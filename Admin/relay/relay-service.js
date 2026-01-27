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
const crypto = require('crypto');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const https = require('https');

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
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');     // Faster writes, safe with WAL
    db.pragma('cache_size = -64000');      // 64MB cache (default is 2MB)
    db.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O
    db.pragma('temp_store = MEMORY');      // Temp tables in RAM

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

    // Sessions - named sessions for tracking work
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            tags TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            ended_at INTEGER
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at)`);

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

    // ========== Hive State Tables (Cross-Session Memory) ==========

    // Services registry - every service in the ecosystem
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_services (
            name TEXT PRIMARY KEY,
            port INTEGER,
            owner TEXT NOT NULL,
            health_path TEXT,
            description TEXT,
            directory TEXT,
            status TEXT DEFAULT 'unknown',
            last_seen INTEGER,
            tags TEXT DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        )
    `);

    // Operational rules and constraints
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            rule TEXT NOT NULL,
            severity TEXT DEFAULT 'must',
            reason TEXT,
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_hive_rules_category ON hive_rules(category)`);

    // Network nodes and capabilities
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_network (
            hostname TEXT PRIMARY KEY,
            ip TEXT NOT NULL,
            role TEXT NOT NULL,
            gpu TEXT,
            ram TEXT,
            cpu TEXT,
            capabilities TEXT DEFAULT '[]',
            llm_enabled INTEGER DEFAULT 1,
            status TEXT DEFAULT 'unknown',
            last_seen INTEGER,
            updated_at INTEGER
        )
    `);

    // Architectural decisions - cross-session visible
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            topic TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT,
            files_changed TEXT DEFAULT '[]',
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_topic ON hive_decisions(topic)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_created ON hive_decisions(created_at)`);

    // Incidents - what broke, why, how it was fixed
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            root_cause TEXT NOT NULL,
            fix TEXT NOT NULL,
            prevention TEXT,
            services_affected TEXT DEFAULT '[]',
            severity TEXT DEFAULT 'medium',
            resolved INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_incidents_severity ON hive_incidents(severity)`);

    // Key-value store for arbitrary structured state
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            updated_by TEXT,
            updated_at INTEGER NOT NULL
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_hive_state_category ON hive_state(category)`);

    // AI persona definitions
    db.exec(`
        CREATE TABLE IF NOT EXISTS hive_ai_identities (
            name TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            voice TEXT,
            location TEXT,
            model TEXT,
            port INTEGER,
            capabilities TEXT DEFAULT '[]',
            active INTEGER DEFAULT 1,
            updated_at INTEGER
        )
    `);

    // ---- Limitless Memory ----
    // Persistent cross-session memory for all AI agents
    db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'general',
            tags TEXT DEFAULT '[]',
            source TEXT DEFAULT 'claude',
            importance INTEGER DEFAULT 5,
            context TEXT,
            session_id TEXT,
            content_hash TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            accessed_at INTEGER,
            access_count INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived)`);

    // Migrate: add content_hash column if missing (existing DBs)
    try { db.exec(`ALTER TABLE memories ADD COLUMN content_hash TEXT`); } catch (e) { /* already exists */ }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash)`);

    // FTS5 full-text search index
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, tags, context, category, content='memories', content_rowid='id')`);

    // Triggers to keep FTS5 in sync
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
            INSERT INTO memories_fts(rowid, content, tags, context, category) VALUES (new.id, new.content, new.tags, new.context, new.category);
        END
    `);
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, content, tags, context, category) VALUES ('delete', old.id, old.content, old.tags, old.context, old.category);
        END
    `);
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, content, tags, context, category) VALUES ('delete', old.id, old.content, old.tags, old.context, old.category);
            INSERT INTO memories_fts(rowid, content, tags, context, category) VALUES (new.id, new.content, new.tags, new.context, new.category);
        END
    `);

    // Rebuild FTS index from existing data (safe to run multiple times)
    try {
        const ftsCount = db.prepare('SELECT COUNT(*) as c FROM memories_fts').get().c;
        const memCount = db.prepare('SELECT COUNT(*) as c FROM memories').get().c;
        if (ftsCount === 0 && memCount > 0) {
            db.exec(`INSERT INTO memories_fts(rowid, content, tags, context, category) SELECT id, content, tags, context, category FROM memories`);
        }
        // Optimize FTS5 index on startup (merges segments for faster queries)
        db.exec(`INSERT INTO memories_fts(memories_fts) VALUES ('optimize')`);
    } catch (e) { /* FTS rebuild/optimize not critical */ }

    // Links between related memories
    db.exec(`
        CREATE TABLE IF NOT EXISTS memory_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            target_id INTEGER NOT NULL,
            relationship TEXT DEFAULT 'related',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE,
            UNIQUE(source_id, target_id)
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_id)`);

    // ---- Memory Embeddings (semantic search via Ollama) ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS memory_embeddings (
            memory_id INTEGER PRIMARY KEY,
            embedding TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'nomic-embed-text',
            dimensions INTEGER NOT NULL DEFAULT 768,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
        )
    `);

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
    // Get all pending sorted by priority then time (exclude plugin dispatches — use /api/plugin/pending)
    const pending = db.prepare(`
        SELECT * FROM tasks
        WHERE status = 'pending' AND (task_type IS NULL OR task_type != 'plugin_dispatch')
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

// Clear all dead letters
app.delete('/api/tasks/dead-letters', (req, res) => {
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM dead_letters').get();
        db.prepare('DELETE FROM dead_letters').run();
        log(`Cleared ${count.count} dead letters`);
        res.json({ success: true, cleared: count.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
// SESSION API (Named Sessions)
// ============================================

// Create a new session
app.post('/api/sessions', (req, res) => {
    try {
        const { id, name, description, tags } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const sessionId = id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        const stmt = db.prepare(`
            INSERT INTO sessions (id, name, description, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            sessionId,
            name,
            description || null,
            tags ? JSON.stringify(tags) : null,
            Date.now(),
            Date.now()
        );

        res.json({ success: true, id: sessionId, name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Session ID already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// List all sessions
app.get('/api/sessions', (req, res) => {
    try {
        const status = req.query.status || 'active';
        const limit = parseInt(req.query.limit) || 50;

        let query = 'SELECT * FROM sessions';
        const params = [];

        if (status !== 'all') {
            query += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY updated_at DESC LIMIT ?';
        params.push(limit);

        const sessions = db.prepare(query).all(...params);

        // Enrich with file counts
        const enriched = sessions.map(s => {
            const fileCount = db.prepare('SELECT COUNT(*) as count FROM file_state WHERE session_id = ?').get(s.id);
            return {
                ...s,
                tags: s.tags ? JSON.parse(s.tags) : [],
                file_count: fileCount.count
            };
        });

        res.json({ count: enriched.length, sessions: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a session by ID
app.get('/api/sessions/:id', (req, res) => {
    try {
        const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Get file summary
        const files = db.prepare(`
            SELECT file_path, operation, created_at
            FROM file_state WHERE session_id = ?
            ORDER BY created_at DESC
        `).all(req.params.id);

        const stats = db.prepare(`
            SELECT operation, COUNT(*) as count
            FROM file_state WHERE session_id = ?
            GROUP BY operation
        `).all(req.params.id);

        res.json({
            ...session,
            tags: session.tags ? JSON.parse(session.tags) : [],
            files: {
                count: files.length,
                operations: Object.fromEntries(stats.map(s => [s.operation, s.count])),
                recent: files.slice(0, 20)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a session
app.patch('/api/sessions/:id', (req, res) => {
    try {
        const { name, description, status, tags } = req.body;
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = ?');
        params.push(Date.now());

        if (status === 'ended') {
            updates.push('ended_at = ?');
            params.push(Date.now());
        }

        params.push(req.params.id);

        const stmt = db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`);
        const result = stmt.run(...params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ success: true, updated: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// End a session
app.post('/api/sessions/:id/end', (req, res) => {
    try {
        const stmt = db.prepare(`
            UPDATE sessions SET status = 'ended', ended_at = ?, updated_at = ? WHERE id = ?
        `);
        const result = stmt.run(Date.now(), Date.now(), req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ success: true, message: 'Session ended' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a session (and its file records)
app.delete('/api/sessions/:id', (req, res) => {
    try {
        const deleteFiles = db.prepare('DELETE FROM file_state WHERE session_id = ?');
        const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');

        const transaction = db.transaction((id) => {
            const filesDeleted = deleteFiles.run(id);
            const sessionDeleted = deleteSession.run(id);
            return { files: filesDeleted.changes, session: sessionDeleted.changes };
        });

        const result = transaction(req.params.id);

        if (result.session === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ success: true, deleted: result });
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
// HIVE STATE API (Cross-Session Memory)
// ============================================

// --- Smart Context Query ---
app.get('/api/hive/context', (req, res) => {
    try {
        const task = (req.query.task || '').toLowerCase();
        const scope = req.query.scope || 'minimal';
        const result = {};

        // Parse task for keywords to filter relevant data
        const keywords = task.split(/[\s+,]+/).filter(w => w.length > 2);

        // Services - filter by keyword match or return all for full scope
        if (scope === 'full' || keywords.length === 0) {
            result.services = db.prepare('SELECT name, port, owner, status, description FROM hive_services ORDER BY name').all();
        } else {
            const likeConditions = keywords.map(() => '(name LIKE ? OR description LIKE ? OR tags LIKE ?)').join(' OR ');
            const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);
            result.services = db.prepare(`SELECT name, port, owner, status, description FROM hive_services WHERE ${likeConditions} ORDER BY name`).all(...params);
            // Always include services that are down
            const down = db.prepare("SELECT name, port, owner, status, description FROM hive_services WHERE status IN ('stopped', 'error')").all();
            const names = new Set(result.services.map(s => s.name));
            for (const s of down) {
                if (!names.has(s.name)) result.services.push(s);
            }
        }

        // Network nodes - always include (compact)
        result.network = db.prepare('SELECT hostname, ip, role, gpu, llm_enabled, status FROM hive_network ORDER BY hostname').all();

        // Recent decisions - last 24h or last 10
        const since = Date.now() - 24 * 60 * 60 * 1000;
        result.decisions = db.prepare('SELECT summary, topic, created_at FROM hive_decisions WHERE created_at > ? ORDER BY created_at DESC LIMIT 10').all(since);

        // Recent incidents - unresolved or last 5
        result.incidents = db.prepare('SELECT title, severity, fix, resolved FROM hive_incidents WHERE resolved = 0 OR created_at > ? ORDER BY created_at DESC LIMIT 5').all(since);

        // Rules - must-follow rules always, others if full scope
        if (scope === 'full') {
            result.rules = db.prepare('SELECT category, rule, severity FROM hive_rules ORDER BY severity, category').all();
        } else {
            result.rules = db.prepare("SELECT category, rule FROM hive_rules WHERE severity = 'must' ORDER BY category").all();
        }

        // AI identities - only if task mentions ai/persona/voice
        if (scope === 'full' || keywords.some(k => ['ai', 'persona', 'voice', 'identity', 'kit', 'oracle', 'mind', 'nova'].includes(k))) {
            result.identities = db.prepare('SELECT name, role, voice, location FROM hive_ai_identities WHERE active = 1').all();
        }

        // Pending messages count
        try {
            const pending = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get();
            result.pending_messages = pending.count;
        } catch (e) {
            result.pending_messages = 0;
        }

        // Format as compact context string
        let context = '=== HIVE CONTEXT ===\n';

        if (result.services.length > 0) {
            context += 'Services: ' + result.services.map(s => `${s.name}:${s.port}(${s.status || '?'})`).join(' ') + '\n';
        }

        if (result.network.length > 0) {
            context += 'Network: ' + result.network.map(n => `${n.hostname}(${n.role}${n.gpu ? ',' + n.gpu : ''}${n.llm_enabled ? '' : ',no-llm'})`).join(' ') + '\n';
        }

        if (result.decisions.length > 0) {
            context += 'Recent decisions:\n' + result.decisions.map(d => `  - ${d.summary}`).join('\n') + '\n';
        }

        if (result.incidents.length > 0) {
            context += 'Incidents:\n' + result.incidents.map(i => `  - [${i.resolved ? 'RESOLVED' : 'OPEN'}] ${i.title}`).join('\n') + '\n';
        }

        if (result.rules.length > 0) {
            context += 'Rules: ' + result.rules.map(r => r.rule).join(' | ') + '\n';
        }

        if (result.identities && result.identities.length > 0) {
            context += 'AI: ' + result.identities.map(i => `${i.name}(${i.role})`).join(' ') + '\n';
        }

        if (result.pending_messages > 0) {
            context += `Pending messages: ${result.pending_messages} awaiting response\n`;
        }

        // Limitless Memory - FTS5-powered recall for this task
        if (keywords.length > 0) {
            try {
                let memories;
                const ftsQuery = keywords.filter(w => w.length > 2).map(w => `"${w.replace(/"/g, '')}"`).join(' OR ');
                if (ftsQuery) {
                    try {
                        memories = db.prepare(`
                            SELECT m.id, m.content, m.category, m.importance FROM memories m
                            JOIN memories_fts f ON m.id = f.rowid
                            WHERE f.memories_fts MATCH ? AND m.archived = 0
                            ORDER BY m.importance DESC, m.updated_at DESC LIMIT 5
                        `).all(ftsQuery);
                    } catch (ftsErr) {
                        // FTS fallback
                        const likeConditions = keywords.map(() => '(LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)').join(' OR ');
                        const memParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
                        memories = db.prepare(`
                            SELECT id, content, category, importance FROM memories
                            WHERE archived = 0 AND (${likeConditions})
                            ORDER BY importance DESC, updated_at DESC LIMIT 5
                        `).all(...memParams);
                    }
                }

                if (memories && memories.length > 0) {
                    result.memories = memories;
                    context += 'Memories:\n' + memories.map(m => `  - [${m.category}] ${m.content.substring(0, 120)}`).join('\n') + '\n';

                    // Track access
                    const updateAccess = db.prepare('UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?');
                    const now = Date.now();
                    for (const m of memories) { updateAccess.run(now, m.id); }
                }
            } catch (memErr) {
                log(`Memory recall in context failed: ${memErr.message}`, 'WARN');
            }
        }

        res.json({ context, data: result });
    } catch (err) {
        log(`Hive context error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// --- Services CRUD ---
app.get('/api/hive/services', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_services WHERE 1=1';
        const params = [];
        if (req.query.owner) { query += ' AND owner = ?'; params.push(req.query.owner); }
        if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
        query += ' ORDER BY name';
        res.json(db.prepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/hive/services/:name', (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM hive_services WHERE name = ?').get(req.params.name);
        if (!row) return res.status(404).json({ error: 'Service not found' });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/services', (req, res) => {
    try {
        const { name, port, owner, health_path, description, directory, status, tags } = req.body;
        if (!name || !owner) return res.status(400).json({ error: 'name and owner required' });
        const now = Date.now();
        db.prepare(`INSERT INTO hive_services (name, port, owner, health_path, description, directory, status, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET port=excluded.port, owner=excluded.owner, health_path=excluded.health_path,
            description=excluded.description, directory=excluded.directory, status=excluded.status, tags=excluded.tags, updated_at=?`)
            .run(name, port || null, owner, health_path || null, description || null, directory || null, status || 'unknown', JSON.stringify(tags || []), now, now, now);
        res.json({ success: true, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hive/services/:name', (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM hive_services WHERE name = ?').get(req.params.name);
        if (!existing) return res.status(404).json({ error: 'Service not found' });
        const { port, owner, health_path, description, directory, status, tags, last_seen } = req.body;
        db.prepare(`UPDATE hive_services SET port=COALESCE(?,port), owner=COALESCE(?,owner), health_path=COALESCE(?,health_path),
            description=COALESCE(?,description), directory=COALESCE(?,directory), status=COALESCE(?,status),
            tags=COALESCE(?,tags), last_seen=COALESCE(?,last_seen), updated_at=? WHERE name=?`)
            .run(port, owner, health_path, description, directory, status, tags ? JSON.stringify(tags) : null, last_seen, Date.now(), req.params.name);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/hive/services/:name', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM hive_services WHERE name = ?').run(req.params.name);
        if (result.changes === 0) return res.status(404).json({ error: 'Service not found' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Rules ---
app.get('/api/hive/rules', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_rules WHERE 1=1';
        const params = [];
        if (req.query.category) { query += ' AND category = ?'; params.push(req.query.category); }
        if (req.query.severity) { query += ' AND severity = ?'; params.push(req.query.severity); }
        query += ' ORDER BY severity, category';
        res.json(db.prepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/rules', (req, res) => {
    try {
        const { category, rule, severity, reason } = req.body;
        if (!category || !rule) return res.status(400).json({ error: 'category and rule required' });
        const result = db.prepare('INSERT INTO hive_rules (category, rule, severity, reason, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(category, rule, severity || 'must', reason || null, Date.now());
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Network ---
app.get('/api/hive/network', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM hive_network ORDER BY hostname').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/hive/network/:hostname', (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM hive_network WHERE hostname = ?').get(req.params.hostname);
        if (!row) return res.status(404).json({ error: 'Node not found' });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/network', (req, res) => {
    try {
        const { hostname, ip, role, gpu, ram, cpu, capabilities, llm_enabled, status } = req.body;
        if (!hostname || !ip || !role) return res.status(400).json({ error: 'hostname, ip, and role required' });
        db.prepare(`INSERT INTO hive_network (hostname, ip, role, gpu, ram, cpu, capabilities, llm_enabled, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(hostname) DO UPDATE SET ip=excluded.ip, role=excluded.role, gpu=excluded.gpu, ram=excluded.ram,
            cpu=excluded.cpu, capabilities=excluded.capabilities, llm_enabled=excluded.llm_enabled, status=excluded.status, updated_at=excluded.updated_at`)
            .run(hostname, ip, role, gpu || null, ram || null, cpu || null, JSON.stringify(capabilities || []), llm_enabled !== undefined ? (llm_enabled ? 1 : 0) : 1, status || 'unknown', Date.now());
        res.json({ success: true, hostname });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hive/network/:hostname', (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM hive_network WHERE hostname = ?').get(req.params.hostname);
        if (!existing) return res.status(404).json({ error: 'Node not found' });
        const { ip, role, gpu, ram, cpu, capabilities, llm_enabled, status, last_seen } = req.body;
        db.prepare(`UPDATE hive_network SET ip=COALESCE(?,ip), role=COALESCE(?,role), gpu=COALESCE(?,gpu), ram=COALESCE(?,ram),
            cpu=COALESCE(?,cpu), capabilities=COALESCE(?,capabilities), llm_enabled=COALESCE(?,llm_enabled),
            status=COALESCE(?,status), last_seen=COALESCE(?,last_seen), updated_at=? WHERE hostname=?`)
            .run(ip, role, gpu, ram, cpu, capabilities ? JSON.stringify(capabilities) : null, llm_enabled !== undefined ? (llm_enabled ? 1 : 0) : null, status, last_seen, Date.now(), req.params.hostname);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Decisions ---
app.get('/api/hive/decisions', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_decisions WHERE 1=1';
        const params = [];
        if (req.query.topic) { query += ' AND topic = ?'; params.push(req.query.topic); }
        if (req.query.since) { query += ' AND created_at > ?'; params.push(parseInt(req.query.since)); }
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(req.query.limit) || 20);
        res.json(db.prepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/decisions', (req, res) => {
    try {
        const { session_id, topic, summary, details, files_changed } = req.body;
        if (!topic || !summary) return res.status(400).json({ error: 'topic and summary required' });
        const result = db.prepare('INSERT INTO hive_decisions (session_id, topic, summary, details, files_changed, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(session_id || null, topic, summary, details || null, JSON.stringify(files_changed || []), Date.now());
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Incidents ---
app.get('/api/hive/incidents', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_incidents WHERE 1=1';
        const params = [];
        if (req.query.severity) { query += ' AND severity = ?'; params.push(req.query.severity); }
        if (req.query.resolved !== undefined) { query += ' AND resolved = ?'; params.push(parseInt(req.query.resolved)); }
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(req.query.limit) || 10);
        res.json(db.prepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/incidents', (req, res) => {
    try {
        const { title, root_cause, fix, prevention, services_affected, severity, resolved } = req.body;
        if (!title || !root_cause || !fix) return res.status(400).json({ error: 'title, root_cause, and fix required' });
        const result = db.prepare('INSERT INTO hive_incidents (title, root_cause, fix, prevention, services_affected, severity, resolved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(title, root_cause, fix, prevention || null, JSON.stringify(services_affected || []), severity || 'medium', resolved !== undefined ? (resolved ? 1 : 0) : 1, Date.now());
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- State (key-value) ---
app.get('/api/hive/state', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_state';
        const params = [];
        if (req.query.category) { query += ' WHERE category = ?'; params.push(req.query.category); }
        query += ' ORDER BY key';
        res.json(db.prepare(query).all(...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/hive/state/:key', (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM hive_state WHERE key = ?').get(req.params.key);
        if (!row) return res.status(404).json({ error: 'Key not found' });
        res.json({ ...row, value: JSON.parse(row.value) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hive/state/:key', (req, res) => {
    try {
        const { value, category, updated_by } = req.body;
        if (value === undefined) return res.status(400).json({ error: 'value required' });
        const now = Date.now();
        db.prepare(`INSERT INTO hive_state (key, value, category, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, category=COALESCE(excluded.category,category), updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
            .run(req.params.key, JSON.stringify(value), category || 'general', updated_by || null, now);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- AI Identities ---
app.get('/api/hive/identities', (req, res) => {
    try {
        let query = 'SELECT * FROM hive_ai_identities';
        if (req.query.active !== undefined) {
            query += ' WHERE active = ' + (req.query.active === 'true' ? 1 : 0);
        }
        query += ' ORDER BY name';
        res.json(db.prepare(query).all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hive/identities', (req, res) => {
    try {
        const { name, role, voice, location, model, port, capabilities, active } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'name and role required' });
        db.prepare(`INSERT INTO hive_ai_identities (name, role, voice, location, model, port, capabilities, active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET role=excluded.role, voice=excluded.voice, location=excluded.location,
            model=excluded.model, port=excluded.port, capabilities=excluded.capabilities, active=excluded.active, updated_at=excluded.updated_at`)
            .run(name, role, voice || null, location || null, model || null, port || null, JSON.stringify(capabilities || []), active !== undefined ? (active ? 1 : 0) : 1, Date.now());
        res.json({ success: true, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// LIMITLESS MEMORY API
// ============================================

// Helper: hash content for deduplication
function memoryHash(content) {
    return crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
}

// --- Ollama Embedding Helpers ---
const OLLAMA_EMBED_URL = 'http://192.168.1.192:11434/api/embed';
const EMBED_MODEL = 'nomic-embed-text';
const EMBED_DIMENSIONS = 768;

function fetchEmbedding(text) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model: EMBED_MODEL, input: text.substring(0, 2048) });
        const url = new URL(OLLAMA_EMBED_URL);
        const req = http.request({
            hostname: url.hostname, port: url.port,
            path: url.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.embeddings && j.embeddings[0]) resolve(j.embeddings[0]);
                    else reject(new Error('No embedding returned'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Embed timeout')); });
        req.write(body);
        req.end();
    });
}

function storeEmbedding(memoryId, embedding) {
    try {
        db.prepare(`
            INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding, model, dimensions, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(memoryId, JSON.stringify(embedding), EMBED_MODEL, EMBED_DIMENSIONS, Date.now());
    } catch (err) {
        log(`Embedding store error for #${memoryId}: ${err.message}`, 'ERROR');
    }
}

function embedMemoryAsync(memoryId, content) {
    fetchEmbedding(content)
        .then(emb => storeEmbedding(memoryId, emb))
        .catch(() => {}); // Non-blocking — Ollama down is not fatal
}

function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag === 0 ? 0 : dot / mag;
}

// Store a new memory (with dedup)
app.post('/api/memory', (req, res) => {
    try {
        const { content, category, tags, source, importance, context, session_id } = req.body;
        if (!content) return res.status(400).json({ error: 'content is required' });

        const hash = memoryHash(content);
        const now = Date.now();

        // Dedup: check if content already exists
        const existing = db.prepare('SELECT id, importance, access_count FROM memories WHERE content_hash = ?').get(hash);
        if (existing) {
            // Merge: bump importance to max, increment access
            const newImp = Math.max(existing.importance, importance || 5);
            db.prepare('UPDATE memories SET importance = ?, access_count = access_count + 1, accessed_at = ?, updated_at = ? WHERE id = ?')
                .run(newImp, now, now, existing.id);
            log(`Memory deduped: #${existing.id} (importance → ${newImp})`);
            return res.json({ success: true, id: existing.id, deduplicated: true });
        }

        const result = db.prepare(`
            INSERT INTO memories (content, category, tags, source, importance, context, session_id, content_hash, created_at, updated_at, accessed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            content,
            category || 'general',
            JSON.stringify(tags || []),
            source || 'claude',
            importance || 5,
            context || null,
            session_id || null,
            hash,
            now, now, now
        );

        const newId = result.lastInsertRowid;
        log(`Memory stored: #${newId} [${category || 'general'}] ${content.substring(0, 80)}`);
        embedMemoryAsync(newId, content);
        res.json({ success: true, id: newId });
    } catch (err) {
        log(`Memory store error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// List/search memories (FTS5-accelerated)
app.get('/api/memory', (req, res) => {
    try {
        const { q, category, tag, source, importance, limit, offset, archived } = req.query;
        const maxLimit = parseInt(limit) || 50;
        const skipOffset = parseInt(offset) || 0;
        const isArchived = archived === 'true' ? 1 : 0;

        let memories;
        if (q) {
            // Use FTS5 for text search, join back for filters
            const ftsQuery = q.split(/\s+/).filter(w => w.length > 0).map(w => `"${w.replace(/"/g, '')}"`).join(' OR ');
            let query = `SELECT m.* FROM memories m JOIN memories_fts f ON m.id = f.rowid WHERE f.memories_fts MATCH ? AND m.archived = ?`;
            const params = [ftsQuery, isArchived];

            if (category) { query += ' AND m.category = ?'; params.push(category); }
            if (tag) { query += ' AND m.tags LIKE ?'; params.push(`%"${tag}"%`); }
            if (source) { query += ' AND m.source = ?'; params.push(source); }
            if (importance) { query += ' AND m.importance >= ?'; params.push(parseInt(importance)); }

            query += ' ORDER BY m.importance DESC, m.updated_at DESC LIMIT ? OFFSET ?';
            params.push(maxLimit, skipOffset);

            try {
                memories = db.prepare(query).all(...params);
            } catch (ftsErr) {
                // FTS query syntax error — fall back to LIKE
                let fallback = 'SELECT * FROM memories WHERE archived = ? AND content LIKE ?';
                const fbParams = [isArchived, `%${q}%`];
                if (category) { fallback += ' AND category = ?'; fbParams.push(category); }
                if (tag) { fallback += ' AND tags LIKE ?'; fbParams.push(`%"${tag}"%`); }
                if (source) { fallback += ' AND source = ?'; fbParams.push(source); }
                if (importance) { fallback += ' AND importance >= ?'; fbParams.push(parseInt(importance)); }
                fallback += ' ORDER BY importance DESC, updated_at DESC LIMIT ? OFFSET ?';
                fbParams.push(maxLimit, skipOffset);
                memories = db.prepare(fallback).all(...fbParams);
            }
        } else {
            let query = 'SELECT * FROM memories WHERE archived = ?';
            const params = [isArchived];
            if (category) { query += ' AND category = ?'; params.push(category); }
            if (tag) { query += ' AND tags LIKE ?'; params.push(`%"${tag}"%`); }
            if (source) { query += ' AND source = ?'; params.push(source); }
            if (importance) { query += ' AND importance >= ?'; params.push(parseInt(importance)); }
            query += ' ORDER BY importance DESC, updated_at DESC LIMIT ? OFFSET ?';
            params.push(maxLimit, skipOffset);
            memories = db.prepare(query).all(...params);
        }

        const total = db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = ?').get(isArchived);
        res.json({ memories, total: total.count, limit: maxLimit, offset: skipOffset });
    } catch (err) {
        log(`Memory list error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Smart recall - FTS5-powered, scored by importance + recency + access frequency
app.get('/api/memory/recall', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(400).json({ error: 'q (query) is required' });

        const keywords = q.toLowerCase().split(/[\s+,]+/).filter(w => w.length > 2);
        if (keywords.length === 0) return res.json({ memories: [] });

        const maxResults = parseInt(limit) || 20;
        const now = Date.now();
        let memories;

        try {
            // FTS5 search with relevance scoring
            const ftsQuery = keywords.map(w => `"${w.replace(/"/g, '')}"`).join(' OR ');
            memories = db.prepare(`
                SELECT m.*,
                    m.importance +
                    CASE WHEN (? - m.updated_at) < 86400000 THEN 5
                         WHEN (? - m.updated_at) < 604800000 THEN 3
                         WHEN (? - m.updated_at) < 2592000000 THEN 1
                         ELSE 0 END AS recency_bonus,
                    CASE WHEN m.access_count > 10 THEN 3
                         WHEN m.access_count > 5 THEN 2
                         WHEN m.access_count > 0 THEN 1
                         ELSE 0 END AS access_bonus
                FROM memories m
                JOIN memories_fts f ON m.id = f.rowid
                WHERE f.memories_fts MATCH ? AND m.archived = 0
                ORDER BY (m.importance +
                    CASE WHEN (? - m.updated_at) < 86400000 THEN 5
                         WHEN (? - m.updated_at) < 604800000 THEN 3
                         WHEN (? - m.updated_at) < 2592000000 THEN 1
                         ELSE 0 END +
                    CASE WHEN m.access_count > 10 THEN 3
                         WHEN m.access_count > 5 THEN 2
                         WHEN m.access_count > 0 THEN 1
                         ELSE 0 END) DESC
                LIMIT ?
            `).all(now, now, now, ftsQuery, now, now, now, maxResults);
        } catch (ftsErr) {
            // Fallback to LIKE if FTS query fails
            const likeConditions = keywords.map(() => '(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(context) LIKE ?)').join(' OR ');
            const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);
            memories = db.prepare(`
                SELECT *,
                    importance +
                    CASE WHEN (? - updated_at) < 86400000 THEN 5
                         WHEN (? - updated_at) < 604800000 THEN 3
                         WHEN (? - updated_at) < 2592000000 THEN 1
                         ELSE 0 END AS recency_bonus,
                    CASE WHEN access_count > 10 THEN 3
                         WHEN access_count > 5 THEN 2
                         WHEN access_count > 0 THEN 1
                         ELSE 0 END AS access_bonus
                FROM memories
                WHERE archived = 0 AND (${likeConditions})
                ORDER BY (importance +
                    CASE WHEN (? - updated_at) < 86400000 THEN 5
                         WHEN (? - updated_at) < 604800000 THEN 3
                         WHEN (? - updated_at) < 2592000000 THEN 1
                         ELSE 0 END +
                    CASE WHEN access_count > 10 THEN 3
                         WHEN access_count > 5 THEN 2
                         WHEN access_count > 0 THEN 1
                         ELSE 0 END) DESC
                LIMIT ?
            `).all(now, now, now, ...params, now, now, now, maxResults);
        }

        // Boost with semantic similarity if embeddings available
        let queryEmb = null;
        try { queryEmb = await fetchEmbedding(q); } catch {}

        if (queryEmb) {
            const embRows = db.prepare(
                `SELECT memory_id, embedding FROM memory_embeddings WHERE memory_id IN (${memories.map(() => '?').join(',')})`
            ).all(...memories.map(m => m.id));
            const embMap = {};
            for (const e of embRows) embMap[e.memory_id] = JSON.parse(e.embedding);

            for (const m of memories) {
                const emb = embMap[m.id];
                m.semantic_score = emb ? +(cosineSimilarity(queryEmb, emb) * 5).toFixed(2) : 0;
            }
            // Re-sort with semantic boost
            memories.sort((a, b) =>
                (b.importance + b.recency_bonus + b.access_bonus + b.semantic_score) -
                (a.importance + a.recency_bonus + a.access_bonus + a.semantic_score)
            );
        }

        // Update access tracking for recalled memories
        const updateAccess = db.prepare('UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?');
        for (const m of memories) {
            updateAccess.run(now, m.id);
        }

        log(`Memory recall: "${q}" → ${memories.length} results${queryEmb ? ' (semantic boosted)' : ''}`);
        res.json({ query: q, memories, count: memories.length });
    } catch (err) {
        log(`Memory recall error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Memory stats (must be before :id route)
app.get('/api/memory/stats', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = 0').get();
        const archived = db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = 1').get();
        const categories = db.prepare('SELECT category, COUNT(*) as count FROM memories WHERE archived = 0 GROUP BY category ORDER BY count DESC').all();
        const topAccessed = db.prepare('SELECT id, content, category, access_count FROM memories WHERE archived = 0 ORDER BY access_count DESC LIMIT 10').all();
        const recentlyAdded = db.prepare('SELECT id, content, category, created_at FROM memories WHERE archived = 0 ORDER BY created_at DESC LIMIT 10').all();
        const links = db.prepare('SELECT COUNT(*) as count FROM memory_links').get();
        const embeddings = db.prepare('SELECT COUNT(*) as count FROM memory_embeddings').get();

        res.json({
            total: total.count,
            archived: archived.count,
            categories,
            links: links.count,
            embeddings: embeddings.count,
            embedding_coverage: total.count > 0 ? +(embeddings.count / total.count * 100).toFixed(1) : 0,
            top_accessed: topAccessed,
            recently_added: recentlyAdded
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk store memories (with dedup, must be before :id route)
app.post('/api/memory/bulk', (req, res) => {
    try {
        const { memories } = req.body;
        if (!Array.isArray(memories) || memories.length === 0) return res.status(400).json({ error: 'memories array is required' });

        const now = Date.now();
        const insert = db.prepare(`
            INSERT INTO memories (content, category, tags, source, importance, context, session_id, content_hash, created_at, updated_at, accessed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const findDup = db.prepare('SELECT id, importance FROM memories WHERE content_hash = ?');
        const bumpDup = db.prepare('UPDATE memories SET importance = MAX(importance, ?), access_count = access_count + 1, accessed_at = ?, updated_at = ? WHERE id = ?');

        const ids = [];
        let duped = 0;
        const insertMany = db.transaction((items) => {
            for (const m of items) {
                if (!m.content) continue;
                const hash = memoryHash(m.content);
                const existing = findDup.get(hash);
                if (existing) {
                    bumpDup.run(m.importance || 5, now, now, existing.id);
                    ids.push(existing.id);
                    duped++;
                } else {
                    const result = insert.run(
                        m.content, m.category || 'general', JSON.stringify(m.tags || []),
                        m.source || 'claude', m.importance || 5, m.context || null,
                        m.session_id || null, hash, now, now, now
                    );
                    ids.push(result.lastInsertRowid);
                }
            }
        });

        insertMany(memories);
        log(`Memory bulk store: ${ids.length} memories (${duped} deduplicated)`);
        // Async embed all new memories (non-blocking)
        for (let i = 0; i < memories.length; i++) {
            if (memories[i].content && ids[i]) {
                embedMemoryAsync(ids[i], memories[i].content);
            }
        }
        res.json({ success: true, ids, count: ids.length, deduplicated: duped });
    } catch (err) {
        log(`Memory bulk store error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Semantic search via embeddings (must be before :id route)
app.get('/api/memory/semantic', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(400).json({ error: 'q (query) is required' });

        const maxResults = parseInt(limit) || 10;

        // Get query embedding from Ollama
        let queryEmb;
        try {
            queryEmb = await fetchEmbedding(q);
        } catch (err) {
            return res.status(503).json({ error: 'Embedding service unavailable', detail: err.message });
        }

        // Get all stored embeddings
        const rows = db.prepare(`
            SELECT e.memory_id, e.embedding, m.content, m.category, m.tags, m.importance,
                   m.access_count, m.created_at, m.updated_at, m.archived
            FROM memory_embeddings e
            JOIN memories m ON e.memory_id = m.id
            WHERE m.archived = 0
        `).all();

        // Compute cosine similarity for each
        const scored = rows.map(r => {
            const emb = JSON.parse(r.embedding);
            const similarity = cosineSimilarity(queryEmb, emb);
            return { ...r, similarity, embedding: undefined };
        }).filter(r => r.similarity > 0.3) // threshold
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, maxResults);

        // Update access tracking
        const now = Date.now();
        const updateAccess = db.prepare('UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?');
        for (const s of scored) updateAccess.run(now, s.memory_id);

        log(`Semantic search: "${q}" → ${scored.length} results (${rows.length} embeddings searched)`);
        res.json({
            query: q,
            memories: scored.map(s => ({
                id: s.memory_id, content: s.content, category: s.category,
                tags: s.tags, importance: s.importance, similarity: +s.similarity.toFixed(4),
                access_count: s.access_count, created_at: s.created_at
            })),
            count: scored.length,
            embeddings_total: rows.length
        });
    } catch (err) {
        log(`Semantic search error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Bulk re-embed all memories (or those missing embeddings)
app.post('/api/memory/embed', async (req, res) => {
    try {
        const { force } = req.body || {};
        let memories;
        if (force) {
            memories = db.prepare('SELECT id, content FROM memories WHERE archived = 0').all();
        } else {
            memories = db.prepare(`
                SELECT m.id, m.content FROM memories m
                LEFT JOIN memory_embeddings e ON m.id = e.memory_id
                WHERE m.archived = 0 AND e.memory_id IS NULL
            `).all();
        }

        if (memories.length === 0) {
            return res.json({ success: true, embedded: 0, message: 'All memories already have embeddings' });
        }

        log(`Embedding ${memories.length} memories (force=${!!force})...`);
        let embedded = 0, failed = 0;

        for (const m of memories) {
            try {
                const emb = await fetchEmbedding(m.content);
                storeEmbedding(m.id, emb);
                embedded++;
            } catch {
                failed++;
            }
        }

        log(`Embedding complete: ${embedded} embedded, ${failed} failed`);
        res.json({ success: true, embedded, failed, total: memories.length });
    } catch (err) {
        log(`Bulk embed error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Embedding stats
app.get('/api/memory/embeddings', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM memory_embeddings').get();
        const memTotal = db.prepare('SELECT COUNT(*) as count FROM memories WHERE archived = 0').get();
        const models = db.prepare('SELECT model, COUNT(*) as count FROM memory_embeddings GROUP BY model').all();
        res.json({
            embedded: total.count,
            total_memories: memTotal.count,
            coverage: memTotal.count > 0 ? +(total.count / memTotal.count * 100).toFixed(1) : 0,
            models
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auto-archive stale memories (must be before :id route)
app.post('/api/memory/archive-stale', (req, res) => {
    try {
        const { max_age_days, max_access, max_importance } = req.body;
        const ageDays = max_age_days || 90;
        const maxAcc = max_access !== undefined ? max_access : 2;
        const maxImp = max_importance || 5;
        const cutoff = Date.now() - (ageDays * 24 * 60 * 60 * 1000);

        const result = db.prepare(`
            UPDATE memories SET archived = 1, updated_at = ?
            WHERE archived = 0 AND created_at < ? AND access_count < ? AND importance < ?
        `).run(Date.now(), cutoff, maxAcc, maxImp);

        log(`Auto-archive: ${result.changes} memories archived (age>${ageDays}d, access<${maxAcc}, importance<${maxImp})`);
        res.json({ success: true, archived_count: result.changes });
    } catch (err) {
        log(`Auto-archive error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Unarchive memories by IDs or category
app.post('/api/memory/unarchive', (req, res) => {
    try {
        const { ids, category } = req.body;
        let result;
        if (ids && Array.isArray(ids)) {
            const placeholders = ids.map(() => '?').join(',');
            result = db.prepare(`UPDATE memories SET archived = 0, updated_at = ? WHERE id IN (${placeholders})`).run(Date.now(), ...ids);
        } else if (category) {
            result = db.prepare('UPDATE memories SET archived = 0, updated_at = ? WHERE archived = 1 AND category = ?').run(Date.now(), category);
        } else {
            return res.status(400).json({ error: 'ids array or category required' });
        }
        log(`Unarchived: ${result.changes} memories`);
        res.json({ success: true, unarchived_count: result.changes });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export memories as JSON
app.get('/api/memory/export', (req, res) => {
    try {
        const { category, importance, since, until, archived } = req.query;
        let query = 'SELECT * FROM memories WHERE 1=1';
        const params = [];

        if (archived !== 'all') {
            query += ' AND archived = ?';
            params.push(archived === 'true' ? 1 : 0);
        }
        if (category) { query += ' AND category = ?'; params.push(category); }
        if (importance) { query += ' AND importance >= ?'; params.push(parseInt(importance)); }
        if (since) { query += ' AND created_at >= ?'; params.push(parseInt(since)); }
        if (until) { query += ' AND created_at <= ?'; params.push(parseInt(until)); }

        query += ' ORDER BY created_at ASC';
        const memories = db.prepare(query).all(...params);

        // Get all links for exported memories
        const memIds = new Set(memories.map(m => m.id));
        const allLinks = db.prepare('SELECT * FROM memory_links').all();
        const links = allLinks.filter(l => memIds.has(l.source_id) && memIds.has(l.target_id));

        const exportData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            count: memories.length,
            links_count: links.length,
            memories,
            links
        };

        res.setHeader('Content-Disposition', `attachment; filename=memories-export-${Date.now()}.json`);
        res.json(exportData);
        log(`Memory export: ${memories.length} memories, ${links.length} links`);
    } catch (err) {
        log(`Memory export error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Import memories from JSON
app.post('/api/memory/import', (req, res) => {
    try {
        const { memories, links, merge } = req.body;
        if (!Array.isArray(memories)) return res.status(400).json({ error: 'memories array is required' });

        const now = Date.now();
        const insert = db.prepare(`
            INSERT INTO memories (content, category, tags, source, importance, context, session_id, content_hash, created_at, updated_at, accessed_at, access_count, archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const findDup = db.prepare('SELECT id FROM memories WHERE content_hash = ?');
        const insertLink = db.prepare('INSERT OR IGNORE INTO memory_links (source_id, target_id, relationship, created_at) VALUES (?, ?, ?, ?)');

        const idMap = {}; // old id → new id
        let imported = 0;
        let skipped = 0;

        const doImport = db.transaction(() => {
            for (const m of memories) {
                if (!m.content) continue;
                const hash = m.content_hash || memoryHash(m.content);
                const existing = findDup.get(hash);
                if (existing) {
                    idMap[m.id] = existing.id;
                    skipped++;
                    continue;
                }
                const result = insert.run(
                    m.content, m.category || 'general',
                    typeof m.tags === 'string' ? m.tags : JSON.stringify(m.tags || []),
                    m.source || 'import', m.importance || 5,
                    m.context || null, m.session_id || null, hash,
                    m.created_at || now, now, m.accessed_at || now,
                    m.access_count || 0, m.archived || 0
                );
                idMap[m.id] = result.lastInsertRowid;
                imported++;
            }

            // Re-create links with mapped IDs
            let linkedCount = 0;
            if (Array.isArray(links)) {
                for (const l of links) {
                    const newSource = idMap[l.source_id];
                    const newTarget = idMap[l.target_id];
                    if (newSource && newTarget) {
                        insertLink.run(newSource, newTarget, l.relationship || 'related', l.created_at || now);
                        linkedCount++;
                    }
                }
            }
            return linkedCount;
        });

        const linkedCount = doImport();
        log(`Memory import: ${imported} imported, ${skipped} skipped (dupes), ${linkedCount} links`);
        res.json({ success: true, imported, skipped, links_created: linkedCount });
    } catch (err) {
        log(`Memory import error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// --- Plugin Dispatch System ---

function discoverPlugins() {
    const plugins = [];
    // Scan .claude/skills/
    const skillsDir = path.join(__dirname, '..', '..', '.claude', 'skills');
    try {
        const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const name = file.replace('.md', '');
            let description = '';
            try {
                const content = fs.readFileSync(path.join(skillsDir, file), 'utf8');
                const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'));
                description = (firstLine || '').trim().substring(0, 120);
            } catch {}
            plugins.push({ name, type: 'skill', source: 'skills', file, description });
        }
    } catch {}

    // Scan hive-plugin/commands/
    const commandsDir = path.join(__dirname, '..', 'hive-plugin', 'commands');
    try {
        const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const name = file.replace('.md', '');
            let description = '';
            try {
                const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
                const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'));
                description = (firstLine || '').trim().substring(0, 120);
            } catch {}
            plugins.push({ name, type: 'command', source: 'hive-plugin', file, description });
        }
    } catch {}

    // MCP tools (from bridge)
    const mcpTools = [
        { name: 'memory_store', description: 'Store a memory', engine: 'mcp' },
        { name: 'memory_recall', description: 'Recall memories by query', engine: 'mcp' },
        { name: 'memory_semantic', description: 'Semantic memory search', engine: 'mcp' },
        { name: 'memory_stats', description: 'Memory database stats', engine: 'mcp' },
        { name: 'db_query', description: 'Read-only SQL query', engine: 'mcp' },
        { name: 'db_tables', description: 'List database tables', engine: 'mcp' },
        { name: 'db_stats', description: 'Database statistics', engine: 'mcp' }
    ];
    for (const tool of mcpTools) {
        plugins.push({ name: tool.name, type: 'mcp_tool', source: 'mcp-bridge', description: tool.description });
    }

    return plugins;
}

// Plugin registry endpoint
app.get('/api/plugin/registry', (req, res) => {
    const plugins = discoverPlugins();
    res.json({
        total: plugins.length,
        plugins,
        types: {
            skill: plugins.filter(p => p.type === 'skill').length,
            command: plugins.filter(p => p.type === 'command').length,
            mcp_tool: plugins.filter(p => p.type === 'mcp_tool').length
        }
    });
});

// Dispatch a plugin for execution (async — creates a task)
app.post('/api/plugin/dispatch', (req, res) => {
    const { plugin, args, priority, source } = req.body;
    if (!plugin) return res.status(400).json({ error: 'plugin name is required' });

    // Validate plugin exists
    const registry = discoverPlugins();
    const found = registry.find(p => p.name === plugin);
    if (!found) return res.status(404).json({ error: `Plugin "${plugin}" not found in registry` });

    // Create task with plugin metadata
    const taskId = crypto.randomUUID();
    const now = Date.now();
    try {
        db.prepare(`
            INSERT INTO tasks (id, session_id, content, status, priority, task_type, created_at, notes)
            VALUES (?, ?, ?, 'pending', ?, 'plugin_dispatch', ?, ?)
        `).run(
            taskId,
            source || 'api',
            `[PLUGIN:${plugin}] ${JSON.stringify(args || {})}`,
            priority || 'normal',
            now,
            JSON.stringify({ plugin: found.name, type: found.type, args: args || {}, dispatched_at: new Date(now).toISOString() })
        );

        // Broadcast via WebSocket
        broadcast({ type: 'plugin:dispatched', taskId, plugin: found.name, timestamp: now });

        log(`Plugin dispatched: ${found.name} (${found.type}) → task ${taskId}`);
        res.json({ success: true, taskId, plugin: found.name, type: found.type, status: 'pending' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Execute an MCP tool directly (synchronous for MCP tools only)
app.post('/api/plugin/execute', async (req, res) => {
    const { plugin, args } = req.body;
    if (!plugin) return res.status(400).json({ error: 'plugin name is required' });

    // Only MCP tools can be executed synchronously
    const registry = discoverPlugins();
    const found = registry.find(p => p.name === plugin && p.type === 'mcp_tool');
    if (!found) {
        return res.status(400).json({
            error: `Plugin "${plugin}" is not an MCP tool or not found. Only MCP tools support synchronous execution. Use /api/plugin/dispatch for skills and commands.`
        });
    }

    // Call MCP bridge
    try {
        const mcpResp = await new Promise((resolve, reject) => {
            const body = JSON.stringify(args || {});
            const req2 = http.request({
                hostname: 'localhost', port: 8860,
                path: `/api/tool/${plugin}`, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            }, (r) => {
                let data = '';
                r.on('data', c => data += c);
                r.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            });
            req2.on('error', reject);
            req2.setTimeout(30000, () => { req2.destroy(); reject(new Error('MCP bridge timeout')); });
            req2.write(body);
            req2.end();
        });
        res.json({ success: true, plugin: found.name, result: mcpResp });
    } catch (err) {
        res.status(500).json({ error: `MCP execution failed: ${err.message}` });
    }
});

// Get pending plugin dispatches (for Claude Code sessions to pick up)
app.get('/api/plugin/pending', (req, res) => {
    try {
        const pending = db.prepare(
            "SELECT id, content, priority, created_at, notes FROM tasks WHERE task_type = 'plugin_dispatch' AND status = 'pending' ORDER BY created_at ASC"
        ).all();
        const parsed = pending.map(t => {
            let meta = {};
            try { meta = JSON.parse(t.notes); } catch {}
            return { taskId: t.id, plugin: meta.plugin, type: meta.type, args: meta.args, priority: t.priority, dispatched_at: meta.dispatched_at };
        });
        res.json({ count: parsed.length, dispatches: parsed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete a plugin dispatch
app.post('/api/plugin/:taskId/complete', (req, res) => {
    const { taskId } = req.params;
    const { result, error } = req.body;
    try {
        const task = db.prepare("SELECT id FROM tasks WHERE id = ? AND task_type = 'plugin_dispatch'").get(taskId);
        if (!task) return res.status(404).json({ error: 'Plugin dispatch not found' });
        db.prepare(
            'UPDATE tasks SET status = ?, response = ?, error = ?, completed_at = ? WHERE id = ?'
        ).run(error ? 'failed' : 'completed', result ? JSON.stringify(result) : null, error || null, Date.now(), taskId);
        broadcast({ type: 'plugin:completed', taskId, timestamp: Date.now() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GitHub Intel Poller ---

const WATCHED_REPOS = [
    // Core AI/LLM
    'ollama/ollama', 'lmstudio-ai/lmstudio', 'anthropics/claude-code',
    'anthropics/anthropic-sdk-python', 'anthropics/anthropic-sdk-typescript',
    'openai/openai-node', 'openai/openai-python',
    // MCP
    'anthropics/model-context-protocol', 'modelcontextprotocol/servers', 'modelcontextprotocol/typescript-sdk',
    // Local LLM Tools
    'ggml-org/llama.cpp', 'Mozilla-Ocho/llamafile', 'huggingface/transformers',
    'vllm-project/vllm', 'oobabooga/text-generation-webui', 'open-webui/open-webui',
    // AI Agents & Frameworks
    'langchain-ai/langchain', 'langchain-ai/langgraph', 'microsoft/autogen',
    'crewAIInc/crewAI', 'significant-gravitas/AutoGPT',
    // Dev Tools
    'nodejs/node', 'electron/electron', 'microsoft/vscode', 'github/copilot.vim',
    // Flight Sim
    'EvenAR/node-simconnect', 'flybywiresim/aircraft',
    // Utilities
    'xtermjs/xterm.js', 'websockets/ws', 'expressjs/express', 'jestjs/jest'
];

function githubApiGet(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com', port: 443, path,
            method: 'GET',
            headers: { 'User-Agent': 'HiveRelay/1.0', 'Accept': 'application/vnd.github.v3+json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, data, headers: res.headers }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub API timeout')); });
        req.end();
    });
}

async function pollGitHubRepo(repo) {
    try {
        const resp = await githubApiGet(`/repos/${repo}/releases/latest`);
        if (resp.status === 404) return null; // No releases
        if (resp.status === 403) { log(`GitHub rate limit hit polling ${repo}`, 'WARN'); return null; }
        if (resp.status !== 200) return null;
        const r = resp.data;
        return {
            repo, tag: r.tag_name, name: r.name || r.tag_name,
            published: r.published_at, url: r.html_url,
            body: (r.body || '').substring(0, 500)
        };
    } catch (err) {
        log(`GitHub poll error for ${repo}: ${err.message}`, 'ERROR');
        return null;
    }
}

const intelPollState = { lastPoll: null, lastResults: [], polling: false };

async function pollAllGitHubReleases() {
    if (intelPollState.polling) { log('GitHub poll already in progress, skipping'); return; }
    intelPollState.polling = true;
    log(`GitHub intel poll starting for ${WATCHED_REPOS.length} repos...`);

    const results = [];
    let stored = 0, skipped = 0;

    for (const repo of WATCHED_REPOS) {
        const release = await pollGitHubRepo(repo);
        if (!release) continue;
        results.push(release);

        // Store as memory if new (dedup by content hash)
        const content = `[GitHub Release] ${repo} ${release.tag}: ${release.name}. Published ${release.published}. ${release.body}`;
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const existing = db.prepare('SELECT id FROM memories WHERE content_hash = ?').get(hash);
        if (!existing) {
            try {
                const result = db.prepare(`
                    INSERT INTO memories (content, category, tags, source, importance, content_hash, created_at, updated_at, access_count, archived)
                    VALUES (?, 'intel', ?, ?, 6, ?, ?, ?, 0, 0)
                `).run(content, JSON.stringify(['github', 'release', repo.split('/')[1]]), `github:${repo}`, hash, Date.now(), Date.now());
                embedMemoryAsync(result.lastInsertRowid, content);
                stored++;
            } catch (e) { log(`Intel store error for ${repo}: ${e.message}`, 'ERROR'); }
        } else {
            skipped++;
        }

        // 2s delay between requests to respect rate limits (60/hr unauthenticated)
        await new Promise(r => setTimeout(r, 2000));
    }

    intelPollState.lastPoll = Date.now();
    intelPollState.lastResults = results;
    intelPollState.polling = false;
    log(`GitHub intel poll complete: ${results.length} releases found, ${stored} new stored, ${skipped} already known`);
    return { releases: results.length, stored, skipped };
}

// Manual trigger
app.post('/api/intel/github/poll', async (req, res) => {
    try {
        const result = await pollAllGitHubReleases();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get latest poll results
app.get('/api/intel/github/latest', (req, res) => {
    res.json({
        lastPoll: intelPollState.lastPoll ? new Date(intelPollState.lastPoll).toISOString() : null,
        polling: intelPollState.polling,
        releases: intelPollState.lastResults
    });
});

// --- Cross-Machine Memory Sync ---

// Return hash manifest for diff-based sync
app.get('/api/memory/sync/manifest', (req, res) => {
    try {
        const hashes = db.prepare('SELECT id, content_hash, updated_at FROM memories WHERE archived = 0 AND content_hash IS NOT NULL').all();
        res.json({
            node: require('os').hostname(),
            count: hashes.length,
            hashes: hashes.map(h => ({ id: h.id, hash: h.content_hash, updated_at: h.updated_at }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync status tracking
const syncHistory = [];

function httpRequest(method, url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: u.hostname, port: u.port,
            path: u.pathname + u.search, method,
            headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
        }, (res) => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
                catch { resolve({ status: res.statusCode, data: chunks }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Sync request timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

// Push memories to a remote relay (diff-based)
app.post('/api/memory/sync/push', async (req, res) => {
    try {
        const { target } = req.body; // e.g. "http://192.168.1.192:8600"
        if (!target) return res.status(400).json({ error: 'target URL is required' });

        // Get remote manifest
        const remote = await httpRequest('GET', `${target}/api/memory/sync/manifest`);
        if (remote.status !== 200) return res.status(502).json({ error: 'Cannot reach remote relay' });

        const remoteHashes = new Set(remote.data.hashes.map(h => h.hash));

        // Find local memories missing on remote
        const localMemories = db.prepare('SELECT * FROM memories WHERE archived = 0 AND content_hash IS NOT NULL').all();
        const missing = localMemories.filter(m => !remoteHashes.has(m.content_hash));

        if (missing.length === 0) {
            const entry = { direction: 'push', target, pushed: 0, timestamp: new Date().toISOString(), remote_node: remote.data.node };
            syncHistory.unshift(entry);
            return res.json({ success: true, pushed: 0, message: 'Remote is up to date' });
        }

        // Push missing to remote
        const pushResult = await httpRequest('POST', `${target}/api/memory/import`, {
            memories: missing,
            merge: true
        });

        const entry = {
            direction: 'push', target,
            pushed: pushResult.data.imported || 0,
            skipped: pushResult.data.skipped || 0,
            timestamp: new Date().toISOString(),
            remote_node: remote.data.node
        };
        syncHistory.unshift(entry);
        if (syncHistory.length > 50) syncHistory.length = 50;

        log(`Sync push to ${target}: ${entry.pushed} pushed, ${entry.skipped} skipped`);
        res.json({ success: true, ...entry });
    } catch (err) {
        log(`Sync push error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Pull memories from a remote relay (diff-based)
app.post('/api/memory/sync/pull', async (req, res) => {
    try {
        const { source } = req.body; // e.g. "http://192.168.1.192:8600"
        if (!source) return res.status(400).json({ error: 'source URL is required' });

        // Get remote manifest
        const remote = await httpRequest('GET', `${source}/api/memory/sync/manifest`);
        if (remote.status !== 200) return res.status(502).json({ error: 'Cannot reach remote relay' });

        // Get local hashes
        const localHashes = new Set(
            db.prepare('SELECT content_hash FROM memories WHERE content_hash IS NOT NULL').all().map(h => h.content_hash)
        );

        // Find which remote hashes we're missing
        const missingHashes = remote.data.hashes.filter(h => !localHashes.has(h.hash));

        if (missingHashes.length === 0) {
            const entry = { direction: 'pull', source, pulled: 0, timestamp: new Date().toISOString(), remote_node: remote.data.node };
            syncHistory.unshift(entry);
            return res.json({ success: true, pulled: 0, message: 'Local is up to date' });
        }

        // Fetch full memories from remote (use export with archived=all to get everything)
        const exported = await httpRequest('GET', `${source}/api/memory/export?archived=all`);
        if (exported.status !== 200) return res.status(502).json({ error: 'Cannot export from remote' });

        const missingHashSet = new Set(missingHashes.map(h => h.hash));
        const toImport = exported.data.memories.filter(m => m.content_hash && missingHashSet.has(m.content_hash));

        // Import locally
        const now = Date.now();
        const insert = db.prepare(`
            INSERT INTO memories (content, category, tags, source, importance, context, session_id, content_hash, created_at, updated_at, accessed_at, access_count, archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const findDup = db.prepare('SELECT id FROM memories WHERE content_hash = ?');

        let imported = 0;
        const doImport = db.transaction(() => {
            for (const m of toImport) {
                if (findDup.get(m.content_hash)) continue;
                insert.run(
                    m.content, m.category || 'general',
                    typeof m.tags === 'string' ? m.tags : JSON.stringify(m.tags || []),
                    m.source || 'sync', m.importance || 5,
                    m.context || null, m.session_id || null, m.content_hash,
                    m.created_at || now, now, m.accessed_at || now,
                    m.access_count || 0, m.archived || 0
                );
                imported++;
            }
        });
        doImport();

        // Embed new memories async
        const newMemories = db.prepare(`
            SELECT m.id, m.content FROM memories m
            LEFT JOIN memory_embeddings e ON m.id = e.memory_id
            WHERE m.archived = 0 AND e.memory_id IS NULL
        `).all();
        for (const m of newMemories) embedMemoryAsync(m.id, m.content);

        const entry = {
            direction: 'pull', source,
            pulled: imported,
            timestamp: new Date().toISOString(),
            remote_node: remote.data.node
        };
        syncHistory.unshift(entry);
        if (syncHistory.length > 50) syncHistory.length = 50;

        log(`Sync pull from ${source}: ${imported} pulled`);
        res.json({ success: true, ...entry });
    } catch (err) {
        log(`Sync pull error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Full bidirectional sync
app.post('/api/memory/sync', async (req, res) => {
    try {
        const { peer } = req.body; // e.g. "http://192.168.1.192:8600"
        if (!peer) return res.status(400).json({ error: 'peer URL is required' });

        // Pull then push
        const pullBody = JSON.stringify({ source: peer });
        const pushBody = JSON.stringify({ target: peer });

        // Pull first
        let pullResult, pushResult;
        try {
            const pr = await httpRequest('POST', `http://localhost:${PORT}/api/memory/sync/pull`, { source: peer });
            pullResult = pr.data;
        } catch (e) { pullResult = { error: e.message }; }

        try {
            const ps = await httpRequest('POST', `http://localhost:${PORT}/api/memory/sync/push`, { target: peer });
            pushResult = ps.data;
        } catch (e) { pushResult = { error: e.message }; }

        log(`Bidirectional sync with ${peer}: pulled=${pullResult.pulled || 0}, pushed=${pushResult.pushed || 0}`);
        res.json({ success: true, pull: pullResult, push: pushResult });
    } catch (err) {
        log(`Sync error: ${err.message}`, 'ERROR');
        res.status(500).json({ error: err.message });
    }
});

// Sync history / status
app.get('/api/memory/sync', (req, res) => {
    res.json({
        node: require('os').hostname(),
        history: syncHistory.slice(0, 20),
        total_syncs: syncHistory.length
    });
});

// Get single memory
app.get('/api/memory/:id', (req, res) => {
    try {
        const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
        if (!memory) return res.status(404).json({ error: 'Memory not found' });

        // Get linked memories
        const links = db.prepare(`
            SELECT ml.relationship, m.id, m.content, m.category, m.importance
            FROM memory_links ml
            JOIN memories m ON (ml.target_id = m.id AND ml.source_id = ?) OR (ml.source_id = m.id AND ml.target_id = ?)
            WHERE m.id != ?
        `).all(req.params.id, req.params.id, req.params.id);

        // Update access tracking
        db.prepare('UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?').run(Date.now(), req.params.id);

        res.json({ ...memory, links });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update a memory
app.put('/api/memory/:id', (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Memory not found' });

        const { content, category, tags, source, importance, context, archived } = req.body;
        db.prepare(`
            UPDATE memories SET
                content = COALESCE(?, content),
                category = COALESCE(?, category),
                tags = COALESCE(?, tags),
                source = COALESCE(?, source),
                importance = COALESCE(?, importance),
                context = COALESCE(?, context),
                archived = COALESCE(?, archived),
                updated_at = ?
            WHERE id = ?
        `).run(
            content || null, category || null,
            tags ? JSON.stringify(tags) : null,
            source || null, importance || null,
            context || null, archived !== undefined ? (archived ? 1 : 0) : null,
            Date.now(), req.params.id
        );

        log(`Memory updated: #${req.params.id}`);
        res.json({ success: true, id: parseInt(req.params.id) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a memory
app.delete('/api/memory/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Memory not found' });
        // Cascade deletes links via FK
        db.prepare('DELETE FROM memory_links WHERE source_id = ? OR target_id = ?').run(req.params.id, req.params.id);
        log(`Memory deleted: #${req.params.id}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Link two memories
app.post('/api/memory/:id/link', (req, res) => {
    try {
        const { target_id, relationship } = req.body;
        if (!target_id) return res.status(400).json({ error: 'target_id is required' });

        // Verify both memories exist
        const source = db.prepare('SELECT id FROM memories WHERE id = ?').get(req.params.id);
        const target = db.prepare('SELECT id FROM memories WHERE id = ?').get(target_id);
        if (!source || !target) return res.status(404).json({ error: 'One or both memories not found' });

        db.prepare(`
            INSERT OR IGNORE INTO memory_links (source_id, target_id, relationship, created_at)
            VALUES (?, ?, ?, ?)
        `).run(req.params.id, target_id, relationship || 'related', Date.now());

        log(`Memory linked: #${req.params.id} → #${target_id} (${relationship || 'related'})`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

    // --- Scheduled Memory Archiving (every 24 hours) ---
    const ARCHIVE_INTERVAL = 24 * 60 * 60 * 1000; // 24h
    function runScheduledArchive() {
        try {
            const ageDays = 90, maxAccess = 2, maxImportance = 5;
            const cutoff = Date.now() - (ageDays * 24 * 60 * 60 * 1000);
            const result = db.prepare(`
                UPDATE memories SET archived = 1, updated_at = ?
                WHERE archived = 0 AND created_at < ? AND access_count < ? AND importance < ?
            `).run(Date.now(), cutoff, maxAccess, maxImportance);
            if (result.changes > 0) {
                log(`Scheduled archive: ${result.changes} memories archived (age>${ageDays}d, access<${maxAccess}, importance<${maxImportance})`);
            }
        } catch (err) {
            log(`Scheduled archive error: ${err.message}`, 'ERROR');
        }
    }
    // Run once at startup (after 60s delay) then every 24h
    setTimeout(() => {
        runScheduledArchive();
        setInterval(runScheduledArchive, ARCHIVE_INTERVAL);
    }, 60 * 1000);
    log('Scheduled memory archiving enabled (every 24h, 90d+ stale, importance<5, access<2)');

    // --- Scheduled GitHub Intel Polling (every 12 hours) ---
    const INTEL_POLL_INTERVAL = 12 * 60 * 60 * 1000; // 12h
    // Run first poll after 5 minutes (let services stabilize), then every 12h
    setTimeout(() => {
        pollAllGitHubReleases().catch(err => log(`Initial GitHub poll error: ${err.message}`, 'ERROR'));
        setInterval(() => {
            pollAllGitHubReleases().catch(err => log(`Scheduled GitHub poll error: ${err.message}`, 'ERROR'));
        }, INTEL_POLL_INTERVAL);
    }, 5 * 60 * 1000);
    log('Scheduled GitHub intel polling enabled (every 12h, 31 repos)');
});
