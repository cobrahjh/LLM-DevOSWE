/**
 * SimWidget Dashboard
 * Central hub for all SimWidget widgets
 */

class Dashboard {
    constructor() {
        this.ws = null;
        this.data = {
            connected: false,
            altitude: 0,
            speed: 0,
            heading: 0,
            verticalSpeed: 0
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
        this.startClock();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            simStatus: document.getElementById('sim-status'),
            wsStatus: document.getElementById('ws-status'),
            localTime: document.getElementById('local-time'),
            altitude: document.getElementById('altitude'),
            speed: document.getElementById('speed'),
            heading: document.getElementById('heading'),
            vs: document.getElementById('vs')
        };
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn?.classList.add('connected');
            this.elements.wsStatus.textContent = '🟢';
            this.elements.wsStatus.title = 'Server Connected';
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
            this.elements.wsStatus.textContent = '🔴';
            this.elements.wsStatus.title = 'Server Disconnected';
            this.elements.simStatus.textContent = '⚪';
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = () => {
            this.elements.wsStatus.textContent = '🔴';
        };
    }

    updateFromSim(data) {
        this.data.connected = true;
        this.elements.simStatus.textContent = '🟢';
        this.elements.simStatus.title = 'MSFS Connected';

        if (data.altitude !== undefined) {
            this.data.altitude = data.altitude;
            this.elements.altitude.textContent = Math.round(data.altitude).toLocaleString();
        }

        if (data.speed !== undefined) {
            this.data.speed = data.speed;
            this.elements.speed.textContent = Math.round(data.speed);
        }

        if (data.heading !== undefined) {
            this.data.heading = data.heading;
            this.elements.heading.textContent = Math.round(data.heading).toString().padStart(3, '0') + '°';
        }

        if (data.verticalSpeed !== undefined) {
            this.data.verticalSpeed = data.verticalSpeed;
            const vs = Math.round(data.verticalSpeed);
            this.elements.vs.textContent = (vs > 0 ? '+' : '') + vs;
        }
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const mins = now.getMinutes().toString().padStart(2, '0');
            this.elements.localTime.textContent = `${hours}:${mins}`;
        };

        updateClock();
        setInterval(updateClock, 1000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
