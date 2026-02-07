/**
 * SimGlass Keymap Editor v1.5.0
 * UI for viewing and editing key mappings
 * Supports keyboard + gamepad/joystick/HOTAS input
 * Device enable/disable to filter noisy devices with constant input
 * Export/Import keymaps to JSON files
 * 
 * Changes v1.5.0:
 * - Clear button now enables Save to allow saving cleared/empty values
 * 
 * Changes v1.4.0:
 * - Import validation with detailed structure checking
 * - Shows summary before import (categories, keys, triggers)
 * 
 * Changes v1.3.0:
 * - Added export keymaps to JSON file
 * - Added import keymaps from JSON file
 * 
 * Changes v1.2.0:
 * - Added device enable/disable toggles per controller
 * - Disabled devices won't capture input during key mapping
 * - Settings persist in localStorage
 * - Visual indicator for noisy disabled devices
 */

const API_BASE = `http://${window.location.hostname}:8080`;

let keymaps = {};
let selectedItem = null;
let capturedKey = null;
let editingCategory = null;
let editingAction = null;

// Controller/Gamepad state
let controllers = {};
let controllerScanActive = false;
let controllerPollInterval = null;

// Device settings - which devices are enabled/disabled
let deviceSettings = {};
const DEVICE_SETTINGS_KEY = 'SimGlass_device_settings';
// Store device IDs by index for reliable lookup
let deviceIdByIndex = {};
let skipNextRender = false;
let lastDeviceState = ''; // Track changes to avoid unnecessary re-renders

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDeviceSettings();
    loadKeymaps();
    loadStatus();
    setupEventListeners();
    setupControllerListeners();
});

function setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadKeymaps);
    document.getElementById('btn-test').addEventListener('click', testSelected);
    document.getElementById('btn-check-conflicts').addEventListener('click', checkConflicts);
    document.getElementById('btn-scan-devices').addEventListener('click', toggleDeviceScan);
    document.getElementById('btn-save-key').addEventListener('click', saveKey);
    document.getElementById('btn-clear-key').addEventListener('click', clearKey);
    document.getElementById('btn-cancel-key').addEventListener('click', closeModal);
    document.getElementById('btn-enable-all').addEventListener('click', enableAllDevices);
    document.getElementById('btn-disable-all').addEventListener('click', disableAllDevices);
    
    // Export/Import
    document.getElementById('btn-export').addEventListener('click', exportKeymaps);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importKeymaps);
    
    // Global key capture
    document.addEventListener('keydown', handleKeyCapture);
}

function toggleDevice(index) {
    // Use cached device ID instead of looking up from gamepads (which can go stale)
    const deviceId = deviceIdByIndex[index];
    if (deviceId) {
        skipNextRender = true;
        const currentlyEnabled = isDeviceEnabled(deviceId);
        setDeviceEnabled(deviceId, !currentlyEnabled);
        lastDeviceState = ''; // Force re-render on next poll
        setTimeout(() => { skipNextRender = false; }, 100);
    }
}

// ============================================
// DEVICE SETTINGS PERSISTENCE
// ============================================

function loadDeviceSettings() {
    try {
        const saved = localStorage.getItem(DEVICE_SETTINGS_KEY);
        if (saved) {
            deviceSettings = JSON.parse(saved);
            log('Device settings loaded', 'info');
        }
    } catch (e) {
        deviceSettings = {};
    }
}

function saveDeviceSettings() {
    try {
        localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(deviceSettings));
    } catch (e) {
        log('Failed to save device settings', 'error');
    }
}

function isDeviceEnabled(deviceId) {
    // Default to enabled if not explicitly disabled
    const key = getDeviceKey(deviceId);
    return deviceSettings[key] !== false;
}

function setDeviceEnabled(deviceId, enabled) {
    const key = getDeviceKey(deviceId);
    deviceSettings[key] = enabled;
    saveDeviceSettings();
    updateDevicesList();
    log(`${enabled ? '✓ Enabled' : '✗ Disabled'}: ${getShortDeviceName(deviceId)}`, enabled ? 'success' : 'info');
}

// Expose to window for inline HTML handlers
window.setDeviceEnabled = setDeviceEnabled;
window.toggleDevice = toggleDevice;

function getDeviceKey(deviceId) {
    // Create stable key from device ID (vendor/product remain same)
    return deviceId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
}

function enableAllDevices() {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
        if (gamepad) {
            setDeviceEnabled(gamepad.id, true);
        }
    }
    lastDeviceState = ''; // Force re-render
}

function disableAllDevices() {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
        if (gamepad) {
            setDeviceEnabled(gamepad.id, false);
        }
    }
    lastDeviceState = ''; // Force re-render
}

// ============================================
// CONTROLLER/GAMEPAD SUPPORT
// ============================================

function setupControllerListeners() {
    window.addEventListener('gamepadconnected', (e) => {
        log(`🎮 Connected: ${e.gamepad.id}`, 'success');
        controllers[e.gamepad.index] = e.gamepad;
        lastDeviceState = ''; // Force re-render
        updateDevicesList();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        log(`🎮 Disconnected: ${e.gamepad.id}`, 'info');
        delete controllers[e.gamepad.index];
        lastDeviceState = ''; // Force re-render
        updateDevicesList();
    });
}

function toggleDeviceScan() {
    const panel = document.getElementById('devices-panel');
    controllerScanActive = !controllerScanActive;
    
    if (controllerScanActive) {
        panel.classList.remove('hidden');
        startControllerPolling();
        log('🎮 Device scanning started - press buttons to detect', 'info');
    } else {
        panel.classList.add('hidden');
        stopControllerPolling();
    }
}

function startControllerPolling() {
    if (controllerPollInterval) return;
    
    controllerPollInterval = setInterval(() => {
        const gamepads = navigator.getGamepads();
        
        // Build current state string to detect changes
        let currentState = '';
        
        for (const gamepad of gamepads) {
            if (!gamepad) continue;
            
            controllers[gamepad.index] = gamepad;
            // Store device ID for reliable lookup when toggling
            deviceIdByIndex[gamepad.index] = gamepad.id;
            
            // Build state string for change detection
            const buttons = gamepad.buttons.map((b, i) => b.pressed ? i : '').filter(x => x !== '').join(',');
            const axes = gamepad.axes.map((a, i) => Math.abs(a) > 0.1 ? `${i}:${a.toFixed(1)}` : '').filter(x => x !== '').join(',');
            currentState += `${gamepad.index}:${buttons}:${axes}|`;
            
            // Skip disabled devices for input capture
            if (!isDeviceEnabled(gamepad.id)) continue;
            
            // Check for button presses
            gamepad.buttons.forEach((button, btnIndex) => {
                if (button.pressed) {
                    handleControllerButton(gamepad, btnIndex);
                }
            });
            
            // Check axes for significant movement
            gamepad.axes.forEach((axis, axisIndex) => {
                if (Math.abs(axis) > 0.9) {
                    handleControllerAxis(gamepad, axisIndex, axis > 0 ? '+' : '-');
                }
            });
        }
        
        // Only re-render if state changed or not skipping
        if (!skipNextRender && currentState !== lastDeviceState) {
            lastDeviceState = currentState;
            updateDevicesList();
        }
    }, 100); // Slowed to 100ms
}

function stopControllerPolling() {
    if (controllerPollInterval) {
        clearInterval(controllerPollInterval);
        controllerPollInterval = null;
    }
}

function handleControllerButton(gamepad, buttonIndex) {
    const deviceName = getShortDeviceName(gamepad.id);
    const inputId = `${deviceName}:BTN${buttonIndex}`;
    
    // If modal is open, capture this as the key
    const modal = document.getElementById('key-capture-modal');
    if (!modal.classList.contains('hidden')) {
        capturedKey = inputId;
        document.getElementById('captured-key').textContent = inputId;
        document.getElementById('captured-key').style.color = '#a78bfa';
        document.getElementById('btn-save-key').disabled = false;
    }
}

function handleControllerAxis(gamepad, axisIndex, direction) {
    const deviceName = getShortDeviceName(gamepad.id);
    const inputId = `${deviceName}:AXIS${axisIndex}${direction}`;
    
    // Could capture axes too if needed
}

function getShortDeviceName(fullId) {
    // Extract meaningful part of device ID
    // e.g., "Thrustmaster T.16000M (Vendor: 044f Product: b10a)" -> "T.16000M"
    const match = fullId.match(/^([^(]+)/);
    if (match) {
        return match[1].trim().replace(/\s+/g, '_').substring(0, 20);
    }
    return 'Device';
}

function updateDevicesList() {
    const list = document.getElementById('devices-list');
    const gamepads = navigator.getGamepads();
    
    let html = '';
    let deviceCount = 0;
    
    for (const gamepad of gamepads) {
        if (!gamepad) continue;
        deviceCount++;
        
        const enabled = isDeviceEnabled(gamepad.id);
        
        // Find pressed buttons
        const pressedButtons = [];
        gamepad.buttons.forEach((btn, idx) => {
            if (btn.pressed) pressedButtons.push(`B${idx}`);
        });
        
        // Find active axes (shows activity even if disabled)
        const activeAxes = [];
        gamepad.axes.forEach((axis, idx) => {
            if (Math.abs(axis) > 0.1) {
                activeAxes.push(`A${idx}:${axis.toFixed(1)}`);
            }
        });
        
        const activity = [...pressedButtons, ...activeAxes].join(', ') || 'idle';
        const statusClass = enabled ? 'enabled' : 'disabled';
        const hasActivity = pressedButtons.length > 0 || activeAxes.some(a => Math.abs(parseFloat(a.split(':')[1])) > 0.5);
        
        html += `
            <li class="device-item ${statusClass} ${hasActivity && !enabled ? 'noisy' : ''}">
                <div class="device-toggle" onclick="toggleDevice(${gamepad.index}); event.stopPropagation();">
                    <div class="toggle-switch ${enabled ? 'on' : 'off'}">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="device-info-block">
                    <div class="device-name">${gamepad.id}</div>
                    <div class="device-info">${gamepad.buttons.length} buttons, ${gamepad.axes.length} axes</div>
                </div>
                <div class="device-activity ${enabled ? '' : 'muted'}">${activity}</div>
            </li>
        `;
    }
    
    if (deviceCount === 0) {
        html = '<li class="device-item"><div class="device-name">No controllers detected</div><div class="device-info">Press a button on any controller</div></li>';
    }
    
    list.innerHTML = html;
}

// Moved to setupEventListeners for event delegation

async function loadStatus() {
    const statusEl = document.getElementById('conn-status');
    try {
        const res = await fetch(`${API_BASE}/api/debug/keysender`);
        const data = await res.json();
        
        if (statusEl) {
            statusEl.className = 'connection-status ' + (data.connected ? 'connected' : '');
            statusEl.title = data.connected ? 'Connected to MSFS' : 'Disconnected';
        }
        document.getElementById('keysender-mode').textContent = 
            `Mode: ${data.mode?.toUpperCase() || 'Unknown'}`;
    } catch (e) {
        if (statusEl) {
            statusEl.className = 'connection-status';
            statusEl.title = 'Connection Error';
        }
    }
}

async function loadKeymaps() {
    try {
        const res = await fetch(`${API_BASE}/api/keymaps`);
        const data = await res.json();
        keymaps = data.keymaps || data;
        renderCategories();
        log('Keymaps loaded', 'success');
    } catch (e) {
        log(`Failed to load keymaps: ${e.message}`, 'error');
    }
}

// ============================================
// EXPORT / IMPORT KEYMAPS
// ============================================

async function exportKeymaps() {
    try {
        // Always fetch fresh data from server before export
        const res = await fetch(`${API_BASE}/api/keymaps`);
        const data = await res.json();
        const freshKeymaps = data.keymaps || data;
        
        // Update local keymaps to match
        keymaps = freshKeymaps;
        
        // Create export data with metadata
        const exportData = {
            _exportInfo: {
                exportedAt: new Date().toISOString(),
                version: '1.4.0',
                source: 'SimGlass Keymap Editor'
            },
            ...freshKeymaps
        };
        
        // Create blob and download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `SimGlass-keymaps-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log('📤 Keymaps exported successfully', 'success');
    } catch (e) {
        log(`Export failed: ${e.message}`, 'error');
    }
}

async function importKeymaps(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        let importData;
        
        // Validate JSON parsing
        try {
            importData = JSON.parse(text);
        } catch (parseError) {
            log(`Invalid JSON file: ${parseError.message}`, 'error');
            event.target.value = '';
            return;
        }
        
        // Remove export metadata if present
        delete importData._exportInfo;
        
        // Validate structure
        const validationResult = validateKeymapStructure(importData);
        if (!validationResult.valid) {
            log(`Validation failed: ${validationResult.error}`, 'error');
            alert(`Import Validation Failed:\n\n${validationResult.error}`);
            event.target.value = '';
            return;
        }
        
        // Show validation summary and confirm import
        const summary = validationResult.summary;
        const confirmMsg = `Import Validation Passed ✓\n\n` +
            `Categories: ${summary.categoryCount}\n` +
            `Total Keymaps: ${summary.actionCount}\n` +
            `With Keys: ${summary.withKeys}\n` +
            `With Triggers: ${summary.withTriggers}\n\n` +
            `Categories found:\n${summary.categories.map(c => `  • ${c.name} (${c.count} items)`).join('\n')}\n\n` +
            `This will REPLACE your current keymaps. Continue?`;
        
        if (!confirm(confirmMsg)) {
            event.target.value = '';
            return;
        }
        
        // Send to server
        const res = await fetch(`${API_BASE}/api/keymaps/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importData)
        });
        
        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }
        
        // Reload keymaps
        await loadKeymaps();
        log(`📥 Imported ${summary.actionCount} keymaps from ${file.name}`, 'success');
        
    } catch (e) {
        log(`Import failed: ${e.message}`, 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

function validateKeymapStructure(data) {
    const errors = [];
    const summary = {
        categoryCount: 0,
        actionCount: 0,
        withKeys: 0,
        withTriggers: 0,
        categories: []
    };
    
    // Check if data is an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, error: 'File must contain a JSON object' };
    }
    
    // Get categories (exclude metadata keys)
    const categories = Object.entries(data).filter(([key]) => 
        !key.startsWith('_') && !['version', 'description'].includes(key)
    );
    
    if (categories.length === 0) {
        return { valid: false, error: 'No keymap categories found in file' };
    }
    
    // Validate each category
    for (const [catName, catData] of categories) {
        if (typeof catData !== 'object' || catData === null) {
            errors.push(`Category "${catName}" is not a valid object`);
            continue;
        }
        
        const actions = Object.entries(catData).filter(([key]) => !key.startsWith('_'));
        let catCount = 0;
        
        for (const [actionId, binding] of actions) {
            // Binding can be string (legacy) or object (v3.0+)
            if (typeof binding === 'string') {
                // Legacy format: just a key string
                catCount++;
                summary.actionCount++;
                if (binding) summary.withKeys++;
            } else if (typeof binding === 'object' && binding !== null) {
                // New format: { name, key, trigger, ... }
                catCount++;
                summary.actionCount++;
                if (binding.key) summary.withKeys++;
                if (binding.trigger) summary.withTriggers++;
            } else {
                errors.push(`Invalid binding in ${catName}.${actionId}`);
            }
        }
        
        summary.categoryCount++;
        summary.categories.push({ name: catName, count: catCount });
    }
    
    if (errors.length > 0) {
        return { valid: false, error: errors.join('\n') };
    }
    
    if (summary.actionCount === 0) {
        return { valid: false, error: 'No valid keymaps found in any category' };
    }
    
    return { valid: true, summary };
}

function renderCategories() {
    const container = document.getElementById('categories-container');
    container.innerHTML = '';
    
    // Filter out metadata
    const categories = Object.entries(keymaps).filter(([key]) => 
        !['version', 'description', '_comment'].includes(key)
    );
    
    categories.forEach(([category, actions]) => {
        if (typeof actions !== 'object') return;
        
        const actionEntries = Object.entries(actions).filter(([key]) => 
            !key.startsWith('_')
        );
        
        const categoryEl = document.createElement('div');
        categoryEl.className = 'category';
        categoryEl.innerHTML = `
            <div class="category-header" onclick="toggleCategory(this)">
                <h2>${formatCategoryName(category)}</h2>
                <div>
                    <span class="count">${actionEntries.length} keys</span>
                    <span class="toggle"></span>
                </div>
            </div>
            <div class="category-content">
                ${actionEntries.map(([id, binding]) => {
                    // v3.0 format: binding has name, key, trigger, isDefault
                    const name = binding.name || formatActionName(id);
                    const key = binding.key || '';
                    const trigger = binding.trigger || '';
                    const isDefault = binding.isDefault === true;
                    return `
                    <div class="keymap-item ${isDefault ? 'default' : 'custom'}" data-category="${category}" data-id="${id}">
                        <span class="keymap-name" onclick="renameKeymap('${category}', '${id}')" title="Click to rename">${name}</span>
                        <span class="keymap-key" onclick="editKey('${category}', '${id}', 'key')" title="MSFS Key">${key || '—'}</span>
                        <span class="keymap-trigger" onclick="editKey('${category}', '${id}', 'trigger')" title="Trigger">${trigger || '—'}</span>
                        <div class="keymap-actions">
                            <button class="btn btn-secondary btn-sm" onclick="testKey('${category}', '${id}')">Test</button>
                            ${!isDefault ? `<button class="btn btn-danger btn-sm" onclick="deleteKeymap('${category}', '${id}')" title="Delete">🗑️</button>` : ''}
                        </div>
                    </div>
                `}).join('')}
                <div class="keymap-add">
                    <button class="btn btn-success btn-sm" onclick="addKeymap('${category}')">+ Add New</button>
                </div>
            </div>
        `;
        container.appendChild(categoryEl);
    });
}

function formatCategoryName(name) {
    const icons = {
        camera: '📷',
        aircraft: '✈️',
        lights: '💡',
        views: '👁️',
        custom: '⚙️'
    };
    const icon = icons[name] || '🔧';
    return `${icon} ${name.charAt(0).toUpperCase() + name.slice(1)}`;
}

function formatActionName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function toggleCategory(header) {
    header.parentElement.classList.toggle('collapsed');
}

// Key editing
let editingField = 'key'; // 'key' or 'trigger'

function editKey(category, action, field = 'key') {
    editingCategory = category;
    editingAction = action;
    editingField = field;
    capturedKey = null;
    
    const fieldLabel = field === 'key' ? 'MSFS Key' : 'Trigger';
    const promptText = field === 'key' ? 'Press key...' : 'Press controller button...';
    document.getElementById('editing-key').textContent = `${formatActionName(action)} → ${fieldLabel}`;
    const hintEl = document.getElementById('modal-hint');
    if (hintEl) hintEl.textContent = promptText;
    document.getElementById('captured-key').textContent = promptText;
    document.getElementById('captured-key').style.color = '#94a3b8';
    document.getElementById('btn-save-key').disabled = true;
    document.getElementById('key-capture-modal').classList.remove('hidden');
    
    // Start controller polling for capture
    startControllerPolling();
}

function handleKeyCapture(e) {
    const modal = document.getElementById('key-capture-modal');
    if (modal.classList.contains('hidden')) return;
    
    e.preventDefault();
    
    // Build key string
    let parts = [];
    if (e.ctrlKey) parts.push('CTRL');
    if (e.shiftKey) parts.push('SHIFT');
    if (e.altKey) parts.push('ALT');
    
    const keyName = getKeyName(e.code, e.key);
    if (keyName && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(keyName);
    }
    
    if (parts.length > 0) {
        capturedKey = parts.join('+');
        document.getElementById('captured-key').textContent = capturedKey;
        document.getElementById('captured-key').style.color = '#4ade80';
        document.getElementById('btn-save-key').disabled = false;
    }
}

function getKeyName(code, key) {
    const codeMap = {
        'Backspace': 'BACKSPACE',
        'Tab': 'TAB',
        'Enter': 'ENTER',
        'Space': 'SPACE',
        'End': 'END',
        'Home': 'HOME',
        'ArrowLeft': 'LEFT',
        'ArrowUp': 'UP',
        'ArrowRight': 'RIGHT',
        'ArrowDown': 'DOWN',
        'Insert': 'INSERT',
        'Delete': 'DELETE',
        'PageUp': 'PAGEUP',
        'PageDown': 'PAGEDOWN',
        'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
        'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
        'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
        'Numpad0': 'NUMPAD0', 'Numpad1': 'NUMPAD1', 'Numpad2': 'NUMPAD2',
        'Numpad3': 'NUMPAD3', 'Numpad4': 'NUMPAD4', 'Numpad5': 'NUMPAD5',
        'Numpad6': 'NUMPAD6', 'Numpad7': 'NUMPAD7', 'Numpad8': 'NUMPAD8',
        'Numpad9': 'NUMPAD9',
        'NumpadAdd': '+', 'NumpadSubtract': '-',
        'NumpadMultiply': '*', 'NumpadDivide': '/',
        'Equal': '=', 'Minus': '-', 'Slash': '/'
    };
    
    if (codeMap[code]) return codeMap[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    
    return key.toUpperCase();
}

async function saveKey() {
    // Allow empty string (cleared value), but require category and action
    if (capturedKey === null || capturedKey === undefined || !editingCategory || !editingAction) return;
    
    // Validate: only keyboard keys allowed for 'key' field (skip validation for empty/cleared)
    if (capturedKey !== '') {
        const isControllerInput = capturedKey.includes(':BTN') || capturedKey.includes(':AXIS');
        if (editingField === 'key' && isControllerInput) {
            log(`❌ MSFS Key must be a keyboard key, not controller input`, 'error');
            return;
        }
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/keymaps/${editingCategory}/${editingAction}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                field: editingField,
                value: capturedKey 
            })
        });
        
        const data = await res.json();
        
        if (data.warning) {
            log(`⚠️ ${data.warning}`, 'error');
        }
        
        const fieldLabel = editingField === 'key' ? 'Key' : 'Trigger';
        const valueLabel = capturedKey === '' ? '(cleared)' : capturedKey;
        log(`Updated ${formatActionName(editingAction)} ${fieldLabel} = ${valueLabel}`, 'success');
        closeModal();
        loadKeymaps();
    } catch (e) {
        log(`Failed to save: ${e.message}`, 'error');
    }
}

function closeModal() {
    document.getElementById('key-capture-modal').classList.add('hidden');
    editingCategory = null;
    editingAction = null;
    editingField = 'key';
    capturedKey = null;
    
    // Stop controller polling if device panel is hidden
    if (!controllerScanActive) {
        stopControllerPolling();
    }
}

function clearKey() {
    // Set to empty string (not null) to allow saving cleared value
    capturedKey = '';
    const promptText = editingField === 'key' ? 'Press key...' : 'Press controller button...';
    document.getElementById('captured-key').textContent = promptText;
    document.getElementById('captured-key').style.color = '#94a3b8';
    document.getElementById('btn-save-key').disabled = false;
}

// ============================================
// ADD / DELETE / RENAME KEYMAPS
// ============================================

async function addKeymap(category) {
    const name = prompt('Enter name for new action:');
    if (!name || !name.trim()) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/keymaps/${category}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
        });
        const data = await res.json();
        
        if (data.success) {
            log(`✓ Added: ${name}`, 'success');
            loadKeymaps();
        } else {
            log(`✗ Failed to add: ${data.error}`, 'error');
        }
    } catch (e) {
        log(`✗ Error: ${e.message}`, 'error');
    }
}

async function deleteKeymap(category, id) {
    const binding = keymaps[category]?.[id];
    const name = binding?.name || id;
    
    if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/keymaps/${category}/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            log(`✓ Deleted: ${name}`, 'success');
            loadKeymaps();
        } else {
            log(`✗ Cannot delete: ${data.error}`, 'error');
        }
    } catch (e) {
        log(`✗ Error: ${e.message}`, 'error');
    }
}

async function renameKeymap(category, id) {
    const binding = keymaps[category]?.[id];
    const currentName = binding?.name || id;
    
    const newName = prompt('Enter new name:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/keymaps/${category}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        const data = await res.json();
        
        if (data.success) {
            log(`✓ Renamed: ${currentName} → ${newName}`, 'success');
            loadKeymaps();
        } else {
            log(`✗ Failed to rename: ${data.error}`, 'error');
        }
    } catch (e) {
        log(`✗ Error: ${e.message}`, 'error');
    }
}

// Testing
async function testKey(category, action) {
    const binding = keymaps[category]?.[action];
    if (!binding) {
        log(`No key mapped for ${category}.${action}`, 'error');
        return;
    }
    
    // Handle both old string format and new object format
    const key = typeof binding === 'object' ? binding.key : binding;
    if (!key) {
        log(`No MSFS key set for ${category}.${action}`, 'error');
        return;
    }
    
    log(`Testing ${category}.${action} → sending "${key}"...`, 'info');
    
    try {
        const res = await fetch(`${API_BASE}/api/sendkey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        const data = await res.json();
        
        if (data.success) {
            log(`✓ Sent: ${key}`, 'success');
        } else {
            log(`✗ Failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (e) {
        log(`✗ Test failed: ${e.message}`, 'error');
    }
}

function testSelected() {
    const selected = document.querySelector('.keymap-item.selected');
    if (selected) {
        const category = selected.dataset.category;
        const action = selected.dataset.action;
        testKey(category, action);
    } else {
        log('No key selected. Click a key first.', 'info');
    }
}

// Conflicts
async function checkConflicts() {
    try {
        const res = await fetch(`${API_BASE}/api/keymaps/conflicts`);
        const data = await res.json();
        
        const panel = document.getElementById('conflicts-panel');
        const list = document.getElementById('conflicts-list');
        
        if (data.conflicts && data.conflicts.length > 0) {
            list.innerHTML = data.conflicts.map(c => 
                `<li><strong>${c.key}</strong>: ${c.usages.map(u => `${u.category}.${u.action}`).join(', ')}</li>`
            ).join('');
            panel.classList.remove('hidden');
            log(`Found ${data.conflicts.length} conflict(s)`, 'error');
            
            // Highlight conflicting items
            document.querySelectorAll('.keymap-item').forEach(item => {
                item.classList.remove('conflict');
                const key = item.querySelector('.keymap-key').textContent;
                if (data.conflicts.some(c => c.key === key)) {
                    item.classList.add('conflict');
                }
            });
        } else {
            panel.classList.add('hidden');
            log('No conflicts found ✓', 'success');
            document.querySelectorAll('.keymap-item').forEach(item => {
                item.classList.remove('conflict');
            });
        }
    } catch (e) {
        log(`Failed to check conflicts: ${e.message}`, 'error');
    }
}

// Logging
function log(message, type = 'info') {
    const logEl = document.getElementById('test-log');
    const entry = document.createElement('div');
    entry.className = `test-log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEl.insertBefore(entry, logEl.firstChild);
    
    // Keep max 50 entries
    while (logEl.children.length > 50) {
        logEl.removeChild(logEl.lastChild);
    }
}

// Selection
document.addEventListener('click', (e) => {
    const item = e.target.closest('.keymap-item');
    if (item && !e.target.closest('button') && !e.target.classList.contains('keymap-key')) {
        document.querySelectorAll('.keymap-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedItem = item;
    }
});
