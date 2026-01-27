#!/usr/bin/env node
/**
 * Relay Database MCP Server
 *
 * Provides read-only SQL access to Relay's SQLite database (tasks.db).
 * Zero dependencies beyond better-sqlite3 (already installed for Relay).
 *
 * Tools: db_query, db_tables, db_describe, db_stats
 *
 * Safety: Only SELECT queries allowed. All writes are blocked.
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'relay', 'tasks.db');
let db;
try {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('journal_mode = WAL');
} catch (err) {
    process.stderr.write(`[relay-db-mcp] Failed to open database: ${err.message}\n`);
    process.exit(1);
}

// --- MCP Tools Definition ---
const TOOLS = [
    {
        name: 'db_query',
        description: 'Execute a read-only SQL query against the Relay database. Only SELECT statements are allowed. Returns up to 100 rows by default. Use this for custom queries, analytics, joining tables, etc.',
        inputSchema: {
            type: 'object',
            properties: {
                sql: { type: 'string', description: 'SQL SELECT query to execute' },
                limit: { type: 'number', description: 'Max rows to return (default 100, max 1000)', default: 100 }
            },
            required: ['sql']
        }
    },
    {
        name: 'db_tables',
        description: 'List all tables in the Relay database with their row counts.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'db_describe',
        description: 'Describe a specific table: columns, types, row count, sample data.',
        inputSchema: {
            type: 'object',
            properties: {
                table: { type: 'string', description: 'Table name to describe' }
            },
            required: ['table']
        }
    },
    {
        name: 'db_stats',
        description: 'Get overall database statistics: file size, table count, total rows, and key metrics.',
        inputSchema: { type: 'object', properties: {} }
    }
];

// --- Tool Handlers ---
function handleTool(name, args) {
    switch (name) {
        case 'db_query': {
            const sql = (args.sql || '').trim();
            // Safety: only allow SELECT and PRAGMA (read-only)
            const upper = sql.toUpperCase();
            if (!upper.startsWith('SELECT') && !upper.startsWith('PRAGMA') && !upper.startsWith('EXPLAIN') && !upper.startsWith('WITH')) {
                return 'Error: Only SELECT, PRAGMA, EXPLAIN, and WITH (CTE) queries are allowed. This is a read-only interface.';
            }
            // Block dangerous patterns
            if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH)\b/i.test(sql)) {
                return 'Error: Write operations are not allowed. This is a read-only interface.';
            }
            const limit = Math.min(args.limit || 100, 1000);
            try {
                let query = sql;
                // Add LIMIT if not present
                if (!upper.includes('LIMIT')) {
                    query = `${sql} LIMIT ${limit}`;
                }
                const rows = db.prepare(query).all();
                if (rows.length === 0) return 'Query returned 0 rows.';
                const cols = Object.keys(rows[0]);
                const header = cols.join(' | ');
                const sep = cols.map(() => '---').join(' | ');
                const data = rows.map(r => cols.map(c => {
                    const v = r[c];
                    if (v === null) return 'NULL';
                    const s = String(v);
                    return s.length > 120 ? s.substring(0, 117) + '...' : s;
                }).join(' | ')).join('\n');
                return `${rows.length} rows:\n${header}\n${sep}\n${data}`;
            } catch (err) {
                return `SQL Error: ${err.message}`;
            }
        }

        case 'db_tables': {
            try {
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
                const result = tables.map(t => {
                    try {
                        const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
                        return `${t.name}: ${count.c} rows`;
                    } catch {
                        return `${t.name}: (error reading)`;
                    }
                });
                return `${tables.length} tables:\n${result.join('\n')}`;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }

        case 'db_describe': {
            const table = args.table;
            if (!table) return 'Error: table name is required';
            // Validate table name to prevent injection
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
                return 'Error: Invalid table name';
            }
            try {
                const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
                if (!exists) return `Table "${table}" not found`;
                const info = db.prepare(`PRAGMA table_info("${table}")`).all();
                const count = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get();
                const cols = info.map(c =>
                    `  ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' PRIMARY KEY' : ''}${c.dflt_value !== null ? ` DEFAULT ${c.dflt_value}` : ''}`
                ).join('\n');
                // Get 3 sample rows
                let sample = '';
                try {
                    const rows = db.prepare(`SELECT * FROM "${table}" LIMIT 3`).all();
                    if (rows.length > 0) {
                        sample = '\n\nSample data (3 rows):\n' + rows.map(r =>
                            Object.entries(r).map(([k, v]) => {
                                const s = v === null ? 'NULL' : String(v);
                                return `  ${k}: ${s.length > 80 ? s.substring(0, 77) + '...' : s}`;
                            }).join('\n')
                        ).join('\n---\n');
                    }
                } catch { /* no sample */ }
                return `Table: ${table}\nRows: ${count.c}\nColumns:\n${cols}${sample}`;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }

        case 'db_stats': {
            try {
                const fs = require('fs');
                const stat = fs.statSync(DB_PATH);
                const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
                let totalRows = 0;
                const tableSummary = tables.map(t => {
                    try {
                        const c = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
                        totalRows += c;
                        return `${t.name}: ${c}`;
                    } catch { return `${t.name}: error`; }
                });
                const pageSize = db.pragma('page_size', { simple: true });
                const pageCount = db.pragma('page_count', { simple: true });
                return `Database: ${DB_PATH}\nSize: ${sizeMB} MB\nPage size: ${pageSize}, Pages: ${pageCount}\nTables: ${tables.length}\nTotal rows: ${totalRows}\n\nPer table:\n${tableSummary.join('\n')}`;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }

        default:
            return `Unknown tool: ${name}`;
    }
}

// --- JSON-RPC over stdio ---
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    processBuffer();
});

function processBuffer() {
    while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;
        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }
        const contentLength = parseInt(match[1]);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + contentLength) break;
        const body = buffer.substring(bodyStart, bodyStart + contentLength);
        buffer = buffer.substring(bodyStart + contentLength);
        try { handleMessage(JSON.parse(body)); }
        catch (e) { stderr(`Parse error: ${e.message}`); }
    }
}

function send(msg) {
    const body = JSON.stringify(msg);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function stderr(msg) {
    process.stderr.write(`[relay-db-mcp] ${msg}\n`);
}

function handleMessage(msg) {
    if (msg.method === 'initialize') {
        send({
            jsonrpc: '2.0', id: msg.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'relay-db', version: '1.0.0' }
            }
        });
        stderr('Initialized');
    } else if (msg.method === 'notifications/initialized') {
        // ack
    } else if (msg.method === 'tools/list') {
        send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } });
    } else if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params;
        try {
            const result = handleTool(name, args || {});
            send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: String(result) }] } });
        } catch (err) {
            send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
        }
    } else if (msg.method === 'ping') {
        send({ jsonrpc: '2.0', id: msg.id, result: {} });
    } else if (msg.id !== undefined) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
    }
}

process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('SIGINT', () => { db.close(); process.exit(0); });

stderr('Relay Database MCP Server starting...');
