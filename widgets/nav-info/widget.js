/**
 * Navigation Info Widget
 * SimWidget Engine v1.0.0
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
            windSpd: 0,
            localTime: 0
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
        this.startTimeUpdate();
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
        setInterval(() => {
            const now = new Date();
            this.elements.utcTime.textContent = now.toUTCString().slice(17, 25);
            this.elements.localTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        }, 1000);
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            console.log('[NAV] Connected to SimWidget');
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateData(msg.data);
                }
            } catch (e) {
                console.error('[NAV] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[NAV] Disconnected');
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('[NAV] WebSocket error:', err);
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.navWidget = new NavInfoWidget();
});
