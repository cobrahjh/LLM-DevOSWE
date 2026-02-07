/**
 * Terminal Hub Server
 * Web-based terminal manager for the Hive
 *
 * Features:
 * - List all running terminal sessions
 * - Create new terminals
 * - Send input to terminals
 * - Real-time output via WebSocket
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');

const PORT = 8771;

// Default command timeout (30 seconds)
const DEFAULT_TIMEOUT = 30000;

// Track running commands per terminal
const runningCommands = new Map(); // termId -> { command, startTime, timeoutId }

// Get running processes (filtered for interesting ones)
async function getRunningProcesses() {
    return new Promise((resolve, reject) => {
        // PowerShell command to get processes with more details
        const cmd = `powershell -Command "Get-Process | Where-Object { $_.ProcessName -match 'node|cmd|powershell|bash|python|code|npm|git|OpenConsole|WindowsTerminal|conhost' } | Select-Object Id, ProcessName, CPU, WorkingSet64, MainWindowTitle | ConvertTo-Json"`;

        exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                let processes = JSON.parse(stdout || '[]');
                // Ensure it's an array
                if (!Array.isArray(processes)) processes = [processes];

                // Format the output
                const formatted = processes.map(p => ({
                    pid: p.Id,
                    name: p.ProcessName,
                    cpu: p.CPU ? p.CPU.toFixed(1) : '0.0',
                    memory: p.WorkingSet64 ? Math.round(p.WorkingSet64 / 1024 / 1024) : 0,
                    title: p.MainWindowTitle || ''
                })).filter(p => p.pid); // Filter out any null entries

                resolve(formatted);
            } catch (e) {
                resolve([]);
            }
        });
    });
}
const terminals = new Map(); // id -> { process, clients, buffer }
let terminalCounter = 0;

// Create HTTP server
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log(`[REQ] ${req.method} ${url.pathname}`);

    if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(path.join(__dirname, 'terminal-hub.html')));
    } else if (url.pathname === '/mobile-engine.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        const mePath = path.join(__dirname, '..', 'agent', 'agent-ui', 'modules', 'mobile-engine.js');
        if (fs.existsSync(mePath)) {
            res.end(fs.readFileSync(mePath));
        } else {
            res.end('// mobile-engine.js not found');
        }
    } else if (url.pathname === '/api/terminals' && req.method === 'GET') {
        // List all terminals
        const list = [];
        terminals.forEach((term, id) => {
            const cmdInfo = runningCommands.get(id);
            list.push({
                id,
                title: term.title || `Terminal ${id}`,
                cwd: term.cwd,
                running: term.isWT ? true : (term.process ? !term.process.killed : false),
                clients: term.clients.size,
                bufferSize: term.buffer.length,
                isWT: term.isWT || false,
                isMonitor: term.isMonitor || false,
                runningCommand: cmdInfo ? {
                    command: cmdInfo.command,
                    elapsed: Date.now() - cmdInfo.startTime
                } : null
            });
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ terminals: list, runningCount: runningCommands.size }));
    } else if (url.pathname === '/api/terminals' && req.method === 'POST') {
        // Create new terminal
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const opts = body ? JSON.parse(body) : {};
                const id = createTerminal(opts);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id, message: 'Terminal created' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (url.pathname.match(/^\/api\/terminals\/\d+$/) && req.method === 'DELETE') {
        // Kill terminal
        const id = parseInt(url.pathname.split('/').pop());
        if (terminals.has(id)) {
            const term = terminals.get(id);
            if (term.process) {
                try { term.process.kill(); } catch (e) { /* already dead */ }
            }
            terminals.delete(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Terminal killed' }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Terminal not found' }));
        }
    } else if (url.pathname.match(/^\/api\/terminals\/\d+\/buffer$/) && req.method === 'GET') {
        // Get terminal buffer content
        const id = parseInt(url.pathname.split('/')[3]);
        if (terminals.has(id)) {
            const term = terminals.get(id);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(term.buffer);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Terminal not found' }));
        }
    } else if (url.pathname.match(/^\/api\/terminals\/\d+\/interrupt$/) && req.method === 'POST') {
        // Send Ctrl+C to interrupt running command
        const id = parseInt(url.pathname.split('/')[3]);
        if (terminals.has(id)) {
            const term = terminals.get(id);
            const result = interruptTerminal(id, term);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Terminal not found' }));
        }
    } else if (url.pathname.match(/^\/api\/terminals\/\d+\/exec$/) && req.method === 'POST') {
        // Execute command with timeout
        const id = parseInt(url.pathname.split('/')[3]);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            if (!terminals.has(id)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Terminal not found' }));
                return;
            }
            try {
                const { command, timeout = DEFAULT_TIMEOUT } = JSON.parse(body);
                const result = await executeWithTimeout(id, command, timeout);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (url.pathname.match(/^\/api\/terminals\/\d+\/cancel$/) && req.method === 'POST') {
        // Cancel running command
        const id = parseInt(url.pathname.split('/')[3]);
        if (terminals.has(id)) {
            const result = cancelCommand(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Terminal not found' }));
        }
    } else if (url.pathname === '/api/terminals/cancel-all' && req.method === 'POST') {
        // Cancel all running commands
        const cancelled = [];
        for (const id of runningCommands.keys()) {
            cancelCommand(id);
            cancelled.push(id);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, cancelled, count: cancelled.length }));
    } else if (url.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Terminal Hub',
            terminals: terminals.size
        }));
    } else if (url.pathname === '/api/processes' && req.method === 'GET') {
        // List running processes
        getRunningProcesses().then(processes => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(processes));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
    } else if (url.pathname === '/api/processes/attach' && req.method === 'POST') {
        // Create a monitoring terminal for a process
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { pid, name } = JSON.parse(body);
                // Create a PowerShell terminal that monitors the process
                const id = createMonitorTerminal(pid, name);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id, message: `Monitoring ${name} (PID: ${pid})` }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (url.pathname === '/api/processes/kill' && req.method === 'POST') {
        // Kill a process
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { pid } = JSON.parse(body);
                process.kill(pid, 'SIGTERM');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: `Killed process ${pid}` }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (url.pathname === '/api/terminals/wt' && req.method === 'POST') {
        // Launch terminal in Windows Terminal with bridge back to Terminal Hub
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const opts = body ? JSON.parse(body) : {};
                const result = createWTTerminal(opts);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (url.pathname === '/api/wt/windows' && req.method === 'GET') {
        // List Windows Terminal windows
        getWTWindows().then(windows => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(windows));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
    } else if (url.pathname === '/api/terminals/bridge' && req.method === 'POST') {
        // Receive bridged output from Windows Terminal
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { id, output } = JSON.parse(body);
                if (terminals.has(id)) {
                    const term = terminals.get(id);
                    term.buffer += output;
                    if (term.buffer.length > 100000) {
                        term.buffer = term.buffer.slice(-50000);
                    }
                    // Broadcast to WebSocket clients
                    const msg = JSON.stringify({ type: 'output', data: output });
                    term.clients.forEach(ws => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(msg);
                        }
                    });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const termId = parseInt(url.searchParams.get('id'));

    if (!termId || !terminals.has(termId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid terminal ID' }));
        ws.close();
        return;
    }

    const term = terminals.get(termId);
    term.clients.add(ws);

    // Send buffer (recent output)
    if (term.buffer.length > 0) {
        ws.send(JSON.stringify({ type: 'output', data: term.buffer }));
    }

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'input' && data.data) {
                if (term.process && term.process.stdin && !term.process.killed) {
                    term.process.stdin.write(data.data);
                } else {
                    ws.send(JSON.stringify({ type: 'output', data: '[Terminal has no input stream]\r\n' }));
                }
            } else if (data.type === 'interrupt') {
                // Send Ctrl+C
                interruptTerminal(termId, term);
            } else if (data.type === 'cancel') {
                // Cancel running command
                cancelCommand(termId);
            } else if (data.type === 'exec') {
                // Execute command with timeout
                const timeout = data.timeout || DEFAULT_TIMEOUT;
                executeWithTimeout(termId, data.command, timeout)
                    .then(result => {
                        ws.send(JSON.stringify({ type: 'exec-result', ...result }));
                    })
                    .catch(err => {
                        ws.send(JSON.stringify({ type: 'exec-result', success: false, error: err.message }));
                    });
            } else if (data.type === 'resize' && data.cols && data.rows) {
                // Resize not supported with basic spawn, would need node-pty
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    });

    ws.on('close', () => {
        term.clients.delete(ws);
    });
});

// Interrupt terminal (send Ctrl+C)
function interruptTerminal(id, term) {
    if (!term.process || term.process.killed) {
        return { success: false, error: 'Terminal process not running' };
    }

    try {
        // Send Ctrl+C (ETX character)
        term.process.stdin.write('\x03');
        console.log(`[Terminal ${id}] Sent interrupt (Ctrl+C)`);

        // Cancel any tracked running command
        if (runningCommands.has(id)) {
            const cmd = runningCommands.get(id);
            if (cmd.timeoutId) clearTimeout(cmd.timeoutId);
            runningCommands.delete(id);
        }

        // Broadcast interrupt to clients
        const msg = JSON.stringify({ type: 'interrupt' });
        term.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });

        return { success: true, message: 'Interrupt signal sent' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Execute command with timeout
function executeWithTimeout(id, command, timeout) {
    return new Promise((resolve, reject) => {
        const term = terminals.get(id);
        if (!term || !term.process || term.process.killed) {
            reject(new Error('Terminal not available'));
            return;
        }

        // Check if command already running
        if (runningCommands.has(id)) {
            reject(new Error('Command already running. Cancel it first.'));
            return;
        }

        const startTime = Date.now();
        const bufferStart = term.buffer.length;
        let resolved = false;

        // Track this command
        const cmdInfo = {
            command,
            startTime,
            timeoutId: null
        };
        runningCommands.set(id, cmdInfo);

        // Set up timeout
        cmdInfo.timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                runningCommands.delete(id);
                // Send Ctrl+C to stop the command
                try {
                    term.process.stdin.write('\x03');
                } catch (e) { /* ignore */ }
                resolve({
                    success: false,
                    error: `Command timed out after ${timeout}ms`,
                    timedOut: true,
                    output: term.buffer.slice(bufferStart),
                    executionTime: Date.now() - startTime
                });
            }
        }, timeout);

        // Listen for output to detect command completion
        const outputHandler = (data) => {
            // Simple heuristic: if we see a prompt pattern, command might be done
            const text = data.toString();
            // Common prompt patterns: PS C:\>, >, $, #
            if (text.match(/(\r\n|\n)(PS [^>]+>|\$|#|>)\s*$/)) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(cmdInfo.timeoutId);
                    runningCommands.delete(id);
                    term.process.stdout.removeListener('data', outputHandler);
                    resolve({
                        success: true,
                        output: term.buffer.slice(bufferStart),
                        executionTime: Date.now() - startTime
                    });
                }
            }
        };

        term.process.stdout.on('data', outputHandler);

        // Send the command
        console.log(`[Terminal ${id}] Executing with ${timeout}ms timeout: ${command}`);
        term.process.stdin.write(command + '\r\n');
    });
}

// Cancel running command
function cancelCommand(id) {
    const term = terminals.get(id);
    const cmdInfo = runningCommands.get(id);

    if (!cmdInfo) {
        return { success: false, error: 'No command running' };
    }

    console.log(`[Terminal ${id}] Cancelling command: ${cmdInfo.command}`);

    // Clear timeout
    if (cmdInfo.timeoutId) clearTimeout(cmdInfo.timeoutId);
    runningCommands.delete(id);

    // Send Ctrl+C
    if (term && term.process && !term.process.killed) {
        try {
            term.process.stdin.write('\x03');
        } catch (e) { /* ignore */ }
    }

    // Broadcast cancel to clients
    if (term) {
        const msg = JSON.stringify({ type: 'cancelled', command: cmdInfo.command });
        term.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    }

    return {
        success: true,
        message: 'Command cancelled',
        command: cmdInfo.command,
        elapsed: Date.now() - cmdInfo.startTime
    };
}

// Shell configurations
const SHELLS = {
    powershell: {
        path: 'powershell.exe',
        args: ['-NoLogo', '-NoExit'],
        name: 'PowerShell'
    },
    cmd: {
        path: 'cmd.exe',
        args: ['/K'],
        name: 'CMD'
    },
    bash: {
        path: 'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        args: ['--login', '-i'],
        name: 'Git Bash'
    }
};

function createTerminal(opts = {}) {
    const id = ++terminalCounter;
    const cwd = opts.cwd || process.env.USERPROFILE || 'C:\\';
    const shellType = opts.shell || 'powershell';
    const title = opts.title || `Terminal ${id}`;

    // Get shell config
    const shellConfig = SHELLS[shellType] || SHELLS.powershell;
    const shellPath = shellConfig.path;
    const shellArgs = shellConfig.args || [];

    let proc;
    try {
        proc = spawn(shellPath, shellArgs, {
            cwd: cwd.startsWith('/') ? 'C:\\LLM-DevOSWE' : cwd,  // Convert unix paths
            env: { ...process.env, TERM: 'xterm-256color' },
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });
    } catch (e) {
        console.error(`Failed to spawn ${shellConfig.name}:`, e.message);
        return null;
    }

    // Handle spawn errors
    proc.on('error', (err) => {
        console.error(`Terminal ${id} (${shellConfig.name}) error:`, err.message);
        const term = terminals.get(id);
        if (term) {
            const msg = `\r\n[Error: ${err.message}]\r\n`;
            term.buffer += msg;
            term.clients.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'output', data: msg }));
                }
            });
        }
    });

    const term = {
        process: proc,
        clients: new Set(),
        buffer: '',
        cwd,
        title
    };

    const broadcast = (data) => {
        const msg = JSON.stringify({ type: 'output', data });
        term.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    };

    proc.stdout.on('data', (data) => {
        const text = data.toString();
        term.buffer += text;
        // Keep buffer under 100KB
        if (term.buffer.length > 100000) {
            term.buffer = term.buffer.slice(-50000);
        }
        broadcast(text);
    });

    proc.stderr.on('data', (data) => {
        const text = data.toString();
        term.buffer += text;
        if (term.buffer.length > 100000) {
            term.buffer = term.buffer.slice(-50000);
        }
        broadcast(text);
    });

    proc.on('exit', (code) => {
        const msg = `\r\n[Process exited with code ${code}]\r\n`;
        term.buffer += msg;
        broadcast(msg);
        term.clients.forEach(ws => {
            ws.send(JSON.stringify({ type: 'exit', code }));
        });
    });

    terminals.set(id, term);
    console.log(`Terminal ${id} created: ${shellConfig.name} (${shellPath}) in ${cwd}`);

    // Send initial command to show prompt (piped stdio doesn't show PS prompt natively)
    setTimeout(() => {
        if (!proc.killed) {
            if (shellType === 'powershell') {
                proc.stdin.write('Write-Output "[Terminal Hub] PowerShell ready - $(Get-Location)"; Write-Output ""\r\n');
            } else if (shellType === 'cmd') {
                proc.stdin.write('echo [Terminal Hub] CMD ready & echo.\r\n');
            } else {
                proc.stdin.write('echo "[Terminal Hub] Shell ready - $(pwd)"\n');
            }
        }
    }, 500);

    return id;
}

// Create a terminal that monitors a process
function createMonitorTerminal(pid, processName) {
    const id = ++terminalCounter;
    const title = `Monitor: ${processName} (${pid})`;

    // PowerShell script to monitor process
    const monitorScript = `
$pid = ${pid}
$processName = "${processName}"
Write-Host "=== Process Monitor: $processName (PID: $pid) ===" -ForegroundColor Cyan
Write-Host ""

# Show initial process info
try {
    $proc = Get-Process -Id $pid -ErrorAction Stop
    Write-Host "Process: $($proc.ProcessName)" -ForegroundColor Green
    Write-Host "Started: $($proc.StartTime)"
    Write-Host "Memory: $([math]::Round($proc.WorkingSet64/1MB, 2)) MB"
    Write-Host "CPU Time: $($proc.TotalProcessorTime)"
    Write-Host "Threads: $($proc.Threads.Count)"
    Write-Host "Handles: $($proc.HandleCount)"
    Write-Host ""
    Write-Host "=== Monitoring (updates every 2s) ===" -ForegroundColor Yellow
    Write-Host ""

    while ($true) {
        Start-Sleep -Seconds 2
        $proc = Get-Process -Id $pid -ErrorAction Stop
        $cpu = [math]::Round($proc.CPU, 2)
        $mem = [math]::Round($proc.WorkingSet64/1MB, 2)
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "[$time] CPU: $cpu s | RAM: $mem MB | Threads: $($proc.Threads.Count)"
    }
} catch {
    Write-Host "Process $pid not found or terminated." -ForegroundColor Red
}
`;

    const proc = spawn('powershell.exe', ['-NoLogo', '-NoExit', '-Command', monitorScript], {
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    const term = {
        process: proc,
        clients: new Set(),
        buffer: '',
        cwd: 'Monitor',
        title,
        isMonitor: true,
        targetPid: pid
    };

    const broadcast = (data) => {
        const msg = JSON.stringify({ type: 'output', data });
        term.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    };

    proc.stdout.on('data', (data) => {
        const text = data.toString();
        term.buffer += text;
        if (term.buffer.length > 100000) {
            term.buffer = term.buffer.slice(-50000);
        }
        broadcast(text);
    });

    proc.stderr.on('data', (data) => {
        const text = data.toString();
        term.buffer += text;
        broadcast(text);
    });

    proc.on('exit', (code) => {
        const msg = `\r\n[Monitor ended]\r\n`;
        term.buffer += msg;
        broadcast(msg);
        term.clients.forEach(ws => {
            ws.send(JSON.stringify({ type: 'exit', code }));
        });
    });

    proc.on('error', (err) => {
        console.error(`Monitor terminal error:`, err.message);
    });

    terminals.set(id, term);
    console.log(`Monitor terminal ${id} created for ${processName} (PID: ${pid})`);

    return id;
}

// Get Windows Terminal windows
async function getWTWindows() {
    return new Promise((resolve, reject) => {
        const cmd = `powershell -Command "Get-Process WindowsTerminal -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle | ConvertTo-Json"`;
        exec(cmd, (err, stdout) => {
            if (err) {
                resolve([]);
                return;
            }
            try {
                let windows = JSON.parse(stdout || '[]');
                if (!Array.isArray(windows)) windows = [windows];
                resolve(windows.filter(w => w && w.Id).map(w => ({
                    pid: w.Id,
                    title: w.MainWindowTitle || 'Windows Terminal'
                })));
            } catch (e) {
                resolve([]);
            }
        });
    });
}

// Create a terminal that runs inside Windows Terminal with output bridged back
function createWTTerminal(opts = {}) {
    const id = ++terminalCounter;
    const cwd = opts.cwd || 'C:\\LLM-DevOSWE';
    const shellType = opts.shell || 'powershell';
    const title = opts.title || `WT Terminal ${id}`;
    const targetWindow = opts.windowId || 0; // 0 = current/new window, -1 = new window

    // Create a virtual terminal entry to receive bridged output
    const term = {
        process: null,
        clients: new Set(),
        buffer: '',
        cwd,
        title,
        isWT: true,
        wtPid: null
    };

    terminals.set(id, term);

    const broadcast = (data) => {
        const msg = JSON.stringify({ type: 'output', data });
        term.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        });
    };

    // Path to launcher batch file
    const launcherBat = path.join(__dirname, 'launch-bridge.bat');

    // Build wt command based on shell type
    let wtCommand;
    if (shellType === 'powershell') {
        // Use batch launcher to avoid quote escaping issues
        wtCommand = `wt -w ${targetWindow} new-tab --title "${title}" -d "${cwd}" "${launcherBat}" ${id} http://localhost:${PORT} "${title}"`;
    } else if (shellType === 'cmd') {
        wtCommand = `wt -w ${targetWindow} new-tab --title "${title}" -d "${cwd}" cmd /K`;
    } else if (shellType === 'bash') {
        wtCommand = `wt -w ${targetWindow} new-tab --title "${title}" -d "${cwd}" "C:\\Program Files\\Git\\bin\\bash.exe" --login -i`;
    }

    console.log(`Launching WT: ${wtCommand}`);

    // Launch Windows Terminal
    exec(wtCommand, (err) => {
        if (err) {
            console.error('Failed to launch Windows Terminal:', err.message);
            term.buffer = `[Error launching Windows Terminal: ${err.message}]\r\n`;
            broadcast(term.buffer);
        } else {
            const msg = `[Windows Terminal tab opened]\r\n[Title: ${title}]\r\n[Shell: ${shellType}]\r\n[CWD: ${cwd}]\r\n[Waiting for bridge connection...]\r\n\r\n`;
            term.buffer = msg;
            broadcast(msg);

            // Try to find the new WT process
            setTimeout(() => {
                exec('powershell -Command "Get-Process WindowsTerminal | Select-Object -First 1 -ExpandProperty Id"', (e, pid) => {
                    if (!e && pid) {
                        term.wtPid = parseInt(pid.trim());
                    }
                });
            }, 1000);
        }
    });

    console.log(`WT Terminal ${id} created: ${title}`);

    return { id, title, message: `Windows Terminal tab opening: ${title}` };
}

// Create initial terminals - one of each type
createTerminal({ title: 'PowerShell', shell: 'powershell', cwd: 'C:\\LLM-DevOSWE' });
createTerminal({ title: 'CMD', shell: 'cmd', cwd: 'C:\\LLM-DevOSWE' });
createTerminal({ title: 'Git Bash', shell: 'bash', cwd: '/c/LLM-DevOSWE' });

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════╗
║       TERMINAL HUB - Port ${PORT}       ║
║  Web-based terminal manager          ║
╚══════════════════════════════════════╝

Endpoints:
  GET  /                         - Web UI
  GET  /api/terminals            - List terminals
  POST /api/terminals            - Create terminal
  DELETE /api/terminals/:id      - Kill terminal
  POST /api/terminals/:id/exec   - Execute with timeout
  POST /api/terminals/:id/interrupt - Send Ctrl+C
  POST /api/terminals/:id/cancel - Cancel running command
  POST /api/terminals/cancel-all - Cancel all commands
  WS   /?id=N                    - Connect to terminal

WebSocket messages:
  { type: 'input', data: '...' }     - Send input
  { type: 'interrupt' }              - Send Ctrl+C
  { type: 'cancel' }                 - Cancel command
  { type: 'exec', command, timeout } - Execute with timeout

Local:  http://localhost:${PORT}
LAN:    http://192.168.1.192:${PORT}
`);
});
