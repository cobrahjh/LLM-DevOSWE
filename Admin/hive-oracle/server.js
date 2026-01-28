/**
 * HIVE ORACLE - Distributed LLM Orchestrator
 *
 * Routes queries to any LLM in the colony with:
 * - Multi-node discovery & health monitoring
 * - Load balancing (least busy node)
 * - Master Mind (parallel queries to all)
 * - Distributed memory sync
 * - Automatic failover
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 8850;
const HIVE_BRAIN_URL = process.env.HIVE_BRAIN_URL || 'http://localhost:8800';
const HIVE_NODE = process.env.HIVE_NODE || os.hostname();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============== COLONY STATE ==============
const colony = {
    nodes: new Map(),        // LLM-capable nodes
    localNode: null,         // This node's info
    memoryBus: {             // Distributed memory
        facts: {},
        lastSync: null
    }
};

// Known LLM endpoints per node type
const LLM_ENDPOINTS = {
    ollama: { port: 11434, health: '/api/tags', generate: '/api/generate', models: '/api/tags' },
    lmstudio: { port: 1234, health: '/v1/models', generate: '/v1/completions', models: '/v1/models' }
};

// ============== NODE DISCOVERY ==============
class NodeDiscovery {
    constructor() {
        this.scanInterval = null;
    }

    async discoverNodes() {
        console.log('[Hive-Oracle] Discovering LLM nodes...');

        // Get devices from Hive Brain
        try {
            const res = await fetch(`${HIVE_BRAIN_URL}/api/colony`);
            if (res.ok) {
                const data = await res.json();
                for (const device of data.devices) {
                    await this.probeNode(device);
                }
            }
        } catch (e) {
            console.log('[Hive-Oracle] Hive Brain not available, using defaults');
        }

        // Always check localhost
        await this.probeNode({ ip: '127.0.0.1', hostname: HIVE_NODE });

        // Check known IPs from hive-network.json
        const knownNodes = [
            { ip: '192.168.1.192', hostname: 'rock-pc' },
            { ip: '192.168.1.97', hostname: 'morpu-pc' },
            { ip: '192.168.1.162', hostname: 'ai-pc' }
        ];

        for (const node of knownNodes) {
            if (!colony.nodes.has(node.ip)) {
                await this.probeNode(node);
            }
        }

        console.log(`[Hive-Oracle] Found ${colony.nodes.size} LLM node(s)`);
    }

    async probeNode(device) {
        const { ip, hostname } = device;

        // Try Ollama
        try {
            const res = await fetch(`http://${ip}:11434/api/tags`, { timeout: 3000 });
            if (res.ok) {
                const data = await res.json();
                const models = data.models?.map(m => m.name) || [];
                colony.nodes.set(ip, {
                    ip,
                    hostname: hostname || ip,
                    type: 'ollama',
                    port: 11434,
                    models,
                    status: 'online',
                    load: 0,
                    lastCheck: Date.now()
                });
                console.log(`[Hive-Oracle] Found Ollama at ${ip} (${models.length} models)`);
                return;
            }
        } catch {}

        // Try LM Studio
        try {
            const res = await fetch(`http://${ip}:1234/v1/models`, { timeout: 3000 });
            if (res.ok) {
                const data = await res.json();
                const models = data.data?.map(m => m.id) || [];
                colony.nodes.set(ip, {
                    ip,
                    hostname: hostname || ip,
                    type: 'lmstudio',
                    port: 1234,
                    models,
                    status: 'online',
                    load: 0,
                    lastCheck: Date.now()
                });
                console.log(`[Hive-Oracle] Found LM Studio at ${ip} (${models.length} models)`);
                return;
            }
        } catch {}

        // Node has no LLM
        if (colony.nodes.has(ip)) {
            colony.nodes.get(ip).status = 'offline';
        }
    }

    startPeriodicScan(interval = 60000) {
        this.scanInterval = setInterval(() => this.discoverNodes(), interval);
    }

    stop() {
        if (this.scanInterval) clearInterval(this.scanInterval);
    }
}

// ============== LOAD BALANCER ==============
class LoadBalancer {
    // Get best node for a query
    getBestNode(preferredModel = null) {
        const onlineNodes = Array.from(colony.nodes.values())
            .filter(n => n.status === 'online');

        if (onlineNodes.length === 0) return null;

        // If model specified, find node with that model
        if (preferredModel) {
            const withModel = onlineNodes.filter(n =>
                n.models.some(m => m.includes(preferredModel) || preferredModel.includes(m))
            );
            if (withModel.length > 0) {
                // Return least loaded node with the model
                return withModel.sort((a, b) => a.load - b.load)[0];
            }
        }

        // Return least loaded node
        return onlineNodes.sort((a, b) => a.load - b.load)[0];
    }

    // Get all online nodes
    getAllNodes() {
        return Array.from(colony.nodes.values()).filter(n => n.status === 'online');
    }

    // Update node load
    incrementLoad(ip) {
        const node = colony.nodes.get(ip);
        if (node) node.load++;
    }

    decrementLoad(ip) {
        const node = colony.nodes.get(ip);
        if (node && node.load > 0) node.load--;
    }
}

// ============== LLM ROUTER ==============
class LLMRouter {
    constructor(loadBalancer) {
        this.lb = loadBalancer;
    }

    async generate(prompt, options = {}) {
        const { model, node: preferredNode, timeout = 60000 } = options;

        // Select node
        let node;
        if (preferredNode) {
            node = colony.nodes.get(preferredNode);
        } else {
            node = this.lb.getBestNode(model);
        }

        if (!node) {
            throw new Error('No LLM nodes available');
        }

        this.lb.incrementLoad(node.ip);
        const startTime = Date.now();

        try {
            let response;
            const useModel = model || node.models[0] || 'qwen2.5-coder:7b';

            if (node.type === 'ollama') {
                response = await this.generateOllama(node, prompt, useModel, timeout);
            } else if (node.type === 'lmstudio') {
                response = await this.generateLMStudio(node, prompt, useModel, timeout);
            }

            const elapsed = Date.now() - startTime;

            return {
                response,
                node: node.hostname,
                ip: node.ip,
                model: useModel,
                elapsed,
                tokensPerSec: response.length / (elapsed / 1000) // rough estimate
            };
        } finally {
            this.lb.decrementLoad(node.ip);
        }
    }

    async generateOllama(node, prompt, model, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(`http://${node.ip}:${node.port}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt, stream: false }),
                signal: controller.signal
            });

            if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
            const data = await res.json();
            return data.response || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async generateLMStudio(node, prompt, model, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(`http://${node.ip}:${node.port}/v1/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt, max_tokens: 2000 }),
                signal: controller.signal
            });

            if (!res.ok) throw new Error(`LM Studio error: ${res.status}`);
            const data = await res.json();
            return data.choices?.[0]?.text || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Master Mind: Query ALL nodes in parallel
    async masterMind(prompt, options = {}) {
        const { timeout = 60000, includeOffline = false } = options;
        const nodes = this.lb.getAllNodes();

        if (nodes.length === 0) {
            throw new Error('No LLM nodes available');
        }

        console.log(`[Master Mind] Querying ${nodes.length} nodes in parallel...`);

        const promises = nodes.map(async (node) => {
            const startTime = Date.now();
            try {
                const model = node.models[0] || 'default';
                let response;

                if (node.type === 'ollama') {
                    response = await this.generateOllama(node, prompt, model, timeout);
                } else if (node.type === 'lmstudio') {
                    response = await this.generateLMStudio(node, prompt, model, timeout);
                }

                return {
                    node: node.hostname,
                    ip: node.ip,
                    model,
                    response,
                    elapsed: Date.now() - startTime,
                    status: 'success'
                };
            } catch (e) {
                return {
                    node: node.hostname,
                    ip: node.ip,
                    error: e.message,
                    elapsed: Date.now() - startTime,
                    status: 'error'
                };
            }
        });

        const results = await Promise.all(promises);
        const successful = results.filter(r => r.status === 'success');

        return {
            query: prompt,
            totalNodes: nodes.length,
            successful: successful.length,
            results,
            // Synthesize best response (longest non-error for now)
            bestResponse: successful.sort((a, b) => b.response.length - a.response.length)[0]
        };
    }
}

// ============== DISTRIBUTED MEMORY ==============
class DistributedMemory {
    constructor() {
        this.facts = {};
        this.syncInterval = null;
    }

    setFact(key, value, source = HIVE_NODE) {
        this.facts[key] = {
            value,
            source,
            updated: Date.now()
        };
        this.broadcastFact(key, this.facts[key]);
        return this.facts[key];
    }

    getFact(key) {
        return this.facts[key]?.value;
    }

    getAllFacts() {
        return this.facts;
    }

    deleteFact(key) {
        delete this.facts[key];
    }

    // Broadcast fact to other nodes
    async broadcastFact(key, fact) {
        // Broadcast via WebSocket to connected clients
        broadcastWs({ type: 'fact_update', key, fact });
    }

    // Sync with another node
    async syncWith(nodeIp) {
        // Future: sync facts with other Hive Oracle instances
    }

    startPeriodicSync(interval = 30000) {
        this.syncInterval = setInterval(() => {
            // Sync with other nodes
            colony.memoryBus.lastSync = Date.now();
        }, interval);
    }

    stop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
    }
}

// ============== INSTANCES ==============
const discovery = new NodeDiscovery();
const loadBalancer = new LoadBalancer();
const router = new LLMRouter(loadBalancer);
const memory = new DistributedMemory();

// ============== API ROUTES ==============

// Health check
app.get('/api/health', (req, res) => {
    const nodes = Array.from(colony.nodes.values());
    res.json({
        service: 'hive-oracle',
        node: HIVE_NODE,
        status: 'ok',
        colony: {
            nodes: nodes.length,
            online: nodes.filter(n => n.status === 'online').length,
            totalModels: nodes.reduce((sum, n) => sum + n.models.length, 0)
        },
        timestamp: new Date().toISOString()
    });
});

// List all LLM nodes
app.get('/api/nodes', (req, res) => {
    res.json(Array.from(colony.nodes.values()));
});

// Get specific node info
app.get('/api/nodes/:ip', (req, res) => {
    const node = colony.nodes.get(req.params.ip);
    if (!node) {
        return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
});

// Refresh node discovery
app.post('/api/nodes/discover', async (req, res) => {
    await discovery.discoverNodes();
    res.json({
        nodes: Array.from(colony.nodes.values()),
        count: colony.nodes.size
    });
});

// List all available models across colony
app.get('/api/models', (req, res) => {
    const models = [];
    for (const node of colony.nodes.values()) {
        if (node.status === 'online') {
            for (const model of node.models) {
                models.push({
                    name: model,
                    node: node.hostname,
                    ip: node.ip,
                    type: node.type
                });
            }
        }
    }
    res.json(models);
});

// Generate (single node)
app.post('/api/generate', async (req, res) => {
    const { prompt, model, node, timeout } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt required' });
    }

    try {
        const result = await router.generate(prompt, { model, node, timeout });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Chat (alias for generate)
app.post('/api/chat', async (req, res) => {
    const { prompt, message, model, node } = req.body;
    const text = prompt || message;

    if (!text) {
        return res.status(400).json({ error: 'prompt or message required' });
    }

    try {
        const result = await router.generate(text, { model, node });
        res.json({
            response: result.response,
            model: result.model,
            node: result.node,
            elapsed: result.elapsed
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Master Mind (parallel query all nodes)
app.post('/api/master-mind', async (req, res) => {
    const { prompt, timeout } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt required' });
    }

    try {
        const result = await router.masterMind(prompt, { timeout });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Consult specific models
app.post('/api/consult', async (req, res) => {
    const { prompt, models } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt required' });
    }

    const targetModels = models || ['qwen2.5-coder:7b', 'kitt:latest'];
    const results = [];

    for (const model of targetModels) {
        try {
            const result = await router.generate(prompt, { model });
            results.push({ model, ...result, status: 'success' });
        } catch (e) {
            results.push({ model, error: e.message, status: 'error' });
        }
    }

    res.json({ prompt, results });
});

// === Memory API ===

app.get('/api/memory/facts', (req, res) => {
    res.json(memory.getAllFacts());
});

app.get('/api/memory/facts/:key', (req, res) => {
    const value = memory.getFact(req.params.key);
    if (value !== undefined) {
        res.json({ key: req.params.key, value });
    } else {
        res.status(404).json({ error: 'Fact not found' });
    }
});

app.post('/api/memory/facts', (req, res) => {
    const { key, value, source } = req.body;
    if (!key || value === undefined) {
        return res.status(400).json({ error: 'key and value required' });
    }
    const fact = memory.setFact(key, value, source);
    res.json({ key, ...fact });
});

app.delete('/api/memory/facts/:key', (req, res) => {
    memory.deleteFact(req.params.key);
    res.json({ deleted: req.params.key });
});

// === WebSocket ===
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Hive-Oracle] Client connected (${clients.size} total)`);

    // Send current state
    ws.send(JSON.stringify({
        type: 'init',
        nodes: Array.from(colony.nodes.values()),
        facts: memory.getAllFacts()
    }));

    ws.on('close', () => {
        clients.delete(ws);
    });

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'generate') {
                const result = await router.generate(msg.prompt, msg);
                ws.send(JSON.stringify({ type: 'response', ...result }));
            } else if (msg.type === 'master_mind') {
                const result = await router.masterMind(msg.prompt, msg);
                ws.send(JSON.stringify({ type: 'master_mind_response', ...result }));
            }
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', error: e.message }));
        }
    });
});

function broadcastWs(data) {
    const json = JSON.stringify(data);
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(json);
        }
    });
}

// ============== START ==============
server.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║           HIVE ORACLE                        ║');
    console.log('║   Distributed LLM Orchestrator               ║');
    console.log('║   http://localhost:' + PORT + '                       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    // Initial discovery
    await discovery.discoverNodes();

    // Start periodic scans
    discovery.startPeriodicScan(60000); // Every 60 seconds
    memory.startPeriodicSync(30000);    // Every 30 seconds

    console.log('');
    console.log('[Hive-Oracle] Ready for queries');
    console.log('  POST /api/generate     - Query best available LLM');
    console.log('  POST /api/master-mind  - Query ALL LLMs in parallel');
    console.log('  GET  /api/nodes        - List LLM nodes');
    console.log('  GET  /api/models       - List all models');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Hive-Oracle] Shutting down...');
    discovery.stop();
    memory.stop();
    process.exit(0);
});

module.exports = { router, discovery, loadBalancer, memory };
