/**
 * AI Pilot API Routes
 * Server-side API for the AI Autopilot pane.
 * Pattern follows copilot-api.js: exports setupAiPilotRoutes(app, getFlightData)
 */

const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Load copilot config (reuses same license/API key)
function getCopilotConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            return config.copilot || {};
        }
    } catch (e) {
        console.error('[AI-Pilot] Config load error:', e.message);
    }
    return {};
}

// AI Pilot system prompt — specialized for autopilot advisory
function buildAiPilotPrompt(flightData) {
    const fd = flightData || {};
    return `You are an AI flight advisor for a Cessna 172 in Microsoft Flight Simulator.
You provide concise, actionable autopilot recommendations.
Keep responses to 2-3 sentences maximum.
When recommending AP changes, prefix with "RECOMMEND:" on its own line.

CURRENT FLIGHT STATE:
- Altitude: ${Math.round(fd.altitude || 0)} ft MSL, ${Math.round(fd.altitudeAGL || 0)} ft AGL
- Speed: ${Math.round(fd.speed || 0)} KIAS, GS ${Math.round(fd.groundSpeed || 0)} kt
- Heading: ${Math.round(fd.heading || 0)}°, Track ${Math.round(fd.groundTrack || 0)}°
- VS: ${Math.round(fd.verticalSpeed || 0)} fpm
- On Ground: ${fd.onGround ? 'Yes' : 'No'}
- AP Master: ${fd.apMaster ? 'ON' : 'OFF'}
- AP HDG: ${fd.apHdgLock ? Math.round(fd.apHdgSet || 0) + '°' : 'OFF'}
- AP ALT: ${fd.apAltLock ? Math.round(fd.apAltSet || 0) + ' ft' : 'OFF'}
- AP VS: ${fd.apVsLock ? Math.round(fd.apVsSet || 0) + ' fpm' : 'OFF'}
- Wind: ${Math.round(fd.windDirection || 0)}°/${Math.round(fd.windSpeed || 0)} kt
- Fuel: ${Math.round(fd.fuelTotal || 0)} gal, Flow: ${(fd.fuelFlow || 0).toFixed(1)} gph
- Gear: ${fd.gearDown ? 'DOWN' : 'UP'}, Flaps: ${fd.flapsIndex || 0}`;
}

function setupAiPilotRoutes(app, getFlightData, getSimConnect, eventMap) {

    // Map API command names to actual SimConnect event names
    // (API uses short names, SimConnect uses _ENGLISH suffix for value-set events)
    const COMMAND_TO_EVENT = {
        'AP_MASTER': 'AP_MASTER',
        'TOGGLE_FLIGHT_DIRECTOR': 'TOGGLE_FLIGHT_DIRECTOR',
        'YAW_DAMPER_TOGGLE': 'YAW_DAMPER_TOGGLE',
        'AP_HDG_HOLD': 'AP_HDG_HOLD',
        'AP_ALT_HOLD': 'AP_ALT_HOLD',
        'AP_VS_HOLD': 'AP_VS_HOLD',
        'AP_AIRSPEED_HOLD': 'AP_PANEL_SPEED_HOLD',
        'AP_NAV1_HOLD': 'AP_NAV1_HOLD',
        'AP_APR_HOLD': 'AP_APR_HOLD',
        'AP_BC_HOLD': 'AP_BC_HOLD',
        'HEADING_BUG_INC': 'HEADING_BUG_INC',
        'HEADING_BUG_DEC': 'HEADING_BUG_DEC',
        'HEADING_BUG_SET': 'HEADING_BUG_SET',
        'AP_ALT_VAR_INC': 'AP_ALT_VAR_INC',
        'AP_ALT_VAR_DEC': 'AP_ALT_VAR_DEC',
        'AP_ALT_VAR_SET': 'AP_ALT_VAR_SET_ENGLISH',
        'AP_VS_VAR_INC': 'AP_VS_VAR_INC',
        'AP_VS_VAR_DEC': 'AP_VS_VAR_DEC',
        'AP_VS_VAR_SET': 'AP_VS_VAR_SET_ENGLISH',
        'AP_SPD_VAR_INC': 'AP_SPD_VAR_INC',
        'AP_SPD_VAR_DEC': 'AP_SPD_VAR_DEC',
        'AP_SPD_VAR_SET': 'AP_SPD_VAR_SET'
    };

    // Status endpoint
    app.get('/api/ai-pilot/status', (req, res) => {
        const fd = getFlightData();
        const cfg = getCopilotConfig();
        const sc = getSimConnect ? getSimConnect() : null;
        res.json({
            hasLlm: !!(cfg.licenseKey),
            simConnected: !!sc,
            phase: 'UNKNOWN',  // phase is tracked client-side
            flightData: {
                altitude: Math.round(fd.altitude || 0),
                speed: Math.round(fd.speed || 0),
                heading: Math.round(fd.heading || 0),
                vs: Math.round(fd.verticalSpeed || 0),
                onGround: fd.onGround || false,
                apMaster: fd.apMaster || false
            }
        });
    });

    // Command execution — validates, then fires SimConnect event directly
    app.post('/api/ai-pilot/command', express_json_guard, (req, res) => {
        const { command, value } = req.body;

        if (!command || !COMMAND_TO_EVENT[command]) {
            return res.status(400).json({ error: 'Invalid command: ' + command });
        }

        // Safety limits for value commands
        if (command.includes('_SET') && value !== undefined) {
            if (command.includes('ALT') && (value < 0 || value > 45000)) {
                return res.status(400).json({ error: 'Altitude out of range (0-45000)' });
            }
            if (command.includes('VS') && (value < -6000 || value > 6000)) {
                return res.status(400).json({ error: 'VS out of range (-6000 to 6000)' });
            }
            if (command.includes('SPD') && (value < 40 || value > 500)) {
                return res.status(400).json({ error: 'Speed out of range (40-500)' });
            }
            if (command === 'HEADING_BUG_SET' && (value < 0 || value > 360)) {
                return res.status(400).json({ error: 'Heading out of range (0-360)' });
            }
        }

        // Resolve the actual SimConnect event name
        const simEventName = COMMAND_TO_EVENT[command];
        const sc = getSimConnect ? getSimConnect() : null;
        const simValue = Math.round(value || 0);

        if (!sc || !eventMap || eventMap[simEventName] === undefined) {
            // SimConnect not available — command is valid but can't execute
            console.log(`[AI-Pilot] ${command} validated (SimConnect not connected)`);
            return res.json({ success: true, command, simEvent: simEventName, value: simValue, executed: false });
        }

        const eventId = eventMap[simEventName];

        try {
            sc.transmitClientEvent(0, eventId, simValue, 1, 16);
            console.log(`[AI-Pilot] ${command} → ${simEventName} (eventId: ${eventId}, value: ${simValue})`);
            res.json({ success: true, command, simEvent: simEventName, value: simValue, executed: true });
        } catch (e) {
            console.error(`[AI-Pilot] SimConnect error: ${e.message}`);
            res.status(500).json({ error: 'SimConnect transmit failed: ' + e.message });
        }
    });

    // Advisory endpoint — proxies to copilot chat with AI pilot system prompt
    app.post('/api/ai-pilot/advisory', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        // Reuse copilot license validation
        let validateKey;
        try {
            validateKey = require('./copilot-license').validateKey;
        } catch (e) {
            return res.status(500).json({ error: 'License module not available' });
        }

        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'Valid copilot license required for AI advisory' });
        }

        const provider = cfg.provider || 'openai';
        const isLocal = provider === 'ollama' || provider === 'lmstudio';

        const apiKey = isLocal ? 'not-needed' : decryptApiKey(cfg);
        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured' });
        }

        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        const flightData = getFlightData();
        const systemPrompt = buildAiPilotPrompt(flightData);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message.slice(0, 2000) }
        ];

        const model = cfg.model || getDefaultModel(provider);
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 60000);

        try {
            if (provider === 'anthropic') {
                await proxyAnthropic(apiKey, model, messages, res, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider);
                await proxyOpenAI(apiKey, model, messages, res, abortController, baseUrl);
            }
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (!res.headersSent) {
                res.status(502).json({ error: err.message });
            }
        }
    });

    // Auto-advise endpoint — asks AI, parses commands, executes them in one call
    app.post('/api/ai-pilot/auto-advise', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        let validateKey;
        try {
            validateKey = require('./copilot-license').validateKey;
        } catch (e) {
            return res.status(500).json({ error: 'License module not available' });
        }

        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'Valid license required' });
        }

        const provider = cfg.provider || 'openai';
        const isLocal = provider === 'ollama' || provider === 'lmstudio';

        const apiKey = isLocal ? 'not-needed' : decryptApiKey(cfg);
        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured' });
        }

        const { message } = req.body;
        const flightData = getFlightData();
        const fd = flightData || {};

        const systemPrompt = buildAiPilotPrompt(flightData) + `\n
IMPORTANT: After your brief advice, output a JSON block with the exact AP commands to execute.
Use this exact format on its own line:
COMMANDS_JSON: [{"command":"COMMAND_NAME","value":NUMBER}, ...]

Valid commands and value ranges:
- HEADING_BUG_SET (0-360)
- AP_ALT_VAR_SET (0-45000, altitude in feet)
- AP_VS_VAR_SET (-6000 to 6000, fpm)
- AP_SPD_VAR_SET (40-500, knots)
- AP_HDG_HOLD (no value, toggles heading hold)
- AP_ALT_HOLD (no value, toggles altitude hold)
- AP_VS_HOLD (no value, toggles VS hold)
- AP_MASTER (no value, toggles AP master)

For toggle commands, omit the value field. Only include commands that need to CHANGE from current state.`;

        const userMsg = message || `Current phase of flight: altitude ${Math.round(fd.altitude||0)}ft, speed ${Math.round(fd.speed||0)}kt, heading ${Math.round(fd.heading||0)}. Recommend optimal AP settings.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg.slice(0, 2000) }
        ];

        const model = cfg.model || getDefaultModel(provider);
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 60000);

        try {
            // Get non-streaming response for parsing
            let fullText = '';
            if (provider === 'anthropic') {
                fullText = await fetchAnthropic(apiKey, model, messages, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider);
                fullText = await fetchOpenAI(apiKey, model, messages, abortController, baseUrl);
            }
            clearTimeout(timeoutId);

            // Parse commands from response
            const commands = parseCommandsFromText(fullText);
            const executed = [];
            const sc = getSimConnect ? getSimConnect() : null;

            for (const cmd of commands) {
                if (!COMMAND_TO_EVENT[cmd.command]) continue;
                const simEventName = COMMAND_TO_EVENT[cmd.command];
                const simValue = Math.round(cmd.value || 0);

                if (sc && eventMap && eventMap[simEventName] !== undefined) {
                    try {
                        sc.transmitClientEvent(0, eventMap[simEventName], simValue, 1, 16);
                        executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: true });
                        console.log(`[AI-Pilot Auto] ${cmd.command} → ${simEventName} = ${simValue}`);
                    } catch (e) {
                        executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: false, error: e.message });
                    }
                } else {
                    executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: false });
                }
            }

            res.json({
                success: true,
                advisory: fullText,
                commands: executed,
                simConnected: !!sc
            });

        } catch (err) {
            clearTimeout(timeoutId);
            res.status(502).json({ error: err.message });
        }
    });

    // Aircraft profiles endpoint
    app.get('/api/ai-pilot/profiles', (req, res) => {
        // Return available profile names (actual data is client-side)
        res.json({
            profiles: ['C172'],
            default: 'C172'
        });
    });
}

// Provider base URL mapping
function getProviderBaseUrl(provider) {
    switch (provider) {
        case 'ollama': return 'http://localhost:11434/v1';
        case 'lmstudio': return 'http://localhost:1234/v1';
        case 'openai': default: return 'https://api.openai.com/v1';
    }
}

// Default model per provider
function getDefaultModel(provider) {
    switch (provider) {
        case 'ollama': return 'qwen2.5-coder:32b';
        case 'lmstudio': return 'local-model';
        case 'anthropic': return 'claude-sonnet-4-5-20250929';
        case 'openai': default: return 'gpt-4o';
    }
}

// OpenAI-compatible streaming proxy (works for OpenAI, Ollama, LM Studio)
async function proxyOpenAI(apiKey, model, messages, res, abortController, baseUrl) {
    const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 300 }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(`LLM error (${response.status}) from ${url}`);
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.on('close', () => abortController.abort());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') {
                    res.write('data: {"done":true}\n\n');
                    continue;
                }
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                } catch (e) { /* skip */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return;
        throw e;
    }
    res.end();
}

// Simplified Anthropic streaming proxy
async function proxyAnthropic(apiKey, model, messages, res, abortController) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model, system: systemMsg?.content || '',
            messages: chatMessages, stream: true, max_tokens: 256
        }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(`Anthropic error (${response.status})`);
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.on('close', () => abortController.abort());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        res.write(`data: ${JSON.stringify({ chunk: parsed.delta.text })}\n\n`);
                    } else if (parsed.type === 'message_stop') {
                        res.write('data: {"done":true}\n\n');
                    }
                } catch (e) { /* skip */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return;
        throw e;
    }
    res.end();
}

// Decrypt API key helper (reused across endpoints)
function decryptApiKey(cfg) {
    if (!cfg.apiKeyEncrypted) return '';
    try {
        const crypto = require('crypto');
        const os = require('os');
        const SALT = 'SimGlass-Copilot-KeyStore';
        const key = crypto.createHash('sha256').update(os.hostname() + SALT).digest();
        const [ivHex, encrypted] = cfg.apiKeyEncrypted.split(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return '';
    }
}

// Non-streaming OpenAI-compatible fetch (for auto-advise parsing)
async function fetchOpenAI(apiKey, model, messages, abortController, baseUrl) {
    const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, max_tokens: 300 }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`LLM error (${response.status}) from ${url}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// Non-streaming Anthropic fetch (for auto-advise parsing)
async function fetchAnthropic(apiKey, model, messages, abortController) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content
    }));
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, system: systemMsg?.content || '', messages: chatMessages, max_tokens: 300 }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`Anthropic error (${response.status})`);
    const data = await response.json();
    return data.content?.[0]?.text || '';
}

// Parse AP commands from LLM response text
function parseCommandsFromText(text) {
    const commands = [];

    // Try JSON format first: COMMANDS_JSON: [...]
    const jsonMatch = text.match(/COMMANDS_JSON:\s*(\[[\s\S]*?\])/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { /* fall through to line parsing */ }
    }

    // Fallback: parse COMMAND VALUE lines
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.replace(/^[-*\s]+/, '').trim();
        // Match patterns like: HEADING_BUG_SET 300, HEADING_BUG_SET: 300, AP_HDG_HOLD ON
        const match = trimmed.match(/^((?:AP_|HEADING_|TOGGLE_|YAW_)\w+)[\s:]+(\d+|ON|OFF)?$/i);
        if (match) {
            const cmd = { command: match[1].toUpperCase() };
            if (match[2] && match[2] !== 'ON' && match[2] !== 'OFF') {
                cmd.value = parseInt(match[2]);
            }
            commands.push(cmd);
        }
    }

    return commands;
}

// Middleware guard
function express_json_guard(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'JSON body required' });
    }
    next();
}

module.exports = { setupAiPilotRoutes };
