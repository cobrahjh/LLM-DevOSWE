/**
 * Toolbar Panel Widget
 * Compact panel container with tab navigation and quick actions
 * Designed for MSFS toolbar or sidebar embedding
 */
class ToolbarPanelWidget {
    constructor() {
        this._destroyed = false;
        this.ws = null;
        this.connected = false;
        this.flightData = {};

        this.initElements();
        this.initEvents();
        this.connectWebSocket();
    }

    initElements() {
        this.widgetFrame = document.getElementById('widget-frame');
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
            this.widgetFrame.src = '/ui/' + btn.dataset.widget + '/';
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

    connectWebSocket() {
        if (this._destroyed) return;

        const host = location.hostname || '127.0.0.1';
        const port = location.port || '8080';
        this.ws = new WebSocket('ws://' + host + ':' + port);

        this.ws.onopen = () => {
            this.connected = true;
            this.statusDot.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.flightData = data;
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.connected = false;
            this.statusDot.classList.remove('connected');
            if (!this._destroyed) {
                setTimeout(() => this.connectWebSocket(), 3000);
            }
        };

        this.ws.onerror = () => {
            this.connected = false;
            this.statusDot.classList.remove('connected');
        };
    }

    destroy() {
        this._destroyed = true;
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.toolbarPanel = new ToolbarPanelWidget();
    window.addEventListener('beforeunload', () => window.toolbarPanel?.destroy());
});
