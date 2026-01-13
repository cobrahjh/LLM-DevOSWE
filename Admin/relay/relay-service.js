/**
 * SimWidget Relay Service v3.0.0
 *
 * REDESIGNED: Direct Claude Code polling (no consumer process needed)
 *
 * Features:
 *   - SQLite persistence (tasks.db)
 *   - Server-side timeout enforcement (5min pending, 30min processing)
 *   - Consumer heartbeat tracking
 *   - Dead letter queue for failed tasks
 *   - Retry logic with exponential backoff
 *   - WebSocket for real-time events
 *
 * WebSocket Events:
 *   task:created    - New task added
 *   task:processing - Consumer picked up task
 *   task:completed  - Task finished with response
 *   task:failed     - Task failed/moved to dead letter
 *   task:retrying   - Task being retried
 *   consumer:online - Consumer connected
 *   consumer:offline- Consumer disconnected
 *
 * Flow (Direct - no consumer):
 *   Phone → Agent Kitt → Relay → [Claude Code polls] → Response → Relay → Agent Kitt
 *
 * Direct API for Claude Code:
 *   GET  /api/messages/pending     - Check for pending messages
 *   POST /api/messages/:id/claim   - Claim a message (mark processing)
 *   POST /api/messages/:id/respond - Complete with response
 *
 * Message Protection:
 *   - Pending/processing messages cannot be deleted without ?force=true
 *   - Cleanup only removes completed/failed tasks
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\relay-service.js
 * Last Updated: 2026-01-12
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const app = express();
const PORT = 8600;
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });
const wsClients = new Set();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // Serve static files (task-history.html)

// ============================================
// DATABASE SETUP
// ============================================

const DB_FILE = path.join(__dirname, 'tasks.db');
const LOG_FILE = path.join(__dirname, 'relay.log');

let db;

function initDatabase() {
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL'); // Better crash recovery

    // Main tasks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'normal',
            consumer_id TEXT,
            created_at INTEGER NOT NULL,
            processing_at INTEGER,
            completed_at INTEGER,
            response TEXT,
            error TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            crossed INTEGER DEFAULT 0,
            notes TEXT
        )
    `);

    // Add crossed and notes columns if they don't exist (migration)
    try {
        db.exec(`ALTER TABLE tasks ADD COLUMN crossed INTEGER DEFAULT 0`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'write'`);
    } catch (e) { /* column exists */ }

    // Dead letter queue
    db.exec(`
        CREATE TABLE IF NOT EXISTS dead_letters (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            failed_at INTEGER NOT NULL,
            original_content TEXT
        )
    `);

    // Consumer heartbeats
    db.exec(`
        CREATE TABLE IF NOT EXISTS consumers (
            id TEXT PRIMARY KEY,
            name TEXT,
            last_heartbeat INTEGER NOT NULL,
            current_task_id TEXT,
            tasks_completed INTEGER DEFAULT 0
        )
    `);

    // Indexes for performance
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)`);

    // Team tasks table (voice-based task assignment)
    db.exec(`
        CREATE TABLE IF NOT EXISTS team_tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            summary TEXT,
            assignee TEXT NOT NULL,
            assignee_name TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT DEFAULT 'assigned',
            created_at INTEGER NOT NULL,
            acknowledged_at INTEGER,
            completed_at INTEGER,
            completion_summary TEXT,
            questions TEXT DEFAULT '[]'
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON team_tasks(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_team_tasks_assignee ON team_tasks(assignee)`);

    // Conversation logs table (voice persona speech history)
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            persona TEXT NOT NULL,
            text TEXT NOT NULL,
            spoken_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_conversation_logs_persona ON conversation_logs(persona)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_conversation_logs_spoken ON conversation_logs(spoken_at DESC)`);

    log(`Database initialized: ${DB_FILE}`);
}

// ============================================
// CONSTANTS
// ============================================

const STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    RETRYING: 'retrying'
};

const TASK_TYPE = {
    READ_ONLY: 'read_only',    // Research, questions, analysis - can run in parallel
    WRITE: 'write'             // File modifications - serialized via file lock
};

// ============================================
// TASK CLASSIFIER
// ============================================

// Keywords indicating file modification intent
const WRITE_KEYWORDS = [
    'create', 'write', 'edit', 'modify', 'update', 'change', 'add', 'remove',
    'delete', 'fix', 'implement', 'refactor', 'build', 'install', 'make',
    'commit', 'push', 'save', 'generate', 'rename', 'move', 'copy',
    'br ', 'ntt', 'mem ', 'mst', // User shortcuts that modify files
    'todo', 'feature', 'bug fix', 'patch'
];

// Keywords indicating read-only intent
const READ_KEYWORDS = [
    'what', 'where', 'how', 'why', 'explain', 'describe', 'show', 'find',
    'search', 'look', 'check', 'status', 'list', 'get', 'read', 'view',
    'analyze', 'review', 'understand', 'tell me', 'help me understand',
    'idt', 'chk', 'psreflect' // User shortcuts for reading/analysis
];

function classifyTask(content) {
    const lower = content.toLowerCase();

    // Check for explicit read-only patterns first
    for (const keyword of READ_KEYWORDS) {
        if (lower.startsWith(keyword) || lower.includes(` ${keyword} `)) {
            // But check if it also has write intent
            let hasWriteIntent = false;
            for (const wk of WRITE_KEYWORDS) {
                if (lower.includes(wk)) {
                    hasWriteIntent = true;
                    break;
                }
            }
            if (!hasWriteIntent) {
                return TASK_TYPE.READ_ONLY;
            }
        }
    }

    // Check for write patterns
    for (const keyword of WRITE_KEYWORDS) {
        if (lower.includes(keyword)) {
            return TASK_TYPE.WRITE;
        }
    }

    // Default to write (safer - ensures file integrity)
    return TASK_TYPE.WRITE;
}

// ============================================
// FILE LOCK MANAGEMENT
// ============================================

// In-memory file lock (persisted in DB for crash recovery)
let fileLock = {
    heldBy: null,
    taskId: null,
    acquiredAt: null
};

function initFileLock() {
    // Create file_lock table for persistence
    db.exec(`
        CREATE TABLE IF NOT EXISTS file_lock (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            held_by TEXT,
            task_id TEXT,
            acquired_at INTEGER
        )
    `);

    // Initialize single row if not exists
    db.prepare(`INSERT OR IGNORE INTO file_lock (id) VALUES (1)`).run();

    // Load existing lock state
    const lock = db.prepare(`SELECT * FROM file_lock WHERE id = 1`).get();
    if (lock && lock.held_by) {
        // Check if lock is stale (older than 15 minutes)
        if (lock.acquired_at && (Date.now() - lock.acquired_at) > 15 * 60 * 1000) {
            log(`Releasing stale file lock held by ${lock.held_by}`, 'WARN');
            releaseFileLock(lock.held_by);
        } else {
            fileLock = {
                heldBy: lock.held_by,
                taskId: lock.task_id,
                acquiredAt: lock.acquired_at
            };
            log(`Restored file lock: held by ${lock.held_by} for task ${lock.task_id}`);
        }
    }
}

function acquireFileLock(consumerId, taskId) {
    if (fileLock.heldBy && fileLock.heldBy !== consumerId) {
        return false; // Lock held by another consumer
    }

    fileLock = {
        heldBy: consumerId,
        taskId: taskId,
        acquiredAt: Date.now()
    };

    // Persist to DB
    db.prepare(`
        UPDATE file_lock SET held_by = ?, task_id = ?, acquired_at = ? WHERE id = 1
    `).run(consumerId, taskId, fileLock.acquiredAt);

    log(`File lock acquired by ${consumerId} for task ${taskId}`);
    broadcast('filelock:acquired', { consumerId, taskId });
    return true;
}

function releaseFileLock(consumerId) {
    if (fileLock.heldBy !== consumerId) {
        return false; // Not holding the lock
    }

    const taskId = fileLock.taskId;
    fileLock = { heldBy: null, taskId: null, acquiredAt: null };

    // Clear in DB
    db.prepare(`
        UPDATE file_lock SET held_by = NULL, task_id = NULL, acquired_at = NULL WHERE id = 1
    `).run();

    log(`File lock released by ${consumerId}`);
    broadcast('filelock:released', { consumerId, taskId });
    return true;
}

function getFileLockStatus() {
    return { ...fileLock };
}

const TIMEOUTS = {
    PENDING_PICKUP: 5 * 60 * 1000,       // 5 minutes to get picked up
    PROCESSING: 10 * 60 * 1000,          // 10 minutes max processing (reduced from 30)
    CONSUMER_HEARTBEAT: 60 * 1000,       // 60 seconds heartbeat deadline
    RETRY_BACKOFF: [30000, 60000, 120000] // 30s, 60s, 120s
};

// ============================================
// LOGGING
// ============================================

function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] ${message}`;
    console.log(entry);
    try {
        fs.appendFileSync(LOG_FILE, entry + '\n');
    } catch (e) {}
}

// ============================================
// WEBSOCKET HANDLERS
// ============================================

wss.on('connection', (ws, req) => {
    const clientId = req.headers['x-client-id'] || generateId();
    ws.clientId = clientId;
    wsClients.add(ws);
    log(`WebSocket client connected: ${clientId} (${wsClients.size} total)`);

    // Send current state on connect
    ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: Date.now()
    }));

    ws.on('close', () => {
        wsClients.delete(ws);
        log(`WebSocket client disconnected: ${clientId} (${wsClients.size} total)`);
    });

    ws.on('error', (err) => {
        log(`WebSocket error for ${clientId}: ${err.message}`, 'ERROR');
        wsClients.delete(ws);
    });
});

// Broadcast event to all connected clients
function broadcast(event, data) {
    const message = JSON.stringify({ type: event, data, timestamp: Date.now() });
    let sent = 0;
    for (const client of wsClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sent++;
        }
    }
    if (sent > 0) {
        log(`Broadcast ${event} to ${sent} clients`);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Migrate from old queue.json if exists
function migrateFromJson() {
    const QUEUE_FILE = path.join(__dirname, 'queue.json');
    if (fs.existsSync(QUEUE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
            const insert = db.prepare(`
                INSERT OR IGNORE INTO tasks (id, session_id, content, status, created_at, processing_at, completed_at, response)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            let migrated = 0;
            for (const [id, msg] of Object.entries(data)) {
                insert.run(
                    id,
                    msg.sessionId || 'default',
                    msg.message,
                    msg.status,
                    msg.createdAt,
                    msg.processingAt || null,
                    msg.respondedAt || null,
                    msg.response || null
                );
                migrated++;
            }

            // Rename old file
            fs.renameSync(QUEUE_FILE, QUEUE_FILE + '.migrated');
            log(`Migrated ${migrated} messages from queue.json to SQLite`);
        } catch (err) {
            log(`Migration failed: ${err.message}`, 'ERROR');
        }
    }
}

// ============================================
// TIMEOUT ENFORCEMENT
// ============================================

function enforceTimeouts() {
    const now = Date.now();

    // Timeout pending tasks (not picked up in 5 minutes)
    const pendingTimeout = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'pending'
        AND created_at < ?
    `).all(now - TIMEOUTS.PENDING_PICKUP);

    for (const task of pendingTimeout) {
        if (task.retry_count < task.max_retries) {
            // Retry
            const backoffIndex = Math.min(task.retry_count, TIMEOUTS.RETRY_BACKOFF.length - 1);
            db.prepare(`
                UPDATE tasks SET status = 'retrying', retry_count = retry_count + 1
                WHERE id = ?
            `).run(task.id);
            log(`Task ${task.id} pending timeout - retry ${task.retry_count + 1}/${task.max_retries}`);

            // Schedule retry (set back to pending after backoff)
            setTimeout(() => {
                db.prepare(`UPDATE tasks SET status = 'pending' WHERE id = ? AND status = 'retrying'`).run(task.id);
                log(`Task ${task.id} retrying now`);
            }, TIMEOUTS.RETRY_BACKOFF[backoffIndex]);
        } else {
            // Move to dead letter
            moveToDeadLetter(task, 'Pending timeout - max retries exceeded');
        }
    }

    // Timeout processing tasks (taking too long)
    const processingTimeout = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'processing'
        AND processing_at < ?
    `).all(now - TIMEOUTS.PROCESSING);

    for (const task of processingTimeout) {
        if (task.retry_count < task.max_retries) {
            db.prepare(`
                UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL, retry_count = retry_count + 1
                WHERE id = ?
            `).run(task.id);
            log(`Task ${task.id} processing timeout - returned to queue (retry ${task.retry_count + 1})`);
        } else {
            moveToDeadLetter(task, 'Processing timeout - max retries exceeded');
        }
    }

    // Check for dead consumers (missed heartbeat)
    const deadConsumers = db.prepare(`
        SELECT * FROM consumers
        WHERE last_heartbeat < ?
        AND current_task_id IS NOT NULL
    `).all(now - TIMEOUTS.CONSUMER_HEARTBEAT);

    for (const consumer of deadConsumers) {
        // Release their task back to pending
        db.prepare(`
            UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL
            WHERE id = ? AND status = 'processing'
        `).run(consumer.current_task_id);

        db.prepare(`UPDATE consumers SET current_task_id = NULL WHERE id = ?`).run(consumer.id);
        log(`Consumer ${consumer.id} dead - released task ${consumer.current_task_id}`);
    }
}

function moveToDeadLetter(task, reason) {
    db.prepare(`
        INSERT INTO dead_letters (id, task_id, reason, failed_at, original_content)
        VALUES (?, ?, ?, ?, ?)
    `).run(generateId(), task.id, reason, Date.now(), task.content);

    db.prepare(`UPDATE tasks SET status = 'failed', error = ? WHERE id = ?`).run(reason, task.id);
    log(`Task ${task.id} moved to dead letter: ${reason}`, 'WARN');
}

// Run timeout checks every 30 seconds
setInterval(enforceTimeouts, 30 * 1000);

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    const stats = db.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
            COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) as processing,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
            COUNT(*) as total
        FROM tasks
    `).get();

    const consumers = db.prepare(`SELECT COUNT(*) as count FROM consumers WHERE last_heartbeat > ?`).get(Date.now() - TIMEOUTS.CONSUMER_HEARTBEAT);
    const deadLetters = db.prepare(`SELECT COUNT(*) as count FROM dead_letters`).get();

    res.json({
        status: 'ok',
        service: 'SimWidget Relay',
        version: '3.0.0',
        queue: stats,
        activeConsumers: consumers.count,
        deadLetters: deadLetters.count
    });
});

// Create new task (Agent sends message)
app.post('/api/queue', (req, res) => {
    const { message, sessionId, context, priority, taskType } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    const id = generateId();
    const createdAt = Date.now();

    // Classify task type (can be overridden by explicit taskType)
    const classifiedType = taskType || classifyTask(message);

    db.prepare(`
        INSERT INTO tasks (id, session_id, content, status, priority, created_at, task_type)
        VALUES (?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, sessionId || 'default', message, priority || 'normal', createdAt, classifiedType);

    log(`New task queued: ${id} [${classifiedType}] from session ${sessionId || 'default'}`);

    // Broadcast task:created event
    broadcast('task:created', {
        id,
        sessionId: sessionId || 'default',
        content: message,
        status: 'pending',
        priority: priority || 'normal',
        taskType: classifiedType,
        createdAt
    });

    res.json({
        success: true,
        messageId: id,
        status: STATUS.PENDING,
        taskType: classifiedType,
        pollUrl: `/api/queue/${id}`
    });
});

// List pending tasks (READ-ONLY - no auto-claim, use /api/messages/:id/claim instead)
app.get('/api/queue/pending', (req, res) => {
    // Get all pending sorted by priority then time
    const pending = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'pending'
        ORDER BY
            CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            created_at ASC
    `).all();

    res.json({
        pending: pending.map(m => ({
            id: m.id,
            sessionId: m.session_id,
            message: m.content,
            createdAt: m.created_at,
            priority: m.priority,
            age: Math.round((Date.now() - m.created_at) / 1000) + 's'
        })),
        count: pending.length,
        hint: 'Use POST /api/messages/:id/claim to claim a message'
    });
});

// Consumer heartbeat
app.post('/api/consumer/heartbeat', (req, res) => {
    const { consumerId, taskId, progress } = req.body;

    if (!consumerId) {
        return res.status(400).json({ error: 'consumerId required' });
    }

    db.prepare(`
        INSERT INTO consumers (id, name, last_heartbeat, current_task_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET last_heartbeat = ?, current_task_id = ?
    `).run(consumerId, consumerId, Date.now(), taskId || null, Date.now(), taskId || null);

    res.json({ success: true, timestamp: Date.now() });
});

// Consumer registration
app.post('/api/consumer/register', (req, res) => {
    const { consumerId, name } = req.body;

    if (!consumerId) {
        return res.status(400).json({ error: 'consumerId required' });
    }

    db.prepare(`
        INSERT INTO consumers (id, name, last_heartbeat, current_task_id, tasks_completed)
        VALUES (?, ?, ?, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET name = ?, last_heartbeat = ?
    `).run(consumerId, name || consumerId, Date.now(), name || consumerId, Date.now());

    log(`Consumer registered: ${consumerId} (${name || consumerId})`);
    broadcast('consumer:online', { consumerId, name: name || consumerId });

    res.json({ success: true, consumerId });
});

// Consumer unregister
app.post('/api/consumer/unregister', (req, res) => {
    const { consumerId } = req.body;

    if (!consumerId) {
        return res.status(400).json({ error: 'consumerId required' });
    }

    // Release any task the consumer had
    const consumer = db.prepare(`SELECT * FROM consumers WHERE id = ?`).get(consumerId);
    if (consumer && consumer.current_task_id) {
        db.prepare(`
            UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL
            WHERE id = ? AND status = 'processing'
        `).run(consumer.current_task_id);
        log(`Consumer ${consumerId} unregistered - released task ${consumer.current_task_id}`);
    }

    db.prepare(`UPDATE consumers SET current_task_id = NULL WHERE id = ?`).run(consumerId);

    broadcast('consumer:offline', { consumerId });
    res.json({ success: true });
});

// Get next available task (for v2 consumer) - with file lock support
app.get('/api/tasks/next', (req, res) => {
    const consumerId = req.query.consumerId || req.headers['x-consumer-id'];
    const preferReadOnly = req.query.preferReadOnly === 'true';

    // Get all pending tasks sorted by priority then time
    const pendingTasks = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'pending'
        ORDER BY
            CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            created_at ASC
    `).all();

    if (pendingTasks.length === 0) {
        return res.json({ task: null, fileLock: getFileLockStatus() });
    }

    // Find an eligible task
    let selectedTask = null;

    for (const task of pendingTasks) {
        const taskType = task.task_type || TASK_TYPE.WRITE;

        if (taskType === TASK_TYPE.READ_ONLY) {
            // Read-only tasks can always be picked up
            selectedTask = task;
            break;
        } else {
            // Write task - need to check/acquire file lock
            if (fileLock.heldBy === null || fileLock.heldBy === consumerId) {
                // Lock available or already held by this consumer
                if (acquireFileLock(consumerId, task.id)) {
                    selectedTask = task;
                    break;
                }
            }
            // Lock held by another consumer - skip write tasks, look for read-only
            if (preferReadOnly) continue;
        }
    }

    // If no task found and preferReadOnly was set, try again without preference
    if (!selectedTask && preferReadOnly) {
        for (const task of pendingTasks) {
            const taskType = task.task_type || TASK_TYPE.WRITE;
            if (taskType === TASK_TYPE.WRITE) {
                if (fileLock.heldBy === null || fileLock.heldBy === consumerId) {
                    if (acquireFileLock(consumerId, task.id)) {
                        selectedTask = task;
                        break;
                    }
                }
            }
        }
    }

    if (!selectedTask) {
        // All pending tasks are write tasks and lock is held by another consumer
        return res.json({
            task: null,
            reason: 'file_lock_held',
            fileLock: getFileLockStatus(),
            pendingWriteTasks: pendingTasks.filter(t => (t.task_type || TASK_TYPE.WRITE) === TASK_TYPE.WRITE).length
        });
    }

    // Mark as processing
    db.prepare(`
        UPDATE tasks SET status = 'processing', processing_at = ?, consumer_id = ?
        WHERE id = ?
    `).run(Date.now(), consumerId || null, selectedTask.id);

    // Update consumer tracking
    if (consumerId) {
        db.prepare(`
            INSERT INTO consumers (id, name, last_heartbeat, current_task_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET last_heartbeat = ?, current_task_id = ?
        `).run(consumerId, consumerId, Date.now(), selectedTask.id, Date.now(), selectedTask.id);
    }

    const taskType = selectedTask.task_type || TASK_TYPE.WRITE;
    log(`Task ${selectedTask.id} [${taskType}] picked up by ${consumerId || 'unknown'}`);

    // Broadcast task:processing event
    broadcast('task:processing', {
        id: selectedTask.id,
        sessionId: selectedTask.session_id,
        taskType: taskType,
        consumerId: consumerId || null,
        processingAt: Date.now()
    });

    res.json({
        task: {
            id: selectedTask.id,
            session_id: selectedTask.session_id,
            content: selectedTask.content,
            priority: selectedTask.priority,
            task_type: taskType,
            created_at: selectedTask.created_at
        },
        fileLock: taskType === TASK_TYPE.WRITE ? getFileLockStatus() : null
    });
});

// Complete a task (for v2 consumer)
app.post('/api/tasks/:id/complete', (req, res) => {
    const { id } = req.params;
    const { response, consumerId, error } = req.body;

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const taskType = task.task_type || TASK_TYPE.WRITE;

    if (error) {
        // Handle error
        if (task.retry_count < task.max_retries) {
            db.prepare(`
                UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL, retry_count = retry_count + 1, error = ?
                WHERE id = ?
            `).run(error, id);
            log(`Task ${id} failed, retrying: ${error}`);
            broadcast('task:retrying', { id, error, retryCount: task.retry_count + 1 });
        } else {
            moveToDeadLetter(task, error);
            broadcast('task:failed', { id, error, movedToDeadLetter: true });
        }

        // Release file lock if this was a write task
        if (taskType === TASK_TYPE.WRITE && consumerId) {
            releaseFileLock(consumerId);
        }
    } else {
        // Success
        const completedAt = Date.now();
        db.prepare(`
            UPDATE tasks SET status = 'completed', response = ?, completed_at = ?
            WHERE id = ?
        `).run(response, completedAt, id);

        const responseTime = completedAt - task.created_at;
        log(`Task ${id} [${taskType}] completed (${responseTime}ms)`);

        // Release file lock if this was a write task
        if (taskType === TASK_TYPE.WRITE && consumerId) {
            releaseFileLock(consumerId);
        }

        // Update consumer stats
        if (consumerId) {
            db.prepare(`
                UPDATE consumers SET current_task_id = NULL, tasks_completed = tasks_completed + 1
                WHERE id = ?
            `).run(consumerId);
        }

        // Broadcast task:completed event
        broadcast('task:completed', {
            id,
            sessionId: task.session_id,
            taskType,
            response,
            completedAt,
            responseTime
        });
    }

    res.json({ success: true, id, fileLockReleased: taskType === TASK_TYPE.WRITE });
});

// Release a task back to queue (for graceful shutdown)
app.post('/api/tasks/:id/release', (req, res) => {
    const { id } = req.params;
    const { consumerId } = req.body;

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    // Only release if task is still processing
    if (task.status !== 'processing') {
        return res.json({ success: false, reason: 'Task not in processing state' });
    }

    // Verify consumer owns this task (optional security)
    if (consumerId && task.consumer_id && task.consumer_id !== consumerId) {
        return res.json({ success: false, reason: 'Consumer does not own this task' });
    }

    const taskType = task.task_type || TASK_TYPE.WRITE;

    db.prepare(`
        UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL
        WHERE id = ?
    `).run(id);

    log(`Task ${id} [${taskType}] released back to queue by ${consumerId || 'unknown'}`);

    // Release file lock if this was a write task
    let lockReleased = false;
    if (taskType === TASK_TYPE.WRITE && consumerId) {
        lockReleased = releaseFileLock(consumerId);
    }

    // Update consumer
    if (consumerId) {
        db.prepare(`UPDATE consumers SET current_task_id = NULL WHERE id = ?`).run(consumerId);
    }

    res.json({ success: true, id, fileLockReleased: lockReleased });
});

// Get file lock status
app.get('/api/filelock', (req, res) => {
    res.json(getFileLockStatus());
});

// Force release file lock (admin only)
app.delete('/api/filelock', (req, res) => {
    const { force, consumerId } = req.body || {};

    if (force) {
        // Force release regardless of holder
        const prevHolder = fileLock.heldBy;
        fileLock = { heldBy: null, taskId: null, acquiredAt: null };
        db.prepare(`
            UPDATE file_lock SET held_by = NULL, task_id = NULL, acquired_at = NULL WHERE id = 1
        `).run();
        log(`File lock force-released (was held by ${prevHolder})`, 'WARN');
        broadcast('filelock:released', { consumerId: prevHolder, forced: true });
        return res.json({ success: true, previousHolder: prevHolder });
    }

    if (consumerId) {
        const released = releaseFileLock(consumerId);
        return res.json({ success: released });
    }

    res.status(400).json({ error: 'Provide consumerId or force=true' });
});

// Consumer sends response
app.post('/api/queue/respond', (req, res) => {
    const { messageId, response, toolResults, error } = req.body;

    if (!messageId) {
        return res.status(400).json({ error: 'messageId required' });
    }

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(messageId);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (error) {
        // Handle error response
        if (task.retry_count < task.max_retries) {
            db.prepare(`
                UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL, retry_count = retry_count + 1, error = ?
                WHERE id = ?
            `).run(error, messageId);
            log(`Task ${messageId} failed, retrying (${task.retry_count + 1}/${task.max_retries}): ${error}`);

            // Broadcast task:retrying event
            broadcast('task:retrying', {
                id: messageId,
                retryCount: task.retry_count + 1,
                maxRetries: task.max_retries,
                error
            });
        } else {
            moveToDeadLetter(task, error);

            // Broadcast task:failed event
            broadcast('task:failed', {
                id: messageId,
                error,
                movedToDeadLetter: true
            });
        }
    } else {
        // Success
        const completedAt = Date.now();
        db.prepare(`
            UPDATE tasks SET status = 'completed', response = ?, completed_at = ?
            WHERE id = ?
        `).run(response, completedAt, messageId);

        const responseTime = completedAt - task.created_at;
        log(`Task ${messageId} completed (${responseTime}ms)`);

        // Update consumer stats
        if (task.consumer_id) {
            db.prepare(`
                UPDATE consumers SET current_task_id = NULL, tasks_completed = tasks_completed + 1
                WHERE id = ?
            `).run(task.consumer_id);
        }

        // Broadcast task:completed event
        broadcast('task:completed', {
            id: messageId,
            sessionId: task.session_id,
            response,
            completedAt,
            responseTime
        });
    }

    res.json({ success: true, messageId });
});

// Agent polls for response
app.get('/api/queue/:id', (req, res) => {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
        id: task.id,
        status: task.status,
        message: task.content,
        response: task.response,
        error: task.error,
        createdAt: task.created_at,
        processingAt: task.processing_at,
        completedAt: task.completed_at,
        responseTime: task.completed_at ? task.completed_at - task.created_at : null,
        retryCount: task.retry_count
    });
});

// List all tasks
app.get('/api/queue', (req, res) => {
    const tasks = db.prepare(`
        SELECT * FROM tasks
        ORDER BY created_at DESC
        LIMIT 50
    `).all();

    res.json({
        messages: tasks.map(t => ({
            id: t.id,
            sessionId: t.session_id,
            status: t.status,
            preview: t.content.substring(0, 100),
            createdAt: new Date(t.created_at).toISOString(),
            hasResponse: !!t.response,
            retryCount: t.retry_count,
            crossed: !!t.crossed,
            notes: t.notes || ''
        })),
        total: tasks.length
    });
});

// Get all tasks with pagination and filters (for master task history page)
app.get('/api/tasks/history', (req, res) => {
    const { status, limit = 100, offset = 0, search, sort = 'desc' } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (status && status !== 'all') {
        whereClause += ' AND status = ?';
        params.push(status);
    }

    if (search) {
        whereClause += ' AND content LIKE ?';
        params.push(`%${search}%`);
    }

    const sortOrder = sort === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM tasks WHERE ${whereClause}`).get(...params);

    // Get tasks
    const tasks = db.prepare(`
        SELECT * FROM tasks
        WHERE ${whereClause}
        ORDER BY created_at ${sortOrder}
        LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    // Get stats
    const stats = db.prepare(`
        SELECT
            status,
            COUNT(*) as count
        FROM tasks
        GROUP BY status
    `).all();

    const statsMap = {};
    stats.forEach(s => statsMap[s.status] = s.count);

    res.json({
        tasks: tasks.map(t => ({
            id: t.id,
            sessionId: t.session_id,
            content: t.content,
            status: t.status,
            priority: t.priority,
            response: t.response,
            error: t.error,
            retryCount: t.retry_count,
            maxRetries: t.max_retries,
            crossed: !!t.crossed,
            notes: t.notes,
            createdAt: t.created_at,
            processingAt: t.processing_at,
            completedAt: t.completed_at
        })),
        total: countResult.total,
        stats: statsMap,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
});

// Get dead letter queue (failed tasks that exceeded retries)
app.get('/api/tasks/dead-letters', (req, res) => {
    try {
        const deadLetters = db.prepare(`
            SELECT * FROM dead_letters
            ORDER BY failed_at DESC
            LIMIT 100
        `).all();

        res.json({
            deadLetters: deadLetters.map(d => ({
                id: d.id,
                taskId: d.task_id,
                reason: d.reason,
                failedAt: d.failed_at,
                originalContent: d.original_content
            })),
            total: deadLetters.length
        });
    } catch (err) {
        res.json({ deadLetters: [], total: 0 });
    }
});

// ============================================
// DIRECT CLAUDE CODE API (No consumer needed)
// ============================================

// Check for pending messages - Claude polls this directly
app.get('/api/messages/pending', (req, res) => {
    const pending = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'pending'
        ORDER BY
            CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            created_at ASC
    `).all();

    if (pending.length === 0) {
        return res.json({ count: 0, messages: [] });
    }

    res.json({
        count: pending.length,
        messages: pending.map(t => ({
            id: t.id,
            content: t.content,
            priority: t.priority,
            age: Math.round((Date.now() - t.created_at) / 1000) + 's',
            createdAt: t.created_at
        }))
    });
});

// Claim a message - marks it as processing and returns content
app.post('/api/messages/:id/claim', (req, res) => {
    const { id } = req.params;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

    if (!task) {
        return res.status(404).json({ error: 'Message not found' });
    }

    if (task.status !== 'pending') {
        return res.status(409).json({
            error: `Message already ${task.status}`,
            status: task.status
        });
    }

    // Claim it
    db.prepare(`
        UPDATE tasks SET status = 'processing', processing_at = ?, consumer_id = 'claude-code'
        WHERE id = ?
    `).run(Date.now(), id);

    log(`Message ${id} claimed by Claude Code`);

    broadcast('task:processing', {
        id,
        sessionId: task.session_id,
        consumerId: 'claude-code',
        processingAt: Date.now()
    });

    res.json({
        success: true,
        message: {
            id: task.id,
            content: task.content,
            sessionId: task.session_id,
            priority: task.priority
        }
    });
});

// Complete a message with response
app.post('/api/messages/:id/respond', (req, res) => {
    const { id } = req.params;
    const { response } = req.body;

    if (!response) {
        return res.status(400).json({ error: 'response required' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
        return res.status(404).json({ error: 'Message not found' });
    }

    const completedAt = Date.now();
    const responseTime = completedAt - task.created_at;

    db.prepare(`
        UPDATE tasks SET status = 'completed', response = ?, completed_at = ?
        WHERE id = ?
    `).run(response, completedAt, id);

    log(`Message ${id} completed (${responseTime}ms)`);

    broadcast('task:completed', {
        id,
        sessionId: task.session_id,
        response,
        completedAt,
        responseTime
    });

    res.json({ success: true, id, responseTime });
});

// Get single task by ID (must come AFTER specific routes like /api/tasks/next, /api/tasks/history)
app.get('/api/tasks/:id', (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json({
        task: {
            id: task.id,
            sessionId: task.session_id,
            content: task.content,
            status: task.status,
            priority: task.priority,
            response: task.response,
            error: task.error,
            createdAt: task.created_at,
            processingAt: task.processing_at,
            completedAt: task.completed_at
        }
    });
});

// Delete task (protected - can't delete pending/claimed without force)
app.delete('/api/queue/:id', (req, res) => {
    const { force } = req.query;

    // Get task info before deleting (for broadcast)
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    // Protected states - can't delete without force flag
    const protectedStates = ['pending', 'processing'];
    if (protectedStates.includes(task.status) && force !== 'true') {
        return res.status(403).json({
            error: `Cannot delete ${task.status} task without force=true`,
            hint: 'Add ?force=true to delete protected tasks',
            status: task.status
        });
    }

    const result = db.prepare(`DELETE FROM tasks WHERE id = ?`).run(req.params.id);
    if (result.changes > 0) {
        log(`Task ${req.params.id} deleted${force === 'true' ? ' (forced)' : ''}`);

        // Broadcast delete to all clients
        broadcast('task:deleted', {
            id: req.params.id,
            sessionId: task.session_id,
            action: 'deleted'
        });

        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Task not found' });
    }
});

// Cross out task (strikethrough but keep)
app.post('/api/queue/:id/cross', (req, res) => {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const newCrossed = task.crossed ? 0 : 1;
    db.prepare(`UPDATE tasks SET crossed = ? WHERE id = ?`).run(newCrossed, req.params.id);
    log(`Task ${req.params.id} ${newCrossed ? 'crossed out' : 'uncrossed'}`);

    // Broadcast update to all clients
    broadcast('task:updated', {
        id: req.params.id,
        sessionId: task.session_id,
        crossed: !!newCrossed,
        action: newCrossed ? 'crossed' : 'uncrossed'
    });

    res.json({ success: true, crossed: newCrossed });
});

// Force process task (mark as processing)
app.post('/api/queue/:id/process', (req, res) => {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'processing') {
        return res.json({ success: false, reason: 'Already processing' });
    }

    db.prepare(`UPDATE tasks SET status = 'processing', processing_at = ? WHERE id = ?`).run(Date.now(), req.params.id);
    log(`Task ${req.params.id} manually set to processing`);

    broadcast('task:processing', {
        id: req.params.id,
        sessionId: task.session_id,
        manual: true,
        processingAt: Date.now()
    });

    res.json({ success: true });
});

// Save note on task
app.post('/api/queue/:id/note', (req, res) => {
    const { note } = req.body;
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare(`UPDATE tasks SET notes = ? WHERE id = ?`).run(note || null, req.params.id);
    log(`Note saved on task ${req.params.id}`);

    // Broadcast update to all clients
    broadcast('task:updated', {
        id: req.params.id,
        sessionId: task.session_id,
        notes: note || '',
        action: 'note_updated'
    });

    res.json({ success: true });
});

// Cleanup completed tasks (ONLY completed and failed - never pending/processing)
app.post('/api/queue/cleanup', (req, res) => {
    const completed = db.prepare(`DELETE FROM tasks WHERE status = 'completed'`).run();
    const failed = db.prepare(`DELETE FROM tasks WHERE status = 'failed'`).run();

    // Count protected (not deleted)
    const protected = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'processing')`).get();

    log(`Cleanup: cleared ${completed.changes} completed, ${failed.changes} failed. Protected: ${protected.count} pending/processing`);

    // Broadcast cleanup to all clients
    if (completed.changes > 0 || failed.changes > 0) {
        broadcast('tasks:cleanup', {
            completed: completed.changes,
            failed: failed.changes,
            protected: protected.count,
            action: 'cleanup'
        });
    }

    res.json({
        success: true,
        cleared: { completed: completed.changes, failed: failed.changes },
        protected: protected.count
    });
});

// Reset stuck processing tasks (force clear)
app.post('/api/queue/reset-processing', (req, res) => {
    const { action } = req.body; // 'pending' or 'delete'

    let result;
    if (action === 'delete') {
        // Delete all processing tasks
        result = db.prepare(`DELETE FROM tasks WHERE status = 'processing'`).run();
        log(`Reset: deleted ${result.changes} stuck processing tasks`);
    } else {
        // Default: return to pending
        result = db.prepare(`
            UPDATE tasks SET status = 'pending', consumer_id = NULL, processing_at = NULL
            WHERE status = 'processing'
        `).run();
        log(`Reset: returned ${result.changes} processing tasks to pending`);
    }

    // Release any file locks
    db.prepare(`UPDATE file_lock SET held_by = NULL, task_id = NULL, acquired_at = NULL WHERE id = 1`).run();

    // Broadcast reset
    broadcast('tasks:reset', {
        count: result.changes,
        action: action || 'pending'
    });

    res.json({ success: true, reset: result.changes, action: action || 'pending' });
});

// Get dead letters
app.get('/api/dead-letters', (req, res) => {
    const letters = db.prepare(`SELECT * FROM dead_letters ORDER BY failed_at DESC LIMIT 50`).all();
    res.json({ deadLetters: letters, total: letters.length });
});

// Retry dead letter
app.post('/api/dead-letters/:id/retry', (req, res) => {
    const letter = db.prepare(`SELECT * FROM dead_letters WHERE id = ?`).get(req.params.id);
    if (!letter) {
        return res.status(404).json({ error: 'Dead letter not found' });
    }

    // Reset the original task
    db.prepare(`
        UPDATE tasks SET status = 'pending', retry_count = 0, error = NULL, consumer_id = NULL, processing_at = NULL
        WHERE id = ?
    `).run(letter.task_id);

    // Remove from dead letters
    db.prepare(`DELETE FROM dead_letters WHERE id = ?`).run(req.params.id);

    log(`Dead letter ${letter.task_id} requeued for retry`);
    res.json({ success: true, taskId: letter.task_id });
});

// Get consumers
app.get('/api/consumers', (req, res) => {
    const consumers = db.prepare(`SELECT * FROM consumers ORDER BY last_heartbeat DESC`).all();
    const now = Date.now();

    res.json({
        consumers: consumers.map(c => ({
            ...c,
            isOnline: (now - c.last_heartbeat) < TIMEOUTS.CONSUMER_HEARTBEAT,
            lastSeenAgo: Math.round((now - c.last_heartbeat) / 1000) + 's'
        }))
    });
});

// ============================================
// TEAM TASKS API (Voice-based task assignment)
// ============================================

// Create team task
app.post('/api/team-tasks', (req, res) => {
    const { id, text, summary, assignee, assigneeName, role, status } = req.body;

    if (!text || !assignee) {
        return res.status(400).json({ error: 'text and assignee required' });
    }

    const taskId = id || generateId();
    const createdAt = Date.now();

    db.prepare(`
        INSERT INTO team_tasks (id, text, summary, assignee, assignee_name, role, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, text, summary || text.substring(0, 100), assignee, assigneeName || assignee, role || 'Team', status || 'assigned', createdAt);

    log(`Team task created: ${taskId} assigned to ${assigneeName || assignee}`);

    broadcast('team_task:created', {
        id: taskId,
        text,
        summary: summary || text.substring(0, 100),
        assignee,
        assigneeName: assigneeName || assignee,
        role: role || 'Team',
        status: status || 'assigned',
        createdAt
    });

    res.json({ success: true, id: taskId });
});

// Get all team tasks
app.get('/api/team-tasks', (req, res) => {
    const status = req.query.status;
    const assignee = req.query.assignee;
    const limit = parseInt(req.query.limit) || 50;

    let query = 'SELECT * FROM team_tasks';
    const params = [];
    const conditions = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (assignee) {
        conditions.push('assignee = ?');
        params.push(assignee);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const tasks = db.prepare(query).all(...params);

    res.json({
        tasks: tasks.map(t => ({
            ...t,
            questions: JSON.parse(t.questions || '[]')
        })),
        total: tasks.length
    });
});

// Get single team task
app.get('/api/team-tasks/:id', (req, res) => {
    const task = db.prepare('SELECT * FROM team_tasks WHERE id = ?').get(req.params.id);

    if (!task) {
        return res.status(404).json({ error: 'Team task not found' });
    }

    res.json({
        ...task,
        questions: JSON.parse(task.questions || '[]')
    });
});

// Update team task (acknowledge, add question, complete)
app.patch('/api/team-tasks/:id', (req, res) => {
    const { id } = req.params;
    const { status, completionSummary, question } = req.body;

    const task = db.prepare('SELECT * FROM team_tasks WHERE id = ?').get(id);
    if (!task) {
        return res.status(404).json({ error: 'Team task not found' });
    }

    const updates = [];
    const params = [];

    if (status) {
        updates.push('status = ?');
        params.push(status);

        if (status === 'acknowledged') {
            updates.push('acknowledged_at = ?');
            params.push(Date.now());
        } else if (status === 'completed') {
            updates.push('completed_at = ?');
            params.push(Date.now());
            if (completionSummary) {
                updates.push('completion_summary = ?');
                params.push(completionSummary);
            }
        }
    }

    if (question) {
        const questions = JSON.parse(task.questions || '[]');
        questions.push({
            question,
            askedAt: new Date().toISOString(),
            answered: false
        });
        updates.push('questions = ?');
        params.push(JSON.stringify(questions));
    }

    if (updates.length > 0) {
        params.push(id);
        db.prepare(`UPDATE team_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        log(`Team task ${id} updated: ${status || 'question added'}`);

        broadcast('team_task:updated', {
            id,
            status: status || task.status,
            completionSummary,
            question
        });
    }

    res.json({ success: true, id });
});

// Complete team task
app.post('/api/team-tasks/:id/complete', (req, res) => {
    const { id } = req.params;
    const { completionSummary } = req.body;

    const task = db.prepare('SELECT * FROM team_tasks WHERE id = ?').get(id);
    if (!task) {
        return res.status(404).json({ error: 'Team task not found' });
    }

    const completedAt = Date.now();
    db.prepare(`
        UPDATE team_tasks SET status = 'completed', completed_at = ?, completion_summary = ?
        WHERE id = ?
    `).run(completedAt, completionSummary || task.summary, id);

    log(`Team task ${id} completed by ${task.assignee_name}`);

    broadcast('team_task:completed', {
        id,
        assignee: task.assignee,
        assigneeName: task.assignee_name,
        completionSummary: completionSummary || task.summary,
        completedAt
    });

    res.json({ success: true, id });
});

// Delete team task
app.delete('/api/team-tasks/:id', (req, res) => {
    const result = db.prepare('DELETE FROM team_tasks WHERE id = ?').run(req.params.id);
    if (result.changes > 0) {
        log(`Team task ${req.params.id} deleted`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Team task not found' });
    }
});

// Get team task stats
app.get('/api/team-tasks/stats/summary', (req, res) => {
    const stats = db.prepare(`
        SELECT
            assignee,
            assignee_name,
            role,
            SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            COUNT(*) as total
        FROM team_tasks
        GROUP BY assignee
    `).all();

    res.json({ stats });
});

// ============================================
// CONVERSATION LOGS API (Voice persona speech history)
// ============================================

const MAX_CONVERSATION_LOG = 20; // Only repeat after 20 entries

// Log a spoken phrase
app.post('/api/conversation-logs', (req, res) => {
    const { persona, text } = req.body;

    if (!persona || !text) {
        return res.status(400).json({ error: 'persona and text required' });
    }

    const spokenAt = Date.now();
    db.prepare(`
        INSERT INTO conversation_logs (persona, text, spoken_at)
        VALUES (?, ?, ?)
    `).run(persona, text, spokenAt);

    // Trim old entries beyond MAX_CONVERSATION_LOG per persona
    db.prepare(`
        DELETE FROM conversation_logs
        WHERE persona = ? AND id NOT IN (
            SELECT id FROM conversation_logs
            WHERE persona = ?
            ORDER BY spoken_at DESC
            LIMIT ?
        )
    `).run(persona, persona, MAX_CONVERSATION_LOG);

    res.json({ success: true, persona, spokenAt });
});

// Get recent phrases for a persona (to check for repeats)
app.get('/api/conversation-logs/:persona', (req, res) => {
    const { persona } = req.params;
    const limit = parseInt(req.query.limit) || MAX_CONVERSATION_LOG;

    const logs = db.prepare(`
        SELECT text, spoken_at FROM conversation_logs
        WHERE persona = ?
        ORDER BY spoken_at DESC
        LIMIT ?
    `).all(persona, limit);

    res.json({
        persona,
        logs,
        count: logs.length
    });
});

// Check if a phrase was recently said by a persona
app.get('/api/conversation-logs/:persona/check', (req, res) => {
    const { persona } = req.params;
    const { text } = req.query;

    if (!text) {
        return res.status(400).json({ error: 'text query param required' });
    }

    const found = db.prepare(`
        SELECT COUNT(*) as count FROM conversation_logs
        WHERE persona = ? AND text = ?
    `).get(persona, text);

    res.json({
        persona,
        text,
        wasRecentlySaid: found.count > 0
    });
});

// Clear logs for a persona
app.delete('/api/conversation-logs/:persona', (req, res) => {
    const { persona } = req.params;
    const result = db.prepare('DELETE FROM conversation_logs WHERE persona = ?').run(persona);
    log(`Cleared ${result.changes} conversation logs for ${persona}`);
    res.json({ success: true, cleared: result.changes });
});

// ============================================
// WEB UI
// ============================================

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimWidget Relay v2</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        h1 { color: #00d9ff; margin-bottom: 20px; }
        .status { background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap; }
        .status-item { text-align: center; }
        .status-item .value { font-size: 24px; font-weight: bold; }
        .status-item .label { font-size: 12px; color: #888; }
        .status .ok { color: #00ff88; }
        .status .warn { color: #ffd700; }
        .status .error { color: #ff4444; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { background: #16213e; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
        .tab.active { background: #00d9ff; color: #000; }
        .panel { display: none; }
        .panel.active { display: block; }
        .task { background: #0f3460; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
        .task.pending { border-left: 4px solid #ffd700; }
        .task.processing { border-left: 4px solid #00d9ff; animation: pulse 2s infinite; }
        .task.completed { border-left: 4px solid #00ff88; }
        .task.failed { border-left: 4px solid #ff4444; }
        .task.crossed { opacity: 0.5; }
        .task.crossed .task-content { text-decoration: line-through; color: #888; }
        .task-header { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
        .task-actions { display: flex; gap: 5px; }
        .task-actions button { padding: 4px 8px; font-size: 14px; }
        .task-status { font-weight: bold; text-transform: uppercase; }
        .task-id { cursor: pointer; font-family: monospace; color: #00d9ff; transition: all 0.2s; }
        .task-id:hover { color: #fff; text-decoration: underline; }
        .task-content { font-family: monospace; background: #1a1a2e; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
        .task-meta { font-size: 12px; color: #888; margin-top: 10px; }
        .task-notes { margin-top: 10px; }
        .task-notes input { width: 100%; background: #1a1a2e; border: 1px solid #333; color: #eee; padding: 8px; border-radius: 4px; font-size: 12px; }
        .task-notes input:focus { outline: none; border-color: #00d9ff; }
        .consumer { background: #0f3460; padding: 10px; border-radius: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; }
        .consumer.online { border-left: 4px solid #00ff88; }
        .consumer.offline { border-left: 4px solid #666; }
        button { background: #00d9ff; color: #000; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 5px; }
        button:hover { background: #00b8d4; }
        button.danger { background: #ff4444; }
        .refresh { margin-bottom: 20px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    </style>
</head>
<body>
    <h1>SimWidget Relay v2.0</h1>

    <div class="status" id="status">Loading...</div>

    <div class="tabs">
        <div class="tab active" onclick="showPanel('tasks')">Tasks</div>
        <div class="tab" onclick="showPanel('consumers')">Consumers</div>
        <div class="tab" onclick="showPanel('deadletters')">Dead Letters</div>
    </div>

    <div class="refresh">
        <button onclick="loadAll()">Refresh</button>
        <button onclick="cleanup()">Cleanup</button>
    </div>

    <div id="tasks" class="panel active"></div>
    <div id="consumers" class="panel"></div>
    <div id="deadletters" class="panel"></div>

    <script>
        async function loadAll() {
            const health = await fetch('/api/health').then(r => r.json());
            document.getElementById('status').innerHTML = \`
                <div class="status-item"><div class="value ok">\${health.queue.pending || 0}</div><div class="label">Pending</div></div>
                <div class="status-item"><div class="value warn">\${health.queue.processing || 0}</div><div class="label">Processing</div></div>
                <div class="status-item"><div class="value">\${health.queue.completed || 0}</div><div class="label">Completed</div></div>
                <div class="status-item"><div class="value error">\${health.queue.failed || 0}</div><div class="label">Failed</div></div>
                <div class="status-item"><div class="value">\${health.activeConsumers}</div><div class="label">Consumers</div></div>
                <div class="status-item"><div class="value error">\${health.deadLetters}</div><div class="label">Dead Letters</div></div>
            \`;

            const queue = await fetch('/api/queue').then(r => r.json());
            document.getElementById('tasks').innerHTML = queue.messages.map(t => \`
                <div class="task \${t.status} \${t.crossed ? 'crossed' : ''}" id="task-\${t.id}">
                    <div class="task-header">
                        <span class="task-status">\${t.status}</span>
                        <span class="task-id" onclick="copyToClipboard('\${t.id}')" title="Click to copy">\${t.id}</span>
                        <div class="task-actions">
                            <button onclick="crossOutTask('\${t.id}')" title="Cross out">\${t.crossed ? '↩️' : '❌'}</button>
                            <button onclick="processTask('\${t.id}')" title="Mark processing">▶️</button>
                            <button onclick="deleteTask('\${t.id}')" class="danger" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div class="task-content">\${t.preview}</div>
                    <div class="task-meta">Session: \${t.sessionId} | \${t.createdAt} | Retries: \${t.retryCount}</div>
                    <div class="task-notes">
                        <input type="text" placeholder="Add note..." value="\${t.notes || ''}" onchange="saveNote('\${t.id}', this.value)" />
                    </div>
                </div>
            \`).join('') || '<p>No tasks</p>';

            const consumers = await fetch('/api/consumers').then(r => r.json());
            document.getElementById('consumers').innerHTML = consumers.consumers.map(c => \`
                <div class="consumer \${c.isOnline ? 'online' : 'offline'}">
                    <span>\${c.id} (\${c.isOnline ? 'Online' : 'Offline'})</span>
                    <span>Tasks: \${c.tasks_completed} | Last: \${c.lastSeenAgo} ago</span>
                </div>
            \`).join('') || '<p>No consumers</p>';

            const dl = await fetch('/api/dead-letters').then(r => r.json());
            document.getElementById('deadletters').innerHTML = dl.deadLetters.map(d => \`
                <div class="task failed">
                    <div class="task-header">
                        <span>Task: \${d.task_id}</span>
                        <button onclick="retryDeadLetter('\${d.id}')">Retry</button>
                    </div>
                    <div class="task-content">\${d.original_content}</div>
                    <div class="task-meta">Reason: \${d.reason}</div>
                </div>
            \`).join('') || '<p>No dead letters</p>';
        }

        function showPanel(name) {
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(name).classList.add('active');
            event.target.classList.add('active');
        }

        async function cleanup() {
            await fetch('/api/queue/cleanup', { method: 'POST' });
            loadAll();
        }

        async function retryDeadLetter(id) {
            await fetch('/api/dead-letters/' + id + '/retry', { method: 'POST' });
            loadAll();
        }

        async function crossOutTask(id) {
            await fetch('/api/queue/' + id + '/cross', { method: 'POST' });
            loadAll();
        }

        async function processTask(id) {
            await fetch('/api/queue/' + id + '/process', { method: 'POST' });
            loadAll();
        }

        async function deleteTask(id) {
            if (confirm('Delete this task?')) {
                await fetch('/api/queue/' + id, { method: 'DELETE' });
                loadAll();
            }
        }

        async function saveNote(id, note) {
            await fetch('/api/queue/' + id + '/note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            });
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                // Show brief feedback
                const el = event.target;
                const originalText = el.textContent;
                el.textContent = 'Copied!';
                el.style.color = '#00ff88';
                setTimeout(() => {
                    el.textContent = originalText;
                    el.style.color = '';
                }, 1000);
            });
        }

        loadAll();
        setInterval(loadAll, 5000);
    </script>
</body>
</html>
    `);
});

// ============================================
// START SERVER
// ============================================

initDatabase();
migrateFromJson();
initFileLock();

server.listen(PORT, '0.0.0.0', () => {
    log(`Relay Service v2.2 started on port ${PORT}`);
    log(`UI: http://localhost:${PORT}`);
    log(`WebSocket: ws://localhost:${PORT}`);
    log(`Database: ${DB_FILE}`);
    log(`File lock: ${fileLock.heldBy ? `held by ${fileLock.heldBy}` : 'available'}`);
});
