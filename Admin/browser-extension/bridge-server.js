/**
 * Kitt Browser Bridge Server
 * HTTP API that communicates with browser extension via WebSocket
 *
 * Port: 8620
 *
 * Endpoints:
 *   GET  /status          - Check connection status
 *   GET  /tabs            - List all tabs
 *   POST /navigate        - Navigate to URL
 *   POST /click           - Click element
 *   POST /type            - Type text
 *   POST /read            - Read page content
 *   POST /execute         - Execute JavaScript
 *   POST /screenshot      - Capture tab
 */

const http = require('http');
const WebSocket = require('ws');

const PORT = 8620;

// State
let extensionSocket = null;
let pendingRequests = new Map();
let requestId = 0;

// Create WebSocket server for extension
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('[Bridge] Extension connected');
    extensionSocket = ws;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'connect') {
                console.log(`[Bridge] Agent: ${msg.agent} v${msg.version}`);
                return;
            }

            if (msg.type === 'response') {
                const pending = pendingRequests.get(msg.id);
                if (pending) {
                    pending.resolve(msg);
                    pendingRequests.delete(msg.id);
                }
            }
        } catch (err) {
            console.error('[Bridge] Parse error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Bridge] Extension disconnected');
        extensionSocket = null;
    });

    ws.on('error', (err) => {
        console.error('[Bridge] WebSocket error:', err);
    });
});

// Send command to extension
function sendToExtension(action, params = {}) {
    return new Promise((resolve, reject) => {
        if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
            reject(new Error('Extension not connected'));
            return;
        }

        const id = ++requestId;
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('Request timeout'));
        }, 30000);

        pendingRequests.set(id, {
            resolve: (data) => {
                clearTimeout(timeout);
                resolve(data);
            },
            reject
        });

        extensionSocket.send(JSON.stringify({ id, action, params }));
    });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse body for POST
    let body = '';
    if (req.method === 'POST') {
        for await (const chunk of req) {
            body += chunk;
        }
    }
    const params = body ? JSON.parse(body) : {};

    try {
        let result;

        switch (req.url) {
            case '/status':
                result = {
                    connected: extensionSocket?.readyState === WebSocket.OPEN,
                    pendingRequests: pendingRequests.size
                };
                break;

            case '/tabs':
                result = await sendToExtension('getTabs');
                break;

            case '/active':
                result = await sendToExtension('getActiveTab');
                break;

            case '/navigate':
                result = await sendToExtension('navigate', params);
                break;

            case '/newtab':
                result = await sendToExtension('newTab', params);
                break;

            case '/close':
                result = await sendToExtension('closeTab', params);
                break;

            case '/click':
                result = await sendToExtension('click', params);
                break;

            case '/type':
                result = await sendToExtension('type', params);
                break;

            case '/input':
                result = await sendToExtension('setInputValue', params);
                break;

            case '/read':
                result = await sendToExtension('readPage', params);
                break;

            case '/execute':
                result = await sendToExtension('executeScript', params);
                break;

            case '/screenshot':
                result = await sendToExtension('screenshot', params);
                break;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
        }

        res.writeHead(200);
        res.end(JSON.stringify(result));

    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
    }
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Kitt Browser Bridge Server v1.0.0');
    console.log(`HTTP API: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Waiting for extension to connect...');
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET  /status     - Connection status');
    console.log('  GET  /tabs       - List tabs');
    console.log('  GET  /active     - Get active tab');
    console.log('  POST /navigate   - {tabId?, url}');
    console.log('  POST /newtab     - {url?}');
    console.log('  POST /click      - {tabId, selector | x,y}');
    console.log('  POST /type       - {tabId, selector?, text}');
    console.log('  POST /input      - {tabId, selector, value}');
    console.log('  POST /read       - {tabId, selector?}');
    console.log('  POST /execute    - {tabId, code}');
    console.log('  POST /screenshot - {tabId?}');
});
