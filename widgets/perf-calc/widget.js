/**
 * Performance Calculator Widget
 * SimWidget Engine v1.0.0
 */

class PerfCalcWidget {
    constructor() {
        this.ws = null;
        this.mode = 'takeoff';
        this.init();
    }

    init() {
        this.connect();
        this.setupTabs();
        this.setupCalculate();
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
                if (msg.type === 'simData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    setupTabs() {
        document.querySelectorAll('.pc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.mode = tab.dataset.mode;

                document.getElementById('takeoff-results').classList.toggle('hidden', this.mode !== 'takeoff');
                document.getElementById('landing-results').classList.toggle('hidden', this.mode !== 'landing');

                // Update flaps options based on mode
                const flapsSelect = document.getElementById('flaps');
                if (this.mode === 'landing') {
                    flapsSelect.innerHTML = `
                        <option value="30">30</option>
                        <option value="40" selected>FULL</option>
                    `;
                } else {
                    flapsSelect.innerHTML = `
                        <option value="1">1</option>
                        <option value="5" selected>5</option>
                        <option value="15">15</option>
                    `;
                }
            });
        });
    }

    setupCalculate() {
        document.getElementById('calculate').addEventListener('click', () => {
            this.calculate();
        });

        // Also calculate on Enter key
        document.querySelectorAll('.pc-inputs input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.calculate();
            });
        });
    }

    calculate() {
        const weight = parseFloat(document.getElementById('weight').value) || 65000;
        const elevation = parseFloat(document.getElementById('elevation').value) || 0;
        const temp = parseFloat(document.getElementById('temp').value) || 15;
        const wind = parseFloat(document.getElementById('wind').value) || 0;
        const flaps = parseInt(document.getElementById('flaps').value) || 5;

        const status = document.getElementById('status');
        status.textContent = 'Calculating...';
        status.className = 'pc-status';

        // Simulate calculation delay
        setTimeout(() => {
            if (this.mode === 'takeoff') {
                this.calculateTakeoff(weight, elevation, temp, wind, flaps);
            } else {
                this.calculateLanding(weight, elevation, temp, wind, flaps);
            }
            status.textContent = 'Calculated';
            status.className = 'pc-status calculated';
        }, 300);
    }

    calculateTakeoff(weight, elevation, temp, wind, flaps) {
        // Simplified performance model (not real aviation data)
        const baseV1 = 120 + (weight - 50000) / 2000;
        const pressureAlt = elevation + ((temp - 15) * 120);
        const altCorrection = pressureAlt / 1000 * 2;
        const windCorrection = wind * -0.5;
        const flapCorrection = flaps === 1 ? 8 : (flaps === 5 ? 0 : -5);

        const v1 = Math.round(baseV1 + altCorrection + windCorrection + flapCorrection);
        const vr = Math.round(v1 + 5);
        const v2 = Math.round(vr + 10);

        // Runway calculation
        const baseRunway = 1800 + (weight - 50000) / 20;
        const rwyAltCorrection = pressureAlt / 1000 * 100;
        const rwyWindCorrection = wind * -30;
        const todr = Math.round(baseRunway + rwyAltCorrection + rwyWindCorrection);

        // Flex temp (simplified)
        const flex = Math.round(temp + 15 + (70000 - weight) / 3000);

        document.getElementById('v1').textContent = v1;
        document.getElementById('vr').textContent = vr;
        document.getElementById('v2').textContent = v2;
        document.getElementById('todr').textContent = todr;
        document.getElementById('flex').textContent = Math.min(flex, 70);
    }

    calculateLanding(weight, elevation, temp, wind, flaps) {
        // Simplified landing performance model
        const baseVref = 125 + (weight - 50000) / 2500;
        const pressureAlt = elevation + ((temp - 15) * 120);
        const altCorrection = pressureAlt / 1000 * 1.5;
        const windCorrection = wind * -0.3;

        const vref = Math.round(baseVref + altCorrection + windCorrection);
        const vapp = Math.round(vref + 5 + Math.max(0, -wind * 0.5));

        // Landing distance
        const baseDistance = 1400 + (weight - 50000) / 25;
        const distAltCorrection = pressureAlt / 1000 * 80;
        const distWindCorrection = wind * -25;
        const ldr = Math.round(baseDistance + distAltCorrection + distWindCorrection);

        // Configuration
        const config = flaps >= 40 ? 'FULL' : `CONF ${flaps}`;

        document.getElementById('vapp').textContent = vapp;
        document.getElementById('vref').textContent = vref;
        document.getElementById('ldr').textContent = ldr;
        document.getElementById('config').textContent = config;
    }

    updateFromSim(data) {
        // Auto-populate from sim data when available
        if (data.totalWeight) {
            document.getElementById('weight').value = Math.round(data.totalWeight);
        }
        if (data.groundAltitude !== undefined) {
            document.getElementById('elevation').value = Math.round(data.groundAltitude);
        }
        if (data.ambientTemperature !== undefined) {
            document.getElementById('temp').value = Math.round(data.ambientTemperature);
        }
        if (data.windSpeed !== undefined) {
            document.getElementById('wind').value = Math.round(data.windSpeed);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.perfCalcWidget = new PerfCalcWidget();
});
