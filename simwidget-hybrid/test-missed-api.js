/**
 * Test missed approach API detection
 */

async function testMissedApproachAPI() {
    const serverPort = 8080;

    console.log('🧪 Testing Missed Approach API\n');

    // Test 1: KBIH R12-Z (should have missed approach with HM hold)
    console.log('Test 1: KBIH R12-Z (known to have 16 legs with HM hold)');
    try {
        // Get KBIH procedures
        const procsResp = await fetch(`http://localhost:${serverPort}/api/navdb/procedures/KBIH`);
        const procsData = await procsResp.json();
        const r12z = procsData.approaches.find(a => a.ident === 'R12-Z');

        if (!r12z) {
            console.log('  ❌ R12-Z not found');
        } else {
            console.log(`  Found R12-Z (ID: ${r12z.id})`);

            // Get legs
            const legsResp = await fetch(`http://localhost:${serverPort}/api/navdb/procedure/${r12z.id}/legs`);
            const legsData = await legsResp.json();

            console.log(`  Approach waypoints: ${legsData.waypoints.length}`);
            console.log(`  Has missed approach: ${legsData.hasMissedApproach ? '✅ YES' : '❌ NO'}`);
            console.log(`  Missed waypoints: ${legsData.missedApproachWaypoints?.length || 0}`);

            if (legsData.hasMissedApproach) {
                console.log('\n  Missed approach waypoints:');
                legsData.missedApproachWaypoints.forEach((wp, idx) => {
                    console.log(`    ${idx + 1}. ${wp.ident} - ${wp.pathTerm || 'N/A'}`);
                });
            }
        }
    } catch (e) {
        console.log('  ❌ Error:', e.message);
    }

    // Test 2: KDEN H07-Z.ABBOO (short approach, should NOT have missed)
    console.log('\n\nTest 2: KDEN H07-Z.ABBOO (simple approach, no missed expected)');
    try {
        const procsResp = await fetch(`http://localhost:${serverPort}/api/navdb/procedures/KDEN`);
        const procsData = await procsResp.json();
        const h07z = procsData.approaches.find(a => a.ident === 'H07-Z' && a.runway === 'ABBOO');

        if (!h07z) {
            console.log('  ❌ H07-Z.ABBOO not found');
        } else {
            console.log(`  Found H07-Z.ABBOO (ID: ${h07z.id})`);

            const legsResp = await fetch(`http://localhost:${serverPort}/api/navdb/procedure/${h07z.id}/legs`);
            const legsData = await legsResp.json();

            console.log(`  Approach waypoints: ${legsData.waypoints.length}`);
            console.log(`  Has missed approach: ${legsData.hasMissedApproach ? '⚠️ YES (unexpected)' : '✅ NO (as expected)'}`);
            console.log(`  Missed waypoints: ${legsData.missedApproachWaypoints?.length || 0}`);
        }
    } catch (e) {
        console.log('  ❌ Error:', e.message);
    }

    console.log('\n✅ API testing complete!');
}

testMissedApproachAPI().catch(console.error);
