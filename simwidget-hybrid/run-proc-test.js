/**
 * Run PROC page tests on commander-pc using Playwright
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function runProcTests() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to GTN750 PROC page
    console.log('Opening GTN750 PROC page...');
    await page.goto('http://localhost:8080/ui/gtn750/#proc');
    await page.waitForTimeout(2000); // Wait for page to load

    // Inject test script
    console.log('Injecting test script...');
    const testScript = fs.readFileSync('C:/temp/test-proc-page.js', 'utf8');
    await page.evaluate(testScript);

    // Wait for tests to complete
    await page.waitForTimeout(5000);

    // Capture console output
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'log') console.log(text);
        if (type === 'error') console.error(text);
        if (type === 'warn') console.warn(text);
    });

    // Run tests
    console.log('\nRunning tests...\n');
    const results = await page.evaluate(async () => {
        if (typeof testProcPage === 'function') {
            return await testProcPage();
        }
        return { error: 'testProcPage function not found' };
    });

    // Take screenshot
    await page.screenshot({ path: 'C:/temp/proc-page-test.png', fullPage: true });
    console.log('\nScreenshot saved to C:/temp/proc-page-test.png');

    // Display results
    if (results.error) {
        console.error(`Error: ${results.error}`);
    } else {
        console.log(`\n=== Test Results ===`);
        console.log(`Passed: ${results.passed}`);
        console.log(`Failed: ${results.failed}`);
        console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

        if (results.failed > 0) {
            console.log('\nFailed tests:');
            results.tests.filter(t => !t.passed).forEach(t => {
                console.log(`  ✗ ${t.name}${t.details ? ` - ${t.details}` : ''}`);
            });
        }
    }

    await browser.close();
    return results;
}

runProcTests().catch(console.error);
