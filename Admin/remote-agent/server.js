const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8591;
const API_KEY = 'hive-remote-2024'; // Simple shared key

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Auth check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            hostname: require('os').hostname(),
            platform: process.platform,
            uptime: process.uptime()
        }));
        return;
    }

    // Execute command
    if (req.method === 'POST' && url.pathname === '/exec') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { cmd, cwd, timeout = 30000 } = JSON.parse(body);
                console.log(`[Exec] ${cmd}`);

                exec(cmd, {
                    cwd: cwd || 'C:\\LLM-DevOSWE',
                    timeout,
                    shell: 'powershell.exe'
                }, (error, stdout, stderr) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: !error,
                        stdout: stdout.toString(),
                        stderr: stderr.toString(),
                        code: error ? error.code : 0
                    }));
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Git pull
    if (req.method === 'POST' && url.pathname === '/git-pull') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            let repo = 'C:\\LLM-DevOSWE';
            try {
                if (body && body.trim()) {
                    const parsed = JSON.parse(body);
                    repo = parsed.repo || repo;
                }
            } catch (e) {
                // Use default repo
            }
            console.log(`[Git Pull] ${repo}`);

            exec('git pull', { cwd: repo }, (error, stdout, stderr) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: !error,
                    stdout: stdout.toString(),
                    stderr: stderr.toString()
                }));
            });
        });
        return;
    }

    // Write file
    if (req.method === 'POST' && url.pathname === '/file') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { path: filePath, content, base64 } = JSON.parse(body);
                console.log(`[Write] ${filePath}`);

                // Ensure directory exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const data = base64 ? Buffer.from(content, 'base64') : content;
                fs.writeFileSync(filePath, data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: filePath }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Read file
    if (req.method === 'GET' && url.pathname === '/file') {
        const filePath = url.searchParams.get('path');
        const base64 = url.searchParams.get('base64') === 'true';

        if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'path required' }));
            return;
        }

        console.log(`[Read] ${filePath}`);

        try {
            const content = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                content: base64 ? content.toString('base64') : content.toString()
            }));
        } catch (e) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // Restart service (node process)
    if (req.method === 'POST' && url.pathname.startsWith('/restart/')) {
        const service = url.pathname.replace('/restart/', '');
        console.log(`[Restart] ${service}`);

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { script, cwd } = body ? JSON.parse(body) : {};

            // Kill existing process by port or name pattern
            const killCmd = service === 'simwidget'
                ? "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
                : `Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*${service}*' } | Stop-Process -Force`;

            exec(killCmd, { shell: 'powershell.exe' }, (err) => {
                // Start new process
                const startScript = script || 'server.js';
                const startCwd = cwd || `C:\\LLM-DevOSWE\\simwidget-hybrid\\backend`;

                const child = spawn('node', [startScript], {
                    cwd: startCwd,
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Restarted ${service}`,
                    pid: child.pid
                }));
            });
        });
        return;
    }

    // List files
    if (req.method === 'GET' && url.pathname === '/ls') {
        const dirPath = url.searchParams.get('path') || 'C:\\LLM-DevOSWE';

        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                path: dirPath,
                files: files.map(f => ({
                    name: f.name,
                    isDir: f.isDirectory()
                }))
            }));
        } catch (e) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Hive Remote Agent v1.0.0                        ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API:  http://0.0.0.0:${PORT}                          ║
║  Hostname:  ${require('os').hostname().padEnd(41)}║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET  /health         - Health check                    ║
║    POST /exec           - Execute command                 ║
║    POST /git-pull       - Git pull repo                   ║
║    POST /file           - Write file                      ║
║    GET  /file?path=     - Read file                       ║
║    POST /restart/:svc   - Restart service                 ║
║    GET  /ls?path=       - List directory                  ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
