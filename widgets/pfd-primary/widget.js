/**
 * Primary Flight Display Widget
 * SimWidget Engine v1.0.0
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
            groundspeed: 0
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            altitude: document.getElementById('altitude'),
            airspeed: document.getElementById('airspeed'),
            heading: document.getElementById('heading'),
            vspeed: document.getElementById('vspeed'),
            groundspeed: document.getElementById('groundspeed'),
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
            console.log('[PFD] Connected to SimWidget');
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateData(msg.data);
                }
            } catch (e) {
                console.error('[PFD] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[PFD] Disconnected');
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('[PFD] WebSocket error:', err);
        };
    }

    updateData(data) {
        // Update stored data
        this.data.altitude = data.altitude || 0;
        this.data.airspeed = data.speed || data.airspeed || 0;
        this.data.heading = data.heading || 0;
        this.data.vspeed = data.verticalSpeed || 0;
        this.data.groundspeed = data.groundSpeed || 0;

        this.updateUI();
    }

    updateUI() {
        const { altitude, airspeed, heading, vspeed, groundspeed } = this.data;

        // Altitude
        this.elements.altitude.textContent = Math.round(altitude).toLocaleString();
        const altPct = Math.min(100, Math.max(0, (altitude % 1000) / 1000 * 100));
        this.elements.altMarker.style.top = (100 - altPct) + '%';

        // Airspeed
        this.elements.airspeed.textContent = Math.round(airspeed);
        const spdPct = Math.min(100, airspeed / 250 * 100);
        const dashOffset = 126 - (spdPct / 100 * 126);
        this.elements.spdFill.style.strokeDashoffset = dashOffset;

        // Heading
        this.elements.heading.textContent = String(Math.round(heading) % 360).padStart(3, '0');
        this.elements.compassRose.style.transform = `translate(-50%, -50%) rotate(${-heading}deg)`;

        // Vertical Speed
        const vsAbs = Math.abs(vspeed);
        const vsDisplay = vspeed >= 0 ? '+' + Math.round(vspeed) : Math.round(vspeed);
        this.elements.vspeed.textContent = vsDisplay;

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

        // Ground Speed
        this.elements.groundspeed.textContent = Math.round(groundspeed);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.pfdWidget = new PFDWidget();
});
