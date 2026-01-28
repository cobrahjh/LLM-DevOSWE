/**
 * VoiceAccess - Centralized Voice Access Management
 * Port: 8875
 *
 * Unified admin layer for the Hive voice ecosystem:
 * - Persona management
 * - Voice command routing & history
 * - Macro system
 * - Cross-service coordination
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8875;
const RELAY_URL = process.env.RELAY_URL || 'http://localhost:8600';
const ORACLE_URL = process.env.ORACLE_URL || 'http://localhost:8850';
const VOICE_URL = process.env.VOICE_URL || 'http://localhost:8870';
const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8585';

const DATA_FILE = path.join(__dirname, 'voiceaccess-data.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============== DATA STORE ==============

const defaults = {
    settings: {
        wakeWord: 'hey kitt',
        defaultPersona: 'heather',
        defaultTarget: 'claude',
        tts: { voice: 'Google UK English Female', rate: 0.9, pitch: 1.0, volume: 1.0 },
        autoSpeak: true,
        commandTimeout: 60000
    },
    personas: {
        heather: {
            id: 'heather',
            name: 'Heather',
            role: 'Team Lead / PM',
            voice: 'Google UK English Female',
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0,
            enabled: true,
            idleChatInterval: 300000,
            idleChatChance: 0.5,
            cooldown: 30000,
            greeting: 'Hey! Heather here. How\'s it going?',
            personality: 'Quick-witted, funny, professional, supportive'
        },
        shiZhenXiang: {
            id: 'shiZhenXiang',
            name: 'Shǐ zhēn xiāng (史真香)',
            role: 'Programmer',
            voice: 'Google 粵語（香港）',
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            enabled: true,
            idleChatInterval: 900000,
            idleChatChance: 0.3,
            cooldown: 30000,
            greeting: 'Oh! Hi boss! I was just... definitely not breaking anything.',
            personality: 'Self-deprecating, wonders why she is a bad programmer, supportive'
        },
        kitt: {
            id: 'kitt',
            name: 'Kitt',
            role: 'Local AI Agent',
            voice: 'Microsoft David',
            rate: 1.0,
            pitch: 0.9,
            volume: 1.0,
            enabled: true,
            idleChatInterval: 0,
            idleChatChance: 0,
            cooldown: 5000,
            greeting: 'Kitt online. Ready for commands.',
            personality: 'Efficient, concise, technical'
        }
    },
    macros: [],
    history: []
};

let store = { ...defaults };

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const saved = JSON.parse(raw);
            store = {
                settings: { ...defaults.settings, ...saved.settings },
                personas: { ...defaults.personas, ...saved.personas },
                macros: saved.macros || [],
                history: saved.history || []
            };
            console.log('[VoiceAccess] Loaded saved data');
        }
    } catch (e) {
        console.log('[VoiceAccess] Using defaults:', e.message);
    }
}

function saveData() {
    try {
        const toSave = {
            settings: store.settings,
            personas: store.personas,
            macros: store.macros,
            history: store.history.slice(-500)
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2));
    } catch (e) {
        console.error('[VoiceAccess] Save failed:', e.message);
    }
}

// ============== INTENT MATCHING ==============

const INTENTS = [
    { pattern: /^(status|health|check|how.?s it going)/i, action: 'status', target: 'orchestrator', tier: 0 },
    { pattern: /^(list|show|what).*(services?|running)/i, action: 'list_services', target: 'orchestrator', tier: 0 },
    { pattern: /^(restart|reboot)\s+(.+)/i, action: 'restart_service', target: 'orchestrator', tier: 1 },
    { pattern: /^(query|ask|generate|prompt)\s+(.+)/i, action: 'llm_query', target: 'oracle', tier: 1 },
    { pattern: /^(search|find|look for)\s+(.+)/i, action: 'search', target: 'agent', tier: 1 },
    { pattern: /^(deploy|push|ship)/i, action: 'deploy', target: 'agent', tier: 2 },
    { pattern: /^(commit|save|checkpoint)/i, action: 'commit', target: 'agent', tier: 1 },
    { pattern: /^(open|launch|start)\s+(.+)/i, action: 'open', target: 'system', tier: 0 },
    { pattern: /^(say|speak|tell)\s+(.+)/i, action: 'speak', target: 'tts', tier: 0 },
    { pattern: /^(macro|shortcut)\s+(.+)/i, action: 'macro', target: 'self', tier: 0 },
    { pattern: /^(help|commands|what can you do)/i, action: 'help', target: 'self', tier: 0 },
    { pattern: /^(switch|change).*(persona|voice)\s*(?:to\s+)?(.+)?/i, action: 'switch_persona', target: 'self', tier: 0 },
    { pattern: /^(mute|unmute|quiet|silence)/i, action: 'toggle_mute', target: 'self', tier: 0 },
    { pattern: /^(hey kitt|hey hive|wake up)/i, action: 'wake', target: 'self', tier: 0 },
];

function parseCommand(text) {
    const trimmed = text.trim();

    // Check macros first
    const macro = store.macros.find(m =>
        m.enabled && trimmed.toLowerCase().includes(m.trigger.toLowerCase())
    );
    if (macro) {
        return { matched: true, type: 'macro', macro, text: trimmed };
    }

    // Match intents
    for (const intent of INTENTS) {
        const match = trimmed.match(intent.pattern);
        if (match) {
            return {
                matched: true,
                type: 'intent',
                action: intent.action,
                target: intent.target,
                tier: intent.tier,
                groups: match.slice(1),
                text: trimmed
            };
        }
    }

    // No match — route to default target
    return {
        matched: false,
        type: 'passthrough',
        target: store.settings.defaultTarget,
        text: trimmed
    };
}

// ============== COMMAND EXECUTION ==============

async function executeCommand(parsed) {
    const result = { success: true, action: parsed.action || parsed.type, response: '' };

    try {
        switch (parsed.type) {
            case 'macro':
                result.response = `Executing macro: ${parsed.macro.name}`;
                result.macroAction = parsed.macro.action;
                // Execute macro action based on type
                if (parsed.macro.action.startsWith('http')) {
                    const res = await fetch(parsed.macro.action, { method: 'POST', timeout: 10000 });
                    result.response = `Macro "${parsed.macro.name}" executed (${res.status})`;
                }
                break;

            case 'intent':
                switch (parsed.action) {
                    case 'status':
                        try {
                            const res = await fetch('http://localhost:8500/api/status', { signal: AbortSignal.timeout(5000) });
                            const data = await res.json();
                            const services = Object.values(data.services);
                            const healthy = services.filter(s => s.healthy).length;
                            result.response = `${healthy} of ${services.length} services healthy.`;
                            result.data = data;
                        } catch {
                            result.response = 'Could not reach Orchestrator.';
                            result.success = false;
                        }
                        break;

                    case 'list_services':
                        try {
                            const res = await fetch('http://localhost:8500/api/status', { signal: AbortSignal.timeout(5000) });
                            const data = await res.json();
                            const list = Object.values(data.services)
                                .map(s => `${s.name}: ${s.healthy ? 'healthy' : 'DOWN'}`)
                                .join(', ');
                            result.response = list;
                        } catch {
                            result.response = 'Orchestrator unavailable.';
                            result.success = false;
                        }
                        break;

                    case 'restart_service':
                        const svcName = parsed.groups[1]?.trim().toLowerCase();
                        try {
                            const res = await fetch(`http://localhost:8500/api/services/${svcName}/restart`, {
                                method: 'POST',
                                signal: AbortSignal.timeout(15000)
                            });
                            const data = await res.json();
                            result.response = data.start?.success
                                ? `Restarted ${svcName} (PID ${data.start.pid})`
                                : `Failed to restart ${svcName}`;
                        } catch (e) {
                            result.response = `Restart failed: ${e.message}`;
                            result.success = false;
                        }
                        break;

                    case 'llm_query':
                        const prompt = parsed.groups[1]?.trim();
                        try {
                            const res = await fetch(`${ORACLE_URL}/api/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt }),
                                signal: AbortSignal.timeout(60000)
                            });
                            const data = await res.json();
                            result.response = data.response || data.error || 'No response';
                            result.model = data.model;
                            result.node = data.node;
                        } catch (e) {
                            result.response = `LLM query failed: ${e.message}`;
                            result.success = false;
                        }
                        break;

                    case 'speak':
                        const speakText = parsed.groups[1]?.trim();
                        broadcastWs({ type: 'speak', text: speakText, persona: store.settings.defaultPersona });
                        result.response = `Speaking: "${speakText}"`;
                        break;

                    case 'switch_persona':
                        const personaName = parsed.groups[2]?.trim().toLowerCase();
                        const found = Object.values(store.personas).find(p =>
                            p.name.toLowerCase().includes(personaName) || p.id.toLowerCase() === personaName
                        );
                        if (found) {
                            store.settings.defaultPersona = found.id;
                            saveData();
                            result.response = `Switched to ${found.name}`;
                            broadcastWs({ type: 'persona_changed', persona: found });
                        } else {
                            result.response = `Persona "${personaName}" not found`;
                            result.success = false;
                        }
                        break;

                    case 'toggle_mute':
                        broadcastWs({ type: 'toggle_mute' });
                        result.response = 'Voice toggled';
                        break;

                    case 'help':
                        result.response = 'Available: status, list services, restart [name], query [prompt], say [text], switch persona [name], macro [name], mute/unmute';
                        break;

                    case 'wake':
                        result.response = store.personas[store.settings.defaultPersona]?.greeting || 'Listening.';
                        break;

                    default:
                        result.response = `Action "${parsed.action}" recognized but not implemented`;
                }
                break;

            case 'passthrough':
                // Send to relay as a task
                try {
                    await fetch(`${RELAY_URL}/api/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: parsed.text,
                            source: 'voiceaccess',
                            priority: 'normal'
                        }),
                        signal: AbortSignal.timeout(5000)
                    });
                    result.response = `Sent to ${parsed.target}: "${parsed.text}"`;
                } catch {
                    result.response = 'Failed to route command';
                    result.success = false;
                }
                break;
        }
    } catch (e) {
        result.success = false;
        result.response = `Error: ${e.message}`;
    }

    return result;
}

// ============== VOICE SERVICE STATUS ==============

async function getVoiceServices() {
    const services = [
        { id: 'voiceaccess', name: 'VoiceAccess', port: PORT, url: `http://localhost:${PORT}` },
        { id: 'hive-voice', name: 'Hive Voice Control', port: 8870, url: VOICE_URL },
        { id: 'relay', name: 'Relay (Logs)', port: 8600, url: RELAY_URL },
        { id: 'oracle', name: 'Hive Oracle (LLM)', port: 8850, url: ORACLE_URL },
        { id: 'agent', name: 'KittBox (Personas)', port: 8585, url: AGENT_URL }
    ];

    const results = await Promise.all(services.map(async (svc) => {
        try {
            const res = await fetch(`${svc.url}/api/health`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            return { ...svc, status: 'online', health: data };
        } catch {
            return { ...svc, status: 'offline', health: null };
        }
    }));

    return results;
}

// ============== API ROUTES ==============

// Health
app.get('/api/health', (req, res) => {
    res.json({
        service: 'voiceaccess',
        status: 'ok',
        version: '1.0.0',
        clients: clients.size,
        activePersona: store.settings.defaultPersona,
        macros: store.macros.length,
        historySize: store.history.length,
        timestamp: new Date().toISOString()
    });
});

// Process voice command
app.post('/api/command', async (req, res) => {
    const { text, persona, source } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const parsed = parseCommand(text);
    const result = await executeCommand(parsed);

    // Log to history
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        text,
        parsed: { type: parsed.type, action: parsed.action, target: parsed.target, tier: parsed.tier },
        result: { success: result.success, response: result.response },
        persona: persona || store.settings.defaultPersona,
        source: source || 'api',
        timestamp: new Date().toISOString()
    };
    store.history.push(entry);
    if (store.history.length > 500) store.history = store.history.slice(-500);
    saveData();

    // Broadcast to connected clients
    broadcastWs({ type: 'command', entry });

    res.json({ ...result, parsed, entry });
});

// Personas
app.get('/api/personas', (req, res) => {
    res.json(Object.values(store.personas));
});

app.get('/api/personas/:id', (req, res) => {
    const persona = store.personas[req.params.id];
    if (!persona) return res.status(404).json({ error: 'Persona not found' });
    res.json(persona);
});

app.put('/api/personas/:id', (req, res) => {
    if (!store.personas[req.params.id]) {
        return res.status(404).json({ error: 'Persona not found' });
    }
    store.personas[req.params.id] = { ...store.personas[req.params.id], ...req.body, id: req.params.id };
    saveData();
    broadcastWs({ type: 'persona_updated', persona: store.personas[req.params.id] });
    res.json(store.personas[req.params.id]);
});

// Macros
app.get('/api/macros', (req, res) => {
    res.json(store.macros);
});

app.post('/api/macros', (req, res) => {
    const { trigger, action, name, description } = req.body;
    if (!trigger || !action) return res.status(400).json({ error: 'trigger and action required' });

    const macro = {
        id: Date.now().toString(36),
        trigger,
        action,
        name: name || trigger,
        description: description || '',
        enabled: true,
        created: new Date().toISOString(),
        uses: 0
    };
    store.macros.push(macro);
    saveData();
    res.json(macro);
});

app.put('/api/macros/:id', (req, res) => {
    const idx = store.macros.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Macro not found' });
    store.macros[idx] = { ...store.macros[idx], ...req.body, id: req.params.id };
    saveData();
    res.json(store.macros[idx]);
});

app.delete('/api/macros/:id', (req, res) => {
    store.macros = store.macros.filter(m => m.id !== req.params.id);
    saveData();
    res.json({ deleted: req.params.id });
});

// History
app.get('/api/history', (req, res) => {
    let results = [...store.history];
    const { persona, action, source, limit, since } = req.query;

    if (persona) results = results.filter(h => h.persona === persona);
    if (action) results = results.filter(h => h.parsed?.action === action);
    if (source) results = results.filter(h => h.source === source);
    if (since) results = results.filter(h => h.timestamp >= since);

    results.reverse(); // newest first
    if (limit) results = results.slice(0, parseInt(limit));

    res.json(results);
});

app.get('/api/history/stats', (req, res) => {
    const history = store.history;
    const last24h = history.filter(h => new Date(h.timestamp) > new Date(Date.now() - 86400000));

    // Action frequency
    const actions = {};
    last24h.forEach(h => {
        const action = h.parsed?.action || 'passthrough';
        actions[action] = (actions[action] || 0) + 1;
    });

    // Persona usage
    const personas = {};
    last24h.forEach(h => {
        personas[h.persona] = (personas[h.persona] || 0) + 1;
    });

    // Hourly distribution
    const hourly = new Array(24).fill(0);
    last24h.forEach(h => {
        const hour = new Date(h.timestamp).getHours();
        hourly[hour]++;
    });

    // Success rate
    const successful = last24h.filter(h => h.result?.success).length;

    res.json({
        total: history.length,
        last24h: last24h.length,
        successRate: last24h.length ? (successful / last24h.length * 100).toFixed(1) : 0,
        actions,
        personas,
        hourly,
        topCommands: Object.entries(actions).sort((a, b) => b[1] - a[1]).slice(0, 10)
    });
});

app.delete('/api/history', (req, res) => {
    store.history = [];
    saveData();
    res.json({ cleared: true });
});

// Settings
app.get('/api/settings', (req, res) => {
    res.json(store.settings);
});

app.put('/api/settings', (req, res) => {
    store.settings = { ...store.settings, ...req.body };
    saveData();
    broadcastWs({ type: 'settings_updated', settings: store.settings });
    res.json(store.settings);
});

// Speak (broadcast TTS to clients)
app.post('/api/speak', (req, res) => {
    const { text, persona, voice, rate, pitch, volume } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const p = store.personas[persona || store.settings.defaultPersona] || {};
    const msg = {
        type: 'speak',
        text,
        persona: persona || store.settings.defaultPersona,
        voice: voice || p.voice || store.settings.tts.voice,
        rate: rate || p.rate || store.settings.tts.rate,
        pitch: pitch || p.pitch || store.settings.tts.pitch,
        volume: volume || p.volume || store.settings.tts.volume
    };
    broadcastWs(msg);
    res.json({ sent: true, clients: clients.size, message: msg });
});

// Voice services status
app.get('/api/services', async (req, res) => {
    const services = await getVoiceServices();
    res.json(services);
});

// Relay conversation logs proxy
app.get('/api/conversation-logs/:persona', async (req, res) => {
    try {
        const r = await fetch(`${RELAY_URL}/api/conversation-logs/${req.params.persona}`, { signal: AbortSignal.timeout(5000) });
        const data = await r.json();
        res.json(data);
    } catch {
        res.json([]);
    }
});

// ============== WEBSOCKET ==============

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[VoiceAccess] Client connected (${clients.size} total)`);

    // Send initial state
    ws.send(JSON.stringify({
        type: 'init',
        settings: store.settings,
        personas: Object.values(store.personas),
        macros: store.macros,
        recentHistory: store.history.slice(-20).reverse()
    }));

    ws.on('message', async (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'command') {
                const parsed = parseCommand(msg.text);
                const result = await executeCommand(parsed);
                ws.send(JSON.stringify({ type: 'command_result', parsed, result }));
            } else if (msg.type === 'speak') {
                broadcastWs({ type: 'speak', text: msg.text, persona: msg.persona || store.settings.defaultPersona });
            }
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', error: e.message }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
    });
});

function broadcastWs(data) {
    const json = JSON.stringify(data);
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
    });
}

// ============== START ==============

loadData();

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║           VOICE ACCESS                        ║');
    console.log('║   Centralized Voice Management                ║');
    console.log(`║   http://localhost:${PORT}                      ║`);
    console.log(`║   http://192.168.1.192:${PORT}                  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log(`[VoiceAccess] ${Object.keys(store.personas).length} personas, ${store.macros.length} macros loaded`);
    console.log('[VoiceAccess] Ready for voice commands');
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\n[VoiceAccess] Shutting down...');
    saveData();
    process.exit(0);
});
