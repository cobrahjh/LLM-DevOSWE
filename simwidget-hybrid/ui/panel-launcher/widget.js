/**
 * Panel Launcher Widget - SimGlass Phase 6
 * Quick access to G1000/avionics panels and controls
 */

const WS_URL = `ws://${window.location.host}`;
const API_URL = `http://${window.location.host}`;

let ws = null;
let isConnected = false;
let _destroyed = false;

// Connect to SimGlass WebSocket
function connect() {
    if (_destroyed) return;

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('[Panel Launcher] Connected to SimGlass');
        isConnected = true;
        updateStatus(true);
    };

    ws.onclose = () => {
        console.log('[Panel Launcher] Disconnected');
        isConnected = false;
        updateStatus(false);
        // Reconnect after 3 seconds
        if (!_destroyed) {
            setTimeout(connect, 3000);
        }
    };

    ws.onerror = (err) => {
        console.error('[Panel Launcher] WebSocket error:', err);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Could update power button states based on flightData
            if (data.connected !== undefined) {
                updateStatus(data.connected);
            }
        } catch (e) {
            // Ignore parse errors
        }
    };
}

// Update connection status indicator
function updateStatus(connected) {
    const statusDot = document.getElementById('status');
    if (statusDot) {
        statusDot.classList.toggle('connected', connected);
    }
}

// Send command via REST API
async function sendCommand(command, value = 0) {
    try {
        const response = await fetch(`${API_URL}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, value })
        });
        const result = await response.json();
        console.log(`[Panel Launcher] Command ${command}:`, result);
        return result;
    } catch (err) {
        console.error(`[Panel Launcher] Command error:`, err);
        return { success: false, error: err.message };
    }
}

// Send H: event via REST API
async function sendHEvent(hevent) {
    try {
        // H: events are sent as a special command format
        const response = await fetch(`${API_URL}/api/hevent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: hevent })
        });
        const result = await response.json();
        console.log(`[Panel Launcher] H:${hevent}:`, result);
        return result;
    } catch (err) {
        // Fallback: try as regular command with H: prefix
        console.log(`[Panel Launcher] Trying H:${hevent} as command fallback`);
        return sendCommand(`H:${hevent}`);
    }
}

// Initialize button handlers
function initButtons() {
    // Standard command buttons
    document.querySelectorAll('[data-command]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const command = btn.dataset.command;
            btn.classList.add('active');
            await sendCommand(command);
            setTimeout(() => btn.classList.remove('active'), 200);
        });
    });

    // H: event buttons (G1000 controls)
    document.querySelectorAll('[data-hevent]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const hevent = btn.dataset.hevent;
            btn.classList.add('active');
            await sendHEvent(hevent);
            setTimeout(() => btn.classList.remove('active'), 150);
        });
    });
}

// Cleanup
function destroy() {
    _destroyed = true;
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Panel Launcher] Initializing...');
    initButtons();
    connect();
});

window.addEventListener('beforeunload', destroy);
