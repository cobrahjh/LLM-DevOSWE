/**
 * Server-Side ATC Controller
 * Type: module | Category: backend
 * Path: backend/ai-autopilot/atc-server.js
 *
 * Extends the browser ATCController for server-side use.
 * Calls A* pathfinding functions directly instead of HTTP fetch.
 * Logs ATC instructions to console instead of browser TTS.
 */

const path = require('path');
const ATCController = require(path.join(__dirname, '../../ui/ai-autopilot/modules/atc-controller'));

class ATCServerController extends ATCController {
    /**
     * @param {Object} options
     * @param {Function} options.requestFacilityGraph - async (icao) => graph
     * @param {Function} options.findNearestNode - (graph, lat, lon) => { nodeIndex, distance_ft }
     * @param {Function} options.findRunwayNode - (graph, runway) => nodeIndex
     * @param {Function} options.aStarRoute - (graph, startIdx, goalIdx) => route
     * @param {Function} [options.onInstruction] - optional callback for ATC instructions
     * @param {Function} [options.onPhaseChange] - optional callback for phase changes
     */
    constructor(options = {}) {
        super({
            onInstruction: options.onInstruction || null,
            onPhaseChange: options.onPhaseChange || null
        });

        this._requestFacilityGraph = options.requestFacilityGraph;
        this._findNearestNode = options.findNearestNode;
        this._findRunwayNode = options.findRunwayNode;
        this._aStarRoute = options.aStarRoute;

        // Airport detection state
        this._detectedIcao = null;
        this._detectedRunways = null;
    }

    /**
     * Override: call A* directly instead of HTTP fetch.
     * @param {string} icao - Airport ICAO
     * @param {string} runway - Target runway ident
     */
    async requestTaxiClearance(icao, runway) {
        if (this._destroyed) return;
        if (!icao || !runway) return;
        if (this._phase !== 'INACTIVE' && this._phase !== 'PARKED') return;

        this._icao = icao.toUpperCase();
        this._runway = runway;
        this._setPhase('TAXI_CLEARANCE_PENDING');

        try {
            // Load facility graph directly (no HTTP)
            const graph = await this._requestFacilityGraph(this._icao);
            if (!graph || !graph.nodes) {
                this._emit(`No facility graph available for ${this._icao}`, 'error');
                this._setPhase('PARKED');
                return;
            }
            this._graph = graph;

            // Find start and goal nodes
            const start = this._findNearestNode(graph, this._lastLat, this._lastLon);
            const goalIdx = this._findRunwayNode(graph, runway);

            if (start.nodeIndex < 0 || goalIdx < 0) {
                this._emit(`Cannot find route nodes for runway ${runway}`, 'error');
                this._setPhase('PARKED');
                return;
            }

            // Run A* pathfinding
            const route = this._aStarRoute(graph, start.nodeIndex, goalIdx);

            if (route.success) {
                this._route = route;
                this._currentWaypointIdx = 1; // Skip start node (we're already there)

                const taxiStr = route.taxiways?.length
                    ? ` via ${route.taxiways.join(', ')}` : '';
                const instruction = `${this._callsign}, taxi to runway ${runway}${taxiStr}`;

                console.log(`[ATC] ${instruction} (${route.waypoints?.length || 0} waypoints, ${route.distance_ft}ft)`);
                this._emit(instruction, 'taxi_clearance');
                this._setPhase('TAXIING');
            } else {
                this._emit(`Unable to find taxi route to runway ${runway}: ${route.error || 'no path'}`, 'error');
                this._setPhase('PARKED');
            }
        } catch (e) {
            console.error('[ATC] Route computation error:', e.message);
            this._emit(`ATC route error: ${e.message}`, 'error');
            this._setPhase('PARKED');
        }
    }

    /** Set detected airport info (from airport detection poll) */
    setDetectedAirport(icao, runways) {
        this._detectedIcao = icao;
        this._detectedRunways = runways;
    }

    /** Get detected airport ICAO */
    getDetectedIcao() {
        return this._detectedIcao;
    }

    /** Get detected runways */
    getDetectedRunways() {
        return this._detectedRunways;
    }

    /**
     * Pick the best runway based on current aircraft heading.
     * Later can incorporate wind data.
     * @param {number} heading - Current aircraft heading in degrees
     * @returns {string|null} Best runway ident
     */
    pickBestRunway(heading) {
        if (!this._detectedRunways || this._detectedRunways.length === 0) return null;
        let best = null, bestErr = 360;
        for (const rwy of this._detectedRunways) {
            // Use heading field if available, else parse from ident
            // NavDB idents have "RW" prefix: "RW16C" → 160°, "RW09" → 090°
            let rwyHdg = rwy.heading;
            if (rwyHdg == null) {
                const stripped = rwy.ident.replace(/^RW/, '');
                const rwyNum = parseInt(stripped);
                if (isNaN(rwyNum)) continue;
                rwyHdg = rwyNum * 10;
            }
            const err = Math.abs(((heading - rwyHdg + 540) % 360) - 180);
            if (err < bestErr) {
                bestErr = err;
                best = rwy.ident;
            }
        }
        return best;
    }

    /** Full state snapshot for API/broadcast */
    getFullState() {
        return {
            phase: this._phase,
            icao: this._icao || this._detectedIcao,
            runway: this._runway,
            detectedIcao: this._detectedIcao,
            instruction: this.getATCInstruction(),
            route: this.getRoute(),
            nextWaypoint: this.getNextWaypoint()
        };
    }
}

module.exports = ATCServerController;
