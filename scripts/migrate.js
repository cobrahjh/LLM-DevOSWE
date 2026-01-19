#!/usr/bin/env node
/**
 * Hive Database Migration System
 *
 * Manages database schema migrations for SQLite databases.
 *
 * Usage:
 *   node scripts/migrate.js                    # Run pending migrations
 *   node scripts/migrate.js --status           # Show migration status
 *   node scripts/migrate.js --create <name>    # Create new migration
 *   node scripts/migrate.js --rollback         # Rollback last migration
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const showStatus = args.includes('--status');
const rollback = args.includes('--rollback');
const createIndex = args.indexOf('--create');
const createName = createIndex !== -1 ? args[createIndex + 1] : null;

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DB_PATH = path.join(__dirname, '..', 'Admin', 'relay', 'relay.db');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

/**
 * Ensure migrations directory exists
 */
function ensureMigrationsDir() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
}

/**
 * Get database connection
 */
function getDb() {
    if (!fs.existsSync(DB_PATH)) {
        console.log(`${colors.yellow}Database not found at ${DB_PATH}${colors.reset}`);
        console.log(`${colors.dim}Creating new database...${colors.reset}`);
    }

    const db = new Database(DB_PATH);

    // Create migrations table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    return db;
}

/**
 * Get all migration files
 */
function getMigrationFiles() {
    ensureMigrationsDir();

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.js'))
        .sort();
}

/**
 * Get applied migrations
 */
function getAppliedMigrations(db) {
    return db.prepare('SELECT name FROM _migrations ORDER BY id').all().map(r => r.name);
}

/**
 * Create a new migration file
 */
function createMigration(name) {
    ensureMigrationsDir();

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
    const filepath = path.join(MIGRATIONS_DIR, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
    /**
     * Apply migration
     * @param {Database} db - better-sqlite3 database instance
     */
    up(db) {
        // db.exec(\`
        //     CREATE TABLE example (
        //         id INTEGER PRIMARY KEY AUTOINCREMENT,
        //         name TEXT NOT NULL,
        //         created_at TEXT DEFAULT (datetime('now'))
        //     )
        // \`);
    },

    /**
     * Rollback migration
     * @param {Database} db - better-sqlite3 database instance
     */
    down(db) {
        // db.exec('DROP TABLE IF EXISTS example');
    }
};
`;

    fs.writeFileSync(filepath, template);
    console.log(`${colors.green}✓ Created migration: ${filename}${colors.reset}`);
    console.log(`${colors.dim}  Path: ${filepath}${colors.reset}`);
}

/**
 * Run pending migrations
 */
function runMigrations(db) {
    const files = getMigrationFiles();
    const applied = getAppliedMigrations(db);
    const pending = files.filter(f => !applied.includes(f));

    if (pending.length === 0) {
        console.log(`${colors.green}✓ No pending migrations${colors.reset}`);
        return;
    }

    console.log(`${colors.cyan}Running ${pending.length} migration(s)...${colors.reset}\n`);

    for (const file of pending) {
        const filepath = path.join(MIGRATIONS_DIR, file);
        const migration = require(filepath);

        try {
            db.transaction(() => {
                migration.up(db);
                db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            })();

            console.log(`${colors.green}✓ Applied: ${file}${colors.reset}`);
        } catch (error) {
            console.log(`${colors.red}✗ Failed: ${file}${colors.reset}`);
            console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
            process.exit(1);
        }
    }

    console.log(`\n${colors.green}✓ All migrations applied successfully${colors.reset}`);
}

/**
 * Rollback last migration
 */
function rollbackLast(db) {
    const applied = getAppliedMigrations(db);

    if (applied.length === 0) {
        console.log(`${colors.yellow}No migrations to rollback${colors.reset}`);
        return;
    }

    const lastMigration = applied[applied.length - 1];
    const filepath = path.join(MIGRATIONS_DIR, lastMigration);

    if (!fs.existsSync(filepath)) {
        console.log(`${colors.red}Migration file not found: ${lastMigration}${colors.reset}`);
        return;
    }

    const migration = require(filepath);

    try {
        db.transaction(() => {
            migration.down(db);
            db.prepare('DELETE FROM _migrations WHERE name = ?').run(lastMigration);
        })();

        console.log(`${colors.green}✓ Rolled back: ${lastMigration}${colors.reset}`);
    } catch (error) {
        console.log(`${colors.red}✗ Rollback failed: ${lastMigration}${colors.reset}`);
        console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

/**
 * Show migration status
 */
function showMigrationStatus(db) {
    const files = getMigrationFiles();
    const applied = getAppliedMigrations(db);

    console.log(`${colors.bright}${colors.cyan}Migration Status${colors.reset}\n`);
    console.log(`${'─'.repeat(60)}`);

    if (files.length === 0) {
        console.log(`${colors.dim}No migrations found${colors.reset}`);
        return;
    }

    for (const file of files) {
        const isApplied = applied.includes(file);
        const status = isApplied
            ? `${colors.green}✓ applied${colors.reset}`
            : `${colors.yellow}○ pending${colors.reset}`;
        console.log(`  ${status}  ${file}`);
    }

    console.log(`${'─'.repeat(60)}`);
    console.log(`${colors.dim}Total: ${files.length}  Applied: ${applied.length}  Pending: ${files.length - applied.length}${colors.reset}`);
}

/**
 * Main
 */
function main() {
    if (createName) {
        createMigration(createName);
        return;
    }

    const db = getDb();

    try {
        if (showStatus) {
            showMigrationStatus(db);
        } else if (rollback) {
            rollbackLast(db);
        } else {
            runMigrations(db);
        }
    } finally {
        db.close();
    }
}

main();
