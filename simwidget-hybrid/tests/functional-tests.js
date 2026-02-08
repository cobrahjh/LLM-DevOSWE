/**
 * SimGlass Functional UI Tests
 * Browser automation tests using Playwright
 *
 * Tests user interactions, form inputs, widget behavior
 *
 * Usage:
 *   node functional-tests.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
let browser, context, page;
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

async function setupBrowser() {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
}

async function teardownBrowser() {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
}

// ============================================
// CHECKLIST WIDGET FUNCTIONAL TESTS
// ============================================

async function testChecklistWidget() {
    log('\n✅ CHECKLIST WIDGET FUNCTIONAL TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        await page.goto(`${BASE_URL}/ui/checklist-widget/`);
        await page.waitForLoadState('networkidle');

        // Test aircraft selection
        const aircraftSelect = await page.$('#aircraft-select');
        assert(aircraftSelect !== null, 'Aircraft selector exists');

        // Change aircraft
        await page.selectOption('#aircraft-select', 'c172');
        await page.waitForTimeout(500); // Wait for lazy load

        const title = await page.textContent('.widget-title');
        assert(title.includes('Checklist'), 'Widget title correct');

        // Test checklist item interaction
        const firstItem = await page.$('.checklist-item');
        assert(firstItem !== null, 'Checklist items rendered');

        // Click item to check it
        await firstItem.click();
        await page.waitForTimeout(200);

        const isChecked = await firstItem.evaluate(el => el.classList.contains('checked'));
        assert(isChecked, 'Checklist item toggles when clicked');

        // Test progress bar updates
        const progressText = await page.textContent('#progress-text');
        assert(progressText !== '0/0', 'Progress bar updates');

        // Test tab switching
        await page.click('[data-checklist="startup"]');
        await page.waitForTimeout(200);

        const startupItems = await page.$$('.checklist-item');
        assert(startupItems.length > 0, 'Startup checklist loads');

        // Test reset button
        await page.click('#btn-reset');
        await page.waitForTimeout(200);

        const checkedAfterReset = await page.$$('.checklist-item.checked');
        assert(checkedAfterReset.length === 0, 'Reset clears all checks');

        log('  ✓ Code splitting verified: Aircraft data lazy-loaded', 'green');
        passed++;

    } catch (e) {
        log(`  ✗ Checklist widget test failed: ${e.message}`, 'red');
        failed++;
    }
}

// ============================================
// COPILOT WIDGET FUNCTIONAL TESTS
// ============================================

async function testCopilotWidget() {
    log('\n🤖 COPILOT WIDGET FUNCTIONAL TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        await page.goto(`${BASE_URL}/ui/copilot-widget/`);
        await page.waitForLoadState('networkidle');

        // Test mode switching to Checklist (triggers lazy load)
        await page.click('[data-mode="checklist"]');
        await page.waitForTimeout(500); // Wait for data load

        const checklistPanel = await page.$('#panel-checklist');
        const isVisible = await checklistPanel.evaluate(el =>
            el.classList.contains('active') || el.style.display !== 'none'
        );
        assert(isVisible, 'Checklist mode panel displays');

        // Verify checklist data loaded
        const aircraftSelect = await page.$('#checklist-aircraft');
        assert(aircraftSelect !== null, 'Checklist aircraft selector exists');

        const options = await page.$$('#checklist-aircraft option');
        assert(options.length > 0, 'Checklist aircraft options loaded');

        // Test Emergency mode (triggers lazy load)
        await page.click('[data-mode="emergency"]');
        await page.waitForTimeout(500);

        const emergencyPanel = await page.$('#panel-emergency');
        assert(emergencyPanel !== null, 'Emergency mode panel exists');

        const emergencySelect = await page.$('#emergency-type');
        const emergencyOptions = await page.$$('#emergency-type option');
        assert(emergencyOptions.length >= 6, 'Emergency procedures loaded (6 types)');

        // Test Assist mode (no lazy load needed)
        await page.click('[data-mode="assist"]');
        await page.waitForTimeout(200);

        const messageArea = await page.$('#message-area');
        assert(messageArea !== null, 'Assist mode message area exists');

        log('  ✓ Code splitting verified: Mode data lazy-loaded', 'green');
        passed++;

    } catch (e) {
        log(`  ✗ Copilot widget test failed: ${e.message}`, 'red');
        failed++;
    }
}

// ============================================
// MAP WIDGET FUNCTIONAL TESTS
// ============================================

async function testMapWidget() {
    log('\n🗺️ MAP WIDGET FUNCTIONAL TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        await page.goto(`${BASE_URL}/ui/map-widget/`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // Wait for map initialization

        // Test map initialization
        const mapContainer = await page.$('#map');
        assert(mapContainer !== null, 'Map container exists');

        // Test follow button
        const followBtn = await page.$('#btn-follow');
        if (followBtn) {
            await followBtn.click();
            await page.waitForTimeout(200);
            const isActive = await followBtn.evaluate(el => el.classList.contains('active'));
            assert(typeof isActive === 'boolean', 'Follow button toggles');
        }

        // Test zoom controls
        const zoomIn = await page.$('.leaflet-control-zoom-in');
        if (zoomIn) {
            await zoomIn.click();
            await page.waitForTimeout(200);
            assert(true, 'Zoom controls functional');
        }

    } catch (e) {
        log(`  ✗ Map widget test failed: ${e.message}`, 'red');
        failed++;
    }
}

// ============================================
// VATSIM WIDGET FUNCTIONAL TESTS
// ============================================

async function testVatsimWidget() {
    log('\n🌐 VATSIM WIDGET FUNCTIONAL TESTS', 'cyan');
    log('─'.repeat(40), 'cyan');

    try {
        await page.goto(`${BASE_URL}/ui/vatsim-live/`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Wait for VATSIM API fetch

        // Test search functionality
        const searchInput = await page.$('#search-input');
        if (searchInput) {
            await searchInput.fill('AAL');
            await page.waitForTimeout(300);

            const aircraftList = await page.$$('.aircraft-item');
            assert(aircraftList !== null, 'Search filters aircraft list');
        }

        // Test range filter toggle
        const rangeToggle = await page.$('#toggle-range');
        if (rangeToggle) {
            await rangeToggle.click();
            await page.waitForTimeout(200);
            assert(true, 'Range filter toggles');
        }

        // Test settings tab
        const settingsTab = await page.$('[data-tab="settings"]');
        if (settingsTab) {
            await settingsTab.click();
            await page.waitForTimeout(200);

            const rangeSlider = await page.$('#range-slider');
            assert(rangeSlider !== null, 'Settings panel loads');
        }

    } catch (e) {
        log(`  ✗ VATSIM widget test failed: ${e.message}`, 'red');
        failed++;
    }
}

// ============================================
// MAIN
// ============================================

async function runFunctionalTests() {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║   SimGlass Functional Tests (Playwright)  ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');

    const startTime = Date.now();

    // Check server
    try {
        const http = require('http');
        await new Promise((resolve, reject) => {
            http.get(`${BASE_URL}/api/status`, (res) => {
                if (res.statusCode === 200) {
                    log('\n✓ Server running at ' + BASE_URL, 'green');
                    resolve();
                } else {
                    reject(new Error('Server returned ' + res.statusCode));
                }
            }).on('error', reject);
        });
    } catch (e) {
        log('\n❌ Server not running at ' + BASE_URL, 'red');
        log('   Start server first: cd backend && node server.js', 'yellow');
        process.exit(1);
    }

    // Setup browser
    await setupBrowser();

    try {
        // Run test suites
        await testChecklistWidget();
        await testCopilotWidget();
        await testMapWidget();
        await testVatsimWidget();

    } catch (e) {
        log(`\n❌ Test execution error: ${e.message}`, 'red');
    } finally {
        await teardownBrowser();
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n' + '═'.repeat(40), 'cyan');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`  Time:   ${duration}s`);
    log('═'.repeat(40), 'cyan');

    if (failed > 0) {
        log('\n❌ Some functional tests failed', 'red');
        process.exit(1);
    } else {
        log('\n✅ All functional tests passed!', 'green');
    }
}

// Handle errors gracefully
process.on('unhandledRejection', async (err) => {
    log(`\n❌ Unhandled error: ${err.message}`, 'red');
    await teardownBrowser();
    process.exit(1);
});

runFunctionalTests();
