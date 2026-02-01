/**
 * [PROJECT_NAME] - Hive Service
 * Port: [PORT]
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, 'config.json');
const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : { port: 8900, name: 'hive-service-template' };

const PORT = process.env.PORT || config.port;
const SERVICE_NAME = config.name;

const app = express();
app.use(cors());
app.use(express.json());

// Track service start time
const startTime = Date.now();

// =============================================================================
// REQUIRED: Health endpoint (Orchestrator checks this)
// =============================================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: SERVICE_NAME,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
    });
});

// =============================================================================
// Status endpoint (more detailed than health)
// =============================================================================
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        service: SERVICE_NAME,
        version: require('./package.json').version,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memory: process.memoryUsage(),
        config: {
            port: PORT
        }
    });
});

// =============================================================================
// Your endpoints here
// =============================================================================

// Example: GET /api/example
app.get('/api/example', (req, res) => {
    res.json({ message: 'Hello from ' + SERVICE_NAME });
});

// Example: POST /api/example
app.post('/api/example', (req, res) => {
    const { data } = req.body;
    console.log(`[${SERVICE_NAME}] Received:`, data);
    res.json({ success: true, received: data });
});

// =============================================================================
// Relay integration helpers
// =============================================================================

/**
 * Send alert to Relay
 * @param {string} type - 'info' | 'warning' | 'error' | 'success'
 * @param {string} message - Alert message
 */
async function sendAlert(type, message) {
    try {
        await fetch('http://localhost:8600/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                message,
                source: SERVICE_NAME,
                timestamp: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error(`[${SERVICE_NAME}] Failed to send alert:`, err.message);
    }
}

/**
 * Store data in Relay knowledge base
 * @param {string} key - Storage key
 * @param {any} value - Data to store
 */
async function storeKnowledge(key, value) {
    try {
        await fetch('http://localhost:8600/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
    } catch (err) {
        console.error(`[${SERVICE_NAME}] Failed to store knowledge:`, err.message);
    }
}

/**
 * Retrieve data from Relay knowledge base
 * @param {string} key - Storage key
 */
async function getKnowledge(key) {
    try {
        const res = await fetch(`http://localhost:8600/api/knowledge/${key}`);
        if (res.ok) return await res.json();
    } catch (err) {
        console.error(`[${SERVICE_NAME}] Failed to get knowledge:`, err.message);
    }
    return null;
}

// =============================================================================
// Start server
// =============================================================================
app.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log('');
    console.log(`========================================`);
    console.log(`  ${SERVICE_NAME}`);
    console.log(`========================================`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${localIP}:${PORT}`);
    console.log(`  Health:  http://localhost:${PORT}/api/health`);
    console.log(`========================================`);
    console.log('');

    // Notify Relay we're online (optional)
    sendAlert('info', `${SERVICE_NAME} started on port ${PORT}`);
});

// Get local IP address
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n[${SERVICE_NAME}] Shutting down...`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`\n[${SERVICE_NAME}] Terminated`);
    process.exit(0);
});
