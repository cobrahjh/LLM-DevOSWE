/**
 * SimGlass Watchdog v1.0.0
 *
 * Lightweight static server on port 8082.
 * Serves diagnostic pages even when the main server (8080) is down.
 * Can restart the main server via /api/restart-main.
 *
 * Start: node watchdog.js
 * Open:  http://localhost:8082/
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { exec, spawn } = require('child_process');

const app = express();
app.use(express.json());

const ROOT = path.join(__dirname, '..');

// Serve all UI files so pages and their assets (JS, CSS) work
app.use('/ui', express.static(path.join(ROOT, 'ui')));
app.use('/shared-ui', express.static(path.join(ROOT, 'ui', 'shared')));

// Root → sally-diagnostics for quick access
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'ui', 'ai-autopilot', 'sally-diagnostics.html'));
});

// Check whether main server is alive
app.get('/api/main-status', (req, res) => {
    const req2 = http.get('http://localhost:8080/api/health', (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
            try { res.json({ online: true, ...JSON.parse(data) }); }
            catch (e) { res.json({ online: true }); }
        });
    });
    req2.on('error', () => res.json({ online: false }));
    req2.setTimeout(2000, () => { req2.destroy(); res.json({ online: false, error: 'timeout' }); });
});

// Kill port-8080 process and restart server.js
app.post('/api/restart-main', (req, res) => {
    res.json({ ok: true, message: 'Restarting main server…' });

    exec('netstat -ano', (err, stdout) => {
        const lines = (stdout || '').split('\n');
        let pid = null;
        for (const line of lines) {
            if (line.includes(':8080') && line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                pid = parts[parts.length - 1];
                break;
            }
        }

        const doStart = () => {
            setTimeout(() => {
                const child = spawn('node', ['server.js'], {
                    cwd: __dirname,
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                console.log('[Watchdog] Main server started');
            }, 1000);
        };

        if (pid && /^\d+$/.test(pid)) {
            console.log(`[Watchdog] Killing PID ${pid} (port 8080)`);
            exec(`taskkill /F /PID ${pid}`, () => doStart());
        } else {
            console.log('[Watchdog] No process found on :8080, starting fresh');
            doStart();
        }
    });
});

const PORT = 8082;
app.listen(PORT, () => {
    console.log(`[Watchdog] Running on http://localhost:${PORT}`);
    console.log(`[Watchdog] Sally diagnostics: http://localhost:${PORT}/`);
    console.log(`[Watchdog] All UI:            http://localhost:${PORT}/ui/`);
});
