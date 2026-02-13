/**
 * GTN User Waypoints - Custom waypoint management system
 * Allows pilots to create, store, and manage custom navigation waypoints
 * Integrates with Direct-To, FPL, and NRST systems
 */

class GTNUserWaypoints {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Configuration
        this.config = {
            enabled: true,
            storageKey: 'gtn750-user-waypoints',
            maxWaypoints: 500,
            autoSave: true
        };

        // Waypoint storage (Map: ident -> waypoint object)
        this.waypoints = new Map();

        // Waypoint categories
        this.categories = [
            { id: 'VRP', name: 'VFR Reporting Point', icon: '▲', color: '#00ffff' },
            { id: 'POI', name: 'Point of Interest', icon: '★', color: '#ffff00' },
            { id: 'PVT', name: 'Private Strip', icon: '⊕', color: '#ff8800' },
            { id: 'PRC', name: 'Practice Area', icon: '○', color: '#00ff00' },
            { id: 'WPT', name: 'General Waypoint', icon: '●', color: '#ffffff' }
        ];

        // Load waypoints from storage
        this.loadWaypoints();

        // Callbacks
        this.onChange = options.onChange || null;
    }

    /**
     * Create a new user waypoint
     * @param {Object} data - Waypoint data
     * @returns {Object|null} Created waypoint or null on error
     */
    createWaypoint(data) {
        // Validate required fields
        if (!data.ident || !data.lat || !data.lon) {
            GTNCore.log('[UserWaypoints] Cannot create waypoint: missing required fields');
            return null;
        }

        // Validate identifier format (3-5 alphanumeric characters)
        const ident = data.ident.toUpperCase().trim();
        if (!/^[A-Z0-9]{3,5}$/.test(ident)) {
            GTNCore.log(`[UserWaypoints] Invalid identifier format: ${ident}`);
            return null;
        }

        // Check if identifier already exists
        if (this.waypoints.has(ident)) {
            GTNCore.log(`[UserWaypoints] Waypoint ${ident} already exists`);
            return null;
        }

        // Check max waypoints limit
        if (this.waypoints.size >= this.config.maxWaypoints) {
            GTNCore.log(`[UserWaypoints] Maximum waypoint limit reached (${this.config.maxWaypoints})`);
            return null;
        }

        // Create waypoint object
        const waypoint = {
            ident: ident,
            name: (data.name || '').trim() || ident,
            lat: parseFloat(data.lat),
            lon: parseFloat(data.lon),
            category: data.category || 'WPT',
            notes: (data.notes || '').trim(),
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            isUserWaypoint: true
        };

        // Validate coordinates
        if (waypoint.lat < -90 || waypoint.lat > 90 || waypoint.lon < -180 || waypoint.lon > 180) {
            GTNCore.log(`[UserWaypoints] Invalid coordinates: ${waypoint.lat}, ${waypoint.lon}`);
            return null;
        }

        // Store waypoint
        this.waypoints.set(ident, waypoint);

        // Auto-save
        if (this.config.autoSave) {
            this.saveWaypoints();
        }

        GTNCore.log(`[UserWaypoints] Created waypoint: ${ident} - ${waypoint.name}`);

        // Notify listeners
        if (typeof this.onChange === 'function') {
            this.onChange('create', waypoint);
        }

        return waypoint;
    }

    /**
     * Update an existing user waypoint
     * @param {string} ident - Waypoint identifier
     * @param {Object} updates - Fields to update
     * @returns {boolean} True if updated successfully
     */
    updateWaypoint(ident, updates) {
        const waypoint = this.waypoints.get(ident.toUpperCase());
        if (!waypoint) {
            GTNCore.log(`[UserWaypoints] Waypoint ${ident} not found`);
            return false;
        }

        // Update allowed fields
        if (updates.name !== undefined) waypoint.name = (updates.name || '').trim();
        if (updates.category !== undefined) waypoint.category = updates.category;
        if (updates.notes !== undefined) waypoint.notes = (updates.notes || '').trim();
        if (updates.lat !== undefined) waypoint.lat = parseFloat(updates.lat);
        if (updates.lon !== undefined) waypoint.lon = parseFloat(updates.lon);

        waypoint.modified = new Date().toISOString();

        // Auto-save
        if (this.config.autoSave) {
            this.saveWaypoints();
        }

        GTNCore.log(`[UserWaypoints] Updated waypoint: ${ident}`);

        // Notify listeners
        if (typeof this.onChange === 'function') {
            this.onChange('update', waypoint);
        }

        return true;
    }

    /**
     * Delete a user waypoint
     * @param {string} ident - Waypoint identifier
     * @returns {boolean} True if deleted successfully
     */
    deleteWaypoint(ident) {
        const waypoint = this.waypoints.get(ident.toUpperCase());
        if (!waypoint) {
            return false;
        }

        this.waypoints.delete(ident.toUpperCase());

        // Auto-save
        if (this.config.autoSave) {
            this.saveWaypoints();
        }

        GTNCore.log(`[UserWaypoints] Deleted waypoint: ${ident}`);

        // Notify listeners
        if (typeof this.onChange === 'function') {
            this.onChange('delete', waypoint);
        }

        return true;
    }

    /**
     * Get a user waypoint by identifier
     * @param {string} ident - Waypoint identifier
     * @returns {Object|null} Waypoint object or null
     */
    getWaypoint(ident) {
        return this.waypoints.get(ident.toUpperCase()) || null;
    }

    /**
     * Check if a waypoint identifier exists
     * @param {string} ident - Waypoint identifier
     * @returns {boolean} True if exists
     */
    hasWaypoint(ident) {
        return this.waypoints.has(ident.toUpperCase());
    }

    /**
     * Get all user waypoints
     * @param {string} category - Optional category filter
     * @returns {Array} Array of waypoint objects
     */
    getAllWaypoints(category = null) {
        let waypoints = Array.from(this.waypoints.values());

        if (category) {
            waypoints = waypoints.filter(wp => wp.category === category);
        }

        // Sort by identifier
        waypoints.sort((a, b) => a.ident.localeCompare(b.ident));

        return waypoints;
    }

    /**
     * Search user waypoints by identifier or name
     * @param {string} query - Search query
     * @returns {Array} Matching waypoints
     */
    searchWaypoints(query) {
        const q = query.toUpperCase().trim();
        if (!q) return [];

        const results = [];

        for (const waypoint of this.waypoints.values()) {
            // Match identifier or name
            if (waypoint.ident.includes(q) || waypoint.name.toUpperCase().includes(q)) {
                results.push(waypoint);
            }
        }

        // Sort by relevance (exact match first, then starts with, then contains)
        results.sort((a, b) => {
            const aIdent = a.ident;
            const bIdent = b.ident;

            if (aIdent === q) return -1;
            if (bIdent === q) return 1;
            if (aIdent.startsWith(q) && !bIdent.startsWith(q)) return -1;
            if (bIdent.startsWith(q) && !aIdent.startsWith(q)) return 1;

            return aIdent.localeCompare(bIdent);
        });

        return results;
    }

    /**
     * Find nearest user waypoints to a position
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} maxResults - Maximum results to return
     * @returns {Array} Nearest waypoints with distance
     */
    findNearest(lat, lon, maxResults = 10) {
        const results = [];

        for (const waypoint of this.waypoints.values()) {
            const distance = this.core.calculateDistance(lat, lon, waypoint.lat, waypoint.lon);
            const bearing = this.core.calculateBearing(lat, lon, waypoint.lat, waypoint.lon);

            results.push({
                ...waypoint,
                distance,
                bearing
            });
        }

        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);

        return results.slice(0, maxResults);
    }

    /**
     * Import waypoints from GPX format
     * @param {string} gpxData - GPX XML data
     * @returns {Object} Import results
     */
    importGPX(gpxData) {
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(gpxData, 'text/xml');
            const waypoints = doc.getElementsByTagName('wpt');

            for (let i = 0; i < waypoints.length; i++) {
                const wpt = waypoints[i];
                const lat = parseFloat(wpt.getAttribute('lat'));
                const lon = parseFloat(wpt.getAttribute('lon'));
                const name = wpt.getElementsByTagName('name')[0]?.textContent || '';
                const desc = wpt.getElementsByTagName('desc')[0]?.textContent || '';

                // Generate identifier from name (first 5 chars, alphanumeric only)
                let ident = name.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 5);
                if (ident.length < 3) {
                    ident = `WPT${(i + 1).toString().padStart(2, '0')}`;
                }

                // Check if identifier exists, append number if needed
                let finalIdent = ident;
                let suffix = 1;
                while (this.waypoints.has(finalIdent)) {
                    finalIdent = ident.substring(0, 4) + suffix;
                    suffix++;
                    if (suffix > 9) {
                        results.skipped++;
                        results.errors.push(`Skipped duplicate: ${ident}`);
                        break;
                    }
                }

                if (suffix <= 9) {
                    const created = this.createWaypoint({
                        ident: finalIdent,
                        name: name || finalIdent,
                        lat,
                        lon,
                        category: 'WPT',
                        notes: desc
                    });

                    if (created) {
                        results.imported++;
                    } else {
                        results.skipped++;
                    }
                }
            }

            GTNCore.log(`[UserWaypoints] GPX import: ${results.imported} imported, ${results.skipped} skipped`);

        } catch (e) {
            results.errors.push(`GPX parse error: ${e.message}`);
            GTNCore.log(`[UserWaypoints] GPX import error: ${e.message}`);
        }

        return results;
    }

    /**
     * Export waypoints to GPX format
     * @param {Array} waypoints - Optional waypoints to export (default: all)
     * @returns {string} GPX XML data
     */
    exportGPX(waypoints = null) {
        const wpts = waypoints || this.getAllWaypoints();

        let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GTN750 SimGlass"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>GTN750 User Waypoints</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

        wpts.forEach(wp => {
            gpx += `  <wpt lat="${wp.lat}" lon="${wp.lon}">
    <name>${this.escapeXml(wp.name)}</name>
    <desc>${this.escapeXml(wp.notes || '')}</desc>
    <sym>${wp.category}</sym>
  </wpt>
`;
        });

        gpx += '</gpx>';

        return gpx;
    }

    /**
     * Export waypoints to CSV format
     * @param {Array} waypoints - Optional waypoints to export (default: all)
     * @returns {string} CSV data
     */
    exportCSV(waypoints = null) {
        const wpts = waypoints || this.getAllWaypoints();

        const headers = ['Identifier', 'Name', 'Latitude', 'Longitude', 'Category', 'Notes'];
        const rows = wpts.map(wp => [
            wp.ident,
            wp.name,
            wp.lat.toFixed(6),
            wp.lon.toFixed(6),
            wp.category,
            wp.notes || ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csv;
    }

    /**
     * Import waypoints from CSV format
     * @param {string} csvData - CSV data
     * @returns {Object} Import results
     */
    importCSV(csvData) {
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        try {
            const lines = csvData.trim().split('\n');
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));

                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx];
                });

                const created = this.createWaypoint({
                    ident: row.identifier || row.ident,
                    name: row.name,
                    lat: parseFloat(row.latitude || row.lat),
                    lon: parseFloat(row.longitude || row.lon),
                    category: row.category || 'WPT',
                    notes: row.notes || ''
                });

                if (created) {
                    results.imported++;
                } else {
                    results.skipped++;
                }
            }

            GTNCore.log(`[UserWaypoints] CSV import: ${results.imported} imported, ${results.skipped} skipped`);

        } catch (e) {
            results.errors.push(`CSV parse error: ${e.message}`);
            GTNCore.log(`[UserWaypoints] CSV import error: ${e.message}`);
        }

        return results;
    }

    /**
     * Save waypoints to localStorage
     */
    saveWaypoints() {
        try {
            const data = {
                version: 1,
                waypoints: Array.from(this.waypoints.values()),
                lastSaved: new Date().toISOString()
            };

            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
            GTNCore.log(`[UserWaypoints] Saved ${this.waypoints.size} waypoints`);

        } catch (e) {
            GTNCore.log(`[UserWaypoints] Save error: ${e.message}`);
        }
    }

    /**
     * Load waypoints from localStorage
     */
    loadWaypoints() {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            if (!stored) {
                GTNCore.log('[UserWaypoints] No saved waypoints found');
                return;
            }

            const data = JSON.parse(stored);
            this.waypoints.clear();

            if (data.waypoints && Array.isArray(data.waypoints)) {
                data.waypoints.forEach(wp => {
                    this.waypoints.set(wp.ident, wp);
                });
            }

            GTNCore.log(`[UserWaypoints] Loaded ${this.waypoints.size} waypoints`);

        } catch (e) {
            GTNCore.log(`[UserWaypoints] Load error: ${e.message}`);
        }
    }

    /**
     * Clear all user waypoints
     */
    clearAll() {
        this.waypoints.clear();

        if (this.config.autoSave) {
            this.saveWaypoints();
        }

        GTNCore.log('[UserWaypoints] All waypoints cleared');

        // Notify listeners
        if (typeof this.onChange === 'function') {
            this.onChange('clear', null);
        }
    }

    /**
     * Get category info
     * @param {string} categoryId - Category ID
     * @returns {Object|null} Category info
     */
    getCategory(categoryId) {
        return this.categories.find(c => c.id === categoryId) || null;
    }

    /**
     * Get statistics
     * @returns {Object} Waypoint statistics
     */
    getStats() {
        const stats = {
            total: this.waypoints.size,
            byCategory: {}
        };

        this.categories.forEach(cat => {
            stats.byCategory[cat.id] = 0;
        });

        for (const waypoint of this.waypoints.values()) {
            if (stats.byCategory[waypoint.category] !== undefined) {
                stats.byCategory[waypoint.category]++;
            }
        }

        return stats;
    }

    /**
     * Escape XML special characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.config.autoSave) {
            this.saveWaypoints();
        }
        GTNCore.log('[UserWaypoints] Destroyed');
    }
}

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNUserWaypoints;
}
