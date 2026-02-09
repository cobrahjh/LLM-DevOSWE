/**
 * ChecklistPane v3.0.0 - Refactored with Lazy-Loading Aircraft Data
 *
 * Code Splitting Architecture:
 * - This file contains ONLY the ChecklistPane widget logic
 * - Aircraft checklist data is stored in separate aircraft-*.js files
 * - Data is lazy-loaded on-demand when an aircraft is selected
 * - Reduces initial load time and memory footprint
 *
 * Aircraft data files are loaded via loadAircraftData() which dynamically
 * imports the appropriate aircraft-{id}.js module and registers it in
 * the global AIRCRAFT_CHECKLISTS object.
 *
 * Dependencies:
 * - SimGlassBase (../../shared/simglass-base.js)
 * - loadAircraftData() function (checklist-loader.js)
 * - AIRCRAFT_CHECKLISTS global object (populated by loader)
 */

class ChecklistPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'checklist-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // Local checklist display, no WebSocket
        });

        this.currentAircraft = 'generic';
        this.currentChecklist = 'preflight';
        this.checkedItems = {};
        this.audioEnabled = true;
        this.synth = window.speechSynthesis;

        this.loadState();
        this.initAircraftSelector();
        this.initTabs();
        this.initControls();
        this.renderChecklist();
    }

    get checklists() {
        return AIRCRAFT_CHECKLISTS[this.currentAircraft].checklists;
    }

    loadState() {
        try {
            const saved = localStorage.getItem('checklist-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.checkedItems = state.checkedItems || {};
                this.audioEnabled = state.audioEnabled !== false;
                this.currentAircraft = state.currentAircraft || 'generic';
            }
        } catch (e) {
            console.error('Failed to load checklist state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('checklist-glass-state', JSON.stringify({
                checkedItems: this.checkedItems,
                audioEnabled: this.audioEnabled,
                currentAircraft: this.currentAircraft
            }));
        } catch (e) {
            console.error('Failed to save checklist state:', e);
        }
    }

    initAircraftSelector() {
        const select = document.getElementById('aircraft-select');
        select.value = this.currentAircraft;
        select.addEventListener('change', () => {
            this.currentAircraft = select.value;
            this.currentChecklist = 'preflight';
            this.renderTabs();
            this.renderChecklist();
            this.saveState();
        });
    }

    initTabs() {
        const tabs = document.getElementById('checklist-tabs');
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const checklist = e.target.dataset.checklist;
                this.switchChecklist(checklist);
            }
        });
        this.renderTabs();
    }

    renderTabs() {
        const container = document.getElementById('checklist-tabs');
        container.replaceChildren();

        Object.keys(this.checklists).forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (key === this.currentChecklist ? ' active' : '');
            btn.dataset.checklist = key;
            btn.textContent = this.checklists[key].name;

            // Mark completed
            const itemKey = this.currentAircraft + '_' + key;
            const checked = this.checkedItems[itemKey] || [];
            if (checked.length === this.checklists[key].items.length) {
                btn.classList.add('completed');
            }

            container.appendChild(btn);
        });
    }

    initControls() {
        const audioBtn = document.getElementById('btn-audio');
        audioBtn.classList.toggle('active', this.audioEnabled);
        audioBtn.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            audioBtn.classList.toggle('active', this.audioEnabled);
            audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
            this.saveState();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            this.navigateChecklist(-1);
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            this.navigateChecklist(1);
        });
    }

    switchChecklist(name) {
        this.currentChecklist = name;
        this.renderTabs();
        this.renderChecklist();
    }

    createChecklistItem(item, index, isChecked) {
        const div = document.createElement('div');
        div.className = 'checklist-item' + (isChecked ? ' checked' : '');
        div.dataset.index = index;

        const checkbox = document.createElement('div');
        checkbox.className = 'item-checkbox';

        const content = document.createElement('div');
        content.className = 'item-content';

        const textEl = document.createElement('div');
        textEl.className = 'item-text';
        textEl.textContent = item.text;

        const actionEl = document.createElement('div');
        actionEl.className = 'item-action';
        actionEl.textContent = item.action;

        content.appendChild(textEl);
        content.appendChild(actionEl);
        div.appendChild(checkbox);
        div.appendChild(content);

        div.addEventListener('click', () => {
            this.toggleItem(index);
        });

        return div;
    }

    createCompleteMessage(name) {
        const div = document.createElement('div');
        div.className = 'checklist-complete';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.textContent = '✅';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = name + ' Complete!';

        div.appendChild(icon);
        div.appendChild(text);
        return div;
    }

    renderChecklist() {
        const container = document.getElementById('checklist-container');
        const checklist = this.checklists[this.currentChecklist];

        if (!checklist) return;

        container.replaceChildren();

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const allChecked = checked.length === checklist.items.length;

        if (allChecked) {
            container.appendChild(this.createCompleteMessage(checklist.name));
        } else {
            checklist.items.forEach((item, index) => {
                const isChecked = checked.includes(index);
                container.appendChild(this.createChecklistItem(item, index, isChecked));
            });
        }

        this.updateProgress();
        this.renderTabs();
    }

    toggleItem(index) {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const itemIndex = checked.indexOf(index);

        if (itemIndex === -1) {
            checked.push(index);

            if (this.audioEnabled) {
                const item = checklist.items[index];
                this.speak(item.text + ', ' + item.action);
            }
        } else {
            checked.splice(itemIndex, 1);
        }

        this.saveState();
        this.renderChecklist();
    }

    speak(text) {
        if (!this.synth) return;
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v =>
            v.name.includes('Google UK English Female') ||
            v.name.includes('Microsoft Hazel') ||
            v.lang === 'en-GB'
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.synth.speak(utterance);
    }

    updateProgress() {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];
        const total = checklist.items.length;
        const completed = checked.length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progress-fill').style.width = percent + '%';
        document.getElementById('progress-text').textContent = completed + '/' + total;
    }

    resetChecklist() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        this.checkedItems[itemKey] = [];
        this.saveState();
        this.renderChecklist();
    }

    navigateChecklist(direction) {
        const keys = Object.keys(this.checklists);
        const currentIndex = keys.indexOf(this.currentChecklist);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = keys.length - 1;
        if (newIndex >= keys.length) newIndex = 0;

        this.switchChecklist(keys[newIndex]);
    }

    // Voice control integration
    initVoiceControl() {
        // Listen for voice commands via BroadcastChannel
        const channel = new BroadcastChannel('SimGlass-checklist');
        channel.onmessage = (event) => {
            this.handleVoiceCommand(event.data);
        };

        // Also listen via localStorage for fallback
        window.addEventListener('storage', (event) => {
            if (event.key === 'SimGlass-checklist-command') {
                try {
                    const cmd = JSON.parse(event.newValue);
                    // Only process recent commands (within 2 seconds)
                    if (Date.now() - cmd.timestamp < 2000) {
                        this.handleVoiceCommand(cmd);
                    }
                } catch (e) {
                    if (window.telemetry) {
                        telemetry.captureError(e, {
                            operation: 'voiceCommandParse',
                            glass: 'checklist-glass',
                            rawValue: event.newValue
                        });
                    }
                }
            }
        });
    }

    handleVoiceCommand(cmd) {
        if (!cmd || cmd.type !== 'checklist') return;

        switch (cmd.action) {
            case 'checkNext':
                this.checkNextItem();
                break;
            case 'uncheckLast':
                this.uncheckLastItem();
                break;
            case 'reset':
                this.resetChecklist();
                break;
            case 'nextChecklist':
                this.navigateChecklist(1);
                break;
            case 'prevChecklist':
                this.navigateChecklist(-1);
                break;
            case 'goto':
                if (cmd.target && this.checklists[cmd.target]) {
                    this.switchChecklist(cmd.target);
                }
                break;
        }
    }

    checkNextItem() {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        // Find first unchecked item
        for (let i = 0; i < checklist.items.length; i++) {
            if (!checked.includes(i)) {
                this.toggleItem(i);
                break;
            }
        }
    }

    uncheckLastItem() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        if (checked.length > 0) {
            const lastIndex = checked[checked.length - 1];
            this.toggleItem(lastIndex);
        }
    }

    // Multiplayer sync methods
    getState() {
        return {
            aircraft: this.currentAircraft,
            checklist: this.currentChecklist,
            checkedItems: this.checkedItems,
            audioEnabled: this.audioEnabled
        };
    }

    loadState(state) {
        if (!state) return;

        if (state.aircraft && state.aircraft !== this.currentAircraft) {
            this.aircraftSelect.value = state.aircraft;
            this.currentAircraft = state.aircraft;
        }

        if (state.checklist && state.checklist !== this.currentChecklist) {
            this.currentChecklist = state.checklist;
            this.updateTabs();
        }

        if (state.checkedItems) {
            this.checkedItems = state.checkedItems;
        }

        this.renderChecklist();
    }

    handleRemoteAction(action, data) {
        switch (action) {
            case 'toggleItem':
                this.toggleItem(data.index, true);
                break;
            case 'changeChecklist':
                this.currentChecklist = data.checklist;
                this.updateTabs();
                this.renderChecklist();
                break;
            case 'changeAircraft':
                this.aircraftSelect.value = data.aircraft;
                this.currentAircraft = data.aircraft;
                this.renderChecklist();
                break;
            case 'reset':
                this.resetChecklist(true);
                break;
        }
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ChecklistPane = new ChecklistPane();
    window.ChecklistPane.initVoiceControl();
    window.addEventListener('beforeunload', () => window.ChecklistPane?.destroy());
});
