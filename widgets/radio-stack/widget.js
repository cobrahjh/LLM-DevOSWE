/**
 * Radio Stack Widget
 * SimWidget Engine v2.0.0 - Phase 3: Radio & Navigation
 */

class RadioStackWidget {
    constructor() {
        this.ws = null;
        this.data = {
            // COM frequencies (in MHz, stored as decimals)
            com1Active: 118.000,
            com1Standby: 121.500,
            com2Active: 118.000,
            com2Standby: 121.500,
            // NAV frequencies
            nav1Active: 108.00,
            nav1Standby: 108.00,
            nav2Active: 108.00,
            nav2Standby: 108.00,
            // Transponder
            xpdrCode: [1, 2, 0, 0], // 1200 VFR
            xpdrMode: 3 // 0=OFF, 1=STBY, 3=ON, 4=ALT
        };

        // Frequency ranges
        this.ranges = {
            com: { min: 118.000, max: 136.975, stepMhz: 1.0, stepKhz: 0.025 },
            nav: { min: 108.00, max: 117.95, stepMhz: 1.0, stepKhz: 0.05 }
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.connect();
        this.updateUI();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            // COM1
            com1ActiveVal: document.getElementById('com1-active-val'),
            com1StbyVal: document.getElementById('com1-stby-val'),
            com1Swap: document.getElementById('com1-swap'),
            // COM2
            com2ActiveVal: document.getElementById('com2-active-val'),
            com2StbyVal: document.getElementById('com2-stby-val'),
            com2Swap: document.getElementById('com2-swap'),
            // NAV1
            nav1ActiveVal: document.getElementById('nav1-active-val'),
            nav1StbyVal: document.getElementById('nav1-stby-val'),
            nav1Swap: document.getElementById('nav1-swap'),
            // NAV2
            nav2ActiveVal: document.getElementById('nav2-active-val'),
            nav2StbyVal: document.getElementById('nav2-stby-val'),
            nav2Swap: document.getElementById('nav2-swap'),
            // Transponder
            xpdrDigits: [
                document.getElementById('xpdr-d0'),
                document.getElementById('xpdr-d1'),
                document.getElementById('xpdr-d2'),
                document.getElementById('xpdr-d3')
            ],
            xpdrModes: {
                off: document.getElementById('xpdr-off'),
                stby: document.getElementById('xpdr-stby'),
                on: document.getElementById('xpdr-on'),
                alt: document.getElementById('xpdr-alt')
            }
        };
    }

    setupEvents() {
        // Frequency tuning buttons
        document.querySelectorAll('.rs-tune-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const radio = e.target.dataset.radio;
                const dir = e.target.dataset.dir;
                const digit = e.target.dataset.digit;
                this.tuneFrequency(radio, dir, digit);
            });
        });

        // Swap buttons
        ['com1', 'com2', 'nav1', 'nav2'].forEach(radio => {
            const swapBtn = this.elements[`${radio}Swap`];
            if (swapBtn) {
                swapBtn.addEventListener('click', () => this.swapFrequency(radio));
            }
        });

        // Transponder digit buttons
        document.querySelectorAll('.rs-code-digit').forEach(digitGroup => {
            const digitIndex = parseInt(digitGroup.dataset.digit);
            digitGroup.querySelectorAll('.rs-code-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const dir = e.target.dataset.dir;
                    this.tuneXpdrDigit(digitIndex, dir);
                });
            });
        });

        // Transponder mode buttons
        document.querySelectorAll('.rs-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = parseInt(e.target.dataset.mode);
                this.setXpdrMode(mode);
            });
        });

        // Transponder preset buttons
        document.querySelectorAll('.rs-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.dataset.code;
                this.setXpdrCode(code);
            });
        });
    }

    tuneFrequency(radio, dir, digit) {
        const isNav = radio.startsWith('nav');
        const range = isNav ? this.ranges.nav : this.ranges.com;
        const step = digit === 'mhz' ? range.stepMhz : range.stepKhz;
        const delta = dir === 'up' ? step : -step;

        const key = `${radio}Standby`;
        let freq = this.data[key] + delta;

        // Wrap around
        if (freq > range.max) freq = range.min;
        if (freq < range.min) freq = range.max;

        this.data[key] = parseFloat(freq.toFixed(3));
        this.updateUI();

        // Send to sim
        this.sendFrequencyCommand(radio, 'standby', this.data[key]);
    }

    swapFrequency(radio) {
        const activeKey = `${radio}Active`;
        const standbyKey = `${radio}Standby`;

        const temp = this.data[activeKey];
        this.data[activeKey] = this.data[standbyKey];
        this.data[standbyKey] = temp;

        this.updateUI();

        // Send swap command
        const swapCommands = {
            com1: 'COM_STBY_RADIO_SWAP',
            com2: 'COM2_RADIO_SWAP',
            nav1: 'NAV1_RADIO_SWAP',
            nav2: 'NAV2_RADIO_SWAP'
        };
        this.sendCommand(swapCommands[radio]);
    }

    tuneXpdrDigit(index, dir) {
        let val = this.data.xpdrCode[index];
        val = dir === 'up' ? val + 1 : val - 1;

        // Wrap 0-7 (octal digits for transponder)
        if (val > 7) val = 0;
        if (val < 0) val = 7;

        this.data.xpdrCode[index] = val;
        this.updateUI();
        this.sendXpdrCode();
    }

    setXpdrCode(code) {
        const digits = code.split('').map(d => parseInt(d));
        this.data.xpdrCode = digits;
        this.updateUI();
        this.sendXpdrCode();
    }

    setXpdrMode(mode) {
        this.data.xpdrMode = mode;
        this.updateUI();
        this.sendCommand('XPNDR_SET', mode);
    }

    sendXpdrCode() {
        const code = parseInt(this.data.xpdrCode.join(''), 8); // Octal to decimal
        this.sendCommand('XPNDR_SET', code);
    }

    sendFrequencyCommand(radio, type, freq) {
        // Convert MHz to BCD format for SimConnect
        // Frequency 118.000 becomes 118000 in Hz, then BCD encoded
        const freqHz = Math.round(freq * 1000);
        const commands = {
            com1: { active: 'COM_RADIO_SET', standby: 'COM_STBY_RADIO_SET' },
            com2: { active: 'COM2_RADIO_SET', standby: 'COM2_STBY_RADIO_SET' },
            nav1: { active: 'NAV1_RADIO_SET', standby: 'NAV1_STBY_SET' },
            nav2: { active: 'NAV2_RADIO_SET', standby: 'NAV2_STBY_SET' }
        };
        this.sendCommand(commands[radio][type], freqHz);
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn?.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn?.classList.remove('connected');
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

    updateFromSim(data) {
        // Update from SimConnect data if available
        if (data.com1Active) this.data.com1Active = data.com1Active;
        if (data.com1Standby) this.data.com1Standby = data.com1Standby;
        if (data.com2Active) this.data.com2Active = data.com2Active;
        if (data.com2Standby) this.data.com2Standby = data.com2Standby;
        if (data.nav1Active) this.data.nav1Active = data.nav1Active;
        if (data.nav1Standby) this.data.nav1Standby = data.nav1Standby;
        if (data.nav2Active) this.data.nav2Active = data.nav2Active;
        if (data.nav2Standby) this.data.nav2Standby = data.nav2Standby;
        if (data.xpdrCode) {
            const codeStr = data.xpdrCode.toString().padStart(4, '0');
            this.data.xpdrCode = codeStr.split('').map(d => parseInt(d));
        }
        if (data.xpdrMode !== undefined) this.data.xpdrMode = data.xpdrMode;

        this.updateUI();
    }

    formatFreq(freq, decimals = 3) {
        return freq.toFixed(decimals);
    }

    updateUI() {
        // COM1
        if (this.elements.com1ActiveVal) {
            this.elements.com1ActiveVal.textContent = this.formatFreq(this.data.com1Active);
        }
        if (this.elements.com1StbyVal) {
            this.elements.com1StbyVal.textContent = this.formatFreq(this.data.com1Standby);
        }

        // COM2
        if (this.elements.com2ActiveVal) {
            this.elements.com2ActiveVal.textContent = this.formatFreq(this.data.com2Active);
        }
        if (this.elements.com2StbyVal) {
            this.elements.com2StbyVal.textContent = this.formatFreq(this.data.com2Standby);
        }

        // NAV1
        if (this.elements.nav1ActiveVal) {
            this.elements.nav1ActiveVal.textContent = this.formatFreq(this.data.nav1Active, 2);
        }
        if (this.elements.nav1StbyVal) {
            this.elements.nav1StbyVal.textContent = this.formatFreq(this.data.nav1Standby, 2);
        }

        // NAV2
        if (this.elements.nav2ActiveVal) {
            this.elements.nav2ActiveVal.textContent = this.formatFreq(this.data.nav2Active, 2);
        }
        if (this.elements.nav2StbyVal) {
            this.elements.nav2StbyVal.textContent = this.formatFreq(this.data.nav2Standby, 2);
        }

        // Transponder digits
        this.data.xpdrCode.forEach((digit, i) => {
            if (this.elements.xpdrDigits[i]) {
                this.elements.xpdrDigits[i].textContent = digit;
            }
        });

        // Transponder mode
        Object.values(this.elements.xpdrModes).forEach(btn => {
            btn?.classList.remove('active');
        });
        const modeMap = { 0: 'off', 1: 'stby', 3: 'on', 4: 'alt' };
        const activeMode = this.elements.xpdrModes[modeMap[this.data.xpdrMode]];
        activeMode?.classList.add('active');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.radioWidget = new RadioStackWidget();
});
