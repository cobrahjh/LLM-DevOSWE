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
You provide concise, actionable autopilot and flight control recommendations.
Keep responses to 2-3 sentences maximum.
When recommending changes, prefix with "RECOMMEND:" on its own line.

C172 V-SPEEDS: Vr=55, Vx=62, Vy=74, Vcruise=110, Vfe=85, Va=99, Vno=129, Vref=65, Vs0=48, Vs1=53

PROCEDURES BY PHASE:
- PREFLIGHT/TAXI: No AP commands. Verify mixture rich, fuel both, controls free.
- BEFORE TAKEOFF: Runup at 1800 RPM, check mags (125 RPM max drop), flaps 0-10°, trim takeoff.
- TAKEOFF ROLL: Full throttle, mixture rich. At 55 KIAS (Vr) rotate with ~10° pitch up.
- INITIAL CLIMB: At 200 AGL with positive climb, engage AP, HDG hold, VS +700.
- DEPARTURE (500+ AGL): Retract flaps, set Vy (74 kt), set cruise altitude target.
- CLIMB: Maintain Vy, full throttle, lean above 3000 ft.
- CRUISE: Level at target alt, set cruise power (2200-2400 RPM), lean mixture.
- DESCENT: Enrich mixture, reduce power, -500 fpm, monitor carb heat.
- APPROACH: Mixture rich, carb heat on, flaps as needed, 65-75 KIAS. Disengage AP below 200 AGL.
- LANDING: Full flaps, 60-65 KIAS (Vref), AP OFF, flare at 10-20 ft AGL.

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
- Gear: ${fd.gearDown ? 'DOWN' : 'UP'}, Flaps: ${fd.flapsIndex || 0}
- Mixture: ${Math.round(fd.mixture || 0)}%, Throttle: ${Math.round(fd.throttle || 0)}%
- Engine RPM: ${Math.round(fd.engineRpm || 0)}`;
}

/** Scale API-level values to SimConnect axis range (0-16383 or -16383 to +16383) */
function scaleSimValue(command, value) {
    if (command === 'THROTTLE_SET' || command === 'MIXTURE_SET' || command === 'MIXTURE1_SET' || command === 'PROP_PITCH_SET') {
        return Math.round((value / 100) * 16383);  // 0-100% → 0-16383
    }
    if (command === 'AXIS_ELEVATOR_SET') {
        return Math.round((value / 50) * 16383);   // -50 to +50 → -16383 to +16383
    }
    return Math.round(value || 0);
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
        'AP_SPD_VAR_SET': 'AP_SPD_VAR_SET',
        // Flight control commands
        'THROTTLE_SET': 'THROTTLE_SET',
        'MIXTURE_SET': 'MIXTURE1_SET',
        'PROP_PITCH_SET': 'PROP_PITCH_SET',
        'FLAPS_UP': 'FLAPS_UP',
        'FLAPS_DOWN': 'FLAPS_DOWN',
        'AXIS_ELEVATOR_SET': 'AXIS_ELEVATOR_SET',
        'PARKING_BRAKES': 'PARKING_BRAKES',
        // Engine start
        'TOGGLE_STARTER1': 'TOGGLE_STARTER1',
        'SET_STARTER1_HELD': 'SET_STARTER1_HELD',
        'MAGNETO1_OFF': 'MAGNETO1_OFF',
        'MAGNETO1_BOTH': 'MAGNETO1_BOTH',
        'MAGNETO1_START': 'MAGNETO1_START',
        'LANDING_LIGHTS_TOGGLE': 'LANDING_LIGHTS_TOGGLE'
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
            if (command === 'THROTTLE_SET' && (value < 0 || value > 100)) {
                return res.status(400).json({ error: 'Throttle out of range (0-100)' });
            }
            if (command === 'MIXTURE_SET' && (value < 0 || value > 100)) {
                return res.status(400).json({ error: 'Mixture out of range (0-100)' });
            }
            if (command === 'AXIS_ELEVATOR_SET' && (value < -50 || value > 50)) {
                return res.status(400).json({ error: 'Elevator out of range (-50 to 50)' });
            }
        }

        // Resolve the actual SimConnect event name
        const simEventName = COMMAND_TO_EVENT[command];
        const sc = getSimConnect ? getSimConnect() : null;

        // Scale values for SimConnect (0-100% → 0-16383, etc.)
        const simValue = scaleSimValue(command, value || 0);

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
        const isLocal = provider.startsWith('ollama') || provider.startsWith('lmstudio');

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
        const timeout = isLocal ? 120000 : 30000;
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            if (provider === 'anthropic') {
                await proxyAnthropic(apiKey, model, messages, res, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider, cfg);
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
        const isLocal = provider.startsWith('ollama') || provider.startsWith('lmstudio');

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
AP COMMANDS:
- HEADING_BUG_SET (0-360)
- AP_ALT_VAR_SET (0-45000, altitude in feet)
- AP_VS_VAR_SET (-6000 to 6000, fpm)
- AP_SPD_VAR_SET (40-500, knots)
- AP_HDG_HOLD (no value, toggles heading hold)
- AP_ALT_HOLD (no value, toggles altitude hold)
- AP_VS_HOLD (no value, toggles VS hold)
- AP_MASTER (no value, toggles AP master)

FLIGHT CONTROL COMMANDS:
- THROTTLE_SET (0-100, percentage)
- MIXTURE_SET (0-100, percentage)
- AXIS_ELEVATOR_SET (-50 to 50, pitch control: negative = nose up)
- FLAPS_UP (no value, retract one notch)
- FLAPS_DOWN (no value, extend one notch)
- PARKING_BRAKES (no value, toggle)
- LANDING_LIGHTS_TOGGLE (no value, toggle)

For toggle commands, omit the value field. Only include commands that need to CHANGE from current state.
For takeoff: use THROTTLE_SET 100, then AXIS_ELEVATOR_SET -25 at Vr, then AP_MASTER after liftoff.`;

        const userMsg = message || `Current phase of flight: altitude ${Math.round(fd.altitude||0)}ft, speed ${Math.round(fd.speed||0)}kt, heading ${Math.round(fd.heading||0)}. Recommend optimal AP settings.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg.slice(0, 2000) }
        ];

        const model = cfg.model || getDefaultModel(provider);
        const abortController = new AbortController();
        const timeout = isLocal ? 120000 : 30000;
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            // Get non-streaming response for parsing
            let fullText = '';
            if (provider === 'anthropic') {
                fullText = await fetchAnthropic(apiKey, model, messages, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider, cfg);
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
                const simValue = scaleSimValue(cmd.command, cmd.value || 0);

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
// Supports remote hosts: 'ollama-aipc', 'lmstudio-rockpc', etc.
function getProviderBaseUrl(provider, cfg) {
    // Custom base URL from config takes priority
    if (cfg && cfg.customBaseUrl) return cfg.customBaseUrl;

    switch (provider) {
        case 'ollama': return 'http://localhost:11434/v1';
        case 'ollama-aipc': return 'http://192.168.1.162:11434/v1';
        case 'ollama-rockpc': return 'http://192.168.1.192:11434/v1';
        case 'lmstudio': return 'http://localhost:1234/v1';
        case 'lmstudio-rockpc': return 'http://192.168.1.192:1234/v1';
        case 'lmstudio-aipc': return 'http://192.168.1.162:1234/v1';
        case 'openai': default: return 'https://api.openai.com/v1';
    }
}

// Default model per provider
function getDefaultModel(provider) {
    if (provider.startsWith('ollama')) return 'qwen2.5-coder:32b';
    if (provider.startsWith('lmstudio')) return 'qwen2.5-7b-instruct';
    switch (provider) {
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
        // Match patterns like: HEADING_BUG_SET 300, THROTTLE_SET: 100, AP_HDG_HOLD ON
        const match = trimmed.match(/^((?:AP_|HEADING_|TOGGLE_|YAW_|THROTTLE_|MIXTURE_|PROP_|FLAPS_|AXIS_|PARKING_|LANDING_)\w+)[\s:]+(-?\d+|ON|OFF)?$/i);
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
