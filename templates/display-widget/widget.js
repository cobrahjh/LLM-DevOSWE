/**
 * Display Widget Template v1.0.0
 * 
 * Template for widgets that display read-only data
 * 
 * Path: templates/display-widget/widget.js
 * Last Updated: 2025-01-08
 */

class DisplayWidget {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.data = {
            altitude: 0,
            heading: 0,
            airspeed: 0,
            vs: 0,
            gs: 0,
            wind: 0
        };
        this.settings = {
            units: 'imperial',
            decimals: false
        };
        
        this.init();
    }

    init() {
        this.initWebSocket();
        this.initUI();
        this.initSettings();
        this.loadSettings();
    }

    // ============================================================
    // WEBSOCKET
    // ============================================================

    initWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:8080`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.connected = true;
            this.updateStatus('Connected', true);
        };
        
        this.ws.onclose = () => {
            this.connected = false;
            this.updateStatus('Disconnected', false);
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.ws.onerror = (err) => {
            console.error('[Widget] WebSocket error:', err);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.handleData(msg.data);
                }
            } catch (err) {
                console.error('[Widget] Parse error:', err);
            }
        };
    }

    handleData(data) {
        // Update local data
        this.data.altitude = data.altitude || 0;
        this.data.heading = data.heading || 0;
        this.data.airspeed = data.speed || 0;
        this.data.vs = data.verticalSpeed || 0;
        this.data.gs = data.groundSpeed || 0;
        this.data.wind = data.windSpeed || 0;
        
        // Update display
        this.updateDisplay();
        this.flashUpdateIndicator();
    }

    // ============================================================
    // DISPLAY UPDATE
    // ============================================================

    updateDisplay() {
        const fmt = this.settings.decimals 
            ? (v) => v.toFixed(1) 
            : (v) => Math.round(v).toLocaleString();
        
        this.setDisplay('altitude', fmt(this.data.altitude));
        this.setDisplay('heading', Math.round(this.data.heading) + '°');
        this.setDisplay('airspeed', fmt(this.data.airspeed));
        this.setDisplay('vs', this.formatVS(this.data.vs));
        this.setDisplay('gs', fmt(this.data.gs));
        this.setDisplay('wind', fmt(this.data.wind));
    }

    formatVS(value) {
        const rounded = Math.round(value);
        if (rounded > 0) return '+' + rounded.toLocaleString();
        return rounded.toLocaleString();
    }

    setDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    flashUpdateIndicator() {
        const indicator = document.getElementById('update-indicator');
        if (indicator) {
            indicator.classList.add('flash');
            setTimeout(() => indicator.classList.remove('flash'), 200);
        }
    }

    // ============================================================
    // UI INITIALIZATION
    // ============================================================

    initUI() {
        // Transparency toggle
        const btnTransparency = document.getElementById('btn-transparency');
        if (btnTransparency) {
            btnTransparency.addEventListener('click', () => this.toggleTransparency());
        }

        // Load transparency state
        if (localStorage.getItem('widget_transparent') === 'true') {
            document.body.classList.add('transparent');
        }
    }

    // ============================================================
    // SETTINGS
    // ============================================================

    initSettings() {
        const btnSettings = document.getElementById('btn-settings');
        const btnClose = document.getElementById('settings-close');
        const panel = document.getElementById('settings-panel');
        
        if (btnSettings && panel) {
            btnSettings.addEventListener('click', () => {
                panel.hidden = !panel.hidden;
            });
        }
        
        if (btnClose && panel) {
            btnClose.addEventListener('click', () => {
                panel.hidden = true;
            });
        }

        // Setting change handlers
        const unitsSelect = document.getElementById('setting-units');
        if (unitsSelect) {
            unitsSelect.addEventListener('change', (e) => {
                this.settings.units = e.target.value;
                this.saveSettings();
                this.updateDisplay();
            });
        }

        const decimalsCheck = document.getElementById('setting-decimals');
        if (decimalsCheck) {
            decimalsCheck.addEventListener('change', (e) => {
                this.settings.decimals = e.target.checked;
                this.saveSettings();
                this.updateDisplay();
            });
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('widget_display_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                
                // Apply to UI
                const unitsSelect = document.getElementById('setting-units');
                if (unitsSelect) unitsSelect.value = this.settings.units;
                
                const decimalsCheck = document.getElementById('setting-decimals');
                if (decimalsCheck) decimalsCheck.checked = this.settings.decimals;
            } catch (err) {
                console.error('[Widget] Settings load error:', err);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('widget_display_settings', JSON.stringify(this.settings));
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    updateStatus(text, connected) {
        const dot = document.getElementById('status-dot');
        const textEl = document.getElementById('status-text');
        
        if (dot) {
            dot.classList.toggle('connected', connected);
            dot.classList.toggle('disconnected', !connected);
        }
        if (textEl) {
            textEl.textContent = text;
        }
    }

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        const isTransparent = document.body.classList.contains('transparent');
        localStorage.setItem('widget_transparent', isTransparent);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.widget = new DisplayWidget();
});
