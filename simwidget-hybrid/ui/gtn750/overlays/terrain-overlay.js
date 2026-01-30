/**
 * GTN750 Terrain Overlay - TAWS-style terrain awareness
 * Renders 5-color terrain based on altitude clearance
 */

class TerrainOverlay {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.enabled = false;
        this.terrainData = null;
        this.lastFetchPos = null;
        this.fetchRadius = 50; // NM
        this.gridSize = 32; // Terrain grid resolution
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache

        // View mode: '360' (full circle) or 'arc' (forward 120 degree arc)
        this.viewMode = '360';
        this.arcAngle = 120; // degrees for arc mode
        this.range = 10; // NM range for terrain page

        // TAWS configuration
        this.taws = {
            enabled: true,
            inhibited: false,
            testMode: false,
            alertLevel: 'CLEAR',
            lastAlert: null
        };

        // Alert thresholds (feet)
        this.thresholds = {
            pullUp: 100,
            warning: 300,
            caution: 500,
            safe: 1000,
            clear: 2000
        };

        // Colors matching real GTN TAWS
        this.colors = {
            pullUp: '#ff0000',      // Red - immediate terrain
            warning: '#ff6600',     // Orange - close terrain
            caution: '#ffcc00',     // Yellow - terrain awareness
            safe: '#00aa00',        // Green - adequate clearance
            clear: 'transparent'    // No coloring needed
        };
    }

    /**
     * Enable/disable terrain overlay
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Set view mode: '360' or 'arc'
     */
    setViewMode(mode) {
        if (mode === '360' || mode === 'arc') {
            this.viewMode = mode;
            return true;
        }
        return false;
    }

    /**
     * Get current view mode
     */
    getViewMode() {
        return this.viewMode;
    }

    /**
     * Toggle between 360 and Arc view modes
     */
    toggleViewMode() {
        this.viewMode = this.viewMode === '360' ? 'arc' : '360';
        return this.viewMode;
    }

    /**
     * Set terrain page range
     */
    setRange(range) {
        const validRanges = [2, 5, 10, 20, 50];
        if (validRanges.includes(range)) {
            this.range = range;
            return true;
        }
        return false;
    }

    /**
     * Get current range
     */
    getRange() {
        return this.range;
    }

    /**
     * Inhibit TAWS alerts (pilot action)
     */
    setInhibited(inhibited) {
        this.taws.inhibited = inhibited;
    }

    /**
     * Run TAWS self-test
     */
    runTest() {
        this.taws.testMode = true;
        setTimeout(() => {
            this.taws.testMode = false;
        }, 5000);
    }

    /**
     * Render terrain on map canvas
     */
    render(ctx, aircraft, mapSettings) {
        if (!this.enabled && !this.taws.testMode) return;

        const { latitude, longitude, altitude, heading, verticalSpeed } = aircraft;
        const { range, orientation, width, height } = mapSettings;

        // Generate or use cached terrain grid
        const terrainGrid = this.getTerrainGrid(latitude, longitude, range);

        // Render terrain cells
        this.renderTerrainGrid(ctx, terrainGrid, aircraft, mapSettings);

        // Check for TAWS alerts
        const alert = this.checkTawsAlert(terrainGrid, aircraft);
        if (alert.level !== this.taws.alertLevel) {
            this.taws.alertLevel = alert.level;
            this.dispatchAlert(alert);
        }
    }

    /**
     * Get terrain grid for current position
     */
    getTerrainGrid(lat, lon, range) {
        const cacheKey = `${Math.round(lat * 10)}_${Math.round(lon * 10)}_${range}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.grid;
        }

        // Generate simulated terrain grid
        // In production, this would fetch from Open-Elevation API or local terrain DB
        const grid = this.generateSimulatedTerrain(lat, lon, range);

        this.cache.set(cacheKey, {
            grid,
            timestamp: Date.now()
        });

        return grid;
    }

    /**
     * Generate simulated terrain data
     * Creates realistic-looking terrain based on position
     */
    generateSimulatedTerrain(centerLat, centerLon, range) {
        const grid = [];
        const cellsPerSide = this.gridSize;
        const nmPerCell = (range * 2) / cellsPerSide;

        for (let row = 0; row < cellsPerSide; row++) {
            grid[row] = [];
            for (let col = 0; col < cellsPerSide; col++) {
                // Calculate cell center position
                const offsetNmX = (col - cellsPerSide / 2) * nmPerCell;
                const offsetNmY = (row - cellsPerSide / 2) * nmPerCell;

                // Convert to lat/lon offset (approximate)
                const latOffset = offsetNmY / 60;
                const lonOffset = offsetNmX / (60 * Math.cos(centerLat * Math.PI / 180));

                const cellLat = centerLat + latOffset;
                const cellLon = centerLon + lonOffset;

                // Generate terrain elevation using noise-like function
                const elevation = this.getSimulatedElevation(cellLat, cellLon);

                grid[row][col] = {
                    lat: cellLat,
                    lon: cellLon,
                    elevation: elevation,
                    nmX: offsetNmX,
                    nmY: offsetNmY
                };
            }
        }

        return grid;
    }

    /**
     * Simulated elevation function
     * Creates varied terrain based on coordinates
     */
    getSimulatedElevation(lat, lon) {
        // Use sine waves at different frequencies for terrain variation
        const scale1 = Math.sin(lat * 2.5) * Math.cos(lon * 2.5) * 2000;
        const scale2 = Math.sin(lat * 7) * Math.cos(lon * 5) * 800;
        const scale3 = Math.sin(lat * 15 + lon * 10) * 400;

        // Base elevation varies by latitude (mountains in certain areas)
        const baseElevation = Math.abs(Math.sin(lat * 0.5)) * 3000;

        // Combine for final elevation (minimum 0 = sea level)
        const elevation = Math.max(0, baseElevation + scale1 + scale2 + scale3);

        return Math.round(elevation);
    }

    /**
     * Render terrain grid on canvas
     */
    renderTerrainGrid(ctx, grid, aircraft, mapSettings) {
        const { latitude, longitude, altitude, heading } = aircraft;
        const { range, orientation, width, height } = mapSettings;

        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        const cellsPerSide = grid.length;
        const cellPixelSize = (range * 2 * pixelsPerNm) / cellsPerSide;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotation * Math.PI / 180);
        ctx.translate(-cx, -cy);

        for (let row = 0; row < cellsPerSide; row++) {
            for (let col = 0; col < cellsPerSide; col++) {
                const cell = grid[row][col];
                const clearance = altitude - cell.elevation;
                const color = this.getClearanceColor(clearance);

                if (color !== 'transparent') {
                    const x = cx + cell.nmX * pixelsPerNm - cellPixelSize / 2;
                    const y = cy - cell.nmY * pixelsPerNm - cellPixelSize / 2;

                    ctx.fillStyle = color;
                    ctx.globalAlpha = 0.6;
                    ctx.fillRect(x, y, cellPixelSize + 1, cellPixelSize + 1);
                }
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    /**
     * Get color based on terrain clearance
     */
    getClearanceColor(clearance) {
        if (clearance < this.thresholds.pullUp) return this.colors.pullUp;
        if (clearance < this.thresholds.warning) return this.colors.warning;
        if (clearance < this.thresholds.caution) return this.colors.caution;
        if (clearance < this.thresholds.safe) return this.colors.safe;
        return this.colors.clear;
    }

    /**
     * Check for TAWS alerts
     */
    checkTawsAlert(grid, aircraft) {
        if (this.taws.inhibited) {
            return { level: 'CLEAR', message: null, color: null };
        }

        if (this.taws.testMode) {
            return { level: 'PULL_UP', message: 'PULL UP', color: this.colors.pullUp };
        }

        const { altitude, verticalSpeed, groundSpeed } = aircraft;

        // Find minimum clearance in forward sector
        let minClearance = Infinity;
        let minClearanceAhead = Infinity;
        const cellsPerSide = grid.length;
        const centerIdx = Math.floor(cellsPerSide / 2);

        // Check cells ahead of aircraft (forward 120 degree arc)
        for (let row = 0; row < centerIdx; row++) {
            for (let col = Math.floor(cellsPerSide * 0.2); col < Math.floor(cellsPerSide * 0.8); col++) {
                const cell = grid[row][col];
                const clearance = altitude - cell.elevation;
                minClearance = Math.min(minClearance, clearance);

                // Forward sector (closer to center)
                if (row < centerIdx / 2 && col > cellsPerSide * 0.35 && col < cellsPerSide * 0.65) {
                    minClearanceAhead = Math.min(minClearanceAhead, clearance);
                }
            }
        }

        // Predictive alerts based on vertical speed
        const predictedClearance = minClearanceAhead + (verticalSpeed / 60) * 10; // 10 second lookahead

        // PULL UP - immediate terrain threat
        if (predictedClearance < this.thresholds.pullUp || minClearance < 50) {
            return {
                level: 'PULL_UP',
                message: 'PULL UP',
                color: this.colors.pullUp,
                aural: 'pull_up'
            };
        }

        // TERRAIN - close terrain with descent
        if (minClearanceAhead < this.thresholds.warning && verticalSpeed < -300) {
            return {
                level: 'TERRAIN',
                message: 'TERRAIN',
                color: this.colors.warning,
                aural: 'terrain'
            };
        }

        // DON'T SINK - low altitude descent
        if (altitude < 1000 && verticalSpeed < -500 && minClearance < this.thresholds.caution) {
            return {
                level: 'DONT_SINK',
                message: "DON'T SINK",
                color: this.colors.caution,
                aural: 'dont_sink'
            };
        }

        // TOO LOW TERRAIN - approaching terrain
        if (minClearance < this.thresholds.caution && groundSpeed > 50) {
            return {
                level: 'TOO_LOW_TERRAIN',
                message: 'TOO LOW TERRAIN',
                color: this.colors.caution,
                aural: 'too_low_terrain'
            };
        }

        return { level: 'CLEAR', message: null, color: null };
    }

    /**
     * Dispatch alert event
     */
    dispatchAlert(alert) {
        window.dispatchEvent(new CustomEvent('gtn:taws-alert', {
            detail: alert
        }));
    }

    /**
     * Render dedicated terrain page view
     */
    renderTerrainPage(ctx, aircraft, width, height) {
        const range = 10; // Fixed 10nm range for terrain page
        const terrainGrid = this.getTerrainGrid(aircraft.latitude, aircraft.longitude, range);

        // Full terrain view without rotation
        this.renderTerrainGrid(ctx, terrainGrid, aircraft, {
            range,
            orientation: 'track',
            width,
            height
        });

        // Draw aircraft symbol at center
        const cx = width / 2;
        const cy = height / 2;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx - 7, cy + 8);
        ctx.lineTo(cx, cy + 4);
        ctx.lineTo(cx + 7, cy + 8);
        ctx.closePath();
        ctx.fill();

        // Draw range ring
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, 5 * pixelsPerNm, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Update clearance display
        const minClearance = this.getMinClearance(terrainGrid, aircraft.altitude);
        return minClearance;
    }

    /**
     * Get minimum terrain clearance
     */
    getMinClearance(grid, altitude) {
        let minClearance = Infinity;

        for (const row of grid) {
            for (const cell of row) {
                const clearance = altitude - cell.elevation;
                minClearance = Math.min(minClearance, clearance);
            }
        }

        return Math.round(minClearance);
    }

    /**
     * Fetch real terrain data from API
     * (For future integration with Open-Elevation or similar)
     */
    async fetchTerrainData(lat, lon, range) {
        // This would call an elevation API in production
        // For now, return simulated data
        return this.generateSimulatedTerrain(lat, lon, range);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerrainOverlay;
}
