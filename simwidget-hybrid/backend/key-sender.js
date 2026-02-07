/**
 * SimWidget Key Sender v3.1.0
 * Uses TCP connection to KeySenderService for fast key sending (~5ms vs ~700ms)
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\key-sender.js
 * 
 * Changelog:
 * v3.2.0 - Added FastKeySender with persistent PowerShell (~50ms vs ~400ms)
 * v3.1.0 - Import/Export keymaps with automatic backup
 * v3.0.0 - GUID-based keymaps with editable names, add/delete/rename support
 * v2.0.0 - Switched to TCP KeySenderService (major performance improvement)
 * v1.1.0 - Added debug logging, history tracking, duplicate detection
 * v1.0.0 - Initial configurable keymap system (PowerShell-based)
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const FastKeySender = require('./fast-key-sender');

const VERSION = '3.2.0';
const KEYMAPS_PATH = path.join(__dirname, '..', 'config', 'keymaps.json');
const SERVICE_HOST = '127.0.0.1';
const SERVICE_PORT = 9999;
const SERVICE_EXE = 'C:\\DevOSWE\\KeySenderService\\bin\\Release\\net8.0\\KeySenderService.exe';

class KeySender {
    constructor() {
        this.keymaps = this.loadKeymaps();
        this.originalIdMap = this.buildOriginalIdMap(); // For backward compat lookups
        this.debug = true;
        this.history = [];
        this.maxHistory = 50;
        this.client = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.pendingCallbacks = new Map();
        this.requestId = 0;
        this.mode = 'tcp'; // 'tcp', 'fast', or 'powershell'
        this.fastKeySender = new FastKeySender();

        this.validateKeymaps();
        this.watchConfig();
        this.startService();
        this.startFastKeySender();
    }

    // Build lookup map: originalId -> { category, id }
    buildOriginalIdMap() {
        const map = {};
        for (const [category, actions] of Object.entries(this.keymaps)) {
            if (typeof actions !== 'object' || category === 'version' || category === 'description') continue;
            for (const [id, binding] of Object.entries(actions)) {
                if (binding && binding.originalId) {
                    map[binding.originalId] = { category, id };
                }
            }
        }
        return map;
    }

    log(message, data = null) {
        if (this.debug) {
            const timestamp = new Date().toISOString().substr(11, 12);
            if (data) {
                console.log(`[KeySender ${timestamp}] ${message}`, data);
            } else {
                console.log(`[KeySender ${timestamp}] ${message}`);
            }
        }
    }

    // Start the KeySenderService if not running
    async startService() {
        this.log('Checking KeySenderService...');
        
        // Check if service is already running
        const isRunning = await this.pingService();
        if (isRunning) {
            this.log('✓ KeySenderService already running');
            this.connect();
            return;
        }

        // Start the service
        this.log(`Starting KeySenderService from ${SERVICE_EXE}`);
        
        if (!fs.existsSync(SERVICE_EXE)) {
            this.log(`⚠️ KeySenderService.exe not found, falling back to PowerShell`);
            this.mode = 'powershell';
            return;
        }

        const child = spawn(SERVICE_EXE, [SERVICE_PORT.toString()], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
        });
        child.unref();

        // Wait for service to start
        await new Promise(r => setTimeout(r, 1000));
        this.connect();
    }

    pingService() {
        return new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(500);
            
            client.connect(SERVICE_PORT, SERVICE_HOST, () => {
                client.write('PING');
            });

            client.on('data', (data) => {
                client.destroy();
                resolve(data.toString().trim() === 'PONG');
            });

            client.on('error', () => {
                client.destroy();
                resolve(false);
            });

            client.on('timeout', () => {
                client.destroy();
                resolve(false);
            });
        });
    }

    connect() {
        if (this.client) {
            this.client.destroy();
        }

        this.client = new net.Socket();
        this.client.setKeepAlive(true, 5000);

        this.client.connect(SERVICE_PORT, SERVICE_HOST, () => {
            this.connected = true;
            this.mode = 'tcp';
            this.log('✓ Connected to KeySenderService');
        });

        this.client.on('data', (data) => {
            const response = data.toString().trim();
            // Handle response (for async sends)
            if (this.pendingCallbacks.size > 0) {
                const [id, callback] = this.pendingCallbacks.entries().next().value;
                this.pendingCallbacks.delete(id);
                callback(response);
            }
        });

        this.client.on('error', (err) => {
            this.log(`Connection error: ${err.message}`);
            this.connected = false;
            // Fall back to FastKeySender if available
            if (this.fastKeySender && this.fastKeySender.ready) {
                this.mode = 'fast';
                this.log('Falling back to FastKeySender');
            }
        });

        this.client.on('close', () => {
            this.connected = false;
            this.log('Connection closed, reconnecting in 3s...');
            this.scheduleReconnect();
        });
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    async startFastKeySender() {
        try {
            await this.fastKeySender.start();
            // If TCP service not connected, use FastKeySender
            if (!this.connected) {
                this.mode = 'fast';
                this.log('✓ Using FastKeySender (persistent PowerShell, ~50ms)');
            }
        } catch (err) {
            this.log(`FastKeySender failed to start: ${err.message}`);
            this.mode = 'powershell';
        }
    }

    getMode() {
        if (this.mode === 'tcp' && this.connected) return 'tcp';
        if (this.fastKeySender && this.fastKeySender.ready) return 'fast';
        return 'powershell';
    }

    loadKeymaps() {
        try {
            const data = fs.readFileSync(KEYMAPS_PATH, 'utf8');
            const keymaps = JSON.parse(data);
            console.log('[KeySender] Loaded keymaps from config');
            return keymaps;
        } catch (e) {
            console.error('[KeySender] Failed to load keymaps:', e.message);
            return this.getDefaultKeymaps();
        }
    }

    validateKeymaps() {
        const keyUsage = {};
        const conflicts = [];

        for (const [category, actions] of Object.entries(this.keymaps)) {
            if (typeof actions !== 'object' || category === 'version' || category === 'description') continue;
            
            for (const [action, binding] of Object.entries(actions)) {
                if (action.startsWith('_')) continue;
                if (!binding) continue;
                
                // Handle both string format and object format
                const key = typeof binding === 'object' ? binding.key : binding;
                if (!key || typeof key !== 'string') continue;

                const normalizedKey = key.toUpperCase();
                if (!keyUsage[normalizedKey]) {
                    keyUsage[normalizedKey] = [];
                }
                keyUsage[normalizedKey].push({ category, action });
            }
        }

        for (const [key, usages] of Object.entries(keyUsage)) {
            if (usages.length > 1) {
                conflicts.push({ key, usages });
            }
        }

        if (conflicts.length > 0) {
            console.warn('[KeySender] ⚠️  DUPLICATE KEY CONFLICTS DETECTED:');
            for (const conflict of conflicts) {
                const locations = conflict.usages.map(u => `${u.category}.${u.action}`).join(', ');
                console.warn(`[KeySender]    ${conflict.key} -> ${locations}`);
            }
        } else {
            console.log('[KeySender] ✓ No duplicate key conflicts');
        }

        return conflicts;
    }

    getConflicts() {
        return this.validateKeymaps();
    }

    watchConfig() {
        try {
            fs.watch(KEYMAPS_PATH, (eventType) => {
                if (eventType === 'change') {
                    console.log('[KeySender] Config changed, reloading...');
                    setTimeout(() => {
                        this.keymaps = this.loadKeymaps();
                        this.originalIdMap = this.buildOriginalIdMap();
                        this.validateKeymaps();
                    }, 100);
                }
            });
        } catch (e) {
            console.log('[KeySender] Could not watch config file');
        }
    }

    getDefaultKeymaps() {
        return {
            camera: {
                cockpitVFR: 'F10',
                cockpitIFR: 'F9',
                toggleExternal: 'BACKSPACE',
                drone: 'SHIFT+X'
            }
        };
    }

    // Get key by category + id (GUID) or legacy originalId
    getKey(category, action) {
        this.log(`Looking up: ${category}.${action}`);
        
        // First try direct lookup (v3.0 GUID-based)
        if (this.keymaps[category] && this.keymaps[category][action]) {
            const binding = this.keymaps[category][action];
            const key = typeof binding === 'object' ? binding.key : binding;
            this.log(`  ✓ Found (direct): ${key}`);
            return key;
        }
        
        // Try legacy originalId lookup for backward compatibility
        const legacy = this.originalIdMap[action];
        if (legacy && legacy.category === category) {
            const binding = this.keymaps[legacy.category][legacy.id];
            const key = typeof binding === 'object' ? binding.key : binding;
            this.log(`  ✓ Found (via originalId): ${key}`);
            return key;
        }
        
        this.log(`  ❌ Not found: ${category}.${action}`);
        return null;
    }

    // Get binding object by id
    getBinding(category, id) {
        if (!this.keymaps[category] || !this.keymaps[category][id]) {
            return null;
        }
        return this.keymaps[category][id];
    }

    // Generate unique ID for new entries
    generateId(category) {
        const prefix = {
            camera: 'cam',
            aircraft: 'acft',
            lights: 'lgt',
            views: 'view',
            custom: 'cust'
        }[category] || 'item';
        
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 4);
        return `${prefix}-${timestamp}-${random}`;
    }

    // Add new keymap entry
    addKeymap(category, name, key = '', trigger = '') {
        if (!this.keymaps[category]) {
            this.keymaps[category] = {};
        }
        
        const id = this.generateId(category);
        this.keymaps[category][id] = {
            originalId: null,
            name: name,
            key: key,
            trigger: trigger,
            isDefault: false
        };
        
        this.saveKeymaps();
        this.log(`Added new keymap: ${category}.${id} (${name})`);
        return { id, category };
    }

    // Delete keymap entry (only non-default)
    deleteKeymap(category, id) {
        if (!this.keymaps[category] || !this.keymaps[category][id]) {
            return { success: false, error: 'Not found' };
        }
        
        const binding = this.keymaps[category][id];
        if (binding.isDefault) {
            return { success: false, error: 'Cannot delete default entries' };
        }
        
        delete this.keymaps[category][id];
        this.saveKeymaps();
        this.originalIdMap = this.buildOriginalIdMap();
        this.log(`Deleted keymap: ${category}.${id}`);
        return { success: true };
    }

    // Rename keymap entry
    renameKeymap(category, id, newName) {
        if (!this.keymaps[category] || !this.keymaps[category][id]) {
            return { success: false, error: 'Not found' };
        }
        
        this.keymaps[category][id].name = newName;
        this.saveKeymaps();
        this.log(`Renamed keymap: ${category}.${id} -> ${newName}`);
        return { success: true };
    }

    // Export to v2.0 format (for reversibility)
    exportToV2() {
        const v2 = {
            version: "2.0",
            description: "SimWidget Key Mappings (exported from v3.0)"
        };
        
        for (const [category, actions] of Object.entries(this.keymaps)) {
            if (category === 'version' || category === 'description') continue;
            if (typeof actions !== 'object') continue;
            
            v2[category] = {};
            for (const [id, binding] of Object.entries(actions)) {
                // Use originalId if available, otherwise use id
                const actionName = binding.originalId || id;
                v2[category][actionName] = {
                    key: binding.key || '',
                    trigger: binding.trigger || ''
                };
            }
        }
        
        return v2;
    }

    // Save v2.0 format to file (for rollback)
    saveAsV2(filepath) {
        const v2 = this.exportToV2();
        fs.writeFileSync(filepath, JSON.stringify(v2, null, 4));
        this.log(`Exported v2.0 format to: ${filepath}`);
        return { success: true, filepath };
    }

    // Send key via TCP (fast) or PowerShell (fallback)
    sendKey(key) {
        const mode = this.getMode();
        if (mode === 'tcp') {
            return this.sendKeyTCP(key);
        } else if (mode === 'fast') {
            return this.sendKeyFast(key);
        } else {
            return this.sendKeyPowerShell(key);
        }
    }

    async sendKeyFast(key) {
        const entry = {
            timestamp: new Date().toISOString(),
            key: key,
            mode: 'fast',
            status: 'pending',
            error: null,
            duration: null
        };

        try {
            const result = await this.fastKeySender.send(key);
            entry.status = 'success';
            entry.duration = result.latency;
            this.log(`✓ Sent: ${key} via FastKeySender (${result.latency}ms)`);
            this.history.unshift(entry);
            if (this.history.length > this.maxHistory) this.history.pop();
            return result;
        } catch (err) {
            entry.status = 'error';
            entry.error = err.message;
            entry.duration = 0;
            this.log(`❌ ${key}: ${err.message}`);
            this.history.unshift(entry);
            if (this.history.length > this.maxHistory) this.history.pop();
            throw err;
        }
    }

    sendKeyTCP(key) {
        return new Promise((resolve, reject) => {
            if (!key) {
                reject(new Error('No key specified'));
                return;
            }

            const entry = {
                timestamp: new Date().toISOString(),
                key: key,
                mode: 'tcp',
                status: 'pending',
                error: null,
                duration: null
            };

            const startTime = Date.now();
            const id = ++this.requestId;

            this.pendingCallbacks.set(id, (response) => {
                entry.duration = Date.now() - startTime;
                
                if (response.startsWith('ERROR')) {
                    entry.status = 'error';
                    entry.error = response;
                    this.log(`❌ ${key}: ${response} (${entry.duration}ms)`);
                    reject(new Error(response));
                } else {
                    entry.status = 'success';
                    this.log(`✓ Sent: ${key} via TCP (${entry.duration}ms)`);
                    resolve(response);
                }

                this.history.unshift(entry);
                if (this.history.length > this.maxHistory) this.history.pop();
            });

            this.client.write(key + '\n');

            // Timeout after 2 seconds
            setTimeout(() => {
                if (this.pendingCallbacks.has(id)) {
                    this.pendingCallbacks.delete(id);
                    entry.status = 'timeout';
                    entry.duration = 2000;
                    this.history.unshift(entry);
                    reject(new Error('Timeout'));
                }
            }, 2000);
        });
    }

    sendKeyPowerShell(key) {
        return new Promise((resolve, reject) => {
            if (!key) {
                reject(new Error('No key specified'));
                return;
            }

            const entry = {
                timestamp: new Date().toISOString(),
                key: key,
                mode: 'powershell',
                status: 'pending',
                error: null,
                duration: null
            };

            const startTime = Date.now();
            const script = 'C:\\LLM-DevOSWE\\send-key.ps1';
            // Sanitize key to prevent PowerShell injection - strip anything that isn't
            // alphanumeric, +, -, or underscore (valid key combo characters)
            const safeKey = key.replace(/[^A-Za-z0-9_+\-\s]/g, '');
            if (!safeKey) {
                reject(new Error('Invalid key after sanitization'));
                return;
            }
            const cmd = `powershell -ExecutionPolicy Bypass -File "${script}" -Key "${safeKey}"`;

            this.log(`Executing (PowerShell fallback): ${key}`);

            exec(cmd, (error, stdout, stderr) => {
                entry.duration = Date.now() - startTime;

                if (error) {
                    entry.status = 'error';
                    entry.error = error.message;
                    this.log(`❌ Error (${entry.duration}ms): ${error.message}`);
                    reject(error);
                } else {
                    entry.status = 'success';
                    this.log(`✓ Sent: ${key} via PowerShell (${entry.duration}ms)`);
                    resolve(stdout);
                }

                this.history.unshift(entry);
                if (this.history.length > this.maxHistory) this.history.pop();
            });
        });
    }

    async send(category, action) {
        this.log(`=== SEND: ${category}.${action} ===`);
        const key = this.getKey(category, action);
        if (key) {
            return this.sendKey(key);
        }
        throw new Error(`No mapping for ${category}.${action}`);
    }

    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }

    clearHistory() {
        this.history = [];
    }

    setDebug(enabled) {
        this.debug = enabled;
        console.log(`[KeySender] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    getKeymaps() {
        return this.keymaps;
    }

    getVersion() {
        return VERSION;
    }

    getStatus() {
        return {
            version: VERSION,
            mode: this.getMode(),
            connected: this.connected,
            servicePort: SERVICE_PORT,
            fastKeySenderReady: this.fastKeySender ? this.fastKeySender.ready : false,
            fastKeySenderStats: this.fastKeySender ? this.fastKeySender.getStats() : null
        };
    }

    updateKeymap(category, action, newValue, field = 'key') {
        console.log(`[KeySender] updateKeymap: ${category}.${action}.${field} = ${newValue}`);
        
        const normalizedValue = newValue.toUpperCase();
        let existingUsage = null;
        
        // Only check for conflicts on 'key' field (not triggers)
        if (field === 'key') {
            existingUsage = this.findKeyUsage(normalizedValue, category, action);
            if (existingUsage) {
                console.warn(`[KeySender] ⚠️  Key ${newValue} already used by ${existingUsage.category}.${existingUsage.action}`);
            }
        }

        if (!this.keymaps[category]) {
            this.keymaps[category] = {};
        }
        
        // Handle both old string format and new object format
        const currentBinding = this.keymaps[category][action];
        console.log(`[KeySender] Current binding:`, currentBinding);
        
        if (typeof currentBinding === 'object' && currentBinding !== null) {
            // New format - update specific field
            this.keymaps[category][action][field] = newValue;
            console.log(`[KeySender] Updated existing object, result:`, this.keymaps[category][action]);
        } else {
            // Migrate from old format to new format
            this.keymaps[category][action] = {
                key: field === 'key' ? newValue : (currentBinding || ''),
                trigger: field === 'trigger' ? newValue : ''
            };
            console.log(`[KeySender] Migrated to new format:`, this.keymaps[category][action]);
        }
        
        this.saveKeymaps();
        return { conflict: existingUsage };
    }

    findKeyUsage(key, excludeCategory, excludeAction) {
        const normalizedKey = key.toUpperCase();

        for (const [category, actions] of Object.entries(this.keymaps)) {
            if (typeof actions !== 'object' || category === 'version' || category === 'description') continue;

            for (const [action, binding] of Object.entries(actions)) {
                if (action.startsWith('_')) continue;
                if (!binding) continue;
                if (category === excludeCategory && action === excludeAction) continue;

                // Handle both string format and object format
                const mappedKey = typeof binding === 'object' ? binding.key : binding;
                if (!mappedKey || typeof mappedKey !== 'string') continue;

                if (mappedKey.toUpperCase() === normalizedKey) {
                    return { category, action, key: mappedKey };
                }
            }
        }
        return null;
    }

    importKeymaps(importData) {
        console.log('[KeySender] Importing keymaps...');
        
        // Backup current keymaps
        const backupPath = KEYMAPS_PATH.replace('.json', `-backup-${Date.now()}.json`);
        try {
            fs.writeFileSync(backupPath, JSON.stringify(this.keymaps, null, 4));
            console.log(`[KeySender] Backup saved to: ${backupPath}`);
        } catch (e) {
            console.warn('[KeySender] Could not create backup:', e.message);
        }
        
        // Count items being imported
        let categoryCount = 0;
        let actionCount = 0;
        
        for (const [key, value] of Object.entries(importData)) {
            if (key.startsWith('_') || typeof value !== 'object') continue;
            categoryCount++;
            actionCount += Object.keys(value).filter(k => !k.startsWith('_')).length;
        }
        
        // Replace keymaps
        this.keymaps = importData;
        this.originalIdMap = this.buildOriginalIdMap();
        this.saveKeymaps();
        this.validateKeymaps();
        
        console.log(`[KeySender] Imported ${actionCount} keymaps in ${categoryCount} categories`);
        return { categoryCount, actionCount, backupPath };
    }

    saveKeymaps() {
        try {
            fs.writeFileSync(KEYMAPS_PATH, JSON.stringify(this.keymaps, null, 4));
            console.log('[KeySender] Keymaps saved');
        } catch (e) {
            console.error('[KeySender] Failed to save keymaps:', e.message);
        }
    }
}

module.exports = new KeySender();
