/**
 * Autopilot Compact Strip pane
 * Type: control | Category: flight
 * Path: ui/autopilot-compact/pane.js
 *
 * Horizontal strip showing AP status and mode toggles with inline values
 * Extends SimGlassBase for WebSocket connection
 */

class AutopilotCompactPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'autopilot-compact',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        this.ap = {
            master: false,
            headingHold: false,
            altitudeHold: false,
            vsHold: false,
            speedHold: false,
            navHold: false,
            aprHold: false
        };

        this.setValues = {
            heading: 0,
            altitude: 10000,
            vs: 0,
            speed: 200
        };

        this.elements = {};
        this.cacheElements();
        this.setupEventListeners();
        this.render();
    }

    cacheElements() {
        this.elements.btnAp = document.getElementById('btn-ap');
        this.elements.btnHdg = document.getElementById('btn-hdg');
        this.elements.btnAlt = document.getElementById('btn-alt');
        this.elements.btnVs = document.getElementById('btn-vs');
        this.elements.btnSpd = document.getElementById('btn-spd');
        this.elements.btnNav = document.getElementById('btn-nav');
        this.elements.btnApr = document.getElementById('btn-apr');

        this.elements.hdgValue = document.getElementById('hdg-value');
        this.elements.altValue = document.getElementById('alt-value');
        this.elements.vsValue = document.getElementById('vs-value');
        this.elements.spdValue = document.getElementById('spd-value');
    }

    setupEventListeners() {
        document.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
            });
        });
    }

    sendCommand(cmd) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd }));
        }
        this.handleLocalCommand(cmd);
    }

    handleLocalCommand(cmd) {
        switch (cmd) {
            case 'AP_MASTER': this.ap.master = !this.ap.master; break;
            case 'AP_HDG_HOLD': this.ap.headingHold = !this.ap.headingHold; break;
            case 'AP_ALT_HOLD': this.ap.altitudeHold = !this.ap.altitudeHold; break;
            case 'AP_VS_HOLD': this.ap.vsHold = !this.ap.vsHold; break;
            case 'AP_AIRSPEED_HOLD': this.ap.speedHold = !this.ap.speedHold; break;
            case 'AP_NAV1_HOLD': this.ap.navHold = !this.ap.navHold; break;
            case 'AP_APR_HOLD': this.ap.aprHold = !this.ap.aprHold; break;
        }
        this.render();
    }

    onSimData(data) {
        if (data.apMaster !== undefined) this.ap.master = data.apMaster;
        if (data.apHdgLock !== undefined) this.ap.headingHold = data.apHdgLock;
        if (data.apAltLock !== undefined) this.ap.altitudeHold = data.apAltLock;
        if (data.apVsLock !== undefined) this.ap.vsHold = data.apVsLock;
        if (data.apSpdLock !== undefined) this.ap.speedHold = data.apSpdLock;
        if (data.apNavLock !== undefined) this.ap.navHold = data.apNavLock;
        if (data.apAprLock !== undefined) this.ap.aprHold = data.apAprLock;

        if (data.apHdgSet !== undefined) this.setValues.heading = Math.round(data.apHdgSet);
        if (data.apAltSet !== undefined) this.setValues.altitude = Math.round(data.apAltSet);
        if (data.apVsSet !== undefined) this.setValues.vs = Math.round(data.apVsSet);
        if (data.apSpdSet !== undefined) this.setValues.speed = Math.round(data.apSpdSet);

        this.render();
    }

    onMessage(msg) {
        if (msg.type === 'flightData' && msg.data) {
            this.onSimData(msg.data);
        }
    }

    render() {
        // AP master
        this.elements.btnAp?.classList.toggle('active', this.ap.master);

        // Mode buttons
        this.elements.btnHdg?.classList.toggle('active', this.ap.headingHold);
        this.elements.btnAlt?.classList.toggle('active', this.ap.altitudeHold);
        this.elements.btnVs?.classList.toggle('active', this.ap.vsHold);
        this.elements.btnSpd?.classList.toggle('active', this.ap.speedHold);
        this.elements.btnNav?.classList.toggle('active', this.ap.navHold);
        this.elements.btnApr?.classList.toggle('active', this.ap.aprHold);

        // Values
        if (this.elements.hdgValue) {
            this.elements.hdgValue.textContent = String(this.setValues.heading).padStart(3, '0') + '\u00B0';
        }
        if (this.elements.altValue) {
            this.elements.altValue.textContent = this.setValues.altitude.toLocaleString();
        }
        if (this.elements.vsValue) {
            const vs = this.setValues.vs;
            this.elements.vsValue.textContent = (vs >= 0 ? '+' : '') + vs;
            this.elements.vsValue.classList.remove('positive', 'negative');
            if (vs > 0) this.elements.vsValue.classList.add('positive');
            if (vs < 0) this.elements.vsValue.classList.add('negative');
        }
        if (this.elements.spdValue) {
            this.elements.spdValue.textContent = this.setValues.speed + 'kt';
        }
    }

    destroy() {
        if (super.destroy) super.destroy();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutopilotCompactPane;
}
