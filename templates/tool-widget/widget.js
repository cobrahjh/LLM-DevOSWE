/**
 * Tool Widget Template v1.0.0
 * 
 * Template for utility widgets with start/stop/pause functionality
 * 
 * Path: templates/tool-widget/widget.js
 * Last Updated: 2025-01-08
 */

class ToolWidget {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.timerInterval = null;
        this.results = [];
        this.settings = {
            autosave: true,
            interval: 100
        };
        
        this.init();
    }

    init() {
        this.initWebSocket();
        this.initUI();
        this.initSettings();
        this.loadSettings();
        this.loadResults();
    }

    // ============================================================
    // WEBSOCKET
    // ============================================================

    initWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:8080`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.connected = true;
            this.updateStatus('ready', 'Ready');
        };
        
        this.ws.onclose = () => {
            this.connected = false;
            this.updateStatus('disconnected', 'Disconnected');
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.ws.onerror = (err) => {
            console.error('[Widget] WebSocket error:', err);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleData(msg);
            } catch (err) {
                console.error('[Widget] Parse error:', err);
            }
        };
    }

    handleData(data) {
        // Process incoming data while running
        if (this.isRunning && !this.isPaused && data.type === 'flightData') {
            this.processData(data.data);
        }
    }

    processData(data) {
        // Override this method for specific processing
        // Example: Add to results, update stats, etc.
    }

    sendCommand(command, value = 1) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command, value }));
        }
    }

    // ============================================================
    // TRANSPORT CONTROLS
    // ============================================================

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();
        
        this.updateStatus('running', 'Running...');
        this.updateButtons();
        this.startTimer();
        
        console.log('[Widget] Started');
    }

    pause() {
        if (!this.isRunning) return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.updateStatus('paused', 'Paused');
            this.stopTimer();
        } else {
            this.updateStatus('running', 'Running...');
            this.startTimer();
        }
        
        this.updateButtons();
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.isPaused = false;
        this.stopTimer();
        
        this.updateStatus('ready', 'Ready');
        this.updateButtons();
        
        if (this.settings.autosave) {
            this.saveResults();
        }
        
        console.log('[Widget] Stopped');
    }

    // ============================================================
    // TIMER
    // ============================================================

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimer() {
        if (!this.startTime) return;
        
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.setDisplay('stat-duration', display);
    }

    // ============================================================
    // RESULTS
    // ============================================================

    addResult(item) {
        this.results.push(item);
        this.renderResults();
        this.setDisplay('stat-items', this.results.length);
    }

    clearResults() {
        this.results = [];
        this.renderResults();
        this.setDisplay('stat-items', '0');
    }

    renderResults() {
        const list = document.getElementById('results-list');
        const count = document.getElementById('list-count');
        
        if (!list) return;
        
        if (this.results.length === 0) {
            list.innerHTML = '<li class="list-empty">No results yet</li>';
        } else {
            list.innerHTML = this.results.slice(-20).reverse().map((item, i) => `
                <li class="list-item">
                    <span class="item-icon">📄</span>
                    <span class="item-text">${item.text || item}</span>
                    <span class="item-meta">${item.time || ''}</span>
                </li>
            `).join('');
        }
        
        if (count) count.textContent = `(${this.results.length})`;
    }

    loadResults() {
        const saved = localStorage.getItem('widget_tool_results');
        if (saved) {
            try {
                this.results = JSON.parse(saved);
                this.renderResults();
            } catch (err) {
                console.error('[Widget] Results load error:', err);
            }
        }
    }

    saveResults() {
        localStorage.setItem('widget_tool_results', JSON.stringify(this.results));
    }

    exportResults() {
        const blob = new Blob([JSON.stringify(this.results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importResults() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                this.results = Array.isArray(data) ? data : [];
                this.renderResults();
                this.saveResults();
            } catch (err) {
                console.error('[Widget] Import error:', err);
            }
        };
        input.click();
    }

    // ============================================================
    // UI INITIALIZATION
    // ============================================================

    initUI() {
        // Transport buttons
        document.getElementById('btn-start')?.addEventListener('click', () => this.start());
        document.getElementById('btn-pause')?.addEventListener('click', () => this.pause());
        document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
        
        // Action buttons
        document.getElementById('btn-clear')?.addEventListener('click', () => this.clearResults());
        document.getElementById('btn-export')?.addEventListener('click', () => this.exportResults());
        document.getElementById('btn-import')?.addEventListener('click', () => this.importResults());
        
        // Transparency toggle
        document.getElementById('btn-transparency')?.addEventListener('click', () => this.toggleTransparency());
        
        // Load transparency state
        if (localStorage.getItem('widget_transparent') === 'true') {
            document.body.classList.add('transparent');
        }
    }

    updateButtons() {
        const btnStart = document.getElementById('btn-start');
        const btnPause = document.getElementById('btn-pause');
        const btnStop = document.getElementById('btn-stop');
        
        if (btnStart) btnStart.disabled = this.isRunning;
        if (btnPause) {
            btnPause.disabled = !this.isRunning;
            btnPause.querySelector('.btn-label').textContent = this.isPaused ? 'Resume' : 'Pause';
        }
        if (btnStop) btnStop.disabled = !this.isRunning;
    }

    // ============================================================
    // SETTINGS
    // ============================================================

    initSettings() {
        const btnSettings = document.getElementById('btn-settings');
        const btnClose = document.getElementById('settings-close');
        const panel = document.getElementById('settings-panel');
        
        if (btnSettings && panel) {
            btnSettings.addEventListener('click', () => panel.hidden = !panel.hidden);
        }
        if (btnClose && panel) {
            btnClose.addEventListener('click', () => panel.hidden = true);
        }

        document.getElementById('setting-autosave')?.addEventListener('change', (e) => {
            this.settings.autosave = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('setting-interval')?.addEventListener('change', (e) => {
            this.settings.interval = parseInt(e.target.value) || 100;
            this.saveSettings();
        });
    }

    loadSettings() {
        const saved = localStorage.getItem('widget_tool_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                
                const autosaveEl = document.getElementById('setting-autosave');
                if (autosaveEl) autosaveEl.checked = this.settings.autosave;
                
                const intervalEl = document.getElementById('setting-interval');
                if (intervalEl) intervalEl.value = this.settings.interval;
            } catch (err) {
                console.error('[Widget] Settings load error:', err);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('widget_tool_settings', JSON.stringify(this.settings));
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    updateStatus(state, message) {
        const indicator = document.getElementById('status-indicator');
        const messageEl = document.getElementById('status-message');
        const iconEl = indicator?.querySelector('.status-icon');
        
        if (indicator) {
            indicator.className = `status-indicator ${state}`;
        }
        if (iconEl) {
            const icons = { ready: '○', running: '●', paused: '◐', disconnected: '✕' };
            iconEl.textContent = icons[state] || '○';
        }
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    setDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        localStorage.setItem('widget_transparent', document.body.classList.contains('transparent'));
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.widget = new ToolWidget();
});
