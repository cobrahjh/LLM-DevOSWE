/**
 * Performance Monitor Widget - SimGlass
 * Tracks WebSocket latency, browser performance, errors, and system health
 * @version 1.0.0
 */

class PerformanceMonitor extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'performance-monitor',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // WebSocket metrics
        this.wsLatency = 0;
        this.wsMessageCount = 0;
        this.wsLastMessageTime = Date.now();
        this.wsReconnectCount = 0;
        this.wsLatencyHistory = [];

        // Browser metrics
        this.fps = 0;
        this.fpsFrames = [];
        this.fpsLastTime = performance.now();

        // Error tracking
        this.errorCount = 0;
        this.errorTimestamps = [];
        this.lastError = null;

        // System health
        this.healthStatus = {
            api: 'unknown',
            simconnect: 'unknown',
            camera: 'unknown'
        };

        // Event log
        this.events = [];
        this.maxEvents = 50;

        // Chart
        this.chartMaxPoints = 60;
        this.chartData = [];

        this.initUI();
        this.startMonitoring();
        this.addEvent('Performance monitor started', 'info');
    }

    initUI() {
        this.elements = {
            // WebSocket
            wsStatus: document.getElementById('ws-status'),
            wsLatency: document.getElementById('ws-latency'),
            wsRate: document.getElementById('ws-rate'),
            wsReconnects: document.getElementById('ws-reconnects'),

            // Browser
            browserFps: document.getElementById('browser-fps'),
            browserMemory: document.getElementById('browser-memory'),
            browserCpu: document.getElementById('browser-cpu'),
            browserDom: document.getElementById('browser-dom'),

            // Errors
            errorTotal: document.getElementById('error-total'),
            errorRecent: document.getElementById('error-recent'),
            errorRate: document.getElementById('error-rate'),
            errorLast: document.getElementById('error-last'),

            // Health
            healthApi: document.getElementById('health-api'),
            healthSimconnect: document.getElementById('health-simconnect'),
            healthCamera: document.getElementById('health-camera'),

            // Chart
            chart: document.getElementById('perf-chart'),

            // Events
            eventsLog: document.getElementById('events-log'),

            // Controls
            btnReset: document.getElementById('btn-reset')
        };

        this.chartCtx = this.elements.chart.getContext('2d');

        // Reset button
        this.elements.btnReset.addEventListener('click', () => this.resetStats());

        // Hook into global error handler
        this.setupErrorTracking();
    }

    // Lifecycle Hooks
    onConnect() {
        this.updateWSStatus('Connected', 'success');
        this.addEvent('WebSocket connected', 'success');
    }

    onDisconnect() {
        this.wsReconnectCount++;
        this.updateWSStatus('Disconnected', 'error');
        this.addEvent('WebSocket disconnected', 'warning');
        this.elements.wsReconnects.textContent = this.wsReconnectCount;
    }

    onMessage(msg) {
        // Track message rate
        this.wsMessageCount++;
        const now = Date.now();

        // Calculate latency (if server timestamp available)
        if (msg.timestamp) {
            this.wsLatency = now - msg.timestamp;
            this.wsLatencyHistory.push({
                time: now,
                latency: this.wsLatency
            });

            // Keep only last 60 seconds
            const cutoff = now - 60000;
            this.wsLatencyHistory = this.wsLatencyHistory.filter(h => h.time > cutoff);
        }
    }

    // Monitoring Functions
    startMonitoring() {
        // Update metrics every second
        this._metricsInterval = setInterval(() => {
            this.updateWebSocketMetrics();
            this.updateBrowserMetrics();
            this.updateErrorMetrics();
            this.updateChart();
        }, 1000);

        // FPS monitoring via RAF
        this.measureFPS();

        // Health checks every 10 seconds
        this._healthInterval = setInterval(() => {
            this.checkSystemHealth();
        }, 10000);

        // Initial health check
        this.checkSystemHealth();
    }

    measureFPS() {
        const now = performance.now();
        const delta = now - this.fpsLastTime;

        this.fpsFrames.push(delta);

        // Calculate FPS from last second of frames
        if (this.fpsFrames.length > 60) {
            this.fpsFrames.shift();
        }

        const avgDelta = this.fpsFrames.reduce((a, b) => a + b, 0) / this.fpsFrames.length;
        this.fps = Math.round(1000 / avgDelta);

        this.fpsLastTime = now;
        this._rafId = requestAnimationFrame(() => this.measureFPS());
    }

    updateWebSocketMetrics() {
        // Status
        const wsState = this.ws ? this.ws.readyState : WebSocket.CLOSED;
        const statusMap = {
            [WebSocket.CONNECTING]: ['Connecting...', 'warning'],
            [WebSocket.OPEN]: ['Connected', 'success'],
            [WebSocket.CLOSING]: ['Closing...', 'warning'],
            [WebSocket.CLOSED]: ['Disconnected', 'error']
        };

        const [status, statusClass] = statusMap[wsState] || ['Unknown', 'error'];
        this.updateWSStatus(status, statusClass);

        // Latency
        if (this.wsLatency > 0) {
            const latencyClass = this.wsLatency < 50 ? 'success' : this.wsLatency < 100 ? 'warning' : 'error';
            this.elements.wsLatency.textContent = this.wsLatency + ' ms';
            this.elements.wsLatency.className = 'metric-value ' + latencyClass;
        }

        // Message rate
        const rate = this.wsMessageCount;
        this.elements.wsRate.textContent = rate;
        this.wsMessageCount = 0; // Reset counter
    }

    updateWSStatus(text, className) {
        this.elements.wsStatus.textContent = text;
        this.elements.wsStatus.className = 'metric-value ' + className;
    }

    updateBrowserMetrics() {
        // FPS
        const fpsClass = this.fps >= 55 ? 'success' : this.fps >= 30 ? 'warning' : 'error';
        this.elements.browserFps.textContent = this.fps;
        this.elements.browserFps.className = 'metric-value ' + fpsClass;

        // Memory (if available)
        if (performance.memory) {
            const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
            const totalMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
            const memoryPct = (memoryMB / totalMB) * 100;
            const memoryClass = memoryPct < 70 ? 'success' : memoryPct < 85 ? 'warning' : 'error';

            this.elements.browserMemory.textContent = memoryMB + ' / ' + totalMB + ' MB';
            this.elements.browserMemory.className = 'metric-value ' + memoryClass;
        } else {
            this.elements.browserMemory.textContent = 'N/A';
        }

        // CPU time (from performance API)
        if (performance.now) {
            const cpuTime = Math.round(performance.now() / 1000);
            this.elements.browserCpu.textContent = cpuTime + ' s';
        }

        // DOM nodes
        const domNodes = document.getElementsByTagName('*').length;
        this.elements.browserDom.textContent = domNodes.toLocaleString();
    }

    updateErrorMetrics() {
        // Total errors
        this.elements.errorTotal.textContent = this.errorCount;

        // Recent errors (last hour)
        const hourAgo = Date.now() - 3600000;
        const recentErrors = this.errorTimestamps.filter(t => t > hourAgo).length;
        this.elements.errorRecent.textContent = recentErrors;

        // Error rate (errors per minute)
        const minuteAgo = Date.now() - 60000;
        const errorsLastMinute = this.errorTimestamps.filter(t => t > minuteAgo).length;
        const errorRate = errorsLastMinute > 0 ? errorsLastMinute + '/min' : '0';
        const rateClass = errorsLastMinute === 0 ? 'success' : errorsLastMinute < 5 ? 'warning' : 'error';
        this.elements.errorRate.textContent = errorRate;
        this.elements.errorRate.className = 'metric-value ' + rateClass;

        // Last error
        if (this.lastError) {
            const errorText = this.lastError.message || this.lastError.toString();
            this.elements.errorLast.textContent = errorText.substring(0, 40);
            this.elements.errorLast.title = errorText;
        }
    }

    async checkSystemHealth() {
        // Check API server
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                this.updateHealthStatus('api', 'healthy', 'Online');
            } else {
                this.updateHealthStatus('api', 'degraded', 'Error ' + res.status);
            }
        } catch (e) {
            this.updateHealthStatus('api', 'down', 'Offline');
        }

        // Check SimConnect (via status endpoint)
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                if (data.simConnected) {
                    this.updateHealthStatus('simconnect', 'healthy', 'Connected');
                } else {
                    this.updateHealthStatus('simconnect', 'degraded', 'Mock Mode');
                }
            }
        } catch (e) {
            this.updateHealthStatus('simconnect', 'down', 'Unknown');
        }

        // Check Camera service
        try {
            const res = await fetch('/api/camera/status');
            if (res.ok) {
                this.updateHealthStatus('camera', 'healthy', 'Available');
            } else {
                this.updateHealthStatus('camera', 'degraded', 'Limited');
            }
        } catch (e) {
            this.updateHealthStatus('camera', 'down', 'Unavailable');
        }
    }

    updateHealthStatus(service, status, text) {
        const element = this.elements['health' + service.charAt(0).toUpperCase() + service.slice(1)];
        if (!element) return;

        const statusDot = element.querySelector('.status-dot');
        const statusText = element.querySelector('.status-text');

        statusDot.className = 'status-dot status-' + status;
        statusText.textContent = text;

        // Track status changes
        if (this.healthStatus[service] !== status) {
            this.addEvent(service + ' status: ' + text, status === 'healthy' ? 'success' : status === 'down' ? 'error' : 'warning');
            this.healthStatus[service] = status;
        }
    }

    updateChart() {
        const canvas = this.elements.chart;
        const ctx = this.chartCtx;
        const w = canvas.width;
        const h = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, w, h);

        if (this.wsLatencyHistory.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for data...', w / 2, h / 2);
            return;
        }

        // Draw grid
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Find max latency for scaling
        const maxLatency = Math.max(...this.wsLatencyHistory.map(h => h.latency), 100);
        const now = Date.now();
        const timeWindow = 60000; // 60 seconds

        // Draw latency line
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();

        this.wsLatencyHistory.forEach((point, i) => {
            const age = now - point.time;
            const x = w - (age / timeWindow) * w;
            const y = h - (point.latency / maxLatency) * h;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw labels
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0 ms', 5, h - 5);
        ctx.fillText(Math.round(maxLatency) + ' ms', 5, 12);
    }

    setupErrorTracking() {
        // Global error handler
        window.addEventListener('error', (e) => {
            this.trackError(e.error || e.message);
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.trackError(e.reason);
        });

        // Hook into telemetry if available
        if (window.telemetry && telemetry.captureError) {
            const originalCapture = telemetry.captureError.bind(telemetry);
            telemetry.captureError = (error, context) => {
                this.trackError(error, context);
                return originalCapture(error, context);
            };
        }
    }

    trackError(error, context) {
        this.errorCount++;
        this.errorTimestamps.push(Date.now());
        this.lastError = error;

        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        const widgetName = context?.widget || 'unknown';

        this.addEvent('Error in ' + widgetName + ': ' + errorMsg, 'error');

        // Keep only last hour of timestamps
        const hourAgo = Date.now() - 3600000;
        this.errorTimestamps = this.errorTimestamps.filter(t => t > hourAgo);
    }

    addEvent(message, type = 'info') {
        const event = {
            time: new Date(),
            message,
            type
        };

        this.events.unshift(event);

        // Keep max events
        if (this.events.length > this.maxEvents) {
            this.events.pop();
        }

        this.renderEvents();
    }

    renderEvents() {
        const container = this.elements.eventsLog;
        container.replaceChildren();

        if (this.events.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'event-item dim';
            empty.textContent = 'No events yet';
            container.appendChild(empty);
            return;
        }

        // Show last 10 events
        this.events.slice(0, 10).forEach(event => {
            const item = document.createElement('div');
            item.className = 'event-item event-' + event.type;

            const time = document.createElement('span');
            time.className = 'event-time';
            const timeStr = event.time.toLocaleTimeString();
            time.textContent = timeStr;

            const message = document.createElement('span');
            message.className = 'event-message';
            message.textContent = event.message;

            item.appendChild(time);
            item.appendChild(message);
            container.appendChild(item);
        });
    }

    resetStats() {
        if (!confirm('Reset all performance statistics?')) return;

        this.wsMessageCount = 0;
        this.wsReconnectCount = 0;
        this.wsLatencyHistory = [];
        this.errorCount = 0;
        this.errorTimestamps = [];
        this.lastError = null;
        this.events = [];
        this.fpsFrames = [];

        this.elements.wsReconnects.textContent = '0';
        this.elements.errorTotal.textContent = '0';
        this.elements.errorRecent.textContent = '0';
        this.elements.errorLast.textContent = 'None';

        this.addEvent('Statistics reset', 'info');
        this.renderEvents();
    }

    destroy() {
        // Clear intervals
        if (this._metricsInterval) {
            clearInterval(this._metricsInterval);
            this._metricsInterval = null;
        }

        if (this._healthInterval) {
            clearInterval(this._healthInterval);
            this._healthInterval = null;
        }

        // Cancel RAF
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        this.addEvent('Performance monitor stopped', 'warning');

        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.performanceMonitor = new PerformanceMonitor();
    window.addEventListener('beforeunload', () =>
        window.performanceMonitor?.destroy()
    );
});
