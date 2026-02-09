/**
 * Health Dashboard pane v2.0.0
 * Path: simwidget-hybrid/ui/health-dashboard/pane.js
 *
 * Real-time system health monitoring for SimGlass components
 */

class HealthDashboardPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'health-dashboard',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        // Known widgets for status checking
        this.WIDGETS = [
            { id: 'copilot', name: 'Copilot', icon: '🧑‍✈️', path: '/ui/copilot-widget/' },
            { id: 'checklist', name: 'Checklist', icon: '✅', path: '/ui/checklist-widget/' },
            { id: 'flightplan', name: 'FPL', icon: '🛫', path: '/ui/flightplan-widget/' },
            { id: 'map', name: 'Map', icon: '🗺️', path: '/ui/map-widget/' },
            { id: 'weather', name: 'Weather', icon: '🌤️', path: '/ui/weather-widget/' },
            { id: 'timer', name: 'Timer', icon: '⏱️', path: '/ui/timer-widget/' },
            { id: 'simbrief', name: 'SimBrief', icon: '📋', path: '/ui/simbrief-widget/' },
            { id: 'notepad', name: 'Notes', icon: '📝', path: '/ui/notepad-widget/' },
            { id: 'camera', name: 'Camera', icon: '📷', path: '/ui/camera-widget/' },
            { id: 'voice', name: 'Voice', icon: '🎤', path: '/ui/voice-control/' }
        ];

        this.API_URL = `http://${window.location.host}`;
        this.errors = [];
        this.MAX_ERRORS = 5;
        this.refreshInterval = null;

        this.initElements();
        this.initWidgetsGrid();
        this.initEventListeners();
        this.fetchHealth();
        this.startAutoRefresh();
    }

    initElements() {
        this.elements = {
            wsStatus: document.getElementById('ws-status'),
            autoRefresh: document.getElementById('auto-refresh'),
            btnRefresh: document.getElementById('btn-refresh'),
            uptime: document.getElementById('uptime'),
            memory: document.getElementById('memory'),
            version: document.getElementById('version'),
            wsClients: document.getElementById('ws-clients'),
            simconnectDetail: document.getElementById('simconnect-detail'),
            websocketDetail: document.getElementById('websocket-detail'),
            cameraDetail: document.getElementById('camera-detail'),
            statusSimconnect: document.getElementById('status-simconnect'),
            statusWebsocket: document.getElementById('status-websocket'),
            statusCamera: document.getElementById('status-camera'),
            pluginsGrid: document.getElementById('plugins-grid'),
            widgetsGrid: document.getElementById('widgets-grid'),
            errorList: document.getElementById('error-list'),
            btnClearErrors: document.getElementById('btn-clear-errors'),
            lastUpdate: document.getElementById('last-update')
        };
    }

    initEventListeners() {
        this.elements.btnRefresh.addEventListener('click', () => {
            this.elements.btnRefresh.classList.add('spinning');
            this.fetchHealth();
            setTimeout(() => this.elements.btnRefresh.classList.remove('spinning'), 500);
        });

        this.elements.autoRefresh.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        this.elements.btnClearErrors.addEventListener('click', () => {
            this.errors = [];
            this.renderErrors();
        });

        // Capture console errors
        const originalError = console.error;
        console.error = (...args) => {
            this.addError(args.join(' '));
            originalError.apply(console, args);
        };

        // Capture unhandled errors
        window.addEventListener('error', (e) => {
            this.addError(e.message);
        });
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        // Health dashboard doesn't need real-time flight data
        // It primarily uses REST API polling
        if (msg.connected !== undefined) {
            this.updateWsStatus(msg.connected);
        }
    }

    // SimGlassBase lifecycle hook
    onConnect() {
        console.log('[Health Dashboard] WebSocket connected');
        this.updateWsStatus(true);
    }

    // SimGlassBase lifecycle hook
    onDisconnect() {
        console.log('[Health Dashboard] WebSocket disconnected');
        this.updateWsStatus(false);
    }

    updateWsStatus(connected) {
        this.elements.wsStatus.classList.toggle('online', connected);
        this.elements.wsStatus.classList.toggle('offline', !connected);
    }

    async fetchHealth() {
        try {
            const response = await fetch(`${this.API_URL}/api/health`);
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const data = await response.json();
            this.updateDashboard(data);
            this.checkWidgetHealth();
            this.updateLastUpdate();
        } catch (err) {
            this.addError('Health fetch failed: ' + err.message);
            this.setOfflineState();
        }
    }

    updateDashboard(data) {
        // System stats
        this.elements.uptime.textContent = data.uptimeFormatted || this.formatUptime(data.uptime);
        this.elements.memory.textContent = data.memory?.heapUsed || '--';
        this.elements.version.textContent = data.version || '--';
        this.elements.wsClients.textContent = data.websocket?.clients || '0';

        // SimConnect status
        const simConnected = data.simconnect?.connected;
        const isMock = data.simconnect?.mock;
        this.elements.statusSimconnect.className = 'status-item ' + (simConnected ? 'ok' : (isMock ? 'mock' : 'error'));
        this.elements.simconnectDetail.textContent = simConnected ? 'Connected' : (isMock ? 'Mock Mode' : 'Disconnected');

        // WebSocket status
        const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
        this.elements.statusWebsocket.className = 'status-item ' + (isConnected ? 'ok' : 'error');
        this.elements.websocketDetail.textContent = isConnected ? (data.websocket?.clients || 0) + ' clients' : 'Disconnected';

        // Camera status
        const cameraState = data.camera?.system?.state || 'unknown';
        const cameraOk = cameraState !== 'error' && cameraState !== 'unknown';
        this.elements.statusCamera.className = 'status-item ' + (cameraOk ? 'ok' : 'warning');
        this.elements.cameraDetail.textContent = data.camera?.controller?.method || cameraState;

        // Plugins
        this.updatePlugins(data.plugins?.list || []);
    }

    updatePlugins(plugins) {
        this.elements.pluginsGrid.textContent = '';

        if (!plugins.length) {
            const placeholder = document.createElement('span');
            placeholder.className = 'plugin-placeholder';
            placeholder.textContent = 'No plugins';
            this.elements.pluginsGrid.appendChild(placeholder);
            return;
        }

        plugins.forEach(plugin => {
            this.elements.pluginsGrid.appendChild(this.createPluginElement(plugin));
        });
    }

    createPluginElement(plugin) {
        const div = document.createElement('div');
        div.className = 'plugin-item ' + (plugin.enabled ? 'enabled' : 'disabled');

        const dot = document.createElement('span');
        dot.className = 'plugin-dot';

        const name = document.createElement('span');
        name.textContent = plugin.name;

        div.appendChild(dot);
        div.appendChild(name);

        return div;
    }

    async checkWidgetHealth() {
        for (const glass of this.WIDGETS) {
            try {
                const response = await fetch(this.API_URL + glass.path, { method: 'HEAD' });
                const el = document.getElementById('pane-' + glass.id);
                if (el) {
                    el.className = 'pane-status ' + (response.ok ? 'ok' : 'error');
                }
            } catch (err) {
                const el = document.getElementById('pane-' + glass.id);
                if (el) {
                    el.className = 'pane-status error';
                }
            }
        }
    }

    setOfflineState() {
        this.elements.statusSimconnect.className = 'status-item error';
        this.elements.simconnectDetail.textContent = 'Offline';
        this.elements.statusWebsocket.className = 'status-item error';
        this.elements.websocketDetail.textContent = 'Offline';
        this.elements.statusCamera.className = 'status-item error';
        this.elements.cameraDetail.textContent = 'Offline';
    }

    addError(message) {
        const now = new Date();
        this.errors.unshift({
            time: now.toLocaleTimeString(),
            message: message
        });

        // Keep only last N errors
        if (this.errors.length > this.MAX_ERRORS) {
            this.errors = this.errors.slice(0, this.MAX_ERRORS);
        }

        this.renderErrors();
    }

    renderErrors() {
        this.elements.errorList.textContent = '';

        if (!this.errors.length) {
            const noErrors = document.createElement('div');
            noErrors.className = 'no-errors';
            noErrors.textContent = 'No errors recorded';
            this.elements.errorList.appendChild(noErrors);
            return;
        }

        this.errors.forEach(err => {
            this.elements.errorList.appendChild(this.createErrorElement(err));
        });
    }

    createErrorElement(err) {
        const div = document.createElement('div');
        div.className = 'error-item';

        const time = document.createElement('span');
        time.className = 'error-time';
        time.textContent = err.time;

        const msg = document.createElement('span');
        msg.className = 'error-message';
        msg.textContent = err.message;

        div.appendChild(time);
        div.appendChild(msg);

        return div;
    }

    updateLastUpdate() {
        const now = new Date();
        this.elements.lastUpdate.textContent = 'Last update: ' + now.toLocaleTimeString();
    }

    formatUptime(seconds) {
        if (!seconds) return '--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return h + 'h ' + m + 'm';
        if (m > 0) return m + 'm ' + s + 's';
        return s + 's';
    }

    initWidgetsGrid() {
        this.elements.widgetsGrid.textContent = '';
        this.WIDGETS.forEach(glass => {
            this.elements.widgetsGrid.appendChild(this.createWidgetElement(glass));
        });
    }

    createWidgetElement(glass) {
        const div = document.createElement('div');
        div.className = 'pane-status unknown';
        div.id = 'pane-' + glass.id;
        div.title = 'Open ' + glass.name;
        div.addEventListener('click', () => window.open(glass.path, '_blank'));

        const icon = document.createElement('span');
        icon.className = 'pane-icon';
        icon.textContent = glass.icon;

        const name = document.createElement('span');
        name.className = 'pane-name';
        name.textContent = glass.name;

        const dot = document.createElement('span');
        dot.className = 'pane-dot';

        div.appendChild(icon);
        div.appendChild(name);
        div.appendChild(dot);

        return div;
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => this.fetchHealth(), 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    destroy() {
        this._destroyed = true;
        this.stopAutoRefresh();
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.healthDashboard = new HealthDashboardPane();
    window.addEventListener('beforeunload', () => window.healthDashboard?.destroy());
});
