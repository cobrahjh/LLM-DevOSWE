/**
 * Control Widget Template v1.0.0
 * 
 * Template for widgets that control aircraft state
 * 
 * Path: templates/control-widget/widget.js
 * Last Updated: 2025-01-08
 */

class ControlWidget {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.state = {
            action1: false,
            action2: false,
            action3: false,
            value1: 50,
            value2: 0
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
            console.log('[Widget] WebSocket connected');
        };
        
        this.ws.onclose = () => {
            this.connected = false;
            this.updateStatus('Disconnected', false);
            console.log('[Widget] WebSocket disconnected');
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.ws.onerror = (err) => {
            console.error('[Widget] WebSocket error:', err);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleData(data);
            } catch (err) {
                console.error('[Widget] Parse error:', err);
            }
        };
    }

    handleData(data) {
        // Update state from server data
        if (data.type === 'flightData') {
            // Process flight data
            // Example: this.state.value1 = data.data.someValue;
        }
    }

    sendCommand(command, value = 1) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command, value }));
        }
    }

    // ============================================================
    // UI INITIALIZATION
    // ============================================================

    initUI() {
        // Toggle buttons
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleToggle(e));
        });

        // Sliders
        const slider1 = document.getElementById('slider-value1');
        const slider2 = document.getElementById('slider-value2');
        
        if (slider1) {
            slider1.addEventListener('input', (e) => {
                this.state.value1 = parseInt(e.target.value);
                this.updateDisplay('value1-display', this.state.value1);
                this.sendCommand('SET_VALUE1', this.state.value1);
            });
        }
        
        if (slider2) {
            slider2.addEventListener('input', (e) => {
                this.state.value2 = parseInt(e.target.value);
                this.updateDisplay('value2-display', `${this.state.value2}°`);
                this.sendCommand('SET_VALUE2', this.state.value2);
            });
        }

        // Transparency toggle
        const btnTransparency = document.getElementById('btn-transparency');
        if (btnTransparency) {
            btnTransparency.addEventListener('click', () => this.toggleTransparency());
        }
    }

    handleToggle(e) {
        const btn = e.currentTarget;
        const id = btn.id.replace('btn-', '');
        const isActive = btn.dataset.active === 'true';
        
        btn.dataset.active = (!isActive).toString();
        btn.classList.toggle('active', !isActive);
        
        this.state[id] = !isActive;
        this.sendCommand(`TOGGLE_${id.toUpperCase()}`, !isActive ? 1 : 0);
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
    }

    loadSettings() {
        const saved = localStorage.getItem('widget_control_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                // Apply settings
            } catch (err) {
                console.error('[Widget] Settings load error:', err);
            }
        }
    }

    saveSettings() {
        const settings = {
            // Save current settings
        };
        localStorage.setItem('widget_control_settings', JSON.stringify(settings));
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

    updateDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        const isTransparent = document.body.classList.contains('transparent');
        localStorage.setItem('widget_transparent', isTransparent);
    }
}

// Panel toggle helper
function togglePanel(header) {
    const panel = header.closest('.panel');
    const isCollapsed = panel.dataset.collapsed === 'true';
    panel.dataset.collapsed = (!isCollapsed).toString();
    
    const toggle = header.querySelector('.panel-toggle');
    if (toggle) {
        toggle.textContent = isCollapsed ? '▼' : '▶';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.widget = new ControlWidget();
});
