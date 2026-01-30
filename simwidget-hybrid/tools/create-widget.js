#!/usr/bin/env node
/**
 * SimWidget CLI - Widget Scaffolding Tool v2.0.0
 *
 * Creates new widget boilerplate with standard structure using shared components
 *
 * Usage: node create-widget.js <widget-name> [options]
 *
 * Types:
 *   simple   - Basic widget with minimal features (default)
 *   data     - Data display widget with grid layout
 *   canvas   - Canvas-based visualization widget
 *   control  - Control panel with buttons and toggles
 *   full     - Full-featured widget with all options
 *
 * Options:
 *   --type <type>       Widget archetype (simple|data|canvas|control|full)
 *   --title "Title"     Widget display title
 *   --icon "emoji"      Header icon/emoji
 *   --category <cat>    Category (flight|nav|util|ai|system)
 *   --canvas            Include canvas element
 *   --sync              Include BroadcastChannel for cross-widget sync
 *   --telemetry         Include telemetry integration
 *   --manifest          Generate plugin manifest.json
 *   --no-websocket      Disable WebSocket connection
 *   --no-settings       Disable settings panel
 *   --no-themes         Disable theme support
 *
 * Examples:
 *   node create-widget.js fuel-monitor --type data --icon "⛽"
 *   node create-widget.js terrain-view --type canvas --sync
 *   node create-widget.js quick-actions --type control --category flight
 *   node create-widget.js my-plugin --type full --manifest
 *
 * Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\create-widget.js
 * Last Updated: 2025-01-29
 */

const fs = require('fs');
const path = require('path');

// ============================================
// ARGUMENT PARSING
// ============================================

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
SimWidget CLI - Widget Scaffolding Tool v2.0.0

Usage: node create-widget.js <widget-name> [options]

Widget Types:
  simple     Basic widget with minimal features (default)
  data       Data display widget with grid layout for flight data
  canvas     Canvas-based visualization (maps, gauges, graphs)
  control    Control panel with buttons, toggles, sliders
  full       Full-featured widget with all options enabled

Options:
  --type <type>       Widget archetype (simple|data|canvas|control|full)
  --title "Title"     Widget display title (default: derived from name)
  --icon "emoji"      Header icon/emoji (default: based on category)
  --category <cat>    Category: flight, nav, util, ai, system (default: util)
  --canvas            Include canvas element for drawing
  --sync              Include BroadcastChannel for cross-widget communication
  --telemetry         Include telemetry/analytics integration
  --manifest          Generate plugin manifest.json for plugin system
  --no-websocket      Disable WebSocket connection (enabled by default)
  --no-settings       Disable settings panel (enabled by default)
  --no-themes         Disable theme support (enabled by default)

Examples:
  node create-widget.js fuel-monitor --type data --icon "⛽" --category flight
  node create-widget.js terrain-radar --type canvas --sync
  node create-widget.js quick-actions --type control --category flight
  node create-widget.js awesome-plugin --type full --manifest --telemetry

Generated Structure:
  ui/<widget-name>/
  ├── index.html      Entry point with shared CSS/JS
  ├── styles.css      Widget-specific styles
  ├── widget.js       Widget class extending SimWidgetBase
  └── manifest.json   Plugin manifest (if --manifest)

Access at: http://localhost:8080/ui/<widget-name>/
    `);
    process.exit(0);
}

// Parse widget name
const widgetName = args[0];
if (widgetName.startsWith('--')) {
    console.error('Error: Widget name required as first argument');
    process.exit(1);
}
const widgetSlug = widgetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Parse options
function getOption(flag, defaultVal = null) {
    const idx = args.indexOf(flag);
    if (idx === -1) return defaultVal;
    if (flag.startsWith('--no-')) return false;
    const nextArg = args[idx + 1];
    if (!nextArg || nextArg.startsWith('--')) return true;
    return nextArg;
}

function hasFlag(flag) {
    return args.includes(flag);
}

// Category icons
const categoryIcons = {
    flight: '✈️',
    nav: '🧭',
    util: '🔧',
    ai: '🤖',
    system: '⚙️'
};

// Build options
const widgetType = getOption('--type', 'simple');
const category = getOption('--category', 'util');

const options = {
    type: widgetType,
    title: getOption('--title') || widgetName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    icon: getOption('--icon') || categoryIcons[category] || '📦',
    category: category,
    // Features (defaults based on type)
    websocket: !hasFlag('--no-websocket'),
    settings: !hasFlag('--no-settings'),
    themes: !hasFlag('--no-themes'),
    canvas: hasFlag('--canvas') || widgetType === 'canvas',
    sync: hasFlag('--sync') || widgetType === 'full',
    telemetry: hasFlag('--telemetry') || widgetType === 'full',
    manifest: hasFlag('--manifest')
};

// Full type enables everything
if (widgetType === 'full') {
    options.canvas = true;
    options.sync = true;
    options.telemetry = true;
    options.manifest = true;
}

const uiDir = path.join(__dirname, '..', 'ui', widgetSlug);

// Check if exists
if (fs.existsSync(uiDir)) {
    console.error(`Error: Widget "${widgetSlug}" already exists at ${uiDir}`);
    process.exit(1);
}

// Create directory
fs.mkdirSync(uiDir, { recursive: true });

// Generate files
const htmlContent = generateHTML(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'index.html'), htmlContent);

const cssContent = generateCSS(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'styles.css'), cssContent);

const jsContent = generateJS(widgetSlug, options);
fs.writeFileSync(path.join(uiDir, 'widget.js'), jsContent);

if (options.manifest) {
    const manifestContent = generateManifest(widgetSlug, options);
    fs.writeFileSync(path.join(uiDir, 'manifest.json'), manifestContent);
}

// Output summary
console.log(`
✅ Widget "${options.title}" created successfully!

📁 ui/${widgetSlug}/
   ├── index.html      ${options.themes ? '(with themes)' : ''}
   ├── styles.css
   ├── widget.js       ${options.type === 'simple' ? '' : `(${options.type} template)`}
   ${options.manifest ? '└── manifest.json   (plugin ready)' : ''}

Features:
   ${options.websocket ? '✅' : '❌'} WebSocket real-time data
   ${options.settings ? '✅' : '❌'} Settings panel
   ${options.themes ? '✅' : '❌'} Theme support (8 themes)
   ${options.canvas ? '✅' : '❌'} Canvas rendering
   ${options.sync ? '✅' : '❌'} Cross-widget sync
   ${options.telemetry ? '✅' : '❌'} Telemetry

Type: ${options.type} | Category: ${options.category}

🌐 Access at: http://localhost:8080/ui/${widgetSlug}/
`);

// ============================================
// HTML GENERATOR
// ============================================

function generateHTML(slug, opts) {
    const canvasSection = opts.canvas ? `
            <!-- Canvas Section -->
            <div class="canvas-container">
                <canvas id="main-canvas"></canvas>
            </div>` : '';

    const dataSection = opts.type === 'data' || opts.type === 'full' ? `
            <!-- Data Display -->
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Value 1</span>
                    <span class="data-value" id="data-val1">--</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Value 2</span>
                    <span class="data-value" id="data-val2">--</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Value 3</span>
                    <span class="data-value" id="data-val3">--</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Value 4</span>
                    <span class="data-value" id="data-val4">--</span>
                </div>
            </div>` : '';

    const controlSection = opts.type === 'control' || opts.type === 'full' ? `
            <!-- Control Buttons -->
            <div class="section">
                <div class="section-title">Controls</div>
                <div class="button-grid">
                    <button class="control-btn toggle-btn" data-cmd="ACTION_1">
                        <div class="status-led off"></div>
                        <span>BTN 1</span>
                    </button>
                    <button class="control-btn toggle-btn" data-cmd="ACTION_2">
                        <div class="status-led off"></div>
                        <span>BTN 2</span>
                    </button>
                    <button class="control-btn toggle-btn" data-cmd="ACTION_3">
                        <div class="status-led off"></div>
                        <span>BTN 3</span>
                    </button>
                    <button class="control-btn toggle-btn" data-cmd="ACTION_4">
                        <div class="status-led off"></div>
                        <span>BTN 4</span>
                    </button>
                </div>
            </div>` : '';

    const contentSection = opts.type === 'simple' ? `
            <!-- Content Area -->
            <div class="content-area">
                <p class="placeholder-text">Widget content goes here</p>
            </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${opts.title} - SimWidget</title>
    <!-- Shared Styles -->
    <link rel="stylesheet" href="/ui/shared/widget-common.css">
    ${opts.themes ? '<link rel="stylesheet" href="/ui/shared/themes.css">' : ''}
    ${opts.settings ? '<link rel="stylesheet" href="/ui/shared/settings-panel.css">' : ''}
    <link rel="stylesheet" href="/ui/shared/widget-customizer.css">
    <link rel="stylesheet" href="/ui/shared/responsive.css">
    <!-- Widget Styles -->
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Settings Button -->
    ${opts.settings ? '<button class="settings-btn" id="settings-btn" title="Settings">&#9881;</button>' : ''}

    <div class="widget-container" id="widget-root">
        <!-- Header -->
        <div class="widget-header">
            <span class="widget-title">${opts.icon} ${opts.title}</span>
            <div class="header-controls">
                <span class="connection-status" id="conn-status" title="Connection status"></span>
            </div>
        </div>
${canvasSection}
${dataSection}
${controlSection}
${contentSection}
        <!-- Actions -->
        <div class="actions-row">
            <button class="btn btn-primary" id="btn-primary">Primary Action</button>
        </div>

        <!-- Footer -->
        <div class="widget-footer">
            <span class="widget-version">v1.0.0</span>
        </div>
    </div>

    <!-- Shared Scripts -->
    ${opts.telemetry ? '<script src="/ui/shared/telemetry.js"></script>' : ''}
    ${opts.settings ? '<script src="/ui/shared/settings-panel.js"></script>' : ''}
    ${opts.themes ? '<script src="/ui/shared/theme-switcher.js"></script>' : ''}
    <script src="/ui/shared/widget-customizer.js"></script>
    <script src="/ui/shared/widget-base.js"></script>
    <!-- Widget Script -->
    <script src="widget.js"></script>
    <script>
        // Initialize widget
        window.widget = new ${toPascalCase(slug)}Widget();
        ${opts.settings ? `
        // Settings panel
        const settings = new SettingsPanel();
        ${opts.themes ? 'settings.registerThemeSection();' : ''}
        const customizer = new WidgetCustomizer({ widgetId: '${slug}', settingsPanel: settings });
        document.getElementById('settings-btn')?.addEventListener('click', () => settings.toggle());` : ''}
    </script>
</body>
</html>
`;
}

// ============================================
// CSS GENERATOR
// ============================================

function generateCSS(slug, opts) {
    const date = new Date().toISOString().split('T')[0];

    const canvasCSS = opts.canvas ? `
/* Canvas */
.canvas-container {
    position: relative;
    width: 100%;
    height: 200px;
    background: var(--bg-tertiary, #0a1520);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
}

#main-canvas {
    width: 100%;
    height: 100%;
}
` : '';

    const dataCSS = opts.type === 'data' || opts.type === 'full' ? `
/* Data Grid */
.data-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
}

.data-item {
    background: var(--bg-secondary, rgba(255,255,255,0.05));
    border-radius: 8px;
    padding: 12px;
    text-align: center;
}

.data-label {
    display: block;
    font-size: 11px;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    margin-bottom: 4px;
}

.data-value {
    display: block;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    font-family: var(--font-data, 'B612 Mono', 'Roboto Mono', monospace);
}

.data-value.highlight-green { color: var(--color-success, #00ff00); }
.data-value.highlight-yellow { color: var(--color-warning, #ffcc00); }
.data-value.highlight-red { color: var(--color-danger, #ff4444); }
.data-value.highlight-cyan { color: var(--color-info, #00d4ff); }
` : '';

    const controlCSS = opts.type === 'control' || opts.type === 'full' ? `
/* Control Buttons */
.section {
    margin-bottom: 16px;
}

.section-title {
    font-size: 12px;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-color, #333);
}

.button-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.control-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--bg-secondary, rgba(255,255,255,0.08));
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
}

.control-btn:hover {
    background: var(--bg-hover, rgba(255,255,255,0.12));
    border-color: var(--accent-color, #4a9eff);
}

.control-btn:active {
    transform: scale(0.96);
}

.control-btn.active {
    background: var(--accent-color, #4a9eff);
    border-color: var(--accent-color, #4a9eff);
}

.status-led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #444;
    transition: all 0.2s;
}

.status-led.on {
    background: #00ff00;
    box-shadow: 0 0 6px #00ff00;
}

.status-led.warning {
    background: #ffcc00;
    box-shadow: 0 0 6px #ffcc00;
}
` : '';

    return `/**
 * ${opts.title} Widget Styles
 * Type: ${opts.type} | Category: ${opts.category}
 * Path: ui/${slug}/styles.css
 * Last Updated: ${date}
 */

/* Widget-specific styles - extends widget-common.css */

.widget-container {
    max-width: 400px;
    margin: 0 auto;
    padding: 16px;
}

/* Content Area */
.content-area {
    background: var(--bg-secondary, rgba(255,255,255,0.05));
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 16px;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.placeholder-text {
    color: var(--text-muted, #666);
    font-size: 14px;
}
${canvasCSS}
${dataCSS}
${controlCSS}
/* Actions Row */
.actions-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

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

.btn-primary {
    background: var(--accent-color, #4a9eff);
    color: white;
}

.btn-primary:hover {
    background: var(--accent-hover, #3a8eef);
}

.btn-secondary {
    background: var(--bg-secondary, rgba(255,255,255,0.1));
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #333);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Footer */
.widget-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--text-muted, #666);
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #222);
}

/* Responsive */
@media (max-width: 480px) {
    .widget-container {
        padding: 12px;
    }

    .button-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .data-grid {
        grid-template-columns: 1fr;
    }
}
`;
}

// ============================================
// JAVASCRIPT GENERATOR
// ============================================

function generateJS(slug, opts) {
    const date = new Date().toISOString().split('T')[0];
    const className = toPascalCase(slug);

    const syncCode = opts.sync ? `
        // Cross-widget sync channel
        this.syncChannel = new BroadcastChannel('simwidget-sync');
        this.initSyncListener();` : '';

    const syncMethods = opts.sync ? `
    /**
     * Initialize cross-widget sync listener
     */
    initSyncListener() {
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;
            this.handleSyncMessage(type, data);
        };
    }

    /**
     * Handle incoming sync messages from other widgets
     */
    handleSyncMessage(type, data) {
        switch (type) {
            case 'route-update':
                console.log('[${className}] Route updated:', data);
                break;
            case 'waypoint-select':
                console.log('[${className}] Waypoint selected:', data);
                break;
            default:
                // Ignore unknown message types
        }
    }

    /**
     * Broadcast message to other widgets
     */
    broadcastSync(type, data) {
        this.syncChannel.postMessage({ type, data });
    }
` : '';

    const canvasCode = opts.canvas ? `
        // Canvas setup
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this.setupCanvas();
        this.startRenderLoop();` : '';

    const canvasMethods = opts.canvas ? `
    /**
     * Setup canvas dimensions
     */
    setupCanvas() {
        if (!this.canvas) return;
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        };
        resize();
        window.addEventListener('resize', resize);
    }

    /**
     * Start canvas render loop
     */
    startRenderLoop() {
        const render = () => {
            this.renderCanvas();
            requestAnimationFrame(render);
        };
        render();
    }

    /**
     * Render canvas content
     */
    renderCanvas() {
        if (!this.ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        this.ctx.fillStyle = '#0a1520';
        this.ctx.fillRect(0, 0, w, h);

        // TODO: Add your canvas rendering here

        // Example: Draw center crosshair
        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath();
        this.ctx.moveTo(w/2, 0);
        this.ctx.lineTo(w/2, h);
        this.ctx.moveTo(0, h/2);
        this.ctx.lineTo(w, h/2);
        this.ctx.stroke();

        // Example: Draw data text
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '14px Consolas, monospace';
        this.ctx.fillText(\`ALT: \${this.data.altitude || 0}\`, 10, 20);
    }
` : '';

    const controlCode = opts.type === 'control' || opts.type === 'full' ? `
        // Setup control buttons
        this.setupControlButtons();` : '';

    const controlMethods = opts.type === 'control' || opts.type === 'full' ? `
    /**
     * Setup control button handlers
     */
    setupControlButtons() {
        document.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.sendCommand(cmd);

                // Visual feedback
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 150);
            });
        });
    }

    /**
     * Update button LED states based on flight data
     */
    updateButtonStates() {
        // Example: Update LED states based on this.data
        // document.querySelector('[data-cmd="GEAR_TOGGLE"] .status-led')
        //     ?.classList.toggle('on', this.data.gearDown);
    }
` : '';

    const dataCode = opts.type === 'data' || opts.type === 'full' ? `
    /**
     * Update data display elements
     */
    updateDataDisplay() {
        // Update data value elements
        this.setElement('data-val1', this.formatNumber(this.data.altitude, 0) + ' ft');
        this.setElement('data-val2', this.formatNumber(this.data.speed, 0) + ' kts');
        this.setElement('data-val3', this.formatHeading(this.data.heading));
        this.setElement('data-val4', this.formatNumber(this.data.verticalSpeed, 0) + ' fpm');
    }

    /**
     * Set element text content safely
     */
    setElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /**
     * Format number with decimals
     */
    formatNumber(value, decimals = 0) {
        if (value === undefined || value === null) return '--';
        return Number(value).toFixed(decimals);
    }

    /**
     * Format heading with leading zeros
     */
    formatHeading(hdg) {
        if (hdg === undefined || hdg === null) return '---°';
        return Math.round(hdg).toString().padStart(3, '0') + '°';
    }
` : '';

    return `/**
 * ${opts.title} Widget v1.0.0
 * Type: ${opts.type} | Category: ${opts.category}
 *
 * Extends SimWidgetBase for WebSocket connection and shared functionality.
 *
 * Path: ui/${slug}/widget.js
 * Last Updated: ${date}
 */

class ${className}Widget extends SimWidgetBase {
    constructor() {
        super({
            widgetName: '${slug}',
            widgetVersion: '1.0.0',
            autoConnect: ${opts.websocket}
        });

        // Widget state
        this.data = {
            altitude: 0,
            speed: 0,
            heading: 0,
            verticalSpeed: 0
        };
${syncCode}
${canvasCode}
${controlCode}
        // Initialize
        this.init();
    }

    /**
     * Initialize widget
     */
    init() {
        console.log('[${className}] Initialized');
        this.bindEvents();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Primary action button
        document.getElementById('btn-primary')?.addEventListener('click', () => {
            this.handlePrimaryAction();
        });
    }

    /**
     * Handle primary action button click
     */
    handlePrimaryAction() {
        console.log('[${className}] Primary action triggered');
        // TODO: Implement your action
    }

    // ============================================
    // WEBSOCKET HANDLERS (override SimWidgetBase)
    // ============================================

    /**
     * Called when WebSocket connects
     */
    onConnect() {
        console.log('[${className}] Connected to server');
    }

    /**
     * Called when WebSocket disconnects
     */
    onDisconnect() {
        console.log('[${className}] Disconnected from server');
    }

    /**
     * Handle incoming WebSocket messages
     */
    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.updateFlightData(msg.data);
        }
    }

    /**
     * Update local flight data from server
     */
    updateFlightData(data) {
        // Map incoming data to local state
        if (data.altitude !== undefined) this.data.altitude = data.altitude;
        if (data.altitudeMSL !== undefined) this.data.altitude = data.altitudeMSL;
        if (data.speed !== undefined) this.data.speed = data.speed;
        if (data.airspeedIndicated !== undefined) this.data.speed = data.airspeedIndicated;
        if (data.heading !== undefined) this.data.heading = data.heading;
        if (data.verticalSpeed !== undefined) this.data.verticalSpeed = data.verticalSpeed;

        // Update UI
        this.updateUI();
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        ${opts.type === 'data' || opts.type === 'full' ? 'this.updateDataDisplay();' : '// TODO: Update your UI elements'}
        ${opts.type === 'control' || opts.type === 'full' ? 'this.updateButtonStates();' : ''}
    }
${dataCode}
${controlMethods}
${canvasMethods}
${syncMethods}
    // ============================================
    // API METHODS
    // ============================================

    /**
     * Send SimConnect command via HTTP API
     */
    async sendHttpCommand(command, value = 0) {
        try {
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, value })
            });
            return await response.json();
        } catch (error) {
            console.error('[${className}] Command error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ${className}Widget;
}
`;
}

// ============================================
// MANIFEST GENERATOR
// ============================================

function generateManifest(slug, opts) {
    const manifest = {
        id: slug,
        name: opts.title,
        version: '1.0.0',
        description: `${opts.title} widget for SimWidget`,
        author: 'SimWidget User',
        category: opts.category,
        entry: 'index.html',
        icon: opts.icon,
        minWidth: 320,
        minHeight: 400,
        resizable: true,
        transparent: true,
        simVars: [
            'PLANE ALTITUDE',
            'AIRSPEED INDICATED',
            'PLANE HEADING DEGREES TRUE',
            'VERTICAL SPEED'
        ],
        commands: [],
        settings: []
    };

    return JSON.stringify(manifest, null, 2);
}

// ============================================
// UTILITIES
// ============================================

function toPascalCase(str) {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}
