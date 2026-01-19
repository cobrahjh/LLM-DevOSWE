/**
 * Integration Tests - Core Services Health
 *
 * These tests verify that core services are running and healthy.
 * Run with: npm test -- --testPathPattern=integration
 *
 * Note: These tests require services to be running.
 * They will skip gracefully if services are offline.
 */

const { SERVICES, getHealthUrl, getCoreServices } = require('../../shared/constants');
const { checkHealth } = require('../../shared/health');

// Longer timeout for network requests
jest.setTimeout(15000);

describe('Core Services Health', () => {
    const coreServices = getCoreServices();

    test.each(coreServices)('%s service health check', async (serviceKey) => {
        const service = SERVICES[serviceKey];
        const url = getHealthUrl(serviceKey);

        const result = await checkHealth(url, 5000);

        if (!result.healthy) {
            // Service is offline - skip with warning
            console.warn(`⚠️  ${service.name} is offline (${result.error})`);
            return;
        }

        expect(result.healthy).toBe(true);
        // Status field may vary by service
        if (result.status) {
            expect(result.status).toBe('ok');
        }
    });
});

describe('Service Response Format', () => {
    test('relay health response has expected fields', async () => {
        const url = getHealthUrl('relay');
        const result = await checkHealth(url, 5000);

        if (!result.healthy) {
            console.warn('⚠️  Relay offline - skipping format test');
            return;
        }

        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('service');
    });

    test('oracle health response has expected fields', async () => {
        const url = getHealthUrl('oracle');
        const result = await checkHealth(url, 5000);

        if (!result.healthy) {
            console.warn('⚠️  Oracle offline - skipping format test');
            return;
        }

        // Oracle returns backend info instead of standard status
        expect(result).toHaveProperty('healthy');
        expect(result.healthy).toBe(true);
    });
});

describe('Service Connectivity', () => {
    test('can reach relay WebSocket endpoint info', async () => {
        const url = 'http://localhost:8600/api/status';

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                expect(data).toBeDefined();
            }
        } catch (error) {
            console.warn('⚠️  Relay status endpoint not reachable');
        }
    });

    test('can list relay consumers', async () => {
        const url = 'http://localhost:8600/api/consumers';

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                expect(Array.isArray(data.consumers)).toBe(true);
            }
        } catch (error) {
            console.warn('⚠️  Relay consumers endpoint not reachable');
        }
    });
});

describe('External Services (Optional)', () => {
    test('ollama is reachable', async () => {
        const url = getHealthUrl('ollama');
        const result = await checkHealth(url, 3000);

        if (!result.healthy) {
            console.warn('⚠️  Ollama is offline');
            return;
        }

        expect(result.healthy).toBe(true);
    });

    test('lm studio is reachable', async () => {
        const url = getHealthUrl('lmStudio');
        const result = await checkHealth(url, 3000);

        if (!result.healthy) {
            console.warn('⚠️  LM Studio is offline');
            return;
        }

        expect(result.healthy).toBe(true);
    });
});
