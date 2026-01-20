// Hive Brain - Central Admin Control Center
// Manages device discovery, installation, and colony health

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const dgram = require('dgram');

const PORT = process.env.PORT || 8800;
const HIVE_NODE = process.env.HIVE_NODE || os.hostname();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============== STATE ==============
const colony = {
    devices: new Map(),      // Known devices
    pending: [],             // Devices awaiting approval
    scanning: false,         // Network scan in progress
    lastScan: null
};

// Hive services to monitor
const SERVICES = {
    oracle: { port: 3002, name: 'Oracle' },
    relay: { port: 8600, name: 'Relay' },
    kittbox: { port: 8585, name: 'KittBox' },
    hivemind: { port: 8701, name: 'Hive-Mind' }
};

// ============== NETWORK SCANNER ==============
async function pingHost(ip, timeout = 1000) {
    return new Promise(resolve => {
        const start = Date.now();
        const socket = require('net').createConnection({ host: ip, port: 80, timeout });
        socket.on('connect', () => { socket.destroy(); resolve({ ip, alive: true, ms: Date.now() - start }); });
        socket.on('timeout', () => { socket.destroy(); resolve({ ip, alive: false }); });
        socket.on('error', () => { socket.destroy(); resolve({ ip, alive: false }); });
    });
}

async function scanNetwork(subnet = '192.168.1', startIp = 1, endIp = 254) {
    colony.scanning = true;
    broadcastWs({ type: 'scan_start', subnet });

    const results = [];
    const batchSize = 20;

    for (let i = startIp; i <= endIp; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, endIp + 1); j++) {
            batch.push(pingHost(`${subnet}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(r => r.alive));
        broadcastWs({ type: 'scan_progress', scanned: Math.min(i + batchSize, endIp), total: endIp - startIp + 1 });
    }

    // Fingerprint alive hosts
    for (const host of results) {
        const device = await fingerprintDevice(host.ip);
        if (device && !colony.devices.has(host.ip)) {
            colony.pending.push(device);
            broadcastWs({ type: 'device_found', device });
        }
    }

    colony.scanning = false;
    colony.lastScan = new Date().toISOString();
    broadcastWs({ type: 'scan_complete', found: results.length, pending: colony.pending.length });

    return results;
}

async function fingerprintDevice(ip) {
    const device = {
        ip,
        hostname: 'unknown',
        os: 'unknown',
        services: [],
        hiveReady: false,
        discoveredAt: new Date().toISOString()
    };

    // Check common ports to identify device type
    const ports = [22, 80, 443, 8585, 8600, 3002, 8701, 9090];
    for (const port of ports) {
        try {
            const result = await pingHost(ip.replace(':80', `:${port}`), 500);
            if (result.alive) device.services.push(port);
        } catch {}
    }

    // Check if it's already running Hive services
    if (device.services.includes(8585) || device.services.includes(8600)) {
        device.hiveReady = true;
    }

    // Try to get hostname via reverse DNS or mDNS
    try {
        const dns = require('dns').promises;
        const hostnames = await dns.reverse(ip).catch(() => []);
        if (hostnames.length) device.hostname = hostnames[0];
    } catch {}

    // Classify device type
    if (device.services.includes(22)) device.os = 'linux';
    if (device.services.includes(9090)) device.type = 'server-cockpit';
    if (device.services.includes(5000)) device.type = 'nas-synology';
    if (device.services.includes(8080)) device.type = 'android-termux';

    return device;
}

// ============== INFECTION (INSTALL) ==============
async function infectDevice(ip, method = 'ssh') {
    const device = colony.pending.find(d => d.ip === ip) || colony.devices.get(ip);
    if (!device) return { error: 'Device not found' };

    broadcastWs({ type: 'infect_start', ip, method });

    if (method === 'ssh') {
        // Generate SSH install command
        const installCmd = `curl -fsSL https://raw.githubusercontent.com/cobrahjh/hive-universal-install/master/quick-install.sh | bash`;

        return new Promise((resolve) => {
            exec(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 hive@${ip} "${installCmd}"`,
                { timeout: 300000 }, // 5 min timeout
                (error, stdout, stderr) => {
                    if (error) {
                        broadcastWs({ type: 'infect_failed', ip, error: error.message });
                        resolve({ error: error.message });
                    } else {
                        device.infected = true;
                        device.infectedAt = new Date().toISOString();
                        colony.devices.set(ip, device);
                        colony.pending = colony.pending.filter(d => d.ip !== ip);
                        broadcastWs({ type: 'infect_success', ip, device });
                        resolve({ success: true, device });
                    }
                }
            );
        });
    } else if (method === 'link') {
        // Return install link for manual installation
        const installUrl = `https://github.com/cobrahjh/hive-universal-install`;
        return {
            method: 'link',
            url: installUrl,
            command: `git clone ${installUrl} && cd hive-universal-install && npm start`
        };
    }
}

// ============== COLONY MANAGEMENT ==============
async function checkDeviceHealth(ip) {
    const device = colony.devices.get(ip);
    if (!device) return null;

    const health = { ip, services: {} };

    for (const [name, svc] of Object.entries(SERVICES)) {
        try {
            const res = await fetch(`http://${ip}:${svc.port}/api/health`, { timeout: 3000 });
            health.services[name] = res.ok ? 'online' : 'error';
        } catch {
            health.services[name] = 'offline';
        }
    }

    device.lastHealthCheck = new Date().toISOString();
    device.health = health;
    colony.devices.set(ip, device);

    return health;
}

async function checkAllDevicesHealth() {
    const results = {};
    for (const [ip, device] of colony.devices) {
        results[ip] = await checkDeviceHealth(ip);
    }
    return results;
}

// ============== API ROUTES ==============

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        service: 'hive-brain',
        node: HIVE_NODE,
        status: 'ok',
        colony: {
            devices: colony.devices.size,
            pending: colony.pending.length,
            scanning: colony.scanning,
            lastScan: colony.lastScan
        },
        timestamp: new Date().toISOString()
    });
});

// Get colony status
app.get('/api/colony', (req, res) => {
    res.json({
        devices: Array.from(colony.devices.values()),
        pending: colony.pending,
        scanning: colony.scanning,
        lastScan: colony.lastScan
    });
});

// Start network scan
app.post('/api/scan', async (req, res) => {
    const { subnet = '192.168.1', start = 1, end = 254 } = req.body;

    if (colony.scanning) {
        return res.status(400).json({ error: 'Scan already in progress' });
    }

    // Run scan in background
    scanNetwork(subnet, start, end);
    res.json({ started: true, subnet });
});

// Get pending devices
app.get('/api/pending', (req, res) => {
    res.json(colony.pending);
});

// Approve device
app.post('/api/approve/:ip', (req, res) => {
    const { ip } = req.params;
    const device = colony.pending.find(d => d.ip === ip);

    if (!device) {
        return res.status(404).json({ error: 'Device not in pending list' });
    }

    colony.devices.set(ip, device);
    colony.pending = colony.pending.filter(d => d.ip !== ip);
    broadcastWs({ type: 'device_approved', device });

    res.json({ approved: true, device });
});

// Reject device
app.delete('/api/pending/:ip', (req, res) => {
    const { ip } = req.params;
    colony.pending = colony.pending.filter(d => d.ip !== ip);
    res.json({ rejected: true, ip });
});

// Infect (install) device
app.post('/api/infect/:ip', async (req, res) => {
    const { ip } = req.params;
    const { method = 'ssh' } = req.body;

    const result = await infectDevice(ip, method);
    res.json(result);
});

// Get device health
app.get('/api/device/:ip/health', async (req, res) => {
    const health = await checkDeviceHealth(req.params.ip);
    if (!health) {
        return res.status(404).json({ error: 'Device not found' });
    }
    res.json(health);
});

// Check all devices health
app.get('/api/health/all', async (req, res) => {
    const results = await checkAllDevicesHealth();
    res.json(results);
});

// Remove device from colony
app.delete('/api/device/:ip', (req, res) => {
    const { ip } = req.params;
    colony.devices.delete(ip);
    res.json({ removed: true, ip });
});

// Add device manually
app.post('/api/device', (req, res) => {
    const { ip, hostname, os, type } = req.body;
    if (!ip) {
        return res.status(400).json({ error: 'IP required' });
    }

    const device = {
        ip,
        hostname: hostname || 'manual',
        os: os || 'unknown',
        type: type || 'unknown',
        services: [],
        hiveReady: false,
        addedAt: new Date().toISOString(),
        manual: true
    };

    colony.devices.set(ip, device);
    broadcastWs({ type: 'device_added', device });
    res.json(device);
});

// Get install link/command
app.get('/api/install-link', (req, res) => {
    res.json({
        github: 'https://github.com/cobrahjh/hive-universal-install',
        oneLiner: 'curl -fsSL https://raw.githubusercontent.com/cobrahjh/hive-universal-install/master/quick-install.sh | bash',
        docker: 'git clone https://github.com/cobrahjh/hive-universal-install && cd hive-universal-install && docker compose up -d',
        npm: 'npx degit cobrahjh/hive-universal-install hive && cd hive && npm start'
    });
});

// ============== WEBSOCKET ==============
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Hive-Brain] Client connected (${clients.size} total)`);

    // Send current state
    ws.send(JSON.stringify({
        type: 'init',
        colony: {
            devices: Array.from(colony.devices.values()),
            pending: colony.pending,
            scanning: colony.scanning
        }
    }));

    ws.on('close', () => {
        clients.delete(ws);
    });

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'scan') {
                scanNetwork(msg.subnet, msg.start, msg.end);
            } else if (msg.type === 'infect') {
                await infectDevice(msg.ip, msg.method);
            }
        } catch {}
    });
});

function broadcastWs(data) {
    const json = JSON.stringify(data);
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(json);
        }
    });
}

// ============== START ==============
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║         HIVE BRAIN                   ║');
    console.log('║   http://localhost:' + PORT + '              ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    // Add localhost as first device
    colony.devices.set('127.0.0.1', {
        ip: '127.0.0.1',
        hostname: HIVE_NODE,
        os: os.platform(),
        type: 'master',
        services: [3002, 8585, 8600, 8701],
        hiveReady: true,
        addedAt: new Date().toISOString()
    });
});
