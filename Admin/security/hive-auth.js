/**
 * Hive Authentication Middleware
 * Simple API key authentication for all Hive services
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Config
const KEYS_FILE = path.join(__dirname, 'api-keys.json');
const MASTER_KEY_ENV = 'HIVE_MASTER_KEY';

// Load or generate keys
function loadKeys() {
    if (fs.existsSync(KEYS_FILE)) {
        return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    }
    return { keys: {}, masterKey: null };
}

function saveKeys(keys) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

// Generate a secure API key
function generateKey(prefix = 'hive') {
    const random = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${random}`;
}

// Initialize master key if not exists
function initMasterKey() {
    const keys = loadKeys();
    if (!keys.masterKey) {
        keys.masterKey = generateKey('hive_master');
        saveKeys(keys);
        console.log('[Hive Auth] Generated new master key');
    }
    return keys.masterKey;
}

// Create a new API key for a service/user
function createApiKey(name, permissions = ['read']) {
    const keys = loadKeys();
    const key = generateKey('hive');
    keys.keys[key] = {
        name,
        permissions,
        created: new Date().toISOString(),
        lastUsed: null
    };
    saveKeys(keys);
    return key;
}

// Validate an API key
function validateKey(key) {
    if (!key) return { valid: false, reason: 'No key provided' };

    // Check master key from env
    const masterKey = process.env[MASTER_KEY_ENV];
    if (masterKey && key === masterKey) {
        return { valid: true, name: 'master', permissions: ['*'] };
    }

    const keys = loadKeys();

    // Check master key from file
    if (key === keys.masterKey) {
        return { valid: true, name: 'master', permissions: ['*'] };
    }

    // Check regular keys
    if (keys.keys[key]) {
        const keyData = keys.keys[key];
        keyData.lastUsed = new Date().toISOString();
        saveKeys(keys);
        return { valid: true, ...keyData };
    }

    return { valid: false, reason: 'Invalid key' };
}

// Express middleware
function authMiddleware(options = {}) {
    const { required = true, permissions = [] } = options;

    return (req, res, next) => {
        // Skip auth for health checks
        if (req.path === '/api/health' || req.path === '/health') {
            return next();
        }

        // Get key from header or query
        const key = req.headers['x-api-key'] ||
                    req.headers['authorization']?.replace('Bearer ', '') ||
                    req.query.api_key;

        const result = validateKey(key);

        if (!result.valid) {
            if (required) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: result.reason
                });
            }
            req.auth = { anonymous: true };
            return next();
        }

        // Check permissions
        if (permissions.length > 0 && !result.permissions.includes('*')) {
            const hasPermission = permissions.some(p => result.permissions.includes(p));
            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Insufficient permissions'
                });
            }
        }

        req.auth = result;
        next();
    };
}

// HTTP middleware (for raw http.createServer)
function httpAuthMiddleware(req, res, options = {}) {
    const { required = true } = options;

    // Skip auth for health checks
    if (req.url === '/api/health' || req.url === '/health') {
        return { valid: true, skip: true };
    }

    // Get key from header
    const key = req.headers['x-api-key'] ||
                req.headers['authorization']?.replace('Bearer ', '');

    const result = validateKey(key);

    if (!result.valid && required) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: result.reason }));
        return { valid: false };
    }

    return result;
}

// CLI: Generate and show master key
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args[0] === 'init') {
        const masterKey = initMasterKey();
        console.log('\n=== Hive Master Key ===');
        console.log(masterKey);
        console.log('\nStore this securely! Use as:');
        console.log('  Header: X-API-Key: ' + masterKey);
        console.log('  Env: HIVE_MASTER_KEY=' + masterKey);
    } else if (args[0] === 'create') {
        const name = args[1] || 'unnamed';
        const key = createApiKey(name, ['read', 'write']);
        console.log(`\nCreated key for "${name}":`);
        console.log(key);
    } else if (args[0] === 'list') {
        const keys = loadKeys();
        console.log('\n=== API Keys ===');
        console.log('Master:', keys.masterKey ? '(set)' : '(not set)');
        console.log('Keys:', Object.keys(keys.keys).length);
        for (const [key, data] of Object.entries(keys.keys)) {
            console.log(`  - ${data.name}: ${key.slice(0, 20)}...`);
        }
    } else {
        console.log('Hive Auth - API Key Management');
        console.log('Usage:');
        console.log('  node hive-auth.js init     - Generate master key');
        console.log('  node hive-auth.js create [name] - Create new key');
        console.log('  node hive-auth.js list     - List all keys');
    }
}

module.exports = {
    generateKey,
    initMasterKey,
    createApiKey,
    validateKey,
    authMiddleware,
    httpAuthMiddleware,
    loadKeys
};
