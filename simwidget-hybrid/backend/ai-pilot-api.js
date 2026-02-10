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

function setupAiPilotRoutes(app, getFlightData) {

    // Status endpoint
    app.get('/api/ai-pilot/status', (req, res) => {
        const fd = getFlightData();
        const cfg = getCopilotConfig();
        res.json({
            hasLlm: !!(cfg.licenseKey),
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

    // Command execution — validates and forwards AP command
    app.post('/api/ai-pilot/command', express_json_guard, (req, res) => {
        const { command, value } = req.body;

        // Whitelist of allowed AP commands
        const ALLOWED_COMMANDS = [
            'AP_MASTER', 'TOGGLE_FLIGHT_DIRECTOR', 'YAW_DAMPER_TOGGLE',
            'AP_HDG_HOLD', 'AP_ALT_HOLD', 'AP_VS_HOLD', 'AP_AIRSPEED_HOLD',
            'AP_NAV1_HOLD', 'AP_APR_HOLD', 'AP_BC_HOLD', 'AP_VNAV',
            'HEADING_BUG_INC', 'HEADING_BUG_DEC', 'HEADING_BUG_SET',
            'AP_ALT_VAR_INC', 'AP_ALT_VAR_DEC', 'AP_ALT_VAR_SET',
            'AP_VS_VAR_INC', 'AP_VS_VAR_DEC', 'AP_VS_VAR_SET',
            'AP_SPD_VAR_INC', 'AP_SPD_VAR_DEC', 'AP_SPD_VAR_SET'
        ];

        if (!command || !ALLOWED_COMMANDS.includes(command)) {
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
        }

        // Command is valid — client handles actual WS send
        res.json({ success: true, command, value });
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

        // Get API key (reuse copilot's encrypted key logic)
        let getApiKey;
        try {
            // Import the getApiKey function by requiring copilot-api internals
            // Since copilot-api doesn't export getApiKey, we replicate the logic
            const crypto = require('crypto');
            const os = require('os');
            const SALT = 'SimGlass-Copilot-KeyStore';
            const ENCRYPTION_ALGO = 'aes-256-cbc';

            function getEncryptionKey() {
                return crypto.createHash('sha256').update(os.hostname() + SALT).digest();
            }

            getApiKey = function(copilotCfg) {
                if (copilotCfg.apiKeyEncrypted) {
                    try {
                        const key = getEncryptionKey();
                        const [ivHex, encrypted] = copilotCfg.apiKeyEncrypted.split(':');
                        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, 'hex'));
                        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                        decrypted += decipher.final('utf8');
                        return decrypted;
                    } catch (e) {
                        return '';
                    }
                }
                return '';
            };
        } catch (e) {
            return res.status(500).json({ error: 'Crypto module error' });
        }

        const apiKey = getApiKey(cfg);
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

        const provider = cfg.provider || 'openai';
        const model = cfg.model || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929');
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 30000);

        try {
            if (provider === 'anthropic') {
                await proxyAnthropic(apiKey, model, messages, res, abortController);
            } else {
                await proxyOpenAI(apiKey, model, messages, res, abortController);
            }
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (!res.headersSent) {
                res.status(502).json({ error: err.message });
            }
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

// Simplified OpenAI streaming proxy
async function proxyOpenAI(apiKey, model, messages, res, abortController) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 256 }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(`OpenAI error (${response.status})`);
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

// Middleware guard
function express_json_guard(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'JSON body required' });
    }
    next();
}

module.exports = { setupAiPilotRoutes };
