/**
 * Hive Validation - Request validation middleware and utilities
 *
 * Usage:
 *   const { validate, schemas } = require('../shared/validation');
 *
 *   // Define schema
 *   const taskSchema = {
 *       task: { type: 'string', required: true, minLength: 1 },
 *       priority: { type: 'number', min: 1, max: 10, default: 5 }
 *   };
 *
 *   // Use as middleware
 *   app.post('/api/tasks', validate(taskSchema), handler);
 */

const { ValidationError } = require('./errors');

/**
 * Validate a value against a field schema
 * @param {*} value - Value to validate
 * @param {Object} schema - Field schema
 * @param {string} fieldName - Name of the field
 * @returns {Object} { valid: boolean, value: any, error?: string }
 */
function validateField(value, schema, fieldName) {
    // Handle default values
    if (value === undefined || value === null) {
        if (schema.default !== undefined) {
            return { valid: true, value: schema.default };
        }
        if (schema.required) {
            return { valid: false, error: `${fieldName} is required` };
        }
        return { valid: true, value: undefined };
    }

    // Type validation
    if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (schema.type === 'array' && !Array.isArray(value)) {
            return { valid: false, error: `${fieldName} must be an array` };
        } else if (schema.type !== 'array' && actualType !== schema.type) {
            return { valid: false, error: `${fieldName} must be a ${schema.type}` };
        }
    }

    // String validations
    if (schema.type === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            return { valid: false, error: `${fieldName} must be at least ${schema.minLength} characters` };
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            return { valid: false, error: `${fieldName} must be at most ${schema.maxLength} characters` };
        }
        if (schema.pattern && !schema.pattern.test(value)) {
            return { valid: false, error: `${fieldName} has invalid format` };
        }
        if (schema.enum && !schema.enum.includes(value)) {
            return { valid: false, error: `${fieldName} must be one of: ${schema.enum.join(', ')}` };
        }
    }

    // Number validations
    if (schema.type === 'number') {
        if (schema.min !== undefined && value < schema.min) {
            return { valid: false, error: `${fieldName} must be at least ${schema.min}` };
        }
        if (schema.max !== undefined && value > schema.max) {
            return { valid: false, error: `${fieldName} must be at most ${schema.max}` };
        }
        if (schema.integer && !Number.isInteger(value)) {
            return { valid: false, error: `${fieldName} must be an integer` };
        }
    }

    // Array validations
    if (schema.type === 'array') {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            return { valid: false, error: `${fieldName} must have at least ${schema.minItems} items` };
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            return { valid: false, error: `${fieldName} must have at most ${schema.maxItems} items` };
        }
        if (schema.items) {
            for (let i = 0; i < value.length; i++) {
                const itemResult = validateField(value[i], schema.items, `${fieldName}[${i}]`);
                if (!itemResult.valid) {
                    return itemResult;
                }
            }
        }
    }

    // Custom validator
    if (schema.validate && typeof schema.validate === 'function') {
        const customResult = schema.validate(value);
        if (customResult !== true) {
            return { valid: false, error: customResult || `${fieldName} is invalid` };
        }
    }

    return { valid: true, value };
}

/**
 * Validate an object against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} { valid: boolean, data: Object, errors: string[] }
 */
function validateObject(data, schema) {
    const errors = [];
    const validatedData = {};

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const result = validateField(data[fieldName], fieldSchema, fieldName);

        if (!result.valid) {
            errors.push(result.error);
        } else if (result.value !== undefined) {
            validatedData[fieldName] = result.value;
        }
    }

    return {
        valid: errors.length === 0,
        data: validatedData,
        errors
    };
}

/**
 * Create validation middleware for Express
 * @param {Object} schema - Validation schema
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const data = req[source] || {};
        const result = validateObject(data, schema);

        if (!result.valid) {
            throw new ValidationError('Validation failed', {
                errors: result.errors
            });
        }

        // Replace with validated/defaulted data
        req[source] = result.data;
        next();
    };
}

/**
 * Create combined validator for multiple sources
 * @param {Object} schemas - Object with 'body', 'query', 'params' keys
 * @returns {Function} Express middleware
 */
function validateAll(schemas) {
    return (req, res, next) => {
        const allErrors = [];

        for (const [source, schema] of Object.entries(schemas)) {
            const data = req[source] || {};
            const result = validateObject(data, schema);

            if (!result.valid) {
                allErrors.push(...result.errors.map(e => `${source}.${e}`));
            } else {
                req[source] = result.data;
            }
        }

        if (allErrors.length > 0) {
            throw new ValidationError('Validation failed', {
                errors: allErrors
            });
        }

        next();
    };
}

// Common schema helpers
const schemas = {
    /**
     * Required string field
     * @param {Object} options - Additional options
     */
    string: (options = {}) => ({
        type: 'string',
        required: true,
        ...options
    }),

    /**
     * Optional string field
     * @param {Object} options - Additional options
     */
    optionalString: (options = {}) => ({
        type: 'string',
        required: false,
        ...options
    }),

    /**
     * Required number field
     * @param {Object} options - Additional options
     */
    number: (options = {}) => ({
        type: 'number',
        required: true,
        ...options
    }),

    /**
     * Optional number field
     * @param {Object} options - Additional options
     */
    optionalNumber: (options = {}) => ({
        type: 'number',
        required: false,
        ...options
    }),

    /**
     * Required boolean field
     */
    boolean: (options = {}) => ({
        type: 'boolean',
        required: true,
        ...options
    }),

    /**
     * Required array field
     * @param {Object} itemSchema - Schema for array items
     * @param {Object} options - Additional options
     */
    array: (itemSchema = {}, options = {}) => ({
        type: 'array',
        required: true,
        items: itemSchema,
        ...options
    }),

    /**
     * ID field (positive integer)
     */
    id: () => ({
        type: 'number',
        required: true,
        integer: true,
        min: 1
    }),

    /**
     * Email field
     */
    email: () => ({
        type: 'string',
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }),

    /**
     * Enum field
     * @param {Array} values - Allowed values
     */
    enum: (values) => ({
        type: 'string',
        required: true,
        enum: values
    }),

    /**
     * UUID field
     */
    uuid: () => ({
        type: 'string',
        required: true,
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    })
};

module.exports = {
    validate,
    validateAll,
    validateField,
    validateObject,
    schemas
};
