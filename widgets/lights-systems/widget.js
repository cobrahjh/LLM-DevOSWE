/**
 * Lights & Systems Widget
 * SimWidget Engine v1.0.0
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
            // Indicators
            indNav: document.getElementById('ind-nav'),
            indBcn: document.getElementById('ind-bcn'),
            indStrb: document.getElementById('ind-strb'),
            indLdg: document.getElementById('ind-ldg'),
            indTaxi: document.getElementById('ind-taxi'),
            indGear: document.getElementById('ind-gear'),
            indBrake: document.getElementById('ind-brake'),
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
                });
            }
        });

        // System buttons
        const systemButtons = ['btnGear', 'btnFlapsUp', 'btnFlapsDn', 'btnBrake'];
        systemButtons.forEach(btn => {
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
            console.log('[LS] Connected to SimWidget');
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateData(msg.data);
                }
            } catch (e) {
                console.error('[LS] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[LS] Disconnected');
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('[LS] WebSocket error:', err);
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.lsWidget = new LightsSystemsWidget();
});
