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
    maxIterations: 15,          // Allow more complex tasks
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

async function readFile(filePath, options = {}, timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, filePath);

    try {
        await acquireLock(absPath, timeout);

        log(`[File] Reading: ${absPath}`);
        const content = fs.readFileSync(absPath, 'utf8');
        const lines = content.split('\n');

        // Support line range: startLine-endLine or just startLine
        let startLine = options.startLine || 1;
        let endLine = options.endLine || lines.length;

        // Clamp to valid range
        startLine = Math.max(1, Math.min(startLine, lines.length));
        endLine = Math.max(startLine, Math.min(endLine, lines.length));

        // Add line numbers
        const numberedLines = lines
            .slice(startLine - 1, endLine)
            .map((line, i) => `${startLine + i}: ${line}`)
            .join('\n');

        releaseLock(absPath);
        return {
            success: true,
            content: numberedLines,
            totalLines: lines.length,
            range: `${startLine}-${endLine}`
        };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

// Edit file - find and replace
async function editFile(filePath, oldText, newText, timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, filePath);

    try {
        await acquireLock(absPath, timeout);

        log(`[File] Editing: ${absPath}`);
        let content = fs.readFileSync(absPath, 'utf8');

        if (!content.includes(oldText)) {
            releaseLock(absPath);
            return { success: false, error: 'Old text not found in file' };
        }

        // Create backup
        fs.copyFileSync(absPath, absPath + '.bak');

        // Replace
        content = content.replace(oldText, newText);
        fs.writeFileSync(absPath, content, 'utf8');

        releaseLock(absPath);
        return { success: true, message: 'Edit applied successfully' };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

// Search files for pattern (grep-like)
async function searchFiles(pattern, searchPath = '.', timeout = CONFIG.fileTimeout) {
    const absPath = path.resolve(CONFIG.workDir, searchPath);

    try {
        await acquireLock(absPath, timeout);

        log(`[Search] Looking for "${pattern}" in ${absPath}`);
        const results = [];

        function searchDir(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                // Skip node_modules, .git, etc.
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

                if (entry.isDirectory()) {
                    searchDir(fullPath);
                } else if (entry.isFile() && /\.(js|html|css|json|md|txt)$/i.test(entry.name)) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const lines = content.split('\n');
                        lines.forEach((line, i) => {
                            if (line.includes(pattern)) {
                                results.push({
                                    file: fullPath.replace(CONFIG.workDir, '').replace(/\\/g, '/'),
                                    line: i + 1,
                                    text: line.trim().substring(0, 100)
                                });
                            }
                        });
                    } catch (e) { /* skip unreadable files */ }
                }
            }
        }

        searchDir(absPath);
        releaseLock(absPath);

        return {
            success: true,
            matches: results.slice(0, 20),  // Limit results
            totalMatches: results.length
        };

    } catch (err) {
        releaseLock(absPath);
        return { success: false, error: err.message };
    }
}

// HTTP request
async function httpRequest(method, url, body = null) {
    return new Promise((resolve) => {
        log(`[HTTP] ${method} ${url}`);

        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    success: true,
                    status: res.statusCode,
                    body: data.substring(0, 2000)  // Limit response size
                });
            });
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
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

    const systemPrompt = `You are Kitt, an AI agent for the SimWidget project. You can execute tasks using these tools:

TOOLS:
[ACTION: command]shell command[/ACTION] - Run shell/powershell command
[ACTION: read]path/file.js[/ACTION] - Read entire file with line numbers
[ACTION: read]path/file.js:100-150[/ACTION] - Read lines 100-150 of file
[ACTION: search]pattern[/ACTION] - Search all files for pattern
[ACTION: search]pattern|path[/ACTION] - Search in specific path
[ACTION: edit]path/file.js
old text to find
---
new text to replace with
[/ACTION] - Find and replace text in file
[ACTION: write]path/file.js
file content
[/ACTION] - Write/create file
[ACTION: list]directory[/ACTION] - List files in directory
[ACTION: http]GET http://192.168.1.42:8600/api/status[/ACTION] - HTTP request
[ACTION: http]POST http://192.168.1.42:8600/api/queue
{"message": "hello"}
[/ACTION] - HTTP POST with JSON body

IMPORTANT RULES:
- ALWAYS use [ACTION: type]content[/ACTION] format - brackets are required!
- One action per response, wait for results
- Use IP 192.168.1.42 never localhost or 127.0.0.1
- Maximum ${CONFIG.maxIterations} iterations allowed
- Say [DONE] with summary when task is complete

PROJECT INFO:
- Directory: ${CONFIG.workDir}
- Stack: Node.js, Electron, WebSocket
- Ports: Main=8080, Agent=8585, Relay=8600, Router=8610
- Sandbox files: Admin/agent/agent-ui/ollama-sandbox.html, styles/ollama-sandbox.css
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
                    // Parse line range if provided: filepath:startLine-endLine
                    let readPath = action.content;
                    let readOpts = {};
                    const rangeMatch = action.content.match(/^(.+?):(\d+)(?:-(\d+))?$/);
                    if (rangeMatch) {
                        readPath = rangeMatch[1];
                        readOpts.startLine = parseInt(rangeMatch[2]);
                        readOpts.endLine = rangeMatch[3] ? parseInt(rangeMatch[3]) : readOpts.startLine + 50;
                    }
                    result = await readFile(readPath, readOpts);
                    history.push({
                        action: `read: ${action.content}`,
                        result: result.success
                            ? `[Lines ${result.range} of ${result.totalLines}]\n${result.content.substring(0, 1500)}`
                            : `Error: ${result.error}`
                    });
                    break;

                case 'write':
                    const writeLines = action.content.split('\n');
                    const writePath = writeLines[0];
                    const writeContent = writeLines.slice(1).join('\n');
                    result = await writeFile(writePath, writeContent);
                    history.push({
                        action: `write: ${writePath}`,
                        result: result.success ? 'File written successfully' : `Error: ${result.error}`
                    });
                    break;

                case 'edit':
                    // Format: filepath\nOLD_TEXT\n---\nNEW_TEXT
                    const editParts = action.content.split('\n---\n');
                    if (editParts.length !== 2) {
                        history.push({
                            action: `edit: invalid format`,
                            result: 'Error: Edit format must be: filepath\\nold_text\\n---\\nnew_text'
                        });
                        break;
                    }
                    const editLines = editParts[0].split('\n');
                    const editPath = editLines[0];
                    const oldText = editLines.slice(1).join('\n');
                    const newText = editParts[1];
                    result = await editFile(editPath, oldText, newText);
                    history.push({
                        action: `edit: ${editPath}`,
                        result: result.success ? result.message : `Error: ${result.error}`
                    });
                    break;

                case 'search':
                    // Format: pattern or pattern|path
                    const searchParts = action.content.split('|');
                    const searchPattern = searchParts[0];
                    const searchPath = searchParts[1] || '.';
                    result = await searchFiles(searchPattern, searchPath);
                    if (result.success) {
                        const matchSummary = result.matches
                            .map(m => `${m.file}:${m.line}: ${m.text}`)
                            .join('\n');
                        history.push({
                            action: `search: ${searchPattern}`,
                            result: `Found ${result.totalMatches} matches:\n${matchSummary}`
                        });
                    } else {
                        history.push({
                            action: `search: ${searchPattern}`,
                            result: `Error: ${result.error}`
                        });
                    }
                    break;

                case 'http':
                    // Format: METHOD url or METHOD url\n{json_body}
                    const httpLines = action.content.split('\n');
                    const httpFirst = httpLines[0].split(' ');
                    const httpMethod = httpFirst[0].toUpperCase();
                    const httpUrl = httpFirst.slice(1).join(' ');
                    const httpBody = httpLines.length > 1 ? JSON.parse(httpLines.slice(1).join('\n')) : null;
                    result = await httpRequest(httpMethod, httpUrl, httpBody);
                    history.push({
                        action: `http: ${httpMethod} ${httpUrl}`,
                        result: result.success
                            ? `Status ${result.status}: ${result.body.substring(0, 500)}`
                            : `Error: ${result.error}`
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
