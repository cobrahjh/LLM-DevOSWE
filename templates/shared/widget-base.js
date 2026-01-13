/**
 * SimWidget Base Class v1.0.0
 * 
 * Base functionality shared by all widgets
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\templates\shared\widget-base.js
 * Last Updated: 2025-01-08
 */

class WidgetBase {
    constructor(options = {}) {
        this.name = options.name || 'widget';
        this.version = options.version || '1.0.0';
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        
        this.storageKey = `simwidget_${this.name}`;
    }

    // ============================================================
    // WEBSOCKET
    // ============================================================

    connectWebSocket(url) {
        const wsUrl = url || `ws://${window.location.hostname}:8080`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                this.onConnect();
                console.log(`[${this.name}] WebSocket connected`);
            };
            
            this.ws.onclose = () => {
                this.connected = false;
                this.onDisconnect();
                console.log(`[${this.name}] WebSocket disconnected`);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (err) => {
                console.error(`[${this.name}] WebSocket error:`, err);
                this.onError(err);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.onMessage(data);
                } catch (err) {
                    console.error(`[${this.name}] Parse error:`, err);
                }
            };
        } catch (err) {
            console.error(`[${this.name}] Connection failed:`, err);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`[${this.name}] Max reconnect attempts reached`);
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        
        console.log(`[${this.name}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connectWebSocket(), delay);
    }

    sendCommand(command, value = 1) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command, value }));
            return true;
        }
        return false;
    }

    sendMessage(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // Override these in subclass
    onConnect() {}
    onDisconnect() {}
    onMessage(data) {}
    onError(err) {}

    // ============================================================
    // STORAGE
    // ============================================================

    saveSettings(settings) {
        try {
            localStorage.setItem(`${this.storageKey}_settings`, JSON.stringify(settings));
            return true;
        } catch (err) {
            console.error(`[${this.name}] Save settings error:`, err);
            return false;
        }
    }

    loadSettings(defaults = {}) {
        try {
            const saved = localStorage.getItem(`${this.storageKey}_settings`);
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (err) {
            console.error(`[${this.name}] Load settings error:`, err);
            return defaults;
        }
    }

    saveData(key, data) {
        try {
            localStorage.setItem(`${this.storageKey}_${key}`, JSON.stringify(data));
            return true;
        } catch (err) {
            console.error(`[${this.name}] Save data error:`, err);
            return false;
        }
    }

    loadData(key, defaultValue = null) {
        try {
            const saved = localStorage.getItem(`${this.storageKey}_${key}`);
            return saved ? JSON.parse(saved) : defaultValue;
        } catch (err) {
            console.error(`[${this.name}] Load data error:`, err);
            return defaultValue;
        }
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

    setDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    setEnabled(id, enabled) {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    }

    setVisible(id, visible) {
        const el = document.getElementById(id);
        if (el) el.hidden = !visible;
    }

    toggleClass(id, className, force) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle(className, force);
    }

    // ============================================================
    // TRANSPARENCY
    // ============================================================

    initTransparency() {
        const btn = document.getElementById('btn-transparency');
        if (btn) {
            btn.addEventListener('click', () => this.toggleTransparency());
        }

        // Load saved state
        if (localStorage.getItem('widget_transparent') === 'true') {
            document.body.classList.add('transparent');
        }
    }

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        const isTransparent = document.body.classList.contains('transparent');
        localStorage.setItem('widget_transparent', isTransparent);
        return isTransparent;
    }

    // ============================================================
    // SETTINGS PANEL
    // ============================================================

    initSettingsPanel() {
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

    // ============================================================
    // UTILITIES
    // ============================================================

    formatNumber(value, decimals = 0) {
        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WidgetBase;
}
