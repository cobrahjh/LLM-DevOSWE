/**
 * SimGlass Terrain Grid — Real elevation data from EarthEnv GMTED2010
 * Loads binary terrain grid (TGRD format) and provides elevation lookups
 *
 * Binary format (terrain-grid-10km.bin):
 *   Header (32 bytes):
 *     [0-3]   magic "TGRD"
 *     [4-5]   version (UInt16LE)
 *     [6-7]   width (UInt16LE)
 *     [8-9]   height (UInt16LE)
 *     [10-13] latMin * 1000 (Int32LE)
 *     [14-17] latMax * 1000 (Int32LE)
 *     [18-21] lonMin * 1000 (Int32LE)
 *     [22-25] lonMax * 1000 (Int32LE)
 *     [26-29] resolution * 100000 (Int32LE)
 *     [30-31] reserved
 *   Data: Int16LE row-major elevations in meters (top-to-bottom, left-to-right)
 *
 * @version 1.0.0
 */

class TerrainGrid {
    constructor() {
        this.loaded = false;
        this.loading = false;
        this.grid = null;     // Int16Array
        this.width = 0;
        this.height = 0;
        this.latMin = 0;
        this.latMax = 0;
        this.lonMin = 0;
        this.lonMax = 0;
        this.cellDeg = 0;     // degrees per cell
        this.cellKm = 0;      // km per cell
        this._loadPromise = null;
        this._M_TO_FT = 3.28084;
    }

    /**
     * Load terrain grid from binary file
     * @param {string} url - URL to .bin file (default: 10km grid)
     * @returns {Promise<boolean>} true if loaded successfully
     */
    async load(url) {
        if (this.loaded) return true;
        if (this._loadPromise) return this._loadPromise;

        url = url || '/ui/shared/data/terrain-grid-10km.bin';

        this._loadPromise = this._doLoad(url);
        return this._loadPromise;
    }

    async _doLoad(url) {
        this.loading = true;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const buffer = await response.arrayBuffer();
            const view = new DataView(buffer);

            // Validate magic
            const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
            if (magic !== 'TGRD') throw new Error(`Invalid magic: "${magic}"`);

            // Parse header
            const version = view.getUint16(4, true);
            this.width = view.getUint16(6, true);
            this.height = view.getUint16(8, true);
            this.latMin = view.getInt32(10, true) / 1000;
            this.latMax = view.getInt32(14, true) / 1000;
            this.lonMin = view.getInt32(18, true) / 1000;
            this.lonMax = view.getInt32(22, true) / 1000;
            this.cellDeg = view.getInt32(26, true) / 100000;
            this.cellKm = this.cellDeg * 111.12;

            // Wrap elevation data as Int16Array (no copy needed)
            this.grid = new Int16Array(buffer, 32);

            this.loaded = true;
            this.loading = false;

            console.log(`[TerrainGrid] Loaded: ${this.width}x${this.height}, ${this.cellKm.toFixed(1)}km/cell, ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
            return true;
        } catch (err) {
            console.error('[TerrainGrid] Load failed:', err.message);
            this.loading = false;
            this._loadPromise = null;
            return false;
        }
    }

    /**
     * Get elevation at a lat/lon in meters
     * @param {number} lat - Latitude (-56 to 84)
     * @param {number} lon - Longitude (-180 to 180)
     * @returns {number} Elevation in meters MSL (0 for ocean/out of range)
     */
    getElevationMeters(lat, lon) {
        if (!this.loaded) return 0;

        const row = Math.floor((this.latMax - lat) / this.cellDeg);
        const col = Math.floor((lon - this.lonMin) / this.cellDeg);

        if (row < 0 || row >= this.height || col < 0 || col >= this.width) return 0;
        return this.grid[row * this.width + col];
    }

    /**
     * Get elevation at a lat/lon in feet
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {number} Elevation in feet MSL
     */
    getElevationFeet(lat, lon) {
        return Math.round(this.getElevationMeters(lat, lon) * this._M_TO_FT);
    }

    /**
     * Get max elevation along a path (for look-ahead terrain warnings)
     * Samples elevation at intervals along a great-circle path
     * @param {number} lat1 - Start latitude
     * @param {number} lon1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lon2 - End longitude
     * @param {number} [samples=20] - Number of sample points
     * @returns {{ maxElev: number, maxElevFt: number, maxLat: number, maxLon: number, distNm: number }}
     */
    getMaxElevationAlongPath(lat1, lon1, lat2, lon2, samples = 20) {
        if (!this.loaded) return { maxElev: 0, maxElevFt: 0, maxLat: lat1, maxLon: lon1, distNm: 0 };

        let maxElev = -9999;
        let maxLat = lat1, maxLon = lon1;

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const lat = lat1 + (lat2 - lat1) * t;
            const lon = lon1 + (lon2 - lon1) * t;
            const elev = this.getElevationMeters(lat, lon);
            if (elev > maxElev) {
                maxElev = elev;
                maxLat = lat;
                maxLon = lon;
            }
        }

        // Approximate distance in NM
        const dLat = (lat2 - lat1) * 60;
        const dLon = (lon2 - lon1) * 60 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
        const distNm = Math.sqrt(dLat * dLat + dLon * dLon);

        return {
            maxElev: Math.max(0, maxElev),
            maxElevFt: Math.round(Math.max(0, maxElev) * this._M_TO_FT),
            maxLat,
            maxLon,
            distNm: Math.round(distNm * 10) / 10
        };
    }

    /**
     * Get terrain grid for a rectangular area (for rendering)
     * Returns a 2D array of elevation values in feet
     * @param {number} centerLat - Center latitude
     * @param {number} centerLon - Center longitude
     * @param {number} rangeNm - Range in nautical miles
     * @param {number} [gridSize=64] - Output grid dimensions
     * @returns {Array<Array<{lat, lon, elevation, nmX, nmY}>>} Grid matching TerrainOverlay format
     */
    getAreaGrid(centerLat, centerLon, rangeNm, gridSize = 64) {
        if (!this.loaded) return null;

        const grid = [];
        const nmPerCell = (rangeNm * 2) / gridSize;
        const cosLat = Math.cos(centerLat * Math.PI / 180);

        for (let row = 0; row < gridSize; row++) {
            grid[row] = [];
            for (let col = 0; col < gridSize; col++) {
                const nmX = (col - gridSize / 2) * nmPerCell;
                const nmY = (row - gridSize / 2) * nmPerCell;

                // Convert NM offset to lat/lon
                const lat = centerLat + nmY / 60;
                const lon = centerLon + nmX / (60 * cosLat);

                const elevM = this.getElevationMeters(lat, lon);
                const elevFt = Math.round(elevM * this._M_TO_FT);

                grid[row][col] = {
                    lat,
                    lon,
                    elevation: elevFt,
                    nmX,
                    nmY
                };
            }
        }

        return grid;
    }

    /**
     * Get look-ahead terrain profile along a heading
     * @param {number} lat - Current latitude
     * @param {number} lon - Current longitude
     * @param {number} heading - True heading in degrees
     * @param {number} rangeNm - Look-ahead distance in NM
     * @param {number} [samples=50] - Number of sample points
     * @returns {Array<{distNm, elevFt, lat, lon}>} Elevation profile
     */
    getTerrainProfile(lat, lon, heading, rangeNm, samples = 50) {
        if (!this.loaded) return [];

        const hdgRad = heading * Math.PI / 180;
        const cosLat = Math.cos(lat * Math.PI / 180);
        const profile = [];

        for (let i = 0; i <= samples; i++) {
            const distNm = (i / samples) * rangeNm;
            const dLat = (distNm / 60) * Math.cos(hdgRad);
            const dLon = (distNm / 60) * Math.sin(hdgRad) / cosLat;

            const pLat = lat + dLat;
            const pLon = lon + dLon;
            const elevM = this.getElevationMeters(pLat, pLon);

            profile.push({
                distNm: Math.round(distNm * 10) / 10,
                elevFt: Math.round(elevM * this._M_TO_FT),
                lat: pLat,
                lon: pLon
            });
        }

        return profile;
    }
}

// Singleton instance — shared across all panes
if (!window._terrainGrid) {
    window._terrainGrid = new TerrainGrid();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerrainGrid;
}
