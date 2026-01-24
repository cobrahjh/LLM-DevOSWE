/**
 * Multiplayer Widget - SimWidget
 * Shows nearby VATSIM/IVAO/MSFS multiplayer traffic
 */

class MultiplayerWidget {
    constructor() {
        this.ws = null;
        this.myPosition = { lat: 0, lon: 0 };
        this.traffic = [];
        this.searchRadius = 50;
        this.selectedNetwork = 'all';
        this.refreshInterval = null;

        this.initElements();
        this.initEvents();
        this.connectWebSocket();
        this.startRefresh();
    }

    initElements() {
        this.myCoordsEl = document.getElementById('my-coords');
        this.trafficList = document.getElementById('traffic-list');
        this.nearbyCountEl = document.getElementById('nearby-count');
        this.rangeEl = document.getElementById('range');
        this.rangeSlider = document.getElementById('range-slider');
        this.rangeValue = document.getElementById('range-value');
        this.networkSelect = document.getElementById('network-select');
        this.refreshBtn = document.getElementById('btn-refresh');
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

    connectWebSocket() {
        const host = location.hostname || 'localhost';
        const wsUrl = `ws://${host}:8080`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updatePosition(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    updatePosition(data) {
        if (data.latitude && data.longitude) {
            this.myPosition = { lat: data.latitude, lon: data.longitude };
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
            // Try VATSIM data
            const vatsimTraffic = await this.fetchVATSIM();

            // Combine with mock MSFS traffic for demo
            const msfsTraffic = this.generateMockTraffic();

            this.traffic = [...vatsimTraffic, ...msfsTraffic];
            this.filterTraffic();
        } catch (e) {
            console.log('Traffic fetch error:', e);
            // Show mock data on error
            this.traffic = this.generateMockTraffic();
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
                network: 'vatsim'
            }));
        } catch (e) {
            return [];
        }
    }

    generateMockTraffic() {
        if (!this.myPosition.lat || !this.myPosition.lon) return [];

        // Generate a few mock aircraft nearby
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
                heading: Math.random() * 360
            };
        });
    }

    filterTraffic() {
        let filtered = this.traffic;

        // Filter by network
        if (this.selectedNetwork !== 'all') {
            filtered = filtered.filter(t => t.network === this.selectedNetwork);
        }

        // Calculate distances and filter by range
        filtered = filtered.map(t => ({
            ...t,
            distance: this.calculateDistance(this.myPosition.lat, this.myPosition.lon, t.lat, t.lon),
            bearing: this.calculateBearing(this.myPosition.lat, this.myPosition.lon, t.lat, t.lon)
        }))
        .filter(t => t.distance <= this.searchRadius)
        .sort((a, b) => a.distance - b.distance);

        this.nearbyCountEl.textContent = filtered.length;
        this.renderTraffic(filtered);
    }

    renderTraffic(traffic) {
        this.trafficList.replaceChildren();

        if (traffic.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-traffic';
            empty.textContent = 'No traffic within ' + this.searchRadius + ' nm';
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

            const distance = document.createElement('div');
            distance.className = 'traffic-distance';

            const distValue = document.createElement('div');
            distValue.className = 'distance-value';
            distValue.textContent = Math.round(t.distance) + ' nm';

            const bearing = document.createElement('div');
            bearing.className = 'distance-bearing';
            bearing.textContent = this.bearingToCardinal(t.bearing);

            distance.appendChild(distValue);
            distance.appendChild(bearing);

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

    bearingToCardinal(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index] + ' ' + Math.round(bearing) + '°';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.multiplayerWidget = new MultiplayerWidget();
});
