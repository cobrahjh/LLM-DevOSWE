/**
 * Toolbar Panel glass
 * Compact panel container with tab navigation and quick actions
 * Designed for MSFS toolbar or sidebar embedding
 */
class ToolbarPanelGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'toolbar-panel',
            widgetVersion: '1.1.0',
            statusElementId: 'status-dot',
            autoConnect: true
        });

        this.flightData = {};

        this.initElements();
        this.initEvents();
    }

    initElements() {
        this.widgetFrame = document.getElementById('glass-frame');
        this.statusDot = document.getElementById('status-dot');
        this.tabs = document.getElementById('tabs');
    }

    initEvents() {
        // Tab switching
        this.tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            this.tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.widgetFrame.src = '/ui/' + btn.dataset.glass + '/';
        });

        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                if (cmd) {
                    btn.classList.add('active');
                    this.sendCommand(cmd);
                    setTimeout(() => btn.classList.remove('active'), 250);
                }
            });
        });
    }

    sendCommand(cmd, value = 0) {
        // Try WebSocket first, fall back to REST
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', event: cmd, value }));
        } else {
            fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd, value })
            }).catch(() => {});
        }
    }

    // SimGlassBase lifecycle hooks
    onConnect() {
        this.statusDot.classList.add('connected');
    }

    onDisconnect() {
        this.statusDot.classList.remove('connected');
    }

    onMessage(data) {
        this.flightData = data;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.toolbarPanel = new ToolbarPanelGlass();
    // SimGlassBase provides destroy() - wire to beforeunload
    window.addEventListener('beforeunload', () => window.toolbarPanel?.destroy());
});
