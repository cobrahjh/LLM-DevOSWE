/**
 * SimWidget Agent Server v1.4.0
 *
 * Self-hosted Claude assistant with local dev environment access
 *
 * Features:
 * - Web chat UI accessible from phone
 * - Claude API integration
 * - Local file read/write
 * - PowerShell command execution
 * - SimWidget server control
 * - Chat history logging
 * - TODO task logging
 * - API usage/cost tracking with budget limits
 * - Token optimization (history truncation, content limits)
 * - Hot Update Engine for live reload
 * - Service Manager with dev/service modes
 * - Kitt busy state tracking & broadcasting
 * - Task queue system (prevents deadlock when Kitt is busy)
 *
 * Path: C:\DevOSWE\SimWidget_Engine\Admin\agent\agent-server.js
 * Last Updated: 2026-01-11
 *
 * v1.4.0 - Task queue system: queue tasks when Kitt is busy, auto-process when available
 * v1.3.0 - Token optimization: budget limits, history truncation, max_tokens reduction
 * v1.2.0 - Added Kitt busy state API (/api/kitt/status) and WebSocket broadcast
 * v1.1.0 - Added /api/services/status endpoint, mode-based status checks
 * v1.0.9 - Added Hot Update Engine for WebSocket-based live reload
 * v1.0.8 - Added API usage/cost tracking and reporting
 * v1.0.7 - Added chat history and TODO logging
 * v1.0.6 - Fixed tool_use/tool_result mismatch error, auto-recovery, crash protection
 * v1.0.5 - Added express.static to serve agent-ui HTML
 * v1.0.1 - Fixed PowerShell command execution
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const TroubleshootEngine = require('../shared/troubleshoot-engine');
const { ServiceManager, SERVICES } = require('./service-manager');

// Initialize service manager
const serviceManager = new ServiceManager();

// Global busy state tracking
let kittBusy = false;
let kittBusySince = null;
let kittCurrentTask = null;

// Task queue for when Kitt is busy
const taskQueue = [];
let isProcessingQueue = false;

function setKittBusy(busy, task = null) {
    kittBusy = busy;
    kittBusySince = busy ? new Date().toISOString() : null;
    kittCurrentTask = task;

    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({
                type: 'busy_state',
                busy: kittBusy,
                since: kittBusySince,
                task: kittCurrentTask,
                queueLength: taskQueue.length
            }));
        }
    });

    // Process next queued task when no longer busy
    if (!busy && taskQueue.length > 0 && !isProcessingQueue) {
        processNextInQueue();
    }
}

// Add task to queue
function queueTask(task) {
    const queuedTask = {
        id: `task-${Date.now()}`,
        ...task,
        queuedAt: new Date().toISOString(),
        status: 'queued'
    };
    taskQueue.push(queuedTask);
    console.log(`[Queue] Task queued: ${queuedTask.id} (${taskQueue.length} in queue)`);

    // Broadcast queue update
    broadcastQueueUpdate();

    return queuedTask;
}

// Process next task in queue
async function processNextInQueue() {
    if (taskQueue.length === 0 || kittBusy) return;

    isProcessingQueue = true;
    const task = taskQueue.shift();
    console.log(`[Queue] Processing queued task: ${task.id}`);

    try {
        // Execute the queued task
        if (task.execute && typeof task.execute === 'function') {
            await task.execute();
        }
    } catch (err) {
        console.error(`[Queue] Task ${task.id} failed:`, err.message);
    } finally {
        isProcessingQueue = false;
        broadcastQueueUpdate();
    }
}

// Broadcast queue status to all clients
function broadcastQueueUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({
                type: 'queue_update',
                queueLength: taskQueue.length,
                tasks: taskQueue.map(t => ({
                    id: t.id,
                    preview: t.content?.substring(0, 50) || 'Task',
                    queuedAt: t.queuedAt
                }))
            }));
        }
    });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const HotEngine = require('./hot-update/hot-engine');

const PORT = process.env.AGENT_PORT || 8585;

// Handle WebSocket upgrades manually to support multiple WS endpoints
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    
    if (pathname === '/chat') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else if (pathname === '/hot') {
        // Let HotEngine handle /hot path - it will be set up after server.listen
        if (server.hotEngine && server.hotEngine.wss) {
            server.hotEngine.wss.handleUpgrade(request, socket, head, (ws) => {
                server.hotEngine.wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    } else {
        socket.destroy();
    }
});
const PROJECT_ROOT = 'C:\\DevClaude\\SimWidget_Engine';

// Serve static files from agent-ui directory
app.use(express.static(path.join(__dirname, 'agent-ui')));
app.use('/hot-update', express.static(path.join(__dirname, 'hot-update')));
app.use(express.json());

// CORS headers for cross-origin requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Anthropic client - DISABLED (not cost effective, use relay mode instead)
// const anthropic = new Anthropic({
//     apiKey: process.env.ANTHROPIC_API_KEY
// });
const anthropic = null; // Placeholder - relay mode is always used

const LOGS_DIR = path.join(__dirname, 'logs');
const CHAT_LOG = path.join(LOGS_DIR, 'chat-history.log');
const USAGE_LOG = path.join(LOGS_DIR, 'usage.log');
const NOTES_FILE = path.join(LOGS_DIR, 'notes.txt');
const TODOS_FILE = path.join(LOGS_DIR, 'todos.json');
const AGENT_LOG = path.join(LOGS_DIR, 'agent-server.log');

// Agent log buffer (captures console output)
const agentLogBuffer = [];
const MAX_LOG_LINES = 500;

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    agentLogBuffer.push(line);
    if (agentLogBuffer.length > MAX_LOG_LINES) {
        agentLogBuffer.shift();
    }
    // Also append to file
    fs.appendFileSync(AGENT_LOG, line + '\n');
}

// Intercept console.log for agent logging
const originalLog = console.log;
console.log = (...args) => {
    originalLog.apply(console, args);
    logToFile(args.join(' '));
};

// Model Configuration - Toggle between Sonnet 4 and Opus 4.5
const MODEL_CONFIG = {
    current: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    options: {
        'claude-sonnet-4-20250514': {
            name: 'Sonnet 4',
            description: 'Fast & cost-effective',
            pricing: { input: 0.003 / 1000, output: 0.015 / 1000 }
        },
        'claude-opus-4-5-20251101': {
            name: 'Opus 4.5',
            description: 'Most capable, complex reasoning',
            pricing: { input: 0.015 / 1000, output: 0.075 / 1000 }
        }
    }
};

// Get current model pricing
function getPricing() {
    return MODEL_CONFIG.options[MODEL_CONFIG.current]?.pricing || MODEL_CONFIG.options['claude-sonnet-4-20250514'].pricing;
}

// Legacy PRICING reference (for backward compat)
const PRICING = MODEL_CONFIG.options['claude-sonnet-4-20250514'].pricing;

// Token Optimization Settings
const TOKEN_LIMITS = {
    maxHistoryMessages: 10,      // Keep only last N messages in context
    maxTokensPerResponse: 2048,  // Reduced from 4096
    sessionBudget: 100000,       // Max input tokens per session
    dailyBudget: 500000,         // Max input tokens per day
    todoSummaryThreshold: 10,    // Summarize if more than N todos
    maxContentLength: 1500       // Truncate long content in history
};

// Relay Mode Configuration
// When enabled, messages go to Relay → Claude Desktop instead of direct API
// ALWAYS use relay mode - direct API is not cost effective
const RELAY_CONFIG = {
    enabled: true,  // ALWAYS enabled - API keys not cost effective
    url: process.env.RELAY_URL || 'http://localhost:8600',
    pollInterval: 1000,
    timeout: 300000
};

// Bridge Mode Configuration
// Routes through Claude Code CLI (uses Pro subscription, no API costs)
const BRIDGE_CONFIG = {
    enabled: false,  // DISABLED - use Relay mode instead (not cost effective)
    url: process.env.BRIDGE_URL || 'http://localhost:8601',
    timeout: 300000  // 5 minute timeout
};

// Track daily usage
let dailyTokenUsage = { date: new Date().toISOString().split('T')[0], tokens: 0 };

// Ensure logs directory
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log API usage
function logUsage(sessionId, inputTokens, outputTokens) {
    const pricing = getPricing();
    const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);
    const entry = {
        timestamp: new Date().toISOString(),
        sessionId,
        model: MODEL_CONFIG.current,
        inputTokens,
        outputTokens,
        cost: cost.toFixed(6)
    };
    fs.appendFileSync(USAGE_LOG, JSON.stringify(entry) + '\n');
    
    // Update daily tracking
    const today = new Date().toISOString().split('T')[0];
    if (dailyTokenUsage.date !== today) {
        dailyTokenUsage = { date: today, tokens: 0 };
    }
    dailyTokenUsage.tokens += inputTokens;
}

// Check if within budget
function checkBudget(sessionTokens) {
    const today = new Date().toISOString().split('T')[0];
    if (dailyTokenUsage.date !== today) {
        dailyTokenUsage = { date: today, tokens: 0 };
    }
    
    if (sessionTokens > TOKEN_LIMITS.sessionBudget) {
        return { ok: false, reason: 'Session token limit reached. Start a new chat.' };
    }
    if (dailyTokenUsage.tokens > TOKEN_LIMITS.dailyBudget) {
        return { ok: false, reason: 'Daily token budget exceeded. Try again tomorrow.' };
    }
    return { ok: true };
}

// Truncate conversation history to save tokens
function truncateHistory(messages) {
    if (messages.length <= TOKEN_LIMITS.maxHistoryMessages) {
        return messages;
    }
    
    // Keep system message (if first) + last N messages
    const hasSystem = messages[0]?.role === 'system';
    const keepFrom = hasSystem ? 1 : 0;
    const systemMsg = hasSystem ? [messages[0]] : [];
    
    // Get last N messages
    const recentMessages = messages.slice(-TOKEN_LIMITS.maxHistoryMessages);
    
    // Add summary of truncated messages
    const truncatedCount = messages.length - TOKEN_LIMITS.maxHistoryMessages - keepFrom;
    if (truncatedCount > 0) {
        const summaryMsg = {
            role: 'user',
            content: `[Note: ${truncatedCount} earlier messages summarized to save tokens]`
        };
        return [...systemMsg, summaryMsg, ...recentMessages];
    }
    
    return [...systemMsg, ...recentMessages];
}

// Summarize todos if too many
function summarizeTodos(todos) {
    if (!todos || todos.length <= TOKEN_LIMITS.todoSummaryThreshold) {
        return todos;
    }
    
    // Group by priority and status
    const pending = todos.filter(t => !t.completed);
    const completed = todos.filter(t => t.completed);
    const highPriority = pending.filter(t => t.priority === 'high');
    
    return {
        summary: true,
        total: todos.length,
        pending: pending.length,
        completed: completed.length,
        highPriority: highPriority.map(t => ({ id: t.id, text: t.text.substring(0, 50) })),
        recentPending: pending.slice(0, 5).map(t => ({ id: t.id, text: t.text.substring(0, 50), priority: t.priority }))
    };
}

// Truncate content in messages
function truncateMessageContent(messages) {
    return messages.map(msg => {
        if (typeof msg.content === 'string' && msg.content.length > TOKEN_LIMITS.maxContentLength) {
            return {
                ...msg,
                content: msg.content.substring(0, TOKEN_LIMITS.maxContentLength) + '... [truncated]'
            };
        }
        return msg;
    });
}

// Log chat messages
function logChat(sessionId, role, content) {
    const entry = {
        timestamp: new Date().toISOString(),
        sessionId,
        role,
        content: content.substring(0, 2000) // Truncate long responses
    };
    fs.appendFileSync(CHAT_LOG, JSON.stringify(entry) + '\n');
}

// Conversation history per session
const sessions = new Map();

// ============================================
// TOOLS DEFINITION
// ============================================

const tools = [
    {
        name: "read_file",
        description: "Read contents of a file from the dev environment",
        input_schema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute path or path relative to project root"
                }
            },
            required: ["path"]
        }
    },
    {
        name: "write_file",
        description: "Write content to a file in the dev environment",
        input_schema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute path or path relative to project root"
                },
                content: {
                    type: "string",
                    description: "Content to write to the file"
                }
            },
            required: ["path", "content"]
        }
    },
    {
        name: "list_directory",
        description: "List files and folders in a directory",
        input_schema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Directory path to list"
                }
            },
            required: ["path"]
        }
    },
    {
        name: "run_powershell",
        description: "Run a PowerShell command on the dev machine. Use native PowerShell cmdlets like Invoke-RestMethod, Get-Content, Test-NetConnection instead of unix commands.",
        input_schema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "PowerShell command to execute (use native cmdlets, not unix aliases)"
                },
                cwd: {
                    type: "string",
                    description: "Working directory (optional)"
                }
            },
            required: ["command"]
        }
    },
    {
        name: "simwidget_control",
        description: "Control SimWidget server (start, stop, status, restart)",
        input_schema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["start", "stop", "status", "restart", "test"],
                    description: "Action to perform on SimWidget server"
                }
            },
            required: ["action"]
        }
    },
    {
        name: "git_sync",
        description: "Commit and push changes to GitHub",
        input_schema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "Commit message"
                }
            },
            required: ["message"]
        }
    }
];

// ============================================
// TOOL EXECUTION
// ============================================

function resolvePath(p) {
    if (path.isAbsolute(p)) return p;
    return path.join(PROJECT_ROOT, p);
}

function runPowerShell(command, cwd = null) {
    return new Promise((resolve) => {
        const options = {
            shell: 'powershell.exe',
            cwd: cwd || PROJECT_ROOT
        };
        
        exec(command, options, (error, stdout, stderr) => {
            resolve({
                stdout: stdout ? stdout.trim() : '',
                stderr: stderr ? stderr.trim() : '',
                error: error ? error.message : null,
                exitCode: error ? error.code : 0
            });
        });
    });
}

async function executeTool(name, input) {
    try {
        switch (name) {
            case "read_file": {
                const filePath = resolvePath(input.path);
                if (!fs.existsSync(filePath)) {
                    return { error: `File not found: ${filePath}` };
                }
                let content = fs.readFileSync(filePath, 'utf8');
                // Truncate large files to prevent token overflow
                const MAX_FILE_SIZE = 8000;
                if (content.length > MAX_FILE_SIZE) {
                    content = content.substring(0, MAX_FILE_SIZE) + `\n\n...[truncated - file is ${content.length} chars, showing first ${MAX_FILE_SIZE}]`;
                }
                return { content, path: filePath, size: content.length };
            }

            case "write_file": {
                const filePath = resolvePath(input.path);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, input.content, 'utf8');
                return { success: true, path: filePath, size: input.content.length };
            }

            case "list_directory": {
                const dirPath = resolvePath(input.path);
                if (!fs.existsSync(dirPath)) {
                    return { error: `Directory not found: ${dirPath}` };
                }
                const items = fs.readdirSync(dirPath, { withFileTypes: true });
                let list = items.map(item => ({
                    name: item.name,
                    type: item.isDirectory() ? 'dir' : 'file'
                }));
                // Limit to 50 items to save tokens
                const total = list.length;
                if (list.length > 50) {
                    list = list.slice(0, 50);
                    return { path: dirPath, count: total, showing: 50, items: list, note: `Showing first 50 of ${total} items` };
                }
                return { path: dirPath, count: list.length, items: list };
            }

            case "run_powershell": {
                const cwd = input.cwd ? resolvePath(input.cwd) : PROJECT_ROOT;
                const result = await runPowerShell(input.command, cwd);
                // Truncate large outputs
                const MAX_OUTPUT = 4000;
                if (result.stdout && result.stdout.length > MAX_OUTPUT) {
                    result.stdout = result.stdout.substring(0, MAX_OUTPUT) + '\n...[truncated]';
                }
                if (result.stderr && result.stderr.length > MAX_OUTPUT) {
                    result.stderr = result.stderr.substring(0, MAX_OUTPUT) + '\n...[truncated]';
                }
                return result;
            }

            case "simwidget_control": {
                const simwidgetDir = path.join(PROJECT_ROOT, 'simwidget-hybrid');
                const action = input.action;

                switch (action) {
                    case "status": {
                        const result = await runPowerShell(
                            `$c = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq 'Listen'}; if($c){'SimWidget server is RUNNING on port 8080'}else{'SimWidget server is NOT running'}`
                        );
                        return { action, result: result.stdout || result.stderr || 'Unknown' };
                    }
                    
                    case "start": {
                        await runPowerShell(
                            `Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d ${simwidgetDir} && npx nodemon backend/server.js" -WindowStyle Minimized`
                        );
                        return { action, result: 'SimWidget server starting...' };
                    }
                    
                    case "stop": {
                        await runPowerShell(
                            `Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -like '*SimWidget*' -or $_.Path -like '*SimWidget*'} | Stop-Process -Force -ErrorAction SilentlyContinue`
                        );
                        // Also try by port
                        await runPowerShell(
                            `$p = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue}`
                        );
                        return { action, result: 'SimWidget server stopped' };
                    }
                    
                    case "restart": {
                        // Stop
                        await runPowerShell(
                            `$p = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue}`
                        );
                        await new Promise(r => setTimeout(r, 1000));
                        // Start
                        await runPowerShell(
                            `Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d ${simwidgetDir} && npx nodemon backend/server.js" -WindowStyle Minimized`
                        );
                        return { action, result: 'SimWidget server restarted' };
                    }
                    
                    case "test": {
                        const result = await runPowerShell(
                            `cd "${simwidgetDir}"; node tests/test-runner.js 2>&1`
                        );
                        return { action, result: result.stdout || result.stderr };
                    }
                    
                    default:
                        return { error: `Unknown action: ${action}` };
                }
            }

            case "git_sync": {
                const simwidgetDir = path.join(PROJECT_ROOT, 'simwidget-hybrid');
                const result = await runPowerShell(
                    `cd "${simwidgetDir}"; git add .; git commit -m "${input.message}"; git push 2>&1`
                );
                return {
                    success: !result.error,
                    output: result.stdout || result.stderr,
                    error: result.error
                };
            }

            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (e) {
        return { error: e.message };
    }
}

// ============================================
// CLAUDE API
// ============================================

const SYSTEM_PROMPT = `You are Kitt, Mr Architect's AI development assistant for SimWidget Engine.

You have direct access to the development environment on Harold-PC via tools:
- read_file: Read any project file
- write_file: Create or modify files  
- list_directory: Browse project structure
- run_powershell: Execute PowerShell commands (use native cmdlets, NOT unix commands like curl/ls/cat)
- simwidget_control: Start/stop/restart/status/test SimWidget server
- git_sync: Commit and push to GitHub

IMPORTANT: When running PowerShell commands, use native Windows/PowerShell cmdlets:
- Use "Invoke-RestMethod" NOT "curl"
- Use "Get-Content" NOT "cat"
- Use "Get-ChildItem" NOT "ls"
- Use "Test-NetConnection" for connectivity tests

Project location: C:\\DevClaude\\SimWidget_Engine
- simwidget-hybrid/ - Main project code (server on port 8080)
- Admin/ - Admin scripts and tools

SimWidget Engine is a flight simulator widget system for MSFS 2024.

Be concise and action-oriented. Execute tasks directly using tools rather than just explaining.`;

async function chat(sessionId, userMessage) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { messages: [], totalTokens: 0 });
    }
    const session = sessions.get(sessionId);
    let messages = session.messages;
    
    // Check budget before proceeding
    const budget = checkBudget(session.totalTokens);
    if (!budget.ok) {
        return { error: budget.reason, budgetExceeded: true };
    }
    
    // Apply token optimizations
    messages = truncateHistory(messages);
    messages = truncateMessageContent(messages);
    
    messages.push({ role: "user", content: userMessage });

    // Track total usage across all API calls
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Helper for API calls with retry on rate limit
    async function callWithRetry(params, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await anthropic.messages.create(params);
            } catch (err) {
                if (err.status === 429 && attempt < maxRetries - 1) {
                    const waitTime = Math.pow(2, attempt + 1) * 1000;
                    console.log(`[Agent] Rate limited, waiting ${waitTime/1000}s...`);
                    await new Promise(r => setTimeout(r, waitTime));
                } else {
                    throw err;
                }
            }
        }
    }

    try {
        let response = await callWithRetry({
            model: MODEL_CONFIG.current,
            max_tokens: TOKEN_LIMITS.maxTokensPerResponse,
            system: SYSTEM_PROMPT,
            tools: tools,
            messages: messages
        });
        
        // Track usage
        if (response.usage) {
            totalInputTokens += response.usage.input_tokens || 0;
            totalOutputTokens += response.usage.output_tokens || 0;
        }

        // Process tool calls
        while (response.stop_reason === "tool_use") {
            const assistantMessage = { role: "assistant", content: response.content };
            messages.push(assistantMessage);

            const toolResults = [];
            for (const block of response.content) {
                if (block.type === "tool_use") {
                    console.log(`[Tool] ${block.name}:`, JSON.stringify(block.input).substring(0, 100));
                    try {
                        const result = await executeTool(block.name, block.input);
                        console.log(`[Result]:`, JSON.stringify(result).substring(0, 200));
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: JSON.stringify(result)
                        });
                    } catch (toolError) {
                        console.error(`[Tool Error]:`, toolError.message);
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: JSON.stringify({ error: toolError.message }),
                            is_error: true
                        });
                    }
                }
            }

            messages.push({ role: "user", content: toolResults });

            response = await callWithRetry({
                model: MODEL_CONFIG.current,
                max_tokens: TOKEN_LIMITS.maxTokensPerResponse,
                system: SYSTEM_PROMPT,
                tools: tools,
                messages: messages
            });
            
            // Track usage from tool call
            if (response.usage) {
                totalInputTokens += response.usage.input_tokens || 0;
                totalOutputTokens += response.usage.output_tokens || 0;
            }
        }

        // Log total usage for this chat
        logUsage(sessionId, totalInputTokens, totalOutputTokens);
        
        // Update session token tracking
        session.totalTokens += totalInputTokens;
        session.messages = messages;

        const textContent = response.content
            .filter(block => block.type === "text")
            .map(block => block.text)
            .join("\n");

        messages.push({ role: "assistant", content: response.content });

        return textContent;
    } catch (apiError) {
        // If we get a tool_use/tool_result mismatch error, clear session and retry
        if (apiError.message && apiError.message.includes('tool_use') && apiError.message.includes('tool_result')) {
            console.error('[Agent] Corrupted session detected, clearing history...');
            sessions.set(sessionId, { messages: [], totalTokens: 0 });
            
            try {
                // Retry with clean history
                const retryMessages = [{ role: "user", content: userMessage }];
                const retryResponse = await anthropic.messages.create({
                    model: MODEL_CONFIG.current,
                    max_tokens: TOKEN_LIMITS.maxTokensPerResponse,
                    system: SYSTEM_PROMPT,
                    tools: tools,
                    messages: retryMessages
                });
                
                const textContent = retryResponse.content
                    .filter(block => block.type === "text")
                    .map(block => block.text)
                    .join("\n");
                
                sessions.set(sessionId, [
                    { role: "user", content: userMessage },
                    { role: "assistant", content: retryResponse.content }
                ]);
                return "(Session was reset)\n\n" + textContent;
            } catch (retryError) {
                console.error('[Agent] Retry also failed:', retryError.message);
                return "Sorry, there was an error. Please try again.";
            }
        }
        console.error('[Agent] API Error:', apiError.message);
        return "Error: " + apiError.message;
    }
}

// ============================================
// RELAY MODE CHAT
// ============================================

// Chat via Relay Service (routes to Claude Desktop instead of direct API)
async function chatViaRelay(sessionId, userMessage, onStatus = () => {}) {
    const http = require('http');
    
    onStatus('Queuing message...');
    
    // Post message to relay queue
    const postData = JSON.stringify({
        message: userMessage,
        sessionId: sessionId,
        context: {
            projectRoot: PROJECT_ROOT,
            timestamp: new Date().toISOString()
        }
    });
    
    return new Promise((resolve, reject) => {
        // Post to relay
        const postReq = http.request({
            hostname: new URL(RELAY_CONFIG.url).hostname,
            port: new URL(RELAY_CONFIG.url).port || 8600,
            path: '/api/queue',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (!result.messageId) {
                        return reject(new Error('Failed to queue message'));
                    }
                    
                    console.log(`[Relay] Message queued: ${result.messageId}`);
                    onStatus('Waiting for Claude Desktop...');
                    
                    // Poll for response
                    pollForResponse(result.messageId, resolve, reject, onStatus);
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        postReq.on('error', reject);
        postReq.write(postData);
        postReq.end();
    });
}

// Poll relay for response
function pollForResponse(messageId, resolve, reject, onStatus = () => {}) {
    const http = require('http');
    const startTime = Date.now();
    let lastStatus = 'pending';
    let processingStartTime = null;
    
    // Timeout for pending state (5 min) - waiting for Claude Desktop to pick up
    const PENDING_TIMEOUT = 5 * 60 * 1000;
    // Timeout for processing state (30 min) - Claude is actively working
    const PROCESSING_TIMEOUT = 30 * 60 * 1000;
    
    const poll = () => {
        const elapsed = Date.now() - startTime;
        const processingElapsed = processingStartTime ? Date.now() - processingStartTime : 0;
        
        // Only timeout if pending too long (Claude Desktop not responding)
        if (lastStatus === 'pending' && elapsed > PENDING_TIMEOUT) {
            return reject(new Error('Timeout: Claude Desktop not responding. Is the chat window open?'));
        }
        
        // Very long timeout for processing (Claude is working)
        if (lastStatus === 'processing' && processingElapsed > PROCESSING_TIMEOUT) {
            return reject(new Error('Timeout: Claude Desktop took too long processing.'));
        }
        
        http.get(`${RELAY_CONFIG.url}/api/queue/${messageId}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    // Track status changes and send updates
                    if (result.status !== lastStatus) {
                        console.log(`[Relay] Status: ${lastStatus} → ${result.status}`);
                        if (result.status === 'processing') {
                            if (!processingStartTime) processingStartTime = Date.now();
                            onStatus('Claude is working...');
                        } else if (result.status === 'pending') {
                            onStatus('Waiting for Claude Desktop...');
                        }
                        lastStatus = result.status;
                    }
                    
                    if (result.status === 'completed' && result.response) {
                        console.log(`[Relay] Response received for ${messageId}`);
                        onStatus('Complete!');
                        resolve(result.response);
                    } else if (result.status === 'pending' || result.status === 'processing') {
                        // Keep polling - slower for processing state
                        const interval = result.status === 'processing' 
                            ? RELAY_CONFIG.pollInterval * 2  // 2 sec when processing
                            : RELAY_CONFIG.pollInterval;     // 1 sec when pending
                        setTimeout(poll, interval);
                    } else {
                        reject(new Error(`Unexpected status: ${result.status}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            // Relay might be down, retry
            console.log(`[Relay] Connection error, retrying...`);
            onStatus('Reconnecting to relay...');
            setTimeout(poll, RELAY_CONFIG.pollInterval * 2);
        });
    };
    
    poll();
}

// Chat via Bridge Service (routes through Claude Code CLI - uses Pro subscription)
async function chatViaBridge(sessionId, userMessage, onStatus = () => {}) {
    onStatus('Sending to Claude Code...');

    try {
        const response = await fetch(`${BRIDGE_CONFIG.url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                context: `Session: ${sessionId}, Project: ${PROJECT_ROOT}`
            }),
            signal: AbortSignal.timeout(BRIDGE_CONFIG.timeout)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Bridge request failed');
        }

        const result = await response.json();
        onStatus('Response received');
        return result.response;
    } catch (error) {
        console.error('[Bridge] Error:', error.message);
        throw error;
    }
}

// ============================================
// WEB SERVER
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'agent-ui', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.4.0',
        project: PROJECT_ROOT,
        bridgeMode: BRIDGE_CONFIG.enabled,
        relayMode: RELAY_CONFIG.enabled
    });
});

// Bridge configuration
app.get('/api/bridge', (req, res) => {
    res.json({
        enabled: BRIDGE_CONFIG.enabled,
        url: BRIDGE_CONFIG.url,
        timeout: BRIDGE_CONFIG.timeout
    });
});

app.post('/api/bridge', (req, res) => {
    const { enabled, url } = req.body;
    if (typeof enabled === 'boolean') BRIDGE_CONFIG.enabled = enabled;
    if (url) BRIDGE_CONFIG.url = url;

    console.log(`[Agent] Bridge mode: ${BRIDGE_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, bridge: BRIDGE_CONFIG });
});

app.get('/api/bridge/health', async (req, res) => {
    try {
        const response = await fetch(`${BRIDGE_CONFIG.url}/api/health`);
        const data = await response.json();
        res.json({ available: true, ...data });
    } catch (e) {
        res.json({ available: false, error: e.message });
    }
});

// Quick Reference API (dynamic abbreviations)
const QUICK_REF_FILE = path.join(__dirname, '..', 'config', 'quick-reference.json');

app.get('/api/quick-reference', (req, res) => {
    try {
        if (fs.existsSync(QUICK_REF_FILE)) {
            const data = JSON.parse(fs.readFileSync(QUICK_REF_FILE, 'utf8'));
            res.json(data);
        } else {
            res.json({ error: 'Quick reference not found', categories: {} });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/quick-reference', (req, res) => {
    try {
        const data = req.body;
        data.lastUpdated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(QUICK_REF_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TODO Insight API - get Kitt's thoughts on a task
app.post('/api/todo-insight', async (req, res) => {
    const { task, context } = req.body;
    if (!task) {
        return res.status(400).json({ error: 'Task required' });
    }
    
    const insightPrompt = `As Kitt, the team leader and PM for SimWidget Engine, provide brief insights on this TODO task:

**Task:** ${task}
${context ? `**Context:** ${context}` : ''}

Provide concise thoughts on:
1. **Priority assessment** - Is this correctly prioritized?
2. **Implementation approach** - Quick suggestion
3. **Blockers/dependencies** - What might block this?
4. **Time estimate** - Rough estimate if possible

Keep response brief and actionable (under 200 words).`;

    // If relay mode is enabled, queue through relay
    if (RELAY_CONFIG.enabled) {
        try {
            const queueRes = await fetch(`${RELAY_CONFIG.url}/api/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sessionId: 'insight-' + Date.now(),
                    message: `[INSIGHT REQUEST] ${task}`,
                    context: { task, insightPrompt }
                })
            });
            const queueData = await queueRes.json();
            return res.json({ 
                task, 
                insight: `Insight request queued (ID: ${queueData.messageId}). Check Kitt Log for response when Claude Desktop processes it.`,
                queued: true,
                messageId: queueData.messageId
            });
        } catch (err) {
            return res.status(500).json({ error: 'Relay not available: ' + err.message });
        }
    }

    try {
        const response = await anthropic.messages.create({
            model: MODEL_CONFIG.current,
            max_tokens: 500,
            messages: [{ role: "user", content: insightPrompt }]
        });
        
        const insight = response.content
            .filter(block => block.type === "text")
            .map(block => block.text)
            .join("\n");
        
        res.json({ task, insight });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Graceful shutdown endpoint
app.post('/api/shutdown', (req, res) => {
    console.log('[Agent] Shutdown requested via API');
    res.json({ status: 'shutting_down' });
    
    // Close WebSocket connections
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'server_shutdown' }));
        client.close();
    });
    
    // Close server gracefully
    setTimeout(() => {
        server.close(() => {
            console.log('[Agent] Graceful shutdown complete');
            process.exit(0);
        });
    }, 500);
});

// Local command endpoints (no token cost)
app.get('/api/processes', async (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('tasklist /fo csv /nh', (err, stdout) => {
            if (err) return res.json({ error: err.message });
            const lines = stdout.trim().split('\n').slice(0, 20);
            const processes = lines.map(line => {
                const parts = line.split('","');
                return { name: parts[0]?.replace(/"/g, ''), pid: parts[1]?.replace(/"/g, '') };
            }).filter(p => p.name);
            res.json({ processes });
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

app.get('/api/disk', async (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('wmic logicaldisk get size,freespace,caption', (err, stdout) => {
            if (err) return res.json({ error: err.message });
            const lines = stdout.trim().split('\n').slice(1).filter(l => l.trim());
            const disks = lines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const drive = parts[0];
                    const free = (parseInt(parts[1]) / 1073741824).toFixed(1);
                    const total = (parseInt(parts[2]) / 1073741824).toFixed(1);
                    return `${drive} ${free}GB free / ${total}GB total`;
                }
                return null;
            }).filter(d => d);
            res.json({ usage: disks.join('\n') || 'No disk info' });
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

app.post('/api/simwidget/restart', async (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('powershell -Command "Get-Process -Name node | Where-Object {$_.MainWindowTitle -like \'*8080*\'} | Stop-Process -Force"', () => {
            exec(`cd ${path.join(PROJECT_ROOT, 'simwidget-hybrid', 'backend')} && start cmd /c "node server.js"`);
        });
        res.json({ success: true, message: 'Restart triggered' });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// Status endpoint for service monitoring
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', service: 'agent', version: '1.1.0' });
});

// Memory (CLAUDE.md and STANDARDS.md)
app.get('/api/memory', (req, res) => {
    try {
        const claudeMd = path.join('C:\\DevOSWE', 'CLAUDE.md');
        const standardsMd = path.join('C:\\DevOSWE', 'STANDARDS.md');

        const claude = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : '';
        const standards = fs.existsSync(standardsMd) ? fs.readFileSync(standardsMd, 'utf8') : '';

        res.json({
            claude,
            standards,
            lastModified: {
                claude: fs.existsSync(claudeMd) ? fs.statSync(claudeMd).mtime : null,
                standards: fs.existsSync(standardsMd) ? fs.statSync(standardsMd).mtime : null
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notes
app.get('/api/notes', (req, res) => {
    try {
        const notes = fs.existsSync(NOTES_FILE) ? fs.readFileSync(NOTES_FILE, 'utf8') : '';
        res.json({ notes });
    } catch (err) {
        res.json({ notes: '', error: err.message });
    }
});

app.post('/api/notes', (req, res) => {
    try {
        fs.writeFileSync(NOTES_FILE, req.body.notes || '');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dev Tracker API
const DEV_TRACKER_FILE = path.join(LOGS_DIR, 'dev-tracker.json');

// Auto-log completed tasks from Kitt's responses
function autoLogTask(userMessage, kittResponse) {
    try {
        // Detect task completion patterns in response
        const completionPatterns = [
            /\*\*Done[.!]?\*\*/i,
            /Done\./i,
            /✅/,
            /(?:complete|done|created|fixed|added|updated|implemented|removed|enhanced)/i,
            /Successfully/i,
            /Files? (?:Created|Modified|Updated)/i,
            /I've (?:added|created|fixed|updated|implemented|removed)/i,
            /Now (?:you can|it will|the)/i,
            /Here's what I/i,
            /All (?:done|complete|set)/i
        ];

        const isTaskComplete = completionPatterns.some(p => p.test(kittResponse));
        console.log(`[DevTracker] Checking response - matches pattern: ${isTaskComplete}`);
        if (!isTaskComplete) return;
        
        // Extract task info from response
        const categoryPatterns = {
            feature: /(?:added|created|implemented|new feature)/i,
            bugfix: /(?:fixed|resolved|repaired|bug|error)/i,
            refactor: /(?:refactor|renamed|reorganized|updated|changed)/i,
            docs: /(?:documentation|docs|readme|standard)/i
        };
        
        let category = 'feature';
        for (const [cat, pattern] of Object.entries(categoryPatterns)) {
            if (pattern.test(kittResponse)) { category = cat; break; }
        }
        
        // Extract title from first line or bold text
        let title = userMessage.slice(0, 50);
        const boldMatch = kittResponse.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) title = boldMatch[1].slice(0, 50);
        
        // Extract files from response
        const files = [];
        const fileMatches = kittResponse.matchAll(/`([^`]+\.(js|html|md|json|css))`/g);
        for (const m of fileMatches) files.push(m[1]);
        
        // Load and update tracker
        const data = fs.existsSync(DEV_TRACKER_FILE)
            ? JSON.parse(fs.readFileSync(DEV_TRACKER_FILE, 'utf8'))
            : { version: '1.1.0', days: {} };
        
        const today = new Date().toISOString().split('T')[0];
        if (!data.days[today]) data.days[today] = { date: today, tasks: [], summary: {} };
        
        const task = {
            id: `task-${Date.now()}`,
            time: new Date().toTimeString().slice(0, 5),
            category,
            title,
            description: userMessage.slice(0, 100),
            files: files.slice(0, 5),
            duration: 10, // Default estimate
            autoLogged: true
        };
        
        data.days[today].tasks.push(task);
        
        // Update summary
        const tasks = data.days[today].tasks;
        data.days[today].summary = {
            totalTasks: tasks.length,
            features: tasks.filter(t => t.category === 'feature').length,
            bugfixes: tasks.filter(t => t.category === 'bugfix').length,
            refactors: tasks.filter(t => t.category === 'refactor').length,
            docs: tasks.filter(t => t.category === 'docs').length,
            totalDuration: tasks.reduce((sum, t) => sum + (t.duration || 0), 0)
        };
        
        fs.writeFileSync(DEV_TRACKER_FILE, JSON.stringify(data, null, 2));
        console.log(`[DevTracker] Auto-logged task: ${title}`);
    } catch (err) {
        console.error('[DevTracker] Auto-log error:', err.message);
    }
}

app.get('/api/dev-tracker', (req, res) => {
    try {
        const data = fs.existsSync(DEV_TRACKER_FILE) 
            ? JSON.parse(fs.readFileSync(DEV_TRACKER_FILE, 'utf8'))
            : { version: '1.0.0', days: {} };
        res.json(data);
    } catch (err) {
        res.json({ error: err.message, days: {} });
    }
});

app.post('/api/dev-tracker/task', (req, res) => {
    try {
        const data = fs.existsSync(DEV_TRACKER_FILE)
            ? JSON.parse(fs.readFileSync(DEV_TRACKER_FILE, 'utf8'))
            : { version: '1.0.0', days: {} };
        
        const today = new Date().toISOString().split('T')[0];
        if (!data.days[today]) {
            data.days[today] = { date: today, tasks: [], summary: {} };
        }
        
        const task = {
            id: `task-${Date.now()}`,
            time: new Date().toTimeString().slice(0, 5),
            category: req.body.category || 'feature',
            title: req.body.title,
            description: req.body.description || '',
            files: req.body.files || [],
            tokens: req.body.tokens || 0,
            duration: req.body.duration || 0
        };
        
        data.days[today].tasks.push(task);
        
        // Update summary
        const tasks = data.days[today].tasks;
        data.days[today].summary = {
            totalTasks: tasks.length,
            features: tasks.filter(t => t.category === 'feature').length,
            bugfixes: tasks.filter(t => t.category === 'bugfix').length,
            refactors: tasks.filter(t => t.category === 'refactor').length,
            docs: tasks.filter(t => t.category === 'docs').length,
            totalDuration: tasks.reduce((sum, t) => sum + (t.duration || 0), 0),
            tokensUsed: tasks.reduce((sum, t) => sum + (t.tokens || 0), 0)
        };
        
        fs.writeFileSync(DEV_TRACKER_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dev-tracker/today', (req, res) => {
    try {
        const data = fs.existsSync(DEV_TRACKER_FILE)
            ? JSON.parse(fs.readFileSync(DEV_TRACKER_FILE, 'utf8'))
            : { days: {} };
        const today = new Date().toISOString().split('T')[0];
        res.json(data.days[today] || { date: today, tasks: [], summary: {} });
    } catch (err) {
        res.json({ error: err.message, tasks: [] });
    }
});

// ==================== KITT BUSY STATUS API ====================

// Get Kitt busy status (can be polled by other services)
app.get('/api/kitt/status', (req, res) => {
    res.json({
        busy: kittBusy,
        since: kittBusySince,
        task: kittCurrentTask,
        uptime: process.uptime()
    });
});

// Force reset busy state (if stuck)
app.post('/api/kitt/reset', (req, res) => {
    setKittBusy(false);
    res.json({ success: true, message: 'Kitt busy state reset' });
});

// Get task queue status
app.get('/api/kitt/queue', (req, res) => {
    res.json({
        busy: kittBusy,
        queueLength: taskQueue.length,
        tasks: taskQueue.map(t => ({
            id: t.id,
            preview: t.content?.substring(0, 50) || 'Task',
            queuedAt: t.queuedAt,
            status: t.status
        }))
    });
});

// Queue a task for Kitt (waits if busy)
app.post('/api/kitt/queue', (req, res) => {
    const { message, sessionId, priority } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // If not busy, can process immediately
    if (!kittBusy) {
        return res.json({
            queued: false,
            message: 'Kitt is available. Send via WebSocket for immediate processing.'
        });
    }

    // Queue the task
    const task = queueTask({
        content: message,
        sessionId: sessionId || `queue-${Date.now()}`,
        priority: priority || 'normal',
        source: 'api'
    });

    res.json({
        queued: true,
        taskId: task.id,
        position: taskQueue.length,
        message: `Task queued. Position: ${taskQueue.length}`
    });
});

// Clear the task queue
app.delete('/api/kitt/queue', (req, res) => {
    const cleared = taskQueue.length;
    taskQueue.length = 0;
    broadcastQueueUpdate();
    res.json({ success: true, cleared, message: `Cleared ${cleared} queued tasks` });
});

// ==================== GAMING DEVICES API ====================

// List gaming devices
app.get('/api/devices/gaming', (req, res) => {
    const ps = `Get-PnpDevice | Where-Object { $_.Class -match 'HID|XboxComposite|XInput|Media' -and $_.FriendlyName -match 'game|xbox|controller|joystick|hotas|throttle|pedal|yoke|rudder|flight' } | Select-Object Status, Class, FriendlyName, InstanceId | ConvertTo-Json`;
    
    exec(`powershell -Command "${ps}"`, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
            let devices = JSON.parse(stdout || '[]');
            if (!Array.isArray(devices)) devices = [devices];
            res.json({ devices });
        } catch (e) {
            res.json({ devices: [], raw: stdout });
        }
    });
});

// Disable all gaming devices
app.post('/api/devices/gaming/disable', (req, res) => {
    const ps = `
        $devices = Get-PnpDevice | Where-Object { $_.Class -match 'HID|XboxComposite|XInput|Media' -and $_.FriendlyName -match 'game|xbox|controller|joystick|hotas|throttle|pedal|yoke|rudder|flight' -and $_.Status -eq 'OK' }
        $count = 0
        foreach ($d in $devices) {
            Disable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
            $count++
        }
        Write-Output "Disabled $count devices"
    `;
    
    exec(`powershell -Command "${ps}"`, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: err.message, stderr });
        res.json({ success: true, message: stdout.trim() });
    });
});

// Enable all gaming devices
app.post('/api/devices/gaming/enable', (req, res) => {
    const ps = `
        $devices = Get-PnpDevice | Where-Object { $_.Class -match 'HID|XboxComposite|XInput|Media' -and $_.FriendlyName -match 'game|xbox|controller|joystick|hotas|throttle|pedal|yoke|rudder|flight' -and $_.Status -ne 'OK' }
        $count = 0
        foreach ($d in $devices) {
            Enable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
            $count++
        }
        Write-Output "Enabled $count devices"
    `;
    
    exec(`powershell -Command "${ps}"`, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: err.message, stderr });
        res.json({ success: true, message: stdout.trim() });
    });
});

// ==================== SERVICE MANAGER API ====================

// Get service manager mode and all service status
app.get('/api/services', async (req, res) => {
    try {
        const status = await serviceManager.statusAll();
        res.json({
            mode: serviceManager.getMode(),
            services: status,
            definitions: SERVICES
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get status for all services with mode override
app.get('/api/services/status', async (req, res) => {
    try {
        const mode = req.query.mode || serviceManager.getMode();
        const results = {};
        
        for (const name of Object.keys(SERVICES)) {
            const svc = SERVICES[name];
            
            if (mode === 'service') {
                // Check Windows Service status
                const svcStatus = await serviceManager.getServiceStatus(name);
                results[name] = svcStatus.status === 'running';
            } else {
                // Check if port is in use (dev mode)
                results[name] = await serviceManager.checkPort(svc.port);
            }
        }
        
        res.json({ mode, services: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single service status
app.get('/api/services/:name', async (req, res) => {
    try {
        const status = await serviceManager.status(req.params.name);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set service manager mode (dev/service)
app.post('/api/services/mode', (req, res) => {
    const { mode } = req.body;
    if (serviceManager.setMode(mode)) {
        res.json({ success: true, mode });
    } else {
        res.status(400).json({ error: 'Invalid mode. Use "dev" or "service"' });
    }
});

// Start a service
app.post('/api/services/:name/start', async (req, res) => {
    try {
        const result = await serviceManager.start(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stop a service
app.post('/api/services/:name/stop', async (req, res) => {
    try {
        const result = await serviceManager.stop(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restart a service
app.post('/api/services/:name/restart', async (req, res) => {
    try {
        const result = await serviceManager.restart(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Install Windows service (requires admin)
app.post('/api/services/:name/install', async (req, res) => {
    try {
        const result = await serviceManager.installService(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Uninstall Windows service (requires admin)
app.post('/api/services/:name/uninstall', async (req, res) => {
    try {
        const result = await serviceManager.uninstallService(req.params.name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Batch operations
app.post('/api/services/start-all', async (req, res) => {
    try {
        const result = await serviceManager.startAll();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/services/stop-all', async (req, res) => {
    try {
        const result = await serviceManager.stopAll();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Todos API (v2 - supports multiple lists)
app.get('/api/todos', (req, res) => {
    try {
        if (fs.existsSync(TODOS_FILE)) {
            const data = JSON.parse(fs.readFileSync(TODOS_FILE, 'utf8'));
            // Return new format with lists
            if (data.lists) {
                res.json({ lists: data.lists, currentList: data.currentList || 'General' });
            } else if (data.todos) {
                // Migrate old format
                res.json({ lists: { General: data.todos }, currentList: 'General' });
            } else {
                res.json({ lists: {}, currentList: 'General' });
            }
        } else {
            res.json({ lists: {}, currentList: 'General' });
        }
    } catch (err) {
        res.json({ lists: {}, currentList: 'General', error: err.message });
    }
});

app.post('/api/todos', (req, res) => {
    try {
        const data = {
            lists: req.body.lists || {},
            currentList: req.body.currentList || 'General'
        };
        fs.writeFileSync(TODOS_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chat history log
app.get('/api/logs/chat', (req, res) => {
    try {
        if (fs.existsSync(CHAT_LOG)) {
            const content = fs.readFileSync(CHAT_LOG, 'utf8');
            const lines = content.split('\n').filter(l => l).slice(-100);
            res.json({ log: lines.join('\n') });
        } else {
            res.json({ log: 'No chat history yet' });
        }
    } catch (err) {
        res.json({ log: 'Error: ' + err.message });
    }
});

// Kitt communications log - formatted for easy reading
app.get('/api/logs/kitt', (req, res) => {
    try {
        const entries = [];
        const seenMessages = new Set(); // Deduplicate
        
        // Read relay queue first (Claude Desktop messages)
        const relayQueueFile = path.join(__dirname, '..', 'relay', 'queue.json');
        if (fs.existsSync(relayQueueFile)) {
            try {
                const queue = JSON.parse(fs.readFileSync(relayQueueFile, 'utf8'));
                Object.values(queue).forEach(msg => {
                    const msgKey = msg.message.substring(0, 50) + msg.createdAt;
                    seenMessages.add(msgKey);
                    
                    entries.push({
                        time: new Date(msg.createdAt).toLocaleTimeString(),
                        date: new Date(msg.createdAt).toLocaleDateString(),
                        from: 'user-relay',
                        message: msg.message.substring(0, 300),
                        status: msg.status,
                        timestamp: msg.createdAt
                    });
                    if (msg.response) {
                        entries.push({
                            time: new Date(msg.respondedAt).toLocaleTimeString(),
                            date: new Date(msg.respondedAt).toLocaleDateString(),
                            from: 'claude-relay',
                            message: msg.response.substring(0, 300) + (msg.response.length > 300 ? '...' : ''),
                            timestamp: msg.respondedAt
                        });
                    }
                });
            } catch (e) {}
        }
        
        // Read chat history (direct API messages)
        if (fs.existsSync(CHAT_LOG)) {
            const content = fs.readFileSync(CHAT_LOG, 'utf8');
            const lines = content.split('\n').filter(l => l).slice(-50);
            lines.forEach(line => {
                try {
                    const entry = JSON.parse(line);
                    const msgKey = entry.content.substring(0, 50) + new Date(entry.timestamp).getTime();
                    
                    // Skip if we already have this from relay
                    if (seenMessages.has(msgKey)) return;
                    
                    entries.push({
                        time: new Date(entry.timestamp).toLocaleTimeString(),
                        date: new Date(entry.timestamp).toLocaleDateString(),
                        from: entry.role === 'user' ? 'user' : 'kitt',
                        message: entry.content.substring(0, 300) + (entry.content.length > 300 ? '...' : ''),
                        isError: entry.content.includes('Error:'),
                        timestamp: new Date(entry.timestamp).getTime()
                    });
                } catch (e) {}
            });
        }
        
        // Sort by timestamp (newest first)
        entries.sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ entries: entries.slice(0, 50) });
    } catch (err) {
        res.json({ entries: [], error: err.message });
    }
});

// Clear chat log
app.delete('/api/logs/chat', (req, res) => {
    try {
        if (fs.existsSync(CHAT_LOG)) {
            fs.writeFileSync(CHAT_LOG, '');
        }
        res.json({ success: true, message: 'Chat log cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Agent server log
app.get('/api/logs/agent', (req, res) => {
    try {
        if (fs.existsSync(AGENT_LOG)) {
            const content = fs.readFileSync(AGENT_LOG, 'utf8');
            const lines = content.split('\n').filter(l => l).slice(-200);
            res.json({ log: lines.join('\n') || 'No agent log yet' });
        } else {
            res.json({ log: agentLogBuffer.slice(-200).join('\n') || 'No agent log yet' });
        }
    } catch (err) {
        res.json({ log: 'Error: ' + err.message });
    }
});

app.delete('/api/logs/agent', (req, res) => {
    try {
        if (fs.existsSync(AGENT_LOG)) {
            fs.writeFileSync(AGENT_LOG, '');
        }
        agentLogBuffer.length = 0;
        res.json({ success: true, message: 'Agent log cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Error log
app.get('/api/logs/errors', (req, res) => {
    try {
        const errorLog = path.join(LOGS_DIR, 'agent-errors.log');
        if (fs.existsSync(errorLog)) {
            const content = fs.readFileSync(errorLog, 'utf8');
            res.json({ log: content || 'No errors' });
        } else {
            res.json({ log: 'No errors' });
        }
    } catch (err) {
        res.json({ log: 'Error: ' + err.message });
    }
});

// Clear error log
app.delete('/api/logs/errors', (req, res) => {
    try {
        const errorLog = path.join(LOGS_DIR, 'agent-errors.log');
        if (fs.existsSync(errorLog)) {
            fs.writeFileSync(errorLog, '');
        }
        res.json({ success: true, message: 'Error log cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// TODOs log
app.get('/api/logs/todos', (req, res) => {
    try {
        const todoLog = path.join(LOGS_DIR, 'todos.log');
        if (fs.existsSync(todoLog)) {
            const content = fs.readFileSync(todoLog, 'utf8');
            res.json({ log: content });
        } else {
            res.json({ log: 'No TODOs yet' });
        }
    } catch (err) {
        res.json({ log: 'Error: ' + err.message });
    }
});

// Usage log (raw)
app.get('/api/logs/usage', (req, res) => {
    try {
        if (fs.existsSync(USAGE_LOG)) {
            const content = fs.readFileSync(USAGE_LOG, 'utf8');
            const lines = content.split('\n').filter(l => l).slice(-50);
            const formatted = lines.map(l => {
                try {
                    const e = JSON.parse(l);
                    return `${e.timestamp.split('T')[0]} ${e.timestamp.split('T')[1].split('.')[0]} | In: ${e.inputTokens.toLocaleString()} Out: ${e.outputTokens.toLocaleString()} | $${parseFloat(e.cost).toFixed(4)}`;
                } catch { return l; }
            }).join('\n');
            res.json({ log: formatted || 'No usage data' });
        } else {
            res.json({ log: 'No usage data yet' });
        }
    } catch (err) {
        res.json({ log: 'Error: ' + err.message });
    }
});

// Clear usage log
app.delete('/api/logs/usage', (req, res) => {
    try {
        if (fs.existsSync(USAGE_LOG)) {
            fs.writeFileSync(USAGE_LOG, '');
        }
        res.json({ success: true, message: 'Usage log cleared' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Usage/Cost reporting
app.get('/api/usage', (req, res) => {
    try {
        if (!fs.existsSync(USAGE_LOG)) {
            return res.json({ 
                today: { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 },
                total: { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 },
                history: []
            });
        }
        
        const content = fs.readFileSync(USAGE_LOG, 'utf8');
        const lines = content.split('\n').filter(l => l);
        const entries = lines.map(l => JSON.parse(l));
        
        const today = new Date().toISOString().split('T')[0];
        
        let todayStats = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        let totalStats = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        let dailyTotals = {};
        
        for (const entry of entries) {
            const day = entry.timestamp.split('T')[0];
            
            totalStats.requests++;
            totalStats.inputTokens += entry.inputTokens;
            totalStats.outputTokens += entry.outputTokens;
            totalStats.cost += parseFloat(entry.cost);
            
            if (day === today) {
                todayStats.requests++;
                todayStats.inputTokens += entry.inputTokens;
                todayStats.outputTokens += entry.outputTokens;
                todayStats.cost += parseFloat(entry.cost);
            }
            
            if (!dailyTotals[day]) {
                dailyTotals[day] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
            }
            dailyTotals[day].requests++;
            dailyTotals[day].inputTokens += entry.inputTokens;
            dailyTotals[day].outputTokens += entry.outputTokens;
            dailyTotals[day].cost += parseFloat(entry.cost);
        }
        
        // Last 7 days history
        const history = Object.entries(dailyTotals)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 7)
            .map(([date, stats]) => ({ date, ...stats }));
        
        // Calculate projections
        const daysWithData = Object.keys(dailyTotals).length;
        const avgDailyCost = daysWithData > 0 ? totalStats.cost / daysWithData : 0;
        const projections = {
            daily: avgDailyCost,
            weekly: avgDailyCost * 7,
            monthly: avgDailyCost * 30,
            yearly: avgDailyCost * 365
        };
        
        // Monthly breakdown
        const monthlyTotals = {};
        for (const entry of entries) {
            const month = entry.timestamp.substring(0, 7); // YYYY-MM
            if (!monthlyTotals[month]) {
                monthlyTotals[month] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
            }
            monthlyTotals[month].requests++;
            monthlyTotals[month].inputTokens += entry.inputTokens;
            monthlyTotals[month].outputTokens += entry.outputTokens;
            monthlyTotals[month].cost += parseFloat(entry.cost);
        }
        
        const months = Object.entries(monthlyTotals)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, stats]) => ({ month, ...stats }));
        
        res.json({
            today: todayStats,
            total: totalStats,
            history,
            months,
            projections
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Token limits configuration
app.get('/api/token-limits', (req, res) => {
    res.json({
        limits: TOKEN_LIMITS,
        current: {
            dailyUsage: dailyTokenUsage,
            dailyRemaining: Math.max(0, TOKEN_LIMITS.dailyBudget - dailyTokenUsage.tokens),
            dailyPercentUsed: ((dailyTokenUsage.tokens / TOKEN_LIMITS.dailyBudget) * 100).toFixed(1)
        },
        pricing: PRICING
    });
});

// Update token limits (for tuning)
app.post('/api/token-limits', (req, res) => {
    const { maxHistoryMessages, maxTokensPerResponse, sessionBudget, dailyBudget } = req.body;
    
    if (maxHistoryMessages) TOKEN_LIMITS.maxHistoryMessages = parseInt(maxHistoryMessages);
    if (maxTokensPerResponse) TOKEN_LIMITS.maxTokensPerResponse = parseInt(maxTokensPerResponse);
    if (sessionBudget) TOKEN_LIMITS.sessionBudget = parseInt(sessionBudget);
    if (dailyBudget) TOKEN_LIMITS.dailyBudget = parseInt(dailyBudget);
    
    res.json({ success: true, limits: TOKEN_LIMITS });
});

// Reset daily budget (for emergencies)
app.post('/api/token-limits/reset-daily', (req, res) => {
    dailyTokenUsage = { date: new Date().toISOString().split('T')[0], tokens: 0 };
    res.json({ success: true, dailyUsage: dailyTokenUsage });
});

// Model configuration - Get current model
app.get('/api/model', (req, res) => {
    const currentOption = MODEL_CONFIG.options[MODEL_CONFIG.current];
    res.json({
        current: MODEL_CONFIG.current,
        name: currentOption?.name || 'Unknown',
        description: currentOption?.description || '',
        pricing: getPricing(),
        options: Object.entries(MODEL_CONFIG.options).map(([id, opt]) => ({
            id,
            name: opt.name,
            description: opt.description,
            pricing: opt.pricing,
            active: id === MODEL_CONFIG.current
        }))
    });
});

// Model configuration - Switch model
app.post('/api/model', (req, res) => {
    const { model } = req.body;

    if (!model || !MODEL_CONFIG.options[model]) {
        return res.status(400).json({
            error: 'Invalid model',
            available: Object.keys(MODEL_CONFIG.options)
        });
    }

    const oldModel = MODEL_CONFIG.current;
    MODEL_CONFIG.current = model;
    const newOption = MODEL_CONFIG.options[model];

    console.log(`[Agent] Model switched: ${oldModel} -> ${model} (${newOption.name})`);

    // Broadcast model change to all WebSocket clients
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({
                type: 'model_changed',
                model: MODEL_CONFIG.current,
                name: newOption.name,
                description: newOption.description
            }));
        }
    });

    res.json({
        success: true,
        model: MODEL_CONFIG.current,
        name: newOption.name,
        description: newOption.description,
        pricing: getPricing()
    });
});

// Relay mode configuration
app.get('/api/relay', (req, res) => {
    res.json({
        enabled: RELAY_CONFIG.enabled,
        url: RELAY_CONFIG.url,
        pollInterval: RELAY_CONFIG.pollInterval,
        timeout: RELAY_CONFIG.timeout
    });
});

app.post('/api/relay', (req, res) => {
    const { enabled, url } = req.body;
    if (typeof enabled === 'boolean') RELAY_CONFIG.enabled = enabled;
    if (url) RELAY_CONFIG.url = url;
    
    console.log(`[Agent] Relay mode: ${RELAY_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, relay: RELAY_CONFIG });
});

// Check relay service health
app.get('/api/relay/health', async (req, res) => {
    const http = require('http');
    
    try {
        const result = await new Promise((resolve, reject) => {
            const request = http.get(`${RELAY_CONFIG.url}/api/health`, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            request.on('error', reject);
            request.setTimeout(3000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
        
        res.json({ 
            relayOnline: true, 
            relayStatus: result,
            agentRelayEnabled: RELAY_CONFIG.enabled
        });
    } catch (err) {
        res.json({ 
            relayOnline: false, 
            error: err.message,
            agentRelayEnabled: RELAY_CONFIG.enabled
        });
    }
});

// ============================================
// WEBSOCKET
// ============================================

// Helper function to process chat messages (used by direct and queued processing)
async function processChatMessage(sessionId, content, ws) {
    logChat(sessionId, 'user', content);
    setKittBusy(true, content.substring(0, 50));
    ws.send(JSON.stringify({ type: 'thinking' }));

    try {
        // Priority: Bridge > Relay (NO direct API - not cost effective)
        let response;
        if (BRIDGE_CONFIG.enabled) {
            // Route through Claude Code CLI (Pro subscription)
            response = await chatViaBridge(sessionId, content, (status) => {
                ws.send(JSON.stringify({ type: 'status', content: status }));
            });
        } else if (RELAY_CONFIG.enabled) {
            // Route through Claude Desktop
            response = await chatViaRelay(sessionId, content, (status) => {
                ws.send(JSON.stringify({ type: 'status', content: status }));
            });
        } else {
            // No cost-effective method available
            throw new Error('No relay available. Start Relay Service (port 8600) or enable Bridge mode.');
        }
        logChat(sessionId, 'assistant', response);
        autoLogTask(content, response); // Auto-log completed tasks
        ws.send(JSON.stringify({ type: 'response', content: response }));
    } finally {
        setKittBusy(false);
    }
}

wss.on('connection', (ws) => {
    const sessionId = Date.now().toString();
    console.log(`[Agent] Client connected: ${sessionId}`);
    
    // Server-side ping to keep connection alive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    
    // Send current busy state on connect (sync UI)
    ws.send(JSON.stringify({
        type: 'busy_state',
        busy: kittBusy,
        since: kittBusySince,
        task: kittCurrentTask
    }));

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            
            // Handle ping/pong for keep-alive
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }
            
            if (msg.type === 'chat') {
                // Check if Kitt is busy - queue task if so
                if (kittBusy && !msg.force) {
                    const task = queueTask({
                        content: msg.content,
                        sessionId: sessionId,
                        ws: ws,
                        execute: async () => {
                            // This executes when Kitt becomes available
                            await processChatMessage(sessionId, msg.content, ws);
                        }
                    });
                    ws.send(JSON.stringify({
                        type: 'queued',
                        taskId: task.id,
                        position: taskQueue.length,
                        message: `Task queued (position ${taskQueue.length}). Will process when Kitt is available.`
                    }));
                    return;
                }

                await processChatMessage(sessionId, msg.content, ws);
            } else if (msg.type === 'todo') {
                // Log TODOs separately
                const todoEntry = {
                    timestamp: new Date().toISOString(),
                    priority: msg.priority,
                    content: msg.content
                };
                fs.appendFileSync(path.join(LOGS_DIR, 'todos.log'), JSON.stringify(todoEntry) + '\n');
                console.log(`[TODO] ${msg.priority}: ${msg.content}`);
            }
        } catch (e) {
            console.error('[Agent] Error:', e.message);
            setKittBusy(false);
            ws.send(JSON.stringify({ type: 'error', content: e.message }));
        }
    });

    ws.on('close', () => {
        console.log(`[Agent] Client disconnected: ${sessionId}`);
        sessions.delete(sessionId);
    });
});

// ============================================
// START SERVER
// ============================================

// Prevent crashes from uncaught errors
process.on('uncaughtException', (err) => {
    console.error('[Agent] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Agent] Unhandled Rejection:', reason);
});

// Start server with TroubleshootEngine
const troubleshoot = new TroubleshootEngine('Agent');

troubleshoot.startServer(server, PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║     SimWidget Agent v1.2.0                ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}            ║`);
    console.log(`║  Network: http://192.168.1.42:${PORT}         ║`);
    console.log('║                                           ║');
    console.log('║  Access from phone to chat with Kitt!     ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');
    
    // Start Hot Update Engine
    const hot = new HotEngine(server, [
        path.join(__dirname, 'agent-ui'),
        path.join(__dirname, 'hot-update')
    ]);
    hot.start();
});
