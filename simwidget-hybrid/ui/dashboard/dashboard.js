/**
 * SimGlass Dashboard
 * Multi-widget layout with drag-and-drop
 */

class Dashboard {
    constructor() {
        this.widgets = [];
        this.isEditing = true;
        this.draggedWidget = null;

        this.availableWidgets = [
            { id: 'simbrief', name: 'SimBrief', icon: '📋', url: '/ui/simbrief-widget/', desc: 'Flight planning OFP' },
            { id: 'flightplan', name: 'Flight Plan', icon: '🛫', url: '/ui/flightplan-widget/', desc: 'Waypoint tracker' },
            { id: 'map', name: 'Map', icon: '🗺️', url: '/ui/map-widget/', desc: 'Live position map', size: 'large' },
            { id: 'weather', name: 'Weather', icon: '🌦️', url: '/ui/weather-widget/', desc: 'METAR display' },
            { id: 'checklist', name: 'Checklist', icon: '✅', url: '/ui/checklist-widget/', desc: 'Aircraft checklists' },
            { id: 'timer', name: 'Timer', icon: '⏱️', url: '/ui/timer-widget/', desc: 'Stopwatch/countdown' },
            { id: 'navigraph', name: 'Navigraph', icon: '🗺️', url: '/ui/navigraph-widget/', desc: 'Airport charts' },
            { id: 'notepad', name: 'Notepad', icon: '📝', url: '/ui/notepad-widget/', desc: 'Quick notes' },
            { id: 'copilot', name: 'AI Copilot', icon: '🧑‍✈️', url: '/ui/copilot-widget/', desc: 'AI assistant' },
            { id: 'voice', name: 'Voice Control', icon: '🎤', url: '/ui/voice-control/', desc: 'Voice commands' },
            { id: 'camera', name: 'Camera', icon: '📷', url: '/ui/camera-controller/', desc: 'Camera views' },
            { id: 'gtn750', name: 'GTN750', icon: '🛰️', url: '/ui/gtn750/', desc: 'GPS navigator' }
        ];

        this.presets = {
            'flight-planning': [
                { widgetId: 'simbrief', size: 'medium' },
                { widgetId: 'weather', size: 'small' },
                { widgetId: 'map', size: 'large' },
                { widgetId: 'navigraph', size: 'medium' }
            ],
            'in-flight': [
                { widgetId: 'flightplan', size: 'medium' },
                { widgetId: 'map', size: 'large' },
                { widgetId: 'checklist', size: 'medium' },
                { widgetId: 'timer', size: 'small' }
            ],
            'streaming': [
                { widgetId: 'map', size: 'large' },
                { widgetId: 'flightplan', size: 'medium' },
                { widgetId: 'weather', size: 'small' }
            ]
        };

        this.initElements();
        this.initEvents();
        this.loadLayout();
    }

    initElements() {
        this.grid = document.getElementById('dashboard-grid');
        this.picker = document.getElementById('widget-picker');
        this.pickerGrid = document.getElementById('picker-grid');
        this.addBtn = document.getElementById('btn-add');
        this.lockBtn = document.getElementById('btn-lock');
        this.saveBtn = document.getElementById('btn-save');
        this.settingsBtn = document.getElementById('btn-settings');
        this.settingsModal = document.getElementById('settings-modal');
        this.presetBtns = document.querySelectorAll('.preset-btn');

        // Voice settings elements
        this.voiceEnabled = document.getElementById('voice-enabled');
        this.voiceSelect = document.getElementById('voice-select');
        this.voiceRate = document.getElementById('voice-rate');
        this.voicePitch = document.getElementById('voice-pitch');
        this.voiceVolume = document.getElementById('voice-volume');
        this.voiceTest = document.getElementById('voice-test');
    }

    initEvents() {
        this.addBtn.addEventListener('click', () => this.showPicker());
        document.getElementById('picker-close').addEventListener('click', () => this.hidePicker());
        document.querySelector('.picker-overlay').addEventListener('click', () => this.hidePicker());

        this.lockBtn.addEventListener('click', () => this.toggleEdit());
        this.saveBtn.addEventListener('click', () => this.saveLayout());

        // Settings modal
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        document.getElementById('settings-close').addEventListener('click', () => this.hideSettings());
        document.querySelector('.settings-overlay').addEventListener('click', () => this.hideSettings());

        // Voice settings
        this.initVoiceSettings();

        // SimConnect settings
        this.initSimConnectSettings();

        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => this.loadPreset(btn.dataset.preset));
        });

        this.populatePicker();
    }

    populatePicker() {
        this.pickerGrid.replaceChildren();

        this.availableWidgets.forEach(widget => {
            const item = document.createElement('div');
            item.className = 'picker-item';

            const icon = document.createElement('div');
            icon.className = 'picker-icon';
            icon.textContent = widget.icon;

            const name = document.createElement('div');
            name.className = 'picker-name';
            name.textContent = widget.name;

            const desc = document.createElement('div');
            desc.className = 'picker-desc';
            desc.textContent = widget.desc;

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(desc);

            item.addEventListener('click', () => {
                this.addWidget(widget.id);
                this.hidePicker();
            });

            this.pickerGrid.appendChild(item);
        });
    }

    showPicker() {
        this.picker.style.display = 'flex';
    }

    hidePicker() {
        this.picker.style.display = 'none';
    }

    toggleEdit() {
        this.isEditing = !this.isEditing;

        if (this.isEditing) {
            this.lockBtn.textContent = '🔓 Edit';
            this.lockBtn.classList.remove('locked');
        } else {
            this.lockBtn.textContent = '🔒 Locked';
            this.lockBtn.classList.add('locked');
        }

        this.grid.querySelectorAll('.widget-panel').forEach(panel => {
            panel.classList.toggle('editing', this.isEditing);
        });
    }

    addWidget(widgetId, size) {
        const widgetDef = this.availableWidgets.find(w => w.id === widgetId);
        if (!widgetDef) return;

        const instanceId = widgetId + '-' + Date.now();
        const widgetSize = size || widgetDef.size || 'medium';

        const widget = {
            instanceId,
            widgetId,
            size: widgetSize
        };

        this.widgets.push(widget);
        this.renderWidget(widget, widgetDef);
        this.updateEmptyState();
    }

    renderWidget(widget, widgetDef) {
        const panel = document.createElement('div');
        panel.className = 'widget-panel size-' + widget.size;
        panel.dataset.instanceId = widget.instanceId;
        if (this.isEditing) panel.classList.add('editing');

        // Header
        const header = document.createElement('div');
        header.className = 'panel-header';

        const title = document.createElement('div');
        title.className = 'panel-title';
        title.textContent = widgetDef.icon + ' ' + widgetDef.name;

        const controls = document.createElement('div');
        controls.className = 'panel-controls';

        const sizeBtn = document.createElement('button');
        sizeBtn.className = 'panel-btn';
        sizeBtn.textContent = '⊞';
        sizeBtn.title = 'Cycle size';
        sizeBtn.addEventListener('click', () => this.cycleSize(widget.instanceId));

        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-btn close';
        closeBtn.textContent = '×';
        closeBtn.title = 'Remove';
        closeBtn.addEventListener('click', () => this.removeWidget(widget.instanceId));

        controls.appendChild(sizeBtn);
        controls.appendChild(closeBtn);

        header.appendChild(title);
        header.appendChild(controls);

        // Content
        const content = document.createElement('div');
        content.className = 'panel-content';

        const iframe = document.createElement('iframe');
        iframe.src = widgetDef.url;
        iframe.loading = 'lazy';
        content.appendChild(iframe);

        panel.appendChild(header);
        panel.appendChild(content);

        // Drag events
        header.draggable = true;
        header.addEventListener('dragstart', (e) => this.onDragStart(e, panel));
        header.addEventListener('dragend', (e) => this.onDragEnd(e, panel));

        panel.addEventListener('dragover', (e) => this.onDragOver(e, panel));
        panel.addEventListener('drop', (e) => this.onDrop(e, panel));
        panel.addEventListener('dragleave', (e) => this.onDragLeave(e, panel));

        this.grid.appendChild(panel);
    }

    removeWidget(instanceId) {
        const panel = this.grid.querySelector('[data-instance-id="' + instanceId + '"]');
        if (panel) {
            panel.remove();
        }
        this.widgets = this.widgets.filter(w => w.instanceId !== instanceId);
        this.updateEmptyState();
    }

    cycleSize(instanceId) {
        const sizes = ['small', 'medium', 'large'];
        const widget = this.widgets.find(w => w.instanceId === instanceId);
        if (!widget) return;

        const currentIndex = sizes.indexOf(widget.size);
        const newSize = sizes[(currentIndex + 1) % sizes.length];
        widget.size = newSize;

        const panel = this.grid.querySelector('[data-instance-id="' + instanceId + '"]');
        if (panel) {
            panel.className = 'widget-panel size-' + newSize;
            if (this.isEditing) panel.classList.add('editing');
        }
    }

    onDragStart(e, panel) {
        if (!this.isEditing) {
            e.preventDefault();
            return;
        }
        this.draggedWidget = panel;
        panel.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    onDragEnd(e, panel) {
        panel.classList.remove('dragging');
        this.draggedWidget = null;
        this.grid.querySelectorAll('.widget-panel').forEach(p => p.classList.remove('drag-over'));
    }

    onDragOver(e, panel) {
        if (!this.isEditing || !this.draggedWidget || this.draggedWidget === panel) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        panel.classList.add('drag-over');
    }

    onDragLeave(e, panel) {
        panel.classList.remove('drag-over');
    }

    onDrop(e, panel) {
        if (!this.isEditing || !this.draggedWidget || this.draggedWidget === panel) return;
        e.preventDefault();
        panel.classList.remove('drag-over');

        // Swap positions in DOM
        const allPanels = Array.from(this.grid.children);
        const draggedIndex = allPanels.indexOf(this.draggedWidget);
        const targetIndex = allPanels.indexOf(panel);

        if (draggedIndex < targetIndex) {
            panel.after(this.draggedWidget);
        } else {
            panel.before(this.draggedWidget);
        }

        // Update widgets array order
        this.updateWidgetsOrder();
    }

    updateWidgetsOrder() {
        const newOrder = [];
        this.grid.querySelectorAll('.widget-panel').forEach(panel => {
            const instanceId = panel.dataset.instanceId;
            const widget = this.widgets.find(w => w.instanceId === instanceId);
            if (widget) newOrder.push(widget);
        });
        this.widgets = newOrder;
    }

    loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        // Clear current widgets
        this.grid.replaceChildren();
        this.widgets = [];

        // Add preset widgets
        preset.forEach(item => {
            this.addWidget(item.widgetId, item.size);
        });

        // Update active button
        this.presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });

        this.showToast('Loaded ' + presetName + ' preset');
    }

    updateEmptyState() {
        const existing = this.grid.querySelector('.empty-state');
        if (existing) existing.remove();

        if (this.widgets.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';

            const icon = document.createElement('div');
            icon.className = 'empty-icon';
            icon.textContent = '🎛️';

            const text = document.createElement('div');
            text.className = 'empty-text';
            text.textContent = 'No widgets added';

            const hint = document.createElement('div');
            hint.className = 'empty-hint';
            hint.textContent = 'Click "+ Add Widget" or select a preset';

            empty.appendChild(icon);
            empty.appendChild(text);
            empty.appendChild(hint);
            this.grid.appendChild(empty);
        }
    }

    saveLayout() {
        try {
            const layout = this.widgets.map(w => ({
                widgetId: w.widgetId,
                size: w.size
            }));
            localStorage.setItem('dashboard-layout', JSON.stringify(layout));
            this.showToast('Layout saved');
        } catch (e) {
            console.error('Failed to save layout:', e);
        }
    }

    loadLayout() {
        try {
            const saved = localStorage.getItem('dashboard-layout');
            if (saved) {
                const layout = JSON.parse(saved);
                if (layout.length > 0) {
                    layout.forEach(item => {
                        this.addWidget(item.widgetId, item.size);
                    });
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to load layout:', e);
        }

        // Load default preset if no saved layout
        this.loadPreset('flight-planning');
    }

    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#667eea;color:white;padding:10px 20px;border-radius:6px;font-size:13px;z-index:1000;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // ============================================
    // SETTINGS
    // ============================================

    showSettings() {
        this.settingsModal.style.display = 'flex';
        this.populateVoices();
    }

    hideSettings() {
        this.settingsModal.style.display = 'none';
    }

    initVoiceSettings() {
        // Initialize VoiceAnnouncer if available
        this.announcer = window.VoiceAnnouncer ? new VoiceAnnouncer() : null;

        // Load saved settings
        this.loadVoiceSettings();

        // Event listeners
        this.voiceEnabled.addEventListener('change', () => this.saveVoiceSettings());
        this.voiceSelect.addEventListener('change', () => this.saveVoiceSettings());

        this.voiceRate.addEventListener('input', () => {
            document.getElementById('voice-rate-value').textContent = this.voiceRate.value + 'x';
            this.saveVoiceSettings();
        });

        this.voicePitch.addEventListener('input', () => {
            document.getElementById('voice-pitch-value').textContent = this.voicePitch.value;
            this.saveVoiceSettings();
        });

        this.voiceVolume.addEventListener('input', () => {
            document.getElementById('voice-volume-value').textContent = Math.round(this.voiceVolume.value * 100) + '%';
            this.saveVoiceSettings();
        });

        this.voiceTest.addEventListener('click', () => this.testVoice());

        // Populate voices when they load
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => this.populateVoices();
        }
    }

    populateVoices() {
        if (!window.speechSynthesis) return;

        const voices = window.speechSynthesis.getVoices();
        const savedVoice = localStorage.getItem('voice-name') || '';

        // Clear existing options
        this.voiceSelect.replaceChildren();

        // Group by language
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        const otherVoices = voices.filter(v => !v.lang.startsWith('en'));

        // Add English voices first
        if (englishVoices.length > 0) {
            const group = document.createElement('optgroup');
            group.label = 'English';
            englishVoices.forEach(voice => {
                const opt = document.createElement('option');
                opt.value = voice.name;
                opt.textContent = voice.name + (voice.localService ? '' : ' (Online)');
                opt.selected = voice.name === savedVoice;
                group.appendChild(opt);
            });
            this.voiceSelect.appendChild(group);
        }

        // Add other voices
        if (otherVoices.length > 0) {
            const group = document.createElement('optgroup');
            group.label = 'Other Languages';
            otherVoices.forEach(voice => {
                const opt = document.createElement('option');
                opt.value = voice.name;
                opt.textContent = voice.name;
                opt.selected = voice.name === savedVoice;
                group.appendChild(opt);
            });
            this.voiceSelect.appendChild(group);
        }
    }

    loadVoiceSettings() {
        try {
            this.voiceEnabled.checked = localStorage.getItem('voice-enabled') !== 'false';
            this.voiceRate.value = localStorage.getItem('voice-rate') || 1;
            this.voicePitch.value = localStorage.getItem('voice-pitch') || 1;
            this.voiceVolume.value = localStorage.getItem('voice-volume') || 1;

            document.getElementById('voice-rate-value').textContent = this.voiceRate.value + 'x';
            document.getElementById('voice-pitch-value').textContent = this.voicePitch.value;
            document.getElementById('voice-volume-value').textContent = Math.round(this.voiceVolume.value * 100) + '%';
        } catch (e) {
            console.error('Failed to load voice settings:', e);
        }
    }

    saveVoiceSettings() {
        try {
            localStorage.setItem('voice-enabled', this.voiceEnabled.checked);
            localStorage.setItem('voice-name', this.voiceSelect.value);
            localStorage.setItem('voice-rate', this.voiceRate.value);
            localStorage.setItem('voice-pitch', this.voicePitch.value);
            localStorage.setItem('voice-volume', this.voiceVolume.value);

            // Update announcer if available
            if (this.announcer) {
                this.announcer.enabled = this.voiceEnabled.checked;
                this.announcer.rate = parseFloat(this.voiceRate.value);
                this.announcer.pitch = parseFloat(this.voicePitch.value);
                this.announcer.volume = parseFloat(this.voiceVolume.value);
                this.announcer.voiceName = this.voiceSelect.value;
                this.announcer.loadVoice();
            }

            // Broadcast settings to other widgets
            const channel = new BroadcastChannel('simglass-voice-settings');
            channel.postMessage({
                enabled: this.voiceEnabled.checked,
                voice: this.voiceSelect.value,
                rate: parseFloat(this.voiceRate.value),
                pitch: parseFloat(this.voicePitch.value),
                volume: parseFloat(this.voiceVolume.value)
            });
            channel.close();
        } catch (e) {
            console.error('Failed to save voice settings:', e);
        }
    }

    testVoice() {
        if (!window.speechSynthesis) {
            this.showToast('Speech synthesis not available');
            return;
        }

        // Cancel with 100ms delay per voice standards
        window.speechSynthesis.cancel();
        this.isSpeaking = false;

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance('SimGlass voice test. All systems nominal.');
            utterance.rate = parseFloat(this.voiceRate.value);
            utterance.pitch = parseFloat(this.voicePitch.value);
            utterance.volume = parseFloat(this.voiceVolume.value);

            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === this.voiceSelect.value);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            utterance.onstart = () => { this.isSpeaking = true; };
            utterance.onend = () => { this.isSpeaking = false; };
            utterance.onerror = () => { this.isSpeaking = false; };

            window.speechSynthesis.speak(utterance);
        }, 100);

        this.showToast('Testing voice...');
    }

    // Speak text following voice standards (with debounce for streaming)
    speakText(text, immediate = false) {
        if (!window.speechSynthesis || !this.voiceEnabled?.checked) return;

        // Strip code blocks
        const plainText = text
            .replace(/```[\s\S]*?```/g, 'code block')
            .replace(/`[^`]+`/g, 'code');

        // Skip long responses (800 char default)
        if (plainText.length > 800) return;

        // Clear pending debounce
        if (this.speechDebounceTimer) {
            clearTimeout(this.speechDebounceTimer);
        }

        if (!immediate) {
            // Debounce: wait 1s after text stops changing
            this.speechDebounceTimer = setTimeout(() => {
                this.doSpeak(plainText);
            }, 1000);
        } else {
            this.doSpeak(plainText);
        }
    }

    doSpeak(text) {
        window.speechSynthesis.cancel();
        this.isSpeaking = false;

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(this.voiceRate?.value || 0.9);
            utterance.pitch = parseFloat(this.voicePitch?.value || 1.0);
            utterance.volume = parseFloat(this.voiceVolume?.value || 1.0);

            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === this.voiceSelect?.value);
            if (selectedVoice) utterance.voice = selectedVoice;

            utterance.onstart = () => { this.isSpeaking = true; };
            utterance.onend = () => { this.isSpeaking = false; };
            utterance.onerror = () => { this.isSpeaking = false; };

            window.speechSynthesis.speak(utterance);
        }, 100);
    }

    stopSpeech() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            this.isSpeaking = false;
        }
    }

    // SimConnect settings
    initSimConnectSettings() {
        const hostInput = document.getElementById('simconnect-host');
        const portInput = document.getElementById('simconnect-port');
        const statusEl = document.getElementById('simconnect-status');
        const connectBtn = document.getElementById('simconnect-connect');
        const localBtn = document.getElementById('simconnect-local');

        // Load current status
        this.loadSimConnectStatus();

        // Connect to remote
        connectBtn?.addEventListener('click', async () => {
            const host = hostInput.value.trim();
            const port = parseInt(portInput.value) || 500;

            if (!host) {
                this.showToast('Enter remote IP address');
                return;
            }

            statusEl.textContent = 'Connecting...';
            statusEl.style.color = '#d29922';

            try {
                const res = await fetch('/api/simconnect/remote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, port })
                });
                const data = await res.json();
                this.showToast(data.message || 'Connecting...');

                // Check status after a delay
                setTimeout(() => this.loadSimConnectStatus(), 3000);
            } catch (e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = '#f85149';
            }
        });

        // Use local
        localBtn?.addEventListener('click', async () => {
            statusEl.textContent = 'Connecting to local...';
            statusEl.style.color = '#d29922';
            hostInput.value = '';

            try {
                const res = await fetch('/api/simconnect/remote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host: null })
                });
                const data = await res.json();
                this.showToast(data.message || 'Connecting to local...');

                setTimeout(() => this.loadSimConnectStatus(), 3000);
            } catch (e) {
                statusEl.textContent = 'Error: ' + e.message;
                statusEl.style.color = '#f85149';
            }
        });
    }

    async loadSimConnectStatus() {
        const hostInput = document.getElementById('simconnect-host');
        const portInput = document.getElementById('simconnect-port');
        const statusEl = document.getElementById('simconnect-status');

        try {
            const res = await fetch('/api/simconnect/status');
            const data = await res.json();

            if (data.connected) {
                statusEl.textContent = '✓ Connected';
                statusEl.style.color = '#3fb950';
            } else if (data.mockMode) {
                statusEl.textContent = '⚠ Mock Mode (MSFS not found)';
                statusEl.style.color = '#d29922';
            } else {
                statusEl.textContent = '✗ Disconnected';
                statusEl.style.color = '#f85149';
            }

            if (data.remoteHost) {
                hostInput.value = data.remoteHost;
                portInput.value = data.remotePort || 500;
            }
        } catch (e) {
            statusEl.textContent = 'Error loading status';
            statusEl.style.color = '#f85149';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
