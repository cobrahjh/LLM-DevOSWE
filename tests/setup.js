/**
 * Jest Test Setup
 *
 * Global setup for all tests
 */

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise during tests
global.console = {
    ...console,
    // Uncomment to silence logs during tests:
    // log: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    error: console.error,
    debug: jest.fn()
};

// Global test utilities
global.testUtils = {
    /**
     * Wait for a condition to be true
     * @param {Function} condition - Function that returns boolean
     * @param {number} timeout - Max wait time in ms
     * @param {number} interval - Check interval in ms
     */
    async waitFor(condition, timeout = 5000, interval = 100) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await condition()) return true;
            await new Promise(r => setTimeout(r, interval));
        }
        throw new Error('Condition not met within timeout');
    },

    /**
     * Create a mock HTTP response
     */
    mockResponse(statusCode = 200, body = {}) {
        return {
            statusCode,
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' }
        };
    }
};
