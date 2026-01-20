/**
 * Engine Display Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class EngineWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            throttle: 0,
            n1: 0,
            fuelFlow: 0,
            fuelQty: 0,
            fuelCapacity: 100,
            oilTemp: 0,
            oilPress: 0,
            engineRunning: false
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
        this.startMockUpdate();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            engStatus: document.getElementById('eng-status'),
            throttle: document.getElementById('throttle'),
            thrArc: document.getElementById('thr-arc'),
            n1: document.getElementById('n1'),
            n1Arc: document.getElementById('n1-arc'),
            fuelFlow: document.getElementById('fuel-flow'),
            fuelQty: document.getElementById('fuel-qty'),
            oilTemp: document.getElementById('oil-temp'),
            oilPress: document.getElementById('oil-press'),
            fuelPct: document.getElementById('fuel-pct'),
            fuelBar: document.getElementById('fuel-bar')
        };
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

    updateData(data) {
        this.data.throttle = data.throttle || 0;
        this.data.n1 = data.n1 || data.engN1 || 0;
        this.data.fuelFlow = data.fuelFlow || 0;
        this.data.fuelQty = data.fuelTotal || 0;
        this.data.oilTemp = data.oilTemp || 0;
        this.data.oilPress = data.oilPress || 0;
        this.data.engineRunning = data.engineRunning || false;

        this.updateUI();
    }

    updateUI() {
        // Engine status
        this.elements.engStatus.textContent = this.data.engineRunning ? 'RUNNING' : 'OFF';
        this.elements.engStatus.classList.toggle('running', this.data.engineRunning);

        // Throttle gauge
        const thrPct = Math.min(100, Math.max(0, this.data.throttle));
        this.elements.throttle.textContent = Math.round(thrPct) + '%';
        const thrOffset = 142 - (thrPct / 100 * 142);
        this.elements.thrArc.style.strokeDashoffset = thrOffset;

        // N1 gauge
        const n1Pct = Math.min(100, Math.max(0, this.data.n1));
        this.elements.n1.textContent = n1Pct.toFixed(1) + '%';
        const n1Offset = 142 - (n1Pct / 100 * 142);
        this.elements.n1Arc.style.strokeDashoffset = n1Offset;

        // N1 color based on value
        this.elements.n1Arc.classList.remove('warning', 'danger');
        if (n1Pct > 95) {
            this.elements.n1Arc.classList.add('danger');
        } else if (n1Pct > 85) {
            this.elements.n1Arc.classList.add('warning');
        }

        // Readings
        this.elements.fuelFlow.textContent = this.data.fuelFlow.toFixed(1) + ' GPH';
        this.elements.fuelQty.textContent = Math.round(this.data.fuelQty) + ' GAL';
        this.elements.oilTemp.textContent = Math.round(this.data.oilTemp) + '°C';
        this.elements.oilPress.textContent = Math.round(this.data.oilPress) + ' PSI';

        // Fuel bar
        const fuelPct = Math.min(100, Math.max(0, (this.data.fuelQty / this.data.fuelCapacity) * 100));
        this.elements.fuelPct.textContent = Math.round(fuelPct) + '%';
        this.elements.fuelBar.style.width = fuelPct + '%';

        this.elements.fuelBar.classList.remove('low', 'critical');
        if (fuelPct < 15) {
            this.elements.fuelBar.classList.add('critical');
        } else if (fuelPct < 30) {
            this.elements.fuelBar.classList.add('low');
        }
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data = {
            throttle: 75,
            n1: 82.5,
            fuelFlow: 28.4,
            fuelQty: 65,
            fuelCapacity: 100,
            oilTemp: 85,
            oilPress: 55,
            engineRunning: true
        };
        this.updateUI();

        // Animate values slowly
        setInterval(() => {
            this.data.n1 = 80 + Math.sin(Date.now() / 2000) * 5;
            this.data.fuelFlow = 25 + Math.sin(Date.now() / 3000) * 5;
            this.updateUI();
        }, 100);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.engineWidget = new EngineWidget();
});
