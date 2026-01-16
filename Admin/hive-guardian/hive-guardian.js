/**
 * Hive Guardian - Auto-healing service monitor
 * Runs as Windows service, monitors all hive services, restarts if down
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'hive-guardian.log');

// Service definitions
const SERVICES = [
    {
        name: 'Ollama',
        port: 11434,
        healthUrl: 'http://localhost:11434/api/tags',
        start: () => spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }),
        isProcess: true
    },
    {
        name: 'Oracle',
        port: 3002,
        healthUrl: 'http://localhost:3002/api/health',
        cwd: 'C:\\LLM-Oracle',
        script: 'oracle.js'
    },
    {
        name: 'Relay',
        port: 8600,
        healthUrl: 'http://localhost:8600/api/status',
        cwd: 'C:\\LLM-DevOSWE\\Admin\\relay',
        script: 'relay-service.js'
    },
    {
        name: 'KittBox',
        port: 8585,
        healthUrl: 'http://localhost:8585/',
        cwd: 'C:\\LLM-DevOSWE\\Admin\\agent\\agent-ui',
        script: 'agent-server.js'
    },
    {
        name: 'Kitt Live',
        port: 8686,
        healthUrl: 'http://localhost:8686/',
        cwd: 'C:\\kittbox-modules\\kitt-live',
        script: 'server.js'
    }
];

const CHECK_INTERVAL = 30000; // 30 seconds
const STARTUP_DELAY = 10000; // 10 seconds between service starts
let running = true;

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function checkHealth(url, timeout = 5000) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

function checkPort(port) {
    return new Promise((resolve) => {
        exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
            resolve(stdout && stdout.trim().length > 0);
        });
    });
}

async function startService(service) {
    log(`Starting ${service.name}...`);

    if (service.isProcess && service.start) {
        const proc = service.start();
        proc.unref();
        return;
    }

    if (service.cwd && service.script) {
        const proc = spawn('node', [service.script], {
            cwd: service.cwd,
            detached: true,
            stdio: 'ignore',
            shell: true
        });
        proc.unref();
    }
}

async function checkAndHeal() {
    for (const service of SERVICES) {
        try {
            // First check if port is listening
            const portUp = await checkPort(service.port);

            if (!portUp) {
                log(`${service.name} is DOWN (port ${service.port} not listening)`);
                await startService(service);
                await new Promise(r => setTimeout(r, 5000)); // Wait for startup
                continue;
            }

            // Then check health endpoint
            if (service.healthUrl) {
                const healthy = await checkHealth(service.healthUrl);
                if (!healthy) {
                    log(`${service.name} health check FAILED`);
                    // Port is up but not healthy - might need restart
                    // For now just log, could add force restart logic
                }
            }
        } catch (e) {
            log(`Error checking ${service.name}: ${e.message}`);
        }
    }
}

async function initialStartup() {
    log('=== Hive Guardian Starting ===');
    log('Performing initial service checks...');

    for (const service of SERVICES) {
        const portUp = await checkPort(service.port);
        if (!portUp) {
            log(`${service.name} not running, starting...`);
            await startService(service);
            await new Promise(r => setTimeout(r, STARTUP_DELAY));
        } else {
            log(`${service.name} already running on port ${service.port}`);
        }
    }

    log('Initial startup complete. Entering monitoring mode.');
}

async function main() {
    // Clear old log on startup
    if (fs.existsSync(LOG_FILE)) {
        const stats = fs.statSync(LOG_FILE);
        if (stats.size > 1024 * 1024) { // 1MB
            fs.writeFileSync(LOG_FILE, ''); // Clear if too large
        }
    }

    await initialStartup();

    // Main monitoring loop
    while (running) {
        await new Promise(r => setTimeout(r, CHECK_INTERVAL));
        await checkAndHeal();
    }
}

// Handle shutdown
process.on('SIGINT', () => { running = false; log('Guardian shutting down...'); });
process.on('SIGTERM', () => { running = false; log('Guardian shutting down...'); });

main().catch(e => log(`Fatal error: ${e.message}`));
