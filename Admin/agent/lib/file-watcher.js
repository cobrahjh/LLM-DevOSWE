/**
 * File Watcher - Real-time file change detection for Dev Tracker
 * Uses chokidar to watch directories and emit events
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class FileWatcher extends EventEmitter {
    constructor(options = {}) {
        super();
        this.watchers = new Map(); // path -> watcher instance
        this.fileChanges = new Map(); // path -> change info
        this.debounceTimers = new Map(); // path -> timer
        this.debounceMs = options.debounceMs || 500;
        this.ignorePatterns = options.ignorePatterns || [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/*.log',
            '**/package-lock.json'
        ];
    }

    /**
     * Start watching a directory
     */
    watch(dirPath, options = {}) {
        if (this.watchers.has(dirPath)) {
            console.log(`[FileWatcher] Already watching: ${dirPath}`);
            return;
        }

        const watchOptions = {
            ignored: this.ignorePatterns,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            },
            ...options
        };

        const watcher = chokidar.watch(dirPath, watchOptions);

        watcher.on('add', (filePath) => this.handleChange('create', filePath));
        watcher.on('change', (filePath) => this.handleChange('modify', filePath));
        watcher.on('unlink', (filePath) => this.handleChange('delete', filePath));
        watcher.on('error', (err) => this.emit('error', err));

        watcher.on('ready', () => {
            console.log(`[FileWatcher] Watching: ${dirPath}`);
            this.emit('ready', dirPath);
        });

        this.watchers.set(dirPath, watcher);
        return watcher;
    }

    /**
     * Stop watching a directory
     */
    async unwatch(dirPath) {
        const watcher = this.watchers.get(dirPath);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(dirPath);
            console.log(`[FileWatcher] Stopped watching: ${dirPath}`);
        }
    }

    /**
     * Stop all watchers
     */
    async unwatchAll() {
        for (const [dirPath, watcher] of this.watchers) {
            await watcher.close();
            console.log(`[FileWatcher] Stopped watching: ${dirPath}`);
        }
        this.watchers.clear();
    }

    /**
     * Handle file change with debouncing
     */
    handleChange(operation, filePath) {
        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Update or create change record
        const existing = this.fileChanges.get(filePath) || {
            path: filePath,
            operations: [],
            firstSeen: Date.now()
        };

        existing.operations.push({
            type: operation,
            timestamp: Date.now()
        });
        existing.lastOperation = operation;
        existing.lastSeen = Date.now();

        this.fileChanges.set(filePath, existing);

        // Debounce before emitting
        const timer = setTimeout(() => {
            this.emitChange(filePath);
        }, this.debounceMs);

        this.debounceTimers.set(filePath, timer);
    }

    /**
     * Emit file change event
     */
    emitChange(filePath) {
        const change = this.fileChanges.get(filePath);
        if (!change) return;

        // Get file stats if file exists
        let stats = null;
        try {
            if (fs.existsSync(filePath)) {
                const fsStat = fs.statSync(filePath);
                stats = {
                    size: fsStat.size,
                    isDirectory: fsStat.isDirectory(),
                    modified: fsStat.mtime.toISOString()
                };
            }
        } catch (err) {
            // File might have been deleted
        }

        const event = {
            path: filePath,
            filename: path.basename(filePath),
            ext: path.extname(filePath),
            dir: path.dirname(filePath),
            operation: change.lastOperation,
            operationCount: change.operations.length,
            stats,
            timestamp: Date.now()
        };

        this.emit('change', event);

        // Clean up
        this.fileChanges.delete(filePath);
        this.debounceTimers.delete(filePath);
    }

    /**
     * Get all pending changes (not yet emitted)
     */
    getPendingChanges() {
        return Array.from(this.fileChanges.values());
    }

    /**
     * Get watched directories
     */
    getWatchedPaths() {
        return Array.from(this.watchers.keys());
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            watching: this.getWatchedPaths(),
            pendingChanges: this.getPendingChanges().length,
            isActive: this.watchers.size > 0
        };
    }
}

module.exports = FileWatcher;
