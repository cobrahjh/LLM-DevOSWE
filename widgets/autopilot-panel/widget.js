/**
 * Autopilot Panel Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class AutopilotWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            apMaster: false,
            fdActive: false,
            apHdg: false,
            apNav: false,
            apApr: false,
            apAlt: false,
            apVs: false,
            apFlc: false,
            apSpd: false,
            hdgSet: 0,
            altSet: 0,
            vsSet: 0,
            spdSet: 0
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.connect();
        this.startMockUpdate();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            fdStatus: document.getElementById('fd-status'),
            apMaster: document.getElementById('btn-ap-master'),
            apStatus: document.getElementById('ap-status'),
            btnHdg: document.getElementById('btn-hdg'),
            btnNav: document.getElementById('btn-nav'),
            btnApr: document.getElementById('btn-apr'),
            btnAlt: document.getElementById('btn-alt'),
            btnVs: document.getElementById('btn-vs'),
            btnFlc: document.getElementById('btn-flc'),
            btnSpd: document.getElementById('btn-spd'),
            indHdg: document.getElementById('ind-hdg'),
            indNav: document.getElementById('ind-nav'),
            indApr: document.getElementById('ind-apr'),
            indAlt: document.getElementById('ind-alt'),
            indVs: document.getElementById('ind-vs'),
            indFlc: document.getElementById('ind-flc'),
            indSpd: document.getElementById('ind-spd'),
            hdgSet: document.getElementById('hdg-set'),
            altSet: document.getElementById('alt-set'),
            vsSet: document.getElementById('vs-set'),
            spdSet: document.getElementById('spd-set')
        };
    }

    setupEvents() {
        // AP Master toggle
        this.elements.apMaster.addEventListener('click', () => {
            this.sendCommand('AP_MASTER');
            // Toggle locally for demo
            this.data.apMaster = !this.data.apMaster;
            this.updateUI();
        });

        // Mode buttons
        const modeButtons = [
            { el: 'btnHdg', key: 'apHdg' },
            { el: 'btnNav', key: 'apNav' },
            { el: 'btnApr', key: 'apApr' },
            { el: 'btnAlt', key: 'apAlt' },
            { el: 'btnVs', key: 'apVs' },
            { el: 'btnFlc', key: 'apFlc' },
            { el: 'btnSpd', key: 'apSpd' }
        ];

        modeButtons.forEach(({ el, key }) => {
            if (this.elements[el]) {
                this.elements[el].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    // Toggle locally for demo
                    this.data[key] = !this.data[key];
                    this.updateUI();
                });
            }
        });
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateData(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
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
        this.data.fdActive = data.fdActive || false;
        this.data.apHdg = data.apHdgLock || false;
        this.data.apNav = data.apNavLock || false;
        this.data.apApr = data.apAprHold || false;
        this.data.apAlt = data.apAltLock || false;
        this.data.apVs = data.apVsLock || false;
        this.data.apFlc = data.apFlcActive || false;
        this.data.apSpd = data.apSpdActive || false;
        this.data.hdgSet = data.apHdgSet || 0;
        this.data.altSet = data.apAltSet || 0;
        this.data.vsSet = data.apVsSet || 0;
        this.data.spdSet = data.apSpdSet || 0;

        this.updateUI();
    }

    updateUI() {
        // FD Status
        this.elements.fdStatus.classList.toggle('active', this.data.fdActive);

        // AP Master
        this.elements.apMaster.classList.toggle('engaged', this.data.apMaster);
        this.elements.apStatus.textContent = this.data.apMaster ? 'ON' : 'OFF';

        // Mode buttons
        this.elements.btnHdg.classList.toggle('active', this.data.apHdg);
        this.elements.btnNav.classList.toggle('active', this.data.apNav);
        this.elements.btnApr.classList.toggle('active', this.data.apApr);
        this.elements.btnAlt.classList.toggle('active', this.data.apAlt);
        this.elements.btnVs.classList.toggle('active', this.data.apVs);
        this.elements.btnFlc.classList.toggle('active', this.data.apFlc);
        this.elements.btnSpd?.classList.toggle('active', this.data.apSpd);

        // Settings
        this.elements.hdgSet.textContent = String(Math.round(this.data.hdgSet)).padStart(3, '0');
        this.elements.altSet.textContent = Math.round(this.data.altSet).toLocaleString();

        const vs = Math.round(this.data.vsSet);
        this.elements.vsSet.textContent = (vs >= 0 ? '+' : '') + vs;

        this.elements.spdSet.textContent = Math.round(this.data.spdSet);
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data.hdgSet = 270;
        this.data.altSet = 35000;
        this.data.vsSet = 0;
        this.data.spdSet = 280;
        this.data.fdActive = true;
        this.updateUI();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.apWidget = new AutopilotWidget();
});
