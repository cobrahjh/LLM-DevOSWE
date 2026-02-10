/**
 * GTN750 Traffic Overlay - ADS-B traffic display with TargetTrend
 * Renders traffic targets with altitude and trend vectors
 */

class TrafficOverlay {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.enabled = false;
        this.mode = 'OPERATE'; // OPERATE, STANDBY, TEST
        this.testTargets = [];
        this.lastUpdate = 0;
        this.updateInterval = 1000; // Update every second

        // Traffic target management with circular buffer
        this.MAX_TARGETS = 100;              // Maximum targets to track
        this.STALE_TARGET_MS = 30000;        // Remove targets not seen in 30s
        this.targets = new Map();            // id → target object

        // Display settings
        this.showTargetTrend = true;
        this.trendDuration = 30; // seconds
        this.altitudeFilter = 'ALL'; // ALL, ABOVE, BELOW, NORMAL

        // Traffic advisory (TA) and resolution advisory (RA) thresholds
        this.taRange = 6; // NM
        this.taAlt = 1200; // feet
        this.raRange = 2; // NM
        this.raAlt = 600; // feet

        // Colors
        this.colors = {
            noThreat: '#ffffff',
            proximateTraffic: '#00ffff',
            trafficAdvisory: '#ffcc00',
            resolutionAdvisory: '#ff0000'
        };

        // Symbols
        this.symbolSize = 10;
    }

    /**
     * Set operating mode
     */
    setMode(mode) {
        this.mode = mode.toUpperCase();
        if (this.mode === 'TEST') {
            this.generateTestTargets();
        } else {
            this.testTargets = [];
        }
    }

    /**
     * Enable/disable traffic display
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Set altitude filter
     */
    setAltitudeFilter(filter) {
        this.altitudeFilter = filter;
    }

    /**
     * Toggle TargetTrend vectors
     */
    setTargetTrend(enabled) {
        this.showTargetTrend = enabled;
    }

    /**
     * Update traffic targets from data source with circular buffer management
     * Prevents memory growth by limiting max targets and removing stale entries
     */
    updateTargets(targets) {
        const now = Date.now();

        // Add or update targets
        targets.forEach(target => {
            this.targets.set(target.id, {
                ...target,
                lastSeen: now
            });
        });

        // Cleanup: Remove stale targets (not seen in 30s)
        for (const [id, target] of this.targets) {
            if (now - target.lastSeen > this.STALE_TARGET_MS) {
                this.targets.delete(id);
            }
        }

        // Enforce max capacity - remove oldest targets if over limit
        if (this.targets.size > this.MAX_TARGETS) {
            const sortedTargets = Array.from(this.targets.entries())
                .sort((a, b) => a[1].lastSeen - b[1].lastSeen);  // Oldest first

            const toRemove = sortedTargets.slice(0, this.targets.size - this.MAX_TARGETS);
            toRemove.forEach(([id]) => this.targets.delete(id));

            GTNCore.log(`[TrafficOverlay] Removed ${toRemove.length} old targets (max: ${this.MAX_TARGETS})`);
        }
    }

    /**
     * Generate test targets for self-test mode
     */
    generateTestTargets() {
        this.testTargets = [
            { id: 'TEST1', lat: 0, lon: 0, relBearing: 30, distance: 3, altitude: 500, verticalSpeed: 0, groundSpeed: 120, heading: 180 },
            { id: 'TEST2', lat: 0, lon: 0, relBearing: 330, distance: 5, altitude: -800, verticalSpeed: -500, groundSpeed: 150, heading: 90 },
            { id: 'TEST3', lat: 0, lon: 0, relBearing: 0, distance: 1.5, altitude: 200, verticalSpeed: 500, groundSpeed: 180, heading: 270 },
            { id: 'TEST4', lat: 0, lon: 0, relBearing: 180, distance: 4, altitude: -200, verticalSpeed: 0, groundSpeed: 100, heading: 0 }
        ];
    }

    /**
     * Render traffic on map canvas
     */
    render(ctx, aircraft, mapSettings) {
        if (!this.enabled || this.mode === 'STANDBY') return;

        // Convert Map to array for rendering (TEST mode still uses array)
        const targets = this.mode === 'TEST' ? this.testTargets : Array.from(this.targets.values());
        const { latitude, longitude, altitude, heading } = aircraft;
        const { range, orientation, width, height } = mapSettings;

        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Render each traffic target
        targets.forEach(target => {
            // Apply altitude filter
            if (!this.passesAltitudeFilter(target.altitude)) return;

            // Calculate position
            let x, y;
            if (target.lat && target.lon) {
                // Calculate from lat/lon
                const dist = this.core.calculateDistance(latitude, longitude, target.lat, target.lon);
                const brg = this.core.calculateBearing(latitude, longitude, target.lat, target.lon);
                const angle = this.core.toRad(brg - rotation);
                x = cx + Math.sin(angle) * dist * pixelsPerNm;
                y = cy - Math.cos(angle) * dist * pixelsPerNm;
            } else {
                // Use relative bearing and distance
                const angle = this.core.toRad(target.relBearing - rotation + heading);
                x = cx + Math.sin(angle) * target.distance * pixelsPerNm;
                y = cy - Math.cos(angle) * target.distance * pixelsPerNm;
            }

            // Check if within display range
            const dist = target.distance || this.core.calculateDistance(latitude, longitude, target.lat, target.lon);
            if (dist > range) return;

            // Determine threat level
            const threatLevel = this.getThreatLevel(target, dist);

            // Draw TargetTrend vector
            if (this.showTargetTrend && target.groundSpeed && target.heading !== undefined) {
                this.drawTrendVector(ctx, x, y, target, pixelsPerNm, rotation, threatLevel);
            }

            // Draw traffic symbol
            this.drawTrafficSymbol(ctx, x, y, target.altitude, threatLevel);

            // Draw altitude label
            this.drawAltitudeLabel(ctx, x, y, target.altitude, target.verticalSpeed);
        });
    }

    /**
     * Check if target passes altitude filter
     */
    passesAltitudeFilter(relativeAlt) {
        switch (this.altitudeFilter) {
            case 'ABOVE':
                return relativeAlt > 0;
            case 'BELOW':
                return relativeAlt < 0;
            case 'NORMAL':
                return Math.abs(relativeAlt) <= 2700;
            default:
                return true;
        }
    }

    /**
     * Get threat level for target
     */
    getThreatLevel(target, distance) {
        const relAlt = Math.abs(target.altitude);

        // Resolution Advisory
        if (distance <= this.raRange && relAlt <= this.raAlt) {
            return 'RA';
        }

        // Traffic Advisory
        if (distance <= this.taRange && relAlt <= this.taAlt) {
            return 'TA';
        }

        // Proximate traffic
        if (distance <= 6 && relAlt <= 1200) {
            return 'PROXIMATE';
        }

        return 'OTHER';
    }

    /**
     * Draw traffic symbol based on relative altitude
     */
    drawTrafficSymbol(ctx, x, y, relativeAlt, threatLevel) {
        const size = this.symbolSize;
        const color = this.getSymbolColor(threatLevel);
        const filled = threatLevel === 'RA' || threatLevel === 'TA';

        ctx.save();
        ctx.translate(x, y);

        // Choose symbol based on relative altitude
        if (Math.abs(relativeAlt) <= 300) {
            // Diamond - same altitude
            this.drawDiamond(ctx, size, color, filled);
        } else if (relativeAlt > 300) {
            // Arrow up - above
            this.drawArrowUp(ctx, size, color, filled);
        } else {
            // Arrow down - below
            this.drawArrowDown(ctx, size, color, filled);
        }

        ctx.restore();
    }

    /**
     * Draw diamond symbol
     */
    drawDiamond(ctx, size, color, filled) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();

        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    /**
     * Draw arrow up symbol (traffic above)
     */
    drawArrowUp(ctx, size, color, filled) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(0, size * 0.2);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.closePath();

        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    /**
     * Draw arrow down symbol (traffic below)
     */
    drawArrowDown(ctx, size, color, filled) {
        ctx.beginPath();
        ctx.moveTo(0, size);
        ctx.lineTo(size * 0.7, -size * 0.5);
        ctx.lineTo(0, -size * 0.2);
        ctx.lineTo(-size * 0.7, -size * 0.5);
        ctx.closePath();

        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    /**
     * Get symbol color based on threat level
     */
    getSymbolColor(threatLevel) {
        switch (threatLevel) {
            case 'RA': return this.colors.resolutionAdvisory;
            case 'TA': return this.colors.trafficAdvisory;
            case 'PROXIMATE': return this.colors.proximateTraffic;
            default: return this.colors.noThreat;
        }
    }

    /**
     * Draw TargetTrend vector (predicted position)
     */
    drawTrendVector(ctx, x, y, target, pixelsPerNm, mapRotation, threatLevel) {
        // Calculate future position based on groundspeed and heading
        const speedNmPerSec = target.groundSpeed / 3600;
        const futureDistNm = speedNmPerSec * this.trendDuration;
        const trendAngle = this.core.toRad(target.heading - mapRotation);

        const endX = x + Math.sin(trendAngle) * futureDistNm * pixelsPerNm;
        const endY = y - Math.cos(trendAngle) * futureDistNm * pixelsPerNm;

        // Draw trend line
        ctx.strokeStyle = this.getSymbolColor(threatLevel);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Draw altitude label
     */
    drawAltitudeLabel(ctx, x, y, relativeAlt, verticalSpeed) {
        const altHundreds = Math.round(relativeAlt / 100);
        const sign = altHundreds >= 0 ? '+' : '';
        const vsArrow = verticalSpeed > 300 ? '↑' : (verticalSpeed < -300 ? '↓' : '');

        ctx.font = '10px Consolas, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(`${sign}${altHundreds}${vsArrow}`, x + 12, y + 4);
    }

    /**
     * Render dedicated traffic page view
     */
    renderTrafficPage(ctx, aircraft, width, height) {
        const range = 10; // Fixed 10nm range for traffic page

        // Clear
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, width, height);

        // Draw range rings
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;
        [2, 6, 10].forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * pixelsPerNm, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw own aircraft
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx - 6, cy + 6);
        ctx.lineTo(cx, cy + 3);
        ctx.lineTo(cx + 6, cy + 6);
        ctx.closePath();
        ctx.fill();

        // Render traffic
        this.render(ctx, aircraft, {
            range,
            orientation: 'track',
            width,
            height
        });

        // Return target count
        return this.mode === 'TEST' ? this.testTargets.length : this.targets.size;
    }

    /**
     * Get current target count
     */
    getTargetCount() {
        return this.mode === 'TEST' ? this.testTargets.length : this.targets.size;
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrafficOverlay;
}
