/**
 * Hive Mind - Real-time Activity Monitor Server
 * Aggregates events from all hive services
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8701;

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(path.join(__dirname, 'hive-mind.html')));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        }
    });
}

// Connect to Relay WebSocket and forward events
let relayWs = null;

function connectToRelay() {
    try {
        relayWs = new WebSocket('ws://localhost:8600');

        relayWs.on('open', () => {
            console.log('Connected to Relay');
            broadcast({ source: 'system', content: 'Connected to Relay' });
        });

        relayWs.on('message', (data) => {
            try {
                const event = JSON.parse(data);
                broadcast({ source: 'relay', type: event.type, data: event.data });
            } catch (e) {}
        });

        relayWs.on('close', () => {
            console.log('Relay disconnected, reconnecting...');
            setTimeout(connectToRelay, 5000);
        });

        relayWs.on('error', () => {});
    } catch (e) {
        setTimeout(connectToRelay, 5000);
    }
}

// Poll Oracle for status
async function pollOracle() {
    try {
        const resp = await fetch('http://localhost:3002/api/health');
        if (resp.ok) {
            const data = await resp.json();
            broadcast({ source: 'oracle', type: 'status', data });
        }
    } catch (e) {}
}

// Check all service health
async function checkServices() {
    const services = [
        { name: 'ollama', url: 'http://localhost:11434/api/tags' },
        { name: 'oracle', url: 'http://localhost:3002/api/health' },
        { name: 'relay', url: 'http://localhost:8600/api/status' },
        { name: 'kittbox', url: 'http://localhost:8585/' },
        { name: 'kittlive', url: 'http://localhost:8686/' }
    ];

    const status = {};
    for (const svc of services) {
        try {
            await fetch(svc.url, { method: 'HEAD' });
            status[svc.name] = 'online';
        } catch (e) {
            status[svc.name] = 'offline';
        }
    }
    broadcast({ source: 'system', type: 'health', data: status });
}

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║         Hive-Mind MONITOR            ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
`);

    connectToRelay();
    setInterval(checkServices, 10000);
    setInterval(pollOracle, 30000);
});
