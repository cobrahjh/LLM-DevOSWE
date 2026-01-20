/**
 * Moving Map Widget
 * SimWidget Engine v1.0.0
 */

class MovingMapWidget {
    constructor() {
        this.ws = null;
        this.canvas = null;
        this.ctx = null;
        this.range = 25; // NM
        this.mode = 'north'; // north, track, hdg
        this.aircraft = {
            lat: 47.4502,
            lon: -122.3088,
            hdg: 270,
            track: 268,
            gs: 250,
            alt: 10000
        };
        this.waypoints = [];
        this.init();
    }

    init() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.connect();
        this.setupControls();
        this.generateMockWaypoints();
        this.startAnimation();
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            document.getElementById('conn').classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'positionData') {
                    this.updatePosition(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    setupControls() {
        // Range buttons
        document.querySelectorAll('.mm-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mm-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.range = parseInt(btn.dataset.range);
            });
        });

        // Mode buttons
        document.querySelectorAll('.mm-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mm-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
            });
        });
    }

    generateMockWaypoints() {
        this.waypoints = [
            { id: 'KSEA', lat: 47.4502, lon: -122.3088, type: 'airport' },
            { id: 'SUMMA', lat: 47.45, lon: -122.1, type: 'fix' },
            { id: 'JAWBN', lat: 47.5, lon: -121.9, type: 'fix' },
            { id: 'CHINS', lat: 47.55, lon: -121.7, type: 'fix' },
            { id: 'KPAE', lat: 47.9063, lon: -122.2817, type: 'airport' }
        ];
    }

    updatePosition(data) {
        if (data.lat !== undefined) this.aircraft.lat = data.lat;
        if (data.lon !== undefined) this.aircraft.lon = data.lon;
        if (data.heading !== undefined) this.aircraft.hdg = data.heading;
        if (data.track !== undefined) this.aircraft.track = data.track;
        if (data.groundSpeed !== undefined) this.aircraft.gs = data.groundSpeed;
        if (data.altitude !== undefined) this.aircraft.alt = data.altitude;
    }

    drawMap() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Get rotation angle based on mode
        let rotation = 0;
        if (this.mode === 'track') rotation = -this.aircraft.track;
        else if (this.mode === 'hdg') rotation = -this.aircraft.hdg;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 40, 0.3)';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation * Math.PI / 180);

        // Draw range rings
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
        ctx.lineWidth = 1;
        const maxR = Math.min(cx, cy) - 20;
        [0.5, 1].forEach(r => {
            ctx.beginPath();
            ctx.arc(0, 0, maxR * r, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw compass ticks
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        for (let i = 0; i < 360; i += 30) {
            const rad = (i - 90) * Math.PI / 180;
            const inner = i % 90 === 0 ? maxR - 15 : maxR - 8;
            ctx.beginPath();
            ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
            ctx.lineTo(Math.cos(rad) * maxR, Math.sin(rad) * maxR);
            ctx.stroke();
        }

        // Draw waypoints
        this.waypoints.forEach(wp => {
            const pos = this.latLonToXY(wp.lat, wp.lon, maxR);
            if (Math.abs(pos.x) < w/2 && Math.abs(pos.y) < h/2) {
                if (wp.type === 'airport') {
                    ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.strokeStyle = 'rgba(0, 212, 255, 0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y - 4);
                    ctx.lineTo(pos.x + 3.5, pos.y + 2);
                    ctx.lineTo(pos.x - 3.5, pos.y + 2);
                    ctx.closePath();
                    ctx.stroke();
                }

                // Label
                ctx.fillStyle = 'rgba(0, 212, 255, 0.8)';
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillText(wp.id, pos.x + 6, pos.y + 3);
            }
        });

        ctx.restore();

        // Draw aircraft (always centered, rotated based on mode)
        ctx.save();
        ctx.translate(cx, cy);

        let acftRotation = 0;
        if (this.mode === 'north') acftRotation = this.aircraft.hdg - 90;

        ctx.rotate(acftRotation * Math.PI / 180);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Update info
        this.updateInfo();

        // Mock movement
        this.aircraft.lon += 0.0002;
        this.aircraft.lat += (Math.random() - 0.5) * 0.0001;
        this.aircraft.hdg = (this.aircraft.hdg + (Math.random() - 0.5) * 0.5 + 360) % 360;
        this.aircraft.track = (this.aircraft.track + (Math.random() - 0.5) * 0.3 + 360) % 360;
    }

    latLonToXY(lat, lon, maxR) {
        const nmPerDegLat = 60;
        const nmPerDegLon = 60 * Math.cos(this.aircraft.lat * Math.PI / 180);

        const dLat = lat - this.aircraft.lat;
        const dLon = lon - this.aircraft.lon;

        const nmNorth = dLat * nmPerDegLat;
        const nmEast = dLon * nmPerDegLon;

        const scale = maxR / this.range;

        return {
            x: nmEast * scale,
            y: -nmNorth * scale
        };
    }

    updateInfo() {
        document.getElementById('ground-speed').textContent = Math.round(this.aircraft.gs);
        document.getElementById('track').textContent = Math.round(this.aircraft.track).toString().padStart(3, '0');
        document.getElementById('altitude').textContent = Math.round(this.aircraft.alt).toLocaleString();
        document.getElementById('compass-hdg').textContent = Math.round(this.aircraft.hdg).toString().padStart(3, '0');
    }

    startAnimation() {
        const animate = () => {
            this.drawMap();
            requestAnimationFrame(animate);
        };
        animate();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.movingMapWidget = new MovingMapWidget();
});
