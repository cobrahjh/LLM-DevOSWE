/**
 * Otto Search Bar - SimGlass Phase 6
 * Command palette for quick action search
 */

const WS_URL = `ws://${window.location.host}`;
const API_URL = `http://${window.location.host}`;

let ws = null;
let isConnected = false;
let selectedIndex = 0;
let filteredCommands = [];
let currentCategory = 'all';
let _destroyed = false;

// Command database
const COMMANDS = [
    // Flight Controls
    { name: 'Toggle Gear', desc: 'Raise/lower landing gear', command: 'GEAR_TOGGLE', category: 'flight', icon: '\u2699', keywords: ['gear', 'landing', 'wheels'] },
    { name: 'Flaps Up', desc: 'Retract flaps one notch', command: 'FLAPS_DECR', category: 'flight', icon: '\u25B2', keywords: ['flaps', 'retract', 'up'] },
    { name: 'Flaps Down', desc: 'Extend flaps one notch', command: 'FLAPS_INCR', category: 'flight', icon: '\u25BC', keywords: ['flaps', 'extend', 'down'] },
    { name: 'Parking Brake', desc: 'Toggle parking brake', command: 'PARKING_BRAKES', category: 'flight', icon: '\u25A0', keywords: ['brake', 'parking', 'stop'] },
    { name: 'Spoilers Toggle', desc: 'Arm/deploy spoilers', command: 'SPOILERS_TOGGLE', category: 'flight', icon: '\u2594', keywords: ['spoilers', 'speedbrake'] },
    { name: 'Elevator Trim Up', desc: 'Trim nose up', command: 'ELEV_TRIM_UP', category: 'flight', icon: '\u2191', keywords: ['trim', 'elevator', 'up'] },
    { name: 'Elevator Trim Down', desc: 'Trim nose down', command: 'ELEV_TRIM_DN', category: 'flight', icon: '\u2193', keywords: ['trim', 'elevator', 'down'] },

    // Lights
    { name: 'Nav Lights', desc: 'Toggle navigation lights', command: 'TOGGLE_NAV_LIGHTS', category: 'lights', icon: '\u{1F7E2}', keywords: ['nav', 'lights'] },
    { name: 'Beacon Light', desc: 'Toggle beacon', command: 'TOGGLE_BEACON_LIGHTS', category: 'lights', icon: '\u{1F534}', keywords: ['beacon', 'lights'] },
    { name: 'Strobe Lights', desc: 'Toggle strobe lights', command: 'STROBES_TOGGLE', category: 'lights', icon: '\u26A1', keywords: ['strobe', 'lights'] },
    { name: 'Landing Lights', desc: 'Toggle landing lights', command: 'LANDING_LIGHTS_TOGGLE', category: 'lights', icon: '\u{1F4A1}', keywords: ['landing', 'lights'] },
    { name: 'Taxi Lights', desc: 'Toggle taxi lights', command: 'TOGGLE_TAXI_LIGHTS', category: 'lights', icon: '\u{1F6A6}', keywords: ['taxi', 'lights'] },
    { name: 'Logo Lights', desc: 'Toggle logo lights', command: 'TOGGLE_LOGO_LIGHTS', category: 'lights', icon: '\u2B50', keywords: ['logo', 'lights'] },
    { name: 'Cabin Lights', desc: 'Toggle cabin lights', command: 'TOGGLE_CABIN_LIGHTS', category: 'lights', icon: '\u{1F3E0}', keywords: ['cabin', 'lights'] },
    { name: 'Panel Lights', desc: 'Toggle panel lights', command: 'PANEL_LIGHTS_TOGGLE', category: 'lights', icon: '\u{1F4DF}', keywords: ['panel', 'lights'] },

    // Autopilot
    { name: 'Autopilot Master', desc: 'Toggle autopilot', command: 'AP_MASTER', category: 'autopilot', icon: '\u2708', keywords: ['autopilot', 'ap', 'master'] },
    { name: 'Heading Hold', desc: 'Toggle heading mode', command: 'AP_PANEL_HEADING_HOLD', category: 'autopilot', icon: '\u27A4', keywords: ['heading', 'hdg'] },
    { name: 'Altitude Hold', desc: 'Toggle altitude mode', command: 'AP_PANEL_ALTITUDE_HOLD', category: 'autopilot', icon: '\u2195', keywords: ['altitude', 'alt'] },
    { name: 'V/S Hold', desc: 'Toggle V/S mode', command: 'AP_PANEL_VS_HOLD', category: 'autopilot', icon: '\u2197', keywords: ['vertical', 'vs'] },
    { name: 'NAV Mode', desc: 'Toggle NAV mode', command: 'AP_NAV1_HOLD', category: 'autopilot', icon: '\u{1F9ED}', keywords: ['nav', 'gps'] },
    { name: 'Approach Mode', desc: 'Toggle approach', command: 'AP_APR_HOLD', category: 'autopilot', icon: '\u{1F6EC}', keywords: ['approach', 'ils'] },

    // Engine
    { name: 'Throttle Full', desc: 'Set throttle 100%', command: 'THROTTLE_FULL', category: 'engine', icon: '\u{1F680}', keywords: ['throttle', 'full', 'toga'] },
    { name: 'Throttle Cut', desc: 'Set throttle idle', command: 'THROTTLE_CUT', category: 'engine', icon: '\u23F9', keywords: ['throttle', 'cut', 'idle'] },
    { name: 'Mixture Rich', desc: 'Set mixture rich', command: 'MIXTURE_RICH', category: 'engine', icon: '\u{1F7E2}', keywords: ['mixture', 'rich'] },
    { name: 'Mixture Lean', desc: 'Set mixture lean', command: 'MIXTURE_LEAN', category: 'engine', icon: '\u{1F7E1}', keywords: ['mixture', 'lean'] },
    { name: 'Pitot Heat', desc: 'Toggle pitot heat', command: 'PITOT_HEAT_TOGGLE', category: 'engine', icon: '\u{1F321}', keywords: ['pitot', 'heat'] },
    { name: 'Carb Heat', desc: 'Toggle carb heat', command: 'ANTI_ICE_TOGGLE_ENG1', category: 'engine', icon: '\u2744', keywords: ['carb', 'heat'] },
    { name: 'Battery', desc: 'Toggle battery', command: 'TOGGLE_MASTER_BATTERY', category: 'engine', icon: '\u{1F50B}', keywords: ['battery', 'master'] },
    { name: 'Alternator', desc: 'Toggle alternator', command: 'TOGGLE_MASTER_ALTERNATOR', category: 'engine', icon: '\u26A1', keywords: ['alternator'] },
    { name: 'Avionics', desc: 'Toggle avionics', command: 'TOGGLE_AVIONICS_MASTER', category: 'engine', icon: '\u{1F4E1}', keywords: ['avionics'] },

    // Camera
    { name: 'Cycle View', desc: 'Cycle camera views', command: 'VIEW_MODE', category: 'camera', icon: '\u{1F4F7}', keywords: ['view', 'camera'] },
    { name: 'Cockpit View', desc: 'Switch to cockpit', command: 'VIEW_COCKPIT_FORWARD', category: 'camera', icon: '\u{1F3AF}', keywords: ['cockpit', 'interior'] },
    { name: 'External View', desc: 'Switch to external', command: 'VIEW_EXTERNAL', category: 'camera', icon: '\u{1F30D}', keywords: ['external', 'chase'] },

    // Radio
    { name: 'COM1 Swap', desc: 'Swap COM1 frequencies', command: 'COM_STBY_RADIO_SWAP', category: 'radio', icon: '\u{1F4E2}', keywords: ['com1', 'swap'] },
    { name: 'COM2 Swap', desc: 'Swap COM2 frequencies', command: 'COM2_RADIO_SWAP', category: 'radio', icon: '\u{1F4E2}', keywords: ['com2', 'swap'] },
    { name: 'NAV1 Swap', desc: 'Swap NAV1 frequencies', command: 'NAV1_RADIO_SWAP', category: 'radio', icon: '\u{1F9ED}', keywords: ['nav1', 'swap'] },
    { name: 'NAV2 Swap', desc: 'Swap NAV2 frequencies', command: 'NAV2_RADIO_SWAP', category: 'radio', icon: '\u{1F9ED}', keywords: ['nav2', 'swap'] },

    // Environment
    { name: 'Pause', desc: 'Toggle pause', command: 'PAUSE_TOGGLE', category: 'environment', icon: '\u23F8', keywords: ['pause', 'stop'] },
    { name: 'Slew Mode', desc: 'Toggle slew', command: 'SLEW_TOGGLE', category: 'environment', icon: '\u21C4', keywords: ['slew', 'move'] },
    { name: 'Repair & Refuel', desc: 'Fix and refuel', command: 'REPAIR_AND_REFUEL', category: 'environment', icon: '\u{1F527}', keywords: ['repair', 'refuel'] },
    { name: 'Sim Rate Up', desc: 'Speed up sim', command: 'SIM_RATE_INCR', category: 'environment', icon: '\u23E9', keywords: ['sim', 'rate', 'fast'] },
    { name: 'Sim Rate Down', desc: 'Slow down sim', command: 'SIM_RATE_DECR', category: 'environment', icon: '\u23EA', keywords: ['sim', 'rate', 'slow'] }
];

function connect() {
    if (_destroyed) return;

    ws = new WebSocket(WS_URL);
    ws.onopen = () => { isConnected = true; updateStatus(true, 'Connected'); };
    ws.onclose = () => {
        isConnected = false;
        updateStatus(false, 'Disconnected');
        if (!_destroyed) {
            setTimeout(connect, 3000);
        }
    };
    ws.onerror = () => updateStatus(false, 'Error');
}

function updateStatus(connected, text) {
    const dot = document.getElementById('status');
    const txt = document.getElementById('statusText');
    if (dot) dot.classList.toggle('connected', connected);
    if (txt) txt.textContent = text;
}

async function sendCommand(command) {
    try {
        const response = await fetch(`${API_URL}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, value: 0 })
        });
        return await response.json();
    } catch (err) {
        return { success: false };
    }
}

function filterCommands(query) {
    const q = query.toLowerCase().trim();
    let results = COMMANDS;
    if (currentCategory !== 'all') {
        results = results.filter(cmd => cmd.category === currentCategory);
    }
    if (q) {
        results = results.filter(cmd => {
            return cmd.name.toLowerCase().includes(q) ||
                   cmd.desc.toLowerCase().includes(q) ||
                   cmd.keywords.some(kw => kw.includes(q));
        });
    }
    return results;
}

function renderResults(commands, query) {
    const container = document.getElementById('results');
    const countEl = document.getElementById('resultCount');
    filteredCommands = commands;
    selectedIndex = 0;

    if (countEl) countEl.textContent = commands.length + ' commands';
    container.textContent = '';

    if (commands.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        const icon = document.createElement('div');
        icon.className = 'no-results-icon';
        icon.textContent = '\u{1F50D}';
        const text = document.createElement('div');
        text.textContent = query ? 'No commands matching "' + query + '"' : 'No commands';
        noResults.appendChild(icon);
        noResults.appendChild(text);
        container.appendChild(noResults);
        return;
    }

    commands.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = 'result-item' + (index === 0 ? ' selected' : '');
        item.dataset.category = cmd.category;
        item.dataset.index = index;

        const iconDiv = document.createElement('div');
        iconDiv.className = 'result-icon';
        iconDiv.textContent = cmd.icon;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'result-name';
        nameDiv.textContent = cmd.name;

        const descDiv = document.createElement('div');
        descDiv.className = 'result-desc';
        descDiv.textContent = cmd.desc;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(descDiv);

        const catSpan = document.createElement('span');
        catSpan.className = 'result-category';
        catSpan.textContent = cmd.category;

        item.appendChild(iconDiv);
        item.appendChild(infoDiv);
        item.appendChild(catSpan);
        item.addEventListener('click', () => executeCommand(index));
        container.appendChild(item);
    });
}

async function executeCommand(index) {
    const cmd = filteredCommands[index];
    if (!cmd) return;
    const items = document.querySelectorAll('.result-item');
    if (items[index]) {
        items[index].style.background = 'rgba(0, 255, 136, 0.2)';
        setTimeout(() => { items[index].style.background = ''; }, 300);
    }
    await sendCommand(cmd.command);
}

function updateSelection(newIndex) {
    const items = document.querySelectorAll('.result-item');
    if (items.length === 0) return;
    newIndex = Math.max(0, Math.min(newIndex, items.length - 1));
    items.forEach(item => item.classList.remove('selected'));
    items[newIndex].classList.add('selected');
    items[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    selectedIndex = newIndex;
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const categoryBar = document.getElementById('categoryBar');

    renderResults(filterCommands(''), '');

    searchInput.addEventListener('input', (e) => {
        renderResults(filterCommands(e.target.value), e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); updateSelection(selectedIndex + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); updateSelection(selectedIndex - 1); }
        else if (e.key === 'Enter') { e.preventDefault(); executeCommand(selectedIndex); }
        else if (e.key === 'Escape') { searchInput.value = ''; renderResults(filterCommands(''), ''); }
    });

    categoryBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            categoryBar.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.dataset.category;
            renderResults(filterCommands(searchInput.value), searchInput.value);
        }
    });

    connect();
});

function destroy() {
    _destroyed = true;
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
}

window.addEventListener('beforeunload', destroy);
