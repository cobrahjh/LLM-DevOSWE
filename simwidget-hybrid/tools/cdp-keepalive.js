// CDP keepalive: Forces all SimGlass tabs active every 500ms
// Prevents Edge/Chrome from freezing background tabs
// Usage: node tools/cdp-keepalive.js  (run on same machine as browser)
const WebSocket = require('ws');
const http = require('http');

const CDP_PORT = 9222;
const INTERVAL_MS = 500;
let connections = new Map(); // targetId -> { ws, url, title }

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${CDP_PORT}/json`, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sendCdp(ws, method, params = {}) {
    return new Promise((resolve) => {
        const msgId = Date.now() + Math.random();
        const timeout = setTimeout(() => resolve(null), 3000);
        const handler = (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.id === msgId) {
                    ws.off('message', handler);
                    clearTimeout(timeout);
                    resolve(data);
                }
            } catch(e) {}
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}

async function connectToTarget(target) {
    return new Promise((resolve) => {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        ws.on('open', () => resolve(ws));
        ws.on('error', () => resolve(null));
        setTimeout(() => resolve(null), 5000);
    });
}

async function refreshTargets() {
    try {
        const targets = await getTargets();
        const simglassTargets = targets.filter(t =>
            t.type === 'page' &&
            (t.url.includes('localhost:8080') || t.url.includes('192.168.1.42:8080'))
        );

        // Connect to new targets
        for (const t of simglassTargets) {
            if (!connections.has(t.id)) {
                const ws = await connectToTarget(t);
                if (ws) {
                    connections.set(t.id, { ws, url: t.url, title: t.title });
                    console.log(`[+] Connected: ${t.title} (${t.url})`);

                    ws.on('close', () => {
                        connections.delete(t.id);
                        console.log(`[-] Disconnected: ${t.title}`);
                    });
                }
            }
        }

        // Clean dead connections
        for (const [id, conn] of connections) {
            if (conn.ws.readyState !== 1) {
                connections.delete(id);
            }
        }
    } catch(e) {
        // CDP not available
    }
}

async function keepAlive() {
    for (const [id, conn] of connections) {
        if (conn.ws.readyState === 1) {
            // Force the page to stay active
            await sendCdp(conn.ws, 'Page.setWebLifecycleState', { state: 'active' });
        }
    }
}

// Main loop
async function main() {
    console.log(`CDP Keepalive — forcing SimGlass tabs active every ${INTERVAL_MS}ms`);
    console.log(`Watching CDP on port ${CDP_PORT}...\n`);

    // Initial target scan
    await refreshTargets();

    // Keep tabs alive every 500ms
    setInterval(keepAlive, INTERVAL_MS);

    // Rescan for new/closed tabs every 10s
    setInterval(refreshTargets, 10000);

    // Status report every 30s
    setInterval(() => {
        if (connections.size > 0) {
            console.log(`[status] ${connections.size} tabs active: ${[...connections.values()].map(c => c.title).join(', ')}`);
        }
    }, 30000);
}

main().catch(e => { console.error(e); process.exit(1); });
