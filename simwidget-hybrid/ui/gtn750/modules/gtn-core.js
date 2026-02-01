/**
 * GTN Core - Shared utilities and base functionality
 * Extracted from widget.js for modular architecture
 */

class GTNCore {
    constructor() {
        this.earthRadiusNM = 3440.065;
    }

    // ===== DISTANCE & BEARING =====

    calculateDistance(lat1, lon1, lat2, lon2) {
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return this.earthRadiusNM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

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
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
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

    getTerrainColor(terrainAlt, aircraftAlt) {
        const clearance = aircraftAlt - terrainAlt;

        if (clearance < 100) return '#ff0000';      // Red - PULL UP
        if (clearance < 500) return '#ff6600';      // Orange - Warning
        if (clearance < 1000) return '#ffcc00';     // Yellow - Caution
        if (clearance < 2000) return '#00aa00';     // Green - Safe
        return '#0a1520';                            // Black/Dark - Clear
    }

    getTerrainAlertLevel(terrainAlt, aircraftAlt, verticalSpeed) {
        const clearance = aircraftAlt - terrainAlt;
        const predictedClearance = clearance + (verticalSpeed / 60); // 1 second prediction

        if (predictedClearance < 100) return { level: 'PULL_UP', color: '#ff0000' };
        if (predictedClearance < 300) return { level: 'TERRAIN', color: '#ff6600' };
        if (clearance < 500 && verticalSpeed < -500) return { level: 'DONT_SINK', color: '#ffcc00' };
        return { level: 'CLEAR', color: null };
    }

    // ===== TRAFFIC COLORS =====

    getTrafficColor(relativeAlt, closureRate) {
        // Resolution Advisory
        if (Math.abs(relativeAlt) < 300 && closureRate > 0) return '#ff0000';
        // Traffic Advisory
        if (Math.abs(relativeAlt) < 1000 && closureRate > 0) return '#ffcc00';
        // Non-threat
        return '#ffffff';
    }

    getTrafficSymbol(relativeAlt) {
        if (Math.abs(relativeAlt) < 300) return 'diamond-filled';
        if (relativeAlt > 300) return 'arrow-up';
        if (relativeAlt < -300) return 'arrow-down';
        return 'diamond';
    }

    // ===== WEATHER COLORS =====

    getMetarColor(flightCategory) {
        const colors = {
            'VFR': '#00ff00',
            'MVFR': '#0099ff',
            'IFR': '#ff0000',
            'LIFR': '#ff00ff'
        };
        return colors[flightCategory] || '#888888';
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

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNCore;
}
