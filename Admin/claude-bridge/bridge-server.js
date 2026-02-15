/**
 * Claude Code Bridge Server v2.0.0
 *
 * Automatic task processor for Kitt - picks up tasks from relay queue
 * and executes them via Claude Code CLI (uses Pro subscription, no API costs)
 *
 * Features:
 *   - Auto-consumes tasks from relay queue
 *   - Spawns Claude Code CLI for each task
 *   - Sends responses back to relay
 *   - HTTP API for direct requests
 *   - Health monitoring and status
 *
 * Port: 8601
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\bridge-server.js
 * Last Updated: 2026-01-12
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const usageMetrics = require('../shared/usage-metrics');

const app = express();
usageMetrics.init('Claude-Bridge');
app.use(express.json());
app.use(usageMetrics.middleware());

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ==================== CONFIGURATION ====================
const config = {
    port: process.env.BRIDGE_PORT || 8601,
    relayUrl: process.env.RELAY_URL || 'http://localhost:8600',
    workingDir: process.env.WORKING_DIR || 'C:\\LLM-DevOSWE',
    pollInterval: 3000,         // Check relay every 3s
    taskTimeout: 10 * 60 * 1000, // 10 minute timeout per task
    heartbeatInterval: 5000,    // Heartbeat every 5s
    autoConsume: true,          // Auto-pick up relay tasks
    maxConcurrent: 1            // Max concurrent tasks (1 for now)
};

// ==================== STATE ====================
const state = {
    consumerId: `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    currentTask: null,
    tasksCompleted: 0,
    tasksFailed: 0,
    startTime: Date.now(),
    lastActivity: null,
    isProcessing: false,
    requestQueue: []
};

let pollTimer = null;
let heartbeatTimer = null;

// ==================== LOGGING ====================
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [Bridge] ${message}`);
}

// ==================== RELAY INTEGRATION ====================

async function registerWithRelay() {
    try {
        const res = await fetch(`${config.relayUrl}/api/consumer/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumerId: state.consumerId,
                name: `Claude-Bridge-${process.pid}`
            })
        });
        if (res.ok) {
            log(`Registered with relay as ${state.consumerId}`);
        }
    } catch (err) {
        log(`Failed to register with relay: ${err.message}`, 'WARN');
    }
}

async function sendHeartbeat() {
    if (!state.currentTask) return;

    try {
        await fetch(`${config.relayUrl}/api/consumer/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumerId: state.consumerId,
                taskId: state.currentTask.id
            })
        });
    } catch (err) {
        log(`Heartbeat failed: ${err.message}`, 'WARN');
    }
}

async function checkRelayQueue() {
    if (!config.autoConsume || state.isProcessing) return;

    try {
        const res = await fetch(`${config.relayUrl}/api/tasks/next?consumerId=${state.consumerId}`);
        const data = await res.json();

        if (data.task) {
            log(`Picked up task ${data.task.id} from relay`);
            await processRelayTask(data.task);
        }
    } catch (err) {
        // Relay not available - silently retry
        if (err.code !== 'ECONNREFUSED') {
            log(`Relay check failed: ${err.message}`, 'WARN');
        }
    }
}

async function processRelayTask(task) {
    state.isProcessing = true;
    state.currentTask = task;
    state.lastActivity = Date.now();

    // Start heartbeat
    heartbeatTimer = setInterval(sendHeartbeat, config.heartbeatInterval);

    log(`Processing task: ${task.content.substring(0, 50)}...`);

    try {
        const response = await callClaudeCLI(task.content, task.session_id);

        // Send response back to relay
        await fetch(`${config.relayUrl}/api/tasks/${task.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response,
                consumerId: state.consumerId
            })
        });

        state.tasksCompleted++;
        log(`Task ${task.id} completed successfully`);

    } catch (err) {
        log(`Task ${task.id} failed: ${err.message}`, 'ERROR');

        // Report error to relay
        try {
            await fetch(`${config.relayUrl}/api/tasks/${task.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: err.message,
                    consumerId: state.consumerId
                })
            });
        } catch (e) {
            log(`Failed to report error to relay: ${e.message}`, 'ERROR');
        }

        state.tasksFailed++;
    } finally {
        // Cleanup
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        state.currentTask = null;
        state.isProcessing = false;
        state.lastActivity = Date.now();
    }
}

async function releaseCurrentTask() {
    if (!state.currentTask) return;

    log(`Releasing task ${state.currentTask.id} back to queue`);

    try {
        await fetch(`${config.relayUrl}/api/tasks/${state.currentTask.id}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumerId: state.consumerId })
        });
    } catch (err) {
        log(`Failed to release task: ${err.message}`, 'WARN');
    }
}

// ==================== CLAUDE CLI EXECUTION ====================

function callClaudeCLI(message, sessionId) {
    return new Promise((resolve, reject) => {
        log(`Spawning Claude CLI...`);

        // Build args - use print mode for non-interactive
        const args = ['-p', message];

        const claudePath = process.env.CLAUDE_PATH || 'C:\\Users\\Stone-PC\\.local\\bin\\claude.exe';

        // Remove CLAUDECODE to allow nested sessions
        const env = { ...process.env };
        delete env.CLAUDECODE;

        const claude = spawn(claudePath, args, {
            shell: true,
            env: env,
            cwd: config.workingDir
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        claude.stdout.on('data', (data) => {
            stdout += data.toString();
            // Log progress
            const lines = stdout.split('\n').length;
            if (lines % 10 === 0) {
                log(`Claude output: ${lines} lines received`);
            }
        });

        claude.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        claude.on('close', (code) => {
            if (killed) return;

            if (code === 0) {
                log(`Claude CLI completed (${stdout.length} chars)`);
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr || `Claude CLI exited with code ${code}`));
            }
        });

        claude.on('error', (err) => {
            reject(new Error(`Failed to spawn claude: ${err.message}`));
        });

        // Timeout
        setTimeout(() => {
            if (!killed) {
                killed = true;
                claude.kill('SIGTERM');
                reject(new Error(`Task timed out after ${config.taskTimeout / 1000}s`));
            }
        }, config.taskTimeout);
    });
}

// ==================== HTTP API ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Claude Code Bridge',
        version: '2.0.0',
        consumerId: state.consumerId,
        autoConsume: config.autoConsume,
        busy: state.isProcessing,
        currentTask: state.currentTask ? {
            id: state.currentTask.id,
            preview: state.currentTask.content?.substring(0, 50)
        } : null,
        stats: {
            completed: state.tasksCompleted,
            failed: state.tasksFailed,
            uptime: Math.round((Date.now() - state.startTime) / 1000),
            lastActivity: state.lastActivity ? new Date(state.lastActivity).toISOString() : null
        },
        queueLength: state.requestQueue.length,
        usage: usageMetrics.getSummary()
    });
});

// Direct chat API (for manual requests)
app.post('/api/chat', async (req, res) => {
    const { message, context } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // Queue if busy
    if (state.isProcessing) {
        const queueItem = { message, context, res, timestamp: Date.now() };
        state.requestQueue.push(queueItem);
        log(`Direct request queued. Queue length: ${state.requestQueue.length}`);
        return; // Response will be sent when processed
    }

    await processDirectMessage(message, context, res);
});

async function processDirectMessage(message, context, res) {
    state.isProcessing = true;
    state.lastActivity = Date.now();

    log(`Processing direct request: ${message.substring(0, 50)}...`);

    try {
        let fullPrompt = message;
        if (context) {
            fullPrompt = `Context: ${context}\n\nRequest: ${message}`;
        }

        const response = await callClaudeCLI(fullPrompt);
        res.json({ success: true, response });
        state.tasksCompleted++;
    } catch (error) {
        log(`Direct request failed: ${error.message}`, 'ERROR');
        res.status(500).json({ error: error.message });
        state.tasksFailed++;
    } finally {
        state.isProcessing = false;
        state.lastActivity = Date.now();
        processNextInQueue();
    }
}

function processNextInQueue() {
    if (state.requestQueue.length > 0 && !state.isProcessing) {
        const next = state.requestQueue.shift();
        log(`Processing queued request. Remaining: ${state.requestQueue.length}`);
        processDirectMessage(next.message, next.context, next.res);
    }
}

// Toggle auto-consume
app.post('/api/config/auto-consume', (req, res) => {
    const { enabled } = req.body;
    config.autoConsume = enabled !== false;
    log(`Auto-consume ${config.autoConsume ? 'enabled' : 'disabled'}`);
    res.json({ success: true, autoConsume: config.autoConsume });
});

// Get queue status
app.get('/api/queue', (req, res) => {
    res.json({
        active: state.currentTask ? {
            id: state.currentTask.id,
            message: state.currentTask.content?.substring(0, 50) + '...',
            elapsed: Date.now() - state.lastActivity
        } : null,
        pending: state.requestQueue.length,
        queue: state.requestQueue.map(q => ({
            message: q.message.substring(0, 50) + '...',
            waiting: Date.now() - q.timestamp
        }))
    });
});

// Clear queue
app.delete('/api/queue', (req, res) => {
    const cleared = state.requestQueue.length;
    state.requestQueue.forEach(q => {
        q.res.status(499).json({ error: 'Request cancelled' });
    });
    state.requestQueue = [];
    log(`Cleared ${cleared} queued requests`);
    res.json({ success: true, cleared });
});

// ==================== GRACEFUL SHUTDOWN ====================

async function shutdown(signal) {
    log(`Received ${signal}, shutting down gracefully...`);

    // Stop polling
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    // Stop heartbeat
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    // Release any in-progress task
    await releaseCurrentTask();

    // Unregister from relay
    try {
        await fetch(`${config.relayUrl}/api/consumer/unregister`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumerId: state.consumerId })
        });
        log('Unregistered from relay');
    } catch (err) {
        // Ignore
    }

    log('Goodbye!');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Windows-specific
if (process.platform === 'win32') {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('SIGINT', () => shutdown('SIGINT'));
}

// ==================== STARTUP ====================

app.listen(config.port, async () => {
    log('═'.repeat(50));
    log('Claude Code Bridge v2.0.0');
    log('═'.repeat(50));
    log(`Consumer ID: ${state.consumerId}`);
    log(`Port: ${config.port}`);
    log(`Relay: ${config.relayUrl}`);
    log(`Working Dir: ${config.workingDir}`);
    log(`Auto-consume: ${config.autoConsume ? 'ENABLED' : 'DISABLED'}`);
    log(`Poll interval: ${config.pollInterval}ms`);
    log(`Task timeout: ${config.taskTimeout / 1000}s`);
    log('═'.repeat(50));
    log('POST /api/chat for direct requests');
    log('GET /api/health for status');
    log('POST /api/config/auto-consume to toggle relay pickup');
    log('═'.repeat(50));

    // Register with relay
    await registerWithRelay();

    // Start polling relay queue
    if (config.autoConsume) {
        pollTimer = setInterval(checkRelayQueue, config.pollInterval);
        log('Started relay queue polling');

        // Check immediately
        setTimeout(checkRelayQueue, 1000);
    }
});
