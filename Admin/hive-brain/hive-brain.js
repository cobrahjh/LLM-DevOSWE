/**
 * Hive Brain - Device Discovery & Colony Management
 * Port: 8810
 *
 * Features:
 * - Network scanning (ping sweep, port scan)
 * - Device fingerprinting (OS, services)
 * - Enrollment queue with approval workflow
 * - Colony health monitoring
 */

const express = require('express');
const cors = require('cors');
const net = require('net');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 8810;
const DATA_DIR = path.join(__dirname, 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ENROLLMENT_FILE = path.join(DATA_DIR, 'enrollment-queue.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Known Hive service ports to scan
const HIVE_PORTS = [
    { port: 3002, service: 'Oracle (LLM)' },
    { port: 8080, service: 'SimWidget Main' },
    { port: 8500, service: 'Master-O' },
    { port: 8585, service: 'KittBox' },
    { port: 8600, service: 'Relay' },
    { port: 8700, service: 'Hivemind' },
    { port: 8701, service: 'Hive-Mind' },
    { port: 8750, service: 'Mesh' },
    { port: 8800, service: 'HiveImmortal Oracle' },
    { port: 8810, service: 'Hive Brain' },
    { port: 11434, service: 'Ollama' },
    { port: 1234, service: 'LM Studio' },
    { port: 22, service: 'SSH' },
];

// Network ranges to scan
const NETWORK_RANGES = [
    '192.168.1',  // Primary home network
];

// ============================================
// DATA PERSISTENCE
// ============================================

function loadJSON(file, defaultValue = {}) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading ${file}:`, e.message);
    }
    return defaultValue;
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ============================================
// NETWORK SCANNING
// ============================================

async function pingHost(ip, timeout = 1000) {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows
            ? `ping -n 1 -w ${timeout} ${ip}`
            : `ping -c 1 -W ${Math.ceil(timeout/1000)} ${ip}`;

        exec(cmd, (error, stdout) => {
            if (error) {
                resolve({ ip, alive: false });
            } else {
                const alive = isWindows
                    ? !stdout.includes('unreachable') && !stdout.includes('timed out')
                    : stdout.includes('1 received') || stdout.includes('1 packets received');
                resolve({ ip, alive });
            }
        });
    });
}

async function checkPort(ip, port, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve({ ip, port, open: true });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ ip, port, open: false });
        });

        socket.on('error', () => {
            socket.destroy();
            resolve({ ip, port, open: false });
        });

        socket.connect(port, ip);
    });
}

async function scanNetwork(range = '192.168.1', startIP = 1, endIP = 254) {
    console.log(`[Scan] Scanning ${range}.${startIP}-${endIP}...`);
    const results = [];
    const batchSize = 20; // Scan in batches to avoid overwhelming

    for (let i = startIP; i <= endIP; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, endIP + 1); j++) {
            batch.push(pingHost(`${range}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(r => r.alive));
    }

    console.log(`[Scan] Found ${results.length} alive hosts`);
    return results;
}

async function scanDevicePorts(ip) {
    console.log(`[Scan] Scanning ports on ${ip}...`);
    const openPorts = [];

    const portChecks = HIVE_PORTS.map(({ port, service }) =>
        checkPort(ip, port).then(result => ({ ...result, service }))
    );

    const results = await Promise.all(portChecks);

    for (const result of results) {
        if (result.open) {
            openPorts.push({ port: result.port, service: result.service });
        }
    }

    return openPorts;
}

async function fingerprintDevice(ip, openPorts) {
    const fingerprint = {
        ip,
        hostname: null,
        os: 'unknown',
        services: openPorts,
        isHiveNode: false,
        lastSeen: Date.now(),
        firstSeen: Date.now()
    };

    // Try to get hostname
    try {
        const result = await new Promise((resolve) => {
            exec(`nslookup ${ip}`, (error, stdout) => {
                if (!error && stdout) {
                    const match = stdout.match(/name\s*=\s*(\S+)/i);
                    if (match) resolve(match[1]);
                }
                resolve(null);
            });
        });
        fingerprint.hostname = result;
    } catch (e) {}

    // Determine if it's a Hive node
    const hiveServices = openPorts.filter(p =>
        [3002, 8500, 8585, 8600, 8700, 8701, 8750, 8800, 8810].includes(p.port)
    );
    fingerprint.isHiveNode = hiveServices.length > 0;

    // Guess OS based on services
    if (openPorts.some(p => p.port === 22)) {
        fingerprint.os = 'linux/unix';
    }
    if (openPorts.some(p => p.port === 3389)) {
        fingerprint.os = 'windows';
    }

    return fingerprint;
}

// ============================================
// DISCOVERY MANAGEMENT
// ============================================

let devices = loadJSON(DEVICES_FILE, { known: {}, discovered: {} });
let enrollmentQueue = loadJSON(ENROLLMENT_FILE, []);
let isScanning = false;
let lastScanTime = null;

async function runDiscovery() {
    if (isScanning) {
        console.log('[Discovery] Scan already in progress');
        return { status: 'already_running' };
    }

    isScanning = true;
    console.log('[Discovery] Starting network discovery...');

    try {
        const newDevices = [];

        for (const range of NETWORK_RANGES) {
            const aliveHosts = await scanNetwork(range);

            for (const host of aliveHosts) {
                const openPorts = await scanDevicePorts(host.ip);

                if (openPorts.length > 0) {
                    const fingerprint = await fingerprintDevice(host.ip, openPorts);

                    // Check if this is a new device
                    const deviceKey = host.ip;
                    if (!devices.known[deviceKey] && !devices.discovered[deviceKey]) {
                        devices.discovered[deviceKey] = fingerprint;
                        newDevices.push(fingerprint);

                        // Add to enrollment queue if it's a potential Hive node
                        if (fingerprint.isHiveNode) {
                            enrollmentQueue.push({
                                id: `enroll-${Date.now()}-${host.ip.replace(/\./g, '')}`,
                                device: fingerprint,
                                status: 'pending',
                                createdAt: Date.now()
                            });
                        }
                    } else if (devices.known[deviceKey]) {
                        // Update last seen
                        devices.known[deviceKey].lastSeen = Date.now();
                        devices.known[deviceKey].services = openPorts;
                    } else {
                        devices.discovered[deviceKey].lastSeen = Date.now();
                        devices.discovered[deviceKey].services = openPorts;
                    }
                }
            }
        }

        // Save state
        saveJSON(DEVICES_FILE, devices);
        saveJSON(ENROLLMENT_FILE, enrollmentQueue);

        lastScanTime = Date.now();
        console.log(`[Discovery] Complete. Found ${newDevices.length} new devices`);

        return {
            status: 'complete',
            newDevices: newDevices.length,
            totalKnown: Object.keys(devices.known).length,
            totalDiscovered: Object.keys(devices.discovered).length
        };
    } finally {
        isScanning = false;
    }
}

// ============================================
// REST API
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Hive Brain',
        version: '1.0.0',
        isScanning,
        lastScan: lastScanTime,
        devices: {
            known: Object.keys(devices.known).length,
            discovered: Object.keys(devices.discovered).length
        },
        enrollmentPending: enrollmentQueue.filter(e => e.status === 'pending').length
    });
});

// Trigger discovery scan
app.post('/api/discover', async (req, res) => {
    const result = await runDiscovery();
    res.json(result);
});

// Get all devices
app.get('/api/devices', (req, res) => {
    res.json({
        known: Object.values(devices.known),
        discovered: Object.values(devices.discovered)
    });
});

// Get specific device
app.get('/api/devices/:ip', (req, res) => {
    const ip = req.params.ip;
    const device = devices.known[ip] || devices.discovered[ip];
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
});

// Approve device (move from discovered to known)
app.post('/api/devices/:ip/approve', (req, res) => {
    const ip = req.params.ip;
    const device = devices.discovered[ip];

    if (!device) {
        return res.status(404).json({ error: 'Device not found in discovered' });
    }

    // Move to known
    devices.known[ip] = { ...device, approvedAt: Date.now() };
    delete devices.discovered[ip];

    // Remove from enrollment queue
    enrollmentQueue = enrollmentQueue.filter(e => e.device.ip !== ip);

    saveJSON(DEVICES_FILE, devices);
    saveJSON(ENROLLMENT_FILE, enrollmentQueue);

    res.json({ success: true, device: devices.known[ip] });
});

// Update device notes
app.patch('/api/devices/:ip/notes', (req, res) => {
    const ip = req.params.ip;
    const { notes } = req.body;

    if (devices.known[ip]) {
        devices.known[ip].notes = notes || '';
        devices.known[ip].notesUpdatedAt = Date.now();
        saveJSON(DEVICES_FILE, devices);
        return res.json({ success: true, device: devices.known[ip] });
    }

    if (devices.discovered[ip]) {
        devices.discovered[ip].notes = notes || '';
        devices.discovered[ip].notesUpdatedAt = Date.now();
        saveJSON(DEVICES_FILE, devices);
        return res.json({ success: true, device: devices.discovered[ip] });
    }

    res.status(404).json({ error: 'Device not found' });
});

// Reject/remove device
app.delete('/api/devices/:ip', (req, res) => {
    const ip = req.params.ip;

    if (devices.discovered[ip]) {
        delete devices.discovered[ip];
    }
    if (devices.known[ip]) {
        delete devices.known[ip];
    }

    // Remove from enrollment queue
    enrollmentQueue = enrollmentQueue.filter(e => e.device.ip !== ip);

    saveJSON(DEVICES_FILE, devices);
    saveJSON(ENROLLMENT_FILE, enrollmentQueue);

    res.json({ success: true });
});

// Get enrollment queue
app.get('/api/enrollment', (req, res) => {
    res.json(enrollmentQueue);
});

// Scan specific IP
app.post('/api/scan/:ip', async (req, res) => {
    const ip = req.params.ip;

    const pingResult = await pingHost(ip);
    if (!pingResult.alive) {
        return res.json({ ip, alive: false, services: [] });
    }

    const openPorts = await scanDevicePorts(ip);
    const fingerprint = await fingerprintDevice(ip, openPorts);

    res.json(fingerprint);
});

// Get colony status (all Hive nodes)
app.get('/api/colony', (req, res) => {
    const hiveNodes = [
        ...Object.values(devices.known).filter(d => d.isHiveNode),
        ...Object.values(devices.discovered).filter(d => d.isHiveNode)
    ];

    res.json({
        nodes: hiveNodes,
        count: hiveNodes.length
    });
});

// ============================================
// BACKGROUND SCANNING
// ============================================

const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes

function startBackgroundScanning() {
    console.log('[Brain] Starting background scanning...');

    // Initial scan after 30 seconds
    setTimeout(() => {
        runDiscovery().catch(console.error);
    }, 30000);

    // Regular scans
    setInterval(() => {
        runDiscovery().catch(console.error);
    }, SCAN_INTERVAL);
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`[Hive Brain] Device Discovery running on port ${PORT}`);
    console.log(`[Hive Brain] API: http://localhost:${PORT}/api/health`);
    console.log(`[Hive Brain] Scanning networks: ${NETWORK_RANGES.join(', ')}`);

    // Load existing data
    devices = loadJSON(DEVICES_FILE, { known: {}, discovered: {} });
    enrollmentQueue = loadJSON(ENROLLMENT_FILE, []);

    console.log(`[Hive Brain] Loaded ${Object.keys(devices.known).length} known devices`);

    // Start background scanning
    startBackgroundScanning();
});
