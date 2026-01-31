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
            simRadar: false,  // Sim weather radar visualization
            metar: false,
            taf: false,
            winds: false,
            lightning: false
        };

        // Sim weather data (updated from widget)
        this.simWeather = {
            precipState: 0,
            visibility: 10000,
            windDirection: 0,
            windSpeed: 0,
            ambientTemp: 15
        };

        // Radar sweep animation
        this.radarSweepAngle = 0;
        this.lastSweepTime = 0;

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
        if (this.layers.simRadar) {
            this.renderSimWeatherRadar(ctx, latitude, longitude, mapSettings);
        }

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
     * Update sim weather data from widget
     */
    updateSimWeather(data) {
        if (data.precipState !== undefined) this.simWeather.precipState = data.precipState;
        if (data.visibility !== undefined) this.simWeather.visibility = data.visibility;
        if (data.windDirection !== undefined) this.simWeather.windDirection = data.windDirection;
        if (data.windSpeed !== undefined) this.simWeather.windSpeed = data.windSpeed;
        if (data.ambientTemp !== undefined) this.simWeather.ambientTemp = data.ambientTemp;
    }

    /**
     * Render sim weather as radar visualization
     * Shows precipitation, visibility reduction as radar returns
     */
    renderSimWeatherRadar(ctx, lat, lon, mapSettings) {
        const { range, width, height, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const maxRadius = Math.min(width, height) / 2;

        const precip = this.simWeather.precipState || 0;
        const vis = this.simWeather.visibility || 10000;
        const wind = this.simWeather.windSpeed || 0;

        // Update sweep animation
        const now = Date.now();
        if (now - this.lastSweepTime > 50) {
            this.radarSweepAngle = (this.radarSweepAngle + 3) % 360;
            this.lastSweepTime = now;
        }

        ctx.save();

        // Determine weather intensity
        let intensity = 0;
        let weatherType = 'none';

        if (precip & 4) {
            weatherType = 'snow';
            intensity = 30 + (wind > 15 ? 15 : 0);
        } else if (precip & 2) {
            weatherType = 'rain';
            intensity = wind > 25 ? 50 : (wind > 15 ? 40 : 25);
        }

        // Add intensity based on low visibility
        if (vis < 1000) intensity = Math.max(intensity, 20);
        else if (vis < 3000) intensity = Math.max(intensity, 10);

        // Only render if there's weather
        if (intensity > 0) {
            // Calculate coverage based on visibility and precip
            const coverage = Math.max(0.3, Math.min(1.0, (10000 - vis) / 8000));
            const weatherRadius = maxRadius * coverage;

            // Generate weather cells based on wind direction
            const windRad = (this.simWeather.windDirection || 0) * Math.PI / 180;
            const numCells = Math.floor(20 + intensity);

            ctx.globalAlpha = 0.6;

            for (let i = 0; i < numCells; i++) {
                // Cells concentrated in wind direction with spread
                const spread = (Math.random() - 0.5) * Math.PI;
                const angle = windRad + spread;
                const dist = Math.random() * weatherRadius * 0.9;

                const x = cx + Math.sin(angle) * dist;
                const y = cy - Math.cos(angle) * dist;

                // Cell size varies
                const cellSize = (3 + Math.random() * 8) * (intensity / 30);

                // Color based on intensity
                const cellIntensity = intensity * (0.5 + Math.random() * 0.5);
                ctx.fillStyle = this.getRadarColor(cellIntensity);

                // Draw cell with slight blur effect
                ctx.beginPath();
                ctx.arc(x, y, cellSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw additional scattered cells for realism
            for (let i = 0; i < numCells / 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * weatherRadius;
                const x = cx + Math.sin(angle) * dist;
                const y = cy - Math.cos(angle) * dist;
                const cellSize = 2 + Math.random() * 4;
                const cellIntensity = intensity * 0.3 * Math.random();

                ctx.fillStyle = this.getRadarColor(cellIntensity);
                ctx.beginPath();
                ctx.arc(x, y, cellSize, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1.0;
        }

        // Draw radar sweep line
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        const sweepRad = this.radarSweepAngle * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(sweepRad) * maxRadius, cy - Math.cos(sweepRad) * maxRadius);
        ctx.stroke();

        // Draw sweep fade trail
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, -Math.PI/2 + sweepRad - 0.5, -Math.PI/2 + sweepRad);
        ctx.lineTo(cx, cy);
        ctx.fillStyle = '#00ff00';
        ctx.fill();

        ctx.globalAlpha = 1.0;

        // Draw range rings
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1].forEach(frac => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxRadius * frac, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw weather type label
        if (intensity > 0) {
            ctx.font = '10px Consolas, monospace';
            ctx.fillStyle = this.getRadarColor(intensity);
            ctx.textAlign = 'left';
            ctx.fillText(weatherType.toUpperCase(), 10, 20);
            ctx.fillStyle = '#888';
            ctx.fillText('SIM WX', 10, 32);
        } else {
            ctx.font = '10px Consolas, monospace';
            ctx.fillStyle = '#00aa00';
            ctx.textAlign = 'left';
            ctx.fillText('CLEAR', 10, 20);
            ctx.fillStyle = '#888';
            ctx.fillText('SIM WX', 10, 32);
        }

        ctx.restore();
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
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Draw aircraft position wind barb from sim weather (if available)
        if (this.simWeather.windSpeed > 0) {
            this.drawWindBarb(ctx, cx, cy, this.simWeather.windDirection - rotation, this.simWeather.windSpeed, true);
        }

        // Grid wind data points
        const windPoints = this.generateSimulatedWinds(lat, lon, range);

        windPoints.forEach(point => {
            // Skip center point (aircraft position already drawn)
            if (point.offsetX === 0 && point.offsetY === 0) return;

            // Apply map rotation to position
            const rotRad = this.core.toRad(rotation);
            const rotX = point.offsetX * Math.cos(rotRad) - point.offsetY * Math.sin(rotRad);
            const rotY = point.offsetX * Math.sin(rotRad) + point.offsetY * Math.cos(rotRad);

            const x = cx + rotX * pixelsPerNm;
            const y = cy - rotY * pixelsPerNm;

            // Rotate wind direction for heading-up display
            this.drawWindBarb(ctx, x, y, point.direction - rotation, point.speed, false);
        });
    }

    /**
     * Generate wind data grid
     * Uses actual sim weather as base with slight variations for surrounding points
     */
    generateSimulatedWinds(centerLat, centerLon, range) {
        const winds = [];
        const step = range / 2;

        // Base wind from sim weather (or default)
        const baseDir = this.simWeather.windDirection || 270;
        const baseSpeed = this.simWeather.windSpeed || 10;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const offsetX = i * step;
                const offsetY = j * step;

                // Add slight variations based on position (simulates wind field)
                // Direction varies +/- 15 degrees, speed varies +/- 20%
                const seed = Math.sin(centerLat * 10 + i * 7) * Math.cos(centerLon * 10 + j * 11);
                const dirVariation = seed * 15;
                const speedVariation = seed * 0.2;

                const direction = (baseDir + dirVariation + 360) % 360;
                const speed = Math.max(0, baseSpeed * (1 + speedVariation));

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
     * Standard meteorological wind barb: staff points toward wind source,
     * barbs on LEFT side when looking from base to tip
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} direction - Wind direction (where wind is FROM, in degrees)
     * @param {number} speed - Wind speed in knots
     * @param {boolean} isAircraft - If true, draw larger/highlighted for aircraft position
     */
    drawWindBarb(ctx, x, y, direction, speed, isAircraft = false) {
        ctx.save();
        ctx.translate(x, y);

        // Wind barb points in direction wind is FROM
        // Canvas: 0° = up, rotation is clockwise
        // Wind direction 0° = from north, so barb should point up
        ctx.rotate(direction * Math.PI / 180);

        const staffLen = isAircraft ? 25 : 18;
        const barbLen = isAircraft ? 10 : 7;
        const shortBarbLen = isAircraft ? 5 : 4;
        const barbSpacing = isAircraft ? 4 : 3;
        const pennantWidth = isAircraft ? 5 : 4;

        // Colors
        const color = isAircraft ? '#00ffff' : '#00aaff';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = isAircraft ? 2 : 1.5;
        ctx.lineCap = 'round';

        // Draw staff (pointing toward wind source, i.e., "up" in rotated frame)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -staffLen);
        ctx.stroke();

        // Calm wind (< 3 kt): draw circle only
        if (speed < 3) {
            ctx.beginPath();
            ctx.arc(0, 0, isAircraft ? 5 : 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Draw barbs from tip of staff downward
        // Barbs on LEFT side (-x direction in rotated frame)
        let remaining = Math.round(speed);
        let barbY = -staffLen;

        // Pennants (50 kt) - filled triangles
        while (remaining >= 50) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-barbLen, barbY + pennantWidth / 2);
            ctx.lineTo(0, barbY + pennantWidth);
            ctx.closePath();
            ctx.fill();
            barbY += pennantWidth + 1;
            remaining -= 50;
        }

        // Long barbs (10 kt)
        while (remaining >= 10) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-barbLen, barbY - barbSpacing);
            ctx.stroke();
            barbY += barbSpacing;
            remaining -= 10;
        }

        // Short barb (5 kt)
        if (remaining >= 5) {
            // If this is the only barb, offset it from the tip
            if (barbY === -staffLen) {
                barbY += barbSpacing;
            }
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-shortBarbLen, barbY - barbSpacing / 2);
            ctx.stroke();
        }

        // Draw speed text for aircraft wind
        if (isAircraft && speed >= 3) {
            ctx.restore();
            ctx.save();
            ctx.translate(x, y);
            ctx.font = 'bold 10px Consolas, monospace';
            ctx.fillStyle = '#00ffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(speed)}kt`, 0, staffLen / 2 + 2);
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
    renderWeatherPage(ctx, aircraft, width, height, range = 50) {

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

        // Render weather layers (always render on weather page, regardless of enabled state)
        const mapSettings = {
            range,
            orientation: 'north',
            width,
            height,
            heading: aircraft.heading
        };

        // Render sim radar if enabled
        if (this.layers.simRadar) {
            this.renderSimWeatherRadar(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }

        // Render NEXRAD if enabled
        if (this.layers.nexrad) {
            this.renderNexrad(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }

        // Render METAR dots if enabled
        if (this.layers.metar) {
            this.renderMetarDotsReal(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }

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
