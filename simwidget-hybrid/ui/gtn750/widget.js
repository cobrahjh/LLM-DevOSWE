/**
 * GTN750 GPS Widget
 * Connects to SimWidget backend for MSFS flight data
 */

class GTN750Widget {
    constructor() {
        this.ws = null;
        this.reconnectDelay = 3000;
        this.activeWaypoint = null;
        this.activeWaypointIndex = 0;
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
            nav2Active: 108.00,
            nav2Standby: 108.00,
            transponder: 1200,
            zuluTime: 0
        };

        // Flight plan
        this.flightPlan = null;

        // CDI data
        this.cdi = {
            dtk: 0,      // Desired track
            xtrk: 0,     // Cross-track error (nm)
            deflection: 0 // -1 to 1 for needle position
        };

        // Cross-widget sync
        this.syncChannel = new BroadcastChannel('simwidget-sync');
        this.initSyncListener();

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.connect();
        this.startClock();
        this.fetchFlightPlan();
    }

    initSyncListener() {
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'route-update' && data.waypoints) {
                this.flightPlan = data;
                this.renderFlightPlan();
            }
            if (type === 'waypoint-select') {
                this.selectWaypoint(data.index);
            }
        };
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
            gpsStatus: document.getElementById('gps-status'),
            // Swap buttons
            swapCom1: document.getElementById('swap-com1'),
            swapCom2: document.getElementById('swap-com2'),
            swapNav1: document.getElementById('swap-nav1'),
            // Flight plan
            fplList: document.getElementById('fpl-list'),
            btnDirect: document.getElementById('btn-direct'),
            // CDI
            cdiNeedle: document.getElementById('cdi-needle'),
            cdiDtk: document.getElementById('cdi-dtk'),
            cdiXtrk: document.getElementById('cdi-xtrk')
        };
    }

    bindEvents() {
        // Frequency swap buttons
        this.elements.swapCom1?.addEventListener('click', () => this.swapFrequency('COM1'));
        this.elements.swapCom2?.addEventListener('click', () => this.swapFrequency('COM2'));
        this.elements.swapNav1?.addEventListener('click', () => this.swapFrequency('NAV1'));

        // Direct-to button
        this.elements.btnDirect?.addEventListener('click', () => this.showDirectTo());
    }

    async swapFrequency(radio) {
        try {
            const event = `${radio}_RADIO_SWAP`;
            await fetch(`http://${location.hostname}:${this.serverPort}/api/simconnect/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event })
            });
            console.log(`[GTN750] Swapped ${radio}`);
        } catch (e) {
            console.error(`[GTN750] Failed to swap ${radio}:`, e);
        }
    }

    showDirectTo() {
        const ident = prompt('Enter waypoint identifier:');
        if (ident && ident.trim()) {
            this.directTo(ident.trim().toUpperCase());
        }
    }

    async directTo(ident) {
        // Broadcast direct-to request
        this.syncChannel.postMessage({
            type: 'direct-to',
            data: { ident }
        });
        console.log(`[GTN750] Direct-to ${ident}`);
    }

    async fetchFlightPlan() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/flightplan`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.waypoints && data.waypoints.length > 0) {
                    this.flightPlan = data;
                    this.renderFlightPlan();
                }
            }
        } catch (e) {
            console.log('[GTN750] No flight plan available');
        }
        // Re-fetch every 30 seconds
        setTimeout(() => this.fetchFlightPlan(), 30000);
    }

    renderFlightPlan() {
        if (!this.elements.fplList) return;

        this.elements.fplList.replaceChildren();

        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'gtn-fpl-empty';
            empty.textContent = 'No flight plan loaded';
            this.elements.fplList.appendChild(empty);
            return;
        }

        this.flightPlan.waypoints.forEach((wp, index) => {
            const item = document.createElement('div');
            item.className = 'gtn-fpl-item';

            if (wp.passed) item.classList.add('passed');
            if (index === this.activeWaypointIndex) item.classList.add('active');

            const left = document.createElement('div');
            const ident = document.createElement('div');
            ident.className = 'gtn-fpl-ident';
            ident.textContent = wp.ident || wp.name || `WP${index + 1}`;

            const type = document.createElement('div');
            type.className = 'gtn-fpl-type';
            type.textContent = wp.type || '';

            left.appendChild(ident);
            left.appendChild(type);

            const dist = document.createElement('div');
            dist.className = 'gtn-fpl-dist';
            if (wp.distanceFromPrev) {
                dist.textContent = Math.round(wp.distanceFromPrev) + ' NM';
            }

            item.appendChild(left);
            item.appendChild(dist);

            item.addEventListener('click', () => this.selectWaypoint(index));
            this.elements.fplList.appendChild(item);
        });
    }

    selectWaypoint(index) {
        this.activeWaypointIndex = index;
        if (this.flightPlan && this.flightPlan.waypoints[index]) {
            this.activeWaypoint = this.flightPlan.waypoints[index];
            this.updateWaypointDisplay();
            this.renderFlightPlan();

            // Broadcast selection
            this.syncChannel.postMessage({
                type: 'waypoint-select',
                data: {
                    index,
                    ident: this.activeWaypoint.ident,
                    lat: this.activeWaypoint.lat,
                    lng: this.activeWaypoint.lng
                }
            });
        }
    }

    updateWaypointDisplay() {
        if (!this.activeWaypoint) return;

        const wp = this.activeWaypoint;

        if (this.elements.wptId) {
            this.elements.wptId.textContent = wp.ident || wp.name || '----';
        }

        // Calculate distance and bearing if we have position
        if (this.data.latitude && this.data.longitude && wp.lat && wp.lng) {
            const dist = this.calculateDistance(
                this.data.latitude, this.data.longitude,
                wp.lat, wp.lng
            );
            const brg = this.calculateBearing(
                this.data.latitude, this.data.longitude,
                wp.lat, wp.lng
            );

            if (this.elements.wptDis) {
                this.elements.wptDis.textContent = dist.toFixed(1);
            }
            if (this.elements.wptBrg) {
                this.elements.wptBrg.textContent = Math.round(brg).toString().padStart(3, '0');
            }

            // ETE calculation
            if (this.data.groundSpeed > 0 && this.elements.wptEte) {
                const eteMinutes = (dist / this.data.groundSpeed) * 60;
                this.elements.wptEte.textContent = this.formatEte(eteMinutes);
            }

            // Update CDI
            this.updateCDI(brg, dist);
        }
    }

    updateCDI(bearing, distance) {
        // Calculate cross-track error (simplified)
        const trackError = this.normalizeAngle(bearing - this.data.heading);
        const xtrk = Math.sin(trackError * Math.PI / 180) * distance;

        this.cdi.dtk = Math.round(bearing);
        this.cdi.xtrk = Math.abs(xtrk);
        this.cdi.deflection = Math.max(-1, Math.min(1, xtrk / 2)); // 2nm = full deflection

        // Update UI
        if (this.elements.cdiDtk) {
            this.elements.cdiDtk.textContent = this.cdi.dtk.toString().padStart(3, '0');
        }
        if (this.elements.cdiXtrk) {
            this.elements.cdiXtrk.textContent = this.cdi.xtrk.toFixed(1);
        }
        if (this.elements.cdiNeedle) {
            const offset = 50 + (this.cdi.deflection * 40); // 10% to 90% range
            this.elements.cdiNeedle.style.left = offset + '%';
        }
    }

    normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    formatEte(minutes) {
        if (minutes < 0 || !isFinite(minutes)) return '--:--';
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}`;
        }
        return `${mins}m`;
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        const wsUrl = `ws://${host}:${this.serverPort}`;
        console.log('[GTN750] Connecting to', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[GTN750] Connected');
            this.elements.conn?.classList.add('connected');
            if (this.elements.gpsStatus) {
                this.elements.gpsStatus.textContent = 'GPS 3D';
                this.elements.gpsStatus.classList.remove('error');
            }
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
            console.log('[GTN750] Disconnected, reconnecting...');
            this.elements.conn?.classList.remove('connected');
            if (this.elements.gpsStatus) {
                this.elements.gpsStatus.textContent = 'NO GPS';
                this.elements.gpsStatus.classList.add('error');
            }
            setTimeout(() => this.connect(), this.reconnectDelay);
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
        this.updateWaypointDisplay();
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
