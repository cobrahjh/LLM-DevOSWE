/**
 * SimGlass Watchdog v1.1.0
 *
 * Lightweight static server on port 8082.
 * Serves diagnostic pages even when the main server (8080) is down.
 * Auto-restarts main server if it goes offline. Logs crashes to crash.log.
 *
 * Start: node watchdog.js
 * Open:  http://localhost:8082/
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const app = express();
app.use(express.json());

const ROOT = path.join(__dirname, '..');
const CRASH_LOG = path.join(__dirname, 'crash.log');

// ── Crash log ──────────────────────────────────────────────────────────────
function logCrash(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(CRASH_LOG, line); } catch (_) {}
    console.log('[Watchdog]', msg);
}

// ── Auto-restart monitor ───────────────────────────────────────────────────
let autoRestartEnabled = true;
let lastRestartAt = 0;
let restartCount = 0;
const RESTART_COOLDOWN = 5000;   // minimum ms between auto-restarts
const POLL_INTERVAL   = 10000;  // check every 10s

function checkMainServer(callback) {
    const req2 = http.get('http://localhost:8080/api/status', (r) => {
        r.resume();
        callback(r.statusCode === 200);
    });
    req2.on('error', () => callback(false));
    req2.setTimeout(3000, () => { req2.destroy(); callback(false); });
}

function startMainServer() {
    const child = spawn('node', ['server.js'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
}

setInterval(() => {
    if (!autoRestartEnabled) return;
    checkMainServer((online) => {
        if (!online) {
            const now = Date.now();
            if (now - lastRestartAt < RESTART_COOLDOWN) return;
            lastRestartAt = now;
            restartCount++;
            logCrash(`CRASH DETECTED — main server offline. Auto-restart #${restartCount}`);
            startMainServer();
        }
    });
}, POLL_INTERVAL);

// Serve all UI files so pages and their assets (JS, CSS) work
app.use('/ui', express.static(path.join(ROOT, 'ui')));
app.use('/shared-ui', express.static(path.join(ROOT, 'ui', 'shared')));

// Root → sally-diagnostics for quick access
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'ui', 'ai-autopilot', 'sally-diagnostics.html'));
});

// Check whether main server is alive
app.get('/api/main-status', (req, res) => {
    checkMainServer((online) => {
        const crashLog = (() => {
            try { return fs.readFileSync(CRASH_LOG, 'utf8').trim().split('\n').slice(-20); }
            catch (_) { return []; }
        })();
        res.json({ online, autoRestart: autoRestartEnabled, restartCount, crashLog });
    });
});

// Toggle auto-restart
app.post('/api/auto-restart', (req, res) => {
    autoRestartEnabled = req.body.enabled !== false;
    res.json({ autoRestart: autoRestartEnabled });
});

// Crash log endpoint
app.get('/api/crash-log', (req, res) => {
    try {
        const log = fs.readFileSync(CRASH_LOG, 'utf8').trim().split('\n').slice(-100);
        res.json({ lines: log, count: log.length });
    } catch (_) {
        res.json({ lines: [], count: 0 });
    }
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
