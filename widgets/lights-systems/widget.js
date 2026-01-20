/**
 * Lights & Systems Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class LightsSystemsWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            navLight: false,
            beaconLight: false,
            strobeLight: false,
            landingLight: false,
            taxiLight: false,
            gearDown: true,
            flapsIndex: 0,
            parkingBrake: false
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
            // Light buttons
            btnNav: document.getElementById('btn-nav'),
            btnBcn: document.getElementById('btn-bcn'),
            btnStrb: document.getElementById('btn-strb'),
            btnLdg: document.getElementById('btn-ldg'),
            btnTaxi: document.getElementById('btn-taxi'),
            // System buttons
            btnGear: document.getElementById('btn-gear'),
            btnFlapsUp: document.getElementById('btn-flaps-up'),
            btnFlapsDn: document.getElementById('btn-flaps-dn'),
            btnBrake: document.getElementById('btn-brake'),
            // Status
            gearStatus: document.getElementById('gear-status'),
            flapsValue: document.getElementById('flaps-value'),
            brakeStatus: document.getElementById('brake-status')
        };
    }

    setupEvents() {
        // Light buttons
        const lightButtons = ['btnNav', 'btnBcn', 'btnStrb', 'btnLdg', 'btnTaxi'];
        lightButtons.forEach(btn => {
            if (this.elements[btn]) {
                this.elements[btn].addEventListener('click', (e) => {
                    const cmd = e.currentTarget.dataset.cmd;
                    if (cmd) this.sendCommand(cmd);
                    // Toggle locally for demo
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
        // Lights
        this.elements.btnNav.classList.toggle('active', this.data.navLight);
        this.elements.btnBcn.classList.toggle('active', this.data.beaconLight);
        this.elements.btnStrb.classList.toggle('active', this.data.strobeLight);
        this.elements.btnLdg.classList.toggle('active', this.data.landingLight);
        this.elements.btnTaxi.classList.toggle('active', this.data.taxiLight);

        // Gear
        this.elements.btnGear.classList.toggle('active', this.data.gearDown);
        this.elements.gearStatus.textContent = this.data.gearDown ? 'DOWN' : 'UP';

        // Flaps
        this.elements.flapsValue.textContent = this.data.flapsIndex;

        // Parking Brake
        this.elements.btnBrake.classList.toggle('active', this.data.parkingBrake);
        this.elements.brakeStatus.textContent = this.data.parkingBrake ? 'SET' : 'OFF';
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data = {
            navLight: true,
            beaconLight: true,
            strobeLight: false,
            landingLight: false,
            taxiLight: false,
            gearDown: true,
            flapsIndex: 0,
            parkingBrake: true
        };
        this.updateUI();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.lsWidget = new LightsSystemsWidget();
});
