/**
 * Test Procedure Preview Visualization on Map
 * Run via Playwright on commander-pc
 */

const { chromium } = require('playwright');

async function testProcedurePreview() {
    console.log('🧪 Testing GTN750 Procedure Preview Visualization\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Step 1: Navigate to GTN750
        console.log('1. Opening GTN750...');
        await page.goto('http://localhost:8080/ui/gtn750/#map');
        await page.waitForTimeout(2000);

        // Step 2: Navigate to PROC page
        console.log('2. Switching to PROC page...');
        await page.evaluate(() => {
            if (window.gtn750?.pageManager) {
                window.gtn750.pageManager.switchPage('proc');
            }
        });
        await page.waitForTimeout(1000);

        // Step 3: Load procedures for KDEN
        console.log('3. Loading procedures for KDEN...');
        await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (procPage) {
                await procPage.loadProcedures('KDEN');
            }
        });
        await page.waitForTimeout(2000);

        // Step 4: Switch to approaches and select first one
        console.log('4. Selecting first approach...');
        const selectedApproach = await page.evaluate(async () => {
            const procPage = window.gtn750?.proceduresPage;
            if (!procPage) return null;

            // Switch to approaches
            procPage.switchType('apr');

            // Wait a moment for rendering
            await new Promise(resolve => setTimeout(resolve, 500));

            // Select first approach
            if (procPage.procedures.approaches.length > 0) {
                const approach = procPage.procedures.approaches[0];
                await procPage.selectProcedure(approach);
                return {
                    name: approach.name,
                    waypointCount: procPage.previewWaypoints.length
                };
            }
            return null;
        });

        if (!selectedApproach) {
            console.error('❌ Failed to select approach');
            await browser.close();
            return;
        }

        console.log(`   Selected: ${selectedApproach.name} (${selectedApproach.waypointCount} waypoints)`);
        await page.waitForTimeout(1000);

        // Step 5: Switch back to MAP page to see preview
        console.log('5. Switching to MAP page to view preview...');
        await page.evaluate(() => {
            if (window.gtn750?.pageManager) {
                window.gtn750.pageManager.switchPage('map');
            }
        });
        await page.waitForTimeout(2000);

        // Step 6: Verify procedure preview is in state
        const previewState = await page.evaluate(() => {
            const state = window.gtn750?.getRendererState();
            if (state?.procedurePreview) {
                return {
                    hasPreview: true,
                    procedureName: state.procedurePreview.procedure?.name,
                    waypointCount: state.procedurePreview.waypoints?.length,
                    firstWaypoint: state.procedurePreview.waypoints?.[0]?.ident,
                    lastWaypoint: state.procedurePreview.waypoints?.[state.procedurePreview.waypoints.length - 1]?.ident
                };
            }
            return { hasPreview: false };
        });

        console.log('6. Procedure preview state:');
        if (previewState.hasPreview) {
            console.log(`   ✅ Procedure: ${previewState.procedureName}`);
            console.log(`   ✅ Waypoints: ${previewState.waypointCount}`);
            console.log(`   ✅ Route: ${previewState.firstWaypoint} → ${previewState.lastWaypoint}`);
        } else {
            console.error('   ❌ No procedure preview in state!');
        }

        // Step 7: Take screenshot
        console.log('7. Taking screenshot...');
        await page.screenshot({
            path: 'C:/temp/gtn750-proc-preview.png',
            fullPage: true
        });
        console.log('   Screenshot saved: C:/temp/gtn750-proc-preview.png');

        // Step 8: Verify canvas rendering
        const canvasStats = await page.evaluate(() => {
            const canvas = document.getElementById('map-canvas');
            if (!canvas) return null;

            const ctx = canvas.getContext('2d');
            // Check if anything cyan (procedure preview color) exists
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            let cyanPixels = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                // Check for cyan-ish color (#00ffff or similar)
                if (r < 50 && g > 200 && b > 200) {
                    cyanPixels++;
                }
            }

            return {
                width: canvas.width,
                height: canvas.height,
                cyanPixels: cyanPixels,
                hasCyan: cyanPixels > 100 // At least some cyan pixels
            };
        });

        console.log('8. Canvas rendering check:');
        if (canvasStats) {
            console.log(`   Canvas size: ${canvasStats.width}x${canvasStats.height}`);
            console.log(`   Cyan pixels: ${canvasStats.cyanPixels}`);
            if (canvasStats.hasCyan) {
                console.log('   ✅ Procedure preview appears to be rendered (cyan pixels detected)');
            } else {
                console.log('   ⚠️ Few/no cyan pixels - preview may not be visible');
            }
        } else {
            console.error('   ❌ Canvas not found!');
        }

        console.log('\n✅ Test complete!');
        console.log('   Review screenshot at C:/temp/gtn750-proc-preview.png');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testProcedurePreview().catch(console.error);
