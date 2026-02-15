/**
 * Rule Engine Takeoff Operations
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine-takeoff.js
 *
 * Handles takeoff and departure phases: TAKEOFF and DEPARTURE
 * Extends RuleEngineCore with phase-specific logic for takeoff operations.
 * Includes sub-phases: BEFORE_ROLL, ROLL, ROTATE, LIFTOFF, INITIAL_CLIMB, DEPARTURE.
 *
 * Refactored 2026-02-14 for memory optimization via lazy loading.
 */

// Load base class (Node.js environment only, not browser)
if (typeof RuleEngineCore === 'undefined' && typeof require !== 'undefined' && typeof window === 'undefined') {
    var { RuleEngineCore } = require('./rule-engine-core.js');
}

class RuleEngineTakeoff extends RuleEngineCore {
    constructor(options = {}) {
        super(options);

        // Takeoff-specific state
        this._takeoffSubPhase = null;       // Current sub-phase within TAKEOFF
        this._rotateStartTime = null;       // Timestamp when rotation began
        this._runwayHeading = null;         // Runway heading for ground steering
    }

    /**
     * Phase-specific evaluation for takeoff operations
     * @param {string} phase - current flight phase
     * @param {Object} d - flight data
     * @param {Object} apState - autopilot state
     * @param {boolean} phaseChanged - true if phase just changed
     */
    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'TAKEOFF':
                this._evaluateTakeoff(d, apState, phaseChanged);
                break;

            case 'DEPARTURE':
                // DEPARTURE is handled as sub-phase of TAKEOFF
                this._evaluateTakeoff(d, apState, phaseChanged);
                break;

            default:
                console.warn(`RuleEngineTakeoff: Unknown phase ${phase}`);
        }
    }

    /**
     * TAKEOFF phase handler
     * Sub-phases: BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
     * Handles runway alignment, rotation, liftoff, and handoff to autopilot.
     *
     * @param {Object} d - flight data
     * @param {Object} apState - autopilot state
     * @param {boolean} phaseChanged - true if phase just changed
     */
    _evaluateTakeoff(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;
        const tk = p.takeoff || {};
        const ias = d.speed || 0;
        const agl = d.altitudeAGL || 0;
        const gs = d.groundSpeed || 0;
        const vs = d.verticalSpeed || 0;
        // Takeoff tuner overrides (from takeoff-tuner.html via localStorage)
        const tt = this._getTakeoffTuning();
        // MSFS 2024: onGround SimVar is unreliable (can report true at 300+ AGL).
        // Trust AGL as tiebreaker: only believe onGround if AGL also < 50ft.
        // Also consider on-ground if very low AGL regardless of SimVar.
        const onGround = (d.onGround && agl < 50) || (agl < 15 && Math.abs(vs) < 200);

        // Initialize sub-phase on entry
        if (phaseChanged || !this._takeoffSubPhase) {
            this._takeoffSubPhase = 'BEFORE_ROLL';
        }

        // Ensure AP is off during takeoff — manual controls only until INITIAL_CLIMB
        // Force-clear dedup cache because AP_MASTER is a toggle — the sim can re-engage
        // independently, making our cached 'false' stale.
        if (apState.master && this._takeoffSubPhase !== 'INITIAL_CLIMB' && this._takeoffSubPhase !== 'DEPARTURE') {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', false, 'AP off for takeoff');
        }

        // ── SIMPLIFIED TAKEOFF — no safety systems, just essentials ──
        // Systems disabled: stall protection, pitch targeting, bank-to-heading, roll/rudder bias
        // Will be re-enabled one at a time as needed.

        switch (this._takeoffSubPhase) {
            case 'BEFORE_ROLL':
                // Recenter ALL flight controls — use 0.0001 (effectively zero) instead of 0
                // because server deletes held-axes at exactly 0, letting joystick override.
                // Non-zero keeps server re-applying at SIM_FRAME rate.
                this._cmdValue('AXIS_ELEVATOR_SET', 0.0001, 'Center elevator');
                this._cmdValue('AXIS_AILERONS_SET', 0.0001, 'Center ailerons');
                this._cmdValue('AXIS_RUDDER_SET', 0, 'Center rudder');
                this._cmdValue('MIXTURE_SET', tt.beforeRollMixture ?? 100, 'Mixture RICH for takeoff');
                // Release parking brake (idempotent — safe after restarts)
                this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake');
                // Ground steering while waiting (prevents heading drift before roll)
                if (!this._runwayHeading) {
                    this._runwayHeading = this._activeRunway?.heading || Math.round(d.heading || 0);
                }
                this._groundSteer(d, this._runwayHeading);
                // Advance to ROLL once plane is actually moving (gs > 3 proves brake is off).
                // MSFS 2024: parkingBrake SimVar is unreliable (always reads true).
                if (gs > 3 && !this._isPhaseHeld('BEFORE_ROLL')) {
                    this._takeoffSubPhase = 'ROLL';
                }
                break;

            case 'ROLL':
                // Ensure brake is off (idempotent — safe after restarts)
                this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake');
                // Hold elevator at near-zero during roll — use 0.0001 (effectively zero)
                // so server keeps held-axes active, overriding joystick at SIM_FRAME rate.
                this._cmdValue('AXIS_ELEVATOR_SET', 0.0001, 'Elevator neutral');
                // Wings-level during roll — torque from full power rolls left
                // Negative AXIS_AILERONS_SET = roll LEFT, positive = roll RIGHT
                // Right bank (+) needs left aileron (-) to correct → negate bank
                const rollBank = d.bank || 0;
                if (Math.abs(rollBank) > (tt.liftoffBankThreshold ?? 3)) {
                    const rollAilGain = tt.liftoffAileronGain ?? 2;
                    const rollAilMax = tt.liftoffAileronMax ?? 25;
                    const rollAilCorr = -rollBank * rollAilGain;
                    this._cmdValue('AXIS_AILERONS_SET', Math.max(-rollAilMax, Math.min(rollAilMax, rollAilCorr)), `Wings level (bank ${Math.round(rollBank)}°)`);
                } else {
                    this._cmdValue('AXIS_AILERONS_SET', 0.0001, 'Ailerons neutral');
                }
                this._cmdValue('THROTTLE_SET', tt.rollThrottle ?? 100, 'Full power');
                if (!this._runwayHeading) {
                    this._runwayHeading = this._activeRunway?.heading || Math.round(d.heading || 0);
                }
                this._groundSteer(d, this._runwayHeading);
                if (ias >= (tt.vrSpeed ?? speeds.Vr ?? 55) && !this._isPhaseHeld('ROLL')) {
                    this._takeoffSubPhase = 'ROTATE';
                    this._rotateStartTime = Date.now();
                }
                break;

            case 'ROTATE': {
                this._cmdValue('THROTTLE_SET', tt.rotateThrottle ?? tt.rollThrottle ?? 100, 'Full power');
                // Progressive rotation: start at -3%, increase by -2%/sec to max.
                // Server-side held-axes deliver full value (no joystick fighting).
                // C172 only needs ~8° pitch for Vy climb — keep elevator gentle.
                const rotMax = tt.rotateElevator ?? -8;
                const rotElapsed = (Date.now() - this._rotateStartTime) / 1000;
                const rotElev = Math.max(rotMax, -3 - rotElapsed * 2);
                this._cmdValue('AXIS_ELEVATOR_SET', rotElev, `Rotate — elevator ${Math.round(rotElev)}`);
                // Wings-level during rotate — negate bank for correct roll direction
                const rotAilGain = tt.liftoffAileronGain ?? 2;
                const rotAilMax = tt.liftoffAileronMax ?? 30;
                const rotBank = d.bank || 0;
                if (Math.abs(rotBank) > (tt.liftoffBankThreshold ?? 2)) {
                    const rotAilCorr = -rotBank * rotAilGain;
                    this._cmdValue('AXIS_AILERONS_SET', Math.max(-rotAilMax, Math.min(rotAilMax, rotAilCorr)), `Wings level (bank ${Math.round(rotBank)}°)`);
                }
                this._groundSteer(d, this._runwayHeading);
                this._cmd('ELEV_TRIM_UP', true, 'Trim nose up');
                // Only transition to LIFTOFF when actually airborne
                if (!onGround && !this._isPhaseHeld('ROTATE')) {
                    this._takeoffSubPhase = 'LIFTOFF';
                }
                // Timeout safety: if still on ground after timeout, hold max elevator but DON'T
                // force LIFTOFF — that applies constant elevator on ground = tipover
                break;
            }

            case 'LIFTOFF': {
                this._cmdValue('THROTTLE_SET', tt.liftoffThrottle ?? tt.rollThrottle ?? 100, 'Full power climb');
                const loElev = tt.liftoffElevator ?? -5;
                this._cmdValue('AXIS_ELEVATOR_SET', loElev, `Climb — elevator ${loElev}`);
                const loAilGain = tt.liftoffAileronGain ?? 3;
                const loAilMax = tt.liftoffAileronMax ?? 30;
                const bank = d.bank || 0;
                if (Math.abs(bank) > (tt.liftoffBankThreshold ?? 3)) {
                    const ailCorr = -bank * loAilGain;
                    this._cmdValue('AXIS_AILERONS_SET', Math.max(-loAilMax, Math.min(loAilMax, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
                }
                if (vs > (tt.liftoffVsThreshold ?? 100) && agl > (tt.liftoffClimbAgl ?? tk.initialClimbAgl ?? 200) && !this._isPhaseHeld('LIFTOFF')) {
                    this._takeoffSubPhase = 'INITIAL_CLIMB';
                }
                break;
            }

            case 'INITIAL_CLIMB': {
                this._cmdValue('THROTTLE_SET', tt.climbPhaseThrottle ?? tt.rollThrottle ?? 100, 'Full power climb');
                const icElev = tt.climbElevator ?? -4;
                this._cmdValue('AXIS_ELEVATOR_SET', icElev, `Climb — elevator ${icElev}`);
                const icAilGain = tt.climbAileronGain ?? 3;
                const icAilMax = tt.climbAileronMax ?? 30;
                {
                    const bank = d.bank || 0;
                    if (Math.abs(bank) > (tt.climbBankThreshold ?? 3)) {
                        const ailCorr = -bank * icAilGain;
                        this._cmdValue('AXIS_AILERONS_SET', Math.max(-icAilMax, Math.min(icAilMax, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
                    }
                }
                // Hand off to AP when safe
                {
                    const stallMargin = (speeds.Vs1 || 53) + (tt.handoffSpeedMargin ?? 15);
                    if (ias >= stallMargin && agl > (tt.handoffAgl ?? tk.flapRetractAgl ?? 500) && !this._isPhaseHeld('INITIAL_CLIMB')) {
                        this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release for AP');
                        this._cmdValue('AXIS_RUDDER_SET', 0, 'Release for AP');
                        this._cmdValue('AXIS_AILERONS_SET', 0, 'Release for AP');
                        if (!apState.master) {
                            delete this._lastCommands['AP_MASTER'];
                            this._cmd('AP_MASTER', true, 'Engage AP');
                            const hdg = Math.round(d.heading || this._runwayHeading || 0);
                            this._cmdValue('HEADING_BUG_SET', hdg, 'HDG ' + hdg + '\u00B0');
                        }
                        this._cmd('AP_HDG_HOLD', true, 'HDG hold');
                        this._cmd('AP_VS_HOLD', true, 'VS hold');
                        const depVS = tt.departureVS ?? p.climb.normalRate ?? 500;
                        this._cmdValue('AP_VS_VAR_SET_ENGLISH', depVS, 'VS +' + depVS);
                        // Verify: don't advance until AP is actually flying
                        if (apState.master) {
                            this._takeoffSubPhase = 'DEPARTURE';
                        }
                    }
                }
                break;
            }

            case 'DEPARTURE': {
                // Retract flaps — keep sending until SimVar confirms retracted
                if ((d.flapsIndex || 0) > 0) {
                    delete this._lastCommands['FLAPS_UP'];
                    this._cmd('FLAPS_UP', true, 'Retract flaps');
                }
                const depSpd = tt.departureSpeed ?? speeds.Vy;
                const depAlt = tt.departureCruiseAlt ?? this._getCruiseAlt();
                this._cmdValue('AP_SPD_VAR_SET', depSpd, 'SPD ' + depSpd + ' (Vy climb)');
                this._cmdValue('AP_ALT_VAR_SET_ENGLISH', depAlt, 'ALT ' + depAlt);
                // Do NOT engage AP_ALT_HOLD here — it captures current alt (~800ft)
                // and prevents the CLIMB phase from commanding VS climb to cruise
                this._cmd('LANDING_LIGHTS_TOGGLE', true, 'Lights off after departure');
                // Sub-phase complete — flight-phase.js will transition to CLIMB at 500+ AGL
                break;
            }
        }
    }

        getTakeoffSubPhase() {
        return this._takeoffSubPhase;
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngineTakeoff };
}
