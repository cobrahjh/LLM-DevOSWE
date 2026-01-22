/**
 * File State Tracker - Shared library for Hive AI services
 *
 * Reports file operations to Relay API for session tracking.
 *
 * Usage:
 *   const FileTracker = require('./file-tracker');
 *   const tracker = new FileTracker('kitt-session-001');
 *
 *   tracker.read('/path/to/file.js');
 *   tracker.edit('/path/to/file.js', { lines_changed: 10 });
 *   tracker.create('/path/to/new-file.js');
 *   tracker.write('/path/to/file.js', { file_size: 1024 });
 */

const http = require('http');

class FileTracker {
    constructor(sessionId, options = {}) {
        this.sessionId = sessionId || `hive-${Date.now()}`;
        this.relayUrl = options.relayUrl || process.env.RELAY_URL || 'http://127.0.0.1:8600';
        this.source = options.source || 'hive-service';
        this.enabled = options.enabled !== false;
        this.queue = [];
        this.flushing = false;
    }

    /**
     * Report a file read operation
     */
    read(filePath, metadata = {}) {
        return this._report(filePath, 'read', metadata);
    }

    /**
     * Report a file edit operation
     */
    edit(filePath, metadata = {}) {
        return this._report(filePath, 'edit', metadata);
    }

    /**
     * Report a file create operation
     */
    create(filePath, metadata = {}) {
        return this._report(filePath, 'create', metadata);
    }

    /**
     * Report a file write operation
     */
    write(filePath, metadata = {}) {
        return this._report(filePath, 'write', metadata);
    }

    /**
     * Report a file delete operation
     */
    delete(filePath, metadata = {}) {
        return this._report(filePath, 'delete', metadata);
    }

    /**
     * Internal: report operation to Relay
     */
    _report(filePath, operation, metadata = {}) {
        if (!this.enabled) return Promise.resolve();

        const payload = {
            session_id: this.sessionId,
            file_path: filePath,
            operation: operation,
            file_size: metadata.file_size || null,
            lines_changed: metadata.lines_changed || null,
            hash: metadata.hash || null,
            metadata: {
                ...metadata,
                source: this.source,
                timestamp: new Date().toISOString()
            }
        };

        return this._send(payload);
    }

    /**
     * Internal: send to Relay API
     */
    _send(payload) {
        return new Promise((resolve) => {
            const data = JSON.stringify(payload);
            const url = new URL(`${this.relayUrl}/api/session/files`);

            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                resolve(true);
            });

            req.on('error', () => {
                resolve(false); // Silent fail
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Create or update the session in Relay
     */
    async createSession(name, description = '', tags = []) {
        const payload = {
            id: this.sessionId,
            name: name,
            description: description,
            tags: tags
        };

        return new Promise((resolve) => {
            const data = JSON.stringify(payload);
            const url = new URL(`${this.relayUrl}/api/sessions`);

            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve({ success: false });
                    }
                });
            });

            req.on('error', () => resolve({ success: false }));
            req.write(data);
            req.end();
        });
    }

    /**
     * End the session
     */
    async endSession() {
        return new Promise((resolve) => {
            const url = new URL(`${this.relayUrl}/api/sessions/${this.sessionId}/end`);

            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST'
            }, (res) => {
                resolve(true);
            });

            req.on('error', () => resolve(false));
            req.end();
        });
    }
}

module.exports = FileTracker;
