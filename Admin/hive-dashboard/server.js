/**
 * Hive Dashboard Server
 * Simple static file server for the Command Center dashboard
 * Port: 8899
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 8899;
const PUBLIC_DIR = __dirname;

// Lazy-load beautiful-mermaid (ESM module)
let renderMermaid = null;
let renderMermaidAscii = null;
async function loadMermaid() {
    if (!renderMermaid) {
        const mod = await import('beautiful-mermaid');
        renderMermaid = mod.renderMermaid;
        renderMermaidAscii = mod.renderMermaidAscii;
    }
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check endpoint
    if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'hive-dashboard',
            port: PORT,
            uptime: process.uptime()
        }));
        return;
    }

    // Mermaid diagram rendering endpoint
    if (req.url === '/api/mermaid' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { diagram, format = 'svg', theme } = JSON.parse(body);
                if (!diagram) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'diagram is required' }));
                    return;
                }
                await loadMermaid();
                if (format === 'ascii') {
                    const ascii = renderMermaidAscii(diagram);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(ascii);
                } else {
                    const options = theme ? { theme } : {};
                    const svg = await renderMermaid(diagram, options);
                    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                    res.end(svg);
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Hive topology diagram (pre-rendered)
    if (req.url === '/api/topology') {
        (async () => {
            try {
                await loadMermaid();
                const diagram = `graph TD
    subgraph Core
        O[Orchestrator :8500]
        R[Relay :8600]
        D[Dashboard :8899]
    end
    subgraph Services
        Oracle[Oracle :3002]
        KB[KittBox :8585]
        SW[SimWidget :8080]
        MCP[MCP Bridge :8860]
    end
    subgraph LLMs
        Ollama[Ollama :11434]
        LMS[LM Studio :1234]
    end
    O --> R
    O --> D
    O --> Oracle
    O --> KB
    O --> SW
    O --> MCP
    Oracle --> Ollama
    Oracle --> LMS
    R --> KB`;
                const svg = await renderMermaid(diagram, {
                    theme: { background: '#0a0a0f', foreground: '#e0e0e0' }
                });
                res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                res.end(svg);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        })();
        return;
    }

    // File read endpoint for docs.html
    if (req.url.startsWith('/api/file?')) {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        const filePath = urlParams.get('path');
        if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'path parameter required' }));
            return;
        }
        // Security: only allow reading from known safe directories
        const safePaths = ['C:/DevClaude', 'C:/LLM-DevOSWE', 'C:/kinship', 'C:/LLM-Oracle', 'C:/PMS50-Prototype'];
        const normalizedPath = filePath.replace(/\\/g, '/');
        const isSafe = safePaths.some(safe => normalizedPath.startsWith(safe));
        if (!isSafe) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access denied' }));
            return;
        }
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(content);
        });
        return;
    }

    // Open file in editor endpoint
    if (req.url.startsWith('/api/open?')) {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        const filePath = urlParams.get('path');
        if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'path parameter required' }));
            return;
        }
        // Use 'code' to open in VS Code, or 'start' as fallback
        exec(`code "${filePath}"`, (err) => {
            if (err) {
                exec(`start "" "${filePath}"`);
            }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: filePath }));
        return;
    }

    // System resource stats endpoint
    if (req.url === '/api/system') {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const avgLoad = cpus.reduce((sum, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            return sum + (1 - cpu.times.idle / total);
        }, 0) / cpus.length;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            cpu: { cores: cpus.length, usage: Math.round(avgLoad * 100), model: cpus[0]?.model || 'Unknown' },
            memory: { total: totalMem, used: usedMem, free: freeMem, percent: Math.round(usedMem / totalMem * 100) },
            os: { platform: os.platform(), hostname: os.hostname(), uptime: os.uptime() },
            node: { version: process.version, pid: process.pid, memUsage: process.memoryUsage().rss }
        }));
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(PUBLIC_DIR, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║       HIVE COMMAND CENTER DASHBOARD        ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  URL: http://localhost:${PORT}                ║`);
    console.log(`║  LAN: http://192.168.1.192:${PORT}             ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
});
