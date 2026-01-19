#!/usr/bin/env node
/**
 * Hive Performance Benchmark
 *
 * Measures performance of key operations across services.
 *
 * Usage:
 *   node scripts/benchmark.js              # Run all benchmarks
 *   node scripts/benchmark.js --relay      # Relay benchmarks only
 *   node scripts/benchmark.js --oracle     # Oracle benchmarks only
 *   node scripts/benchmark.js --json       # JSON output
 */

const { SERVICES, getServiceUrl } = require('../shared/constants');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const relayOnly = args.includes('--relay');
const oracleOnly = args.includes('--oracle');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

/**
 * Measure execution time of an async function
 */
async function measure(name, fn, iterations = 10) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        try {
            await fn();
            times.push(performance.now() - start);
        } catch (error) {
            return {
                name,
                error: error.message,
                iterations: i
            };
        }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    return {
        name,
        iterations,
        avg: avg.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        p95: p95.toFixed(2)
    };
}

/**
 * Relay service benchmarks
 */
async function benchmarkRelay() {
    const baseUrl = getServiceUrl('relay');
    const results = [];

    // Health check
    results.push(await measure('Relay: Health Check', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Queue list
    results.push(await measure('Relay: List Queue', async () => {
        const res = await fetch(`${baseUrl}/api/queue?limit=10`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Add task
    results.push(await measure('Relay: Add Task', async () => {
        const res = await fetch(`${baseUrl}/api/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task: `Benchmark task ${Date.now()}`,
                source: 'benchmark'
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }, 5));

    // Consumer list
    results.push(await measure('Relay: List Consumers', async () => {
        const res = await fetch(`${baseUrl}/api/consumers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    return results;
}

/**
 * Oracle service benchmarks
 */
async function benchmarkOracle() {
    const baseUrl = getServiceUrl('oracle');
    const results = [];

    // Health check
    results.push(await measure('Oracle: Health Check', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Model list
    results.push(await measure('Oracle: Get Model', async () => {
        const res = await fetch(`${baseUrl}/api/model`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Memory facts
    results.push(await measure('Oracle: List Facts', async () => {
        const res = await fetch(`${baseUrl}/api/memory/facts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Projects list
    results.push(await measure('Oracle: List Projects', async () => {
        const res = await fetch(`${baseUrl}/api/projects`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }));

    // Simple ask (if LLM available) - only 1 iteration
    results.push(await measure('Oracle: Simple Ask', async () => {
        const res = await fetch(`${baseUrl}/api/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: 'Say "ok"',
                maxTokens: 10
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }, 1));

    return results;
}

/**
 * Display results in terminal
 */
function displayResults(results, category) {
    console.log(`\n${colors.bright}${colors.cyan}${category}${colors.reset}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`${colors.dim}${'Benchmark'.padEnd(30)} ${'Avg'.padStart(10)} ${'Min'.padStart(10)} ${'Max'.padStart(10)} ${'P95'.padStart(10)}${colors.reset}`);
    console.log(`${'─'.repeat(70)}`);

    for (const r of results) {
        if (r.error) {
            console.log(`${r.name.padEnd(30)} ${colors.red}ERROR: ${r.error}${colors.reset}`);
        } else {
            const avgColor = parseFloat(r.avg) < 50 ? colors.green :
                parseFloat(r.avg) < 200 ? colors.yellow : colors.red;
            console.log(
                `${r.name.padEnd(30)} ` +
                `${avgColor}${(r.avg + 'ms').padStart(10)}${colors.reset} ` +
                `${(r.min + 'ms').padStart(10)} ` +
                `${(r.max + 'ms').padStart(10)} ` +
                `${(r.p95 + 'ms').padStart(10)}`
            );
        }
    }
}

/**
 * Main benchmark runner
 */
async function main() {
    const allResults = {
        timestamp: new Date().toISOString(),
        results: {}
    };

    if (!jsonOutput) {
        console.log(`${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}║${colors.reset}                   ${colors.bright}HIVE PERFORMANCE BENCHMARK${colors.reset}                    ${colors.cyan}║${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════════════╝${colors.reset}`);
    }

    // Relay benchmarks
    if (!oracleOnly) {
        try {
            const relayResults = await benchmarkRelay();
            allResults.results.relay = relayResults;
            if (!jsonOutput) displayResults(relayResults, 'RELAY SERVICE');
        } catch (error) {
            if (!jsonOutput) console.log(`\n${colors.red}Relay benchmarks failed: ${error.message}${colors.reset}`);
            allResults.results.relay = { error: error.message };
        }
    }

    // Oracle benchmarks
    if (!relayOnly) {
        try {
            const oracleResults = await benchmarkOracle();
            allResults.results.oracle = oracleResults;
            if (!jsonOutput) displayResults(oracleResults, 'ORACLE SERVICE');
        } catch (error) {
            if (!jsonOutput) console.log(`\n${colors.red}Oracle benchmarks failed: ${error.message}${colors.reset}`);
            allResults.results.oracle = { error: error.message };
        }
    }

    if (jsonOutput) {
        console.log(JSON.stringify(allResults, null, 2));
    } else {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`${colors.dim}Benchmark completed at ${new Date().toLocaleTimeString()}${colors.reset}\n`);
    }

    // Cleanup benchmark tasks
    try {
        await fetch(`${getServiceUrl('relay')}/api/queue/cleanup`, { method: 'POST' });
    } catch (e) {
        // Ignore cleanup errors
    }
}

main().catch(console.error);
