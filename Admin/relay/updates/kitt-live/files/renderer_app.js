/**
 * Kitt Live - Renderer Application
 * Chat UI, Voice Recognition, TTS
 */

class KittApp {
    constructor() {
        this.config = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.micLocked = false;  // Keep mic on continuously
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentVoice = null;
        this.messages = [];

        // Wake word detection
        this.wakeWordEnabled = true;
        this.wakeWords = ['hey kitt', 'hey kit', 'ok kitt', 'okay kitt', 'hi kitt'];
        this.wakeWordListening = false;
        this.wakeWordRecognition = null;
        this.awaitingCommand = false;
        this.awaitingTimeout = null;

        this.init();
    }

    async init() {
        // Load config
        this.config = await window.kitt.getConfig();

        // Setup UI
        this.setupElements();
        this.setupEventListeners();
        this.setupVoice();
        this.updateEnvIndicator();

        // Listen for config changes
        window.kitt.on('config-changed', (config) => {
            this.config = config;
            this.updateEnvIndicator();
            this.loadVoice();
        });

        // Listen for push-to-talk hotkey
        window.kitt.on('push-to-talk', () => {
            this.toggleListening();
        });

        // Start wake word detection if enabled
        if (this.wakeWordEnabled) {
            setTimeout(() => this.startWakeWordListening(), 2000);
        }
    }

    setupElements() {
        // Window controls
        this.closeBtn = document.getElementById('closeBtn');
        this.minimizeBtn = document.getElementById('minimizeBtn');
        this.settingsBtn = document.getElementById('settingsBtn');

        // Status
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusDot = this.statusIndicator.querySelector('.status-dot');
        this.statusText = this.statusIndicator.querySelector('.status-text');
        this.envIndicator = document.getElementById('envIndicator');

        // Chat
        this.chatContainer = document.getElementById('chatContainer');

        // Input
        this.voiceBtn = document.getElementById('voiceBtn');
        this.micToggleBtn = document.getElementById('micToggleBtn');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
    }

    setupEventListeners() {
        // Window controls
        this.closeBtn.addEventListener('click', () => window.kitt.closeWindow());
        this.minimizeBtn.addEventListener('click', () => window.kitt.minimizeWindow());
        this.settingsBtn.addEventListener('click', () => window.kitt.openSettings());

        // Environment indicator
        this.envIndicator.addEventListener('click', () => this.toggleEnvironment());

        // Voice button - push to talk
        this.voiceBtn.addEventListener('mousedown', () => {
            if (!this.micLocked) this.startListening();
        });
        this.voiceBtn.addEventListener('mouseup', () => {
            if (!this.micLocked) this.stopListening();
        });
        this.voiceBtn.addEventListener('mouseleave', () => {
            if (this.isListening && !this.micLocked) this.stopListening();
        });

        // Mic toggle button - keep mic on
        this.micToggleBtn.addEventListener('click', () => this.toggleMicLock());

        // Text input
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateSendButton();
        });

        // Send button
        this.sendBtn.addEventListener('click', () => this.sendMessage());
    }

    setupVoice() {
        // Speech Recognition (Web Speech API)
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.voiceBtn.classList.add('listening');
                this.setStatus('listening', 'Listening...');
            };

            this.recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                this.messageInput.value = transcript;
                this.autoResizeInput();
                this.updateSendButton();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.voiceBtn.classList.remove('listening');

                // Auto-send if we have text
                if (this.messageInput.value.trim()) {
                    this.sendMessage();
                }

                // If mic is locked, restart listening
                if (this.micLocked) {
                    setTimeout(() => this.startListening(), 100);
                } else {
                    this.setStatus('ready', 'Ready');
                    // Resume wake word listening if enabled
                    if (this.wakeWordEnabled && !this.wakeWordListening) {
                        this.startWakeWordListening();
                    }
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
                this.voiceBtn.classList.remove('listening');
                this.setStatus('ready', 'Ready');
            };

            // Setup wake word recognition (separate instance for continuous listening)
            this.setupWakeWordRecognition();
        }

        // Load TTS voice
        this.loadVoice();
    }

    setupWakeWordRecognition() {
        if (!('webkitSpeechRecognition' in window)) return;

        this.wakeWordRecognition = new webkitSpeechRecognition();
        this.wakeWordRecognition.continuous = true;
        this.wakeWordRecognition.interimResults = true;
        this.wakeWordRecognition.lang = 'en-US';

        this.wakeWordRecognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();

                // Check for wake word
                for (const wakeWord of this.wakeWords) {
                    if (transcript.includes(wakeWord)) {
                        console.log('[Kitt] Wake word detected:', transcript);
                        this.handleWakeWord();
                        return;
                    }
                }
            }
        };

        this.wakeWordRecognition.onend = () => {
            this.wakeWordListening = false;
            // Auto-restart if wake word mode is enabled and not in main listening mode
            if (this.wakeWordEnabled && !this.isListening && !this.micLocked) {
                setTimeout(() => this.startWakeWordListening(), 500);
            }
        };

        this.wakeWordRecognition.onerror = (event) => {
            if (event.error !== 'aborted') {
                console.error('Wake word recognition error:', event.error);
            }
            this.wakeWordListening = false;
        };
    }

    handleWakeWord() {
        // Stop wake word listening
        this.stopWakeWordListening();

        // Play acknowledgment sound or speak
        this.speak('Yes?');

        // Set awaiting command state
        this.awaitingCommand = true;
        this.setStatus('listening', 'Listening...');

        // Wait for speech to finish, then start listening for command
        setTimeout(() => {
            if (this.awaitingCommand) {
                this.startListening();
            }
        }, 600);

        // Timeout if no command received
        this.awaitingTimeout = setTimeout(() => {
            if (this.awaitingCommand && !this.isListening) {
                this.awaitingCommand = false;
                this.setStatus('ready', 'Ready');
                this.startWakeWordListening();
            }
        }, 10000);
    }

    startWakeWordListening() {
        if (this.wakeWordRecognition && !this.wakeWordListening && !this.isListening && !this.micLocked) {
            try {
                this.wakeWordRecognition.start();
                this.wakeWordListening = true;
                console.log('[Kitt] Wake word listening started');
            } catch (e) {
                // Already started or other error
            }
        }
    }

    stopWakeWordListening() {
        if (this.wakeWordRecognition && this.wakeWordListening) {
            try {
                this.wakeWordRecognition.stop();
                this.wakeWordListening = false;
            } catch (e) {
                // Already stopped
            }
        }
    }

    toggleWakeWord() {
        this.wakeWordEnabled = !this.wakeWordEnabled;
        if (this.wakeWordEnabled) {
            this.startWakeWordListening();
        } else {
            this.stopWakeWordListening();
        }
        return this.wakeWordEnabled;
    }

    async loadVoice() {
        const voiceName = this.config?.voice?.name || 'Microsoft Jenny Online (Natural)';

        // Wait for voices to load
        const loadVoices = () => {
            const voices = this.synthesis.getVoices();
            this.currentVoice = voices.find(v => v.name === voiceName) ||
                               voices.find(v => v.name.includes('Microsoft') && v.name.includes('Natural')) ||
                               voices.find(v => v.lang.startsWith('en'));
        };

        if (this.synthesis.getVoices().length) {
            loadVoices();
        } else {
            this.synthesis.onvoiceschanged = loadVoices;
        }
    }

    startListening() {
        if (this.recognition && !this.isListening) {
            // Stop wake word listening first
            this.stopWakeWordListening();
            this.awaitingCommand = false;
            if (this.awaitingTimeout) {
                clearTimeout(this.awaitingTimeout);
                this.awaitingTimeout = null;
            }

            try {
                this.recognition.start();
            } catch (e) {
                console.error('Failed to start recognition:', e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    toggleMicLock() {
        this.micLocked = !this.micLocked;
        this.micToggleBtn.classList.toggle('locked', this.micLocked);

        // Update icon
        const icon = this.micToggleBtn.querySelector('.toggle-icon');
        icon.textContent = this.micLocked ? '🔓' : '🔒';

        if (this.micLocked) {
            // Start continuous listening
            this.startListening();
            this.setStatus('listening', 'Mic locked on');
        } else {
            // Stop listening
            this.stopListening();
            this.setStatus('ready', 'Ready');
        }
    }

    speak(text) {
        if (!text || this.isSpeaking) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (this.currentVoice) {
            utterance.voice = this.currentVoice;
        }

        utterance.rate = this.config?.voice?.rate || 1.0;
        utterance.pitch = this.config?.voice?.pitch || 1.0;
        utterance.volume = this.config?.voice?.volume || 0.8;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.setStatus('speaking', 'Speaking...');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.setStatus('ready', 'Ready');
        };

        utterance.onerror = (e) => {
            console.error('Speech error:', e);
            this.isSpeaking = false;
            this.setStatus('ready', 'Ready');
        };

        this.synthesis.speak(utterance);
    }

    cancelSpeech() {
        this.synthesis.cancel();
        this.isSpeaking = false;
        this.setStatus('ready', 'Ready');
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text) return;

        // Clear input
        this.messageInput.value = '';
        this.autoResizeInput();
        this.updateSendButton();

        // Add user message
        this.addMessage('user', text);

        // Remove welcome message if present
        const welcome = this.chatContainer.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        // Show thinking indicator
        this.setStatus('thinking', 'Thinking...');
        const typingEl = this.addTypingIndicator();

        try {
            // Send to LLM
            const response = await window.kitt.sendToLLM(text, {
                environment: this.config?.environment?.enabled
            });

            // Remove typing indicator
            typingEl.remove();

            // Add Kitt response
            this.addMessage('kitt', response);

            // Speak response
            if (this.config?.behavior?.showCaptions !== false) {
                this.speak(response);
            }

        } catch (error) {
            typingEl.remove();
            this.addMessage('kitt', 'Sorry, I encountered an error. Please try again.');
            console.error('LLM error:', error);
        }

        this.setStatus('ready', 'Ready');
    }

    addMessage(role, text) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            <div class="message-bubble">${this.escapeHtml(text)}</div>
            <div class="message-time">${time}</div>
        `;

        this.chatContainer.appendChild(messageEl);
        this.scrollToBottom();

        this.messages.push({ role, text, time: new Date() });
    }

    addTypingIndicator() {
        const typingEl = document.createElement('div');
        typingEl.className = 'message kitt';
        typingEl.innerHTML = `
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.chatContainer.appendChild(typingEl);
        this.scrollToBottom();
        return typingEl;
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    setStatus(state, text) {
        this.statusDot.className = 'status-dot ' + state;
        this.statusText.textContent = text;
    }

    updateEnvIndicator() {
        const enabled = this.config?.environment?.enabled;
        this.envIndicator.classList.toggle('enabled', enabled);
        this.envIndicator.querySelector('.env-icon').textContent = enabled ? '🔓' : '🔒';
        this.envIndicator.title = enabled ? 'Environment Access: ON' : 'Environment Access: OFF';
    }

    async toggleEnvironment() {
        const newValue = !this.config?.environment?.enabled;
        await window.kitt.setConfig('environment.enabled', newValue);
    }

    autoResizeInput() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    updateSendButton() {
        this.sendBtn.disabled = !this.messageInput.value.trim();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new KittApp();
