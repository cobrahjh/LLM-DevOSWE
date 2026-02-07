/**
 * ATC/Comms glass
 * Displays radio frequencies, transponder, and ATC callsign
 */

class ATCGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'atc-comms',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.data = {
            com1Active: 0,
            com1Standby: 0,
            com2Active: 0,
            com2Standby: 0,
            nav1Active: 0,
            nav1Standby: 0,
            nav2Active: 0,
            nav2Standby: 0,
            transponderCode: 0,
            transponderState: 0,
            atcCallsign: '',
            atcFlightNumber: '',
            atcType: ''
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.startPolling();
    }

    // SimGlassBase override: handle incoming messages
    onMessage(msg) {
        if (msg.type === 'simData' || msg.type === 'flightData') {
            this.updateFromSimData(msg.data);
        }
    }

    // SimGlassBase override: called when connected
    onConnect() {
        console.log('[ATC] WebSocket connected');
    }

    // SimGlassBase override: called when disconnected
    onDisconnect() {
        console.log('[ATC] WebSocket disconnected');
    }

    updateFromSimData(data) {
        // Update radio frequencies
        if (data.com1ActiveFreq !== undefined) {
            this.data.com1Active = data.com1ActiveFreq;
            this.updateFreqDisplay('com1-active', this.formatComFreq(data.com1ActiveFreq));
        }
        if (data.com1StandbyFreq !== undefined) {
            this.data.com1Standby = data.com1StandbyFreq;
            this.updateFreqDisplay('com1-standby', this.formatComFreq(data.com1StandbyFreq));
        }
        if (data.com2ActiveFreq !== undefined) {
            this.data.com2Active = data.com2ActiveFreq;
            this.updateFreqDisplay('com2-active', this.formatComFreq(data.com2ActiveFreq));
        }
        if (data.com2StandbyFreq !== undefined) {
            this.data.com2Standby = data.com2StandbyFreq;
            this.updateFreqDisplay('com2-standby', this.formatComFreq(data.com2StandbyFreq));
        }

        // NAV frequencies
        if (data.nav1ActiveFreq !== undefined) {
            this.data.nav1Active = data.nav1ActiveFreq;
            this.updateFreqDisplay('nav1-active', this.formatNavFreq(data.nav1ActiveFreq));
        }
        if (data.nav1StandbyFreq !== undefined) {
            this.data.nav1Standby = data.nav1StandbyFreq;
            this.updateFreqDisplay('nav1-standby', this.formatNavFreq(data.nav1StandbyFreq));
        }
        if (data.nav2ActiveFreq !== undefined) {
            this.data.nav2Active = data.nav2ActiveFreq;
            this.updateFreqDisplay('nav2-active', this.formatNavFreq(data.nav2ActiveFreq));
        }
        if (data.nav2StandbyFreq !== undefined) {
            this.data.nav2Standby = data.nav2StandbyFreq;
            this.updateFreqDisplay('nav2-standby', this.formatNavFreq(data.nav2StandbyFreq));
        }

        // Transponder
        if (data.transponderCode !== undefined) {
            this.data.transponderCode = data.transponderCode;
            document.getElementById('xpdr-code').textContent =
                data.transponderCode.toString().padStart(4, '0');
        }
        if (data.transponderState !== undefined) {
            this.data.transponderState = data.transponderState;
            const modeEl = document.getElementById('xpdr-mode');
            const modes = ['OFF', 'STBY', 'TEST', 'ON', 'ALT'];
            modeEl.textContent = modes[data.transponderState] || 'STBY';
            modeEl.classList.toggle('active', data.transponderState >= 3);
        }

        // ATC Info
        if (data.atcId !== undefined) {
            this.data.atcCallsign = data.atcId;
            document.getElementById('atc-callsign').textContent = data.atcId || '-------';
        }
        if (data.atcFlightNumber !== undefined) {
            this.data.atcFlightNumber = data.atcFlightNumber;
            document.getElementById('atc-flightnum').textContent = data.atcFlightNumber || '----';
        }
        if (data.atcType !== undefined) {
            this.data.atcType = data.atcType;
            document.getElementById('atc-actype').textContent = data.atcType || '----';
        }
    }

    formatComFreq(freq) {
        if (!freq || freq === 0) return '---.---';
        // SimConnect returns frequency in Hz, convert to MHz
        const mhz = freq / 1000000;
        return mhz.toFixed(3);
    }

    formatNavFreq(freq) {
        if (!freq || freq === 0) return '---.--';
        const mhz = freq / 1000000;
        return mhz.toFixed(2);
    }

    updateFreqDisplay(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = value;
    }

    bindEvents() {
        // Swap buttons
        document.getElementById('btn-swap-com1')?.addEventListener('click', () => {
            this.sendEvent('COM_STBY_RADIO_SWAP');
        });
        document.getElementById('btn-swap-com2')?.addEventListener('click', () => {
            this.sendEvent('COM2_RADIO_SWAP');
        });
        document.getElementById('btn-swap-nav1')?.addEventListener('click', () => {
            this.sendEvent('NAV1_RADIO_SWAP');
        });
        document.getElementById('btn-swap-nav2')?.addEventListener('click', () => {
            this.sendEvent('NAV2_RADIO_SWAP');
        });

        // Quick frequency buttons
        document.querySelectorAll('.freq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const freq = btn.dataset.freq;
                this.setStandbyFreq('com1', freq);
                this.showToast(`Set COM1 standby: ${freq}`);
            });
        });
    }

    sendEvent(eventName, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'simEvent',
                event: eventName,
                value: value
            }));
        }
    }

    setStandbyFreq(radio, freq) {
        // Convert MHz to BCD for SimConnect
        const freqParts = freq.split('.');
        const mhz = parseInt(freqParts[0]);
        const khz = parseInt(freqParts[1] || '0');

        // This is simplified - actual BCD encoding is more complex
        this.sendEvent(`${radio.toUpperCase()}_STBY_RADIO_SET`, parseFloat(freq) * 1000000);
    }

    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2000);
    }

    destroy() {
        this._destroyed = true;
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        super.destroy();
    }

    async startPolling() {
        // Fallback polling for radio data
        this._pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/radios');
                if (response.ok) {
                    const data = await response.json();
                    this.updateFromSimData(data);
                }
            } catch (e) {
                // Silent fail - WebSocket is primary
            }
        }, 1000);
    }
}

// Toast styles
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--glass-accent, #667eea);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 13px;
        z-index: 1000;
        animation: toastFade 2s ease-in-out;
    }
    @keyframes toastFade {
        0%, 100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        15%, 85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(toastStyle);

// Initialize
const atcWidget = new ATCGlass();
window.addEventListener('beforeunload', () => atcWidget.destroy());
