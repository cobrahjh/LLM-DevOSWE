/**
 * Panel Launcher pane - SimGlass v2.0.0
 * Quick access to G1000/avionics panels and controls
 */

class PanelLauncher extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'panel-launcher',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.apiUrl = 'http://' + window.location.host;
        this.compactMode = false;
        this.flightData = null;
        this.initButtons();
        this.initCompactMode();
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        // Server sends { type: 'flightData', data: {...} }
        if (msg.type === 'flightData' && msg.data) {
            // Store flight data for compact mode updates
            this.flightData = msg.data;
            this.updateCompact();
        } else if (msg.connected !== undefined) {
            // Direct connection status updates
            this.updateStatus(msg.connected);
            this.updateCompact();
        }
    }

    onConnect() {
        console.log('[Panel Launcher] Connected to SimGlass');
    }

    onDisconnect() {
        console.log('[Panel Launcher] Disconnected');
    }

    // Update connection status indicator
    updateStatus(connected) {
        const statusDot = document.getElementById('status');
        if (statusDot) {
            statusDot.classList.toggle('connected', connected);
        }
    }

    // Send command via REST API
    async sendCommand(command, value = 0) {
        try {
            const response = await fetch(`${this.apiUrl}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, value })
            });
            const result = await response.json();
            console.log(`[Panel Launcher] Command ${command}:`, result);
            return result;
        } catch (err) {
            console.error(`[Panel Launcher] Command error:`, err);
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'sendCommand',
                    glass: 'panel-launcher',
                    command
                });
            }
            return { success: false, error: err.message };
        }
    }

    // Send H: event via REST API
    async sendHEvent(hevent) {
        try {
            // H: events are sent as a special command format
            const response = await fetch(`${this.apiUrl}/api/hevent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: hevent })
            });
            const result = await response.json();
            console.log(`[Panel Launcher] H:${hevent}:`, result);
            return result;
        } catch (err) {
            // Fallback: try as regular command with H: prefix
            console.log(`[Panel Launcher] Trying H:${hevent} as command fallback`);
            return this.sendCommand(`H:${hevent}`);
        }
    }

    // Initialize compact mode
    initCompactMode() {
        const compactKey = 'panel-launcher-compact';
        const container = document.querySelector('.widget-container');
        const toggle = document.getElementById('compact-toggle');

        // Read from localStorage
        const savedCompact = localStorage.getItem(compactKey);
        this.compactMode = savedCompact === 'true';

        // Apply initial state
        if (this.compactMode && container) {
            container.classList.add('compact');
        }
        if (toggle) {
            toggle.classList.toggle('active', this.compactMode);
        }

        // Toggle handler
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.compactMode = !this.compactMode;
                localStorage.setItem(compactKey, this.compactMode);

                if (container) {
                    container.classList.toggle('compact', this.compactMode);
                }
                toggle.classList.toggle('active', this.compactMode);

                this.updateCompact();
            });
        }

        // Initial update
        this.updateCompact();
    }

    // Update compact mode display
    updateCompact() {
        if (!this.compactMode) return;

        // Update power status
        const powerEl = document.getElementById('compact-power');
        const avionicsEl = document.getElementById('compact-avionics');
        const statusEl = document.getElementById('compact-status');
        const themeEl = document.getElementById('compact-theme');

        if (this.flightData) {
            // Update based on actual flight data if available
            const batteryOn = this.flightData.ELECTRICAL_MASTER_BATTERY === 1;
            const avionicsOn = this.flightData.AVIONICS_MASTER_SWITCH === 1;

            if (powerEl) powerEl.textContent = batteryOn ? 'ON' : 'OFF';
            if (avionicsEl) avionicsEl.textContent = avionicsOn ? 'ON' : 'OFF';
        } else {
            // Default values when no flight data
            if (powerEl) powerEl.textContent = '---';
            if (avionicsEl) avionicsEl.textContent = '---';
        }

        // Update connection status
        const statusDot = document.getElementById('status');
        const connected = statusDot && statusDot.classList.contains('connected');
        if (statusEl) {
            statusEl.textContent = connected ? 'CONN' : 'DISC';
            statusEl.style.color = connected ? 'var(--sg-accent-green, #00ff88)' : '#ff4444';
        }

        // Update theme
        if (themeEl && window.SimGlassThemes) {
            const currentTheme = SimGlassThemes.getCurrentTheme();
            themeEl.textContent = currentTheme.substring(0, 4).toUpperCase();
        } else if (themeEl) {
            themeEl.textContent = 'DARK';
        }
    }

    // Initialize button handlers
    initButtons() {
        // Standard command buttons
        document.querySelectorAll('[data-command]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const command = btn.dataset.command;
                btn.classList.add('active');
                await this.sendCommand(command);
                setTimeout(() => btn.classList.remove('active'), 200);
            });
        });

        // H: event buttons (G1000 controls)
        document.querySelectorAll('[data-hevent]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const hevent = btn.dataset.hevent;
                btn.classList.add('active');
                await this.sendHEvent(hevent);
                setTimeout(() => btn.classList.remove('active'), 150);
            });
        });
    }

    // Cleanup - extends SimGlassBase.destroy()
    destroy() {
        // Call parent destroy for WebSocket cleanup
        super.destroy();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Panel Launcher] Initializing...');
    window.panelLauncher = new PanelLauncher();
    window.addEventListener('beforeunload', () => window.panelLauncher?.destroy());
});
