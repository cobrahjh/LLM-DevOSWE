/**
 * SimWidget Test Database v1.0.0
 * 
 * SQLite-based test history storage
 * - Stores test runs and individual results
 * - 30-day retention with compression backup
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\test-db.js
 * Last Updated: 2025-01-08
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DB_PATH = path.join(__dirname, 'history.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');
const RETENTION_DAYS = 30;

class TestDatabase {
    constructor() {
        this.db = new Database(DB_PATH);
        this.init();
    }

    init() {
        // Create tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                duration_ms INTEGER,
                passed INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0,
                skipped INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                trigger TEXT DEFAULT 'manual',
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                test_id TEXT NOT NULL,
                category TEXT,
                name TEXT,
                status TEXT NOT NULL,
                duration_ms INTEGER,
                error_message TEXT,
                diff TEXT,
                FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                cron TEXT NOT NULL,
                suites TEXT,
                enabled INTEGER DEFAULT 1,
                last_run TEXT,
                next_run TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_results_run_id ON results(run_id);
            CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);
        `);

        // Add cloud_id column if not exists (for Supabase sync)
        try {
            this.db.exec(`ALTER TABLE runs ADD COLUMN cloud_id TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }

    /**
     * Start a new test run
     */
    startRun(trigger = 'manual', notes = '') {
        const stmt = this.db.prepare(`
            INSERT INTO runs (timestamp, trigger, notes)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(new Date().toISOString(), trigger, notes);
        return result.lastInsertRowid;
    }

    /**
     * Complete a test run with summary
     */
    completeRun(runId, summary) {
        const stmt = this.db.prepare(`
            UPDATE runs 
            SET duration_ms = ?, passed = ?, failed = ?, skipped = ?, total = ?
            WHERE id = ?
        `);
        stmt.run(
            summary.duration,
            summary.passed,
            summary.failed,
            summary.skipped,
            summary.passed + summary.failed + summary.skipped,
            runId
        );
    }

    /**
     * Record individual test result
     */
    recordResult(runId, test) {
        const stmt = this.db.prepare(`
            INSERT INTO results (run_id, test_id, category, name, status, duration_ms, error_message, diff)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const [category, name] = test.id.split('/');
        stmt.run(
            runId,
            test.id,
            category,
            name,
            test.status,
            test.duration || 0,
            test.error || null,
            test.diff ? JSON.stringify(test.diff) : null
        );
    }

    /**
     * Get recent runs
     */
    getRecentRuns(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT * FROM runs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    /**
     * Get run details with results
     */
    getRunDetails(runId) {
        const run = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
        if (!run) return null;

        const results = this.db.prepare(`
            SELECT * FROM results WHERE run_id = ? ORDER BY category, name
        `).all(runId);

        return { ...run, results };
    }

    /**
     * Get test history for a specific test
     */
    getTestHistory(testId, limit = 30) {
        const stmt = this.db.prepare(`
            SELECT r.*, runs.timestamp 
            FROM results r
            JOIN runs ON r.run_id = runs.id
            WHERE r.test_id = ?
            ORDER BY runs.timestamp DESC
            LIMIT ?
        `);
        return stmt.all(testId, limit);
    }

    /**
     * Get failure trends
     */
    getFailureTrends(days = 7) {
        const stmt = this.db.prepare(`
            SELECT 
                DATE(timestamp) as date,
                SUM(passed) as passed,
                SUM(failed) as failed,
                COUNT(*) as runs
            FROM runs
            WHERE timestamp >= datetime('now', ?)
            GROUP BY DATE(timestamp)
            ORDER BY date
        `);
        return stmt.all(`-${days} days`);
    }

    /**
     * Get flaky tests (sometimes pass, sometimes fail)
     */
    getFlakyTests(days = 7) {
        const stmt = this.db.prepare(`
            SELECT 
                test_id,
                COUNT(*) as total_runs,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passes,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
            FROM results r
            JOIN runs ON r.run_id = runs.id
            WHERE runs.timestamp >= datetime('now', ?)
            GROUP BY test_id
            HAVING passes > 0 AND failures > 0
            ORDER BY failures DESC
        `);
        return stmt.all(`-${days} days`);
    }

    // ============================================================
    // SCHEDULE MANAGEMENT
    // ============================================================

    /**
     * Create or update a schedule
     */
    upsertSchedule(name, cron, suites = '*', enabled = true) {
        const stmt = this.db.prepare(`
            INSERT INTO schedules (name, cron, suites, enabled)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                cron = excluded.cron,
                suites = excluded.suites,
                enabled = excluded.enabled
        `);
        stmt.run(name, cron, suites, enabled ? 1 : 0);
    }

    /**
     * Get all schedules
     */
    getSchedules() {
        return this.db.prepare('SELECT * FROM schedules ORDER BY name').all();
    }

    /**
     * Get enabled schedules
     */
    getEnabledSchedules() {
        return this.db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
    }

    /**
     * Toggle schedule enabled/disabled
     */
    toggleSchedule(name, enabled) {
        const stmt = this.db.prepare('UPDATE schedules SET enabled = ? WHERE name = ?');
        stmt.run(enabled ? 1 : 0, name);
    }

    /**
     * Delete a schedule
     */
    deleteSchedule(name) {
        const stmt = this.db.prepare('DELETE FROM schedules WHERE name = ?');
        stmt.run(name);
    }

    /**
     * Update last/next run times
     */
    updateScheduleRun(name, lastRun, nextRun) {
        const stmt = this.db.prepare(`
            UPDATE schedules SET last_run = ?, next_run = ? WHERE name = ?
        `);
        stmt.run(lastRun, nextRun, name);
    }

    // ============================================================
    // MAINTENANCE
    // ============================================================

    /**
     * Archive old records (30+ days) to compressed backup
     */
    archiveOldRecords() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
        const cutoffStr = cutoff.toISOString();

        // Get old runs to archive
        const oldRuns = this.db.prepare(`
            SELECT * FROM runs WHERE timestamp < ?
        `).all(cutoffStr);

        if (oldRuns.length === 0) {
            console.log('[TestDB] No records to archive');
            return { archived: 0 };
        }

        // Get results for old runs
        const runIds = oldRuns.map(r => r.id);
        const oldResults = this.db.prepare(`
            SELECT * FROM results WHERE run_id IN (${runIds.join(',')})
        `).all();

        // Create backup object
        const backup = {
            exported: new Date().toISOString(),
            retention_days: RETENTION_DAYS,
            runs: oldRuns,
            results: oldResults
        };

        // Write compressed backup
        const backupFile = path.join(BACKUP_DIR, `archive-${Date.now()}.json.gz`);
        const compressed = zlib.gzipSync(JSON.stringify(backup, null, 2));
        fs.writeFileSync(backupFile, compressed);

        // Delete archived records
        this.db.prepare(`DELETE FROM results WHERE run_id IN (${runIds.join(',')})`).run();
        this.db.prepare(`DELETE FROM runs WHERE id IN (${runIds.join(',')})`).run();

        console.log(`[TestDB] Archived ${oldRuns.length} runs to ${backupFile}`);
        return { archived: oldRuns.length, file: backupFile };
    }

    /**
     * Get database stats
     */
    getStats() {
        const runs = this.db.prepare('SELECT COUNT(*) as count FROM runs').get();
        const results = this.db.prepare('SELECT COUNT(*) as count FROM results').get();
        const schedules = this.db.prepare('SELECT COUNT(*) as count FROM schedules').get();
        const oldestRun = this.db.prepare('SELECT MIN(timestamp) as oldest FROM runs').get();
        const newestRun = this.db.prepare('SELECT MAX(timestamp) as newest FROM runs').get();

        // Get backup files
        const backups = fs.existsSync(BACKUP_DIR) 
            ? fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.gz'))
            : [];

        return {
            runs: runs.count,
            results: results.count,
            schedules: schedules.count,
            oldestRun: oldestRun.oldest,
            newestRun: newestRun.newest,
            backupCount: backups.length,
            dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
        };
    }

    /**
     * Vacuum database to reclaim space
     */
    vacuum() {
        this.db.exec('VACUUM');
        console.log('[TestDB] Database vacuumed');
    }

    close() {
        this.db.close();
    }
}

module.exports = TestDatabase;
