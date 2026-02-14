/**
 * Test Procedure Loading into Flight Plan
 * Run via Playwright on commander-pc
 */

const { chromium } = require('playwright');

async function testProcedureLoad() {
    console.log('🧪 Testing GTN750 Procedure Load Functionality\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Step 1: Navigate to GTN750
        console.log('1. Opening GTN750...');
        await page.goto('http://localhost:8080/ui/gtn750/#fpl');
        await page.waitForTimeout(2000);

        // Step 2: Check initial flight plan
        console.log('2. Checking initial flight plan...');
        const initialPlan = await page.evaluate(() => {
            const fpl = window.gtn750?.flightPlanManager?.flightPlan;
            return {
                exists: !!fpl,
                waypointCount: fpl?.waypoints?.length || 0,
                waypoints: fpl?.waypoints?.map(wp => wp.ident) || []
            };
        });
        console.log(`   Initial waypoints: ${initialPlan.waypointCount}`);
        if (initialPlan.waypoints.length > 0) {
            console.log(`   Route: ${initialPlan.waypoints.join(' → ')}`);
        }

        // Step 3: Navigate to PROC page
        console.log('\n3. Switching to PROC page...');
        await page.evaluate(() => {
            if (window.gtn750?.pageManager) {
                window.gtn750.pageManager.switchPage('proc');
            }
        });
        await page.waitForTimeout(1000);

        // Step 4: Load procedures for KDEN
        console.log('4. Loading procedures for KDEN...');
        await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage) {
                await procPage.loadProcedures('KDEN');
            }
        });
        await page.waitForTimeout(2000);

        // Step 5: Select first approach
        console.log('5. Selecting first approach...');
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
                    waypointCount: procPage.previewWaypoints.length,
                    waypoints: procPage.previewWaypoints.slice(0, 5).map(wp => wp.ident)
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
        console.log(`   Waypoints: ${selectedApproach.waypoints.join(' → ')}...`);

        // Step 6: Click LOAD soft key
        console.log('\n6. Loading procedure into flight plan...');
        await page.evaluate(() => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage) {
                procPage.loadProcedure();
            }
        });
        await page.waitForTimeout(2000);

        // Step 7: Verify flight plan was updated
        console.log('7. Verifying flight plan...');
        const updatedPlan = await page.evaluate(() => {
            const fpl = window.gtn750?.flightPlanManager?.flightPlan;
            return {
                waypointCount: fpl?.waypoints?.length || 0,
                waypoints: fpl?.waypoints?.map(wp => ({
                    ident: wp.ident,
                    procType: wp.procedureType
                })) || [],
                procedures: fpl?.procedures || {},
                source: fpl?.source
            };
        });

        console.log(`   Flight plan waypoints: ${updatedPlan.waypointCount}`);

        if (updatedPlan.waypointCount > initialPlan.waypointCount) {
            console.log(`   ✅ Waypoints added: ${updatedPlan.waypointCount - initialPlan.waypointCount}`);

            // Show approach waypoints
            const approachWps = updatedPlan.waypoints.filter(wp => wp.procType === 'APPROACH');
            if (approachWps.length > 0) {
                console.log(`   ✅ Approach waypoints: ${approachWps.map(wp => wp.ident).join(' → ')}`);
            }

            // Show procedure metadata
            if (updatedPlan.procedures.apr) {
                console.log(`   ✅ Approach loaded: ${updatedPlan.procedures.apr.name}`);
                console.log(`   Type: ${updatedPlan.procedures.apr.approachType || 'Unknown'}`);
            }

            console.log(`   Flight plan source: ${updatedPlan.source}`);
        } else {
            console.error('   ❌ No waypoints added to flight plan!');
        }

        // Step 8: Take screenshot of FPL page
        console.log('\n8. Taking screenshot of flight plan...');
        await page.screenshot({
            path: 'C:/temp/gtn750-proc-loaded.png',
            fullPage: true
        });
        console.log('   Screenshot saved: C:/temp/gtn750-proc-loaded.png');

        console.log('\n✅ Test complete!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testProcedureLoad().catch(console.error);
