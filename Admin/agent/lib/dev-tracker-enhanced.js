/**
 * Enhanced Dev Tracker - Full file intelligence system
 * Combines Git tracking, file watching, metrics, and HiveDrop integration
 */

const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const GitTracker = require('./git-tracker');
const FileWatcher = require('./file-watcher');

const HIVE_MESH_HOST = '127.0.0.1';
const HIVE_MESH_PORT = 8750;

class DevTrackerEnhanced {
    constructor(options = {}) {
        this.dataFile = options.dataFile || path.join(__dirname, '../logs/dev-tracker.json');
        this.watchedRepos = new Map(); // repoPath -> GitTracker
        this.fileWatcher = new FileWatcher({
            debounceMs: options.debounceMs || 500
        });
        this.udpSocket = null;
        this.enableHiveDrop = options.enableHiveDrop !== false;
        this.lastCommitHash = new Map(); // repoPath -> hash
        this.activeTaskId = null;
        this.taskFileChanges = []; // Files changed during active task

        this.setupFileWatcher();
        if (this.enableHiveDrop) {
            this.setupUdpBroadcast();
        }
    }

    /**
     * Setup file watcher event handlers
     */
    setupFileWatcher() {
        this.fileWatcher.on('change', (event) => {
            console.log(`[DevTracker] File ${event.operation}: ${event.filename}`);

            // Track file change for active task
            if (this.activeTaskId) {
                this.taskFileChanges.push({
                    ...event,
                    taskId: this.activeTaskId
                });
            }

            // Emit to HiveDrop
            if (this.enableHiveDrop) {
                this.broadcastEvent('devtracker.file', {
                    path: event.path,
                    filename: event.filename,
                    operation: event.operation,
                    size: event.stats?.size,
                    taskId: this.activeTaskId
                });
            }
        });

        this.fileWatcher.on('error', (err) => {
            console.error('[DevTracker] File watcher error:', err.message);
        });
    }

    /**
     * Setup UDP socket for HiveDrop broadcast
     */
    setupUdpBroadcast() {
        try {
            this.udpSocket = dgram.createSocket('udp4');
            this.udpSocket.on('error', (err) => {
                console.error('[DevTracker] UDP error:', err.message);
            });
        } catch (err) {
            console.error('[DevTracker] Failed to create UDP socket:', err.message);
        }
    }

    /**
     * Broadcast event to Hive Mesh
     */
    broadcastEvent(type, payload) {
        if (!this.udpSocket) return;

        const event = {
            type,
            timestamp: Date.now(),
            source: 'devtracker',
            payload
        };

        const message = Buffer.from(JSON.stringify(event));

        try {
            this.udpSocket.send(message, HIVE_MESH_PORT, HIVE_MESH_HOST);
            this.udpSocket.send(message, HIVE_MESH_PORT, '192.168.1.192'); // ROCK-PC
        } catch (err) {
            // Silent fail for UDP
        }
    }

    /**
     * Load tracker data
     */
    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                return JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
            }
        } catch (err) {
            console.error('[DevTracker] Failed to load data:', err.message);
        }
        return { version: '2.0.0', days: {}, totals: {} };
    }

    /**
     * Save tracker data
     */
    saveData(data) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.dataFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('[DevTracker] Failed to save data:', err.message);
        }
    }

    /**
     * Start watching a repository
     */
    watchRepo(repoPath) {
        // Normalize path for Windows
        const normalizedPath = path.resolve(repoPath);

        if (this.watchedRepos.has(normalizedPath)) return true;

        const git = new GitTracker(normalizedPath);
        if (!git.isGitRepo()) {
            console.warn(`[DevTracker] Not a git repo: ${normalizedPath}`);
            return false;
        }

        this.watchedRepos.set(normalizedPath, git);
        this.lastCommitHash.set(normalizedPath, git.execGit('rev-parse --short HEAD'));

        // Start file watching
        this.fileWatcher.watch(normalizedPath);

        console.log(`[DevTracker] Now tracking repo: ${normalizedPath}`);
        return true;
    }

    /**
     * Stop watching a repository
     */
    async unwatchRepo(repoPath) {
        this.watchedRepos.delete(repoPath);
        this.lastCommitHash.delete(repoPath);
        await this.fileWatcher.unwatch(repoPath);
    }

    /**
     * Start a new task
     */
    startTask(title, options = {}) {
        const taskId = `task-${Date.now()}`;
        this.activeTaskId = taskId;
        this.taskFileChanges = [];

        const data = this.loadData();
        const today = new Date().toISOString().split('T')[0];

        if (!data.days[today]) {
            data.days[today] = { date: today, tasks: [], summary: {} };
        }

        const task = {
            id: taskId,
            time: new Date().toTimeString().slice(0, 5),
            title,
            description: options.description || '',
            category: options.category || 'feature',
            status: 'in_progress',
            startedAt: new Date().toISOString(),
            files: [],
            metrics: {},
            commit: null
        };

        data.days[today].tasks.push(task);
        this.saveData(data);

        this.broadcastEvent('devtracker.task.started', {
            taskId,
            title,
            timestamp: task.startedAt
        });

        return task;
    }

    /**
     * Complete the active task with file and git info
     */
    completeTask(options = {}) {
        if (!this.activeTaskId) {
            console.warn('[DevTracker] No active task to complete');
            return null;
        }

        const data = this.loadData();
        const today = new Date().toISOString().split('T')[0];
        const dayData = data.days[today];

        if (!dayData) return null;

        const taskIndex = dayData.tasks.findIndex(t => t.id === this.activeTaskId);
        if (taskIndex === -1) return null;

        const task = dayData.tasks[taskIndex];

        // Gather file information
        const filesWithDiffs = this.getEnhancedFileInfo();
        task.files = filesWithDiffs;

        // Calculate metrics
        task.metrics = this.calculateMetrics(filesWithDiffs);

        // Get latest commit if available
        for (const [repoPath, git] of this.watchedRepos) {
            const newCommit = git.checkForNewCommit(this.lastCommitHash.get(repoPath));
            if (newCommit) {
                task.commit = newCommit;
                this.lastCommitHash.set(repoPath, newCommit.hash);
                break;
            }
        }

        // Update task
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.duration = options.duration || this.calculateDuration(task.startedAt, task.completedAt);

        // Update summary
        this.updateDaySummary(dayData);
        this.saveData(data);

        // Broadcast completion
        this.broadcastEvent('devtracker.task.completed', {
            taskId: task.id,
            title: task.title,
            metrics: task.metrics,
            commit: task.commit,
            filesChanged: task.files.length
        });

        this.activeTaskId = null;
        this.taskFileChanges = [];

        return task;
    }

    /**
     * Get enhanced file info with git diffs
     */
    getEnhancedFileInfo() {
        const files = [];
        const seenPaths = new Set();

        // From task file changes (real-time watching)
        for (const change of this.taskFileChanges) {
            if (seenPaths.has(change.path)) continue;
            seenPaths.add(change.path);

            const fileInfo = {
                path: change.path,
                filename: change.filename,
                ext: change.ext,
                operation: change.operation,
                size: change.stats?.size || 0,
                linesAdded: 0,
                linesRemoved: 0
            };

            // Get git diff for this file
            for (const [repoPath, git] of this.watchedRepos) {
                if (change.path.startsWith(repoPath)) {
                    const diff = git.getFileDiff(path.relative(repoPath, change.path));
                    fileInfo.linesAdded = diff.linesAdded;
                    fileInfo.linesRemoved = diff.linesRemoved;
                    fileInfo.status = diff.status;
                    break;
                }
            }

            files.push(fileInfo);
        }

        // Also check git for any missed changes
        for (const [repoPath, git] of this.watchedRepos) {
            const gitChanges = git.getChangedFiles();
            for (const change of gitChanges) {
                const fullPath = path.join(repoPath, change.path);
                if (seenPaths.has(fullPath)) continue;
                seenPaths.add(fullPath);

                files.push({
                    path: fullPath,
                    filename: path.basename(change.path),
                    ext: path.extname(change.path),
                    operation: change.status,
                    linesAdded: change.linesAdded,
                    linesRemoved: change.linesRemoved,
                    status: change.status
                });
            }
        }

        return files;
    }

    /**
     * Calculate metrics from file changes
     */
    calculateMetrics(files) {
        return {
            totalLinesAdded: files.reduce((sum, f) => sum + (f.linesAdded || 0), 0),
            totalLinesRemoved: files.reduce((sum, f) => sum + (f.linesRemoved || 0), 0),
            filesCreated: files.filter(f => f.operation === 'create' || f.status === 'added').length,
            filesModified: files.filter(f => f.operation === 'modify' || f.status === 'modified').length,
            filesDeleted: files.filter(f => f.operation === 'delete' || f.status === 'deleted').length,
            totalFiles: files.length
        };
    }

    /**
     * Calculate duration in minutes
     */
    calculateDuration(startedAt, completedAt) {
        const start = new Date(startedAt);
        const end = new Date(completedAt);
        return Math.round((end - start) / 60000);
    }

    /**
     * Update day summary
     */
    updateDaySummary(dayData) {
        const tasks = dayData.tasks;
        dayData.summary = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            features: tasks.filter(t => t.category === 'feature').length,
            bugfixes: tasks.filter(t => t.category === 'bugfix').length,
            refactors: tasks.filter(t => t.category === 'refactor').length,
            docs: tasks.filter(t => t.category === 'docs').length,
            totalDuration: tasks.reduce((sum, t) => sum + (t.duration || 0), 0),
            totalLinesAdded: tasks.reduce((sum, t) => sum + (t.metrics?.totalLinesAdded || 0), 0),
            totalLinesRemoved: tasks.reduce((sum, t) => sum + (t.metrics?.totalLinesRemoved || 0), 0),
            totalFilesChanged: tasks.reduce((sum, t) => sum + (t.files?.length || 0), 0)
        };
    }

    /**
     * Auto-log a task (for backward compatibility with existing agent-server)
     */
    autoLogTask(title, options = {}) {
        const task = this.startTask(title, options);
        return this.completeTask({ duration: options.duration || 10 });
    }

    /**
     * Get all data
     */
    getData() {
        return this.loadData();
    }

    /**
     * Get today's data
     */
    getToday() {
        const data = this.loadData();
        const today = new Date().toISOString().split('T')[0];
        return data.days[today] || { date: today, tasks: [], summary: {} };
    }

    /**
     * Get aggregate metrics
     */
    getAggregateMetrics() {
        const data = this.loadData();
        const metrics = {
            totalDays: Object.keys(data.days).length,
            totalTasks: 0,
            totalLinesAdded: 0,
            totalLinesRemoved: 0,
            totalFilesChanged: 0,
            totalDuration: 0,
            byCategory: { feature: 0, bugfix: 0, refactor: 0, docs: 0 }
        };

        for (const day of Object.values(data.days)) {
            for (const task of day.tasks || []) {
                metrics.totalTasks++;
                metrics.totalLinesAdded += task.metrics?.totalLinesAdded || 0;
                metrics.totalLinesRemoved += task.metrics?.totalLinesRemoved || 0;
                metrics.totalFilesChanged += task.files?.length || 0;
                metrics.totalDuration += task.duration || 0;
                if (task.category && metrics.byCategory[task.category] !== undefined) {
                    metrics.byCategory[task.category]++;
                }
            }
        }

        return metrics;
    }

    /**
     * Get recent commits across all watched repos
     */
    getRecentCommits(count = 20) {
        const commits = [];

        for (const [repoPath, git] of this.watchedRepos) {
            const repoCommits = git.getRecentCommits(count);
            for (const commit of repoCommits) {
                commits.push({
                    ...commit,
                    repo: path.basename(repoPath)
                });
            }
        }

        // Sort by timestamp descending
        commits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return commits.slice(0, count);
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            activeTask: this.activeTaskId,
            watchedRepos: Array.from(this.watchedRepos.keys()),
            fileWatcher: this.fileWatcher.getStatus(),
            pendingFileChanges: this.taskFileChanges.length,
            hiveDrop: this.enableHiveDrop
        };
    }

    /**
     * Cleanup
     */
    async shutdown() {
        await this.fileWatcher.unwatchAll();
        if (this.udpSocket) {
            this.udpSocket.close();
        }
    }
}

module.exports = DevTrackerEnhanced;
