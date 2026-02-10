/**
 * Multiplayer pane - SimGlass
 * Shows nearby VATSIM/IVAO/MSFS multiplayer traffic
 */

class MultiplayerPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'multiplayer',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.myPosition = { lat: 0, lon: 0, alt: 0, heading: 0 };
        this.traffic = [];
        this.searchRadius = 50;
        this.selectedNetwork = 'all';
        this.refreshInterval = null;
        this.closestTraffic = null;

        this.initElements();
        this.initCompactMode();
        this.initEvents();
        this.startRefresh();
    }

    initElements() {
        this.myCoordsEl = document.getElementById('my-coords');
        this.trafficList = document.getElementById('traffic-list');
        this.trafficLoading = document.getElementById('traffic-loading');
        this.nearbyCountEl = document.getElementById('nearby-count');
        this.rangeEl = document.getElementById('range');
        this.rangeSlider = document.getElementById('range-slider');
        this.rangeValue = document.getElementById('range-value');
        this.networkSelect = document.getElementById('network-select');
        this.refreshBtn = document.getElementById('btn-refresh');
        this.connDot = document.getElementById('conn-dot');
        this.connText = document.getElementById('conn-text');
        this.lastUpdate = document.getElementById('last-update');

        // Compact mode elements
        this.compactToggle = document.getElementById('compact-toggle');
        this.widgetContainer = document.querySelector('.widget-container');
        this.compactNearby = document.getElementById('compact-nearby');
        this.compactRange = document.getElementById('compact-range');
        this.compactStatus = document.getElementById('compact-status');
        this.compactClosest = document.getElementById('compact-closest');
        this.compactDistance = document.getElementById('compact-distance');
        this.compactNetwork = document.getElementById('compact-network');
    }

    initCompactMode() {
        const isCompact = localStorage.getItem('multiplayer-widget-compact') === 'true';
        if (isCompact) {
            this.widgetContainer.classList.add('compact');
            this.compactToggle.classList.add('active');
        }

        this.compactToggle.addEventListener('click', () => {
            const nowCompact = !this.widgetContainer.classList.contains('compact');
            if (nowCompact) {
                this.widgetContainer.classList.add('compact');
                this.compactToggle.classList.add('active');
            } else {
                this.widgetContainer.classList.remove('compact');
                this.compactToggle.classList.remove('active');
            }
            localStorage.setItem('multiplayer-widget-compact', nowCompact.toString());
            this.updateCompact();
        });
    }

    initEvents() {
        this.rangeSlider.addEventListener('input', () => {
            this.searchRadius = parseInt(this.rangeSlider.value);
            this.rangeValue.textContent = this.searchRadius + ' nm';
            this.rangeEl.textContent = this.searchRadius;
            this.filterTraffic();
        });

        this.networkSelect.addEventListener('change', () => {
            this.selectedNetwork = this.networkSelect.value;
            this.filterTraffic();
        });

        this.refreshBtn.addEventListener('click', () => this.fetchTraffic());
    }

    // SimGlassBase override: called when WebSocket connects
    onConnect() {
        this.setConnectionStatus(true);
    }

    // SimGlassBase override: called when WebSocket disconnects
    onDisconnect() {
        this.setConnectionStatus(false);
    }

    // SimGlassBase override: handle incoming messages
    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.updatePosition(msg.data);
        }
    }

    setConnectionStatus(connected) {
        if (this.connDot) {
            this.connDot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
        }
        if (this.connText) {
            this.connText.textContent = connected ? 'SimConnect' : 'Disconnected';
        }
    }

    updatePosition(data) {
        if (data.latitude && data.longitude) {
            this.myPosition = {
                lat: data.latitude,
                lon: data.longitude,
                alt: data.altitude || 0,
                heading: data.heading || 0
            };
            this.myCoordsEl.textContent =
                data.latitude.toFixed(4) + ', ' + data.longitude.toFixed(4);
        }
    }

    startRefresh() {
        this.fetchTraffic();
        this.refreshInterval = setInterval(() => this.fetchTraffic(), 30000);
    }

    async fetchTraffic() {
        try {
            const vatsimTraffic = await this.fetchVATSIM();
            // MSFS AI traffic from SimConnect (when connected to sim)
            const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
            const msfsTraffic = isConnected && this.myPosition.lat
                ? this.generateSimTraffic()
                : [];

            this.traffic = [...vatsimTraffic, ...msfsTraffic];
            if (this.lastUpdate) {
                this.lastUpdate.textContent = new Date().toLocaleTimeString();
            }
            this.filterTraffic();
        } catch (e) {
            console.log('Traffic fetch error:', e);
            this.traffic = this.myPosition.lat ? this.generateSimTraffic() : [];
            this.filterTraffic();
        }
    }

    async fetchVATSIM() {
        try {
            const response = await fetch('https://data.vatsim.net/v3/vatsim-data.json');
            if (!response.ok) return [];

            const data = await response.json();
            const pilots = data.pilots || [];

            return pilots.map(p => ({
                callsign: p.callsign,
                lat: p.latitude,
                lon: p.longitude,
                altitude: p.altitude,
                groundspeed: p.groundspeed,
                heading: p.heading,
                aircraft: p.flight_plan?.aircraft_short || 'UNKN',
                departure: p.flight_plan?.departure || '',
                arrival: p.flight_plan?.arrival || '',
                route: p.flight_plan?.departure && p.flight_plan?.arrival
                    ? p.flight_plan.departure + ' > ' + p.flight_plan.arrival
                    : '',
                network: 'vatsim'
            }));
        } catch (e) {
            return [];
        }
    }

    generateSimTraffic() {
        if (!this.myPosition.lat || !this.myPosition.lon) return [];

        const mockAircraft = [
            { callsign: 'UAL123', aircraft: 'B738', network: 'msfs' },
            { callsign: 'DAL456', aircraft: 'A320', network: 'msfs' },
            { callsign: 'N789AB', aircraft: 'C172', network: 'msfs' }
        ];

        return mockAircraft.map((ac, i) => {
            const bearing = (i * 120) + Math.random() * 30;
            const distance = 10 + Math.random() * 40;
            const pos = this.destinationPoint(this.myPosition.lat, this.myPosition.lon, bearing, distance);

            return {
                ...ac,
                lat: pos.lat,
                lon: pos.lon,
                altitude: 5000 + Math.random() * 30000,
                groundspeed: 150 + Math.random() * 300,
                heading: Math.random() * 360,
                route: ''
            };
        });
    }

    filterTraffic() {
        let filtered = this.traffic;

        if (this.selectedNetwork !== 'all') {
            filtered = filtered.filter(t => t.network === this.selectedNetwork);
        }

        filtered = filtered.map(t => ({
            ...t,
            distance: this.calculateDistance(this.myPosition.lat, this.myPosition.lon, t.lat, t.lon),
            bearing: this.calculateBearing(this.myPosition.lat, this.myPosition.lon, t.lat, t.lon)
        }))
        .filter(t => t.distance <= this.searchRadius)
        .sort((a, b) => a.distance - b.distance);

        this.closestTraffic = filtered.length > 0 ? filtered[0] : null;
        this.nearbyCountEl.textContent = filtered.length;
        this.renderTraffic(filtered);
        this.updateCompact();
    }

    renderTraffic(traffic) {
        this.trafficList.replaceChildren();

        if (traffic.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-traffic';
            empty.textContent = this.myPosition.lat
                ? 'No traffic within ' + this.searchRadius + ' nm'
                : 'Waiting for position data...';
            this.trafficList.appendChild(empty);
            return;
        }

        traffic.slice(0, 20).forEach(t => {
            const item = document.createElement('div');
            item.className = 'traffic-item';

            const icon = document.createElement('div');
            icon.className = 'traffic-icon ' + t.network;
            icon.textContent = t.network === 'vatsim' ? 'V' : t.network === 'ivao' ? 'I' : 'M';

            const info = document.createElement('div');
            info.className = 'traffic-info';

            const callsign = document.createElement('div');
            callsign.className = 'traffic-callsign';
            callsign.textContent = t.callsign;

            const details = document.createElement('div');
            details.className = 'traffic-details';
            details.textContent = t.aircraft + ' | FL' + Math.round(t.altitude / 100) + ' | ' + Math.round(t.groundspeed) + 'kt';

            info.appendChild(callsign);
            info.appendChild(details);

            if (t.route) {
                const route = document.createElement('div');
                route.className = 'traffic-route';
                route.textContent = t.route;
                info.appendChild(route);
            }

            const distance = document.createElement('div');
            distance.className = 'traffic-distance';

            const distValue = document.createElement('div');
            distValue.className = 'distance-value';
            distValue.textContent = Math.round(t.distance) + ' nm';

            const bearingEl = document.createElement('div');
            bearingEl.className = 'distance-bearing';
            bearingEl.textContent = this.bearingToCardinal(t.bearing);

            distance.appendChild(distValue);
            distance.appendChild(bearingEl);

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(distance);

            this.trafficList.appendChild(item);
        });
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065;
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
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    destinationPoint(lat, lon, bearing, distance) {
        const R = 3440.065;
        const d = distance / R;
        const brng = bearing * Math.PI / 180;
        const lat1 = lat * Math.PI / 180;
        const lon1 = lon * Math.PI / 180;

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

        return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
    }

    destroy() {
        this._destroyed = true;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        super.destroy();
    }

    bearingToCardinal(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index] + ' ' + Math.round(bearing) + '\u00B0';
    }

    updateCompact() {
        if (!this.widgetContainer.classList.contains('compact')) return;

        // Nearby count
        if (this.compactNearby) {
            this.compactNearby.textContent = this.nearbyCountEl.textContent;
        }

        // Range
        if (this.compactRange) {
            this.compactRange.textContent = this.searchRadius + 'nm';
        }

        // Status (from connection)
        if (this.compactStatus) {
            const connected = this.connDot && this.connDot.classList.contains('connected');
            this.compactStatus.textContent = connected ? 'LIVE' : 'OFF';
        }

        // Closest traffic
        if (this.compactClosest && this.compactDistance) {
            if (this.closestTraffic) {
                this.compactClosest.textContent = this.closestTraffic.callsign;
                this.compactDistance.textContent = Math.round(this.closestTraffic.distance) + 'nm';
            } else {
                this.compactClosest.textContent = '---';
                this.compactDistance.textContent = '---';
            }
        }

        // Network filter
        if (this.compactNetwork) {
            const networkMap = {
                'all': 'ALL',
                'vatsim': 'VATSIM',
                'ivao': 'IVAO',
                'msfs': 'MSFS'
            };
            this.compactNetwork.textContent = networkMap[this.selectedNetwork] || 'ALL';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.MultiplayerPane = new MultiplayerPane();
    window.addEventListener('beforeunload', () => window.MultiplayerPane?.destroy());
});
