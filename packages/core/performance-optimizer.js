/**
 * SimWidget Performance Optimization Module
 * Version: v1.0.0
 * Last updated: 2026-01-06
 * 
 * Features:
 * - SimVar caching with smart invalidation
 * - Request throttling and batching
 * - Lazy widget loading
 * - Memory management
 * - Performance monitoring
 */

class PerformanceOptimizer {
    constructor() {
        // SimVar Cache
        this.simvarCache = new Map();
        this.simvarSubscriptions = new Map();
        
        // Request batching
        this.pendingRequests = [];
        this.batchTimer = null;
        this.batchDelay = 16; // ~60fps
        
        // Throttling
        this.throttleMap = new Map();
        
        // Performance metrics
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            batchedRequests: 0,
            throttledCalls: 0,
            avgResponseTime: 0,
            responseTimes: []
        };
        
        // Configuration
        this.config = {
            cacheEnabled: true,
            cacheTTL: {
                fast: 50,      // 50ms for rapidly changing (position, speed)
                medium: 200,   // 200ms for moderate (fuel, temps)
                slow: 1000,    // 1s for slow changing (payload, settings)
                static: 60000  // 1min for static (aircraft type)
            },
            batchingEnabled: true,
            maxBatchSize: 50,
            memoryLimit: 100 * 1024 * 1024, // 100MB
            enableMetrics: true
        };

        // SimVar update rates
        this.simvarRates = {
            // Fast (position, speed, attitude)
            'GPS POSITION LAT': 'fast',
            'GPS POSITION LON': 'fast',
            'AIRSPEED INDICATED': 'fast',
            'VERTICAL SPEED': 'fast',
            'HEADING INDICATOR': 'fast',
            'PLANE PITCH DEGREES': 'fast',
            'PLANE BANK DEGREES': 'fast',
            
            // Medium (engines, fuel flow)
            'ENG RPM:1': 'medium',
            'ENG RPM:2': 'medium',
            'FUEL TOTAL QUANTITY': 'medium',
            'ENG FUEL FLOW GPH:1': 'medium',
            
            // Slow (temps, pressures)
            'ENG OIL TEMPERATURE:1': 'slow',
            'ENG OIL PRESSURE:1': 'slow',
            'AMBIENT TEMPERATURE': 'slow',
            
            // Static (aircraft info)
            'TITLE': 'static',
            'ATC MODEL': 'static',
            'TOTAL WEIGHT': 'slow'
        };
    }

    // ========== SIMVAR CACHING ==========

    /**
     * Get SimVar with caching
     */
    async getSimvar(name, $api) {
        const now = Date.now();
        const cached = this.simvarCache.get(name);
        const rate = this.simvarRates[name] || 'medium';
        const ttl = this.config.cacheTTL[rate];

        // Check cache validity
        if (this.config.cacheEnabled && cached && (now - cached.timestamp) < ttl) {
            this.metrics.cacheHits++;
            return cached.value;
        }

        this.metrics.cacheMisses++;
        
        // Fetch fresh value
        const startTime = performance.now();
        const value = await $api.variables.get(name);
        this.recordResponseTime(performance.now() - startTime);

        // Update cache
        this.simvarCache.set(name, {
            value: value,
            timestamp: now
        });

        return value;
    }

    /**
     * Batch multiple SimVar requests
     */
    async getSimvarsBatched(names, $api) {
        if (!this.config.batchingEnabled) {
            const results = {};
            for (const name of names) {
                results[name] = await this.getSimvar(name, $api);
            }
            return results;
        }

        return new Promise((resolve) => {
            this.pendingRequests.push({
                names: names,
                $api: $api,
                resolve: resolve
            });

            if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelay);
            }
        });
    }

    async processBatch() {
        this.batchTimer = null;
        const requests = this.pendingRequests.splice(0, this.config.maxBatchSize);
        
        if (requests.length === 0) return;

        // Collect all unique SimVars needed
        const allNames = new Set();
        requests.forEach(req => req.names.forEach(n => allNames.add(n)));

        // Fetch all values
        const $api = requests[0].$api;
        const allValues = {};
        
        for (const name of allNames) {
            allValues[name] = await this.getSimvar(name, $api);
        }

        // Resolve each request with its subset
        requests.forEach(req => {
            const result = {};
            req.names.forEach(name => {
                result[name] = allValues[name];
            });
            req.resolve(result);
        });

        this.metrics.batchedRequests += requests.length;

        // Process remaining if any
        if (this.pendingRequests.length > 0) {
            this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelay);
        }
    }

    // ========== THROTTLING ==========

    /**
     * Throttle function calls
     */
    throttle(key, fn, delay) {
        const now = Date.now();
        const lastCall = this.throttleMap.get(key);

        if (lastCall && (now - lastCall) < delay) {
            this.metrics.throttledCalls++;
            return null;
        }

        this.throttleMap.set(key, now);
        return fn();
    }

    /**
     * Debounce function calls
     */
    debounce(key, fn, delay) {
        const existing = this.throttleMap.get(key);
        if (existing?.timer) {
            clearTimeout(existing.timer);
        }

        const timer = setTimeout(() => {
            fn();
            this.throttleMap.delete(key);
        }, delay);

        this.throttleMap.set(key, { timer });
    }

    // ========== LAZY LOADING ==========

    /**
     * Lazy load widget modules
     */
    async lazyLoadWidget(widgetId, basePath) {
        const cacheKey = `widget_${widgetId}`;
        
        // Check if already loaded
        if (window.loadedWidgets?.has(widgetId)) {
            return window.loadedWidgets.get(widgetId);
        }

        try {
            // Load manifest first
            const manifestResponse = await fetch(`${basePath}/${widgetId}/manifest.json`);
            const manifest = await manifestResponse.json();

            // Load JS
            const jsModule = await import(`${basePath}/${widgetId}/${manifest.files.js}`);

            // Load CSS
            if (manifest.files.css) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `${basePath}/${widgetId}/${manifest.files.css}`;
                document.head.appendChild(link);
            }

            // Cache loaded widget
            if (!window.loadedWidgets) window.loadedWidgets = new Map();
            window.loadedWidgets.set(widgetId, { manifest, module: jsModule });

            return { manifest, module: jsModule };
        } catch (err) {
            console.error(`[PerfOptimizer] Failed to load widget ${widgetId}:`, err);
            throw err;
        }
    }

    // ========== MEMORY MANAGEMENT ==========

    /**
     * Check memory usage and cleanup if needed
     */
    checkMemory() {
        if (!performance.memory) return; // Not available in all browsers

        const used = performance.memory.usedJSHeapSize;
        
        if (used > this.config.memoryLimit) {
            console.warn('[PerfOptimizer] Memory limit exceeded, running cleanup');
            this.cleanup();
        }
    }

    cleanup() {
        // Clear old cache entries
        const now = Date.now();
        const maxAge = 60000; // 1 minute

        for (const [key, entry] of this.simvarCache) {
            if (now - entry.timestamp > maxAge) {
                this.simvarCache.delete(key);
            }
        }

        // Clear throttle map
        this.throttleMap.clear();

        // Force garbage collection hint
        if (window.gc) window.gc();
    }

    // ========== PERFORMANCE MONITORING ==========

    recordResponseTime(ms) {
        if (!this.config.enableMetrics) return;

        this.metrics.responseTimes.push(ms);
        
        // Keep last 100 samples
        if (this.metrics.responseTimes.length > 100) {
            this.metrics.responseTimes.shift();
        }

        // Calculate average
        const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.avgResponseTime = sum / this.metrics.responseTimes.length;
    }

    getMetrics() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return {
            ...this.metrics,
            cacheHitRate: total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(1) + '%' : 'N/A',
            cacheSize: this.simvarCache.size,
            avgResponseTime: this.metrics.avgResponseTime.toFixed(2) + 'ms'
        };
    }

    resetMetrics() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            batchedRequests: 0,
            throttledCalls: 0,
            avgResponseTime: 0,
            responseTimes: []
        };
    }

    // ========== CONFIGURATION ==========

    configure(options) {
        Object.assign(this.config, options);
    }

    setSimvarRate(name, rate) {
        if (['fast', 'medium', 'slow', 'static'].includes(rate)) {
            this.simvarRates[name] = rate;
        }
    }
}

// ========== OPTIMIZED API WRAPPER ==========

class OptimizedAPI {
    constructor($api, optimizer) {
        this.$api = $api;
        this.optimizer = optimizer || new PerformanceOptimizer();
    }

    get variables() {
        return {
            get: async (name) => this.optimizer.getSimvar(name, this.$api),
            set: (name, value) => this.$api.variables.set(name, value),
            getBatched: async (names) => this.optimizer.getSimvarsBatched(names, this.$api)
        };
    }

    get datastore() {
        return this.$api.datastore;
    }

    // Forward other API methods
    get command() { return this.$api.command; }
    get event() { return this.$api.event; }
}

// ========== PERFORMANCE WIDGET ==========

class PerformanceMonitorWidget {
    constructor($api) {
        this.$api = $api;
        this.optimizer = new PerformanceOptimizer();
        this.visible = false;
    }

    html_created() {
        this.render();
        console.log('[PerfMonitor] Initialized');
    }

    loop_1hz() {
        if (this.visible) {
            this.updateDisplay();
        }
        this.optimizer.checkMemory();
    }

    render() {
        const container = document.getElementById('perf-monitor-container');
        if (!container) return;

        container.innerHTML = `
            <div class="perf-panel" id="perf-panel" style="display: none;">
                <div class="perf-header">
                    <span>Performance Monitor</span>
                    <button onclick="perfMonitor.toggle()">×</button>
                </div>
                <div class="perf-content">
                    <div class="perf-metric">
                        <label>Cache Hit Rate</label>
                        <span id="perf-cache-rate">--</span>
                    </div>
                    <div class="perf-metric">
                        <label>Cache Size</label>
                        <span id="perf-cache-size">--</span>
                    </div>
                    <div class="perf-metric">
                        <label>Avg Response</label>
                        <span id="perf-response">--</span>
                    </div>
                    <div class="perf-metric">
                        <label>Batched Requests</label>
                        <span id="perf-batched">--</span>
                    </div>
                    <div class="perf-metric">
                        <label>Throttled Calls</label>
                        <span id="perf-throttled">--</span>
                    </div>
                </div>
                <div class="perf-actions">
                    <button onclick="perfMonitor.resetMetrics()">Reset</button>
                    <button onclick="perfMonitor.cleanup()">Cleanup</button>
                </div>
            </div>
        `;
    }

    toggle() {
        this.visible = !this.visible;
        const panel = document.getElementById('perf-panel');
        if (panel) {
            panel.style.display = this.visible ? 'block' : 'none';
        }
    }

    updateDisplay() {
        const metrics = this.optimizer.getMetrics();
        
        this.setElement('perf-cache-rate', metrics.cacheHitRate);
        this.setElement('perf-cache-size', metrics.cacheSize);
        this.setElement('perf-response', metrics.avgResponseTime);
        this.setElement('perf-batched', metrics.batchedRequests);
        this.setElement('perf-throttled', metrics.throttledCalls);
    }

    setElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    resetMetrics() {
        this.optimizer.resetMetrics();
        this.updateDisplay();
    }

    cleanup() {
        this.optimizer.cleanup();
        this.updateDisplay();
    }
}

// Global instances
let perfOptimizer = null;
let perfMonitor = null;

// SimWidget hooks
function html_created($api) {
    perfOptimizer = new PerformanceOptimizer();
    perfMonitor = new PerformanceMonitorWidget($api);
    perfMonitor.optimizer = perfOptimizer;
    perfMonitor.html_created();
    
    // Expose globally for other widgets
    window.SimWidgetOptimizer = perfOptimizer;
    window.OptimizedAPI = OptimizedAPI;
}

function loop_1hz($api) {
    if (perfMonitor) perfMonitor.loop_1hz();
}

function exit($api) {
    if (perfOptimizer) perfOptimizer.cleanup();
}

// Export
if (typeof module !== 'undefined') {
    module.exports = {
        PerformanceOptimizer,
        OptimizedAPI,
        PerformanceMonitorWidget,
        html_created,
        loop_1hz,
        exit
    };
}
