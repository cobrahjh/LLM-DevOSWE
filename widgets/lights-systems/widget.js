/**
 * Lights & Systems Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class LightsSystemsWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            // Basic lights
            navLight: false,
            beaconLight: false,
            strobeLight: false,
            landingLight: false,
            taxiLight: false,
            // Additional lights
            logoLight: false,
            wingLight: false,
            cabinLight: false,
            panelLight: false,
            recogLight: false,
            // Systems
            gearDown: true,
            flapsIndex: 0,
            parkingBrake: false,
            // Electrical
            battery: false,
            alternator: false,
            avionics: false,
            // Trim
            aileronTrim: 0,
            elevatorTrim: 0,
            rudderTrim: 0,
            // Engine systems
            pitotHeat: false,
            carbHeat: false,
            deice: false,
            // Doors
            doorMain: false,
            doorCargo: false
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
            // Basic light buttons
            btnNav: document.getElementById('btn-nav'),
            btnBcn: document.getElementById('btn-bcn'),
            btnStrb: document.getElementById('btn-strb'),
            btnLdg: document.getElementById('btn-ldg'),
            btnTaxi: document.getElementById('btn-taxi'),
            // Additional light buttons
            btnLogo: document.getElementById('btn-logo'),
            btnWing: document.getElementById('btn-wing'),
            btnCabin: document.getElementById('btn-cabin'),
            btnPanel: document.getElementById('btn-panel'),
            btnRecog: document.getElementById('btn-recog'),
            // System buttons
            btnGear: document.getElementById('btn-gear'),
            btnFlapsUp: document.getElementById('btn-flaps-up'),
            btnFlapsDn: document.getElementById('btn-flaps-dn'),
            btnBrake: document.getElementById('btn-brake'),
            // Electrical buttons
            btnBatt: document.getElementById('btn-batt'),
            btnAlt: document.getElementById('btn-alt'),
            btnAvio: document.getElementById('btn-avio'),
            // Trim buttons
            btnAilL: document.getElementById('btn-ail-l'),
            btnAilR: document.getElementById('btn-ail-r'),
            btnElvUp: document.getElementById('btn-elv-up'),
            btnElvDn: document.getElementById('btn-elv-dn'),
            btnRudL: document.getElementById('btn-rud-l'),
            btnRudR: document.getElementById('btn-rud-r'),
            // Engine systems
            btnPitot: document.getElementById('btn-pitot'),
            btnCarb: document.getElementById('btn-carb'),
            btnDeice: document.getElementById('btn-deice'),
            // Doors
            btnDoorMain: document.getElementById('btn-door-main'),
            btnDoorCargo: document.getElementById('btn-door-cargo'),
            // Status displays
            gearStatus: document.getElementById('gear-status'),
            flapsValue: document.getElementById('flaps-value'),
            brakeStatus: document.getElementById('brake-status'),
            ailTrim: document.getElementById('ail-trim'),
            elvTrim: document.getElementById('elv-trim'),
            rudTrim: document.getElementById('rud-trim')
        };
    }

    setupEvents() {
        // Light buttons (basic)
        const lightButtons = ['btnNav', 'btnBcn', 'btnStrb', 'btnLdg', 'btnTaxi'];
        lightButtons.forEach(btn => {
            if (this.elements[btn]) {
                this.elements[btn].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    const key = btn.replace('btn', '').toLowerCase();
                    const dataKey = key === 'nav' ? 'navLight' :
                                   key === 'bcn' ? 'beaconLight' :
                                   key === 'strb' ? 'strobeLight' :
                                   key === 'ldg' ? 'landingLight' :
                                   key === 'taxi' ? 'taxiLight' : null;
                    if (dataKey) {
                        this.data[dataKey] = !this.data[dataKey];
                        this.updateUI();
                    }
                });
            }
        });

        // Additional light buttons
        const extraLights = ['btnLogo', 'btnWing', 'btnCabin', 'btnPanel', 'btnRecog'];
        extraLights.forEach(btn => {
            if (this.elements[btn]) {
                this.elements[btn].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    const key = btn.replace('btn', '').toLowerCase();
                    const dataKey = key + 'Light';
                    if (this.data.hasOwnProperty(dataKey)) {
                        this.data[dataKey] = !this.data[dataKey];
                        this.updateUI();
                    }
                });
            }
        });

        // Gear button
        if (this.elements.btnGear) {
            this.elements.btnGear.addEventListener('click', (e) => {
                const cmd = e.currentTarget.dataset.cmd;
                if (cmd) this.sendCommand(cmd);
                this.data.gearDown = !this.data.gearDown;
                this.updateUI();
            });
        }

        // Flaps buttons
        if (this.elements.btnFlapsUp) {
            this.elements.btnFlapsUp.addEventListener('click', (e) => {
                const cmd = e.currentTarget.dataset.cmd;
                if (cmd) this.sendCommand(cmd);
                this.data.flapsIndex = Math.max(0, this.data.flapsIndex - 1);
                this.updateUI();
            });
        }

        if (this.elements.btnFlapsDn) {
            this.elements.btnFlapsDn.addEventListener('click', (e) => {
                const cmd = e.currentTarget.dataset.cmd;
                if (cmd) this.sendCommand(cmd);
                this.data.flapsIndex = Math.min(4, this.data.flapsIndex + 1);
                this.updateUI();
            });
        }

        // Brake button
        if (this.elements.btnBrake) {
            this.elements.btnBrake.addEventListener('click', (e) => {
                const cmd = e.currentTarget.dataset.cmd;
                if (cmd) this.sendCommand(cmd);
                this.data.parkingBrake = !this.data.parkingBrake;
                this.updateUI();
            });
        }

        // Electrical buttons
        const elecButtons = [
            { el: 'btnBatt', data: 'battery' },
            { el: 'btnAlt', data: 'alternator' },
            { el: 'btnAvio', data: 'avionics' }
        ];
        elecButtons.forEach(({ el, data }) => {
            if (this.elements[el]) {
                this.elements[el].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    this.data[data] = !this.data[data];
                    this.updateUI();
                });
            }
        });

        // Trim buttons
        const trimStep = 5; // 5% per click
        if (this.elements.btnAilL) {
            this.elements.btnAilL.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.aileronTrim = Math.max(-100, this.data.aileronTrim - trimStep);
                this.updateUI();
            });
        }
        if (this.elements.btnAilR) {
            this.elements.btnAilR.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.aileronTrim = Math.min(100, this.data.aileronTrim + trimStep);
                this.updateUI();
            });
        }
        if (this.elements.btnElvUp) {
            this.elements.btnElvUp.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.elevatorTrim = Math.min(100, this.data.elevatorTrim + trimStep);
                this.updateUI();
            });
        }
        if (this.elements.btnElvDn) {
            this.elements.btnElvDn.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.elevatorTrim = Math.max(-100, this.data.elevatorTrim - trimStep);
                this.updateUI();
            });
        }
        if (this.elements.btnRudL) {
            this.elements.btnRudL.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.rudderTrim = Math.max(-100, this.data.rudderTrim - trimStep);
                this.updateUI();
            });
        }
        if (this.elements.btnRudR) {
            this.elements.btnRudR.addEventListener('click', (e) => {
                this.sendCommand(e.currentTarget.dataset.cmd);
                this.data.rudderTrim = Math.min(100, this.data.rudderTrim + trimStep);
                this.updateUI();
            });
        }

        // Engine systems buttons
        const engButtons = [
            { el: 'btnPitot', data: 'pitotHeat' },
            { el: 'btnCarb', data: 'carbHeat' },
            { el: 'btnDeice', data: 'deice' }
        ];
        engButtons.forEach(({ el, data }) => {
            if (this.elements[el]) {
                this.elements[el].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    this.data[data] = !this.data[data];
                    this.updateUI();
                });
            }
        });

        // Door buttons
        const doorButtons = [
            { el: 'btnDoorMain', data: 'doorMain' },
            { el: 'btnDoorCargo', data: 'doorCargo' }
        ];
        doorButtons.forEach(({ el, data }) => {
            if (this.elements[el]) {
                this.elements[el].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    this.data[data] = !this.data[data];
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
        this.data.navLight = data.navLight || false;
        this.data.beaconLight = data.beaconLight || false;
        this.data.strobeLight = data.strobeLight || false;
        this.data.landingLight = data.landingLight || false;
        this.data.taxiLight = data.taxiLight || false;
        this.data.gearDown = data.gearDown !== undefined ? data.gearDown : true;
        this.data.flapsIndex = data.flapsIndex || 0;
        this.data.parkingBrake = data.parkingBrake || false;

        this.updateUI();
    }

    updateUI() {
        // Basic Lights
        this.elements.btnNav?.classList.toggle('active', this.data.navLight);
        this.elements.btnBcn?.classList.toggle('active', this.data.beaconLight);
        this.elements.btnStrb?.classList.toggle('active', this.data.strobeLight);
        this.elements.btnLdg?.classList.toggle('active', this.data.landingLight);
        this.elements.btnTaxi?.classList.toggle('active', this.data.taxiLight);

        // Additional Lights
        this.elements.btnLogo?.classList.toggle('active', this.data.logoLight);
        this.elements.btnWing?.classList.toggle('active', this.data.wingLight);
        this.elements.btnCabin?.classList.toggle('active', this.data.cabinLight);
        this.elements.btnPanel?.classList.toggle('active', this.data.panelLight);
        this.elements.btnRecog?.classList.toggle('active', this.data.recogLight);

        // Gear
        this.elements.btnGear?.classList.toggle('active', this.data.gearDown);
        if (this.elements.gearStatus) {
            this.elements.gearStatus.textContent = this.data.gearDown ? 'DOWN' : 'UP';
        }

        // Flaps
        if (this.elements.flapsValue) {
            this.elements.flapsValue.textContent = this.data.flapsIndex;
        }

        // Parking Brake
        this.elements.btnBrake?.classList.toggle('active', this.data.parkingBrake);
        if (this.elements.brakeStatus) {
            this.elements.brakeStatus.textContent = this.data.parkingBrake ? 'SET' : 'OFF';
        }

        // Electrical
        this.elements.btnBatt?.classList.toggle('active', this.data.battery);
        this.elements.btnAlt?.classList.toggle('active', this.data.alternator);
        this.elements.btnAvio?.classList.toggle('active', this.data.avionics);

        // Trim values
        if (this.elements.ailTrim) {
            this.elements.ailTrim.textContent = `${this.data.aileronTrim}%`;
        }
        if (this.elements.elvTrim) {
            this.elements.elvTrim.textContent = `${this.data.elevatorTrim}%`;
        }
        if (this.elements.rudTrim) {
            this.elements.rudTrim.textContent = `${this.data.rudderTrim}%`;
        }

        // Engine systems
        this.elements.btnPitot?.classList.toggle('active', this.data.pitotHeat);
        this.elements.btnCarb?.classList.toggle('active', this.data.carbHeat);
        this.elements.btnDeice?.classList.toggle('active', this.data.deice);

        // Doors
        this.elements.btnDoorMain?.classList.toggle('active', this.data.doorMain);
        this.elements.btnDoorCargo?.classList.toggle('active', this.data.doorCargo);
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data = {
            // Basic lights
            navLight: true,
            beaconLight: true,
            strobeLight: false,
            landingLight: false,
            taxiLight: false,
            // Additional lights
            logoLight: false,
            wingLight: false,
            cabinLight: true,
            panelLight: true,
            recogLight: false,
            // Systems
            gearDown: true,
            flapsIndex: 0,
            parkingBrake: true,
            // Electrical
            battery: true,
            alternator: true,
            avionics: true,
            // Trim
            aileronTrim: 0,
            elevatorTrim: 0,
            rudderTrim: 0,
            // Engine systems
            pitotHeat: false,
            carbHeat: false,
            deice: false,
            // Doors
            doorMain: false,
            doorCargo: false
        };
        this.updateUI();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.lsWidget = new LightsSystemsWidget();
});
