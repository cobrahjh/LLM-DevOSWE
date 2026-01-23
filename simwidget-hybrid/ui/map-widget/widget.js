/**
 * Map Widget - SimWidget
 * Live aircraft position map using Leaflet
 */

class MapWidget {
    constructor() {
        this.map = null;
        this.marker = null;
        this.trackLine = null;
        this.trackPoints = [];
        this.followMode = true;
        this.ws = null;
        this.position = { lat: 47.4502, lng: -122.3088 }; // Default: Seattle
        this.heading = 0;
        this.altitude = 0;
        this.speed = 0;

        this.initMap();
        this.initControls();
        this.connectWebSocket();
    }

    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map', {
            center: [this.position.lat, this.position.lng],
            zoom: 10,
            zoomControl: true,
            attributionControl: true
        });

        // Dark map tiles (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Create aircraft marker
        const aircraftIcon = L.divIcon({
            className: 'aircraft-marker',
            html: '✈️',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        this.marker = L.marker([this.position.lat, this.position.lng], {
            icon: aircraftIcon,
            rotationAngle: 0
        }).addTo(this.map);

        // Track line
        this.trackLine = L.polyline([], {
            color: '#667eea',
            weight: 2,
            opacity: 0.7
        }).addTo(this.map);
    }

    initControls() {
        // Center button
        document.getElementById('btn-center').addEventListener('click', () => {
            this.centerOnAircraft();
        });

        // Follow toggle
        const followBtn = document.getElementById('btn-follow');
        followBtn.classList.toggle('active', this.followMode);
        followBtn.addEventListener('click', () => {
            this.followMode = !this.followMode;
            followBtn.classList.toggle('active', this.followMode);
            if (this.followMode) {
                this.centerOnAircraft();
            }
        });

        // Disable follow on manual pan
        this.map.on('dragstart', () => {
            this.followMode = false;
            document.getElementById('btn-follow').classList.remove('active');
        });
    }

    connectWebSocket() {
        const wsUrl = 'ws://' + window.location.host;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[Map] WebSocket connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'simvar' || data.type === 'position') {
                        this.updatePosition(data);
                    }
                } catch (e) {}
            };

            this.ws.onclose = () => {
                console.log('[Map] WebSocket closed, reconnecting...');
                setTimeout(() => this.connectWebSocket(), 3000);
            };

            this.ws.onerror = () => {
                // Will reconnect on close
            };

        } catch (e) {
            console.error('[Map] WebSocket error:', e);
            setTimeout(() => this.connectWebSocket(), 5000);
        }

        // Also poll the REST API as fallback
        this.pollPosition();
    }

    async pollPosition() {
        try {
            const response = await fetch('/api/simvars');
            if (response.ok) {
                const data = await response.json();
                this.updatePosition(data);
            }
        } catch (e) {}

        // Poll every 2 seconds
        setTimeout(() => this.pollPosition(), 2000);
    }

    updatePosition(data) {
        // Extract position data
        const lat = data.PLANE_LATITUDE || data.latitude || data.lat;
        const lng = data.PLANE_LONGITUDE || data.longitude || data.lng || data.lon;
        const heading = data.PLANE_HEADING_DEGREES_TRUE || data.heading || 0;
        const altitude = data.PLANE_ALTITUDE || data.altitude || 0;
        const speed = data.AIRSPEED_INDICATED || data.GROUND_VELOCITY || data.speed || 0;

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            this.position = { lat, lng };
            this.heading = heading;
            this.altitude = altitude;
            this.speed = speed;

            // Update marker
            this.marker.setLatLng([lat, lng]);

            // Rotate marker (using CSS transform)
            const markerEl = this.marker.getElement();
            if (markerEl) {
                markerEl.style.transform += ' rotate(' + heading + 'deg)';
                markerEl.style.transformOrigin = 'center center';
            }

            // Add to track
            this.trackPoints.push([lat, lng]);
            if (this.trackPoints.length > 500) {
                this.trackPoints.shift();
            }
            this.trackLine.setLatLngs(this.trackPoints);

            // Follow aircraft
            if (this.followMode) {
                this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
            }

            // Update info display
            this.updateInfoDisplay();
        }
    }

    updateInfoDisplay() {
        const posEl = document.getElementById('info-position');
        const altEl = document.getElementById('info-altitude');
        const hdgEl = document.getElementById('info-heading');
        const spdEl = document.getElementById('info-speed');

        posEl.textContent = this.formatCoord(this.position.lat, 'lat') + ' ' +
                           this.formatCoord(this.position.lng, 'lng');
        altEl.textContent = Math.round(this.altitude).toLocaleString() + ' ft';
        hdgEl.textContent = Math.round(this.heading) + '°';
        spdEl.textContent = Math.round(this.speed) + ' kt';
    }

    formatCoord(value, type) {
        const abs = Math.abs(value);
        const deg = Math.floor(abs);
        const min = ((abs - deg) * 60).toFixed(2);
        const dir = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
        return deg + '°' + min + "'" + dir;
    }

    centerOnAircraft() {
        this.map.setView([this.position.lat, this.position.lng], this.map.getZoom(), {
            animate: true,
            duration: 0.5
        });
    }

    clearTrack() {
        this.trackPoints = [];
        this.trackLine.setLatLngs([]);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.mapWidget = new MapWidget();
});
