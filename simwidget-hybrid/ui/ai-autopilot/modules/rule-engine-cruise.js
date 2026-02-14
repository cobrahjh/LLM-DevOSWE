/**
 * Rule Engine Cruise Operations
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine-cruise.js
 *
 * Handles CLIMB and CRUISE phases with navigation integration
 * Extracted from rule-engine.js for memory optimization (Feb 2026)
 */

if (typeof RuleEngineCore === 'undefined' && typeof require !== 'undefined') {
    var { RuleEngineCore } = require('./rule-engine-core.js');
}

class RuleEngineCruise extends RuleEngineCore {
    constructor(options = {}) {
        super(options);
    }

    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'CLIMB':
                this._evaluateClimb(d, apState, phaseChanged);
                break;
            case 'CRUISE':
                this._evaluateCruise(d, apState, phaseChanged);
                break;
            default:
                console.warn(`RuleEngineCruise: Unknown phase ${phase}`);
        }
    }

    _evaluateClimb(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;

        // On phase entry: release takeoff controls and engage AP
        if (phaseChanged) {
            // CRITICAL: zero elevator to release takeoff rotation pitch-up
            this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release takeoff elevator');
            this._cmdValue('AXIS_RUDDER_SET', 0, 'Release takeoff rudder');
            this._cmdValue('STEERING_SET', 0, 'Release nosewheel');

            // Set heading bug to current heading before engaging AP
            const climbHdg = Math.round(d.heading || this._runwayHeading || 0);
            this._cmdValue('HEADING_BUG_SET', climbHdg, 'HDG ' + climbHdg + '\u00B0');

            // Engage AP + modes
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', true, 'Engage AP for climb');
            this._cmd('AP_HDG_HOLD', true, 'HDG hold for climb');
            this._cmd('AP_VS_HOLD', true, 'VS hold for climb');
            const climbTT2 = this._getTakeoffTuning();
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', climbTT2.departureVS ?? 500, 'VS +500 for climb');
        }

        // Retract flaps if still deployed
        if ((d.flapsIndex || 0) > 0) {
            delete this._lastCommands['FLAPS_UP'];
            this._cmd('FLAPS_UP', true, 'Retract flaps for climb');
        }

        // Climb power
        if (!this._speedCorrectionActive) {
            const climbTT = this._getTakeoffTuning();
            this._cmdValue('THROTTLE_SET', climbTT.climbThrottle ?? 100, 'Climb power');
        }

        // Manual flight when AP isn't active
        if (!apState.master) {
            const climbBank = d.bank || 0;
            const climbPitch = d.pitch || 0;

            // Wings-level: proportional aileron
            const bankFix = Math.max(-25, Math.min(25, -climbBank * 0.6));
            this._cmdValue('AXIS_AILERONS_SET', Math.round(bankFix), `Wings level (bank ${Math.round(climbBank)}°)`);

            // Pitch hold ~7° nose-up for Vy climb
            const pitchTarget = 7;
            const pitchErr = pitchTarget - climbPitch;
            const pitchFix = Math.max(-20, Math.min(20, pitchErr * 1.5));
            this._cmdValue('AXIS_ELEVATOR_SET', Math.round(-pitchFix), `Pitch hold (${Math.round(climbPitch)}°)`);

            // Keep trying to engage AP
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', true, 'Engage AP for climb');
        }

        // Lateral nav — continuous evaluation
        this._applyLateralNav(d, apState, phaseChanged);

        // Set climb VS — adapts to available speed margin
        if (!this._speedCorrectionActive) {
            const ias = d.speed || 0;
            const stallMargin = ias - ((speeds.Vs1 || 53) + 10);
            const climbTTvs = this._getTakeoffTuning();
            let climbVS = climbTTvs.climbVS ?? p.climb.normalRate;

            if (stallMargin < 15) {
                climbVS = Math.max(200, Math.round(climbVS * Math.max(0.3, stallMargin / 15)));
            }

            if (phaseChanged || !apState.vsHold) {
                this._cmd('AP_VS_HOLD', true, 'VS hold for climb');
            }
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', climbVS, 'VS +' + climbVS);
        }

        if (phaseChanged) {
            this._cmdValue('AP_ALT_VAR_SET_ENGLISH', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());
            this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy)');
        }
    }

    _evaluateCruise(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;

        if (!apState.master) {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', true, 'Engage AP for cruise');
        }

        if (phaseChanged) {
            // Level off
            this._cmd('AP_ALT_HOLD', true, 'ALT hold at cruise');
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', 0, 'VS 0 (level)');
            this._cmdValue('AP_SPD_VAR_SET', speeds.Vcruise, 'SPD ' + speeds.Vcruise + ' (cruise)');
        }

        // Lateral nav — continuous evaluation
        this._applyLateralNav(d, apState, phaseChanged);

        // Speed-maintaining throttle
        const ias = d.speed || 0;
        const spdDiff = speeds.Vcruise - ias;
        let cruiseThrottle;

        if (spdDiff > 15) cruiseThrottle = 100;       // way below target
        else if (spdDiff > 5) cruiseThrottle = 90;    // building speed
        else if (spdDiff > -5) cruiseThrottle = 80;   // near target
        else cruiseThrottle = 70;                      // above target

        if (!this._speedCorrectionActive) {
            this._cmdValue('THROTTLE_SET', cruiseThrottle, 'Cruise throttle ' + cruiseThrottle + '%');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngineCruise };
}
