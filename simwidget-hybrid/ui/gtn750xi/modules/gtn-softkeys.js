/**
 * GTN Soft Keys - Context-sensitive function keys
 * Mimics real GTN 750 bottom row soft keys
 */

class GTNSoftKeys {
    constructor(options = {}) {
        this.container = options.container || document.getElementById('gtn-softkeys');
        this.keyCount = 6;
        this.keys = [];
        this.contexts = new Map();
        this.currentContext = null;
        this.subMenu = null;

        this.init();
    }

    init() {
        this.createKeyElements();
        this.registerDefaultContexts();
    }

    /**
     * Create soft key button elements
     */
    createKeyElements() {
        if (!this.container) return;

        this.container.textContent = '';
        for (let i = 0; i < this.keyCount; i++) {
            const key = document.createElement('button');
            key.className = 'gtn-softkey';
            key.dataset.index = i;

            const label = document.createElement('span');
            label.className = 'sk-label';
            key.appendChild(label);

            key.addEventListener('click', () => this.handleKeyPress(i));
            this.container.appendChild(key);
            this.keys.push(key);
        }
    }

    /**
     * Register default page contexts
     */
    registerDefaultContexts() {
        // MAP page
        this.registerContext('map', [
            { label: 'MENU', action: 'map-menu' },
            { label: 'TER', action: 'toggle-terrain', toggle: true },
            { label: 'TFC', action: 'toggle-traffic', toggle: true },
            { label: 'WX', action: 'toggle-weather', toggle: true },
            { label: 'VNAV', action: 'toggle-vnav', toggle: true },
            { label: 'CDI', action: 'cdi-menu' }
        ]);

        // CDI source menu
        this.registerContext('cdi-menu', [
            { label: 'GPS', action: 'cdi-source-gps' },
            { label: 'NAV1', action: 'cdi-source-nav1' },
            { label: 'NAV2', action: 'cdi-source-nav2' },
            { label: 'OBS', action: 'obs-toggle', toggle: true },
            { label: 'HOLD', action: 'hold-menu' },
            { label: 'BACK', action: 'back-menu' }
        ]);

        // Holding pattern menu
        this.registerContext('hold-menu', [
            { label: 'HOLD', action: 'hold-toggle', toggle: true },
            { label: 'OBS+', action: 'obs-inc' },
            { label: 'OBS-', action: 'obs-dec' },
            { label: 'R/L', action: 'hold-direction' },
            { label: 'TIME', action: 'hold-time' },
            { label: 'BACK', action: 'back-menu' }
        ]);

        // FPL page
        this.registerContext('fpl', [
            { label: 'SAVE', action: 'save-fpl' },
            { label: 'LOAD', action: 'load-fpl' },
            { label: 'INVERT', action: 'fpl-invert' },
            { label: 'VNAV', action: 'toggle-vnav', toggle: true },
            { label: 'CLEAR', action: 'fpl-clear' },
            { label: 'D\u2192', action: 'direct-to' }
        ]);

        // FPL page (waypoint selected)
        this.registerContext('fpl-selected', [
            { label: 'DELETE', action: 'fpl-delete' },
            { label: 'INSERT', action: 'fpl-insert' },
            { label: 'AWY', action: 'fpl-airway' },
            { label: 'MOVE\n\u25B2', action: 'fpl-move-up' },
            { label: 'MOVE\n\u25BC', action: 'fpl-move-down' },
            { label: 'ACTV\nLEG', action: 'activate-leg' }
        ]);

        // WPT page
        this.registerContext('wpt', [
            { label: 'MENU', action: 'wpt-menu' },
            { label: 'D\u2192', action: 'direct-to' },
            { label: 'MAP', action: 'show-on-map' },
            { label: 'FPL', action: 'add-to-fpl' },
            { label: '', action: null },
            { label: 'BACK', action: 'back' }
        ]);

        // NRST page
        this.registerContext('nrst', [
            { label: 'APT', action: 'nrst-apt' },
            { label: 'VOR', action: 'nrst-vor' },
            { label: 'NDB', action: 'nrst-ndb' },
            { label: 'FIX', action: 'nrst-fix' },
            { label: 'D\u2192', action: 'direct-to' },
            { label: 'BACK', action: 'back' }
        ]);

        // PROC page
        this.registerContext('proc', [
            { label: 'DEP', action: 'proc-departure' },
            { label: 'ARR', action: 'proc-arrival' },
            { label: 'APR', action: 'proc-approach' },
            { label: 'LOAD', action: 'load-proc' },
            { label: 'CHART', action: 'view-proc-chart' },
            { label: 'BACK', action: 'back' }
        ]);

        // TERRAIN page
        this.registerContext('terrain', [
            { label: 'VIEW', action: 'terrain-view' },
            { label: '360\u00B0', action: 'terrain-360' },
            { label: 'ARC', action: 'terrain-arc' },
            { label: 'RANGE', action: 'terrain-range' },
            { label: 'INHIB', action: 'taws-inhibit', toggle: true },
            { label: 'BACK', action: 'back' }
        ]);

        // TRAFFIC page
        this.registerContext('traffic', [
            { label: 'OPER', action: 'traffic-operate' },
            { label: 'STBY', action: 'traffic-standby' },
            { label: 'TEST', action: 'traffic-test' },
            { label: 'ALT', action: 'traffic-alt-mode' },
            { label: '', action: null },
            { label: 'BACK', action: 'back' }
        ]);

        // WEATHER page
        this.registerContext('wx', [
            { label: 'NXRD', action: 'wx-nexrad' },
            { label: 'METAR', action: 'wx-metar' },
            { label: 'TAF', action: 'wx-taf' },
            { label: 'WINDS', action: 'wx-winds' },
            { label: 'LTNG', action: 'wx-lightning' },
            { label: 'BACK', action: 'back' }
        ]);

        // CHARTS page
        this.registerContext('charts', [
            { label: 'APD', action: 'chart-apt' },
            { label: 'IAP', action: 'chart-iap' },
            { label: 'DP', action: 'chart-dp' },
            { label: 'STAR', action: 'chart-star' },
            { label: 'VIEW', action: 'view-chart' },
            { label: 'BACK', action: 'back' }
        ]);

        // AUX page
        this.registerContext('aux', [
            { label: 'TRIP', action: 'aux-trip' },
            { label: 'FUEL', action: 'aux-fuel' },
            { label: 'VCALC', action: 'goto-vcalc' },
            { label: 'TIMER', action: 'aux-timer' },
            { label: 'LOGBK', action: 'aux-logbook' },
            { label: 'BACK', action: 'back' }
        ]);

        // VCALC page
        this.registerContext('vcalc', [
            { label: 'ENABLE', action: 'vcalc-enable', toggle: true },
            { label: 'TARGET', action: 'vcalc-select-wpt' },
            { label: 'MSG', action: 'vcalc-toggle-msg', toggle: true },
            { label: 'RESET', action: 'vcalc-restore' },
            { label: '', action: null },
            { label: 'BACK', action: 'back' }
        ]);

        // SYSTEM page
        this.registerContext('system', [
            { label: 'NORTH', action: 'sys-north-up' },
            { label: 'TRACK', action: 'sys-track-up' },
            { label: 'NIGHT', action: 'sys-night-mode', toggle: true },
            { label: 'RESET', action: 'sys-reset' },
            { label: '', action: null },
            { label: 'BACK', action: 'back' }
        ]);

        // TAXI page (SafeTaxi Airport Diagrams)
        this.registerContext('taxi', [
            { label: 'LOAD', action: 'taxi-load' },
            { label: 'CENTER', action: 'taxi-center' },
            { label: 'AUTO', action: 'taxi-auto' },
            { label: 'ZOOM+', action: 'taxi-zoom-in' },
            { label: 'ZOOM-', action: 'taxi-zoom-out' },
            { label: 'BACK', action: 'back' }
        ]);

        // USER WPT page (User Waypoints)
        this.registerContext('user-wpt', [
            { label: 'NEW', action: 'user-wpt-new' },
            { label: 'IMPORT', action: 'user-wpt-import' },
            { label: 'EXPORT', action: 'user-wpt-export' },
            { label: 'D→', action: 'direct-to' },
            { label: 'FPL', action: 'user-wpt-add-fpl' },
            { label: 'BACK', action: 'back' }
        ]);

        // Map menu submenu
        this.registerContext('map-menu', [
            { label: 'NORTH', action: 'map-north-up' },
            { label: 'TRACK', action: 'map-track-up' },
            { label: 'HDG', action: 'map-heading-up' },
            { label: 'RANGE', action: 'map-range' },
            { label: 'DATA', action: 'map-datafields' },
            { label: 'BACK', action: 'back-menu' }
        ]);
    }

    /**
     * Register a context
     */
    registerContext(contextId, keys) {
        this.contexts.set(contextId, keys);
    }

    /**
     * Set active context
     */
    setContext(contextId) {
        if (!this.contexts.has(contextId)) {
            console.warn(`[GTN] Context not found: ${contextId}`);
            return;
        }

        this.currentContext = contextId;
        const keyConfig = this.contexts.get(contextId);

        keyConfig.forEach((config, index) => {
            if (index < this.keys.length) {
                this.updateKey(index, config);
            }
        });
    }

    /**
     * Update a single key
     */
    updateKey(index, config) {
        const key = this.keys[index];
        if (!key) return;

        const labelEl = key.querySelector('.sk-label');
        labelEl.textContent = config.label || '';

        key.dataset.action = config.action || '';
        key.classList.toggle('active', config.active || false);
        key.classList.toggle('toggle', config.toggle || false);
        key.classList.toggle('disabled', !config.action);
    }

    /**
     * Handle key press
     */
    handleKeyPress(index) {
        const key = this.keys[index];
        if (!key || key.classList.contains('disabled')) return;

        // Add press feedback animation
        key.classList.add('pressed');
        setTimeout(() => key.classList.remove('pressed'), 150);

        const action = key.dataset.action;
        if (!action) return;

        // Handle back actions
        if (action === 'back') {
            this.dispatchAction('go-back');
            return;
        }

        if (action === 'back-menu') {
            // Return from submenu to page context
            const pageId = window.gtn750?.pageManager?.getCurrentPageId();
            if (pageId) this.setContext(pageId);
            return;
        }

        // Handle menu actions (switch to submenu context)
        if (action.endsWith('-menu')) {
            this.setContext(action);
            return;
        }

        // Toggle states for toggle buttons
        if (key.classList.contains('toggle')) {
            key.classList.toggle('active');
        }

        // Dispatch action
        this.dispatchAction(action, { index, active: key.classList.contains('active') });
    }

    /**
     * Dispatch action event
     */
    dispatchAction(action, detail = {}) {
        window.dispatchEvent(new CustomEvent('gtn:softkey', {
            detail: { action, ...detail }
        }));
    }

    /**
     * Set key active state (for toggles)
     */
    setKeyActive(index, active) {
        if (this.keys[index]) {
            this.keys[index].classList.toggle('active', active);
        }
    }

    /**
     * Find key index by action
     */
    findKeyByAction(action) {
        return this.keys.findIndex(k => k.dataset.action === action);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNSoftKeys;
}
