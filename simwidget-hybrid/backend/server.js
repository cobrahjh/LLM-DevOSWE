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

// Serve root widgets folder
const widgetsPath = path.join(__dirname, '../../widgets');
app.use('/widgets', express.static(widgetsPath), serveIndex(widgetsPath, { icons: true }));

// Root index page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimWidget Command Center</title>
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
    <h1>🎛️ SimWidget Command Center <span class="status">Online</span></h1>
    <p class="version">Server v${SERVER_VERSION} | KeySender v${keySender.getVersion()} | <a href="http://192.168.1.42:8500" target="_blank">Master (O)</a></p>
    
    <div style="margin: 20px 0;">
        <a href="http://192.168.1.42:8500" target="_blank" class="service-link master">🎛️ Master (O) :8500</a>
        <a href="http://192.168.1.42:8585" target="_blank" class="service-link agent">🤖 Kitt Agent :8585</a>
        <a href="http://192.168.1.42:8590" target="_blank" class="service-link remote">📡 Remote Support :8590</a>
    </div>
    
    <div class="grid">
        <div class="section highlight">
            <h2>🎮 Flight Widgets</h2>
            <ul>
                <li><a href="/ui/aircraft-control/">✈️ Aircraft Control</a></li>
                <li><a href="/ui/camera-widget/">📷 Camera Widget</a></li>
                <li><a href="/ui/flight-data-widget/">📊 Flight Data</a></li>
                <li><a href="/ui/flight-recorder/">🎬 Flight Recorder</a></li>
                <li><a href="/ui/fuel-widget/">⛽ Fuel Widget</a></li>
                <li><a href="/ui/wasm-camera/">🎥 WASM Camera</a></li>
            </ul>
        </div>
        
        <div class="section">
            <h2>⚙️ Configuration</h2>
            <ul>
                <li><a href="/ui/keymap-editor/">⌨️ Keymap Editor</a></li>
                <li><a href="/ui/services-panel/">🔧 Services Panel</a></li>
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
        
        <div class="section">
            <h2>📂 Resources</h2>
            <ul>
                <li><a href="/ui/">📂 /ui/</a> - All UI Widgets</li>
                <li><a href="/backend/">📂 /backend/</a> - Backend Source</li>
                <li><a href="http://192.168.1.42:8585" target="_blank">🤖 Kitt Agent</a> <span class="new-badge">NEW</span></li>
                <li><a href="http://192.168.1.42:8500" target="_blank">🎛️ Master Dashboard</a> <span class="new-badge">NEW</span></li>
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
        .desc { color: #888; margin-left: 15px; }
        .back { margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="back"><a href="/">← Back to Home</a></div>
    <h1>🔌 SimWidget API</h1>
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
        name: 'SimWidget API',
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

app.get('/api/status', (req, res) => {
    res.json({ 
        connected: isSimConnected,
        camera: cameraController.getStatus(),
        flightData 
    });
});

// Graceful shutdown endpoint
app.post('/api/shutdown', (req, res) => {
    console.log('[Server] Shutdown requested via API');
    res.json({ status: 'shutting_down' });
    
    // Close WebSocket connections
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'server_shutdown' }));
        client.close();
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
            { name: 'simwidget', port: 8080, description: 'Main SimWidget server' },
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
        simwidget: {
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
        simwidget: path.join(__dirname, '..', 'logs', 'server.log'),
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
        modes: { 0: 'off', 2: 'flyby' }
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
        wouldSend: key ? `powershell -ExecutionPolicy Bypass -File C:\\DevOSWE\\send-key.ps1 -Key ${key}` : null
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
                    exec('powershell -ExecutionPolicy Bypass -File "C:\\DevOSWE\\send-key.ps1" -Key "ALT+Z"');
                } else if (command === 'KEY_NEXT_CINEMATIC' || command === 'NCV') {
                    exec('powershell -ExecutionPolicy Bypass -File "C:\\DevOSWE\\send-key.ps1" -Key "ALT+X"');
                }
            }
        });
        return;
    }
    
    // Legacy camera commands (direct keyboard)
    if (command === 'KEY_TOGGLE_CINEMATIC') {
        console.log('[Camera] TCM - Alt+Z');
        exec('powershell -ExecutionPolicy Bypass -File "C:\\DevOSWE\\send-key.ps1" -Key "ALT+Z"');
        return;
    }
    if (command === 'KEY_NEXT_CINEMATIC') {
        console.log('[Camera] NCV - Alt+X');
        exec('powershell -ExecutionPolicy Bypass -File "C:\\DevOSWE\\send-key.ps1" -Key "ALT+X"');
        return;
    }
    if (command === 'VIEW_MODE') {
        // Try SimConnect first (works without elevation)
        if (simConnectConnection && eventMap['VIEW_MODE']) {
            console.log('[Camera] VIEW_MODE via SimConnect');
            try {
                simConnectConnection.transmitClientEvent(0, eventMap['VIEW_MODE'], 0, 1, 16);
                return;
            } catch (e) {
                console.log('[Camera] SimConnect failed, trying keyboard');
            }
        }
        exec('powershell -ExecutionPolicy Bypass -File "C:\\DevOSWE\\send-key.ps1" -Key "END"');
        return;
    }
    
    if (!simConnectConnection) return;
    
    const eventId = eventMap[command];
    if (eventId !== undefined) {
        try {
            let simValue = 0;
            
            // Handle different command types
            if (command === 'THROTTLE_SET' || command === 'PROP_PITCH_SET' || command === 'MIXTURE_SET') {
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
            } else if (command === 'AXIS_AILERONS_SET' || command === 'AXIS_ELEVATOR_SET' || command === 'AXIS_RUDDER_SET') {
                // Flight controls: -100 to 100 → -16383 to 16383
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

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    
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
    
    ws.on('close', () => {
        console.log('Client disconnected');
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

// Broadcast flight data to all connected clients
function broadcastFlightData() {
    const message = JSON.stringify({ type: 'flightData', data: flightData });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// SimConnect initialization
async function initSimConnect() {
    try {
        const { open, Protocol, SimConnectDataType } = require('node-simconnect');
        
        console.log('Connecting to MSFS...');
        
        const { recvOpen, handle } = await open('SimWidget', Protocol.KittyHawk);
        
        console.log('Connected to MSFS:', recvOpen.applicationName);
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
            'GEAR_TOGGLE',
            'FLAPS_UP',
            'FLAPS_DOWN',
            // Autopilot events
            'AP_MASTER',
            'AP_HDG_HOLD',
            'AP_ALT_HOLD',
            'AP_VS_HOLD',
            'AP_PANEL_SPEED_HOLD',
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
            // Flight controls
            'AXIS_AILERONS_SET',
            'AXIS_ELEVATOR_SET',
            'AXIS_RUDDER_SET',
            'CENTER_AILER_RUDDER',
            // Engine control events
            'THROTTLE_SET',
            'PROP_PITCH_SET',
            'MIXTURE_SET',
            // Slew mode for flight recorder playback
            'SLEW_TOGGLE',
            'SLEW_ON',
            'SLEW_OFF'
            // Note: Fuel control uses writable SimVars, not events
        ];
        
        events.forEach((eventName, index) => {
            const eventId = 1000 + index;
            handle.mapClientEventToSimEvent(eventId, eventName);
            eventMap[eventName] = eventId;
        });
        console.log('Mapped', events.length, 'client events');
        
        // Define data request using proper data types
        handle.addToDataDefinition(0, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AIRSPEED INDICATED', 'knots', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE HEADING DEGREES MAGNETIC', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'BRAKE PARKING POSITION', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'GEAR HANDLE POSITION', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'FLAPS HANDLE INDEX', 'Number', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'LIGHT NAV', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'LIGHT BEACON', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'LIGHT STROBE', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'LIGHT LANDING', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'LIGHT TAXI', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'ENG COMBUSTION:1', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG THROTTLE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'LOCAL TIME', 'Hours', SimConnectDataType.FLOAT64, 0);
        // Autopilot data
        handle.addToDataDefinition(0, 'AUTOPILOT MASTER', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT HEADING LOCK', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT ALTITUDE LOCK', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT VERTICAL HOLD', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT AIRSPEED HOLD', 'Bool', SimConnectDataType.INT32, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT HEADING LOCK DIR', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT ALTITUDE LOCK VAR', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT VERTICAL HOLD VAR', 'feet per minute', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AUTOPILOT AIRSPEED HOLD VAR', 'knots', SimConnectDataType.FLOAT64, 0);
        // Fuel data - Total and flow
        handle.addToDataDefinition(0, 'FUEL TOTAL QUANTITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'FUEL TOTAL CAPACITY', 'gallons', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ENG FUEL FLOW GPH:1', 'gallons per hour', SimConnectDataType.FLOAT64, 0);
        // Individual tank quantities (11 tanks)
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
        // Individual tank capacities (11 tanks)
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
        // Engine control data
        handle.addToDataDefinition(0, 'GENERAL ENG PROPELLER LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'GENERAL ENG MIXTURE LEVER POSITION:1', 'Percent', SimConnectDataType.FLOAT64, 0);
        // Flight control data
        handle.addToDataDefinition(0, 'AILERON POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'ELEVATOR POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'RUDDER POSITION', 'Position', SimConnectDataType.FLOAT64, 0);
        // Additional flight data (for flight-data-widget)
        handle.addToDataDefinition(0, 'GROUND VELOCITY', 'knots', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT WIND DIRECTION', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'AMBIENT WIND VELOCITY', 'knots', SimConnectDataType.FLOAT64, 0);
        // Position data (for flight recorder playback)
        handle.addToDataDefinition(0, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE PITCH DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        handle.addToDataDefinition(0, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64, 0);
        
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
        
        // Request data every 100ms
        handle.requestDataOnSimObject(0, 0, 0, 3, 0); // Period = SIM_FRAME
        
        // Handle incoming data
        handle.on('simObjectData', (data) => {
            if (data.requestID === 0) {
                // Read data in order using buffer methods
                const d = data.data;
                try {
                    flightData = {
                        altitude: d.readFloat64(),
                        speed: d.readFloat64(),
                        heading: d.readFloat64(),
                        verticalSpeed: d.readFloat64(),
                        parkingBrake: d.readInt32() !== 0,
                        gearDown: d.readInt32() !== 0,
                        flapsIndex: d.readInt32(),
                        navLight: d.readInt32() !== 0,
                        beaconLight: d.readInt32() !== 0,
                        strobeLight: d.readInt32() !== 0,
                        landingLight: d.readInt32() !== 0,
                        taxiLight: d.readInt32() !== 0,
                        engineRunning: d.readInt32() !== 0,
                        throttle: d.readFloat64(),
                        localTime: d.readFloat64(),
                        // Autopilot
                        apMaster: d.readInt32() !== 0,
                        apHdgLock: d.readInt32() !== 0,
                        apAltLock: d.readInt32() !== 0,
                        apVsLock: d.readInt32() !== 0,
                        apSpdLock: d.readInt32() !== 0,
                        apHdgSet: d.readFloat64(),
                        apAltSet: d.readFloat64(),
                        apVsSet: d.readFloat64(),
                        apSpdSet: d.readFloat64(),
                        // Fuel totals
                        fuelTotal: d.readFloat64(),
                        fuelCapacity: d.readFloat64(),
                        fuelFlow: d.readFloat64(),
                        // Individual tank quantities (read in order)
                        fuelTankLeftMain: d.readFloat64(),
                        fuelTankRightMain: d.readFloat64(),
                        fuelTankLeftAux: d.readFloat64(),
                        fuelTankRightAux: d.readFloat64(),
                        fuelTankCenter: d.readFloat64(),
                        fuelTankCenter2: d.readFloat64(),
                        fuelTankCenter3: d.readFloat64(),
                        fuelTankLeftTip: d.readFloat64(),
                        fuelTankRightTip: d.readFloat64(),
                        fuelTankExternal1: d.readFloat64(),
                        fuelTankExternal2: d.readFloat64(),
                        // Individual tank capacities
                        fuelTankLeftMainCap: d.readFloat64(),
                        fuelTankRightMainCap: d.readFloat64(),
                        fuelTankLeftAuxCap: d.readFloat64(),
                        fuelTankRightAuxCap: d.readFloat64(),
                        fuelTankCenterCap: d.readFloat64(),
                        fuelTankCenter2Cap: d.readFloat64(),
                        fuelTankCenter3Cap: d.readFloat64(),
                        fuelTankLeftTipCap: d.readFloat64(),
                        fuelTankRightTipCap: d.readFloat64(),
                        fuelTankExternal1Cap: d.readFloat64(),
                        fuelTankExternal2Cap: d.readFloat64(),
                        // Engine controls
                        propeller: d.readFloat64(),
                        mixture: d.readFloat64(),
                        // Flight controls (-1 to 1 range, convert to -100 to 100)
                        aileron: d.readFloat64() * 100,
                        elevator: d.readFloat64() * 100,
                        rudder: d.readFloat64() * 100,
                        // Additional flight data
                        groundSpeed: d.readFloat64(),
                        windDirection: d.readFloat64(),
                        windSpeed: d.readFloat64(),
                        // Position data (for flight recorder)
                        latitude: d.readFloat64(),
                        longitude: d.readFloat64(),
                        altitudeMSL: d.readFloat64(),
                        pitch: d.readFloat64(),
                        bank: d.readFloat64(),
                        connected: true
                    };
                    broadcastFlightData();
                } catch (e) {
                    console.error('Data read error:', e.message);
                }
            }
        });
        
        handle.on('close', () => {
            console.log('SimConnect closed');
            isSimConnected = false;
            flightData.connected = false;
            // Try to reconnect after 5 seconds
            setTimeout(initSimConnect, 5000);
        });
        
        handle.on('error', (err) => {
            console.error('SimConnect error:', err);
        });
        
    } catch (err) {
        console.log('SimConnect not available:', err.message);
        console.log('Running in MOCK mode - generating fake data for UI development');
        isSimConnected = false;
        flightData.connected = false;
        
        // Start mock data generator
        startMockData();
    }
}

// Mock data for browser testing without MSFS
function startMockData() {
    console.log('Starting mock data generator...');
    
    let mockAlt = 5000;
    let mockHdg = 0;
    let mockSpd = 120;
    
    setInterval(() => {
        // Simulate gentle flying
        mockAlt += (Math.random() - 0.5) * 100;
        mockHdg = (mockHdg + 0.5) % 360;
        mockSpd += (Math.random() - 0.5) * 5;
        
        flightData = {
            altitude: Math.max(0, mockAlt),
            speed: Math.max(0, mockSpd),
            heading: mockHdg,
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
            // Flight controls (mock)
            aileron: 0,
            elevator: 0,
            rudder: 0,
            // Additional flight data (mock)
            groundSpeed: mockSpd * 1.1 + (Math.random() - 0.5) * 10,
            windDirection: 270 + (Math.random() - 0.5) * 20,
            windSpeed: 15 + (Math.random() - 0.5) * 10,
            connected: false // Show as disconnected in mock mode
        };
        
        broadcastFlightData();
    }, 100);
}

// Start server with TroubleshootEngine
const troubleshoot = new TroubleshootEngine('SimWidget');

troubleshoot.startServer(server, PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           SimWidget Backend Server v${SERVER_VERSION}                   ║
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

