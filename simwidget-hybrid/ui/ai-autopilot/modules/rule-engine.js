/**
 * Rule Engine — Per-Phase AP Command Generation
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine.js
 *
 * Produces AP and flight control commands based on current flight phase and aircraft profile.
 * Commands are pushed to the command queue for rate-limited execution.
 * TAKEOFF phase uses sub-phases for procedure-aware control:
 *   BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
 */

class RuleEngine {
    constructor(options = {}) {
        this.profile = options.profile || null;
        this.commandQueue = options.commandQueue || null;
        this._lastPhase = null;
        this._lastCommands = {};  // track what we last commanded per axis
        this._takeoffSubPhase = null;
        this._runwayHeading = null;  // captured at takeoff roll start

        // Terrain awareness (uses shared singleton from terrain-grid.js)
        this._terrainGrid = (typeof window !== 'undefined' && window._terrainGrid) || null;
        this._terrainAlert = null;     // current terrain alert: null | 'CAUTION' | 'WARNING'
        this._lastTerrainCheck = 0;
    }

    /**
     * Evaluate rules for current phase and flight data.
     * Generates AP commands and pushes them to the command queue.
     * @param {string} phase - current flight phase
     * @param {Object} d - flightData from WebSocket
     * @param {Object} apState - current AP engaged states
     */
    evaluate(phase, d, apState) {
        if (!this.profile || !this.commandQueue || !d) return;

        const p = this.profile;
        const speeds = p.speeds;
        const phaseChanged = phase !== this._lastPhase;
        this._lastPhase = phase;

        // Reset takeoff sub-phase when leaving TAKEOFF
        if (phaseChanged && phase !== 'TAKEOFF') {
            this._takeoffSubPhase = null;
            this._runwayHeading = null;
        }

        // Terrain awareness check for airborne phases
        if (phase !== 'PREFLIGHT' && phase !== 'TAXI') {
            this._checkTerrain(d, apState, phase);
        }

        switch (phase) {
            case 'PREFLIGHT':
            case 'TAXI':
                // No AP commands during ground ops
                if (apState.master) {
                    this._cmd('AP_MASTER', false, 'Disengage AP on ground');
                }
                break;

            case 'TAKEOFF':
                this._evaluateTakeoff(d, apState, phaseChanged);
                break;

            case 'CLIMB':
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for climb');
                }
                // Set climb VS and speed
                if (phaseChanged || !apState.vsHold) {
                    this._cmd('AP_VS_HOLD', true, 'VS hold for climb');
                    this._cmdValue('AP_VS_VAR_SET', p.climb.normalRate, 'VS +' + p.climb.normalRate);
                }
                if (phaseChanged || !apState.altitudeHold) {
                    this._cmd('AP_ALT_HOLD', true, 'ALT hold target');
                }
                if (phaseChanged) {
                    this._cmdValue('AP_ALT_VAR_SET', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());
                    this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy)');
                }
                // Transition from HDG to NAV if available
                if (d.apNavLock === false && phaseChanged) {
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                break;

            case 'CRUISE':
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for cruise');
                }
                if (phaseChanged) {
                    // Level off
                    this._cmd('AP_ALT_HOLD', true, 'ALT hold at cruise');
                    this._cmdValue('AP_VS_VAR_SET', 0, 'VS 0 (level)');
                    this._cmdValue('AP_SPD_VAR_SET', speeds.Vcruise, 'SPD ' + speeds.Vcruise + ' (cruise)');
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                break;

            case 'DESCENT':
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for descent');
                }
                if (phaseChanged) {
                    this._cmd('AP_VS_HOLD', true, 'VS hold for descent');
                    this._cmdValue('AP_VS_VAR_SET', p.descent.normalRate, 'VS ' + p.descent.normalRate);
                    this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.DESCENT, 'SPD ' + p.phaseSpeeds.DESCENT);
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                break;

            case 'APPROACH':
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for approach');
                }
                if (phaseChanged) {
                    this._cmd('AP_APR_HOLD', true, 'APR mode');
                    this._cmdValue('AP_VS_VAR_SET', p.descent.approachRate, 'VS ' + p.descent.approachRate);
                    this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.APPROACH, 'SPD ' + p.phaseSpeeds.APPROACH);
                }
                break;

            case 'LANDING':
                // Disengage AP for manual landing
                if (apState.master && d.altitudeAGL < 100) {
                    this._cmd('AP_MASTER', false, 'Disengage AP for landing');
                }
                break;
        }
    }

    /**
     * Takeoff sub-phase state machine.
     * Sub-phases: BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
     */
    _evaluateTakeoff(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;
        const tk = p.takeoff || {};
        const ias = d.speed || 0;
        const agl = d.altitudeAGL || 0;
        const vs = d.verticalSpeed || 0;
        const onGround = d.onGround !== false;

        // Initialize sub-phase on entry
        if (phaseChanged || !this._takeoffSubPhase) {
            this._takeoffSubPhase = 'BEFORE_ROLL';
        }

        // Ensure AP is off during ground roll
        if (onGround && apState.master) {
            this._cmd('AP_MASTER', false, 'AP off for takeoff roll');
        }

        switch (this._takeoffSubPhase) {
            case 'BEFORE_ROLL':
                // Verify configuration: mixture rich, correct flaps
                this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH for takeoff');
                // Advance to ROLL — the flight phase already detected takeoff roll (gs > 40)
                this._takeoffSubPhase = 'ROLL';
                break;

            case 'ROLL':
                // Full throttle
                this._cmdValue('THROTTLE_SET', 100, 'Full throttle');
                // Capture runway heading for later HDG hold
                if (!this._runwayHeading) {
                    this._runwayHeading = Math.round(d.heading || 0);
                }
                // Transition to ROTATE at Vr
                if (ias >= (speeds.Vr || 55)) {
                    this._takeoffSubPhase = 'ROTATE';
                }
                break;

            case 'ROTATE':
                // Pitch up for rotation
                this._cmdValue('AXIS_ELEVATOR_SET', tk.rotationPitch || -25, 'Rotate — pitch up');
                // Transition to LIFTOFF when airborne
                if (!onGround) {
                    this._takeoffSubPhase = 'LIFTOFF';
                }
                break;

            case 'LIFTOFF':
                // Release back-pressure
                this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release pitch — positive climb');
                // Wait for positive climb rate and safe altitude
                if (vs > 200 && agl > (tk.initialClimbAgl || 200)) {
                    this._takeoffSubPhase = 'INITIAL_CLIMB';
                }
                break;

            case 'INITIAL_CLIMB':
                // Engage AP and set climb profile
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP — initial climb');
                }
                this._cmd('AP_HDG_HOLD', true, 'HDG hold runway heading');
                if (this._runwayHeading !== null) {
                    this._cmdValue('HEADING_BUG_SET', this._runwayHeading, 'HDG ' + this._runwayHeading + '\u00B0');
                }
                this._cmd('AP_VS_HOLD', true, 'VS hold for climb');
                this._cmdValue('AP_VS_VAR_SET', p.climb.normalRate, 'VS +' + p.climb.normalRate);
                // Advance to DEPARTURE at flap-retract altitude
                if (agl > (tk.flapRetractAgl || 500)) {
                    this._takeoffSubPhase = 'DEPARTURE';
                }
                break;

            case 'DEPARTURE':
                // Retract flaps, set climb speed, set cruise alt target
                this._cmd('FLAPS_UP', true, 'Retract flaps');
                this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy climb)');
                this._cmdValue('AP_ALT_VAR_SET', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());
                this._cmd('AP_ALT_HOLD', true, 'ALT hold target');
                this._cmd('LANDING_LIGHTS_TOGGLE', true, 'Lights off after departure');
                // Sub-phase complete — flight-phase.js will transition to CLIMB at 200+ AGL
                break;
        }
    }

    /** Get the current takeoff sub-phase (for debug display) */
    getTakeoffSubPhase() {
        return this._takeoffSubPhase;
    }

    /** Get current terrain alert level (for debug display) */
    getTerrainAlert() {
        return this._terrainAlert;
    }

    /**
     * Check terrain ahead and react if necessary.
     * Called from evaluate() during airborne phases.
     * Uses look-ahead along current heading to detect rising terrain.
     * @param {Object} d - flightData
     * @param {Object} apState - autopilot state
     * @param {string} phase - current flight phase
     */
    _checkTerrain(d, apState, phase) {
        if (!this._terrainGrid || !this._terrainGrid.loaded) return;

        // Throttle checks to once per 2 seconds (terrain doesn't change fast)
        const now = Date.now();
        if (now - this._lastTerrainCheck < 2000) return;
        this._lastTerrainCheck = now;

        const lat = d.latitude;
        const lon = d.longitude;
        const hdg = d.heading || 0;
        const alt = d.altitude || 0;         // MSL feet
        const vs = d.verticalSpeed || 0;     // fpm
        const gs = d.groundSpeed || 0;       // knots

        if (!lat || !lon || alt < 100) return; // Skip on ground or no position

        // Look ahead along current heading
        // Check at 2nm, 5nm, and 10nm ahead
        const lookAheadDistances = [2, 5, 10]; // NM
        const cosLat = Math.cos(lat * Math.PI / 180);
        const hdgRad = hdg * Math.PI / 180;

        let worstClearance = Infinity;
        let worstDist = 0;
        let worstElev = 0;

        for (const dist of lookAheadDistances) {
            const dLat = (dist / 60) * Math.cos(hdgRad);
            const dLon = (dist / 60) * Math.sin(hdgRad) / cosLat;
            const checkLat = lat + dLat;
            const checkLon = lon + dLon;

            const terrainFt = this._terrainGrid.getElevationFeet(checkLat, checkLon);
            if (terrainFt <= 0) continue; // Ocean or no data

            // Predict altitude at that distance given current VS and GS
            const timeToReachMin = gs > 30 ? (dist / gs) * 60 : 0; // minutes
            const predictedAlt = alt + (vs * timeToReachMin / 60); // feet at that point
            const clearance = predictedAlt - terrainFt;

            if (clearance < worstClearance) {
                worstClearance = clearance;
                worstDist = dist;
                worstElev = terrainFt;
            }
        }

        // Determine alert level based on predicted clearance
        const prevAlert = this._terrainAlert;

        if (worstClearance < 500) {
            // WARNING: Predicted terrain conflict within 500ft
            this._terrainAlert = 'WARNING';

            if (phase !== 'TAKEOFF' && phase !== 'LANDING') {
                // Climb immediately to clear terrain
                const safeAlt = worstElev + 1500; // 1500ft above highest terrain ahead
                if (apState.master) {
                    this._cmdValue('AP_ALT_VAR_SET', safeAlt, `TERRAIN: climb to ${safeAlt}ft (terrain ${worstElev}ft at ${worstDist}nm)`);
                    this._cmd('AP_VS_HOLD', true, 'TERRAIN: VS hold for climb');
                    this._cmdValue('AP_VS_VAR_SET', 1000, 'TERRAIN: max climb');
                }
            }
        } else if (worstClearance < 1500) {
            // CAUTION: Terrain within 1500ft clearance
            this._terrainAlert = 'CAUTION';
            // Advisory only — no automatic action, let pilot/LLM decide
        } else {
            this._terrainAlert = null;
        }
    }

    /**
     * Push a toggle/boolean AP command
     */
    _cmd(command, value, description) {
        if (this._lastCommands[command] === value) return; // dedup
        this._lastCommands[command] = value;
        this.commandQueue.enqueue({
            type: command,
            value: value,
            description: description || command
        });
    }

    /**
     * Push a value-set AP command (altitude, speed, VS, heading)
     */
    _cmdValue(command, value, description) {
        const lastVal = this._lastCommands[command];
        if (lastVal !== undefined && Math.abs(lastVal - value) < 1) return; // dedup within tolerance
        this._lastCommands[command] = value;
        this.commandQueue.enqueue({
            type: command,
            value: value,
            description: description || `${command} \u2192 ${value}`
        });
    }

    _getCruiseAlt() {
        // Accessed via parent pane's flightPhase module
        return this._targetCruiseAlt || 8500;
    }

    /** Set target cruise altitude (called from pane) */
    setTargetCruiseAlt(alt) {
        this._targetCruiseAlt = alt;
    }

    /** Reset command dedup tracking (e.g., on AI toggle) */
    reset() {
        this._lastCommands = {};
        this._lastPhase = null;
        this._takeoffSubPhase = null;
        this._runwayHeading = null;
    }

    /** Update aircraft profile */
    setProfile(profile) {
        this.profile = profile;
        this.reset();
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
}
