/**
 * Jest Configuration
 *
 * Run tests: npm test
 * Watch mode: npm run test:watch
 */

module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '<rootDir>/tests/unit/**/*.test.js',
        '<rootDir>/tests/integration/**/*.test.js'
    ],
    collectCoverageFrom: [
        'Admin/**/*.js',
        'shared/**/*.js',
        'scripts/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['./tests/setup.js'],
    modulePathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/packages/.*/node_modules/',
        '<rootDir>/Admin/hive-universal-install/',
        '<rootDir>/Admin/morpu-install-package/'
    ]
};
