/**
 * SimWidget Master (O) v1.2.0
 *
 * Master service orchestrator - survives when child services fail
 *
 * Path: C:\LLM-DevOSWE\Admin\orchestrator\orchestrator.js
 * Last Updated: 2026-01-20
 *
 * v1.2.0 - Added Hive-Mind, Terminal Hub, Hive Brain, Hive Oracle to watchdog
 *        - Added spawn fallback for services without Windows Services
 * v1.1.0 - Switched to Windows Services for all managed services
 *        - Removed spawn fallback (all services are Windows Services now)
 * 
 * Features:
 *   - Service registry with inheritance
 *   - Health watchdog with auto-restart
 *   - REST API for service control
 *   - Web dashboard
 *   - Runs independently of managed services
 * 
 * Endpoints:
 *   GET  /api/health         - Master health
 *   GET  /api/status         - All services status
 *   GET  /api/services       - Service registry
 *   GET  /api/services/:id   - Single service status
 *   POST /api/services/:id/start   - Start service
 *   POST /api/services/:id/stop    - Stop service
 *   POST /api/services/:id/restart - Restart service
 *   POST /api/start-all      - Start all services
 *   POST /api/stop-all       - Stop all services
 *   POST /api/shutdown       - Shutdown Master
 *   GET  /api/log            - Master logs
 *   GET  /api/watchdog       - Watchdog status
 *   POST /api/watchdog/enable  - Enable auto-restart
 *   POST /api/watchdog/disable - Disable auto-restart
 */

const express = require('express');
const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = 8500;
const PROJECT_ROOT = 'C:\\LLM-DevOSWE';
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}


// ============================================
// SERVICE LOGGING (Standard Pattern)
// ============================================

const SERVICE_LOG = path.join(LOGS_DIR, 'orchestrator.log');
const logBuffer = [];
const MAX_LOG_LINES = 500;

function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}`;
    logBuffer.push(line);
    if (logBuffer.length > MAX_LOG_LINES) {
        logBuffer.shift();
    }
    fs.appendFileSync(SERVICE_LOG, line + '\n');
    console.log(line);
}

// ============================================
// SERVICE REGISTRY
// ============================================

const SERVICES = {
    oracle: {
        id: 'oracle',
        name: 'Oracle',
        port: 3002,
        dir: 'C:\\LLM-Oracle',
        start: 'node oracle.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 0,
        autoRestart: true
    },
    simwidget: {
        id: 'simwidget',
        name: 'SimWidget Main Server',
        port: 8080,
        dir: path.join(PROJECT_ROOT, 'simwidget-hybrid', 'backend'),
        start: 'node server.js',
        winService: 'simwidgetmainserver.exe',  // Windows Service ID
        healthEndpoint: '/api/status',
        priority: 1,
        autoRestart: true
    },
    agent: {
        id: 'agent',
        name: 'Agent (Kitt)',
        port: 8585,
        dir: path.join(PROJECT_ROOT, 'Admin', 'agent'),
        start: 'node agent-server.js',
        winService: 'simwidgetagent.exe',  // Windows Service ID
        healthEndpoint: '/api/health',
        priority: 2,
        autoRestart: true
    },
    relay: {
        id: 'relay',
        name: 'Relay Service',
        port: 8600,
        dir: path.join(PROJECT_ROOT, 'Admin', 'relay'),
        start: 'node relay-service.js',
        winService: 'simwidgetrelay.exe',  // Windows Service ID
        healthEndpoint: '/api/health',
        priority: 3,
        autoRestart: true
    },
    remote: {
        id: 'remote',
        name: 'Remote Support',
        port: 8590,
        dir: path.join(PROJECT_ROOT, 'Admin', 'remote-support'),
        start: 'node service.js',
        winService: 'simwidgetremotesupport.exe',  // Windows Service ID
        healthEndpoint: '/api/health',
        priority: 4,
        autoRestart: true
    },
    bridge: {
        id: 'bridge',
        name: 'Claude Bridge',
        port: 8601,
        dir: path.join(PROJECT_ROOT, 'Admin', 'claude-bridge'),
        start: 'node bridge-server.js',
        winService: 'simwidgetclaudebridge.exe',  // Windows Service ID
        healthEndpoint: '/api/health',
        priority: 5,
        autoRestart: false
    },
    keysender: {
        id: 'keysender',
        name: 'KeySender Service',
        port: null,  // No HTTP port - native Windows service
        dir: path.join(PROJECT_ROOT, 'KeySenderService'),
        start: null,  // Managed by Windows Service only
        winService: 'simwidgetkeysender',  // Windows Service ID
        healthEndpoint: null,  // Health checked via SC query
        priority: 6,
        autoRestart: false,  // No start command available - Windows Service only
        type: 'native'  // Flag for native Windows service (no Node.js)
    },
    hivemind: {
        id: 'hivemind',
        name: 'Hive-Mind Monitor',
        port: 8701,
        dir: path.join(PROJECT_ROOT, 'Admin', 'hive-mind'),
        start: 'node hive-mind-server.js',
        winService: null,  // No Windows Service yet
        healthEndpoint: '/api/health',
        priority: 7,
        autoRestart: true
    },
    terminalhub: {
        id: 'terminalhub',
        name: 'Terminal Hub',
        port: 8771,
        dir: path.join(PROJECT_ROOT, 'Admin', 'terminal-hub'),
        start: 'node terminal-hub-server.js',
        winService: null,  // No Windows Service yet
        healthEndpoint: '/api/health',
        priority: 8,
        autoRestart: true
    },
    hivebrain: {
        id: 'hivebrain',
        name: 'Hive Brain Admin',
        port: 8800,
        dir: path.join(PROJECT_ROOT, 'Admin', 'hive-brain'),
        start: 'node server.js',
        winService: null,  // No Windows Service yet
        healthEndpoint: '/api/health',
        priority: 9,
        autoRestart: true
    },
    hiveoracle: {
        id: 'hiveoracle',
        name: 'Hive Oracle (LLM)',
        port: 8850,
        dir: path.join(PROJECT_ROOT, 'Admin', 'hive-oracle'),
        start: 'node server.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 10,
        autoRestart: true
    },
    hivebraindiscovery: {
        id: 'hivebraindiscovery',
        name: 'Hive-Brain Discovery',
        port: 8810,
        dir: path.join(PROJECT_ROOT, 'Admin', 'hive-brain'),
        start: 'node hive-brain.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 11,
        autoRestart: true
    },
    mastermind: {
        id: 'mastermind',
        name: 'Master-Mind',
        port: 8820,
        dir: path.join(PROJECT_ROOT, 'Admin', 'master-mind'),
        start: 'node master-mind.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 12,
        autoRestart: true
    },
    hivemesh: {
        id: 'hivemesh',
        name: 'Hive-Mesh',
        port: 8750,
        dir: 'C:\\DevClaude\\Hivemind\\mesh',
        start: 'node mesh.js',
        winService: null,
        healthEndpoint: '/health',
        priority: 13,
        autoRestart: true
    },
    mcpbridge: {
        id: 'mcpbridge',
        name: 'MCP-Bridge',
        port: 8860,
        dir: path.join(PROJECT_ROOT, 'Admin', 'mcp-bridge'),
        start: 'node server.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 14,
        autoRestart: true
    },
    dashboard: {
        id: 'dashboard',
        name: 'Hive Dashboard',
        port: 8899,
        dir: path.join(PROJECT_ROOT, 'Admin', 'hive-dashboard'),
        start: 'node server.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 15,
        autoRestart: true
    },
    voiceaccess: {
        id: 'voiceaccess',
        name: 'VoiceAccess',
        port: 8875,
        dir: path.join(PROJECT_ROOT, 'Admin', 'voiceaccess'),
        start: 'node server.js',
        winService: null,
        healthEndpoint: '/api/health',
        priority: 16,
        autoRestart: true
    }
};

// Track service states
const serviceStates = {};
for (const id of Object.keys(SERVICES)) {
    serviceStates[id] = {
        running: false,
        lastCheck: null,
        lastStart: null,
        restartCount: 0,
        consecutiveHealthy: 0,
        error: null
    };
}


// ============================================
// WATCHDOG
// ============================================

let watchdogEnabled = true;
let watchdogInterval = null;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_COOLDOWN = 60000; // 1 minute between restarts

async function checkServiceHealth(serviceId) {
    const svc = SERVICES[serviceId];
    if (!svc) return { healthy: false, error: 'Unknown service' };

    // Native Windows services (no HTTP port) - check via SC query
    if (svc.type === 'native' || !svc.port) {
        return new Promise((resolve) => {
            exec(`sc query "${svc.winService}"`, (error, stdout) => {
                if (error) {
                    resolve({ healthy: false, error: 'Service not found' });
                } else {
                    const running = stdout.includes('RUNNING');
                    resolve({ healthy: running, status: running ? 'RUNNING' : 'STOPPED' });
                }
            });
        });
    }

    // HTTP-based health check for Node.js services
    return new Promise((resolve) => {
        const req = http.get({
            hostname: 'localhost',
            port: svc.port,
            path: svc.healthEndpoint,
            timeout: 5000
        }, (res) => {
            res.resume(); // Drain response body to free connection
            resolve({ healthy: res.statusCode === 200, statusCode: res.statusCode });
        });

        req.on('error', (err) => {
            resolve({ healthy: false, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ healthy: false, error: 'Timeout' });
        });
    });
}

async function checkPortInUse(port) {
    return new Promise((resolve) => {
        exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Where-Object {$_.State -eq 'Listen'}"`,
            (error, stdout) => {
                resolve(stdout.trim().length > 0);
            });
    });
}

// Send alert to Relay's alert system (P8)
function sendRelayAlert(severity, title, message, service) {
    const body = JSON.stringify({ severity, source: 'orchestrator', title, message, service });
    const req = http.request({
        hostname: 'localhost', port: 8600,
        path: '/api/alerts', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => { res.resume(); });
    req.on('error', () => {}); // Non-blocking, ignore errors
    req.setTimeout(5000, () => req.destroy());
    req.write(body);
    req.end();
}

const previousHealthState = {};

async function watchdogCheck() {
    if (!watchdogEnabled) return;

    for (const [id, svc] of Object.entries(SERVICES)) {
        const state = serviceStates[id];
        const health = await checkServiceHealth(id);
        const portInUse = await checkPortInUse(svc.port);
        const wasHealthy = previousHealthState[id] !== false;

        state.running = portInUse;
        state.lastCheck = new Date().toISOString();

        if (!health.healthy && svc.autoRestart && watchdogEnabled) {
            state.consecutiveHealthy = 0;

            // Alert on state change (healthy -> unhealthy)
            if (wasHealthy) {
                sendRelayAlert('error', `${svc.name} is DOWN`, `Service ${svc.name} (port ${svc.port}) failed health check. Auto-restart enabled.`, svc.name);
            }
            previousHealthState[id] = false;

            // Check cooldown
            const timeSinceLastStart = state.lastStart
                ? Date.now() - new Date(state.lastStart).getTime()
                : Infinity;

            if (timeSinceLastStart > RESTART_COOLDOWN && state.restartCount < MAX_RESTART_ATTEMPTS) {
                log(`[Watchdog] ${svc.name} unhealthy, attempting restart (${state.restartCount + 1}/${MAX_RESTART_ATTEMPTS})`, 'WARN');
                await startService(id);
                state.restartCount++;
            } else if (state.restartCount >= MAX_RESTART_ATTEMPTS) {
                if (state.error !== 'Max restart attempts reached') {
                    log(`[Watchdog] ${svc.name} max restart attempts reached`, 'ERROR');
                    state.error = 'Max restart attempts reached';
                    sendRelayAlert('critical', `${svc.name} UNREACHABLE`, `Service ${svc.name} failed ${MAX_RESTART_ATTEMPTS} restart attempts. Manual intervention required.`, svc.name);
                }
            }
        } else if (health.healthy) {
            state.consecutiveHealthy = (state.consecutiveHealthy || 0) + 1;

            // Only reset restart count after 3 consecutive healthy checks (stability)
            if (state.consecutiveHealthy >= 3) {
                if (!wasHealthy && previousHealthState[id] === false) {
                    sendRelayAlert('info', `${svc.name} recovered`, `Service ${svc.name} (port ${svc.port}) is back online.`, svc.name);
                }
                previousHealthState[id] = true;
                state.restartCount = 0;
                state.error = null;
            }
        }
    }
}

function startWatchdog() {
    if (watchdogInterval) clearInterval(watchdogInterval);
    watchdogInterval = setInterval(watchdogCheck, HEALTH_CHECK_INTERVAL);
    log('[Watchdog] Started');
}

function stopWatchdog() {
    if (watchdogInterval) {
        clearInterval(watchdogInterval);
        watchdogInterval = null;
    }
    log('[Watchdog] Stopped');
}


// ============================================
// SERVICE CONTROL
// ============================================

// Check if a Windows Service exists
async function checkWinServiceExists(serviceName) {
    if (!serviceName) return false;
    return new Promise((resolve) => {
        exec(`sc query "${serviceName}"`, (error, stdout) => {
            resolve(!error && stdout.includes('STATE'));
        });
    });
}

// Start via Windows Service
async function startViaWinService(serviceName) {
    return new Promise((resolve) => {
        exec(`net start "${serviceName}"`, (error, stdout, stderr) => {
            if (error) {
                // Check if already running
                if (stderr && stderr.includes('already been started')) {
                    resolve({ success: true, method: 'winservice', message: 'Already running' });
                } else {
                    resolve({ success: false, method: 'winservice', error: stderr || error.message });
                }
            } else {
                resolve({ success: true, method: 'winservice', message: 'Started via Windows Service' });
            }
        });
    });
}

// Start via spawn (fallback)
async function startViaSpawn(svc, state) {
    return new Promise((resolve) => {
        const parts = svc.start.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
        const child = spawn(cmd, args, {
            cwd: svc.dir,
            detached: true,
            stdio: 'ignore',
            shell: true,
            windowsHide: false
        });
        
        child.unref();
        
        state.lastStart = new Date().toISOString();
        resolve({ success: true, method: 'spawn', message: 'Started via spawn', pid: child.pid });
    });
}

async function startService(serviceId) {
    const svc = SERVICES[serviceId];
    if (!svc) return { success: false, error: 'Unknown service' };

    const state = serviceStates[serviceId];

    // Reset restart counter on manual start
    state.restartCount = 0;
    state.error = null;

    // Check if already running
    if (svc.port) {
        const portInUse = await checkPortInUse(svc.port);
        if (portInUse) {
            return { success: true, message: 'Already running' };
        }
    } else {
        // Native service - check via SC query
        const health = await checkServiceHealth(serviceId);
        if (health.healthy) {
            return { success: true, message: 'Already running' };
        }
    }

    log(`[Service] Starting ${svc.name}...`);

    // Try Windows Service first if configured
    if (svc.winService) {
        const winSvcExists = await checkWinServiceExists(svc.winService);
        if (winSvcExists) {
            log(`[Service] Starting Windows Service: ${svc.winService}`);
            const result = await startViaWinService(svc.winService);
            if (result.success) {
                state.lastStart = new Date().toISOString();
                state.startMethod = 'winservice';
                log(`[Service] ${svc.name} ${result.message}`);
                return result;
            }
            log(`[Service] Windows Service start failed: ${result.error}, trying spawn...`, 'WARN');
        } else {
            log(`[Service] Windows Service ${svc.winService} not installed, using spawn`, 'WARN');
        }
    }

    // Fallback to spawn for services without Windows Services or when winservice fails
    if (svc.start && svc.dir) {
        log(`[Service] Starting via spawn: ${svc.start}`);
        const result = await startViaSpawn(svc, state);
        if (result.success) {
            state.startMethod = 'spawn';
            log(`[Service] ${svc.name} started via spawn (PID: ${result.pid})`);
        } else {
            log(`[Service] Failed to start ${svc.name}: ${result.error}`, 'ERROR');
            state.error = result.error;
        }
        return result;
    }

    log(`[Service] ${svc.name} has no start configuration`, 'ERROR');
    return { success: false, error: 'No start configuration' };
}

async function stopService(serviceId, graceful = true) {
    const svc = SERVICES[serviceId];
    if (!svc) return { success: false, error: 'Unknown service' };

    const state = serviceStates[serviceId];
    log(`[Service] Stopping ${svc.name}...`);

    // All services are Windows Services now
    if (svc.winService) {
        log(`[Service] Stopping Windows Service: ${svc.winService}`);
        const result = await new Promise((resolve) => {
            exec(`net stop "${svc.winService}"`, (error, stdout, stderr) => {
                if (error && !stderr.includes('is not started')) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true, method: 'winservice' });
                }
            });
        });
        if (result.success) {
            state.running = false;
            log(`[Service] ${svc.name} stopped via Windows Service`);
            return result;
        }
        log(`[Service] Windows Service stop failed: ${result.error}`, 'WARN');
    }

    // Fallback: Force kill by port (in case service is stuck)
    // Skip for native services without ports
    if (!svc.port) {
        log(`[Service] ${svc.name} is a native service, no port to force kill`, 'WARN');
        return { success: false, error: 'Could not stop native service' };
    }

    log(`[Service] Force stopping ${svc.name} by port...`);
    return new Promise((resolve) => {
        exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${svc.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
            (error) => {
                if (error) {
                    log(`[Service] Force stop failed for ${svc.name}: ${error.message}`, 'ERROR');
                    resolve({ success: false, error: error.message });
                } else {
                    serviceStates[serviceId].running = false;
                    log(`[Service] ${svc.name} force stopped`);
                    resolve({ success: true, method: 'force' });
                }
            });
    });
}

async function restartService(serviceId) {
    const stopResult = await stopService(serviceId, true);
    await new Promise(r => setTimeout(r, 1500));
    const startResult = await startService(serviceId);
    return { stop: stopResult, start: startResult };
}

async function startAllServices() {
    const results = {};
    // Sort by priority
    const sorted = Object.keys(SERVICES).sort((a, b) => SERVICES[a].priority - SERVICES[b].priority);
    
    for (const id of sorted) {
        results[id] = await startService(id);
        await new Promise(r => setTimeout(r, 2000)); // Stagger starts
    }
    return results;
}

async function stopAllServices() {
    const results = {};
    // Stop in reverse priority order
    const sorted = Object.keys(SERVICES).sort((a, b) => SERVICES[b].priority - SERVICES[a].priority);
    
    for (const id of sorted) {
        results[id] = await stopService(id, true);
    }
    return results;
}


// ============================================
// REST API
// ============================================

app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Health (no auth)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'master', version: '1.0.0' });
});

// Status (no auth)
app.get('/api/status', async (req, res) => {
    const status = {};
    for (const [id, svc] of Object.entries(SERVICES)) {
        const health = await checkServiceHealth(id);
        const portInUse = await checkPortInUse(svc.port);
        const state = serviceStates[id];
        status[id] = {
            name: svc.name,
            port: svc.port,
            running: portInUse,
            healthy: health.healthy,
            startMethod: state.startMethod || 'unknown',
            restartCount: state.restartCount,
            error: state.error
        };
    }
    res.json({ 
        master: { status: 'running', watchdog: watchdogEnabled },
        services: status 
    });
});

// Log endpoint (no auth)
app.get('/api/log', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    res.json({ 
        log: logBuffer.slice(-lines).join('\n'),
        lines: Math.min(lines, logBuffer.length),
        total: logBuffer.length
    });
});

// Service registry
app.get('/api/services', (req, res) => {
    res.json(SERVICES);
});

// Single service status
app.get('/api/services/:id', async (req, res) => {
    const svc = SERVICES[req.params.id];
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    
    const health = await checkServiceHealth(req.params.id);
    const portInUse = await checkPortInUse(svc.port);
    const state = serviceStates[req.params.id];
    
    // Check if Windows Service exists
    const winServiceExists = svc.winService ? await checkWinServiceExists(svc.winService) : false;
    
    res.json({
        ...svc,
        running: portInUse,
        healthy: health.healthy,
        startMethod: state.startMethod || 'unknown',
        winServiceAvailable: winServiceExists,
        state
    });
});

// Start service
app.post('/api/services/:id/start', async (req, res) => {
    const result = await startService(req.params.id);
    res.json(result);
});

// Stop service
app.post('/api/services/:id/stop', async (req, res) => {
    const graceful = req.body.graceful !== false;
    const result = await stopService(req.params.id, graceful);
    res.json(result);
});

// Restart service
app.post('/api/services/:id/restart', async (req, res) => {
    const result = await restartService(req.params.id);
    res.json(result);
});

// Reset service restart counter
app.post('/api/services/:id/reset', (req, res) => {
    const serviceId = req.params.id;
    const state = serviceStates[serviceId];
    if (!state) {
        return res.status(404).json({ error: 'Unknown service' });
    }
    state.restartCount = 0;
    state.error = null;
    log(`[Service] ${serviceId} restart counter reset`);
    res.json({ success: true, message: `${serviceId} restart counter reset` });
});

// Reset all service counters
app.post('/api/reset-all', (req, res) => {
    for (const [id, state] of Object.entries(serviceStates)) {
        state.restartCount = 0;
        state.error = null;
    }
    log('[Service] All restart counters reset');
    res.json({ success: true, message: 'All restart counters reset' });
});

// Start all
app.post('/api/start-all', async (req, res) => {
    // Reset all counters before starting
    for (const [id, state] of Object.entries(serviceStates)) {
        state.restartCount = 0;
        state.error = null;
    }
    const results = await startAllServices();
    res.json(results);
});

// Stop all
app.post('/api/stop-all', async (req, res) => {
    const results = await stopAllServices();
    res.json(results);
});

// Watchdog control
app.get('/api/watchdog', (req, res) => {
    res.json({ 
        enabled: watchdogEnabled,
        interval: HEALTH_CHECK_INTERVAL,
        maxRestarts: MAX_RESTART_ATTEMPTS,
        cooldown: RESTART_COOLDOWN
    });
});

app.post('/api/watchdog/enable', (req, res) => {
    watchdogEnabled = true;
    startWatchdog();
    res.json({ enabled: true });
});

app.post('/api/watchdog/disable', (req, res) => {
    watchdogEnabled = false;
    stopWatchdog();
    res.json({ enabled: false });
});

// Check if running as Windows Service
const isWindowsService = !process.env.TERM && !process.stdout.isTTY;

// Shutdown Master (protected)
app.post('/api/shutdown', (req, res) => {
    const { confirm } = req.body || {};
    
    // Require explicit confirmation
    if (confirm !== 'SHUTDOWN-MASTER') {
        return res.status(400).json({ 
            error: 'Confirmation required',
            hint: 'Send POST with body: { "confirm": "SHUTDOWN-MASTER" }',
            warning: 'Master (O) is the service supervisor. Shutting it down stops the watchdog.'
        });
    }
    
    log('[Master] Shutdown confirmed via API');
    res.json({ status: 'shutting_down' });
    
    stopWatchdog();
    setTimeout(() => {
        server.close(() => {
            log('[Master] Graceful shutdown complete');
            process.exit(0);
        });
    }, 500);
});

// Service mode info endpoint
app.get('/api/mode', (req, res) => {
    res.json({
        mode: isWindowsService ? 'service' : 'development',
        protected: true,
        shutdownRequiresConfirm: true
    });
});


// ============================================
// WEB DASHBOARD
// ============================================

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimWidget Master (O)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
        h1 { color: #58a6ff; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; }
        .card h3 { color: #8b949e; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
        .service { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #30363d; }
        .service:last-child { border-bottom: none; }
        .status { width: 12px; height: 12px; border-radius: 50%; margin-right: 10px; }
        .status.running { background: #3fb950; }
        .status.stopped { background: #f85149; }
        .status.unknown { background: #8b949e; }
        .name { flex: 1; }
        .port { color: #8b949e; font-size: 12px; margin-left: 10px; }
        .actions { display: flex; gap: 5px; }
        .btn { padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .btn-start { background: #238636; color: white; }
        .btn-stop { background: #da3633; color: white; }
        .btn-restart { background: #1f6feb; color: white; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .toolbar { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
        .watchdog { display: flex; align-items: center; gap: 10px; }
        .watchdog-status { padding: 5px 10px; border-radius: 4px; font-size: 12px; }
        .watchdog-status.enabled { background: #238636; }
        .watchdog-status.disabled { background: #da3633; }
        .log { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>🎛️ SimWidget Master (O)</h1>
    
    <div class="toolbar">
        <button class="btn btn-start" onclick="startAll()">Start All</button>
        <button class="btn btn-stop" onclick="stopAll()">Stop All</button>
        <button class="btn btn-restart" onclick="location.reload()">Refresh</button>
        <div class="watchdog">
            <span>Watchdog:</span>
            <span id="watchdog-status" class="watchdog-status">Loading...</span>
            <button class="btn" id="watchdog-toggle" onclick="toggleWatchdog()">Toggle</button>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h3>Services</h3>
            <div id="services">Loading...</div>
        </div>
        <div class="card">
            <h3>Recent Logs</h3>
            <div id="logs" class="log">Loading...</div>
        </div>
    </div>
    
    <script>
        async function loadStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                // Update watchdog
                const wd = document.getElementById('watchdog-status');
                wd.textContent = data.master.watchdog ? 'Enabled' : 'Disabled';
                wd.className = 'watchdog-status ' + (data.master.watchdog ? 'enabled' : 'disabled');
                
                // Update services
                let html = '';
                for (const [id, svc] of Object.entries(data.services)) {
                    const status = svc.running ? 'running' : 'stopped';
                    html += '<div class="service">';
                    html += '<div class="status ' + status + '"></div>';
                    html += '<span class="name">' + svc.name + '</span>';
                    html += '<span class="port">:' + svc.port + '</span>';
                    html += '<div class="actions">';
                    html += '<button class="btn btn-start" onclick="control(\\'' + id + '\\', \\'start\\')" ' + (svc.running ? 'disabled' : '') + '>Start</button>';
                    html += '<button class="btn btn-stop" onclick="control(\\'' + id + '\\', \\'stop\\')" ' + (!svc.running ? 'disabled' : '') + '>Stop</button>';
                    html += '<button class="btn btn-restart" onclick="control(\\'' + id + '\\', \\'restart\\')">Restart</button>';
                    html += '</div></div>';
                }
                document.getElementById('services').innerHTML = html;
            } catch (e) {
                document.getElementById('services').innerHTML = 'Error: ' + e.message;
            }
        }
        
        async function loadLogs() {
            try {
                const res = await fetch('/api/log?lines=20');
                const data = await res.json();
                document.getElementById('logs').textContent = data.log || 'No logs';
            } catch (e) {
                document.getElementById('logs').textContent = 'Error: ' + e.message;
            }
        }
        
        async function control(id, action) {
            await fetch('/api/services/' + id + '/' + action, { method: 'POST' });
            setTimeout(loadStatus, 1000);
        }
        
        async function startAll() {
            await fetch('/api/start-all', { method: 'POST' });
            setTimeout(loadStatus, 3000);
        }
        
        async function stopAll() {
            await fetch('/api/stop-all', { method: 'POST' });
            setTimeout(loadStatus, 2000);
        }
        
        async function toggleWatchdog() {
            const wd = document.getElementById('watchdog-status');
            const action = wd.classList.contains('enabled') ? 'disable' : 'enable';
            await fetch('/api/watchdog/' + action, { method: 'POST' });
            loadStatus();
        }
        
        loadStatus();
        loadLogs();
        setInterval(loadStatus, 5000);
        setInterval(loadLogs, 10000);
    </script>
</body>
</html>
    `);
});


// ============================================
// SERVER STARTUP
// ============================================

// Crash protection (Standard Pattern)
process.on('uncaughtException', (err) => {
    log(`Uncaught Exception: ${err.message}`, 'ERROR');
});

process.on('unhandledRejection', (reason) => {
    log(`Unhandled Rejection: ${reason}`, 'ERROR');
});

// Graceful shutdown
process.on('SIGINT', () => {
    log('SIGINT received, shutting down...');
    stopWatchdog();
    server.close(() => {
        log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down...');
    stopWatchdog();
    server.close(() => process.exit(0));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║          SimWidget Master (O) v1.0.0              ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  Dashboard:  http://localhost:${PORT}                 ║`);
    console.log(`║  Network:    http://192.168.1.192:${PORT}              ║`);
    console.log('║                                                   ║');
    console.log('║  Managed Services:                                ║');
    for (const [id, svc] of Object.entries(SERVICES)) {
        const name = (svc.name + '                    ').substring(0, 20);
        console.log(`║    ${name} :${svc.port}                   ║`);
    }
    console.log('║                                                   ║');
    console.log('║  Watchdog: ENABLED (30s health checks)            ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
    
    log('Master (O) started');
    
    // Start watchdog
    startWatchdog();
    
    // Initial status check
    setTimeout(watchdogCheck, 2000);
});
