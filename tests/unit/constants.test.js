/**
 * Tests for shared/constants.js
 */

const {
    PORTS,
    SERVICES,
    MACHINES,
    TIMEOUTS,
    RETRY,
    getServiceUrl,
    getHealthUrl,
    getCoreServices,
    getOptionalServices
} = require('../../shared/constants');

describe('PORTS', () => {
    test('should have all required ports defined', () => {
        expect(PORTS.RELAY).toBe(8600);
        expect(PORTS.ORACLE).toBe(3002);
        expect(PORTS.KITTBOX).toBe(8585);
        expect(PORTS.HIVE_MIND).toBe(8701);
        expect(PORTS.OLLAMA).toBe(11434);
        expect(PORTS.LM_STUDIO).toBe(1234);
    });

    test('should have unique port numbers', () => {
        const ports = Object.values(PORTS);
        const uniquePorts = new Set(ports);
        expect(ports.length).toBe(uniquePorts.size);
    });
});

describe('SERVICES', () => {
    test('should have relay service defined', () => {
        expect(SERVICES.relay).toBeDefined();
        expect(SERVICES.relay.name).toBe('Relay');
        expect(SERVICES.relay.port).toBe(PORTS.RELAY);
        expect(SERVICES.relay.healthPath).toBe('/api/health');
    });

    test('should have oracle service defined', () => {
        expect(SERVICES.oracle).toBeDefined();
        expect(SERVICES.oracle.name).toBe('Oracle');
        expect(SERVICES.oracle.port).toBe(PORTS.ORACLE);
    });

    test('all services should have required properties', () => {
        for (const [key, service] of Object.entries(SERVICES)) {
            expect(service.name).toBeDefined();
            expect(service.port).toBeGreaterThan(0);
            expect(service.healthPath).toBeDefined();
            expect(service.description).toBeDefined();
        }
    });
});

describe('MACHINES', () => {
    test('should have primary machine defined', () => {
        expect(MACHINES.primary).toBeDefined();
        expect(MACHINES.primary.name).toBe('Harold-PC');
        expect(MACHINES.primary.role).toBe('Primary');
    });

    test('should have fallback machine with IP', () => {
        expect(MACHINES.fallback).toBeDefined();
        expect(MACHINES.fallback.ip).toBe('192.168.1.162');
    });
});

describe('TIMEOUTS', () => {
    test('should have reasonable timeout values', () => {
        expect(TIMEOUTS.HEALTH_CHECK).toBe(5000);
        expect(TIMEOUTS.SERVICE_START).toBe(30000);
        expect(TIMEOUTS.LLM_RESPONSE).toBe(120000);
    });
});

describe('RETRY', () => {
    test('should have retry configuration', () => {
        expect(RETRY.MAX_ATTEMPTS).toBe(3);
        expect(RETRY.INITIAL_DELAY).toBe(1000);
        expect(RETRY.BACKOFF_MULTIPLIER).toBe(2);
    });
});

describe('getServiceUrl', () => {
    test('should return correct URL for relay', () => {
        expect(getServiceUrl('relay')).toBe('http://localhost:8600');
    });

    test('should return correct URL with custom host', () => {
        expect(getServiceUrl('relay', '192.168.1.42')).toBe('http://192.168.1.42:8600');
    });

    test('should throw for unknown service', () => {
        expect(() => getServiceUrl('unknown')).toThrow('Unknown service: unknown');
    });
});

describe('getHealthUrl', () => {
    test('should return correct health URL for relay', () => {
        expect(getHealthUrl('relay')).toBe('http://localhost:8600/api/health');
    });

    test('should return correct health URL for simwidget', () => {
        expect(getHealthUrl('simwidget')).toBe('http://localhost:8080/api/status');
    });

    test('should handle custom host', () => {
        expect(getHealthUrl('oracle', '192.168.1.42')).toBe('http://192.168.1.42:3002/api/health');
    });
});

describe('getCoreServices', () => {
    test('should return array of core service keys', () => {
        const core = getCoreServices();
        expect(Array.isArray(core)).toBe(true);
        expect(core).toContain('relay');
        expect(core).toContain('oracle');
        expect(core).toContain('kittbox');
        expect(core).toContain('hiveMind');
    });
});

describe('getOptionalServices', () => {
    test('should return array of optional service keys', () => {
        const optional = getOptionalServices();
        expect(Array.isArray(optional)).toBe(true);
        expect(optional).toContain('hiveBrain');
        expect(optional).toContain('browserBridge');
    });

    test('should not overlap with core services', () => {
        const core = getCoreServices();
        const optional = getOptionalServices();
        const overlap = core.filter(c => optional.includes(c));
        expect(overlap.length).toBe(0);
    });
});
