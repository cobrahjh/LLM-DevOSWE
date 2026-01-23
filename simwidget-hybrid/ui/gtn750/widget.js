/**
 * GTN750 GPS Widget
 * Connects to SimWidget backend for MSFS flight data
 */

class GTN750Widget {
    constructor() {
        this.ws = null;
        this.serverHost = '192.168.1.42';
        this.serverPort = 8080;

        this.data = {
            latitude: 0,
            longitude: 0,
            altitude: 0,
            groundSpeed: 0,
            heading: 0,
            track: 0,
            verticalSpeed: 0,
            windDirection: 0,
            windSpeed: 0,
            com1Active: 118.00,
            com1Standby: 118.00,
            com2Active: 118.00,
            com2Standby: 118.00,
            nav1Active: 108.00,
            nav1Standby: 108.00,
            transponder: 1200,
            zuluTime: 0
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
            lat: document.getElementById('lat'),
            lon: document.getElementById('lon'),
            gs: document.getElementById('gs'),
            trk: document.getElementById('trk'),
            alt: document.getElementById('alt'),
            hdg: document.getElementById('hdg'),
            vs: document.getElementById('vs'),
            wind: document.getElementById('wind'),
            wptId: document.getElementById('wpt-id'),
            wptDis: document.getElementById('wpt-dis'),
            wptBrg: document.getElementById('wpt-brg'),
            wptEte: document.getElementById('wpt-ete'),
            com1: document.getElementById('com1'),
            com1Stby: document.getElementById('com1-stby'),
            com2: document.getElementById('com2'),
            com2Stby: document.getElementById('com2-stby'),
            nav1: document.getElementById('nav1'),
            nav1Stby: document.getElementById('nav1-stby'),
            xpdr: document.getElementById('xpdr'),
            utcTime: document.getElementById('utc-time'),
            gpsStatus: document.getElementById('gps-status')
        };
    }

    connect() {
        const host = window.location.hostname || this.serverHost;
        this.ws = new WebSocket(`ws://${host}:${this.serverPort}`);

        this.ws.onopen = () => {
            console.log('[GTN750] Connected');
            this.elements.conn?.classList.add('connected');
            this.elements.gpsStatus.textContent = 'GPS 3D';
            this.elements.gpsStatus.style.background = '#004400';
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {
                console.error('[GTN750] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[GTN750] Disconnected');
            this.elements.conn?.classList.remove('connected');
            this.elements.gpsStatus.textContent = 'NO GPS';
            this.elements.gpsStatus.style.background = '#440000';
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (e) => {
            console.error('[GTN750] WebSocket error:', e);
        };
    }

    updateFromSim(data) {
        // Update internal data
        if (data.latitude !== undefined) this.data.latitude = data.latitude;
        if (data.longitude !== undefined) this.data.longitude = data.longitude;
        if (data.altitudeMSL !== undefined) this.data.altitude = data.altitudeMSL;
        if (data.groundSpeed !== undefined) this.data.groundSpeed = data.groundSpeed;
        if (data.heading !== undefined) this.data.heading = data.heading;
        if (data.verticalSpeed !== undefined) this.data.verticalSpeed = data.verticalSpeed;
        if (data.windDirection !== undefined) this.data.windDirection = data.windDirection;
        if (data.windSpeed !== undefined) this.data.windSpeed = data.windSpeed;
        if (data.com1Active !== undefined) this.data.com1Active = data.com1Active;
        if (data.com1Standby !== undefined) this.data.com1Standby = data.com1Standby;
        if (data.com2Active !== undefined) this.data.com2Active = data.com2Active;
        if (data.com2Standby !== undefined) this.data.com2Standby = data.com2Standby;
        if (data.nav1Active !== undefined) this.data.nav1Active = data.nav1Active;
        if (data.nav1Standby !== undefined) this.data.nav1Standby = data.nav1Standby;
        if (data.transponder !== undefined) this.data.transponder = data.transponder;
        if (data.zuluTime !== undefined) this.data.zuluTime = data.zuluTime;

        // Calculate track from heading (simplified - should use GPS track)
        this.data.track = this.data.heading;

        this.updateUI();
    }

    formatLatitude(lat) {
        const dir = lat >= 0 ? 'N' : 'S';
        const absLat = Math.abs(lat);
        const deg = Math.floor(absLat);
        const min = ((absLat - deg) * 60).toFixed(2);
        return `${dir} ${deg.toString().padStart(2, '0')}° ${min.padStart(5, '0')}'`;
    }

    formatLongitude(lon) {
        const dir = lon >= 0 ? 'E' : 'W';
        const absLon = Math.abs(lon);
        const deg = Math.floor(absLon);
        const min = ((absLon - deg) * 60).toFixed(2);
        return `${dir} ${deg.toString().padStart(3, '0')}° ${min.padStart(5, '0')}'`;
    }

    formatFrequency(freq) {
        return freq.toFixed(2);
    }

    formatTransponder(code) {
        return code.toString().padStart(4, '0');
    }

    formatTime(hours) {
        const totalSeconds = hours * 3600;
        const h = Math.floor(totalSeconds / 3600) % 24;
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}Z`;
    }

    updateUI() {
        // Position
        if (this.elements.lat) {
            this.elements.lat.textContent = this.formatLatitude(this.data.latitude);
        }
        if (this.elements.lon) {
            this.elements.lon.textContent = this.formatLongitude(this.data.longitude);
        }

        // Navigation data
        if (this.elements.gs) {
            this.elements.gs.textContent = Math.round(this.data.groundSpeed);
        }
        if (this.elements.trk) {
            this.elements.trk.textContent = Math.round(this.data.track).toString().padStart(3, '0');
        }
        if (this.elements.alt) {
            this.elements.alt.textContent = Math.round(this.data.altitude).toLocaleString();
        }
        if (this.elements.hdg) {
            this.elements.hdg.textContent = Math.round(this.data.heading).toString().padStart(3, '0');
        }
        if (this.elements.vs) {
            const vs = Math.round(this.data.verticalSpeed);
            this.elements.vs.textContent = (vs >= 0 ? '+' : '') + vs;
        }
        if (this.elements.wind) {
            const dir = Math.round(this.data.windDirection).toString().padStart(3, '0');
            const spd = Math.round(this.data.windSpeed).toString().padStart(2, '0');
            this.elements.wind.textContent = `${dir}/${spd}`;
        }

        // Radio frequencies
        if (this.elements.com1) {
            this.elements.com1.textContent = this.formatFrequency(this.data.com1Active);
        }
        if (this.elements.com1Stby) {
            this.elements.com1Stby.textContent = this.formatFrequency(this.data.com1Standby);
        }
        if (this.elements.com2) {
            this.elements.com2.textContent = this.formatFrequency(this.data.com2Active);
        }
        if (this.elements.com2Stby) {
            this.elements.com2Stby.textContent = this.formatFrequency(this.data.com2Standby);
        }
        if (this.elements.nav1) {
            this.elements.nav1.textContent = this.formatFrequency(this.data.nav1Active);
        }
        if (this.elements.nav1Stby) {
            this.elements.nav1Stby.textContent = this.formatFrequency(this.data.nav1Standby);
        }
        if (this.elements.xpdr) {
            this.elements.xpdr.textContent = this.formatTransponder(this.data.transponder);
        }

        // UTC time from sim
        if (this.elements.utcTime && this.data.zuluTime) {
            this.elements.utcTime.textContent = this.formatTime(this.data.zuluTime);
        }
    }

    startClock() {
        // Fallback clock if sim time not available
        setInterval(() => {
            if (!this.data.zuluTime && this.elements.utcTime) {
                const now = new Date();
                const h = now.getUTCHours().toString().padStart(2, '0');
                const m = now.getUTCMinutes().toString().padStart(2, '0');
                const s = now.getUTCSeconds().toString().padStart(2, '0');
                this.elements.utcTime.textContent = `${h}:${m}:${s}Z`;
            }
        }, 1000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.gtn750 = new GTN750Widget();
});
