/**
 * ATC Ground Controller — State Machine + Position Monitoring
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/atc-controller.js
 *
 * Manages ATC ground operations: taxi clearances, hold short, takeoff
 * clearance, readback validation, position monitoring along route.
 *
 * 9 ground phases:
 *   INACTIVE → PARKED → TAXI_CLEARANCE_PENDING → TAXIING → HOLD_SHORT
 *   → TAKEOFF_CLEARANCE_PENDING → CLEARED_TAKEOFF → AIRBORNE → INACTIVE
 */

class ATCController {
    constructor(options = {}) {
        this._serverPort = options.serverPort || '';
        this._onInstruction = options.onInstruction || null;
        this._onPhaseChange = options.onPhaseChange || null;

        // State machine
        this._phase = 'INACTIVE';
        this._route = null;          // { success, nodePath, taxiways, instruction, waypoints, distance_ft }
        this._icao = null;           // Current airport ICAO
        this._runway = null;         // Target runway ident
        this._graph = null;          // Airport facility graph

        // Position tracking along route
        this._currentWaypointIdx = 0;  // Index into route.waypoints
        this._lastLat = 0;
        this._lastLon = 0;
        this._lastGs = 0;

        // Timing
        this._holdShortTime = 0;     // When we entered HOLD_SHORT
        this._holdShortDelay = 5000; // 5s hold before auto-clearance
        this._phaseEntryTime = Date.now();

        // Callsign (default, overridable)
        this._callsign = 'SimGlass 1';

        this._destroyed = false;
    }

    // ── Public API ────────────────────────────────────────────

    /** Get current ATC phase */
    getPhase() {
        return this._phase;
    }

    /** Get current ATC instruction text for UI */
    getATCInstruction() {
        if (!this._route) return '';
        switch (this._phase) {
            case 'TAXIING':
                return this._route.instruction || '';
            case 'HOLD_SHORT':
                return `Hold short runway ${this._runway}`;
            case 'TAKEOFF_CLEARANCE_PENDING':
                return `Ready for departure runway ${this._runway}`;
            case 'CLEARED_TAKEOFF':
                return `Cleared for takeoff runway ${this._runway}`;
            case 'TAXI_CLEARANCE_PENDING':
                return 'Requesting taxi clearance...';
            default:
                return '';
        }
    }

    /** Get next waypoint for taxi steering */
    getNextWaypoint() {
        if (!this._route?.waypoints || this._currentWaypointIdx >= this._route.waypoints.length) return null;
        const wp = this._route.waypoints[this._currentWaypointIdx];
        if (!wp) return null;
        // Compute bearing from current position to next waypoint
        const bearing = this._bearing(this._lastLat, this._lastLon, wp.lat, wp.lon);
        return { lat: wp.lat, lon: wp.lon, name: wp.name, type: wp.type, bearing };
    }

    /** Get full route info (for UI display) */
    getRoute() {
        if (!this._route) return null;
        return {
            taxiways: this._route.taxiways,
            distance_ft: this._route.distance_ft,
            waypointCount: this._route.waypoints?.length || 0,
            currentWaypoint: this._currentWaypointIdx,
            instruction: this._route.instruction
        };
    }

    /** Set aircraft callsign */
    setCallsign(cs) {
        this._callsign = cs || 'SimGlass 1';
    }

    // ── State Transitions ─────────────────────────────────────

    /**
     * Request taxi clearance from ATC.
     * Calls server for A* route, stores route, emits instruction.
     * @param {string} icao - Airport ICAO
     * @param {string} runway - Target runway ident (e.g., '16R')
     */
    async requestTaxiClearance(icao, runway) {
        if (this._destroyed) return;
        if (!icao || !runway) return;
        if (this._phase !== 'INACTIVE' && this._phase !== 'PARKED') return;

        this._icao = icao.toUpperCase();
        this._runway = runway;
        this._setPhase('TAXI_CLEARANCE_PENDING');

        try {
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            const url = `${base}/api/ai-pilot/atc/route?icao=${this._icao}&fromLat=${this._lastLat}&fromLon=${this._lastLon}&toRunway=${runway}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                this._route = data;
                this._currentWaypointIdx = 1; // Skip start node (we're already there)

                // Build ATC phraseology
                const rwyFormatted = typeof ATCPhraseology !== 'undefined'
                    ? ATCPhraseology.formatRunway(runway) : runway;
                const taxiStr = data.taxiways?.length
                    ? ` via ${data.taxiways.join(', ')}` : '';
                const instruction = `${this._callsign}, taxi to runway ${rwyFormatted}${taxiStr}`;

                this._emit(instruction, 'taxi_clearance');
                this._setPhase('TAXIING');
            } else {
                this._emit(`Unable to find taxi route to runway ${runway}`, 'error');
                this._setPhase('PARKED');
            }
        } catch (e) {
            this._emit(`ATC communication error: ${e.message}`, 'error');
            this._setPhase('PARKED');
        }
    }

    /** Pilot reports ready for departure at hold-short line */
    reportReadyForDeparture() {
        if (this._phase !== 'HOLD_SHORT') return;
        this._setPhase('TAKEOFF_CLEARANCE_PENDING');
        this._emit(`${this._callsign}, ready for departure runway ${this._runway}`, 'pilot_report');
    }

    /** ATC issues takeoff clearance */
    issueTakeoffClearance() {
        if (this._phase !== 'HOLD_SHORT' && this._phase !== 'TAKEOFF_CLEARANCE_PENDING') return;
        const rwyFormatted = typeof ATCPhraseology !== 'undefined'
            ? ATCPhraseology.formatRunway(this._runway) : this._runway;
        this._emit(`${this._callsign}, cleared for takeoff runway ${rwyFormatted}`, 'takeoff_clearance');
        this._setPhase('CLEARED_TAKEOFF');
    }

    /** Activate ATC when parked at airport */
    activate() {
        if (this._phase === 'INACTIVE') {
            this._setPhase('PARKED');
        }
    }

    /** Deactivate ATC (e.g., after takeoff) */
    deactivate() {
        this._route = null;
        this._graph = null;
        this._currentWaypointIdx = 0;
        this._setPhase('INACTIVE');
    }

    /**
     * Validate a readback against expected elements.
     * @param {string} text - Readback text (from pilot)
     * @returns {{ valid: boolean, missing: string[] }}
     */
    validateReadback(text) {
        if (!text) return { valid: false, missing: ['empty readback'] };
        const upper = text.toUpperCase();
        const missing = [];

        // Check runway in readback
        if (this._runway && !upper.includes(this._runway.toUpperCase())) {
            missing.push('runway ' + this._runway);
        }

        // Check taxiway names
        if (this._route?.taxiways) {
            for (const tw of this._route.taxiways) {
                if (!upper.includes(tw.toUpperCase())) {
                    missing.push('taxiway ' + tw);
                }
            }
        }

        return { valid: missing.length === 0, missing };
    }

    // ── Position Update (called every sim tick) ───────────────

    /**
     * Update aircraft position. Called from pane.js on each sim data tick.
     * Monitors progress along route, detects hold-short, auto-transitions.
     */
    updatePosition(lat, lon, gs, altAGL) {
        if (this._destroyed || this._phase === 'INACTIVE') return;

        this._lastLat = lat;
        this._lastLon = lon;
        this._lastGs = gs;

        // Auto-activate when on ground near airport
        if (this._phase === 'PARKED' || this._phase === 'TAXI_CLEARANCE_PENDING') return;

        // Airborne detection
        if (altAGL > 50) {
            if (this._phase === 'CLEARED_TAKEOFF') {
                this._setPhase('AIRBORNE');
                this._emit('Airborne, good day', 'phase');
                // Auto-deactivate after a brief delay
                setTimeout(() => {
                    if (this._phase === 'AIRBORNE') this.deactivate();
                }, 5000);
            }
            return;
        }

        // Route progress tracking (TAXIING phase)
        if (this._phase === 'TAXIING' && this._route?.waypoints) {
            this._trackRouteProgress(lat, lon, gs);
        }

        // Auto-issue takeoff clearance after hold-short delay
        if (this._phase === 'HOLD_SHORT') {
            if (Date.now() - this._holdShortTime > this._holdShortDelay) {
                this.reportReadyForDeparture();
                // Auto-clear after 2 more seconds
                setTimeout(() => {
                    if (this._phase === 'TAKEOFF_CLEARANCE_PENDING') {
                        this.issueTakeoffClearance();
                    }
                }, 2000);
            }
        }
    }

    // ── Route Progress Tracking ───────────────────────────────

    _trackRouteProgress(lat, lon, gs) {
        const waypoints = this._route.waypoints;
        if (this._currentWaypointIdx >= waypoints.length) return;

        const wp = waypoints[this._currentWaypointIdx];
        const distToWp = this._distanceFt(lat, lon, wp.lat, wp.lon);

        // Advance waypoint when within 100ft (~30m)
        if (distToWp < 100) {
            this._currentWaypointIdx++;

            // Check if we've reached a runway hold point
            if (wp.type === 'RUNWAY_HOLD') {
                this._holdShortTime = Date.now();
                this._setPhase('HOLD_SHORT');
                this._emit(`Hold short runway ${this._runway}`, 'hold_short');
                return;
            }

            // Announce taxiway transitions
            if (this._currentWaypointIdx < waypoints.length) {
                const next = waypoints[this._currentWaypointIdx];
                if (next.type === 'TAXIWAY' && next.name !== wp.name) {
                    this._emit(`Turn onto taxiway ${next.name}`, 'taxi_turn');
                }
            }

            // Reached end of route (runway threshold)
            if (this._currentWaypointIdx >= waypoints.length) {
                this._holdShortTime = Date.now();
                this._setPhase('HOLD_SHORT');
                this._emit(`Hold short runway ${this._runway}`, 'hold_short');
            }
        }

        // Off-route detection: if nearest node is not on our route path
        // and we're more than 200ft from the expected waypoint
        if (distToWp > 500 && gs > 2) {
            // Don't spam — only warn once per 10 seconds
            if (!this._lastOffRouteWarn || Date.now() - this._lastOffRouteWarn > 10000) {
                this._lastOffRouteWarn = Date.now();
                this._emit('Verify position — you appear to be off route', 'warning');
            }
        }
    }

    // ── Internal Helpers ──────────────────────────────────────

    _setPhase(newPhase) {
        const old = this._phase;
        if (old === newPhase) return;
        this._phase = newPhase;
        this._phaseEntryTime = Date.now();
        if (this._onPhaseChange) this._onPhaseChange(old, newPhase);
    }

    _emit(text, type) {
        if (this._onInstruction) this._onInstruction(text, type);
    }

    /** Haversine distance in feet between two lat/lon points */
    _distanceFt(lat1, lon1, lat2, lon2) {
        const R = 20902231; // Earth radius in feet
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Bearing from point 1 to point 2 in degrees */
    _bearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1r = lat1 * Math.PI / 180;
        const lat2r = lat2 * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2r);
        const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    destroy() {
        this._destroyed = true;
        this._route = null;
        this._graph = null;
        this._onInstruction = null;
        this._onPhaseChange = null;
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ATCController;
}
