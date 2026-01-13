/**
 * Terminal Bridge Server v1.0.0
 *
 * Streams Claude Code terminal output to Command Center UI
 *
 * Architecture:
 * - WebSocket server on port 8701
 * - Receives output from Claude Code hooks
 * - Broadcasts to all connected Admin UI clients
 * - Stores recent output buffer for new connections
 *
 * Port: 8701
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.TERMINAL_BRIDGE_PORT || 8701;

// Output buffer (keep last 500 lines)
const MAX_BUFFER_LINES = 500;
let outputBuffer = [];
let sessionInfo = {
    cwd: process.cwd(),
    startTime: new Date().toISOString(),
    isActive: false
};

// ============================================
// HTTP SERVER (for health checks)
// ============================================

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/health' || req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Terminal Bridge',
            port: PORT,
            clients: wss.clients.size,
            bufferLines: outputBuffer.length,
            session: sessionInfo
        }));
        return;
    }

    // POST /output - receive output from hooks
    if (req.method === 'POST' && req.url === '/output') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                handleOutput(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // GET /buffer - get current buffer
    if (req.url === '/buffer') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            buffer: outputBuffer,
            session: sessionInfo
        }));
        return;
    }

    // POST /clear - clear buffer
    if (req.method === 'POST' && req.url === '/clear') {
        outputBuffer = [];
        broadcast({ type: 'clear' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log(`[TerminalBridge] Client connected: ${clientId}`);

    // Send current session info and buffer
    ws.send(JSON.stringify({
        type: 'init',
        clientId,
        session: sessionInfo,
        buffer: outputBuffer
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            handleClientMessage(ws, clientId, data);
        } catch (err) {
            console.error('[TerminalBridge] Parse error:', err);
        }
    });

    ws.on('close', () => {
        console.log(`[TerminalBridge] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
        console.error(`[TerminalBridge] WebSocket error for ${clientId}:`, err);
    });
});

function handleClientMessage(ws, clientId, data) {
    switch (data.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        case 'get_buffer':
            ws.send(JSON.stringify({
                type: 'buffer',
                buffer: outputBuffer,
                session: sessionInfo
            }));
            break;

        case 'clear':
            outputBuffer = [];
            broadcast({ type: 'clear' });
            break;

        default:
            console.log(`[TerminalBridge] Unknown message type: ${data.type}`);
    }
}

// ============================================
// OUTPUT HANDLING
// ============================================

function handleOutput(data) {
    const entry = {
        timestamp: new Date().toISOString(),
        type: data.type || 'output',  // output, error, system, tool, assistant
        content: data.content || data.text || '',
        tool: data.tool || null,
        cwd: data.cwd || sessionInfo.cwd
    };

    // Update session info
    if (data.cwd) sessionInfo.cwd = data.cwd;
    if (data.type === 'start') sessionInfo.isActive = true;
    if (data.type === 'end') sessionInfo.isActive = false;

    // Add to buffer
    outputBuffer.push(entry);

    // Trim buffer if too large
    while (outputBuffer.length > MAX_BUFFER_LINES) {
        outputBuffer.shift();
    }

    // Broadcast to all clients
    broadcast({
        type: 'output',
        entry
    });

    console.log(`[TerminalBridge] ${entry.type}: ${entry.content.substring(0, 50)}...`);
}

function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// ============================================
// STDIN READER (for direct piping)
// ============================================

if (!process.stdin.isTTY) {
    console.log('[TerminalBridge] Reading from stdin...');

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
        handleOutput({
            type: 'output',
            content: chunk
        });
    });
}

// ============================================
// STARTUP
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           TERMINAL BRIDGE v1.0.0                          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  WebSocket:  ws://localhost:${PORT}                         ║
║  HTTP POST:  http://localhost:${PORT}/output                ║
║  Health:     http://localhost:${PORT}/health                ║
║                                                           ║
║  Usage:                                                   ║
║    1. Start this server                                   ║
║    2. Configure Claude Code hooks to POST to /output      ║
║    3. Connect Admin UI to WebSocket                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n[TerminalBridge] Shutting down...');
    wss.close(() => {
        server.close(() => {
            console.log('[TerminalBridge] Goodbye!');
            process.exit(0);
        });
    });
}

module.exports = { server, wss, handleOutput, broadcast };
