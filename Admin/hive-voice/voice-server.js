const http = require('http');
const WebSocket = require('ws');
const { execFile } = require('child_process');
const path = require('path');

const PORT = 8870;
const RELAY_URL = 'http://192.168.1.42:8600';

// Voice control state
const state = {
    listening: false,
    mode: 'command', // 'command' or 'dictate'
    wakeWord: 'hey kitt',
    targetApp: 'claude', // 'claude', 'kittbox', 'terminal'
    lastTranscript: '',
    history: []
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Hive Voice Control',
            version: '1.0.0',
            state: {
                listening: state.listening,
                mode: state.mode,
                target: state.targetApp
            }
        }));
        return;
    }

    // Get state
    if (req.url === '/api/state') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
        return;
    }

    // Set mode
    if (req.url === '/api/mode' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { mode } = JSON.parse(body);
                if (['command', 'dictate'].includes(mode)) {
                    state.mode = mode;
                    broadcast({ type: 'mode', mode: state.mode });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, mode: state.mode }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid mode' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Set target
    if (req.url === '/api/target' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { target } = JSON.parse(body);
                state.targetApp = target;
                broadcast({ type: 'target', target: state.targetApp });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, target: state.targetApp }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Process transcript (from browser or whisper)
    if (req.url === '/api/transcript' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { text, final } = JSON.parse(body);
                processTranscript(text, final);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // History
    if (req.url === '/api/history') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state.history.slice(-50)));
        return;
    }

    // Serve UI
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getUIHtml());
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

// WebSocket for real-time updates
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[Voice] Client connected');

    // Send current state
    ws.send(JSON.stringify({ type: 'state', ...state }));

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'transcript') {
                processTranscript(msg.text, msg.final);
            } else if (msg.type === 'listening') {
                state.listening = msg.value;
                broadcast({ type: 'listening', value: state.listening });
            } else if (msg.type === 'mode') {
                state.mode = msg.mode;
                broadcast({ type: 'mode', mode: state.mode });
            }
        } catch (e) {
            console.error('[Voice] Message error:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('[Voice] Client disconnected');
    });
});

function broadcast(msg) {
    const data = JSON.stringify(msg);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function processTranscript(text, isFinal) {
    if (!text) return;

    const lowerText = text.toLowerCase().trim();
    state.lastTranscript = text;

    console.log(`[Voice] ${isFinal ? 'Final' : 'Interim'}: "${text}"`);
    broadcast({ type: 'transcript', text, final: isFinal });

    if (!isFinal) return;

    // Add to history
    state.history.push({
        timestamp: Date.now(),
        text,
        mode: state.mode,
        target: state.targetApp
    });

    // Check for wake word
    if (lowerText.includes(state.wakeWord)) {
        state.listening = true;
        broadcast({ type: 'wake', triggered: true });
        speak('Yes?');
        return;
    }

    // Check for mode switches
    if (lowerText.includes('dictate mode') || lowerText.includes('start dictating')) {
        state.mode = 'dictate';
        broadcast({ type: 'mode', mode: 'dictate' });
        speak('Dictation mode');
        return;
    }

    if (lowerText.includes('command mode') || lowerText.includes('stop dictating')) {
        state.mode = 'command';
        broadcast({ type: 'mode', mode: 'command' });
        speak('Command mode');
        return;
    }

    // Process based on mode
    if (state.mode === 'dictate') {
        sendToTarget(text);
    } else {
        processCommand(lowerText);
    }
}

function processCommand(text) {
    // Target switching
    if (text.includes('switch to claude') || text.includes('talk to claude')) {
        state.targetApp = 'claude';
        speak('Switching to Claude');
        return;
    }
    if (text.includes('switch to kitt') || text.includes('talk to kitt')) {
        state.targetApp = 'kittbox';
        speak('Switching to Kitt');
        return;
    }

    // Quick commands
    if (text.includes('commit changes') || text.includes('git commit')) {
        sendToRelay({ type: 'command', target: 'claude', text: '/commit' });
        speak('Committing');
        return;
    }

    if (text.includes('run tests') || text.includes('test it')) {
        sendToRelay({ type: 'command', target: 'terminal', text: 'npm test' });
        speak('Running tests');
        return;
    }

    if (text.includes('check status')) {
        sendToRelay({ type: 'command', target: 'terminal', text: 'git status' });
        speak('Checking status');
        return;
    }

    // Default: send as query to target
    sendToTarget(text);
}

function sendToTarget(text) {
    console.log(`[Voice] Sending to ${state.targetApp}: "${text}"`);

    switch (state.targetApp) {
        case 'claude':
            // Send to Claude Code via relay
            sendToRelay({
                type: 'voice_input',
                target: 'claude-code',
                text: text,
                mode: state.mode
            });
            break;

        case 'kittbox':
            // Send to KittBox chat
            fetch('http://192.168.1.42:8585/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, voice: true })
            }).catch(e => console.error('[Voice] KittBox error:', e));
            break;

        case 'terminal':
            // Type into active terminal
            typeText(text);
            break;
    }

    broadcast({ type: 'sent', target: state.targetApp, text });
}

function sendToRelay(data) {
    fetch(`${RELAY_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: 'hive-voice',
            to: data.target,
            content: data,
            priority: 'high'
        })
    }).catch(e => console.error('[Voice] Relay error:', e));
}

function typeText(text) {
    // Use PowerShell to type text into active window (safe: no shell interpolation)
    const script = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${text.replace(/'/g, "''")}')`;
    execFile('powershell', ['-Command', script], (err) => {
        if (err) console.error('[Voice] Type error:', err);
    });
}

function speak(text) {
    // Use PowerShell TTS (safe: using execFile with args)
    const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('Microsoft Zira Desktop'); $s.Speak('${text.replace(/'/g, "''")}')`;
    execFile('powershell', ['-Command', script], (err) => {
        if (err) console.error('[Voice] TTS error:', err);
    });
    broadcast({ type: 'speak', text });
}

function getUIHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hive Voice Control</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { text-align: center; margin-bottom: 20px; }

        .status-bar {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .status-pill {
            padding: 8px 16px;
            border-radius: 20px;
            background: rgba(255,255,255,0.1);
            font-size: 14px;
        }
        .status-pill.active { background: #4CAF50; }
        .status-pill.dictate { background: #ff9800; }

        .mic-container {
            text-align: center;
            margin: 40px 0;
        }
        .mic-btn {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 48px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        }
        .mic-btn:hover { transform: scale(1.05); }
        .mic-btn.listening {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(245, 87, 108, 0.7); }
            50% { box-shadow: 0 0 0 20px rgba(245, 87, 108, 0); }
        }

        .transcript-box {
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 20px;
            min-height: 100px;
            margin-bottom: 20px;
        }
        .transcript-box h3 { margin-bottom: 10px; color: #888; font-size: 12px; }
        .transcript-text { font-size: 18px; line-height: 1.5; }
        .transcript-text.interim { color: #888; font-style: italic; }

        .controls {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }
        .control-btn {
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            cursor: pointer;
            transition: background 0.2s;
        }
        .control-btn:hover { background: rgba(255,255,255,0.2); }
        .control-btn.active { background: #4CAF50; }

        .history {
            background: rgba(0,0,0,0.2);
            border-radius: 12px;
            padding: 15px;
            max-height: 200px;
            overflow-y: auto;
        }
        .history-item {
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            font-size: 14px;
        }
        .history-item:last-child { border: none; }
        .history-time { color: #666; font-size: 11px; margin-right: 8px; }

        .error { color: #f44336; text-align: center; padding: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hive Voice Control</h1>

        <div class="status-bar">
            <div class="status-pill" id="listeningStatus">Not Listening</div>
            <div class="status-pill" id="modeStatus">Command Mode</div>
            <div class="status-pill" id="targetStatus">Target: Claude</div>
        </div>

        <div class="mic-container">
            <button class="mic-btn" id="micBtn" onclick="toggleListening()">🎤</button>
            <p style="margin-top: 15px; color: #888;">Click or say "Hey Kitt"</p>
        </div>

        <div class="transcript-box">
            <h3>TRANSCRIPT</h3>
            <div class="transcript-text" id="transcript">Ready for voice input...</div>
        </div>

        <div class="controls">
            <button class="control-btn" onclick="setMode('command')">Command</button>
            <button class="control-btn" onclick="setMode('dictate')">Dictate</button>
            <button class="control-btn" onclick="cycleTarget()">Switch Target</button>
        </div>

        <div class="controls">
            <button class="control-btn" onclick="setTarget('claude')">Claude</button>
            <button class="control-btn" onclick="setTarget('kittbox')">Kitt</button>
            <button class="control-btn" onclick="setTarget('terminal')">Terminal</button>
        </div>

        <div class="history" id="history">
            <div class="history-item" style="color: #666;">Voice history will appear here...</div>
        </div>

        <div class="error" id="error"></div>
    </div>

    <script>
        let recognition = null;
        let ws = null;
        let listening = false;
        let currentMode = 'command';
        let currentTarget = 'claude';
        const targets = ['claude', 'kittbox', 'terminal'];

        // Initialize Web Speech API
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }

                if (final) {
                    document.getElementById('transcript').textContent = final;
                    document.getElementById('transcript').classList.remove('interim');
                    sendTranscript(final, true);
                } else if (interim) {
                    document.getElementById('transcript').textContent = interim;
                    document.getElementById('transcript').classList.add('interim');
                    sendTranscript(interim, false);
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech error:', event.error);
                if (event.error !== 'no-speech') {
                    document.getElementById('error').textContent = 'Error: ' + event.error;
                }
            };

            recognition.onend = () => {
                if (listening) {
                    recognition.start(); // Auto-restart
                }
            };
        } else {
            document.getElementById('error').textContent = 'Speech recognition not supported in this browser';
        }

        // WebSocket connection
        function connectWS() {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Get base path for proxy support (e.g., /voice when behind Caddy)
            const basePath = location.pathname.replace(/\\/index\\.html$/, '').replace(/\\/$/, '');
            ws = new WebSocket(protocol + '//' + location.host + basePath);

            ws.onopen = () => console.log('WebSocket connected');

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                handleServerMessage(msg);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected, reconnecting...');
                setTimeout(connectWS, 2000);
            };
        }

        function handleServerMessage(msg) {
            switch (msg.type) {
                case 'state':
                    currentMode = msg.mode;
                    currentTarget = msg.targetApp;
                    updateUI();
                    break;
                case 'mode':
                    currentMode = msg.mode;
                    updateUI();
                    break;
                case 'target':
                    currentTarget = msg.target;
                    updateUI();
                    break;
                case 'wake':
                    if (msg.triggered && !listening) {
                        toggleListening();
                    }
                    break;
                case 'transcript':
                    addToHistory(msg.text);
                    break;
            }
        }

        function updateUI() {
            document.getElementById('modeStatus').textContent = currentMode === 'dictate' ? 'Dictate Mode' : 'Command Mode';
            document.getElementById('modeStatus').classList.toggle('dictate', currentMode === 'dictate');
            document.getElementById('targetStatus').textContent = 'Target: ' + currentTarget.charAt(0).toUpperCase() + currentTarget.slice(1);
        }

        function toggleListening() {
            listening = !listening;
            const btn = document.getElementById('micBtn');
            const status = document.getElementById('listeningStatus');

            if (listening) {
                recognition?.start();
                btn.classList.add('listening');
                status.textContent = 'Listening...';
                status.classList.add('active');
            } else {
                recognition?.stop();
                btn.classList.remove('listening');
                status.textContent = 'Not Listening';
                status.classList.remove('active');
            }

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'listening', value: listening }));
            }
        }

        function sendTranscript(text, isFinal) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'transcript', text, final: isFinal }));
            }
        }

        function setMode(mode) {
            currentMode = mode;
            updateUI();
            fetch('/api/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
        }

        function setTarget(target) {
            currentTarget = target;
            updateUI();
            fetch('/api/target', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
        }

        function cycleTarget() {
            const idx = targets.indexOf(currentTarget);
            const next = targets[(idx + 1) % targets.length];
            setTarget(next);
        }

        function addToHistory(text) {
            const history = document.getElementById('history');
            const item = document.createElement('div');
            item.className = 'history-item';

            const timeSpan = document.createElement('span');
            timeSpan.className = 'history-time';
            timeSpan.textContent = new Date().toLocaleTimeString();

            const textNode = document.createTextNode(' ' + text);

            item.appendChild(timeSpan);
            item.appendChild(textNode);
            history.insertBefore(item, history.firstChild);

            // Keep only last 20 items
            while (history.children.length > 20) {
                history.removeChild(history.lastChild);
            }
        }

        // Initialize
        connectWS();
        updateUI();
    </script>
</body>
</html>`;
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hive Voice] Running on port ${PORT}`);
    console.log(`[Hive Voice] UI: http://localhost:${PORT}`);
    console.log(`[Hive Voice] Wake word: "${state.wakeWord}"`);
});
