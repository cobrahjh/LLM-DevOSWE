/**
 * Kitt Live - Settings Page
 */

class SettingsApp {
    constructor() {
        this.config = null;
        this.init();
    }

    async init() {
        this.config = await window.kitt.getConfig();
        this.setupElements();
        this.loadSettings();
        this.setupEventListeners();
        this.loadVoices();
        this.loadAudioDevices();
    }

    setupElements() {
        // Window
        this.closeBtn = document.getElementById('closeBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.saveBtn = document.getElementById('saveBtn');

        // Voice
        this.voiceSelect = document.getElementById('voiceSelect');
        this.voiceRate = document.getElementById('voiceRate');
        this.voiceVolume = document.getElementById('voiceVolume');

        // Audio devices
        this.inputDevice = document.getElementById('inputDevice');
        this.outputDevice = document.getElementById('outputDevice');

        // Hotkeys
        this.hotkeyToggle = document.getElementById('hotkeyToggle');
        this.hotkeyPTT = document.getElementById('hotkeyPTT');

        // Behavior
        this.startMinimized = document.getElementById('startMinimized');
        this.startWithWindows = document.getElementById('startWithWindows');
        this.showCaptions = document.getElementById('showCaptions');

        // LLM
        this.llmBackend = document.getElementById('llmBackend');
        this.oracleUrl = document.getElementById('oracleUrl');
        this.llmModel = document.getElementById('llmModel');

        // Environment
        this.envEnabled = document.getElementById('envEnabled');
        this.envSection = document.getElementById('envSection');
        this.safetyLevel = document.getElementById('safetyLevel');
        this.permLocalPC = document.getElementById('permLocalPC');
        this.permNetworkPCs = document.getElementById('permNetworkPCs');
        this.permWeb = document.getElementById('permWeb');
        this.permAPIs = document.getElementById('permAPIs');
        this.permClipboard = document.getElementById('permClipboard');
        this.permScreenshots = document.getElementById('permScreenshots');
    }

    loadSettings() {
        // Voice
        this.voiceRate.value = this.config.voice?.rate || 1.0;
        this.voiceVolume.value = this.config.voice?.volume || 0.8;

        // Hotkeys
        this.hotkeyToggle.value = this.config.hotkeys?.toggle || 'Alt+K';
        this.hotkeyPTT.value = this.config.hotkeys?.pushToTalk || 'Ctrl+Space';

        // Behavior
        this.startMinimized.checked = this.config.behavior?.startMinimized !== false;
        this.startWithWindows.checked = this.config.behavior?.startWithWindows || false;
        this.showCaptions.checked = this.config.behavior?.showCaptions !== false;

        // LLM
        this.llmBackend.value = this.config.llm?.backend || 'oracle';
        this.oracleUrl.value = this.config.llm?.oracleUrl || 'http://localhost:3002';
        this.llmModel.value = this.config.llm?.model || 'qwen2.5-coder:7b';

        // Environment
        this.envEnabled.checked = this.config.environment?.enabled || false;
        this.envSection.style.display = this.envEnabled.checked ? 'block' : 'none';
        this.safetyLevel.value = this.config.environment?.safetyLevel || 'standard';
        this.permLocalPC.checked = this.config.environment?.permissions?.localPC !== false;
        this.permNetworkPCs.checked = this.config.environment?.permissions?.networkPCs || false;
        this.permWeb.checked = this.config.environment?.permissions?.web || false;
        this.permAPIs.checked = this.config.environment?.permissions?.apis !== false;
        this.permClipboard.checked = this.config.environment?.permissions?.clipboard !== false;
        this.permScreenshots.checked = this.config.environment?.permissions?.screenshots || false;
    }

    async loadVoices() {
        const voices = await window.kitt.getVoices();
        this.voiceSelect.innerHTML = voices.map(v =>
            `<option value="${v.name}" ${v.name === this.config.voice?.name ? 'selected' : ''}>${v.name}</option>`
        ).join('');
    }

    async loadAudioDevices() {
        try {
            // Request permission first
            await navigator.mediaDevices.getUserMedia({ audio: true });

            const devices = await navigator.mediaDevices.enumerateDevices();

            // Input devices (microphones)
            const inputs = devices.filter(d => d.kind === 'audioinput');
            this.inputDevice.innerHTML = inputs.map(d =>
                `<option value="${d.deviceId}" ${d.deviceId === this.config.audio?.inputDevice ? 'selected' : ''}>${d.label || 'Microphone ' + (inputs.indexOf(d) + 1)}</option>`
            ).join('');

            // Output devices (speakers)
            const outputs = devices.filter(d => d.kind === 'audiooutput');
            this.outputDevice.innerHTML = outputs.map(d =>
                `<option value="${d.deviceId}" ${d.deviceId === this.config.audio?.outputDevice ? 'selected' : ''}>${d.label || 'Speaker ' + (outputs.indexOf(d) + 1)}</option>`
            ).join('');

        } catch (err) {
            console.error('Failed to enumerate audio devices:', err);
            this.inputDevice.innerHTML = '<option value="default">Default</option>';
            this.outputDevice.innerHTML = '<option value="default">Default</option>';
        }
    }

    setupEventListeners() {
        // Close buttons
        this.closeBtn.addEventListener('click', () => window.kitt.closeSettings());
        this.cancelBtn.addEventListener('click', () => window.kitt.closeSettings());

        // Save
        this.saveBtn.addEventListener('click', () => this.saveSettings());

        // Environment toggle
        this.envEnabled.addEventListener('change', () => {
            this.envSection.style.display = this.envEnabled.checked ? 'block' : 'none';
        });

        // Hotkey capture
        this.hotkeyToggle.addEventListener('keydown', (e) => this.captureHotkey(e, this.hotkeyToggle));
        this.hotkeyPTT.addEventListener('keydown', (e) => this.captureHotkey(e, this.hotkeyPTT));
    }

    captureHotkey(e, input) {
        e.preventDefault();

        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Meta');

        // Only accept if a modifier is pressed with a regular key
        if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
            const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            input.value = [...modifiers, key].join('+');
        }
    }

    async saveSettings() {
        // Voice
        await window.kitt.setConfig('voice.name', this.voiceSelect.value);
        await window.kitt.setConfig('voice.rate', parseFloat(this.voiceRate.value));
        await window.kitt.setConfig('voice.volume', parseFloat(this.voiceVolume.value));

        // Audio devices
        await window.kitt.setConfig('audio.inputDevice', this.inputDevice.value);
        await window.kitt.setConfig('audio.outputDevice', this.outputDevice.value);

        // Hotkeys
        await window.kitt.setConfig('hotkeys.toggle', this.hotkeyToggle.value);
        await window.kitt.setConfig('hotkeys.pushToTalk', this.hotkeyPTT.value);

        // Behavior
        await window.kitt.setConfig('behavior.startMinimized', this.startMinimized.checked);
        await window.kitt.setConfig('behavior.startWithWindows', this.startWithWindows.checked);
        await window.kitt.setConfig('behavior.showCaptions', this.showCaptions.checked);

        // LLM
        await window.kitt.setConfig('llm.backend', this.llmBackend.value);
        await window.kitt.setConfig('llm.oracleUrl', this.oracleUrl.value);
        await window.kitt.setConfig('llm.model', this.llmModel.value);

        // Environment
        await window.kitt.setConfig('environment.enabled', this.envEnabled.checked);
        await window.kitt.setConfig('environment.safetyLevel', this.safetyLevel.value);
        await window.kitt.setConfig('environment.permissions.localPC', this.permLocalPC.checked);
        await window.kitt.setConfig('environment.permissions.networkPCs', this.permNetworkPCs.checked);
        await window.kitt.setConfig('environment.permissions.web', this.permWeb.checked);
        await window.kitt.setConfig('environment.permissions.apis', this.permAPIs.checked);
        await window.kitt.setConfig('environment.permissions.clipboard', this.permClipboard.checked);
        await window.kitt.setConfig('environment.permissions.screenshots', this.permScreenshots.checked);

        // Show save confirmation
        this.showSaveConfirmation();
    }

    showSaveConfirmation() {
        // Change button to show saved
        const originalText = this.saveBtn.textContent;
        this.saveBtn.textContent = 'Saved!';
        this.saveBtn.style.background = '#4ade80';

        setTimeout(() => {
            this.saveBtn.textContent = originalText;
            this.saveBtn.style.background = '';
            // Close settings after showing confirmation
            window.kitt.closeSettings();
        }, 1000);
    }
}

// Initialize
const settingsApp = new SettingsApp();
