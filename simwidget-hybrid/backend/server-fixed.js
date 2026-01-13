/**
 * SimWidget Backend Server v1.9.0
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

// Hot reload manager (development only)
const hotReloadManager = new HotReloadManager();

const SERVER_VERSION = '1.10.0';

// SimConnect - will be loaded dynamically
let simConnect = null;
let simConnectConnection = null;
let isSimConnected = false;

// Fuel write data definition IDs (set during SimConnect init)
let fuelWriteDefId = null;
let fuelWriteDefIdRight = null;

// Camera controller (handles ChasePlane detection)
const cameraController = new CameraController();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 8080;

// Flight data state
let flightData = {
    altitude: 0,
    speed: 0,
    heading: 0,
    verticalSpeed: 0,
    groundSpeed: 0,        // Added for flight-data-widget
    windDirection: 0,      // Added for flight-data-widget
    windSpeed: 0,          // Added for flight-data-widget
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
    // Flight controls
    aileron: 0,
    elevator: 0,
    rudder: 0,
    // Position data (for flight recorder)
    latitude: 0,
    longitude: 0,
    altitudeMSL: 0,
    pitch: 0,
    bank: 0
};

// Directory structure (DEBUG - TODO: disable directory listing for production)
const uiPath = path.join(__dirname, '../ui');
const configPath = path.join(__dirname, '../config');
const backendPath = path.join(__dirname);

// Serve shared UI for hot reload and common components
const sharedUIPath = path.join(__dirname, '../shared-ui');
app.use('/shared-ui', express.static(sharedUIPath));

// Serve UI directories with listing
app.use('/ui', express.static(uiPath), serveIndex(uiPath, { icons: true }));
app.use('/config', express.static(configPath), serveIndex(configPath, { icons: true }));
app.use('/backend', express.static(backendPath), serveIndex(backendPath, { icons: true }));

// Root index page
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SimWidget Engine</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 40px; }
        h1 { color: #7ec8e3; }
        a { color: #7ec8e3; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .section { margin: 20px 0; padding: 15px; background: #16213e; border-radius: 8px; }
        .section h2 { margin-top: 0; color: #4ade80; font-size: 16px; }
        ul { list-style: none; padding: 0; }
        li { padding: 5px 0; }
        .version { color: #888; font-size: 12px; }
    </style>
</head>
<body>
    <h1>SimWidget Engine</h1>
    <p class="version">Server v${SERVER_VERSION} | KeySender v${keySender.getVersion()}</p>
    
    <div class="section">
        <h2>📁 Directories</h2>
        <ul>
            <li><a href="/ui/">📂 /ui/</a> - UI Widgets & Controls</li>
            <li><a href="/config/">📂 /config/</a> - Configuration Files</li>
            <li><a href="/backend/">📂 /backend/</a> - Backend Source</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>🎮 UI Widgets</h2>
        <ul>
            <li><a href="/ui/aircraft-control/">✈️ Aircraft Control</a></li>
            <li><a href="/ui/camera-widget/">📷 Camera Widget</a></li>
            <li><a href="/ui/flight-data-widget/">📊 Flight Data Widget</a></li>
            <li><a href="/ui/flight-recorder/">🎬 Flight Recorder</a></li>
            <li><a href="/ui/fuel-widget/">⛽ Fuel Widget</a></li>
            <li><a href="/ui/keymap-editor/">⌨️ Keymap Editor</a></li>
            <li><a href="/ui/services-panel/">🔧 Services Panel</a></li>
            <li><a href="/ui/voice-control/">🎤 Voice Control</a></li>
        </ul>
    </div>
    
    <div class="section">
        <h2>🔌 API</h2>
        <ul>
            <li><a href="/api">/api</a> - API Index (all endpoints)</li>
            <li><a href="/api/status">/api/status</a> - Connection Status</li>
            <li><a href="/api/keymaps">/api/keymaps</a> - Key Mappings</li>
            <li><a href="/api/debug/camera">/api/debug/camera</a> - Camera Debug</li>
        </ul>
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

// REST API endpoints

// API Index - list all available endpoints (HTML view)
app.get('/api', (req, res) => {
    // If requesting JSON, return JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(getApiIndex());
    }
    
    // Otherwise return HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SimWidget API</title>
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
    </style>
</head>
<body>
    <h1>🔌 SimWidget API v${SERVER_VERSION}</h1>
    
    <p><a href="/">← Back to Main</a></p>
    
    ${generateApiIndexHtml()}
</body>
</html>
    `);
});