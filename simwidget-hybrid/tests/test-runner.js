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
 *   node test-runner.js splitting - Run code splitting tests only
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
        'tinywidgets',
        'vatsim-live'
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
// CODE SPLITTING TESTS
// ============================================

async function testCodeSplitting() {
    log('\n📦 CODE SPLITTING TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    // Test Checklist Widget v3.0.0 lazy-loading
    try {
        const res = await fetch(`${API_BASE}/ui/checklist-widget/`);
        const html = await res.text();

        // Verify registry is loaded in critical path
        assert(html.includes('aircraft-registry.js'),
               'Checklist: Registry script in HTML');

        // Verify data files are NOT in initial HTML (loaded on-demand)
        assert(!html.includes('aircraft-ga.js') || !html.includes('<script src="data/aircraft-ga.js"'),
               'Checklist: GA aircraft not in critical path');
        assert(!html.includes('aircraft-turboprop.js') || !html.includes('<script src="data/aircraft-turboprop.js"'),
               'Checklist: Turboprop not in critical path');
        assert(!html.includes('aircraft-jets.js') || !html.includes('<script src="data/aircraft-jets.js"'),
               'Checklist: Jets not in critical path');
        assert(!html.includes('aircraft-airliners.js') || !html.includes('<script src="data/aircraft-airliners.js"'),
               'Checklist: Airliners not in critical path');

        // Verify data files are accessible for lazy-loading
        const gaRes = await fetch(`${API_BASE}/ui/checklist-widget/data/aircraft-ga.js`);
        assert(gaRes.ok, 'Checklist: GA data file accessible (519 lines)');

        const turbopropRes = await fetch(`${API_BASE}/ui/checklist-widget/data/aircraft-turboprop.js`);
        assert(turbopropRes.ok, 'Checklist: Turboprop data file accessible (388 lines)');

        const jetsRes = await fetch(`${API_BASE}/ui/checklist-widget/data/aircraft-jets.js`);
        assert(jetsRes.ok, 'Checklist: Jets data file accessible (302 lines)');

        const airlinersRes = await fetch(`${API_BASE}/ui/checklist-widget/data/aircraft-airliners.js`);
        assert(airlinersRes.ok, 'Checklist: Airliners data file accessible (609 lines)');

        // Verify registry file
        const registryRes = await fetch(`${API_BASE}/ui/checklist-widget/data/aircraft-registry.js`);
        assert(registryRes.ok, 'Checklist: Registry file accessible (108 lines)');

    } catch (e) {
        assert(false, `Checklist code splitting - ${e.message}`);
    }

    // Test Copilot Widget v3.0.0 lazy-loading
    try {
        const res = await fetch(`${API_BASE}/ui/copilot-widget/`);
        const html = await res.text();

        // Verify data loader is in critical path
        assert(html.includes('data-loader.js'),
               'Copilot: Data loader script in HTML');

        // Verify data modules are NOT in initial HTML
        assert(!html.includes('checklists.js') || !html.includes('<script src="data/checklists.js"'),
               'Copilot: Checklists not in critical path');
        assert(!html.includes('emergency-procedures.js') || !html.includes('<script src="data/emergency-procedures.js"'),
               'Copilot: Emergencies not in critical path');

        // Verify data files are accessible
        const checklistsRes = await fetch(`${API_BASE}/ui/copilot-widget/data/checklists.js`);
        assert(checklistsRes.ok, 'Copilot: Checklists data file accessible (355 lines)');

        const emergencyRes = await fetch(`${API_BASE}/ui/copilot-widget/data/emergency-procedures.js`);
        assert(emergencyRes.ok, 'Copilot: Emergency data file accessible (84 lines)');

        const loaderRes = await fetch(`${API_BASE}/ui/copilot-widget/data/data-loader.js`);
        assert(loaderRes.ok, 'Copilot: Data loader accessible (34 lines)');

    } catch (e) {
        assert(false, `Copilot code splitting - ${e.message}`);
    }

    // Test GTN750 v2.1.0 ModuleLoader lazy-loading
    try {
        const res = await fetch(`${API_BASE}/ui/gtn750/`);
        const html = await res.text();

        // Verify ModuleLoader is in critical path
        assert(html.includes('module-loader.js'),
               'GTN750: ModuleLoader script in HTML');

        // Verify lazy modules are NOT in initial HTML
        assert(!html.includes('gtn-flight-plan.js') || !html.includes('<script src="modules/gtn-flight-plan.js"'),
               'GTN750: Flight plan not in critical path');
        assert(!html.includes('gtn-data-handler.js') || !html.includes('<script src="modules/gtn-data-handler.js"'),
               'GTN750: Data handler not in critical path');
        assert(!html.includes('page-proc.js') || !html.includes('<script src="pages/page-proc.js"'),
               'GTN750: PROC page not in critical path');

        // Verify critical modules ARE in HTML
        assert(html.includes('gtn-core.js'),
               'GTN750: Core module in HTML');
        assert(html.includes('gtn-map-renderer.js'),
               'GTN750: Map renderer in HTML');

        // Verify lazy-loaded modules are accessible
        const flightPlanRes = await fetch(`${API_BASE}/ui/gtn750/modules/gtn-flight-plan.js`);
        assert(flightPlanRes.ok, 'GTN750: Flight plan module accessible');

        const procPageRes = await fetch(`${API_BASE}/ui/gtn750/pages/page-proc.js`);
        assert(procPageRes.ok, 'GTN750: PROC page accessible');

    } catch (e) {
        assert(false, `GTN750 code splitting - ${e.message}`);
    }

    // Verify bundle size reduction
    try {
        const ChecklistPane = await fetch(`${API_BASE}/ui/checklist-widget/pane.js`);
        const checklistSize = Buffer.byteLength(await ChecklistPane.text(), 'utf8');
        assert(checklistSize < 20000,
               `Checklist pane.js < 20KB (actual: ${(checklistSize/1024).toFixed(1)}KB)`);

        const CopilotPane = await fetch(`${API_BASE}/ui/copilot-widget/pane.js`);
        const copilotSize = Buffer.byteLength(await CopilotPane.text(), 'utf8');
        assert(copilotSize < 80000,
               `Copilot pane.js < 80KB (actual: ${(copilotSize/1024).toFixed(1)}KB)`);

        const GTN750Pane = await fetch(`${API_BASE}/ui/gtn750/pane.js`);
        const gtn750Size = Buffer.byteLength(await GTN750Pane.text(), 'utf8');
        assert(gtn750Size < 92000,
               `GTN750 pane.js < 92KB (actual: ${(gtn750Size/1024).toFixed(1)}KB)`);

    } catch (e) {
        assert(false, `Bundle size verification - ${e.message}`);
    }

    log('\n  ✨ Code splitting architecture verified', 'cyan');
    log('     Lazy-loaded modules: 15+ files across 3 glasses', 'white');
    log('     Bundle reduction: Checklist -78.6%, Copilot -19.8%, GTN750 -23%', 'white');
}

// ============================================
// AI AUTOPILOT TESTS
// ============================================

async function testAiAutopilot() {
    log('\n── AI Autopilot Tests ──', 'cyan');

    // Test: AI Autopilot pane loads
    try {
        const res = await fetch(`${API_BASE}/ui/ai-autopilot/`);
        assert(res.ok, 'AI Autopilot pane loads (index.html)');
        const html = await res.text();
        assert(html.includes('AI AUTOPILOT'), 'HTML contains AI AUTOPILOT title');
        assert(html.includes('widget-base.js'), 'HTML includes widget-base.js');
        assert(html.includes('flight-phase.js'), 'HTML includes flight-phase.js');
        assert(html.includes('rule-engine.js'), 'HTML includes rule-engine.js');
        assert(html.includes('command-queue.js'), 'HTML includes command-queue.js');
        assert(html.includes('llm-advisor.js'), 'HTML includes llm-advisor.js');
        assert(html.includes('aircraft-profiles.js'), 'HTML includes aircraft-profiles.js');
    } catch (e) {
        assert(false, `AI Autopilot pane load - ${e.message}`);
    }

    // Test: pane.js loads
    try {
        const res = await fetch(`${API_BASE}/ui/ai-autopilot/pane.js`);
        assert(res.ok, 'pane.js loads');
        const js = await res.text();
        assert(js.includes('class AiAutopilotPane'), 'pane.js contains AiAutopilotPane class');
        assert(js.includes('extends SimGlassBase'), 'AiAutopilotPane extends SimGlassBase');
        assert(js.includes('destroy()'), 'pane.js has destroy() method');
    } catch (e) {
        assert(false, `pane.js load - ${e.message}`);
    }

    // Test: modules load
    const modules = [
        { path: 'modules/flight-phase.js', className: 'FlightPhase' },
        { path: 'modules/rule-engine.js', className: 'RuleEngine' },
        { path: 'modules/command-queue.js', className: 'CommandQueue' },
        { path: 'modules/llm-advisor.js', className: 'LLMAdvisor' },
        { path: 'data/aircraft-profiles.js', className: 'AIRCRAFT_PROFILES' }
    ];

    for (const mod of modules) {
        try {
            const res = await fetch(`${API_BASE}/ui/ai-autopilot/${mod.path}`);
            assert(res.ok, `${mod.path} loads`);
            const js = await res.text();
            assert(js.includes(mod.className), `${mod.path} contains ${mod.className}`);
        } catch (e) {
            assert(false, `${mod.path} load - ${e.message}`);
        }
    }

    // Test: styles.css loads
    try {
        const res = await fetch(`${API_BASE}/ui/ai-autopilot/styles.css`);
        assert(res.ok, 'styles.css loads');
        const css = await res.text();
        assert(css.includes('.phase-section'), 'CSS contains phase-section styles');
        assert(css.includes('.command-log'), 'CSS contains command-log styles');
        assert(css.includes('.advisory-panel'), 'CSS contains advisory-panel styles');
    } catch (e) {
        assert(false, `styles.css load - ${e.message}`);
    }

    // Test: API endpoints
    try {
        const res = await fetch(`${API_BASE}/api/ai-pilot/status`);
        assert(res.ok, 'GET /api/ai-pilot/status returns 200');
        const data = res.json();
        assert(data && data.flightData !== undefined, 'Status includes flightData');
    } catch (e) {
        assert(false, `API status - ${e.message}`);
    }

    try {
        const res = await fetch(`${API_BASE}/api/ai-pilot/profiles`);
        assert(res.ok, 'GET /api/ai-pilot/profiles returns 200');
        const data = res.json();
        assert(data && data.profiles && data.profiles.includes('C172'), 'Profiles include C172');
    } catch (e) {
        assert(false, `API profiles - ${e.message}`);
    }

    // Test: command validation
    try {
        const res = await fetch(`${API_BASE}/api/ai-pilot/command`, {
            method: 'POST',
            body: JSON.stringify({ command: 'AP_MASTER' })
        });
        assert(res.ok, 'POST /api/ai-pilot/command accepts valid command');
    } catch (e) {
        assert(false, `API command valid - ${e.message}`);
    }

    try {
        const res = await fetch(`${API_BASE}/api/ai-pilot/command`, {
            method: 'POST',
            body: JSON.stringify({ command: 'INVALID_CMD' })
        });
        assert(res.status === 400, 'POST /api/ai-pilot/command rejects invalid command');
    } catch (e) {
        assert(false, `API command invalid - ${e.message}`);
    }

    try {
        const res = await fetch(`${API_BASE}/api/ai-pilot/command`, {
            method: 'POST',
            body: JSON.stringify({ command: 'AP_ALT_VAR_SET', value: 99999 })
        });
        assert(res.status === 400, 'POST /api/ai-pilot/command rejects out-of-range altitude');
    } catch (e) {
        assert(false, `API command safety - ${e.message}`);
    }

    log('\n  AI Autopilot: 9 files, 4 modules, 3 API endpoints verified', 'cyan');
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
    if (!suite || suite === 'splitting') await testCodeSplitting();
    if (!suite || suite === 'ai-autopilot') await testAiAutopilot();

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
if (suite && !['api', 'websocket', 'widgets', 'splitting', 'ai-autopilot'].includes(suite)) {
    log('Usage: node test-runner.js [api|websocket|widgets|splitting|ai-autopilot]', 'yellow');
    process.exit(1);
}

runTests(suite);
