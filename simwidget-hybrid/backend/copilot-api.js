/**
 * AI Copilot API Routes
 * Server-side proxy to OpenAI/Anthropic with license gating and BYO API key.
 * Pattern follows weather-api.js: exports setupCopilotRoutes(app, getFlightData)
 */

const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { validateKey, TIERS } = require('./copilot-license');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ENCRYPTION_ALGO = 'aes-256-cbc';
const SALT = 'SimGlass-Copilot-KeyStore';

// Derive encryption key from machine identity
function getEncryptionKey() {
    const material = os.hostname() + SALT;
    return crypto.createHash('sha256').update(material).digest();
}

function encryptApiKey(plainKey) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptApiKey(encryptedStr) {
    if (!encryptedStr || !encryptedStr.includes(':')) return '';
    const key = getEncryptionKey();
    const [ivHex, encrypted] = encryptedStr.split(':');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
        // Auto-create from example if missing
        const examplePath = path.join(path.dirname(CONFIG_PATH), 'config.example.json');
        if (fs.existsSync(examplePath)) {
            const example = fs.readFileSync(examplePath, 'utf8');
            fs.writeFileSync(CONFIG_PATH, example);
            console.log('[Config] Created config.json from config.example.json');
            return JSON.parse(example);
        }
    } catch (e) {
        console.error('[Copilot] Config load error:', e.message);
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getCopilotConfig() {
    const config = loadConfig();
    return config.copilot || {};
}

function saveCopilotConfig(copilotSection) {
    const config = loadConfig();
    config.copilot = copilotSection;
    saveConfig(config);
}

// In-memory API key storage for "memory only" mode
let memoryApiKey = '';

function getApiKey(copilotCfg) {
    if (copilotCfg.apiKeyMemoryOnly && memoryApiKey) {
        return memoryApiKey;
    }
    if (copilotCfg.apiKeyEncrypted) {
        try {
            return decryptApiKey(copilotCfg.apiKeyEncrypted);
        } catch (e) {
            console.error('[Copilot] API key decryption failed:', e.message);
            return '';
        }
    }
    return '';
}

function buildSystemPrompt(flightData) {
    const fd = flightData || {};
    return `You are an expert flight instructor and copilot for Microsoft Flight Simulator.
Keep responses concise and use standard aviation terminology.

CURRENT FLIGHT STATE:
- Position: ${(fd.latitude || 0).toFixed(4)}N, ${(fd.longitude || 0).toFixed(4)}W
- Altitude: ${Math.round(fd.altitude || 0)} ft MSL, ${Math.round(fd.altitudeAGL || 0)} ft AGL
- Speed: ${Math.round(fd.speed || 0)} KIAS, GS ${Math.round(fd.groundSpeed || 0)} kt
- Heading: ${Math.round(fd.heading || 0)}° True, Track ${Math.round(fd.groundTrack || 0)}°
- VS: ${Math.round(fd.verticalSpeed || 0)} fpm
- On Ground: ${fd.onGround ? 'Yes' : 'No'}

SYSTEMS:
- Gear: ${fd.gearDown ? 'DOWN' : 'UP'}, Flaps: ${fd.flapsIndex || 0}
- Engine: ${fd.engineRunning ? 'Running' : 'Off'}, RPM: ${Math.round(fd.engineRpm || 0)}
- Throttle: ${Math.round((fd.throttle || 0) * 100)}%, Mixture: ${Math.round((fd.mixture || 0) * 100)}%

AUTOPILOT:
- Master: ${fd.apMaster ? 'ON' : 'OFF'}
- HDG: ${fd.apHdgLock ? Math.round(fd.apHdgSet || 0) + '°' : 'OFF'}
- ALT: ${fd.apAltLock ? Math.round(fd.apAltSet || 0) + ' ft' : 'OFF'}
- VS: ${fd.apVsLock ? Math.round(fd.apVsSet || 0) + ' fpm' : 'OFF'}

FUEL:
- Total: ${Math.round(fd.fuelTotal || 0)} gal / ${Math.round(fd.fuelCapacity || 0)} gal
- Flow: ${(fd.fuelFlow || 0).toFixed(1)} gph

RADIOS:
- COM1: ${((fd.com1Active || 0) / 1000000).toFixed(3)} MHz
- NAV1: ${((fd.nav1Active || 0) / 1000000).toFixed(3)} MHz
- XPDR: ${fd.transponder || 1200}

ENVIRONMENT:
- Wind: ${Math.round(fd.windDirection || 0)}° / ${Math.round(fd.windSpeed || 0)} kt
- Temp: ${Math.round(fd.ambientTemp || 15)}°C
- QNH: ${(fd.ambientPressure || 29.92).toFixed(2)} inHg`;
}

function mapProviderError(status, provider) {
    if (status === 401) return 'Invalid API key. Check your key in settings.';
    if (status === 429) return 'Rate limited. Wait a moment and try again.';
    if (status === 403) return 'API key lacks permission for this model.';
    if (status === 500 || status === 502 || status === 503) return `${provider} is temporarily unavailable.`;
    return `${provider} error (${status})`;
}

async function proxyToOpenAI(apiKey, model, messages, req, res, abortController) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model || 'gpt-4o',
            messages,
            stream: true,
            max_tokens: 1024
        }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(mapProviderError(response.status, 'OpenAI'));
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Now that headers are sent, abort on real client disconnect
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
                    if (content) {
                        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                    }
                } catch (e) { /* skip malformed chunks */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return; // client disconnected mid-stream
        throw e;
    }
    res.end();
}

async function proxyToAnthropic(apiKey, model, messages, req, res, abortController) {
    // Convert OpenAI-style messages to Anthropic format
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
            model: model || 'claude-sonnet-4-5-20250929',
            system: systemMsg ? systemMsg.content : '',
            messages: chatMessages,
            stream: true,
            max_tokens: 1024
        }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(mapProviderError(response.status, 'Anthropic'));
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Now that headers are sent, abort on real client disconnect
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
                } catch (e) { /* skip malformed chunks */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return; // client disconnected mid-stream
        throw e;
    }
    res.end();
}

function setupCopilotRoutes(app, getFlightData) {
    // Status endpoint — never returns actual API key
    app.get('/api/copilot/status', (req, res) => {
        const cfg = getCopilotConfig();
        const licenseResult = validateKey(cfg.licenseKey);
        res.json({
            licensed: licenseResult.valid,
            tier: licenseResult.tier || null,
            provider: cfg.provider || 'openai',
            model: cfg.model || 'gpt-4o',
            hasApiKey: !!(getApiKey(cfg)),
            apiKeyMemoryOnly: !!cfg.apiKeyMemoryOnly,
            ttsVoice: cfg.ttsVoice || 'nova'
        });
    });

    // Validate a license key without saving
    app.post('/api/copilot/validate-key', express_json_guard, (req, res) => {
        const { key } = req.body;
        const result = validateKey(key);
        res.json(result);
    });

    // Save copilot config (license, provider, model, API key)
    app.post('/api/copilot/config', express_json_guard, (req, res) => {
        const { licenseKey, provider, model, apiKey, apiKeyMemoryOnly, ttsVoice } = req.body;

        const cfg = getCopilotConfig();

        if (licenseKey !== undefined) cfg.licenseKey = licenseKey;
        if (provider !== undefined) cfg.provider = provider;
        if (model !== undefined) cfg.model = model;
        if (apiKeyMemoryOnly !== undefined) cfg.apiKeyMemoryOnly = apiKeyMemoryOnly;
        if (ttsVoice !== undefined) cfg.ttsVoice = ttsVoice;

        if (apiKey !== undefined && apiKey !== '') {
            if (apiKeyMemoryOnly) {
                memoryApiKey = apiKey;
                cfg.apiKeyEncrypted = '';
            } else {
                cfg.apiKeyEncrypted = encryptApiKey(apiKey);
                memoryApiKey = '';
            }
        }

        saveCopilotConfig(cfg);

        const licenseResult = validateKey(cfg.licenseKey);
        res.json({
            success: true,
            licensed: licenseResult.valid,
            tier: licenseResult.tier || null,
            hasApiKey: !!(getApiKey(cfg))
        });
    });

    // Text-to-speech endpoint — proxies to OpenAI TTS
    app.post('/api/copilot/speak', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'License required' });
        }

        const apiKey = getApiKey(cfg);
        if (!apiKey || cfg.provider !== 'openai') {
            return res.status(400).json({ error: 'OpenAI API key required for TTS' });
        }

        let { text, voice } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Cap at 4096 chars (OpenAI TTS limit)
        text = text.slice(0, 4096);
        voice = voice || cfg.ttsVoice || 'nova';

        const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];
        if (!VALID_VOICES.includes(voice)) voice = 'nova';

        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: voice,
                    response_format: 'mp3'
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                const err = await response.text().catch(() => '');
                console.error('[Copilot] TTS error:', response.status, err);
                return res.status(response.status).json({ error: mapProviderError(response.status, 'OpenAI TTS') });
            }

            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache'
            });

            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();
        } catch (err) {
            console.error('[Copilot] TTS error:', err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: 'TTS request failed: ' + err.message });
            }
        }
    });

    // Streaming chat endpoint
    app.post('/api/copilot/chat', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        // Validate license
        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'Valid license required. Configure in Settings > AI Copilot.' });
        }

        // Get API key
        const apiKey = getApiKey(cfg);
        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured. Add your key in Settings > AI Copilot.' });
        }

        let { message, history } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Guardrails
        message = message.slice(0, 4000);
        history = Array.isArray(history) ? history.slice(-20) : [];

        const flightData = getFlightData();
        const systemPrompt = buildSystemPrompt(flightData);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(h => ({
                role: h.role === 'copilot' || h.role === 'assistant' ? 'assistant' : 'user',
                content: (h.content || h.text || '').slice(0, 4000)
            })),
            { role: 'user', content: message }
        ];

        const provider = cfg.provider || 'openai';
        const model = cfg.model || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929');

        // Abort controller — client disconnect listener is attached inside proxy
        // functions AFTER headers are sent (req 'close' fires early in Express
        // when the request body finishes, not when the client actually disconnects)
        const abortController = new AbortController();

        // 60s timeout for initial response from upstream LLM
        const timeoutId = setTimeout(() => abortController.abort(), 60000);

        try {
            if (provider === 'anthropic') {
                await proxyToAnthropic(apiKey, model, messages, req, res, abortController);
            } else {
                await proxyToOpenAI(apiKey, model, messages, req, res, abortController);
            }
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (abortController.signal.aborted) {
                if (!res.headersSent) {
                    res.status(504).json({ error: 'Request timed out or client disconnected' });
                }
                return;
            }
            console.error('[Copilot] LLM proxy error:', err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: err.message });
            } else {
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.end();
            }
        }
    });
}

// Middleware guard: ensure JSON body is parsed
function express_json_guard(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'JSON body required' });
    }
    next();
}

module.exports = { setupCopilotRoutes };
