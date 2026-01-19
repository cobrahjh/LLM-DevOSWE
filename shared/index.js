/**
 * Hive Shared Modules - Central export
 *
 * Usage:
 *   const { SERVICES, createLogger, ValidationError, validate } = require('../shared');
 */

const constants = require('./constants');
const health = require('./health');
const errors = require('./errors');
const validation = require('./validation');
const createLogger = require('./logger');

module.exports = {
    // Constants
    ...constants,

    // Health
    ...health,

    // Errors
    ...errors,

    // Validation
    ...validation,

    // Logger (function, not spread)
    createLogger
};
