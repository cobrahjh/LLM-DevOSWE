/**
 * Hive Error Handling - Standardized errors and error handling
 *
 * Usage:
 *   const { HiveError, NotFoundError, ValidationError, errorHandler } = require('../shared/errors');
 *
 *   // Throw typed errors
 *   throw new NotFoundError('Task not found', { taskId: 123 });
 *
 *   // Use error handler middleware (Express)
 *   app.use(errorHandler);
 */

/**
 * Base error class for all Hive errors
 */
class HiveError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert to JSON for API responses
     * @param {boolean} includeStack - Include stack trace (only in development)
     * @returns {Object} JSON representation
     */
    toJSON(includeStack = false) {
        const json = {
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                timestamp: this.timestamp
            }
        };

        if (Object.keys(this.details).length > 0) {
            json.error.details = this.details;
        }

        if (includeStack && this.stack) {
            json.error.stack = this.stack.split('\n').slice(0, 10);
        }

        return json;
    }
}

/**
 * Resource not found (404)
 */
class NotFoundError extends HiveError {
    constructor(message = 'Resource not found', details = {}) {
        super(message, 404, 'NOT_FOUND', details);
    }
}

/**
 * Validation error (400)
 */
class ValidationError extends HiveError {
    constructor(message = 'Validation failed', details = {}) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

/**
 * Authentication error (401)
 */
class AuthenticationError extends HiveError {
    constructor(message = 'Authentication required', details = {}) {
        super(message, 401, 'AUTHENTICATION_ERROR', details);
    }
}

/**
 * Authorization error (403)
 */
class AuthorizationError extends HiveError {
    constructor(message = 'Access denied', details = {}) {
        super(message, 403, 'AUTHORIZATION_ERROR', details);
    }
}

/**
 * Conflict error (409)
 */
class ConflictError extends HiveError {
    constructor(message = 'Resource conflict', details = {}) {
        super(message, 409, 'CONFLICT_ERROR', details);
    }
}

/**
 * Rate limit error (429)
 */
class RateLimitError extends HiveError {
    constructor(message = 'Rate limit exceeded', details = {}) {
        super(message, 429, 'RATE_LIMIT_ERROR', details);
    }
}

/**
 * Service unavailable (503)
 */
class ServiceUnavailableError extends HiveError {
    constructor(message = 'Service temporarily unavailable', details = {}) {
        super(message, 503, 'SERVICE_UNAVAILABLE', details);
    }
}

/**
 * Timeout error (504)
 */
class TimeoutError extends HiveError {
    constructor(message = 'Request timeout', details = {}) {
        super(message, 504, 'TIMEOUT_ERROR', details);
    }
}

/**
 * Express error handler middleware
 * @param {Object} options - Handler options
 * @param {Function} options.logger - Optional logger instance
 * @param {boolean} options.includeStack - Include stack in response (dev only)
 * @returns {Function} Express error handler
 */
function createErrorHandler(options = {}) {
    const { logger = null, includeStack = false } = options;

    return (err, req, res, _next) => {
        // Log the error
        if (logger) {
            logger.error(`${req.method} ${req.url} - ${err.message}`, {
                statusCode: err.statusCode || 500,
                code: err.code || 'INTERNAL_ERROR',
                details: err.details || {}
            });
        }

        // Handle HiveError instances
        if (err instanceof HiveError) {
            return res.status(err.statusCode).json(err.toJSON(includeStack));
        }

        // Handle standard errors
        const statusCode = err.statusCode || err.status || 500;
        const response = {
            error: {
                code: 'INTERNAL_ERROR',
                message: process.env.NODE_ENV === 'production'
                    ? 'An internal error occurred'
                    : err.message,
                statusCode,
                timestamp: new Date().toISOString()
            }
        };

        if (includeStack && err.stack) {
            response.error.stack = err.stack.split('\n').slice(0, 10);
        }

        return res.status(statusCode).json(response);
    };
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create error from HTTP response
 * @param {Object} response - HTTP response
 * @param {string} defaultMessage - Default error message
 * @returns {HiveError} Error instance
 */
function fromResponse(response, defaultMessage = 'Request failed') {
    const statusCode = response.status || response.statusCode || 500;
    const message = response.data?.message || response.statusText || defaultMessage;

    if (statusCode === 404) return new NotFoundError(message);
    if (statusCode === 400) return new ValidationError(message);
    if (statusCode === 401) return new AuthenticationError(message);
    if (statusCode === 403) return new AuthorizationError(message);
    if (statusCode === 409) return new ConflictError(message);
    if (statusCode === 429) return new RateLimitError(message);
    if (statusCode === 503) return new ServiceUnavailableError(message);
    if (statusCode === 504) return new TimeoutError(message);

    return new HiveError(message, statusCode);
}

module.exports = {
    HiveError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    createErrorHandler,
    asyncHandler,
    fromResponse
};
