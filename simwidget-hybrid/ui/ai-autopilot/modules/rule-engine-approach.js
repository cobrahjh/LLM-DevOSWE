/**
 * Rule Engine Approach Operations
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine-approach.js
 *
 * Handles DESCENT, APPROACH, and LANDING phases
 * Extracted from rule-engine.js for memory optimization (Feb 2026)
 */

if (typeof RuleEngineCore === 'undefined' && typeof require !== 'undefined' && typeof window === 'undefined') {
    const RuleEngineCoreModule = require('./rule-engine-core.js');
    global.RuleEngineCore = RuleEngineCoreModule.RuleEngineCore;
}

class RuleEngineApproach extends RuleEngineCore {
    constructor(options = {}) {
        super(options);
    }

    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'DESCENT':
                this._evaluateDescent(d, apState, phaseChanged);
                break;
            case 'APPROACH':
                this._evaluateApproach(d, apState, phaseChanged);
                break;
            case 'LANDING':
                this._evaluateLanding(d, apState);
                break;
            default:
                console.warn(`RuleEngineApproach: Unknown phase ${phase}`);
        }
    }

    _evaluateDescent(d, apState, phaseChanged) {
        const p = this.profile;

        if (!apState.master) {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', true, 'Engage AP for descent');
        }

        if (phaseChanged) {
            this._cmdValue('AP_ALT_VAR_SET_ENGLISH', this._targetCruiseAlt, 'ALT ' + this._targetCruiseAlt);
            this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.DESCENT, 'SPD ' + p.phaseSpeeds.DESCENT);
        }

        this._applyLateralNav(d, apState, phaseChanged);

        if (apState.altitudeHold) {
            delete this._lastCommands['AP_ALT_HOLD'];
            this._cmd('AP_ALT_HOLD', true, 'Disengage ALT hold for descent');
        }

        const desVs = d.verticalSpeed || 0;
        if (Math.abs(desVs - p.descent.normalRate) > 200) {
            delete this._lastCommands['AP_VS_HOLD'];
            delete this._lastCommands['AP_VS_VAR_SET_ENGLISH'];
        }

        this._cmd('AP_VS_HOLD', true, 'VS hold for descent');
        this._cmdValue('AP_VS_VAR_SET_ENGLISH', p.descent.normalRate, 'VS ' + p.descent.normalRate);

        const desIas = d.speed || 0;
        const desTarget = p.phaseSpeeds.DESCENT || 100;
        let desThrottle;

        if (desIas < desTarget - 10) desThrottle = 75;
        else if (desIas < desTarget + 5) desThrottle = 55;
        else if (desIas < desTarget + 15) desThrottle = 40;
        else desThrottle = 25;

        this._cmdValue('THROTTLE_SET', desThrottle, 'Descent throttle ' + desThrottle + '%');
    }

    _evaluateApproach(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;
        const aprAgl = d.altitudeAGL || 0;

        if (!apState.master) {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', true, 'Engage AP for approach');
        }

        if (phaseChanged) {
            this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.APPROACH, 'SPD ' + p.phaseSpeeds.APPROACH);
            this._cmd('AP_VS_HOLD', true, 'VS hold for approach');
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', p.descent.approachRate, 'VS ' + p.descent.approachRate);
        }

        const flaps = d.flapsIndex || 0;
        if (flaps < 1) {
            this._cmd('FLAPS_DOWN', 1, 'Flaps 1 for approach');
        } else if (aprAgl < 800 && flaps < 2) {
            this._cmd('FLAPS_DOWN', 2, 'Flaps 2 below 800 AGL');
        } else if (aprAgl < 400 && flaps < 3) {
            this._cmd('FLAPS_DOWN', 3, 'Full flaps below 400 AGL');
        }

        if (this._navState) {
            const nav = this._navState;
            if (nav.cdi?.gsValid && nav.approach?.hasGlideslope) {
                if (!apState.aprHold || phaseChanged) {
                    this._cmd('AP_APR_HOLD', true, 'APR mode (GS valid)');
                }
            } else if (nav.approach?.mode) {
                if (!apState.aprHold || phaseChanged) {
                    this._cmd('AP_APR_HOLD', true, 'APR mode (lateral)');
                }
            } else {
                const navHdg = this._getNavHeading(d);
                if (navHdg) {
                    this._cmdValue('HEADING_BUG_SET', navHdg.heading, navHdg.description);
                    if (!apState.headingHold || phaseChanged) {
                        this._cmd('AP_HDG_HOLD', true, 'HDG hold (approach)');
                    }
                } else if (this._activeRunway?.heading != null) {
                    this._cmdValue('HEADING_BUG_SET', Math.round(this._activeRunway.heading), 'RWY HDG ' + Math.round(this._activeRunway.heading) + '°');
                    if (!apState.headingHold || phaseChanged) {
                        this._cmd('AP_HDG_HOLD', true, 'HDG hold (runway)');
                    }
                }
            }
        } else if (phaseChanged) {
            const aprHdg = this._activeRunway?.heading || d.heading || 0;
            this._cmdValue('HEADING_BUG_SET', Math.round(aprHdg), 'HDG ' + Math.round(aprHdg) + '°');
            this._cmd('AP_HDG_HOLD', true, 'HDG hold (no nav)');
        }

        const aprIas = d.speed || 0;
        let aprThrottle = 40;

        if (aprIas < (speeds.Vs0 || 48) + 10) aprThrottle = 55;
        else if (aprIas > (speeds.Vfe || 85) - 5) aprThrottle = 25;

        this._cmdValue('THROTTLE_SET', aprThrottle, 'Approach throttle ' + aprThrottle + '%');
    }

    _evaluateLanding(d, apState) {
        const lndAgl = d.altitudeAGL || 0;
        const lndGs = d.groundSpeed || 0;
        const lndOnGround = lndAgl < 10 && d.onGround !== false;

        if ((d.flapsIndex || 0) < 3) {
            this._cmd('FLAPS_DOWN', 4, 'Full flaps for landing');
        }

        if (!lndOnGround) {
            if (lndAgl > 100) {
                if (!apState.master) this._cmd('AP_MASTER', true, 'AP for final');
                this._cmd('AP_VS_HOLD', true, 'VS hold final');
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', -300, 'VS -300 (final)');
                this._cmdValue('THROTTLE_SET', 35, 'Final throttle');
            } else if (lndAgl > 50) {
                if (apState.master) {
                    this._cmdValue('AP_VS_VAR_SET_ENGLISH', -200, 'VS -200 (short final)');
                }
                this._cmdValue('THROTTLE_SET', 25, 'Short final throttle');
            } else if (lndAgl > 20) {
                if (apState.master) {
                    this._cmdValue('AP_VS_VAR_SET_ENGLISH', -100, 'VS -100 (pre-flare)');
                }
                this._cmdValue('THROTTLE_SET', 15, 'Pre-flare throttle');
            } else {
                if (apState.master) {
                    delete this._lastCommands['AP_MASTER'];
                    this._cmd('AP_MASTER', false, 'AP off — flare');
                }
                this._cmdValue('THROTTLE_SET', 0, 'Idle for flare');
                this._cmdValue('AXIS_ELEVATOR_SET', -30, 'Nose up for flare');
            }
        } else {
            if (apState.master) {
                delete this._lastCommands['AP_MASTER'];
                this._cmd('AP_MASTER', false, 'AP off — on ground');
            }

            this._cmdValue('THROTTLE_SET', 0, 'Idle on rollout');
            this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release elevator');
            this._cmdValue('AXIS_RUDDER_SET', 0, 'Center rudder');
            this._cmdValue('AXIS_AILERONS_SET', 0, 'Center ailerons');

            if ((d.flapsIndex || 0) > 0) {
                delete this._lastCommands['FLAPS_UP'];
                this._cmd('FLAPS_UP', true, 'Retract flaps after landing');
            }

            if (lndGs < 40 && lndGs > 5) {
                this._cmdValue('PARKING_BRAKE_SET', 1, 'Braking');
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngineApproach };
}
