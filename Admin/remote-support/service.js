/**
 * SimWidget Remote Support Service v1.1.0
 * 
 * Windows service for remote command execution and system management
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\remote-support\service.js
 * Last Updated: 2026-01-09
 * 
 * v1.1.0 - Added service log buffer, /api/log endpoint, crash protection, graceful shutdown
 * v1.0.0 - Initial release
 * 
 * Endpoints:
 *   POST /api/exec        - Execute command
 *   GET  /api/files       - List directory
 *   GET  /api/files/:path - Read file
 *   POST /api/files       - Write file
 *   GET  /api/services    - List managed services
 *   POST /api/services    - Control service (start/stop/restart)
 *   GET  /api/status      - System health
 *   GET  /api/logs        - View audit logs
 *   GET  /api/log         - View service console log (for monitoring UI)
 *   WS   /ws              - Real-time streaming
 */

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const TroubleshootEngine = require('../shared/troubleshoot-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = process.env.REMOTE_PORT || 8590;
const API_KEY = process.env.REMOTE_API_KEY || 'simwidget-remote-2025';
const PROJECT_ROOT = 'C:\\DevOSWE';
const LOGS_DIR = path.join(__dirname, 'logs');
const AUDIT_LOG = path.join(LOGS_DIR, 'audit.log');

// Ensure logs directory
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// ============================================
// SERVICE LOGGING (Standard Pattern)
// ============================================

const SERVICE_LOG = path.join(LOGS_DIR, 'service.log');
const serviceLogBuffer = [];
const MAX_LOG_LINES = 500;

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    serviceLogBuffer.push(line);
    if (serviceLogBuffer.length > MAX_LOG_LINES) {
        serviceLogBuffer.shift();
    }
    // Also append to file
    fs.appendFileSync(SERVICE_LOG, line + '\n');
}

// Intercept console.log for service logging
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog.apply(console, args);
    logToFile(args.join(' '));
};

console.error = (...args) => {
    originalError.apply(console, args);
    logToFile('[ERROR] ' + args.join(' '));
};

// ============================================
// SECURITY
// ============================================

// Command whitelist (patterns)
const ALLOWED_COMMANDS = [
    /^Get-/i,
    /^Set-Location/i,
    /^dir/i,
    /^ls/i,
    /^cd/i,
    /^type/i,
    /^cat/i,
    /^echo/i,
    /^npm/i,
    /^npx/i,
    /^node/i,
    /^git/i,
    /^Start-Process/i,
    /^Stop-Process/i,
    /^Restart-Service/i,
    /^Start-Service/i,
    /^Stop-Service/i,
    /^Test-/i,
    /^Write-Output/i,
    /^systeminfo/i,
    /^tasklist/i,
    /^netstat/i,
    /^ping/i,
    /^ipconfig/i
];

// Blocked dangerous patterns
const BLOCKED_PATTERNS = [
    /Remove-Item.*-Recurse.*-Force/i,
    /rm\s+-rf/i,
    /format\s+[a-z]:/i,
    /del\s+\/s\s+\/q/i,
    /reg\s+delete/i,
    /net\s+user/i,
    /shutdown/i,
    /restart-computer/i
];

function isCommandAllowed(cmd) {
    // Check blocked first
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(cmd)) return false;
    }
    // Check allowed
    for (const pattern of ALLOWED_COMMANDS) {
        if (pattern.test(cmd)) return true;
    }
    return false;
}

function audit(action, details, ip) {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        ip
    };
    fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

// Auth middleware
function authMiddleware(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.apiKey;
    if (key !== API_KEY) {
        audit('AUTH_FAILED', { path: req.path }, req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Rate limiting (simple in-memory)
const rateLimits = new Map();
function rateLimit(ip, limit = 60) {
    const now = Date.now();
    const windowMs = 60000;
    
    if (!rateLimits.has(ip)) {
        rateLimits.set(ip, { count: 1, start: now });
        return true;
    }
    
    const record = rateLimits.get(ip);
    if (now - record.start > windowMs) {
        record.count = 1;
        record.start = now;
        return true;
    }
    
    record.count++;
    return record.count <= limit;
}

// ============================================
// MANAGED SERVICES
// ============================================

const MANAGED_SERVICES = {
    simwidget: {
        name: 'SimWidget Server',
        dir: path.join(PROJECT_ROOT, 'simwidget-hybrid'),
        start: 'npx nodemon backend/server.js',
        port: 8080
    },
    agent: {
        name: 'Agent Server',
        dir: path.join(PROJECT_ROOT, 'Admin', 'agent'),
        start: 'node agent-server.js',
        port: 8585
    }
};

async function getServiceStatus(serviceId) {
    const service = MANAGED_SERVICES[serviceId];
    if (!service) return null;
    
    return new Promise((resolve) => {
        exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${service.port} -ErrorAction SilentlyContinue | Where-Object {$_.State -eq 'Listen'}"`, 
            (error, stdout) => {
                resolve({
                    id: serviceId,
                    name: service.name,
                    port: service.port,
                    running: stdout.trim().length > 0
                });
            });
    });
}

async function controlService(serviceId, action) {
    const service = MANAGED_SERVICES[serviceId];
    if (!service) return { error: 'Unknown service' };
    
    return new Promise((resolve) => {
        let cmd;
        switch (action) {
            case 'start':
                cmd = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d "${service.dir}" ^&^& ${service.start}' -WindowStyle Minimized`;
                break;
            case 'stop':
                cmd = `Get-NetTCPConnection -LocalPort ${service.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`;
                break;
            case 'restart':
                cmd = `Get-NetTCPConnection -LocalPort ${service.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Start-Sleep -Seconds 2; Start-Process -FilePath 'cmd.exe' -ArgumentList '/c cd /d "${service.dir}" ^&^& ${service.start}' -WindowStyle Minimized`;
                break;
            default:
                return resolve({ error: 'Invalid action' });
        }
        
        exec(`powershell -Command "${cmd}"`, (error, stdout, stderr) => {
            resolve({
                serviceId,
                action,
                success: !error,
                output: stdout || stderr || 'Done'
            });
        });
    });
}

// ============================================
// ROUTES
// ============================================

app.use(express.json());

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use((req, res, next) => {
    if (!rateLimit(req.ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
});

// Health (no auth required)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0' });
});

// Graceful shutdown endpoint (no auth - for server manager)
app.post('/api/shutdown', (req, res) => {
    console.log('[Remote] Shutdown requested via API');
    res.json({ status: 'shutting_down' });
    
    // Close WebSocket connections
    wss.clients.forEach(client => client.close());
    
    // Close server gracefully
    setTimeout(() => {
        server.close(() => {
            console.log('[Remote] Graceful shutdown complete');
            process.exit(0);
        });
    }, 500);
});

// Basic status (no auth required - for service monitoring)
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', service: 'remote-support', port: PORT, version: '1.1.0' });
});

// Service log endpoint (no auth - for monitoring UI)
app.get('/api/log', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const recentLines = serviceLogBuffer.slice(-lines);
    res.json({ 
        log: recentLines.join('\n'),
        lines: recentLines.length,
        total: serviceLogBuffer.length
    });
});

// All other routes require auth
app.use('/api', authMiddleware);

// Execute command
app.post('/api/exec', async (req, res) => {
    const { command, cwd } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }
    
    if (!isCommandAllowed(command)) {
        audit('BLOCKED_COMMAND', { command }, req.ip);
        return res.status(403).json({ error: 'Command not allowed' });
    }
    
    audit('EXEC', { command, cwd }, req.ip);
    
    const workDir = cwd || PROJECT_ROOT;
    exec(`powershell -Command "${command}"`, { cwd: workDir, timeout: 30000 }, (error, stdout, stderr) => {
        res.json({
            success: !error,
            stdout: stdout || '',
            stderr: stderr || '',
            error: error ? error.message : null
        });
    });
});

// List directory
app.get('/api/files', (req, res) => {
    const dirPath = req.query.path || PROJECT_ROOT;
    
    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: 'Path not found' });
    }
    
    try {
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'Not a directory' });
        }
        
        const items = fs.readdirSync(dirPath, { withFileTypes: true }).map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(dirPath, item.name)
        }));
        
        res.json({ path: dirPath, items });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Read file
app.get('/api/files/*', (req, res) => {
    const filePath = req.params[0];
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ path: filePath, content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Write file
app.post('/api/files', (req, res) => {
    const { path: filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
        return res.status(400).json({ error: 'Path and content required' });
    }
    
    audit('WRITE_FILE', { path: filePath }, req.ip);
    
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ success: true, path: filePath });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// List services
app.get('/api/services', async (req, res) => {
    const statuses = await Promise.all(
        Object.keys(MANAGED_SERVICES).map(id => getServiceStatus(id))
    );
    res.json({ services: statuses });
});

// Control service
app.post('/api/services', async (req, res) => {
    const { service, action } = req.body;
    
    if (!service || !action) {
        return res.status(400).json({ error: 'Service and action required' });
    }
    
    audit('SERVICE_CONTROL', { service, action }, req.ip);
    
    const result = await controlService(service, action);
    res.json(result);
});

// System status
app.get('/api/status', async (req, res) => {
    try {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        // Get disk space
        const diskInfo = await new Promise((resolve) => {
            exec('powershell -Command "Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json"', (err, stdout) => {
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve({ Used: 0, Free: 0 });
                }
            });
        });
        
        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            uptime: os.uptime(),
            cpu: {
                model: cpus[0]?.model,
                cores: cpus.length,
                usage: cpus.reduce((acc, cpu) => {
                    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
                    return acc + (1 - cpu.times.idle / total);
                }, 0) / cpus.length * 100
            },
            memory: {
                total: totalMem,
                free: freeMem,
                used: totalMem - freeMem,
                usedPercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1)
            },
            disk: {
                used: diskInfo.Used,
                free: diskInfo.Free,
                total: diskInfo.Used + diskInfo.Free
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// View logs
app.get('/api/logs', (req, res) => {
    const logFile = req.query.file || 'audit';
    const lines = parseInt(req.query.lines) || 100;
    
    const logPath = path.join(LOGS_DIR, `${logFile}.log`);
    
    if (!fs.existsSync(logPath)) {
        return res.json({ logs: [], file: logFile });
    }
    
    try {
        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.trim().split('\n').filter(l => l);
        const recentLines = allLines.slice(-lines);
        
        const logs = recentLines.map(line => {
            try { return JSON.parse(line); } catch { return { raw: line }; }
        });
        
        res.json({ logs, file: logFile, total: allLines.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// WEBSOCKET
// ============================================

wss.on('connection', (ws, req) => {
    // Auth check
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = url.searchParams.get('apiKey');
    
    if (key !== API_KEY) {
        ws.close(4001, 'Unauthorized');
        return;
    }
    
    console.log('[Remote] WebSocket client connected');
    audit('WS_CONNECT', {}, req.socket.remoteAddress);
    
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            
            switch (msg.type) {
                case 'exec':
                    if (!isCommandAllowed(msg.command)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Command not allowed' }));
                        return;
                    }
                    
                    audit('WS_EXEC', { command: msg.command }, req.socket.remoteAddress);
                    
                    // Stream output
                    const child = spawn('powershell', ['-Command', msg.command], {
                        cwd: msg.cwd || PROJECT_ROOT
                    });
                    
                    child.stdout.on('data', (data) => {
                        ws.send(JSON.stringify({ type: 'stdout', data: data.toString() }));
                    });
                    
                    child.stderr.on('data', (data) => {
                        ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
                    });
                    
                    child.on('close', (code) => {
                        ws.send(JSON.stringify({ type: 'exit', code }));
                    });
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
            }
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', message: e.message }));
        }
    });
    
    ws.on('close', () => {
        console.log('[Remote] WebSocket client disconnected');
    });
});

// ============================================
// START SERVER
// ============================================

// Crash protection (Standard Pattern)
process.on('uncaughtException', (err) => {
    console.error('[Remote] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Remote] Unhandled Rejection:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('[Remote] Shutting down gracefully...');
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log('[Remote] Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('[Remote] SIGTERM received, shutting down...');
    wss.clients.forEach(client => client.close());
    server.close(() => process.exit(0));
});

const troubleshoot = new TroubleshootEngine('Remote');

troubleshoot.startServer(server, PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║   SimWidget Remote Support v1.1.0         ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}            ║`);
    console.log(`║  Network: http://192.168.1.42:${PORT}         ║`);
    console.log('║                                           ║');
    console.log('║  API Key required for all operations      ║');
    console.log('║  /api/log endpoint for service monitoring ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');
});
