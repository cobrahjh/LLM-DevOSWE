/**
 * Flight Instruments Widget
 * SimWidget Engine v2.0.0 - Phase 4: Information & HUD
 */

class FlightInstrumentsWidget {
    constructor() {
        this.ws = null;
        this.data = {
            // Speeds
            ias: 0,
            groundSpeed: 0,
            // Altitude
            altitude: 0,
            verticalSpeed: 0,
            // Attitude
            pitch: 0,
            bank: 0,
            heading: 0,
            // Control inputs (-100 to 100)
            aileron: 0,
            elevator: 0,
            rudder: 0,
            // Environment
            gforce: 1.0,
            gforceMin: 1.0,
            gforceMax: 1.0,
            windDirection: 0,
            windSpeed: 0
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.generateTapes();
        this.connect();
        this.startMockData();
        this.updateUI();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            // Speed tape
            speedTrack: document.getElementById('speed-track'),
            speedValue: document.getElementById('speed-value'),
            // Altitude tape
            altTrack: document.getElementById('alt-track'),
            altValue: document.getElementById('alt-value'),
            // Attitude
            horizon: document.getElementById('horizon'),
            pitchValue: document.getElementById('pitch-value'),
            bankValue: document.getElementById('bank-value'),
            // Data row
            vsValue: document.getElementById('vs-value'),
            hdgValue: document.getElementById('hdg-value'),
            gsValue: document.getElementById('gs-value'),
            // Control inputs
            controlDot: document.getElementById('control-dot'),
            rudderIndicator: document.getElementById('rudder-indicator'),
            rudderValue: document.getElementById('rudder-value'),
            // G-force
            gforceValue: document.getElementById('gforce-value'),
            gforceFill: document.getElementById('gforce-fill'),
            gforceMin: document.getElementById('gforce-min'),
            gforceMax: document.getElementById('gforce-max'),
            // Wind
            windArrow: document.getElementById('wind-arrow'),
            windDir: document.getElementById('wind-dir'),
            windSpd: document.getElementById('wind-spd')
        };
    }

    generateTapes() {
        // Generate speed tape (0-400 kts)
        if (this.elements.speedTrack) {
            let html = '';
            for (let i = 400; i >= 0; i -= 10) {
                const isMajor = i % 50 === 0;
                html += `<div class="fi-tape-tick ${isMajor ? 'major' : ''}" data-value="${i}">
                    ${isMajor ? `<span>${i}</span>` : ''}
                </div>`;
            }
            this.elements.speedTrack.innerHTML = html;
        }

        // Generate altitude tape (0-50000 ft)
        if (this.elements.altTrack) {
            let html = '';
            for (let i = 50000; i >= 0; i -= 100) {
                const isMajor = i % 500 === 0;
                html += `<div class="fi-tape-tick ${isMajor ? 'major' : ''}" data-value="${i}">
                    ${isMajor ? `<span>${i >= 1000 ? Math.floor(i/1000) + 'k' : i}</span>` : ''}
                </div>`;
            }
            this.elements.altTrack.innerHTML = html;
        }
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn?.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn?.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    updateFromSim(data) {
        if (data.indicatedAltitude !== undefined) this.data.altitude = data.indicatedAltitude;
        if (data.indicatedAirspeed !== undefined) this.data.ias = data.indicatedAirspeed;
        if (data.groundSpeed !== undefined) this.data.groundSpeed = data.groundSpeed;
        if (data.verticalSpeed !== undefined) this.data.verticalSpeed = data.verticalSpeed;
        if (data.heading !== undefined) this.data.heading = data.heading;
        if (data.pitch !== undefined) this.data.pitch = data.pitch;
        if (data.bank !== undefined) this.data.bank = data.bank;
        if (data.aileronPosition !== undefined) this.data.aileron = data.aileronPosition;
        if (data.elevatorPosition !== undefined) this.data.elevator = data.elevatorPosition;
        if (data.rudderPosition !== undefined) this.data.rudder = data.rudderPosition;
        if (data.gForce !== undefined) {
            this.data.gforce = data.gForce;
            this.data.gforceMin = Math.min(this.data.gforceMin, data.gForce);
            this.data.gforceMax = Math.max(this.data.gforceMax, data.gForce);
        }
        if (data.windDirection !== undefined) this.data.windDirection = data.windDirection;
        if (data.windSpeed !== undefined) this.data.windSpeed = data.windSpeed;

        this.updateUI();
    }

    startMockData() {
        // Simulate flight data for testing
        let t = 0;
        setInterval(() => {
            t += 0.05;

            // Simulate gentle flight
            this.data.ias = 120 + Math.sin(t * 0.3) * 10;
            this.data.groundSpeed = this.data.ias + 15;
            this.data.altitude = 5500 + Math.sin(t * 0.2) * 200;
            this.data.verticalSpeed = Math.cos(t * 0.2) * 500;
            this.data.heading = (180 + Math.sin(t * 0.1) * 20 + 360) % 360;
            this.data.pitch = Math.sin(t * 0.4) * 5;
            this.data.bank = Math.sin(t * 0.3) * 15;

            // Control inputs follow attitude
            this.data.aileron = this.data.bank * 2;
            this.data.elevator = -this.data.pitch * 3;
            this.data.rudder = Math.sin(t * 0.5) * 10;

            // G-force varies with maneuvers
            this.data.gforce = 1.0 + Math.sin(t * 0.6) * 0.3;
            this.data.gforceMin = Math.min(this.data.gforceMin, this.data.gforce);
            this.data.gforceMax = Math.max(this.data.gforceMax, this.data.gforce);

            // Wind
            this.data.windDirection = 270;
            this.data.windSpeed = 12;

            this.updateUI();
        }, 50);
    }

    updateUI() {
        // Speed tape
        if (this.elements.speedTrack) {
            const speedOffset = (this.data.ias / 400) * 100;
            this.elements.speedTrack.style.transform = `translateY(${speedOffset}%)`;
        }
        if (this.elements.speedValue) {
            this.elements.speedValue.textContent = Math.round(this.data.ias);
        }

        // Altitude tape
        if (this.elements.altTrack) {
            const altOffset = (this.data.altitude / 50000) * 100;
            this.elements.altTrack.style.transform = `translateY(${altOffset}%)`;
        }
        if (this.elements.altValue) {
            this.elements.altValue.textContent = Math.round(this.data.altitude);
        }

        // Attitude indicator
        if (this.elements.horizon) {
            const pitchOffset = this.data.pitch * 2; // 2px per degree
            this.elements.horizon.style.transform = `rotate(${-this.data.bank}deg) translateY(${pitchOffset}px)`;
        }
        if (this.elements.pitchValue) {
            this.elements.pitchValue.textContent = `${this.data.pitch > 0 ? '+' : ''}${this.data.pitch.toFixed(1)}°`;
        }
        if (this.elements.bankValue) {
            this.elements.bankValue.textContent = `${this.data.bank > 0 ? 'R' : 'L'}${Math.abs(this.data.bank).toFixed(1)}°`;
        }

        // Data row
        if (this.elements.vsValue) {
            const vs = Math.round(this.data.verticalSpeed);
            this.elements.vsValue.textContent = (vs > 0 ? '+' : '') + vs;
            this.elements.vsValue.className = 'fi-data-value ' + (vs > 100 ? 'positive' : vs < -100 ? 'negative' : '');
        }
        if (this.elements.hdgValue) {
            this.elements.hdgValue.textContent = Math.round(this.data.heading).toString().padStart(3, '0');
        }
        if (this.elements.gsValue) {
            this.elements.gsValue.textContent = Math.round(this.data.groundSpeed);
        }

        // Control inputs - dot position
        if (this.elements.controlDot) {
            const x = (this.data.aileron / 100) * 40; // 40px max offset
            const y = (this.data.elevator / 100) * 40;
            this.elements.controlDot.style.transform = `translate(${x}px, ${y}px)`;
        }

        // Rudder bar
        if (this.elements.rudderIndicator) {
            const pos = 50 + (this.data.rudder / 100) * 45; // 50% center, 45% range
            this.elements.rudderIndicator.style.left = `${pos}%`;
        }
        if (this.elements.rudderValue) {
            this.elements.rudderValue.textContent = `${Math.round(this.data.rudder)}%`;
        }

        // G-force
        if (this.elements.gforceValue) {
            this.elements.gforceValue.textContent = this.data.gforce.toFixed(1);
            this.elements.gforceValue.className = 'fi-gforce-value ' +
                (this.data.gforce > 2 ? 'high' : this.data.gforce < 0.5 ? 'low' : '');
        }
        if (this.elements.gforceFill) {
            // Map -1 to 3 G range to 0-100%
            const fillPct = Math.min(100, Math.max(0, ((this.data.gforce + 1) / 4) * 100));
            this.elements.gforceFill.style.width = `${fillPct}%`;
        }
        if (this.elements.gforceMin) {
            this.elements.gforceMin.textContent = this.data.gforceMin.toFixed(1);
        }
        if (this.elements.gforceMax) {
            this.elements.gforceMax.textContent = this.data.gforceMax.toFixed(1);
        }

        // Wind
        if (this.elements.windArrow) {
            // Arrow points where wind is coming FROM relative to aircraft heading
            const relWind = (this.data.windDirection - this.data.heading + 360) % 360;
            this.elements.windArrow.style.transform = `rotate(${relWind}deg)`;
        }
        if (this.elements.windDir) {
            this.elements.windDir.textContent = Math.round(this.data.windDirection).toString().padStart(3, '0') + '°';
        }
        if (this.elements.windSpd) {
            this.elements.windSpd.textContent = `${Math.round(this.data.windSpeed)} kt`;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.flightWidget = new FlightInstrumentsWidget();
});
