/**
 * Flight Phase State Machine
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/flight-phase.js
 *
 * 8 flight phases with automatic transitions based on sim data.
 * PREFLIGHT → TAXI → TAKEOFF → CLIMB → CRUISE → DESCENT → APPROACH → LANDING
 */

class FlightPhase {
    constructor(options = {}) {
        this.PHASES = ['PREFLIGHT', 'TAXI', 'TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH', 'LANDING'];
        this.phase = 'PREFLIGHT';
        this.phaseIndex = 0;
        this.targetCruiseAlt = options.targetCruiseAlt || 8500;
        this.fieldElevation = options.fieldElevation || 0;
        this.destinationDist = Infinity;  // NM to destination
        this.profile = options.profile || null;
        this.onPhaseChange = options.onPhaseChange || null;
        this._lastData = null;
        this._phaseEntryTime = Date.now();
        this._manualPhase = false;
        this._atc = null;
    }

    /** Set ATC controller reference (called from pane.js) */
    setATCController(atc) {
        this._atc = atc || null;
    }

    /**
     * Evaluate phase transitions based on current flight data
     * @param {Object} d - flightData from WebSocket
     * @returns {string} current phase name
     */
    update(d) {
        if (!d || this._manualPhase) return this.phase;
        this._lastData = d;

        const alt = d.altitude || 0;
        const agl = d.altitudeAGL != null ? d.altitudeAGL : alt - this.fieldElevation;
        const gs = d.groundSpeed || 0;
        const ias = d.speed || 0;
        const vs = d.verticalSpeed || 0;
        // MSFS 2024: onGround SimVar is unreliable (reports true at 4000+ AGL).
        // Require BOTH SimVar AND low AGL. Fallback: very low AGL + no climb.
        const onGround = (d.onGround && agl < 50) || (agl < 15 && Math.abs(vs) < 200);
        const gearDown = d.gearDown !== undefined ? d.gearDown : true;
        // MSFS 2024: engineRunning SimVar is unreliable (shows True even at idle/windmilling).
        // Use RPM threshold matching rule-engine-ground.js logic (< 500 = off)
        const engineRunning = (d.engineRpm || 0) >= 500;

        const todNm = this.profile ? (alt - this.fieldElevation) / 1000 * (this.profile.descent.todFactor || 3) : 30;
        const prevPhase = this.phase;

        // ── CATCH-UP: detect current flight state on reconnection ──
        // If we're in PREFLIGHT/TAXI but clearly airborne, jump to the right phase.
        // This handles page reload or AI enable while already in flight.
        if ((this.phase === 'PREFLIGHT' || this.phase === 'TAXI') && !onGround && agl > 100 && ias > 30) {
            if (alt >= this.targetCruiseAlt - 200) {
                this._setPhase('CRUISE');
            } else if (vs >= 50) {
                // Climbing - prioritize over altitude check
                this._setPhase('CLIMB');
            } else if (agl < 2000) {
                // Low altitude, not climbing - likely on approach
                this._setPhase('APPROACH');
            } else {
                // High altitude, level or slight descent - default to climb
                this._setPhase('CLIMB');
            }
        }

        // ── GROUND RESET: if on ground with engine off from airborne phase, reset to PREFLIGHT ──
        // Exclude LANDING phase (has its own LANDING→TAXI transition)
        if (onGround && !engineRunning && this.phaseIndex >= 2 && this.phase !== 'LANDING') {
            // phaseIndex >= 2 means TAKEOFF or later (not PREFLIGHT/TAXI/LANDING)
            this._setPhase('PREFLIGHT');
        }

        switch (this.phase) {
            case 'PREFLIGHT':
                // Transition to TAXI when engine is running, or when on ground with any throttle
                // (AI autopilot sets throttle before engineRunning is detected)
                if ((engineRunning || d.throttle > 10) && onGround) {
                    this._setPhase('TAXI');
                }
                break;

            case 'TAXI':
                // Transition to TAKEOFF early — TAKEOFF ROLL handles full power
                // ATC gate: if ATC controller is active, require CLEARED_TAKEOFF phase
                if (gs > 25 && onGround && (!this._atc || this._atc.getPhase() === 'INACTIVE' || this._atc.getPhase() === 'CLEARED_TAKEOFF')) {
                    this._setPhase('TAKEOFF');
                } else if (gs < 1 && !engineRunning) {
                    this._setPhase('PREFLIGHT');
                }
                break;

            case 'TAKEOFF':
                if (!onGround && agl > 500) {
                    this._setPhase('CLIMB');
                } else if (gs < 10 && onGround) {
                    this._setPhase('TAXI');
                }
                break;

            case 'CLIMB':
                if (alt >= this.targetCruiseAlt - 200) {
                    this._setPhase('CRUISE');
                }
                break;

            case 'CRUISE':
                // Transition to descent when:
                // 1. Distance to destination warrants TOD
                // 2. VS is negative for sustained period (manual descent)
                // 3. Cruise altitude lowered — currently well above new target
                if (this.destinationDist < Math.abs(todNm) && this.destinationDist < 100) {
                    this._setPhase('DESCENT');
                } else if (vs < -300 && alt < this.targetCruiseAlt - 500 && this._phaseAge() > 30000) {
                    this._setPhase('DESCENT');
                } else if (alt > this.targetCruiseAlt + 500 && this._phaseAge() > 5000) {
                    this._setPhase('DESCENT');
                }
                break;

            case 'DESCENT':
                if (agl < 3000 && (d.apAprLock || d.apNavLock)) {
                    this._setPhase('APPROACH');
                } else if (agl < 2000) {
                    this._setPhase('APPROACH');
                }
                break;

            case 'APPROACH':
                if (agl < 200 && gearDown) {
                    this._setPhase('LANDING');
                } else if (alt > this.targetCruiseAlt - 500 && vs > 300) {
                    // Missed approach / go-around — back to climb
                    this._setPhase('CLIMB');
                }
                break;

            case 'LANDING':
                if (onGround && gs < 30) {
                    this._setPhase('TAXI');
                } else if (!onGround && (agl >= 500 || vs > 200)) {
                    // Go-around: climbing from landing or above 500 AGL
                    this._setPhase('CLIMB');
                }
                break;
        }

        return this.phase;
    }

    _setPhase(newPhase) {
        const oldPhase = this.phase;
        this.phase = newPhase;
        this.phaseIndex = this.PHASES.indexOf(newPhase);
        this._phaseEntryTime = Date.now();
        if (this.onPhaseChange) {
            this.onPhaseChange(newPhase, oldPhase);
        }
    }

    _phaseAge() {
        return Date.now() - this._phaseEntryTime;
    }

    /** Force a specific phase (from takeoff tuner) */
    forcePhase(phase) {
        if (this.PHASES.includes(phase)) {
            this._setPhase(phase);
        }
    }

    /** Get progress percentage (0-100) through the flight phases */
    getProgress() {
        return Math.round((this.phaseIndex / (this.PHASES.length - 1)) * 100);
    }

    /** Manually override to a specific phase */
    setManualPhase(phase) {
        if (this.PHASES.includes(phase)) {
            this._manualPhase = true;
            this._setPhase(phase);
        }
    }

    /** Resume automatic phase detection */
    resumeAuto() {
        this._manualPhase = false;
    }

    /** Set target cruise altitude */
    setCruiseAlt(alt) {
        this.targetCruiseAlt = Math.max(1000, Math.min(alt, this.profile?.limits?.ceiling || 45000));
    }

    /** Set distance to destination (NM) for TOD calculation */
    setDestinationDist(nm) {
        this.destinationDist = nm;
    }

    /** Set field elevation for AGL calculations */
    setFieldElevation(ft) {
        this.fieldElevation = ft;
    }

    /** Get current state for serialization */
    getState() {
        return {
            phase: this.phase,
            phaseIndex: this.phaseIndex,
            progress: this.getProgress(),
            targetCruiseAlt: this.targetCruiseAlt,
            manualPhase: this._manualPhase,
            phaseAge: this._phaseAge()
        };
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlightPhase;
}
