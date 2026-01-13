/**
 * Knowledge Sync Script v1.0.0
 * Backs up CLAUDE.md and STANDARDS.md to SQLite database
 *
 * Usage: node sync-knowledge.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, 'knowledge.db');
const ROOT = 'C:/LLM-DevOSWE';

// Create/open database
const db = new Database(DB_PATH);

// Create schema
db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at INTEGER,
        session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at);
`);

// Read current files
const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
const standardsMd = fs.readFileSync(path.join(ROOT, 'STANDARDS.md'), 'utf8');

// Generate hashes
const claudeHash = crypto.createHash('sha256').update(claudeMd).digest('hex');
const standardsHash = crypto.createHash('sha256').update(standardsMd).digest('hex');

// Check if already synced (same hash)
const existing = db.prepare('SELECT hash FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1').get('claude_md');
const existingStd = db.prepare('SELECT hash FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT 1').get('standards_md');

const sessionId = 'session-' + Date.now();
let synced = [];

if (!existing || existing.hash !== claudeHash) {
    db.prepare('INSERT INTO knowledge (type, content, hash, created_at, session_id) VALUES (?, ?, ?, ?, ?)')
        .run('claude_md', claudeMd, claudeHash, Date.now(), sessionId);
    synced.push('CLAUDE.md');
}

if (!existingStd || existingStd.hash !== standardsHash) {
    db.prepare('INSERT INTO knowledge (type, content, hash, created_at, session_id) VALUES (?, ?, ?, ?, ?)')
        .run('standards_md', standardsMd, standardsHash, Date.now(), sessionId);
    synced.push('STANDARDS.md');
}

// Get stats
const stats = db.prepare('SELECT type, COUNT(*) as versions FROM knowledge GROUP BY type').all();
console.log('✓ Database:', DB_PATH);
console.log('✓ Synced:', synced.length ? synced.join(', ') : 'Already up to date');
console.log('✓ Versions:', stats.map(s => `${s.type}: ${s.versions}`).join(', '));
db.close();
