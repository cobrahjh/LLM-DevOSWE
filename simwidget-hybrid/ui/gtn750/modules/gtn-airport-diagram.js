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
            showParkingPositions: true,
            showHoldShortLines: true,
            autoFollow: false,       // Auto-center on ownship during taxi
            trackUp: false,          // Rotate diagram to aircraft heading
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
            holdShort: '#ff0000',
            parking: '#4488ff',
            parkingLabel: '#ffffff',
            background: '#0a1520'
        };

        // Performance: Static layer caching
        this.staticCache = null;        // Off-screen canvas for static elements
        this.cacheValid = false;        // Whether cache needs regeneration
        this.lastCacheScale = 0;        // Scale when cache was generated
        this.lastCacheOffsetX = 0;      // OffsetX when cache was generated
        this.lastCacheOffsetY = 0;      // OffsetY when cache was generated

        // Satellite map tiles (fallback when no diagram data)
        this.satelliteEnabled = false;   // Manual toggle for satellite view
        this.satelliteOpacity = 0.8;     // Opacity 0-1 for blending with diagram
        this.autoSatelliteMode = false;  // True if satellite was auto-enabled (no diagram)
        this.tileCache = new Map();      // Cache for loaded map tiles
        this.tileZoomLevel = 16;         // Zoom level for tiles (16 = good detail)
        this.tileProvider = {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
            maxZoom: 19
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

            // Check if we have diagram data (runways or taxiways)
            const hasRunways = this.airport.runways && this.airport.runways.length > 0;
            const hasTaxiways = this.taxiGraph && this.taxiGraph.edges && this.taxiGraph.edges.length > 0;

            if (!hasRunways && !hasTaxiways) {
                // No diagram data - auto-enable satellite view
                this.autoSatelliteMode = true;
                this.tileZoomLevel = 16; // Good detail for airports
                GTNCore.log(`[AirportDiagram] No diagram data for ${icao} - auto-enabling satellite view`);
            } else {
                // Have diagram data - disable auto mode (user can still manually enable)
                this.autoSatelliteMode = false;
            }

            // Auto-scale to fit all runways (or set reasonable default for satellite)
            this.autoScale();

            // Invalidate cache for new airport
            this.invalidateCache();

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

        // Auto-follow mode: center on ownship when moving on ground
        if (this.options.autoFollow && this.ownship.onGround && this.ownship.groundSpeed > 1) {
            this.centerOnOwnship();
        }
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
     * Convert lat/lon to canvas coordinates with Web Mercator projection
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} {x, y} canvas coordinates
     */
    latLonToCanvas(lat, lon) {
        if (!this.canvas) return { x: 0, y: 0 };

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Web Mercator projection for better accuracy
        // Convert lat/lon to meters from viewport center
        const R = 6378137; // Earth radius in meters (WGS84)

        // Convert to radians
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        const centerLatRad = this.viewport.centerLat * Math.PI / 180;
        const centerLonRad = this.viewport.centerLon * Math.PI / 180;

        // Mercator projection
        const x_m = R * (lonRad - centerLonRad);
        const y_m = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2)) -
                    R * Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));

        // Convert meters to pixels
        let x = centerX + (x_m * this.viewport.scale) + this.viewport.offsetX;
        let y = centerY - (y_m * this.viewport.scale) + this.viewport.offsetY; // Y is inverted

        // Apply track-up rotation if enabled
        if (this.options.trackUp && this.ownship && this.ownship.heading !== undefined) {
            const heading = this.ownship.heading;
            const angle = -(heading - 90) * Math.PI / 180; // Rotate to heading-up

            // Rotate around center
            const dx = x - centerX;
            const dy = y - centerY;
            x = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
            y = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);
        }

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
     * Convert lat/lon to tile coordinates at given zoom level
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} zoom - Zoom level
     * @returns {{x: number, y: number}} Tile coordinates
     */
    latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const latRad = lat * Math.PI / 180;
        return {
            x: Math.floor((lon + 180) / 360 * n),
            y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
        };
    }

    /**
     * Convert tile coordinates to lat/lon
     * @param {number} x - Tile X
     * @param {number} y - Tile Y
     * @param {number} zoom - Zoom level
     * @returns {{lat: number, lon: number}} Coordinates
     */
    tileToLatLon(x, y, zoom) {
        const n = Math.pow(2, zoom);
        const lon = x / n * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        const lat = latRad * 180 / Math.PI;
        return { lat, lon };
    }

    /**
     * Load a map tile image
     * @param {number} x - Tile X
     * @param {number} y - Tile Y
     * @param {number} z - Zoom level
     * @returns {Promise<Image>} Loaded tile image
     */
    async loadTile(x, y, z) {
        const key = `${z}/${x}/${y}`;

        // Check cache first
        if (this.tileCache.has(key)) {
            return this.tileCache.get(key);
        }

        // Load tile
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.tileCache.set(key, img);
                resolve(img);
            };

            img.onerror = () => {
                GTNCore.log(`[AirportDiagram] Failed to load tile ${key}`);
                reject(new Error(`Failed to load tile ${key}`));
            };

            const url = this.tileProvider.url
                .replace('{z}', z)
                .replace('{x}', x)
                .replace('{y}', y);

            img.src = url;
        });
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
     * Render the complete airport diagram (with caching)
     */
    async render() {
        if (!this.canvas) return;

        // Update canvas size to match container (if changed)
        this.updateCanvasSize();

        const ctx = this.canvas.getContext('2d');
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear canvas with background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, w, h);

        // Check if airport is loaded
        if (!this.airport) {
            this.renderNoDataMessage(ctx, 'NO AIRPORT LOADED', 'Load an airport using the input above');
            return;
        }

        // Determine if satellite should be shown (manual toggle OR auto mode for missing data)
        const showSatellite = this.satelliteEnabled || this.autoSatelliteMode;

        // If ONLY satellite (no diagram), render satellite and overlays only
        if (showSatellite && this.autoSatelliteMode && !this.satelliteEnabled) {
            // Pure satellite mode (no diagram data)
            await this.renderSatelliteTiles(ctx, 1.0);
            this.renderOwnship(ctx);
            this.renderAirportLabel(ctx);
            this.renderScaleIndicator(ctx);
            this.renderAttribution(ctx);
            return;
        }

        // If satellite enabled manually, render it as background layer with opacity
        if (showSatellite) {
            await this.renderSatelliteTiles(ctx, this.satelliteOpacity);
        }

        // Check if we need to regenerate static cache
        const scaleChanged = Math.abs(this.viewport.scale - this.lastCacheScale) > 0.01;
        const offsetChanged = Math.abs(this.viewport.offsetX - this.lastCacheOffsetX) > 5 ||
                            Math.abs(this.viewport.offsetY - this.lastCacheOffsetY) > 5;

        if (!this.cacheValid || scaleChanged || offsetChanged) {
            this.renderStaticLayers();
            this.cacheValid = true;
            this.lastCacheScale = this.viewport.scale;
            this.lastCacheOffsetX = this.viewport.offsetX;
            this.lastCacheOffsetY = this.viewport.offsetY;
        }

        // Copy cached static layers to main canvas
        if (this.staticCache) {
            ctx.drawImage(this.staticCache, 0, 0);
        }

        // Render dynamic layers on top (re-rendered every frame)
        this.renderTaxiRoute(ctx);
        this.renderOwnship(ctx);
        this.renderAirportLabel(ctx);
        this.renderScaleIndicator(ctx);
    }

    /**
     * Render "no data" message when diagram not available
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} title - Main message title
     * @param {string} subtitle - Detailed message
     */
    renderNoDataMessage(ctx, title, subtitle) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Title
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, w / 2, h / 2 - 40);

        // Subtitle (handle multi-line)
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        const lines = subtitle.split('\n');
        lines.forEach((line, i) => {
            ctx.fillText(line, w / 2, h / 2 + (i * 20));
        });

        // Help text
        ctx.fillStyle = '#888888';
        ctx.font = '12px Arial';
        ctx.fillText('Diagram data only available for major airports', w / 2, h / 2 + 60);
    }

    /**
     * Render satellite map tiles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} opacity - Opacity 0-1 for blending
     */
    async renderSatelliteTiles(ctx, opacity = 1.0) {
        if (!this.airport) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Save context state and apply opacity
        ctx.save();
        ctx.globalAlpha = opacity;

        // Calculate tile coordinates for viewport center
        const centerTile = this.latLonToTile(
            this.viewport.centerLat,
            this.viewport.centerLon,
            this.tileZoomLevel
        );

        // Calculate how many tiles we need to cover the canvas
        // At zoom 16, each tile is 256px representing ~611m at equator
        const metersPerTile = 40075017 / Math.pow(2, this.tileZoomLevel); // Earth circumference / 2^zoom
        const pixelsPerMeter = this.viewport.scale;
        const tilePixelSize = metersPerTile * pixelsPerMeter;

        // If tiles would be too small/large, suggest better zoom level
        if (tilePixelSize < 128) {
            this.tileZoomLevel = Math.max(1, this.tileZoomLevel - 1);
        } else if (tilePixelSize > 512) {
            this.tileZoomLevel = Math.min(this.tileProvider.maxZoom, this.tileZoomLevel + 1);
        }

        // Recalculate with adjusted zoom
        const tilesNeededX = Math.ceil(w / 256) + 2;
        const tilesNeededY = Math.ceil(h / 256) + 2;

        // Load and render tiles
        const promises = [];
        for (let dx = -Math.floor(tilesNeededX / 2); dx <= Math.ceil(tilesNeededX / 2); dx++) {
            for (let dy = -Math.floor(tilesNeededY / 2); dy <= Math.ceil(tilesNeededY / 2); dy++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;

                // Skip invalid tiles
                const maxTile = Math.pow(2, this.tileZoomLevel);
                if (tileX < 0 || tileX >= maxTile || tileY < 0 || tileY >= maxTile) continue;

                // Load tile and render it
                promises.push(
                    this.loadTile(tileX, tileY, this.tileZoomLevel).then(img => {
                        // Get northwest corner of this tile in lat/lon
                        const nwCorner = this.tileToLatLon(tileX, tileY, this.tileZoomLevel);

                        // Get southeast corner (next tile)
                        const seCorner = this.tileToLatLon(tileX + 1, tileY + 1, this.tileZoomLevel);

                        // Convert corners to canvas coordinates
                        const nw = this.latLonToCanvas(nwCorner.lat, nwCorner.lon);
                        const se = this.latLonToCanvas(seCorner.lat, seCorner.lon);

                        // Calculate tile size in pixels
                        const tileWidth = Math.abs(se.x - nw.x);
                        const tileHeight = Math.abs(se.y - nw.y);

                        // Draw tile (use NW corner as position)
                        ctx.drawImage(img, nw.x, nw.y, tileWidth, tileHeight);
                    }).catch(err => {
                        // Silently ignore failed tiles
                        GTNCore.log(`[AirportDiagram] Tile load failed: ${err.message}`);
                    })
                );
            }
        }

        await Promise.all(promises);

        // Restore context state (opacity)
        ctx.restore();
    }

    /**
     * Render attribution text for satellite tiles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderAttribution(ctx) {
        // Show attribution if satellite is enabled (manual or auto)
        if (!this.satelliteEnabled && !this.autoSatelliteMode) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(w - 200, h - 20, 200, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('© Esri, DigitalGlobe', w - 5, h - 5);
    }

    /**
     * Render static layers to off-screen cache (runways, taxiways, parking)
     */
    renderStaticLayers() {
        if (!this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Create or resize cache canvas
        if (!this.staticCache || this.staticCache.width !== w || this.staticCache.height !== h) {
            this.staticCache = document.createElement('canvas');
            this.staticCache.width = w;
            this.staticCache.height = h;
        }

        const ctx = this.staticCache.getContext('2d');

        // Clear cache - use transparent if satellite enabled, opaque background otherwise
        if (this.satelliteEnabled || this.autoSatelliteMode) {
            // Transparent background to show satellite tiles underneath
            ctx.clearRect(0, 0, w, h);
        } else {
            // Opaque background (normal mode)
            ctx.fillStyle = this.colors.background;
            ctx.fillRect(0, 0, w, h);
        }

        // Render static layers in order (back to front)
        this.renderTaxiGraph(ctx);
        this.renderRunways(ctx);
        this.renderHoldShortLines(ctx);
        this.renderParkingPositions(ctx);
        this.renderHotspots(ctx);
    }

    /**
     * Invalidate static cache (forces re-render on next frame)
     */
    invalidateCache() {
        this.cacheValid = false;
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
     * Render runway numbers (always upright relative to viewport)
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

        const fontSize = Math.max(14, 24 * this.viewport.scale);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Use enhanced visibility on satellite imagery
        const useSatellite = this.satelliteEnabled || this.autoSatelliteMode;

        // Helper function to normalize angle to keep text upright
        const normalizeAngle = (angle) => {
            let normalized = angle % (Math.PI * 2);
            // If text would be upside-down, rotate it 180° to keep upright
            if (normalized > Math.PI / 2 && normalized < Math.PI * 3 / 2) {
                normalized += Math.PI;
            } else if (normalized < -Math.PI / 2 && normalized > -Math.PI * 3 / 2) {
                normalized += Math.PI;
            }
            return normalized;
        };

        // Helper to draw text with background for visibility
        const drawRunwayNumber = (text, x, y) => {
            const metrics = ctx.measureText(text);
            const padding = fontSize * 0.3;
            const width = metrics.width + padding * 2;
            const height = fontSize + padding * 2;

            if (useSatellite) {
                // High contrast background for satellite imagery
                // Dark semi-transparent background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(-width / 2, -height / 2, width, height);

                // Bright yellow border
                ctx.strokeStyle = '#FFFF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(-width / 2, -height / 2, width, height);

                // White text with shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(text, 0, 0);

                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                // Standard rendering on diagram
                ctx.fillStyle = this.colors.runwayMarking;
                ctx.fillText(text, 0, 0);
            }
        };

        // In track-up mode, compensate for diagram rotation
        let textAngle1 = angle1 + Math.PI / 2;
        let textAngle2 = angle2 + Math.PI / 2;

        if (this.options.trackUp && this.ownship && this.ownship.heading !== undefined) {
            const heading = this.ownship.heading;
            const rotationOffset = (heading - 90) * Math.PI / 180;
            textAngle1 += rotationOffset;
            textAngle2 += rotationOffset;
        }

        // Draw runway number at each end (always upright)
        ctx.save();
        ctx.translate(p1.x, p1.y);
        ctx.rotate(normalizeAngle(textAngle1));
        drawRunwayNumber(id1, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(p2.x, p2.y);
        ctx.rotate(normalizeAngle(textAngle2));
        drawRunwayNumber(id2, 0, 0);
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
     * Render hold-short lines at runway entries
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderHoldShortLines(ctx) {
        if (!this.options.showHoldShortLines || !this.airport || !this.airport.runways) return;
        if (!this.taxiGraph || !this.taxiGraph.nodes) return;

        // Draw hold-short lines at taxiway-runway intersections
        // These are double yellow dashed lines perpendicular to taxiway
        for (const runway of this.airport.runways) {
            if (!runway.lat1 || !runway.lon1 || !runway.lat2 || !runway.lon2) continue;

            // Find nodes near runway threshold (within 50m)
            const rwThreshold = 50; // meters

            for (const nodeId in this.taxiGraph.nodes) {
                const node = this.taxiGraph.nodes[nodeId];

                // Calculate distance from node to runway centerline
                const distToRwy1 = this.calculateDistance(node.lat, node.lon, runway.lat1, runway.lon1) * 1852; // nm to meters
                const distToRwy2 = this.calculateDistance(node.lat, node.lon, runway.lat2, runway.lon2) * 1852;

                if (distToRwy1 < rwThreshold || distToRwy2 < rwThreshold) {
                    const p = this.latLonToCanvas(node.lat, node.lon);

                    // Draw hold-short marking (perpendicular to runway)
                    const rwAngle = Math.atan2(runway.lat2 - runway.lat1, runway.lon2 - runway.lon1);
                    const lineLength = Math.max(15, 30 * this.viewport.scale);

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(rwAngle);

                    // Double yellow dashed lines
                    ctx.strokeStyle = this.colors.holdShort;
                    ctx.lineWidth = Math.max(2, 3 * this.viewport.scale);
                    ctx.setLineDash([5, 5]);

                    // First line
                    ctx.beginPath();
                    ctx.moveTo(-lineLength, -3);
                    ctx.lineTo(lineLength, -3);
                    ctx.stroke();

                    // Second line
                    ctx.beginPath();
                    ctx.moveTo(-lineLength, 3);
                    ctx.lineTo(lineLength, 3);
                    ctx.stroke();

                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }
        }
    }

    /**
     * Render parking positions (gates, ramps, FBOs)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderParkingPositions(ctx) {
        if (!this.options.showParkingPositions || !this.taxiGraph || !this.taxiGraph.nodes) return;

        // Parking positions are nodes with "parking" type in taxiGraph
        for (const nodeId in this.taxiGraph.nodes) {
            const node = this.taxiGraph.nodes[nodeId];

            // Check if this is a parking position (has parking metadata)
            if (node.type === 'parking' || node.name?.match(/^(GATE|RAMP|PARK|GA)/i)) {
                const p = this.latLonToCanvas(node.lat, node.lon);
                const size = Math.max(8, 10 * this.viewport.scale);

                // Draw parking circle
                ctx.fillStyle = this.colors.parking;
                ctx.strokeStyle = this.colors.parkingLabel;
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Draw parking label (if zoomed in enough)
                if (this.viewport.scale > 0.8 && node.name) {
                    ctx.font = `bold ${Math.max(10, 12 * this.viewport.scale)}px Arial`;
                    ctx.fillStyle = this.colors.parkingLabel;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(node.name, p.x, p.y + size + 3);
                }
            }
        }
    }

    /**
     * Render hotspots (safety critical areas)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    renderHotspots(ctx) {
        if (!this.options.showHotspots || !this.taxiGraph || !this.taxiGraph.hotspots) return;

        // Hotspots are areas where runway incursions are likely
        for (const hotspot of this.taxiGraph.hotspots) {
            if (!hotspot.lat || !hotspot.lon) continue;

            const p = this.latLonToCanvas(hotspot.lat, hotspot.lon);
            const radius = Math.max(20, (hotspot.radius_m || 30) * this.viewport.scale);

            // Draw hotspot circle with red fill and flashing border
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            ctx.strokeStyle = this.colors.hotspot;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw hotspot label "HS" with identifier
            ctx.font = `bold ${Math.max(14, 16 * this.viewport.scale)}px Arial`;
            ctx.fillStyle = this.colors.hotspot;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const label = hotspot.id ? `HS ${hotspot.id}` : 'HS';
            ctx.fillText(label, p.x, p.y);
        }
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

        // In track-up mode, aircraft always points up (no rotation needed)
        // In north-up mode, rotate to heading
        if (!this.options.trackUp) {
            ctx.rotate((heading - 90) * Math.PI / 180); // -90 to align with north-up
        }

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
     * Toggle satellite imagery on/off
     * @returns {boolean} New satellite state
     */
    toggleSatellite() {
        this.satelliteEnabled = !this.satelliteEnabled;
        this.invalidateCache(); // Redraw needed
        GTNCore.log(`[AirportDiagram] Satellite ${this.satelliteEnabled ? 'enabled' : 'disabled'}`);
        return this.satelliteEnabled;
    }

    /**
     * Set satellite opacity
     * @param {number} opacity - Opacity 0-1
     */
    setSatelliteOpacity(opacity) {
        this.satelliteOpacity = Math.max(0, Math.min(1, opacity));
        GTNCore.log(`[AirportDiagram] Satellite opacity: ${Math.round(this.satelliteOpacity * 100)}%`);
    }

    /**
     * Get current satellite state
     * @returns {boolean} True if satellite is currently shown
     */
    isSatelliteActive() {
        return this.satelliteEnabled || this.autoSatelliteMode;
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
