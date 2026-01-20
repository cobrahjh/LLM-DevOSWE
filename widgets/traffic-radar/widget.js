/**
 * Traffic Radar Widget
 * SimWidget Engine v1.0.0
 */

class TrafficRadarWidget {
    constructor() {
        this.ws = null;
        this.canvas = null;
        this.ctx = null;
        this.range = 10; // NM
        this.traffic = [];
        this.init();
    }

    init() {
        this.canvas = document.getElementById('traffic-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.connect();
        this.setupControls();
        this.generateMockTraffic();
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
                if (msg.type === 'trafficData') {
                    this.traffic = msg.data;
                    this.updateList();
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    setupControls() {
        document.querySelectorAll('.tr-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tr-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.range = parseInt(btn.dataset.range);
                document.getElementById('radar-range').textContent = this.range + ' NM';
            });
        });
    }

    generateMockTraffic() {
        this.traffic = [
            { callsign: 'UAL123', dist: 3.2, bearing: 45, altDiff: 1500, threat: 'proximate' },
            { callsign: 'DAL456', dist: 5.8, bearing: 120, altDiff: -800, threat: 'proximate' },
            { callsign: 'AAL789', dist: 2.1, bearing: 280, altDiff: 200, threat: 'ta' },
            { callsign: 'SWA321', dist: 8.5, bearing: 190, altDiff: 3200, threat: 'proximate' }
        ];
        this.updateList();
    }

    updateList() {
        document.getElementById('traffic-count').textContent = this.traffic.length;

        const listEl = document.getElementById('traffic-list');
        let html = '';

        this.traffic.forEach(t => {
            const altSign = t.altDiff > 0 ? '+' : '';
            const altClass = t.altDiff > 0 ? 'above' : 'below';
            const icon = t.threat === 'ra' ? '■' : (t.threat === 'ta' ? '○' : '◇');

            html += `
                <div class="tr-item">
                    <span class="tr-item-icon ${t.threat}">${icon}</span>
                    <span class="tr-item-callsign">${t.callsign}</span>
                    <span class="tr-item-info">${t.dist.toFixed(1)}nm</span>
                    <span class="tr-item-alt ${altClass}">${altSign}${t.altDiff}ft</span>
                </div>
            `;
        });

        listEl.innerHTML = html || '<div class="tr-item" style="justify-content:center;color:var(--sw-text-dim)">No traffic</div>';
    }

    drawRadar() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(cx, cy) - 10;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 40, 0.2)';
        ctx.fillRect(0, 0, w, h);

        // Range rings
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
        ctx.lineWidth = 1;
        [0.33, 0.66, 1].forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Cross
        ctx.beginPath();
        ctx.moveTo(cx, cy - maxR);
        ctx.lineTo(cx, cy + maxR);
        ctx.moveTo(cx - maxR, cy);
        ctx.lineTo(cx + maxR, cy);
        ctx.stroke();

        // Draw traffic
        this.traffic.forEach(t => {
            if (t.dist > this.range) return;

            const scale = (t.dist / this.range) * maxR;
            const rad = ((t.bearing - 90) * Math.PI) / 180;
            const x = cx + Math.cos(rad) * scale;
            const y = cy + Math.sin(rad) * scale;

            // Threat color
            let color = 'rgba(180, 200, 220, 0.8)';
            if (t.threat === 'ta') color = 'rgba(255, 214, 0, 0.9)';
            if (t.threat === 'ra') color = 'rgba(255, 51, 102, 0.9)';

            // Draw target
            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            if (t.threat === 'ra') {
                // Red square
                ctx.fillRect(x - 5, y - 5, 10, 10);
            } else if (t.threat === 'ta') {
                // Yellow circle
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Diamond
                ctx.beginPath();
                ctx.moveTo(x, y - 5);
                ctx.lineTo(x + 5, y);
                ctx.lineTo(x, y + 5);
                ctx.lineTo(x - 5, y);
                ctx.closePath();
                ctx.stroke();
            }

            // Altitude tag
            ctx.fillStyle = color;
            ctx.font = '9px JetBrains Mono, monospace';
            const altText = t.altDiff > 0 ? '+' + Math.round(t.altDiff / 100) : Math.round(t.altDiff / 100);
            ctx.fillText(altText, x + 8, y + 3);
        });

        // Update traffic positions (mock movement)
        this.traffic.forEach(t => {
            t.bearing = (t.bearing + 0.2) % 360;
            t.dist += (Math.random() - 0.5) * 0.05;
            t.dist = Math.max(0.5, Math.min(this.range * 1.2, t.dist));
        });
    }

    startAnimation() {
        const animate = () => {
            this.drawRadar();
            requestAnimationFrame(animate);
        };
        animate();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.trafficWidget = new TrafficRadarWidget();
});
