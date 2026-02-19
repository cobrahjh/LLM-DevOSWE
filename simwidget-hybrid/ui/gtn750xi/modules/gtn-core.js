/**
 * GTN Core - Shared utilities and base functionality
 * Extracted from widget.js for modular architecture
 */

class GTNCore {
    constructor() {
        this.earthRadiusNM = 3440.065;

        // TAWS (Terrain Awareness Warning System) thresholds
        this.TAWS_THRESHOLDS = {
            PULL_UP: 100,      // ft - Red alert, immediate action required
            WARNING: 500,      // ft - Orange warning, terrain threat
            CAUTION: 1000,     // ft - Yellow caution, terrain advisory
            SAFE: 2000         // ft - Green safe, adequate clearance
        };

        this.TAWS_COLORS = {
            PULL_UP: '#ff0000',    // Red
            WARNING: '#ff6600',    // Orange
            CAUTION: '#ffcc00',    // Yellow
            SAFE: '#00aa00',       // Green
            CLEAR: '#0a1520'       // Dark background
        };

        // TAWS alert prediction thresholds
        this.TAWS_ALERT_THRESHOLDS = {
            PULL_UP: 100,          // ft - Predicted clearance for PULL UP
            TERRAIN: 300,          // ft - Predicted clearance for TERRAIN
            DONT_SINK_ALT: 500,    // ft - Clearance for DON'T SINK
            DONT_SINK_VS: -500     // fpm - Descent rate threshold
        };

        // Traffic (TCAS) thresholds
        this.TRAFFIC_THRESHOLDS = {
            RESOLUTION_ADVISORY: 300,   // ft - Red, Resolution Advisory
            TRAFFIC_ADVISORY: 1000      // ft - Yellow, Traffic Advisory
        };

        this.TRAFFIC_COLORS = {
            RESOLUTION: '#ff0000',  // Red - Resolution Advisory
            TRAFFIC: '#ffcc00',     // Yellow - Traffic Advisory
            NON_THREAT: '#ffffff'   // White - Non-threat
        };

        // METAR flight category colors
        this.METAR_COLORS = {
            VFR: '#00ff00',     // Green - Visual Flight Rules
            MVFR: '#0099ff',    // Blue - Marginal VFR
            IFR: '#ff0000',     // Red - Instrument Flight Rules
            LIFR: '#ff00ff',    // Magenta - Low IFR
            UNKNOWN: '#888888'  // Gray - Unknown
        };
    }

    // ===== DISTANCE & BEARING =====

    /**
     * Calculate great circle distance between two points using Haversine formula
     * @param {number} lat1 - Starting latitude in decimal degrees (-90 to +90)
     * @param {number} lon1 - Starting longitude in decimal degrees (-180 to +180)
     * @param {number} lat2 - Ending latitude in decimal degrees (-90 to +90)
     * @param {number} lon2 - Ending longitude in decimal degrees (-180 to +180)
     * @returns {number} Distance in nautical miles
     * @example
     * const dist = core.calculateDistance(47.4502, -122.3088, 33.9416, -118.4085);
     * // Returns: 954.2 (KSEA to KLAX)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return this.earthRadiusNM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Calculate initial bearing (forward azimuth) from point 1 to point 2
     * @param {number} lat1 - Starting latitude in decimal degrees
     * @param {number} lon1 - Starting longitude in decimal degrees
     * @param {number} lat2 - Ending latitude in decimal degrees
     * @param {number} lon2 - Ending longitude in decimal degrees
     * @returns {number} True bearing in degrees (0-360), where 0=North, 90=East, 180=South, 270=West
     * @example
     * const brg = core.calculateBearing(47.4502, -122.3088, 47.6062, -122.3321);
     * // Returns: 359.2 (KSEA to KBFI is nearly due north)
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = this.toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
        const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
            Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    toRad(deg) {
        return deg * Math.PI / 180;
    }

    toDeg(rad) {
        return rad * 180 / Math.PI;
    }

    normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    /**
     * Normalize heading to 0-360 range
     */
    normalizeHeading(hdg) {
        return ((hdg % 360) + 360) % 360;
    }

    // ===== MAGNETIC VARIATION =====

    /**
     * Convert true bearing/heading to magnetic
     * @param {number} trueBearing - True bearing in degrees
     * @param {number} magvar - Magnetic variation (positive = east, negative = west)
     * @returns {number} Magnetic bearing
     */
    trueToMagnetic(trueBearing, magvar) {
        return this.normalizeHeading(trueBearing - magvar);
    }

    /**
     * Convert magnetic bearing/heading to true
     * @param {number} magBearing - Magnetic bearing in degrees
     * @param {number} magvar - Magnetic variation (positive = east, negative = west)
     * @returns {number} True bearing
     */
    magneticToTrue(magBearing, magvar) {
        return this.normalizeHeading(magBearing + magvar);
    }

    /**
     * Calculate magnetic bearing between two points
     * @param {number} lat1 - Start latitude
     * @param {number} lon1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lon2 - End longitude
     * @param {number} magvar - Magnetic variation at current position
     * @returns {number} Magnetic bearing
     */
    calculateMagneticBearing(lat1, lon1, lat2, lon2, magvar) {
        const trueBearing = this.calculateBearing(lat1, lon1, lat2, lon2);
        return this.trueToMagnetic(trueBearing, magvar);
    }

    // ===== COORDINATE CONVERSION =====

    nmToPixels(nm, range, canvasSize) {
        return (nm / range) * (canvasSize / 2);
    }

    /**
     * Convert geographic coordinates to canvas pixel coordinates
     * Used for rendering waypoints, traffic, and other map objects
     * @param {number} lat - Object latitude in decimal degrees
     * @param {number} lon - Object longitude in decimal degrees
     * @param {number} centerLat - Center point (aircraft) latitude
     * @param {number} centerLon - Center point (aircraft) longitude
     * @param {number} heading - Map rotation angle (0=North Up)
     * @param {number} range - Map range in nautical miles
     * @param {number} width - Canvas width in pixels
     * @param {number} height - Canvas height in pixels
     * @param {boolean} [northUp=false] - If true, ignores heading rotation
     * @returns {{x: number, y: number}} Canvas coordinates with origin at top-left
     * @example
     * const pos = core.latLonToCanvas(47.45, -122.31, 47.44, -122.30, 360, 10, 520, 280);
     * // Returns: {x: 260, y: 120} - pixel position on canvas
     */
    latLonToCanvas(lat, lon, centerLat, centerLon, heading, range, width, height, northUp = false) {
        const dist = this.calculateDistance(centerLat, centerLon, lat, lon);
        const brg = this.calculateBearing(centerLat, centerLon, lat, lon);
        const rotation = northUp ? 0 : heading;
        const angle = this.toRad(brg - rotation);
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        return {
            x: width / 2 + Math.sin(angle) * dist * pixelsPerNm,
            y: height / 2 - Math.cos(angle) * dist * pixelsPerNm
        };
    }

    // ===== FORMATTING =====

    formatLat(lat) {
        const dir = lat >= 0 ? 'N' : 'S';
        const abs = Math.abs(lat);
        const deg = Math.floor(abs);
        const min = ((abs - deg) * 60).toFixed(2);
        return `${dir}${deg.toString().padStart(2, '0')}\u00B0${min.padStart(5, '0')}'`;
    }

    formatLon(lon) {
        const dir = lon >= 0 ? 'E' : 'W';
        const abs = Math.abs(lon);
        const deg = Math.floor(abs);
        const min = ((abs - deg) * 60).toFixed(2);
        return `${dir}${deg.toString().padStart(3, '0')}\u00B0${min.padStart(5, '0')}'`;
    }

    formatTime(hours) {
        const total = hours * 3600;
        const h = Math.floor(total / 3600) % 24;
        const m = Math.floor((total % 3600) / 60);
        const s = Math.floor(total % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}Z`;
    }

    formatEte(minutes) {
        if (!isFinite(minutes) || minutes < 0) return '--:--';
        const rounded = Math.round(minutes);
        const hrs = Math.floor(rounded / 60);
        const mins = rounded % 60;
        return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}` : `${mins}m`;
    }

    formatFrequency(freq, decimals = 3) {
        return freq.toFixed(decimals);
    }

    formatAltitude(alt) {
        return Math.round(alt).toLocaleString();
    }

    formatHeading(hdg) {
        return Math.round(hdg).toString().padStart(3, '0');
    }

    // ===== TERRAIN COLORS (TAWS) =====

    /**
     * Get color for terrain based on clearance (TAWS color coding)
     * @param {number} terrainAlt - Terrain elevation MSL in feet
     * @param {number} aircraftAlt - Aircraft altitude MSL in feet
     * @returns {string} Hex color code for terrain shading
     * @example
     * const color = core.getTerrainColor(4500, 5000);
     * // Returns: '#ffcc00' (yellow - 500ft clearance)
     */
    getTerrainColor(terrainAlt, aircraftAlt) {
        const clearance = aircraftAlt - terrainAlt;

        if (clearance < this.TAWS_THRESHOLDS.PULL_UP) return this.TAWS_COLORS.PULL_UP;
        if (clearance < this.TAWS_THRESHOLDS.WARNING) return this.TAWS_COLORS.WARNING;
        if (clearance < this.TAWS_THRESHOLDS.CAUTION) return this.TAWS_COLORS.CAUTION;
        if (clearance < this.TAWS_THRESHOLDS.SAFE) return this.TAWS_COLORS.SAFE;
        return this.TAWS_COLORS.CLEAR;
    }

    /**
     * Calculate TAWS alert level with predictive collision detection
     * Uses 1-second lookahead based on vertical speed
     * @param {number} terrainAlt - Terrain elevation MSL in feet
     * @param {number} aircraftAlt - Aircraft altitude MSL in feet
     * @param {number} verticalSpeed - Vertical speed in feet per minute (positive=climb)
     * @returns {{level: string, color: string|null}} Alert level and color
     * @example
     * const alert = core.getTerrainAlertLevel(4900, 5000, -600);
     * // Returns: {level: 'DONT_SINK', color: '#ffcc00'}
     */
    getTerrainAlertLevel(terrainAlt, aircraftAlt, verticalSpeed) {
        const clearance = aircraftAlt - terrainAlt;
        const predictedClearance = clearance + (verticalSpeed / 60); // 1 second prediction

        if (predictedClearance < this.TAWS_ALERT_THRESHOLDS.PULL_UP) {
            return { level: 'PULL_UP', color: this.TAWS_COLORS.PULL_UP };
        }
        if (predictedClearance < this.TAWS_ALERT_THRESHOLDS.TERRAIN) {
            return { level: 'TERRAIN', color: this.TAWS_COLORS.WARNING };
        }
        if (clearance < this.TAWS_ALERT_THRESHOLDS.DONT_SINK_ALT &&
            verticalSpeed < this.TAWS_ALERT_THRESHOLDS.DONT_SINK_VS) {
            return { level: 'DONT_SINK', color: this.TAWS_COLORS.CAUTION };
        }
        return { level: 'CLEAR', color: null };
    }

    // ===== TRAFFIC COLORS =====

    getTrafficColor(relativeAlt, closureRate) {
        // Resolution Advisory (RA) - immediate threat
        if (Math.abs(relativeAlt) < this.TRAFFIC_THRESHOLDS.RESOLUTION_ADVISORY && closureRate > 0) {
            return this.TRAFFIC_COLORS.RESOLUTION;
        }
        // Traffic Advisory (TA) - proximate traffic
        if (Math.abs(relativeAlt) < this.TRAFFIC_THRESHOLDS.TRAFFIC_ADVISORY && closureRate > 0) {
            return this.TRAFFIC_COLORS.TRAFFIC;
        }
        // Non-threat traffic
        return this.TRAFFIC_COLORS.NON_THREAT;
    }

    getTrafficSymbol(relativeAlt) {
        const threshold = this.TRAFFIC_THRESHOLDS.RESOLUTION_ADVISORY;
        if (Math.abs(relativeAlt) < threshold) return 'diamond-filled';
        if (relativeAlt > threshold) return 'arrow-up';
        if (relativeAlt < -threshold) return 'arrow-down';
        return 'diamond';
    }

    // ===== WEATHER COLORS =====

    getMetarColor(flightCategory) {
        return this.METAR_COLORS[flightCategory] || this.METAR_COLORS.UNKNOWN;
    }

    // ===== STORAGE =====

    saveSettings(key, value) {
        try {
            localStorage.setItem(`gtn750_${key}`, JSON.stringify(value));
        } catch (e) {
            console.warn('[GTN] Failed to save settings:', e);
        }
    }

    loadSettings(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(`gtn750_${key}`);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
}

GTNCore.DEBUG = localStorage.getItem('gtn750-debug') === 'true';
GTNCore.log = function(...args) { if (GTNCore.DEBUG) console.log(...args); };

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNCore;
}
