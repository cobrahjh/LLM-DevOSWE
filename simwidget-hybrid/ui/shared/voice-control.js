/**
 * Voice Control Module - SimGlass
 * Web Speech API voice recognition for hands-free control
 *
 * Commands:
 *   "check" / "next" - Check next item
 *   "uncheck" / "back" - Uncheck last item
 *   "reset" - Reset current checklist
 *   "next checklist" - Go to next checklist
 *   "previous checklist" - Go to previous checklist
 *   "go to [checklist]" - Switch to specific checklist
 */

class VoiceControl {
    constructor(options = {}) {
        this.enabled = false;
        this.listening = false;
        this.recognition = null;
        this.onCommand = options.onCommand || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
        this.onTranscript = options.onTranscript || (() => {});
        this.continuous = options.continuous !== false;
        this.language = options.language || 'en-US';

        // Command patterns
        this.commands = {
            check: /^(check|checked|next|next item|roger|affirm|done)$/i,
            uncheck: /^(uncheck|undo|back|go back|previous item)$/i,
            reset: /^(reset|reset checklist|clear|start over)$/i,
            nextChecklist: /^(next checklist|next list|skip)$/i,
            prevChecklist: /^(previous checklist|prev checklist|back checklist)$/i,
            gotoChecklist: /^(go to|switch to|open)\s+(.+)$/i,
            toggleAudio: /^(toggle audio|mute|unmute|audio)$/i,
            stop: /^(stop listening|stop voice|disable voice)$/i
        };

        // Checklist name mappings
        this.checklistAliases = {
            'preflight': ['preflight', 'pre-flight', 'pre flight', 'before flight'],
            'startup': ['startup', 'start up', 'engine start', 'start'],
            'taxi': ['taxi', 'taxiing', 'before taxi'],
            'takeoff': ['takeoff', 'take off', 'before takeoff', 'departure'],
            'cruise': ['cruise', 'cruising', 'en route', 'enroute'],
            'landing': ['landing', 'approach', 'before landing', 'arrival'],
            'shutdown': ['shutdown', 'shut down', 'parking', 'securing']
        };

        this.init();
    }

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('[Voice] Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.continuous;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;

        this.recognition.onstart = () => {
            this.listening = true;
            this.onStatusChange({ listening: true, enabled: this.enabled });
        };

        this.recognition.onend = () => {
            this.listening = false;
            this.onStatusChange({ listening: false, enabled: this.enabled });

            // Auto-restart if still enabled
            if (this.enabled && this.continuous) {
                setTimeout(() => {
                    if (this.enabled) this.startListening();
                }, 100);
            }
        };

        this.recognition.onerror = (event) => {
            console.warn('[Voice] Error:', event.error);
            if (event.error === 'not-allowed') {
                this.enabled = false;
                this.onStatusChange({ listening: false, enabled: false, error: 'Microphone access denied' });
            }
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                if (event.results[i].isFinal) {
                    finalTranscript = transcript;
                } else {
                    interimTranscript = transcript;
                }
            }

            this.onTranscript({ final: finalTranscript, interim: interimTranscript });

            if (finalTranscript) {
                this.processCommand(finalTranscript);
            }
        };
    }

    processCommand(transcript) {
        const text = transcript.toLowerCase().trim();

        // Check each command pattern
        if (this.commands.check.test(text)) {
            this.sendCommand('checkNext');
            return;
        }

        if (this.commands.uncheck.test(text)) {
            this.sendCommand('uncheckLast');
            return;
        }

        if (this.commands.reset.test(text)) {
            this.sendCommand('reset');
            return;
        }

        if (this.commands.nextChecklist.test(text)) {
            this.sendCommand('nextChecklist');
            return;
        }

        if (this.commands.prevChecklist.test(text)) {
            this.sendCommand('prevChecklist');
            return;
        }

        if (this.commands.toggleAudio.test(text)) {
            this.sendCommand('toggleAudio');
            return;
        }

        if (this.commands.stop.test(text)) {
            this.disable();
            return;
        }

        // Check for goto command
        const gotoMatch = text.match(this.commands.gotoChecklist);
        if (gotoMatch) {
            const target = this.resolveChecklistName(gotoMatch[2]);
            if (target) {
                this.sendCommand('goto', { target });
            }
            return;
        }

        // Try to match checklist name directly
        const directMatch = this.resolveChecklistName(text);
        if (directMatch) {
            this.sendCommand('goto', { target: directMatch });
        }
    }

    resolveChecklistName(spoken) {
        const text = spoken.toLowerCase().trim();

        for (const [key, aliases] of Object.entries(this.checklistAliases)) {
            if (aliases.some(alias => text.includes(alias))) {
                return key;
            }
        }

        return null;
    }

    sendCommand(action, data = {}) {
        const command = {
            type: 'checklist',
            action,
            ...data,
            timestamp: Date.now()
        };

        // Send via BroadcastChannel
        try {
            const channel = new SafeChannel('SimGlass-checklist');
            channel.postMessage(command);
            channel.close();
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'sendCommand',
                    component: 'VoiceControl',
                    channel: 'BroadcastChannel'
                });
            }
        }

        // Also send via localStorage for cross-origin support
        try {
            localStorage.setItem('SimGlass-checklist-command', JSON.stringify(command));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'sendCommand',
                    component: 'VoiceControl',
                    channel: 'localStorage'
                });
            }
        }

        // Callback
        this.onCommand(command);
    }

    enable() {
        if (!this.recognition) {
            console.warn('[Voice] Not supported');
            return false;
        }

        this.enabled = true;
        this.startListening();
        return true;
    }

    disable() {
        this.enabled = false;
        this.stopListening();
    }

    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }

    startListening() {
        if (!this.recognition || this.listening) return;

        try {
            this.recognition.start();
        } catch (e) {
            // Already started
        }
    }

    stopListening() {
        if (!this.recognition || !this.listening) return;

        try {
            this.recognition.stop();
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'stopListening',
                    component: 'VoiceControl'
                });
            }
        }
    }

    isSupported() {
        return !!this.recognition;
    }
}

// Voice control UI component
class VoiceControlUI {
    constructor(voiceControl, container) {
        this.voice = voiceControl;
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        this.render();
        this.bindEvents();
    }

    render() {
        if (!this.container) return;

        const el = document.createElement('div');
        el.className = 'voice-control-ui';

        const btn = document.createElement('button');
        btn.className = 'voice-btn';
        btn.title = 'Voice Control';

        const icon = document.createElement('span');
        icon.className = 'voice-icon';
        icon.textContent = '🎤';

        const status = document.createElement('span');
        status.className = 'voice-status';

        btn.appendChild(icon);
        btn.appendChild(status);

        const transcript = document.createElement('div');
        transcript.className = 'voice-transcript';

        el.appendChild(btn);
        el.appendChild(transcript);

        this.container.appendChild(el);
        this.element = el;
        this.btn = btn;
        this.statusEl = status;
        this.transcriptEl = transcript;

        // Update UI based on support
        if (!this.voice.isSupported()) {
            this.btn.disabled = true;
            this.btn.title = 'Voice not supported in this browser';
        }
    }

    bindEvents() {
        this.btn.addEventListener('click', () => {
            this.voice.toggle();
        });

        this.voice.onStatusChange = (status) => {
            this.element.classList.toggle('enabled', status.enabled);
            this.element.classList.toggle('listening', status.listening);
            this.statusEl.textContent = status.listening ? 'Listening...' : '';

            if (status.error) {
                this.statusEl.textContent = status.error;
            }
        };

        this.voice.onTranscript = ({ final, interim }) => {
            if (final) {
                this.transcriptEl.textContent = final;
                this.transcriptEl.classList.add('final');
                setTimeout(() => {
                    this.transcriptEl.classList.remove('final');
                    this.transcriptEl.textContent = '';
                }, 2000);
            } else if (interim) {
                this.transcriptEl.textContent = interim;
                this.transcriptEl.classList.remove('final');
            }
        };

        this.voice.onCommand = (cmd) => {
            this.element.classList.add('command-sent');
            setTimeout(() => this.element.classList.remove('command-sent'), 300);
        };
    }
}

// Add styles
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .voice-control-ui {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .voice-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: var(--widget-bg-secondary, #16213e);
            border: 2px solid transparent;
            border-radius: var(--widget-radius-sm, 6px);
            color: var(--widget-text, #fff);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .voice-btn:hover {
            border-color: var(--widget-accent, #667eea);
        }

        .voice-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .voice-control-ui.enabled .voice-btn {
            background: var(--widget-accent, #667eea);
            border-color: var(--widget-accent, #667eea);
        }

        .voice-control-ui.listening .voice-btn {
            animation: voice-pulse 1s ease-in-out infinite;
        }

        @keyframes voice-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
            50% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
        }

        .voice-icon {
            font-size: 16px;
        }

        .voice-status {
            font-size: 11px;
            color: var(--widget-text-muted, #888);
        }

        .voice-control-ui.enabled .voice-status {
            color: var(--widget-text, #fff);
        }

        .voice-transcript {
            font-size: 12px;
            color: var(--widget-text-muted, #888);
            font-style: italic;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .voice-transcript.final {
            color: var(--widget-success, #22c55e);
            font-style: normal;
        }

        .voice-control-ui.command-sent .voice-btn {
            transform: scale(0.95);
        }

        /* Compact mode for header */
        .voice-control-compact .voice-btn {
            padding: 6px 10px;
        }

        .voice-control-compact .voice-status,
        .voice-control-compact .voice-transcript {
            display: none;
        }
    `;
    document.head.appendChild(style);
})();

// Export
if (typeof window !== 'undefined') {
    window.VoiceControl = VoiceControl;
    window.VoiceControlUI = VoiceControlUI;
}
