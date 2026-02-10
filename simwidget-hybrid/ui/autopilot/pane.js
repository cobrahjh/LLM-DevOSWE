/**
 * Autopilot pane
 * Type: control | Category: flight
 * Path: ui/autopilot/pane.js
 *
 * Full autopilot control panel with heading, altitude, VS, speed modes
 * Extends SimGlassBase for WebSocket connection
 */

class AutopilotPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'autopilot',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // Autopilot state
        this.ap = {
            master: false,
            flightDirector: false,
            yawDamper: false,
            headingHold: false,
            altitudeHold: false,
            vsHold: false,
            speedHold: false,
            navHold: false,
            aprHold: false,
            bcHold: false,
            vnavHold: false
        };

        // Set values (what AP is targeting)
        this.setValues = {
            heading: 0,
            altitude: 10000,
            vs: 0,
            speed: 200
        };

        // Current values (actual aircraft state)
        this.current = {
            heading: 0,
            altitude: 0,
            vs: 0,
            speed: 0,
            navSource: '---'
        };

        // SimConnect variable mappings
        this.simVars = {
            // AP states
            'AUTOPILOT MASTER': 'apMaster',
            'AUTOPILOT FLIGHT DIRECTOR ACTIVE': 'apFD',
            'AUTOPILOT YAW DAMPER': 'apYD',
            'AUTOPILOT HEADING LOCK': 'apHDG',
            'AUTOPILOT ALTITUDE LOCK': 'apALT',
            'AUTOPILOT VERTICAL HOLD': 'apVS',
            'AUTOPILOT AIRSPEED HOLD': 'apSPD',
            'AUTOPILOT NAV1 LOCK': 'apNAV',
            'AUTOPILOT APPROACH HOLD': 'apAPR',
            'AUTOPILOT BACKCOURSE HOLD': 'apBC',

            // Set values
            'AUTOPILOT HEADING LOCK DIR': 'hdgSet',
            'AUTOPILOT ALTITUDE LOCK VAR': 'altSet',
            'AUTOPILOT VERTICAL HOLD VAR': 'vsSet',
            'AUTOPILOT AIRSPEED HOLD VAR': 'spdSet',

            // Current values
            'HEADING INDICATOR': 'hdgCurrent',
            'PLANE HEADING DEGREES MAGNETIC': 'hdgCurrent',
            'INDICATED ALTITUDE': 'altCurrent',
            'VERTICAL SPEED': 'vsCurrent',
            'AIRSPEED INDICATED': 'spdCurrent',

            // Mock data mappings
            'heading': 'hdgCurrent',
            'altitude': 'altCurrent',
            'verticalSpeed': 'vsCurrent',
            'groundSpeed': 'spdCurrent'
        };

        // Compact mode state
        this.compactMode = localStorage.getItem('ap-compact') === 'true';

        // Cache DOM elements
        this.elements = {};
        this.cacheElements();

        // Track repeat intervals for cleanup
        this.repeatIntervals = new Map();

        // Bind event handlers
        this.setupEventListeners();
        this.setupCompactToggle();

        // Apply saved compact mode
        if (this.compactMode) {
            document.getElementById('widget-root')?.classList.add('compact');
            document.getElementById('compact-toggle')?.classList.add('active');
        }

        // Initial render
        this.render();
    }

    cacheElements() {
        // Status indicators
        this.elements.apMasterStatus = document.getElementById('ap-master-status');
        this.elements.apStatus = document.getElementById('ap-status');
        this.elements.fdStatus = document.getElementById('fd-status');
        this.elements.ydStatus = document.getElementById('yd-status');

        // Buttons
        this.elements.btnAp = document.getElementById('btn-ap');
        this.elements.btnFd = document.getElementById('btn-fd');
        this.elements.btnYd = document.getElementById('btn-yd');
        this.elements.btnHdg = document.getElementById('btn-hdg');
        this.elements.btnAlt = document.getElementById('btn-alt');
        this.elements.btnVs = document.getElementById('btn-vs');
        this.elements.btnSpd = document.getElementById('btn-spd');
        this.elements.btnNav = document.getElementById('btn-nav');
        this.elements.btnApr = document.getElementById('btn-apr');
        this.elements.btnBc = document.getElementById('btn-bc');
        this.elements.btnVnav = document.getElementById('btn-vnav');

        // Value displays
        this.elements.hdgValue = document.getElementById('hdg-value');
        this.elements.altValue = document.getElementById('alt-value');
        this.elements.vsValue = document.getElementById('vs-value');
        this.elements.spdValue = document.getElementById('spd-value');

        // Current value displays
        this.elements.hdgCurrent = document.getElementById('hdg-current');
        this.elements.altCurrent = document.getElementById('alt-current');
        this.elements.vsCurrent = document.getElementById('vs-current');
        this.elements.spdCurrent = document.getElementById('spd-current');

        // Footer
        this.elements.navSource = document.getElementById('nav-source');

        // Compact MCP elements
        this.elements.cBtnAp = document.getElementById('c-btn-ap');
        this.elements.cCellHdg = document.getElementById('c-cell-hdg');
        this.elements.cCellAlt = document.getElementById('c-cell-alt');
        this.elements.cCellVs = document.getElementById('c-cell-vs');
        this.elements.cCellSpd = document.getElementById('c-cell-spd');
        this.elements.cHdgVal = document.getElementById('c-hdg-val');
        this.elements.cAltVal = document.getElementById('c-alt-val');
        this.elements.cVsVal = document.getElementById('c-vs-val');
        this.elements.cSpdVal = document.getElementById('c-spd-val');
        this.elements.cBtnNav = document.getElementById('c-btn-nav');
        this.elements.cBtnApr = document.getElementById('c-btn-apr');
        this.elements.cBtnBc = document.getElementById('c-btn-bc');
        this.elements.cBtnVnav = document.getElementById('c-btn-vnav');
        this.elements.cBtnFd = document.getElementById('c-btn-fd');
        this.elements.cBtnYd = document.getElementById('c-btn-yd');
    }

    setupCompactToggle() {
        const toggle = document.getElementById('compact-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            localStorage.setItem('ap-compact', this.compactMode);
            document.getElementById('widget-root')?.classList.toggle('compact', this.compactMode);
            toggle.classList.toggle('active', this.compactMode);
            this.render();
        });
    }

    setupEventListeners() {
        // All buttons with data-cmd attribute
        document.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmd = e.currentTarget.dataset.cmd;
                this.sendCommand(cmd);
            });

            // Handle repeat for +/- buttons
            if (btn.dataset.repeat === 'true') {
                const clearRepeat = () => {
                    const interval = this.repeatIntervals.get(btn);
                    if (interval) {
                        clearInterval(interval);
                        this.repeatIntervals.delete(btn);
                    }
                };

                btn.addEventListener('mousedown', () => {
                    const repeatInterval = setInterval(() => {
                        this.sendCommand(btn.dataset.cmd);
                    }, 150);
                    this.repeatIntervals.set(btn, repeatInterval);
                });

                btn.addEventListener('mouseup', clearRepeat);
                btn.addEventListener('mouseleave', clearRepeat);

                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    const repeatInterval = setInterval(() => {
                        this.sendCommand(btn.dataset.cmd);
                    }, 150);
                    this.repeatIntervals.set(btn, repeatInterval);
                }, { passive: false });

                btn.addEventListener('touchend', clearRepeat);
                btn.addEventListener('touchcancel', clearRepeat);
            }
        });
    }

    sendCommand(cmd) {
        // Send command to backend
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: cmd
            }));
        }

        // For demo/mock mode, toggle states locally
        this.handleLocalCommand(cmd);
    }

    handleLocalCommand(cmd) {
        switch (cmd) {
            case 'AP_MASTER':
                this.ap.master = !this.ap.master;
                break;
            case 'TOGGLE_FLIGHT_DIRECTOR':
                this.ap.flightDirector = !this.ap.flightDirector;
                break;
            case 'YAW_DAMPER_TOGGLE':
                this.ap.yawDamper = !this.ap.yawDamper;
                break;
            case 'AP_HDG_HOLD':
                this.ap.headingHold = !this.ap.headingHold;
                break;
            case 'AP_ALT_HOLD':
                this.ap.altitudeHold = !this.ap.altitudeHold;
                break;
            case 'AP_VS_HOLD':
                this.ap.vsHold = !this.ap.vsHold;
                break;
            case 'AP_AIRSPEED_HOLD':
                this.ap.speedHold = !this.ap.speedHold;
                break;
            case 'AP_NAV1_HOLD':
                this.ap.navHold = !this.ap.navHold;
                break;
            case 'AP_APR_HOLD':
                this.ap.aprHold = !this.ap.aprHold;
                break;
            case 'AP_BC_HOLD':
                this.ap.bcHold = !this.ap.bcHold;
                break;
            case 'AP_VNAV':
                this.ap.vnavHold = !this.ap.vnavHold;
                break;

            // Adjust values
            case 'HEADING_BUG_INC':
                this.setValues.heading = (this.setValues.heading + 1) % 360;
                break;
            case 'HEADING_BUG_DEC':
                this.setValues.heading = (this.setValues.heading - 1 + 360) % 360;
                break;
            case 'AP_ALT_VAR_INC':
                this.setValues.altitude = Math.min(this.setValues.altitude + 100, 50000);
                break;
            case 'AP_ALT_VAR_DEC':
                this.setValues.altitude = Math.max(this.setValues.altitude - 100, 0);
                break;
            case 'AP_VS_VAR_INC':
                this.setValues.vs = Math.min(this.setValues.vs + 100, 6000);
                break;
            case 'AP_VS_VAR_DEC':
                this.setValues.vs = Math.max(this.setValues.vs - 100, -6000);
                break;
            case 'AP_SPD_VAR_INC':
                this.setValues.speed = Math.min(this.setValues.speed + 1, 500);
                break;
            case 'AP_SPD_VAR_DEC':
                this.setValues.speed = Math.max(this.setValues.speed - 1, 50);
                break;
            case 'HEADING_BUG_SET':
                this.setValues.heading = this.current.heading;
                break;
        }

        this.render();
    }

    onSimData(data) {
        // Update current values from sim data (server field names)
        if (data.heading !== undefined) {
            this.current.heading = Math.round(data.heading);
        }
        if (data.altitude !== undefined) {
            this.current.altitude = Math.round(data.altitude);
        }
        if (data.verticalSpeed !== undefined) {
            this.current.vs = Math.round(data.verticalSpeed);
        }
        if (data.speed !== undefined) {
            this.current.speed = Math.round(data.speed);
        }

        // Update AP states from server flightData
        if (data.apMaster !== undefined) this.ap.master = data.apMaster;
        if (data.apFlightDirector !== undefined) this.ap.flightDirector = data.apFlightDirector;
        if (data.apYawDamper !== undefined) this.ap.yawDamper = data.apYawDamper;
        if (data.apHdgLock !== undefined) this.ap.headingHold = data.apHdgLock;
        if (data.apAltLock !== undefined) this.ap.altitudeHold = data.apAltLock;
        if (data.apVsLock !== undefined) this.ap.vsHold = data.apVsLock;
        if (data.apSpdLock !== undefined) this.ap.speedHold = data.apSpdLock;
        if (data.apNavLock !== undefined) this.ap.navHold = data.apNavLock;
        if (data.apAprLock !== undefined) this.ap.aprHold = data.apAprLock;
        if (data.apBcLock !== undefined) this.ap.bcHold = data.apBcLock;

        // Update set values from server flightData
        if (data.apHdgSet !== undefined) this.setValues.heading = Math.round(data.apHdgSet);
        if (data.apAltSet !== undefined) this.setValues.altitude = Math.round(data.apAltSet);
        if (data.apVsSet !== undefined) this.setValues.vs = Math.round(data.apVsSet);
        if (data.apSpdSet !== undefined) this.setValues.speed = Math.round(data.apSpdSet);

        // Navigation source
        if (data.apNavSelected !== undefined) {
            this.current.navSource = data.apNavSelected === 1 ? 'NAV1' : data.apNavSelected === 2 ? 'NAV2' : 'GPS';
        }

        this.render();
    }

    render() {
        this.updateMasterStatus();
        this.updateModeButtons();
        this.updateValues();
        this.updateCurrentValues();
        this.updateCompact();
    }

    updateMasterStatus() {
        // AP Master status badge
        if (this.elements.apMasterStatus) {
            this.elements.apMasterStatus.textContent = this.ap.master ? 'AP ON' : 'AP OFF';
            this.elements.apMasterStatus.classList.toggle('engaged', this.ap.master);
        }

        // AP button status
        if (this.elements.apStatus) {
            this.elements.apStatus.textContent = this.ap.master ? 'ON' : 'OFF';
        }
        if (this.elements.fdStatus) {
            this.elements.fdStatus.textContent = this.ap.flightDirector ? 'ON' : 'OFF';
        }
        if (this.elements.ydStatus) {
            this.elements.ydStatus.textContent = this.ap.yawDamper ? 'ON' : 'OFF';
        }

        // Button active states
        this.elements.btnAp?.classList.toggle('active', this.ap.master);
        this.elements.btnFd?.classList.toggle('active', this.ap.flightDirector);
        this.elements.btnYd?.classList.toggle('active', this.ap.yawDamper);
    }

    updateModeButtons() {
        this.elements.btnHdg?.classList.toggle('active', this.ap.headingHold);
        this.elements.btnAlt?.classList.toggle('active', this.ap.altitudeHold);
        this.elements.btnVs?.classList.toggle('active', this.ap.vsHold);
        this.elements.btnSpd?.classList.toggle('active', this.ap.speedHold);
        this.elements.btnNav?.classList.toggle('active', this.ap.navHold);
        this.elements.btnApr?.classList.toggle('active', this.ap.aprHold);
        this.elements.btnBc?.classList.toggle('active', this.ap.bcHold);
        this.elements.btnVnav?.classList.toggle('active', this.ap.vnavHold);
    }

    updateValues() {
        // Heading
        if (this.elements.hdgValue) {
            this.elements.hdgValue.textContent = String(this.setValues.heading).padStart(3, '0');
        }

        // Altitude
        if (this.elements.altValue) {
            this.elements.altValue.textContent = this.setValues.altitude.toLocaleString();
        }

        // VS
        if (this.elements.vsValue) {
            const vs = this.setValues.vs;
            this.elements.vsValue.textContent = vs >= 0 ? `+${vs}` : vs;
            this.elements.vsValue.classList.remove('positive', 'negative');
            if (vs > 0) this.elements.vsValue.classList.add('positive');
            if (vs < 0) this.elements.vsValue.classList.add('negative');
        }

        // Speed
        if (this.elements.spdValue) {
            this.elements.spdValue.textContent = this.setValues.speed;
        }
    }

    updateCurrentValues() {
        // Heading
        if (this.elements.hdgCurrent) {
            this.elements.hdgCurrent.textContent = `${String(this.current.heading).padStart(3, '0')}\u00B0`;
        }

        // Altitude
        if (this.elements.altCurrent) {
            this.elements.altCurrent.textContent = `${this.current.altitude.toLocaleString()} ft`;
        }

        // VS
        if (this.elements.vsCurrent) {
            const vs = this.current.vs;
            this.elements.vsCurrent.textContent = `${vs >= 0 ? '+' : ''}${vs} fpm`;
        }

        // Speed
        if (this.elements.spdCurrent) {
            this.elements.spdCurrent.textContent = `${this.current.speed} kt`;
        }

        // Nav source
        if (this.elements.navSource) {
            this.elements.navSource.textContent = this.current.navSource;
        }
    }

    updateCompact() {
        const e = this.elements;
        // AP master
        e.cBtnAp?.classList.toggle('active', this.ap.master);
        // Mode cells
        e.cCellHdg?.classList.toggle('active', this.ap.headingHold);
        e.cCellAlt?.classList.toggle('active', this.ap.altitudeHold);
        e.cCellVs?.classList.toggle('active', this.ap.vsHold);
        e.cCellSpd?.classList.toggle('active', this.ap.speedHold);
        // Nav buttons
        e.cBtnNav?.classList.toggle('active', this.ap.navHold);
        e.cBtnApr?.classList.toggle('active', this.ap.aprHold);
        e.cBtnBc?.classList.toggle('active', this.ap.bcHold);
        e.cBtnVnav?.classList.toggle('active', this.ap.vnavHold);
        e.cBtnFd?.classList.toggle('active', this.ap.flightDirector);
        e.cBtnYd?.classList.toggle('active', this.ap.yawDamper);
        // Values
        if (e.cHdgVal) e.cHdgVal.textContent = String(this.setValues.heading).padStart(3, '0');
        if (e.cAltVal) e.cAltVal.textContent = this.setValues.altitude.toLocaleString();
        if (e.cVsVal) {
            const vs = this.setValues.vs;
            e.cVsVal.textContent = vs >= 0 ? `+${vs}` : vs;
        }
        if (e.cSpdVal) e.cSpdVal.textContent = this.setValues.speed;
    }

    /**
     * Handle WebSocket messages from server
     * Override SimGlassBase.onMessage
     */
    onMessage(msg) {
        if (msg.type === 'flightData' && msg.data) {
            this.onSimData(msg.data);
        }
    }

    /**
     * Cleanup on glass unload
     * Override SimGlassBase.destroy()
     */
    destroy() {
        // Clear all repeat intervals
        this.repeatIntervals.forEach((interval) => clearInterval(interval));
        this.repeatIntervals.clear();

        // Call parent destroy (closes WebSocket, etc.)
        if (super.destroy) {
            super.destroy();
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutopilotPane;
}
