#!/usr/bin/env node
/**
 * SimWidget CLI - Widget Scaffolding Tool v1.0.0
 * 
 * Creates new widget boilerplate with standard structure
 * 
 * Usage: node create-widget.js <widget-name> [options]
 * 
 * Options:
 *   --title "Custom Title"  - Widget display title
 *   --icon "🎯"            - Header icon/emoji
 *   --websocket            - Include WebSocket connection
 *   --settings             - Include settings panel
 *   --no-transparency      - Disable transparency toggle
 * 
 * Example:
 *   node create-widget.js weather-radar --title "Weather Radar" --icon "🌦️" --websocket
 * 
 * Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\create-widget.js
 * Last Updated: 2025-01-07
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
SimWidget CLI - Widget Scaffolding Tool v1.0.0

Usage: node create-widget.js <widget-name> [options]

Options:
  --title "Title"     Widget display title (default: derived from name)
  --icon "🎯"         Header icon/emoji (default: 📦)
  --websocket         Include WebSocket connection for live data
  --settings          Include settings panel boilerplate
  --no-transparency   Disable transparency toggle feature

Examples:
  node create-widget.js nav-display
  node create-widget.js weather-radar --title "Weather Radar" --icon "🌦️" --websocket
  node create-widget.js checklist --title "Checklist" --icon "✅" --settings
    `);
    process.exit(0);
}

const widgetName = args[0];
const widgetSlug = widgetName.toLowerCase().replace(/\s+/g, '-');

// Parse options
function getOption(flag, defaultVal = null) {
    const idx = args.indexOf(flag);
    if (idx === -1) return defaultVal;
    if (flag.startsWith('--no-')) return false;
    const nextArg = args[idx + 1];
    if (!nextArg || nextArg.startsWith('--')) return true;
    return nextArg;
}

const options = {
    title: getOption('--title') || widgetName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    icon: getOption('--icon') || '📦',
    websocket: args.includes('--websocket'),
    settings: args.includes('--settings'),
    transparency: !args.includes('--no-transparency')
};

const uiDir = path.join(__dirname, '..', 'ui', widgetSlug);

// Check if exists
if (fs.existsSync(uiDir)) {
    console.error(`❌ Widget "${widgetSlug}" already exists at ${uiDir}`);
    process.exit(1);
}

// Create directory
fs.mkdirSync(uiDir, { recursive: true });

// Generate files
const htmlContent = generateHTML(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'index.html'), htmlContent);

const cssContent = generateCSS(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'widget.css'), cssContent);

const jsContent = generateJS(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'widget.js'), jsContent);

console.log(`
✅ Widget "${options.title}" created successfully!

Files created:
  📁 ui/${widgetSlug}/
     ├── index.html
     ├── widget.css
     └── widget.js

Features enabled:
  ${options.transparency ? '✅' : '❌'} Transparency toggle
  ${options.websocket ? '✅' : '❌'} WebSocket connection
  ${options.settings ? '✅' : '❌'} Settings panel

Access at: http://localhost:8080/ui/${widgetSlug}/
`);

// ============================================
// TEMPLATE GENERATORS
// ============================================

function generateHTML(slug, opts) {
    const settingsPanel = opts.settings ? `
        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-header">
                <h2>Settings</h2>
                <button id="btn-close-settings" class="btn-icon">✕</button>
            </div>
            <div class="settings-content">
                <div class="setting-row">
                    <label>Option 1</label>
                    <input type="checkbox" id="setting-option1">
                </div>
            </div>
        </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SimWidget - ${opts.title}</title>
    <link rel="stylesheet" href="widget.css">
</head>
<body>
    <div class="widget-container">
        <div class="widget-header">
            <h1>${opts.icon} ${opts.title}</h1>
            <div class="header-controls">
${opts.transparency ? '                <button id="btn-transparency" class="btn-icon" title="Toggle Transparency">👁</button>' : ''}
${opts.settings ? '                <button id="btn-settings" class="btn-icon" title="Settings">⚙️</button>' : ''}
            </div>
        </div>

        <div class="content-section">
            <div class="placeholder">
                <p>Widget content area</p>
${opts.websocket ? '                <div class="connection-status" id="conn-status">Disconnected</div>' : ''}
            </div>
        </div>

        <div class="actions-section">
            <button id="btn-action" class="btn btn-primary">Action</button>
        </div>
${settingsPanel}
    </div>
    <script src="widget.js"></script>
</body>
</html>
`;
}

function generateCSS(slug, opts) {
    const date = new Date().toISOString().split('T')[0];
    return `/* ${opts.title} Widget v1.0.0 */
/* Last Updated: ${date} */
/* Path: ui/${slug}/widget.css */

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    min-height: 100vh;
}

body.transparent { background: rgba(26, 26, 46, 0.5); }

.widget-container { max-width: 400px; margin: 0 auto; padding: 16px; }

.widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #333;
}

.widget-header h1 { font-size: 18px; font-weight: 600; color: #fff; }

.header-controls { display: flex; gap: 8px; }

.btn-icon {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
}
.btn-icon:hover { opacity: 1; }

.content-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.placeholder { text-align: center; color: #888; padding: 32px; }

.connection-status {
    margin-top: 12px;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    display: inline-block;
    background: #ff4444;
}
.connection-status.connected { background: #44aa44; }

.actions-section { display: flex; gap: 8px; }

.btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary { background: #4a9eff; color: white; }
.btn-primary:hover { background: #3a8eef; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.settings-panel {
    position: fixed;
    top: 0; right: 0;
    width: 300px; height: 100%;
    background: #1a1a2e;
    border-left: 1px solid #333;
    padding: 16px;
    transform: translateX(0);
    transition: transform 0.3s;
    z-index: 100;
}
.settings-panel.hidden { transform: translateX(100%); }

.settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #333;
}
.settings-header h2 { font-size: 16px; }

.setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #222;
}
.setting-row label { color: #aaa; }

.hidden { display: none !important; }
`;
}

function generateJS(slug, opts) {
    const date = new Date().toISOString().split('T')[0];
    
    const wsCode = opts.websocket ? `
// ============================================
// WEBSOCKET CONNECTION
// ============================================

const WS_URL = 'ws://localhost:8080';
let ws = null;
let reconnectTimer = null;

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        scheduleReconnect();
    };
    
    ws.onerror = (err) => console.error('WebSocket error:', err);
    
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch (e) {
            console.error('Parse error:', e);
        }
    };
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
    }, 3000);
}

function updateConnectionStatus(connected) {
    const el = document.getElementById('conn-status');
    if (el) {
        el.textContent = connected ? 'Connected' : 'Disconnected';
        el.classList.toggle('connected', connected);
    }
}

function handleMessage(msg) {
    if (msg.type === 'flightData') {
        updateDisplay(msg.data);
    }
}

function updateDisplay(data) {
    // TODO: Update widget display with flight data
    console.log('Flight data:', data);
}
` : '';

    const transparencyCode = opts.transparency ? `
    // Transparency toggle
    document.getElementById('btn-transparency')?.addEventListener('click', () => {
        document.body.classList.toggle('transparent');
        localStorage.setItem('${slug}-transparent', document.body.classList.contains('transparent'));
    });
    if (localStorage.getItem('${slug}-transparent') === 'true') {
        document.body.classList.add('transparent');
    }` : '';

    const settingsCode = opts.settings ? `
    // Settings panel
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        document.getElementById('settings-panel').classList.remove('hidden');
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        document.getElementById('settings-panel').classList.add('hidden');
    });` : '';

    return `/**
 * SimWidget ${opts.title} v1.0.0
 * Path: C:\\DevOSWE\\simwidget-hybrid\\ui\\${slug}\\widget.js
 * Last Updated: ${date}
 */

const API_BASE = 'http://localhost:8080';
${wsCode}
// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('${opts.title} widget initialized');
    ${opts.websocket ? 'connectWebSocket();' : ''}
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-action')?.addEventListener('click', handleAction);
${transparencyCode}
${settingsCode}
}

// ============================================
// ACTIONS
// ============================================

function handleAction() {
    console.log('Action triggered');
    // TODO: Implement action
}

// ============================================
// API CALLS
// ============================================

async function sendCommand(command, value = 0) {
    try {
        const res = await fetch(\`\${API_BASE}/api/command\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, value })
        });
        return await res.json();
    } catch (e) {
        console.error('Command error:', e);
        return { success: false, error: e.message };
    }
}

async function sendKey(key) {
    try {
        const res = await fetch(\`\${API_BASE}/api/sendkey\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        return await res.json();
    } catch (e) {
        console.error('Key send error:', e);
        return { success: false, error: e.message };
    }
}
`;
}
