/**
 * Test Procedure Details Panel
 * Run via Playwright on commander-pc
 */

const { chromium } = require('playwright');

async function testProcedureDetails() {
    console.log('🧪 Testing GTN750 Procedure Details Panel\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Step 1: Navigate to GTN750 PROC page
        console.log('1. Opening GTN750 PROC page...');
        await page.goto('http://localhost:8080/ui/gtn750/#proc');
        await page.waitForTimeout(2000);

        // Step 2: Load procedures for KDEN
        console.log('2. Loading procedures for KDEN...');
        await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage) {
                await procPage.loadProcedures('KDEN');
            }
        });
        await page.waitForTimeout(2000);

        // Step 3: Select first approach
        console.log('3. Selecting first approach...');
        const selectedApproach = await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (!procPage) return null;

            procPage.switchType('apr');
            await new Promise(resolve => setTimeout(resolve, 500));

            if (procPage.procedures.approaches.length > 0) {
                const approach = procPage.procedures.approaches[0];
                await procPage.selectProcedure(approach);
                return {
                    name: approach.name,
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

        console.log(`   ✅ Selected: ${selectedApproach.name}`);
        console.log(`   Type: ${selectedApproach.type || 'N/A'}`);
        console.log(`   Runway: ${selectedApproach.runway || 'N/A'}`);

        // Step 4: Wait for details panel to appear
        await page.waitForTimeout(1000);

        // Step 5: Check if details panel is visible
        console.log('\n4. Checking details panel visibility...');
        const panelCheck = await page.evaluate(() => {
            const panel = document.getElementById('proc-details-panel');
            if (!panel) return { exists: false };

            const isVisible = panel.style.display !== 'none';
            return {
                exists: true,
                visible: isVisible,
                display: panel.style.display
            };
        });

        if (panelCheck.exists && panelCheck.visible) {
            console.log('   ✅ Details panel is visible');
        } else {
            console.log(`   ❌ Details panel not visible (display: ${panelCheck.display})`);
        }

        // Step 6: Verify info fields are populated
        console.log('\n5. Checking info field values...');
        const infoFields = await page.evaluate(() => {
            return {
                name: document.getElementById('proc-name-val')?.textContent,
                type: document.getElementById('proc-type-val')?.textContent,
                runway: document.getElementById('proc-runway-val')?.textContent,
                distance: document.getElementById('proc-distance-val')?.textContent
            };
        });

        console.log(`   Name: ${infoFields.name}`);
        console.log(`   Type: ${infoFields.type}`);
        console.log(`   Runway: ${infoFields.runway}`);
        console.log(`   Distance: ${infoFields.distance}`);

        if (infoFields.name && infoFields.name !== '—') {
            console.log('   ✅ Info fields populated');
        } else {
            console.log('   ⚠️ Info fields may not be populated');
        }

        // Step 7: Check waypoint list
        console.log('\n6. Checking waypoint list...');
        const waypointList = await page.evaluate(() => {
            const list = document.getElementById('proc-waypoints-list');
            if (!list) return null;

            const items = list.querySelectorAll('.proc-wpt-item');
            const waypoints = [];

            items.forEach(item => {
                const ident = item.querySelector('.proc-wpt-ident')?.textContent;
                const distance = item.querySelector('.proc-wpt-distance')?.textContent;
                const bearing = item.querySelector('.proc-wpt-bearing')?.textContent;
                const altitude = item.querySelector('.proc-wpt-altitude')?.textContent;

                waypoints.push({ ident, distance, bearing, altitude });
            });

            const totalEl = list.querySelector('.proc-wpt-total-value');
            const totalDistance = totalEl?.textContent;

            return {
                count: items.length,
                waypoints: waypoints.slice(0, 3), // First 3 waypoints
                totalDistance
            };
        });

        if (waypointList) {
            console.log(`   Waypoint count: ${waypointList.count}`);
            console.log(`   Total distance: ${waypointList.totalDistance || 'N/A'}`);

            if (waypointList.waypoints.length > 0) {
                console.log('\n   First 3 waypoints:');
                waypointList.waypoints.forEach((wp, idx) => {
                    console.log(`   ${idx + 1}. ${wp.ident} - ${wp.distance || 'N/A'} - ${wp.bearing || 'N/A'} - ${wp.altitude || 'N/A'}`);
                });
                console.log('   ✅ Waypoint list rendered');
            } else {
                console.log('   ⚠️ No waypoints in list');
            }
        } else {
            console.log('   ❌ Waypoint list not found');
        }

        // Step 8: Test close button
        console.log('\n7. Testing close button...');
        await page.evaluate(() => {
            const closeBtn = document.getElementById('proc-details-close');
            closeBtn?.click();
        });
        await page.waitForTimeout(500);

        const panelHidden = await page.evaluate(() => {
            const panel = document.getElementById('proc-details-panel');
            return panel.style.display === 'none';
        });

        if (panelHidden) {
            console.log('   ✅ Close button works - panel hidden');
        } else {
            console.log('   ❌ Close button failed - panel still visible');
        }

        // Step 9: Take screenshot
        console.log('\n8. Taking screenshot...');

        // Re-open panel for screenshot
        await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage && procPage.procedures.approaches.length > 0) {
                const approach = procPage.procedures.approaches[0];
                await procPage.selectProcedure(approach);
            }
        });
        await page.waitForTimeout(1000);

        await page.screenshot({
            path: 'C:/temp/gtn750-proc-details.png',
            fullPage: true
        });
        console.log('   Screenshot saved: C:/temp/gtn750-proc-details.png');

        console.log('\n✅ Test complete!');
        console.log('\nProcedure Details Panel Features:');
        console.log('  • Floating panel with procedure info');
        console.log('  • Name, type, runway, total distance');
        console.log('  • Waypoint-by-waypoint breakdown');
        console.log('  • Distance and bearing between waypoints');
        console.log('  • Altitude constraints (@, +, -, B)');
        console.log('  • Speed limits where applicable');
        console.log('  • Total distance summary');
        console.log('  • Close button functionality');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testProcedureDetails().catch(console.error);
