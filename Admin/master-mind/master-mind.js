/**
 * Master Mind - Parallel LLM Orchestrator
 * Port: 8820
 *
 * Queries multiple LLM sources simultaneously and aggregates results.
 *
 * Sources:
 * - Ollama (localhost:11434) - Free, local
 * - LM Studio (localhost:1234) - Free, local (Nova)
 * - LM Studio Remote (192.168.1.162:1234) - Free, remote (Iris)
 * - Future: OpenAI, Claude API (with cost warnings)
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const usageMetrics = require('../shared/usage-metrics');

const app = express();
usageMetrics.init('Master-Mind');
app.use(cors());
app.use(express.json());
app.use(usageMetrics.middleware());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 8820;
const DATA_DIR = path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// LLM BACKENDS CONFIGURATION
// ============================================

const LLM_BACKENDS = {
    ollama: {
        name: 'Ollama',
        type: 'ollama',
        url: 'http://localhost:11434',
        model: 'qwen3-coder:latest',
        enabled: true,
        free: true,
        priority: 1,
        timeout: 60000
    },
    nova: {
        name: 'Nova (LM Studio Local)',
        type: 'openai',
        url: 'http://localhost:1234',
        model: 'local-model',
        enabled: true,
        free: true,
        priority: 2,
        timeout: 60000
    },
    iris: {
        name: 'Iris (LM Studio Remote)',
        type: 'openai',
        url: 'http://192.168.1.162:1234',
        model: 'vt-gwen-2.5-3b',
        enabled: true,
        free: true,
        priority: 3,
        timeout: 90000
    }
};

// Stats tracking
let stats = {
    totalQueries: 0,
    queriesByBackend: {},
    avgResponseTime: {},
    lastQuery: null,
    costIncurred: 0
};

// Load stats
try {
    if (fs.existsSync(STATS_FILE)) {
        stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
} catch (e) {}

function saveStats() {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// ============================================
// HTTP HELPERS
// ============================================

function httpRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const lib = isHttps ? https : http;
        const urlObj = new URL(url);

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname,
            method: options.method || 'POST',
            headers: options.headers || {},
            timeout: options.timeout || 60000
        };

        const req = lib.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// ============================================
// LLM QUERY FUNCTIONS
// ============================================

async function queryOllama(backend, prompt, options = {}) {
    const startTime = Date.now();

    try {
        const response = await httpRequest(
            `${backend.url}/api/generate`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: backend.timeout
            },
            {
                model: options.model || backend.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.maxTokens || 1000
                }
            }
        );

        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.response) {
            return {
                success: true,
                backend: backend.name,
                response: response.data.response,
                responseTime,
                tokens: response.data.eval_count || 0
            };
        }

        return { success: false, backend: backend.name, error: 'Invalid response', responseTime };
    } catch (e) {
        return { success: false, backend: backend.name, error: e.message, responseTime: Date.now() - startTime };
    }
}

async function queryOpenAI(backend, prompt, options = {}) {
    const startTime = Date.now();

    try {
        const response = await httpRequest(
            `${backend.url}/v1/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(backend.apiKey ? { 'Authorization': `Bearer ${backend.apiKey}` } : {})
                },
                timeout: backend.timeout
            },
            {
                model: options.model || backend.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 256,
                stop: ["\n\n", "User:", "Human:", "\n\n\n"],
                repeat_penalty: 1.2
            }
        );

        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.choices && response.data.choices[0]) {
            return {
                success: true,
                backend: backend.name,
                response: response.data.choices[0].message.content,
                responseTime,
                tokens: response.data.usage?.total_tokens || 0
            };
        }

        return { success: false, backend: backend.name, error: 'Invalid response', responseTime };
    } catch (e) {
        return { success: false, backend: backend.name, error: e.message, responseTime: Date.now() - startTime };
    }
}

async function queryBackend(backendId, prompt, options = {}) {
    const backend = LLM_BACKENDS[backendId];
    if (!backend || !backend.enabled) {
        return { success: false, backend: backendId, error: 'Backend not available' };
    }

    switch (backend.type) {
        case 'ollama':
            return queryOllama(backend, prompt, options);
        case 'openai':
            return queryOpenAI(backend, prompt, options);
        default:
            return { success: false, backend: backend.name, error: 'Unknown backend type' };
    }
}

// ============================================
// PARALLEL QUERY ENGINE
// ============================================

async function parallelQuery(prompt, options = {}) {
    const startTime = Date.now();
    const backends = options.backends || Object.keys(LLM_BACKENDS).filter(id => LLM_BACKENDS[id].enabled);

    console.log(`[MasterMind] Querying ${backends.length} backends in parallel...`);

    // Query all backends in parallel
    const promises = backends.map(id => queryBackend(id, prompt, options));
    const results = await Promise.all(promises);

    // Collect successful responses
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Update stats
    stats.totalQueries++;
    stats.lastQuery = Date.now();
    results.forEach(r => {
        stats.queriesByBackend[r.backend] = (stats.queriesByBackend[r.backend] || 0) + 1;
        if (r.success) {
            const prevAvg = stats.avgResponseTime[r.backend] || r.responseTime;
            stats.avgResponseTime[r.backend] = Math.round((prevAvg + r.responseTime) / 2);
        }
    });
    saveStats();

    const totalTime = Date.now() - startTime;

    return {
        query: prompt,
        totalTime,
        backends: {
            queried: backends.length,
            successful: successful.length,
            failed: failed.length
        },
        responses: successful.sort((a, b) => a.responseTime - b.responseTime),
        errors: failed,
        consensus: findConsensus(successful),
        fastest: successful.length > 0 ? successful.reduce((a, b) => a.responseTime < b.responseTime ? a : b) : null
    };
}

function findConsensus(responses) {
    if (responses.length < 2) return null;

    // Simple consensus: find common themes/keywords
    // This is a basic implementation - could be enhanced with NLP
    const allWords = responses.map(r =>
        r.response.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    );

    const wordCounts = {};
    allWords.flat().forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const commonWords = Object.entries(wordCounts)
        .filter(([_, count]) => count >= Math.ceil(responses.length * 0.6))
        .map(([word]) => word)
        .slice(0, 10);

    return {
        agreementLevel: commonWords.length > 5 ? 'high' : commonWords.length > 2 ? 'medium' : 'low',
        commonThemes: commonWords
    };
}

// ============================================
// SMART QUERY (FASTEST WINS)
// ============================================

async function smartQuery(prompt, options = {}) {
    const backends = options.backends || Object.keys(LLM_BACKENDS).filter(id => LLM_BACKENDS[id].enabled);

    console.log(`[MasterMind] Smart query - first response wins from ${backends.length} backends...`);

    // Race all backends - first successful response wins
    const promises = backends.map(id =>
        queryBackend(id, prompt, options).then(result => {
            if (result.success) return result;
            throw new Error(result.error);
        })
    );

    try {
        const winner = await Promise.any(promises);

        stats.totalQueries++;
        stats.lastQuery = Date.now();
        stats.queriesByBackend[winner.backend] = (stats.queriesByBackend[winner.backend] || 0) + 1;
        saveStats();

        return {
            mode: 'smart',
            winner: winner.backend,
            response: winner.response,
            responseTime: winner.responseTime,
            tokens: winner.tokens
        };
    } catch (e) {
        return {
            mode: 'smart',
            error: 'All backends failed',
            details: e.errors?.map(err => err.message) || [e.message]
        };
    }
}

// ============================================
// BACKEND HEALTH CHECK
// ============================================

async function checkBackendHealth(backendId) {
    const backend = LLM_BACKENDS[backendId];
    if (!backend) return { id: backendId, status: 'unknown' };

    try {
        let healthUrl;
        if (backend.type === 'ollama') {
            healthUrl = `${backend.url}/api/tags`;
        } else {
            healthUrl = `${backend.url}/v1/models`;
        }

        const response = await httpRequest(healthUrl, { method: 'GET', timeout: 2000 });

        return {
            id: backendId,
            name: backend.name,
            status: response.status === 200 ? 'online' : 'error',
            type: backend.type,
            free: backend.free,
            priority: backend.priority
        };
    } catch (e) {
        return {
            id: backendId,
            name: backend.name,
            status: 'offline',
            error: e.message
        };
    }
}

async function checkAllBackends() {
    const checks = Object.keys(LLM_BACKENDS).map(id => checkBackendHealth(id));
    return Promise.all(checks);
}

// ============================================
// REST API
// ============================================

// Cached backend status (refreshed every 30s in background)
let cachedBackends = [];
let lastBackendCheck = 0;

async function refreshBackendCache() {
    cachedBackends = await checkAllBackends();
    lastBackendCheck = Date.now();
}
setInterval(refreshBackendCache, 30000);

// Health check (instant response from cache)
app.get('/api/health', async (req, res) => {
    // First call or stale cache — refresh inline
    if (cachedBackends.length === 0 || Date.now() - lastBackendCheck > 60000) {
        await refreshBackendCache();
    }
    const online = cachedBackends.filter(b => b.status === 'online').length;

    res.json({
        status: 'ok',
        service: 'Master Mind',
        version: '1.0.0',
        backends: {
            total: cachedBackends.length,
            online,
            offline: cachedBackends.length - online
        },
        stats: {
            totalQueries: stats.totalQueries,
            lastQuery: stats.lastQuery
        },
        usage: usageMetrics.getSummary()
    });
});

// List backends
app.get('/api/backends', async (req, res) => {
    const health = await checkAllBackends();
    res.json(health);
});

// Toggle backend
app.post('/api/backends/:id/toggle', (req, res) => {
    const id = req.params.id;
    if (!LLM_BACKENDS[id]) {
        return res.status(404).json({ error: 'Backend not found' });
    }
    LLM_BACKENDS[id].enabled = !LLM_BACKENDS[id].enabled;
    res.json({ id, enabled: LLM_BACKENDS[id].enabled });
});

// Parallel query - all backends
app.post('/api/query/parallel', async (req, res) => {
    const { prompt, options } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt required' });
    }

    const result = await parallelQuery(prompt, options || {});
    res.json(result);
});

// Smart query - fastest wins
app.post('/api/query/smart', async (req, res) => {
    const { prompt, options } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt required' });
    }

    const result = await smartQuery(prompt, options || {});
    res.json(result);
});

// Query specific backend
app.post('/api/query/:backend', async (req, res) => {
    const { prompt, options } = req.body;
    const backendId = req.params.backend;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt required' });
    }
    if (!LLM_BACKENDS[backendId]) {
        return res.status(404).json({ error: 'Backend not found' });
    }

    const result = await queryBackend(backendId, prompt, options || {});
    res.json(result);
});

// Get stats
app.get('/api/stats', (req, res) => {
    res.json(stats);
});

// Reset stats
app.post('/api/stats/reset', (req, res) => {
    stats = {
        totalQueries: 0,
        queriesByBackend: {},
        avgResponseTime: {},
        lastQuery: null,
        costIncurred: 0
    };
    saveStats();
    res.json({ success: true });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
    console.log(`[Master Mind] Parallel LLM Orchestrator running on port ${PORT}`);
    console.log(`[Master Mind] API: http://localhost:${PORT}/api/health`);

    // Check backend availability
    const health = await checkAllBackends();
    const online = health.filter(b => b.status === 'online');
    console.log(`[Master Mind] Backends: ${online.length}/${health.length} online`);
    health.forEach(b => {
        console.log(`  - ${b.name}: ${b.status}`);
    });
});
