/**
 * Rule Engine — Per-Phase AP Command Generation
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine.js
 *
 * Produces AP commands based on current flight phase and aircraft profile.
 * Commands are pushed to the command queue for rate-limited execution.
 */

class RuleEngine {
    constructor(options = {}) {
        this.profile = options.profile || null;
        this.commandQueue = options.commandQueue || null;
        this._lastPhase = null;
        this._lastCommands = {};  // track what we last commanded per axis
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

        switch (phase) {
            case 'PREFLIGHT':
            case 'TAXI':
                // No AP commands during ground ops
                if (apState.master) {
                    this._cmd('AP_MASTER', false, 'Disengage AP on ground');
                }
                break;

            case 'TAKEOFF':
                // Engage AP after positive climb established
                if (!apState.master && d.verticalSpeed > 200 && !d.onGround) {
                    this._cmd('AP_MASTER', true, 'Engage AP');
                }
                if (apState.master) {
                    this._cmd('AP_HDG_HOLD', true, 'HDG hold for runway track');
                    this._cmd('HEADING_BUG_SET', d.heading, 'Set HDG to runway heading');
                    this._cmd('AP_VS_HOLD', true, 'VS hold for initial climb');
                    this._cmdValue('AP_VS_VAR_SET', p.climb.normalRate, 'VS +' + p.climb.normalRate);
                }
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
            description: description || `${command} → ${value}`
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
