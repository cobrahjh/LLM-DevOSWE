/**
 * Usage Metrics Tracker v1.0.0
 *
 * Tracks service usage metrics for determining active vs abandoned services.
 *
 * Usage:
 *   const metrics = require('../shared/usage-metrics');
 *   metrics.init('ServiceName');
 *
 *   // Track requests
 *   app.use(metrics.middleware());
 *
 *   // Get stats
 *   const stats = metrics.getStats();
 */

class UsageMetrics {
    constructor() {
        this.serviceName = 'unknown';
        this.startTime = Date.now();
        this.requestCount = 0;
        this.lastActivity = null;
        this.endpointStats = new Map();
        this.errorCount = 0;
        this.activeConnections = 0;
    }

    /**
     * Initialize metrics for a service
     * @param {string} serviceName - Name of the service
     */
    init(serviceName) {
        this.serviceName = serviceName;
        this.startTime = Date.now();
        console.log(`[UsageMetrics] Initialized for ${serviceName}`);
    }

    /**
     * Express middleware to track all requests
     * @returns {Function} Express middleware
     */
    middleware() {
        return (req, res, next) => {
            this.trackRequest(req.method, req.path);
            next();
        };
    }

    /**
     * Track a request to a specific endpoint
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     */
    trackRequest(method, path) {
        this.requestCount++;
        this.lastActivity = Date.now();

        const endpoint = `${method} ${path}`;
        const stats = this.endpointStats.get(endpoint) || { count: 0, lastHit: null };
        stats.count++;
        stats.lastHit = this.lastActivity;
        this.endpointStats.set(endpoint, stats);
    }

    /**
     * Track an error
     */
    trackError() {
        this.errorCount++;
    }

    /**
     * Track active connection change
     * @param {number} delta - Change in connection count (+1 or -1)
     */
    trackConnection(delta) {
        this.activeConnections = Math.max(0, this.activeConnections + delta);
    }

    /**
     * Get uptime in seconds
     * @returns {number} Uptime in seconds
     */
    getUptime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    /**
     * Get time since last activity in seconds
     * @returns {number|null} Seconds since last activity, or null if no activity
     */
    getIdleTime() {
        if (!this.lastActivity) return null;
        return Math.floor((Date.now() - this.lastActivity) / 1000);
    }

    /**
     * Get all statistics
     * @returns {object} Complete stats object
     */
    getStats() {
        const topEndpoints = Array.from(this.endpointStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([endpoint, stats]) => ({
                endpoint,
                count: stats.count,
                lastHit: stats.lastHit
            }));

        return {
            service: this.serviceName,
            uptime: this.getUptime(),
            uptimeFormatted: this.formatUptime(this.getUptime()),
            startTime: this.startTime,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            activeConnections: this.activeConnections,
            lastActivity: this.lastActivity,
            idleTime: this.getIdleTime(),
            idleTimeFormatted: this.lastActivity ? this.formatUptime(this.getIdleTime()) : 'No activity yet',
            totalEndpoints: this.endpointStats.size,
            topEndpoints,
            isActive: this.requestCount > 0,
            isIdle: this.getIdleTime() > 300 // Idle if no activity for 5 minutes
        };
    }

    /**
     * Format uptime/idle time into human-readable string
     * @param {number} seconds - Seconds to format
     * @returns {string} Formatted time (e.g., "2h 15m 30s")
     */
    formatUptime(seconds) {
        if (seconds === null) return 'N/A';

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Get a summary suitable for health endpoint
     * @returns {object} Summary stats
     */
    getSummary() {
        return {
            uptime: this.getUptime(),
            requests: this.requestCount,
            lastActivity: this.lastActivity,
            isActive: this.requestCount > 0
        };
    }

    /**
     * Reset all metrics (use with caution)
     */
    reset() {
        this.requestCount = 0;
        this.lastActivity = null;
        this.endpointStats.clear();
        this.errorCount = 0;
        console.log(`[UsageMetrics] Metrics reset for ${this.serviceName}`);
    }
}

// Singleton instance
const metrics = new UsageMetrics();

module.exports = metrics;
