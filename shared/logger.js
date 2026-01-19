/**
 * Hive Logger - Standardized logging for all services
 *
 * Usage:
 *   const logger = require('../shared/logger')('relay');
 *   logger.info('Server started', { port: 8600 });
 *   logger.error('Connection failed', { error: err.message });
 *
 * Log Levels: debug < info < warn < error
 * Set LOG_LEVEL env var to control output (default: info)
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const COLORS = {
    debug: '\x1b[36m',  // Cyan
    info: '\x1b[32m',   // Green
    warn: '\x1b[33m',   // Yellow
    error: '\x1b[31m',  // Red
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bright: '\x1b[1m'
};

/**
 * Get current log level from environment
 * @returns {number} Log level threshold
 */
function getLogLevel() {
    const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
    return LOG_LEVELS[level] ?? LOG_LEVELS.info;
}

/**
 * Format timestamp for logs
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format log message with optional data
 * @param {string} level - Log level
 * @param {string} service - Service name
 * @param {string} message - Log message
 * @param {Object} data - Optional structured data
 * @param {boolean} useColors - Whether to use ANSI colors
 * @returns {string} Formatted log line
 */
function formatLog(level, service, message, data, useColors = true) {
    const timestamp = getTimestamp();
    const levelUpper = level.toUpperCase().padEnd(5);

    if (useColors && process.stdout.isTTY) {
        const color = COLORS[level] || COLORS.reset;
        const serviceStr = `${COLORS.dim}[${service}]${COLORS.reset}`;
        const levelStr = `${color}${levelUpper}${COLORS.reset}`;
        const timeStr = `${COLORS.dim}${timestamp}${COLORS.reset}`;

        let output = `${timeStr} ${levelStr} ${serviceStr} ${message}`;
        if (data && Object.keys(data).length > 0) {
            output += ` ${COLORS.dim}${JSON.stringify(data)}${COLORS.reset}`;
        }
        return output;
    } else {
        // Plain format for file output or non-TTY
        let output = `${timestamp} ${levelUpper} [${service}] ${message}`;
        if (data && Object.keys(data).length > 0) {
            output += ` ${JSON.stringify(data)}`;
        }
        return output;
    }
}

/**
 * Create a logger instance for a service
 * @param {string} serviceName - Name of the service
 * @param {Object} options - Logger options
 * @param {string} options.logFile - Optional file path to write logs
 * @param {number} options.maxFileSize - Max log file size in bytes (default: 5MB)
 * @param {number} options.maxBackups - Max number of backup files (default: 3)
 * @returns {Object} Logger instance
 */
function createLogger(serviceName, options = {}) {
    const {
        logFile = null,
        maxFileSize = 5 * 1024 * 1024,  // 5MB
        maxBackups = 3
    } = options;

    /**
     * Rotate log file if needed
     */
    function rotateIfNeeded() {
        if (!logFile) return;

        try {
            if (!fs.existsSync(logFile)) return;

            const stats = fs.statSync(logFile);
            if (stats.size < maxFileSize) return;

            // Rotate existing backups
            for (let i = maxBackups - 1; i >= 1; i--) {
                const oldFile = `${logFile}.${i}`;
                const newFile = `${logFile}.${i + 1}`;
                if (fs.existsSync(oldFile)) {
                    if (i === maxBackups - 1) {
                        fs.unlinkSync(oldFile);
                    } else {
                        fs.renameSync(oldFile, newFile);
                    }
                }
            }

            // Move current to .1
            fs.renameSync(logFile, `${logFile}.1`);
        } catch (err) {
            console.error(`Log rotation failed: ${err.message}`);
        }
    }

    /**
     * Write to log file (synchronous for reliability)
     * @param {string} line - Log line to write
     */
    function writeToFile(line) {
        if (!logFile) return;

        try {
            rotateIfNeeded();

            const dir = path.dirname(logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.appendFileSync(logFile, line + '\n');
        } catch (err) {
            console.error(`Failed to write log: ${err.message}`);
        }
    }

    /**
     * Log a message at the specified level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Optional structured data
     */
    function log(level, message, data = {}) {
        const currentLevel = getLogLevel();
        const messageLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;

        if (messageLevel < currentLevel) return;

        // Console output (with colors)
        const consoleLine = formatLog(level, serviceName, message, data, true);

        if (level === 'error') {
            console.error(consoleLine);
        } else if (level === 'warn') {
            console.warn(consoleLine);
        } else {
            console.log(consoleLine);
        }

        // File output (without colors)
        if (logFile) {
            const fileLine = formatLog(level, serviceName, message, data, false);
            writeToFile(fileLine);
        }
    }

    return {
        debug: (message, data) => log('debug', message, data),
        info: (message, data) => log('info', message, data),
        warn: (message, data) => log('warn', message, data),
        error: (message, data) => log('error', message, data),

        /**
         * Log an error object with stack trace
         * @param {string} message - Error context message
         * @param {Error} error - Error object
         */
        exception: (message, error) => {
            log('error', message, {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 5).join('\n')
            });
        },

        /**
         * Create a child logger with additional context
         * @param {string} context - Additional context (e.g., request ID)
         * @returns {Object} Child logger
         */
        child: (context) => {
            return createLogger(`${serviceName}:${context}`, options);
        },

        /**
         * Close logger (no-op for sync writes, kept for API compatibility)
         */
        close: () => {
            // No-op - using sync writes for reliability
        }
    };
}

module.exports = createLogger;
