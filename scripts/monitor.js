#!/usr/bin/env node
/**
 * Hive Service Monitor
 *
 * Real-time monitoring of all hive services with auto-refresh.
 *
 * Usage:
 *   node scripts/monitor.js              # Monitor with 5s refresh
 *   node scripts/monitor.js --interval 10 # 10 second refresh
 *   node scripts/monitor.js --once       # Single check, no refresh
 *   node scripts/monitor.js --json       # JSON output
 */

const { SERVICES, getHealthUrl, getCoreServices } = require('../shared/constants');
const { checkHealth } = require('../shared/health');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const onceOnly = args.includes('--once');
const intervalIndex = args.indexOf('--interval');
const interval = intervalIndex !== -1 ? parseInt(args[intervalIndex + 1], 10) * 1000 : 5000;

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
    if (!jsonOutput) {
        process.stdout.write('\x1b[2J\x1b[H');
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format uptime to human readable
 */
function formatUptime(ms) {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Check all services
 */
async function checkAllServices() {
    const results = [];
    const coreServices = getCoreServices();

    for (const [key, service] of Object.entries(SERVICES)) {
        const url = getHealthUrl(key);
        const startTime = Date.now();
        const result = await checkHealth(url, 3000);
        const responseTime = Date.now() - startTime;

        results.push({
            key,
            name: service.name,
            port: service.port,
            isCore: coreServices.includes(key),
            healthy: result.healthy,
            responseTime,
            uptime: result.uptime || result.uptimeMs,
            memory: result.memory,
            error: result.error,
            details: result
        });
    }

    return results;
}

/**
 * Display results in terminal
 */
function displayResults(results) {
    const now = new Date().toLocaleTimeString();

    console.log(`${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║${colors.reset}              ${colors.bright}HIVE SERVICE MONITOR${colors.reset}                           ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║${colors.reset}              ${colors.dim}Last updated: ${now}${colors.reset}                      ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╠═══════════════════════════════════════════════════════════════╣${colors.reset}`);

    // Core services
    console.log(`${colors.bright}${colors.cyan}║${colors.reset} ${colors.bright}CORE SERVICES${colors.reset}                                                 ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}╟───────────────────────────────────────────────────────────────╢${colors.reset}`);

    const coreResults = results.filter(r => r.isCore);
    for (const r of coreResults) {
        const status = r.healthy
            ? `${colors.green}● ONLINE ${colors.reset}`
            : `${colors.red}● OFFLINE${colors.reset}`;
        const time = r.healthy ? `${colors.dim}${r.responseTime}ms${colors.reset}` : `${colors.red}${r.error}${colors.reset}`;
        const uptime = r.healthy ? formatUptime(r.uptime) : '-';

        const name = r.name.padEnd(15);
        const port = `:${r.port}`.padEnd(6);
        const uptimeStr = uptime.padEnd(10);

        console.log(`${colors.cyan}║${colors.reset}  ${status} ${name} ${port} ${colors.dim}uptime:${colors.reset} ${uptimeStr} ${time.padStart(10)} ${colors.cyan}║${colors.reset}`);
    }

    // Optional services
    console.log(`${colors.cyan}╟───────────────────────────────────────────────────────────────╢${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║${colors.reset} ${colors.bright}OPTIONAL SERVICES${colors.reset}                                             ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}╟───────────────────────────────────────────────────────────────╢${colors.reset}`);

    const optionalResults = results.filter(r => !r.isCore);
    for (const r of optionalResults) {
        const status = r.healthy
            ? `${colors.green}●${colors.reset}`
            : `${colors.dim}○${colors.reset}`;
        const name = r.name.padEnd(15);
        const port = `:${r.port}`.padEnd(6);
        const state = r.healthy ? `${colors.green}online${colors.reset} ` : `${colors.dim}offline${colors.reset}`;

        console.log(`${colors.cyan}║${colors.reset}  ${status} ${name} ${port} ${state}                              ${colors.cyan}║${colors.reset}`);
    }

    // Summary
    const online = results.filter(r => r.healthy).length;
    const offline = results.filter(r => !r.healthy).length;
    const coreOnline = coreResults.filter(r => r.healthy).length;
    const coreTotal = coreResults.length;

    console.log(`${colors.cyan}╟───────────────────────────────────────────────────────────────╢${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset} ${colors.bright}SUMMARY${colors.reset}                                                       ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}  Total: ${online}/${results.length} online    Core: ${coreOnline}/${coreTotal}    Optional: ${online - coreOnline}/${results.length - coreTotal}        ${colors.cyan}║${colors.reset}`);

    if (coreOnline < coreTotal) {
        console.log(`${colors.cyan}║${colors.reset}  ${colors.red}${colors.bright}⚠ WARNING: Core services offline!${colors.reset}                           ${colors.cyan}║${colors.reset}`);
    }

    console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);

    if (!onceOnly) {
        console.log(`\n${colors.dim}Press Ctrl+C to exit. Refreshing every ${interval / 1000}s...${colors.reset}`);
    }
}

/**
 * Display JSON output
 */
function displayJson(results) {
    const output = {
        timestamp: new Date().toISOString(),
        services: results.map(r => ({
            name: r.name,
            port: r.port,
            isCore: r.isCore,
            healthy: r.healthy,
            responseTime: r.responseTime,
            uptime: r.uptime,
            error: r.error
        })),
        summary: {
            total: results.length,
            online: results.filter(r => r.healthy).length,
            offline: results.filter(r => !r.healthy).length,
            coreHealthy: results.filter(r => r.isCore && r.healthy).length,
            coreTotal: results.filter(r => r.isCore).length
        }
    };

    console.log(JSON.stringify(output, null, 2));
}

/**
 * Main monitoring loop
 */
async function main() {
    async function run() {
        const results = await checkAllServices();

        if (jsonOutput) {
            displayJson(results);
        } else {
            clearScreen();
            displayResults(results);
        }
    }

    await run();

    if (!onceOnly && !jsonOutput) {
        setInterval(run, interval);
    }
}

main().catch(console.error);
