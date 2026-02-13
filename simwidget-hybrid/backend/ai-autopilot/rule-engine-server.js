/**
 * Server-Side AI Autopilot Rule Engine
 * Type: module | Category: backend
 * Path: backend/ai-autopilot/rule-engine-server.js
 *
 * Wraps the existing browser rule engine modules for server-side execution.
 * Calls executeCommand() directly — no WebSocket, no browser caching issues.
 * Evaluates on every SimConnect data frame (~30Hz).
 */

const path = require('path');
const RuleEngine = require(path.join(__dirname, '../../ui/ai-autopilot/modules/rule-engine'));
const FlightPhase = require(path.join(__dirname, '../../ui/ai-autopilot/modules/flight-phase'));
const CommandQueue = require(path.join(__dirname, '../../ui/ai-autopilot/modules/command-queue'));
const { AIRCRAFT_PROFILES, DEFAULT_PROFILE } = require(path.join(__dirname, '../../ui/ai-autopilot/data/aircraft-profiles'));

class RuleEngineServer {
    /**
     * @param {Object} opts
     * @param {Function} opts.executeCommand - server.js executeCommand(command, value)
     * @param {Function} opts.getTuning - returns tuning object (from ai-pilot-api _sharedState)
     */
    constructor(opts = {}) {
        this._executeCommand = opts.executeCommand;
        this._getTuning = opts.getTuning || (() => ({}));
        this._enabled = false;

        // Command log for API/broadcast
        this._commandLog = [];
        this._maxLog = 30;

        // AP state tracking (extracted from flightData each frame)
        this.ap = {
            master: false, headingHold: false, altitudeHold: false,
            vsHold: false, speedHold: false, navHold: false, aprHold: false
        };

        const profile = AIRCRAFT_PROFILES[DEFAULT_PROFILE];

        // Command queue — calls executeCommand directly instead of WebSocket
        this.commandQueue = new CommandQueue({
            sendCommand: (wsCmd) => this._directExecute(wsCmd),
            profile: profile,
            onCommandExecuted: (entry) => this._onCommand(entry)
        });

        // Flight phase state machine
        this.flightPhase = new FlightPhase({
            targetCruiseAlt: 8500,
            profile: profile,
            onPhaseChange: (newPhase, oldPhase) => {
                console.log(`[RuleEngine] Phase: ${oldPhase} → ${newPhase}`);
            }
        });

        // Rule engine — with server-side tuning getter (no localStorage)
        this.ruleEngine = new RuleEngine({
            profile: profile,
            commandQueue: this.commandQueue,
            tuningGetter: () => this._getTuning(),
            holdsGetter: () => ({})  // no phase holds on server
        });

        console.log('[RuleEngine] Server-side mode ready');
    }

    /**
     * Enable the server-side rule engine.
     * Resets state for a clean start.
     */
    enable() {
        this._enabled = true;
        this.ruleEngine.reset();
        this.commandQueue.clear();
        this._commandLog = [];
        console.log('[RuleEngine] ENABLED — server-side evaluation active');
    }

    /**
     * Disable the rule engine and release all flight control axes.
     */
    disable() {
        this._enabled = false;
        // Release all flight control axes so joystick takes over
        this._executeCommand('AXIS_ELEVATOR_SET', 0);
        this._executeCommand('AXIS_RUDDER_SET', 0);
        this._executeCommand('AXIS_AILERONS_SET', 0);
        console.log('[RuleEngine] DISABLED — axes released');
    }

    /** @returns {boolean} */
    isEnabled() {
        return this._enabled;
    }

    /**
     * Evaluate rules for the current flight data frame.
     * Called from simObjectData handler in server.js (~30Hz).
     * @param {Object} fd - parsed flightData from SimConnect
     */
    evaluate(fd) {
        if (!this._enabled || !fd) return;

        // Extract AP state from flightData
        this.ap.master = !!fd.apMaster;
        this.ap.headingHold = !!fd.apHdgLock;
        this.ap.altitudeHold = !!fd.apAltLock;
        this.ap.vsHold = !!fd.apVsLock;
        this.ap.speedHold = !!fd.apSpdLock;
        this.ap.navHold = !!fd.apNavLock;
        this.ap.aprHold = !!fd.apAprLock;

        // Update flight phase state machine
        this.flightPhase.update(fd);

        // Sync cruise alt to rule engine
        this.ruleEngine.setTargetCruiseAlt(this.flightPhase.targetCruiseAlt);

        // Run rule engine evaluation
        this.ruleEngine.evaluate(this.flightPhase.phase, fd, this.ap);
    }

    /**
     * Convert CommandQueue wsCmd output to direct executeCommand call.
     * CommandQueue._buildWsCommand returns either a string (toggle) or { command, value }.
     */
    _directExecute(wsCmd) {
        if (!this._executeCommand) return;
        if (typeof wsCmd === 'string') {
            this._executeCommand(wsCmd);
        } else if (wsCmd && wsCmd.command) {
            this._executeCommand(wsCmd.command, wsCmd.value);
        }
    }

    /**
     * Command execution callback — logs for API/broadcast.
     */
    _onCommand(entry) {
        this._commandLog.unshift({
            time: entry.time,
            type: entry.type,
            value: entry.value,
            description: entry.description
        });
        if (this._commandLog.length > this._maxLog) {
            this._commandLog.pop();
        }
    }

    /**
     * Get current state for API response and WS broadcast.
     * Kept slim to avoid bloating flightData messages.
     */
    getState() {
        return {
            enabled: this._enabled,
            phase: this.flightPhase.phase,
            subPhase: this.ruleEngine.getTakeoffSubPhase() || null,
            phaseProgress: this.flightPhase.getProgress(),
            live: this.ruleEngine.live,
            commandLog: this._commandLog.slice(0, 10)
        };
    }

    /**
     * Get broadcast-friendly state (minimal, for inclusion in flightData).
     */
    getBroadcastState() {
        if (!this._enabled) return { enabled: false };
        return {
            enabled: true,
            phase: this.flightPhase.phase,
            subPhase: this.ruleEngine.getTakeoffSubPhase() || null,
            phaseProgress: this.flightPhase.getProgress(),
            live: {
                elevator: this.ruleEngine.live.elevator,
                aileron: this.ruleEngine.live.aileron,
                throttle: this.ruleEngine.live.throttle,
                rudder: this.ruleEngine.live.rudder,
                safetyActive: this.ruleEngine.live.safetyActive,
                safetyReason: this.ruleEngine.live.safetyReason,
            },
            lastCmd: this._commandLog.length > 0 ? this._commandLog[0] : null
        };
    }

    /** Set target cruise altitude */
    setCruiseAlt(alt) {
        this.flightPhase.setCruiseAlt(alt);
    }

    /** Set nav state from GTN750 */
    setNavState(nav) {
        this.ruleEngine.setNavState(nav);
    }

    /** Set airport data */
    setAirportData(airport) {
        this.ruleEngine.setAirportData(airport);
    }

    /** Set active runway */
    setActiveRunway(runway) {
        this.ruleEngine.setActiveRunway(runway);
    }
}

module.exports = RuleEngineServer;
