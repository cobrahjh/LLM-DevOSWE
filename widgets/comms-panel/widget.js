/**
 * Comms Panel Widget
 * SimWidget Engine v1.0.0
 */

class CommsPanelWidget {
    constructor() {
        this.ws = null;
        this.init();
    }

    init() {
        this.connect();
        this.setupSwapButtons();
        this.setupFreqPresets();
        this.setupXpdr();
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            document.getElementById('conn').classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'radioData') {
                    this.updateRadios(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    setupSwapButtons() {
        ['com1', 'com2', 'nav1'].forEach(radio => {
            const swapBtn = document.getElementById(`${radio}-swap`);
            const activeEl = document.getElementById(`${radio}-active`);
            const stbyEl = document.getElementById(`${radio}-stby`);

            swapBtn.addEventListener('click', () => {
                const active = activeEl.textContent;
                const stby = stbyEl.value;
                activeEl.textContent = stby;
                stbyEl.value = active;

                this.sendCommand(`${radio.toUpperCase()}_SWAP`);
            });
        });
    }

    setupFreqPresets() {
        document.querySelectorAll('.freq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const freq = btn.dataset.freq;
                document.getElementById('com1-stby').value = freq;
            });
        });
    }

    setupXpdr() {
        // Mode buttons
        document.querySelectorAll('.xpdr-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.xpdr-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.sendCommand('XPDR_MODE_' + btn.dataset.mode.toUpperCase());
            });
        });

        // Ident button
        document.getElementById('xpdr-ident').addEventListener('click', () => {
            this.sendCommand('XPDR_IDENT');
            const btn = document.getElementById('xpdr-ident');
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 2000);
        });

        // Code validation
        const codeInput = document.getElementById('xpdr-code');
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-7]/g, '').slice(0, 4);
        });
    }

    sendCommand(cmd, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd, value }));
        }
    }

    updateRadios(data) {
        if (data.com1Active) document.getElementById('com1-active').textContent = data.com1Active;
        if (data.com1Stby) document.getElementById('com1-stby').value = data.com1Stby;
        if (data.com2Active) document.getElementById('com2-active').textContent = data.com2Active;
        if (data.com2Stby) document.getElementById('com2-stby').value = data.com2Stby;
        if (data.nav1Active) document.getElementById('nav1-active').textContent = data.nav1Active;
        if (data.nav1Stby) document.getElementById('nav1-stby').value = data.nav1Stby;
        if (data.xpdrCode) document.getElementById('xpdr-code').value = data.xpdrCode;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.commsWidget = new CommsPanelWidget();
});
