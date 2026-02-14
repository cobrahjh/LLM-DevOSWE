/**
 * Hive Port Manager
 *
 * Provides port availability checking and reservation system for Hive services
 * Prevents port conflicts across the ecosystem
 *
 * Usage:
 *   const { checkPort, findAvailablePort, reservePort } = require('./Admin/tools/port-manager');
 *
 *   // Check if port is available
 *   const available = await checkPort(8080);
 *
 *   // Find next available port in range
 *   const port = await findAvailablePort(8000, 8100);
 *
 *   // Reserve port for service
 *   await reservePort(8080, 'MyService', '/path/to/service.js');
 */

const net = require('net');
const fs = require('fs').promises;
const path = require('path');

// Port registry file location
const REGISTRY_FILE = path.join(__dirname, 'port-registry.json');

// Reserved port ranges
const PORT_RANGES = {
    SYSTEM: { min: 0, max: 1023, description: 'System/well-known ports' },
    HIVE_CORE: { min: 3000, max: 3999, description: 'Hive core services (Oracle, etc.)' },
    SIMWIDGET: { min: 8000, max: 8099, description: 'SimWidget services' },
    HIVE_SERVICES: { min: 8500, max: 8899, description: 'Hive infrastructure services' },
    USER_SERVICES: { min: 9000, max: 9999, description: 'User/project services' },
    EXTERNAL: { min: 11000, max: 12000, description: 'External services (Ollama, LM Studio)' }
};

/**
 * Check if a port is currently in use
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if available, false if in use
 */
async function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false); // Port in use
            } else {
                resolve(false); // Other error, assume unavailable
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true); // Port available
        });

        server.listen(port);
    });
}

/**
 * Find the next available port in a range
 * @param {number} startPort - Start of range
 * @param {number} endPort - End of range
 * @returns {Promise<number|null>} - Available port or null if none found
 */
async function findAvailablePort(startPort = 8000, endPort = 8999) {
    for (let port = startPort; port <= endPort; port++) {
        const available = await checkPort(port);
        if (available) {
            return port;
        }
    }
    return null;
}

/**
 * Get port range recommendation for service type
 * @param {string} serviceType - Type of service (core, simwidget, hive, user, external)
 * @returns {object} - Port range with min/max
 */
function getRecommendedRange(serviceType) {
    const ranges = {
        'core': PORT_RANGES.HIVE_CORE,
        'simwidget': PORT_RANGES.SIMWIDGET,
        'hive': PORT_RANGES.HIVE_SERVICES,
        'user': PORT_RANGES.USER_SERVICES,
        'external': PORT_RANGES.EXTERNAL
    };

    return ranges[serviceType] || PORT_RANGES.USER_SERVICES;
}

/**
 * Load port registry from file
 * @returns {Promise<object>} - Registry object
 */
async function loadRegistry() {
    try {
        const data = await fs.readFile(REGISTRY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // File doesn't exist or is invalid, return default
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            ports: {}
        };
    }
}

/**
 * Save port registry to file
 * @param {object} registry - Registry object to save
 */
async function saveRegistry(registry) {
    registry.lastUpdated = new Date().toISOString();
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Reserve a port for a service
 * @param {number} port - Port to reserve
 * @param {string} serviceName - Name of the service
 * @param {string} scriptPath - Path to service script
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<boolean>} - True if reserved, false if already taken
 */
async function reservePort(port, serviceName, scriptPath, metadata = {}) {
    const registry = await loadRegistry();

    // Check if port is already reserved
    if (registry.ports[port]) {
        console.error(`Port ${port} already reserved by ${registry.ports[port].serviceName}`);
        return false;
    }

    // Check if port is actually available
    const available = await checkPort(port);
    if (!available) {
        console.error(`Port ${port} is in use but not in registry`);
        return false;
    }

    // Reserve the port
    registry.ports[port] = {
        serviceName,
        scriptPath,
        reservedAt: new Date().toISOString(),
        ...metadata
    };

    await saveRegistry(registry);
    console.log(`✓ Port ${port} reserved for ${serviceName}`);
    return true;
}

/**
 * Release a port reservation
 * @param {number} port - Port to release
 * @returns {Promise<boolean>} - True if released, false if not reserved
 */
async function releasePort(port) {
    const registry = await loadRegistry();

    if (!registry.ports[port]) {
        console.error(`Port ${port} is not reserved`);
        return false;
    }

    const serviceName = registry.ports[port].serviceName;
    delete registry.ports[port];

    await saveRegistry(registry);
    console.log(`✓ Port ${port} released from ${serviceName}`);
    return true;
}

/**
 * Get information about a port
 * @param {number} port - Port to query
 * @returns {Promise<object>} - Port info including availability and reservation
 */
async function getPortInfo(port) {
    const available = await checkPort(port);
    const registry = await loadRegistry();
    const reservation = registry.ports[port];

    return {
        port,
        available,
        reserved: !!reservation,
        reservation: reservation || null,
        inUse: !available
    };
}

/**
 * List all reserved ports
 * @returns {Promise<array>} - Array of port reservations
 */
async function listReservedPorts() {
    const registry = await loadRegistry();
    return Object.entries(registry.ports).map(([port, info]) => ({
        port: parseInt(port),
        ...info
    }));
}

/**
 * Check for port conflicts (reserved but available, or in use but not reserved)
 * @returns {Promise<object>} - Conflict report
 */
async function checkConflicts() {
    const registry = await loadRegistry();
    const conflicts = {
        reservedButAvailable: [],
        inUseButNotReserved: []
    };

    // Check reserved ports
    for (const [port, info] of Object.entries(registry.ports)) {
        const available = await checkPort(parseInt(port));
        if (available) {
            conflicts.reservedButAvailable.push({
                port: parseInt(port),
                ...info
            });
        }
    }

    // Check common port ranges for unreserved usage
    const checkRanges = [
        ...Array.from({ length: 100 }, (_, i) => 8000 + i), // 8000-8099
        ...Array.from({ length: 400 }, (_, i) => 8500 + i), // 8500-8899
        3002, 11434, 1234 // Known services
    ];

    for (const port of checkRanges) {
        if (!registry.ports[port]) {
            const available = await checkPort(port);
            if (!available) {
                conflicts.inUseButNotReserved.push(port);
            }
        }
    }

    return conflicts;
}

/**
 * Suggest a port for a new service
 * @param {string} serviceType - Type of service (core, simwidget, hive, user)
 * @param {string} serviceName - Name of the service
 * @returns {Promise<number|null>} - Suggested port or null
 */
async function suggestPort(serviceType = 'user', serviceName = '') {
    const range = getRecommendedRange(serviceType);
    const port = await findAvailablePort(range.min, range.max);

    if (port) {
        console.log(`💡 Suggested port ${port} for ${serviceName || 'service'} (${range.description})`);
    } else {
        console.error(`❌ No available ports in ${serviceType} range (${range.min}-${range.max})`);
    }

    return port;
}

/**
 * Validate port before use (checks availability and range appropriateness)
 * @param {number} port - Port to validate
 * @param {string} serviceType - Type of service
 * @returns {Promise<object>} - Validation result
 */
async function validatePort(port, serviceType = 'user') {
    const result = {
        valid: true,
        warnings: [],
        errors: []
    };

    // Check if port is in valid range
    if (port < 1024) {
        result.errors.push('Port is in system reserved range (0-1023)');
        result.valid = false;
    }

    if (port > 65535) {
        result.errors.push('Port is out of valid range (1-65535)');
        result.valid = false;
    }

    // Check availability
    const available = await checkPort(port);
    if (!available) {
        result.errors.push('Port is already in use');
        result.valid = false;
    }

    // Check if reserved
    const registry = await loadRegistry();
    if (registry.ports[port]) {
        result.errors.push(`Port already reserved by ${registry.ports[port].serviceName}`);
        result.valid = false;
    }

    // Check range appropriateness
    const range = getRecommendedRange(serviceType);
    if (port < range.min || port > range.max) {
        result.warnings.push(`Port ${port} is outside recommended range for ${serviceType} (${range.min}-${range.max})`);
    }

    return result;
}

module.exports = {
    checkPort,
    findAvailablePort,
    reservePort,
    releasePort,
    getPortInfo,
    listReservedPorts,
    checkConflicts,
    suggestPort,
    validatePort,
    getRecommendedRange,
    PORT_RANGES
};

// CLI usage
if (require.main === module) {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        switch (command) {
            case 'check':
                const port = parseInt(args[0]);
                const available = await checkPort(port);
                console.log(`Port ${port}: ${available ? 'AVAILABLE' : 'IN USE'}`);
                break;

            case 'find':
                const start = parseInt(args[0]) || 8000;
                const end = parseInt(args[1]) || 8999;
                const foundPort = await findAvailablePort(start, end);
                console.log(foundPort ? `Available: ${foundPort}` : 'No available ports in range');
                break;

            case 'reserve':
                const reservePort = parseInt(args[0]);
                const serviceName = args[1];
                const scriptPath = args[2] || '';
                await reservePort(reservePort, serviceName, scriptPath);
                break;

            case 'list':
                const reserved = await listReservedPorts();
                console.log('Reserved Ports:');
                console.table(reserved);
                break;

            case 'conflicts':
                const conflicts = await checkConflicts();
                console.log('Port Conflicts:');
                console.log('Reserved but available:', conflicts.reservedButAvailable);
                console.log('In use but not reserved:', conflicts.inUseButNotReserved);
                break;

            case 'suggest':
                const serviceType = args[0] || 'user';
                const name = args[1] || '';
                await suggestPort(serviceType, name);
                break;

            default:
                console.log('Usage:');
                console.log('  node port-manager.js check <port>');
                console.log('  node port-manager.js find [start] [end]');
                console.log('  node port-manager.js reserve <port> <name> [path]');
                console.log('  node port-manager.js list');
                console.log('  node port-manager.js conflicts');
                console.log('  node port-manager.js suggest [type] [name]');
        }
    })();
}
