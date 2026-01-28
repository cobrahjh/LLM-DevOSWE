/**
 * Voice Communication Engine v1.0.0
 *
 * Full voice I/O for Admin Kitt
 * - Speech-to-Text (STT) via Web Speech API
 * - Text-to-Speech (TTS) for responses
 * - Push-to-talk or continuous listening modes
 * - Visual feedback
 */

const VoiceEngine = (function() {
    'use strict';

    let recognition = null;
    let synthesis = window.speechSynthesis;
    let isListening = false;
    let isSpeaking = false;
    let voiceEnabled = true;
    let ttsEnabled = true;
    let selectedVoice = null;
    let voiceRate = 0.9;
    let voicePitch = 1.0;
    let voiceVolume = 1.0;
    let autoSubmitDelay = 1.0; // seconds

    const config = {
        continuous: false,      // Keep listening after result
        interimResults: true,   // Show partial results
        lang: 'en-US',
        wakeWord: null,         // Optional wake word like "hey kitt"
        autoSend: true,         // Auto-send after speech ends
        speakResponses: true,   // TTS for responses
        useTeamTasks: true      // Route voice to TeamTasks for assignment
    };

    // Voice queue to prevent overlapping speech
    const voiceQueue = [];
    let isProcessingQueue = false;

    // UI Elements
    let elements = {
        voiceBtn: null,
        voiceStatus: null,
        voiceWave: null,
        voiceOutput: null  // Floating output window
    };

    // Current speech metadata
    let currentSpeechMeta = {
        messageType: 'system',
        persona: 'Heather'
    };

    // Voice output history
    let voiceHistory = [];
    const MAX_VOICE_HISTORY = 50;
    let currentHistoryIndex = -1;

    function init() {
        // Check for Speech Recognition support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[VoiceEngine] Speech Recognition not supported');
            return false;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = config.continuous;
        recognition.interimResults = config.interimResults;
        recognition.lang = config.lang;

        recognition.onstart = handleStart;
        recognition.onend = handleEnd;
        recognition.onresult = handleResult;
        recognition.onerror = handleError;

        // Load preferred voice
        loadVoices();
        synthesis.onvoiceschanged = loadVoices;

        // Load saved TTS enabled state
        loadTTSEnabledState();

        // Load minimized entries state
        loadMinimizedEntries();

        // Create UI elements
        createVoiceUI();

        console.log('[VoiceEngine] Initialized, TTS enabled:', ttsEnabled);
        return true;
    }

    function loadVoices() {
        const voices = synthesis.getVoices();
        if (!voices || voices.length === 0) return;

        // Check localStorage for user-saved voice first
        const savedVoiceName = localStorage.getItem('voice-selected');
        if (savedVoiceName) {
            const savedVoice = voices.find(v => v.name === savedVoiceName) ||
                               voices.find(v => v.name.includes(savedVoiceName));
            if (savedVoice) {
                selectedVoice = savedVoice;
                console.log('[VoiceEngine] Restored saved voice:', selectedVoice.name);
                return;
            }
        }

        // Fallback priority: Heather's Natural voice > any English Natural > Google UK > legacy > any English
        selectedVoice = voices.find(v => v.name.includes('Emma') && v.name.includes('Natural')) ||
                        voices.find(v => /Microsoft.*(Emma|Aria|Ava|Jenny)/i.test(v.name) && v.lang.startsWith('en')) ||
                        voices.find(v => /Microsoft.*Natural/i.test(v.name) && v.lang.startsWith('en')) ||
                        voices.find(v => v.name.includes('Google UK English Female')) ||
                        voices.find(v => v.name.includes('Microsoft David')) ||
                        voices.find(v => v.name.includes('Google US English')) ||
                        voices.find(v => v.lang.startsWith('en')) ||
                        voices[0];

        if (selectedVoice) {
            console.log('[VoiceEngine] Using voice:', selectedVoice.name);
        }
    }

    function createVoiceUI() {
        // Voice status indicator
        let statusDiv = document.getElementById('voice-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'voice-status';
            statusDiv.innerHTML = `
                <div class="voice-indicator">
                    <div class="voice-icon">🎤</div>
                    <div class="voice-wave">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div class="voice-text">Ready</div>
                </div>
            `;
            statusDiv.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(26, 26, 46, 0.95);
                border: 1px solid #4a9eff;
                border-radius: 30px;
                padding: 10px 20px;
                display: none;
                z-index: 10000;
                font-size: 13px;
                color: #e0e0e0;
            `;
            document.body.appendChild(statusDiv);
        }
        elements.voiceStatus = statusDiv;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .voice-indicator {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .voice-icon {
                font-size: 20px;
            }
            .voice-wave {
                display: flex;
                align-items: center;
                gap: 3px;
                height: 20px;
            }
            .voice-wave span {
                width: 3px;
                height: 5px;
                background: #4a9eff;
                border-radius: 2px;
                animation: none;
            }
            .voice-wave.active span {
                animation: wave 0.5s ease-in-out infinite;
            }
            .voice-wave span:nth-child(1) { animation-delay: 0s; }
            .voice-wave span:nth-child(2) { animation-delay: 0.1s; }
            .voice-wave span:nth-child(3) { animation-delay: 0.2s; }
            .voice-wave span:nth-child(4) { animation-delay: 0.1s; }
            .voice-wave span:nth-child(5) { animation-delay: 0s; }
            @keyframes wave {
                0%, 100% { height: 5px; }
                50% { height: 18px; }
            }
            .voice-text {
                min-width: 100px;
            }
            #voice-status.listening {
                border-color: #22c55e;
            }
            #voice-status.listening .voice-icon {
                color: #22c55e;
            }
            #voice-status.speaking {
                border-color: #eab308;
            }
            #voice-status.speaking .voice-icon::after {
                content: '🔊';
                margin-left: 5px;
            }
        `;
        document.head.appendChild(style);

        elements.voiceWave = statusDiv.querySelector('.voice-wave');
        elements.voiceText = statusDiv.querySelector('.voice-text');

        // Create floating voice output window
        createVoiceOutputWindow();
    }

    function createVoiceOutputWindow() {
        let outputDiv = document.getElementById('voice-output-window');
        if (!outputDiv) {
            outputDiv = document.createElement('div');
            outputDiv.id = 'voice-output-window';
            outputDiv.innerHTML = `
                <div class="voice-output-header">
                    <span class="voice-output-title">🎤 Voice Log</span>
                    <span class="voice-nav-counter">0 / 0</span>
                    <button class="voice-output-minimize" id="voice-log-minimize" title="Minimize">▼</button>
                    <button class="voice-output-close" title="Close">×</button>
                </div>
                <div class="voice-output-body">
                    <div class="voice-output-messages"></div>
                    <div class="voice-output-nav">
                        <button class="voice-nav-btn" id="voice-nav-prev" title="Previous">◀</button>
                        <button class="voice-nav-btn voice-nav-pause" id="voice-nav-pause" title="Pause/Resume">⏸</button>
                        <button class="voice-nav-btn" id="voice-nav-next" title="Next">▶</button>
                        <button class="voice-nav-btn voice-nav-replay" id="voice-nav-replay" title="Replay Current">🔄</button>
                        <button class="voice-nav-btn voice-nav-stop" id="voice-nav-stop" title="Stop">⏹</button>
                        <button class="voice-nav-btn voice-nav-settings" id="voice-nav-settings" title="Voice Settings">⚙</button>
                        <button class="voice-nav-btn voice-nav-clear" id="voice-nav-clear" title="Clear History">🗑</button>
                    </div>
                    <div class="voice-settings-panel" id="voice-settings-panel" style="display:none;">
                        <div class="voice-setting-row">
                            <label>🔊 TTS Enabled</label>
                            <input type="checkbox" id="voice-tts-toggle" checked>
                        </div>
                        <div class="voice-setting-row">
                            <label>🗣 Auto-speak</label>
                            <input type="checkbox" id="voice-auto-speak" checked>
                            <span style="font-size:10px;color:#666;">Speak responses</span>
                        </div>
                        <div class="voice-setting-row">
                            <label>📤 Auto-submit</label>
                            <input type="checkbox" id="voice-auto-submit" checked>
                            <span style="font-size:10px;color:#666;">Send after speech</span>
                        </div>
                        <div class="voice-setting-row" id="voice-delay-row">
                            <label>⏱ Delay</label>
                            <input type="range" id="voice-submit-delay" min="0" max="5" step="0.5" value="1">
                            <span id="voice-delay-value">1.0s</span>
                        </div>
                        <div class="voice-setting-row">
                            <label>🎚 Rate</label>
                            <input type="range" id="voice-rate-slider" min="0.5" max="2" step="0.1" value="0.9">
                            <span id="voice-rate-value">0.9x</span>
                        </div>
                        <div class="voice-setting-row">
                            <label>🎵 Pitch</label>
                            <input type="range" id="voice-pitch-slider" min="0.5" max="2" step="0.1" value="1.0">
                            <span id="voice-pitch-value">1.0</span>
                        </div>
                        <div class="voice-setting-row">
                            <label>🔉 Volume</label>
                            <input type="range" id="voice-volume-slider" min="0" max="1" step="0.1" value="1.0">
                            <span id="voice-volume-value">1.0</span>
                        </div>
                        <div class="voice-setting-row">
                            <label>🎤 Voice</label>
                            <select id="voice-select"></select>
                        </div>
                    </div>
                    <div class="voice-output-progress">
                        <div class="voice-output-progress-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(outputDiv);

            // Close button
            outputDiv.querySelector('.voice-output-close').onclick = () => {
                hideVoiceOutput();
            };

            // Minimize button
            document.getElementById('voice-log-minimize').onclick = () => toggleVoiceLogMinimize();

            // Navigation buttons
            document.getElementById('voice-nav-prev').onclick = () => navigateVoiceHistory(-1);
            document.getElementById('voice-nav-next').onclick = () => navigateVoiceHistory(1);
            document.getElementById('voice-nav-replay').onclick = () => replayCurrentVoice();
            document.getElementById('voice-nav-clear').onclick = () => clearVoiceHistory();
            document.getElementById('voice-nav-pause').onclick = () => togglePause();
            document.getElementById('voice-nav-stop').onclick = () => stopSpeaking();
            document.getElementById('voice-nav-settings').onclick = () => toggleSettingsPanel();

            // Settings panel handlers
            document.getElementById('voice-tts-toggle').onchange = (e) => {
                setTTSEnabled(e.target.checked);
            };
            document.getElementById('voice-auto-speak').onchange = (e) => {
                config.speakResponses = e.target.checked;
                localStorage.setItem('voice-auto-speak', e.target.checked);
            };
            document.getElementById('voice-auto-submit').onchange = (e) => {
                config.autoSend = e.target.checked;
                localStorage.setItem('voice-auto-submit', e.target.checked);
                document.getElementById('voice-delay-row').style.display = e.target.checked ? 'flex' : 'none';
            };
            document.getElementById('voice-submit-delay').oninput = (e) => {
                autoSubmitDelay = parseFloat(e.target.value);
                document.getElementById('voice-delay-value').textContent = autoSubmitDelay.toFixed(1) + 's';
                localStorage.setItem('voice-submit-delay', autoSubmitDelay);
            };
            document.getElementById('voice-rate-slider').oninput = (e) => {
                const rate = parseFloat(e.target.value);
                setRate(rate);
                document.getElementById('voice-rate-value').textContent = rate.toFixed(1) + 'x';
                localStorage.setItem('voice-rate', rate);
            };
            document.getElementById('voice-pitch-slider').oninput = (e) => {
                voicePitch = parseFloat(e.target.value);
                document.getElementById('voice-pitch-value').textContent = voicePitch.toFixed(1);
                localStorage.setItem('voice-pitch', voicePitch);
            };
            document.getElementById('voice-volume-slider').oninput = (e) => {
                voiceVolume = parseFloat(e.target.value);
                document.getElementById('voice-volume-value').textContent = voiceVolume.toFixed(1);
                localStorage.setItem('voice-volume', voiceVolume);
            };
            document.getElementById('voice-select').onchange = (e) => {
                setVoice(e.target.value);
                localStorage.setItem('voice-selected', e.target.value);
            };

            // Load saved settings
            loadVoiceSettings();

            // Load saved history from localStorage
            loadVoiceHistory();

            // Load minimized state
            loadVoiceLogMinimizeState();

            // Make draggable
            setupVoiceOutputDrag(outputDiv);
        }
        elements.voiceOutput = outputDiv;

        // Add styles
        const style = document.createElement('style');
        style.id = 'voice-output-styles';
        if (!document.getElementById('voice-output-styles')) {
            style.textContent = `
                #voice-output-window {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    width: 450px;
                    background: rgba(26, 26, 46, 0.95);
                    border: 1px solid #4a9eff;
                    border-radius: 12px;
                    display: none;
                    z-index: 10001;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                #voice-output-window.visible { display: block; }
                #voice-output-window.speaking {
                    border-color: #22c55e;
                    animation: voice-glow 1.5s ease-in-out infinite;
                }
                #voice-output-window.minimized {
                    width: auto;
                    min-width: 150px;
                }
                #voice-output-window.minimized .voice-output-body {
                    display: none;
                }
                .voice-output-minimize {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    padding: 2px 6px;
                    font-size: 12px;
                }
                .voice-output-minimize:hover { color: #fff; }
                @keyframes voice-glow {
                    0%, 100% { box-shadow: 0 8px 32px rgba(34, 197, 94, 0.2); }
                    50% { box-shadow: 0 8px 32px rgba(34, 197, 94, 0.4); }
                }

                .voice-output-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: rgba(0,0,0,0.3);
                    border-bottom: 1px solid #333;
                    cursor: move;
                    user-select: none;
                }
                .voice-output-persona {
                    font-weight: 600;
                    color: #e0e0e0;
                    font-size: 13px;
                }
                .voice-output-type {
                    background: #2a2a3e;
                    color: #4a9eff;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    text-transform: uppercase;
                    margin-left: auto;
                }
                .voice-output-type.response { background: #22c55e33; color: #22c55e; }
                .voice-output-type.idle { background: #f59e0b33; color: #f59e0b; }
                .voice-output-type.error { background: #ef444433; color: #ef4444; }
                .voice-output-type.task { background: #a855f733; color: #a855f7; }
                .voice-output-type.greeting { background: #ec489933; color: #ec4899; }

                .voice-output-close {
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .voice-output-close:hover { background: rgba(255,255,255,0.1); color: #fff; }

                .voice-output-title {
                    font-weight: 600;
                    color: #e0e0e0;
                    font-size: 13px;
                }

                .voice-output-messages {
                    padding: 8px;
                    max-height: 250px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .voice-message-bubble {
                    padding: 10px 12px;
                    background: #1a1a2e;
                    border-radius: 8px;
                    border-left: 3px solid #4a9eff;
                    transition: all 0.2s ease;
                }

                .voice-message-bubble.current {
                    background: #252545;
                    border-left-color: #22c55e;
                    box-shadow: 0 0 8px rgba(34, 197, 94, 0.2);
                }

                .voice-message-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }

                .voice-message-persona {
                    font-weight: 600;
                    font-size: 11px;
                    color: #e0e0e0;
                }

                .voice-message-type {
                    font-size: 9px;
                    padding: 2px 6px;
                    border-radius: 8px;
                    text-transform: uppercase;
                    background: #2a2a3e;
                    color: #4a9eff;
                }
                .voice-message-type.response { background: #22c55e33; color: #22c55e; }
                .voice-message-type.idle { background: #f59e0b33; color: #f59e0b; }
                .voice-message-type.error { background: #ef444433; color: #ef4444; }
                .voice-message-type.task { background: #a855f733; color: #a855f7; }
                .voice-message-type.greeting { background: #ec489933; color: #ec4899; }

                .voice-message-time {
                    font-size: 10px;
                    color: #666;
                    margin-left: auto;
                }

                .voice-message-text {
                    font-size: 12px;
                    color: #c0c0c0;
                    line-height: 1.4;
                    word-break: break-word;
                }

                .voice-message-minimize {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 2px 4px;
                    font-size: 10px;
                    margin-left: 4px;
                }
                .voice-message-minimize:hover { color: #fff; }

                .voice-message-bubble.entry-minimized .voice-message-text {
                    display: none;
                }
                .voice-message-bubble.entry-minimized {
                    padding: 6px 10px;
                }
                .voice-message-bubble.entry-minimized .voice-message-header {
                    margin-bottom: 0;
                }

                .voice-output-nav {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: rgba(0,0,0,0.2);
                    border-top: 1px solid #333;
                }
                .voice-nav-btn {
                    background: #2a2a3e;
                    border: 1px solid #444;
                    color: #aaa;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }
                .voice-nav-btn:hover {
                    background: #3a3a4e;
                    color: #fff;
                    border-color: #4a9eff;
                }
                .voice-nav-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                .voice-nav-counter {
                    color: #888;
                    font-size: 11px;
                    min-width: 50px;
                    text-align: center;
                }
                .voice-nav-replay {
                    margin-left: 8px;
                }
                .voice-nav-clear {
                    margin-left: auto;
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ef4444 !important;
                }
                .voice-nav-clear:hover {
                    background: rgba(239, 68, 68, 0.4) !important;
                }
                .voice-nav-pause.paused {
                    background: rgba(34, 197, 94, 0.3) !important;
                    color: #22c55e !important;
                }
                .voice-nav-stop {
                    background: rgba(239, 68, 68, 0.2) !important;
                    color: #ef4444 !important;
                }
                .voice-nav-stop:hover {
                    background: rgba(239, 68, 68, 0.4) !important;
                }
                .voice-nav-settings {
                    margin-left: auto;
                }

                .voice-settings-panel {
                    padding: 12px;
                    background: rgba(0,0,0,0.3);
                    border-top: 1px solid #333;
                }
                .voice-setting-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                .voice-setting-row:last-child {
                    margin-bottom: 0;
                }
                .voice-setting-row label {
                    font-size: 11px;
                    color: #aaa;
                    min-width: 80px;
                }
                .voice-setting-row input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                .voice-setting-row input[type="range"] {
                    flex: 1;
                    cursor: pointer;
                }
                .voice-setting-row select {
                    flex: 1;
                    background: #2a2a3e;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: #e0e0e0;
                    padding: 4px 8px;
                    font-size: 11px;
                    cursor: pointer;
                }
                .voice-setting-row span {
                    font-size: 11px;
                    color: #888;
                    min-width: 35px;
                }

                .voice-output-progress {
                    height: 3px;
                    background: rgba(255,255,255,0.1);
                }
                .voice-output-progress-bar {
                    height: 100%;
                    width: 0%;
                    background: linear-gradient(90deg, #4a9eff, #22c55e);
                    transition: width 0.3s linear;
                }
            `;
            document.head.appendChild(style);
        }

        // Load position from localStorage
        const savedPos = localStorage.getItem('voice-output-position');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                if (pos.top) outputDiv.style.top = pos.top;
                if (pos.right) outputDiv.style.right = pos.right;
                if (pos.left) {
                    outputDiv.style.left = pos.left;
                    outputDiv.style.right = 'auto';
                }
            } catch (e) {}
        }
    }

    function setupVoiceOutputDrag(element) {
        const header = element.querySelector('.voice-output-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = element.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            element.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = (startLeft + dx) + 'px';
            element.style.top = (startTop + dy) + 'px';
            element.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.transition = '';
                // Save position
                localStorage.setItem('voice-output-position', JSON.stringify({
                    top: element.style.top,
                    left: element.style.left
                }));
            }
        });
    }

    function showVoiceOutput(text, options = {}) {
        if (!elements.voiceOutput) return;

        const persona = options.persona || currentSpeechMeta.persona || 'Heather';
        const messageType = options.messageType || currentSpeechMeta.messageType || 'system';

        // Add to history
        const historyEntry = {
            text,
            persona,
            messageType,
            timestamp: new Date().toLocaleTimeString(),
            voiceOptions: { ...options }
        };
        voiceHistory.push(historyEntry);
        if (voiceHistory.length > MAX_VOICE_HISTORY) {
            voiceHistory.shift();
        }
        currentHistoryIndex = voiceHistory.length - 1;

        // Save to localStorage
        saveVoiceHistory();

        // Update display
        displayVoiceEntry(historyEntry);
        updateVoiceNavCounter();

        console.log('[VoiceEngine] Added to history:', historyEntry.text.substring(0, 50) + '...');

        elements.voiceOutput.classList.add('visible', 'speaking');

        // Reset and animate progress bar
        const progressBar = elements.voiceOutput.querySelector('.voice-output-progress-bar');
        progressBar.style.width = '0%';

        const wordsPerMin = 150;
        const wordCount = text.split(/\s+/).length;
        const durationMs = (wordCount / wordsPerMin) * 60 * 1000;

        progressBar.style.transition = `width ${durationMs}ms linear`;
        requestAnimationFrame(() => {
            progressBar.style.width = '100%';
        });
    }

    function displayVoiceEntry(entry) {
        renderAllMessages();
    }

    // Track minimized entries
    let minimizedEntries = new Set();

    function renderAllMessages() {
        if (!elements.voiceOutput) return;

        const container = elements.voiceOutput.querySelector('.voice-output-messages');
        if (!container) return;

        // Show last 10 messages max for performance
        const displayHistory = voiceHistory.slice(-10);
        const offset = Math.max(0, voiceHistory.length - 10);

        container.innerHTML = displayHistory.map((entry, idx) => {
            const actualIdx = offset + idx;
            const isCurrent = actualIdx === currentHistoryIndex;
            const isMinimized = minimizedEntries.has(actualIdx);
            return `
                <div class="voice-message-bubble ${isCurrent ? 'current' : ''} ${isMinimized ? 'entry-minimized' : ''}" data-index="${actualIdx}">
                    <div class="voice-message-header">
                        <span class="voice-message-persona">🎤 ${entry.persona}</span>
                        <span class="voice-message-type ${entry.messageType}">${entry.messageType}</span>
                        <span class="voice-message-time">${entry.timestamp}</span>
                        <button class="voice-message-minimize" data-idx="${actualIdx}" title="${isMinimized ? 'Expand' : 'Minimize'}">${isMinimized ? '▼' : '▲'}</button>
                    </div>
                    <div class="voice-message-text">${escapeHtml(entry.text)}</div>
                </div>
            `;
        }).join('');

        // Scroll to current message
        const currentBubble = container.querySelector('.voice-message-bubble.current');
        if (currentBubble) {
            currentBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Click handler to select message
        container.querySelectorAll('.voice-message-bubble').forEach(bubble => {
            bubble.onclick = (e) => {
                // Don't select if clicking minimize button
                if (e.target.classList.contains('voice-message-minimize')) return;

                const idx = parseInt(bubble.dataset.index);
                if (!isNaN(idx)) {
                    currentHistoryIndex = idx;
                    renderAllMessages();
                    updateVoiceNavCounter();
                }
            };
        });

        // Minimize button handlers
        container.querySelectorAll('.voice-message-minimize').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                toggleEntryMinimize(idx);
            };
        });
    }

    function toggleEntryMinimize(idx) {
        if (minimizedEntries.has(idx)) {
            minimizedEntries.delete(idx);
        } else {
            minimizedEntries.add(idx);
        }
        saveMinimizedEntries();
        renderAllMessages();
    }

    function saveMinimizedEntries() {
        try {
            localStorage.setItem('voice-minimized-entries', JSON.stringify([...minimizedEntries]));
        } catch (e) {}
    }

    function loadMinimizedEntries() {
        try {
            const saved = localStorage.getItem('voice-minimized-entries');
            if (saved) {
                minimizedEntries = new Set(JSON.parse(saved));
            }
        } catch (e) {}
    }

    // Voice log window minimize
    let voiceLogMinimized = false;

    function toggleVoiceLogMinimize() {
        voiceLogMinimized = !voiceLogMinimized;
        if (elements.voiceOutput) {
            elements.voiceOutput.classList.toggle('minimized', voiceLogMinimized);
            const btn = document.getElementById('voice-log-minimize');
            if (btn) btn.textContent = voiceLogMinimized ? '▲' : '▼';
        }
        localStorage.setItem('voice-log-minimized', voiceLogMinimized ? 'true' : 'false');
    }

    function loadVoiceLogMinimizeState() {
        voiceLogMinimized = localStorage.getItem('voice-log-minimized') === 'true';
        if (elements.voiceOutput && voiceLogMinimized) {
            elements.voiceOutput.classList.add('minimized');
            const btn = document.getElementById('voice-log-minimize');
            if (btn) btn.textContent = '▲';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updateVoiceNavCounter() {
        const counter = elements.voiceOutput?.querySelector('.voice-nav-counter');
        if (counter) {
            counter.textContent = `${currentHistoryIndex + 1} / ${voiceHistory.length}`;
        }

        // Update button states
        const prevBtn = document.getElementById('voice-nav-prev');
        const nextBtn = document.getElementById('voice-nav-next');
        if (prevBtn) prevBtn.disabled = currentHistoryIndex <= 0;
        if (nextBtn) nextBtn.disabled = currentHistoryIndex >= voiceHistory.length - 1;
    }

    function navigateVoiceHistory(direction) {
        const newIndex = currentHistoryIndex + direction;
        if (newIndex < 0 || newIndex >= voiceHistory.length) return;

        currentHistoryIndex = newIndex;
        displayVoiceEntry(voiceHistory[currentHistoryIndex]);
        updateVoiceNavCounter();

        // Show window if hidden
        if (elements.voiceOutput) {
            elements.voiceOutput.classList.add('visible');
            elements.voiceOutput.classList.remove('speaking');
        }
    }

    function replayCurrentVoice() {
        if (currentHistoryIndex < 0 || currentHistoryIndex >= voiceHistory.length) return;

        const entry = voiceHistory[currentHistoryIndex];
        speakNow(entry.text, entry.voiceOptions);
    }

    function saveVoiceHistory() {
        try {
            localStorage.setItem('voice-output-history', JSON.stringify(voiceHistory));
            console.log('[VoiceEngine] Saved', voiceHistory.length, 'history entries');
        } catch (e) {
            console.warn('[VoiceEngine] Failed to save history:', e);
        }
    }

    function loadVoiceHistory() {
        try {
            const saved = localStorage.getItem('voice-output-history');
            if (saved) {
                voiceHistory = JSON.parse(saved);
                currentHistoryIndex = voiceHistory.length > 0 ? voiceHistory.length - 1 : -1;
                updateVoiceNavCounter();
                if (voiceHistory.length > 0) {
                    displayVoiceEntry(voiceHistory[currentHistoryIndex]);
                    elements.voiceOutput?.classList.add('visible');
                }
                console.log('[VoiceEngine] Loaded', voiceHistory.length, 'history entries');
            }
        } catch (e) {
            console.warn('[VoiceEngine] Failed to load history:', e);
        }
    }

    function clearVoiceHistory() {
        voiceHistory = [];
        currentHistoryIndex = -1;
        localStorage.removeItem('voice-output-history');
        updateVoiceNavCounter();
        if (elements.voiceOutput) {
            const container = elements.voiceOutput.querySelector('.voice-output-messages');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        History cleared
                    </div>
                `;
            }
        }
        console.log('[VoiceEngine] History cleared');
    }

    function hideVoiceOutput() {
        if (!elements.voiceOutput) return;
        elements.voiceOutput.classList.remove('visible', 'speaking');
    }

    function showStatus(text, type = '') {
        if (!elements.voiceStatus) return;
        elements.voiceStatus.style.display = 'block';
        elements.voiceStatus.className = type;
        elements.voiceText.textContent = text;

        if (type === 'listening') {
            elements.voiceWave.classList.add('active');
        } else {
            elements.voiceWave.classList.remove('active');
        }
    }

    function hideStatus() {
        if (elements.voiceStatus) {
            elements.voiceStatus.style.display = 'none';
            elements.voiceWave.classList.remove('active');
        }
    }

    function handleStart() {
        isListening = true;
        showStatus('Listening...', 'listening');
        console.log('[VoiceEngine] Started listening');
    }

    function handleEnd() {
        isListening = false;
        if (!isSpeaking) {
            hideStatus();
        }
        console.log('[VoiceEngine] Stopped listening');
    }

    function handleResult(event) {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript.trim();

        if (lastResult.isFinal) {
            console.log('[VoiceEngine] Final:', transcript);
            showStatus(`"${transcript}"`, '');

            // Check for wake word
            if (config.wakeWord && !transcript.toLowerCase().includes(config.wakeWord)) {
                setTimeout(hideStatus, 1500);
                return;
            }

            // Remove wake word from transcript
            let message = transcript;
            if (config.wakeWord) {
                message = transcript.toLowerCase().replace(config.wakeWord, '').trim();
            }

            // Try TeamTasks first for task assignment
            if (config.useTeamTasks && typeof TeamTasks !== 'undefined') {
                const handled = TeamTasks.handleVoiceTask(message);
                if (handled) {
                    console.log('[VoiceEngine] Task assigned to team member');
                    setTimeout(hideStatus, 2000);
                    return;
                }
            }

            // Send to Kitt if not a team task (with optional delay)
            if (config.autoSend && message && typeof AdminKitt !== 'undefined') {
                if (autoSubmitDelay > 0) {
                    showStatus(`Sending in ${autoSubmitDelay}s...`, '');
                    setTimeout(() => {
                        AdminKitt.sendQuick(message);
                        hideStatus();
                    }, autoSubmitDelay * 1000);
                } else {
                    AdminKitt.sendQuick(message);
                    setTimeout(hideStatus, 2000);
                }
            } else {
                setTimeout(hideStatus, 2000);
            }
        } else {
            // Interim result
            showStatus(`"${transcript}..."`, 'listening');
        }
    }

    function handleError(event) {
        console.error('[VoiceEngine] Error:', event.error);
        showStatus(`Error: ${event.error}`, '');
        setTimeout(hideStatus, 2000);
        isListening = false;
    }

    function startListening() {
        if (!recognition || isListening) return;

        // Stop TTS if speaking
        if (isSpeaking) {
            stopSpeaking();
        }

        try {
            recognition.start();
        } catch (e) {
            console.error('[VoiceEngine] Start error:', e);
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            recognition.stop();
        }
    }

    function toggleListening() {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
        return isListening;
    }

    function speak(text, options = {}) {
        if (!synthesis || !ttsEnabled) return Promise.resolve();

        // If immediate/force, speak now; otherwise queue
        if (options.immediate || options.force) {
            return speakNow(text, options);
        }

        // Add to queue
        return new Promise((resolve) => {
            voiceQueue.push({ text, options, resolve });
            processVoiceQueue();
        });
    }

    function processVoiceQueue() {
        if (isProcessingQueue || voiceQueue.length === 0 || isSpeaking) return;

        isProcessingQueue = true;
        const item = voiceQueue.shift();

        speakNow(item.text, item.options).then(() => {
            item.resolve();
            isProcessingQueue = false;
            // Process next in queue after small delay
            setTimeout(processVoiceQueue, 300);
        });
    }

    function speakNow(text, options = {}) {
        if (!synthesis || !ttsEnabled) return Promise.resolve();

        return new Promise((resolve) => {
            // Cancel any current speech if forcing
            if (options.force) {
                synthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);

            // Support voice name override (for alternate personas like ShiZhenXiang)
            let voice = selectedVoice;
            let persona = 'Heather';
            if (options.voiceName) {
                const voices = synthesis.getVoices();
                console.log('[VoiceEngine] Looking for voice:', options.voiceName, 'in', voices.length, 'voices');

                // Try exact match first, then partial match
                const exactMatch = voices.find(v => v.name === options.voiceName);
                const partialMatch = voices.find(v => v.name.includes(options.voiceName));

                if (exactMatch) {
                    voice = exactMatch;
                    console.log('[VoiceEngine] Found exact match:', voice.name);
                } else if (partialMatch) {
                    voice = partialMatch;
                    console.log('[VoiceEngine] Found partial match:', voice.name);
                } else {
                    console.warn('[VoiceEngine] Voice not found:', options.voiceName, '- using default');
                }

                // Detect persona from voice name
                if (options.voiceName.includes('粵語') || options.voiceName.includes('Cantonese')) {
                    persona = 'Shǐ zhēn xiāng';
                }
            } else if (options.voice) {
                voice = options.voice;
            }
            if (options.persona) persona = options.persona;

            // Store metadata for floating window
            currentSpeechMeta.persona = persona;
            currentSpeechMeta.messageType = options.messageType || 'system';

            utterance.voice = voice;
            utterance.rate = options.rate || voiceRate;
            utterance.pitch = options.pitch || voicePitch;
            utterance.volume = options.volume || voiceVolume;

            utterance.onstart = () => {
                isSpeaking = true;
                showStatus('Speaking...', 'speaking');
                // Show floating voice output window
                showVoiceOutput(text, {
                    persona,
                    messageType: options.messageType || 'system'
                });
            };

            utterance.onend = () => {
                isSpeaking = false;
                isPaused = false;
                updatePauseButton();
                hideStatus();
                // Remove speaking state but keep window visible for history browsing
                if (elements.voiceOutput) {
                    elements.voiceOutput.classList.remove('speaking');
                }
                resolve();
            };

            utterance.onerror = (e) => {
                isSpeaking = false;
                hideStatus();
                hideVoiceOutput();
                console.error('[VoiceEngine] TTS error:', e);
                resolve();
            };

            synthesis.speak(utterance);
        });
    }

    function stopSpeaking() {
        if (synthesis) {
            synthesis.cancel();
            isSpeaking = false;
            isPaused = false;
            updatePauseButton();
            hideStatus();
            // Don't hide voice output on stop - keep history visible
            if (elements.voiceOutput) {
                elements.voiceOutput.classList.remove('speaking');
            }
        }
    }

    // Hook into Kitt responses for auto-TTS
    function speakResponse(text) {
        if (!config.speakResponses || !ttsEnabled) return;

        // Clean up text for speech (remove markdown, code blocks, etc)
        let cleanText = text
            .replace(/```[\s\S]*?```/g, 'code block')
            .replace(/`[^`]+`/g, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/#{1,6}\s*/g, '')
            .replace(/\n+/g, '. ')
            .trim();

        // Limit length for TTS
        if (cleanText.length > 500) {
            cleanText = cleanText.substring(0, 500) + '... and more.';
        }

        speak(cleanText);
    }

    function setVoiceEnabled(enabled) {
        voiceEnabled = enabled;
        console.log('[VoiceEngine] Voice:', enabled ? 'enabled' : 'disabled');
    }

    function setTTSEnabled(enabled) {
        ttsEnabled = enabled;
        if (!enabled) stopSpeaking();
        localStorage.setItem('voice-tts-enabled', enabled ? 'true' : 'false');
        console.log('[VoiceEngine] TTS:', enabled ? 'enabled' : 'disabled');
    }

    function setConfig(newConfig) {
        Object.assign(config, newConfig);
        if (recognition) {
            recognition.continuous = config.continuous;
            recognition.interimResults = config.interimResults;
            recognition.lang = config.lang;
        }
    }

    function getVoices() {
        return synthesis ? synthesis.getVoices() : [];
    }

    function setVoice(voiceName) {
        const voices = getVoices();
        const newVoice = voices.find(v => v.name === voiceName);
        if (newVoice) {
            selectedVoice = newVoice;
            localStorage.setItem('voice-selected', voiceName);
            console.log('[VoiceEngine] Voice changed to:', voiceName);
        }
    }

    function setRate(rate) {
        voiceRate = parseFloat(rate) || 1.0;
        console.log('[VoiceEngine] Rate set to:', voiceRate);
    }

    function setEnabled(enabled) {
        ttsEnabled = !!enabled;
        localStorage.setItem('voice-tts-enabled', enabled ? 'true' : 'false');
        console.log('[VoiceEngine] TTS enabled:', ttsEnabled);
    }

    function loadTTSEnabledState() {
        const saved = localStorage.getItem('voice-tts-enabled');
        if (saved !== null) {
            ttsEnabled = saved === 'true';
            console.log('[VoiceEngine] Loaded TTS enabled state:', ttsEnabled);
        }
    }

    // Pause/Resume speech
    let isPaused = false;

    function togglePause() {
        if (!synthesis) return;

        const pauseBtn = document.getElementById('voice-nav-pause');

        if (isPaused) {
            synthesis.resume();
            isPaused = false;
            if (pauseBtn) {
                pauseBtn.textContent = '⏸';
                pauseBtn.classList.remove('paused');
                pauseBtn.title = 'Pause';
            }
            console.log('[VoiceEngine] Resumed');
        } else {
            synthesis.pause();
            isPaused = true;
            if (pauseBtn) {
                pauseBtn.textContent = '▶';
                pauseBtn.classList.add('paused');
                pauseBtn.title = 'Resume';
            }
            console.log('[VoiceEngine] Paused');
        }
    }

    function pauseSpeaking() {
        if (synthesis && !isPaused) {
            synthesis.pause();
            isPaused = true;
            updatePauseButton();
        }
    }

    function resumeSpeaking() {
        if (synthesis && isPaused) {
            synthesis.resume();
            isPaused = false;
            updatePauseButton();
        }
    }

    function updatePauseButton() {
        const pauseBtn = document.getElementById('voice-nav-pause');
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? '▶' : '⏸';
            pauseBtn.classList.toggle('paused', isPaused);
            pauseBtn.title = isPaused ? 'Resume' : 'Pause';
        }
    }

    // Settings panel toggle
    let settingsPanelVisible = false;

    function toggleSettingsPanel() {
        const panel = document.getElementById('voice-settings-panel');
        if (!panel) return;

        settingsPanelVisible = !settingsPanelVisible;
        panel.style.display = settingsPanelVisible ? 'block' : 'none';

        // Populate voice selector if opening
        if (settingsPanelVisible) {
            populateVoiceSelector();
        }
    }

    function populateVoiceSelector() {
        const select = document.getElementById('voice-select');
        if (!select) return;

        const voices = synthesis.getVoices();
        select.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (selectedVoice && voice.name === selectedVoice.name) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    function loadVoiceSettings() {
        // Load rate
        const savedRate = localStorage.getItem('voice-rate');
        if (savedRate) {
            voiceRate = parseFloat(savedRate);
            const slider = document.getElementById('voice-rate-slider');
            const value = document.getElementById('voice-rate-value');
            if (slider) slider.value = voiceRate;
            if (value) value.textContent = voiceRate.toFixed(1) + 'x';
        }

        // Load pitch
        const savedPitch = localStorage.getItem('voice-pitch');
        if (savedPitch) {
            voicePitch = parseFloat(savedPitch);
            const slider = document.getElementById('voice-pitch-slider');
            const value = document.getElementById('voice-pitch-value');
            if (slider) slider.value = voicePitch;
            if (value) value.textContent = voicePitch.toFixed(1);
        }

        // Load volume
        const savedVolume = localStorage.getItem('voice-volume');
        if (savedVolume) {
            voiceVolume = parseFloat(savedVolume);
            const slider = document.getElementById('voice-volume-slider');
            const value = document.getElementById('voice-volume-value');
            if (slider) slider.value = voiceVolume;
            if (value) value.textContent = voiceVolume.toFixed(1);
        }

        // Load auto-speak
        const savedAutoSpeak = localStorage.getItem('voice-auto-speak');
        if (savedAutoSpeak !== null) {
            config.speakResponses = savedAutoSpeak === 'true';
            const toggle = document.getElementById('voice-auto-speak');
            if (toggle) toggle.checked = config.speakResponses;
        }

        // Load auto-submit
        const savedAutoSubmit = localStorage.getItem('voice-auto-submit');
        if (savedAutoSubmit !== null) {
            config.autoSend = savedAutoSubmit === 'true';
            const toggle = document.getElementById('voice-auto-submit');
            if (toggle) toggle.checked = config.autoSend;
            const delayRow = document.getElementById('voice-delay-row');
            if (delayRow) delayRow.style.display = config.autoSend ? 'flex' : 'none';
        }

        // Load submit delay
        const savedDelay = localStorage.getItem('voice-submit-delay');
        if (savedDelay) {
            autoSubmitDelay = parseFloat(savedDelay);
            const slider = document.getElementById('voice-submit-delay');
            const value = document.getElementById('voice-delay-value');
            if (slider) slider.value = autoSubmitDelay;
            if (value) value.textContent = autoSubmitDelay.toFixed(1) + 's';
        }

        // Load TTS enabled state
        const ttsToggle = document.getElementById('voice-tts-toggle');
        if (ttsToggle) {
            ttsToggle.checked = ttsEnabled;
        }

        // Load selected voice (after voices are loaded)
        setTimeout(() => {
            const savedVoice = localStorage.getItem('voice-selected');
            if (savedVoice) {
                setVoice(savedVoice);
                const select = document.getElementById('voice-select');
                if (select) select.value = savedVoice;
            }
        }, 500);

        console.log('[VoiceEngine] Settings loaded');
    }

    function getSelectedVoice() {
        return selectedVoice;
    }

    function clearVoiceQueue() {
        voiceQueue.length = 0;
        console.log('[VoiceEngine] Voice queue cleared');
    }

    function getQueueLength() {
        return voiceQueue.length;
    }

    return {
        init,
        startListening,
        stopListening,
        toggleListening,
        speak,
        speakNow,
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        togglePause,
        speakResponse,
        setVoiceEnabled,
        setTTSEnabled,
        setConfig,
        getVoices,
        setVoice,
        setRate,
        setEnabled,
        getSelectedVoice,
        clearVoiceQueue,
        getQueueLength,
        showVoiceOutput,
        hideVoiceOutput,
        clearVoiceHistory,
        loadVoiceHistory,
        toggleSettingsPanel,
        get voiceHistory() { return voiceHistory; },
        get isListening() { return isListening; },
        get isSpeaking() { return isSpeaking; },
        get isPaused() { return isPaused; },
        get config() { return config; }
    };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    VoiceEngine.init();
});

// Export
if (typeof module !== 'undefined') module.exports = { VoiceEngine };
