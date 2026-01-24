/**
 * Health Dashboard Widget v1.0.0
 * Path: simwidget-hybrid/ui/health-dashboard/widget.js
 *
 * Real-time system health monitoring for SimWidget components
 */

const API_URL = `http://${window.location.host}`;
const WS_URL = `ws://${window.location.host}`;

// Known widgets for status checking
const WIDGETS = [
    { id: 'copilot', name: 'Copilot', icon: '\u{1F9D1}\u200D\u2708\uFE0F', path: '/ui/copilot-widget/' },
    { id: 'checklist', name: 'Checklist', icon: '\u2705', path: '/ui/checklist-widget/' },
    { id: 'flightplan', name: 'FPL', icon: '\u{1F6EB}', path: '/ui/flightplan-widget/' },
    { id: 'map', name: 'Map', icon: '\u{1F5FA}\uFE0F', path: '/ui/map-widget/' },
    { id: 'weather', name: 'Weather', icon: '\u{1F324}\uFE0F', path: '/ui/weather-widget/' },
    { id: 'timer', name: 'Timer', icon: '\u23F1\uFE0F', path: '/ui/timer-widget/' },
    { id: 'simbrief', name: 'SimBrief', icon: '\u{1F4CB}', path: '/ui/simbrief-widget/' },
    { id: 'notepad', name: 'Notes', icon: '\u{1F4DD}', path: '/ui/notepad-widget/' },
    { id: 'camera', name: 'Camera', icon: '\u{1F4F7}', path: '/ui/camera-control/' },
    { id: 'voice', name: 'Voice', icon: '\u{1F3A4}', path: '/ui/voice-control/' }
];

let ws = null;
let isConnected = false;
let refreshInterval = null;
let errors = [];
const MAX_ERRORS = 5;

// DOM Elements
const elements = {
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Health Dashboard] Initializing...');
    initWidgetsGrid();
    initEventListeners();
    connectWebSocket();
    fetchHealth();
    startAutoRefresh();
});

// Initialize event listeners
function initEventListeners() {
    elements.btnRefresh.addEventListener('click', () => {
        elements.btnRefresh.classList.add('spinning');
        fetchHealth();
        setTimeout(() => elements.btnRefresh.classList.remove('spinning'), 500);
    });

    elements.autoRefresh.addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });

    elements.btnClearErrors.addEventListener('click', () => {
        errors = [];
        renderErrors();
    });

    // Capture console errors
    const originalError = console.error;
    console.error = function(...args) {
        addError(args.join(' '));
        originalError.apply(console, args);
    };

    // Capture unhandled errors
    window.addEventListener('error', (e) => {
        addError(e.message);
    });
}

// Create a widget status element safely
function createWidgetElement(widget) {
    const div = document.createElement('div');
    div.className = 'widget-status unknown';
    div.id = 'widget-' + widget.id;
    div.title = 'Open ' + widget.name;
    div.addEventListener('click', () => window.open(widget.path, '_blank'));

    const icon = document.createElement('span');
    icon.className = 'widget-icon';
    icon.textContent = widget.icon;

    const name = document.createElement('span');
    name.className = 'widget-name';
    name.textContent = widget.name;

    const dot = document.createElement('span');
    dot.className = 'widget-dot';

    div.appendChild(icon);
    div.appendChild(name);
    div.appendChild(dot);

    return div;
}

// Initialize widgets grid
function initWidgetsGrid() {
    elements.widgetsGrid.textContent = '';
    WIDGETS.forEach(widget => {
        elements.widgetsGrid.appendChild(createWidgetElement(widget));
    });
}

// WebSocket connection
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('[Health Dashboard] WebSocket connected');
        isConnected = true;
        updateWsStatus(true);
    };

    ws.onclose = () => {
        console.log('[Health Dashboard] WebSocket disconnected');
        isConnected = false;
        updateWsStatus(false);
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
        addError('WebSocket connection error');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.connected !== undefined) {
                updateWsStatus(data.connected);
            }
        } catch (e) {
            // Ignore parse errors
        }
    };
}

// Update WebSocket status indicator
function updateWsStatus(connected) {
    elements.wsStatus.classList.toggle('online', connected);
    elements.wsStatus.classList.toggle('offline', !connected);
}

// Fetch health data from API
async function fetchHealth() {
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        updateDashboard(data);
        checkWidgetHealth();
        updateLastUpdate();
    } catch (err) {
        addError('Health fetch failed: ' + err.message);
        setOfflineState();
    }
}

// Update dashboard with health data
function updateDashboard(data) {
    // System stats
    elements.uptime.textContent = data.uptimeFormatted || formatUptime(data.uptime);
    elements.memory.textContent = data.memory?.heapUsed || '--';
    elements.version.textContent = data.version || '--';
    elements.wsClients.textContent = data.websocket?.clients || '0';

    // SimConnect status
    const simConnected = data.simconnect?.connected;
    const isMock = data.simconnect?.mock;
    elements.statusSimconnect.className = 'status-item ' + (simConnected ? 'ok' : (isMock ? 'mock' : 'error'));
    elements.simconnectDetail.textContent = simConnected ? 'Connected' : (isMock ? 'Mock Mode' : 'Disconnected');

    // WebSocket status
    elements.statusWebsocket.className = 'status-item ' + (isConnected ? 'ok' : 'error');
    elements.websocketDetail.textContent = isConnected ? (data.websocket?.clients || 0) + ' clients' : 'Disconnected';

    // Camera status
    const cameraState = data.camera?.system?.state || 'unknown';
    const cameraOk = cameraState !== 'error' && cameraState !== 'unknown';
    elements.statusCamera.className = 'status-item ' + (cameraOk ? 'ok' : 'warning');
    elements.cameraDetail.textContent = data.camera?.controller?.method || cameraState;

    // Plugins
    updatePlugins(data.plugins?.list || []);
}

// Create plugin element safely
function createPluginElement(plugin) {
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

// Update plugins display
function updatePlugins(plugins) {
    elements.pluginsGrid.textContent = '';

    if (!plugins.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'plugin-placeholder';
        placeholder.textContent = 'No plugins';
        elements.pluginsGrid.appendChild(placeholder);
        return;
    }

    plugins.forEach(plugin => {
        elements.pluginsGrid.appendChild(createPluginElement(plugin));
    });
}

// Check widget availability
async function checkWidgetHealth() {
    for (const widget of WIDGETS) {
        try {
            const response = await fetch(API_URL + widget.path, { method: 'HEAD' });
            const el = document.getElementById('widget-' + widget.id);
            if (el) {
                el.className = 'widget-status ' + (response.ok ? 'ok' : 'error');
            }
        } catch (err) {
            const el = document.getElementById('widget-' + widget.id);
            if (el) {
                el.className = 'widget-status error';
            }
        }
    }
}

// Set offline state for all indicators
function setOfflineState() {
    elements.statusSimconnect.className = 'status-item error';
    elements.simconnectDetail.textContent = 'Offline';
    elements.statusWebsocket.className = 'status-item error';
    elements.websocketDetail.textContent = 'Offline';
    elements.statusCamera.className = 'status-item error';
    elements.cameraDetail.textContent = 'Offline';
}

// Add error to list
function addError(message) {
    const now = new Date();
    errors.unshift({
        time: now.toLocaleTimeString(),
        message: message
    });

    // Keep only last N errors
    if (errors.length > MAX_ERRORS) {
        errors = errors.slice(0, MAX_ERRORS);
    }

    renderErrors();
}

// Create error element safely
function createErrorElement(err) {
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

// Render error list
function renderErrors() {
    elements.errorList.textContent = '';

    if (!errors.length) {
        const noErrors = document.createElement('div');
        noErrors.className = 'no-errors';
        noErrors.textContent = 'No errors recorded';
        elements.errorList.appendChild(noErrors);
        return;
    }

    errors.forEach(err => {
        elements.errorList.appendChild(createErrorElement(err));
    });
}

// Update last update timestamp
function updateLastUpdate() {
    const now = new Date();
    elements.lastUpdate.textContent = 'Last update: ' + now.toLocaleTimeString();
}

// Format uptime
function formatUptime(seconds) {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
}

// Auto refresh
function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(fetchHealth, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
