/**
 * VATSIM Live Widget - SimGlass
 * Real-time VATSIM network integration
 * @version 1.0.0
 */

const VATSIM_DATA_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const DEFAULT_UPDATE_INTERVAL = 15000; // 15 seconds (VATSIM recommendation)
const DEFAULT_RANGE_NM = 50;

class VatsimLiveWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'vatsim-live',
            widgetVersion: '1.0.0',
            autoConnect: true  // Connect to SimGlass for position data
        });

        // VATSIM data
        this.vatsimData = null;
        this.pilots = [];
        this.controllers = [];
        this.atis = [];

        // User position
        this.userPosition = { lat: 0, lon: 0, altitude: 0 };

        // Settings
        this.settings = {
            range: DEFAULT_RANGE_NM,
            updateInterval: DEFAULT_UPDATE_INTERVAL,
            showOnMap: true,
            showNotifications: true,
            minAltitude: 0,
            maxAltitude: 50000
        };

        // State
        this.currentTab = 'aircraft';
        this.searchQuery = '';
        this.atcFilter = 'all';

        // BroadcastChannel for map integration
        this.mapChannel = new BroadcastChannel('simglass-sync');

        this.loadSettings();
        this.initUI();
        this.startVatsimUpdates();
    }

    initUI() {
        this.elements = {
            // Status
            vatsimStatus: document.getElementById('vatsim-status'),
            pilotCount: document.getElementById('pilot-count'),
            statusSection: document.getElementById('status-section'),
            statusMessage: document.getElementById('status-message'),

            // Stats
            statPilots: document.getElementById('stat-pilots'),
            statAtc: document.getElementById('stat-atc'),
            statNearby: document.getElementById('stat-nearby'),
            statUpdated: document.getElementById('stat-updated'),

            // Lists
            aircraftList: document.getElementById('aircraft-list'),
            atcList: document.getElementById('atc-list'),

            // Filters
            aircraftSearch: document.getElementById('aircraft-search'),
            filterRange: document.getElementById('filter-range'),
            atcFilter: document.getElementById('atc-filter'),

            // Settings
            rangeSlider: document.getElementById('range-slider'),
            rangeValue: document.getElementById('range-value'),
            updateInterval: document.getElementById('update-interval'),
            showOnMap: document.getElementById('show-on-map'),
            showNotifications: document.getElementById('show-notifications'),
            minAltitude: document.getElementById('min-altitude'),
            maxAltitude: document.getElementById('max-altitude')
        };

        this.initTabs();
        this.initFilters();
        this.initSettings();
    }

    initTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'tab-' + tabName);
        });
    }

    initFilters() {
        this.elements.aircraftSearch.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderAircraft();
        });

        this.elements.filterRange.addEventListener('change', () => {
            this.renderAircraft();
        });

        this.elements.atcFilter.addEventListener('change', (e) => {
            this.atcFilter = e.target.value;
            this.renderATC();
        });
    }

    initSettings() {
        this.elements.rangeSlider.addEventListener('input', (e) => {
            this.settings.range = parseInt(e.target.value);
            this.elements.rangeValue.textContent = this.settings.range + ' nm';
            this.saveSettings();
            this.renderAircraft();
        });

        this.elements.updateInterval.addEventListener('change', (e) => {
            this.settings.updateInterval = parseInt(e.target.value) * 1000;
            this.saveSettings();
            this.restartVatsimUpdates();
        });

        this.elements.showOnMap.addEventListener('change', (e) => {
            this.settings.showOnMap = e.target.checked;
            this.saveSettings();
        });

        this.elements.showNotifications.addEventListener('change', (e) => {
            this.settings.showNotifications = e.target.checked;
            this.saveSettings();
        });

        this.elements.minAltitude.addEventListener('change', (e) => {
            this.settings.minAltitude = parseInt(e.target.value) || 0;
            this.saveSettings();
            this.renderAircraft();
        });

        this.elements.maxAltitude.addEventListener('change', (e) => {
            this.settings.maxAltitude = parseInt(e.target.value) || 50000;
            this.saveSettings();
            this.renderAircraft();
        });

        // Load settings into UI
        this.elements.rangeSlider.value = this.settings.range;
        this.elements.rangeValue.textContent = this.settings.range + ' nm';
        this.elements.updateInterval.value = this.settings.updateInterval / 1000;
        this.elements.showOnMap.checked = this.settings.showOnMap;
        this.elements.showNotifications.checked = this.settings.showNotifications;
        this.elements.minAltitude.value = this.settings.minAltitude;
        this.elements.maxAltitude.value = this.settings.maxAltitude;
    }

    // SimGlassBase Lifecycle
    onMessage(msg) {
        if (msg.type === 'flightData' && msg.data) {
            // Update user position from SimConnect
            this.userPosition = {
                lat: msg.data.latitude || msg.data.PLANE_LATITUDE || 0,
                lon: msg.data.longitude || msg.data.PLANE_LONGITUDE || 0,
                altitude: msg.data.altitude || msg.data.PLANE_ALTITUDE || 0
            };

            // Re-render if position changed significantly
            this.renderAircraft();
        }
    }

    // VATSIM Data Fetching
    startVatsimUpdates() {
        this.fetchVatsimData();
        this._vatsimInterval = setInterval(() => {
            this.fetchVatsimData();
        }, this.settings.updateInterval);
    }

    restartVatsimUpdates() {
        if (this._vatsimInterval) {
            clearInterval(this._vatsimInterval);
        }
        this.startVatsimUpdates();
    }

    async fetchVatsimData() {
        try {
            this.updateStatus('fetching');

            const response = await fetch(VATSIM_DATA_URL);
            if (!response.ok) {
                throw new Error('VATSIM API returned ' + response.status);
            }

            this.vatsimData = await response.json();
            this.pilots = this.vatsimData.pilots || [];
            this.controllers = this.vatsimData.controllers || [];
            this.atis = this.vatsimData.atis || [];

            this.updateStatus('connected');
            this.updateStats();
            this.renderAircraft();
            this.renderATC();

            // Broadcast to map if enabled
            if (this.settings.showOnMap) {
                this.broadcastToMap();
            }

        } catch (error) {
            this.updateStatus('error', error.message);

            if (window.telemetry) {
                telemetry.captureError(error, {
                    operation: 'fetchVatsimData',
                    widget: 'vatsim-live',
                    url: VATSIM_DATA_URL
                });
            }
        }
    }

    updateStatus(status, message = '') {
        const statusMap = {
            fetching: { icon: '🔄', text: 'Updating...', color: '#667eea' },
            connected: { icon: '🟢', text: 'Connected to VATSIM', color: '#22c55e' },
            error: { icon: '🔴', text: 'Connection Error: ' + message, color: '#ef4444' }
        };

        const config = statusMap[status];
        if (!config) return;

        this.elements.vatsimStatus.textContent = config.icon;
        this.elements.statusMessage.querySelector('.status-icon').textContent = config.icon;
        this.elements.statusMessage.querySelector('.status-text').textContent = config.text;
        this.elements.statusMessage.style.color = config.color;

        if (status === 'connected') {
            this.elements.statusSection.style.display = 'none';
        } else {
            this.elements.statusSection.style.display = 'block';
        }
    }

    updateStats() {
        if (!this.vatsimData) return;

        this.elements.statPilots.textContent = this.pilots.length.toLocaleString();
        this.elements.statAtc.textContent = this.controllers.length.toLocaleString();

        // Count nearby aircraft
        const nearby = this.pilots.filter(pilot =>
            this.calculateDistance(pilot.latitude, pilot.longitude) <= this.settings.range
        );
        this.elements.statNearby.textContent = nearby.length.toLocaleString();

        // Update time
        const updateTime = new Date(this.vatsimData.general.update_timestamp);
        const secondsAgo = Math.floor((Date.now() - updateTime.getTime()) / 1000);
        this.elements.statUpdated.textContent = secondsAgo + 's ago';

        this.elements.pilotCount.textContent = this.pilots.length.toLocaleString() + ' pilots';
    }

    renderAircraft() {
        const container = this.elements.aircraftList;
        container.replaceChildren();

        // Filter aircraft
        let filtered = this.pilots.filter(pilot => {
            // Range filter
            if (this.elements.filterRange.checked) {
                const distance = this.calculateDistance(pilot.latitude, pilot.longitude);
                if (distance > this.settings.range) return false;
            }

            // Altitude filter
            if (pilot.altitude < this.settings.minAltitude || pilot.altitude > this.settings.maxAltitude) {
                return false;
            }

            // Search filter
            if (this.searchQuery) {
                const searchable = `${pilot.callsign} ${pilot.name} ${pilot.flight_plan?.aircraft || ''}`.toLowerCase();
                if (!searchable.includes(this.searchQuery)) return false;
            }

            return true;
        });

        // Sort by distance
        filtered = filtered.map(pilot => ({
            ...pilot,
            distance: this.calculateDistance(pilot.latitude, pilot.longitude)
        })).sort((a, b) => a.distance - b.distance);

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = this.searchQuery ? 'No aircraft match your search' : 'No aircraft nearby';
            container.appendChild(empty);
            return;
        }

        filtered.forEach(pilot => {
            const item = this.createAircraftItem(pilot);
            container.appendChild(item);
        });
    }

    createAircraftItem(pilot) {
        const item = document.createElement('div');
        item.className = 'aircraft-item';

        const aircraft = pilot.flight_plan?.aircraft || 'Unknown';
        const departure = pilot.flight_plan?.departure || '?';
        const arrival = pilot.flight_plan?.arrival || '?';

        item.innerHTML = `
            <div class="aircraft-header">
                <span class="callsign">${pilot.callsign}</span>
                <span class="distance">${pilot.distance.toFixed(0)} nm</span>
            </div>
            <div class="aircraft-details">
                <span class="aircraft-type">${aircraft}</span>
                <span class="route">${departure} → ${arrival}</span>
            </div>
            <div class="aircraft-stats">
                <span>Alt: ${Math.round(pilot.altitude).toLocaleString()} ft</span>
                <span>GS: ${pilot.groundspeed} kt</span>
                <span>HDG: ${pilot.heading}°</span>
            </div>
        `;

        return item;
    }

    renderATC() {
        const container = this.elements.atcList;
        container.replaceChildren();

        // Filter ATC
        let filtered = this.controllers.filter(controller => {
            if (this.atcFilter === 'all') return true;

            if (this.atcFilter === 'nearby') {
                // Check if callsign matches nearby airports
                // Simplified: just show all for now
                return true;
            }

            // Filter by position type
            return controller.callsign.includes('_' + this.atcFilter + '_') ||
                   controller.callsign.endsWith('_' + this.atcFilter);
        });

        // Sort by callsign
        filtered.sort((a, b) => a.callsign.localeCompare(b.callsign));

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No ATC stations match filter';
            container.appendChild(empty);
            return;
        }

        filtered.forEach(controller => {
            const item = this.createATCItem(controller);
            container.appendChild(item);
        });
    }

    createATCItem(controller) {
        const item = document.createElement('div');
        item.className = 'atc-item';

        const frequency = controller.frequency;
        const logonTime = new Date(controller.logon_time);
        const hoursOnline = ((Date.now() - logonTime.getTime()) / 3600000).toFixed(1);

        item.innerHTML = `
            <div class="atc-header">
                <span class="atc-callsign">${controller.callsign}</span>
                <span class="atc-frequency">${frequency}</span>
            </div>
            <div class="atc-details">
                <span class="atc-name">${controller.name}</span>
                <span class="atc-time">${hoursOnline}h online</span>
            </div>
            ${controller.text_atis ? `<div class="atc-atis">${controller.text_atis.join(' ')}</div>` : ''}
        `;

        return item;
    }

    // Utility Functions
    calculateDistance(lat2, lon2) {
        const lat1 = this.userPosition.lat;
        const lon1 = this.userPosition.lon;

        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

        const R = 3440.065; // Earth radius in nautical miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    broadcastToMap() {
        if (!this.mapChannel || !this.settings.showOnMap) return;

        // Send nearby aircraft to map widget
        const nearby = this.pilots.filter(pilot => {
            const distance = this.calculateDistance(pilot.latitude, pilot.longitude);
            return distance <= this.settings.range;
        }).map(pilot => ({
            callsign: pilot.callsign,
            lat: pilot.latitude,
            lon: pilot.longitude,
            altitude: pilot.altitude,
            heading: pilot.heading,
            groundspeed: pilot.groundspeed
        }));

        this.mapChannel.postMessage({
            type: 'vatsim-traffic',
            data: nearby,
            source: 'vatsim-live'
        });
    }

    // Settings Persistence
    saveSettings() {
        try {
            localStorage.setItem('vatsim-live-settings', JSON.stringify(this.settings));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveSettings',
                    widget: 'vatsim-live',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('vatsim-live-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadSettings',
                    widget: 'vatsim-live',
                    storage: 'localStorage'
                });
            }
        }
    }

    destroy() {
        // Stop VATSIM updates
        if (this._vatsimInterval) {
            clearInterval(this._vatsimInterval);
            this._vatsimInterval = null;
        }

        // Close BroadcastChannel
        if (this.mapChannel) {
            this.mapChannel.close();
            this.mapChannel = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.vatsimLiveWidget = new VatsimLiveWidget();
    window.addEventListener('beforeunload', () =>
        window.vatsimLiveWidget?.destroy()
    );
});
