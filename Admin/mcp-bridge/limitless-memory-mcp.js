#!/usr/bin/env node
/**
 * Limitless Memory MCP Server
 *
 * Exposes Limitless Memory (Relay :8600) as MCP tools.
 * Zero dependencies — implements MCP protocol (JSON-RPC 2.0 over stdio) directly.
 *
 * Tools: memory_store, memory_recall, memory_search, memory_semantic,
 *        memory_stats, memory_get, memory_delete
 *
 * Usage with Claude Desktop (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "limitless-memory": {
 *       "command": "node",
 *       "args": ["C:/LLM-DevOSWE/Admin/mcp-bridge/limitless-memory-mcp.js"]
 *     }
 *   }
 * }
 */

const http = require('http');
const RELAY = 'http://localhost:8600';

// --- HTTP helper ---
function relay(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, RELAY);
        const data = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: url.hostname, port: url.port,
            path: url.pathname + url.search, method,
            headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
        }, (res) => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try { resolve(JSON.parse(chunks)); }
                catch { resolve(chunks); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Relay timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

// --- MCP Tools Definition ---
const TOOLS = [
    {
        name: 'memory_store',
        description: 'Store a new memory in Limitless Memory. Automatically deduplicates via SHA256 hash. Use this to remember facts, decisions, patterns, rules, or anything worth persisting across sessions.',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'The memory content to store' },
                category: { type: 'string', description: 'Category: general, rule, fact, project, service, pattern, incident, infrastructure, persona, architecture, operations, philosophy, reference, tooling, session', default: 'general' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for organization and filtering' },
                importance: { type: 'number', description: 'Importance 1-10 (10=critical rules, 7=useful facts, 3=minor notes)', default: 5 },
                source: { type: 'string', description: 'Where this memory came from', default: 'mcp' }
            },
            required: ['content']
        }
    },
    {
        name: 'memory_recall',
        description: 'Recall memories by keyword query. Returns results scored by importance + recency + access frequency + semantic similarity. Best for finding specific knowledge.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'What to search for (keywords or natural language)' },
                limit: { type: 'number', description: 'Max results to return', default: 10 }
            },
            required: ['query']
        }
    },
    {
        name: 'memory_search',
        description: 'Search memories with filtering by category, tag, or text. Returns paginated results.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Text to search for' },
                category: { type: 'string', description: 'Filter by category' },
                tag: { type: 'string', description: 'Filter by tag' },
                limit: { type: 'number', default: 20 },
                offset: { type: 'number', default: 0 }
            }
        }
    },
    {
        name: 'memory_semantic',
        description: 'Semantic search using AI embeddings. Finds memories by meaning, not just keywords. Uses Ollama nomic-embed-text on Rock-PC. Best for natural language queries like "how do I fix a crashed service?"',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language query' },
                limit: { type: 'number', default: 10 }
            },
            required: ['query']
        }
    },
    {
        name: 'memory_stats',
        description: 'Get memory database statistics: total count, categories, embedding coverage, top accessed memories, recently added.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'memory_get',
        description: 'Get a specific memory by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Memory ID' }
            },
            required: ['id']
        }
    },
    {
        name: 'memory_delete',
        description: 'Delete a specific memory by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'number', description: 'Memory ID' }
            },
            required: ['id']
        }
    }
];

// --- Tool Handlers ---
async function handleTool(name, args) {
    switch (name) {
        case 'memory_store': {
            const result = await relay('POST', '/api/memory', {
                content: args.content,
                category: args.category || 'general',
                tags: args.tags || [],
                importance: args.importance || 5,
                source: args.source || 'mcp'
            });
            if (result.deduplicated) {
                return `Memory already exists (ID: ${result.id}, deduplicated). Content hash matched existing entry.`;
            }
            return `Memory stored successfully (ID: ${result.id})`;
        }

        case 'memory_recall': {
            const result = await relay('GET', `/api/memory/recall?q=${encodeURIComponent(args.query)}&limit=${args.limit || 10}`);
            if (!result.memories || result.memories.length === 0) {
                return `No memories found for "${args.query}"`;
            }
            const formatted = result.memories.map((m, i) =>
                `${i + 1}. [#${m.id}] (${m.category}, imp:${m.importance}) ${m.content}${m.semantic_score ? ` [semantic:${m.semantic_score}]` : ''}`
            ).join('\n');
            return `Found ${result.count} memories:\n${formatted}`;
        }

        case 'memory_search': {
            const params = new URLSearchParams();
            if (args.query) params.set('q', args.query);
            if (args.category) params.set('category', args.category);
            if (args.tag) params.set('tag', args.tag);
            params.set('limit', String(args.limit || 20));
            params.set('offset', String(args.offset || 0));

            const result = await relay('GET', `/api/memory?${params}`);
            if (!result.memories || result.memories.length === 0) {
                return 'No memories found matching criteria';
            }
            const formatted = result.memories.map(m =>
                `[#${m.id}] (${m.category}) ${m.content.substring(0, 120)}...`
            ).join('\n');
            return `${result.total} total, showing ${result.memories.length}:\n${formatted}`;
        }

        case 'memory_semantic': {
            const result = await relay('GET', `/api/memory/semantic?q=${encodeURIComponent(args.query)}&limit=${args.limit || 10}`);
            if (result.error) {
                return `Semantic search unavailable: ${result.error}${result.detail ? ' (' + result.detail + ')' : ''}`;
            }
            if (!result.memories || result.memories.length === 0) {
                return `No semantically similar memories found for "${args.query}"`;
            }
            const formatted = result.memories.map((m, i) =>
                `${i + 1}. [#${m.id}] (sim:${m.similarity}, ${m.category}) ${m.content.substring(0, 150)}`
            ).join('\n');
            return `${result.count} results (${result.embeddings_total} embeddings searched):\n${formatted}`;
        }

        case 'memory_stats': {
            const result = await relay('GET', '/api/memory/stats');
            const cats = result.categories ? result.categories.map(c => `${c.category}(${c.count})`).join(', ') : 'none';
            return `Total: ${result.total} memories (${result.archived} archived)\nEmbeddings: ${result.embeddings} (${result.embedding_coverage}% coverage)\nLinks: ${result.links}\nCategories: ${cats}`;
        }

        case 'memory_get': {
            const result = await relay('GET', `/api/memory/${args.id}`);
            if (result.error) return `Memory #${args.id} not found`;
            return JSON.stringify(result, null, 2);
        }

        case 'memory_delete': {
            const result = await relay('DELETE', `/api/memory/${args.id}`);
            return result.success ? `Memory #${args.id} deleted` : `Failed to delete: ${result.error || 'unknown error'}`;
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
    // MCP uses Content-Length header framing
    while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
            buffer = buffer.substring(headerEnd + 4);
            continue;
        }

        const contentLength = parseInt(match[1]);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + contentLength) break; // Wait for more data

        const body = buffer.substring(bodyStart, bodyStart + contentLength);
        buffer = buffer.substring(bodyStart + contentLength);

        try {
            const msg = JSON.parse(body);
            handleMessage(msg);
        } catch (e) {
            stderr(`Parse error: ${e.message}`);
        }
    }
}

function send(msg) {
    const body = JSON.stringify(msg);
    const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    process.stdout.write(frame);
}

function stderr(msg) {
    process.stderr.write(`[limitless-memory-mcp] ${msg}\n`);
}

async function handleMessage(msg) {
    if (msg.method === 'initialize') {
        send({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'limitless-memory', version: '1.0.0' }
            }
        });
        stderr('Initialized');
    } else if (msg.method === 'notifications/initialized') {
        // Client acknowledged, nothing to do
    } else if (msg.method === 'tools/list') {
        send({
            jsonrpc: '2.0',
            id: msg.id,
            result: { tools: TOOLS }
        });
    } else if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params;
        try {
            const result = await handleTool(name, args || {});
            send({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    content: [{ type: 'text', text: String(result) }]
                }
            });
        } catch (err) {
            send({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    content: [{ type: 'text', text: `Error: ${err.message}` }],
                    isError: true
                }
            });
        }
    } else if (msg.method === 'ping') {
        send({ jsonrpc: '2.0', id: msg.id, result: {} });
    } else if (msg.id !== undefined) {
        // Unknown request with ID — respond with error
        send({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32601, message: `Method not found: ${msg.method}` }
        });
    }
    // Ignore unknown notifications (no id)
}

stderr('Limitless Memory MCP Server starting...');
