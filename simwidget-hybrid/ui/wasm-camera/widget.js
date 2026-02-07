/**
 * WASM Camera Widget v2.0.0
 * Last updated: 2026-02-07
 *
 * Controls smooth cinematic camera via WASM module
 */

const API_BASE = `http://${window.location.host}`;

class WasmCameraWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'wasm-camera',
            widgetVersion: '2.0.0',
            autoConnect: false  // HTTP polling for WASM module status
        });

        this._destroyed = false;
        this._wasmPollInterval = null;
        this.isActive = false;
        this.isReady = false;
        this.currentPreset = 1;
        this.smoothing = 50;

        this.initElements();
        this.initEvents();
        this.updatePresetButtons();
        this.checkStatus();
        this._wasmPollInterval = setInterval(() => this.checkStatus(), 2000);

        console.log('[WASM Camera Widget] Initialized');
    }

    initElements() {
        this.statusDot = document.getElementById('status-dot');
        this.btnFlyby = document.getElementById('btn-flyby');
        this.btnTower = document.getElementById('btn-tower');
        this.btnNext = document.getElementById('btn-next');
        this.btnReset = document.getElementById('btn-reset');
        this.smoothSlider = document.getElementById('smooth-slider');
        this.smoothValue = document.getElementById('smooth-value');
        this.infoBar = document.getElementById('info-bar');
        this.presetBtns = document.querySelectorAll('.preset-btn');
    }

    initEvents() {
        // Smoothing slider
        this.smoothSlider.addEventListener('input', () => {
            this.smoothing = parseInt(this.smoothSlider.value);
            this.smoothValue.textContent = this.smoothing;
        });

        // Action buttons
        this.btnFlyby.addEventListener('click', () => this.sendCommand('flyby', this.smoothing));
        this.btnTower.addEventListener('click', () => this.sendCommand('tower', this.smoothing));
        this.btnNext.addEventListener('click', () => this.sendCommand('orbit', this.smoothing));
        this.btnReset.addEventListener('click', () => this.sendCommand('cockpit', this.smoothing));

        // Preset buttons
        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                this.currentPreset = parseInt(btn.dataset.preset);
                await this.sendCommand('preset', this.smoothing);
                await new Promise(r => setTimeout(r, 100));
                this.updatePresetButtons();
            });
        });
    }

    async sendCommand(action, smooth) {
        try {
            const res = await fetch(`${API_BASE}/api/wasm-camera`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, smooth })
            });
            const data = await res.json();
            if (data.success) {
                console.log(`[Camera] ${action} success`);
            } else {
                console.error(`[Camera] ${action} failed:`, data.error);
            }
            return data;
        } catch (err) {
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'sendCommand',
                    widget: 'wasm-camera',
                    action: action
                });
            }
            return { success: false, error: err.message };
        }
    }

    async checkStatus() {
        try {
            const res = await fetch(`${API_BASE}/api/wasm-camera/status`);
            const data = await res.json();

            this.isReady = data.ready;
            const mode = data.status;
            this.isActive = mode !== 0;

            this.updateUI();
        } catch (err) {
            this.isReady = false;
            this.isActive = false;
            this.updateUI();
        }
    }

    updateUI() {
        // Status indicator
        this.statusDot.classList.remove('ready', 'active');
        if (this.isActive) {
            this.statusDot.classList.add('active');
            this.statusDot.title = 'Camera Active';
        } else if (this.isReady) {
            this.statusDot.classList.add('ready');
            this.statusDot.title = 'WASM Module Ready';
        } else {
            this.statusDot.title = 'WASM Module Not Detected';
        }

        // Buttons
        this.btnFlyby.disabled = !this.isReady;
        this.btnTower.disabled = !this.isReady;
        this.btnNext.disabled = !this.isReady;
        this.btnReset.disabled = !this.isReady;
        this.smoothSlider.disabled = !this.isReady;

        // Info bar
        if (!this.isReady) {
            this.infoBar.textContent = '⚠️ WASM module not detected. Install from Community folder.';
            this.infoBar.style.display = 'flex';
        } else if (this.isActive) {
            this.infoBar.textContent = '🎥 Camera active';
            this.infoBar.style.display = 'flex';
        } else {
            this.infoBar.style.display = 'none';
        }
    }

    updatePresetButtons() {
        this.presetBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.preset) === this.currentPreset);
        });
    }

    destroy() {
        this._destroyed = true;

        if (this._wasmPollInterval) {
            clearInterval(this._wasmPollInterval);
            this._wasmPollInterval = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.wasmCamera = new WasmCameraWidget();
    window.addEventListener('beforeunload', () => window.wasmCamera?.destroy());
});
