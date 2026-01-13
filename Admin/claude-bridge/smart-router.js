/**
 * Smart Message Router v1.0.0
 *
 * Routes messages to Claude Code when available, falls back to local LLM.
 *
 * Architecture:
 *   Phone → Relay → Smart Router → Claude Code (priority) OR Local LLM (fallback)
 *
 * Endpoints:
 *   POST /api/claude/connect    - Claude Code announces availability
 *   POST /api/claude/disconnect - Claude Code going offline
 *   GET  /api/claude/status     - Check if Claude is available
 *   GET  /api/messages/next     - Claude Code polls for next message
 *   POST /api/messages/:id/complete - Claude Code reports completion
 *
 * Port: 8610
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\smart-router.js
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { execSync } = require('child_process');

const app = express();
const PORT = 8610;

app.use(cors());
app.use(express.json());

// ============================================
// STATE
// ============================================

const state = {
    claudeConnected: false,
    claudeLastSeen: null,
    claudeSessionId: null,
    processedCount: 0,
    llmFallbackCount: 0
};

const CONFIG = {
    relayUrl: 'http://localhost:8600',
    claudeTimeout: 30000,      // Consider Claude offline after 30s no heartbeat
    pollInterval: 3000,        // Check relay every 3s
    // Local Ollama LLM
    useLocalOllama: true,
    ollamaModel: 'qwen2.5-coder:14b',  // 14b for better quality (87 tok/s)
    // Remote LLM (backup - ai-pc)
    llmUrl: 'http://ai-pc:1234',
    llmModel: 'qwen2.5-7b-instruct',
    llmTimeout: 60000
};

// ============================================
// HELPERS
// ============================================

function log(msg) {
    const ts = new Date().toISOString().substr(11, 8);
    console.log(`[${ts}] ${msg}`);
}

function relayGet(path) {
    return new Promise((resolve, reject) => {
        http.get(`${CONFIG.relayUrl}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Parse error')); }
            });
        }).on('error', reject);
    });
}

function relayPost(path, body = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${CONFIG.relayUrl}${path}`);
        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ raw: data }); }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

function runLocalOllama(prompt) {
    const safePrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ').substring(0, 500);
    // Direct prompt - just answer the question
    const fullPrompt = safePrompt;

    try {
        const output = execSync(`ollama run ${CONFIG.ollamaModel} "${fullPrompt}"`, {
            encoding: 'utf8',
            timeout: CONFIG.llmTimeout,
            windowsHide: true
        });
        return output.replace(/[\x1b\[][\d;?]*[mGKHJ]/g, '').replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '').trim();
    } catch (err) {
        return `Ollama Error: ${err.message}`;
    }
}

async function runRemoteLLM(prompt) {
    const systemPrompt = `You are Kitt, a helpful AI assistant. Keep responses brief (1-2 sentences).`;

    return new Promise((resolve, reject) => {
        const url = new URL(`${CONFIG.llmUrl}/v1/chat/completions`);
        const body = JSON.stringify({
            model: CONFIG.llmModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.7
        });

        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: CONFIG.llmTimeout
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0] && json.choices[0].message) {
                        resolve(json.choices[0].message.content.trim());
                    } else {
                        resolve('Message received.');
                    }
                } catch (e) {
                    resolve(`LLM Parse Error: ${data.substring(0, 100)}`);
                }
            });
        });

        req.on('error', (err) => resolve(`LLM Error: ${err.message}`));
        req.on('timeout', () => {
            req.destroy();
            resolve('LLM Timeout');
        });

        req.write(body);
        req.end();
    });
}

function isClaudeAvailable() {
    if (!state.claudeConnected) return false;
    if (!state.claudeLastSeen) return false;

    const elapsed = Date.now() - state.claudeLastSeen;
    if (elapsed > CONFIG.claudeTimeout) {
        log('Claude timed out - marking offline');
        state.claudeConnected = false;
        return false;
    }
    return true;
}

// ============================================
// CLAUDE CODE ENDPOINTS
// ============================================

// Claude announces it's available
app.post('/api/claude/connect', (req, res) => {
    const sessionId = req.body.sessionId || `claude-${Date.now()}`;
    state.claudeConnected = true;
    state.claudeLastSeen = Date.now();
    state.claudeSessionId = sessionId;
    log(`Claude connected: ${sessionId}`);
    res.json({ success: true, sessionId, message: 'Claude is now the primary processor' });
});

// Claude going offline
app.post('/api/claude/disconnect', (req, res) => {
    log(`Claude disconnected: ${state.claudeSessionId}`);
    state.claudeConnected = false;
    state.claudeSessionId = null;
    res.json({ success: true, message: 'Claude offline, falling back to local LLM' });
});

// Heartbeat - Claude is still alive
app.post('/api/claude/heartbeat', (req, res) => {
    state.claudeLastSeen = Date.now();
    res.json({ success: true, timestamp: state.claudeLastSeen });
});

// Check Claude status
app.get('/api/claude/status', (req, res) => {
    res.json({
        available: isClaudeAvailable(),
        connected: state.claudeConnected,
        sessionId: state.claudeSessionId,
        lastSeen: state.claudeLastSeen,
        processedByClaudeCode: state.processedCount,
        processedByLLM: state.llmFallbackCount
    });
});

// Claude polls for next message
app.get('/api/messages/next', async (req, res) => {
    state.claudeLastSeen = Date.now(); // Acts as heartbeat

    try {
        const pending = await relayGet('/api/messages/pending');

        if (pending.count === 0) {
            return res.json({ hasMessage: false });
        }

        const msg = pending.messages[0];

        // Claim it
        const claimed = await relayPost(`/api/messages/${msg.id}/claim`);
        if (!claimed.success) {
            return res.json({ hasMessage: false, error: 'Failed to claim' });
        }

        log(`Routing to Claude: [${msg.id}] "${msg.content.substring(0, 30)}..."`);

        res.json({
            hasMessage: true,
            id: msg.id,
            content: msg.content,
            priority: msg.priority,
            age: msg.age
        });
    } catch (err) {
        res.json({ hasMessage: false, error: err.message });
    }
});

// Claude reports completion
app.post('/api/messages/:id/complete', async (req, res) => {
    const { id } = req.params;
    const { response, success } = req.body;

    state.claudeLastSeen = Date.now();

    try {
        await relayPost(`/api/messages/${id}/respond`, { response });
        state.processedCount++;
        log(`Claude completed: [${id}] - ${success ? 'success' : 'failed'}`);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ============================================
// BACKGROUND: LLM FALLBACK PROCESSOR
// ============================================

async function processWithFallback() {
    // Only process if Claude is NOT available
    if (isClaudeAvailable()) return;

    try {
        const pending = await relayGet('/api/messages/pending');
        if (pending.count === 0) return;

        const msg = pending.messages[0];

        // Double-check Claude didn't just connect
        if (isClaudeAvailable()) return;

        // Claim and process with local LLM
        const claimed = await relayPost(`/api/messages/${msg.id}/claim`);
        if (!claimed.success) return;

        log(`LLM fallback: [${msg.id}] "${msg.content.substring(0, 30)}..."`);

        let response;
        let label;
        if (CONFIG.useLocalOllama) {
            response = runLocalOllama(msg.content);
            label = 'Local LLM';
        } else {
            response = await runRemoteLLM(msg.content);
            label = 'ai-pc LLM';
        }

        await relayPost(`/api/messages/${msg.id}/respond`, {
            response: `[${label}] ${response}`
        });

        state.llmFallbackCount++;
        log(`LLM completed: [${msg.id}]`);
    } catch (err) {
        // Ignore errors, will retry next poll
    }
}

// ============================================
// STATUS ENDPOINT
// ============================================

app.get('/api/status', (req, res) => {
    res.json({
        service: 'Smart Router',
        version: '1.0.0',
        llmMode: CONFIG.useLocalOllama ? 'local' : 'aipc',
        claude: {
            available: isClaudeAvailable(),
            sessionId: state.claudeSessionId,
            lastSeen: state.claudeLastSeen
        },
        stats: {
            processedByClaudeCode: state.processedCount,
            processedByLLM: state.llmFallbackCount
        }
    });
});

// Switch LLM mode
app.post('/api/llm/mode', (req, res) => {
    const { mode } = req.body;

    if (mode === 'local') {
        CONFIG.useLocalOllama = true;
        log('Switched to Local Ollama');
    } else if (mode === 'aipc') {
        CONFIG.useLocalOllama = false;
        log('Switched to ai-pc LLM');
    } else if (mode === 'claude') {
        // Claude mode just means prefer Claude when available
        CONFIG.useLocalOllama = true;  // Fallback to local
        log('Switched to Claude priority mode');
    }

    res.json({
        success: true,
        mode: mode,
        useLocalOllama: CONFIG.useLocalOllama
    });
});

app.get('/api/llm/mode', (req, res) => {
    res.json({
        mode: CONFIG.useLocalOllama ? 'local' : 'aipc',
        useLocalOllama: CONFIG.useLocalOllama,
        claudeAvailable: isClaudeAvailable()
    });
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
    log('='.repeat(50));
    log('Smart Message Router v1.0.0');
    log(`Port: ${PORT}`);
    log(`Relay: ${CONFIG.relayUrl}`);
    log(`LLM Fallback: ${CONFIG.llmModel}`);
    log('='.repeat(50));
    log('Waiting for Claude Code to connect...');

    // Start fallback processor
    setInterval(processWithFallback, CONFIG.pollInterval);
});
