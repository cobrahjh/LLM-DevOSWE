/**
 * Claude Terminal v1.1.0
 * Direct control over Claude Code CLI sessions from Command Center
 *
 * Features:
 * - Spawn/kill Claude sessions
 * - Real-time output streaming via WebSocket
 * - Send prompts and input (text or voice)
 * - Voice input with auto-submit
 * - Session management
 */

const ClaudeTerminal = (function() {
    'use strict';

    let ws = null;
    let currentSessionId = null;
    let terminalElement = null;
    let inputElement = null;
    let outputElement = null;
    let sessions = [];
    let isConnected = false;
    let recognition = null;
    let isRecording = false;

    const config = {
        wsUrl: `ws://${location.hostname}:8585/claude`,
        relayUrl: `http://${location.hostname}:8600`,
        autoScroll: true,
        maxLines: 1000,
        useRelay: true,  // Send prompts to relay queue instead of CLI session
        // Voice settings
        voiceContinuous: true,      // Keep listening until manual stop
        voiceAutoSubmit: false,     // Don't auto-submit, let user press Enter
        voiceSilenceTimeout: 3000   // Wait 3 seconds of silence before stopping
    };

    // ==================== WEBSOCKET ====================

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        console.log('[ClaudeTerminal] Connecting to', config.wsUrl);
        ws = new WebSocket(config.wsUrl);

        ws.onopen = () => {
            console.log('[ClaudeTerminal] Connected');
            isConnected = true;
            updateStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (err) {
                console.error('[ClaudeTerminal] Parse error:', err);
            }
        };

        ws.onclose = () => {
            console.log('[ClaudeTerminal] Disconnected');
            isConnected = false;
            updateStatus('disconnected');
            // Reconnect after 3 seconds
            setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
            console.error('[ClaudeTerminal] WebSocket error:', err);
        };
    }

    function send(msg) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    // ==================== MESSAGE HANDLING ====================

    function handleMessage(msg) {
        switch (msg.type) {
            case 'claude:sessions':
                sessions = msg.sessions || [];
                renderSessionList();
                break;

            case 'claude:spawned':
                currentSessionId = msg.session.id;
                appendOutput(`\n[Session ${msg.session.id} started]\n`, 'system');
                renderSessionList();
                break;

            case 'claude:output':
                if (msg.sessionId === currentSessionId || !currentSessionId) {
                    appendOutput(msg.text, msg.stream);
                }
                break;

            case 'claude:buffer':
                // Received buffered output
                if (msg.buffer && msg.buffer.length > 0) {
                    clearOutput();
                    msg.buffer.forEach(item => {
                        appendOutput(item.text, item.type);
                    });
                }
                break;

            case 'claude:exit':
                appendOutput(`\n[Session exited with code ${msg.code}]\n`, 'system');
                if (msg.sessionId === currentSessionId) {
                    currentSessionId = null;
                }
                send({ type: 'list' });
                break;

            case 'claude:error':
                appendOutput(`\n[Error: ${msg.error}]\n`, 'error');
                break;
        }
    }

    // ==================== UI RENDERING ====================

    function createUI() {
        console.log('[ClaudeTerminal] createUI() called');
        // Check if terminal already exists
        if (document.getElementById('claude-terminal')) {
            console.log('[ClaudeTerminal] Terminal already exists');
            return;
        }

        const container = document.createElement('div');
        container.id = 'claude-terminal';
        container.innerHTML = `
            <div class="ct-header">
                <div class="ct-title">
                    <span class="ct-icon">🤖</span>
                    <span>Claude Terminal</span>
                    <span class="ct-status" id="ct-status">●</span>
                </div>
                <div class="ct-controls">
                    <select id="ct-session-select" title="Select session">
                        <option value="">No sessions</option>
                    </select>
                    <button class="ct-btn ct-btn-spawn" onclick="ClaudeTerminal.spawn()" title="New Session">➕</button>
                    <button class="ct-btn ct-btn-kill" onclick="ClaudeTerminal.killCurrent()" title="Kill Session">⏹</button>
                    <button class="ct-btn ct-btn-clear" onclick="ClaudeTerminal.clearOutput()" title="Clear">🗑</button>
                    <button class="ct-btn ct-btn-pin" onclick="ClaudeTerminal.togglePin()" title="Pin/Unpin">📌</button>
                    <button class="ct-btn ct-btn-minimize" onclick="ClaudeTerminal.toggleMinimize()" title="Minimize">─</button>
                    <button class="ct-btn ct-btn-close" onclick="ClaudeTerminal.hide()" title="Close">✕</button>
                </div>
            </div>
            <div class="ct-body">
                <div class="ct-output" id="ct-output"></div>
                <div class="ct-input-area">
                    <input type="text" class="ct-input" id="ct-input" placeholder="Type or speak a prompt..." autocomplete="off">
                    <button class="ct-btn ct-btn-voice" id="ct-voice-btn" onclick="ClaudeTerminal.toggleVoice()" title="Voice input">🎤</button>
                    <button class="ct-btn ct-btn-send" onclick="ClaudeTerminal.sendInput()">Send</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Add styles
        addStyles();

        // Cache elements
        terminalElement = container;
        outputElement = document.getElementById('ct-output');
        inputElement = document.getElementById('ct-input');

        // Event listeners
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Stop voice recording if active
                if (isRecording && recognition) {
                    recognition.stop();
                }
                sendInput();
            }
        });

        document.getElementById('ct-session-select').addEventListener('change', (e) => {
            if (e.target.value) {
                switchSession(e.target.value);
            }
        });

        // Make draggable
        makeDraggable(container);
    }

    function addStyles() {
        if (document.getElementById('claude-terminal-styles')) return;

        const style = document.createElement('style');
        style.id = 'claude-terminal-styles';
        style.textContent = `
            #claude-terminal {
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 600px;
                height: 400px;
                min-width: 350px;
                min-height: 200px;
                background: #0d0d14;
                border: 1px solid #4a9eff;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: 'JetBrains Mono', monospace;
                resize: both;
                overflow: hidden;
            }
            #claude-terminal::after {
                content: '';
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
                pointer-events: none;
                border-radius: 0 0 6px 0;
            }
            #claude-terminal.minimized {
                height: 40px;
                resize: none;
            }
            #claude-terminal.minimized .ct-body {
                display: none;
            }
            #claude-terminal.hidden {
                display: none;
            }
            .ct-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #1a1a2e;
                border-bottom: 1px solid #333;
                cursor: move;
                border-radius: 8px 8px 0 0;
            }
            .ct-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                font-weight: 600;
                color: #e0e0e0;
            }
            .ct-icon {
                font-size: 16px;
            }
            .ct-status {
                font-size: 10px;
                color: #666;
            }
            .ct-status.connected {
                color: #22c55e;
            }
            .ct-controls {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .ct-btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #aaa;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .ct-btn:hover {
                background: rgba(255,255,255,0.2);
                color: #fff;
            }
            .ct-btn-spawn { color: #22c55e; }
            .ct-btn-kill { color: #ef4444; }
            .ct-btn-pin { color: #666; }
            .ct-btn-pin.pinned { color: #f59e0b; }
            #claude-terminal.pinned { border-color: #f59e0b; }
            #claude-terminal.pinned .ct-header { cursor: default; }
            #ct-session-select {
                background: #1a1a2e;
                border: 1px solid #333;
                color: #e0e0e0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                max-width: 150px;
            }
            .ct-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .ct-output {
                flex: 1;
                padding: 12px;
                overflow-y: auto;
                font-size: 12px;
                line-height: 1.5;
                color: #e0e0e0;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .ct-output .stdout {
                color: #e0e0e0;
            }
            .ct-output .stderr {
                color: #f59e0b;
            }
            .ct-output .system {
                color: #4a9eff;
                font-style: italic;
            }
            .ct-output .error {
                color: #ef4444;
            }
            .ct-input-area {
                display: flex;
                gap: 8px;
                padding: 8px 12px;
                background: #1a1a2e;
                border-top: 1px solid #333;
            }
            .ct-input {
                flex: 1;
                background: #0d0d14;
                border: 1px solid #333;
                color: #e0e0e0;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: inherit;
                font-size: 12px;
            }
            .ct-input:focus {
                outline: none;
                border-color: #4a9eff;
            }
            .ct-btn-send {
                background: #4a9eff;
                color: #fff;
                padding: 8px 16px;
            }
            .ct-btn-send:hover {
                background: #3b8eef;
            }
            .ct-btn-voice {
                background: rgba(255,255,255,0.1);
                font-size: 14px;
                padding: 8px 12px;
            }
            .ct-btn-voice:hover {
                background: rgba(255,255,255,0.2);
            }
            .ct-btn-voice.recording {
                background: #ef4444;
                color: #fff;
                animation: pulse-voice 1s infinite;
            }
            @keyframes pulse-voice {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        `;
        document.head.appendChild(style);
    }

    function updateStatus(status) {
        const el = document.getElementById('ct-status');
        if (el) {
            el.className = 'ct-status ' + status;
            el.title = status;
        }
    }

    function renderSessionList() {
        const select = document.getElementById('ct-session-select');
        if (!select) return;

        select.innerHTML = sessions.length === 0
            ? '<option value="">No sessions</option>'
            : sessions.map(s => `
                <option value="${s.id}" ${s.id === currentSessionId ? 'selected' : ''}>
                    ${s.id.substring(0, 15)}... (${s.status})
                </option>
            `).join('');
    }

    function appendOutput(text, type = 'stdout') {
        if (!outputElement) return;

        const span = document.createElement('span');
        span.className = type;
        span.textContent = text;
        outputElement.appendChild(span);

        // Trim old lines
        while (outputElement.children.length > config.maxLines) {
            outputElement.removeChild(outputElement.firstChild);
        }

        // Auto-scroll
        if (config.autoScroll) {
            outputElement.scrollTop = outputElement.scrollHeight;
        }
    }

    function clearOutput() {
        if (outputElement) {
            outputElement.innerHTML = '';
        }
    }

    // ==================== SESSION MANAGEMENT ====================

    function spawn(prompt = null) {
        if (!isConnected) {
            console.warn('[ClaudeTerminal] Not connected');
            return;
        }

        send({
            type: 'spawn',
            options: {
                cwd: 'C:\\DevOSWE'
            }
        });

        // If prompt provided, send it after session starts
        if (prompt) {
            setTimeout(() => {
                if (currentSessionId) {
                    sendPrompt(prompt);
                }
            }, 2000);
        }
    }

    function sendInput() {
        const text = inputElement?.value?.trim();
        if (!text) return;

        inputElement.value = '';
        appendOutput(`\n> ${text}\n`, 'system');

        if (config.useRelay) {
            // Send to relay queue for processing
            sendToRelay(text);
        } else {
            // Legacy: send to CLI session
            if (!currentSessionId) {
                spawn();
                setTimeout(() => {
                    if (currentSessionId) {
                        send({ type: 'input', sessionId: currentSessionId, text });
                    }
                }, 2000);
            } else {
                send({ type: 'input', sessionId: currentSessionId, text });
            }
        }
    }

    async function sendToRelay(content) {
        try {
            appendOutput('[Sending to relay...]\n', 'system');

            const response = await fetch(`${config.relayUrl}/api/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    sessionId: 'claude-terminal',
                    priority: 'normal'
                })
            });

            const result = await response.json();

            if (result.success || result.id) {
                appendOutput(`[Task created: ${result.id}]\n`, 'system');
                // Poll for response
                pollForResponse(result.id);
            } else {
                appendOutput(`[Error: ${result.error || 'Failed to create task'}]\n`, 'error');
            }
        } catch (err) {
            appendOutput(`[Relay error: ${err.message}]\n`, 'error');
        }
    }

    async function pollForResponse(taskId) {
        const maxAttempts = 60;  // Poll for up to 60 seconds
        let attempts = 0;

        const poll = async () => {
            try {
                const response = await fetch(`${config.relayUrl}/api/queue/${taskId}`);
                const task = await response.json();

                if (task.status === 'completed' || task.status === 'responded') {
                    appendOutput(`\n[Response]\n${task.response || task.result || 'Done'}\n`, 'stdout');
                    return;
                }

                if (task.status === 'failed' || task.status === 'error') {
                    appendOutput(`\n[Task failed: ${task.error || 'Unknown error'}]\n`, 'error');
                    return;
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000);
                } else {
                    appendOutput('[Timeout waiting for response]\n', 'error');
                }
            } catch (err) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000);
                }
            }
        };

        setTimeout(poll, 1000);
    }

    function sendPrompt(prompt) {
        if (!currentSessionId) {
            spawn(prompt);
            return;
        }

        send({ type: 'prompt', sessionId: currentSessionId, prompt });
    }

    // ==================== VOICE INPUT ====================

    function initVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[ClaudeTerminal] Speech recognition not supported');
            return null;
        }

        const rec = new SpeechRecognition();
        rec.continuous = config.voiceContinuous;  // Keep listening until stopped
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
            isRecording = true;
            updateVoiceButton(true);
            appendOutput('[🎤 Listening... (click 🎤 or press Enter when done)]\n', 'system');
        };

        rec.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            if (inputElement) {
                // Append final results, show interim in real-time
                if (finalTranscript) {
                    inputElement.value = (inputElement.value + ' ' + finalTranscript).trim();
                }
                // Show interim result temporarily
                inputElement.placeholder = interimTranscript || 'Listening...';
            }
        };

        rec.onend = () => {
            isRecording = false;
            updateVoiceButton(false);
            if (inputElement) {
                inputElement.placeholder = 'Type or speak a prompt...';
            }

            if (config.voiceAutoSubmit && inputElement?.value?.trim()) {
                appendOutput(`[🎤 Heard: "${inputElement.value.trim()}"]\n`, 'system');
                sendInput();
            } else if (inputElement?.value?.trim()) {
                appendOutput(`[🎤 Ready - press Enter to send]\n`, 'system');
            } else {
                appendOutput('[🎤 Stopped]\n', 'system');
            }
        };

        rec.onerror = (event) => {
            // Ignore no-speech errors in continuous mode
            if (event.error === 'no-speech' && config.voiceContinuous) {
                return;
            }
            isRecording = false;
            updateVoiceButton(false);
            if (event.error !== 'aborted') {
                appendOutput(`[🎤 Error: ${event.error}]\n`, 'error');
            }
        };

        return rec;
    }

    function updateVoiceButton(recording) {
        const btn = document.getElementById('ct-voice-btn');
        if (btn) {
            btn.classList.toggle('recording', recording);
            btn.textContent = recording ? '⏹' : '🎤';
            btn.title = recording ? 'Stop recording' : 'Voice input';
        }
    }

    function toggleVoice() {
        if (isRecording) {
            // Stop recording
            if (recognition) {
                recognition.stop();
            }
            return;
        }

        // Start recording
        if (!recognition) {
            recognition = initVoiceRecognition();
        }

        if (recognition) {
            try {
                recognition.start();
            } catch (err) {
                console.error('[ClaudeTerminal] Voice error:', err);
                appendOutput(`[🎤 Error: ${err.message}]\n`, 'error');
            }
        } else {
            appendOutput('[🎤 Voice input not supported in this browser]\n', 'error');
        }
    }

    function switchSession(sessionId) {
        if (currentSessionId) {
            send({ type: 'unsubscribe', sessionId: currentSessionId });
        }

        currentSessionId = sessionId;
        clearOutput();

        if (sessionId) {
            send({ type: 'subscribe', sessionId });
            appendOutput(`[Switched to session ${sessionId}]\n`, 'system');
        }
    }

    function killCurrent() {
        if (currentSessionId) {
            send({ type: 'kill', sessionId: currentSessionId });
        }
    }

    // ==================== UI CONTROLS ====================

    function show() {
        console.log('[ClaudeTerminal] show() called');
        try {
            createUI();
            console.log('[ClaudeTerminal] UI created, element:', terminalElement);
            terminalElement?.classList.remove('hidden');
            console.log('[ClaudeTerminal] Hidden class removed');
            connect();
        } catch (err) {
            console.error('[ClaudeTerminal] Error in show():', err);
        }
    }

    function hide() {
        terminalElement?.classList.add('hidden');
    }

    function toggle() {
        if (terminalElement?.classList.contains('hidden')) {
            show();
        } else {
            hide();
        }
    }

    function toggleMinimize() {
        terminalElement?.classList.toggle('minimized');
    }

    function togglePin() {
        if (!terminalElement) return;
        const isPinned = terminalElement.classList.toggle('pinned');
        const pinBtn = terminalElement.querySelector('.ct-btn-pin');
        if (pinBtn) {
            pinBtn.classList.toggle('pinned', isPinned);
            pinBtn.title = isPinned ? 'Unpin (enable dragging)' : 'Pin (disable dragging)';
        }
    }

    // Snap zones configuration
    const snapConfig = {
        threshold: 30,  // Distance from edge to trigger snap
        zones: {
            left: { x: 0, y: 0, w: 0.5, h: 1 },
            right: { x: 0.5, y: 0, w: 0.5, h: 1 },
            top: { x: 0, y: 0, w: 1, h: 0.5 },
            bottom: { x: 0, y: 0.5, w: 1, h: 0.5 },
            topLeft: { x: 0, y: 0, w: 0.5, h: 0.5 },
            topRight: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
            bottomLeft: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
            bottomRight: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
            full: { x: 0, y: 0, w: 1, h: 1 }
        }
    };

    let snapPreview = null;
    let originalSize = null;
    let isSnapped = false;

    function createSnapPreview() {
        if (snapPreview) return snapPreview;

        snapPreview = document.createElement('div');
        snapPreview.id = 'snap-preview';
        snapPreview.style.cssText = `
            position: fixed;
            background: rgba(74, 158, 255, 0.15);
            border: 2px dashed rgba(74, 158, 255, 0.6);
            border-radius: 8px;
            pointer-events: none;
            z-index: 9999;
            display: none;
            transition: all 0.15s ease;
        `;
        document.body.appendChild(snapPreview);
        return snapPreview;
    }

    function getSnapZone(x, y) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const t = snapConfig.threshold;

        // Corner detection (higher priority)
        if (x < t && y < t) return 'topLeft';
        if (x > vw - t && y < t) return 'topRight';
        if (x < t && y > vh - t) return 'bottomLeft';
        if (x > vw - t && y > vh - t) return 'bottomRight';

        // Top center for full screen
        if (y < t && x > vw * 0.3 && x < vw * 0.7) return 'full';

        // Edge detection
        if (x < t) return 'left';
        if (x > vw - t) return 'right';
        if (y < t) return 'top';
        if (y > vh - t) return 'bottom';

        return null;
    }

    function showSnapPreview(zone) {
        if (!zone) {
            if (snapPreview) snapPreview.style.display = 'none';
            return;
        }

        const preview = createSnapPreview();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const z = snapConfig.zones[zone];
        const gap = 8;

        preview.style.left = (z.x * vw + gap) + 'px';
        preview.style.top = (z.y * vh + gap) + 'px';
        preview.style.width = (z.w * vw - gap * 2) + 'px';
        preview.style.height = (z.h * vh - gap * 2) + 'px';
        preview.style.display = 'block';
    }

    function snapToZone(el, zone) {
        if (!zone) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const z = snapConfig.zones[zone];
        const gap = 8;

        // Save original size before snapping
        if (!isSnapped) {
            originalSize = {
                width: el.offsetWidth,
                height: el.offsetHeight,
                left: el.offsetLeft,
                top: el.offsetTop
            };
        }

        el.style.left = (z.x * vw + gap) + 'px';
        el.style.top = (z.y * vh + gap) + 'px';
        el.style.width = (z.w * vw - gap * 2) + 'px';
        el.style.height = (z.h * vh - gap * 2) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';

        isSnapped = true;
        el.dataset.snapped = zone;
    }

    function unsnap(el) {
        if (originalSize && isSnapped) {
            el.style.width = originalSize.width + 'px';
            el.style.height = originalSize.height + 'px';
            isSnapped = false;
            delete el.dataset.snapped;
        }
    }

    function makeDraggable(el) {
        const header = el.querySelector('.ct-header');
        let isDragging = false;
        let startX, startY, initialX, initialY;
        let pendingSnap = null;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('select')) return;
            if (el.classList.contains('pinned')) return; // Don't drag if pinned
            isDragging = true;
            const rect = el.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;
            el.style.transition = 'none';

            // If currently snapped, restore original size on drag start
            if (isSnapped) {
                unsnap(el);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = (initialX + dx) + 'px';
            el.style.top = (initialY + dy) + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';

            // Check for snap zones
            pendingSnap = getSnapZone(e.clientX, e.clientY);
            showSnapPreview(pendingSnap);
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            el.style.transition = '';

            // Apply snap if in zone
            if (pendingSnap) {
                snapToZone(el, pendingSnap);
            }

            // Hide preview
            showSnapPreview(null);
            pendingSnap = null;
        });

        // Double-click header to toggle maximize
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('button') || e.target.closest('select')) return;

            if (isSnapped && el.dataset.snapped === 'full') {
                unsnap(el);
                if (originalSize) {
                    el.style.left = originalSize.left + 'px';
                    el.style.top = originalSize.top + 'px';
                    el.style.width = originalSize.width + 'px';
                    el.style.height = originalSize.height + 'px';
                }
            } else {
                snapToZone(el, 'full');
            }
        });
    }

    // ==================== INITIALIZATION ====================

    function init() {
        console.log('[ClaudeTerminal] Initializing...');
        // Don't auto-show, wait for user to open it
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        show,
        hide,
        toggle,
        toggleMinimize,
        togglePin,
        toggleVoice,
        spawn,
        sendInput,
        sendPrompt,
        killCurrent,
        clearOutput,
        switchSession,
        get isConnected() { return isConnected; },
        get currentSession() { return currentSessionId; },
        get sessions() { return sessions; },
        get isRecording() { return isRecording; }
    };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ClaudeTerminal.init();
});

window.ClaudeTerminal = ClaudeTerminal;
