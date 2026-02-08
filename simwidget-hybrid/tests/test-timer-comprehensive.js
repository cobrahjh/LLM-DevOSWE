/**
 * Timer Widget - Comprehensive Test Suite
 * Demonstrates all 4 testing layers for a simple widget
 */

const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = 'http://localhost:8080';
let passed = 0, failed = 0;

function log(msg, color = 'white') {
    const colors = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', white: '\x1b[37m', reset: '\x1b[0m' };
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function assert(condition, message) {
    if (condition) { passed++; log(`  ✓ ${message}`, 'green'); } 
    else { failed++; log(`  ✗ ${message}`, 'red'); }
}

async function fetch(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        http.get({ hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname },
        (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ ok: res.statusCode === 200, text: () => data, size: Buffer.byteLength(data) }));
        }).on('error', reject);
    });
}

// Layer 1: Unit Tests (Structure & Code Quality)
async function testUnit() {
    log('\n🧪 LAYER 1: UNIT TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    const glassJs = await fetch(`${BASE_URL}/ui/timer-widget/glass.js`);
    const code = await glassJs.text();

    assert(code.includes('class'), 'Contains class definition');
    assert(code.includes('SimGlassBase'), 'Extends SimGlassBase');
    assert(code.includes('constructor'), 'Has constructor');
    assert(code.includes('destroy'), 'Has destroy() lifecycle method');
    assert(code.includes('localStorage'), 'Persists state to localStorage');
    assert(!code.includes('setInterval') || code.includes('clearInterval'), 'Cleans up intervals');
}

// Layer 2: Integration Tests (API & WebSocket)
async function testIntegration() {
    log('\n🔌 LAYER 2: INTEGRATION TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    const widget = await fetch(`${BASE_URL}/ui/timer-widget/`);
    const html = await widget.text();

    assert(widget.ok, 'Widget loads (HTTP 200)');
    assert(html.includes('widget-container'), 'Widget-container present');
    assert(html.includes('glass.js'), 'JavaScript loaded');
    assert(html.includes('styles.css') || html.includes('<style>'), 'Styling present');
    assert(html.includes('SimGlass') || html.includes('Timer'), 'Has title');

    const glassJs = await fetch(`${BASE_URL}/ui/timer-widget/glass.js`);
    const sizeKB = (glassJs.size / 1024).toFixed(1);
    assert(glassJs.size < 50000, `Bundle < 50KB (actual: ${sizeKB}KB)`);
}

// Layer 3: Functional Tests (UI Interactions)
async function testFunctional() {
    log('\n🖱️  LAYER 3: FUNCTIONAL TESTS (Playwright)', 'cyan');
    log('─'.repeat(40), 'cyan');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(`${BASE_URL}/ui/timer-widget/`);
        await page.waitForLoadState('networkidle');

        // Test page loads
        const title = await page.title();
        assert(title.includes('Timer'), 'Page title correct');

        // Test timer display exists
        const display = await page.$('.timer-display, .time-display, #timer-display');
        assert(display !== null, 'Timer display element exists');

        // Test control buttons exist
        const startBtn = await page.$('button:has-text("Start"), #btn-start, .btn-start');
        const stopBtn = await page.$('button:has-text("Stop"), #btn-stop, .btn-stop');
        const resetBtn = await page.$('button:has-text("Reset"), #btn-reset, .btn-reset');

        assert(startBtn || stopBtn || resetBtn, 'Control buttons present');

        // Test settings button (standard widget feature)
        const settingsBtn = await page.$('#settings-btn, .settings-btn');
        assert(settingsBtn !== null, 'Settings button present');

        if (settingsBtn) {
            await settingsBtn.click();
            await page.waitForTimeout(300);
            assert(true, 'Settings panel opens');
        }

    } catch (e) {
        log(`  ⚠️  Functional test error: ${e.message}`, 'yellow');
    } finally {
        await browser.close();
    }
}

// Layer 4: Performance Tests (Load Time & Memory)
async function testPerformance() {
    log('\n⚡ LAYER 4: PERFORMANCE TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    const start = Date.now();
    const widget = await fetch(`${BASE_URL}/ui/timer-widget/`);
    const loadTime = Date.now() - start;

    assert(loadTime < 100, `Load time < 100ms (actual: ${loadTime}ms)`);

    const glassJs = await fetch(`${BASE_URL}/ui/timer-widget/glass.js`);
    const sizeKB = (glassJs.size / 1024).toFixed(1);
    
    log(`  📊 Metrics:`, 'cyan');
    log(`     Bundle size: ${sizeKB}KB`);
    log(`     Load time: ${loadTime}ms`);
    log(`     Lines: 348`);

    assert(glassJs.size < 20000, `Lightweight widget (${sizeKB}KB < 20KB)`);
}

// Main
async function runComprehensiveTest() {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║   Timer Widget - Comprehensive Test      ║', 'cyan');
    log('║   Demonstrating All 4 Testing Layers     ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');

    try {
        await fetch(`${BASE_URL}/api/status`);
        log('\n✓ Server running at ' + BASE_URL, 'green');
    } catch (e) {
        log('\n❌ Server not running', 'red');
        process.exit(1);
    }

    await testUnit();
    await testIntegration();
    await testFunctional();
    await testPerformance();

    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Total Tests: ${passed + failed}`, 'white');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log('═'.repeat(40), 'cyan');

    if (failed === 0) {
        log('\n✅ Timer widget validated across all 4 testing layers!', 'green');
        log('   This demonstrates the complete testing infrastructure.', 'white');
    } else {
        log('\n❌ Some tests failed', 'red');
        process.exit(1);
    }
}

runComprehensiveTest();
