/**
 * SimGlass Backend Server v1.9.0
 * 
 * Bridges SimConnect to browser/toolbar panel via WebSocket
 * 
 * Features:
 * - WebSocket server for real-time flight data
 * - REST API for commands
 * - Serves shared UI for browser development
 * - SimConnect integration for MSFS 2024
 * - Configurable camera control system
 * - WASM cinematic camera support
 * 
 * Changelog:
 * v1.13.0 - Added radio frequency API (COM1/2, NAV1/2, ADF, transponder)
 * v1.12.0 - Added Phase 6 widgets to command center index
 * v1.11.0 - Added plugin system with discovery and management
 * v1.10.0 - Added /api/logs/:service endpoint for log viewing
 * v1.9.0 - Added Services Panel widget and /api/services endpoint
 * v1.8.0 - Added WASM cinematic camera API
 * v1.7.0 - Flight Recorder position playback via slew mode
 * v1.6.0 - Added Flight Recorder widget
 * v1.5.0 - Added Voice Control widget
 * v1.4.0 - Added debug API, keymap management, version tracking
 * v1.3.0 - Switched to configurable keymaps, removed ChasePlane
 * v1.2.0 - Fixed MSFS 2024 camera keybindings
 * v1.1.0 - Added camera system integration
 * v1.0.0 - Initial server with SimConnect
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const serveIndex = require('serve-index');
const CameraController = require('./camera-controller');
const { executeCamera, checkVJoy, isCameraCommand } = require('./vjoy-camera');
const TroubleshootEngine = require('../../Admin/shared/troubleshoot-engine');
const cameraSystem = require('./camera-system');
const { HotReloadManager } = require('./hot-reload');
const PluginLoader = require('./plugin-system/plugin-loader');
const PluginAPI = require('./plugin-system/plugin-api');
const { setupWeatherRoutes } = require('./weather-api');
const { setupCopilotRoutes } = require('./copilot-api');
const { setupAiPilotRoutes } = require('./ai-pilot-api');
const { setupNavdataRoutes } = require('./navdata-api');
const LittleNavMapAPI = require('./littlenavmap-api');
const RuleEngineServer = require('./ai-autopilot/rule-engine-server');
const usageMetrics = require('../../Admin/shared/usage-metrics');

// Hot reload manager (development only)
const hotReloadManager = new HotReloadManager();

// Plugin system
const pluginsDir = path.join(__dirname, '../plugins');
const pluginLoader = new PluginLoader(pluginsDir);
const pluginAPI = new PluginAPI();

// Little Navmap integration
const littleNavMapAPI = new LittleNavMapAPI();

const SERVER_VERSION = '1.14.0';

// SimConnect - will be loaded dynamically
let simConnect = null;
let simConnectConnection = null;
let isSimConnected = false;

// SimConnect reconnection with exponential backoff
let simConnectRetryTimeout = null;
let simConnectRetryDelay = 2000;
const SC_RETRY_MIN = 2000;
const SC_RETRY_MAX = 60000;
const SC_RETRY_MULTIPLIER = 1.5;
let simConnectRetryCount = 0;
let mockDataInterval = null;
let mockDataSuppressed = false;

// Fuel write data definition IDs (set during SimConnect init)
let fuelWriteDefId = null;
let fuelWriteDefIdRight = null;

// Camera controller (handles ChasePlane detection)
const cameraController = new CameraController();

// AHK helper status checker (static command, no user input)
async function getAhkHelperStatus() {
    return new Promise((resolve) => {
        exec('tasklist /FI "IMAGENAME eq AutoHotkey*.exe" /FO CSV /NH', (err, stdout) => {
            const running = stdout && stdout.includes('AutoHotkey');
            resolve({
                installed: true,
                running: running,
                script: 'camera-helper.ahk'
            });
        });
    });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 8080;

// Initialize usage metrics
usageMetrics.init('SimGlass Backend');

// Held axis values — re-applied every SIM_FRAME to override joystick spring-center.
// InputEvents get overridden each frame by joystick polling; this re-applies our values
// at the same rate so the AI can hold elevator/aileron deflection during takeoff.
const _heldAxes = {}; // { key: { hash, value } } — entries set by axis handlers, applied in simObjectData

// Flight data state
let flightData = {
    altitude: 0,
    altitudeAGL: 0,
    groundAltitude: 0,
    speed: 0,
    heading: 0,
    magvar: 0,             // Magnetic variation at current position
    groundTrack: 0,        // GPS ground true track
    verticalSpeed: 0,
    groundSpeed: 0,        // Added for flight-data-widget
    windDirection: 0,      // Added for flight-data-widget
    windSpeed: 0,          // Added for flight-data-widget
    // Sim weather
    ambientTemp: 15,       // Celsius
    ambientPressure: 29.92, // inHg
    visibility: 10000,     // meters
    precipState: 0,        // 0=none, 2=rain, 4=snow
    barometerMb: 1013.25,  // millibars
    parkingBrake: false,
    gearDown: true,
    flapsIndex: 0,
    navLight: false,
    beaconLight: false,
    strobeLight: false,
    landingLight: false,
    taxiLight: false,
    engineRunning: false,
    throttle: 0,
    localTime: 0,
    zuluTime: 0,
    connected: false,
    // Autopilot
    apMaster: false,
    apHdgLock: false,
    apAltLock: false,
    apVsLock: false,
    apSpdLock: false,
    apHdgSet: 0,
    apAltSet: 0,
    apVsSet: 0,
    apSpdSet: 0,
    // Fuel totals
    fuelTotal: 0,
    fuelCapacity: 0,
    fuelFlow: 0,
    // Individual tanks (quantity)
    fuelTankLeftMain: 0,
    fuelTankRightMain: 0,
    fuelTankLeftAux: 0,
    fuelTankRightAux: 0,
    fuelTankCenter: 0,
    fuelTankCenter2: 0,
    fuelTankCenter3: 0,
    fuelTankLeftTip: 0,
    fuelTankRightTip: 0,
    fuelTankExternal1: 0,
    fuelTankExternal2: 0,
    // Individual tanks (capacity)
    fuelTankLeftMainCap: 0,
    fuelTankRightMainCap: 0,
    fuelTankLeftAuxCap: 0,
    fuelTankRightAuxCap: 0,
    fuelTankCenterCap: 0,
    fuelTankCenter2Cap: 0,
    fuelTankCenter3Cap: 0,
    fuelTankLeftTipCap: 0,
    fuelTankRightTipCap: 0,
    fuelTankExternal1Cap: 0,
    fuelTankExternal2Cap: 0,
    // Engine controls
    propeller: 0,
    mixture: 0,
    // Engine instruments (for engine-monitor)
    engineRpm: 0,
    manifoldPressure: 0,
    oilTemp: 0,
    oilPressure: 0,
    egt: 0,
    cht: 0,
    // Additional autopilot modes
    apFlightDirector: false,
    apYawDamper: false,
    apNavLock: false,
    apAprLock: false,
    apBcLock: false,
    // Flight controls
    aileron: 0,
    elevator: 0,
    rudder: 0,
    // Position data (for flight recorder) — default to KDEN area for navdb browsing
    latitude: 39.8561,
    longitude: -104.6737,
    altitudeMSL: 0,
    pitch: 0,
    bank: 0,
    // Radio frequencies
    com1Active: 0,
    com1Standby: 0,
    com2Active: 0,
    com2Standby: 0,
    nav1Active: 0,
    nav1Standby: 0,
    nav2Active: 0,
    nav2Standby: 0,
    adfActive: 0,
    adfStandby: 0,
    transponder: 0,
    transponderState: 4,
    transponderIdent: 0,
    // DME
    dme1Distance: 0,
    dme2Distance: 0,
    dme1Speed: 0,
    dme2Speed: 0,
    // GPS Flight Plan
    gpsWpCount: 0,
    gpsWpIndex: 0,
    gpsWpDistance: 0,
    gpsWpEte: 0,
    gpsWpBearing: 0,
    gpsWpNextLat: 0,
    gpsWpNextLon: 0,
    gpsWpNextAlt: 0,
    gpsWpPrevLat: 0,
    gpsWpPrevLon: 0,
    gpsEte: 0,
    gpsLat: 0,
    gpsLon: 0
};

// Directory structure - listing disabled in production (NODE_ENV=production)
const uiPath = path.join(__dirname, '../ui');
const configPath = path.join(__dirname, '../config');
const backendPath = path.join(__dirname);
const isProduction = process.env.NODE_ENV === 'production';

// Usage metrics middleware (before routes)
app.use(usageMetrics.middleware());

// Serve shared UI for hot reload and common components
const sharedUIPath = path.join(__dirname, '../shared-ui');
app.use('/shared-ui', express.static(sharedUIPath));

// Serve UI directories (listing only in dev mode)
// No-cache for JS/HTML/CSS — prevents stale code after deploys and during development
app.use('/ui', express.static(uiPath, { setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}}));
if (!isProduction) {
    app.use('/ui', serveIndex(uiPath, { icons: true }));
    app.use('/config', serveIndex(configPath, { icons: true }));
    app.use('/backend', serveIndex(backendPath, { icons: true }));
}
app.use('/config', express.static(configPath));
app.use('/backend', express.static(backendPath));

// Serve root widgets folder
const widgetsPath = path.join(__dirname, '../../widgets');
app.use('/widgets', express.static(widgetsPath));
if (!isProduction) app.use('/widgets', serveIndex(widgetsPath, { icons: true }));

// Serve plugins static files
app.use('/plugins', express.static(pluginsDir));
if (!isProduction) app.use('/plugins', serveIndex(pluginsDir, { icons: true }));

// Root index page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimGlass Command Center</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 40px; max-width: 1200px; margin: 0 auto; }
        h1 { color: #7ec8e3; display: flex; align-items: center; gap: 12px; }
        h1 .status { font-size: 12px; padding: 4px 10px; background: #22c55e; color: #000; border-radius: 12px; }
        a { color: #7ec8e3; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }
        .section { padding: 15px; background: #16213e; border-radius: 8px; border: 1px solid #333; }
        .section:hover { border-color: #4a9eff; }
        .section h2 { margin-top: 0; color: #4ade80; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { padding: 6px 0; }
        li a { display: flex; align-items: center; gap: 8px; }
        .version { color: #888; font-size: 12px; margin-bottom: 20px; }
        .highlight { background: linear-gradient(135deg, #1a3a5c, #16213e); border-color: #4a9eff !important; }
        .new-badge { background: #cc7722; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .service-link { display: inline-block; padding: 8px 16px; background: #4a9eff; color: #fff !important; border-radius: 6px; margin: 4px 4px 4px 0; font-size: 13px; }
        .service-link:hover { background: #3a8eef; text-decoration: none; }
        .service-link.master { background: #22c55e; }
        .service-link.agent { background: #8b5cf6; }
        .service-link.remote { background: #cc7722; }
    </style>
</head>
<body>
    <h1>🎛️ SimGlass Command Center <span class="status">Online</span></h1>
    <p class="version">Server v${SERVER_VERSION} | KeySender v${keySender.getVersion()} | <a href="http://192.168.1.192:8500" target="_blank">Master (O)</a></p>
    
    <div style="margin: 20px 0;">
        <a href="http://192.168.1.192:8500" target="_blank" class="service-link master">🎛️ Master (O) :8500</a>
        <a href="http://192.168.1.192:8585" target="_blank" class="service-link agent">🤖 Kitt Agent :8585</a>
        <a href="http://192.168.1.192:8590" target="_blank" class="service-link remote">📡 Remote Support :8590</a>
    </div>
    
    <div class="grid">
        <div class="section highlight">
            <h2>🎮 Flight Widgets</h2>
            <div style="margin-bottom:12px;"><a href="/ui/dashboard/" style="display:inline-block;padding:10px 16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;border-radius:8px;font-weight:600;">🎛️ Widget Dashboard</a> <span class="new-badge">NEW</span></div>
            <ul>
                <li><a href="/ui/aircraft-control/">✈️ Aircraft Control</a></li>
                <li><a href="/ui/camera-widget/">📷 Camera Widget</a></li>
                <li><a href="/ui/flight-data-widget/">📊 Flight Data</a></li>
                <li><a href="/ui/flight-recorder/">🎬 Flight Recorder</a></li>
                <li><a href="/ui/fuel-widget/">⛽ Fuel Widget</a></li>
                <li><a href="/ui/fuel-monitor/">⛽ Fuel Monitor</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/engine-monitor/">🔧 Engine Monitor</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/autopilot/">🎛️ Autopilot</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/panel-launcher/">🎛️ Panel Launcher</a></li>
                <li><a href="/ui/interaction-wheel/">⚙️ Interaction Wheel</a></li>
                <li><a href="/ui/otto-search/">🔍 SimGlass Search</a></li>
                <li><a href="/ui/radio-stack/">📻 Radio Stack</a></li>
                <li><a href="/ui/environment/">🌤️ Environment</a></li>
                <li><a href="/ui/gtn750/">🗺️ GTN750</a></li>
                <li><a href="/ui/wasm-camera/">🎬 WASM Camera</a></li>
                <li><a href="/ui/checklist-widget/">✅ Checklist</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/map-widget/">🗺️ Map</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/weather-widget/">🌦️ Weather</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/timer-widget/">⏱️ Timer</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/notepad-widget/">📝 Notepad</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/flightplan-widget/">🛫 Flight Plan</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/simbrief-widget/">📋 SimBrief</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/navigraph-widget/">🗺️ Navigraph Charts</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/charts-widget/">📊 Free Charts</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/copilot-widget/">🧑‍✈️ AI Copilot</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/landing-widget/">🛬 Landing Rate</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/performance-widget/">📈 Performance</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/atc-widget/">📡 ATC Comm</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/flightlog-widget/">📓 Flight Log</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/multiplayer-widget/">👥 Multiplayer</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/fuel-planner/">⛽ Fuel Planner</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/weight-balance/">⚖️ Weight & Balance</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/holding-calc/">🔄 Holding Calc</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/flight-log/">📒 Flight Log</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/flight-instructor/">🎓 Instructor</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/mobile-companion/">📱 Mobile View</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/replay-debrief/">🎬 Flight Replay</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/kneeboard-widget/">📋 Kneeboard</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/metar-widget/">🌦️ METAR Weather</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/checklist-maker/">✏️ Checklist Maker</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/dashboard/">🎛️ Widget Dashboard</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/flight-dashboard/">🎯 Flight Dashboard</a></li>
            </ul>
        </div>

        <div class="section">
            <h2>⚙️ Configuration</h2>
            <ul>
                <li><a href="/ui/keymap-editor/">⌨️ Keymap Editor</a></li>
                <li><a href="/ui/services-panel/">🔧 Services Panel</a></li>
                <li><a href="/ui/plugin-manager/">🔌 Plugin Manager</a></li>
                <li><a href="/ui/voice-control/">🎤 Voice Control</a></li>
                <li><a href="/config/">📁 Config Files</a></li>
            </ul>
        </div>
        
        <div class="section">
            <h2>🔌 API & Debug</h2>
            <ul>
                <li><a href="/api">/api</a> - All Endpoints</li>
                <li><a href="/api/status">/api/status</a> - Connection Status</li>
                <li><a href="/api/keymaps">/api/keymaps</a> - Key Mappings</li>
                <li><a href="/api/debug/camera">/api/debug/camera</a> - Camera Debug</li>
                <li><a href="/api/health">/api/health</a> - Health Check</li>
            </ul>
        </div>
        
        <div class="section highlight">
            <h2>📹 Video Capture</h2>
            <ul>
                <li><a href="/backend/video-capture/ws-stream/viewer.html">🎥 Live Capture (60+ FPS)</a> <span class="new-badge">NEW</span></li>
                <li><a href="/ui/video-viewer/">📺 Video Viewer</a></li>
                <li><a href="/backend/video-capture/">📂 Capture Prototypes</a></li>
            </ul>
        </div>

        <div class="section">
            <h2>📂 Resources</h2>
            <ul>
                <li><a href="/ui/">📂 /ui/</a> - All UI Widgets</li>
                <li><a href="/backend/">📂 /backend/</a> - Backend Source</li>
                <li><a href="http://192.168.1.192:8585" target="_blank">🤖 Kitt Agent</a></li>
                <li><a href="http://192.168.1.192:8500" target="_blank">🎛️ Master Dashboard</a></li>
            </ul>
        </div>
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #0f172a; border-radius: 8px; font-size: 12px; color: #888;">
        <strong style="color: #4a9eff;">Quick Commands:</strong> 
        sas (start all servers) | br (best recommendation) | uem (use existing) | idt (Kitt insights) | sc (sanity check) | ntt (next todo)
    </div>
</body>
</html>
    `);
});

app.use(express.json());

// CORS for toolbar panel
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Initialize plugin system
pluginLoader.discover();
pluginLoader.loadConfig(path.join(__dirname, '../plugins-config.json'));
pluginAPI.registerRoutes(app, pluginLoader);
console.log(`[Plugins] Discovered ${pluginLoader.getAll().length} plugins`);

// REST API endpoints

// API Index - list all available endpoints (HTML view)
app.get('/api', (req, res) => {
    // If requesting JSON, return JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(getApiIndex());
    }
    
    // Otherwise return HTML
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimGlass API</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 40px; }
        h1 { color: #7ec8e3; }
        h2 { color: #4ade80; font-size: 16px; margin-top: 25px; }
        a { color: #7ec8e3; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .endpoint { padding: 8px 15px; background: #16213e; margin: 5px 0; border-radius: 4px; font-family: monospace; }
        .method { color: #4ade80; font-weight: bold; }
        .post { color: #f59e0b; }
        .delete { color: #ef4444; }
        .desc { color: #888; margin-left: 15px; }
        .back { margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="back"><a href="/">← Back to Home</a></div>
    <h1>🔌 SimGlass API</h1>
    <p>Version: ${SERVER_VERSION}</p>
    
    <h2>Status</h2>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/status">/api/status</a> <span class="desc">- Connection status and flight data</span></div>
    
    <h2>Commands</h2>
    <div class="endpoint"><span class="method post">POST</span> /api/command <span class="desc">- Send SimConnect command { command, value }</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/sendkey <span class="desc">- Send keyboard key { key }</span></div>
    
    <h2>Camera System</h2>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/camsys/state">/api/camsys/state</a> <span class="desc">- Get camera state</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/camsys/:action <span class="desc">- Camera action (cockpit, external, drone, toggle, zoom-in, zoom-out)</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/camera/:action <span class="desc">- Legacy camera via vJoy</span></div>
    
    <h2>Keymaps</h2>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/keymaps">/api/keymaps</a> <span class="desc">- Get all keymaps</span></div>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/keymaps/conflicts">/api/keymaps/conflicts</a> <span class="desc">- Check for key conflicts</span></div>
    <div class="endpoint"><span class="method">GET</span> /api/keymaps/:category <span class="desc">- Get keymaps for category</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/keymaps/:category/:action <span class="desc">- Update keymap { key }</span></div>
    
    <h2>Plugins</h2>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/plugins">/api/plugins</a> <span class="desc">- List all plugins</span></div>
    <div class="endpoint"><span class="method">GET</span> /api/plugins/:id <span class="desc">- Get plugin details</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/plugins/:id/enable <span class="desc">- Enable plugin</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/plugins/:id/disable <span class="desc">- Disable plugin</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/plugins/refresh <span class="desc">- Rescan plugins folder</span></div>

    <h2>Debug</h2>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/debug/history">/api/debug/history</a> <span class="desc">- Key send history</span></div>
    <div class="endpoint"><span class="method delete">DELETE</span> /api/debug/history <span class="desc">- Clear history</span></div>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/debug/camera">/api/debug/camera</a> <span class="desc">- Camera debug info</span></div>
    <div class="endpoint"><span class="method">GET</span> <a href="/api/debug/keysender">/api/debug/keysender</a> <span class="desc">- Key sender status</span></div>
    <div class="endpoint"><span class="method">GET</span> /api/debug/test/:category/:action <span class="desc">- Test keymap lookup</span></div>
    <div class="endpoint"><span class="method post">POST</span> /api/debug/mode <span class="desc">- Set debug mode { enabled }</span></div>
</body>
</html>
    `);
});

function getApiIndex() {
    return {
        name: 'SimGlass API',
        version: SERVER_VERSION,
        endpoints: {
            'GET /api/status': 'Connection status and flight data',
            'POST /api/command': 'Send SimConnect command',
            'POST /api/sendkey': 'Send keyboard key',
            'GET /api/camsys/state': 'Camera state',
            'POST /api/camsys/:action': 'Camera action',
            'GET /api/keymaps': 'All keymaps',
            'GET /api/keymaps/conflicts': 'Key conflicts',
            'GET /api/debug/camera': 'Camera debug',
            'GET /api/debug/keysender': 'Key sender status'
        }
    };
}

app.get('/api/status', async (req, res) => {
    const ahkStatus = await getAhkHelperStatus();
    res.json({
        connected: isSimConnected,
        camera: cameraController.getStatus(),
        ahkHelper: ahkStatus,
        flightData,
        usage: usageMetrics.getSummary()
    });
});

// Flight Plan API - Returns GPS-based flight plan data from SimConnect
const mockWaypoints = [
    { ident: 'KJFK', type: 'departure', lat: 40.6413, lng: -73.7781, alt: 0, passed: true },
    { ident: 'MERIT', type: 'fix', lat: 41.9742, lng: -87.9073, alt: 35000, passed: true },
    { ident: 'KDEN', type: 'fix', lat: 39.8561, lng: -104.6737, alt: 35000, active: true },
    { ident: 'CLARR', type: 'fix', lat: 36.0796, lng: -115.1523, alt: 35000 },
    { ident: 'KLAX', type: 'arrival', lat: 33.9425, lng: -118.4081, alt: 0 }
];

app.get('/api/flightplan', (req, res) => {
    const fd = flightData;

    if (fd.gpsWpCount > 0) {
        // Build from SimConnect GPS data
        const waypoints = [];
        if (fd.gpsWpPrevLat !== 0 || fd.gpsWpPrevLon !== 0) {
            waypoints.push({
                ident: 'WP' + (fd.gpsWpIndex - 1),
                type: fd.gpsWpIndex === 1 ? 'departure' : 'fix',
                lat: fd.gpsWpPrevLat,
                lng: fd.gpsWpPrevLon,
                passed: true
            });
        }
        if (fd.gpsWpNextLat !== 0 || fd.gpsWpNextLon !== 0) {
            waypoints.push({
                ident: 'WP' + fd.gpsWpIndex,
                type: fd.gpsWpIndex === fd.gpsWpCount ? 'arrival' : 'fix',
                lat: fd.gpsWpNextLat,
                lng: fd.gpsWpNextLon,
                alt: fd.gpsWpNextAlt,
                active: true,
                distanceFromPrev: fd.gpsWpDistance
            });
        }
        res.json({
            source: 'simconnect',
            connected: isSimConnected,
            departure: waypoints[0]?.ident || '----',
            arrival: waypoints[waypoints.length - 1]?.ident || '----',
            totalDistance: Math.round(fd.gpsWpDistance * (fd.gpsWpCount - fd.gpsWpIndex + 1)),
            totalEte: fd.gpsEte,
            currentPosition: { lat: fd.gpsLat || fd.latitude, lng: fd.gpsLon || fd.longitude, groundSpeed: fd.groundSpeed },
            waypointIndex: fd.gpsWpIndex,
            waypointCount: fd.gpsWpCount,
            nextWaypoint: { ident: 'WP' + fd.gpsWpIndex, distance: fd.gpsWpDistance, bearing: fd.gpsWpBearing, ete: fd.gpsWpEte, alt: fd.gpsWpNextAlt },
            waypoints
        });
    } else {
        // Mock data for UI development
        res.json({
            source: 'mock',
            connected: false,
            departure: 'KJFK',
            arrival: 'KLAX',
            totalDistance: 2475,
            totalEte: 18000,
            currentPosition: { lat: fd.gpsLat || 40.6413, lng: fd.gpsLon || -95.5, groundSpeed: fd.groundSpeed || 450 },
            waypointIndex: 2,
            waypointCount: 5,
            nextWaypoint: { ident: 'KDEN', distance: 125.4, bearing: 275, ete: 1850, alt: 35000 },
            waypoints: mockWaypoints
        });
    }
});

// Health check endpoint with full system status
const serverStartTime = Date.now();

app.get('/api/health', (req, res) => {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const memUsage = process.memoryUsage();

    res.json({
        status: 'ok',
        version: SERVER_VERSION,
        uptime: uptime,
        uptimeFormatted: formatUptime(uptime),
        simconnect: {
            connected: isSimConnected,
            mock: !isSimConnected
        },
        camera: {
            system: cameraSystem.getState(),
            controller: cameraController.getStatus()
        },
        plugins: {
            discovered: pluginLoader.getAll().length,
            enabled: pluginLoader.getActive().length,
            list: pluginLoader.getAll().map(p => ({ id: p.id, name: p.name, enabled: p.enabled }))
        },
        websocket: {
            clients: wss.clients.size
        },
        memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
        },
        timestamp: new Date().toISOString()
    });
});

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

// Video capture endpoints for MSFS live view
const sharp = require('sharp');
const FRAME_PATH = path.join(__dirname, 'frame.png');
const FRAME_JPG_PATH = path.join(__dirname, 'frame.jpg');
const NIRCMD_PATH = 'C:\\LLM-DevOSWE\\nircmd\\nircmdc.exe';
let lastFrameTime = 0;
let msfsRunning = false;
let frameCache = null;
let frameCacheTime = 0;

// Check if MSFS is running
function checkMsfsRunning() {
    return new Promise((resolve) => {
        exec('tasklist /FI "IMAGENAME eq FlightSimulator2024.exe" /FO CSV /NH', (err, stdout) => {
            if (err) {
                resolve(false);
            } else {
                resolve(stdout.includes('FlightSimulator'));
            }
        });
    });
}

// ============================================
// WEATHER API PROXY (METAR/TAF)
// ============================================

// Cache for weather data (5 minute TTL)
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Nearby airports METAR (within radius) - must be before :icao route
app.get('/api/weather/metar/nearby', async (req, res) => {
    const { lat, lon, radius = 100 } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Provide lat and lon' });
    }

    try {
        // Use AWC for bulk METAR fetch within bounding box
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        const radiusNm = parseFloat(radius);

        // Rough bounding box (1 degree ~ 60nm)
        const latDelta = radiusNm / 60;
        const lonDelta = radiusNm / (60 * Math.cos(latNum * Math.PI / 180));

        const bbox = `${latNum - latDelta},${lonNum - lonDelta},${latNum + latDelta},${lonNum + lonDelta}`;
        const awcUrl = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`;

        const response = await fetch(awcUrl, { signal: AbortSignal.timeout(8000) });

        if (response.ok) {
            const data = await response.json();
            const metars = (data || []).map(m => ({
                icao: m.icaoId,
                raw: m.rawOb,
                lat: m.lat,
                lon: m.lon,
                flight_rules: m.fltcat,
                temp: m.temp,
                dewp: m.dewp,
                wdir: m.wdir,
                wspd: m.wspd,
                visib: m.visib,
                altim: m.altim
            }));
            return res.json({ metars, count: metars.length });
        }

        res.status(502).json({ error: 'AWC API unavailable' });
    } catch (e) {
        console.log('[Weather] Nearby METAR failed:', e.message);
        res.status(500).json({ error: 'Failed to fetch nearby METARs' });
    }
});

app.get('/api/weather/metar/:icao', async (req, res) => {
    const icao = req.params.icao.toUpperCase();

    if (!/^[A-Z]{4}$/.test(icao)) {
        return res.status(400).json({ error: 'Invalid ICAO code' });
    }

    // Check cache
    const cached = weatherCache.get(`metar_${icao}`);
    if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
        return res.json(cached.data);
    }

    try {
        // Try AVWX API first (free tier)
        const avwxRes = await fetch(`https://avwx.rest/api/metar/${icao}?options=info,translate`, {
            headers: { 'Authorization': 'DEMO' },
            signal: AbortSignal.timeout(5000)
        });

        if (avwxRes.ok) {
            const data = await avwxRes.json();
            weatherCache.set(`metar_${icao}`, { data, timestamp: Date.now() });
            return res.json(data);
        }
    } catch (e) {
        console.log(`[Weather] AVWX failed for ${icao}: ${e.message}`);
    }

    try {
        // Fallback: Aviation Weather Center (AWC)
        const awcUrl = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
        const awcRes = await fetch(awcUrl, { signal: AbortSignal.timeout(5000) });

        if (awcRes.ok) {
            const awcData = await awcRes.json();
            if (awcData && awcData.length > 0) {
                const metar = awcData[0];
                const parsed = {
                    raw: metar.rawOb,
                    station: icao,
                    time: { dt: metar.obsTime },
                    wind_direction: { value: metar.wdir },
                    wind_speed: { value: metar.wspd },
                    wind_gust: metar.wgst ? { value: metar.wgst } : null,
                    visibility: { value: metar.visib },
                    temperature: { value: metar.temp },
                    dewpoint: { value: metar.dewp },
                    altimeter: { value: metar.altim },
                    flight_rules: metar.fltcat,
                    clouds: (metar.clouds || []).map(c => ({
                        type: c.cover,
                        altitude: c.base
                    }))
                };
                weatherCache.set(`metar_${icao}`, { data: parsed, timestamp: Date.now() });
                return res.json(parsed);
            }
        }
    } catch (e) {
        console.log(`[Weather] AWC failed for ${icao}: ${e.message}`);
    }

    res.status(404).json({ error: `No METAR found for ${icao}` });
});

app.get('/api/weather/taf/:icao', async (req, res) => {
    const icao = req.params.icao.toUpperCase();

    if (!/^[A-Z]{4}$/.test(icao)) {
        return res.status(400).json({ error: 'Invalid ICAO code' });
    }

    // Check cache
    const cached = weatherCache.get(`taf_${icao}`);
    if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
        return res.json(cached.data);
    }

    try {
        const awcUrl = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`;
        const awcRes = await fetch(awcUrl, { signal: AbortSignal.timeout(5000) });

        if (awcRes.ok) {
            const data = await awcRes.json();
            if (data && data.length > 0) {
                weatherCache.set(`taf_${icao}`, { data: data[0], timestamp: Date.now() });
                return res.json(data[0]);
            }
        }
    } catch (e) {
        console.log(`[Weather] TAF failed for ${icao}: ${e.message}`);
    }

    res.status(404).json({ error: `No TAF found for ${icao}` });
});

// RainViewer radar data (free, no API key)
app.get('/api/weather/radar', async (req, res) => {
    try {
        const cached = weatherCache.get('radar_tiles');
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 min cache
            return res.json(cached.data);
        }

        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            const result = {
                generated: data.generated,
                host: data.host,
                radar: data.radar?.past?.slice(-6) || [], // Last 6 frames
                satellite: data.satellite?.infrared?.slice(-3) || []
            };
            weatherCache.set('radar_tiles', { data: result, timestamp: Date.now() });
            return res.json(result);
        }

        res.status(502).json({ error: 'RainViewer API unavailable' });
    } catch (e) {
        console.log('[Weather] Radar fetch failed:', e.message);
        res.status(500).json({ error: 'Failed to fetch radar data' });
    }
});

// Nearby airports API
app.get('/api/nearby/airports', async (req, res) => {
    const lat = parseFloat(req.query.lat) || flightData.latitude || 40.6413;
    const lon = parseFloat(req.query.lon) || flightData.longitude || -73.7781;
    const radius = parseInt(req.query.radius) || 50;

    // Check cache (based on rounded position)
    const cacheKey = `nearby_apt_${Math.round(lat * 10)}_${Math.round(lon * 10)}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 min cache
        return res.json(cached.data);
    }

    // Use local navdb (fast, reliable, has runway data)
    try {
        const navRes = await fetch(`http://localhost:${PORT}/api/navdb/nearby/airports?lat=${lat}&lon=${lon}&range=${radius}&limit=25`, { signal: AbortSignal.timeout(3000) });
        if (navRes.ok) {
            const navData = await navRes.json();
            if (navData.items?.length) {
                // Enrich each airport with runway data
                const airports = await Promise.all(navData.items.map(async apt => {
                    try {
                        const rwyRes = await fetch(`http://localhost:${PORT}/api/navdb/airport/${apt.icao}`, { signal: AbortSignal.timeout(2000) });
                        if (rwyRes.ok) {
                            const full = await rwyRes.json();
                            apt.runways = (full.runways || []).map(r => ({
                                id: r.ident?.replace(/^RW/, '') || r.id,
                                length: r.length || 0,
                                heading: r.heading || 0,
                                lat: r.lat,
                                lon: r.lon
                            }));
                        }
                    } catch (_) {}
                    return apt;
                }));
                weatherCache.set(cacheKey, { data: airports, timestamp: Date.now() });
                return res.json(airports);
            }
        }
    } catch (e) {
        console.log('[Nearby] Navdb lookup failed:', e.message);
    }

    // Fallback: generate sample airports around position
    const sampleAirports = generateSampleAirports(lat, lon, radius);
    res.json(sampleAirports);
});

// Generate sample airports for demo/fallback
function generateSampleAirports(lat, lon, radius) {
    const types = ['LARGE', 'MEDIUM', 'SMALL', 'HELIPORT'];
    const prefixes = ['K', 'C', 'E', 'L'];
    const airports = [];
    const count = 8 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
        const bearing = (i * 360 / count) + Math.random() * 30;
        const distance = 5 + Math.random() * (radius - 5);
        const bearingRad = bearing * Math.PI / 180;

        const aptLat = lat + (distance * Math.cos(bearingRad)) / 60;
        const aptLon = lon + (distance * Math.sin(bearingRad)) / (60 * Math.cos(lat * Math.PI / 180));

        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const code = `${prefix}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

        airports.push({
            icao: code,
            name: `${code} Regional Airport`,
            type: types[Math.floor(Math.random() * types.length)],
            lat: aptLat,
            lon: aptLon,
            elevation: Math.round(500 + Math.random() * 2000),
            distance: Math.round(distance * 10) / 10,
            bearing: Math.round(bearing),
            runways: [{ id: `${Math.floor(Math.random() * 36).toString().padStart(2, '0')}`, length: 3000 + Math.floor(Math.random() * 7000) }]
        });
    }

    return airports.sort((a, b) => a.distance - b.distance);
}

// Helper functions for distance/bearing
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Waypoint lookup API
app.get('/api/waypoint/:ident', async (req, res) => {
    const ident = req.params.ident.toUpperCase();

    if (!/^[A-Z0-9]{2,5}$/.test(ident)) {
        return res.status(400).json({ error: 'Invalid waypoint identifier' });
    }

    // Check cache
    const cached = weatherCache.get(`waypoint_${ident}`);
    if (cached && Date.now() - cached.timestamp < 86400000) { // 24 hour cache
        return res.json(cached.data);
    }

    try {
        // Try aviationAPI for airports (3-4 letter codes)
        if (ident.length >= 3 && ident.length <= 4) {
            const apiUrl = `https://api.aviationapi.com/v1/airports?apt=${ident}`;
            const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });

            if (response.ok) {
                const data = await response.json();
                const airports = Array.isArray(data) ? data : Object.values(data).flat();
                const apt = airports.find(a => (a.icao || a.ident)?.toUpperCase() === ident);

                if (apt) {
                    const result = {
                        ident: ident,
                        name: apt.name || apt.facility_name,
                        type: 'AIRPORT',
                        lat: parseFloat(apt.latitude || apt.lat),
                        lon: parseFloat(apt.longitude || apt.lon),
                        elevation: apt.elevation,
                        source: 'aviationapi'
                    };
                    weatherCache.set(`waypoint_${ident}`, { data: result, timestamp: Date.now() });
                    return res.json(result);
                }
            }
        }
    } catch (e) {
        console.log(`[Waypoint] API lookup failed for ${ident}: ${e.message}`);
    }

    // Generate sample waypoint for demo (VOR/NDB/FIX simulation)
    // In production, would use a nav database
    const sampleWaypoints = {
        'JFK': { name: 'Kennedy VOR', type: 'VOR', lat: 40.6413, lon: -73.7781 },
        'LGA': { name: 'LaGuardia VOR', type: 'VOR', lat: 40.7769, lon: -73.8740 },
        'EWR': { name: 'Newark VOR', type: 'VOR', lat: 40.6895, lon: -74.1745 },
        'BOS': { name: 'Boston VOR', type: 'VOR', lat: 42.3656, lon: -71.0096 },
        'ORD': { name: 'OHare VOR', type: 'VOR', lat: 41.9742, lon: -87.9073 },
        'LAX': { name: 'Los Angeles VOR', type: 'VOR', lat: 33.9425, lon: -118.4081 },
        'DEN': { name: 'Denver VOR', type: 'VOR', lat: 39.8561, lon: -104.6737 }
    };

    if (sampleWaypoints[ident]) {
        const sample = sampleWaypoints[ident];
        return res.json({
            ident,
            name: sample.name,
            type: sample.type,
            lat: sample.lat,
            lon: sample.lon,
            source: 'sample'
        });
    }

    // Not found
    res.status(404).json({ error: 'Waypoint not found', ident });
});

// Charts API - fetch available charts for an airport
app.get('/api/charts/:icao', async (req, res) => {
    const icao = req.params.icao.toUpperCase();

    if (!/^[A-Z]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: 'Invalid ICAO code' });
    }

    // Check cache
    const cached = weatherCache.get(`charts_${icao}`);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return res.json(cached.data);
    }

    try {
        // Try aviationAPI.com for chart data (free)
        const apiUrl = `https://api.aviationapi.com/v1/charts?apt=${icao}`;
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });

        if (response.ok) {
            const data = await response.json();
            const charts = [];

            // aviationAPI returns charts as array: {"KJFK": [{chart}, {chart}, ...]}
            const chartList = data[icao] || [];
            if (Array.isArray(chartList)) {
                chartList.forEach(chart => {
                    charts.push({
                        id: chart.chart_seq || chart.chart_code,
                        name: chart.chart_name || 'Unknown',
                        type: mapChartType(chart.chart_code),
                        url: chart.pdf_path || `https://chartfox.org/${icao}`,
                        pdfName: chart.pdf_name
                    });
                });
            }

            if (charts.length > 0) {
                const result = { airport: icao, charts, count: charts.length, source: 'aviationapi' };
                weatherCache.set(`charts_${icao}`, { data: result, timestamp: Date.now() });
                return res.json(result);
            }
        }
    } catch (e) {
        console.log(`[Charts] AviationAPI failed for ${icao}: ${e.message}`);
    }

    // Fallback: return ChartFox URL only
    const fallback = {
        airport: icao,
        charts: [{
            id: 'chartfox',
            name: `${icao} Charts`,
            type: 'ALL',
            url: `https://chartfox.org/${icao}`
        }],
        count: 1,
        source: 'chartfox'
    };

    res.json(fallback);
});

// Procedures API - extract procedures from charts data
app.get('/api/procedures/:icao', async (req, res) => {
    const icao = req.params.icao.toUpperCase();

    if (!/^[A-Z]{3,4}$/.test(icao)) {
        return res.status(400).json({ error: 'Invalid ICAO code' });
    }

    // Check cache
    const cached = weatherCache.get(`procedures_${icao}`);
    if (cached && Date.now() - cached.timestamp < 3600000) {
        return res.json(cached.data);
    }

    try {
        // Fetch charts to extract procedure names
        const apiUrl = `https://api.aviationapi.com/v1/charts?apt=${icao}`;
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });

        if (response.ok) {
            const data = await response.json();
            const chartList = data[icao] || [];

            const departures = [];
            const arrivals = [];
            const approaches = [];

            chartList.forEach(chart => {
                const name = chart.chart_name || '';
                const code = chart.chart_code || '';

                // Extract runway from name
                const rwyMatch = name.match(/RWY\s*(\d{1,2}[LRC]?(?:\/\d{1,2}[LRC]?)?)/i);
                const runway = rwyMatch ? rwyMatch[1] : 'ALL';

                if (code === 'DP' || code.includes('SID')) {
                    // Skip continuation pages
                    if (!name.includes('CONT.')) {
                        departures.push({
                            id: chart.chart_seq || chart.pdf_name,
                            name: name,
                            runway: runway,
                            transition: 'RADAR',
                            chartUrl: chart.pdf_path
                        });
                    }
                } else if (code === 'STAR') {
                    if (!name.includes('CONT.')) {
                        arrivals.push({
                            id: chart.chart_seq || chart.pdf_name,
                            name: name,
                            runway: runway,
                            transition: 'ALL',
                            chartUrl: chart.pdf_path
                        });
                    }
                } else if (code === 'IAP') {
                    // Determine approach type
                    let type = 'OTHER';
                    let category = '';
                    if (name.includes('ILS')) {
                        type = 'ILS';
                        if (name.includes('CAT II') || name.includes('CAT III')) {
                            category = name.includes('CAT III') ? 'CAT III' : 'CAT II';
                        } else {
                            category = 'CAT I';
                        }
                    } else if (name.includes('RNAV') || name.includes('GPS')) {
                        type = 'RNAV';
                        category = name.includes('LPV') ? 'LPV' : 'LNAV';
                    } else if (name.includes('VOR')) {
                        type = 'VOR';
                    } else if (name.includes('LOC')) {
                        type = 'LOC';
                    } else if (name.includes('NDB')) {
                        type = 'NDB';
                    } else if (name.includes('VISUAL')) {
                        type = 'VISUAL';
                    }

                    approaches.push({
                        id: chart.chart_seq || chart.pdf_name,
                        name: name,
                        runway: runway,
                        type: type,
                        category: category,
                        chartUrl: chart.pdf_path
                    });
                }
            });

            const result = {
                airport: icao,
                departures,
                arrivals,
                approaches,
                source: 'aviationapi'
            };

            weatherCache.set(`procedures_${icao}`, { data: result, timestamp: Date.now() });
            return res.json(result);
        }
    } catch (e) {
        console.log(`[Procedures] API failed for ${icao}: ${e.message}`);
    }

    // Return empty for fallback
    res.json({
        airport: icao,
        departures: [],
        arrivals: [],
        approaches: [],
        source: 'none'
    });
});

// Helper: Map chart codes to types
function mapChartType(code) {
    if (!code) return 'OTHER';
    code = code.toUpperCase();
    if (code.includes('APD') || code.includes('AIRPORT')) return 'APD';
    if (code.includes('IAP') || code.includes('ILS') || code.includes('RNAV') || code.includes('VOR') || code.includes('LOC')) return 'IAP';
    if (code.includes('DP') || code.includes('SID') || code.includes('DEPARTURE')) return 'DP';
    if (code.includes('STAR') || code.includes('ARRIVAL')) return 'STAR';
    if (code.includes('MIN')) return 'MIN';
    if (code.includes('HOT')) return 'HOT';
    return 'OTHER';
}

// SimBrief OFP proxy (CORS bypass)
app.get('/api/simbrief/ofp', async (req, res) => {
    const { userid, username } = req.query;

    if (!userid && !username) {
        return res.status(400).json({ error: 'Provide userid or username' });
    }

    try {
        let url = 'https://www.simbrief.com/api/xml.fetcher.php?json=1';
        if (userid) {
            url += '&userid=' + encodeURIComponent(userid);
        } else {
            url += '&username=' + encodeURIComponent(username);
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const data = await response.json();

        // Check for error in response (SimBrief returns 400 with JSON error)
        if (data.fetch?.status?.startsWith('Error')) {
            return res.status(404).json({ error: data.fetch.status });
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: 'SimBrief API error' });
        }

        res.json(data);
    } catch (e) {
        console.log('[SimBrief] Fetch failed:', e.message);
        res.status(500).json({ error: 'Failed to fetch from SimBrief' });
    }
});

// Video status endpoint
app.get('/api/video/status', async (req, res) => {
    msfsRunning = await checkMsfsRunning();
    res.json({
        ready: msfsRunning,
        lastFrame: lastFrameTime,
        framePath: FRAME_PATH
    });
});

// Video frame capture endpoint - optimized
app.get('/api/video/frame', async (req, res) => {
    const quality = parseInt(req.query.quality) || 60;
    const scale = parseFloat(req.query.scale) || 0.5;

    try {
        // Capture screen using nircmd
        await new Promise((resolve) => {
            exec(`"${NIRCMD_PATH}" savescreenshotfull "${FRAME_PATH}"`, { timeout: 2000 }, () => {
                resolve();
            });
        });

        if (!fs.existsSync(FRAME_PATH)) {
            return res.status(500).json({ error: 'Frame not captured' });
        }

        // Compress and resize with sharp for faster transfer
        const optimized = await sharp(FRAME_PATH)
            .resize({ width: Math.round(1920 * scale), withoutEnlargement: true })
            .jpeg({ quality: quality, mozjpeg: true })
            .toBuffer();

        lastFrameTime = Date.now();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Length', optimized.length);
        res.send(optimized);
    } catch (e) {
        console.log('[Video] Capture error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Detection API for setup wizard
app.get('/api/detect', async (req, res) => {
    const results = {
        msfs: { detected: false, version: null },
        chaseplane: { detected: false },
        ahk: { detected: false },
        simconnect: { detected: isSimConnected }
    };

    // Check for MSFS process
    try {
        const { stdout } = await new Promise((resolve, reject) => {
            exec('tasklist /FI "IMAGENAME eq FlightSimulator.exe" /FO CSV /NH', (err, stdout, stderr) => {
                if (err) reject(err);
                else resolve({ stdout, stderr });
            });
        });
        if (stdout.includes('FlightSimulator.exe')) {
            results.msfs.detected = true;
            results.msfs.version = 'MSFS 2024';
        }
    } catch (e) {
        // Try MSFS 2020
        try {
            const { stdout } = await new Promise((resolve, reject) => {
                exec('tasklist /FI "IMAGENAME eq FlightSimulator2020.exe" /FO CSV /NH', (err, stdout, stderr) => {
                    if (err) reject(err);
                    else resolve({ stdout, stderr });
                });
            });
            if (stdout.includes('FlightSimulator')) {
                results.msfs.detected = true;
                results.msfs.version = 'MSFS 2020';
            }
        } catch (e2) {}
    }

    // Check for ChasePlane
    try {
        const { stdout } = await new Promise((resolve, reject) => {
            exec('tasklist /FI "IMAGENAME eq CP MSFS Bridge.exe" /FO CSV /NH', (err, stdout, stderr) => {
                if (err) reject(err);
                else resolve({ stdout, stderr });
            });
        });
        results.chaseplane.detected = stdout.includes('CP MSFS Bridge');
    } catch (e) {
        console.log('[Platform] ChasePlane detection failed:', e.message);
    }

    // Check for AutoHotKey
    try {
        const { stdout } = await new Promise((resolve, reject) => {
            exec('where autohotkey', (err, stdout, stderr) => {
                resolve({ stdout: stdout || '', stderr });
            });
        });
        results.ahk.detected = stdout.trim().length > 0;
    } catch (e) {
        // Also check if AHK is running
        try {
            const { stdout } = await new Promise((resolve, reject) => {
                exec('tasklist /FI "IMAGENAME eq AutoHotkey*.exe" /FO CSV /NH', (err, stdout, stderr) => {
                    resolve({ stdout: stdout || '', stderr });
                });
            });
            results.ahk.detected = stdout.includes('AutoHotkey');
        } catch (e2) {}
    }

    // SimConnect detected if we have a connection or if MSFS is running
    results.simconnect.detected = isSimConnected || results.msfs.detected;

    res.json(results);
});

// Config API for setup wizard
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

app.get('/api/config', (req, res) => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            res.json(config);
        } else {
            res.json({});
        }
    } catch (e) {
        res.json({});
    }
});

app.post('/api/config', (req, res) => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SimConnect remote settings endpoint
app.post('/api/simconnect/remote', async (req, res) => {
    const { host, port } = req.body;
    console.log(`[SimConnect] Setting remote host: ${host}:${port || 500}`);

    try {
        // Save to config
        let config = {};
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
        config.simconnect = { remoteHost: host || null, remotePort: port || 500 };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        // Cancel pending retry and reset backoff
        if (simConnectRetryTimeout) clearTimeout(simConnectRetryTimeout);
        simConnectRetryTimeout = null;
        simConnectRetryDelay = SC_RETRY_MIN;
        simConnectRetryCount = 0;

        // Close existing connection
        if (simConnectConnection) {
            try {
                simConnectConnection.close();
            } catch (e) {
                console.log('[SimConnect] Close failed:', e.message);
            }
            simConnectConnection = null;
            isSimConnected = false;
            flightData.connected = false;
        }

        // Reconnect with new settings
        if (host) {
            setTimeout(() => initSimConnect(), 500);
            res.json({ success: true, message: `Connecting to ${host}:${port || 500}...` });
        } else {
            // Clear remote, try local
            setTimeout(() => initSimConnect(), 500);
            res.json({ success: true, message: 'Cleared remote, connecting to local MSFS...' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/simconnect/status', (req, res) => {
    let config = {};
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {
        console.log('[SimConnect] Config read failed:', e.message);
    }

    res.json({
        connected: isSimConnected,
        remoteHost: config.simconnect?.remoteHost || null,
        remotePort: config.simconnect?.remotePort || 500,
        mockMode: !isSimConnected,
        retryCount: simConnectRetryCount,
        nextRetryIn: simConnectRetryTimeout ? Math.round(simConnectRetryDelay / SC_RETRY_MULTIPLIER / 1000) : null
    });
});

// Mock data control
app.post('/api/mock/stop', (req, res) => {
    mockDataSuppressed = true;
    stopMockData();
    res.json({ mock: false });
});
app.post('/api/mock/start', (req, res) => {
    mockDataSuppressed = false;
    startMockData();
    res.json({ mock: true });
});

// Graceful shutdown endpoint
app.post('/api/shutdown', (req, res) => {
    console.log('[Server] Shutdown requested via API');
    res.json({ status: 'shutting_down' });
    
    // Close WebSocket connections
    wss.clients.forEach(client => {
        try {
            client.send(JSON.stringify({ type: 'server_shutdown' }));
            client.close();
        } catch (_) {
            try { client.terminate(); } catch (__) {}
        }
    });
    
    // Close server gracefully
    setTimeout(() => {
        server.close(() => {
            console.log('[Server] Graceful shutdown complete');
            process.exit(0);
        });
    }, 500);
});

// Services control endpoint
app.get('/api/services', (req, res) => {
    res.json({
        services: [
            { name: 'SimGlass', port: 8080, description: 'Main SimGlass server' },
            { name: 'agent', port: 8585, description: 'Claude Agent server' },
            { name: 'remote', port: 8590, description: 'Remote Support service' }
        ]
    });
});

app.post('/api/services', async (req, res) => {
    const { service, action } = req.body;
    
    if (!service || !action) {
        return res.status(400).json({ error: 'service and action required' });
    }
    
    const serviceConfigs = {
        SimGlass: {
            dir: 'C:\\DevOSWE\\simwidget-hybrid\\backend',
            start: 'npx nodemon server.js',
            port: 8080
        },
        agent: {
            dir: 'C:\\DevOSWE\\Admin\\agent',
            start: 'node agent-server.js',
            port: 8585
        },
        remote: {
            dir: 'C:\\DevOSWE\\Admin\\remote-support',
            start: 'node service.js',
            port: 8590
        }
    };
    
    const config = serviceConfigs[service];
    if (!config) {
        return res.status(400).json({ error: 'Unknown service' });
    }
    
    try {
        let cmd;
        switch (action) {
            case 'start':
                cmd = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d "${config.dir}" ^&^& ${config.start}' -WindowStyle Minimized`;
                break;
            case 'stop':
                cmd = `Get-NetTCPConnection -LocalPort ${config.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
                break;
            case 'restart':
                cmd = `Get-NetTCPConnection -LocalPort ${config.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2; Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d "${config.dir}" ^&^& ${config.start}' -WindowStyle Minimized`;
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
        
        exec(`powershell -Command "${cmd}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Services] ${action} ${service} error:`, error.message);
                return res.json({ success: false, error: error.message });
            }
            console.log(`[Services] ${action} ${service}: OK`);
            res.json({ success: true, service, action });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logs API endpoint
app.get('/api/logs/:service', (req, res) => {
    const service = req.params.service;
    const logPaths = {
        SimGlass: path.join(__dirname, '..', 'logs', 'server.log'),
        agent: 'C:\\DevOSWE\\Admin\\agent\\logs\\agent-errors.log',
        remote: 'C:\\DevOSWE\\Admin\\remote-support\\logs\\audit.log'
    };
    
    const logPath = logPaths[service];
    if (!logPath) {
        return res.status(400).json({ error: 'Unknown service' });
    }
    
    try {
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf8');
            // Return last 100 lines
            const lines = content.split('\n').slice(-100).join('\n');
            res.json({ service, log: lines });
        } else {
            res.json({ service, log: 'Log file not found: ' + logPath });
        }
    } catch (err) {
        res.json({ service, log: 'Error reading log: ' + err.message });
    }
});

app.post('/api/command', (req, res) => {
    const { command, value } = req.body;
    console.log(`Command received: ${command} = ${value}`);

    // Keyboard shortcuts work even without SimConnect
    if (command.startsWith('KEY_')) {
        executeCommand(command, value);
        res.json({ success: true, keyboard: true });
    } else if (isSimConnected && simConnectConnection) {
        executeCommand(command, value);
        res.json({ success: true });
    } else {
        // Mock response for browser testing without sim
        res.json({ success: true, mock: true });
    }
});

// H: Event endpoint for G1000/avionics HTML events
// Maps common H: events to SimConnect events or handles via InputEvent system
const H_EVENT_MAP = {
    // G1000 PFD Softkeys
    'AS1000_PFD_SOFTKEYS_1': 'G1000_PFD_SOFTKEY1',
    'AS1000_PFD_SOFTKEYS_2': 'G1000_PFD_SOFTKEY2',
    'AS1000_PFD_SOFTKEYS_3': 'G1000_PFD_SOFTKEY3',
    'AS1000_PFD_SOFTKEYS_4': 'G1000_PFD_SOFTKEY4',
    'AS1000_PFD_SOFTKEYS_5': 'G1000_PFD_SOFTKEY5',
    'AS1000_PFD_SOFTKEYS_6': 'G1000_PFD_SOFTKEY6',
    // G1000 MFD Softkeys
    'AS1000_MFD_SOFTKEYS_1': 'G1000_MFD_SOFTKEY1',
    'AS1000_MFD_SOFTKEYS_2': 'G1000_MFD_SOFTKEY2',
    'AS1000_MFD_SOFTKEYS_3': 'G1000_MFD_SOFTKEY3',
    'AS1000_MFD_SOFTKEYS_4': 'G1000_MFD_SOFTKEY4',
    'AS1000_MFD_SOFTKEYS_5': 'G1000_MFD_SOFTKEY5',
    'AS1000_MFD_SOFTKEYS_6': 'G1000_MFD_SOFTKEY6',
    // G1000 Common Controls
    'AS1000_PFD_ENT': 'G1000_PFD_ENT_Push',
    'AS1000_PFD_CLR': 'G1000_PFD_CLR',
    'AS1000_MFD_ENT': 'G1000_MFD_ENT_Push',
    'AS1000_MFD_CLR': 'G1000_MFD_CLR',
    'AS1000_PFD_DIRECTTO': 'G1000_PFD_DIRECTTO',
    'AS1000_MFD_DIRECTTO': 'G1000_MFD_DIRECTTO',
    'AS1000_MFD_MENU': 'G1000_MFD_MENU_Push',
    'AS1000_MFD_FPL': 'G1000_MFD_FPL_Push',
    'AS1000_MFD_PROC': 'G1000_MFD_PROC_Push'
};

app.post('/api/hevent', (req, res) => {
    const { event } = req.body;
    console.log(`H:Event received: ${event}`);

    if (!event) {
        return res.status(400).json({ success: false, error: 'No event specified' });
    }

    // Check if we have a mapped SimConnect event
    const mappedEvent = H_EVENT_MAP[event];

    if (mappedEvent && isSimConnected && simConnectConnection) {
        // Try to execute via SimConnect event mapping
        const eventId = eventMap[mappedEvent];
        if (eventId !== undefined) {
            try {
                simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
                console.log(`H:Event ${event} -> SimConnect ${mappedEvent}`);
                return res.json({ success: true, method: 'simconnect', mapped: mappedEvent });
            } catch (e) {
                console.error(`H:Event SimConnect error:`, e.message);
            }
        }
    }

    // For unmapped events, log and return info
    // Full H: event support requires MSFS InputEvent system
    console.log(`H:Event ${event} - no direct mapping available`);
    res.json({
        success: true,
        method: 'logged',
        note: 'H: events require InputEvent system for full support',
        event
    });
});

// Radio frequency API
// Frequency values: COM/NAV in MHz (e.g., 121.5), ADF in KHz (e.g., 394), XPNDR in octal (e.g., 1200)
app.post('/api/radio/:radio/:action', (req, res) => {
    const { radio, action } = req.params;
    const { frequency, code } = req.body;

    console.log(`[Radio] ${radio} ${action}:`, frequency || code);

    if (!isSimConnected || !simConnectConnection) {
        return res.json({ success: true, mock: true });
    }

    // Map radio/action to event name and convert frequency
    let eventName = null;
    let eventValue = 0;

    switch (`${radio.toLowerCase()}_${action.toLowerCase()}`) {
        // COM1
        case 'com1_active':
            eventName = 'COM_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'com1_standby':
            eventName = 'COM_STBY_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'com1_swap':
            eventName = 'COM_STBY_RADIO_SWAP';
            eventValue = 0;
            break;
        // COM2
        case 'com2_active':
            eventName = 'COM2_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'com2_standby':
            eventName = 'COM2_STBY_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'com2_swap':
            eventName = 'COM2_STBY_RADIO_SWAP';
            eventValue = 0;
            break;
        // NAV1
        case 'nav1_active':
            eventName = 'NAV1_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'nav1_standby':
            eventName = 'NAV1_STBY_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'nav1_swap':
            eventName = 'NAV1_RADIO_SWAP';
            eventValue = 0;
            break;
        // NAV2
        case 'nav2_active':
            eventName = 'NAV2_RADIO_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'nav2_standby':
            eventName = 'NAV2_STBY_SET';
            eventValue = freqToBCD16(frequency);
            break;
        case 'nav2_swap':
            eventName = 'NAV2_RADIO_SWAP';
            eventValue = 0;
            break;
        // ADF
        case 'adf_active':
            eventName = 'ADF_SET';
            eventValue = adfToBCD16(frequency);
            break;
        case 'adf_standby':
            eventName = 'ADF_STBY_SET';
            eventValue = adfToBCD16(frequency);
            break;
        case 'adf_swap':
            eventName = 'ADF1_RADIO_SWAP';
            eventValue = 0;
            break;
        // Transponder
        case 'xpndr_set':
        case 'transponder_set':
            eventName = 'XPNDR_SET';
            eventValue = parseInt(code, 8); // Convert octal string to decimal
            break;
        case 'xpndr_ident':
            eventName = 'XPNDR_IDENT_TOGGLE';
            eventValue = 0;
            break;
        default:
            return res.status(400).json({ success: false, error: `Unknown radio action: ${radio}/${action}` });
    }

    const eventId = eventMap[eventName];
    if (eventId !== undefined) {
        try {
            simConnectConnection.transmitClientEvent(0, eventId, eventValue, 1, 16);
            console.log(`[Radio] ${eventName} = ${eventValue}`);
            res.json({ success: true, event: eventName, value: eventValue });
        } catch (e) {
            console.error(`[Radio] Error:`, e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        res.status(400).json({ success: false, error: `Event ${eventName} not mapped` });
    }
});

// Set transponder state (STBY=1, ON=3, ALT=4, GND=5)
// MSFS has no K-event for mode, must write SimVar directly
app.post('/api/radio/xpdr/xpndr_state', (req, res) => {
    const state = parseInt(req.body.code || req.body.state);
    if (isNaN(state) || state < 0 || state > 5) {
        return res.status(400).json({ success: false, error: 'Invalid transponder state (0-5)' });
    }

    if (simConnectConnection) {
        try {
            // Write TRANSPONDER STATE:1 SimVar via SetDataOnSimObject
            // For now, update local state — SimConnect write requires data definition
            flightData.transponderState = state;
            console.log(`[Radio] XPDR State set to ${state}`);
            res.json({ success: true, state });
        } catch (e) {
            console.error(`[Radio] XPDR State error:`, e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        // Mock mode — just update local state
        flightData.transponderState = state;
        console.log(`[Radio] XPDR State set to ${state} (mock)`);
        res.json({ success: true, state });
    }
});

// Convert COM/NAV frequency (MHz) to BCD16 format
// e.g., 121.500 -> 0x2150 (121.50 with 1 implied)
function freqToBCD16(freq) {
    // COM frequencies: 118.000 - 136.975 MHz
    // NAV frequencies: 108.00 - 117.95 MHz
    // Remove the leading "1" and convert to BCD
    const mhz = parseFloat(freq);
    const adjusted = Math.round((mhz - 100) * 100); // e.g., 121.50 -> 2150
    // Convert to BCD16
    const digits = adjusted.toString().padStart(4, '0');
    let bcd = 0;
    for (let i = 0; i < 4; i++) {
        bcd = (bcd << 4) | parseInt(digits[i]);
    }
    return bcd;
}

// Convert ADF frequency (KHz) to BCD16 format
function adfToBCD16(freq) {
    const khz = parseInt(freq);
    const digits = khz.toString().padStart(4, '0');
    let bcd = 0;
    for (let i = 0; i < 4; i++) {
        bcd = (bcd << 4) | parseInt(digits[i]);
    }
    return bcd;
}

// Get current radio frequencies
app.get('/api/radio', (req, res) => {
    res.json({
        com1: { active: flightData.com1Active, standby: flightData.com1Standby },
        com2: { active: flightData.com2Active, standby: flightData.com2Standby },
        nav1: { active: flightData.nav1Active, standby: flightData.nav1Standby },
        nav2: { active: flightData.nav2Active, standby: flightData.nav2Standby },
        adf: { active: flightData.adfActive, standby: flightData.adfStandby },
        transponder: flightData.transponder,
        dme1: { distance: flightData.dme1Distance, speed: flightData.dme1Speed },
        dme2: { distance: flightData.dme2Distance, speed: flightData.dme2Speed }
    });
});

// Extended radio/ATC data for ATC widget
app.get('/api/radios', (req, res) => {
    res.json({
        com1ActiveFreq: flightData.com1Active,
        com1StandbyFreq: flightData.com1Standby,
        com2ActiveFreq: flightData.com2Active,
        com2StandbyFreq: flightData.com2Standby,
        nav1ActiveFreq: flightData.nav1Active,
        nav1StandbyFreq: flightData.nav1Standby,
        nav2ActiveFreq: flightData.nav2Active,
        nav2StandbyFreq: flightData.nav2Standby,
        transponderCode: flightData.transponder,
        transponderState: flightData.transponderState || 4,
        transponderIdent: flightData.transponderIdent || 0,
        atcId: flightData.atcId || '',
        atcFlightNumber: flightData.atcFlightNumber || '',
        atcType: flightData.atcType || ''
    });
});

// Traffic data for Traffic Radar widget (simulated for demo)
let trafficData = [];
let lastTrafficUpdate = 0;

// Generate simulated traffic around current position
function generateSimulatedTraffic(ownLat, ownLon, ownAlt) {
    // Only regenerate every 5 seconds for consistency
    if (Date.now() - lastTrafficUpdate < 5000 && trafficData.length > 0) {
        // Update positions based on heading
        trafficData.forEach(t => {
            // Move targets by their groundspeed
            const nmPerSec = t.groundSpeed / 3600;
            const distNm = nmPerSec * 5; // 5 second movement
            const hdgRad = t.heading * Math.PI / 180;
            t.lat += distNm * Math.cos(hdgRad) / 60;
            t.lon += distNm * Math.sin(hdgRad) / (60 * Math.cos(t.lat * Math.PI / 180));
            // Update relative altitude and distance
            t.altitude = (t.absAlt || ownAlt + t.altitude) - ownAlt;
            t.distance = Math.sqrt(
                Math.pow((t.lat - ownLat) * 60, 2) +
                Math.pow((t.lon - ownLon) * 60 * Math.cos(ownLat * Math.PI / 180), 2)
            );
        });
        // Remove targets that moved too far
        trafficData = trafficData.filter(t => t.distance <= 15);
        return trafficData;
    }

    lastTrafficUpdate = Date.now();
    const callsigns = ['AAL', 'DAL', 'UAL', 'SWA', 'JBU', 'FFT', 'SKW', 'RPA', 'ASA', 'VRD'];
    const count = 3 + Math.floor(Math.random() * 4); // 3-6 targets
    const targets = [];

    for (let i = 0; i < count; i++) {
        const bearing = Math.random() * 360;
        const distance = 1 + Math.random() * 9; // 1-10nm
        const bearingRad = bearing * Math.PI / 180;

        // Calculate position
        const lat = ownLat + (distance * Math.cos(bearingRad)) / 60;
        const lon = ownLon + (distance * Math.sin(bearingRad)) / (60 * Math.cos(ownLat * Math.PI / 180));

        // Random altitude offset (-2000 to +2000 ft relative)
        const altOffset = Math.round((Math.random() * 4000 - 2000) / 100) * 100;
        const absAlt = ownAlt + altOffset;

        // Random heading and speed
        const heading = Math.floor(Math.random() * 36) * 10;
        const groundSpeed = 150 + Math.floor(Math.random() * 300); // 150-450 kts

        // Random vertical speed
        const verticalSpeed = Math.random() < 0.6 ? 0 :
            (Math.random() < 0.5 ? 500 + Math.random() * 1500 : -500 - Math.random() * 1500);

        targets.push({
            id: `${callsigns[Math.floor(Math.random() * callsigns.length)]}${100 + Math.floor(Math.random() * 900)}`,
            lat,
            lon,
            absAlt, // Store absolute altitude for updates
            altitude: altOffset, // Relative altitude
            distance,
            relBearing: bearing,
            heading,
            groundSpeed,
            verticalSpeed: Math.round(verticalSpeed)
        });
    }

    trafficData = targets;
    return targets;
}

app.get('/api/traffic', (req, res) => {
    // Generate simulated traffic based on own position
    const ownLat = flightData.latitude || 40.6413;
    const ownLon = flightData.longitude || -73.7781;
    const ownAlt = flightData.altitude || 5000;

    const traffic = generateSimulatedTraffic(ownLat, ownLon, ownAlt);

    res.json({
        traffic,
        count: traffic.length,
        ownPosition: {
            latitude: ownLat,
            longitude: ownLon,
            altitude: ownAlt,
            heading: flightData.heading || 0
        }
    });
});

// Failures data for Failures Monitor widget
app.get('/api/failures', (req, res) => {
    const failures = [];

    // Check engine status
    if (flightData.eng1Combustion === false) {
        failures.push({ system: 'engine1', name: 'Engine 1', detail: 'No combustion' });
    }
    if (flightData.eng2Combustion === false) {
        failures.push({ system: 'engine2', name: 'Engine 2', detail: 'No combustion' });
    }

    // Check electrical
    if (flightData.electricalMainBusVoltage < 20) {
        failures.push({ system: 'electrical', name: 'Electrical', detail: `Low voltage: ${flightData.electricalMainBusVoltage?.toFixed(1) || 0}V` });
    }

    // Check fuel
    if (flightData.fuelTotal < 100) {
        failures.push({ system: 'fuel', name: 'Fuel', detail: 'Critically low' });
    }

    res.json({
        activeFailures: failures,
        systems: {
            engine1: flightData.eng1Combustion !== false ? 'ok' : 'fail',
            engine2: flightData.eng2Combustion !== false ? 'ok' : 'fail',
            electrical: (flightData.electricalMainBusVoltage || 28) >= 20 ? 'ok' : 'fail',
            hydraulic: 'ok',
            fuel: (flightData.fuelTotal || 1000) >= 100 ? 'ok' : 'fail',
            avionics: 'ok',
            gear: 'ok',
            flaps: 'ok'
        }
    });
});

// Shared Cockpit sync endpoint
const cockpitSessions = new Map();

app.get('/api/cockpit/sessions', (req, res) => {
    const sessions = [];
    cockpitSessions.forEach((session, id) => {
        sessions.push({ id, ...session, clients: session.clients?.length || 0 });
    });
    res.json({ sessions });
});

app.post('/api/cockpit/create', (req, res) => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    cockpitSessions.set(sessionId, {
        created: Date.now(),
        host: req.body.host || 'Unknown',
        clients: [],
        state: {}
    });
    res.json({ sessionId, success: true });
});

app.post('/api/cockpit/join/:sessionId', (req, res) => {
    const session = cockpitSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    session.clients.push({ joined: Date.now(), name: req.body.name || 'Guest' });
    res.json({ success: true, session });
});

app.get('/api/cockpit/state/:sessionId', (req, res) => {
    const session = cockpitSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ state: session.state, flightData });
});

app.post('/api/cockpit/sync/:sessionId', (req, res) => {
    const session = cockpitSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    // Merge state updates
    session.state = { ...session.state, ...req.body.state };
    session.lastUpdate = Date.now();

    // Broadcast to WebSocket clients in this session
    wss.clients.forEach(client => {
        if (client.sessionId === req.params.sessionId && client.readyState === 1) {
            try {
                client.send(JSON.stringify({ type: 'cockpitSync', state: session.state, flightData }));
            } catch (_) {}
        }
    });

    res.json({ success: true });
});

// Camera control REST endpoint (vJoy)
app.post('/api/camera/:action', async (req, res) => {
    const action = req.params.action.toUpperCase();
    const commandMap = {
        'CINEMATIC': 'TCM',
        'NEXT': 'NCV',
        'PREV': 'PCV',
        'TOGGLE': 'VTG',
        'DRONE': 'DRN',
        'RESET': 'RST'
    };
    const cmd = commandMap[action] || action;
    const result = await executeCamera(cmd);
    res.json(result);
});

// Camera System REST endpoints (native MSFS camera control)
app.get('/api/camsys/state', (req, res) => {
    res.json(cameraSystem.getState());
});
app.get('/api/camsys/status', (req, res) => {
    res.json(cameraSystem.getState());
});

app.post('/api/camsys/:action', (req, res) => {
    const action = req.params.action.toLowerCase();
    const { value, duration, speed, slot, name } = req.body || {};
    
    try {
        switch (action) {
            // Basic views
            case 'cockpit':
            case 'vfr':
                cameraSystem.cockpitView();
                break;
            case 'ifr':
                cameraSystem.cockpitIFR();
                break;
            case 'landing':
                cameraSystem.cockpitLanding();
                break;
            case 'external':
            case 'chase':
                cameraSystem.externalView();
                break;
            case 'drone':
                cameraSystem.droneView();
                break;
            case 'topdown':
                cameraSystem.topDownView();
                break;
            case 'toggle':
                cameraSystem.toggleView();
                break;
            case 'cycle':
            case 'next':
                cameraSystem.cycleViews();
                break;
            case 'prev':
                cameraSystem.prevView();
                break;
            
            // Cinematic modes
            case 'flyby':
                cameraSystem.startFlyby(duration || 8000);
                break;
            case 'orbit':
                cameraSystem.startOrbit(speed || 10);
                break;
            case 'stop':
                cameraSystem.stopAllModes();
                break;
            
            // Adjustments
            case 'zoomin':
                cameraSystem.zoomIn();
                break;
            case 'zoomout':
                cameraSystem.zoomOut();
                break;
            case 'reset':
                cameraSystem.resetCamera();
                break;
            case 'panleft':
                cameraSystem.panLeft();
                break;
            case 'panright':
                cameraSystem.panRight();
                break;
            case 'panup':
                cameraSystem.panUp();
                break;
            case 'pandown':
                cameraSystem.panDown();
                break;
            
            // Presets
            case 'save':
                cameraSystem.savePreset(name || 'Preset', slot || 1);
                break;
            case 'load':
                cameraSystem.loadPreset(slot || 1);
                break;
            
            // Smart camera
            case 'smart':
            case 'lock':
                cameraSystem.enableSmartCamera();
                break;
            case 'smartnext':
            case 'nexttarget':
                cameraSystem.nextSmartTarget();
                break;
            case 'smartprev':
            case 'prevtarget':
                cameraSystem.prevSmartTarget();
                break;
            
            default:
                res.json({ success: false, error: `Unknown action: ${action}` });
                return;
        }
        res.json({ success: true, action, state: cameraSystem.getState() });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ==================== WASM CAMERA API ====================
// Communicates with WASM module via LVars

let wasmCameraReady = false;
let wasmCameraStatus = 0;

// WASM Camera command endpoint
app.post('/api/wasm-camera', (req, res) => {
    const { action, smooth } = req.body;
    console.log(`[WASM Camera] Action: ${action}, Smooth: ${smooth}`);
    
    if (!simConnectConnection) {
        res.json({ success: false, error: 'SimConnect not connected' });
        return;
    }
    
    try {
        // Command values matching WASM enum
        const commands = {
            'flyby': 1,
            'tower': 2,
            'toggle': 3,
            'next': 4,
            'reset': 5
        };
        
        const cmdValue = commands[action];
        if (cmdValue === undefined) {
            res.json({ success: false, error: `Unknown action: ${action}` });
            return;
        }
        
        // Set smoothing if provided
        if (smooth !== undefined) {
            setLVar('SIMWIDGET_CAM_SMOOTH', Math.max(0, Math.min(100, smooth)));
        }

        // Send command
        setLVar('SIMWIDGET_CAM_CMD', cmdValue);
        
        res.json({ success: true, action, command: cmdValue });
    } catch (e) {
        console.error('[WASM Camera] Error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// WASM Camera status endpoint
app.get('/api/wasm-camera/status', (req, res) => {
    res.json({
        ready: wasmCameraReady,
        status: wasmCameraStatus,
        modes: { 0: 'off', 1: 'cinematic', 2: 'flyby', 3: 'tower', 4: 'manual' }
    });
});

// Helper to set LVar via Lorby AAO WebAPI (port 43380)
let lorbyConnected = false;

async function checkLorby() {
    try {
        const res = await fetch('http://localhost:43380/webapi?conn=1');
        const text = await res.text();
        lorbyConnected = text.includes('OK');
        if (lorbyConnected) console.log('[Lorby] Connected');
    } catch (e) {
        lorbyConnected = false;
    }
}

function setLVar(name, value) {
    // Lorby AAO uses RPN script format: value (>L:name)
    const script = `${value} (>L:${name})`;
    const url = `http://localhost:43380/webapi?evt=${encodeURIComponent(script)}`;
    
    http.get(url, (res) => {
        console.log(`[Lorby] Set L:${name} = ${value}`);
    }).on('error', (err) => {
        console.log(`[Lorby] Error setting ${name}:`, err.message);
    });
}

async function getLVar(name) {
    try {
        const res = await fetch(`http://localhost:43380/webapi?var=(L:${name})`);
        const text = await res.text();
        return parseFloat(text) || 0;
    } catch (e) {
        return 0;
    }
}

// Check Lorby connection on startup
checkLorby();
setInterval(checkLorby, 10000);

// Poll WASM camera status
setInterval(async () => {
    if (lorbyConnected) {
        wasmCameraReady = (await getLVar('SIMWIDGET_CAM_READY')) === 1;
        wasmCameraStatus = await getLVar('SIMWIDGET_CAM_STATUS');
    }
}, 2000);

// Flight Recorder Position Set endpoint
app.post('/api/recorder/position', (req, res) => {
    const { lat, lon, alt, hdg, pitch, bank, spd } = req.body;
    console.log(`[Recorder] Set position: lat=${lat}, lon=${lon}, alt=${alt}, hdg=${hdg}`);
    
    if (!simConnectConnection) {
        res.json({ success: false, error: 'SimConnect not connected' });
        return;
    }
    
    try {
        const { RawBuffer } = require('node-simconnect');
        // Write 7 FLOAT64 values (56 bytes)
        const rawBuffer = new RawBuffer(56);
        rawBuffer.writeFloat64(lat || 0);
        rawBuffer.writeFloat64(lon || 0);
        rawBuffer.writeFloat64(alt || 0);
        rawBuffer.writeFloat64(hdg || 0);
        rawBuffer.writeFloat64(pitch || 0);
        rawBuffer.writeFloat64(bank || 0);
        rawBuffer.writeFloat64(spd || 0);
        
        const dataPacket = { tagged: false, arrayCount: 0, buffer: rawBuffer };
        simConnectConnection.setDataOnSimObject(12, 0, dataPacket);
        
        res.json({ success: true });
    } catch (e) {
        console.error('[Recorder] Position set error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Flight Recorder Slew Mode endpoint
app.post('/api/recorder/slew', (req, res) => {
    const { enabled } = req.body;
    console.log(`[Recorder] Slew mode: ${enabled ? 'ON' : 'OFF'}`);
    
    if (!simConnectConnection) {
        res.json({ success: false, error: 'SimConnect not connected' });
        return;
    }
    
    try {
        const eventName = enabled ? 'SLEW_ON' : 'SLEW_OFF';
        const eventId = eventMap[eventName];
        if (eventId) {
            simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
            res.json({ success: true, slew: enabled });
        } else {
            res.json({ success: false, error: 'Slew event not mapped' });
        }
    } catch (e) {
        console.error('[Recorder] Slew error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// ==================== ENVIRONMENT API ====================

// Set time of day
app.post('/api/environment/time', (req, res) => {
    const { hours, minutes } = req.body;
    console.log(`[Environment] Set time: ${hours}:${minutes}`);

    if (!simConnectConnection) {
        return res.json({ success: false, error: 'SimConnect not connected' });
    }

    try {
        // ZULU_HOURS_SET and ZULU_MINUTES_SET
        const hoursEventId = eventMap['ZULU_HOURS_SET'];
        const minutesEventId = eventMap['ZULU_MINUTES_SET'];

        if (hoursEventId) {
            simConnectConnection.transmitClientEvent(0, hoursEventId, hours, 1, 16);
        }
        if (minutesEventId) {
            simConnectConnection.transmitClientEvent(0, minutesEventId, minutes, 1, 16);
        }

        res.json({ success: true, time: { hours, minutes } });
    } catch (e) {
        console.error('[Environment] Time error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Set weather preset
app.post('/api/environment/weather', async (req, res) => {
    const { preset } = req.body;
    console.log(`[Environment] Set weather: ${preset}`);

    // Weather preset mapping for MSFS 2024
    // Uses weather panel keyboard navigation
    const presetConfig = {
        clear: { name: 'Clear Skies', clouds: 0, precip: 0 },
        fewclouds: { name: 'Few Clouds', clouds: 1, precip: 0 },
        scattered: { name: 'Scattered', clouds: 2, precip: 0 },
        broken: { name: 'Broken', clouds: 3, precip: 0 },
        overcast: { name: 'Overcast', clouds: 4, precip: 0 },
        rain: { name: 'Rain', clouds: 4, precip: 1 },
        storm: { name: 'Thunderstorm', clouds: 4, precip: 2 },
        snow: { name: 'Snow', clouds: 4, precip: 3 },
        fog: { name: 'Fog', clouds: 0, precip: 0, visibility: 1 }
    };

    if (!presetConfig[preset]) {
        return res.json({ success: false, error: 'Unknown weather preset' });
    }

    try {
        // Method 1: Try SimConnect weather events if available
        if (simConnectConnection && eventMap['SET_WEATHER_PRESET']) {
            const presetIndex = Object.keys(presetConfig).indexOf(preset);
            simConnectConnection.transmitClientEvent(0, eventMap['SET_WEATHER_PRESET'], presetIndex, 1, 16);
            return res.json({ success: true, preset, method: 'simconnect' });
        }

        // Method 2: Log the weather change (preset already validated against whitelist above)
        const presetName = presetConfig[preset].name;
        console.log(`[Weather] Setting weather to: ${presetName}`);

        // Return success - weather changes are UI-only until MSFS SDK improves
        res.json({
            success: true,
            preset,
            method: 'ui-state',
            note: 'Weather UI updated. Full weather control requires MSFS menu.'
        });
    } catch (e) {
        console.error('[Environment] Weather error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Capture current weather to .WPR file (Phase 3: Weather Capture)
app.get('/api/environment/capture-weather', (req, res) => {
    console.log('[Environment] Capturing current weather to .WPR format');

    if (!flightData) {
        return res.status(503).json({ success: false, error: 'No flight data available' });
    }

    const { name = 'Captured Weather' } = req.query;

    try {
        // Convert current weather data to .WPR XML format
        const tempK = (flightData.temperature || 15) + 273.15; // Celsius to Kelvin
        const pressurePa = Math.round((flightData.pressure || 29.92) * 3386.39); // inHg to Pascals
        const visMeter = flightData.visibility || 10000; // meters
        const precipMmH = flightData.precipRate || 0; // mm/h
        const windDir = Math.round(flightData.windDir || 0);
        const windSpd = Math.round(flightData.windSpeed || 0);
        const inCloud = flightData.inCloud || false;

        // Determine cloud layers based on conditions
        let cloudLayers = '';
        if (inCloud || precipMmH > 0) {
            // Overcast conditions
            cloudLayers = `
        <!-- Low overcast layer -->
        <CloudLayer>
            <CloudLayerAltitudeBot value="300" unit="m"/><!-- ~1000ft -->
            <CloudLayerAltitudeTop value="600" unit="m"/><!-- ~2000ft -->
            <CloudLayerDensity value="0.9" unit="(0 - 1)"/>
            <CloudLayerScattering value="0.85" unit="(0 - 1)"/>
        </CloudLayer>`;
        } else if (visMeter < 5000) {
            // Scattered clouds
            cloudLayers = `
        <!-- Scattered clouds -->
        <CloudLayer>
            <CloudLayerAltitudeBot value="1000" unit="m"/><!-- ~3300ft -->
            <CloudLayerAltitudeTop value="1500" unit="m"/><!-- ~5000ft -->
            <CloudLayerDensity value="0.5" unit="(0 - 1)"/>
            <CloudLayerScattering value="0.6" unit="(0 - 1)"/>
        </CloudLayer>`;
        } else {
            // Few clouds at altitude
            cloudLayers = `
        <!-- Few scattered clouds -->
        <CloudLayer>
            <CloudLayerAltitudeBot value="1500" unit="m"/><!-- ~5000ft -->
            <CloudLayerAltitudeTop value="1800" unit="m"/><!-- ~6000ft -->
            <CloudLayerDensity value="0.2" unit="(0 - 1)"/>
            <CloudLayerScattering value="0.4" unit="(0 - 1)"/>
        </CloudLayer>`;
        }

        // Determine precipitation type
        let precipType = 'RAIN';
        if (tempK < 275) precipType = 'SNOW'; // Below 2°C

        const precipitationLine = precipMmH > 0
            ? `<Precipitations>${precipMmH.toFixed(1)}</Precipitations>\n        <PrecipitationType>${precipType}</PrecipitationType>`
            : `<Precipitations>0</Precipitations>`;

        // Build .WPR XML
        const wprXml = `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="WeatherPreset" version="1,3">
    <Descr>AceXML Document</Descr>
    <WeatherPreset.Preset>
        <!-- Metadata -->
        <Name>${name}</Name>
        <Order>20</Order>
        <LoadingTip>Captured from live conditions</LoadingTip>
        <LiveID>WEATHER_UNKNOWN</LiveID>

        <!-- Atmospheric Conditions -->
        <IsAltitudeAMGL>False</IsAltitudeAMGL>
        <MSLPressure>${pressurePa}</MSLPressure><!-- ${flightData.pressure?.toFixed(2)} inHg -->
        <MSLTemperature>${tempK.toFixed(2)}</MSLTemperature><!-- ${flightData.temperature?.toFixed(1)}°C -->
        <AerosolDensity>${inCloud ? '0.8' : '0.3'}</AerosolDensity>
        ${precipitationLine}
        <SnowCover>0</SnowCover>
        <ThunderstormIntensity>${precipMmH > 5 ? '0.3' : '0'}</ThunderstormIntensity>
${cloudLayers}

        <!-- Surface wind -->
        <WindLayer>
            <WindLayerAltitude value="0" unit="m"/>
            <WindLayerAngle value="${windDir}" unit="degrees"/>
            <WindLayerSpeed value="${windSpd}" unit="knts"/>
        </WindLayer>

        <!-- Upper wind (estimated from surface) -->
        <WindLayer>
            <WindLayerAltitude value="3000" unit="m"/>
            <WindLayerAngle value="${(windDir + 20) % 360}" unit="degrees"/>
            <WindLayerSpeed value="${Math.round(windSpd * 1.5)}" unit="knts"/>
        </WindLayer>
    </WeatherPreset.Preset>
</SimBase.Document>
`;

        // Return as downloadable XML file
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-zA-Z0-9]/g, '_')}.wpr"`);
        res.send(wprXml);

        console.log(`[Environment] Generated .WPR file: ${name}`);
    } catch (e) {
        console.error('[Environment] Weather capture error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Set sim rate
app.post('/api/environment/simrate', (req, res) => {
    const { rate } = req.body;
    console.log(`[Environment] Set sim rate: ${rate}x`);

    if (!simConnectConnection) {
        return res.json({ success: false, error: 'SimConnect not connected' });
    }

    try {
        // SIM_RATE_SET or SIM_RATE_INCR/SIM_RATE_DECR
        const setEventId = eventMap['SIM_RATE_SET'];
        if (setEventId) {
            // Sim rate is set as a multiplier (1 = normal, 2 = 2x, etc.)
            simConnectConnection.transmitClientEvent(0, setEventId, Math.round(rate * 256), 1, 16);
            res.json({ success: true, rate });
        } else {
            // Try increment/decrement approach
            res.json({ success: false, error: 'SIM_RATE events not mapped' });
        }
    } catch (e) {
        console.error('[Environment] Sim rate error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Pause/Resume
app.post('/api/environment/pause', (req, res) => {
    const { paused } = req.body;
    console.log(`[Environment] ${paused ? 'Pause' : 'Resume'}`);

    if (!simConnectConnection) {
        return res.json({ success: false, error: 'SimConnect not connected' });
    }

    try {
        const eventName = paused ? 'PAUSE_ON' : 'PAUSE_OFF';
        const eventId = eventMap[eventName];
        if (eventId) {
            simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
            res.json({ success: true, paused });
        } else {
            // Try PAUSE_TOGGLE
            const toggleId = eventMap['PAUSE_TOGGLE'];
            if (toggleId) {
                simConnectConnection.transmitClientEvent(0, toggleId, 0, 1, 16);
                res.json({ success: true, paused });
            } else {
                res.json({ success: false, error: 'Pause event not mapped' });
            }
        }
    } catch (e) {
        console.error('[Environment] Pause error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Repair aircraft
app.post('/api/environment/repair', (req, res) => {
    console.log('[Environment] Repair aircraft');

    if (!simConnectConnection) {
        return res.json({ success: false, error: 'SimConnect not connected' });
    }

    try {
        const eventId = eventMap['REPAIR_AND_REFUEL'];
        if (eventId) {
            simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
            res.json({ success: true, action: 'repair' });
        } else {
            res.json({ success: false, error: 'Repair event not mapped' });
        }
    } catch (e) {
        console.error('[Environment] Repair error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// Refuel aircraft
app.post('/api/environment/refuel', (req, res) => {
    console.log('[Environment] Refuel aircraft');

    if (!simConnectConnection) {
        return res.json({ success: false, error: 'SimConnect not connected' });
    }

    try {
        // FUEL_SELECTOR_ALL or ADD_FUEL_QUANTITY
        const eventId = eventMap['REPAIR_AND_REFUEL'] || eventMap['ADD_FUEL_QUANTITY'];
        if (eventId) {
            simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
            res.json({ success: true, action: 'refuel' });
        } else {
            res.json({ success: false, error: 'Refuel event not mapped' });
        }
    } catch (e) {
        console.error('[Environment] Refuel error:', e.message);
        res.json({ success: false, error: e.message });
    }
});

// ==================== KEYMAP API ====================

const keySender = require('./key-sender');

// Get all keymaps
app.get('/api/keymaps', (req, res) => {
    res.json({
        keymaps: keySender.getKeymaps(),
        conflicts: keySender.getConflicts()
    });
});

// Check for key conflicts
app.get('/api/keymaps/conflicts', (req, res) => {
    res.json({ conflicts: keySender.getConflicts() });
});

// Get keymaps for a specific category
app.get('/api/keymaps/:category', (req, res) => {
    const keymaps = keySender.getKeymaps();
    const category = req.params.category;
    if (keymaps[category]) {
        res.json(keymaps[category]);
    } else {
        res.status(404).json({ error: `Category '${category}' not found` });
    }
});

// Update a keymap
app.post('/api/keymaps/:category/:action', (req, res) => {
    const { category, action } = req.params;
    const { field, value, key } = req.body;
    
    // Support both old format (key) and new format (field, value)
    const targetField = field || 'key';
    const targetValue = value || key;
    
    if (!targetValue) {
        res.status(400).json({ error: 'Missing value in request body' });
        return;
    }
    
    const result = keySender.updateKeymap(category, action, targetValue, targetField);
    res.json({ 
        success: true, 
        category, 
        action, 
        field: targetField,
        value: targetValue,
        conflict: result.conflict || null,
        warning: result.conflict ? `Key already used by ${result.conflict.category}.${result.conflict.action}` : null
    });
});

// Add new keymap entry
app.post('/api/keymaps/:category', (req, res) => {
    const { category } = req.params;
    const { name, key, trigger } = req.body;
    
    if (!name) {
        res.status(400).json({ error: 'Missing name in request body' });
        return;
    }
    
    const result = keySender.addKeymap(category, name, key || '', trigger || '');
    res.json({ success: true, ...result });
});

// Rename keymap entry
app.patch('/api/keymaps/:category/:id', (req, res) => {
    const { category, id } = req.params;
    const { name } = req.body;
    
    if (!name) {
        res.status(400).json({ error: 'Missing name in request body' });
        return;
    }
    
    const result = keySender.renameKeymap(category, id, name);
    res.json(result);
});

// Delete keymap entry
app.delete('/api/keymaps/:category/:id', (req, res) => {
    const { category, id } = req.params;
    const result = keySender.deleteKeymap(category, id);
    res.json(result);
});

// Export keymaps to v2.0 format (for rollback)
app.get('/api/keymaps/export/v2', (req, res) => {
    const v2 = keySender.exportToV2();
    res.json(v2);
});

// Save v2.0 backup file
app.post('/api/keymaps/export/v2', (req, res) => {
    const backupPath = path.join(__dirname, '..', 'config', 'keymaps-v2-backup.json');
    const result = keySender.saveAsV2(backupPath);
    res.json(result);
});

// Import keymaps from JSON file
app.post('/api/keymaps/import', (req, res) => {
    const importData = req.body;
    
    if (!importData || typeof importData !== 'object') {
        res.status(400).json({ error: 'Invalid import data' });
        return;
    }
    
    try {
        const result = keySender.importKeymaps(importData);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Send a custom key (for testing/widgets)
app.post('/api/sendkey', (req, res) => {
    const { key } = req.body;

    if (!key) {
        res.status(400).json({ error: 'Missing key in request body' });
        return;
    }

    // Validate key format: only allow alphanumeric, modifiers, and common key names
    // Prevents command injection when key is passed to PowerShell exec
    const KEY_PATTERN = /^[A-Za-z0-9_+\-\s]{1,50}$/;
    if (!KEY_PATTERN.test(key)) {
        res.status(400).json({ error: 'Invalid key format. Use alphanumeric characters and modifiers (e.g. ALT+Z, CTRL+SHIFT+F1)' });
        return;
    }

    keySender.sendKey(key)
        .then(() => res.json({ success: true, key }))
        .catch(e => res.json({ success: false, error: e.message }));
});

// ==================== DEBUG API ====================

// Get key send history
app.get('/api/debug/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({ history: keySender.getHistory(limit) });
});

// Clear history
app.delete('/api/debug/history', (req, res) => {
    keySender.clearHistory();
    res.json({ success: true, message: 'History cleared' });
});

// Toggle debug mode
app.post('/api/debug/mode', (req, res) => {
    const { enabled } = req.body;
    keySender.setDebug(enabled !== false);
    res.json({ debug: keySender.debug });
});

// Test a specific key without affecting sim (dry run info)
app.get('/api/debug/test/:category/:action', (req, res) => {
    const { category, action } = req.params;
    const key = keySender.getKey(category, action);
    res.json({
        category,
        action,
        key: key || null,
        found: !!key,
        wouldSend: key ? `powershell -ExecutionPolicy Bypass -File C:\\LLM-DevOSWE\\send-key.ps1 -Key ${key}` : null
    });
});

// Get camera action log
app.get('/api/debug/camera', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({
        state: cameraSystem.getState(),
        actionLog: cameraSystem.getActionLog(limit),
        keyHistory: keySender.getHistory(limit),
        keySenderStatus: keySender.getStatus()
    });
});

// Get key sender status
app.get('/api/debug/keysender', (req, res) => {
    res.json(keySender.getStatus());
});

// Set debug mode for both camera and key sender
app.post('/api/debug/camera', (req, res) => {
    const { enabled } = req.body;
    cameraSystem.setDebug(enabled !== false);
    res.json({ debug: cameraSystem.debug });
});

// Save pasted debug console output
app.post('/api/debug/save-paste', (req, res) => {
    try {
        const { content, timestamp, source } = req.body;
        const fs = require('fs');
        const path = require('path');

        const outputPath = path.join(__dirname, '..', 'debug-console.txt');
        const header = `=== Debug Console Paste ===\nTimestamp: ${timestamp || new Date().toISOString()}\nSource: ${source || 'unknown'}\n${'='.repeat(50)}\n\n`;

        fs.writeFileSync(outputPath, header + content, 'utf8');

        console.log(`[DEBUG] Saved paste to ${outputPath} (${content.length} chars)`);
        res.json({
            success: true,
            file: 'debug-console.txt',
            size: content.length,
            path: outputPath
        });
    } catch (error) {
        console.error('[DEBUG] Error saving paste:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug: InputEvent hashes
app.get('/api/debug/inputevents', (req, res) => {
    const hashes = global.inputEventHashes || {};
    const result = {};
    for (const [k, v] of Object.entries(hashes)) {
        result[k] = typeof v === 'bigint' ? v.toString() : v;
    }
    res.json(result);
});

app.get('/api/debug/held-axes', (req, res) => {
    const result = {};
    for (const [k, v] of Object.entries(_heldAxes)) {
        if (k.startsWith('_')) {
            result[k] = v;
        } else if (v && typeof v === 'object') {
            result[k] = { hash: typeof v.hash === 'bigint' ? v.hash.toString() : v.hash, value: v.value };
        } else {
            result[k] = v;
        }
    }
    res.json(result);
});

app.post('/api/debug/throttle-test', (req, res) => {
    if (!simConnectConnection) return res.json({ error: 'No SimConnect' });
    const method = req.query.method || 'all';
    const pct = parseInt(req.query.pct) || 80;
    const results = {};

    // Method 1: InputEvent ENGINE_THROTTLE_1
    const hash = global.inputEventHashes?.ENGINE_THROTTLE_1;
    if (hash && (method === 'all' || method === 'inputevent')) {
        try {
            simConnectConnection.setInputEvent(hash, pct / 100);
            results.inputEvent = { ok: true, hash: hash.toString(), value: pct / 100 };
        } catch (e) { results.inputEvent = { error: e.message }; }
    }

    // Method 2: SimVar write (definition 14)
    if (method === 'all' || method === 'simvar') {
        try {
            const { RawBuffer } = require('node-simconnect');
            const buf = new RawBuffer(8);
            buf.writeFloat64(pct);
            simConnectConnection.setDataOnSimObject(14, 0, { tagged: false, arrayCount: 0, buffer: buf });
            results.simvarWrite = { ok: true, defId: 14, value: pct };
        } catch (e) { results.simvarWrite = { error: e.message }; }
    }

    // Method 3: Legacy transmitClientEvent THROTTLE_SET
    if (method === 'all' || method === 'legacy') {
        const eid = eventMap['THROTTLE_SET'];
        if (eid !== undefined) {
            try {
                const simValue = Math.round((pct / 100) * 16383);
                simConnectConnection.transmitClientEvent(0, eid, simValue, 1, 16);
                results.legacy = { ok: true, eventId: eid, simValue };
            } catch (e) { results.legacy = { error: e.message }; }
        } else {
            results.legacy = { error: 'THROTTLE_SET not in eventMap' };
        }
    }

    // Method 4: AXIS_THROTTLE_SET (simulates joystick axis — may override hardware)
    if (method === 'all' || method === 'axis') {
        const eid = eventMap['AXIS_THROTTLE_SET'];
        if (eid !== undefined) {
            try {
                // AXIS events use -16383 to +16383 range (center = 0, full = 16383)
                const simValue = Math.round((pct / 100) * 16383);
                simConnectConnection.transmitClientEvent(0, eid, simValue, 1, 16);
                results.axisThrottle = { ok: true, eventId: eid, simValue };
            } catch (e) { results.axisThrottle = { error: e.message }; }
        } else {
            results.axisThrottle = { error: 'AXIS_THROTTLE_SET not in eventMap' };
        }
    }

    // Clear held axes to avoid interference
    delete _heldAxes.throttle;
    res.json(results);
});

// SimConnect command execution - events mapped during init
let eventMap = {};

function executeCommand(command, value) {
    // vJoy Camera commands - use virtual joystick for ChasePlane
    if (isCameraCommand(command)) {
        console.log(`[Camera] ${command} via vJoy`);
        executeCamera(command).then(result => {
            if (!result.success) {
                console.log(`[Camera] vJoy failed, trying keyboard fallback`);
                // Fallback to keyboard simulation
                if (command === 'KEY_TOGGLE_CINEMATIC' || command === 'TCM') {
                    exec('powershell -ExecutionPolicy Bypass -File "C:\\LLM-DevOSWE\\send-key.ps1" -Key "ALT+Z"');
                } else if (command === 'KEY_NEXT_CINEMATIC' || command === 'NCV') {
                    exec('powershell -ExecutionPolicy Bypass -File "C:\\LLM-DevOSWE\\send-key.ps1" -Key "ALT+X"');
                }
            }
        });
        return;
    }
    
    // Legacy camera commands (direct keyboard)
    if (command === 'KEY_TOGGLE_CINEMATIC') {
        console.log('[Camera] TCM - Alt+Z');
        exec('powershell -ExecutionPolicy Bypass -File "C:\\LLM-DevOSWE\\send-key.ps1" -Key "ALT+Z"');
        return;
    }
    if (command === 'KEY_NEXT_CINEMATIC') {
        console.log('[Camera] NCV - Alt+X');
        exec('powershell -ExecutionPolicy Bypass -File "C:\\LLM-DevOSWE\\send-key.ps1" -Key "ALT+X"');
        return;
    }
    if (command === 'VIEW_MODE') {
        // Use cmd /c start to run PowerShell with desktop access
        console.log('[Camera] VIEW_MODE via cmd start PowerShell');
        exec('cmd /c start /min powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\\LLM-DevOSWE\\simwidget-hybrid\\backend\\send-backspace.ps1"', (err, stdout, stderr) => {
            if (err) console.log('[Camera] Error:', err.message);
        });
        return;
    }
    
    if (!simConnectConnection) return;

    // MSFS 2024 mixture — auto mixture is enabled in sim, so mixture is managed by MSFS.
    // FUEL_MIXTURE_1 InputEvent is enumerated but does NOT actually control mixture lever.
    // Just log and return — don't fight the sim's auto mixture system.
    if (command === 'MIXTURE_SET' || command === 'MIXTURE_RICH' || command === 'MIXTURE_LEAN' || command === 'AXIS_MIXTURE_SET') {
        // No-op: MSFS auto mixture handles this
        return;
    }

    // MSFS 2024 throttle — use InputEvent ENGINE_THROTTLE_1
    // SimVar write doesn't work (GENERAL ENG THROTTLE LEVER POSITION:1 is read-only).
    // Hardware flight devices must be disabled via scheduled task to prevent override.
    if (command === 'THROTTLE_SET' || command === 'THROTTLE1_SET') {
        const percent = Math.max(0, Math.min(100, value || 0));
        const normalized = percent / 100; // InputEvent uses 0.0–1.0
        const hash = global.inputEventHashes?.ENGINE_THROTTLE_1;
        if (hash) {
            try {
                simConnectConnection.setInputEvent(hash, normalized);
                // Store for 120Hz re-application (holds value against any remaining hardware)
                if (percent === 0) {
                    delete _heldAxes.throttle;
                } else {
                    _heldAxes.throttle = { hash, value: normalized };
                }
                updateHeldAxesTimer();
                console.log(`[Throttle] InputEvent: ${percent}% (${normalized})`);
            } catch (e) {
                console.error(`[Throttle] InputEvent error: ${e.message}`);
            }
        } else {
            console.warn('[Throttle] ENGINE_THROTTLE_1 hash not available yet');
        }
        return;
    }

    // MSFS 2024 elevator trim via HANDLING InputEvent — preferred for takeoff rotation
    // HANDLING category InputEvents control actual flight dynamics (not cosmetic)
    if (command === 'ELEV_TRIM_INPUT') {
        const hash = global.inputEventHashes?.HANDLING_ELEVATORTRIM_WHEEL;
        if (hash) {
            try {
                // value: -100 to 100 → -1.0 to 1.0
                const normalized = Math.max(-1, Math.min(1, (value || 0) / 100));
                simConnectConnection.setInputEvent(hash, normalized);
                console.log(`[ElevTrim] InputEvent: ${value}% (${normalized}) via HANDLING_ELEVATORTRIM_WHEEL`);
            } catch (e) {
                console.error(`[ElevTrim] InputEvent error: ${e.message}`);
            }
        }
        return;
    }

    // MSFS 2024 flaps via HANDLING InputEvent
    if (command === 'FLAPS_INPUT') {
        const hash = global.inputEventHashes?.HANDLING_FLAPS;
        if (hash) {
            try {
                // value: 0 to 100 → 0.0 to 1.0
                const normalized = Math.max(0, Math.min(1, (value || 0) / 100));
                simConnectConnection.setInputEvent(hash, normalized);
                console.log(`[Flaps] InputEvent: ${value}% (${normalized}) via HANDLING_FLAPS`);
            } catch (e) {
                console.error(`[Flaps] InputEvent error: ${e.message}`);
            }
        }
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MSFS 2024 FLIGHT CONTROLS — LOCKED CONVENTIONS (verified 2026-02-12)
    // DO NOT CHANGE these values, names, signs, or methods without express
    // written consent from the user. Each was individually tested in-sim.
    //
    // ┌──────────┬────────────┬──────────────────────────────────────────┐
    // │ Control  │ Method     │ Convention (input -100..+100)            │
    // ├──────────┼────────────┼──────────────────────────────────────────┤
    // │ Throttle │ InputEvent │ 0..100 → 0.0..1.0 ENGINE_THROTTLE_1    │
    // │ Elevator │ Legacy     │ -100=nose UP, +100=nose DOWN (NEGATED)  │
    // │          │            │ transmitClientEvent AXIS_ELEVATOR_SET   │
    // │ Ailerons │ Legacy     │ -100=roll LEFT, +100=roll RIGHT         │
    // │          │            │ transmitClientEvent AXIS_AILERONS_SET   │
    // │ Rudder   │ Legacy     │ +100=yaw LEFT, -100=yaw RIGHT          │
    // │          │            │ transmitClientEvent AXIS_RUDDER_SET     │
    // └──────────┴────────────┴──────────────────────────────────────────┘
    //
    // NOTE: UNKNOWN_TAIL_ELEVATOR and UNKNOWN_AILERON_LEFT/RIGHT InputEvents
    // do NOT produce actual control surface deflection in MSFS 2024. All
    // flight surface controls use legacy transmitClientEvent path.
    //
    // Elevator sign: SimConnect AXIS_ELEVATOR_SET uses -16383=nose UP (aft stick),
    // +16383=nose DOWN (forward stick). Rule engine uses -100=nose UP, same direction.
    // NO negation needed — pass through directly.
    // ═══════════════════════════════════════════════════════════════════════
    if (command === 'AXIS_ELEVATOR_SET') {
        // MSFS 2024: UNKNOWN_TAIL_ELEVATOR InputEvent does NOT deflect elevator.
        // Use legacy transmitClientEvent — same as ailerons and rudder.
        const elevEventId = eventMap['AXIS_ELEVATOR_SET'];
        if (elevEventId !== undefined) {
            const simValue = Math.round((value || 0) / 100 * 16383);
            // Store for 60Hz re-application (overcomes joystick spring-center)
            if (value === 0) {
                delete _heldAxes.elevator;
            } else {
                _heldAxes.elevator = { eventId: elevEventId, value: simValue, legacy: true };
            }
            updateHeldAxesTimer();
            simConnectConnection.transmitClientEvent(0, elevEventId, simValue, 1, 16);
            console.log(`[Elevator] Legacy: ${value}% → ${simValue}`);
        }
        return;
    }
    if (command === 'AXIS_RUDDER_SET') {
        const rudderEventId = eventMap['AXIS_RUDDER_SET'];
        if (rudderEventId !== undefined) {
            const simValue = Math.round((value || 0) / 100 * 16383);
            // Store for 60Hz re-application (overcomes joystick spring-center)
            if (value === 0) {
                delete _heldAxes.rudder;
            } else {
                _heldAxes.rudder = { eventId: rudderEventId, value: simValue, legacy: true };
            }
            updateHeldAxesTimer();
            simConnectConnection.transmitClientEvent(0, rudderEventId, simValue, 1, 16);
            console.log(`[Rudder] Legacy: ${value}% → ${simValue}`);
        }
        return;
    }
    if (command === 'STEERING_SET') {
        const steerEventId = eventMap['STEERING_SET'];
        if (steerEventId !== undefined) {
            const simValue = Math.round((value || 0) / 100 * 16383);
            if (value === 0) {
                delete _heldAxes.steering;
            } else {
                _heldAxes.steering = { eventId: steerEventId, value: simValue, legacy: true };
            }
            updateHeldAxesTimer();
            simConnectConnection.transmitClientEvent(0, steerEventId, simValue, 1, 16);
        }
        return;
    }
    if (command === 'AXIS_AILERONS_SET') {
        // MSFS 2024: UNKNOWN_AILERON_LEFT/RIGHT InputEvents do NOT control ailerons.
        // Use legacy transmitClientEvent path — same as rudder.
        const ailEventId = eventMap['AXIS_AILERONS_SET'];
        if (ailEventId !== undefined) {
            const simValue = Math.round((value || 0) / 100 * 16383);
            // Store for 60Hz re-application (overcomes joystick spring-center)
            if (value === 0) {
                delete _heldAxes.ailerons;
            } else {
                _heldAxes.ailerons = { eventId: ailEventId, value: simValue, legacy: true };
            }
            updateHeldAxesTimer();
            simConnectConnection.transmitClientEvent(0, ailEventId, simValue, 1, 16);
            console.log(`[Ailerons] Legacy: ${value}% → ${simValue}`);
        }
        return;
    }
    // MSFS 2024 parking brake via InputEvent (LANDING_GEAR_PARKINGBRAKE)
    // Legacy PARKING_BRAKES event may not work — also try InputEvent as fallback
    if (command === 'PARKING_BRAKES' || command === 'PARKING_BRAKE_SET') {
        const hash = global.inputEventHashes?.LANDING_GEAR_PARKINGBRAKE;
        if (hash) {
            try {
                // InputEvent toggle: 0 = release, 1 = engage
                const ieValue = (command === 'PARKING_BRAKE_SET') ? (value ? 1 : 0) : 0;
                simConnectConnection.setInputEvent(hash, ieValue);
                console.log(`[ParkBrake] InputEvent LANDING_GEAR_PARKINGBRAKE: ${ieValue}`);
            } catch (e) {
                console.error(`[ParkBrake] InputEvent error: ${e.message}`);
            }
        }
        // Also fall through to legacy event below (belt and suspenders)
    }

    // MSFS 2024 quick preflight - removes chocks, covers, completes preflight
    // This sets the aircraft to "ready to fly" state, bypassing walk-around
    if (command === 'QUICK_PREFLIGHT') {
        const eventId = eventMap['QUICK_PREFLIGHT'];
        if (eventId !== undefined) {
            try {
                // Toggle event - no value needed (simValue = 0)
                simConnectConnection.transmitClientEvent(0, eventId, 0, 1, 16);
                console.log(`[QuickPreflight] Aircraft ready for taxi (chocks/covers removed)`);
            } catch (e) {
                console.error(`[QuickPreflight] Event error: ${e.message}`);
            }
        }
        return;
    }

    // Differential braking for ground steering — not affected by joystick rudder axis
    if (command === 'AXIS_LEFT_BRAKE_SET' || command === 'AXIS_RIGHT_BRAKE_SET') {
        const brakeEventId = eventMap[command];
        if (brakeEventId !== undefined) {
            // 0-100% → 0-16383
            const simValue = Math.round(Math.max(0, Math.min(100, value || 0)) / 100 * 16383);
            simConnectConnection.transmitClientEvent(0, brakeEventId, simValue, 1, 16);
            if (value > 5) console.log(`[Brake] ${command}: ${value}% → ${simValue}`);
        }
        return;
    }

    const eventId = eventMap[command];
    if (eventId !== undefined) {
        try {
            let simValue = 0;

            // Handle different command types
            if (command === 'THROTTLE_SET' || command === 'PROP_PITCH_SET' || command === 'MIXTURE_SET' || command === 'MIXTURE1_SET') {
                // 0-100% → 0-16383
                simValue = Math.round((value / 100) * 16383);
            } else if (command === 'HEADING_BUG_SET') {
                // Degrees 0-360
                simValue = Math.round(value);
            } else if (command === 'AP_ALT_VAR_SET_ENGLISH') {
                // Altitude in feet
                simValue = Math.round(value);
            } else if (command === 'AP_VS_VAR_SET_ENGLISH') {
                // Vertical speed in fpm (can be negative)
                simValue = Math.round(value);
            } else if (command === 'AP_SPD_VAR_SET') {
                // Speed in knots
                simValue = Math.round(value);
            } else if (command === 'VIEW_MODE' || command === 'CENTER_AILER_RUDDER') {
                // Toggle - no value needed
                simValue = 0;
            } else if (command === 'ZULU_HOURS_SET' || command === 'ZULU_MINUTES_SET') {
                // Time values passed directly
                simValue = Math.round(value);
            } else if (command === 'SIM_RATE_SET') {
                // Sim rate multiplier (1 = 256)
                simValue = Math.round(value * 256);
            } else if (command === 'PAUSE_TOGGLE' || command === 'SLEW_TOGGLE' || command === 'REPAIR_AND_REFUEL') {
                // Toggle commands - no value needed
                simValue = 0;
            } else if (command === 'AXIS_MIXTURE_SET') {
                // Axis control: -100 to 100 → -16383 to 16383
                simValue = Math.round((value / 100) * 16383);
            } else if (command === 'MIXTURE_RICH' || command === 'MIXTURE_LEAN') {
                // Toggle commands - no value needed
                simValue = 0;
            } else if (command === 'ELEVATOR_TRIM_SET') {
                // Elevator trim: -16383 (full nose down) to 16383 (full nose up)
                simValue = Math.round(Math.max(-16383, Math.min(16383, value)));
            } else if (command === 'ELEVATOR_SET') {
                // Direct elevator: -16383 to 16383
                simValue = Math.round(Math.max(-16383, Math.min(16383, value)));
            } else if (command === 'AXIS_SLEW_AHEAD_SET' || command === 'AXIS_SLEW_ALTIT_SET') {
                // Slew axis: -100 to 100 → -16383 to 16383
                simValue = Math.round((value / 100) * 16383);
            }
            
            simConnectConnection.transmitClientEvent(
                0,           // Object ID (0 = user aircraft)
                eventId,     // Event ID (mapped during init)
                simValue,    // Data value
                1,           // Group ID
                16           // Flags
            );
            console.log(`Sent command: ${command} (eventId: ${eventId}, value: ${simValue})`);
        } catch (e) {
            console.error(`Command error: ${e.message}`);
        }
    } else {
        console.log(`Unknown command: ${command}`);
    }
}

// ── Server-Side AI Autopilot Rule Engine ──────────────────────────────────
// Evaluates flight rules directly in Node.js, calling executeCommand() without
// any browser/WebSocket hop. Eliminates browser cache issues entirely.
const ruleEngineServer = new RuleEngineServer({
    executeCommand: (cmd, val) => executeCommand(cmd, val),
    getTuning: () => {
        // Read tuning from ai-pilot-api shared state if available
        try {
            const { getSharedState } = require('./ai-pilot-api');
            const state = getSharedState();
            return state?.tuning || {};
        } catch { return {}; }
    },
    requestFacilityGraph: (icao) => requestFacilityGraph(icao),
    getFlightData: () => flightData
});

// API endpoints for server-side rule engine
app.post('/api/ai-autopilot/enable', (req, res) => {
    ruleEngineServer.enable();
    // Auto-disable flight controllers so hardware axes don't override software control
    setFlightDevicesEnabled(false, (ok) => {
        if (!ok) console.warn('[AI-AP] Flight device disable task failed to start');
    });
    res.json({ success: true, enabled: true });
});

app.post('/api/ai-autopilot/disable', (req, res) => {
    ruleEngineServer.disable();
    // Re-enable flight controllers for manual flight
    setFlightDevicesEnabled(true, (ok) => {
        if (!ok) console.warn('[AI-AP] Flight device enable task failed to start');
    });
    res.json({ success: true, enabled: false });
});

app.get('/api/ai-autopilot/state', (req, res) => {
    res.json(ruleEngineServer.getState());
});

app.post('/api/ai-autopilot/cruise-alt', (req, res) => {
    const alt = parseInt(req.body.altitude);
    if (isNaN(alt)) return res.status(400).json({ error: 'altitude required' });
    ruleEngineServer.setCruiseAlt(alt);
    res.json({ success: true, cruiseAlt: alt });
});

// ── ATC Ground Operations API ──────────────────────────────────────────
app.post('/api/ai-autopilot/request-taxi', async (req, res) => {
    try {
        const result = await ruleEngineServer.requestTaxi();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/ai-autopilot/cleared-takeoff', (req, res) => {
    res.json(ruleEngineServer.clearedForTakeoff());
});

app.get('/api/ai-autopilot/atc-state', (req, res) => {
    res.json(ruleEngineServer.getATCState());
});

app.post('/api/ai-autopilot/atc-deactivate', (req, res) => {
    res.json(ruleEngineServer.deactivateATC());
});

// ── Device Management (flight controller disable/enable for AI autopilot) ──
// Hardware throttle/joystick axes override ALL software commands in MSFS 2024.
// Solution: disable flight sim peripherals at Windows PnP level when AI is active.
// Devices: Thrustmaster (VID_044F) joystick+throttle, Saitek (VID_06A3) rudder pedals
const FLIGHT_DEVICE_VIDS = ['VID_044F', 'VID_06A3']; // Thrustmaster, Saitek

function setFlightDevicesEnabled(enabled, callback) {
    const taskName = enabled ? 'EnableFlightDevices' : 'DisableFlightDevices';
    const scriptPath = enabled
        ? 'C:\\LLM-DevOSWE\\enable-flight-devices.ps1'
        : 'C:\\LLM-DevOSWE\\disable-flight-devices.ps1';
    const action = enabled ? 'Enable' : 'Disable';
    // Use pre-deployed SYSTEM scheduled tasks (Disable-PnpDevice requires SYSTEM privileges)
    // The tasks report "Generic failure" but the devices DO change state (Error = disabled)
    exec(`schtasks /Run /TN ${taskName}`, { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) {
            console.warn(`[Device] Task ${taskName} failed to start:`, stderr || err.message);
            if (callback) callback(false, stderr || err.message);
        } else {
            console.log(`[Device] ${action} task started — devices will change state in ~3s`);
            if (callback) callback(true);
        }
    });
}

// List HID devices (for UI/debugging)
app.get('/api/devices', (req, res) => {
    const ps = `Get-PnpDevice -Class 'HIDClass' | Select-Object InstanceId,FriendlyName,Status | ConvertTo-Json`;
    exec(`powershell -Command "${ps}"`, { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        try {
            const devices = JSON.parse(stdout);
            const list = (Array.isArray(devices) ? devices : [devices]).map(d => ({
                id: d.InstanceId,
                name: d.FriendlyName || 'Unknown',
                status: d.Status === 'OK' ? 'enabled' : 'disabled',
                isFlightDevice: FLIGHT_DEVICE_VIDS.some(v => (d.InstanceId || '').includes(v))
            }));
            res.json({ devices: list, flightDeviceVids: FLIGHT_DEVICE_VIDS });
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse device list' });
        }
    });
});

// Disable flight devices manually
app.post('/api/devices/flight/disable', (req, res) => {
    setFlightDevicesEnabled(false, (ok, err) => {
        res.json({ success: ok, action: 'disabled', error: ok ? undefined : err });
    });
});

// Enable flight devices manually
app.post('/api/devices/flight/enable', (req, res) => {
    setFlightDevicesEnabled(true, (ok, err) => {
        res.json({ success: ok, action: 'enabled', error: ok ? undefined : err });
    });
});

// WebSocket handling
// Ping/pong heartbeat — detect dead clients every 30s
const WS_HEARTBEAT_INTERVAL = 30000;
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws._isAlive === false) {
            ws.terminate();
            return;
        }
        ws._isAlive = false;
        ws.ping();
    });
}, WS_HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws._isAlive = true;
    usageMetrics.trackConnection(+1);

    // Clear held axes on new connection — prevents stale elevator/aileron from previous session
    for (const key of Object.keys(_heldAxes)) delete _heldAxes[key];
    updateHeldAxesTimer();

    ws.on('pong', () => { ws._isAlive = true; });

    // Add client to hot reload manager (development only)
    hotReloadManager.addClient(ws);

    // Send current state immediately
    ws.send(JSON.stringify({ type: 'flightData', data: flightData }));

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            if (msg.type === 'command') {
                // Handle categorized commands (from fuel widget, etc.)
                if (msg.category === 'fuel') {
                    handleFuelCommand(msg.action, msg);
                } else {
                    executeCommand(msg.command, msg.value);
                }
            }
        } catch (e) {
            console.error('Message parse error:', e);
        }
    });

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        usageMetrics.trackConnection(-1);
    });
});

// Handle fuel commands
function handleFuelCommand(action, params) {
    console.log(`[Fuel] ${action}`, params);
    
    const tankDefIds = global.tankDefIds || {
        'LeftMain': 1, 'RightMain': 2, 'LeftAux': 3, 'RightAux': 4,
        'Center': 5, 'Center2': 6, 'Center3': 7,
        'LeftTip': 8, 'RightTip': 9, 'External1': 10, 'External2': 11
    };
    
    // Tank key to flightData field mapping
    const tankFields = {
        'LeftMain': { qty: 'fuelTankLeftMain', cap: 'fuelTankLeftMainCap' },
        'RightMain': { qty: 'fuelTankRightMain', cap: 'fuelTankRightMainCap' },
        'LeftAux': { qty: 'fuelTankLeftAux', cap: 'fuelTankLeftAuxCap' },
        'RightAux': { qty: 'fuelTankRightAux', cap: 'fuelTankRightAuxCap' },
        'Center': { qty: 'fuelTankCenter', cap: 'fuelTankCenterCap' },
        'Center2': { qty: 'fuelTankCenter2', cap: 'fuelTankCenter2Cap' },
        'Center3': { qty: 'fuelTankCenter3', cap: 'fuelTankCenter3Cap' },
        'LeftTip': { qty: 'fuelTankLeftTip', cap: 'fuelTankLeftTipCap' },
        'RightTip': { qty: 'fuelTankRightTip', cap: 'fuelTankRightTipCap' },
        'External1': { qty: 'fuelTankExternal1', cap: 'fuelTankExternal1Cap' },
        'External2': { qty: 'fuelTankExternal2', cap: 'fuelTankExternal2Cap' }
    };
    
    // Helper to set a single tank
    function setTank(tankKey, percentOver100) {
        const defId = tankDefIds[tankKey];
        if (!defId) {
            console.log(`[Fuel] Unknown tank: ${tankKey}`);
            return false;
        }
        
        if (!simConnectConnection) {
            // Mock mode
            const fields = tankFields[tankKey];
            if (fields && flightData[fields.cap]) {
                flightData[fields.qty] = percentOver100 * flightData[fields.cap];
            }
            return true;
        }
        
        try {
            const { RawBuffer } = require('node-simconnect');
            const rawBuffer = new RawBuffer(8);
            rawBuffer.writeFloat64(percentOver100);
            const dataPacket = { tagged: false, arrayCount: 0, buffer: rawBuffer };
            simConnectConnection.setDataOnSimObject(defId, 0, dataPacket);
            console.log(`[Fuel] Set ${tankKey} to ${(percentOver100 * 100).toFixed(0)}%`);
            return true;
        } catch (e) {
            console.error(`[Fuel] Error setting ${tankKey}:`, e.message);
            return false;
        }
    }
    
    // Handle different actions
    if (action === 'setPercent') {
        // Set ALL tanks to percent (Fill All / Empty All)
        const percentOver100 = Math.max(0, Math.min(1, params.percent / 100));
        console.log(`[Fuel] Setting ALL tanks to ${params.percent}%`);
        
        if (!simConnectConnection) {
            // Mock mode - update all tanks
            for (const [tankKey, fields] of Object.entries(tankFields)) {
                if (flightData[fields.cap] > 0) {
                    flightData[fields.qty] = percentOver100 * flightData[fields.cap];
                }
            }
            // Update total
            flightData.fuelTotal = percentOver100 * flightData.fuelCapacity;
            broadcastFlightData();
        } else {
            // Set all tanks that have capacity
            for (const tankKey of Object.keys(tankDefIds)) {
                const fields = tankFields[tankKey];
                if (fields && flightData[fields.cap] > 0) {
                    setTank(tankKey, percentOver100);
                }
            }
        }
    } else if (action === 'setTankPercent') {
        // Set SINGLE tank to percent
        const tankKey = params.tankKey;
        const percentOver100 = Math.max(0, Math.min(1, params.percent / 100));
        setTank(tankKey, percentOver100);
        if (!simConnectConnection) broadcastFlightData();
        
    } else if (action === 'adjustTank') {
        // Adjust SINGLE tank by gallons
        const tankKey = params.tankKey;
        const amount = params.amount || 0;
        const fields = tankFields[tankKey];
        
        if (!fields) {
            console.log(`[Fuel] Unknown tank: ${tankKey}`);
            return;
        }
        
        const currentQty = flightData[fields.qty] || 0;
        const capacity = flightData[fields.cap] || 0;
        
        if (capacity <= 0) {
            console.log(`[Fuel] Tank ${tankKey} has no capacity`);
            return;
        }
        
        const newQty = Math.max(0, Math.min(capacity, currentQty + amount));
        const percentOver100 = newQty / capacity;
        
        console.log(`[Fuel] ${tankKey}: ${currentQty.toFixed(1)} → ${newQty.toFixed(1)} gal (${(percentOver100 * 100).toFixed(0)}%)`);
        setTank(tankKey, percentOver100);
        if (!simConnectConnection) broadcastFlightData();
        
    } else if (action === 'adjust') {
        // Legacy: adjust all tanks (deprecated, kept for compatibility)
        const newTotal = Math.max(0, Math.min(flightData.fuelCapacity, flightData.fuelTotal + params.amount));
        const percentOver100 = flightData.fuelCapacity > 0 ? newTotal / flightData.fuelCapacity : 0;
        
        for (const tankKey of Object.keys(tankDefIds)) {
            const fields = tankFields[tankKey];
            if (fields && flightData[fields.cap] > 0) {
                setTank(tankKey, percentOver100);
            }
        }
        if (!simConnectConnection) {
            flightData.fuelTotal = newTotal;
            broadcastFlightData();
        }
    } else {
        console.log(`[Fuel] Unknown action: ${action}`);
    }
}

// Re-apply held axis values — overcomes joystick spring-center.
// MSFS 2024 joystick hardware polls at ~60-120Hz, overriding our axis commands.
// SIM_FRAME alone (~30Hz) is too slow — the joystick wins the race.
// Solution: dedicated 60Hz timer + SIM_FRAME for double coverage.
let _heldAxesTimer = null;

function reapplyHeldAxes() {
    if (!simConnectConnection) return;
    const { RawBuffer } = require('node-simconnect');
    for (const held of Object.values(_heldAxes)) {
        try {
            if (held.simvar) {
                // Direct SimVar write — bypasses InputEvent/joystick
                const buf = new RawBuffer(8);
                buf.writeFloat64(held.value);
                const dataPacket = { tagged: false, arrayCount: 0, buffer: buf };
                simConnectConnection.setDataOnSimObject(held.defId, 0, dataPacket);
            } else if (held.legacy) {
                // Legacy transmitClientEvent (elevator, ailerons, rudder)
                simConnectConnection.transmitClientEvent(0, held.eventId, held.value, 1, 16);
            } else {
                // InputEvent (throttle, etc.)
                simConnectConnection.setInputEvent(held.hash, held.value);
            }
        } catch (_) {
            // Silently ignore — will retry next tick
        }
    }
}

// Start/stop the held-axes timer based on whether any axes are held.
// 8ms (~120Hz) — balances between outpacing joystick polling and not
// overwhelming SimConnect. 16ms was too slow for rudder, 4ms caused drops.
function updateHeldAxesTimer() {
    const hasHeld = Object.keys(_heldAxes).length > 0;
    if (hasHeld && !_heldAxesTimer) {
        _heldAxesTimer = setInterval(reapplyHeldAxes, 8); // ~120Hz
    } else if (!hasHeld && _heldAxesTimer) {
        clearInterval(_heldAxesTimer);
        _heldAxesTimer = null;
    }
}

// Broadcast flight data to all connected clients
function broadcastFlightData() {
    const message = JSON.stringify({ type: 'flightData', data: flightData });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(message);
            } catch (e) {
                try { client.terminate(); } catch (_) {}
            }
        }
    });
}

function scheduleSimConnectRetry() {
    if (simConnectRetryTimeout) clearTimeout(simConnectRetryTimeout);
    simConnectRetryCount++;
    const delay = simConnectRetryDelay;
    simConnectRetryDelay = Math.min(simConnectRetryDelay * SC_RETRY_MULTIPLIER, SC_RETRY_MAX);
    console.log(`[SimConnect] Retry #${simConnectRetryCount} in ${(delay / 1000).toFixed(1)}s...`);
    simConnectRetryTimeout = setTimeout(() => initSimConnect(), delay);
}

function stopMockData() {
    if (mockDataInterval) {
        clearInterval(mockDataInterval);
        mockDataInterval = null;
        console.log('[SimConnect] Mock data stopped');
    }
}

// SimConnect initialization
async function initSimConnect() {
    try {
        const { open, Protocol, SimConnectDataType } = require('node-simconnect');

        // Remote SimConnect support - read from config file first, then env vars
        let remoteHost = process.env.SIMCONNECT_HOST || null;
        let remotePort = parseInt(process.env.SIMCONNECT_PORT) || 500;

        // Check config file for remote settings
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                if (config.simconnect?.remoteHost) {
                    remoteHost = config.simconnect.remoteHost;
                }
                if (config.simconnect?.remotePort) {
                    remotePort = parseInt(config.simconnect.remotePort) || 500;
                }
            }
        } catch (e) {
            console.log('[SimConnect] Could not read config:', e.message);
        }

        if (remoteHost) {
            console.log(`Connecting to MSFS on remote host ${remoteHost}:${remotePort}...`);
        } else {
            console.log('Connecting to MSFS...');
        }

        const connectOptions = remoteHost
            ? { remote: { host: remoteHost, port: remotePort } }
            : {};

        const { recvOpen, handle } = await open('SimGlass', Protocol.KittyHawk, connectOptions);
        
        console.log('Connected to MSFS:', recvOpen.applicationName);
        if (mockDataInterval) {
            console.log('[SimConnect] Connected — switching from mock to live data');
            stopMockData();
        }
        if (simConnectRetryTimeout) clearTimeout(simConnectRetryTimeout);
        simConnectRetryTimeout = null;
        simConnectRetryDelay = SC_RETRY_MIN;
        simConnectRetryCount = 0;
        simConnectConnection = handle;
        isSimConnected = true;
        flightData.connected = true;
        
        // Map client events for commands
        const events = [
            'TOGGLE_NAV_LIGHTS',
            'TOGGLE_BEACON_LIGHTS',
            'STROBES_TOGGLE',
            'LANDING_LIGHTS_TOGGLE',
            'TOGGLE_TAXI_LIGHTS',
            'PARKING_BRAKES',
            'PARKING_BRAKE_SET',
            'GEAR_TOGGLE',
            'FLAPS_UP',
            'FLAPS_DOWN',
            'SPOILERS_TOGGLE',
            // Autopilot events
            'AP_MASTER',
            'AP_HDG_HOLD',
            'AP_ALT_HOLD',
            'AP_VS_HOLD',
            'AP_PANEL_SPEED_HOLD',
            'TOGGLE_FLIGHT_DIRECTOR',
            'YAW_DAMPER_TOGGLE',
            'AP_NAV1_HOLD',
            'AP_APR_HOLD',
            'AP_BC_HOLD',
            'HEADING_BUG_INC',
            'HEADING_BUG_DEC',
            'AP_ALT_VAR_INC',
            'AP_ALT_VAR_DEC',
            'AP_VS_VAR_INC',
            'AP_VS_VAR_DEC',
            'AP_SPD_VAR_INC',
            'AP_SPD_VAR_DEC',
            // Direct AP value SET events
            'HEADING_BUG_SET',
            'AP_ALT_VAR_SET_ENGLISH',
            'AP_VS_VAR_SET_ENGLISH',
            'AP_SPD_VAR_SET',
            // View toggle
            'VIEW_MODE',
            // Flight controls (AXIS_ + non-AXIS variants — MSFS 2024 may ignore one or the other)
            'AXIS_AILERONS_SET',
            'AXIS_ELEVATOR_SET',
            'AXIS_RUDDER_SET',
            'RUDDER_SET',
            'ELEVATOR_SET',
            'ELEV_TRIM_DN',
            'ELEV_TRIM_UP',
            'ELEVATOR_TRIM_SET',
            'AILERON_SET',
            'CENTER_AILER_RUDDER',
            // Nosewheel steering (ground only — wider angle than rudder pedals)
            'STEERING_SET',
            // Differential braking (ground steering)
            'AXIS_LEFT_BRAKE_SET',
            'AXIS_RIGHT_BRAKE_SET',
            'BRAKES_LEFT',
            'BRAKES_RIGHT',
            // Engine control events
            'THROTTLE_SET',
            'THROTTLE1_SET',
            'AXIS_THROTTLE_SET',
            'AXIS_THROTTLE1_SET',
            'PROP_PITCH_SET',
            'MIXTURE_SET',
            'MIXTURE1_SET',
            'MIXTURE_RICH',
            'MIXTURE_LEAN',
            'AXIS_MIXTURE_SET',
            // Engine start events
            'TOGGLE_STARTER1',
            'SET_STARTER1_HELD',
            'MAGNETO1_OFF',
            'MAGNETO1_RIGHT',
            'MAGNETO1_LEFT',
            'MAGNETO1_BOTH',
            'MAGNETO1_START',
            'ENGINE_AUTO_START',
            'QUICK_PREFLIGHT',  // MSFS 2024 - quick preflight (removes chocks/covers)
            'TOGGLE_JETWAY',    // Try alternate event names
            'TOGGLE_AIRCRAFT_EXIT',
            'REQUEST_FUEL_KEY',
            // Slew mode for flight recorder playback
            'SLEW_TOGGLE',
            'SLEW_ON',
            'SLEW_OFF',
            'SLEW_ALTIT_UP_FAST',
            'SLEW_ALTIT_UP_SLOW',
            'SLEW_ALTIT_DN_FAST',
            'SLEW_ALTIT_DN_SLOW',
            'SLEW_ALTIT_FREEZE',
            'SLEW_AHEAD_PLUS',
            'SLEW_AHEAD_MINUS',
            'AXIS_SLEW_AHEAD_SET',
            'AXIS_SLEW_ALTIT_SET',
            // Environment controls
            'ZULU_HOURS_SET',
            'ZULU_MINUTES_SET',
            'PAUSE_ON',
            'PAUSE_OFF',
            'PAUSE_TOGGLE',
            'SIM_RATE_SET',
            'SIM_RATE_INCR',
            'SIM_RATE_DECR',
            'REPAIR_AND_REFUEL',
            // Radio frequency events
            'COM_RADIO_SET',
            'COM_STBY_RADIO_SET',
            'COM2_RADIO_SET',
            'COM2_STBY_RADIO_SET',
            'NAV1_RADIO_SET',
            'NAV1_STBY_SET',
            'NAV2_RADIO_SET',
            'NAV2_STBY_SET',
            'COM_STBY_RADIO_SWAP',
            'COM2_STBY_RADIO_SWAP',
            'NAV1_RADIO_SWAP',
            'NAV2_RADIO_SWAP',
            'ADF_SET',
            'ADF_STBY_SET',
            'ADF1_RADIO_SWAP',
            'XPNDR_SET',
            'XPNDR_IDENT_ON',
            'XPNDR_IDENT_OFF',
            'XPNDR_IDENT_TOGGLE',
            // OBS (VOR course) control events
            'VOR1_SET',
            'VOR2_SET',
            'VOR1_OBI_INC',
            'VOR1_OBI_DEC',
            'VOR2_OBI_INC',
            'VOR2_OBI_DEC'
            // Note: Fuel control uses writable SimVars, not events
        ];
        
        events.forEach((eventName, index) => {
            const eventId = 1000 + index;
            handle.mapClientEventToSimEvent(eventId, eventName);
            eventMap[eventName] = eventId;
        });
        console.log('Mapped', events.length, 'client events');
        
        // MSFS 2024 MINIMAL DATA REQUEST - Essential flight data only
        // ALL vars use FLOAT64 for consistent 8-byte alignment (MSFS 2024 pads INT32 inconsistently)
        console.log('[SimConnect] Using MSFS 2024 minimal data mode (all FLOAT64)');

        // Core flight data (16 vars)
        handle.addToDataDefinition(0, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE ALT ABOVE GROUND', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GROUND ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AIRSPEED INDICATED', 'knots', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE HEADING DEGREES MAGNETIC', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GROUND VELOCITY', 'knots', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE PITCH DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'MAGVAR', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT WIND DIRECTION', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT WIND VELOCITY', 'knots', SimConnectDataType.FLOAT64, 0);

        // Weather conditions (7 vars) - Phase 1: Enhanced Weather Reading
        handle.addToDataDefinition(0, 'AMBIENT TEMPERATURE', 'celsius', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT PRESSURE', 'inches of mercury', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'SEA LEVEL PRESSURE', 'millibars', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT VISIBILITY', 'meters', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT PRECIP RATE', 'millimeters of water', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT IN CLOUD', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT DENSITY ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);

        handle.addToDataDefinition(0, 'LOCAL TIME', 'Hours', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ZULU TIME', 'Hours', SimConnectDataType.FLOAT64, 0);

        // Autopilot (9 vars)
        handle.addToDataDefinition(0, 'AUTOPILOT MASTER', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT HEADING LOCK', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT ALTITUDE LOCK', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT VERTICAL HOLD', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT AIRSPEED HOLD', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT HEADING LOCK DIR', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT ALTITUDE LOCK VAR', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT VERTICAL HOLD VAR', 'feet per minute', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT AIRSPEED HOLD VAR', 'knots', SimConnectDataType.FLOAT64, 0);

        // GPS (8 vars)
        handle.addToDataDefinition(0, 'GPS FLIGHT PLAN WP COUNT', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS FLIGHT PLAN WP INDEX', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS WP DISTANCE', 'nautical miles', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS WP ETE', 'seconds', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS WP BEARING', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS POSITION LAT', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS POSITION LON', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS ETE', 'seconds', SimConnectDataType.FLOAT64, 0);

        // Fuel basics (3 vars)
        handle.addToDataDefinition(0, 'FUEL TOTAL QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TOTAL CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ENG FUEL FLOW GPH:1', 'gallons per hour', SimConnectDataType.FLOAT64, 0);

        // Engine (2 vars)
        handle.addToDataDefinition(0, 'ENG COMBUSTION:1', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG THROTTLE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);

        // NAV1 CDI/OBS/Glideslope (9 vars)
        handle.addToDataDefinition(0, 'NAV CDI:1', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV OBS:1', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV RADIAL:1', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV TOFROM:1', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV SIGNAL:1', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV GSI:1', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV GS FLAG:1', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV HAS LOCALIZER:1', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV HAS GLIDE SLOPE:1', 'Bool', SimConnectDataType.FLOAT64, 0);

        // GPS CDI (6 vars)
        handle.addToDataDefinition(0, 'GPS CDI NEEDLE', 'number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS WP CROSS TRK', 'nautical miles', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS WP DESIRED TRACK', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS OBS VALUE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS VERTICAL ANGLE ERROR', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GPS APPROACH MODE', 'Bool', SimConnectDataType.FLOAT64, 0);

        // Radio frequencies (13 vars)
        handle.addToDataDefinition(0, 'COM ACTIVE FREQUENCY:1', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'COM STANDBY FREQUENCY:1', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'COM ACTIVE FREQUENCY:2', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'COM STANDBY FREQUENCY:2', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV ACTIVE FREQUENCY:1', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV STANDBY FREQUENCY:1', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV ACTIVE FREQUENCY:2', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV STANDBY FREQUENCY:2', 'MHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ADF ACTIVE FREQUENCY:1', 'KHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ADF STANDBY FREQUENCY:1', 'KHz', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'TRANSPONDER CODE:1', 'BCO16', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'TRANSPONDER STATE:1', 'Enum', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'TRANSPONDER IDENT:1', 'Bool', SimConnectDataType.FLOAT64, 0);

        // DME (4 vars)
        handle.addToDataDefinition(0, 'NAV DME:1', 'nautical miles', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV DME:2', 'nautical miles', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV DMESPEED:1', 'knots', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'NAV DMESPEED:2', 'knots', SimConnectDataType.FLOAT64, 0);

        // Lights (5 vars)
        handle.addToDataDefinition(0, 'LIGHT NAV', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'LIGHT BEACON', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'LIGHT STROBE', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'LIGHT LANDING', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'LIGHT TAXI', 'Bool', SimConnectDataType.FLOAT64, 0);

        // Gear and Flaps (3 vars)
        handle.addToDataDefinition(0, 'GEAR HANDLE POSITION', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FLAPS HANDLE INDEX', 'Number', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'BRAKE PARKING POSITION', 'Bool', SimConnectDataType.FLOAT64, 0);

        // Engine Instruments (8 vars)
        handle.addToDataDefinition(0, 'GENERAL ENG RPM:1', 'rpm', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RECIP ENG MANIFOLD PRESSURE:1', 'inHg', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG OIL TEMPERATURE:1', 'Fahrenheit', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG OIL PRESSURE:1', 'psi', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RECIP ENG EXHAUST GAS TEMPERATURE:1', 'Fahrenheit', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RECIP ENG CYLINDER HEAD TEMPERATURE:1', 'Fahrenheit', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG PROPELLER LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG MIXTURE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);

        // Individual Fuel Tank Quantities (11 vars)
        handle.addToDataDefinition(0, 'FUEL TANK LEFT MAIN QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT MAIN QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK LEFT AUX QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT AUX QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER2 QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER3 QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK LEFT TIP QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT TIP QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK EXTERNAL1 QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK EXTERNAL2 QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);

        // Immersion / CockpitFX (15 vars)
        handle.addToDataDefinition(0, 'ACCELERATION BODY X', 'feet per second squared', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ACCELERATION BODY Y', 'feet per second squared', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ACCELERATION BODY Z', 'feet per second squared', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'INCIDENCE ALPHA', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'INCIDENCE BETA', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'SIM ON GROUND', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'SURFACE TYPE', 'Enum', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'STALL WARNING', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'OVERSPEED WARNING', 'Bool', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GEAR POSITION:0', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GEAR POSITION:1', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GEAR POSITION:2', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FLAPS HANDLE PERCENT', 'Percent', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ROTATION VELOCITY BODY X', 'radians per second', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ROTATION VELOCITY BODY Z', 'radians per second', SimConnectDataType.FLOAT64, 0);

        // Doors / canopy / exits (5 vars) — for cabin perspective filter
        handle.addToDataDefinition(0, 'CANOPY OPEN', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'EXIT OPEN:0', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'EXIT OPEN:1', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'EXIT OPEN:2', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'EXIT OPEN:3', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);

        // Individual Fuel Tank Capacities (11 vars)
        handle.addToDataDefinition(0, 'FUEL TANK LEFT MAIN CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT MAIN CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK LEFT AUX CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT AUX CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER2 CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK CENTER3 CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK LEFT TIP CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK RIGHT TIP CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK EXTERNAL1 CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TANK EXTERNAL2 CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);

        // Control Surface Positions (6 vars) — for AI autopilot mapping
        handle.addToDataDefinition(0, 'ELEVATOR POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AILERON POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RUDDER POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'YOKE Y POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'YOKE X POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RUDDER PEDAL POSITION', 'Position', SimConnectDataType.FLOAT64, 0);

        console.log('[SimConnect] Registered 132 SimVars for MSFS 2024');

        // Writable fuel tank definitions (separate definition IDs for writing)
        // Units: "Percent Over 100" = 0.0 to 1.0 range
        // Tank key to definition ID mapping
        const tankDefIds = {
            'LeftMain': 1,
            'RightMain': 2,
            'LeftAux': 3,
            'RightAux': 4,
            'Center': 5,
            'Center2': 6,
            'Center3': 7,
            'LeftTip': 8,
            'RightTip': 9,
            'External1': 10,
            'External2': 11
        };
        
        // Store mapping globally for fuel commands
        global.tankDefIds = tankDefIds;
        
        // Register all tanks as writable
        handle.addToDataDefinition(1, 'FUEL TANK LEFT MAIN LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(2, 'FUEL TANK RIGHT MAIN LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(3, 'FUEL TANK LEFT AUX LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(4, 'FUEL TANK RIGHT AUX LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(5, 'FUEL TANK CENTER LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(6, 'FUEL TANK CENTER2 LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(7, 'FUEL TANK CENTER3 LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(8, 'FUEL TANK LEFT TIP LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(9, 'FUEL TANK RIGHT TIP LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(10, 'FUEL TANK EXTERNAL1 LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(11, 'FUEL TANK EXTERNAL2 LEVEL', 'Percent Over 100', SimConnectDataType.FLOAT64, 0);
        console.log('[Fuel] Registered 11 writable tank definitions (IDs 1-11)');
        
        // Writable position definition for flight recorder playback (ID 12)
        // Uses slew mode to set aircraft position
        handle.addToDataDefinition(12, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'PLANE PITCH DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(12, 'AIRSPEED INDICATED', 'knots', SimConnectDataType.FLOAT64, 0);
        console.log('[Recorder] Registered writable position definition (ID 12)');

        // Writable mixture lever position (ID 13) — direct SimVar write bypasses InputEvent/joystick issues
        handle.addToDataDefinition(13, 'GENERAL ENG MIXTURE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        console.log('[Mixture] Registered writable mixture definition (ID 13)');

        // Writable throttle lever position (ID 14) — direct SimVar write bypasses hardware axis override
        // InputEvent ENGINE_THROTTLE_1 gets overridden by physical joystick throttle axis.
        // SimVar write goes directly into the sim data store, immune to hardware axis.
        handle.addToDataDefinition(14, 'GENERAL ENG THROTTLE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        console.log('[Throttle] Registered writable throttle definition (ID 14)');

        // MSFS 2024 InputEvents — mixture lever uses B: variables, not legacy SimConnect events.
        // Enumerate input events to find FUEL_MIXTURE_1 hash for setInputEvent().
        global.inputEventHashes = {};
        handle.on('inputEventsList', recv => {
            const events = recv.inputEventDescriptors;
            console.log(`[InputEvents] Received ${events.length} input events`);
            // Dump all names for debugging flight control mapping
            const allNames = events.map(e => e.name).sort();
            console.log(`[InputEvents] ALL names: ${allNames.join(', ')}`);
            for (const e of events) {
                // Store hashes for key controls
                if (e.name === 'FUEL_MIXTURE_1') {
                    global.inputEventHashes.FUEL_MIXTURE_1 = e.inputEventIdHash;
                    console.log(`[InputEvents] FUEL_MIXTURE_1 hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'ENGINE_THROTTLE_1') {
                    global.inputEventHashes.ENGINE_THROTTLE_1 = e.inputEventIdHash;
                }
                // Flight control surfaces — MSFS 2024 requires InputEvents
                if (e.name === 'UNKNOWN_TAIL_ELEVATOR') {
                    global.inputEventHashes.UNKNOWN_TAIL_ELEVATOR = e.inputEventIdHash;
                    console.log(`[InputEvents] UNKNOWN_TAIL_ELEVATOR hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'UNKNOWN_RUDDER') {
                    global.inputEventHashes.UNKNOWN_RUDDER = e.inputEventIdHash;
                    console.log(`[InputEvents] UNKNOWN_RUDDER hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'UNKNOWN_AILERON_LEFT') {
                    global.inputEventHashes.UNKNOWN_AILERON_LEFT = e.inputEventIdHash;
                    console.log(`[InputEvents] UNKNOWN_AILERON_LEFT hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'UNKNOWN_AILERON_RIGHT') {
                    global.inputEventHashes.UNKNOWN_AILERON_RIGHT = e.inputEventIdHash;
                    console.log(`[InputEvents] UNKNOWN_AILERON_RIGHT hash: ${e.inputEventIdHash}`);
                }
                // HANDLING category — actual flight dynamics (elevator trim, flaps)
                if (e.name === 'HANDLING_ELEVATORTRIM_YOKE') {
                    global.inputEventHashes.HANDLING_ELEVATORTRIM_YOKE = e.inputEventIdHash;
                    console.log(`[InputEvents] HANDLING_ELEVATORTRIM_YOKE hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'HANDLING_ELEVATORTRIM_WHEEL') {
                    global.inputEventHashes.HANDLING_ELEVATORTRIM_WHEEL = e.inputEventIdHash;
                    console.log(`[InputEvents] HANDLING_ELEVATORTRIM_WHEEL hash: ${e.inputEventIdHash}`);
                }
                if (e.name === 'HANDLING_FLAPS') {
                    global.inputEventHashes.HANDLING_FLAPS = e.inputEventIdHash;
                    console.log(`[InputEvents] HANDLING_FLAPS hash: ${e.inputEventIdHash}`);
                }
            }
            // Apply any pending throttle that was queued before hashes arrived
            if (_heldAxes._pendingThrottle != null && global.inputEventHashes.ENGINE_THROTTLE_1) {
                const hash = global.inputEventHashes.ENGINE_THROTTLE_1;
                const val = _heldAxes._pendingThrottle;
                delete _heldAxes._pendingThrottle;
                _heldAxes.throttle = { hash, value: val };
                updateHeldAxesTimer();
                try {
                    simConnectConnection.setInputEvent(hash, val);
                    console.log(`[Throttle] Applied pending: ${Math.round(val * 100)}% after InputEvent ready`);
                } catch (e) {
                    console.error(`[Throttle] Pending apply error: ${e.message}`);
                }
            }
            // Force rule engine to re-send all commands now that InputEvents are ready
            if (ruleEngineServer && ruleEngineServer.isEnabled()) {
                ruleEngineServer.commandQueue.clear();
                console.log('[InputEvents] Cleared rule engine dedup cache — commands will re-send');
            }
        });
        handle.enumerateInputEvents(0);
        console.log('[InputEvents] Enumeration requested');
        
        // Request data every 100ms
        handle.requestDataOnSimObject(0, 0, 0, 3, 0); // Period = SIM_FRAME
        
        // Handle incoming data — fault-tolerant progressive reader
        // MSFS 2024 may add padding bytes between data groups, so we read
        // progressively and assign after each group succeeds
        handle.on('simObjectData', (data) => {
            if (data.requestID === 0) {
                const d = data.data;
                const fd = { connected: true };
                const rf = () => d.readFloat64();
                const rb = () => rf() !== 0;
                const ri = () => Math.round(rf());

                try {
                    // Core flight data (16 vars)
                    fd.altitude = rf(); fd.altitudeAGL = rf(); fd.groundAltitude = rf();
                    fd.speed = rf(); fd.heading = rf(); fd.verticalSpeed = rf();
                    fd.groundSpeed = rf(); fd.latitude = rf(); fd.longitude = rf();
                    fd.pitch = rf(); fd.bank = rf(); fd.magvar = rf();
                    fd.windDirection = rf(); fd.windSpeed = rf();

                    // Weather conditions (7 vars)
                    fd.temperature = rf(); fd.pressure = rf(); fd.seaLevelPressure = rf();
                    fd.visibility = rf(); fd.precipRate = rf();
                    fd.inCloud = rb(); fd.densityAltitude = rf();

                    fd.localTime = rf(); fd.zuluTime = rf();

                    // Autopilot (9 vars)
                    fd.apMaster = rb(); fd.apHdgLock = rb(); fd.apAltLock = rb();
                    fd.apVsLock = rb(); fd.apSpdLock = rb();
                    fd.apHdgSet = rf(); fd.apAltSet = rf(); fd.apVsSet = rf(); fd.apSpdSet = rf();

                    // GPS (8 vars)
                    fd.gpsWpCount = ri(); fd.gpsWpIndex = ri();
                    fd.gpsWpDistance = rf(); fd.gpsWpEte = rf(); fd.gpsWpBearing = rf();
                    fd.gpsLat = rf(); fd.gpsLon = rf(); fd.gpsEte = rf();

                    // Fuel (3 vars)
                    fd.fuelTotal = rf(); fd.fuelCapacity = rf(); fd.fuelFlow = rf();

                    // Engine (2 vars)
                    fd.engineRunning = rb(); fd.throttle = rf();

                    // NAV1 CDI (9 vars)
                    fd.nav1Cdi = ri(); fd.nav1Obs = rf(); fd.nav1Radial = rf();
                    fd.nav1ToFrom = ri(); fd.nav1Signal = ri(); fd.nav1Gsi = ri();
                    fd.nav1GsFlag = rb(); fd.nav1HasLoc = rb(); fd.nav1HasGs = rb();

                    // GPS CDI (6 vars)
                    fd.gpsCdiNeedle = ri(); fd.gpsCrossTrackError = rf();
                    fd.gpsDesiredTrack = rf(); fd.gpsObsValue = rf();
                    fd.gpsVerticalError = rf(); fd.gpsApproachMode = rb();

                    // Radio (13 vars)
                    fd.com1Active = rf(); fd.com1Standby = rf();
                    fd.com2Active = rf(); fd.com2Standby = rf();
                    fd.nav1Active = rf(); fd.nav1Standby = rf();
                    fd.nav2Active = rf(); fd.nav2Standby = rf();
                    fd.adfActive = rf(); fd.adfStandby = rf(); fd.transponder = ri();
                    fd.transponderState = ri(); fd.transponderIdent = ri();

                    // DME (4 vars)
                    fd.dme1Distance = rf(); fd.dme2Distance = rf();
                    fd.dme1Speed = rf(); fd.dme2Speed = rf();

                    // Lights (5 vars)
                    fd.navLight = rb(); fd.beaconLight = rb(); fd.strobeLight = rb();
                    fd.landingLight = rb(); fd.taxiLight = rb();

                    // Gear/Flaps (3 vars)
                    fd.gearDown = rb(); fd.flapsIndex = ri(); fd.parkingBrake = rb();

                    // Engine Instruments (8 vars)
                    fd.engineRpm = rf(); fd.manifoldPressure = rf();
                    fd.oilTemp = rf(); fd.oilPressure = rf();
                    fd.egt = rf(); fd.cht = rf(); fd.propeller = rf(); fd.mixture = rf();

                    // Individual Fuel Tank Quantities (11 vars)
                    fd.fuelTankLeftMain = rf(); fd.fuelTankRightMain = rf();
                    fd.fuelTankLeftAux = rf(); fd.fuelTankRightAux = rf();
                    fd.fuelTankCenter = rf(); fd.fuelTankCenter2 = rf(); fd.fuelTankCenter3 = rf();
                    fd.fuelTankLeftTip = rf(); fd.fuelTankRightTip = rf();
                    fd.fuelTankExternal1 = rf(); fd.fuelTankExternal2 = rf();

                    // Immersion / CockpitFX (15 vars) — must match definition order
                    fd.accelX = rf(); fd.accelY = rf(); fd.accelZ = rf();
                    fd.angleOfAttack = rf(); fd.sideslip = rf();
                    fd.onGround = rb(); fd.surfaceType = ri();
                    fd.stallWarning = rb(); fd.overspeedWarning = rb();
                    fd.gearPos0 = rf(); fd.gearPos1 = rf(); fd.gearPos2 = rf();
                    fd.flapPercent = rf();
                    fd.rotVelX = rf(); fd.rotVelZ = rf();

                    // Doors / canopy (5 vars)
                    fd.canopyOpen = rf();
                    fd.exitOpen0 = rf(); fd.exitOpen1 = rf();
                    fd.exitOpen2 = rf(); fd.exitOpen3 = rf();

                    // Individual Fuel Tank Capacities (11 vars)
                    fd.fuelTankLeftMainCap = rf(); fd.fuelTankRightMainCap = rf();
                    fd.fuelTankLeftAuxCap = rf(); fd.fuelTankRightAuxCap = rf();
                    fd.fuelTankCenterCap = rf(); fd.fuelTankCenter2Cap = rf(); fd.fuelTankCenter3Cap = rf();
                    fd.fuelTankLeftTipCap = rf(); fd.fuelTankRightTipCap = rf();
                    fd.fuelTankExternal1Cap = rf(); fd.fuelTankExternal2Cap = rf();

                    // Control Surface Positions (6 vars)
                    // MSFS 2024: ELEVATOR POSITION not in buffer, shifts all reads -1
                    // Verified empirically: joystick fwd/back → slot 3, rudder pedal → slot 2
                    fd.aileronPos = rf(); fd.rudderPos = rf(); fd.yokeY = rf();
                    fd.yokeX = rf(); fd.rudderPedal = rf();
                    fd.elevatorPos = fd.yokeY;  // use yoke Y as elevator proxy
                } catch (e) {
                    if (!this._loggedReadError) {
                        console.error('[SimConnect] Data read partial at buffer offset, got', Object.keys(fd).length, 'vars. Error:', e.message);
                        this._loggedReadError = true;
                    }
                }

                // Assign defaults for computed fields
                fd.groundTrack = fd.heading || 0;
                fd.altitudeMSL = fd.altitude || 0;

                // Update flightData with whatever we successfully read
                if (Object.keys(fd).length > 5) {
                    flightData = fd;
                    // Server-side rule engine evaluation (direct executeCommand, no browser)
                    ruleEngineServer.evaluate(fd);
                    // Include rule engine state in broadcast for UI display
                    flightData.aiAutopilot = ruleEngineServer.getBroadcastState();
                    broadcastFlightData();
                    // Re-apply held axis values at SIM_FRAME rate to overcome joystick polling
                    reapplyHeldAxes();
                }
            }
        });

        handle.on('close', () => {
            console.log('[SimConnect] Connection closed');
            isSimConnected = false;
            flightData.connected = false;
            // Clear held axes — no SimConnect to apply them to
            for (const key of Object.keys(_heldAxes)) delete _heldAxes[key];
            updateHeldAxesTimer();
            scheduleSimConnectRetry();
        });
        
        handle.on('error', (err) => {
            console.error('SimConnect error:', err);
        });
        
    } catch (err) {
        const wasAlreadyMock = !!mockDataInterval;
        isSimConnected = false;
        flightData.connected = false;

        if (!wasAlreadyMock) {
            console.log('[SimConnect] Not available:', err.message);
            console.log('[SimConnect] Running in MOCK mode — will keep retrying');
        }

        // Start mock data generator (idempotent — won't double-start)
        startMockData();
        scheduleSimConnectRetry();
    }
}

// ── ATC Facility Data (Taxi Graph) ───────────────────────────────────────
// Loads airport taxiway graphs from SimConnect facility data or cache.
// Used by ATC ground operations for A* taxi routing.

const ATC_CACHE_DIR = path.join(__dirname, '..', 'data', 'atc-cache');
const ATC_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const _facilityPending = {};  // ICAO → { resolve, reject, data }

// Ensure cache directory exists
try { fs.mkdirSync(ATC_CACHE_DIR, { recursive: true }); } catch (e) { /* ok */ }

/**
 * Request airport facility graph. Returns cached JSON or queries SimConnect.
 * Falls back to a mock mini-graph when SimConnect is unavailable.
 * @param {string} icao - Airport ICAO code (e.g., 'KSEA')
 * @returns {Promise<Object>} { nodes, edges, parking, runways, timestamp }
 */
async function requestFacilityGraph(icao) {
    if (!icao) return null;
    const key = icao.toUpperCase();

    // Build a dynamic graph using aircraft position + real NavDB runway data.
    // Not cached because it depends on aircraft's current position.
    const startLat = flightData?.latitude || 0;
    const startLon = flightData?.longitude || 0;

    // Query NavDB for real runway data
    let navdbRunways = [];
    try {
        const navdata = require('./navdata-api');
        if (navdata.queryAirport) {
            const airport = navdata.queryAirport(key);
            if (airport?.runways) navdbRunways = airport.runways;
        }
    } catch (e) { /* NavDB not available */ }

    // Fallback: try HTTP API if direct query failed
    if (navdbRunways.length === 0) {
        try {
            const http = require('http');
            const data = await new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:8080/api/navdb/airport/${key}`, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
                });
                req.on('error', reject);
                req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            navdbRunways = data?.runways || [];
        } catch (e) { /* HTTP fallback failed */ }
    }

    if (navdbRunways.length === 0 || !startLat) {
        console.log(`[ATC] No NavDB data for ${key} — using static mock graph`);
        return getStaticMockGraph(key);
    }

    return buildDynamicGraph(key, startLat, startLon, navdbRunways);
}

/**
 * Build a dynamic taxi graph from aircraft position + real NavDB runway data.
 * Creates intermediate waypoints between the aircraft and each runway.
 */
function buildDynamicGraph(icao, startLat, startLon, navdbRunways) {
    const nodes = [];
    const edges = [];
    const parking = [];
    const runways = [];

    // Node 0: Aircraft's current position (parking/start)
    nodes.push({ index: 0, lat: startLat, lon: startLon, name: 'AIRCRAFT', type: 'PARKING' });
    parking.push({ name: 'AIRCRAFT', lat: startLat, lon: startLon, nodeIndex: 0 });

    let nodeIdx = 1;
    const FT_PER_DEG = 364567; // approximate ft per degree latitude

    for (const rwy of navdbRunways) {
        const rwyLat = rwy.lat;
        const rwyLon = rwy.lon;
        const rwyHdg = rwy.heading || 0;
        const rwyIdent = (rwy.ident || '').replace(/^RW/, '');

        // Hold-short point: ~300ft perpendicular to the runway (left side of heading)
        const perpRad = (rwyHdg - 90) * Math.PI / 180;
        const holdOffsetFt = 300;
        const holdLat = rwyLat + (holdOffsetFt / FT_PER_DEG) * Math.cos(perpRad);
        const holdLon = rwyLon + (holdOffsetFt / (FT_PER_DEG * Math.cos(rwyLat * Math.PI / 180))) * Math.sin(perpRad);

        // Generate 4 intermediate waypoints from aircraft to hold-short
        // Slight lateral offset to simulate taxiway routing (not a perfectly straight line)
        const wpIndices = [];
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);
            let wpLat = startLat + (holdLat - startLat) * t;
            let wpLon = startLon + (holdLon - startLon) * t;
            const idx = nodeIdx++;
            const taxiLetter = String.fromCharCode(64 + i); // A, B, C, D
            nodes.push({ index: idx, lat: wpLat, lon: wpLon, name: taxiLetter, type: 'TAXIWAY' });
            wpIndices.push(idx);
        }

        // Hold-short node
        const holdIdx = nodeIdx++;
        nodes.push({ index: holdIdx, lat: holdLat, lon: holdLon, name: `RWY_${rwyIdent}`, type: 'RUNWAY_HOLD' });

        // Runway threshold node
        const thrIdx = nodeIdx++;
        nodes.push({ index: thrIdx, lat: rwyLat, lon: rwyLon, name: `${rwyIdent}_THR`, type: 'RUNWAY_THRESHOLD' });

        // Build edges: aircraft → wp1 → wp2 → wp3 → wp4 → hold → threshold
        const chain = [0, ...wpIndices, holdIdx, thrIdx];
        const taxiNames = ['Alpha', 'Alpha', 'Bravo', 'Bravo', 'Charlie', null];
        for (let i = 0; i < chain.length - 1; i++) {
            const from = nodes[chain[i]];
            const to = nodes[chain[i + 1]];
            const dist = haversineFtLocal(from.lat, from.lon, to.lat, to.lon);
            edges.push({
                from: chain[i],
                to: chain[i + 1],
                taxiway: taxiNames[i] || null,
                distance_ft: Math.round(dist)
            });
        }

        runways.push({
            ident: rwyIdent,
            lat: rwyLat,
            lon: rwyLon,
            heading: rwyHdg,
            nodeIndex: holdIdx,
            thresholdIndex: thrIdx
        });
    }

    console.log(`[ATC] Built dynamic graph for ${icao}: ${nodes.length} nodes, ${edges.length} edges, ${runways.length} runways (aircraft at ${startLat.toFixed(4)}, ${startLon.toFixed(4)})`);
    return {
        icao,
        nodes, edges, parking, runways,
        source: 'navdb-dynamic',
        cached: false,
        timestamp: Date.now()
    };
}

/** Haversine distance in feet (local copy for graph builder) */
function haversineFtLocal(lat1, lon1, lat2, lon2) {
    const R = 20902231;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Static mock graph — only used when NavDB is unavailable and no aircraft position.
 */
function getStaticMockGraph(icao) {
    const nodes = [
        { index: 0, lat: 47.4490, lon: -122.3088, name: 'GATE_A1', type: 'PARKING' },
        { index: 1, lat: 47.4492, lon: -122.3080, name: 'A',       type: 'TAXIWAY' },
        { index: 2, lat: 47.4500, lon: -122.3070, name: 'B',       type: 'TAXIWAY' },
        { index: 3, lat: 47.4510, lon: -122.3060, name: 'C',       type: 'TAXIWAY' },
        { index: 4, lat: 47.4520, lon: -122.3050, name: 'RWY_16R', type: 'RUNWAY_HOLD' },
        { index: 5, lat: 47.4530, lon: -122.3045, name: '16R_THR', type: 'RUNWAY_THRESHOLD' }
    ];
    const edges = [
        { from: 0, to: 1, taxiway: 'Alpha',   distance_ft: 250 },
        { from: 1, to: 2, taxiway: 'Alpha',   distance_ft: 400 },
        { from: 2, to: 3, taxiway: 'Bravo',   distance_ft: 350 },
        { from: 3, to: 4, taxiway: 'Charlie', distance_ft: 300 },
        { from: 4, to: 5, taxiway: null,       distance_ft: 150 }
    ];
    return {
        icao: icao || 'KSEA',
        nodes, edges,
        parking: [{ name: 'GATE_A1', lat: 47.4490, lon: -122.3088, nodeIndex: 0 }],
        runways: [{ ident: '16R', lat: 47.4530, lon: -122.3045, heading: 160, nodeIndex: 4, thresholdIndex: 5 }],
        source: 'mock',
        cached: false,
        timestamp: Date.now()
    };
}

// Mock data for browser testing without MSFS
function startMockData() {
    if (mockDataInterval || mockDataSuppressed) return; // Already running or suppressed
    console.log('[SimConnect] Starting mock data generator...');

    let mockAlt = 5000;
    let mockHdg = 0;
    let mockSpd = 120;

    mockDataInterval = setInterval(() => {
        // Simulate gentle flying
        mockAlt += (Math.random() - 0.5) * 100;
        mockHdg = (mockHdg + 0.5) % 360;
        mockSpd += (Math.random() - 0.5) * 5;
        
        // Simulate terrain elevation (Kansas area ~1500ft MSL with some variation)
        const mockGroundAlt = 1500 + Math.sin(mockHdg * Math.PI / 180) * 300;
        const mockAGL = Math.max(0, mockAlt) - mockGroundAlt;

        flightData = {
            altitude: Math.max(0, mockAlt),
            altitudeAGL: Math.max(0, mockAGL),
            groundAltitude: mockGroundAlt,
            speed: Math.max(0, mockSpd),
            heading: mockHdg,
            magvar: -5.2,  // Mock: typical value for central US
            groundTrack: (mockHdg + (Math.random() - 0.5) * 5 + 360) % 360,
            verticalSpeed: (Math.random() - 0.5) * 500,
            parkingBrake: false,
            gearDown: mockAlt < 2000,
            flapsIndex: mockSpd < 100 ? 2 : 0,
            navLight: true,
            beaconLight: true,
            strobeLight: true,
            landingLight: mockAlt < 3000,
            taxiLight: false,
            engineRunning: true,
            throttle: 65 + Math.random() * 10,
            localTime: new Date().getHours() + new Date().getMinutes() / 60,
            zuluTime: new Date().getUTCHours() + new Date().getUTCMinutes() / 60,
            // Autopilot (mock)
            apMaster: true,
            apHdgLock: true,
            apAltLock: true,
            apVsLock: false,
            apSpdLock: false,
            apHdgSet: 270,
            apAltSet: 5000,
            apVsSet: 0,
            apSpdSet: 120,
            // Fuel (mock) - simulating a typical GA aircraft with main tanks only
            fuelTotal: 42.5,
            fuelCapacity: 56.0,
            fuelFlow: 8.2,
            fuelTankLeftMain: 21.3,
            fuelTankRightMain: 21.2,
            fuelTankLeftAux: 0,
            fuelTankRightAux: 0,
            fuelTankCenter: 0,
            fuelTankCenter2: 0,
            fuelTankCenter3: 0,
            fuelTankLeftTip: 0,
            fuelTankRightTip: 0,
            fuelTankExternal1: 0,
            fuelTankExternal2: 0,
            fuelTankLeftMainCap: 28.0,
            fuelTankRightMainCap: 28.0,
            fuelTankLeftAuxCap: 0,
            fuelTankRightAuxCap: 0,
            fuelTankCenterCap: 0,
            fuelTankCenter2Cap: 0,
            fuelTankCenter3Cap: 0,
            fuelTankLeftTipCap: 0,
            fuelTankRightTipCap: 0,
            fuelTankExternal1Cap: 0,
            fuelTankExternal2Cap: 0,
            // Engine controls (mock)
            propeller: 100,
            mixture: 100,
            // Immersion / CockpitFX (mock)
            accelX: (Math.random() - 0.5) * 0.3,
            accelY: (Math.random() - 0.5) * 0.2,
            accelZ: -32.17 + (Math.random() - 0.5) * 0.5,
            angleOfAttack: 3 + (Math.random() - 0.5) * 2,
            sideslip: (Math.random() - 0.5) * 1,
            onGround: false,
            surfaceType: 0,
            stallWarning: false,
            overspeedWarning: false,
            gearPos0: mockAlt < 2000 ? 100 : 0,
            gearPos1: mockAlt < 2000 ? 100 : 0,
            gearPos2: mockAlt < 2000 ? 100 : 0,
            flapPercent: mockSpd < 100 ? 30 : 0,
            rotVelX: (Math.random() - 0.5) * 0.02,
            rotVelZ: (Math.random() - 0.5) * 0.01,
            canopyOpen: 0,
            exitOpen0: 0, exitOpen1: 0, exitOpen2: 0, exitOpen3: 0,
            // Flight controls (mock)
            aileron: 0,
            elevator: 0,
            rudder: 0,
            // Position data (mock - somewhere over Kansas flying west)
            latitude: 40.6413 + (Math.random() - 0.5) * 0.01,
            longitude: -95.5 + (Math.random() - 0.5) * 0.01,
            // Additional flight data (mock)
            groundSpeed: mockSpd * 1.1 + (Math.random() - 0.5) * 10,
            windDirection: 270 + (Math.random() - 0.5) * 20,
            windSpeed: 15 + (Math.random() - 0.5) * 10,

            // Weather conditions (Phase 1: Enhanced Weather Reading)
            temperature: 15 + (Math.random() - 0.5) * 10,  // Celsius
            pressure: 29.92 + (Math.random() - 0.5) * 0.3,  // inHg
            seaLevelPressure: 1013 + (Math.random() - 0.5) * 20,  // mb
            visibility: 9000 + Math.random() * 1000,  // meters (good VFR)
            precipRate: Math.random() < 0.8 ? 0 : Math.random() * 2,  // mm (mostly clear)
            inCloud: Math.random() < 0.2,  // 20% chance in cloud
            densityAltitude: 4700 + (Math.random() - 0.5) * 500,
            // GPS Flight Plan (mock flight: KJFK -> KLAX)
            gpsWpCount: 5,
            gpsWpIndex: 2,
            gpsWpDistance: 125.4 + (Math.random() - 0.5) * 2,
            gpsWpEte: 1850 + Math.random() * 100,
            gpsWpBearing: 275 + (Math.random() - 0.5) * 5,
            gpsWpNextLat: 39.8561,
            gpsWpNextLon: -104.6737,
            gpsWpNextAlt: 35000,
            gpsWpPrevLat: 41.9742,
            gpsWpPrevLon: -87.9073,
            gpsEte: 14400 + Math.random() * 500,
            gpsLat: 40.6413 + (Math.random() - 0.5) * 0.01,
            gpsLon: -95.5 + (Math.random() - 0.5) * 0.01,
            // NAV1 CDI/OBS mock data (simulating VOR approach)
            nav1Cdi: Math.round((Math.random() - 0.5) * 100),
            nav1Obs: 275,
            nav1Radial: 95 + (Math.random() - 0.5) * 5,
            nav1ToFrom: Math.random() > 0.5 ? 1 : 0,
            nav1Signal: 85 + Math.round(Math.random() * 15),
            nav1Gsi: Math.round((Math.random() - 0.5) * 60),
            nav1GsFlag: false,
            nav1HasLoc: true,
            nav1HasGs: true,
            // NAV2 mock data
            nav2Cdi: Math.round((Math.random() - 0.5) * 80),
            nav2Obs: 180,
            nav2Radial: 0 + (Math.random() - 0.5) * 5,
            nav2ToFrom: 1,
            nav2Signal: 70 + Math.round(Math.random() * 30),
            nav2Gsi: 0,
            nav2GsFlag: true,
            // GPS CDI mock data
            gpsCdiNeedle: Math.round((Math.random() - 0.5) * 50),
            gpsCrossTrackError: (Math.random() - 0.5) * 1.5,
            gpsDesiredTrack: 275,
            gpsObsValue: 275,
            gpsVerticalError: (Math.random() - 0.5) * 2,
            gpsApproachMode: false,
            // Transponder
            transponder: 1200,
            transponderState: 4,
            transponderIdent: 0,
            // Navigation source
            apNavSelected: 0,
            connected: false, // Show as disconnected in mock mode
            aiAutopilot: ruleEngineServer.getBroadcastState()
        };

        broadcastFlightData();
    }, 100);
}

// ===== Stream Deck Integration API =====
// Simple REST endpoints for Elgato Stream Deck actions

app.get('/api/streamdeck/actions', (req, res) => {
    res.json({
        actions: [
            { id: 'camera.cockpit', name: 'Cockpit View', icon: '🎥' },
            { id: 'camera.external', name: 'External View', icon: '🌍' },
            { id: 'camera.drone', name: 'Drone View', icon: '🚁' },
            { id: 'camera.showcase', name: 'Showcase View', icon: '✨' },
            { id: 'sim.pause', name: 'Pause/Resume', icon: '⏸️' },
            { id: 'sim.slew', name: 'Toggle Slew', icon: '🕹️' },
            { id: 'lights.landing', name: 'Landing Lights', icon: '💡' },
            { id: 'lights.nav', name: 'Nav Lights', icon: '🔦' },
            { id: 'gear.toggle', name: 'Toggle Gear', icon: '🛞' },
            { id: 'flaps.up', name: 'Flaps Up', icon: '⬆️' },
            { id: 'flaps.down', name: 'Flaps Down', icon: '⬇️' },
            { id: 'ap.toggle', name: 'Autopilot', icon: '🤖' },
            { id: 'xpdr.7700', name: 'Squawk 7700', icon: '🚨' }
        ]
    });
});

app.post('/api/streamdeck/execute/:actionId', async (req, res) => {
    const { actionId } = req.params;
    console.log('[StreamDeck] Execute:', actionId);

    try {
        const [category, action] = actionId.split('.');

        switch (category) {
            case 'camera':
                await cameraSystem.executeAction(action);
                break;
            case 'sim':
                if (action === 'pause') await sendSimConnectEvent('PAUSE_TOGGLE');
                if (action === 'slew') await sendSimConnectEvent('SLEW_TOGGLE');
                break;
            case 'lights':
                if (action === 'landing') await sendSimConnectEvent('LANDING_LIGHTS_TOGGLE');
                if (action === 'nav') await sendSimConnectEvent('NAV_LIGHTS_TOGGLE');
                break;
            case 'gear':
                await sendSimConnectEvent('GEAR_TOGGLE');
                break;
            case 'flaps':
                if (action === 'up') await sendSimConnectEvent('FLAPS_UP');
                if (action === 'down') await sendSimConnectEvent('FLAPS_DOWN');
                break;
            case 'ap':
                await sendSimConnectEvent('AP_MASTER');
                break;
            case 'xpdr':
                if (action === '7700') await sendSimConnectEvent('XPNDR_SET', 7700);
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }

        res.json({ success: true, action: actionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/streamdeck/status', (req, res) => {
    res.json({
        connected: connected,
        flightData: latestFlightData ? {
            altitude: Math.round(latestFlightData.altitude || 0),
            speed: Math.round(latestFlightData.speed || 0),
            heading: Math.round(latestFlightData.heading || 0),
            onGround: latestFlightData.onGround || false
        } : null
    });
});

// Helper for SimConnect events
async function sendSimConnectEvent(event, value = 0) {
    if (typeof simConnect !== 'undefined' && simConnect) {
        try {
            simConnect.transmitClientEvent(event, value);
        } catch (e) {
            console.log('[StreamDeck] SimConnect event error:', e.message);
        }
    }
}

// Start server with TroubleshootEngine
// Setup Weather Control API
setupWeatherRoutes(app, () => simConnectConnection);

// Setup Copilot AI API (streaming LLM proxy)
setupCopilotRoutes(app, () => flightData);

// Setup AI Pilot API (autopilot advisory + command execution via SimConnect)
setupAiPilotRoutes(app, () => flightData, () => simConnectConnection, eventMap, { requestFacilityGraph });

// Setup Navigation Database API (FAA CIFP SQLite)
setupNavdataRoutes(app);

// Setup Little Navmap Integration API (UDP position sharing, .PLN import/export)
littleNavMapAPI.setupRoutes(app);

const troubleshoot = new TroubleshootEngine('SimGlass');

troubleshoot.startServer(server, PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           SimGlass Backend Server v${SERVER_VERSION}                   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  HTTP Server:    http://localhost:${PORT}                   ║
║  WebSocket:      ws://localhost:${PORT}                     ║
║                                                           ║
║  Open browser to http://localhost:${PORT} for UI dev        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    // Check vJoy availability for ChasePlane camera controls
    const vjoyReady = await checkVJoy();
    if (vjoyReady) {
        console.log('[vJoy] ChasePlane camera controls enabled via virtual joystick');
    } else {
        console.log('[vJoy] Not available - using keyboard fallback for camera');
    }
    
    // Initialize camera controller (detects ChasePlane)
    const camStatus = await cameraController.init();
    console.log(`[Camera] Mode: ${camStatus.mode.toUpperCase()}`);
    if (camStatus.chasePlane) {
        console.log('[Camera] ChasePlane detected');
    }
    
    // Try to connect to SimConnect
    initSimConnect();
});

