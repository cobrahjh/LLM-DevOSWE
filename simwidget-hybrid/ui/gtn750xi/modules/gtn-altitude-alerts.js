/**
 * GTN Altitude Alerts - Altitude monitoring and deviation warnings
 * Prevents altitude busts and provides situational awareness for IFR operations
 */

class GTNAltitudeAlerts {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Assigned altitude (pilot-set target)
        this.assignedAltitude = null;

        // Alert thresholds (feet)
        this.THRESHOLDS = {
            APPROACH_WARNING: 1000,    // Warning at 1000ft before target
            PROXIMITY_WARNING: 200,    // Proximity alert at 200ft
            CAPTURE_WINDOW: 100,       // Captured within ±100ft
            DEVIATION_ALERT: 300,      // Deviation alert if >300ft off
            MDA_WARNING: 100,          // Warn 100ft before MDA
            DA_WARNING: 100            // Warn 100ft before DA
        };

        // Alert state machine
        this.state = 'IDLE'; // IDLE, ARMED, APPROACHING, PROXIMITY, CAPTURED, HOLDING, DEVIATION
        this.previousState = null;

        // Altitude history for trend detection
        this.altitudeHistory = [];
        this.historyMaxLength = 10; // Last 10 samples (~1 second at 10Hz)

        // Audio context for alert chimes
        this.audioContext = null;
        this.lastChimeTime = 0;
        this.chimeMinInterval = 2000; // Minimum 2s between chimes

        // Approach altitude warnings
        this.approachAltitude = null; // MDA or DA from active approach
        this.approachAltitudeType = null; // 'MDA' or 'DA'
        this.approachAltitudeWarned = false;

        // Callbacks
        this.onAlert = options.onAlert || null; // Function to call on alert
    }

    /**
     * Set assigned altitude (pilot target)
     * @param {number} altitude - Target altitude in feet MSL
     */
    setAssignedAltitude(altitude) {
        if (altitude !== null && altitude !== undefined) {
            this.assignedAltitude = Math.round(altitude);
            if (this.state === 'IDLE') {
                this.state = 'ARMED';
            }
            GTNCore.log(`[AltitudeAlerts] Assigned altitude set: ${this.assignedAltitude}ft`);
        } else {
            this.assignedAltitude = null;
            this.state = 'IDLE';
        }
    }

    /**
     * Set approach altitude (MDA or DA from procedure)
     * @param {number} altitude - Approach altitude in feet MSL
     * @param {string} type - 'MDA' or 'DA'
     */
    setApproachAltitude(altitude, type) {
        this.approachAltitude = altitude;
        this.approachAltitudeType = type || 'MDA';
        this.approachAltitudeWarned = false;
        GTNCore.log(`[AltitudeAlerts] Approach altitude set: ${type} ${altitude}ft`);
    }

    /**
     * Clear approach altitude
     */
    clearApproachAltitude() {
        this.approachAltitude = null;
        this.approachAltitudeType = null;
        this.approachAltitudeWarned = false;
    }

    /**
     * Update altitude alerts with current flight data
     * @param {Object} data - Flight data (altitude, verticalSpeed, etc.)
     */
    update(data) {
        if (!data || data.altitude === undefined) return;

        const currentAltitude = data.altitude;
        const verticalSpeed = data.verticalSpeed || 0;

        // Update altitude history for trend detection
        this.altitudeHistory.push(currentAltitude);
        if (this.altitudeHistory.length > this.historyMaxLength) {
            this.altitudeHistory.shift();
        }

        // Check approach altitude warnings
        this.checkApproachAltitude(currentAltitude, verticalSpeed);

        // Update assigned altitude state machine
        if (this.assignedAltitude !== null) {
            this.updateAssignedAltitudeState(currentAltitude, verticalSpeed);
        }
    }

    /**
     * Update state machine for assigned altitude monitoring
     * @param {number} currentAltitude - Current altitude MSL (feet)
     * @param {number} verticalSpeed - Current vertical speed (fpm)
     */
    updateAssignedAltitudeState(currentAltitude, verticalSpeed) {
        const deviation = currentAltitude - this.assignedAltitude;
        const absDeviation = Math.abs(deviation);

        this.previousState = this.state;

        switch (this.state) {
            case 'ARMED':
                // Waiting for approach to target altitude
                if (absDeviation < this.THRESHOLDS.CAPTURE_WINDOW) {
                    this.state = 'CAPTURED';
                    this.triggerAlert('ALTITUDE_CAPTURED', `Captured ${this.assignedAltitude}ft`, 'success');
                } else if (absDeviation < this.THRESHOLDS.APPROACH_WARNING) {
                    this.state = 'APPROACHING';
                    this.triggerAlert('ALTITUDE_APPROACHING', `Approaching ${this.assignedAltitude}ft`, 'info');
                }
                break;

            case 'APPROACHING':
                // Within 1000ft, approaching target
                if (absDeviation < this.THRESHOLDS.CAPTURE_WINDOW) {
                    this.state = 'CAPTURED';
                    this.triggerAlert('ALTITUDE_CAPTURED', `Captured ${this.assignedAltitude}ft`, 'success');
                } else if (absDeviation < this.THRESHOLDS.PROXIMITY_WARNING) {
                    this.state = 'PROXIMITY';
                    this.triggerAlert('ALTITUDE_PROXIMITY', `${Math.round(absDeviation)}ft to assigned`, 'warning');
                } else if (absDeviation >= this.THRESHOLDS.APPROACH_WARNING) {
                    this.state = 'ARMED';
                }
                break;

            case 'PROXIMITY':
                // Within 200ft, very close to target
                if (absDeviation < this.THRESHOLDS.CAPTURE_WINDOW) {
                    this.state = 'CAPTURED';
                    this.triggerAlert('ALTITUDE_CAPTURED', `Captured ${this.assignedAltitude}ft`, 'success');
                } else if (absDeviation >= this.THRESHOLDS.PROXIMITY_WARNING && absDeviation < this.THRESHOLDS.APPROACH_WARNING) {
                    this.state = 'APPROACHING';
                } else if (absDeviation >= this.THRESHOLDS.APPROACH_WARNING) {
                    this.state = 'ARMED';
                }
                break;

            case 'CAPTURED':
                // Within ±100ft of target, captured
                if (absDeviation >= this.THRESHOLDS.CAPTURE_WINDOW) {
                    // Check if still holding or deviating significantly
                    if (absDeviation < this.THRESHOLDS.PROXIMITY_WARNING) {
                        this.state = 'HOLDING';
                    } else if (absDeviation >= this.THRESHOLDS.DEVIATION_ALERT) {
                        this.state = 'DEVIATION';
                        this.triggerAlert('ALTITUDE_DEVIATION', `Altitude deviation ${Math.round(absDeviation)}ft`, 'critical');
                    } else {
                        this.state = 'PROXIMITY';
                    }
                }
                break;

            case 'HOLDING':
                // Holding near assigned altitude (within 200ft but outside capture window)
                if (absDeviation < this.THRESHOLDS.CAPTURE_WINDOW) {
                    this.state = 'CAPTURED';
                } else if (absDeviation >= this.THRESHOLDS.DEVIATION_ALERT) {
                    this.state = 'DEVIATION';
                    this.triggerAlert('ALTITUDE_DEVIATION', `Altitude deviation ${Math.round(absDeviation)}ft`, 'critical');
                } else if (absDeviation >= this.THRESHOLDS.PROXIMITY_WARNING && absDeviation < this.THRESHOLDS.APPROACH_WARNING) {
                    this.state = 'APPROACHING';
                }
                break;

            case 'DEVIATION':
                // Significant deviation from assigned altitude
                if (absDeviation < this.THRESHOLDS.DEVIATION_ALERT) {
                    this.state = 'HOLDING';
                } else if (absDeviation < this.THRESHOLDS.PROXIMITY_WARNING) {
                    this.state = 'PROXIMITY';
                }
                // Repeat deviation alert every 5 seconds if still deviating
                if (Date.now() - this.lastChimeTime > 5000) {
                    this.triggerAlert('ALTITUDE_DEVIATION', `Altitude deviation ${Math.round(absDeviation)}ft`, 'critical');
                }
                break;
        }
    }

    /**
     * Check approach altitude warnings (MDA/DA)
     * @param {number} currentAltitude - Current altitude MSL (feet)
     * @param {number} verticalSpeed - Current vertical speed (fpm)
     */
    checkApproachAltitude(currentAltitude, verticalSpeed) {
        if (!this.approachAltitude || this.approachAltitudeWarned) return;

        const deviation = currentAltitude - this.approachAltitude;
        const threshold = this.THRESHOLDS.MDA_WARNING;

        // Warn if descending and within threshold above approach altitude
        if (verticalSpeed < -100 && deviation > 0 && deviation < threshold) {
            this.approachAltitudeWarned = true;
            this.triggerAlert(
                'APPROACH_ALTITUDE',
                `Approaching ${this.approachAltitudeType} ${this.approachAltitude}ft`,
                'warning'
            );
        }
    }

    /**
     * Trigger an altitude alert
     * @param {string} type - Alert type identifier
     * @param {string} message - Alert message
     * @param {string} level - Alert level ('info', 'warning', 'success', 'critical')
     */
    triggerAlert(type, message, level) {
        const now = Date.now();

        // Throttle chimes
        if (now - this.lastChimeTime < this.chimeMinInterval && level !== 'critical') {
            return;
        }

        GTNCore.log(`[AltitudeAlerts] ${level.toUpperCase()}: ${message}`);

        // Play audio chime
        this.playChime(level);
        this.lastChimeTime = now;

        // Call external callback if provided
        if (typeof this.onAlert === 'function') {
            this.onAlert(type, message, level);
        }
    }

    /**
     * Play alert chime
     * @param {string} level - Alert level
     */
    playChime(level) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Create oscillator for tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Different tones for different alert levels
            let frequency, duration, pattern;
            switch (level) {
                case 'critical':
                    frequency = 800;
                    duration = 0.3;
                    pattern = [0, 0.15]; // Double beep
                    break;
                case 'warning':
                    frequency = 660;
                    duration = 0.2;
                    pattern = [0]; // Single beep
                    break;
                case 'success':
                    frequency = 880;
                    duration = 0.15;
                    pattern = [0, 0.1, 0.2]; // Triple beep
                    break;
                case 'info':
                default:
                    frequency = 440;
                    duration = 0.1;
                    pattern = [0]; // Single beep
            }

            osc.frequency.value = frequency;
            gain.gain.value = 0.05; // Low volume

            // Play pattern
            pattern.forEach((delay, i) => {
                const startTime = now + delay;
                const endTime = startTime + duration;

                const o = i === 0 ? osc : ctx.createOscillator();
                const g = i === 0 ? gain : ctx.createGain();

                if (i > 0) {
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.frequency.value = frequency;
                    g.gain.value = 0.05;
                }

                o.start(startTime);
                o.stop(endTime);
            });

        } catch (e) {
            // Audio API not available or blocked
            GTNCore.log(`[AltitudeAlerts] Audio chime failed: ${e.message}`);
        }
    }

    /**
     * Get current alert status for display
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            assignedAltitude: this.assignedAltitude,
            state: this.state,
            stateColor: this.getStateColor(),
            stateLabel: this.getStateLabel(),
            approachAltitude: this.approachAltitude,
            approachAltitudeType: this.approachAltitudeType
        };
    }

    /**
     * Get color for current alert state
     * @returns {string} CSS color
     */
    getStateColor() {
        switch (this.state) {
            case 'CAPTURED':
            case 'HOLDING':
                return '#00ff00'; // Green - on target
            case 'PROXIMITY':
                return '#ffaa00'; // Amber - very close
            case 'APPROACHING':
                return '#ffff00'; // Yellow - approaching
            case 'DEVIATION':
                return '#ff0000'; // Red - deviation
            case 'ARMED':
                return '#00ffff'; // Cyan - armed
            default:
                return '#808080'; // Gray - idle
        }
    }

    /**
     * Get label for current alert state
     * @returns {string} State label
     */
    getStateLabel() {
        switch (this.state) {
            case 'CAPTURED': return 'CAPTURED';
            case 'HOLDING': return 'HOLDING';
            case 'PROXIMITY': return 'PROXIMITY';
            case 'APPROACHING': return 'APPROACHING';
            case 'DEVIATION': return 'DEVIATION';
            case 'ARMED': return 'ARMED';
            default: return '';
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        GTNCore.log('[AltitudeAlerts] Destroyed');
    }
}

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNAltitudeAlerts;
}
