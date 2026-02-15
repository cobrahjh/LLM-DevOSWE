/**
 * Test Procedure Details Panel with Console Logging
 * Run via Playwright on commander-pc
 */

const { chromium } = require('playwright');

async function testProcedureDetailsDebug() {
    console.log('🧪 Testing GTN750 Procedure Details Panel (Debug Mode)\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(text);
        if (text.includes('[PROC]') || text.includes('[GTN750]')) {
            console.log(`   📋 ${text}`);
        }
    });

    try {
        // Step 1: Navigate to GTN750 PROC page and enable debug
        console.log('1. Opening GTN750 PROC page with debug logging...');
        await page.goto('http://localhost:8080/ui/gtn750/#proc');

        // Enable debug logging
        await page.evaluate(() => {
            localStorage.setItem('gtn750-debug', 'true');
        });

        // Reload to pick up debug setting
        await page.reload();
        console.log('   ✅ Debug logging enabled');

        await page.waitForTimeout(2000);

        // Step 2: Load procedures for KDEN
        console.log('\n2. Loading procedures for KDEN...');
        await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage) {
                await procPage.loadProcedures('KDEN');
            }
        });
        await page.waitForTimeout(2000);

        // Step 3: Select first approach
        console.log('\n3. Selecting first approach...');
        const selectedApproach = await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (!procPage) return null;

            procPage.switchType('apr');
            await new Promise(resolve => setTimeout(resolve, 500));

            if (procPage.procedures.approaches.length > 0) {
                const approach = procPage.procedures.approaches[0];
                console.log('[TEST] About to select:', approach.name, 'ID:', approach.id);
                await procPage.selectProcedure(approach);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for fetch
                return {
                    name: approach.name,
                    id: approach.id,
                    type: approach.approachType,
                    runway: approach.runway
                };
            }
            return null;
        });

        if (!selectedApproach) {
            console.error('   ❌ Failed to select approach');
            await browser.close();
            return;
        }

        console.log(`   ✅ Selected: ${selectedApproach.name} (ID: ${selectedApproach.id})`);

        // Step 4: Wait a bit more for async operations
        await page.waitForTimeout(2000);

        // Step 5: Check panel and waypoints
        console.log('\n4. Checking details panel...');
        const panelCheck = await page.evaluate(() => {
            const panel = document.getElementById('proc-details-panel');
            const wpList = document.getElementById('proc-waypoints-list');
            const wpItems = wpList?.querySelectorAll('.proc-wpt-item');

            return {
                panelVisible: panel?.style.display !== 'none',
                waypointCount: wpItems?.length || 0,
                waypointHTML: wpList?.innerHTML || '',
                name: document.getElementById('proc-name-val')?.textContent,
                type: document.getElementById('proc-type-val')?.textContent,
                runway: document.getElementById('proc-runway-val')?.textContent,
                distance: document.getElementById('proc-distance-val')?.textContent
            };
        });

        console.log(`   Panel visible: ${panelCheck.panelVisible ? '✅' : '❌'}`);
        console.log(`   Name: ${panelCheck.name}`);
        console.log(`   Type: ${panelCheck.type}`);
        console.log(`   Runway: ${panelCheck.runway}`);
        console.log(`   Distance: ${panelCheck.distance}`);
        console.log(`   Waypoints: ${panelCheck.waypointCount}`);

        if (panelCheck.waypointCount === 0) {
            console.log('\n   ⚠️ Waypoint list HTML length:', panelCheck.waypointHTML.length);
            if (panelCheck.waypointHTML.length < 100) {
                console.log('   HTML:', panelCheck.waypointHTML);
            }
        }

        // Step 6: Take screenshot
        console.log('\n5. Taking screenshot...');
        await page.screenshot({
            path: 'C:/temp/gtn750-proc-details-debug.png',
            fullPage: true
        });
        console.log('   Screenshot saved: C:/temp/gtn750-proc-details-debug.png');

        // Step 7: Show console log summary
        console.log('\n📋 Console Log Summary:');
        const procLogs = consoleLogs.filter(log => log.includes('[PROC]') || log.includes('[GTN750]'));
        if (procLogs.length > 0) {
            procLogs.forEach(log => console.log(`   ${log}`));
        } else {
            console.log('   No [PROC] or [GTN750] logs found');
        }

        console.log('\n✅ Test complete!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testProcedureDetailsDebug().catch(console.error);
