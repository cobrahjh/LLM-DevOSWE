/**
 * Hot Update Engine v1.0.0
 * WebSocket-based hot reload system
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\hot-update\hot-engine.js
 * Last Updated: 2025-01-08
 * 
 * Features:
 * - File watching with instant WebSocket push
 * - CSS hot swap (no page reload)
 * - State preservation hints
 * - Multi-client sync
 * - Backend restart detection
 * 
 * Usage:
 *   const HotEngine = require('./hot-update/hot-engine');
 *   const hot = new HotEngine(server, watchPaths, options);
 *   hot.start();
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

class HotEngine {
    constructor(server, watchPaths, options = {}) {
        this.watchPaths = Array.isArray(watchPaths) ? watchPaths : [watchPaths];
        this.options = {
            wsPath: '/hot',
            debounceMs: 100,
            extensions: ['.html', '.js', '.css', '.json'],
            ignored: ['node_modules', '.git'],
            ...options
        };
        
        this.clients = new Set();
        this.watchers = [];
        this.debounceTimer = null;
        this.lastChange = null;
        
        // Create WebSocket server in noServer mode (upgrade handled by main server)
        this.wss = new WebSocket.Server({ noServer: true });
        
        // Store reference on server for upgrade handling
        server.hotEngine = this;
        
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log(`[HotEngine] Client connected (${this.clients.size} total)`);
            
            // Send current state
            ws.send(JSON.stringify({ 
                type: 'connected',
                timestamp: Date.now()
            }));

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`[HotEngine] Client disconnected (${this.clients.size} total)`);
            });

            ws.on('error', (err) => {
                console.error('[HotEngine] WebSocket error:', err.message);
                this.clients.delete(ws);
            });
        });
    }

    start() {
        console.log('[HotEngine] Starting file watchers...');
        
        this.watchPaths.forEach(watchPath => {
            this.watchDirectory(watchPath);
        });

        console.log(`[HotEngine] Watching ${this.watchPaths.length} path(s) for changes`);
        console.log(`[HotEngine] WebSocket endpoint: ws://localhost${this.options.wsPath}`);
    }

    watchDirectory(dir) {
        if (!fs.existsSync(dir)) {
            console.warn(`[HotEngine] Path not found: ${dir}`);
            return;
        }

        const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            
            // Check if ignored
            if (this.options.ignored.some(i => filename.includes(i))) return;
            
            // Check extension
            const ext = path.extname(filename).toLowerCase();
            if (!this.options.extensions.includes(ext)) return;

            // Debounce rapid changes
            this.scheduleReload(filename, ext);
        });

        this.watchers.push(watcher);
    }

    scheduleReload(filename, ext) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.notifyClients(filename, ext);
        }, this.options.debounceMs);
    }

    notifyClients(filename, ext) {
        const changeType = this.getChangeType(ext);
        const payload = {
            type: 'update',
            changeType,
            filename,
            timestamp: Date.now()
        };

        console.log(`[HotEngine] ${changeType.toUpperCase()}: ${filename}`);
        
        const message = JSON.stringify(payload);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });

        this.lastChange = payload;
    }

    getChangeType(ext) {
        switch (ext) {
            case '.css': return 'css';      // Hot swap, no reload
            case '.html': return 'html';    // Full reload
            case '.js': return 'js';        // Full reload
            case '.json': return 'data';    // Optional reload
            default: return 'unknown';
        }
    }

    broadcast(type, data = {}) {
        const payload = JSON.stringify({ type, ...data, timestamp: Date.now() });
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }

    // Call this before server restart
    notifyRestart(delayMs = 3000) {
        this.broadcast('restart', { reconnectIn: delayMs });
    }

    stop() {
        this.watchers.forEach(w => w.close());
        this.watchers = [];
        this.wss.close();
        console.log('[HotEngine] Stopped');
    }

    getClientCount() {
        return this.clients.size;
    }
}

module.exports = HotEngine;

