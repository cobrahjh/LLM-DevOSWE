/**
 * GTN750 Airport Diagram Renderer (SafeTaxi)
 *
 * Renders airport surface diagrams with runways, taxiways, and ownship position.
 * Integrates with NavDB for airport data and AI Autopilot API for taxi graphs.
 *
 * Features:
 * - Runway rendering with numbers and markings
 * - Taxiway network visualization
 * - Real-time ownship position with heading indicator
 * - Taxi route overlay from ATC clearances
 * - Pan/zoom controls
 * - Automatic scaling and centering
 *
 * @version 1.0.0
 * @created 2026-02-13
 */

class GTNAirportDiagram {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.canvas = options.canvas || null;
        this.serverPort = options.serverPort || 8080;

        // State
        this.airport = null;           // Current airport data from NavDB
        this.taxiGraph = null;         // Taxi graph from AI Autopilot API
        this.ownship = null;           // Current aircraft position
        this.taxiRoute = null;         // Active taxi route from ATC
        this.viewport = {
            centerLat: 0,
            centerLon: 0,
            scale: 1.0,             // Pixels per meter
            offsetX: 0,             // Pan offset in pixels
            offsetY: 0
        };

        // Rendering options
        this.options = {
            showRunwayNumbers: true,
            showTaxiwayLabels: true,
            showOwnship: true,
            showTaxiRoute: true,
            showHotspots: true,
            ownshipSize: 20,         // Aircraft symbol size in pixels
            minScale: 0.1,
            maxScale: 10.0
        };

        // Colors
        this.colors = {
            runway: '#333333',
            runwayMarking: '#ffffff',
            taxiway: '#555555',
            taxiwayMarking: '#ffff00',
            taxiwayLabel: '#00ff00',
            ownship: '#00ffff',
            ownshipHeading: '#ff00ff',
            taxiRoute: '#00ff00',
            hotspot: '#ff0000',
            background: '#0a1520'
        };

        this._destroyed = false;
    }

    /**
     * Load airport data and taxi graph
     * @param {string} icao - Airport ICAO code
     */
    async loadAirport(icao) {
        if (this._destroyed) return false;

        try {
            // Fetch airport details from NavDB
            const airportResponse = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/navdb/airport/${icao}`
            );

            if (!airportResponse.ok) {
                throw new Error(`Airport ${icao} not found in NavDB`);
            }

            this.airport = await airportResponse.json();

            // Fetch taxi graph from AI Autopilot API (if available)
            try {
                const taxiResponse = await fetch(
                    `http://${location.hostname}:${this.serverPort}/api/ai-pilot/atc/airport/${icao}`
                );

                if (taxiResponse.ok) {
                    this.taxiGraph = await taxiResponse.json();
                }
            } catch (e) {
                GTNCore.log(`[AirportDiagram] No taxi graph for ${icao}: ${e.message}`);
                this.taxiGraph = null;
            }

            // Center viewport on airport
            this.viewport.centerLat = this.airport.lat;
            this.viewport.centerLon = this.airport.lon;
            this.viewport.offsetX = 0;
            this.viewport.offsetY = 0;

            // Auto-scale to fit all runways
            this.autoScale();

            GTNCore.log(`[AirportDiagram] Loaded ${icao}: ${this.airport.name}`);
            return true;

        } catch (error) {
            GTNCore.log(`[AirportDiagram] Failed to load ${icao}: ${error.message}`);
            this.airport = null;
            this.taxiGraph = null;
            return false;
        }
    }

    /**
     * Update ownship position
     * @param {Object} data - Flight data with lat, lon, heading
     */
    updateOwnship(data) {
        if (!data || !data.latitude || !data.longitude) {
            this.ownship = null;
            return;
        }

        this.ownship = {
            lat: data.latitude,
            lon: data.longitude,
            heading: data.heading || data.groundTrack || 0,
            groundSpeed: data.groundSpeed || 0,
            onGround: data.agl < 50
        };
    }

    /**
     * Set active taxi route from ATC clearance
     * @param {Array} route - Array of waypoint objects with lat/lon
     */
    setTaxiRoute(route) {
        this.taxiRoute = route;
    }

    /**
     * Clear active taxi route
     */
    clearTaxiRoute() {
        this.taxiRoute = null;
    }

    /**
     * Auto-scale viewport to fit all runways
     */
    autoScale() {
        if (!this.airport || !this.airport.runways || this.airport.runways.length === 0) {
            this.viewport.scale = 1.0;
            return;
        }

        // Find bounding box of all runways
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        for (const runway of this.airport.runways) {
            if (runway.lat1 !== undefined && runway.lon1 !== undefined) {
                minLat = Math.min(minLat, runway.lat1);
                maxLat = Math.max(maxLat, runway.lat1);
                minLon = Math.min(minLon, runway.lon1);
                maxLon = Math.max(maxLon, runway.lon1);
            }
            if (runway.lat2 !== undefined && runway.lon2 !== undefined) {
                minLat = Math.min(minLat, runway.lat2);
                maxLat = Math.max(maxLat, runway.lat2);
                minLon = Math.min(minLon, runway.lon2);
                maxLon = Math.max(maxLon, runway.lon2);
            }
        }

        if (!isFinite(minLat)) {
            this.viewport.scale = 1.0;
            return;
        }

        // Calculate canvas size needed
        if (!this.canvas) return;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // Calculate required scale (with 20% padding)
        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;

        // Convert to meters (approximate)
        const latMeters = latRange * 111320; // 1 degree lat ≈ 111.32 km
        const lonMeters = lonRange * 111320 * Math.cos(this.airport.lat * Math.PI / 180);

        const scaleX = (canvasWidth * 0.8) / lonMeters;
        const scaleY = (canvasHeight * 0.8) / latMeters;

        this.viewport.scale = Math.min(scaleX, scaleY);
        this.viewport.scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, this.viewport.scale));
    }

    /**
     * Convert lat/lon to canvas coordinates
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} {x, y} canvas coordinates
     */
    latLonToCanvas(lat, lon) {
        if (!this.canvas) return { x: 0, y: 0 };

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Calculate meters from center
        const dLat = lat - this.viewport.centerLat;
        const dLon = lon - this.viewport.centerLon;

        const meterY = dLat * 111320; // 1 degree lat ≈ 111.32 km
        const meterX = dLon * 111320 * Math.cos(this.viewport.centerLat * Math.PI / 180);

        // Convert to pixels
        const x = centerX + (meterX * this.viewport.scale) + this.viewport.offsetX;
        const y = centerY - (meterY * this.viewport.scale) + this.viewport.offsetY; // Y is inverted

        return { x, y };
    }

    /**
     * Calculate distance between two lat/lon points (Haversine formula)
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in nautical miles
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Update canvas size to match container
     * @returns {boolean} True if size changed
     */
    updateCanvasSize() {
        if (!this.canvas) return false;

        const container = this.canvas.parentElement;
        if (!container) return false;

        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;

        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            GTNCore.log(`[AirportDiagram] Canvas resized to ${newWidth}x${newHeight}`);
            return true;
        }

        return false;
    }

    /**
     * Render the complete airport diagram
     */
    render() {
        if (!this.canvas || !this.airport) return;

        // Update canvas size to match container (if changed)
        this.updateCanvasSize();

        const ctx = this.canvas.getContext('2d');
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, w, h);

        // Render layers in order (back to front)
        this.renderTaxiGraph(ctx);
        this.renderRunways(ctx);
        this.renderTaxiRoute(ctx);
        this.renderOwnship(ctx);
        this.renderAirportLabel(ctx);
        this.renderScaleIndicator(ctx);
    }

    /**
     * Render runways with markings
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderRunways(ctx) {
        if (!this.airport.runways || this.airport.runways.length === 0) return;

        for (const runway of this.airport.runways) {
            // Skip if missing coordinates
            if (!runway.lat1 || !runway.lon1 || !runway.lat2 || !runway.lon2) continue;

            const p1 = this.latLonToCanvas(runway.lat1, runway.lon1);
            const p2 = this.latLonToCanvas(runway.lat2, runway.lon2);

            // Runway width (scale with zoom, minimum 3 pixels)
            const width = Math.max(3, (runway.width_ft || 100) * 0.3048 * this.viewport.scale);

            // Draw runway surface
            ctx.strokeStyle = this.colors.runway;
            ctx.lineWidth = width;
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Draw centerline marking
            ctx.strokeStyle = this.colors.runwayMarking;
            ctx.lineWidth = Math.max(1, width * 0.05);
            ctx.setLineDash([width * 0.3, width * 0.2]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw runway numbers (if enabled and scale is sufficient)
            if (this.options.showRunwayNumbers && this.viewport.scale > 0.5) {
                this.renderRunwayNumbers(ctx, p1, p2, runway);
            }
        }
    }

    /**
     * Render runway numbers
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} p1 - Start point {x, y}
     * @param {Object} p2 - End point {x, y}
     * @param {Object} runway - Runway data
     */
    renderRunwayNumbers(ctx, p1, p2, runway) {
        const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const angle2 = angle1 + Math.PI;

        // Runway identifiers
        const id1 = runway.ident1 || runway.name?.substring(0, 2) || '';
        const id2 = runway.ident2 || runway.name?.substring(3, 5) || '';

        if (!id1 || !id2) return;

        const fontSize = Math.max(12, 20 * this.viewport.scale);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = this.colors.runwayMarking;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw runway number at each end
        ctx.save();
        ctx.translate(p1.x, p1.y);
        ctx.rotate(angle1 + Math.PI / 2);
        ctx.fillText(id1, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(p2.x, p2.y);
        ctx.rotate(angle2 + Math.PI / 2);
        ctx.fillText(id2, 0, 0);
        ctx.restore();
    }

    /**
     * Render taxi graph (taxiways and nodes)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderTaxiGraph(ctx) {
        if (!this.taxiGraph || !this.taxiGraph.edges) return;

        // Draw taxiway edges
        for (const edge of this.taxiGraph.edges) {
            if (!this.taxiGraph.nodes || !this.taxiGraph.nodes[edge.from] || !this.taxiGraph.nodes[edge.to]) continue;

            const node1 = this.taxiGraph.nodes[edge.from];
            const node2 = this.taxiGraph.nodes[edge.to];

            const p1 = this.latLonToCanvas(node1.lat, node1.lon);
            const p2 = this.latLonToCanvas(node2.lat, node2.lon);

            // Taxiway width (thinner than runways)
            const width = Math.max(2, 15 * this.viewport.scale);

            ctx.strokeStyle = this.colors.taxiway;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Taxiway centerline
            ctx.strokeStyle = this.colors.taxiwayMarking;
            ctx.lineWidth = Math.max(1, width * 0.1);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Draw taxiway label (if enabled and scale is sufficient)
            if (this.options.showTaxiwayLabels && this.viewport.scale > 1.0 && edge.name) {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                ctx.font = `${Math.max(10, 12 * this.viewport.scale)}px Arial`;
                ctx.fillStyle = this.colors.taxiwayLabel;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(edge.name, midX, midY);
            }
        }
    }

    /**
     * Render active taxi route
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderTaxiRoute(ctx) {
        if (!this.options.showTaxiRoute || !this.taxiRoute || this.taxiRoute.length < 2) return;

        ctx.strokeStyle = this.colors.taxiRoute;
        ctx.lineWidth = Math.max(3, 5 * this.viewport.scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([10, 5]);

        ctx.beginPath();
        for (let i = 0; i < this.taxiRoute.length; i++) {
            const wp = this.taxiRoute[i];
            const p = this.latLonToCanvas(wp.lat, wp.lon);

            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Render ownship aircraft symbol
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderOwnship(ctx) {
        if (!this.options.showOwnship || !this.ownship || !this.ownship.onGround) return;

        const p = this.latLonToCanvas(this.ownship.lat, this.ownship.lon);
        const size = this.options.ownshipSize;
        const heading = this.ownship.heading;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((heading - 90) * Math.PI / 180); // -90 to align with north-up

        // Draw aircraft symbol (simple triangle)
        ctx.fillStyle = this.colors.ownship;
        ctx.strokeStyle = this.colors.ownshipHeading;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(size, 0);           // Nose
        ctx.lineTo(-size * 0.5, size * 0.4);  // Left wing
        ctx.lineTo(-size * 0.3, 0);           // Tail notch
        ctx.lineTo(-size * 0.5, -size * 0.4); // Right wing
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Render airport label
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderAirportLabel(ctx) {
        if (!this.airport) return;

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${this.airport.icao} - ${this.airport.name}`, 10, 10);
    }

    /**
     * Render scale indicator bar
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderScaleIndicator(ctx) {
        if (!this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Determine appropriate scale length based on current zoom
        // Target: 100-200px on screen
        const targetPx = 150;
        const metersPerPx = 1 / this.viewport.scale;
        const scaleMeters = Math.round(metersPerPx * targetPx);

        // Round to nice numbers (100, 200, 500, 1000, etc.)
        let niceScale;
        if (scaleMeters < 100) {
            niceScale = Math.ceil(scaleMeters / 50) * 50;
        } else if (scaleMeters < 500) {
            niceScale = Math.ceil(scaleMeters / 100) * 100;
        } else if (scaleMeters < 1000) {
            niceScale = Math.ceil(scaleMeters / 200) * 200;
        } else {
            niceScale = Math.ceil(scaleMeters / 500) * 500;
        }

        const scalePx = niceScale * this.viewport.scale;

        // Draw scale bar in bottom-left corner
        const barX = 10;
        const barY = h - 30;
        const barHeight = 5;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX - 2, barY - 15, scalePx + 4, 25);

        // Scale bar
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX, barY, scalePx, barHeight);

        // Tick marks at ends
        ctx.fillRect(barX, barY - 3, 2, barHeight + 6);
        ctx.fillRect(barX + scalePx - 2, barY - 3, 2, barHeight + 6);

        // Label
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const label = niceScale >= 1000
            ? `${(niceScale / 1000).toFixed(1)}km`
            : `${niceScale}m`;

        ctx.fillText(label, barX + scalePx / 2, barY - 12);
    }

    /**
     * Pan viewport by pixel offset
     * @param {number} dx - X offset in pixels
     * @param {number} dy - Y offset in pixels
     */
    pan(dx, dy) {
        this.viewport.offsetX += dx;
        this.viewport.offsetY += dy;
    }

    /**
     * Zoom viewport
     * @param {number} factor - Zoom factor (>1 zoom in, <1 zoom out)
     */
    zoom(factor) {
        this.viewport.scale *= factor;
        this.viewport.scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, this.viewport.scale));
    }

    /**
     * Center viewport on ownship
     */
    centerOnOwnship() {
        if (!this.ownship) return;
        this.viewport.centerLat = this.ownship.lat;
        this.viewport.centerLon = this.ownship.lon;
        this.viewport.offsetX = 0;
        this.viewport.offsetY = 0;
    }

    /**
     * Center viewport on airport
     */
    centerOnAirport() {
        if (!this.airport) return;
        this.viewport.centerLat = this.airport.lat;
        this.viewport.centerLon = this.airport.lon;
        this.viewport.offsetX = 0;
        this.viewport.offsetY = 0;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this._destroyed = true;
        this.airport = null;
        this.taxiGraph = null;
        this.ownship = null;
        this.taxiRoute = null;
        GTNCore.log('[AirportDiagram] Destroyed');
    }
}
