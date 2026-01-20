/**
 * Navigation Info Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

class NavInfoWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.data = {
            lat: 0,
            lon: 0,
            track: 0,
            windDir: 0,
            windSpd: 0
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
        this.startTimeUpdate();
        this.startMockUpdate();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            lat: document.getElementById('lat'),
            lon: document.getElementById('lon'),
            track: document.getElementById('track'),
            wind: document.getElementById('wind'),
            windArrow: document.getElementById('wind-arrow'),
            utcTime: document.getElementById('utc-time'),
            localTime: document.getElementById('local-time')
        };
    }

    startTimeUpdate() {
        // Update real-world time every second
        const updateTime = () => {
            const now = new Date();
            this.elements.utcTime.textContent = now.toUTCString().slice(17, 25);
            this.elements.localTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        };
        updateTime();
        setInterval(updateTime, 1000);
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
        this.data.lat = data.lat || data.latitude || 0;
        this.data.lon = data.lon || data.longitude || 0;
        this.data.track = data.track || data.groundTrack || 0;
        this.data.windDir = data.windDirection || 0;
        this.data.windSpd = data.windSpeed || 0;

        this.updateUI();
    }

    formatCoord(value, isLat) {
        const abs = Math.abs(value);
        const deg = Math.floor(abs);
        const min = ((abs - deg) * 60).toFixed(2);

        if (isLat) {
            const dir = value >= 0 ? 'N' : 'S';
            return `${dir} ${String(deg).padStart(2, '0')}°${String(min).padStart(5, '0')}'`;
        } else {
            const dir = value >= 0 ? 'E' : 'W';
            return `${dir} ${String(deg).padStart(3, '0')}°${String(min).padStart(5, '0')}'`;
        }
    }

    updateUI() {
        // Coordinates
        this.elements.lat.textContent = this.formatCoord(this.data.lat, true);
        this.elements.lon.textContent = this.formatCoord(this.data.lon, false);

        // Track
        this.elements.track.textContent = String(Math.round(this.data.track)).padStart(3, '0') + '°';

        // Wind
        const windDir = String(Math.round(this.data.windDir)).padStart(3, '0');
        const windSpd = Math.round(this.data.windSpd);
        this.elements.wind.textContent = `${windDir}°/${windSpd}kt`;

        // Rotate wind arrow to show direction wind is coming FROM
        this.elements.windArrow.style.transform = `rotate(${this.data.windDir}deg)`;
    }

    startMockUpdate() {
        // Generate mock data for testing without sim
        this.data = {
            lat: 47.4502,
            lon: -122.3088,
            track: 270,
            windDir: 315,
            windSpd: 12
        };
        this.updateUI();

        // Animate track slowly
        setInterval(() => {
            this.data.track = (this.data.track + 0.1) % 360;
            this.data.windDir = (this.data.windDir + 0.05) % 360;
            this.updateUI();
        }, 100);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.navWidget = new NavInfoWidget();
});
