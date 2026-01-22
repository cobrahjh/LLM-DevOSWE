/**
 * Interaction Wheel Widget - SimWidget Phase 6
 * Flow Pro-style radial menu for quick flight actions
 */

const WS_URL = 'ws://localhost:8080';
const API_URL = 'http://localhost:8080';

let ws = null;
let isConnected = false;

// Define wheel segments - quick actions arranged in a circle
const WHEEL_ACTIONS = [
    { id: 'gear', icon: '\u2699', label: 'GEAR', command: 'GEAR_TOGGLE', category: 'flight', tooltip: 'Toggle landing gear' },
    { id: 'flaps-up', icon: '\u25B2', label: 'FLAPS-', command: 'FLAPS_DECR', category: 'flight', tooltip: 'Retract flaps' },
    { id: 'flaps-dn', icon: '\u25BC', label: 'FLAPS+', command: 'FLAPS_INCR', category: 'flight', tooltip: 'Extend flaps' },
    { id: 'lights', icon: '\u{1F4A1}', label: 'LIGHTS', command: 'TOGGLE_ALL_LIGHTS', category: 'lights', tooltip: 'Toggle all lights' },
    { id: 'ap', icon: '\u2708', label: 'A/P', command: 'AP_MASTER', category: 'autopilot', tooltip: 'Autopilot master' },
    { id: 'brake', icon: '\u25A0', label: 'BRAKE', command: 'PARKING_BRAKES', category: 'flight', tooltip: 'Parking brake' },
    { id: 'view', icon: '\u{1F4F7}', label: 'VIEW', command: 'VIEW_MODE', category: 'camera', tooltip: 'Cycle camera view' },
    { id: 'spoiler', icon: '\u2594', label: 'SPOIL', command: 'SPOILERS_TOGGLE', category: 'flight', tooltip: 'Toggle spoilers' }
];

// Connect to SimWidget WebSocket
function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('[Wheel] Connected to SimWidget');
        isConnected = true;
        updateStatus(true, 'Connected');
    };

    ws.onclose = () => {
        console.log('[Wheel] Disconnected');
        isConnected = false;
        updateStatus(false, 'Disconnected');
        setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
        console.error('[Wheel] WebSocket error:', err);
        updateStatus(false, 'Error');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            updateSegmentStates(data);
        } catch (e) {
            // Ignore parse errors
        }
    };
}

// Update connection status
function updateStatus(connected, text) {
    const statusDot = document.getElementById('status');
    const statusText = document.getElementById('statusText');

    if (statusDot) statusDot.classList.toggle('connected', connected);
    if (statusText) statusText.textContent = text;
}

// Update segment active states based on flight data
function updateSegmentStates(data) {
    const gearSeg = document.querySelector('[data-action="gear"]');
    if (gearSeg) gearSeg.classList.toggle('active', data.gearDown);

    const brakeSeg = document.querySelector('[data-action="brake"]');
    if (brakeSeg) brakeSeg.classList.toggle('active', data.parkingBrake);

    const apSeg = document.querySelector('[data-action="ap"]');
    if (apSeg) apSeg.classList.toggle('active', data.apMaster);

    const lightSeg = document.querySelector('[data-action="lights"]');
    if (lightSeg) {
        const anyLightOn = data.navLight || data.beaconLight || data.strobeLight ||
                          data.landingLight || data.taxiLight;
        lightSeg.classList.toggle('active', anyLightOn);
    }
}

// Send command via REST API
async function sendCommand(command) {
    try {
        const response = await fetch(`${API_URL}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, value: 0 })
        });
        const result = await response.json();
        console.log(`[Wheel] ${command}:`, result);
        return result;
    } catch (err) {
        console.error(`[Wheel] Command error:`, err);
        return { success: false, error: err.message };
    }
}

// Create wheel segments using safe DOM methods
function createWheel() {
    const wheel = document.getElementById('wheel');
    const segmentCount = WHEEL_ACTIONS.length;
    const angleStep = 360 / segmentCount;

    WHEEL_ACTIONS.forEach((action, index) => {
        const angle = index * angleStep - 90;
        const segment = document.createElement('div');
        segment.className = 'wheel-segment';
        segment.dataset.action = action.id;
        segment.dataset.category = action.category;
        segment.style.transform = `rotate(${angle}deg)`;

        // Create content using safe DOM methods
        const content = document.createElement('div');
        content.className = 'segment-content';
        content.style.transform = `translateY(-50%) rotate(${-angle}deg)`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'segment-icon';
        iconSpan.textContent = action.icon;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'segment-label';
        labelSpan.textContent = action.label;

        content.appendChild(iconSpan);
        content.appendChild(labelSpan);
        segment.appendChild(content);

        // Click handler
        segment.addEventListener('click', async () => {
            segment.classList.add('active');
            await sendCommand(action.command);
            setTimeout(() => {
                if (!['gear', 'brake', 'ap', 'lights'].includes(action.id)) {
                    segment.classList.remove('active');
                }
            }, 200);
        });

        // Tooltip handlers
        segment.addEventListener('mouseenter', (e) => showTooltip(e, action.tooltip));
        segment.addEventListener('mouseleave', hideTooltip);

        wheel.appendChild(segment);
    });
}

// Tooltip functions
function showTooltip(event, text) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = text;
    tooltip.style.left = event.pageX + 15 + 'px';
    tooltip.style.top = event.pageY + 15 + 'px';
    tooltip.classList.add('visible');
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Wheel] Initializing Interaction Wheel...');

    const hub = document.getElementById('hub');
    hub.addEventListener('click', () => {
        console.log('[Wheel] Hub clicked');
    });

    createWheel();
    connect();
});
