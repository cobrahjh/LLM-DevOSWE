/**
 * Tests for shared/errors.js
 */

const {
    HiveError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    asyncHandler,
    fromResponse
} = require('../../shared/errors');

describe('HiveError', () => {
    test('should create error with default values', () => {
        const error = new HiveError('Test error');

        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.name).toBe('HiveError');
        expect(error.timestamp).toBeDefined();
    });

    test('should create error with custom values', () => {
        const error = new HiveError('Custom error', 400, 'CUSTOM_CODE', { field: 'test' });

        expect(error.message).toBe('Custom error');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('CUSTOM_CODE');
        expect(error.details.field).toBe('test');
    });

    test('should convert to JSON', () => {
        const error = new HiveError('Test', 400, 'TEST', { id: 123 });
        const json = error.toJSON();

        expect(json.error.code).toBe('TEST');
        expect(json.error.message).toBe('Test');
        expect(json.error.statusCode).toBe(400);
        expect(json.error.details.id).toBe(123);
        expect(json.error.stack).toBeUndefined();
    });

    test('should include stack when requested', () => {
        const error = new HiveError('Test');
        const json = error.toJSON(true);

        expect(json.error.stack).toBeDefined();
        expect(Array.isArray(json.error.stack)).toBe(true);
    });
});

describe('Error subclasses', () => {
    test('NotFoundError should have 404 status', () => {
        const error = new NotFoundError('Task not found');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
    });

    test('ValidationError should have 400 status', () => {
        const error = new ValidationError('Invalid input');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
    });

    test('AuthenticationError should have 401 status', () => {
        const error = new AuthenticationError();
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('AuthorizationError should have 403 status', () => {
        const error = new AuthorizationError();
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('ConflictError should have 409 status', () => {
        const error = new ConflictError();
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT_ERROR');
    });

    test('RateLimitError should have 429 status', () => {
        const error = new RateLimitError();
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('RATE_LIMIT_ERROR');
    });

    test('ServiceUnavailableError should have 503 status', () => {
        const error = new ServiceUnavailableError();
        expect(error.statusCode).toBe(503);
        expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    test('TimeoutError should have 504 status', () => {
        const error = new TimeoutError();
        expect(error.statusCode).toBe(504);
        expect(error.code).toBe('TIMEOUT_ERROR');
    });
});

describe('asyncHandler', () => {
    test('should call next with error on rejection', async () => {
        const error = new Error('Async error');
        const handler = asyncHandler(async () => {
            throw error;
        });

        const next = jest.fn();
        await handler({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    test('should not call next on success', async () => {
        const handler = asyncHandler(async (req, res) => {
            res.send('ok');
        });

        const next = jest.fn();
        const res = { send: jest.fn() };
        await handler({}, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.send).toHaveBeenCalledWith('ok');
    });
});

describe('fromResponse', () => {
    test('should create NotFoundError for 404', () => {
        const error = fromResponse({ status: 404, statusText: 'Not Found' });
        expect(error).toBeInstanceOf(NotFoundError);
    });

    test('should create ValidationError for 400', () => {
        const error = fromResponse({ status: 400 });
        expect(error).toBeInstanceOf(ValidationError);
    });

    test('should create AuthenticationError for 401', () => {
        const error = fromResponse({ status: 401 });
        expect(error).toBeInstanceOf(AuthenticationError);
    });

    test('should create AuthorizationError for 403', () => {
        const error = fromResponse({ status: 403 });
        expect(error).toBeInstanceOf(AuthorizationError);
    });

    test('should create HiveError for unknown status', () => {
        const error = fromResponse({ status: 418, statusText: 'I am a teapot' });
        expect(error).toBeInstanceOf(HiveError);
        expect(error.statusCode).toBe(418);
    });

    test('should use message from response data', () => {
        const error = fromResponse({ status: 400, data: { message: 'Custom message' } });
        expect(error.message).toBe('Custom message');
    });
});
