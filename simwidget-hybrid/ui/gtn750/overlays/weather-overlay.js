/**
 * GTN750 Weather Overlay - NEXRAD radar and METAR display
 * Uses RainViewer API for radar and AVWX for METAR data
 */

class WeatherOverlay {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.enabled = false;

        // Layer states
        this.layers = {
            nexrad: false,
            metar: false,
            taf: false,
            winds: false,
            lightning: false
        };

        // Radar data
        this.radarTiles = [];
        this.radarTimestamp = null;
        this.radarAge = 0; // minutes old
        this.radarAnimating = false;
        this.radarFrames = [];
        this.currentFrame = 0;
        this.radarHost = '';
        this.radarTileCache = new Map(); // path -> Image
        this.radarTileSize = 256;

        // METAR data
        this.metarData = new Map(); // icao -> metar
        this.lastMetarFetch = 0;
        this.metarFetchInterval = 300000; // 5 minutes

        // TAF data
        this.tafData = new Map();

        // Wind data
        this.windData = [];

        // Lightning data
        this.lightningStrikes = [];

        // API endpoints
        this.rainViewerApi = 'https://api.rainviewer.com/public/weather-maps.json';

        // Color scales for radar
        this.radarColors = [
            { dbz: 5, color: '#04e904' },   // Light green
            { dbz: 10, color: '#01c501' },  // Green
            { dbz: 15, color: '#fef700' },  // Yellow
            { dbz: 20, color: '#e5bc00' },  // Gold
            { dbz: 25, color: '#fd9500' },  // Orange
            { dbz: 30, color: '#fd0000' },  // Red
            { dbz: 35, color: '#d40000' },  // Dark red
            { dbz: 40, color: '#bc0000' },  // Maroon
            { dbz: 45, color: '#f800fd' },  // Magenta
            { dbz: 50, color: '#9854c6' },  // Purple
            { dbz: 55, color: '#fdfdfd' }   // White
        ];

        // METAR colors for flight category
        this.metarColors = {
            VFR: '#00ff00',
            MVFR: '#0099ff',
            IFR: '#ff0000',
            LIFR: '#ff00ff'
        };
    }

    /**
     * Enable/disable weather overlay
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Toggle individual weather layer
     */
    toggleLayer(layer) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = !this.layers[layer];
            return this.layers[layer];
        }
        return false;
    }

    /**
     * Set layer state
     */
    setLayer(layer, enabled) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = enabled;
        }
    }

    /**
     * Render weather overlays on map canvas
     */
    render(ctx, aircraft, mapSettings) {
        if (!this.enabled) return;

        const { latitude, longitude } = aircraft;
        const { range, orientation, width, height } = mapSettings;

        // Render each enabled layer
        if (this.layers.nexrad) {
            this.renderNexrad(ctx, latitude, longitude, mapSettings);
        }

        if (this.layers.metar) {
            this.renderMetarDotsReal(ctx, latitude, longitude, mapSettings);
        }

        if (this.layers.winds) {
            this.renderWinds(ctx, latitude, longitude, mapSettings);
        }

        if (this.layers.lightning) {
            this.renderLightning(ctx, latitude, longitude, mapSettings);
        }
    }

    /**
     * Render NEXRAD radar overlay
     * Uses RainViewer tiles when available, falls back to simulated data
     */
    renderNexrad(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;

        ctx.save();

        // Apply map rotation if not north-up
        if (orientation !== 'north') {
            ctx.translate(cx, cy);
            ctx.rotate(-mapSettings.heading * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        // Use real radar tiles if available
        if (this.radarHost && this.radarFrames.length > 0) {
            this.renderRadarTiles(ctx, lat, lon, mapSettings);
        } else {
            // Fallback to simulated radar
            this.renderSimulatedRadar(ctx, lat, lon, mapSettings);
        }

        ctx.restore();
    }

    /**
     * Render real radar tiles from RainViewer
     */
    renderRadarTiles(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;

        // Calculate zoom level based on range (nm to degrees approx)
        const degRange = range / 60; // rough nm to degrees
        const zoom = Math.max(3, Math.min(10, Math.floor(8 - Math.log2(degRange))));

        // Get current radar frame
        const frame = this.radarFrames[this.currentFrame] || this.radarFrames[this.radarFrames.length - 1];
        if (!frame) return;

        // Calculate tile coordinates for center
        const centerTile = this.latLonToTile(lat, lon, zoom);

        // How many tiles we need to cover the view (typically 3x3 or 5x5)
        const tilesNeeded = Math.ceil(range / 30) + 1; // More tiles for larger ranges

        // Calculate pixels per tile at this zoom/range
        const nmPerTile = 360 / Math.pow(2, zoom) * 60 * Math.cos(lat * Math.PI / 180);
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const tilePixelSize = nmPerTile * pixelsPerNm;

        ctx.globalAlpha = 0.6;

        // Render tiles in a grid around center
        for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
            for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;

                // Get tile position relative to aircraft
                const tileLat = this.tileToLat(tileY, zoom);
                const tileLon = this.tileToLon(tileX, zoom);
                const tileLat2 = this.tileToLat(tileY + 1, zoom);
                const tileLon2 = this.tileToLon(tileX + 1, zoom);

                // Calculate distance from aircraft to tile center
                const tileCenterLat = (tileLat + tileLat2) / 2;
                const tileCenterLon = (tileLon + tileLon2) / 2;

                const dist = this.core.calculateDistance(lat, lon, tileCenterLat, tileCenterLon);
                if (dist > range * 1.5) continue; // Skip tiles too far away

                // Calculate screen position
                const brg = this.core.calculateBearing(lat, lon, tileCenterLat, tileCenterLon);
                const angle = this.core.toRad(brg);
                const screenX = cx + Math.sin(angle) * dist * pixelsPerNm;
                const screenY = cy - Math.cos(angle) * dist * pixelsPerNm;

                // Load and draw tile
                const tilePath = `${frame.path}/${this.radarTileSize}/${zoom}/${tileX}/${tileY}/2/1_1.png`;
                const tileUrl = `${this.radarHost}${tilePath}`;

                this.loadAndDrawTile(ctx, tileUrl, screenX - tilePixelSize / 2, screenY - tilePixelSize / 2, tilePixelSize);
            }
        }

        ctx.globalAlpha = 1.0;
    }

    /**
     * Load radar tile and draw when ready
     */
    loadAndDrawTile(ctx, url, x, y, size) {
        // Check cache
        let img = this.radarTileCache.get(url);

        if (!img) {
            // Create and cache new image
            img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            this.radarTileCache.set(url, img);

            // Clean old cache entries (keep last 100)
            if (this.radarTileCache.size > 100) {
                const firstKey = this.radarTileCache.keys().next().value;
                this.radarTileCache.delete(firstKey);
            }
        }

        // Draw if loaded
        if (img.complete && img.naturalWidth > 0) {
            try {
                ctx.drawImage(img, x, y, size, size);
            } catch (e) {
                // Tile may have failed to load
            }
        }
    }

    /**
     * Convert lat/lon to tile coordinates
     */
    latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x, y };
    }

    /**
     * Convert tile Y to latitude
     */
    tileToLat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    /**
     * Convert tile X to longitude
     */
    tileToLon(x, zoom) {
        return x / Math.pow(2, zoom) * 360 - 180;
    }

    /**
     * Render simulated radar (fallback)
     */
    renderSimulatedRadar(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        const radarCells = this.generateSimulatedRadar(lat, lon, range);

        ctx.globalAlpha = 0.5;

        radarCells.forEach(cell => {
            const x = cx + cell.offsetX * pixelsPerNm;
            const y = cy - cell.offsetY * pixelsPerNm;
            const cellSize = cell.size * pixelsPerNm;

            ctx.fillStyle = this.getRadarColor(cell.intensity);
            ctx.fillRect(x - cellSize / 2, y - cellSize / 2, cellSize, cellSize);
        });

        ctx.globalAlpha = 1.0;
    }

    /**
     * Generate simulated radar data
     */
    generateSimulatedRadar(centerLat, centerLon, range) {
        const cells = [];
        const numCells = 20;

        // Create weather cells based on position
        const seed = Math.sin(centerLat * 10) * Math.cos(centerLon * 10);

        for (let i = 0; i < numCells; i++) {
            // Pseudo-random but deterministic positions
            const angle = (seed * 1000 + i * 137.5) % 360;
            const dist = ((seed * 500 + i * 17) % range) * 0.8;

            const offsetX = Math.sin(angle * Math.PI / 180) * dist;
            const offsetY = Math.cos(angle * Math.PI / 180) * dist;

            // Intensity varies
            const intensity = 10 + ((seed * 100 + i * 23) % 40);

            // Cell size varies
            const size = 1 + ((seed * 50 + i * 7) % 3);

            cells.push({
                offsetX,
                offsetY,
                intensity,
                size
            });
        }

        return cells;
    }

    /**
     * Get radar color for intensity (dBZ)
     */
    getRadarColor(dbz) {
        for (let i = this.radarColors.length - 1; i >= 0; i--) {
            if (dbz >= this.radarColors[i].dbz) {
                return this.radarColors[i].color;
            }
        }
        return 'transparent';
    }

    /**
     * Render METAR dots at airports
     */
    renderMetarDots(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Simulated METAR positions
        const metarStations = this.generateSimulatedMetar(lat, lon, range);

        metarStations.forEach(station => {
            const dist = this.core.calculateDistance(lat, lon, station.lat, station.lon);
            if (dist > range) return;

            const brg = this.core.calculateBearing(lat, lon, station.lat, station.lon);
            const angle = this.core.toRad(brg - rotation);

            const x = cx + Math.sin(angle) * dist * pixelsPerNm;
            const y = cy - Math.cos(angle) * dist * pixelsPerNm;

            // Draw METAR dot
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = this.metarColors[station.category] || '#888888';
            ctx.fill();

            // Draw station ID
            ctx.font = '8px Consolas, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(station.icao, x, y - 8);
        });
    }

    /**
     * Generate simulated METAR stations
     */
    generateSimulatedMetar(centerLat, centerLon, range) {
        const stations = [];
        const categories = ['VFR', 'MVFR', 'IFR', 'LIFR'];

        // Generate stations in a grid pattern
        const step = range / 3;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;

                const lat = centerLat + (i * step / 60);
                const lon = centerLon + (j * step / (60 * Math.cos(centerLat * Math.PI / 180)));

                // Pseudo-random category
                const catIdx = Math.floor(Math.abs(Math.sin(lat * 100 + lon * 100) * 4)) % 4;

                stations.push({
                    icao: `K${String.fromCharCode(65 + Math.abs(i) * 3 + j)}${String.fromCharCode(66 + Math.abs(j) * 2)}${String.fromCharCode(67 + i + j)}`,
                    lat,
                    lon,
                    category: categories[catIdx]
                });
            }
        }

        return stations;
    }

    /**
     * Render wind barbs
     */
    renderWinds(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        // Simulated wind data points
        const windPoints = this.generateSimulatedWinds(lat, lon, range);

        windPoints.forEach(point => {
            const x = cx + point.offsetX * pixelsPerNm;
            const y = cy - point.offsetY * pixelsPerNm;

            this.drawWindBarb(ctx, x, y, point.direction, point.speed);
        });
    }

    /**
     * Generate simulated wind data
     */
    generateSimulatedWinds(centerLat, centerLon, range) {
        const winds = [];
        const step = range / 2;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const offsetX = i * step;
                const offsetY = j * step;

                // Pseudo-random wind
                const direction = (Math.abs(Math.sin(centerLat * 10 + i) * 360) + i * 30) % 360;
                const speed = 5 + Math.abs(Math.cos(centerLon * 10 + j) * 25);

                winds.push({
                    offsetX,
                    offsetY,
                    direction,
                    speed
                });
            }
        }

        return winds;
    }

    /**
     * Draw wind barb at position
     */
    drawWindBarb(ctx, x, y, direction, speed) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((direction + 180) * Math.PI / 180);

        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 1;

        // Draw staff
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.stroke();

        // Draw barbs based on speed
        let remaining = speed;
        let barbY = -15;

        // Pennants (50 kt)
        while (remaining >= 50) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(5, barbY + 3);
            ctx.lineTo(0, barbY + 6);
            ctx.closePath();
            ctx.fillStyle = '#00aaff';
            ctx.fill();
            barbY += 6;
            remaining -= 50;
        }

        // Long barbs (10 kt)
        while (remaining >= 10) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(8, barbY + 3);
            ctx.stroke();
            barbY += 3;
            remaining -= 10;
        }

        // Short barbs (5 kt)
        if (remaining >= 5) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(4, barbY + 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Render lightning strikes
     */
    renderLightning(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Simulated lightning
        const strikes = this.generateSimulatedLightning(lat, lon, range);

        strikes.forEach(strike => {
            const angle = this.core.toRad(strike.bearing - rotation);
            const x = cx + Math.sin(angle) * strike.distance * pixelsPerNm;
            const y = cy - Math.cos(angle) * strike.distance * pixelsPerNm;

            // Draw lightning symbol
            ctx.fillStyle = strike.age < 5 ? '#ffff00' : '#ff8800';
            ctx.font = '12px Arial';
            ctx.fillText('⚡', x - 5, y + 4);
        });
    }

    /**
     * Generate simulated lightning
     */
    generateSimulatedLightning(lat, lon, range) {
        const strikes = [];
        const time = Date.now() / 1000;

        // Create moving lightning based on time
        for (let i = 0; i < 5; i++) {
            const angle = ((time * 10 + i * 72) % 360);
            const distance = (range * 0.3) + ((time + i * 17) % (range * 0.5));

            strikes.push({
                bearing: angle,
                distance,
                age: i * 3 // minutes ago
            });
        }

        return strikes;
    }

    /**
     * Render weather page with full display
     */
    renderWeatherPage(ctx, aircraft, width, height) {
        const range = 50; // 50nm range for weather page

        // Clear
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, width, height);

        // Draw range rings
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;
        [10, 25, 50].forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * pixelsPerNm, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw own aircraft
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.lineTo(cx, cy + 2);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.closePath();
        ctx.fill();

        // Render weather layers
        this.render(ctx, aircraft, {
            range,
            orientation: 'north',
            width,
            height,
            heading: aircraft.heading
        });

        // Draw legend
        this.drawLegend(ctx, width, height);
    }

    /**
     * Draw weather legend
     */
    drawLegend(ctx, width, height) {
        const legendX = 10;
        let legendY = height - 60;

        ctx.font = '10px Consolas, monospace';

        // METAR legend
        if (this.layers.metar) {
            Object.entries(this.metarColors).forEach(([cat, color], idx) => {
                ctx.fillStyle = color;
                ctx.fillRect(legendX + idx * 40, legendY, 10, 10);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(cat, legendX + idx * 40 + 12, legendY + 9);
            });
            legendY += 15;
        }

        // Radar legend
        if (this.layers.nexrad) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Radar: Light → Heavy', legendX, legendY + 9);
            for (let i = 0; i < 6; i++) {
                ctx.fillStyle = this.radarColors[i * 2].color;
                ctx.fillRect(legendX + 100 + i * 12, legendY, 10, 10);
            }
        }
    }

    /**
     * Fetch real radar data from backend (RainViewer proxy)
     */
    async fetchRadarData() {
        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const response = await fetch(`http://${location.hostname}:${port}/api/weather/radar`);
            const data = await response.json();

            if (data.radar && data.radar.length > 0) {
                this.radarFrames = data.radar;
                this.radarHost = data.host;
                const latest = this.radarFrames[this.radarFrames.length - 1];
                this.radarTimestamp = latest.time;
                this.radarAge = Math.round((Date.now() / 1000 - latest.time) / 60);
                console.log(`[GTN750] Radar data loaded: ${this.radarFrames.length} frames, ${this.radarAge}min old`);
            }
        } catch (e) {
            console.warn('[GTN750] Failed to fetch radar data:', e);
        }
    }

    /**
     * Fetch METARs for nearby airports
     */
    async fetchNearbyMetars(lat, lon, radius = 100) {
        if (Date.now() - this.lastMetarFetch < this.metarFetchInterval) {
            return; // Rate limit
        }

        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const url = `http://${location.hostname}:${port}/api/weather/metar/nearby?lat=${lat}&lon=${lon}&radius=${radius}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.metars && data.metars.length > 0) {
                this.metarData.clear();
                data.metars.forEach(m => {
                    this.metarData.set(m.icao, {
                        icao: m.icao,
                        lat: m.lat,
                        lon: m.lon,
                        category: m.flight_rules || 'VFR',
                        raw: m.raw,
                        temp: m.temp,
                        dewp: m.dewp,
                        wdir: m.wdir,
                        wspd: m.wspd,
                        visib: m.visib
                    });
                });
                this.lastMetarFetch = Date.now();
                console.log(`[GTN750] Loaded ${data.metars.length} METARs`);
            }
        } catch (e) {
            console.warn('[GTN750] Failed to fetch nearby METARs:', e);
        }
    }

    /**
     * Fetch single METAR
     */
    async fetchMetar(icao) {
        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const response = await fetch(`http://${location.hostname}:${port}/api/weather/metar/${icao}`);
            const data = await response.json();

            if (data.raw || data.station) {
                return {
                    icao: data.station || icao,
                    raw: data.raw,
                    category: data.flight_rules || 'VFR',
                    temp: data.temperature?.value,
                    dewp: data.dewpoint?.value,
                    wdir: data.wind_direction?.value,
                    wspd: data.wind_speed?.value,
                    visib: data.visibility?.value,
                    altim: data.altimeter?.value
                };
            }
        } catch (e) {
            console.warn(`[GTN750] Failed to fetch METAR for ${icao}:`, e);
        }
        return null;
    }

    /**
     * Render METAR dots using real data when available
     */
    renderMetarDotsReal(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Use real METAR data if available, otherwise fall back to simulated
        const stations = this.metarData.size > 0
            ? Array.from(this.metarData.values())
            : this.generateSimulatedMetar(lat, lon, range);

        stations.forEach(station => {
            const dist = this.core.calculateDistance(lat, lon, station.lat, station.lon);
            if (dist > range) return;

            const brg = this.core.calculateBearing(lat, lon, station.lat, station.lon);
            const angle = this.core.toRad(brg - rotation);

            const x = cx + Math.sin(angle) * dist * pixelsPerNm;
            const y = cy - Math.cos(angle) * dist * pixelsPerNm;

            // Draw METAR dot
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = this.metarColors[station.category] || '#888888';
            ctx.fill();

            // Draw station ID
            ctx.font = '8px Consolas, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(station.icao, x, y - 8);
        });
    }

    /**
     * Start auto-refresh for weather data
     */
    startAutoRefresh(lat, lon) {
        // Initial fetch
        this.fetchRadarData();
        this.fetchNearbyMetars(lat, lon);

        // Refresh radar every 2 minutes
        this.radarRefreshInterval = setInterval(() => {
            this.fetchRadarData();
        }, 120000);

        // Refresh METARs every 5 minutes
        this.metarRefreshInterval = setInterval(() => {
            this.fetchNearbyMetars(lat, lon);
        }, 300000);
    }

    /**
     * Start radar animation loop
     */
    startRadarAnimation() {
        if (this.radarAnimating) return;
        this.radarAnimating = true;

        this.radarAnimationInterval = setInterval(() => {
            if (this.radarFrames.length > 0) {
                this.currentFrame = (this.currentFrame + 1) % this.radarFrames.length;
            }
        }, 500); // 500ms per frame
    }

    /**
     * Stop radar animation
     */
    stopRadarAnimation() {
        this.radarAnimating = false;
        if (this.radarAnimationInterval) {
            clearInterval(this.radarAnimationInterval);
            this.radarAnimationInterval = null;
        }
        // Reset to latest frame
        this.currentFrame = this.radarFrames.length - 1;
    }

    /**
     * Toggle radar animation
     */
    toggleRadarAnimation() {
        if (this.radarAnimating) {
            this.stopRadarAnimation();
        } else {
            this.startRadarAnimation();
        }
        return this.radarAnimating;
    }

    /**
     * Get current radar frame time
     */
    getCurrentFrameTime() {
        if (this.radarFrames.length === 0) return null;
        const frame = this.radarFrames[this.currentFrame];
        if (!frame) return null;
        return new Date(frame.time * 1000);
    }

    /**
     * Check if radar data is available
     */
    hasRadarData() {
        return this.radarHost && this.radarFrames.length > 0;
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.radarRefreshInterval) {
            clearInterval(this.radarRefreshInterval);
        }
        if (this.metarRefreshInterval) {
            clearInterval(this.metarRefreshInterval);
        }
    }

    /**
     * Get current METAR text for display
     */
    getMetarText(icao) {
        const metar = this.metarData.get(icao);
        return metar?.raw || 'No METAR available';
    }

    /**
     * Get layer states
     */
    getLayers() {
        return { ...this.layers };
    }

    /**
     * Get radar age in minutes
     */
    getRadarAge() {
        return this.radarAge;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherOverlay;
}
