/**
 * Traffic Radar Widget
 * Displays nearby AI/multiplayer aircraft on radar display
 */

class TrafficWidget {
    constructor() {
        this.ws = null;
        this.reconnectDelay = 2000;
        this.range = 10; // nm
        this.ownPosition = { lat: 0, lon: 0, alt: 0, hdg: 0 };
        this.traffic = [];
        this.radarSize = 0;
        this.lastAlertLevel = null;
        this.announcer = typeof VoiceAnnouncer !== 'undefined' ? new VoiceAnnouncer() : null;

        this.init();
    }

    init() {
        this.radarSize = document.getElementById('radar-display').offsetWidth;
        this.connectWebSocket();
        this.bindEvents();
        this.startPolling();

        // Handle resize
        window.addEventListener('resize', () => {
            this.radarSize = document.getElementById('radar-display').offsetWidth;
            this.updateRadarDisplay();
        });
    }

    connectWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:3001/ws`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Traffic] WebSocket connected');
            this.updateConnectionStatus(true);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'simData') {
                    this.updateOwnPosition(msg.data);
                }
                if (msg.type === 'traffic') {
                    this.updateTraffic(msg.data);
                }
            } catch (e) {
                console.error('[Traffic] Parse error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[Traffic] WebSocket closed');
            this.updateConnectionStatus(false);
            if (!this._destroyed) setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        };

        this.ws.onerror = (error) => {
            console.error('[Traffic] WebSocket error:', error);
        };
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('conn-status');
        if (status) {
            status.classList.toggle('connected', connected);
            status.title = connected ? 'Connected to SimConnect' : 'Disconnected';
        }
    }

    updateOwnPosition(data) {
        if (data.latitude !== undefined) this.ownPosition.lat = data.latitude;
        if (data.longitude !== undefined) this.ownPosition.lon = data.longitude;
        if (data.altitude !== undefined) this.ownPosition.alt = data.altitude;
        if (data.heading !== undefined) this.ownPosition.hdg = data.heading;
    }

    updateTraffic(trafficData) {
        this.traffic = trafficData || [];
        this.updateRadarDisplay();
        this.updateTrafficList();
        this.checkTCAS();
    }

    updateRadarDisplay() {
        const container = document.getElementById('traffic-targets');
        container.textContent = '';

        this.traffic.forEach(aircraft => {
            const relPos = this.calculateRelativePosition(aircraft);
            if (relPos.distance <= this.range) {
                const target = this.createTargetElement(aircraft, relPos);
                container.appendChild(target);
            }
        });
    }

    calculateRelativePosition(aircraft) {
        // Calculate distance and bearing from own aircraft
        const R = 3440.065; // Earth radius in nm
        const lat1 = this.ownPosition.lat * Math.PI / 180;
        const lat2 = aircraft.latitude * Math.PI / 180;
        const dLat = (aircraft.latitude - this.ownPosition.lat) * Math.PI / 180;
        const dLon = (aircraft.longitude - this.ownPosition.lon) * Math.PI / 180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Bearing
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;

        // Relative bearing (accounting for own heading)
        const relativeBearing = (bearing - this.ownPosition.hdg + 360) % 360;

        // Altitude difference (in 100s of feet for display)
        const altDiff = Math.round((aircraft.altitude - this.ownPosition.alt) / 100);

        // Vertical trend
        let trend = 'level';
        if (aircraft.verticalSpeed > 100) trend = 'ascending';
        else if (aircraft.verticalSpeed < -100) trend = 'descending';

        return { distance, bearing, relativeBearing, altDiff, trend };
    }

    createTargetElement(aircraft, relPos) {
        const target = document.createElement('div');
        target.className = 'traffic-target';

        // Convert polar to cartesian for radar display
        const angle = (relPos.relativeBearing - 90) * Math.PI / 180; // -90 to make north up
        const normalizedDist = relPos.distance / this.range;
        const radius = (this.radarSize / 2) * normalizedDist * 0.9; // 90% of radius

        const x = 50 + (Math.cos(angle) * radius / this.radarSize * 100);
        const y = 50 + (Math.sin(angle) * radius / this.radarSize * 100);

        target.style.left = `${x}%`;
        target.style.top = `${y}%`;

        const icon = document.createElement('span');
        icon.className = `target-icon ${relPos.trend}`;
        icon.textContent = relPos.trend === 'ascending' ? '↑' :
                          relPos.trend === 'descending' ? '↓' : '◆';

        const alt = document.createElement('span');
        alt.className = 'target-alt';
        const altSign = relPos.altDiff >= 0 ? '+' : '';
        alt.textContent = `${altSign}${relPos.altDiff}`;

        target.appendChild(icon);
        target.appendChild(alt);
        target.title = `${aircraft.callsign || 'Unknown'}\n${relPos.distance.toFixed(1)} nm\nAlt: ${Math.round(aircraft.altitude)} ft`;

        return target;
    }

    updateTrafficList() {
        const listContent = document.getElementById('list-content');
        const countEl = document.getElementById('traffic-count');

        const nearbyTraffic = this.traffic
            .map(aircraft => ({
                ...aircraft,
                relPos: this.calculateRelativePosition(aircraft)
            }))
            .filter(a => a.relPos.distance <= this.range)
            .sort((a, b) => a.relPos.distance - b.relPos.distance);

        countEl.textContent = nearbyTraffic.length;

        if (nearbyTraffic.length === 0) {
            listContent.textContent = '';
            const noTraffic = document.createElement('div');
            noTraffic.className = 'no-traffic';
            noTraffic.textContent = 'No traffic detected';
            listContent.appendChild(noTraffic);
            return;
        }

        listContent.textContent = '';
        nearbyTraffic.slice(0, 5).forEach(aircraft => {
            const item = document.createElement('div');
            item.className = 'traffic-item';

            const callsign = document.createElement('span');
            callsign.className = 'callsign';
            callsign.textContent = aircraft.callsign || 'N/A';

            const distance = document.createElement('span');
            distance.className = 'distance';
            distance.textContent = `${aircraft.relPos.distance.toFixed(1)} nm`;

            const altitude = document.createElement('span');
            altitude.className = 'altitude';
            altitude.textContent = `FL${Math.round(aircraft.altitude / 100).toString().padStart(3, '0')}`;

            const trend = document.createElement('span');
            trend.className = `trend ${aircraft.relPos.trend === 'ascending' ? 'up' :
                              aircraft.relPos.trend === 'descending' ? 'down' : 'level'}`;
            trend.textContent = aircraft.relPos.trend === 'ascending' ? '▲' :
                               aircraft.relPos.trend === 'descending' ? '▼' : '—';

            item.appendChild(callsign);
            item.appendChild(distance);
            item.appendChild(altitude);
            item.appendChild(trend);
            listContent.appendChild(item);
        });
    }

    checkTCAS() {
        const alertEl = document.getElementById('tcas-alert');
        let highestThreat = null;
        let threatAircraft = null;

        this.traffic.forEach(aircraft => {
            const relPos = this.calculateRelativePosition(aircraft);

            // Simple TCAS-like logic
            // RA: < 0.5nm and < 500ft vertical separation
            // TA: < 2nm and < 1000ft vertical separation
            const vertSep = Math.abs(relPos.altDiff * 100);

            if (relPos.distance < 0.5 && vertSep < 500) {
                highestThreat = 'ra';
                threatAircraft = { ...aircraft, relPos };
            } else if (relPos.distance < 2 && vertSep < 1000 && highestThreat !== 'ra') {
                highestThreat = 'ta';
                if (!threatAircraft) threatAircraft = { ...aircraft, relPos };
            }
        });

        alertEl.className = 'tcas-alert';
        if (highestThreat === 'ra') {
            alertEl.className = 'tcas-alert ra';
            alertEl.textContent = 'TRAFFIC ALERT';

            // Voice alert for RA (only if state changed)
            if (this.lastAlertLevel !== 'ra' && this.announcer) {
                const direction = this.getClockPosition(threatAircraft.relPos.relativeBearing);
                const vertDir = threatAircraft.relPos.altDiff > 0 ? 'high' : 'low';
                this.announcer.speak(`Traffic! Traffic! ${direction} o'clock, ${vertDir}`);
            }
        } else if (highestThreat === 'ta') {
            alertEl.className = 'tcas-alert ta';
            alertEl.textContent = 'TRAFFIC';

            // Voice alert for TA (only if state changed from clear)
            if (this.lastAlertLevel === null && this.announcer) {
                const direction = this.getClockPosition(threatAircraft.relPos.relativeBearing);
                this.announcer.speak(`Traffic, ${direction} o'clock, ${Math.round(threatAircraft.relPos.distance)} miles`);
            }
        } else {
            alertEl.textContent = '';
        }

        this.lastAlertLevel = highestThreat;
    }

    getClockPosition(bearing) {
        // Convert bearing to clock position (12 = ahead, 3 = right, etc)
        const clock = Math.round(bearing / 30) || 12;
        return clock === 0 ? 12 : clock;
    }

    bindEvents() {
        // Range selector
        document.getElementById('range-select')?.addEventListener('change', (e) => {
            this.range = parseInt(e.target.value);
            this.updateRadarDisplay();
            this.updateTrafficList();
        });
    }

    destroy() {
        this._destroyed = true;
        if (this._pollInterval) clearInterval(this._pollInterval);
        if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    }

    async startPolling() {
        // Poll for traffic data
        this._pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/traffic');
                if (response.ok) {
                    const data = await response.json();
                    this.updateTraffic(data.traffic || []);
                }
            } catch (e) {
                // Silent fail
            }
        }, 2000);
    }
}

// Initialize
const trafficWidget = new TrafficWidget();
window.addEventListener('beforeunload', () => trafficWidget.destroy());
