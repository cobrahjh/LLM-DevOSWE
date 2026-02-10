/**
 * Kneeboard pane - SimGlass v2.0.0
 * Combined notes, frequencies, timer, and reference
 */

class KneeboardPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'kneeboard-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for kneeboard
        });

        this.currentTab = 'notes';
        this.notes = '';
        this.frequencies = [];
        this.flightTimerRunning = false;
        this.flightTimerStart = null;
        this.flightTimerElapsed = 0;
        this.countdownRunning = false;
        this.countdownEnd = null;
        this.compactMode = false;

        this.loadState();
        this.initCompactMode();
        this.initTabs();
        this.initNotes();
        this.initFrequencies();
        this.initTimers();
        this.initClear();

        // Start clock updates
        this.updateZuluTime();
        this._clockInterval = setInterval(() => {
            this.updateZuluTime();
            if (this.compactMode) {
                this.updateCompact();
            }
        }, 1000);
    }

    loadState() {
        try {
            const saved = localStorage.getItem('kneeboard-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.notes = state.notes || '';
                this.frequencies = state.frequencies || [];
                this.flightTimerElapsed = state.flightTimerElapsed || 0;
            }

            // Load compact mode preference
            const compactPref = localStorage.getItem('kneeboard-widget-compact');
            this.compactMode = compactPref === 'true';
        } catch (e) {
            console.error('[Kneeboard] Failed to load state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('kneeboard-glass-state', JSON.stringify({
                notes: this.notes,
                frequencies: this.frequencies,
                flightTimerElapsed: this.flightTimerElapsed
            }));

            // Save compact mode preference
            localStorage.setItem('kneeboard-widget-compact', this.compactMode.toString());
        } catch (e) {
            console.error('[Kneeboard] Failed to save state:', e);
        }
    }

    // Compact Mode
    initCompactMode() {
        const toggleBtn = document.getElementById('compact-toggle');
        const container = document.querySelector('.widget-container');

        // Apply saved compact mode state
        if (this.compactMode) {
            container.classList.add('compact');
            toggleBtn.classList.add('active');
            this.updateCompact();
        }

        // Toggle handler
        toggleBtn.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            container.classList.toggle('compact', this.compactMode);
            toggleBtn.classList.toggle('active', this.compactMode);
            this.saveState();

            if (this.compactMode) {
                this.updateCompact();
            }
        });
    }

    updateCompact() {
        if (!this.compactMode) return;

        // Update Zulu time
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        document.getElementById('compact-zulu').textContent = hours + ':' + minutes + 'Z';

        // Update flight timer
        let flightTime = '00:00';
        if (this.flightTimerRunning) {
            const elapsed = this.flightTimerElapsed + (Date.now() - this.flightTimerStart);
            const totalSeconds = Math.floor(elapsed / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            if (hours > 0) {
                flightTime = hours + ':' + minutes;
            } else {
                const seconds = String(totalSeconds % 60).padStart(2, '0');
                flightTime = minutes + ':' + seconds;
            }
        } else if (this.flightTimerElapsed > 0) {
            const totalSeconds = Math.floor(this.flightTimerElapsed / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            if (hours > 0) {
                flightTime = hours + ':' + minutes;
            } else {
                const seconds = String(totalSeconds % 60).padStart(2, '0');
                flightTime = minutes + ':' + seconds;
            }
        }
        document.getElementById('compact-flight').textContent = flightTime;

        // Update notes count
        const noteLines = this.notes.split('\n').filter(l => l.trim()).length;
        document.getElementById('compact-notes').textContent = noteLines > 0 ? noteLines + ' lines' : 'Empty';

        // Update frequencies
        for (let i = 0; i < 3; i++) {
            const elem = document.getElementById('compact-freq' + (i + 1));
            if (this.frequencies[i]) {
                elem.textContent = this.frequencies[i].value;
            } else {
                elem.textContent = '---';
            }
        }
    }

    // Tab Management
    initTabs() {
        const tabsContainer = document.getElementById('kneeboard-tabs');
        tabsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('kb-tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.kb-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update panels
        document.querySelectorAll('.kb-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === 'panel-' + tabName);
        });
    }

    // Notes
    initNotes() {
        const textarea = document.getElementById('notes-area');
        textarea.value = this.notes;

        textarea.addEventListener('input', () => {
            this.notes = textarea.value;
            this.saveState();
            this.updateCompact();
        });

        // Templates
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const template = this.getTemplate(btn.dataset.template);
                this.insertTemplate(template);
            });
        });
    }

    getTemplate(type) {
        const templates = {
            atis: 'ATIS: ___\nWIND: ___@___\nVIS: ___\nCLG: ___\nTEMP: ___/___\nALT: ___\nRWY: ___\n',
            clearance: 'CLR TO: ___\nVIA: ___\nALT: ___\nDEP: ___\nSQK: ___\n',
            squawk: 'SQK: ____\n'
        };
        return templates[type] || '';
    }

    insertTemplate(template) {
        const textarea = document.getElementById('notes-area');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + template + text.substring(end);
        this.notes = textarea.value;
        this.saveState();

        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + template.length;
    }

    // Frequencies
    initFrequencies() {
        this.renderFrequencies();

        document.getElementById('btn-add-freq').addEventListener('click', () => {
            this.addFrequency();
        });

        // Enter key to add
        document.getElementById('freq-value').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addFrequency();
        });
    }

    renderFrequencies() {
        const list = document.getElementById('freq-list');
        list.replaceChildren();

        if (this.frequencies.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'freq-item';
            empty.style.justifyContent = 'center';
            empty.style.color = 'var(--glass-text-dim)';
            empty.textContent = 'No frequencies saved';
            list.appendChild(empty);
            return;
        }

        this.frequencies.forEach((freq, index) => {
            const item = document.createElement('div');
            item.className = 'freq-item';

            const name = document.createElement('span');
            name.className = 'freq-name';
            name.textContent = freq.name;

            const value = document.createElement('span');
            value.className = 'freq-value';
            value.textContent = freq.value;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'freq-delete';
            deleteBtn.textContent = '✕';
            deleteBtn.addEventListener('click', () => this.deleteFrequency(index));

            item.appendChild(name);
            item.appendChild(value);
            item.appendChild(deleteBtn);
            list.appendChild(item);
        });
    }

    addFrequency() {
        const nameInput = document.getElementById('freq-name');
        const valueInput = document.getElementById('freq-value');

        const name = nameInput.value.trim().toUpperCase();
        const value = valueInput.value.trim();

        if (!name || !value) return;

        this.frequencies.push({ name, value });
        this.saveState();
        this.renderFrequencies();
        this.updateCompact();

        nameInput.value = '';
        valueInput.value = '';
        nameInput.focus();
    }

    deleteFrequency(index) {
        this.frequencies.splice(index, 1);
        this.saveState();
        this.renderFrequencies();
        this.updateCompact();
    }

    // Timers
    initTimers() {
        // Flight timer
        document.getElementById('btn-timer-start').addEventListener('click', () => {
            this.toggleFlightTimer();
        });

        document.getElementById('btn-timer-reset').addEventListener('click', () => {
            this.resetFlightTimer();
        });

        // Countdown
        document.getElementById('btn-countdown-start').addEventListener('click', () => {
            this.startCountdown();
        });

        // Update timers every second
        this._timerInterval = setInterval(() => {
            this.updateFlightTimer();
            this.updateCountdown();
        }, 1000);
    }

    updateZuluTime() {
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        document.getElementById('zulu-time').textContent = hours + ':' + minutes + ':' + seconds + 'Z';
    }

    toggleFlightTimer() {
        const btn = document.getElementById('btn-timer-start');

        if (this.flightTimerRunning) {
            // Stop
            this.flightTimerRunning = false;
            this.flightTimerElapsed += Date.now() - this.flightTimerStart;
            this.saveState();
            btn.textContent = '▶️ Start';
        } else {
            // Start
            this.flightTimerRunning = true;
            this.flightTimerStart = Date.now();
            btn.textContent = '⏸️ Pause';
        }
    }

    resetFlightTimer() {
        this.flightTimerRunning = false;
        this.flightTimerStart = null;
        this.flightTimerElapsed = 0;
        this.saveState();
        document.getElementById('btn-timer-start').textContent = '▶️ Start';
        document.getElementById('flight-timer').textContent = '00:00:00';
    }

    updateFlightTimer() {
        if (!this.flightTimerRunning) return;

        const elapsed = this.flightTimerElapsed + (Date.now() - this.flightTimerStart);
        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');

        document.getElementById('flight-timer').textContent = hours + ':' + minutes + ':' + seconds;
    }

    startCountdown() {
        const minutes = parseInt(document.getElementById('countdown-min').value) || 5;
        this.countdownEnd = Date.now() + (minutes * 60 * 1000);
        this.countdownRunning = true;

        document.getElementById('countdown-setup').classList.add('hidden');
        document.getElementById('countdown-display').classList.remove('hidden');
    }

    updateCountdown() {
        if (!this.countdownRunning) return;

        const remaining = this.countdownEnd - Date.now();
        const display = document.getElementById('countdown-display');

        if (remaining <= 0) {
            this.countdownRunning = false;
            display.textContent = '00:00';
            display.classList.add('warning');

            // Play alert sound
            this.playAlert();

            // Reset after 5 seconds
            setTimeout(() => {
                display.classList.add('hidden');
                display.classList.remove('warning');
                document.getElementById('countdown-setup').classList.remove('hidden');
            }, 5000);
            return;
        }

        const totalSeconds = Math.ceil(remaining / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        display.textContent = minutes + ':' + seconds;

        // Warning at 30 seconds
        display.classList.toggle('warning', totalSeconds <= 30);
    }

    playAlert() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.3;

            osc.start();
            setTimeout(() => osc.stop(), 200);
            setTimeout(() => {
                osc.frequency.value = 880;
                osc.start();
                setTimeout(() => osc.stop(), 200);
            }, 300);
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'playBeep',
                    glass: 'kneeboard-glass',
                    audioContext: 'WebAudioAPI'
                });
            }
        }
    }

    // Clear
    initClear() {
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (this.currentTab === 'notes') {
                if (confirm('Clear all notes?')) {
                    this.notes = '';
                    document.getElementById('notes-area').value = '';
                    this.saveState();
                }
            } else if (this.currentTab === 'frequencies') {
                if (confirm('Clear all frequencies?')) {
                    this.frequencies = [];
                    this.saveState();
                    this.renderFrequencies();
                }
            }
        });
    }

    destroy() {
        if (this._clockInterval) {
            clearInterval(this._clockInterval);
            this._clockInterval = null;
        }
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.KneeboardPane = new KneeboardPane();
    window.addEventListener('beforeunload', () => window.KneeboardPane?.destroy());
});
