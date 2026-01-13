/**
 * Hot Reload Module for SimWidget Engine v1.1.0
 * Last Updated: 2026-01-09
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class HotReloadManager {
    constructor() {
        this.clients = new Set();
        this.isEnabled = process.env.NODE_ENV === 'development' || process.env.HOT_RELOAD === 'true';
        this.watcher = null;
        
        if (this.isEnabled) {
            console.log('🔥 Hot reload enabled');
            this.setupFileWatcher();
        }
    }
    
    setupFileWatcher() {
        const watchPaths = [
            path.join(__dirname, '../ui/**/*'),
            path.join(__dirname, '../config/**/*'),
            path.join(__dirname, '../shared-ui/**/*')
        ];
        
        this.watcher = chokidar.watch(watchPaths, {
            ignored: /node_modules|\.git|\.log$/,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
        });
        
        this.watcher.on('change', (filePath) => {
            this.notifyClients('file-changed', { 
                path: this.getRelativePath(filePath),
                type: this.getFileType(filePath),
                timestamp: Date.now()
            });
        });
        
        this.watcher.on('add', (filePath) => {
            this.notifyClients('file-added', { 
                path: this.getRelativePath(filePath),
                type: this.getFileType(filePath),
                timestamp: Date.now()
            });
        });
        
        this.watcher.on('unlink', (filePath) => {
            this.notifyClients('file-deleted', { 
                path: this.getRelativePath(filePath),
                timestamp: Date.now()
            });
        });
        
        console.log('📁 Watching files:', watchPaths.map(p => p.replace(__dirname, '.')));
    }
    
    getRelativePath(filePath) {
        return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
    }
    
    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.html': return 'html';
            case '.css': return 'css';
            case '.js': return 'javascript';
            case '.json': return 'json';
            default: return 'other';
        }
    }
    
    addClient(ws) {
        if (!this.isEnabled) return;
        this.clients.add(ws);
        ws.send(JSON.stringify({ type: 'hot-reload-connected', message: 'Hot reload active', timestamp: Date.now() }));
        ws.on('close', () => { this.clients.delete(ws); });
        console.log(`🔥 Hot reload client connected (${this.clients.size} total)`);
    }
    
    notifyClients(eventType, data) {
        if (!this.isEnabled || this.clients.size === 0) return;
        const message = JSON.stringify({ type: eventType, ...data });
        const closedClients = [];
        for (const client of this.clients) {
            try {
                if (client.readyState === client.OPEN) {
                    client.send(message);
                } else {
                    closedClients.push(client);
                }
            } catch (error) {
                closedClients.push(client);
            }
        }
        closedClients.forEach(client => this.clients.delete(client));
        console.log(`🔄 File changed: ${data.path} (notified ${this.clients.size} clients)`);
    }
    
    getStatus() {
        return { enabled: this.isEnabled, clients: this.clients.size, watching: this.watcher ? true : false };
    }
    
    destroy() {
        if (this.watcher) this.watcher.close();
        this.clients.clear();
    }
}

function getHotReloadScript() {
    if (process.env.NODE_ENV !== 'development' && process.env.HOT_RELOAD !== 'true') return '';
    return `<script>
(function() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws, reconnectAttempts = 0;
    function connect() {
        ws = new WebSocket(protocol + '//' + window.location.host);
        ws.onopen = () => { reconnectAttempts = 0; };
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'file-changed' || data.type === 'file-added' || data.type === 'file-deleted') {
                if (data.type === 'css') {
                    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                        const url = new URL(l.href); url.searchParams.set('v', Date.now()); l.href = url.toString();
                    });
                } else {
                    window.location.reload();
                }
            }
        };
        ws.onclose = () => { if (reconnectAttempts++ < 5) setTimeout(connect, 2000 * reconnectAttempts); };
    }
    connect();
})();
</script>`;
}

module.exports = { HotReloadManager, getHotReloadScript };
