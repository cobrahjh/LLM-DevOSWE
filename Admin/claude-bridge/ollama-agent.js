/**
 * Ollama Agent v1.0.0
 *
 * Autonomous agent using local Ollama LLM for task execution.
 * Handles file/resource deadlocks with timeouts and locks.
 *
 * Features:
 * - Command execution with timeout
 * - File read/write with locks
 * - Multi-step task processing
 * - Deadlock prevention
 * - Resource cleanup
 *
 * Path: C:\DevOSWE\Admin\claude-bridge\ollama-agent.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    ollamaModel: 'kitt',  // Custom model with project context
    maxIterations: 10,          // Prevent infinite loops
    commandTimeout: 30000,      // 30s max per command
    fileTimeout: 5000,          // 5s max for file operations
    lockTimeout: 10000,         // 10s max wait for locks
    thinkingTimeout: 60000,     // 60s max for LLM response
    workDir: 'C:\\DevOSWE',
    logFile: path.join(__dirname, 'ollama-agent.log')
};

// ============================================
// RESOURCE LOCKS (Deadlock Prevention)
// ============================================

const locks = new Map();  // path -> { holder, timestamp, timeout }
const pendingLocks = new Map();  // path -> [{ resolve, reject, timeout }]

function acquireLock(resource, timeout = CONFIG.lockTimeout) {
    return new Promise((resolve, reject) => {
        const now = Date.now();

        // Check if lock exists
        if (locks.has(resource)) {
            const lock = locks.get(resource);

            // Check if lock is stale (holder crashed)
            if (now - lock.timestamp > lock.timeout) {
                log(`[Lock] Releasing stale lock on ${resource}`);
                locks.delete(resource);
            } else {
                // Queue this request
                log(`[Lock] Waiting for lock on ${resource}`);
                const pending = pendingLocks.get(resource) || [];

                const timeoutId = setTimeout(() => {
                    // Remove from pending queue
                    const idx = pending.findIndex(p => p.timeoutId === timeoutId);
                    if (idx >= 0) pending.splice(idx, 1);
                    reject(new Error(`Lock timeout on ${resource}`));
                }, timeout);

                pending.push({ resolve, reject, timeoutId });
                pendingLocks.set(resource, pending);
                return;
            }
        }

        // Acquire lock
        locks.set(resource, {
            holder: process.pid,
            timestamp: now,
            timeout: timeout
        });
        log(`[Lock] Acquired lock on ${resource}`);
        resolve(true);
    });
}

function releaseLock(resource) {
    if (!locks.has(resource)) return;

    locks.delete(resource);
    log(`[Lock] Released lock on ${resource}`);

    // Grant to next in queue
    const pending = pendingLocks.get(resource);
    if (pending && pending.length > 0) {
        const next = pending.shift();
        clearTimeout(next.timeoutId);

        locks.set(resource, {
            holder: process.pid,
            timestamp: Date.now(),
            timeout: CONFIG.lockTimeout
        });

        next.resolve(true);
    }
}

function releaseAllLocks() {
    log(`[Lock] Releasing all locks (cleanup)`);
    for (const resource of locks.keys()) {
        releaseLock(resource);
    }
}

// ============================================
// LOGGING
// ============================================

function log(msg) {
    const ts = new Date().toISOString().substr(11, 12);
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(CONFIG.logFile, line + '\n');
    } catch (e) { /* ignore */ }
}

// ============================================
// SAFE COMMAND EXECUTION
// ============================================

const BLOCKED_COMMANDS = [
    'rm -rf /', 'del /f /s /q c:\\',
    'format', 'mkfs',
    'shutdown', 'reboot',
    ':(){:|:&};:'  // Fork bomb
];

function isCommandSafe(cmd) {
    const lower = cmd.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
        if (lower.includes(blocked)) {
            return false;
        }
    }
    return true;
}

async function executeCommand(cmd, timeout = CONFIG.commandTimeout) {
    if (!isCommandSafe(cmd)) {
        return { success: false, output: 'Command blocked for safety', code: -1 };
    }

    const resource = `cmd:${cmd.substring(0, 50)}`;

    try {
        await acquireLock(resource, timeout);

        log(`[Exec] Running: ${cmd.substring(0, 100)}`);

        const output = execSync(cmd, {
            encoding: 'utf8',
            timeout: timeout,
            cwd: CONFIG.workDir,
            windowsHide: true,
            maxBuffer: 1024 * 1024  // 1MB max output
        });

        releaseLock(resource);
        return { success: true, output: output.trim(), code: 0 };

    } catch (err) {
        releaseLock(resource);
        return {
            success: false,
            output: err.stderr || err.message,
            code: err.status || -1
        };
    }
}

// ============================================
// SAFE FILE OPERATIONS
// ============================================

async function readFile(filePath, timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, filePath);

    try {
        await acquireLock(absPath, timeout);

        log(`[File] Reading: ${absPath}`);
        const content = fs.readFileSync(absPath, 'utf8');

        releaseLock(absPath);
        return { success: true, content };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

async function writeFile(filePath, content, timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, filePath);

    try {
        await acquireLock(absPath, timeout);

        log(`[File] Writing: ${absPath}`);

        // Create backup first
        if (fs.existsSync(absPath)) {
            const backup = absPath + '.bak';
            fs.copyFileSync(absPath, backup);
        }

        fs.writeFileSync(absPath, content, 'utf8');

        releaseLock(absPath);
        return { success: true };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

async function listFiles(dirPath, timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, dirPath || '.');

    try {
        await acquireLock(absPath, timeout);

        const files = fs.readdirSync(absPath);

        releaseLock(absPath);
        return { success: true, files };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

// ============================================
// OLLAMA INTERACTION
// ============================================

function callOllama(prompt) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Ollama timeout'));
        }, CONFIG.thinkingTimeout);

        // Use HTTP API instead of CLI (avoids command line length limits)
        const body = JSON.stringify({
            model: CONFIG.ollamaModel,
            prompt: prompt,
            stream: false
        });

        const req = http.request({
            hostname: 'localhost',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeout);
                try {
                    const json = JSON.parse(data);
                    resolve(json.response || '');
                } catch (e) {
                    reject(new Error('Failed to parse Ollama response'));
                }
            });
        });

        req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ============================================
// ACTION PARSER
// ============================================

function parseAction(response) {
    // Look for structured actions in the response
    const actions = [];

    // Pattern: [ACTION: type] content [/ACTION]
    const actionRegex = /\[ACTION:\s*(\w+)\]([\s\S]*?)\[\/ACTION\]/gi;
    let match;

    while ((match = actionRegex.exec(response)) !== null) {
        actions.push({
            type: match[1].toLowerCase(),
            content: match[2].trim()
        });
    }

    // Also check for code blocks with bash/cmd
    const codeRegex = /```(?:bash|cmd|shell|powershell)?\n([\s\S]*?)```/gi;
    while ((match = codeRegex.exec(response)) !== null) {
        const cmd = match[1].trim();
        if (cmd && !actions.some(a => a.content === cmd)) {
            actions.push({
                type: 'command',
                content: cmd
            });
        }
    }

    // Check for DONE indicator
    if (response.toLowerCase().includes('[done]') ||
        response.toLowerCase().includes('task complete') ||
        response.toLowerCase().includes('task completed')) {
        actions.push({ type: 'done', content: '' });
    }

    return actions;
}

// ============================================
// AGENT LOOP
// ============================================

async function runAgent(task) {
    log('='.repeat(50));
    log(`[Agent] Starting task: ${task.substring(0, 100)}`);
    log('='.repeat(50));

    const history = [];
    let iteration = 0;
    let finalResult = null;

    const systemPrompt = `You are an AI agent that can execute tasks. You have these tools:

[ACTION: command]shell command here[/ACTION] - Run a shell command
[ACTION: read]file/path.txt[/ACTION] - Read a file
[ACTION: write]file/path.txt
content here
[/ACTION] - Write to a file
[ACTION: list]directory/path[/ACTION] - List files in directory

When the task is complete, say [DONE] with a summary.

Rules:
- One action at a time
- Wait for results before next action
- Handle errors gracefully
- Maximum ${CONFIG.maxIterations} steps allowed

Current directory: ${CONFIG.workDir}
`;

    try {
        while (iteration < CONFIG.maxIterations) {
            iteration++;
            log(`[Agent] Iteration ${iteration}/${CONFIG.maxIterations}`);

            // Build prompt with history
            let prompt = systemPrompt + '\n\nTask: ' + task + '\n\n';

            if (history.length > 0) {
                prompt += 'Previous actions and results:\n';
                for (const h of history.slice(-5)) {  // Last 5 actions
                    prompt += `Action: ${h.action}\nResult: ${h.result}\n\n`;
                }
            }

            prompt += 'What is the next action? (or [DONE] if complete)';

            // Get LLM response
            log('[Agent] Thinking...');
            const response = await callOllama(prompt);
            log(`[Agent] Response: ${response.substring(0, 200)}...`);

            // Parse actions
            const actions = parseAction(response);

            if (actions.length === 0) {
                // No structured action, treat as final response
                log('[Agent] No action found, treating as response');
                finalResult = response;
                break;
            }

            // Execute first action
            const action = actions[0];
            log(`[Agent] Executing: ${action.type}`);

            let result;

            switch (action.type) {
                case 'done':
                    finalResult = response;
                    log('[Agent] Task marked complete');
                    break;

                case 'command':
                    result = await executeCommand(action.content);
                    history.push({
                        action: `command: ${action.content}`,
                        result: result.success ? result.output : `Error: ${result.output}`
                    });
                    break;

                case 'read':
                    result = await readFile(action.content);
                    history.push({
                        action: `read: ${action.content}`,
                        result: result.success ? result.content.substring(0, 500) : `Error: ${result.error}`
                    });
                    break;

                case 'write':
                    const lines = action.content.split('\n');
                    const filePath = lines[0];
                    const content = lines.slice(1).join('\n');
                    result = await writeFile(filePath, content);
                    history.push({
                        action: `write: ${filePath}`,
                        result: result.success ? 'File written successfully' : `Error: ${result.error}`
                    });
                    break;

                case 'list':
                    result = await listFiles(action.content);
                    const fileList = result.success ? result.files : [];
                    const fileCount = fileList.length;
                    const truncatedList = fileList.slice(0, 20).join(', ') + (fileCount > 20 ? `... (${fileCount} total)` : '');
                    history.push({
                        action: `list: ${action.content}`,
                        result: result.success ? `${fileCount} files: ${truncatedList}` : `Error: ${result.error}`
                    });
                    break;

                default:
                    history.push({
                        action: `unknown: ${action.type}`,
                        result: 'Unknown action type'
                    });
            }

            if (action.type === 'done') break;
        }

        if (iteration >= CONFIG.maxIterations) {
            log('[Agent] Max iterations reached');
            finalResult = 'Task incomplete: maximum iterations reached';
        }

    } catch (err) {
        log(`[Agent] Error: ${err.message}`);
        finalResult = `Error: ${err.message}`;
    } finally {
        // Cleanup
        releaseAllLocks();
    }

    log('='.repeat(50));
    log(`[Agent] Finished in ${iteration} iterations`);
    log('='.repeat(50));

    return {
        success: true,
        result: finalResult,
        iterations: iteration,
        history: history
    };
}

// ============================================
// EXPRESS SERVER (optional)
// ============================================

function startServer(port = 8620) {
    const express = require('express');
    const app = express();

    app.use(express.json());

    app.post('/api/task', async (req, res) => {
        const { task } = req.body;
        if (!task) {
            return res.status(400).json({ error: 'Task required' });
        }

        try {
            const result = await runAgent(task);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/status', (req, res) => {
        res.json({
            service: 'Ollama Agent',
            model: CONFIG.ollamaModel,
            locks: locks.size,
            workDir: CONFIG.workDir
        });
    });

    app.listen(port, () => {
        log(`Ollama Agent server running on port ${port}`);
    });
}

// ============================================
// CLI
// ============================================

async function main() {
    const args = process.argv.slice(2);

    if (args[0] === 'server') {
        startServer(args[1] || 8620);
        return;
    }

    if (args[0] === 'task') {
        const task = args.slice(1).join(' ');
        if (!task) {
            console.log('Usage: node ollama-agent.js task "your task here"');
            return;
        }

        const result = await runAgent(task);
        console.log('\n=== RESULT ===');
        console.log(result.result);
        console.log(`\nCompleted in ${result.iterations} iterations`);
        return;
    }

    console.log('Ollama Agent v1.0.0');
    console.log('');
    console.log('Usage:');
    console.log('  node ollama-agent.js task "describe what you want done"');
    console.log('  node ollama-agent.js server [port]');
    console.log('');
    console.log('Examples:');
    console.log('  node ollama-agent.js task "list all JS files in the server folder"');
    console.log('  node ollama-agent.js task "create a hello world script"');
    console.log('  node ollama-agent.js server 8620');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    log('[Agent] Shutting down...');
    releaseAllLocks();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    log(`[Agent] Uncaught exception: ${err.message}`);
    releaseAllLocks();
    process.exit(1);
});

main().catch(console.error);

module.exports = { runAgent, executeCommand, readFile, writeFile };
