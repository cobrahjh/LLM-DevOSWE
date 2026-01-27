/**
 * MCP-Hive Bridge Service
 * Exposes MCP server capabilities to all Hive AI
 * Port: 8860
 *
 * Architecture:
 * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 * │   Oracle    │───►│  MCP Bridge │───►│ MCP Servers │
 * │   KittBox   │───►│   :8860     │───►│ (14 total)  │
 * │   tinyAI    │───►│             │───►│             │
 * └─────────────┘    └─────────────┘    └─────────────┘
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 8860;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MCP Server configurations
const MCP_SERVERS = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-filesystem', process.env.HOME || 'C:/Users/hjharissh'],
    description: 'File system operations',
    tools: ['read_file', 'write_file', 'list_directory', 'create_directory', 'move_file', 'search_files', 'get_file_info']
  },
  memory: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-memory'],
    description: 'Persistent knowledge graph memory',
    tools: ['create_entities', 'create_relations', 'add_observations', 'delete_entities', 'delete_observations', 'delete_relations', 'read_graph', 'search_nodes', 'open_nodes']
  },
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '' },
    description: 'GitHub repository operations',
    tools: ['search_repositories', 'get_file_contents', 'create_or_update_file', 'push_files', 'create_issue', 'create_pull_request', 'fork_repository', 'create_branch', 'list_commits', 'list_issues', 'update_issue', 'add_issue_comment', 'search_code', 'search_issues', 'search_users', 'get_issue', 'get_pull_request', 'list_pull_requests', 'create_repository', 'get_me']
  },
  fetch: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-fetch'],
    description: 'HTTP fetch operations',
    tools: ['fetch']
  },
  sqlite: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-sqlite'],
    description: 'SQLite database operations',
    tools: ['read_query', 'write_query', 'create_table', 'list_tables', 'describe_table', 'append_insight']
  },
  git: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-git'],
    description: 'Git version control operations',
    tools: ['git_status', 'git_diff_unstaged', 'git_diff_staged', 'git_diff', 'git_commit', 'git_add', 'git_reset', 'git_log', 'git_create_branch', 'git_checkout', 'git_show', 'git_init', 'git_clone', 'git_branch_list', 'git_tag_list', 'git_remote_list', 'git_stash', 'git_stash_pop']
  },
  time: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-time'],
    description: 'Time and timezone operations',
    tools: ['get_current_time', 'convert_time']
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-sequential-thinking'],
    description: 'Step-by-step reasoning',
    tools: ['sequentialthinking']
  },
  puppeteer: {
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-puppeteer'],
    description: 'Browser automation',
    tools: ['puppeteer_navigate', 'puppeteer_screenshot', 'puppeteer_click', 'puppeteer_fill', 'puppeteer_select', 'puppeteer_hover', 'puppeteer_evaluate']
  },
  slack: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: {
      SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || '',
      SLACK_TEAM_ID: process.env.SLACK_TEAM_ID || ''
    },
    description: 'Slack integration',
    tools: ['slack_list_channels', 'slack_post_message', 'slack_reply_to_thread', 'slack_add_reaction', 'slack_get_channel_history', 'slack_get_thread_replies', 'slack_get_users', 'slack_get_user_profile']
  },
  'brave-search': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
    description: 'Web search via Brave Search API',
    tools: ['brave_web_search', 'brave_local_search']
  }
};

// Active MCP server processes
const activeServers = new Map();
const serverHealth = new Map();

// MCP Protocol helpers
class MCPClient {
  constructor(serverName, config) {
    this.serverName = serverName;
    this.config = config;
    this.process = null;
    this.ready = false;
    this.tools = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.buffer = '';
  }

  async start() {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...this.config.env };

      this.process = spawn(this.config.command, this.config.args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr.on('data', (data) => {
        console.error(`[MCP:${this.serverName}] stderr:`, data.toString());
      });

      this.process.on('error', (err) => {
        console.error(`[MCP:${this.serverName}] Process error:`, err);
        this.ready = false;
        reject(err);
      });

      this.process.on('close', (code) => {
        console.log(`[MCP:${this.serverName}] Process closed with code ${code}`);
        this.ready = false;
        activeServers.delete(this.serverName);
      });

      // Initialize MCP protocol
      setTimeout(async () => {
        try {
          await this.initialize();
          this.ready = true;
          resolve(true);
        } catch (err) {
          reject(err);
        }
      }, 1000);
    });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (e) {
          // Not JSON, might be log output
        }
      }
    }
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
    }
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result); },
        reject: (err) => { clearTimeout(timeout); reject(err); }
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-hive-bridge', version: '1.0.0' }
    });

    // Send initialized notification
    this.process.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // Get available tools
    try {
      const toolsResult = await this.sendRequest('tools/list', {});
      this.tools = toolsResult.tools || [];
    } catch (e) {
      this.tools = this.config.tools.map(name => ({ name }));
    }

    return result;
  }

  async callTool(toolName, args = {}) {
    if (!this.ready) {
      throw new Error(`Server ${this.serverName} not ready`);
    }

    return await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

// Get or start MCP server
async function getServer(serverName) {
  if (activeServers.has(serverName)) {
    const client = activeServers.get(serverName);
    if (client.ready) {
      return client;
    }
  }

  const config = MCP_SERVERS[serverName];
  if (!config) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  console.log(`[MCP Bridge] Starting ${serverName}...`);
  const client = new MCPClient(serverName, config);

  try {
    await client.start();
    activeServers.set(serverName, client);
    serverHealth.set(serverName, { status: 'online', lastCheck: Date.now() });
    console.log(`[MCP Bridge] ${serverName} ready with ${client.tools.length} tools`);
    return client;
  } catch (err) {
    serverHealth.set(serverName, { status: 'error', error: err.message, lastCheck: Date.now() });
    throw err;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-hive-bridge',
    port: PORT,
    uptime: process.uptime(),
    activeServers: activeServers.size,
    availableServers: Object.keys(MCP_SERVERS).length
  });
});

// Comprehensive status endpoint
app.get('/api/status', (req, res) => {
  const serverStatuses = Object.entries(MCP_SERVERS).map(([name, config]) => {
    const health = serverHealth.get(name);
    const client = activeServers.get(name);
    return {
      name,
      description: config.description,
      status: health?.status || 'stopped',
      active: !!client?.ready,
      toolCount: client?.tools?.length || config.tools.length,
      lastCheck: health?.lastCheck || null,
      error: health?.error || null
    };
  });

  const online = serverStatuses.filter(s => s.status === 'online').length;
  const errored = serverStatuses.filter(s => s.status === 'error').length;

  res.json({
    service: 'mcp-hive-bridge',
    version: '1.0.0',
    port: PORT,
    uptime: process.uptime(),
    summary: {
      total: serverStatuses.length,
      online,
      stopped: serverStatuses.length - online - errored,
      errored
    },
    servers: serverStatuses,
    timestamp: new Date().toISOString()
  });
});

// List all available MCP servers
app.get('/api/servers', (req, res) => {
  const servers = Object.entries(MCP_SERVERS).map(([name, config]) => ({
    name,
    description: config.description,
    tools: config.tools,
    status: serverHealth.get(name)?.status || 'stopped',
    active: activeServers.has(name)
  }));

  res.json({ servers });
});

// Get server details
app.get('/api/servers/:name', async (req, res) => {
  const { name } = req.params;
  const config = MCP_SERVERS[name];

  if (!config) {
    return res.status(404).json({ error: `Server ${name} not found` });
  }

  const client = activeServers.get(name);

  res.json({
    name,
    description: config.description,
    tools: client?.tools || config.tools,
    status: serverHealth.get(name)?.status || 'stopped',
    active: !!client?.ready
  });
});

// Start a server
app.post('/api/servers/:name/start', async (req, res) => {
  const { name } = req.params;

  try {
    const client = await getServer(name);
    res.json({
      success: true,
      server: name,
      tools: client.tools.length,
      status: 'online'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a server
app.post('/api/servers/:name/stop', (req, res) => {
  const { name } = req.params;
  const client = activeServers.get(name);

  if (client) {
    client.stop();
    activeServers.delete(name);
    serverHealth.set(name, { status: 'stopped', lastCheck: Date.now() });
  }

  res.json({ success: true, server: name, status: 'stopped' });
});

// List tools for a server
app.get('/api/servers/:name/tools', async (req, res) => {
  const { name } = req.params;

  try {
    const client = await getServer(name);
    res.json({ server: name, tools: client.tools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Call a tool
app.post('/api/servers/:name/tools/:tool', async (req, res) => {
  const { name, tool } = req.params;
  const args = req.body;

  try {
    const client = await getServer(name);
    const result = await client.callTool(tool, args);
    res.json({ success: true, server: name, tool, result });
  } catch (err) {
    res.status(500).json({ error: err.message, server: name, tool });
  }
});

// Unified tool call endpoint (auto-routes to correct server)
app.post('/api/tool/:tool', async (req, res) => {
  const { tool } = req.params;
  const args = req.body;

  // Find which server has this tool
  for (const [serverName, config] of Object.entries(MCP_SERVERS)) {
    if (config.tools.includes(tool)) {
      try {
        const client = await getServer(serverName);
        const result = await client.callTool(tool, args);
        return res.json({ success: true, server: serverName, tool, result });
      } catch (err) {
        return res.status(500).json({ error: err.message, server: serverName, tool });
      }
    }
  }

  res.status(404).json({ error: `Tool ${tool} not found in any server` });
});

// Batch tool calls
app.post('/api/batch', async (req, res) => {
  const { calls } = req.body; // [{ server, tool, args }, ...]

  const results = await Promise.all(calls.map(async (call) => {
    try {
      const client = await getServer(call.server);
      const result = await client.callTool(call.tool, call.args || {});
      return { success: true, ...call, result };
    } catch (err) {
      return { success: false, ...call, error: err.message };
    }
  }));

  res.json({ results });
});

// Quick shortcuts for common operations
app.get('/api/quick/read-file', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  try {
    const client = await getServer('filesystem');
    const result = await client.callTool('read_file', { path: filePath });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quick/write-file', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });

  try {
    const client = await getServer('filesystem');
    const result = await client.callTool('write_file', { path: filePath, content });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quick/memory-store', async (req, res) => {
  const { entities, relations, observations } = req.body;

  try {
    const client = await getServer('memory');
    const results = {};

    if (entities) {
      results.entities = await client.callTool('create_entities', { entities });
    }
    if (relations) {
      results.relations = await client.callTool('create_relations', { relations });
    }
    if (observations) {
      results.observations = await client.callTool('add_observations', { observations });
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quick/memory-recall', async (req, res) => {
  const { query } = req.query;

  try {
    const client = await getServer('memory');
    const result = query
      ? await client.callTool('search_nodes', { query })
      : await client.callTool('read_graph', {});
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quick/github-repo', async (req, res) => {
  const { owner, repo, path: filePath } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const client = await getServer('github');
    const result = await client.callTool('get_file_contents', { owner, repo, path: filePath || '' });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Web search shortcut (Brave Search P11)
app.get('/api/quick/search', async (req, res) => {
  const { q, count } = req.query;
  if (!q) return res.status(400).json({ error: 'q (query) required' });

  try {
    const client = await getServer('brave-search');
    const result = await client.callTool('brave_web_search', { query: q, count: parseInt(count) || 10 });
    res.json({ success: true, query: q, result });
  } catch (err) {
    res.status(500).json({ error: err.message, hint: 'Set BRAVE_API_KEY in .env' });
  }
});

// ============================================
// SERVER STARTUP
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║         MCP-HIVE BRIDGE SERVICE            ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  URL: http://localhost:${PORT}                ║`);
  console.log(`║  LAN: http://192.168.1.42:${PORT}             ║`);
  console.log('║                                            ║');
  console.log(`║  Available Servers: ${Object.keys(MCP_SERVERS).length.toString().padEnd(22)}║`);
  console.log('║                                            ║');
  console.log('║  Endpoints:                                ║');
  console.log('║    GET  /api/health                        ║');
  console.log('║    GET  /api/servers                       ║');
  console.log('║    POST /api/servers/:name/start           ║');
  console.log('║    POST /api/servers/:name/tools/:tool     ║');
  console.log('║    POST /api/tool/:tool (auto-route)       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[MCP Bridge] Shutting down...');
  for (const [name, client] of activeServers) {
    console.log(`[MCP Bridge] Stopping ${name}...`);
    client.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const client of activeServers.values()) {
    client.stop();
  }
  process.exit(0);
});
