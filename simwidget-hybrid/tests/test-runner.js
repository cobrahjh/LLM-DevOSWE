/**
 * SimGlass Test Framework v1.0.0
 * 
 * Automated testing for API, WebSocket, and widget components
 * 
 * Usage:
 *   node test-runner.js           - Run all tests
 *   node test-runner.js api       - Run API tests only
 *   node test-runner.js websocket - Run WebSocket tests only
 *   node test-runner.js widgets   - Run widget tests only
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\tests\test-runner.js
 * Last Updated: 2025-01-07
 */

const http = require('http');
const WebSocket = require('ws');

const API_BASE = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080';

let passed = 0;
let failed = 0;

// ============================================
// TEST UTILITIES
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

async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (options.body) {
            reqOptions.headers['Content-Type'] = 'application/json';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => { try { return JSON.parse(data); } catch { return null; } },
                    text: () => data
                });
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
        if (options.body) req.write(options.body);
        req.end();
    });
}

// ============================================
// API TESTS
// ============================================

async function testAPI() {
    log('\n📡 API TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    // GET /api/status
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        assert(res.ok, 'GET /api/status returns 200');
        const data = res.json();
        assert(data && 'connected' in data, '/api/status has connected field');
        assert(data && 'flightData' in data, '/api/status has flightData field');
    } catch (e) {
        assert(false, `GET /api/status - ${e.message}`);
    }

    // GET /api/keymaps
    try {
        const res = await fetch(`${API_BASE}/api/keymaps`);
        assert(res.ok, 'GET /api/keymaps returns 200');
    } catch (e) {
        assert(false, `GET /api/keymaps - ${e.message}`);
    }

    // POST /api/command
    try {
        const res = await fetch(`${API_BASE}/api/command`, {
            method: 'POST',
            body: JSON.stringify({ command: 'TEST', value: 0 })
        });
        assert(res.ok, 'POST /api/command accepts requests');
    } catch (e) {
        assert(false, `POST /api/command - ${e.message}`);
    }

    // POST /api/sendkey
    try {
        const res = await fetch(`${API_BASE}/api/sendkey`, {
            method: 'POST',
            body: JSON.stringify({ key: 'TEST' })
        });
        assert(res.ok, 'POST /api/sendkey accepts requests');
    } catch (e) {
        assert(false, `POST /api/sendkey - ${e.message}`);
    }

    // GET /api/camsys/status
    try {
        const res = await fetch(`${API_BASE}/api/camsys/status`);
        assert(res.ok, 'GET /api/camsys/status returns 200');
    } catch (e) {
        assert(false, `GET /api/camsys/status - ${e.message}`);
    }

    // GET /api/debug/keysender
    try {
        const res = await fetch(`${API_BASE}/api/debug/keysender`);
        assert(res.ok, 'GET /api/debug/keysender returns 200');
    } catch (e) {
        assert(false, `GET /api/debug/keysender - ${e.message}`);
    }

    // POST /api/recorder/slew
    try {
        const res = await fetch(`${API_BASE}/api/recorder/slew`, {
            method: 'POST',
            body: JSON.stringify({ enabled: false })
        });
        assert(res.status !== 404, 'POST /api/recorder/slew endpoint exists');
    } catch (e) {
        assert(false, `POST /api/recorder/slew - ${e.message}`);
    }

    // POST /api/recorder/position
    try {
        const res = await fetch(`${API_BASE}/api/recorder/position`, {
            method: 'POST',
            body: JSON.stringify({ lat: 0, lon: 0, alt: 0, hdg: 0 })
        });
        assert(res.status !== 404, 'POST /api/recorder/position endpoint exists');
    } catch (e) {
        assert(false, `POST /api/recorder/position - ${e.message}`);
    }
}

// ============================================
// WEBSOCKET TESTS
// ============================================

async function testWebSocket() {
    log('\n🔌 WEBSOCKET TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    return new Promise((resolve) => {
        let ws;
        const timeout = setTimeout(() => {
            assert(false, 'WebSocket connection timeout');
            if (ws) ws.close();
            resolve();
        }, 5000);

        try {
            ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                assert(true, 'WebSocket connects successfully');
            });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    assert(true, 'WebSocket receives valid JSON');
                    
                    if (msg.type === 'flightData') {
                        assert(true, 'Receives flightData message');
                        const fd = msg.data;
                        assert('altitude' in fd, 'flightData.altitude exists');
                        assert('speed' in fd, 'flightData.speed exists');
                        assert('heading' in fd, 'flightData.heading exists');
                        assert('latitude' in fd, 'flightData.latitude exists');
                        assert('longitude' in fd, 'flightData.longitude exists');
                    }
                } catch (e) {
                    assert(false, `WebSocket JSON parse error`);
                }

                clearTimeout(timeout);
                ws.close();
                resolve();
            });

            ws.on('error', (err) => {
                assert(false, `WebSocket error - ${err.message}`);
                clearTimeout(timeout);
                resolve();
            });

        } catch (e) {
            assert(false, `WebSocket connect - ${e.message}`);
            clearTimeout(timeout);
            resolve();
        }
    });
}

// ============================================
// WIDGET TESTS
// ============================================

async function testWidgets() {
    log('\n🧩 WIDGET TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    const widgets = [
        // Control & Automation
        'aircraft-control',
        'autopilot',
        'voice-control',

        // Flight Planning & Navigation
        'flightplan-widget',
        'gtn750',
        'map-widget',
        'navigraph-widget',
        'simbrief-widget',
        'holding-calc',

        // Flight Data & Monitoring
        'flight-data-widget',
        'flight-dashboard',
        'flight-recorder',
        'flightlog-widget',
        'flight-log',
        'landing-widget',
        'performance-widget',
        'replay-debrief',

        // Aircraft Systems
        'engine-monitor',
        'fuel-widget',
        'fuel-monitor',
        'fuel-planner',
        'health-dashboard',
        'weight-balance',
        'failures-widget',

        // ATC & Communication
        'atc-widget',
        'copilot-widget',
        'flight-instructor',
        'multiplayer-widget',
        'traffic-widget',
        'voice-stress',

        // Weather & Environment
        'environment',
        'metar-widget',
        'weather-widget',

        // Camera & Media
        'camera-widget',
        'wasm-camera',
        'video-viewer',

        // Utilities & Tools
        'charts-widget',
        'checklist-widget',
        'checklist-maker',
        'kneeboard-widget',
        'notepad-widget',
        'timer-widget',

        // System & Configuration
        'dashboard',
        'keymap-editor',
        'panel-launcher',
        'performance-monitor',
        'plugin-manager',
        'services-panel',
        'toolbar-panel',

        // UI Components
        'interaction-wheel',
        'mobile-companion',
        'otto-search',
        'radio-stack',
        'tinywidgets'
    ];

    let totalLoadTime = 0;
    let slowestWidget = { name: '', time: 0 };

    for (const widget of widgets) {
        try {
            const startTime = Date.now();
            const res = await fetch(`${API_BASE}/ui/${widget}/`);
            const loadTime = Date.now() - startTime;
            totalLoadTime += loadTime;

            if (loadTime > slowestWidget.time) {
                slowestWidget = { name: widget, time: loadTime };
            }

            assert(res.ok, `Widget /${widget}/ accessible (${loadTime}ms)`);

            // Validate HTML content
            if (res.ok) {
                const html = await res.text();

                // Check for essential widget elements
                const hasWidgetContainer = html.includes('widget-container') ||
                                          html.includes('class="container"');
                const hasWidgetJS = html.includes('widget.js') ||
                                   html.includes('.js');
                const hasTitle = html.includes('<title>') &&
                                html.includes('SimGlass');

                if (!hasWidgetContainer) {
                    log(`    ⚠ ${widget}: Missing widget-container class`, 'yellow');
                }
                if (!hasWidgetJS) {
                    log(`    ⚠ ${widget}: No widget.js script found`, 'yellow');
                }
                if (!hasTitle) {
                    log(`    ⚠ ${widget}: Missing or invalid <title>`, 'yellow');
                }
            }
        } catch (e) {
            assert(false, `Widget ${widget} - ${e.message}`);
        }
    }

    // Summary statistics
    const avgLoadTime = Math.round(totalLoadTime / widgets.length);
    log(`\n  📊 Widget Statistics:`, 'cyan');
    log(`     Average load time: ${avgLoadTime}ms`);
    log(`     Slowest widget: ${slowestWidget.name} (${slowestWidget.time}ms)`);
    log(`     Total widgets: ${widgets.length}`);

    // Shared resources
    log(`\n  🔧 Testing Shared Resources:`, 'cyan');
    const sharedResources = [
        'widget-base.js',
        'widget-common.css',
        'telemetry.js',
        'platform-utils.js',
        'themes.js',
        'settings-panel.js'
    ];

    for (const resource of sharedResources) {
        try {
            const res = await fetch(`${API_BASE}/ui/shared/${resource}`);
            const body = await res.text();
            const size = Buffer.byteLength(body, 'utf8');
            assert(res.ok, `Shared: ${resource} (${(size / 1024).toFixed(1)}KB)`);
        } catch (e) {
            assert(false, `Shared ${resource} - ${e.message}`);
        }
    }
}

// ============================================
// MAIN
// ============================================

async function runTests(suite) {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║     SimGlass Test Framework v1.0.0       ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');

    const startTime = Date.now();

    // Check server
    try {
        await fetch(`${API_BASE}/api/status`);
        log('\n✓ Server running at ' + API_BASE, 'green');
    } catch (e) {
        log('\n❌ Server not running at ' + API_BASE, 'red');
        log('   Start server first: npm start', 'yellow');
        process.exit(1);
    }

    // Run tests
    if (!suite || suite === 'api') await testAPI();
    if (!suite || suite === 'websocket') await testWebSocket();
    if (!suite || suite === 'widgets') await testWidgets();

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`  Time:   ${duration}s`);
    log('═'.repeat(40), 'cyan');

    if (failed > 0) {
        log('\n❌ Some tests failed', 'red');
        process.exit(1);
    } else {
        log('\n✅ All tests passed!', 'green');
    }
}

const suite = process.argv[2];
if (suite && !['api', 'websocket', 'widgets'].includes(suite)) {
    log('Usage: node test-runner.js [api|websocket|widgets]', 'yellow');
    process.exit(1);
}

runTests(suite);
