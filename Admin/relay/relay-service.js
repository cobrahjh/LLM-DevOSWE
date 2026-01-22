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

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = 8600;
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });
const wsClients = new Set();

// Security: API Key authentication
const API_KEY = process.env.HIVE_API_KEY;
const PUBLIC_ENDPOINTS = ['/api/health', '/api/status', '/', '/task-history.html'];

function apiKeyAuth(req, res, next) {
    // Skip auth for public endpoints
    if (PUBLIC_ENDPOINTS.some(ep => req.path === ep || req.path.startsWith('/api/health'))) {
        return next();
    }

    // Skip auth if no API key configured (backwards compatibility)
    if (!API_KEY) {
        return next();
    }

    const providedKey = req.headers['x-api-key'] || req.query.apikey;
    if (providedKey === API_KEY) {
        return next();
    }

    // Allow localhost and local network without auth for development
    const clientIP = req.ip || req.connection.remoteAddress;
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    const isLocalNetwork = clientIP?.includes('192.168.1.') || clientIP?.includes('::ffff:192.168.1.');
    if (isLocalhost || isLocalNetwork) {
        return next();
    }

    console.log(`[Security] Unauthorized request from ${clientIP} to ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized - API key required' });
}

// Security: CORS - allow all origins for Hive internal services
const corsOptions = {
    origin: true, // Reflect the request origin
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(apiKeyAuth);
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

    // ========== LLM Training & Evaluation Tables ==========

    // Prompt library - store and manage prompts for teaching LLMs
    db.exec(`
        CREATE TABLE IF NOT EXISTS prompt_library (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            prompt_text TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            rating REAL DEFAULT 0,
            use_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            last_used INTEGER
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompt_library(category)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_rating ON prompt_library(rating DESC)`);

    // Benchmarks - test suites for evaluating LLM performance
    db.exec(`
        CREATE TABLE IF NOT EXISTS benchmarks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'general',
            test_cases TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            run_count INTEGER DEFAULT 0
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_benchmarks_category ON benchmarks(category)`);

    // Benchmark runs - results from running benchmarks against models
    db.exec(`
        CREATE TABLE IF NOT EXISTS benchmark_runs (
            id TEXT PRIMARY KEY,
            benchmark_id TEXT NOT NULL,
            model TEXT NOT NULL,
            results TEXT NOT NULL DEFAULT '[]',
            passed INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            total_time INTEGER DEFAULT 0,
            avg_tokens INTEGER DEFAULT 0,
            run_at INTEGER NOT NULL,
            FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id)
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_benchmark_runs_benchmark ON benchmark_runs(benchmark_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_benchmark_runs_model ON benchmark_runs(model)`);

    // Training examples - curated input/output pairs for fine-tuning
    db.exec(`
        CREATE TABLE IF NOT EXISTS training_examples (
            id TEXT PRIMARY KEY,
            input_text TEXT NOT NULL,
            output_text TEXT NOT NULL,
            source TEXT DEFAULT 'manual',
            category TEXT DEFAULT 'general',
            rating INTEGER DEFAULT 0,
            approved INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_training_approved ON training_examples(approved)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_training_source ON training_examples(source)`);

    // Training sessions - group exports of training data
    db.exec(`
        CREATE TABLE IF NOT EXISTS training_sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            example_count INTEGER DEFAULT 0,
            approved_count INTEGER DEFAULT 0,
            export_format TEXT,
            exported_at INTEGER,
            created_at INTEGER NOT NULL
        )
    `);

    // Training metrics - track loss, perplexity, accuracy over time
    db.exec(`
        CREATE TABLE IF NOT EXISTS training_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            epoch INTEGER,
            loss REAL,
            perplexity REAL,
            accuracy REAL,
            val_loss REAL,
            val_perplexity REAL,
            learning_rate REAL,
            notes TEXT,
            timestamp INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_model ON training_metrics(model)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON training_metrics(timestamp)`);

    // Kitt conversations - persistent chat history per session
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_timestamp ON conversations(timestamp)`);

    // Knowledge backup - CLAUDE.md and STANDARDS.md versioning
    db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            hash TEXT NOT NULL,
            session_id TEXT,
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at)`);

    // Tool usage logs - for Claude Code hooks
    db.exec(`
        CREATE TABLE IF NOT EXISTS tool_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool TEXT NOT NULL,
            input_summary TEXT,
            session_id TEXT,
            source TEXT DEFAULT 'claude-code-hook',
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_logs_tool ON tool_logs(tool)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_logs_created ON tool_logs(created_at)`);

    // File state tracking - tracks all files read/modified/created during sessions
    db.exec(`
        CREATE TABLE IF NOT EXISTS file_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            operation TEXT NOT NULL,
            file_size INTEGER,
            lines_changed INTEGER,
            hash TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_file_state_session ON file_state(session_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_file_state_path ON file_state(file_path)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_file_state_operation ON file_state(operation)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_file_state_created ON file_state(created_at)`);

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
    // Store in dead_letters for audit trail
    db.prepare(`
        INSERT INTO dead_letters (id, task_id, reason, failed_at, original_content)
        VALUES (?, ?, ?, ?, ?)
    `).run(generateId(), task.id, reason, Date.now(), task.content);

    // Flag for review instead of just failing - gives admin chance to resubmit or reject
    db.prepare(`
        UPDATE tasks SET status = 'needs_review', error = ?
        WHERE id = ?
    `).run(`[NEEDS_REVIEW] ${reason}`, task.id);

    log(`Task ${task.id} needs review: ${reason}`, 'WARN');

    // Broadcast for UI updates
    broadcast('task:needs_review', {
        id: task.id,
        sessionId: task.session_id,
        reason,
        previousStatus: task.status
    });
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
            COALESCE(SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END), 0) as needs_review,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected,
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

    // Ensure all expected statuses have values (default 0)
    const statsMap = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        needs_review: 0
    };
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

// ==================== TASK LIFECYCLE MANAGEMENT ====================

// Reject a task with documented reason (keeps history, removes from active queue)
app.post('/api/tasks/:id/reject', (req, res) => {
    const { id } = req.params;
    const { reason, category } = req.body;

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'rejected') {
        return res.status(400).json({ error: 'Task already rejected' });
    }

    const rejectedAt = Date.now();
    const rejectReason = reason || 'No reason provided';
    const rejectCategory = category || 'unknown'; // bad_input, no_consumer, unclear, duplicate, other

    db.prepare(`
        UPDATE tasks
        SET status = 'rejected',
            error = ?,
            completed_at = ?,
            response = ?
        WHERE id = ?
    `).run(
        `[REJECTED: ${rejectCategory}] ${rejectReason}`,
        rejectedAt,
        JSON.stringify({ rejectedAt, reason: rejectReason, category: rejectCategory, previousStatus: task.status }),
        id
    );

    log(`Task ${id} rejected: [${rejectCategory}] ${rejectReason}`);

    broadcast('task:rejected', {
        id,
        sessionId: task.session_id,
        reason: rejectReason,
        category: rejectCategory
    });

    res.json({ success: true, id, status: 'rejected', reason: rejectReason, category: rejectCategory });
});

// Flag task for manual review
app.post('/api/tasks/:id/review', (req, res) => {
    const { id } = req.params;
    const { note } = req.body;

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const reviewNote = note || 'Flagged for review';

    db.prepare(`
        UPDATE tasks
        SET status = 'needs_review',
            error = ?
        WHERE id = ?
    `).run(`[REVIEW] ${reviewNote} (was: ${task.status})`, id);

    log(`Task ${id} flagged for review: ${reviewNote}`);

    broadcast('task:needs_review', {
        id,
        sessionId: task.session_id,
        note: reviewNote,
        previousStatus: task.status
    });

    res.json({ success: true, id, status: 'needs_review', note: reviewNote });
});

// Get tasks needing review
app.get('/api/queue/review', (req, res) => {
    const tasks = db.prepare(`
        SELECT * FROM tasks
        WHERE status IN ('needs_review', 'failed')
        ORDER BY created_at DESC
        LIMIT 50
    `).all();

    res.json({
        tasks: tasks.map(t => ({
            id: t.id,
            sessionId: t.session_id,
            status: t.status,
            preview: t.content.substring(0, 100) + (t.content.length > 100 ? '...' : ''),
            content: t.content,
            error: t.error,
            createdAt: new Date(t.created_at).toISOString(),
            retryCount: t.retry_count
        })),
        total: tasks.length
    });
});

// Resubmit a task (optionally with modified content)
app.post('/api/tasks/:id/resubmit', (req, res) => {
    const { id } = req.params;
    const { content, priority } = req.body;

    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const resubmittableStates = ['failed', 'needs_review', 'rejected'];
    if (!resubmittableStates.includes(task.status)) {
        return res.status(400).json({
            error: `Cannot resubmit task in '${task.status}' state`,
            hint: `Task must be in: ${resubmittableStates.join(', ')}`
        });
    }

    const newContent = content || task.content;
    const newPriority = priority || task.priority;

    db.prepare(`
        UPDATE tasks
        SET status = 'pending',
            content = ?,
            priority = ?,
            error = NULL,
            consumer_id = NULL,
            processing_at = NULL,
            completed_at = NULL,
            response = NULL,
            retry_count = 0
        WHERE id = ?
    `).run(newContent, newPriority, id);

    log(`Task ${id} resubmitted (was: ${task.status})`);

    broadcast('task:resubmitted', {
        id,
        sessionId: task.session_id,
        previousStatus: task.status,
        modified: content ? true : false
    });

    res.json({ success: true, id, status: 'pending', modified: content ? true : false });
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
// TOOL USAGE LOGS (Claude Code Hooks)
// ============================================

// Log a tool usage from PostToolUse hook
app.post('/api/logs', (req, res) => {
    try {
        const { type, tool, input_summary, session_id, source, timestamp } = req.body;

        // Accept either 'tool' directly or nested in body
        const toolName = tool || req.body.tool_name || 'unknown';
        const summary = input_summary || '';
        const sessionId = session_id || null;
        const logSource = source || 'claude-code-hook';
        const createdAt = timestamp ? new Date(timestamp).getTime() : Date.now();

        db.prepare(`
            INSERT INTO tool_logs (tool, input_summary, session_id, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(toolName, summary, sessionId, logSource, createdAt);

        res.json({ success: true, tool: toolName, logged_at: createdAt });
    } catch (err) {
        log(`Tool log error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Get recent tool logs
app.get('/api/logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const tool = req.query.tool;

        let query = `
            SELECT id, tool, input_summary, session_id, source, created_at
            FROM tool_logs
        `;
        const params = [];

        if (tool) {
            query += ` WHERE tool = ?`;
            params.push(tool);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const logs = db.prepare(query).all(...params);

        res.json({
            count: logs.length,
            logs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tool usage stats
app.get('/api/logs/stats', (req, res) => {
    try {
        const since = req.query.since ? parseInt(req.query.since) : Date.now() - (24 * 60 * 60 * 1000); // Last 24h

        const stats = db.prepare(`
            SELECT tool, COUNT(*) as count
            FROM tool_logs
            WHERE created_at > ?
            GROUP BY tool
            ORDER BY count DESC
        `).all(since);

        const total = stats.reduce((sum, s) => sum + s.count, 0);

        res.json({
            since: new Date(since).toISOString(),
            total,
            by_tool: stats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear old tool logs (keep last N days)
app.delete('/api/logs', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const result = db.prepare('DELETE FROM tool_logs WHERE created_at < ?').run(cutoff);

        log(`Cleared ${result.changes} tool logs older than ${days} days`);
        res.json({ success: true, cleared: result.changes, days });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
// LLM TRAINING & EVALUATION API
// ============================================

// === PROMPT LIBRARY ===

// List all prompts
app.get('/api/prompts', (req, res) => {
    try {
        const { category, search } = req.query;
        let sql = 'SELECT * FROM prompt_library';
        const params = [];

        if (category) {
            sql += ' WHERE category = ?';
            params.push(category);
        }
        if (search) {
            sql += category ? ' AND' : ' WHERE';
            sql += ' (name LIKE ? OR prompt_text LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY rating DESC, use_count DESC';

        const prompts = db.prepare(sql).all(...params);
        res.json({ prompts: prompts.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })) });
    } catch (err) {
        log(`Error listing prompts: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Get single prompt
app.get('/api/prompts/:id', (req, res) => {
    try {
        const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
        prompt.tags = JSON.parse(prompt.tags || '[]');
        res.json(prompt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create prompt
app.post('/api/prompts', (req, res) => {
    try {
        const { name, category, prompt_text, tags } = req.body;
        if (!name || !prompt_text) {
            return res.status(400).json({ error: 'name and prompt_text required' });
        }
        const id = `prompt_${Date.now()}`;
        db.prepare(`
            INSERT INTO prompt_library (id, name, category, prompt_text, tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, name, category || 'general', prompt_text, JSON.stringify(tags || []), Date.now());

        broadcast('prompt:created', { id, name, category });
        res.json({ success: true, id });
    } catch (err) {
        log(`Error creating prompt: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Update prompt
app.put('/api/prompts/:id', (req, res) => {
    try {
        const { name, category, prompt_text, tags, rating } = req.body;
        const existing = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Prompt not found' });

        db.prepare(`
            UPDATE prompt_library SET
                name = COALESCE(?, name),
                category = COALESCE(?, category),
                prompt_text = COALESCE(?, prompt_text),
                tags = COALESCE(?, tags),
                rating = COALESCE(?, rating),
                updated_at = ?
            WHERE id = ?
        `).run(name, category, prompt_text, tags ? JSON.stringify(tags) : null, rating, Date.now(), req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete prompt
app.delete('/api/prompts/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM prompt_library WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test prompt against Ollama
app.post('/api/prompts/:id/test', async (req, res) => {
    try {
        const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

        const { model, test_input } = req.body;
        const modelName = model || 'qwen3-coder:latest';
        const fullPrompt = prompt.prompt_text + (test_input ? `\n\nUser: ${test_input}` : '');

        const startTime = Date.now();
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, prompt: fullPrompt, stream: false })
        });

        const data = await response.json();
        const elapsed = Date.now() - startTime;

        // Update use count
        db.prepare('UPDATE prompt_library SET use_count = use_count + 1, last_used = ? WHERE id = ?')
            .run(Date.now(), req.params.id);

        res.json({
            response: data.response,
            model: modelName,
            elapsed_ms: elapsed,
            tokens: data.eval_count || 0
        });
    } catch (err) {
        log(`Error testing prompt: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// === BENCHMARKS ===

// List benchmarks
app.get('/api/benchmarks', (req, res) => {
    try {
        const { category } = req.query;
        let sql = 'SELECT * FROM benchmarks';
        if (category) sql += ' WHERE category = ?';
        sql += ' ORDER BY created_at DESC';

        const benchmarks = category
            ? db.prepare(sql).all(category)
            : db.prepare(sql).all();

        res.json({
            benchmarks: benchmarks.map(b => ({
                ...b,
                test_cases: JSON.parse(b.test_cases || '[]')
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single benchmark with run history
app.get('/api/benchmarks/:id', (req, res) => {
    try {
        const benchmark = db.prepare('SELECT * FROM benchmarks WHERE id = ?').get(req.params.id);
        if (!benchmark) return res.status(404).json({ error: 'Benchmark not found' });

        benchmark.test_cases = JSON.parse(benchmark.test_cases || '[]');
        const runs = db.prepare(`
            SELECT * FROM benchmark_runs WHERE benchmark_id = ? ORDER BY run_at DESC LIMIT 20
        `).all(req.params.id);

        res.json({
            ...benchmark,
            runs: runs.map(r => ({ ...r, results: JSON.parse(r.results || '[]') }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create benchmark
app.post('/api/benchmarks', (req, res) => {
    try {
        const { name, description, category, test_cases } = req.body;
        if (!name || !test_cases || !Array.isArray(test_cases)) {
            return res.status(400).json({ error: 'name and test_cases array required' });
        }

        const id = `bench_${Date.now()}`;
        db.prepare(`
            INSERT INTO benchmarks (id, name, description, category, test_cases, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, name, description || '', category || 'general', JSON.stringify(test_cases), Date.now());

        broadcast('benchmark:created', { id, name });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Run benchmark against a model
app.post('/api/benchmarks/:id/run', async (req, res) => {
    try {
        const benchmark = db.prepare('SELECT * FROM benchmarks WHERE id = ?').get(req.params.id);
        if (!benchmark) return res.status(404).json({ error: 'Benchmark not found' });

        const { model } = req.body;
        const modelName = model || 'qwen3-coder:latest';
        const testCases = JSON.parse(benchmark.test_cases || '[]');

        const results = [];
        let passed = 0, failed = 0, totalTime = 0, totalTokens = 0;

        for (const tc of testCases) {
            const startTime = Date.now();
            try {
                const response = await fetch('http://localhost:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: modelName, prompt: tc.input, stream: false })
                });
                const data = await response.json();
                const elapsed = Date.now() - startTime;
                totalTime += elapsed;
                totalTokens += data.eval_count || 0;

                // Check if output contains expected (simple substring match)
                const success = tc.expected
                    ? data.response.toLowerCase().includes(tc.expected.toLowerCase())
                    : true;

                if (success) passed++; else failed++;
                results.push({
                    input: tc.input,
                    expected: tc.expected,
                    actual: data.response,
                    passed: success,
                    time_ms: elapsed,
                    tokens: data.eval_count || 0
                });
            } catch (err) {
                failed++;
                results.push({
                    input: tc.input,
                    expected: tc.expected,
                    error: err.message,
                    passed: false
                });
            }
        }

        // Save run
        const runId = `run_${Date.now()}`;
        db.prepare(`
            INSERT INTO benchmark_runs (id, benchmark_id, model, results, passed, failed, total_time, avg_tokens, run_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(runId, req.params.id, modelName, JSON.stringify(results), passed, failed, totalTime, Math.round(totalTokens / testCases.length), Date.now());

        // Update run count
        db.prepare('UPDATE benchmarks SET run_count = run_count + 1, updated_at = ? WHERE id = ?')
            .run(Date.now(), req.params.id);

        broadcast('benchmark:completed', { id: runId, benchmark_id: req.params.id, model: modelName, passed, failed });

        res.json({
            run_id: runId,
            model: modelName,
            passed,
            failed,
            total: testCases.length,
            pass_rate: testCases.length ? Math.round((passed / testCases.length) * 100) : 0,
            total_time_ms: totalTime,
            avg_tokens: Math.round(totalTokens / testCases.length),
            results
        });
    } catch (err) {
        log(`Error running benchmark: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Compare benchmark runs across models
app.get('/api/benchmarks/:id/compare', (req, res) => {
    try {
        const runs = db.prepare(`
            SELECT * FROM benchmark_runs WHERE benchmark_id = ? ORDER BY run_at DESC
        `).all(req.params.id);

        // Group by model
        const byModel = {};
        for (const run of runs) {
            if (!byModel[run.model]) byModel[run.model] = [];
            byModel[run.model].push({
                ...run,
                results: JSON.parse(run.results || '[]'),
                pass_rate: run.passed + run.failed > 0 ? Math.round((run.passed / (run.passed + run.failed)) * 100) : 0
            });
        }

        res.json({ comparison: byModel });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === TRAINING DATA ===

// List training examples
app.get('/api/training/examples', (req, res) => {
    try {
        const { source, approved, category, limit } = req.query;
        let sql = 'SELECT * FROM training_examples WHERE 1=1';
        const params = [];

        if (source) { sql += ' AND source = ?'; params.push(source); }
        if (approved !== undefined) { sql += ' AND approved = ?'; params.push(approved === 'true' ? 1 : 0); }
        if (category) { sql += ' AND category = ?'; params.push(category); }
        sql += ' ORDER BY created_at DESC';
        if (limit) sql += ` LIMIT ${parseInt(limit)}`;

        const examples = db.prepare(sql).all(...params);
        res.json({ examples, total: examples.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create training example
app.post('/api/training/examples', (req, res) => {
    try {
        const { input_text, output_text, source, category, rating } = req.body;
        if (!input_text || !output_text) {
            return res.status(400).json({ error: 'input_text and output_text required' });
        }

        const id = `train_${Date.now()}`;
        db.prepare(`
            INSERT INTO training_examples (id, input_text, output_text, source, category, rating, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, input_text, output_text, source || 'manual', category || 'general', rating || 0, Date.now());

        broadcast('training:example_created', { id, source });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update training example (rate/approve)
app.put('/api/training/examples/:id', (req, res) => {
    try {
        const { rating, approved, category } = req.body;
        db.prepare(`
            UPDATE training_examples SET
                rating = COALESCE(?, rating),
                approved = COALESCE(?, approved),
                category = COALESCE(?, category),
                updated_at = ?
            WHERE id = ?
        `).run(rating, approved, category, Date.now(), req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete training example
app.delete('/api/training/examples/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM training_examples WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export training data as JSONL
app.post('/api/training/export', (req, res) => {
    try {
        const { format, approved_only, category, session_name } = req.body;
        let sql = 'SELECT * FROM training_examples WHERE 1=1';
        const params = [];

        if (approved_only) { sql += ' AND approved = 1'; }
        if (category) { sql += ' AND category = ?'; params.push(category); }

        const examples = db.prepare(sql).all(...params);

        // Create session record
        const sessionId = `session_${Date.now()}`;
        db.prepare(`
            INSERT INTO training_sessions (id, name, example_count, approved_count, export_format, exported_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            sessionId,
            session_name || `Export ${new Date().toISOString().slice(0, 10)}`,
            examples.length,
            examples.filter(e => e.approved).length,
            format || 'jsonl',
            Date.now(),
            Date.now()
        );

        // Format output
        let output;
        if (format === 'jsonl' || !format) {
            // OpenAI fine-tuning format
            output = examples.map(e => JSON.stringify({
                messages: [
                    { role: 'user', content: e.input_text },
                    { role: 'assistant', content: e.output_text }
                ]
            })).join('\n');
        } else if (format === 'csv') {
            output = 'input,output\n' + examples.map(e =>
                `"${e.input_text.replace(/"/g, '""')}","${e.output_text.replace(/"/g, '""')}"`
            ).join('\n');
        } else {
            output = JSON.stringify(examples, null, 2);
        }

        res.json({
            session_id: sessionId,
            format: format || 'jsonl',
            count: examples.length,
            data: output
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get training sessions
app.get('/api/training/sessions', (req, res) => {
    try {
        const sessions = db.prepare('SELECT * FROM training_sessions ORDER BY created_at DESC').all();
        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-capture toggle state (in-memory)
let autoCapture = { enabled: false, source: 'relay' };

app.get('/api/training/capture', (req, res) => {
    res.json(autoCapture);
});

app.post('/api/training/capture', (req, res) => {
    const { enabled, source } = req.body;
    autoCapture = { enabled: !!enabled, source: source || 'relay' };
    broadcast('training:capture_toggled', autoCapture);
    res.json({ success: true, ...autoCapture });
});

// Hook to capture from task completions (call this when a task completes)
function captureTrainingExample(input, output, source = 'relay') {
    if (!autoCapture.enabled) return null;

    const id = `train_${Date.now()}`;
    db.prepare(`
        INSERT INTO training_examples (id, input_text, output_text, source, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, input, output, source, Date.now());

    broadcast('training:auto_captured', { id, source });
    return id;
}

// ============================================
// TRAINING METRICS (Loss/Perplexity Tracking)
// ============================================

// GET /api/training/metrics - get training metrics
app.get('/api/training/metrics', (req, res) => {
    try {
        const { model, limit = 100 } = req.query;
        let query = 'SELECT * FROM training_metrics';
        const params = [];

        if (model) {
            query += ' WHERE model = ?';
            params.push(model);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(parseInt(limit));

        const metrics = db.prepare(query).all(...params);

        // Get distinct models for filter dropdown
        const models = db.prepare('SELECT DISTINCT model FROM training_metrics ORDER BY model').all();

        res.json({
            metrics,
            models: models.map(m => m.model)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/training/metrics - record new metric
app.post('/api/training/metrics', (req, res) => {
    try {
        const {
            model,
            epoch,
            loss,
            perplexity,
            accuracy,
            val_loss,
            val_perplexity,
            learning_rate,
            notes
        } = req.body;

        if (!model) {
            return res.status(400).json({ error: 'Model name is required' });
        }

        const stmt = db.prepare(`
            INSERT INTO training_metrics
            (model, epoch, loss, perplexity, accuracy, val_loss, val_perplexity, learning_rate, notes, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            model,
            epoch || null,
            loss || null,
            perplexity || null,
            accuracy || null,
            val_loss || null,
            val_perplexity || null,
            learning_rate || null,
            notes || null,
            Date.now()
        );

        broadcast('training:metric_recorded', { id: result.lastInsertRowid, model });

        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: `Metric recorded for ${model}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/training/metrics/:id - delete a metric
app.delete('/api/training/metrics/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM training_metrics WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// KITT LIVE UPDATES API
// ============================================

const UPDATES_DIR = path.join(__dirname, 'updates');
if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

// GET /api/updates/:app - Get update manifest for an app
app.get('/api/updates/:app', (req, res) => {
    try {
        const appName = req.params.app;
        const manifestPath = path.join(UPDATES_DIR, appName, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            return res.status(404).json({ error: 'No updates available' });
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        res.json(manifest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/updates/:app/download/:file - Download update file
app.get('/api/updates/:app/download/:file', (req, res) => {
    try {
        const { app: appName, file } = req.params;
        const filePath = path.join(UPDATES_DIR, appName, 'files', file);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(filePath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/updates/:app/publish - Publish a new update (for dev use)
app.post('/api/updates/:app/publish', (req, res) => {
    try {
        const appName = req.params.app;
        const { version, changelog, files, type } = req.body;

        if (!version) {
            return res.status(400).json({ error: 'Version is required' });
        }

        const appDir = path.join(UPDATES_DIR, appName);
        const filesDir = path.join(appDir, 'files');

        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true });
        }

        const manifest = {
            version,
            changelog: changelog || `Update to version ${version}`,
            type: type || 'incremental',
            publishedAt: new Date().toISOString(),
            files: files || [],
            downloadUrl: `http://localhost:${PORT}/api/updates/${appName}/download/update.zip`
        };

        fs.writeFileSync(
            path.join(appDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        broadcast('update:published', { app: appName, version });
        log(`Update published: ${appName} v${version}`);

        res.json({ success: true, manifest });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/updates - List all apps with updates
app.get('/api/updates', (req, res) => {
    try {
        const apps = [];

        if (fs.existsSync(UPDATES_DIR)) {
            const dirs = fs.readdirSync(UPDATES_DIR);
            for (const dir of dirs) {
                const manifestPath = path.join(UPDATES_DIR, dir, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    apps.push({ app: dir, ...manifest });
                }
            }
        }

        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// CONVERSATION API (Kitt session memory)
// ============================================

// Get conversation history for a session
app.get('/api/conversations/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const limit = parseInt(req.query.limit) || 20;

        const messages = db.prepare(`
            SELECT role, content, timestamp
            FROM conversations
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `).all(sessionId, limit);

        // Return in chronological order
        res.json({ sessionId, messages: messages.reverse() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add message to conversation
app.post('/api/conversations/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { role, content } = req.body;

        if (!role || !content) {
            return res.status(400).json({ error: 'role and content required' });
        }

        const timestamp = Date.now();
        db.prepare(`
            INSERT INTO conversations (session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?)
        `).run(sessionId, role, content, timestamp);

        // Keep only last 50 messages per session
        db.prepare(`
            DELETE FROM conversations
            WHERE session_id = ?
            AND id NOT IN (
                SELECT id FROM conversations
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT 50
            )
        `).run(sessionId, sessionId);

        res.json({ success: true, sessionId, role, timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear conversation history for a session
app.delete('/api/conversations/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = db.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId);
        res.json({ success: true, deleted: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// KNOWLEDGE BACKUP API
// ============================================

const crypto = require('crypto');

// Backup CLAUDE.md or STANDARDS.md
app.post('/api/knowledge/backup', (req, res) => {
    try {
        const { type, sessionId } = req.body;

        if (!type || !['claude_md', 'standards_md'].includes(type)) {
            return res.status(400).json({ error: 'type must be claude_md or standards_md' });
        }

        // Determine file path
        const filePath = type === 'claude_md'
            ? path.join(__dirname, '..', '..', 'CLAUDE.md')
            : path.join(__dirname, '..', '..', 'STANDARDS.md');

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `File not found: ${filePath}` });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // Check if content has changed since last backup
        const lastBackup = db.prepare(`
            SELECT hash FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1
        `).get(type);

        if (lastBackup && lastBackup.hash === hash) {
            return res.json({
                success: true,
                message: 'No changes detected, skipping backup',
                hash,
                changed: false
            });
        }

        // Insert new backup
        const timestamp = Date.now();
        db.prepare(`
            INSERT INTO knowledge (type, content, hash, session_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(type, content, hash, sessionId || null, timestamp);

        // Count total backups for this type
        const count = db.prepare(`SELECT COUNT(*) as count FROM knowledge WHERE type = ?`).get(type);

        log(`Knowledge backup: ${type} (hash: ${hash.substring(0, 8)}...)`);
        res.json({
            success: true,
            type,
            hash,
            timestamp,
            changed: true,
            totalBackups: count.count
        });
    } catch (err) {
        log(`Knowledge backup error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// List all backups for a type
app.get('/api/knowledge/list/:type', (req, res) => {
    try {
        const { type } = req.params;

        if (!['claude_md', 'standards_md'].includes(type)) {
            return res.status(400).json({ error: 'type must be claude_md or standards_md' });
        }

        const backups = db.prepare(`
            SELECT id, hash, session_id, created_at, LENGTH(content) as size
            FROM knowledge
            WHERE type = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).all(type);

        res.json({ type, count: backups.length, backups });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific backup or latest
app.get('/api/knowledge/restore/:type', (req, res) => {
    try {
        const { type } = req.params;
        const { id } = req.query;

        if (!['claude_md', 'standards_md'].includes(type)) {
            return res.status(400).json({ error: 'type must be claude_md or standards_md' });
        }

        let backup;
        if (id) {
            backup = db.prepare(`SELECT * FROM knowledge WHERE type = ? AND id = ?`).get(type, id);
        } else {
            backup = db.prepare(`SELECT * FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1`).get(type);
        }

        if (!backup) {
            return res.status(404).json({ error: `No backup found for ${type}` });
        }

        res.json({
            id: backup.id,
            type: backup.type,
            content: backup.content,
            hash: backup.hash,
            sessionId: backup.session_id,
            createdAt: backup.created_at
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restore a backup to file
app.post('/api/knowledge/restore/:type', (req, res) => {
    try {
        const { type } = req.params;
        const { id } = req.body;

        if (!['claude_md', 'standards_md'].includes(type)) {
            return res.status(400).json({ error: 'type must be claude_md or standards_md' });
        }

        let backup;
        if (id) {
            backup = db.prepare(`SELECT * FROM knowledge WHERE type = ? AND id = ?`).get(type, id);
        } else {
            backup = db.prepare(`SELECT * FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1`).get(type);
        }

        if (!backup) {
            return res.status(404).json({ error: `No backup found for ${type}` });
        }

        // Write to file
        const filePath = type === 'claude_md'
            ? path.join(__dirname, '..', '..', 'CLAUDE.md')
            : path.join(__dirname, '..', '..', 'STANDARDS.md');

        fs.writeFileSync(filePath, backup.content, 'utf8');

        log(`Knowledge restored: ${type} from backup ${backup.id}`);
        res.json({
            success: true,
            type,
            backupId: backup.id,
            hash: backup.hash,
            restoredAt: Date.now()
        });
    } catch (err) {
        log(`Knowledge restore error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Backup both files at once (syncmem)
app.post('/api/knowledge/sync', (req, res) => {
    try {
        const { sessionId } = req.body;
        const results = [];

        for (const type of ['claude_md', 'standards_md']) {
            const filePath = type === 'claude_md'
                ? path.join(__dirname, '..', '..', 'CLAUDE.md')
                : path.join(__dirname, '..', '..', 'STANDARDS.md');

            if (!fs.existsSync(filePath)) {
                results.push({ type, error: 'File not found' });
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            const lastBackup = db.prepare(`
                SELECT hash FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1
            `).get(type);

            if (lastBackup && lastBackup.hash === hash) {
                results.push({ type, changed: false, hash });
            } else {
                const timestamp = Date.now();
                db.prepare(`
                    INSERT INTO knowledge (type, content, hash, session_id, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(type, content, hash, sessionId || null, timestamp);
                results.push({ type, changed: true, hash, timestamp });
            }
        }

        const changed = results.filter(r => r.changed).length;
        log(`Knowledge sync: ${changed} file(s) backed up`);
        res.json({ success: true, results, changed });
    } catch (err) {
        log(`Knowledge sync error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Get backup status (for UI display)
app.get('/api/knowledge/status', (req, res) => {
    try {
        const status = {};

        for (const type of ['claude_md', 'standards_md']) {
            const latest = db.prepare(`
                SELECT hash, created_at FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1
            `).get(type);
            const count = db.prepare(`SELECT COUNT(*) as count FROM knowledge WHERE type = ?`).get(type);

            status[type] = {
                lastBackup: latest ? latest.created_at : null,
                lastHash: latest ? latest.hash.substring(0, 8) : null,
                totalBackups: count.count
            };
        }

        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// FILE STATE API (Session File Tracking)
// ============================================

// Record a file operation
app.post('/api/session/files', (req, res) => {
    try {
        const { session_id, file_path, operation, file_size, lines_changed, hash, metadata } = req.body;

        if (!session_id || !file_path || !operation) {
            return res.status(400).json({ error: 'session_id, file_path, and operation are required' });
        }

        const validOps = ['read', 'write', 'create', 'edit', 'delete'];
        if (!validOps.includes(operation)) {
            return res.status(400).json({ error: `Invalid operation. Must be one of: ${validOps.join(', ')}` });
        }

        const stmt = db.prepare(`
            INSERT INTO file_state (session_id, file_path, operation, file_size, lines_changed, hash, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            session_id,
            file_path,
            operation,
            file_size || null,
            lines_changed || null,
            hash || null,
            metadata ? JSON.stringify(metadata) : null,
            Date.now()
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get files for a session
app.get('/api/session/files/:session_id', (req, res) => {
    try {
        const { session_id } = req.params;
        const operation = req.query.operation; // Filter by operation type

        let query = 'SELECT * FROM file_state WHERE session_id = ?';
        const params = [session_id];

        if (operation) {
            query += ' AND operation = ?';
            params.push(operation);
        }

        query += ' ORDER BY created_at DESC';

        const rows = db.prepare(query).all(...params);

        // Parse metadata JSON
        const files = rows.map(r => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : null
        }));

        res.json({
            session_id,
            count: files.length,
            files
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get session summary (unique files and operation counts)
app.get('/api/session/files/:session_id/summary', (req, res) => {
    try {
        const { session_id } = req.params;

        const stats = db.prepare(`
            SELECT operation, COUNT(*) as count
            FROM file_state WHERE session_id = ?
            GROUP BY operation
        `).all(session_id);

        const uniqueFiles = db.prepare(`
            SELECT DISTINCT file_path, MAX(created_at) as last_access
            FROM file_state WHERE session_id = ?
            GROUP BY file_path
            ORDER BY last_access DESC
        `).all(session_id);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM file_state WHERE session_id = ?
        `).get(session_id);

        res.json({
            session_id,
            total_operations: total.count,
            unique_files: uniqueFiles.length,
            operations: Object.fromEntries(stats.map(s => [s.operation, s.count])),
            files: uniqueFiles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all sessions with file activity
app.get('/api/session/files', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;

        const sessions = db.prepare(`
            SELECT session_id,
                   COUNT(*) as total_operations,
                   COUNT(DISTINCT file_path) as unique_files,
                   MIN(created_at) as started_at,
                   MAX(created_at) as last_activity
            FROM file_state
            GROUP BY session_id
            ORDER BY last_activity DESC
            LIMIT ?
        `).all(limit);

        res.json({ count: sessions.length, sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk record file operations
app.post('/api/session/files/bulk', (req, res) => {
    try {
        const { session_id, files } = req.body;

        if (!session_id || !Array.isArray(files)) {
            return res.status(400).json({ error: 'session_id and files array required' });
        }

        const stmt = db.prepare(`
            INSERT INTO file_state (session_id, file_path, operation, file_size, lines_changed, hash, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const inserted = db.transaction((files) => {
            let count = 0;
            for (const f of files) {
                stmt.run(
                    session_id,
                    f.file_path,
                    f.operation || 'read',
                    f.file_size || null,
                    f.lines_changed || null,
                    f.hash || null,
                    f.metadata ? JSON.stringify(f.metadata) : null,
                    f.timestamp || Date.now()
                );
                count++;
            }
            return count;
        })(files);

        res.json({ success: true, inserted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// INTEL API (Intelligence Database)
// ============================================

// Get intel summary from database
app.get('/api/intel/db', (req, res) => {
    try {
        const news = db.prepare('SELECT COUNT(*) as count FROM intel_news').get();
        const github = db.prepare('SELECT COUNT(*) as count FROM intel_github').get();
        const models = db.prepare('SELECT COUNT(*) as count FROM intel_models').get();
        const health = db.prepare('SELECT COUNT(*) as count FROM intel_health').get();
        const briefings = db.prepare('SELECT COUNT(*) as count FROM intel_briefings').get();

        res.json({
            tables: {
                news: news.count,
                github: github.count,
                models: models.count,
                health: health.count,
                briefings: briefings.count
            },
            total: news.count + github.count + models.count + health.count + briefings.count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get news from database
app.get('/api/intel/db/news', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const aiOnly = req.query.ai === 'true';

        let query = 'SELECT * FROM intel_news';
        if (aiOnly) query += ' WHERE is_ai_related = 1';
        query += ' ORDER BY published_at DESC LIMIT ?';

        const rows = db.prepare(query).all(limit);
        res.json({ count: rows.length, items: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get GitHub releases from database
app.get('/api/intel/db/github', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const repo = req.query.repo;

        let query = 'SELECT * FROM intel_github';
        const params = [];
        if (repo) {
            query += ' WHERE repo LIKE ?';
            params.push(`%${repo}%`);
        }
        query += ' ORDER BY discovered_at DESC LIMIT ?';
        params.push(limit);

        const rows = db.prepare(query).all(...params);
        res.json({ count: rows.length, items: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get health anomalies from database
app.get('/api/intel/db/health', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const rows = db.prepare('SELECT * FROM intel_health ORDER BY timestamp DESC LIMIT ?').all(limit);
        res.json({ count: rows.length, items: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Store intel item (used by Oracle)
app.post('/api/intel/db/store', (req, res) => {
    try {
        const { type, data } = req.body;

        if (type === 'news') {
            const stmt = db.prepare('INSERT OR IGNORE INTO intel_news (source, external_id, title, url, score, is_ai_related, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            stmt.run(data.source, data.external_id, data.title, data.url, data.score, data.is_ai_related ? 1 : 0, data.published_at);
        } else if (type === 'github') {
            const stmt = db.prepare('INSERT OR IGNORE INTO intel_github (repo, tag, name, url, release_type, published_at, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            stmt.run(data.repo, data.tag, data.name, data.url, data.release_type, data.published_at, data.discovered_at);
        } else if (type === 'health') {
            const stmt = db.prepare('INSERT INTO intel_health (timestamp, type, services, severity) VALUES (?, ?, ?, ?)');
            stmt.run(data.timestamp, data.type, JSON.stringify(data.services), data.severity);
        } else if (type === 'model') {
            const stmt = db.prepare('INSERT OR IGNORE INTO intel_models (name, size, digest, source, discovered_at) VALUES (?, ?, ?, ?, ?)');
            stmt.run(data.name, data.size, data.digest, data.source || 'ollama', data.discovered_at);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
