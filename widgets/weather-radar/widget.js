/**
 * Weather Radar Widget
 * SimWidget Engine v1.0.0
 */

class WeatherRadarWidget {
    constructor() {
        this.ws = null;
        this.canvas = null;
        this.ctx = null;
        this.mode = 'radar';
        this.weather = [];
        this.init();
    }

    init() {
        this.canvas = document.getElementById('radar-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupModeToggle();
        this.connect();
        this.generateMockWeather();
        this.startAnimation();
    }

    setupModeToggle() {
        document.querySelectorAll('.wx-mode').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.wx-mode').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
            });
        });
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            document.getElementById('conn').classList.add('connected');
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    generateMockWeather() {
        this.weather = [];
        // Generate random weather cells
        for (let i = 0; i < 8; i++) {
            this.weather.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height * 0.7,
                radius: 15 + Math.random() * 30,
                intensity: Math.random(), // 0-1
                dx: (Math.random() - 0.5) * 0.5,
                dy: (Math.random() - 0.5) * 0.3
            });
        }
    }

    getWeatherColor(intensity) {
        if (intensity < 0.25) return 'rgba(0, 255, 136, 0.6)';
        if (intensity < 0.5) return 'rgba(255, 214, 0, 0.6)';
        if (intensity < 0.75) return 'rgba(255, 136, 0, 0.7)';
        return 'rgba(255, 51, 102, 0.8)';
    }

    drawRadar() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 40, 0.3)';
        ctx.fillRect(0, 0, w, h);

        // Draw weather cells
        this.weather.forEach(cell => {
            // Update position
            cell.x += cell.dx;
            cell.y += cell.dy;

            // Wrap around
            if (cell.x < -cell.radius) cell.x = w + cell.radius;
            if (cell.x > w + cell.radius) cell.x = -cell.radius;
            if (cell.y < -cell.radius) cell.y = h * 0.7 + cell.radius;
            if (cell.y > h * 0.7 + cell.radius) cell.y = -cell.radius;

            // Draw gradient cell
            const gradient = ctx.createRadialGradient(
                cell.x, cell.y, 0,
                cell.x, cell.y, cell.radius
            );
            gradient.addColorStop(0, this.getWeatherColor(cell.intensity));
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Sweep line
        const sweep = (Date.now() / 50) % 360;
        const sweepRad = (sweep * Math.PI) / 180;
        ctx.save();
        ctx.translate(w / 2, h);
        ctx.rotate(-sweepRad - Math.PI / 2);
        const sweepGradient = ctx.createLinearGradient(0, 0, 0, -h);
        sweepGradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
        sweepGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = sweepGradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, h, -0.1, 0.1);
        ctx.fill();
        ctx.restore();
    }

    drawWind() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 40, 0.3)';
        ctx.fillRect(0, 0, w, h);

        // Draw wind arrows
        const windDir = 310; // degrees
        const windSpd = 15;
        const arrowSize = 8;
        const spacing = 30;

        ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.lineWidth = 1;

        for (let x = spacing; x < w; x += spacing) {
            for (let y = spacing; y < h - 20; y += spacing) {
                const offset = (Date.now() / 100 + x + y) % spacing;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(((windDir - 90) * Math.PI) / 180);

                ctx.beginPath();
                ctx.moveTo(-arrowSize, 0);
                ctx.lineTo(arrowSize, 0);
                ctx.lineTo(arrowSize - 3, -3);
                ctx.moveTo(arrowSize, 0);
                ctx.lineTo(arrowSize - 3, 3);
                ctx.stroke();

                ctx.restore();
            }
        }

        // Wind barb at center
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(w / 2, h - 30);
        ctx.rotate(((windDir - 90) * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(20, 0);
        ctx.lineTo(15, -6);
        ctx.moveTo(20, 0);
        ctx.lineTo(15, 6);
        ctx.stroke();
        ctx.restore();
    }

    startAnimation() {
        const animate = () => {
            if (this.mode === 'radar') {
                this.drawRadar();
            } else {
                this.drawWind();
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.weatherWidget = new WeatherRadarWidget();
});
