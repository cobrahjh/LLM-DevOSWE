/**
 * Tests for shared/logger.js
 */

const createLogger = require('../../shared/logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('createLogger', () => {
    test('should create a logger with all methods', () => {
        const logger = createLogger('test-service');

        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.exception).toBe('function');
        expect(typeof logger.child).toBe('function');
        expect(typeof logger.close).toBe('function');
    });

    test('should create child logger with context', () => {
        const logger = createLogger('parent');
        const child = logger.child('request-123');

        expect(typeof child.info).toBe('function');
        expect(typeof child.error).toBe('function');
    });
});

describe('logging output', () => {
    let consoleSpy;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    test('should log info messages', () => {
        const logger = createLogger('test');
        logger.info('Test message');

        expect(consoleSpy).toHaveBeenCalled();
        const output = consoleSpy.mock.calls[0][0];
        expect(output).toContain('INFO');
        expect(output).toContain('test');
        expect(output).toContain('Test message');
    });

    test('should include data in log output', () => {
        const logger = createLogger('test');
        logger.info('User login', { userId: 123, ip: '192.168.1.1' });

        expect(consoleSpy).toHaveBeenCalled();
        const output = consoleSpy.mock.calls[0][0];
        expect(output).toContain('userId');
        expect(output).toContain('123');
    });
});

describe('log levels', () => {
    let consoleSpy;
    const originalEnv = process.env.LOG_LEVEL;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        if (originalEnv === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = originalEnv;
        }
    });

    test('should respect LOG_LEVEL=error', () => {
        process.env.LOG_LEVEL = 'error';
        const logger = createLogger('test');

        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warn message');

        // None of these should be logged when level is error
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should log error when LOG_LEVEL=error', () => {
        process.env.LOG_LEVEL = 'error';
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        const logger = createLogger('test');
        logger.error('Error message');

        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe('file logging', () => {
    const testLogDir = path.join(os.tmpdir(), 'hive-logger-test');
    const testLogFile = path.join(testLogDir, 'test.log');

    beforeEach(() => {
        // Clean up test directory
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true });
        }
    });

    test('should create log file and write to it', () => {
        const logger = createLogger('test', { logFile: testLogFile });
        logger.info('Test file logging');
        logger.close();

        // Give it a moment to flush
        expect(fs.existsSync(testLogFile)).toBe(true);
        const content = fs.readFileSync(testLogFile, 'utf-8');
        expect(content).toContain('Test file logging');
        expect(content).toContain('INFO');
    });

    test('should create directory if it does not exist', () => {
        const nestedLogFile = path.join(testLogDir, 'nested', 'deep', 'test.log');
        const logger = createLogger('test', { logFile: nestedLogFile });
        logger.info('Nested directory test');
        logger.close();

        expect(fs.existsSync(nestedLogFile)).toBe(true);
    });
});

describe('exception logging', () => {
    let errorSpy;

    beforeEach(() => {
        errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    test('should log exception with message and stack', () => {
        const logger = createLogger('test');
        const error = new Error('Test error');
        logger.exception('Something went wrong', error);

        expect(errorSpy).toHaveBeenCalled();
        const output = errorSpy.mock.calls[0][0];
        expect(output).toContain('Something went wrong');
        expect(output).toContain('Test error');
    });
});
