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
        this.gridSize = 64; // Terrain grid resolution (higher = smoother)
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

        // Alert thresholds (feet) - for TAWS warnings
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
            clear: '#004400'        // Dark green - terrain below (always show)
        };

        // Always show terrain mode (shows terrain colors relative to altitude)
        this.alwaysShowTerrain = true;
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
     * Grid regenerates as aircraft moves for smooth terrain scrolling
     */
    getTerrainGrid(lat, lon, range) {
        // More granular cache key - regenerate every ~1nm of movement
        const cacheKey = `${Math.round(lat * 60)}_${Math.round(lon * 60)}_${range}`;
        const cached = this.cache.get(cacheKey);

        // Shorter cache timeout for smoother updates (5 seconds)
        if (cached && Date.now() - cached.timestamp < 5000) {
            return cached.grid;
        }

        // Generate simulated terrain grid
        // In production, this would fetch from Open-Elevation API or local terrain DB
        const grid = this.generateSimulatedTerrain(lat, lon, range);

        // Clear old cache entries to prevent memory growth
        if (this.cache.size > 20) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

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
     * Creates varied terrain with hills, ridges, and valleys
     */
    getSimulatedElevation(lat, lon) {
        // Multiple frequency noise for natural-looking terrain
        // Large scale features (mountains, valleys)
        const large1 = Math.sin(lat * 1.5) * Math.cos(lon * 1.8) * 1500;
        const large2 = Math.sin(lat * 2.2 + lon * 0.5) * 1200;

        // Medium scale features (hills, ridges)
        const med1 = Math.sin(lat * 5) * Math.cos(lon * 4) * 600;
        const med2 = Math.sin(lat * 7 + lon * 6) * Math.cos(lon * 8) * 400;
        const med3 = Math.sin(lat * 9) * Math.sin(lon * 11) * 300;

        // Small scale features (local variation)
        const small1 = Math.sin(lat * 20 + lon * 15) * 150;
        const small2 = Math.cos(lat * 25 - lon * 20) * 100;
        const small3 = Math.sin(lat * 40 + lon * 35) * 50;

        // Ridge lines (creates linear features)
        const ridge = Math.abs(Math.sin(lat * 3 + lon * 2)) * 800;

        // Base elevation with regional variation
        const baseElevation = Math.abs(Math.sin(lat * 0.3) * Math.cos(lon * 0.4)) * 2000;

        // Combine all features
        const elevation = baseElevation + large1 + large2 + med1 + med2 + med3 + small1 + small2 + small3 + ridge;

        // Ensure minimum 0 (sea level)
        return Math.round(Math.max(0, elevation));
    }

    /**
     * Render terrain grid on canvas
     * Uses real ground elevation from MSFS to calculate terrain variation
     */
    renderTerrainGrid(ctx, grid, aircraft, mapSettings, groundElevation = 0, realAGL = null) {
        const { latitude, longitude, altitude, heading } = aircraft;
        const { range, orientation, width, height } = mapSettings;

        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        const cellsPerSide = grid.length;
        const cellPixelSize = (range * 2 * pixelsPerNm) / cellsPerSide;

        // Use real AGL if available, otherwise fall back to calculated clearance
        const useRealAGL = realAGL !== null && realAGL > 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotation * Math.PI / 180);
        ctx.translate(-cx, -cy);

        for (let row = 0; row < cellsPerSide; row++) {
            for (let col = 0; col < cellsPerSide; col++) {
                const cell = grid[row][col];

                // Calculate terrain clearance:
                // If we have real AGL, use ground elevation + simulated terrain variation
                // This creates terrain that matches real-world elevation at aircraft position
                let clearance;
                if (useRealAGL) {
                    // Use real ground elevation as base, add simulated variation
                    const simVariation = cell.elevation - this.getSimulatedElevation(latitude, longitude);
                    const terrainElev = groundElevation + simVariation;
                    clearance = altitude - terrainElev;
                } else {
                    clearance = altitude - cell.elevation;
                }

                const color = this.getClearanceColor(clearance, cell.elevation);

                // Skip transparent cells (terrain well below aircraft)
                if (color === 'transparent') continue;

                const x = cx + cell.nmX * pixelsPerNm - cellPixelSize / 2;
                const y = cy - cell.nmY * pixelsPerNm - cellPixelSize / 2;

                ctx.fillStyle = color;
                ctx.globalAlpha = 0.75;
                ctx.fillRect(x, y, cellPixelSize + 1, cellPixelSize + 1);
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    /**
     * Render terrain grid with Arc view (forward 120 degree only)
     * Uses real ground elevation from MSFS when available
     */
    renderTerrainGridArc(ctx, grid, aircraft, width, height, groundElevation = 0, realAGL = null) {
        const { altitude, latitude, longitude } = aircraft;
        const range = this.range;
        const cx = width / 2;
        const cy = height * 0.85;
        const pixelsPerNm = Math.min(width, height * 0.8) / range;
        const cellsPerSide = grid.length;
        const cellPixelSize = (range * 2 * pixelsPerNm) / cellsPerSide;
        const halfArc = (this.arcAngle / 2) * Math.PI / 180;

        // Use real AGL if available
        const useRealAGL = realAGL !== null && realAGL > 0;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, range * pixelsPerNm, -Math.PI / 2 - halfArc, -Math.PI / 2 + halfArc);
        ctx.closePath();
        ctx.clip();

        for (let row = 0; row < cellsPerSide; row++) {
            for (let col = 0; col < cellsPerSide; col++) {
                const cell = grid[row][col];
                const angle = Math.atan2(cell.nmX, -cell.nmY);
                if (Math.abs(angle) > halfArc) continue;
                const distance = Math.sqrt(cell.nmX * cell.nmX + cell.nmY * cell.nmY);
                if (distance > range) continue;

                // Calculate clearance using real ground elevation if available
                let clearance;
                if (useRealAGL) {
                    const simVariation = cell.elevation - this.getSimulatedElevation(latitude, longitude);
                    const terrainElev = groundElevation + simVariation;
                    clearance = altitude - terrainElev;
                } else {
                    clearance = altitude - cell.elevation;
                }

                const color = this.getClearanceColor(clearance, cell.elevation);
                // Skip transparent cells
                if (color === 'transparent') continue;
                const x = cx + cell.nmX * pixelsPerNm - cellPixelSize / 2;
                const y = cy + cell.nmY * pixelsPerNm - cellPixelSize / 2;
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.75;
                ctx.fillRect(x, y, cellPixelSize + 1, cellPixelSize + 1);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Draw arc outline
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, range * pixelsPerNm, -Math.PI / 2 - halfArc, -Math.PI / 2 + halfArc);
        ctx.closePath();
        ctx.stroke();

        // Draw range arcs
        ctx.strokeStyle = '#00aa00';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        [0.25, 0.5, 0.75].forEach(fraction => {
            ctx.beginPath();
            ctx.arc(cx, cy, range * fraction * pixelsPerNm, -Math.PI / 2 - halfArc, -Math.PI / 2 + halfArc);
            ctx.stroke();
        });
        ctx.setLineDash([]);
    }

    /**
     * Get color based on terrain clearance (relative to aircraft altitude)
     * Matches real GTN 750 TAWS display colors
     */
    getClearanceColor(clearance, elevation = 0) {
        // Real GTN 750 terrain colors (relative to aircraft):
        // Red = terrain within 500ft of aircraft or ABOVE
        // Yellow = terrain 500-1000ft below
        // Green = terrain 1000-1500ft below
        // No color = terrain more than 1500ft below

        if (clearance <= 0) return '#ff0000';           // Above aircraft - solid red
        if (clearance < 100) return '#ff0000';          // Within 100ft - red (PULL UP)
        if (clearance < 300) return '#ff4400';          // Within 300ft - red-orange
        if (clearance < 500) return '#ff6600';          // Within 500ft - orange
        if (clearance < 750) return '#ffaa00';          // 500-750ft - yellow-orange
        if (clearance < 1000) return '#ffcc00';         // 750-1000ft - yellow
        if (clearance < 1250) return '#88cc00';         // 1000-1250ft - yellow-green
        if (clearance < 1500) return '#44aa00';         // 1250-1500ft - green

        // Below 1500ft clearance - no terrain color (black/transparent)
        return 'transparent';
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
     * Render dedicated terrain page view with 360/Arc mode support
     * Uses real AGL from MSFS when available for accurate terrain coloring
     */
    renderTerrainPage(ctx, aircraft, width, height) {
        const terrainGrid = this.getTerrainGrid(aircraft.latitude, aircraft.longitude, this.range);

        // Use real AGL from MSFS if available
        const realAGL = aircraft.altitudeAGL || aircraft.altitude;
        const groundElevation = aircraft.altitude - realAGL;

        // Clear background
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, width, height);

        if (this.viewMode === 'arc') {
            // Arc view - forward 120 only, aircraft at bottom
            this.renderTerrainGridArc(ctx, terrainGrid, aircraft, width, height, groundElevation, realAGL);

            // Draw aircraft at bottom center
            const cx = width / 2;
            const cy = height * 0.85;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 10);
            ctx.lineTo(cx - 7, cy + 8);
            ctx.lineTo(cx, cy + 4);
            ctx.lineTo(cx + 7, cy + 8);
            ctx.closePath();
            ctx.fill();

            // Draw view mode indicator
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('ARC', 10, 20);
        } else {
            // 360 view - full circle, aircraft at center
            this.renderTerrainGrid(ctx, terrainGrid, aircraft, {
                range: this.range,
                orientation: 'track',
                width,
                height
            }, groundElevation, realAGL);

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

            // Draw range rings
            const pixelsPerNm = Math.min(width, height) / 2 / this.range;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            [0.5, 1].forEach(fraction => {
                ctx.beginPath();
                ctx.arc(cx, cy, this.range * fraction * pixelsPerNm, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.setLineDash([]);

            // Draw compass rose
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            const radius = this.range * pixelsPerNm - 15;
            ctx.fillText('N', cx, cy - radius);
            ctx.fillText('S', cx, cy + radius + 10);
            ctx.fillText('E', cx + radius + 5, cy + 4);
            ctx.fillText('W', cx - radius - 5, cy + 4);

            // Draw view mode indicator
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('360', 10, 20);
        }

        // Draw range indicator
        ctx.fillStyle = '#00ffff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(this.range + ' NM', width - 10, 20);

        // Return real AGL as clearance (actual terrain clearance at aircraft position)
        return Math.round(realAGL);
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
