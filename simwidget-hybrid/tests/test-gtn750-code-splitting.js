/**
 * GTN750 Code Splitting Tests v1.0.0
 *
 * Tests lazy loading implementation for GTN750 glass
 * Validates module loading strategy and performance
 *
 * Usage:
 *   node test-gtn750-code-splitting.js
 *
 * Path: C:\LLM-DevOSWE\simwidget-hybrid\tests\test-gtn750-code-splitting.js
 * Created: 2026-02-07
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:8080';
const GTN750_BASE = `${API_BASE}/ui/gtn750`;

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
// GTN750 CODE SPLITTING TESTS
// ============================================

async function testCriticalModulesAccessible() {
    log('\n📦 Critical Modules (Immediate Load)', 'cyan');
    log('─'.repeat(40), 'cyan');

    const critical = [
        '/ui/shared/module-loader.js',
        '/ui/gtn750/modules/gtn-core.js',
        '/ui/gtn750/modules/gtn-data-fields.js',
        '/ui/gtn750/modules/gtn-cdi.js',
        '/ui/gtn750/modules/gtn-map-renderer.js',
        '/ui/gtn750/modules/gtn-pages.js',
        '/ui/gtn750/modules/gtn-softkeys.js',
        '/ui/gtn750/glass.js'
    ];

    for (const module of critical) {
        try {
            const res = await fetch(`${API_BASE}${module}`);
            assert(res.ok, `${path.basename(module)} accessible (HTTP ${res.status})`);
        } catch (e) {
            assert(false, `${path.basename(module)} - ${e.message}`);
        }
    }
}

async function testDeferredModulesAccessible() {
    log('\n⏱️  Deferred Modules (500ms delay)', 'cyan');
    log('─'.repeat(40), 'cyan');

    const deferred = [
        '/ui/gtn750/modules/gtn-data-handler.js',
        '/ui/gtn750/modules/gtn-simvar-handler.js',
        '/ui/gtn750/overlays/terrain-overlay.js',
        '/ui/gtn750/overlays/traffic-overlay.js',
        '/ui/gtn750/overlays/weather-overlay.js',
        '/ui/gtn750/overlays/map-controls.js'
    ];

    for (const module of deferred) {
        try {
            const res = await fetch(`${API_BASE}${module}`);
            assert(res.ok, `${path.basename(module)} accessible (HTTP ${res.status})`);
        } catch (e) {
            assert(false, `${path.basename(module)} - ${e.message}`);
        }
    }
}

async function testLazyModulesAccessible() {
    log('\n🔄 Lazy-Loaded Modules (On-demand)', 'cyan');
    log('─'.repeat(40), 'cyan');

    const lazy = [
        '/ui/gtn750/modules/gtn-flight-plan.js',
        '/ui/gtn750/pages/page-proc.js',
        '/ui/gtn750/pages/page-charts.js',
        '/ui/gtn750/pages/page-nrst.js',
        '/ui/gtn750/pages/page-aux.js',
        '/ui/gtn750/pages/page-system.js'
    ];

    for (const module of lazy) {
        try {
            const res = await fetch(`${API_BASE}${module}`);
            assert(res.ok, `${path.basename(module)} accessible (HTTP ${res.status})`);
        } catch (e) {
            assert(false, `${path.basename(module)} - ${e.message}`);
        }
    }
}

async function testIndexHtmlStructure() {
    log('\n📄 index.html Structure', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        const res = await fetch(`${GTN750_BASE}/`);
        const html = await res.text();

        // Check module-loader.js is included
        assert(
            html.includes('module-loader.js'),
            'ModuleLoader script included in HTML'
        );

        // Check glass.js is included
        assert(
            html.includes('glass.js'),
            'glass.js included in HTML'
        );

        // Check that lazy-loaded modules are NOT in HTML
        const shouldNotBeInHTML = [
            'gtn-flight-plan.js',
            'gtn-data-handler.js',
            'page-proc.js',
            'page-charts.js'
        ];

        shouldNotBeInHTML.forEach(module => {
            assert(
                !html.includes(module),
                `${module} NOT in HTML (lazy-loaded) ✓`
            );
        });

        // Count script tags (should be reduced)
        const scriptMatches = html.match(/<script[^>]+src=[^>]+><\/script>/g) || [];
        const scriptCount = scriptMatches.length;
        log(`  📊 Total script tags in HTML: ${scriptCount}`, scriptCount <= 12 ? 'green' : 'yellow');
        assert(scriptCount <= 12, `Script count ${scriptCount} <= 12 (reduced from 17)`);

    } catch (e) {
        assert(false, `index.html check - ${e.message}`);
    }
}

async function testGlassJsImplementation() {
    log('\n🔧 glass.js Implementation', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        const glassPath = path.join(__dirname, '../ui/gtn750/glass.js');
        const content = fs.readFileSync(glassPath, 'utf8');

        // Check version
        assert(
            content.includes('v2.1.0') || content.includes('Code Splitting'),
            'Version includes code splitting reference'
        );

        // Check ModuleLoader initialization
        assert(
            content.includes('new ModuleLoader'),
            'ModuleLoader initialized in constructor'
        );

        // Check lazy loading methods exist
        const methods = [
            'loadDataHandler',
            'loadFlightPlan',
            'loadOverlays',
            'loadPageModule',
            'deferredInit'
        ];

        methods.forEach(method => {
            assert(
                content.includes(`${method}(`),
                `Method ${method}() exists`
            );
        });

        // Check for null-safe optional chaining
        assert(
            content.includes('flightPlanManager?.'),
            'Null-safe optional chaining used for flightPlanManager'
        );

        assert(
            content.includes('if (this.dataHandler)') || content.includes('dataHandler)'),
            'Null-safe check for dataHandler'
        );

        // Check loadedModules tracking
        assert(
            content.includes('loadedModules'),
            'loadedModules tracking object exists'
        );

    } catch (e) {
        assert(false, `glass.js validation - ${e.message}`);
    }
}

async function testModuleLoaderUtility() {
    log('\n🛠️  ModuleLoader Utility', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        const loaderPath = path.join(__dirname, '../ui/shared/module-loader.js');
        const content = fs.readFileSync(loaderPath, 'utf8');

        // Check class definition
        assert(
            content.includes('class ModuleLoader'),
            'ModuleLoader class defined'
        );

        // Check key methods
        const methods = ['load', 'loadMultiple', 'loadDeferred', 'preload', 'clearCache'];
        methods.forEach(method => {
            assert(
                content.includes(`${method}(`),
                `Method ${method}() exists`
            );
        });

        // Check caching implementation
        assert(
            content.includes('this.cache') && content.includes('Map'),
            'Caching mechanism implemented'
        );

        // Check timeout handling
        assert(
            content.includes('timeout'),
            'Timeout handling implemented'
        );

        // Check telemetry integration
        assert(
            content.includes('telemetry'),
            'Telemetry integration included'
        );

    } catch (e) {
        assert(false, `ModuleLoader validation - ${e.message}`);
    }
}

async function testPageModuleMapping() {
    log('\n🗺️  Page Module Mapping', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        const glassPath = path.join(__dirname, '../ui/gtn750/glass.js');
        const content = fs.readFileSync(glassPath, 'utf8');

        // Check loadPageModule has correct mappings
        const expectedMappings = [
            ['proc', 'pages/page-proc.js'],
            ['charts', 'pages/page-charts.js'],
            ['nrst', 'pages/page-nrst.js'],
            ['aux', 'pages/page-aux.js'],
            ['system', 'pages/page-system.js']
        ];

        expectedMappings.forEach(([pageId, modulePath]) => {
            assert(
                content.includes(pageId) && content.includes(modulePath),
                `Mapping: ${pageId} → ${modulePath}`
            );
        });

    } catch (e) {
        assert(false, `Page module mapping - ${e.message}`);
    }
}

async function testPerformanceMetrics() {
    log('\n📊 Performance Metrics', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        // Measure index.html load time
        const start = Date.now();
        const res = await fetch(`${GTN750_BASE}/`);
        const loadTime = Date.now() - start;

        assert(
            res.ok,
            `GTN750 loads successfully (${loadTime}ms)`
        );

        assert(
            loadTime < 500,
            `Load time ${loadTime}ms < 500ms target`
        );

        // Count total file sizes (critical vs all)
        const criticalModules = [
            'modules/gtn-core.js',
            'modules/gtn-data-fields.js',
            'modules/gtn-cdi.js',
            'modules/gtn-map-renderer.js'
        ];

        let criticalSize = 0;
        for (const module of criticalModules) {
            const res = await fetch(`${GTN750_BASE}/${module}`);
            const body = await res.text();
            criticalSize += Buffer.byteLength(body, 'utf8');
        }

        log(`  📦 Critical modules size: ${(criticalSize / 1024).toFixed(1)}KB`, 'cyan');

    } catch (e) {
        assert(false, `Performance metrics - ${e.message}`);
    }
}

// ============================================
// MAIN
// ============================================

async function runTests() {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║   GTN750 Code Splitting Tests v1.0.0    ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');

    const startTime = Date.now();

    // Check server
    try {
        await fetch(`${API_BASE}/api/status`);
        log('\n✓ Server running at ' + API_BASE, 'green');
    } catch (e) {
        log('\n❌ Server not running at ' + API_BASE, 'red');
        log('   Start server first with: node backend/server.js', 'yellow');
        process.exit(1);
    }

    // Run tests
    await testCriticalModulesAccessible();
    await testDeferredModulesAccessible();
    await testLazyModulesAccessible();
    await testIndexHtmlStructure();
    await testGlassJsImplementation();
    await testModuleLoaderUtility();
    await testPageModuleMapping();
    await testPerformanceMetrics();

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`  Time:   ${duration}s`);
    log('═'.repeat(40), 'cyan');

    if (failed > 0) {
        log('\n❌ Some tests failed', 'red');
        log('   Review errors above and fix implementation', 'yellow');
        process.exit(1);
    } else {
        log('\n✅ All tests passed! Code splitting verified.', 'green');
        log('   GTN750 v2.1.0 lazy loading working correctly.', 'green');
    }
}

runTests();
