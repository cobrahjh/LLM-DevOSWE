/**
 * SimGlass Voice Control v3.0.0
 * Voice command recognition for flight simulator control
 * Uses Web Speech API (Chrome/Edge)
 *
 * v3.0.0 - Code splitting: default commands extracted to data/default-commands.js
 * v2.0.0 - Migrated to SimGlassBase
 *
 * Path: ui/voice-control/glass.js
 */

const API_BASE = `http://${window.location.hostname}:8080`;
const STORAGE_KEY = 'SimGlass_voice_settings';
const COMMANDS_KEY = 'SimGlass_voice_commands';

class VoiceControlGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'voice-control',
            widgetVersion: '3.0.0',
            autoConnect: false  // Uses Web Speech API, not WebSocket
        });

        this._destroyed = false;
        this.recognition = null;
        this.isListening = false;
        this.settings = {
            language: 'en-US',
            continuous: true,
            confidence: 0.6,
            wakeWord: ''
        };

        // Voice commands (loaded from localStorage or lazy-loaded defaults)
        this.voiceCommands = [];
        this._defaultCommandsLoaded = false;

        this.loadSettings();
        this.loadCommands();
        this.initSpeechRecognition();
        this.setupEventListeners();
        this.renderCommands();
        this.log('Voice Control ready', 'info');

        // Load transparency preference
        if (localStorage.getItem('voice_transparent') === 'true') {
            document.body.classList.add('transparent');
        }
    }

    setupEventListeners() {
        document.getElementById('btn-listen').addEventListener('click', () => this.toggleListening());
        document.getElementById('mic-status').addEventListener('click', () => this.toggleListening());
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('btn-close-settings').addEventListener('click', () => this.closeSettings());
        document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-transparency').addEventListener('click', () => this.toggleTransparency());

        // Settings inputs
        document.getElementById('setting-confidence').addEventListener('input', (e) => {
            document.getElementById('confidence-value').textContent = e.target.value + '%';
        });
    }

    // ============================================
    // SPEECH RECOGNITION
    // ============================================

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.log('Speech recognition not supported in this browser', 'error');
            document.getElementById('btn-listen').disabled = true;
            document.getElementById('status-text').textContent = 'Not Supported';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.settings.continuous;
        this.recognition.interimResults = true;
        this.recognition.lang = this.settings.language;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
            this.log('Listening started', 'info');
        };

        this.recognition.onend = () => {
            if (this._destroyed) return;
            this.isListening = false;
            this.updateUI();

            // Auto-restart if continuous mode
            if (this.settings.continuous && document.getElementById('btn-listen').dataset.shouldListen === 'true') {
                setTimeout(() => {
                    if (this._destroyed) return;
                    if (document.getElementById('btn-listen').dataset.shouldListen === 'true') {
                        try {
                            this.recognition.start();
                        } catch(e) {
                            if (window.telemetry) {
                                telemetry.captureError(e, {
                                    operation: 'autoRestartRecognition',
                                    glass: 'voice-control'
                                });
                            }
                        }
                    }
                }, 100);
            }
        };

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.toLowerCase().trim();
            const confidence = result[0].confidence;

            document.getElementById('transcript').textContent = transcript;

            if (result.isFinal) {
                this.processCommand(transcript, confidence);
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                this.log(`Recognition error: ${event.error}`, 'error');
            }
        };
    }

    toggleListening() {
        const btn = document.getElementById('btn-listen');

        if (this.isListening) {
            btn.dataset.shouldListen = 'false';
            this.recognition.stop();
        } else {
            btn.dataset.shouldListen = 'true';
            try {
                this.recognition.start();
            } catch(e) {
                this.log('Could not start recognition', 'error');
            }
        }
    }

    updateUI() {
        const btn = document.getElementById('btn-listen');
        const micIcon = document.getElementById('mic-icon');
        const statusText = document.getElementById('status-text');
        const micStatus = document.getElementById('mic-status');

        if (this.isListening) {
            btn.textContent = 'Stop Listening';
            btn.classList.add('listening');
            micIcon.textContent = '🔴';
            statusText.textContent = 'Listening...';
            micStatus.classList.add('active');
        } else {
            btn.textContent = 'Start Listening';
            btn.classList.remove('listening');
            micIcon.textContent = '🎤';
            statusText.textContent = 'Click to Start';
            micStatus.classList.remove('active');
        }
    }

    // ============================================
    // COMMAND PROCESSING
    // ============================================

    processCommand(transcript, confidence) {
        // Check wake word if configured
        if (this.settings.wakeWord) {
            if (!transcript.startsWith(this.settings.wakeWord.toLowerCase())) {
                return; // Ignore if wake word not spoken
            }
            transcript = transcript.slice(this.settings.wakeWord.length).trim();
        }

        // Check confidence threshold
        if (confidence < this.settings.confidence) {
            this.log(`Low confidence (${(confidence * 100).toFixed(0)}%): "${transcript}"`, 'warn');
            return;
        }

        // Find matching command
        const match = this.findBestMatch(transcript);

        if (match) {
            document.getElementById('matched-command').textContent = `✓ ${match.command.description}`;
            document.getElementById('matched-command').className = 'matched-command success';
            this.log(`Matched: "${match.command.phrase}" → ${match.command.description}`, 'success');
            this.executeAction(match.command);
        } else {
            document.getElementById('matched-command').textContent = `✗ No match found`;
            document.getElementById('matched-command').className = 'matched-command error';
            this.log(`No match for: "${transcript}"`, 'warn');
        }
    }

    findBestMatch(transcript) {
        let bestMatch = null;
        let bestScore = 0;

        for (const cmd of this.voiceCommands) {
            const score = this.calculateSimilarity(transcript, cmd.phrase.toLowerCase());
            if (score > bestScore && score > 0.7) {
                bestScore = score;
                bestMatch = { command: cmd, score };
            }
        }

        return bestMatch;
    }

    calculateSimilarity(str1, str2) {
        // Check for exact match or contains
        if (str1 === str2) return 1.0;
        if (str1.includes(str2) || str2.includes(str1)) return 0.9;

        // Levenshtein-based similarity
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const distance = matrix[len1][len2];
        return 1 - distance / Math.max(len1, len2);
    }

    // ============================================
    // ACTION EXECUTION
    // ============================================

    async executeAction(cmd) {
        try {
            switch (cmd.action) {
                case 'keymap':
                    await this.executeKeymap(cmd.category, cmd.id);
                    break;
                case 'command':
                    await this.executeCommand(cmd.command);
                    break;
                case 'key':
                    await this.sendKey(cmd.key);
                    break;
                case 'fuel':
                    await this.executeFuel(cmd);
                    break;
                case 'checklist':
                    await this.executeChecklist(cmd);
                    break;
                case 'dashboard':
                    await this.executeDashboard(cmd);
                    break;
                case 'glass':
                    await this.executeWidget(cmd);
                    break;
                default:
                    this.log(`Unknown action type: ${cmd.action}`, 'error');
            }
        } catch (e) {
            this.log(`Action failed: ${e.message}`, 'error');
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'executeAction',
                    glass: 'voice-control',
                    action: cmd.action
                });
            }
        }
    }

    async executeKeymap(category, id) {
        try {
            // First get the keymap to find the key
            const res = await fetch(`${API_BASE}/api/keymaps/${category}`);
            const keymaps = await res.json();

            // Find by originalId or id
            let key = null;
            for (const [mapId, binding] of Object.entries(keymaps)) {
                if (binding.originalId === id || mapId === id) {
                    key = binding.key || binding;
                    break;
                }
            }

            if (key) {
                await this.sendKey(key);
            } else {
                this.log(`Keymap not found: ${category}.${id}`, 'error');
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'executeKeymap',
                    glass: 'voice-control',
                    category: category,
                    id: id
                });
            }
            throw e;
        }
    }

    async executeCommand(command) {
        await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, value: 1 })
        });
        this.log(`Command sent: ${command}`, 'info');
    }

    async sendKey(key) {
        await fetch(`${API_BASE}/api/sendkey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        this.log(`Key sent: ${key}`, 'info');
    }

    async executeFuel(cmd) {
        await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'command',
                category: 'fuel',
                action: cmd.fuelAction,
                percent: cmd.percent
            })
        });
        this.log(`Fuel: ${cmd.fuelAction} ${cmd.percent}%`, 'info');
    }

    async executeChecklist(cmd) {
        // Send checklist command via WebSocket broadcast or localStorage
        const action = {
            type: 'checklist',
            action: cmd.checklistAction,
            target: cmd.target || null
        };

        // Use BroadcastChannel API for cross-glass communication
        const channel = new SafeChannel('SimGlass-checklist');
        channel.postMessage(action);
        channel.close();

        // Also store in localStorage for widgets that might not support BroadcastChannel
        localStorage.setItem('SimGlass-checklist-command', JSON.stringify({
            ...action,
            timestamp: Date.now()
        }));

        this.log(`Checklist: ${cmd.checklistAction}${cmd.target ? ' -> ' + cmd.target : ''}`, 'info');
    }

    async executeDashboard(cmd) {
        const channel = new SafeChannel('SimGlass-sync');

        if (cmd.layout) {
            // Change dashboard layout
            channel.postMessage({
                type: 'dashboard-layout',
                data: { layout: cmd.layout }
            });
            this.log(`Dashboard layout: ${cmd.layout}`, 'info');
        } else if (cmd.dashAction === 'fullscreen') {
            channel.postMessage({
                type: 'dashboard-action',
                data: { action: 'fullscreen' }
            });
            this.log('Dashboard: Toggle fullscreen', 'info');
        } else if (cmd.dashAction === 'open') {
            window.open('/ui/flight-dashboard/', 'flight-dashboard', 'width=1400,height=900');
            this.log('Dashboard: Opened', 'info');
        }

        channel.close();
    }

    async executeWidget(cmd) {
        const channel = new SafeChannel('SimGlass-sync');

        switch (cmd.glass) {
            case 'weather':
                channel.postMessage({
                    type: 'glass-action',
                    data: { glass: 'weather', action: 'fetch' }
                });
                this.log('Weather: Fetch requested', 'info');
                break;

            case 'simbrief':
                channel.postMessage({
                    type: 'glass-action',
                    data: { glass: 'simbrief', action: 'fetch' }
                });
                this.log('SimBrief: Fetch requested', 'info');
                break;

            case 'charts':
                window.open('/ui/charts-glass/', 'charts-glass', 'width=800,height=600');
                this.log('Charts: Opened', 'info');
                break;

            case 'notepad':
                channel.postMessage({
                    type: 'glass-action',
                    data: { glass: 'notepad', action: 'copy' }
                });
                this.log('Notepad: Copy requested', 'info');
                break;
        }

        channel.close();
    }

    // ============================================
    // SETTINGS
    // ============================================

    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadSettings',
                    glass: 'voice-control',
                    storage: 'localStorage'
                });
            }
        }

        // Apply to UI (after DOM is ready)
        setTimeout(() => {
            const langEl = document.getElementById('setting-language');
            const contEl = document.getElementById('setting-continuous');
            const confEl = document.getElementById('setting-confidence');
            const confValEl = document.getElementById('confidence-value');
            const wakeEl = document.getElementById('setting-wakeword');

            if (langEl) langEl.value = this.settings.language;
            if (contEl) contEl.checked = this.settings.continuous;
            if (confEl) confEl.value = this.settings.confidence * 100;
            if (confValEl) confValEl.textContent = (this.settings.confidence * 100) + '%';
            if (wakeEl) wakeEl.value = this.settings.wakeWord;
        }, 0);
    }

    saveSettings() {
        this.settings.language = document.getElementById('setting-language').value;
        this.settings.continuous = document.getElementById('setting-continuous').checked;
        this.settings.confidence = document.getElementById('setting-confidence').value / 100;
        this.settings.wakeWord = document.getElementById('setting-wakeword').value.trim();

        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));

        // Reinitialize recognition with new settings
        if (this.recognition) {
            this.recognition.lang = this.settings.language;
            this.recognition.continuous = this.settings.continuous;
        }

        this.closeSettings();
        this.log('Settings saved', 'success');
    }

    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    loadCommands() {
        try {
            const saved = localStorage.getItem(COMMANDS_KEY);
            if (saved) {
                this.voiceCommands = JSON.parse(saved);
                return;
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadCommands',
                    glass: 'voice-control',
                    storage: 'localStorage'
                });
            }
        }

        // No custom commands saved — lazy-load defaults
        this.loadDefaultCommands();
    }

    loadDefaultCommands() {
        // Already loaded via <script> tag or previous call
        if (typeof DEFAULT_VOICE_COMMANDS !== 'undefined') {
            this.voiceCommands = [...DEFAULT_VOICE_COMMANDS];
            this._defaultCommandsLoaded = true;
            this.renderCommands();
            return;
        }

        // Lazy-load the data file
        const script = document.createElement('script');
        script.src = 'data/default-commands.js';
        script.onload = () => {
            if (typeof DEFAULT_VOICE_COMMANDS !== 'undefined') {
                this.voiceCommands = [...DEFAULT_VOICE_COMMANDS];
                this._defaultCommandsLoaded = true;
                this.renderCommands();
                console.log(`[VoiceControl] Loaded ${this.voiceCommands.length} default commands`);
            }
        };
        script.onerror = () => {
            console.error('[VoiceControl] Failed to load default commands');
            if (window.telemetry) {
                telemetry.captureError(new Error('Failed to load default-commands.js'), {
                    operation: 'loadDefaultCommands',
                    glass: 'voice-control'
                });
            }
        };
        document.head.appendChild(script);
    }

    saveCommands() {
        localStorage.setItem(COMMANDS_KEY, JSON.stringify(this.voiceCommands));
    }

    // ============================================
    // UI RENDERING
    // ============================================

    renderCommands() {
        const list = document.getElementById('commands-list');
        const countEl = document.getElementById('command-count');
        if (countEl) countEl.textContent = `(${this.voiceCommands.length})`;

        // Group by action type
        const grouped = {};
        this.voiceCommands.forEach(cmd => {
            const type = cmd.action;
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(cmd);
        });

        let html = '';
        for (const [type, cmds] of Object.entries(grouped)) {
            html += `<div class="command-group">
                <div class="group-header">${this.formatType(type)}</div>`;
            cmds.forEach(cmd => {
                html += `<div class="command-item">
                    <span class="phrase">"${cmd.phrase}"</span>
                    <span class="desc">${cmd.description}</span>
                </div>`;
            });
            html += '</div>';
        }

        if (list) list.innerHTML = html;
    }

    formatType(type) {
        const icons = {
            keymap: '⌨️ Keymaps',
            command: '🎮 SimConnect',
            key: '⌨️ Keys',
            fuel: '⛽ Fuel'
        };
        return icons[type] || type;
    }

    // ============================================
    // TRANSPARENCY
    // ============================================

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        localStorage.setItem('voice_transparent', document.body.classList.contains('transparent'));
    }

    // ============================================
    // LOGGING
    // ============================================

    log(message, type = 'info') {
        const logEl = document.getElementById('log');
        if (!logEl) return;

        const time = new Date().toLocaleTimeString();
        const typeClass = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : type === 'warn' ? 'log-warn' : '';

        const entry = document.createElement('div');
        entry.className = `log-entry ${typeClass}`;
        entry.innerHTML = `<span class="time">${time}</span> ${message}`;

        logEl.insertBefore(entry, logEl.firstChild);

        // Keep only last 20 entries
        while (logEl.children.length > 20) {
            logEl.removeChild(logEl.lastChild);
        }
    }

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
        this._destroyed = true;

        // Stop speech recognition
        if (this.recognition) {
            try {
                const btn = document.getElementById('btn-listen');
                if (btn) btn.dataset.shouldListen = 'false';
                this.recognition.stop();
                this.recognition = null;
            } catch (e) {
                console.error('[Voice Control] Recognition cleanup error:', e);
            }
        }

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.voiceControl = new VoiceControlGlass();
    window.addEventListener('beforeunload', () => window.voiceControl?.destroy());
});
