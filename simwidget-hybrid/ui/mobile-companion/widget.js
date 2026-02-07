/**
 * Mobile Companion Widget
 * Remote control + flight data viewer for phone/tablet
 */
class MobileCompanionWidget {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.BASE = location.origin;
        this.pollTimer = null;

        this.initElements();
        this.initEvents();
        this.connectWebSocket();
        this.startPolling();
    }

    initElements() {
        this.statusEl = document.getElementById('status');
        this.altEl = document.getElementById('altitude');
        this.spdEl = document.getElementById('speed');
        this.hdgEl = document.getElementById('heading');
        this.vsEl = document.getElementById('vs');
        this.iframe = document.getElementById('widget-iframe');
        this.sections = document.querySelectorAll('.section');
        this.navBtns = document.querySelectorAll('.nav-btn');
    }

    initEvents() {
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                if (cmd) {
                    btn.classList.add('flash');
                    this.sendCommand(cmd);
                    setTimeout(() => btn.classList.remove('flash'), 200);
                }
            });
        });

        // Widget tabs
        document.querySelectorAll('.widget-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.iframe.src = '/ui/' + tab.dataset.widget + '-widget/';
            });
        });

        // Bottom nav
        this.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.showSection(section, btn);
            });
        });
    }

    showSection(section, btn) {
        this.navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.sections.forEach(s => s.classList.remove('active'));
        const target = document.getElementById('section-' + section);
        if (target) target.classList.add('active');
    }

    async sendCommand(cmd) {
        try {
            await fetch(this.BASE + '/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
        } catch (e) {
            // Silently fail - status shows connection state
        }
    }

    connectWebSocket() {
        const host = location.hostname || '127.0.0.1';
        const port = location.port || '8080';
        this.ws = new WebSocket('ws://' + host + ':' + port);

        this.ws.onopen = () => {
            this.connected = true;
            this.updateStatus(true);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'simdata' || data.PLANE_ALTITUDE !== undefined) {
                    this.updateFlightData(data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.connected = false;
            this.updateStatus(false);
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onerror = () => {
            this.connected = false;
            this.updateStatus(false);
        };
    }

    startPolling() {
        this.pollTimer = setInterval(() => this.fetchFlightData(), 1000);
        this.fetchFlightData();
    }

    async fetchFlightData() {
        try {
            const res = await fetch(this.BASE + '/api/simvars');
            if (res.ok) {
                const d = await res.json();
                this.updateFlightData(d);
                this.updateStatus(true);
            }
        } catch (e) {
            if (!this.connected) this.updateStatus(false);
        }
    }

    updateFlightData(d) {
        this.altEl.textContent = Math.round(d.PLANE_ALTITUDE || d.altitude || 0);
        this.spdEl.textContent = Math.round(d.AIRSPEED_INDICATED || d.airspeed || 0);
        this.hdgEl.textContent = Math.round(d.PLANE_HEADING_DEGREES_TRUE || d.heading || 0);
        this.vsEl.textContent = Math.round(d.VERTICAL_SPEED || d.verticalSpeed || 0);
    }

    updateStatus(connected) {
        if (connected) {
            this.statusEl.textContent = 'Connected';
            this.statusEl.classList.add('status-connected');
        } else {
            this.statusEl.textContent = 'Disconnected';
            this.statusEl.classList.remove('status-connected');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCompanion = new MobileCompanionWidget();
});
