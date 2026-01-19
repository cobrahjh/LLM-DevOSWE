/**
 * Tests for shared/validation.js
 */

const {
    validate,
    validateField,
    validateObject,
    schemas
} = require('../../shared/validation');
const { ValidationError } = require('../../shared/errors');

describe('validateField', () => {
    test('should validate required field', () => {
        const result = validateField(undefined, { required: true }, 'name');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('required');
    });

    test('should apply default value', () => {
        const result = validateField(undefined, { default: 'test' }, 'name');
        expect(result.valid).toBe(true);
        expect(result.value).toBe('test');
    });

    test('should validate string type', () => {
        const result = validateField(123, { type: 'string' }, 'name');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('string');
    });

    test('should validate minLength', () => {
        const result = validateField('ab', { type: 'string', minLength: 3 }, 'name');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 3');
    });

    test('should validate maxLength', () => {
        const result = validateField('abcdef', { type: 'string', maxLength: 5 }, 'name');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at most 5');
    });

    test('should validate pattern', () => {
        const result = validateField('invalid', { type: 'string', pattern: /^[0-9]+$/ }, 'code');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid format');
    });

    test('should validate enum', () => {
        const result = validateField('invalid', { type: 'string', enum: ['a', 'b', 'c'] }, 'choice');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('one of');
    });

    test('should validate number min', () => {
        const result = validateField(5, { type: 'number', min: 10 }, 'value');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 10');
    });

    test('should validate number max', () => {
        const result = validateField(15, { type: 'number', max: 10 }, 'value');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at most 10');
    });

    test('should validate integer', () => {
        const result = validateField(3.14, { type: 'number', integer: true }, 'count');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('integer');
    });

    test('should validate array type', () => {
        const result = validateField('not-array', { type: 'array' }, 'items');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('array');
    });

    test('should validate array minItems', () => {
        const result = validateField([1], { type: 'array', minItems: 2 }, 'items');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 2');
    });

    test('should validate array items', () => {
        const result = validateField([1, 'invalid', 3], {
            type: 'array',
            items: { type: 'number' }
        }, 'values');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('values[1]');
    });

    test('should validate with custom validator', () => {
        const result = validateField('test', {
            type: 'string',
            validate: (v) => v.startsWith('pre_') || 'must start with pre_'
        }, 'code');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('pre_');
    });

    test('should pass valid values', () => {
        const result = validateField('valid', {
            type: 'string',
            required: true,
            minLength: 3,
            maxLength: 10
        }, 'name');
        expect(result.valid).toBe(true);
        expect(result.value).toBe('valid');
    });
});

describe('validateObject', () => {
    const schema = {
        name: { type: 'string', required: true, minLength: 1 },
        age: { type: 'number', min: 0, default: 0 },
        email: { type: 'string', pattern: /^.+@.+$/ }
    };

    test('should validate complete object', () => {
        const result = validateObject({
            name: 'John',
            age: 25,
            email: 'john@example.com'
        }, schema);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should apply defaults', () => {
        const result = validateObject({ name: 'John' }, schema);

        expect(result.valid).toBe(true);
        expect(result.data.age).toBe(0);
    });

    test('should collect multiple errors', () => {
        const result = validateObject({
            name: '',
            age: -5,
            email: 'invalid'
        }, schema);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
    });
});

describe('validate middleware', () => {
    const schema = {
        task: { type: 'string', required: true },
        priority: { type: 'number', default: 5 }
    };

    test('should call next on valid request', () => {
        const req = { body: { task: 'Test task' } };
        const res = {};
        const next = jest.fn();

        validate(schema)(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.priority).toBe(5); // Default applied
    });

    test('should throw ValidationError on invalid request', () => {
        const req = { body: {} };
        const res = {};
        const next = jest.fn();

        expect(() => validate(schema)(req, res, next)).toThrow(ValidationError);
    });
});

describe('schemas helpers', () => {
    test('string() creates required string schema', () => {
        const schema = schemas.string();
        expect(schema.type).toBe('string');
        expect(schema.required).toBe(true);
    });

    test('optionalString() creates optional string schema', () => {
        const schema = schemas.optionalString();
        expect(schema.type).toBe('string');
        expect(schema.required).toBe(false);
    });

    test('id() creates positive integer schema', () => {
        const schema = schemas.id();
        expect(schema.type).toBe('number');
        expect(schema.integer).toBe(true);
        expect(schema.min).toBe(1);
    });

    test('email() validates email format', () => {
        const schema = schemas.email();
        const validResult = validateField('test@example.com', schema, 'email');
        const invalidResult = validateField('invalid', schema, 'email');

        expect(validResult.valid).toBe(true);
        expect(invalidResult.valid).toBe(false);
    });

    test('enum() restricts to allowed values', () => {
        const schema = schemas.enum(['pending', 'active', 'done']);
        const validResult = validateField('pending', schema, 'status');
        const invalidResult = validateField('unknown', schema, 'status');

        expect(validResult.valid).toBe(true);
        expect(invalidResult.valid).toBe(false);
    });

    test('uuid() validates UUID format', () => {
        const schema = schemas.uuid();
        const validResult = validateField('550e8400-e29b-41d4-a716-446655440000', schema, 'id');
        const invalidResult = validateField('not-a-uuid', schema, 'id');

        expect(validResult.valid).toBe(true);
        expect(invalidResult.valid).toBe(false);
    });
});
