/**
 * Hive Constants - Single source of truth for all service configurations
 *
 * Usage:
 *   const { SERVICES, PORTS, getServiceUrl } = require('../shared/constants');
 *   const relayUrl = getServiceUrl('relay');
 */

// Service Ports
const PORTS = {
    RELAY: 8600,
    ORACLE: 3002,
    KITTBOX: 8585,
    MASTER_O: 8500,
    REMOTE_SUPPORT: 8590,
    SIMWIDGET: 8080,
    HIVE_MIND: 8701,
    HIVE_BRAIN: 8800,
    HIVE_ORACLE: 8850,
    SMART_ROUTER: 8610,
    BROWSER_BRIDGE: 8620,
    GOOGLE_DRIVE: 8621,
    CLAUDE_BRIDGE: 8700,
    KITT_LIVE: 8686,
    WHISPER: 8660,
    OLLAMA: 11434,
    LM_STUDIO: 1234
};

// Service Definitions
const SERVICES = {
    relay: {
        name: 'Relay',
        port: PORTS.RELAY,
        healthPath: '/api/health',
        description: 'Message broker, task queue, persistent storage'
    },
    oracle: {
        name: 'Oracle',
        port: PORTS.ORACLE,
        healthPath: '/api/health',
        description: 'LLM backend, project APIs, tool execution'
    },
    kittbox: {
        name: 'KittBox',
        port: PORTS.KITTBOX,
        healthPath: '/api/health',
        description: 'Command center UI, task execution'
    },
    masterO: {
        name: 'Master O',
        port: PORTS.MASTER_O,
        healthPath: '/api/health',
        description: 'Service orchestrator, health monitoring'
    },
    remoteSupport: {
        name: 'Remote Support',
        port: PORTS.REMOTE_SUPPORT,
        healthPath: '/api/health',
        description: 'Remote command execution, file operations'
    },
    simwidget: {
        name: 'SimWidget',
        port: PORTS.SIMWIDGET,
        healthPath: '/api/status',
        description: 'MSFS SimConnect bridge'
    },
    hiveMind: {
        name: 'Hive-Mind',
        port: PORTS.HIVE_MIND,
        healthPath: '/api/health',
        description: 'Real-time activity monitor'
    },
    hiveBrain: {
        name: 'Hive Brain',
        port: PORTS.HIVE_BRAIN,
        healthPath: '/api/health',
        description: 'Device discovery, colony management'
    },
    hiveOracle: {
        name: 'Hive Oracle',
        port: PORTS.HIVE_ORACLE,
        healthPath: '/api/health',
        description: 'Distributed LLM orchestrator'
    },
    smartRouter: {
        name: 'Smart Router',
        port: PORTS.SMART_ROUTER,
        healthPath: '/api/health',
        description: 'LLM routing (Claude/Ollama/Iris)'
    },
    browserBridge: {
        name: 'Browser Bridge',
        port: PORTS.BROWSER_BRIDGE,
        healthPath: '/status',
        description: 'Browser automation API'
    },
    kittLive: {
        name: 'Kitt Live',
        port: PORTS.KITT_LIVE,
        healthPath: '/api/health',
        description: 'Standalone chat UI'
    },
    whisper: {
        name: 'Whisper',
        port: PORTS.WHISPER,
        healthPath: '/api/health',
        description: 'Speech-to-text transcription'
    },
    ollama: {
        name: 'Ollama',
        port: PORTS.OLLAMA,
        healthPath: '/api/tags',
        description: 'Local LLM inference'
    },
    lmStudio: {
        name: 'LM Studio',
        port: PORTS.LM_STUDIO,
        healthPath: '/v1/models',
        description: 'Local LLM (OpenAI-compatible)'
    }
};

// Network Machines
const MACHINES = {
    primary: {
        name: 'Harold-PC',
        ip: '192.168.1.42',
        role: 'Primary'
    },
    secondary: {
        name: 'morpu-pc',
        ip: null, // Dynamic
        role: 'Secondary'
    },
    fallback: {
        name: 'ai-pc',
        ip: '192.168.1.162',
        role: 'Fallback (Iris)'
    }
};

// Timeouts (ms)
const TIMEOUTS = {
    HEALTH_CHECK: 5000,
    SERVICE_START: 30000,
    TASK_PROCESSING: 300000,
    CONSUMER_HEARTBEAT: 30000,
    LLM_RESPONSE: 120000
};

// Retry Configuration
const RETRY = {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10000,
    BACKOFF_MULTIPLIER: 2
};

/**
 * Get full URL for a service
 * @param {string} serviceKey - Key from SERVICES object
 * @param {string} host - Host (default: localhost)
 * @returns {string} Full URL
 */
function getServiceUrl(serviceKey, host = 'localhost') {
    const service = SERVICES[serviceKey];
    if (!service) throw new Error(`Unknown service: ${serviceKey}`);
    return `http://${host}:${service.port}`;
}

/**
 * Get health check URL for a service
 * @param {string} serviceKey - Key from SERVICES object
 * @param {string} host - Host (default: localhost)
 * @returns {string} Health check URL
 */
function getHealthUrl(serviceKey, host = 'localhost') {
    const service = SERVICES[serviceKey];
    if (!service) throw new Error(`Unknown service: ${serviceKey}`);
    return `http://${host}:${service.port}${service.healthPath}`;
}

/**
 * Get all core services (required for hive operation)
 * @returns {string[]} Array of service keys
 */
function getCoreServices() {
    return ['relay', 'oracle', 'kittbox', 'hiveMind'];
}

/**
 * Get all optional services
 * @returns {string[]} Array of service keys
 */
function getOptionalServices() {
    return ['hiveBrain', 'hiveOracle', 'browserBridge', 'whisper', 'smartRouter'];
}

module.exports = {
    PORTS,
    SERVICES,
    MACHINES,
    TIMEOUTS,
    RETRY,
    getServiceUrl,
    getHealthUrl,
    getCoreServices,
    getOptionalServices
};
