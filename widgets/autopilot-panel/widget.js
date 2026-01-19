/**
 * Autopilot Panel Widget
 * SimWidget Engine v1.0.0
 */

class AutopilotWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            apMaster: false,
            apHdg: false,
            apNav: false,
            apApr: false,
            apAlt: false,
            apVs: false,
            apFlc: false,
            hdgSet: 0,
            altSet: 0,
            vsSet: 0
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.connect();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            apMaster: document.getElementById('btn-ap-master'),
            apStatus: document.getElementById('ap-status'),
            btnHdg: document.getElementById('btn-hdg'),
            btnNav: document.getElementById('btn-nav'),
            btnApr: document.getElementById('btn-apr'),
            btnAlt: document.getElementById('btn-alt'),
            btnVs: document.getElementById('btn-vs'),
            btnFlc: document.getElementById('btn-flc'),
            indHdg: document.getElementById('ind-hdg'),
            indNav: document.getElementById('ind-nav'),
            indApr: document.getElementById('ind-apr'),
            indAlt: document.getElementById('ind-alt'),
            indVs: document.getElementById('ind-vs'),
            indFlc: document.getElementById('ind-flc'),
            hdgSet: document.getElementById('hdg-set'),
            altSet: document.getElementById('alt-set'),
            vsSet: document.getElementById('vs-set')
        };
    }

    setupEvents() {
        // AP Master toggle
        this.elements.apMaster.addEventListener('click', () => {
            this.sendCommand('AP_MASTER');
        });

        // Mode buttons
        const modeButtons = ['btnHdg', 'btnNav', 'btnApr', 'btnAlt', 'btnVs', 'btnFlc'];
        modeButtons.forEach(btn => {
            if (this.elements[btn]) {
                this.elements[btn].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                });
            }
        });
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            console.log('[AP] Connected to SimWidget');
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateData(msg.data);
                }
            } catch (e) {
                console.error('[AP] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[AP] Disconnected');
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('[AP] WebSocket error:', err);
        };
    }

    sendCommand(command, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: command,
                value: value
            }));
        }
    }

    updateData(data) {
        this.data.apMaster = data.apMaster || false;
        this.data.apHdg = data.apHdgLock || false;
        this.data.apNav = data.apNavLock || false;
        this.data.apApr = data.apAprHold || false;
        this.data.apAlt = data.apAltLock || false;
        this.data.apVs = data.apVsLock || false;
        this.data.apFlc = data.apFlcActive || false;
        this.data.hdgSet = data.apHdgSet || 0;
        this.data.altSet = data.apAltSet || 0;
        this.data.vsSet = data.apVsSet || 0;

        this.updateUI();
    }

    updateUI() {
        // AP Master
        this.elements.apMaster.classList.toggle('engaged', this.data.apMaster);
        this.elements.apStatus.textContent = this.data.apMaster ? 'AP ON' : 'AP OFF';

        // Mode buttons
        this.elements.btnHdg.classList.toggle('active', this.data.apHdg);
        this.elements.btnNav.classList.toggle('active', this.data.apNav);
        this.elements.btnApr.classList.toggle('active', this.data.apApr);
        this.elements.btnAlt.classList.toggle('active', this.data.apAlt);
        this.elements.btnVs.classList.toggle('active', this.data.apVs);
        this.elements.btnFlc.classList.toggle('active', this.data.apFlc);

        // Settings
        this.elements.hdgSet.textContent = String(Math.round(this.data.hdgSet)).padStart(3, '0') + '°';
        this.elements.altSet.textContent = Math.round(this.data.altSet).toLocaleString() + 'ft';
        this.elements.vsSet.textContent = (this.data.vsSet >= 0 ? '+' : '') + Math.round(this.data.vsSet) + 'fpm';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.apWidget = new AutopilotWidget();
});
