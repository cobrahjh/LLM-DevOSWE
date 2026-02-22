/**
 * GTN750 System Page - Configuration and settings
 * Provides display settings, units configuration, and system status
 */

class SystemPage {
    constructor(options = {}) {
        this.core = options.core;

        // Default settings
        this.settings = {
            // Display
            mapOrientation: 'track',
            brightness: 80,
            nightMode: false,
            largeText: false,

            // Units
            distanceUnit: 'nm',
            altitudeUnit: 'ft',
            speedUnit: 'kt',
            temperatureUnit: 'c',
            fuelUnit: 'gal',
            pressureUnit: 'inhg',

            // Map Features
            showTerrain: true,
            showTraffic: true,
            showWeather: false,
            showAirways: false,
            showAirspace: true,
            showNavaids: true,

            // Range Rings & Overlays
            navRangeRing: true,
            navRangeRingDistance: 10,  // nm
            trackVector: true,
            trackVectorLength: 60,     // seconds

            // Auto Features
            northUpAbove: 50,          // nm - switch to North Up above this range
            northUpAboveEnabled: true,

            // Visual Approach Aids
            runwayExtensions: true,    // 5nm centerline projection

            // Auto Zoom
            autoZoom: true,
            autoZoomMin: 2,            // nm
            autoZoomMax: 100,          // nm

            // Data Fields
            dataFieldTL: 'gs',
            dataFieldTR: 'trk',
            dataFieldBL: 'alt',
            dataFieldBR: 'rng',

            // Alerts
            altitudeAlert: 500,
            terrainAlert: true,
            trafficAlert: true,

            // Audio
            audioEnabled: true,
            audioVolume: 70
        };

        // Data field options
        this.dataFieldOptions = [
            { id: 'gs', label: 'Ground Speed' },
            { id: 'tas', label: 'True Airspeed' },
            { id: 'trk', label: 'Track' },
            { id: 'hdg', label: 'Heading' },
            { id: 'alt', label: 'Altitude' },
            { id: 'vs', label: 'Vertical Speed' },
            { id: 'rng', label: 'Map Range' },
            { id: 'dis', label: 'Distance to WPT' },
            { id: 'ete', label: 'Time to WPT' },
            { id: 'brg', label: 'Bearing to WPT' },
            { id: 'dtk', label: 'Desired Track' },
            { id: 'xtrk', label: 'Cross Track' },
            { id: 'eta', label: 'ETA' },
            { id: 'oat', label: 'Outside Air Temp' },
            { id: 'wind', label: 'Wind' }
        ];

        // Elements
        this.elements = {};

        // Callbacks
        this.onSettingChange = options.onSettingChange || (() => {});
    }

    init() {
        this.cacheElements();
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
        this.fetchNavdbStatus();
        this.checkLatestAirac();
    }

    cacheElements() {
        this.elements = {
            // Display section
            mapOrient: document.getElementById('sys-map-orient'),
            brightness: document.getElementById('sys-brightness'),
            brightnessValue: document.getElementById('sys-brightness-value'),
            nightMode: document.getElementById('sys-night-mode'),
            largeText: document.getElementById('sys-large-text'),

            // Units section
            distanceUnit: document.getElementById('sys-distance-unit'),
            altitudeUnit: document.getElementById('sys-altitude-unit'),
            speedUnit: document.getElementById('sys-speed-unit'),
            tempUnit: document.getElementById('sys-temp-unit'),
            fuelUnit: document.getElementById('sys-fuel-unit'),
            pressureUnit: document.getElementById('sys-pressure-unit'),

            // Map features
            showTerrain: document.getElementById('sys-show-terrain'),
            showTraffic: document.getElementById('sys-show-traffic'),
            showWeather: document.getElementById('sys-show-weather'),
            showAirways: document.getElementById('sys-show-airways'),
            showAirspace: document.getElementById('sys-show-airspace'),
            showNavaids: document.getElementById('sys-show-navaids'),

            // Data fields
            dataFieldTL: document.getElementById('sys-df-tl'),
            dataFieldTR: document.getElementById('sys-df-tr'),
            dataFieldBL: document.getElementById('sys-df-bl'),
            dataFieldBR: document.getElementById('sys-df-br'),

            // Alerts
            altitudeAlert: document.getElementById('sys-altitude-alert'),
            terrainAlert: document.getElementById('sys-terrain-alert'),
            trafficAlert: document.getElementById('sys-traffic-alert'),

            // Audio
            audioEnabled: document.getElementById('sys-audio-enabled'),
            audioVolume: document.getElementById('sys-audio-volume'),

            // Status
            gpsStatus: document.getElementById('sys-gps-status'),
            databaseStatus: document.getElementById('sys-database-status'),
            softwareVersion: document.getElementById('sys-software-version'),

            // Navdata
            airacCycle: document.getElementById('sys-airac-cycle'),
            airacExpiry: document.getElementById('sys-airac-expiry'),
            navdbAirports: document.getElementById('sys-navdb-airports'),
            navdbUpdateBtn: document.getElementById('sys-navdb-update-btn'),
            navdbProgressWrap: document.getElementById('sys-navdb-progress-wrap'),
            navdbProgressFill: document.getElementById('sys-navdb-progress-fill'),
            navdbProgressText: document.getElementById('sys-navdb-progress-text'),
            airacWarn: document.getElementById('airac-warn'),
            navdbLatest: document.getElementById('sys-navdb-latest'),
            navdbLatestCycle: document.getElementById('sys-navdb-latest-cycle'),
            navdbUpdateBadge: document.getElementById('sys-navdb-update-badge')
        };
    }

    loadSettings() {
        const saved = localStorage.getItem('gtn750_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(this.settings, parsed);
            } catch (e) {
                console.warn('[GTN750] Failed to load settings');
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750_settings', JSON.stringify(this.settings));
    }

    bindEvents() {
        // Map orientation
        this.elements.mapOrient?.addEventListener('change', (e) => {
            this.setSetting('mapOrientation', e.target.value);
        });

        // Brightness slider
        this.elements.brightness?.addEventListener('input', (e) => {
            this.setSetting('brightness', parseInt(e.target.value));
            if (this.elements.brightnessValue) {
                this.elements.brightnessValue.textContent = e.target.value + '%';
            }
            this.applyBrightness();
        });

        // Night mode
        this.elements.nightMode?.addEventListener('change', (e) => {
            this.setSetting('nightMode', e.target.checked);
            this.applyNightMode();
        });

        // Large text
        this.elements.largeText?.addEventListener('change', (e) => {
            this.setSetting('largeText', e.target.checked);
            this.applyLargeText();
        });

        // Unit selects
        const unitSelects = ['distanceUnit', 'altitudeUnit', 'speedUnit', 'tempUnit', 'fuelUnit', 'pressureUnit'];
        unitSelects.forEach(key => {
            this.elements[key]?.addEventListener('change', (e) => {
                this.setSetting(key, e.target.value);
            });
        });

        // Map feature checkboxes
        const featureCheckboxes = ['showTerrain', 'showTraffic', 'showWeather', 'showAirways', 'showAirspace', 'showNavaids'];
        featureCheckboxes.forEach(key => {
            this.elements[key]?.addEventListener('change', (e) => {
                this.setSetting(key, e.target.checked);
            });
        });

        // Data field selects
        const dataFieldSelects = ['dataFieldTL', 'dataFieldTR', 'dataFieldBL', 'dataFieldBR'];
        dataFieldSelects.forEach(key => {
            this.elements[key]?.addEventListener('change', (e) => {
                this.setSetting(key, e.target.value);
            });
        });

        // Alert settings
        this.elements.altitudeAlert?.addEventListener('change', (e) => {
            this.setSetting('altitudeAlert', parseInt(e.target.value));
        });

        this.elements.terrainAlert?.addEventListener('change', (e) => {
            this.setSetting('terrainAlert', e.target.checked);
        });

        this.elements.trafficAlert?.addEventListener('change', (e) => {
            this.setSetting('trafficAlert', e.target.checked);
        });

        // Audio
        this.elements.audioEnabled?.addEventListener('change', (e) => {
            this.setSetting('audioEnabled', e.target.checked);
        });

        this.elements.audioVolume?.addEventListener('input', (e) => {
            this.setSetting('audioVolume', parseInt(e.target.value));
        });

        // Navdata update
        this.elements.navdbUpdateBtn?.addEventListener('click', () => {
            this.startNavdbUpdate();
        });
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        this.onSettingChange(key, value);
        GTNCore.log(`[GTN750] Setting ${key} = ${value}`);
    }

    getSetting(key) {
        return this.settings[key];
    }

    getSettings() {
        return { ...this.settings };
    }

    updateUI() {
        // Map orientation
        if (this.elements.mapOrient) {
            this.elements.mapOrient.value = this.settings.mapOrientation;
        }

        // Brightness
        if (this.elements.brightness) {
            this.elements.brightness.value = this.settings.brightness;
        }
        if (this.elements.brightnessValue) {
            this.elements.brightnessValue.textContent = this.settings.brightness + '%';
        }

        // Night mode
        if (this.elements.nightMode) {
            this.elements.nightMode.checked = this.settings.nightMode;
        }

        // Large text
        if (this.elements.largeText) {
            this.elements.largeText.checked = this.settings.largeText;
        }

        // Units
        if (this.elements.distanceUnit) this.elements.distanceUnit.value = this.settings.distanceUnit;
        if (this.elements.altitudeUnit) this.elements.altitudeUnit.value = this.settings.altitudeUnit;
        if (this.elements.speedUnit) this.elements.speedUnit.value = this.settings.speedUnit;
        if (this.elements.tempUnit) this.elements.tempUnit.value = this.settings.temperatureUnit;
        if (this.elements.fuelUnit) this.elements.fuelUnit.value = this.settings.fuelUnit;
        if (this.elements.pressureUnit) this.elements.pressureUnit.value = this.settings.pressureUnit;

        // Map features
        if (this.elements.showTerrain) this.elements.showTerrain.checked = this.settings.showTerrain;
        if (this.elements.showTraffic) this.elements.showTraffic.checked = this.settings.showTraffic;
        if (this.elements.showWeather) this.elements.showWeather.checked = this.settings.showWeather;
        if (this.elements.showAirways) this.elements.showAirways.checked = this.settings.showAirways;
        if (this.elements.showAirspace) this.elements.showAirspace.checked = this.settings.showAirspace;
        if (this.elements.showNavaids) this.elements.showNavaids.checked = this.settings.showNavaids;

        // Data fields - populate options
        this.populateDataFieldSelects();

        // Alerts
        if (this.elements.altitudeAlert) this.elements.altitudeAlert.value = this.settings.altitudeAlert;
        if (this.elements.terrainAlert) this.elements.terrainAlert.checked = this.settings.terrainAlert;
        if (this.elements.trafficAlert) this.elements.trafficAlert.checked = this.settings.trafficAlert;

        // Audio
        if (this.elements.audioEnabled) this.elements.audioEnabled.checked = this.settings.audioEnabled;
        if (this.elements.audioVolume) this.elements.audioVolume.value = this.settings.audioVolume;

        // Status
        if (this.elements.softwareVersion) {
            this.elements.softwareVersion.textContent = 'v2.0.0';
        }

        // Apply visual settings
        this.applyBrightness();
        this.applyNightMode();
        this.applyLargeText();
    }

    populateDataFieldSelects() {
        const selects = ['dataFieldTL', 'dataFieldTR', 'dataFieldBL', 'dataFieldBR'];
        const settingKeys = ['dataFieldTL', 'dataFieldTR', 'dataFieldBL', 'dataFieldBR'];

        selects.forEach((selectKey, index) => {
            const select = this.elements[selectKey];
            if (!select) return;

            // Clear existing options
            select.textContent = '';

            // Add options
            this.dataFieldOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.id;
                option.textContent = opt.label;
                select.appendChild(option);
            });

            // Set current value
            select.value = this.settings[settingKeys[index]];
        });
    }

    applyBrightness() {
        const brightness = this.settings.brightness / 100;
        const container = document.querySelector('.gtn750');
        if (container) {
            container.style.filter = `brightness(${brightness})`;
        }
    }

    applyNightMode() {
        const container = document.querySelector('.gtn750');
        if (container) {
            container.classList.toggle('night-mode', this.settings.nightMode);
        }
    }

    applyLargeText() {
        const container = document.querySelector('.gtn750');
        if (container) {
            container.classList.toggle('large-text', this.settings.largeText);
        }
    }

    /**
     * Update GPS status
     */
    updateGpsStatus(status) {
        if (this.elements.gpsStatus) {
            this.elements.gpsStatus.textContent = status;
            this.elements.gpsStatus.style.color = status === '3D FIX' ? '#00ff00' :
                                                   status === '2D FIX' ? '#ffcc00' : '#ff0000';
        }
    }

    /**
     * Fetch navdata status from backend and update UI
     */
    async fetchNavdbStatus() {
        try {
            const res = await fetch('/api/navdb/status');
            if (!res.ok) throw new Error('navdb unavailable');
            const data = await res.json();
            this.updateDatabaseStatus(data);
        } catch (e) {
            if (this.elements.databaseStatus) {
                this.elements.databaseStatus.textContent = 'UNAVAILABLE';
                this.elements.databaseStatus.style.color = '#ff6600';
            }
        }
    }

    /**
     * Update database status display from /api/navdb/status response
     */
    updateDatabaseStatus(data) {
        const now = new Date();
        const expiry = data.airac_expiry ? new Date(data.airac_expiry) : null;
        const isExpired = expiry && now > expiry;
        const isWarning = expiry && !isExpired && (expiry - now) < 7 * 86400000; // <7 days left

        if (this.elements.airacCycle) {
            this.elements.airacCycle.textContent = data.airac_cycle || '—';
        }

        if (this.elements.databaseStatus) {
            if (isExpired) {
                this.elements.databaseStatus.textContent = 'EXPIRED';
                this.elements.databaseStatus.style.color = '#ff0000';
            } else if (isWarning) {
                this.elements.databaseStatus.textContent = 'EXPIRING';
                this.elements.databaseStatus.style.color = '#ffaa00';
            } else {
                this.elements.databaseStatus.textContent = 'CURRENT';
                this.elements.databaseStatus.style.color = '#00ff00';
            }
        }

        if (this.elements.airacExpiry && expiry) {
            const mo = expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            this.elements.airacExpiry.textContent = mo;
            this.elements.airacExpiry.style.color = isExpired ? '#ff0000' : isWarning ? '#ffaa00' : '';
        }

        if (this.elements.navdbAirports && data.counts) {
            this.elements.navdbAirports.textContent = data.counts.airports.toLocaleString();
        }

        // Status bar badge
        if (this.elements.airacWarn) {
            if (isExpired) {
                this.elements.airacWarn.style.display = '';
                this.elements.airacWarn.textContent = 'DB EXP';
                this.elements.airacWarn.style.color = '#ff4444';
            } else if (isWarning) {
                this.elements.airacWarn.style.display = '';
                this.elements.airacWarn.textContent = 'DB EXP SOON';
                this.elements.airacWarn.style.color = '#ffaa00';
            } else {
                this.elements.airacWarn.style.display = 'none';
            }
        }
    }

    /**
     * Check latest available AIRAC cycle from server and show update badge
     */
    async checkLatestAirac() {
        try {
            const res = await fetch('/api/navdb/check-latest');
            if (!res.ok) return;
            const data = await res.json();

            if (this.elements.navdbLatest) {
                this.elements.navdbLatest.style.display = '';
            }

            if (this.elements.navdbLatestCycle) {
                this.elements.navdbLatestCycle.textContent = data.latest ? 'AIRAC ' + data.latest : '—';
            }

            if (this.elements.navdbUpdateBadge) {
                if (data.update_available) {
                    this.elements.navdbUpdateBadge.style.display = '';
                    // Flash the update button to draw attention
                    if (this.elements.navdbUpdateBtn) {
                        this.elements.navdbUpdateBtn.textContent = 'UPDATE TO AIRAC ' + data.latest;
                        this.elements.navdbUpdateBtn.style.borderColor = '#ffaa00';
                        this.elements.navdbUpdateBtn.style.color = '#ffaa00';
                    }
                } else {
                    this.elements.navdbUpdateBadge.style.display = 'none';
                    if (this.elements.navdbUpdateBtn) {
                        this.elements.navdbUpdateBtn.textContent = 'UPDATE DATABASE';
                    }
                }
            }
        } catch (e) { /* non-fatal */ }
    }

    /**
     * Trigger AIRAC database update and poll for progress
     */
    async startNavdbUpdate() {
        const btn = this.elements.navdbUpdateBtn;
        const wrap = this.elements.navdbProgressWrap;
        const fill = this.elements.navdbProgressFill;
        const txt = this.elements.navdbProgressText;

        if (btn) { btn.disabled = true; btn.textContent = 'UPDATING...'; }
        if (wrap) wrap.style.display = '';
        if (fill) fill.style.width = '0%';
        if (txt) txt.textContent = 'Starting update...';

        try {
            const startRes = await fetch('/api/navdb/update', { method: 'POST' });
            if (!startRes.ok) {
                const err = await startRes.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to start update');
            }
        } catch (e) {
            if (txt) txt.textContent = 'Error: ' + e.message;
            if (btn) { btn.disabled = false; btn.textContent = 'UPDATE DATABASE'; }
            return;
        }

        // Poll status every 3 seconds
        const poll = setInterval(async () => {
            try {
                const statusRes = await fetch('/api/navdb/update-status');
                const status = await statusRes.json();

                if (fill) fill.style.width = (status.progress || 0) + '%';
                if (txt) txt.textContent = status.message || status.status;

                if (status.status === 'complete') {
                    clearInterval(poll);
                    if (txt) txt.textContent = 'Update complete!';
                    if (btn) { btn.disabled = false; btn.textContent = 'UPDATE DATABASE'; }
                    setTimeout(() => {
                        if (wrap) wrap.style.display = 'none';
                        this.fetchNavdbStatus();
                    }, 3000);
                } else if (status.status === 'error') {
                    clearInterval(poll);
                    if (txt) txt.textContent = 'Error: ' + (status.message || 'update failed');
                    if (txt) txt.style.color = '#ff4444';
                    if (btn) { btn.disabled = false; btn.textContent = 'UPDATE DATABASE'; }
                }
            } catch (e) { /* retry next poll */ }
        }, 3000);
    }

    /**
     * Reset to defaults
     */
    resetToDefaults() {
        localStorage.removeItem('gtn750_settings');
        this.settings = {
            mapOrientation: 'track',
            brightness: 80,
            nightMode: false,
            largeText: false,
            distanceUnit: 'nm',
            altitudeUnit: 'ft',
            speedUnit: 'kt',
            temperatureUnit: 'c',
            fuelUnit: 'gal',
            pressureUnit: 'inhg',
            showTerrain: true,
            showTraffic: true,
            showWeather: false,
            showAirways: false,
            showAirspace: true,
            showNavaids: true,
            dataFieldTL: 'gs',
            dataFieldTR: 'trk',
            dataFieldBL: 'alt',
            dataFieldBR: 'rng',
            altitudeAlert: 500,
            terrainAlert: true,
            trafficAlert: true,
            audioEnabled: true,
            audioVolume: 70
        };
        this.saveSettings();
        this.updateUI();
        GTNCore.log('[GTN750] Settings reset to defaults');
    }

    /**
     * Export settings
     */
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings
     */
    importSettings(json) {
        try {
            const imported = JSON.parse(json);
            // Block prototype pollution
            delete imported.__proto__; delete imported.constructor; delete imported.prototype;
            Object.assign(this.settings, imported);
            this.saveSettings();
            this.updateUI();
            return true;
        } catch (e) {
            console.error('[GTN750] Failed to import settings:', e);
            return false;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemPage;
}
