/**
 * Live browser test using Chrome DevTools Protocol
 * Connects to already-open browser and checks nav state
 */

const CDP = require('chrome-remote-interface');

async function testNavIntegration() {
    console.log('\n' + '='.repeat(60));
    console.log('  LIVE BROWSER TEST - Flight Plan Navigation');
    console.log('='.repeat(60) + '\n');

    let client;
    try {
        console.log('Connecting to Chrome DevTools Protocol...');

        // List available targets
        const targets = await CDP.List({ port: 9222 });

        console.log(`\nFound ${targets.length} browser tabs/targets:\n`);

        let gtnTarget = null;
        let aiTarget = null;

        for (const target of targets) {
            const title = target.title || 'Untitled';
            const url = target.url || '';
            console.log(`  - ${title}`);
            console.log(`    ${url}\n`);

            if (url.includes('/ui/gtn750/')) {
                gtnTarget = target;
                console.log('    ✅ Found GTN750 page\n');
            }
            if (url.includes('/ui/ai-autopilot/')) {
                aiTarget = target;
                console.log('    ✅ Found AI Autopilot page\n');
            }
        }

        if (!gtnTarget && !aiTarget) {
            console.log('❌ Neither GTN750 nor AI Autopilot page found in browser');
            console.log('\nPlease open the pages in Chrome with remote debugging:');
            console.log('  chrome.exe --remote-debugging-port=9222\n');
            console.log('Then open:');
            console.log('  http://localhost:8080/ui/gtn750/');
            console.log('  http://localhost:8080/ui/ai-autopilot/\n');
            return;
        }

        // Test AI Autopilot page if found
        if (aiTarget) {
            console.log('='.repeat(60));
            console.log('Testing AI Autopilot Page');
            console.log('='.repeat(60) + '\n');

            client = await CDP({ target: aiTarget, port: 9222 });
            const { Runtime } = client;
            await Runtime.enable();

            // Check if widget exists
            const widgetCheck = await Runtime.evaluate({
                expression: 'typeof widget !== "undefined"'
            });

            if (widgetCheck.result.value) {
                console.log('✅ Widget object exists\n');

                // Get nav guidance
                const navGuidance = await Runtime.evaluate({
                    expression: 'widget.ruleEngine.getNavGuidance()'
                });

                if (navGuidance.result.value) {
                    const ng = navGuidance.result.value;
                    console.log('Nav Guidance Data:');
                    console.log(`  Waypoint: ${ng.wpIdent || 'N/A'}`);
                    console.log(`  Distance: ${ng.wpDist ? ng.wpDist.toFixed(1) + 'nm' : 'N/A'}`);
                    console.log(`  Bearing: ${ng.wpBearing || 'N/A'}°`);
                    console.log(`  CDI Source: ${ng.cdiSource || 'N/A'}`);
                    console.log(`  XTRK: ${ng.xtrk ? ng.xtrk.toFixed(2) + 'nm' : 'N/A'}`);
                    console.log(`  DTK: ${ng.dtk || 'N/A'}°`);
                    console.log(`  Nav Mode: ${ng.navMode || 'N/A'}`);
                    console.log(`  Intercept Heading: ${ng.interceptHdg || 'N/A'}°`);
                    console.log(`  Dest Distance: ${ng.destDist ? ng.destDist.toFixed(0) + 'nm' : 'N/A'}\n`);

                    if (ng.wpIdent) {
                        console.log('✅ NAV GUIDANCE WORKING - Waypoint data present!\n');
                    } else {
                        console.log('⚠️  Nav guidance exists but no waypoint (GTN750 not open?)\n');
                    }
                } else {
                    console.log('⚠️  getNavGuidance() returned null (GTN750 not broadcasting)\n');
                }

                // Check AI enabled status
                const aiEnabled = await Runtime.evaluate({
                    expression: 'widget.aiEnabled'
                });
                console.log(`AI Autopilot Enabled: ${aiEnabled.result.value ? '✅ YES' : '❌ NO'}\n`);

                // Check phase
                const phase = await Runtime.evaluate({
                    expression: 'widget.flightPhase.phase'
                });
                console.log(`Current Phase: ${phase.result.value || 'UNKNOWN'}\n`);

            } else {
                console.log('❌ Widget object not found - page may not be loaded\n');
            }

            await client.close();
        }

        console.log('='.repeat(60));
        console.log('Test Complete');
        console.log('='.repeat(60) + '\n');

        if (gtnTarget && aiTarget) {
            console.log('✅ Both pages found in browser');
            if (aiTarget) {
                console.log('✅ AI Autopilot page accessible via CDP');
            }
            console.log('\nNext steps:');
            console.log('1. Enable AI Autopilot (click ON button)');
            console.log('2. Check heading display shows waypoint (not raw heading)');
            console.log('3. Verify NAV row shows GPS source\n');
        } else if (!gtnTarget) {
            console.log('⚠️  GTN750 page not found - open http://localhost:8080/ui/gtn750/\n');
        } else if (!aiTarget) {
            console.log('⚠️  AI Autopilot page not found - open http://localhost:8080/ui/ai-autopilot/\n');
        }

    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.log('❌ Cannot connect to Chrome DevTools Protocol');
            console.log('\nStart Chrome with remote debugging enabled:');
            console.log('  chrome.exe --remote-debugging-port=9222\n');
            console.log('Or use the batch file to open pages normally.\n');
        } else {
            console.error('Error:', err.message);
        }
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testNavIntegration().catch(console.error);
