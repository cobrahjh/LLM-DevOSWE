/**
 * Rule Engine Ground Operations
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine-ground.js
 *
 * Handles ground phases: PREFLIGHT and TAXI
 * Extends RuleEngineCore with phase-specific logic for ground operations.
 * Includes engine start, brake management, and ground steering.
 *
 * Refactored 2026-02-14 for memory optimization via lazy loading.
 */

// Load base class (Node.js environment only, not browser)
if (typeof RuleEngineCore === 'undefined' && typeof require !== 'undefined' && typeof window === 'undefined') {
    const RuleEngineCoreModule = require('./rule-engine-core.js');
    global.RuleEngineCore = RuleEngineCoreModule.RuleEngineCore;
}

class RuleEngineGround extends RuleEngineCore {
    constructor(options = {}) {
        super(options);

        // Ground-specific state
        this._engineStartAttempt = null;  // timestamp of last ENGINE_AUTO_START attempt
    }

    /**
     * Phase-specific evaluation for ground operations
     * @param {string} phase - current flight phase
     * @param {Object} d - flight data
     * @param {Object} apState - autopilot state
     * @param {boolean} phaseChanged - true if phase just changed
     */
    _evaluatePhase(phase, d, apState, phaseChanged) {
        // Reset preflight flag when entering PREFLIGHT phase
        if (phase === 'PREFLIGHT' && phaseChanged) {
            this._preflightReadySent = false;
        }

        switch (phase) {
            case 'PREFLIGHT':
                this._evaluatePreflight(d, apState);
                break;

            case 'TAXI':
                this._evaluateTaxi(d, apState, phaseChanged);
                break;

            default:
                console.warn(`RuleEngineGround: Unknown phase ${phase}`);
        }
    }

    /**
     * PREFLIGHT phase handler
     * Prepares aircraft for taxi: mixture rich, release brake, idle-up throttle
     */
    _evaluatePreflight(d, apState) {
        // No AP during preflight — force-clear dedup (toggle can be stale)
        if (apState.master) {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', false, 'Disengage AP on ground');
        }

        // Quick preflight: removes chocks, covers, completes preflight
        // Only send once per preflight phase
        if (!this._preflightReadySent) {
            // Force-clear dedup cache to ensure command sends
            delete this._lastCommands['QUICK_PREFLIGHT'];
            this._cmd('QUICK_PREFLIGHT', true, 'Quick preflight (removes chocks/covers)');
            this._preflightReadySent = true;
        }

        // Prepare aircraft for taxi
        const tt = this._getTakeoffTuning();
        this._cmdValue('MIXTURE_SET', tt.preflightMixture ?? 100, 'Mixture RICH');
        // Idempotent brake release (server uses LANDING_GEAR_PARKINGBRAKE InputEvent)
        this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake for taxi');
        this._cmdValue('THROTTLE_SET', tt.preflightThrottle ?? 20, 'Idle-up throttle');

        // Capture heading and start steering immediately — don't wait for TAXI
        if (!this._runwayHeading) {
            if (this._activeRunway?.heading) {
                this._runwayHeading = this._activeRunway.heading;
            } else {
                this._runwayHeading = Math.round(d.heading || 0);
            }
        }
        if (d.groundSpeed > 0.5) {
            this._groundSteer(d, this._runwayHeading);
        }
    }

    /**
     * TAXI phase handler
     * Manages engine start, ATC coordination, ground steering, and speed control
     */
    _evaluateTaxi(d, apState, phaseChanged) {
        // Disengage AP on ground — force-clear dedup (toggle can be stale)
        if (apState.master) {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', false, 'Disengage AP on ground');
        }
        this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH for takeoff');

        // Brake release on entry (idempotent via PARKING_BRAKE_SET)
        if (phaseChanged) {
            this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake');
        }

        // Engine auto-start: ENGINE_AUTO_START is a TOGGLE, so sending it
        // when engine is already cranking will STOP the start sequence.
        // Only send when engine RPM is genuinely low, and retry every 8s
        // in case the toggle landed in the wrong state.
        if ((d.engineRpm || 0) < 500) {
            if (!this._engineStartAttempt || (Date.now() - this._engineStartAttempt) > 8000) {
                this._engineStartAttempt = Date.now();
                // Clear BOTH rule engine dedup AND command queue dedup —
                // command queue's _isDuplicate() caches ENGINE_AUTO_START=true
                // and silently drops retries.
                delete this._lastCommands['ENGINE_AUTO_START'];
                if (this.commandQueue._currentApState) {
                    delete this.commandQueue._currentApState['ENGINE_AUTO_START'];
                }
                this._cmd('ENGINE_AUTO_START', true, 'Engine auto-start (retry)');
            }
        }

        // ATC hold-short gate: if ATC is active and we're at HOLD_SHORT,
        // stop the aircraft and wait for clearance
        if (this._atc && (this._atc.getPhase() === 'HOLD_SHORT' || this._atc.getPhase() === 'TAKEOFF_CLEARANCE_PENDING')) {
            this._cmdValue('THROTTLE_SET', 0, 'Hold short — awaiting clearance');
            if ((d.groundSpeed || 0) < 1) {
                this._cmdValue('PARKING_BRAKE_SET', 1, 'Parking brake — hold short');
            }
            return;
        }

        // ATC cleared for takeoff: full power to accelerate past 25kt → TAKEOFF phase
        if (this._atc && this._atc.getPhase() === 'CLEARED_TAKEOFF') {
            this._cmdValue('PARKING_BRAKE_SET', 0, 'Brake off — cleared for takeoff');
            // Set runway heading from ATC runway ident (e.g., "RW34C" → 340°).
            // MUST override any stale gate heading from PREFLIGHT.
            if (this._atc._runway) {
                const rwyNum = parseInt(this._atc._runway.replace(/^RW/, ''));
                if (!isNaN(rwyNum)) {
                    this._runwayHeading = rwyNum * 10;
                }
            }
            if (!this._runwayHeading) {
                this._runwayHeading = Math.round(d.heading || 0);
            }
            this._groundSteer(d, this._runwayHeading);
            this._cmdValue('THROTTLE_SET', 100, 'Full power — takeoff roll');
            return;
        }

        // Use ATC waypoint for steering if available, else runway heading
        let steerTarget;
        if (this._atc && this._atc.getPhase() === 'TAXIING') {
            const wp = this._atc.getNextWaypoint();
            if (wp) steerTarget = wp.bearing;
        }

        if (steerTarget == null) {
            // Capture runway heading from current aircraft heading.
            // Only recapture if truly stationary (GS < 1) AND we haven't started rolling.
            // Once we've moved (GS > 3), lock the heading permanently.
            const gs = d.groundSpeed || 0;
            const curHdg = Math.round(d.heading || 0);
            if (gs > 3) this._runwayHeadingLocked = true;
            if (!this._runwayHeading) {
                this._runwayHeading = curHdg;
            } else if (!this._runwayHeadingLocked && gs < 1) {
                // Pre-roll correction only — stale startup data fix
                const err = Math.abs(((curHdg - this._runwayHeading + 540) % 360) - 180);
                if (err > 45) {
                    this._runwayHeading = curHdg;
                }
            }
            steerTarget = this._runwayHeading;
        }

        this._groundSteer(d, steerTarget);

        // Heading-aware throttle control
        const gs = d.groundSpeed || 0;
        const hdg = d.heading || 0;
        const hdgError = Math.abs(((hdg - steerTarget + 540) % 360) - 180);

        // Heading-aware throttle: reduce when misaligned but keep minimum
        // for nosewheel steering authority (15% stalls the correction loop)
        // Values overridable via takeoff-tuner.html
        const tt = this._getTakeoffTuning();
        const thrMax = tt.taxiThrottleMax ?? 40;
        const targetGS = tt.taxiTargetGS ?? 12;
        let thr;

        if (gs < 5) {
            // Breakaway / acceleration — keep high throttle until established taxi speed.
            // C172 needs ~40% to start rolling and maintain speed during turns.
            // Don't reduce for heading error until we have taxi speed — nosewheel
            // needs forward momentum to actually turn the aircraft.
            thr = tt.taxiBreakawayThrottle ?? 40;
        } else {
            // Speed-proportional: target 25%, ramp with speed error
            // Allow heading error to reduce throttle only when we have speed
            const speedError = targetGS - gs;
            const hdgPenalty = hdgError > 30 ? (hdgError - 30) * 0.15 : 0;
            thr = Math.max(20, Math.min(thrMax, 25 + speedError * (tt.taxiSpeedGain ?? 1.5) - hdgPenalty));
        }

        this._cmdValue('THROTTLE_SET', Math.round(thr), `Taxi (GS ${Math.round(gs)}, hdg err ${Math.round(hdgError)}°)`);
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngineGround };
}
if (typeof window !== 'undefined') {
    window.RuleEngineGround = RuleEngineGround;
}
