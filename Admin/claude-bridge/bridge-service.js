/**
 * Claude Bridge Service v1.0.0
 *
 * Simple WebSocket bridge to Claude Code CLI
 * Replaces: Agent Server + Relay + Consumer
 *
 * Two workers:
 * - Quick Worker: Read-only tasks (status, questions) - instant
 * - Code Worker: File changes - queued, file-safe
 *
 * Port: 8700
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.BRIDGE_PORT || 8700;
const WORKING_DIR = process.env.BRIDGE_CWD || 'C:\\DevOSWE';

// ============================================
// WORKER MANAGEMENT
// ============================================

class ClaudeWorker {
    constructor(name, options = {}) {
        this.name = name;
        this.busy = false;
        this.currentTask = null;
        this.queue = [];
        this.maxQueue = options.maxQueue || 10;
        this.timeout = options.timeout || 30 * 60 * 1000; // 30 min default
        this.process = null;
        this.taskCount = 0;
    }

    canAccept() {
        return this.queue.length < this.maxQueue;
    }

    async execute(task, onData, onComplete, onError) {
        if (this.busy) {
            if (!this.canAccept()) {
                onError(new Error('Queue full'));
                return;
            }
            // Add to queue
            this.queue.push({ task, onData, onComplete, onError });
            onData(`[Queued] Position ${this.queue.length} in ${this.name}\n`);
            return;
        }

        this.busy = true;
        this.currentTask = task;
        this.taskCount++;

        const taskId = `${this.name}-${this.taskCount}`;
        console.log(`[${this.name}] Starting task ${taskId}: ${task.content.substring(0, 50)}...`);

        try {
            await this._runClaude(task.content, onData, onComplete, onError);
        } catch (err) {
            onError(err);
        } finally {
            this.busy = false;
            this.currentTask = null;
            this._processQueue();
        }
    }

    _processQueue() {
        if (this.queue.length > 0 && !this.busy) {
            const next = this.queue.shift();
            this.execute(next.task, next.onData, next.onComplete, next.onError);
        }
    }

    _runClaude(content, onData, onComplete, onError) {
        return new Promise((resolve, reject) => {
            // Escape content for shell - wrap in quotes and escape inner quotes
            const escapedContent = content.replace(/"/g, '\\"');
            const args = ['--print', `"${escapedContent}"`];

            console.log(`[${this.name}] Spawning: claude --print "${content.substring(0, 30)}..."`);

            const claudePath = process.env.CLAUDE_PATH || 'C:\\Users\\Stone-PC\\AppData\\Roaming\\npm\\claude.cmd';
            this.process = spawn(claudePath, args, {
                cwd: WORKING_DIR,
                shell: false,
                env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
            });

            let output = '';
            let timeoutId = setTimeout(() => {
                if (this.process) {
                    this.process.kill();
                    onError(new Error(`Task timeout after ${this.timeout / 1000}s`));
                    reject(new Error('Timeout'));
                }
            }, this.timeout);

            this.process.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                onData(text);
            });

            this.process.stderr.on('data', (data) => {
                const text = data.toString();
                output += text;
                onData(text);
            });

            this.process.on('close', (code) => {
                clearTimeout(timeoutId);
                this.process = null;
                console.log(`[${this.name}] Task completed with code ${code}`);
                onComplete(output, code);
                resolve(output);
            });

            this.process.on('error', (err) => {
                clearTimeout(timeoutId);
                this.process = null;
                console.error(`[${this.name}] Process error:`, err);
                onError(err);
                reject(err);
            });
        });
    }

    getStatus() {
        return {
            name: this.name,
            busy: this.busy,
            queueLength: this.queue.length,
            taskCount: this.taskCount,
            currentTask: this.currentTask ? this.currentTask.content.substring(0, 50) + '...' : null
        };
    }

    kill() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

// ============================================
// TASK ROUTER
// ============================================

// Keywords that indicate code changes (route to Code Worker)
const CODE_CHANGE_KEYWORDS = [
    'edit', 'fix', 'change', 'update', 'modify', 'add', 'remove', 'delete',
    'create', 'write', 'implement', 'refactor', 'rename', 'move', 'build',
    'install', 'npm', 'commit', 'push', 'merge'
];

function isCodeChange(content) {
    const lower = content.toLowerCase();
    return CODE_CHANGE_KEYWORDS.some(kw => lower.includes(kw));
}

function routeTask(content) {
    if (isCodeChange(content)) {
        return 'code';
    }
    return 'quick';
}

// ============================================
// WORKERS
// ============================================

const workers = {
    quick: new ClaudeWorker('QuickWorker', {
        maxQueue: 5,
        timeout: 5 * 60 * 1000  // 5 min for quick tasks
    }),
    code: new ClaudeWorker('CodeWorker', {
        maxQueue: 10,
        timeout: 30 * 60 * 1000  // 30 min for code tasks
    })
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

    if (req.url === '/api/health' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Claude Bridge',
            port: PORT,
            workers: {
                quick: workers.quick.getStatus(),
                code: workers.code.getStatus()
            },
            uptime: process.uptime()
        }));
        return;
    }

    if (req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            quick: workers.quick.getStatus(),
            code: workers.code.getStatus()
        }));
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
    console.log(`[Bridge] Client connected: ${clientId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            handleMessage(ws, clientId, data);
        } catch (err) {
            // Plain text message
            handleMessage(ws, clientId, { type: 'task', content: message.toString() });
        }
    });

    ws.on('close', () => {
        console.log(`[Bridge] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
        console.error(`[Bridge] WebSocket error for ${clientId}:`, err);
    });

    // Send welcome
    ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        workers: {
            quick: workers.quick.getStatus(),
            code: workers.code.getStatus()
        }
    }));
});

function handleMessage(ws, clientId, data) {
    const { type, content, worker: preferredWorker } = data;

    if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
    }

    if (type === 'status') {
        ws.send(JSON.stringify({
            type: 'status',
            workers: {
                quick: workers.quick.getStatus(),
                code: workers.code.getStatus()
            }
        }));
        return;
    }

    if (type === 'task' || content) {
        const taskContent = content || data.toString();
        const workerType = preferredWorker || routeTask(taskContent);
        const worker = workers[workerType] || workers.quick;

        const taskId = `task_${Date.now()}`;

        ws.send(JSON.stringify({
            type: 'task_started',
            taskId,
            worker: worker.name,
            routed: workerType
        }));

        worker.execute(
            { content: taskContent, clientId, taskId },
            // onData - stream output
            (text) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'output',
                        taskId,
                        text
                    }));
                }
            },
            // onComplete
            (output, code) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'task_complete',
                        taskId,
                        exitCode: code,
                        output
                    }));
                }
            },
            // onError
            (err) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'task_error',
                        taskId,
                        error: err.message
                    }));
                }
            }
        );
    }
}

// ============================================
// STARTUP
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           CLAUDE BRIDGE SERVICE v1.0.0                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  WebSocket:  ws://localhost:${PORT}                         ║
║  Health:     http://localhost:${PORT}/api/health            ║
║  Working Dir: ${WORKING_DIR.padEnd(40)}║
║                                                           ║
║  Workers:                                                 ║
║    - QuickWorker: Read-only tasks (5 min timeout)        ║
║    - CodeWorker:  File changes (30 min timeout)          ║
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
    console.log('\n[Bridge] Shutting down...');
    workers.quick.kill();
    workers.code.kill();
    wss.close(() => {
        server.close(() => {
            console.log('[Bridge] Goodbye!');
            process.exit(0);
        });
    });
}

module.exports = { workers, server, wss };
