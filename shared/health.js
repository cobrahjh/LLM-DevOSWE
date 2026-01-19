/**
 * Hive Health Check Utilities
 *
 * Provides standardized health response format and middleware
 * for all hive services.
 *
 * Usage:
 *   const { createHealthResponse, healthMiddleware } = require('../shared/health');
 *
 *   // Simple usage
 *   app.get('/api/health', (req, res) => {
 *       res.json(createHealthResponse('relay', '3.0.0'));
 *   });
 *
 *   // With custom metrics
 *   app.get('/api/health', (req, res) => {
 *       res.json(createHealthResponse('relay', '3.0.0', {
 *           queue: { pending: 5, completed: 100 }
 *       }));
 *   });
 *
 *   // Middleware (auto-adds /api/health)
 *   healthMiddleware(server, 'relay', '3.0.0', getMetricsFn);
 */

const os = require('os');

const startTime = Date.now();

/**
 * Create a standardized health response
 * @param {string} serviceName - Name of the service
 * @param {string} version - Service version
 * @param {Object} metrics - Optional custom metrics
 * @returns {Object} Standardized health response
 */
function createHealthResponse(serviceName, version, metrics = {}) {
    const uptimeMs = Date.now() - startTime;

    return {
        status: 'ok',
        service: serviceName,
        version: version,
        uptime: uptimeMs,
        uptimeHuman: formatUptime(uptimeMs),
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        },
        ...metrics
    };
}

/**
 * Create an error health response
 * @param {string} serviceName - Name of the service
 * @param {string} version - Service version
 * @param {string} error - Error message
 * @returns {Object} Error health response
 */
function createErrorResponse(serviceName, version, error) {
    return {
        status: 'error',
        service: serviceName,
        version: version,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        error: error
    };
}

/**
 * Format milliseconds into human readable uptime
 * @param {number} ms - Milliseconds
 * @returns {string} Human readable uptime
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Health check middleware for HTTP servers
 * Adds /api/health endpoint to an http server
 *
 * @param {Object} options - Configuration
 * @param {string} options.serviceName - Name of the service
 * @param {string} options.version - Service version
 * @param {Function} options.getMetrics - Optional function returning custom metrics
 * @returns {Function} Request handler
 */
function createHealthHandler(options) {
    const { serviceName, version, getMetrics } = options;

    return async (req, res) => {
        try {
            const metrics = getMetrics ? await getMetrics() : {};
            const response = createHealthResponse(serviceName, version, metrics);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (error) {
            const response = createErrorResponse(serviceName, version, error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        }
    };
}

/**
 * Check if a service is healthy by calling its health endpoint
 * @param {string} url - Health endpoint URL
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Health response or error
 */
async function checkHealth(url, timeout = 5000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return { healthy: true, ...data };
        } else {
            return { healthy: false, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        return {
            healthy: false,
            error: error.name === 'AbortError' ? 'timeout' : error.message
        };
    }
}

module.exports = {
    createHealthResponse,
    createErrorResponse,
    createHealthHandler,
    formatUptime,
    checkHealth
};
