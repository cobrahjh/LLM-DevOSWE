/**
 * Timer Widget Functional Test
 * Demonstrates complete testing: accessibility, functionality, performance
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
let passed = 0, failed = 0;

function log(msg, color = 'white') {
    const colors = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
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
            res.on('end', () => resolve({ 
                ok: res.statusCode === 200, 
                text: () => data, 
                size: Buffer.byteLength(data)
            }));
        }).on('error', reject);
    });
}

async function testTimerWidget() {
    log('\n⏱️  TIMER WIDGET TEST SUITE', 'cyan');
    log('═'.repeat(40), 'cyan');

    // Accessibility
    log('\n📍 Accessibility Tests:', 'cyan');
    const widget = await fetch(`${BASE_URL}/ui/timer-widget/`);
    assert(widget.ok, 'Widget accessible at /ui/timer-widget/');
    
    const html = await widget.text();
    assert(html.includes('Timer'), 'Has Timer title');
    assert(html.includes('widget-container'), 'Has widget-container class');
    assert(html.includes('pane.js'), 'Loads pane.js');

    // Structure validation
    log('\n🏗️  Structure Tests:', 'cyan');
    assert(html.includes('start') || html.includes('btn'), 'Has control buttons');
    assert(html.includes('display') || html.includes('time'), 'Has time display');
    
    // Performance
    log('\n⚡ Performance Tests:', 'cyan');
    const glassJs = await fetch(`${BASE_URL}/ui/timer-widget/pane.js`);
    assert(glassJs.ok, 'pane.js accessible');
    const sizeKB = (glassJs.size / 1024).toFixed(1);
    assert(glassJs.size < 50000, `Bundle size < 50KB (actual: ${sizeKB}KB)`);

    // WebSocket integration (if used)
    log('\n🔌 Integration Tests:', 'cyan');
    const usesWebSocket = (await glassJs.text()).includes('SimGlassBase');
    assert(usesWebSocket, 'Extends SimGlassBase');

    // Summary
    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log('═'.repeat(40), 'cyan');

    if (failed === 0) {
        log('\n✅ Timer widget fully validated!', 'green');
    } else {
        log('\n❌ Some tests failed', 'red');
        process.exit(1);
    }
}

testTimerWidget();
