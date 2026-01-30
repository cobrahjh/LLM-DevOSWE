/**
 * GTN750 Nearest Page - Displays nearby airports, VORs, NDBs, and fixes
 * Shows distance, bearing, and basic info for each navaid
 */

class NearestPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;

        // Current state
        this.activeType = 'apt'; // apt, vor, ndb, fix
        this.items = [];
        this.selectedItem = null;
        this.position = { lat: 40.6413, lon: -73.7781 };

        // Elements
        this.elements = {};

        // Callbacks
        this.onItemSelect = options.onItemSelect || (() => {});
        this.onDirectTo = options.onDirectTo || (() => {});
    }

    /**
     * Initialize page
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.fetchNearby();
    }

    cacheElements() {
        this.elements = {
            tabs: document.querySelectorAll('.nrst-tab'),
            list: document.getElementById('nrst-list')
        };
    }

    bindEvents() {
        // Type tabs
        this.elements.tabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchType(tab.dataset.type);
            });
        });
    }

    /**
     * Update position from flight data
     */
    setPosition(lat, lon) {
        this.position = { lat, lon };
    }

    /**
     * Switch navaid type
     */
    switchType(type) {
        this.activeType = type;

        // Update tabs
        this.elements.tabs?.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Fetch new data
        this.fetchNearby();
    }

    /**
     * Fetch nearby items
     */
    async fetchNearby() {
        this.showLoading();

        try {
            const url = `http://${location.hostname}:${this.serverPort}/api/nearby/${this.activeType === 'apt' ? 'airports' : this.activeType}?lat=${this.position.lat}&lon=${this.position.lon}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                this.items = data.airports || data.items || [];
                this.renderList();
                return;
            }
        } catch (e) {
            console.log(`[GTN750] Nearby ${this.activeType} fetch failed:`, e.message);
        }

        // Generate sample data for VOR/NDB/FIX (not implemented in API yet)
        if (this.activeType !== 'apt') {
            this.items = this.generateSampleNavaids(this.activeType);
        } else {
            this.items = [];
        }
        this.renderList();
    }

    /**
     * Generate sample navaids for demo
     */
    generateSampleNavaids(type) {
        const items = [];
        const count = 6 + Math.floor(Math.random() * 6);
        const { lat, lon } = this.position;

        for (let i = 0; i < count; i++) {
            const bearing = (i * 360 / count) + Math.random() * 30;
            const distance = 3 + Math.random() * 40;
            const bearingRad = bearing * Math.PI / 180;

            const itemLat = lat + (distance * Math.cos(bearingRad)) / 60;
            const itemLon = lon + (distance * Math.sin(bearingRad)) / (60 * Math.cos(lat * Math.PI / 180));

            if (type === 'vor') {
                const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const id = `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}`;
                items.push({
                    id,
                    name: `${id} VOR`,
                    type: Math.random() < 0.3 ? 'VOR/DME' : 'VOR',
                    freq: (108 + Math.random() * 10).toFixed(2),
                    lat: itemLat,
                    lon: itemLon,
                    distance: Math.round(distance * 10) / 10,
                    bearing: Math.round(bearing)
                });
            } else if (type === 'ndb') {
                const id = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
                items.push({
                    id,
                    name: `${id} NDB`,
                    type: 'NDB',
                    freq: (200 + Math.floor(Math.random() * 200)).toString(),
                    lat: itemLat,
                    lon: itemLon,
                    distance: Math.round(distance * 10) / 10,
                    bearing: Math.round(bearing)
                });
            } else if (type === 'fix') {
                const fixes = ['ALPHA', 'BRAVO', 'CEDAR', 'DELTA', 'EAGLE', 'FRANK', 'GATOR', 'HAPPY', 'IGLOO', 'JULEP', 'KINGS', 'LEMON'];
                const id = fixes[Math.floor(Math.random() * fixes.length)] + (i > 0 ? i : '');
                items.push({
                    id,
                    name: id,
                    type: 'FIX',
                    lat: itemLat,
                    lon: itemLon,
                    distance: Math.round(distance * 10) / 10,
                    bearing: Math.round(bearing)
                });
            }
        }

        return items.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.elements.list) return;
        this.elements.list.innerHTML = '<div class="gtn-nrst-empty">Searching...</div>';
    }

    /**
     * Render list of nearby items
     */
    renderList() {
        if (!this.elements.list) return;
        this.elements.list.innerHTML = '';

        if (!this.items.length) {
            const empty = document.createElement('div');
            empty.className = 'gtn-nrst-empty';
            empty.textContent = `No ${this.getTypeName()} found nearby`;
            this.elements.list.appendChild(empty);
            return;
        }

        this.items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'gtn-nrst-item';
            if (this.selectedItem === index) {
                row.classList.add('selected');
            }

            // ID/code
            const id = document.createElement('span');
            id.className = 'nrst-id';
            id.textContent = item.icao || item.id;

            // Name
            const name = document.createElement('span');
            name.className = 'nrst-name';
            name.textContent = item.name?.substring(0, 20) || '';

            // Distance
            const dist = document.createElement('span');
            dist.className = 'nrst-dist';
            dist.textContent = `${item.distance}nm`;

            // Bearing
            const brg = document.createElement('span');
            brg.className = 'nrst-brg';
            brg.textContent = `${item.bearing.toString().padStart(3, '0')}°`;

            // Additional info based on type
            const info = document.createElement('span');
            info.className = 'nrst-info';
            if (this.activeType === 'apt') {
                info.textContent = item.type?.substring(0, 3) || '';
            } else if (item.freq) {
                info.textContent = item.freq;
            }

            row.appendChild(id);
            row.appendChild(name);
            row.appendChild(dist);
            row.appendChild(brg);
            row.appendChild(info);

            row.addEventListener('click', () => this.selectItem(index));
            this.elements.list.appendChild(row);
        });
    }

    /**
     * Get type name for display
     */
    getTypeName() {
        const names = { apt: 'airports', vor: 'VORs', ndb: 'NDBs', fix: 'fixes' };
        return names[this.activeType] || 'items';
    }

    /**
     * Select an item
     */
    selectItem(index) {
        this.selectedItem = index;
        this.renderList();
        this.onItemSelect(this.items[index], this.activeType);
    }

    /**
     * Get selected item
     */
    getSelectedItem() {
        if (this.selectedItem === null) return null;
        return this.items[this.selectedItem];
    }

    /**
     * Direct-to selected item
     */
    directTo() {
        const item = this.getSelectedItem();
        if (item) {
            this.onDirectTo(item);
            console.log(`[GTN750] Direct-To: ${item.icao || item.id}`);
        }
    }

    /**
     * Show on map
     */
    showOnMap() {
        const item = this.getSelectedItem();
        if (item) {
            console.log(`[GTN750] Show on map: ${item.icao || item.id} at ${item.lat}, ${item.lon}`);
            return { lat: item.lat, lon: item.lon, item };
        }
        return null;
    }

    /**
     * Refresh list
     */
    refresh() {
        this.fetchNearby();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NearestPage;
}
