/**
 * SimGlass Performance Regression Tests
 * Tracks bundle sizes, load times, and memory usage over time
 *
 * Detects performance regressions by comparing against baseline metrics
 *
 * Usage:
 *   node performance-regression.js          # Run all performance tests
 *   node performance-regression.js baseline # Set new baseline
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const BASELINE_FILE = path.join(__dirname, 'performance-baseline.json');

let passed = 0;
let failed = 0;

// ============================================
// UTILITIES
// ============================================

function log(msg, color = 'white') {
    const colors = {
        green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
        cyan: '\x1b[36m', white: '\x1b[37m', reset: '\x1b[0m'
    };
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function assert(condition, message) {
    if (condition) {
        passed++;
        log(`  ✓ ${message}`, 'green');
    } else {
        failed++;
        log(`  ✗ ${message}`, 'red');
    }
}

async function fetch(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        http.get({
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                text: () => data,
                size: Buffer.byteLength(data, 'utf8')
            }));
        }).on('error', reject);
    });
}

function loadBaseline() {
    if (fs.existsSync(BASELINE_FILE)) {
        return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    }
    return null;
}

function saveBaseline(metrics) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(metrics, null, 2));
    log(`\n✓ Baseline saved to ${BASELINE_FILE}`, 'green');
}

// ============================================
// PERFORMANCE METRICS COLLECTION
// ============================================

async function measureBundleSizes() {
    const widgets = [
        { name: 'checklist-widget', target: 20000, description: 'Checklist (code-split)' },
        { name: 'copilot-widget', target: 80000, description: 'Copilot (code-split)' },
        { name: 'gtn750', target: 65000, description: 'GTN750 (modular)' },
        { name: 'map-widget', target: 100000, description: 'Map' },
        { name: 'vatsim-live', target: 100000, description: 'VATSIM Live' }
    ];

    const results = {};

    for (const widget of widgets) {
        try {
            const res = await fetch(`${BASE_URL}/ui/${widget.name}/pane.js`);
            const size = res.size;
            results[widget.name] = {
                size,
                target: widget.target,
                description: widget.description,
                withinTarget: size < widget.target
            };
        } catch (e) {
            results[widget.name] = { error: e.message };
        }
    }

    return results;
}

async function measureSharedLibraries() {
    const libs = [
        'widget-base.js',
        'telemetry.js',
        'settings-panel.js',
        'themes.js',
        'platform-utils.js'
    ];

    const results = {};

    for (const lib of libs) {
        try {
            const res = await fetch(`${BASE_URL}/ui/shared/${lib}`);
            results[lib] = { size: res.size };
        } catch (e) {
            results[lib] = { error: e.message };
        }
    }

    return results;
}

async function measureLoadTimes() {
    const widgets = [
        'checklist-widget',
        'copilot-widget',
        'gtn750',
        'map-widget',
        'vatsim-live'
    ];

    const results = {};

    for (const widget of widgets) {
        try {
            const start = Date.now();
            await fetch(`${BASE_URL}/ui/${widget}/`);
            const loadTime = Date.now() - start;
            results[widget] = { loadTime };
        } catch (e) {
            results[widget] = { error: e.message };
        }
    }

    return results;
}

// ============================================
// REGRESSION DETECTION
// ============================================

function detectRegressions(current, baseline) {
    const regressions = [];
    const improvements = [];

    // Bundle size regressions (>10% increase)
    for (const [widget, data] of Object.entries(current.bundles)) {
        if (baseline.bundles[widget] && !data.error) {
            const baseSize = baseline.bundles[widget].size;
            const currentSize = data.size;
            const increase = ((currentSize - baseSize) / baseSize) * 100;

            if (increase > 10) {
                regressions.push({
                    type: 'bundle',
                    widget,
                    baseline: baseSize,
                    current: currentSize,
                    increase: increase.toFixed(1) + '%'
                });
            } else if (increase < -10) {
                improvements.push({
                    type: 'bundle',
                    widget,
                    reduction: Math.abs(increase).toFixed(1) + '%'
                });
            }
        }
    }

    // Load time regressions (>50ms absolute increase OR >50% relative increase)
    for (const [widget, data] of Object.entries(current.loadTimes)) {
        if (baseline.loadTimes[widget] && !data.error) {
            const baseTime = baseline.loadTimes[widget].loadTime;
            const currentTime = data.loadTime;
            const absoluteIncrease = currentTime - baseTime;
            const percentIncrease = baseTime > 0 ? ((currentTime - baseTime) / baseTime) * 100 : 0;

            // Only flag if both >50ms AND >50% increase (avoids 0→1ms false positives)
            if (absoluteIncrease > 50 && percentIncrease > 50) {
                regressions.push({
                    type: 'loadTime',
                    widget,
                    baseline: baseTime + 'ms',
                    current: currentTime + 'ms',
                    increase: percentIncrease.toFixed(1) + '%'
                });
            }
        }
    }

    return { regressions, improvements };
}

// ============================================
// MAIN
// ============================================

async function runPerformanceTests() {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║   SimGlass Performance Regression Tests  ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');

    const isBaselineMode = process.argv[2] === 'baseline';

    // Check server
    try {
        await fetch(`${BASE_URL}/api/status`);
        log('\n✓ Server running at ' + BASE_URL, 'green');
    } catch (e) {
        log('\n❌ Server not running at ' + BASE_URL, 'red');
        process.exit(1);
    }

    log('\n📊 Measuring Performance Metrics...', 'cyan');
    log('─'.repeat(40), 'cyan');

    const currentMetrics = {
        timestamp: new Date().toISOString(),
        bundles: await measureBundleSizes(),
        sharedLibs: await measureSharedLibraries(),
        loadTimes: await measureLoadTimes()
    };

    // Display current metrics
    log('\n📦 Bundle Sizes:', 'cyan');
    for (const [widget, data] of Object.entries(currentMetrics.bundles)) {
        if (data.error) {
            log(`  ✗ ${data.description}: Error`, 'red');
        } else {
            const sizeKB = (data.size / 1024).toFixed(1);
            const targetKB = (data.target / 1024).toFixed(0);
            const status = data.withinTarget ? '✓' : '✗';
            const color = data.withinTarget ? 'green' : 'red';
            log(`  ${status} ${data.description}: ${sizeKB}KB (target: <${targetKB}KB)`, color);

            if (data.withinTarget) passed++; else failed++;
        }
    }

    log('\n⚡ Load Times:', 'cyan');
    for (const [widget, data] of Object.entries(currentMetrics.loadTimes)) {
        if (!data.error) {
            log(`  • ${widget}: ${data.loadTime}ms`);
        }
    }

    // Baseline mode - save and exit
    if (isBaselineMode) {
        saveBaseline(currentMetrics);
        log('\n✅ Baseline metrics saved!', 'green');
        log('   Run without "baseline" argument to check for regressions', 'yellow');
        return;
    }

    // Regression detection
    const baseline = loadBaseline();
    if (!baseline) {
        log('\n⚠️  No baseline found', 'yellow');
        log('   Run with "baseline" argument to set baseline:', 'yellow');
        log('   node performance-regression.js baseline', 'yellow');
        return;
    }

    log('\n🔍 Checking for Regressions...', 'cyan');
    log('─'.repeat(40), 'cyan');
    log(`   Baseline: ${new Date(baseline.timestamp).toLocaleString()}`);

    const { regressions, improvements } = detectRegressions(currentMetrics, baseline);

    if (regressions.length > 0) {
        log('\n❌ Performance Regressions Detected:', 'red');
        regressions.forEach(r => {
            log(`  ✗ ${r.widget} ${r.type}: ${r.baseline} → ${r.current} (+${r.increase})`, 'red');
            failed++;
        });
    } else {
        log('\n✓ No performance regressions detected', 'green');
        passed++;
    }

    if (improvements.length > 0) {
        log('\n🎉 Performance Improvements:', 'green');
        improvements.forEach(i => {
            log(`  ✓ ${i.widget} ${i.type}: ${i.reduction} improvement`, 'green');
        });
    }

    // Summary
    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Metrics Checked: ${Object.keys(currentMetrics.bundles).length + 1}`, 'white');
    log(`  Regressions: ${regressions.length}`, regressions.length > 0 ? 'red' : 'green');
    log(`  Improvements: ${improvements.length}`, 'green');
    log('═'.repeat(40), 'cyan');

    if (regressions.length > 0) {
        log('\n❌ Performance regression detected!', 'red');
        process.exit(1);
    } else {
        log('\n✅ Performance targets met!', 'green');
    }
}

runPerformanceTests().catch(err => {
    log(`\n❌ Fatal error: ${err.message}`, 'red');
    process.exit(1);
});
