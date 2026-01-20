/**
 * Primary Flight Display Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class PFDWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            altitude: 0,
            airspeed: 0,
            heading: 0,
            vspeed: 0,
            groundspeed: 0,
            mach: 0,
            tas: 0,
            oat: 0,
            onGround: true
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
            flightPhase: document.getElementById('flight-phase'),
            altitude: document.getElementById('altitude'),
            airspeed: document.getElementById('airspeed'),
            heading: document.getElementById('heading'),
            vspeed: document.getElementById('vspeed'),
            vspeedSmall: document.getElementById('vspeed-small'),
            groundspeed: document.getElementById('groundspeed'),
            mach: document.getElementById('mach'),
            tas: document.getElementById('tas'),
            oat: document.getElementById('oat'),
            altMarker: document.getElementById('alt-marker'),
            spdFill: document.getElementById('spd-fill'),
            compassRose: document.getElementById('compass-rose'),
            vsBar: document.getElementById('vs-bar')
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
        this.data.altitude = data.altitude || 0;
        this.data.airspeed = data.speed || data.airspeed || 0;
        this.data.heading = data.heading || 0;
        this.data.vspeed = data.verticalSpeed || 0;
        this.data.groundspeed = data.groundSpeed || 0;
        this.data.mach = data.mach || 0;
        this.data.tas = data.tas || data.trueAirspeed || 0;
        this.data.oat = data.oat || data.ambientTemperature || 0;
        this.data.onGround = data.onGround !== undefined ? data.onGround : this.data.altitude < 100;

        this.updateUI();
    }

    updateUI() {
        const { altitude, airspeed, heading, vspeed, groundspeed, mach, tas, oat, onGround } = this.data;

        // Flight Phase
        this.elements.flightPhase.textContent = onGround ? 'GND' : 'AIR';
        this.elements.flightPhase.classList.toggle('airborne', !onGround);

        // Altitude
        this.elements.altitude.textContent = Math.round(altitude).toLocaleString();
        const altPct = Math.min(100, Math.max(0, (altitude % 1000) / 1000 * 100));
        this.elements.altMarker.style.top = (100 - altPct) * 0.9 + 5 + '%';

        // Airspeed
        this.elements.airspeed.textContent = Math.round(airspeed);
        const spdPct = Math.min(100, airspeed / 350 * 100);
        const dashOffset = 126 - (spdPct / 100 * 126);
        this.elements.spdFill.style.strokeDashoffset = dashOffset;

        // Ground Speed
        this.elements.groundspeed.textContent = Math.round(groundspeed);

        // Heading
        this.elements.heading.textContent = String(Math.round(heading) % 360).padStart(3, '0');
        const hdgOffset = (heading / 360) * 100;
        this.elements.compassRose.style.transform = `translate(-${50 + hdgOffset * 0.5}%, -50%)`;

        // Vertical Speed
        const vsDisplay = vspeed >= 0 ? '+' + Math.round(vspeed) : Math.round(vspeed);
        this.elements.vspeed.textContent = vsDisplay;
        this.elements.vspeedSmall.textContent = vsDisplay;

        const vsAbs = Math.abs(vspeed);
        const vsPct = Math.min(50, vsAbs / 2000 * 50);

        if (vspeed >= 0) {
            this.elements.vsBar.style.top = (50 - vsPct) + '%';
            this.elements.vsBar.style.height = vsPct + '%';
            this.elements.vsBar.classList.remove('descend');
        } else {
            this.elements.vsBar.style.top = '50%';
            this.elements.vsBar.style.height = vsPct + '%';
            this.elements.vsBar.classList.add('descend');
        }

        // Additional Data
        this.elements.mach.textContent = mach > 0.1 ? 'M' + mach.toFixed(2) : '---';
        this.elements.tas.textContent = tas > 0 ? Math.round(tas) : '---';
        this.elements.oat.textContent = oat !== 0 ? Math.round(oat) + '°C' : '--°C';
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data = {
            altitude: 35000,
            airspeed: 280,
            heading: 270,
            vspeed: 0,
            groundspeed: 485,
            mach: 0.78,
            tas: 460,
            oat: -56,
            onGround: false
        };
        this.updateUI();

        // Animate heading slowly
        setInterval(() => {
            this.data.heading = (this.data.heading + 0.2) % 360;
            this.data.vspeed = Math.sin(Date.now() / 3000) * 500;
            this.updateUI();
        }, 100);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.pfdWidget = new PFDWidget();
});
