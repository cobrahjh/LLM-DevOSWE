/**
 * SimGlass Voice Control v1.0.0
 * Voice command recognition for flight simulator control
 * Uses Web Speech API (Chrome/Edge)
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\voice-control\widget.js
 * Last Updated: 2025-01-07
 */

const API_BASE = `http://${window.location.hostname}:8080`;
const STORAGE_KEY = 'SimGlass_voice_settings';
const COMMANDS_KEY = 'SimGlass_voice_commands';

// State
let recognition = null;
let isListening = false;
let settings = {
    language: 'en-US',
    continuous: true,
    confidence: 0.6,
    wakeWord: ''
};

// Default voice commands mapped to actions
let voiceCommands = [
    // Camera commands
    { phrase: 'cockpit view', action: 'keymap', category: 'camera', id: 'cockpitVFR', description: 'Switch to cockpit' },
    { phrase: 'external view', action: 'keymap', category: 'camera', id: 'externalClose', description: 'External camera' },
    { phrase: 'drone view', action: 'keymap', category: 'camera', id: 'drone', description: 'Drone camera' },
    { phrase: 'zoom in', action: 'keymap', category: 'camera', id: 'zoomIn', description: 'Zoom in' },
    { phrase: 'zoom out', action: 'keymap', category: 'camera', id: 'zoomOut', description: 'Zoom out' },
    
    // Lights
    { phrase: 'landing lights', action: 'keymap', category: 'lights', id: 'landing', description: 'Toggle landing lights' },
    { phrase: 'nav lights', action: 'keymap', category: 'lights', id: 'nav', description: 'Toggle nav lights' },
    { phrase: 'strobe lights', action: 'keymap', category: 'lights', id: 'strobes', description: 'Toggle strobes' },
    { phrase: 'beacon', action: 'keymap', category: 'lights', id: 'beacon', description: 'Toggle beacon' },
    { phrase: 'all lights on', action: 'keymap', category: 'lights', id: 'allOn', description: 'All lights on' },
    { phrase: 'all lights off', action: 'keymap', category: 'lights', id: 'allOff', description: 'All lights off' },
    
    // Aircraft controls
    { phrase: 'gear up', action: 'command', command: 'GEAR_UP', description: 'Retract gear' },
    { phrase: 'gear down', action: 'command', command: 'GEAR_DOWN', description: 'Extend gear' },
    { phrase: 'flaps up', action: 'command', command: 'FLAPS_UP', description: 'Flaps up' },
    { phrase: 'flaps down', action: 'command', command: 'FLAPS_DOWN', description: 'Flaps down' },
    { phrase: 'autopilot', action: 'command', command: 'AP_MASTER', description: 'Toggle autopilot' },
    { phrase: 'parking brake', action: 'command', command: 'PARKING_BRAKES', description: 'Toggle parking brake' },
    
    // Fuel
    { phrase: 'fill fuel', action: 'fuel', fuelAction: 'setPercent', percent: 100, description: 'Fill all tanks' },
    { phrase: 'half fuel', action: 'fuel', fuelAction: 'setPercent', percent: 50, description: '50% fuel' },
    
    // Custom/utility
    { phrase: 'take screenshot', action: 'key', key: 'F12', description: 'Screenshot' },
    { phrase: 'pause', action: 'key', key: 'P', description: 'Pause simulation' },

    // Checklist commands (hands-free)
    { phrase: 'check', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'checked', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'next item', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'uncheck', action: 'checklist', checklistAction: 'uncheckLast', description: 'Uncheck last item' },
    { phrase: 'reset checklist', action: 'checklist', checklistAction: 'reset', description: 'Reset current checklist' },
    { phrase: 'next checklist', action: 'checklist', checklistAction: 'nextChecklist', description: 'Go to next checklist' },
    { phrase: 'previous checklist', action: 'checklist', checklistAction: 'prevChecklist', description: 'Go to previous checklist' },
    { phrase: 'startup checklist', action: 'checklist', checklistAction: 'goto', target: 'startup', description: 'Go to startup checklist' },
    { phrase: 'taxi checklist', action: 'checklist', checklistAction: 'goto', target: 'taxi', description: 'Go to taxi checklist' },
    { phrase: 'takeoff checklist', action: 'checklist', checklistAction: 'goto', target: 'takeoff', description: 'Go to takeoff checklist' },
    { phrase: 'landing checklist', action: 'checklist', checklistAction: 'goto', target: 'landing', description: 'Go to landing checklist' },

    // Dashboard commands
    { phrase: 'show map', action: 'dashboard', layout: 'map-focus', description: 'Map focus layout' },
    { phrase: 'map focus', action: 'dashboard', layout: 'map-focus', description: 'Map focus layout' },
    { phrase: 'planning mode', action: 'dashboard', layout: 'planning', description: 'Planning layout' },
    { phrase: 'show planning', action: 'dashboard', layout: 'planning', description: 'Planning layout' },
    { phrase: 'enroute mode', action: 'dashboard', layout: 'enroute', description: 'Enroute layout' },
    { phrase: 'show enroute', action: 'dashboard', layout: 'enroute', description: 'Enroute layout' },
    { phrase: 'default layout', action: 'dashboard', layout: 'default', description: 'Default layout' },
    { phrase: 'fullscreen', action: 'dashboard', dashAction: 'fullscreen', description: 'Toggle fullscreen' },
    { phrase: 'open dashboard', action: 'dashboard', dashAction: 'open', description: 'Open flight dashboard' },

    // Widget commands
    { phrase: 'fetch weather', action: 'widget', widget: 'weather', widgetAction: 'fetch', description: 'Fetch weather' },
    { phrase: 'fetch simbrief', action: 'widget', widget: 'simbrief', widgetAction: 'fetch', description: 'Fetch SimBrief OFP' },
    { phrase: 'show charts', action: 'widget', widget: 'charts', widgetAction: 'open', description: 'Open charts widget' },
    { phrase: 'copy to notepad', action: 'widget', widget: 'notepad', widgetAction: 'copy', description: 'Copy to notepad' }
];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadCommands();
    initSpeechRecognition();
    setupEventListeners();
    renderCommands();
    log('Voice Control ready', 'info');
});

function setupEventListeners() {
    document.getElementById('btn-listen').addEventListener('click', toggleListening);
    document.getElementById('mic-status').addEventListener('click', toggleListening);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-transparency').addEventListener('click', toggleTransparency);
    
    // Settings inputs
    document.getElementById('setting-confidence').addEventListener('input', (e) => {
        document.getElementById('confidence-value').textContent = e.target.value + '%';
    });
}

// ============================================
// SPEECH RECOGNITION
// ============================================

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        log('Speech recognition not supported in this browser', 'error');
        document.getElementById('btn-listen').disabled = true;
        document.getElementById('status-text').textContent = 'Not Supported';
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = settings.continuous;
    recognition.interimResults = true;
    recognition.lang = settings.language;
    
    recognition.onstart = () => {
        isListening = true;
        updateUI();
        log('Listening started', 'info');
    };
    
    recognition.onend = () => {
        isListening = false;
        updateUI();
        
        // Auto-restart if continuous mode
        if (settings.continuous && document.getElementById('btn-listen').dataset.shouldListen === 'true') {
            setTimeout(() => {
                if (document.getElementById('btn-listen').dataset.shouldListen === 'true') {
                    try {
                        recognition.start();
                    } catch(e) {
                        if (window.telemetry) {
                            telemetry.captureError(e, {
                                operation: 'autoRestartRecognition',
                                widget: 'voice-control'
                            });
                        }
                    }
                }
            }, 100);
        }
    };
    
    recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.toLowerCase().trim();
        const confidence = result[0].confidence;
        
        document.getElementById('transcript').textContent = transcript;
        
        if (result.isFinal) {
            processCommand(transcript, confidence);
        }
    };
    
    recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            log(`Recognition error: ${event.error}`, 'error');
        }
    };
}

function toggleListening() {
    const btn = document.getElementById('btn-listen');
    
    if (isListening) {
        btn.dataset.shouldListen = 'false';
        recognition.stop();
    } else {
        btn.dataset.shouldListen = 'true';
        try {
            recognition.start();
        } catch(e) {
            log('Could not start recognition', 'error');
        }
    }
}

function updateUI() {
    const btn = document.getElementById('btn-listen');
    const micIcon = document.getElementById('mic-icon');
    const statusText = document.getElementById('status-text');
    const micStatus = document.getElementById('mic-status');
    
    if (isListening) {
        btn.textContent = 'Stop Listening';
        btn.classList.add('listening');
        micIcon.textContent = '🔴';
        statusText.textContent = 'Listening...';
        micStatus.classList.add('active');
    } else {
        btn.textContent = 'Start Listening';
        btn.classList.remove('listening');
        micIcon.textContent = '🎤';
        statusText.textContent = 'Click to Start';
        micStatus.classList.remove('active');
    }
}


// ============================================
// COMMAND PROCESSING
// ============================================

function processCommand(transcript, confidence) {
    // Check wake word if configured
    if (settings.wakeWord) {
        if (!transcript.startsWith(settings.wakeWord.toLowerCase())) {
            return; // Ignore if wake word not spoken
        }
        transcript = transcript.slice(settings.wakeWord.length).trim();
    }
    
    // Check confidence threshold
    if (confidence < settings.confidence) {
        log(`Low confidence (${(confidence * 100).toFixed(0)}%): "${transcript}"`, 'warn');
        return;
    }
    
    // Find matching command
    const match = findBestMatch(transcript);
    
    if (match) {
        document.getElementById('matched-command').textContent = `✓ ${match.command.description}`;
        document.getElementById('matched-command').className = 'matched-command success';
        log(`Matched: "${match.command.phrase}" → ${match.command.description}`, 'success');
        executeAction(match.command);
    } else {
        document.getElementById('matched-command').textContent = `✗ No match found`;
        document.getElementById('matched-command').className = 'matched-command error';
        log(`No match for: "${transcript}"`, 'warn');
    }
}

function findBestMatch(transcript) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const cmd of voiceCommands) {
        const score = calculateSimilarity(transcript, cmd.phrase.toLowerCase());
        if (score > bestScore && score > 0.7) {
            bestScore = score;
            bestMatch = { command: cmd, score };
        }
    }
    
    return bestMatch;
}

function calculateSimilarity(str1, str2) {
    // Check for exact match or contains
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.9;
    
    // Levenshtein-based similarity
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];
    
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    
    const distance = matrix[len1][len2];
    return 1 - distance / Math.max(len1, len2);
}

// ============================================
// ACTION EXECUTION
// ============================================

async function executeAction(cmd) {
    try {
        switch (cmd.action) {
            case 'keymap':
                await executeKeymap(cmd.category, cmd.id);
                break;
            case 'command':
                await executeCommand(cmd.command);
                break;
            case 'key':
                await sendKey(cmd.key);
                break;
            case 'fuel':
                await executeFuel(cmd);
                break;
            case 'checklist':
                await executeChecklist(cmd);
                break;
            case 'dashboard':
                await executeDashboard(cmd);
                break;
            case 'widget':
                await executeWidget(cmd);
                break;
            default:
                log(`Unknown action type: ${cmd.action}`, 'error');
        }
    } catch (e) {
        log(`Action failed: ${e.message}`, 'error');
    }
}

async function executeKeymap(category, id) {
    // First get the keymap to find the key
    const res = await fetch(`${API_BASE}/api/keymaps/${category}`);
    const keymaps = await res.json();
    
    // Find by originalId or id
    let key = null;
    for (const [mapId, binding] of Object.entries(keymaps)) {
        if (binding.originalId === id || mapId === id) {
            key = binding.key || binding;
            break;
        }
    }
    
    if (key) {
        await sendKey(key);
    } else {
        log(`Keymap not found: ${category}.${id}`, 'error');
    }
}

async function executeCommand(command) {
    await fetch(`${API_BASE}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value: 1 })
    });
    log(`Command sent: ${command}`, 'info');
}

async function sendKey(key) {
    await fetch(`${API_BASE}/api/sendkey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    log(`Key sent: ${key}`, 'info');
}

async function executeFuel(cmd) {
    await fetch(`${API_BASE}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'command',
            category: 'fuel',
            action: cmd.fuelAction,
            percent: cmd.percent
        })
    });
    log(`Fuel: ${cmd.fuelAction} ${cmd.percent}%`, 'info');
}

async function executeChecklist(cmd) {
    // Send checklist command via WebSocket broadcast or localStorage
    const action = {
        type: 'checklist',
        action: cmd.checklistAction,
        target: cmd.target || null
    };

    // Use BroadcastChannel API for cross-widget communication
    const channel = new BroadcastChannel('SimGlass-checklist');
    channel.postMessage(action);
    channel.close();

    // Also store in localStorage for widgets that might not support BroadcastChannel
    localStorage.setItem('SimGlass-checklist-command', JSON.stringify({
        ...action,
        timestamp: Date.now()
    }));

    log(`Checklist: ${cmd.checklistAction}${cmd.target ? ' -> ' + cmd.target : ''}`, 'info');
}

async function executeDashboard(cmd) {
    const channel = new BroadcastChannel('SimGlass-sync');

    if (cmd.layout) {
        // Change dashboard layout
        channel.postMessage({
            type: 'dashboard-layout',
            data: { layout: cmd.layout }
        });
        log(`Dashboard layout: ${cmd.layout}`, 'info');
    } else if (cmd.dashAction === 'fullscreen') {
        channel.postMessage({
            type: 'dashboard-action',
            data: { action: 'fullscreen' }
        });
        log('Dashboard: Toggle fullscreen', 'info');
    } else if (cmd.dashAction === 'open') {
        window.open('/ui/flight-dashboard/', 'flight-dashboard', 'width=1400,height=900');
        log('Dashboard: Opened', 'info');
    }

    channel.close();
}

async function executeWidget(cmd) {
    const channel = new BroadcastChannel('SimGlass-sync');

    switch (cmd.widget) {
        case 'weather':
            channel.postMessage({
                type: 'widget-action',
                data: { widget: 'weather', action: 'fetch' }
            });
            log('Weather: Fetch requested', 'info');
            break;

        case 'simbrief':
            channel.postMessage({
                type: 'widget-action',
                data: { widget: 'simbrief', action: 'fetch' }
            });
            log('SimBrief: Fetch requested', 'info');
            break;

        case 'charts':
            window.open('/ui/charts-widget/', 'charts-widget', 'width=800,height=600');
            log('Charts: Opened', 'info');
            break;

        case 'notepad':
            channel.postMessage({
                type: 'widget-action',
                data: { widget: 'notepad', action: 'copy' }
            });
            log('Notepad: Copy requested', 'info');
            break;
    }

    channel.close();
}


// ============================================
// SETTINGS
// ============================================

function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            settings = { ...settings, ...JSON.parse(saved) };
        }
    } catch (e) {
        if (window.telemetry) {
            telemetry.captureError(e, {
                operation: 'loadSettings',
                widget: 'voice-control',
                storage: 'localStorage'
            });
        }
    }

    // Apply to UI
    document.getElementById('setting-language').value = settings.language;
    document.getElementById('setting-continuous').checked = settings.continuous;
    document.getElementById('setting-confidence').value = settings.confidence * 100;
    document.getElementById('confidence-value').textContent = (settings.confidence * 100) + '%';
    document.getElementById('setting-wakeword').value = settings.wakeWord;
}

function saveSettings() {
    settings.language = document.getElementById('setting-language').value;
    settings.continuous = document.getElementById('setting-continuous').checked;
    settings.confidence = document.getElementById('setting-confidence').value / 100;
    settings.wakeWord = document.getElementById('setting-wakeword').value.trim();
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // Reinitialize recognition with new settings
    if (recognition) {
        recognition.lang = settings.language;
        recognition.continuous = settings.continuous;
    }
    
    closeSettings();
    log('Settings saved', 'success');
}

function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function loadCommands() {
    try {
        const saved = localStorage.getItem(COMMANDS_KEY);
        if (saved) {
            voiceCommands = JSON.parse(saved);
        }
    } catch (e) {
        if (window.telemetry) {
            telemetry.captureError(e, {
                operation: 'loadCommands',
                widget: 'voice-control',
                storage: 'localStorage'
            });
        }
    }
}

function saveCommands() {
    localStorage.setItem(COMMANDS_KEY, JSON.stringify(voiceCommands));
}

// ============================================
// UI RENDERING
// ============================================

function renderCommands() {
    const list = document.getElementById('commands-list');
    document.getElementById('command-count').textContent = `(${voiceCommands.length})`;
    
    // Group by action type
    const grouped = {};
    voiceCommands.forEach(cmd => {
        const type = cmd.action;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(cmd);
    });
    
    let html = '';
    for (const [type, cmds] of Object.entries(grouped)) {
        html += `<div class="command-group">
            <div class="group-header">${formatType(type)}</div>`;
        cmds.forEach(cmd => {
            html += `<div class="command-item">
                <span class="phrase">"${cmd.phrase}"</span>
                <span class="desc">${cmd.description}</span>
            </div>`;
        });
        html += '</div>';
    }
    
    list.innerHTML = html;
}

function formatType(type) {
    const icons = {
        keymap: '⌨️ Keymaps',
        command: '🎮 SimConnect',
        key: '⌨️ Keys',
        fuel: '⛽ Fuel'
    };
    return icons[type] || type;
}

// ============================================
// TRANSPARENCY
// ============================================

function toggleTransparency() {
    document.body.classList.toggle('transparent');
    localStorage.setItem('voice_transparent', document.body.classList.contains('transparent'));
}

// Load transparency preference
if (localStorage.getItem('voice_transparent') === 'true') {
    document.body.classList.add('transparent');
}

// ============================================
// LOGGING
// ============================================

function log(message, type = 'info') {
    const logEl = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    const typeClass = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : '';
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${typeClass}`;
    entry.innerHTML = `<span class="time">${time}</span> ${message}`;
    
    logEl.insertBefore(entry, logEl.firstChild);
    
    // Keep only last 20 entries
    while (logEl.children.length > 20) {
        logEl.removeChild(logEl.lastChild);
    }
}
