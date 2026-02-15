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
const fs = require('fs');
const { RuleEngineCore: RuleEngine } = require(path.join(__dirname, '../../ui/ai-autopilot/modules/rule-engine-core'));
const FlightPhase = require(path.join(__dirname, '../../ui/ai-autopilot/modules/flight-phase'));
const CommandQueue = require(path.join(__dirname, '../../ui/ai-autopilot/modules/command-queue'));
const { AIRCRAFT_PROFILES, DEFAULT_PROFILE } = require(path.join(__dirname, '../../ui/ai-autopilot/data/aircraft-profiles'));
const ATCServerController = require(path.join(__dirname, 'atc-server'));

const STATE_FILE = path.join(__dirname, '.rule-engine-state.json');

class RuleEngineServer {
    /**
     * @param {Object} opts
     * @param {Function} opts.executeCommand - server.js executeCommand(command, value)
     * @param {Function} opts.getTuning - returns tuning object (from ai-pilot-api _sharedState)
     * @param {Function} [opts.requestFacilityGraph] - async (icao) => graph
     * @param {Function} [opts.getFlightData] - () => current flightData object
     */
    constructor(opts = {}) {
        this._executeCommand = opts.executeCommand;
        this._getTuning = opts.getTuning || (() => ({}));
        this._getFlightData = opts.getFlightData || (() => null);
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

        // ── ATC Server Controller ──────────────────────────────────
        this._atc = null;
        this._airportDetectInterval = null;
        this._lastAirportCheck = 0;
        const requestFacilityGraph = opts.requestFacilityGraph;
        if (requestFacilityGraph) {
            const { findNearestNode, findRunwayNode, aStarRoute } = require('../ai-pilot-api');
            this._atc = new ATCServerController({
                requestFacilityGraph,
                findNearestNode,
                findRunwayNode,
                aStarRoute,
                onInstruction: (text, type) => {
                    console.log(`[ATC] ${type}: ${text}`);
                    this._onCommand({ time: Date.now(), type: 'atc', value: type, description: text });
                },
                onPhaseChange: (oldPhase, newPhase) => {
                    console.log(`[ATC] Phase: ${oldPhase} → ${newPhase}`);
                }
            });
            // Wire ATC into rule engine and flight phase so they respect ATC gates
            this.ruleEngine.setATCController(this._atc);
            this.flightPhase.setATCController(this._atc);
            // Start airport detection polling (every 15s)
            this._startAirportDetection();
            console.log('[ATC] Server-side ATC ready');
        }

        // Auto-recover: if we were enabled before a server restart, re-enable
        const savedState = this._loadState();
        if (savedState && savedState.enabled) {
            this._enabled = true;
            if (savedState.cruiseAlt) {
                this.flightPhase.setCruiseAlt(savedState.cruiseAlt);
            }
            console.log('[RuleEngine] Auto-recovered — was enabled before restart (cruiseAlt: ' + this.flightPhase.targetCruiseAlt + ')');
        }

        console.log('[RuleEngine] Server-side mode ready');
    }

    /**
     * Enable the server-side rule engine.
     * Resets state for a clean start.
     */
    enable() {
        this._enabled = true;
        this._saveState(true);
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
        this._saveState(false);
        // Release ALL axes so user regains full control
        this._executeCommand('THROTTLE_SET', 0);
        this._executeCommand('AXIS_ELEVATOR_SET', 0);
        this._executeCommand('AXIS_RUDDER_SET', 0);
        this._executeCommand('STEERING_SET', 0);
        this._executeCommand('AXIS_AILERONS_SET', 0);
        this._executeCommand('AXIS_LEFT_BRAKE_SET', 0);
        this._executeCommand('AXIS_RIGHT_BRAKE_SET', 0);
        console.log('[RuleEngine] DISABLED — all axes released');
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

        // Update ATC position (every frame for accurate waypoint tracking)
        if (this._atc) {
            const agl = fd.altitudeAGL ?? fd.altAGL ?? 0;
            this._atc.updatePosition(fd.latitude || 0, fd.longitude || 0, fd.groundSpeed || 0, agl);
        }

        // Update flight phase state machine
        this.flightPhase.update(fd);

        // Sync cruise alt to rule engine
        this.ruleEngine.setTargetCruiseAlt(this.flightPhase.targetCruiseAlt);

        // Run rule engine evaluation
        this.ruleEngine.evaluate(this.flightPhase.phase, fd, this.ap);
    }

    // ── ATC Control Methods ──────────────────────────────────────────

    /**
     * Request taxi to runway. Auto-detects airport and picks best runway.
     * Note: Engine must be running before requesting taxi (Ctrl+E in MSFS).
     * MSFS 2024 RPM SimVar is unreliable — skip auto-start detection.
     * @returns {Object} result
     */
    async requestTaxi() {
        if (!this._atc) return { success: false, error: 'ATC not initialized' };

        const fd = this._getFlightData();
        if (!fd) return { success: false, error: 'No flight data available' };

        const icao = this._atc.getDetectedIcao();
        if (!icao) return { success: false, error: 'No airport detected — are you on the ground near an airport?' };

        // Pick best runway based on heading
        const heading = fd.heading || 0;
        const runway = this._atc.pickBestRunway(heading);
        if (!runway) return { success: false, error: `No runways found at ${icao}` };

        // Activate ATC and request clearance
        this._atc.activate();
        await this._atc.requestTaxiClearance(icao, runway);

        return {
            success: true,
            icao,
            runway,
            phase: this._atc.getPhase(),
            route: this._atc.getRoute()
        };
    }

    /**
     * Issue takeoff clearance. Called after voice "request takeoff".
     */
    clearedForTakeoff() {
        if (!this._atc) return { success: false, error: 'ATC not initialized' };
        const phase = this._atc.getPhase();
        if (phase !== 'HOLD_SHORT' && phase !== 'TAKEOFF_CLEARANCE_PENDING') {
            return { success: false, error: `Cannot clear for takeoff in phase: ${phase}` };
        }
        this._atc.issueTakeoffClearance();
        return { success: true, phase: this._atc.getPhase() };
    }

    /** Get full ATC state for API */
    getATCState() {
        if (!this._atc) return { active: false };
        return {
            active: true,
            ...this._atc.getFullState()
        };
    }

    /** Deactivate ATC ground ops */
    deactivateATC() {
        if (!this._atc) return { success: false };
        this._atc.deactivate();
        return { success: true, phase: this._atc.getPhase() };
    }

    // ── Airport Detection (15s poll) ─────────────────────────────────

    _startAirportDetection() {
        this._airportDetectInterval = setInterval(() => this._detectAirport(), 15000);
    }

    async _detectAirport() {
        const fd = this._getFlightData();
        if (!fd || !fd.latitude || !fd.longitude) return;

        // Only detect when on ground
        const agl = fd.altitudeAGL ?? fd.altAGL ?? 0;
        const onGround = agl < 50;
        if (!onGround) {
            // Airborne — clear detection
            if (this._atc.getDetectedIcao()) {
                this._atc.setDetectedAirport(null, null);
            }
            return;
        }

        // Query navdata for nearest airport within 2nm
        try {
            const http = require('http');
            const url = `http://localhost:8080/api/navdb/nearby/airports?lat=${fd.latitude}&lon=${fd.longitude}&range=2&limit=1`;
            const data = await new Promise((resolve, reject) => {
                http.get(url, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try { resolve(JSON.parse(body)); }
                        catch (e) { reject(e); }
                    });
                }).on('error', reject);
            });

            const airports = data?.items || data;
            if (airports && airports.length > 0) {
                const airport = airports[0];
                const prevIcao = this._atc.getDetectedIcao();

                if (airport.icao !== prevIcao) {
                    console.log(`[ATC] Airport detected: ${airport.icao} (${airport.name}) — ${airport.distance}nm`);

                    // Fetch runway data
                    const rwyData = await new Promise((resolve, reject) => {
                        http.get(`http://localhost:8080/api/navdb/airport/${airport.icao}`, (res) => {
                            let body = '';
                            res.on('data', chunk => body += chunk);
                            res.on('end', () => {
                                try { resolve(JSON.parse(body)); }
                                catch (e) { reject(e); }
                            });
                        }).on('error', reject);
                    });

                    const runways = rwyData?.runways || [];
                    this._atc.setDetectedAirport(airport.icao, runways);

                    if (this._atc.getPhase() === 'INACTIVE') {
                        this._atc.activate();
                    }
                }
            } else if (this._atc.getDetectedIcao()) {
                // Moved away from airport
                this._atc.setDetectedAirport(null, null);
            }
        } catch (e) {
            // NavDB not available — silent fallback
        }
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
        const state = {
            enabled: this._enabled,
            phase: this.flightPhase.phase,
            subPhase: this.ruleEngine?.getTakeoffSubPhase ? this.ruleEngine.getTakeoffSubPhase() : null,
            phaseProgress: this.flightPhase.getProgress(),
            live: this.ruleEngine.live,
            commandLog: this._commandLog.slice(0, 10)
        };
        if (this._atc) {
            state.atc = this.getATCState();
        }
        return state;
    }

    /**
     * Get broadcast-friendly state (minimal, for inclusion in flightData).
     */
    getBroadcastState() {
        if (!this._enabled) return { enabled: false };
        const state = {
            enabled: true,
            phase: this.flightPhase.phase,
            subPhase: this.ruleEngine?.getTakeoffSubPhase ? this.ruleEngine.getTakeoffSubPhase() : null,
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
        // Include ATC state if active
        if (this._atc && this._atc.getPhase() !== 'INACTIVE') {
            state.atc = {
                phase: this._atc.getPhase(),
                icao: this._atc._icao || this._atc.getDetectedIcao(),
                runway: this._atc._runway,
                instruction: this._atc.getATCInstruction(),
                route: this._atc.getRoute(),
                nextWaypoint: this._atc.getNextWaypoint()
            };
        }
        return state;
    }

    /** Set target cruise altitude */
    setCruiseAlt(alt) {
        this.flightPhase.setCruiseAlt(alt);
        if (this._enabled) this._saveState(true);
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

    /** Persist state to disk for auto-recovery after restart */
    _saveState(enabled) {
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                enabled,
                cruiseAlt: this.flightPhase.targetCruiseAlt
            }));
        } catch (e) { /* best-effort */ }
    }

    /** Load persisted state. Returns object or null. */
    _loadState() {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (e) {
            return null;
        }
    }
}

module.exports = RuleEngineServer;
