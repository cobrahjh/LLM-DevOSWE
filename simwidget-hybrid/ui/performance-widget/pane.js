/**
 * Performance pane - SimGlass
 * Displays FPS, GPU, CPU usage and frame timing
 */

class PerformancePane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'performance-glass',
            widgetVersion: '1.1.0',
            autoConnect: true
        });

        this.fpsHistory = [];
        this.targetFPS = 60;
        this._rafId = null;
        this._fetchInterval = null;

        this.initElements();
        this.initEvents();
        this.startLocalMonitoring();
    }

    initElements() {
        this.fpsEl = document.getElementById('fps');
        this.fpsBar = document.getElementById('fps-bar');
        this.gpuEl = document.getElementById('gpu');
        this.gpuBar = document.getElementById('gpu-bar');
        this.cpuEl = document.getElementById('cpu');
        this.cpuBar = document.getElementById('cpu-bar');
        this.ramEl = document.getElementById('ram');
        this.ramBar = document.getElementById('ram-bar');

        this.frameTimeEl = document.getElementById('frame-time');
        this.mainThreadEl = document.getElementById('main-thread');
        this.renderThreadEl = document.getElementById('render-thread');

        this.drawCallsEl = document.getElementById('draw-calls');
        this.objectsEl = document.getElementById('objects');
        this.vramEl = document.getElementById('vram');

        this.refreshBtn = document.getElementById('btn-refresh');

        this.fpsCard = this.fpsEl.closest('.perf-card');
        this.gpuCard = this.gpuEl.closest('.perf-card');
        this.cpuCard = this.cpuEl.closest('.perf-card');
    }

    initEvents() {
        this.refreshBtn.addEventListener('click', () => this.refresh());
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        if (msg.type === 'performance') {
            this.updatePerformance(msg.data);
        }
    }

    startLocalMonitoring() {
        // Monitor browser FPS using requestAnimationFrame
        let lastTime = performance.now();
        let frameCount = 0;

        const measureFPS = () => {
            if (this._destroyed) return;

            frameCount++;
            const now = performance.now();
            const elapsed = now - lastTime;

            if (elapsed >= 1000) {
                const fps = Math.round((frameCount * 1000) / elapsed);
                this.updateFPS(fps);
                frameCount = 0;
                lastTime = now;
            }

            this._rafId = requestAnimationFrame(measureFPS);
        };

        this._rafId = requestAnimationFrame(measureFPS);

        // Fetch server performance data periodically
        this.fetchPerformance();
        this._fetchInterval = setInterval(() => this.fetchPerformance(), 2000);
    }

    async fetchPerformance() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                const data = await response.json();
                this.updateServerStats(data);
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'fetchPerformance',
                    glass: 'performance-glass',
                    url: '/api/health'
                });
            }
        }
    }

    updateFPS(fps) {
        this.fpsEl.textContent = fps;
        const percent = Math.min(100, (fps / this.targetFPS) * 100);
        this.fpsBar.style.width = percent + '%';

        // Update card state
        this.fpsCard.classList.remove('warning', 'critical');
        if (fps < 20) {
            this.fpsCard.classList.add('critical');
        } else if (fps < 30) {
            this.fpsCard.classList.add('warning');
        }

        // Calculate frame time
        const frameTime = (1000 / fps).toFixed(1);
        this.frameTimeEl.textContent = frameTime + ' ms';

        // Estimate thread times (simplified)
        this.mainThreadEl.textContent = (frameTime * 0.6).toFixed(1) + ' ms';
        this.renderThreadEl.textContent = (frameTime * 0.4).toFixed(1) + ' ms';
    }

    updateServerStats(data) {
        // Memory from server
        if (data.memory) {
            const heapUsed = parseInt(data.memory.heapUsed) || 0;
            const heapTotal = parseInt(data.memory.heapTotal) || 1;
            const rss = parseInt(data.memory.rss) || 0;

            this.ramEl.textContent = rss + ' MB';
            const ramPercent = Math.min(100, (heapUsed / heapTotal) * 100);
            this.ramBar.style.width = ramPercent + '%';
        }

        // WebSocket clients as proxy for "objects"
        if (data.websocket) {
            this.objectsEl.textContent = data.websocket.clients || 0;
        }
    }

    updatePerformance(data) {
        // From sim performance data if available
        if (data.fps) {
            this.updateFPS(data.fps);
        }

        if (data.gpuUsage !== undefined) {
            this.gpuEl.textContent = data.gpuUsage + '%';
            this.gpuBar.style.width = data.gpuUsage + '%';

            this.gpuCard.classList.remove('warning', 'critical');
            if (data.gpuUsage > 95) {
                this.gpuCard.classList.add('critical');
            } else if (data.gpuUsage > 80) {
                this.gpuCard.classList.add('warning');
            }
        }

        if (data.cpuUsage !== undefined) {
            this.cpuEl.textContent = data.cpuUsage + '%';
            this.cpuBar.style.width = data.cpuUsage + '%';

            this.cpuCard.classList.remove('warning', 'critical');
            if (data.cpuUsage > 95) {
                this.cpuCard.classList.add('critical');
            } else if (data.cpuUsage > 80) {
                this.cpuCard.classList.add('warning');
            }
        }

        if (data.vram !== undefined) {
            this.vramEl.textContent = (data.vram / 1024).toFixed(1) + ' GB';
        }

        if (data.drawCalls !== undefined) {
            this.drawCallsEl.textContent = data.drawCalls.toLocaleString();
        }
    }

    refresh() {
        this.fetchPerformance();
    }

    destroy() {
        // Additional cleanup beyond SimGlassBase
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        if (this._fetchInterval) {
            clearInterval(this._fetchInterval);
            this._fetchInterval = null;
        }

        // Call parent's destroy() for WebSocket cleanup
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.PerformancePane = new PerformancePane();
    window.addEventListener('beforeunload', () => window.PerformancePane?.destroy());
});
