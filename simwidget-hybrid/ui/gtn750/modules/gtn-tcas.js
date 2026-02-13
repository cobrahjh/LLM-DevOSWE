/**
 * GTN TCAS - Traffic Collision Avoidance System
 * Implements TCAS II logic for Traffic Advisories (TA) and Resolution Advisories (RA)
 * Monitors traffic proximity and generates alerts to prevent mid-air collisions
 */

class GTNTCAS {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Configuration (TCAS II parameters)
        this.config = {
            enabled: true,
            sensitivity: 'NORMAL', // NORMAL, ABOVE, BELOW
            taEnabled: true,       // Traffic Advisories
            raEnabled: true,       // Resolution Advisories
            // Proximity zones (nautical miles and feet)
            taHorizontal: 6.0,     // TA horizontal range
            taVertical: 1200,      // TA vertical range (feet)
            raHorizontal: 3.5,     // RA horizontal range
            raVertical: 800,       // RA vertical range (feet)
            // Time-based thresholds (seconds)
            tauTA: 20,             // Time to CPA for TA
            tauRA: 15,             // Time to CPA for RA
            // Altitude-based adjustments
            altitudeBands: [
                { ceiling: 2350, taHorizontal: 3.3, raHorizontal: 2.0 },
                { ceiling: 5000, taHorizontal: 4.8, raHorizontal: 2.8 },
                { ceiling: 10000, taHorizontal: 6.0, raHorizontal: 3.5 },
                { ceiling: 20000, taHorizontal: 7.0, raHorizontal: 4.0 },
                { ceiling: 42000, taHorizontal: 7.0, raHorizontal: 4.0 }
            ]
        };

        // State
        this.threats = new Map(); // Map of callsign -> threat object
        this.activeTA = null;     // Current Traffic Advisory
        this.activeRA = null;     // Current Resolution Advisory
        this.lastAlertTime = 0;
        this.alertCooldown = 3000; // Minimum 3s between alerts

        // Audio context for alerts
        this.audioContext = null;
        this.lastChimeTime = 0;

        // Callbacks
        this.onAlert = options.onAlert || null;
        this.onThreatChange = options.onThreatChange || null;
    }

    /**
     * Enable or disable TCAS
     * @param {boolean} enabled - TCAS enabled state
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.clearAllThreats();
        }
        GTNCore.log(`[TCAS] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Set TCAS sensitivity mode
     * @param {string} mode - 'NORMAL', 'ABOVE', 'BELOW'
     */
    setSensitivity(mode) {
        if (['NORMAL', 'ABOVE', 'BELOW'].includes(mode)) {
            this.config.sensitivity = mode;
            GTNCore.log(`[TCAS] Sensitivity: ${mode}`);
        }
    }

    /**
     * Update TCAS with current traffic and own ship data
     * @param {Array} trafficList - Array of traffic objects
     * @param {Object} ownShip - Own ship position and velocity
     */
    update(trafficList, ownShip) {
        if (!this.config.enabled || !ownShip) {
            return;
        }

        const currentTime = Date.now();

        // Clear old threats
        this.clearStaleThreats(trafficList);

        // Adjust thresholds based on altitude
        this.adjustThresholdsForAltitude(ownShip.altitude);

        // Process each traffic target
        trafficList.forEach(traffic => {
            this.processThreat(traffic, ownShip, currentTime);
        });

        // Determine highest priority threat
        this.updateActiveThreat();
    }

    /**
     * Clear threats no longer in traffic list
     * @param {Array} currentTraffic - Current traffic list
     */
    clearStaleThreats(currentTraffic) {
        const currentCallsigns = new Set(currentTraffic.map(t => t.callsign));
        for (const [callsign, threat] of this.threats.entries()) {
            if (!currentCallsigns.has(callsign)) {
                this.threats.delete(callsign);
            }
        }
    }

    /**
     * Adjust detection thresholds based on altitude
     * @param {number} altitude - Current altitude (feet MSL)
     */
    adjustThresholdsForAltitude(altitude) {
        const band = this.config.altitudeBands.find(b => altitude < b.ceiling);
        if (band) {
            this.config.taHorizontal = band.taHorizontal;
            this.config.raHorizontal = band.raHorizontal;
        }
    }

    /**
     * Process individual traffic target for threat assessment
     * @param {Object} traffic - Traffic target data
     * @param {Object} ownShip - Own ship data
     * @param {number} currentTime - Current timestamp
     */
    processThreat(traffic, ownShip, currentTime) {
        const callsign = traffic.callsign || traffic.hexCode;

        // Calculate relative geometry
        const geometry = this.calculateGeometry(traffic, ownShip);

        // Classify threat level
        const threatLevel = this.classifyThreat(geometry, ownShip);

        // Calculate tau (time to closest point of approach)
        const tau = this.calculateTau(geometry);

        // Determine if TA or RA is warranted
        const isTA = this.isTrafficAdvisory(geometry, tau, threatLevel);
        const isRA = this.isResolutionAdvisory(geometry, tau, threatLevel);

        // Create or update threat object
        const threat = {
            callsign,
            traffic,
            geometry,
            tau,
            threatLevel,
            isTA,
            isRA,
            timestamp: currentTime
        };

        // Calculate RA sense (climb/descend) if needed
        if (isRA) {
            threat.raSense = this.calculateRASense(traffic, ownShip, geometry);
            threat.raVS = this.calculateRAVerticalSpeed(threat.raSense, geometry);
        }

        this.threats.set(callsign, threat);
    }

    /**
     * Calculate relative geometry between traffic and own ship
     * @param {Object} traffic - Traffic target
     * @param {Object} ownShip - Own ship
     * @returns {Object} Geometry data
     */
    calculateGeometry(traffic, ownShip) {
        // Horizontal distance and bearing
        const distance = this.core.calculateDistance(
            ownShip.latitude, ownShip.longitude,
            traffic.lat, traffic.lon
        );

        const bearing = this.core.calculateBearing(
            ownShip.latitude, ownShip.longitude,
            traffic.lat, traffic.lon
        );

        // Vertical separation
        const altitudeSeparation = traffic.altitude - ownShip.altitude;

        // Closure rate (horizontal)
        const ownHeading = ownShip.heading || ownShip.track || 0;
        const ownSpeed = ownShip.groundSpeed || 0;
        const trafficHeading = traffic.heading || traffic.track || 0;
        const trafficSpeed = traffic.groundSpeed || 0;

        // Calculate closing velocity using relative velocity vector
        const ownVelX = ownSpeed * Math.sin(this.core.toRad(ownHeading));
        const ownVelY = ownSpeed * Math.cos(this.core.toRad(ownHeading));
        const trafficVelX = trafficSpeed * Math.sin(this.core.toRad(trafficHeading));
        const trafficVelY = trafficSpeed * Math.cos(this.core.toRad(trafficHeading));

        const relVelX = trafficVelX - ownVelX;
        const relVelY = trafficVelY - ownVelY;
        const closureRate = Math.sqrt(relVelX * relVelX + relVelY * relVelY);

        // Vertical closure rate
        const ownVS = ownShip.verticalSpeed || 0;
        const trafficVS = traffic.verticalSpeed || 0;
        const verticalClosureRate = Math.abs(trafficVS - ownVS);

        return {
            distance,
            bearing,
            altitudeSeparation,
            closureRate,
            verticalClosureRate,
            relativeAltitude: altitudeSeparation
        };
    }

    /**
     * Calculate tau (time to closest point of approach)
     * @param {Object} geometry - Relative geometry
     * @returns {number} Tau in seconds (or Infinity if not closing)
     */
    calculateTau(geometry) {
        if (geometry.closureRate < 10) {
            return Infinity; // Not closing
        }

        // Horizontal tau
        const tauHorizontal = (geometry.distance / geometry.closureRate) * 3600; // Convert to seconds

        // Vertical tau
        let tauVertical = Infinity;
        if (geometry.verticalClosureRate > 50) {
            tauVertical = Math.abs(geometry.altitudeSeparation / geometry.verticalClosureRate) * 60;
        }

        // Return minimum tau (most critical dimension)
        return Math.min(tauHorizontal, tauVertical);
    }

    /**
     * Classify threat level based on proximity
     * @param {Object} geometry - Relative geometry
     * @param {Object} ownShip - Own ship data
     * @returns {string} Threat level
     */
    classifyThreat(geometry, ownShip) {
        const inRAZone = geometry.distance < this.config.raHorizontal &&
                         Math.abs(geometry.altitudeSeparation) < this.config.raVertical;

        const inTAZone = geometry.distance < this.config.taHorizontal &&
                         Math.abs(geometry.altitudeSeparation) < this.config.taVertical;

        if (inRAZone) return 'RA_ZONE';
        if (inTAZone) return 'TA_ZONE';
        if (geometry.distance < 10) return 'PROXIMATE';
        return 'OTHER';
    }

    /**
     * Determine if Traffic Advisory is warranted
     * @param {Object} geometry - Relative geometry
     * @param {number} tau - Time to CPA
     * @param {string} threatLevel - Threat classification
     * @returns {boolean} True if TA warranted
     */
    isTrafficAdvisory(geometry, tau, threatLevel) {
        if (!this.config.taEnabled) return false;

        return (threatLevel === 'TA_ZONE' || threatLevel === 'RA_ZONE') &&
               tau < this.config.tauTA;
    }

    /**
     * Determine if Resolution Advisory is warranted
     * @param {Object} geometry - Relative geometry
     * @param {number} tau - Time to CPA
     * @param {string} threatLevel - Threat classification
     * @returns {boolean} True if RA warranted
     */
    isResolutionAdvisory(geometry, tau, threatLevel) {
        if (!this.config.raEnabled) return false;

        return threatLevel === 'RA_ZONE' && tau < this.config.tauRA;
    }

    /**
     * Calculate RA sense (climb or descend)
     * @param {Object} traffic - Traffic target
     * @param {Object} ownShip - Own ship
     * @param {Object} geometry - Relative geometry
     * @returns {string} 'CLIMB' or 'DESCEND'
     */
    calculateRASense(traffic, ownShip, geometry) {
        const trafficVS = traffic.verticalSpeed || 0;
        const ownVS = ownShip.verticalSpeed || 0;

        // If traffic is above and climbing, descend
        // If traffic is below and descending, climb
        if (geometry.altitudeSeparation > 0) {
            return trafficVS > 0 ? 'DESCEND' : 'CLIMB';
        } else {
            return trafficVS < 0 ? 'CLIMB' : 'DESCEND';
        }
    }

    /**
     * Calculate required vertical speed for RA
     * @param {string} sense - 'CLIMB' or 'DESCEND'
     * @param {Object} geometry - Relative geometry
     * @returns {number} Required VS in fpm
     */
    calculateRAVerticalSpeed(sense, geometry) {
        // TCAS II typically commands 1500-2500 fpm based on urgency
        const urgency = Math.abs(geometry.altitudeSeparation);

        if (urgency < 400) {
            return sense === 'CLIMB' ? 2500 : -2500; // Urgent
        } else if (urgency < 600) {
            return sense === 'CLIMB' ? 2000 : -2000; // High priority
        } else {
            return sense === 'CLIMB' ? 1500 : -1500; // Standard
        }
    }

    /**
     * Update active TA/RA based on highest priority threat
     */
    updateActiveThreat() {
        const previousTA = this.activeTA;
        const previousRA = this.activeRA;

        // Find highest priority RA
        let highestRA = null;
        let lowestRATau = Infinity;

        for (const threat of this.threats.values()) {
            if (threat.isRA && threat.tau < lowestRATau) {
                highestRA = threat;
                lowestRATau = threat.tau;
            }
        }

        this.activeRA = highestRA;

        // If no RA, check for TA
        if (!this.activeRA) {
            let highestTA = null;
            let lowestTATau = Infinity;

            for (const threat of this.threats.values()) {
                if (threat.isTA && threat.tau < lowestTATau) {
                    highestTA = threat;
                    lowestTATau = threat.tau;
                }
            }

            this.activeTA = highestTA;
        } else {
            this.activeTA = null; // RA supersedes TA
        }

        // Trigger alerts for new threats
        const now = Date.now();
        if (this.activeRA && !previousRA && now - this.lastAlertTime > this.alertCooldown) {
            this.triggerRAAlert(this.activeRA);
            this.lastAlertTime = now;
        } else if (this.activeTA && !previousTA && !this.activeRA && now - this.lastAlertTime > this.alertCooldown) {
            this.triggerTAAlert(this.activeTA);
            this.lastAlertTime = now;
        }

        // Notify of threat changes
        if (typeof this.onThreatChange === 'function') {
            this.onThreatChange(this.activeRA, this.activeTA);
        }
    }

    /**
     * Trigger Traffic Advisory alert
     * @param {Object} threat - Threat object
     */
    triggerTAAlert(threat) {
        const message = `Traffic, Traffic`;
        GTNCore.log(`[TCAS] TA: ${message} - ${threat.callsign} at ${threat.geometry.distance.toFixed(1)}nm`);

        this.playTAChime();

        if (typeof this.onAlert === 'function') {
            this.onAlert('TA', message, 'warning', threat);
        }
    }

    /**
     * Trigger Resolution Advisory alert
     * @param {Object} threat - Threat object
     */
    triggerRAAlert(threat) {
        const sense = threat.raSense;
        const vs = Math.abs(threat.raVS);
        const message = `${sense}, ${sense}`;

        GTNCore.log(`[TCAS] RA: ${message} ${vs} FPM - ${threat.callsign}`);

        this.playRAChime();

        if (typeof this.onAlert === 'function') {
            this.onAlert('RA', message, 'critical', threat);
        }
    }

    /**
     * Play Traffic Advisory chime
     */
    playTAChime() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Create oscillator for TA tone (500Hz, two quick beeps)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = 500;
            gain.gain.value = 0.08;

            // Two 0.15s beeps with 0.1s gap
            osc.start(now);
            osc.stop(now + 0.15);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 500;
            gain2.gain.value = 0.08;
            osc2.start(now + 0.25);
            osc2.stop(now + 0.40);

        } catch (e) {
            GTNCore.log(`[TCAS] Audio failed: ${e.message}`);
        }
    }

    /**
     * Play Resolution Advisory chime
     */
    playRAChime() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Create oscillator for RA tone (800Hz, urgent beeping)
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = 800;
                gain.gain.value = 0.1;

                const startTime = now + (i * 0.2);
                osc.start(startTime);
                osc.stop(startTime + 0.1);
            }

        } catch (e) {
            GTNCore.log(`[TCAS] Audio failed: ${e.message}`);
        }
    }

    /**
     * Clear all threats
     */
    clearAllThreats() {
        this.threats.clear();
        this.activeTA = null;
        this.activeRA = null;
    }

    /**
     * Get TCAS status for display
     * @returns {Object} TCAS status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            taEnabled: this.config.taEnabled,
            raEnabled: this.config.raEnabled,
            sensitivity: this.config.sensitivity,
            threatCount: this.threats.size,
            activeTA: this.activeTA,
            activeRA: this.activeRA,
            hasTA: this.activeTA !== null,
            hasRA: this.activeRA !== null,
            statusColor: this.getStatusColor(),
            statusLabel: this.getStatusLabel()
        };
    }

    /**
     * Get status color based on active threats
     * @returns {string} CSS color
     */
    getStatusColor() {
        if (this.activeRA) return '#ff0000'; // Red - Resolution Advisory
        if (this.activeTA) return '#ffff00'; // Yellow - Traffic Advisory
        if (this.threats.size > 0) return '#00ffff'; // Cyan - Traffic present
        return '#00ff00'; // Green - Clear
    }

    /**
     * Get status label
     * @returns {string} Status label
     */
    getStatusLabel() {
        if (this.activeRA) return 'RA';
        if (this.activeTA) return 'TA';
        if (this.threats.size > 0) return 'TFC';
        return 'CLEAR';
    }

    /**
     * Get all threats for display
     * @returns {Array} Array of threat objects
     */
    getThreats() {
        return Array.from(this.threats.values());
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clearAllThreats();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        GTNCore.log('[TCAS] Destroyed');
    }
}

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNTCAS;
}
