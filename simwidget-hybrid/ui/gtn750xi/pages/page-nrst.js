/**
 * GTN750 Nearest Page - Displays nearby airports, VORs, NDBs, and fixes
 * Shows distance, bearing, and basic info for each navaid
 */

class NearestPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.frequencyTuner = options.frequencyTuner || null;

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
        // If position is outside US coverage (no active flight), keep default US position
        // FAA navdb only covers US — lat ~24-72, lon ~-180 to -60
        if (lat < 20 || lat > 75 || lon > -50 || lon < -185) return;
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

        // Map tab type to navdb API endpoint
        const typeMap = {
            apt: 'airports',
            vor: 'navaids',
            ndb: 'ndbs',
            fix: 'fixes'
        };

        // Try navdb first (local SQLite), then fall back to legacy API for airports
        const navdbType = typeMap[this.activeType];
        try {
            const navdbUrl = `http://${location.hostname}:${this.serverPort}/api/navdb/nearby/${navdbType}?lat=${this.position.lat}&lon=${this.position.lon}&range=50&limit=25`;
            const response = await fetch(navdbUrl);

            if (response.ok) {
                const data = await response.json();
                this.items = data.items || [];
                // Normalize airport items to match expected format
                if (this.activeType === 'apt') {
                    this.items = this.items.map(a => ({ ...a, icao: a.icao || a.id }));
                }
                this.renderList();
                return;
            }
        } catch (e) {
            GTNCore.log(`[GTN750] NavDB nearby ${this.activeType} failed:`, e.message);
        }

        // Fallback: legacy airports API (aviationapi.com)
        if (this.activeType === 'apt') {
            try {
                const legacyUrl = `http://${location.hostname}:${this.serverPort}/api/nearby/airports?lat=${this.position.lat}&lon=${this.position.lon}`;
                const response = await fetch(legacyUrl);
                if (response.ok) {
                    const data = await response.json();
                    this.items = data.airports || data.items || [];
                    this.renderList();
                    return;
                }
            } catch (e) {
                GTNCore.log(`[GTN750] Legacy nearby airports failed:`, e.message);
            }
        }

        this.items = [];
        this.renderList();
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
                // Create clickable frequency button
                const freqBtn = document.createElement('button');
                freqBtn.className = 'nrst-freq-btn';
                freqBtn.textContent = item.freq;
                freqBtn.title = 'Load to NAV1 standby';
                freqBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Don't trigger row selection
                    this.loadFrequency(item);
                });
                info.appendChild(freqBtn);
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
        if (this.selectedItem === index) {
            this.directTo();
            return;
        }
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
            GTNCore.log(`[GTN750] Direct-To: ${item.icao || item.id}`);
        }
    }

    /**
     * Show on map
     */
    showOnMap() {
        const item = this.getSelectedItem();
        if (item) {
            GTNCore.log(`[GTN750] Show on map: ${item.icao || item.id} at ${item.lat}, ${item.lon}`);
            return { lat: item.lat, lon: item.lon, item };
        }
        return null;
    }

    /**
     * Load navaid frequency to NAV1 standby
     * @param {Object} item - Navaid item with freq property
     */
    async loadFrequency(item) {
        if (!this.frequencyTuner || !item.freq) {
            GTNCore.log('[NRST] No frequency tuner or frequency available');
            return;
        }

        // Parse frequency string to number (e.g., "116.80" -> 116.80)
        const freq = parseFloat(item.freq);
        if (isNaN(freq)) {
            GTNCore.log(`[NRST] Invalid frequency: ${item.freq}`);
            return;
        }

        // Load to NAV1 standby
        const success = await this.frequencyTuner.setFrequency('nav1', 'standby', freq);

        if (success) {
            GTNCore.log(`[NRST] Loaded ${item.id} freq ${freq.toFixed(2)} to NAV1 standby`);

            // Visual feedback - briefly highlight the button
            const btn = event.target;
            if (btn) {
                btn.classList.add('freq-loaded');
                setTimeout(() => btn.classList.remove('freq-loaded'), 800);
            }
        } else {
            GTNCore.log(`[NRST] Failed to load frequency ${freq.toFixed(2)}`);
        }
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
