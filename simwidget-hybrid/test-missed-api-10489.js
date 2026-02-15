/**
 * Test missed approach API with specific procedure ID 10489 (16-leg R12-Z)
 */

async function testMissedApproachAPI() {
    const serverPort = 8080;

    console.log('🧪 Testing Missed Approach API (Procedure ID 10489)\n');

    try {
        const legsResp = await fetch(`http://localhost:${serverPort}/api/navdb/procedure/10489/legs`);
        const legsData = await legsResp.json();

        console.log(`Procedure: ${legsData.procedure.name}`);
        console.log(`Type: ${legsData.procedure.type}`);
        console.log(`Runway: ${legsData.procedure.runway}`);
        console.log(`\nResults:`);
        console.log(`  Total legs in DB: ${legsData.legs.length + (legsData.missedApproachLegs?.length || 0)}`);
        console.log(`  Approach waypoints: ${legsData.waypoints.length}`);
        console.log(`  Has missed approach: ${legsData.hasMissedApproach ? '✅ YES' : '❌ NO'}`);
        console.log(`  Missed waypoints: ${legsData.missedApproachWaypoints?.length || 0}`);

        if (legsData.hasMissedApproach) {
            console.log('\n  Approach legs (should be ~13 waypoints up to seq 90):');
            legsData.waypoints.forEach((wp, idx) => {
                console.log(`    ${idx + 1}. ${wp.ident} - ${wp.pathTerm || 'N/A'}`);
            });

            console.log('\n  Missed approach waypoints (should start around seq 100):');
            legsData.missedApproachWaypoints.forEach((wp, idx) => {
                console.log(`    ${idx + 1}. ${wp.ident} - ${wp.pathTerm || 'N/A'}`);
            });
        }

        // Expected result:
        // - Approach should have waypoints up to TEVOC (seq 90)
        // - Missed should start at NEBSE (seq 100) and include BIH HM hold
        const expectedApproachEnd = 'TEVOC';
        const expectedMissedStart = 'NEBSE';

        console.log('\n  Validation:');
        const lastApproachWp = legsData.waypoints[legsData.waypoints.length - 1];
        console.log(`    Last approach waypoint: ${lastApproachWp?.ident} (expected: ${expectedApproachEnd}) ${lastApproachWp?.ident === expectedApproachEnd ? '✅' : '❌'}`);

        if (legsData.hasMissedApproach && legsData.missedApproachWaypoints.length > 0) {
            const firstMissedWp = legsData.missedApproachWaypoints[0];
            console.log(`    First missed waypoint: ${firstMissedWp.ident} (expected: ${expectedMissedStart}) ${firstMissedWp.ident === expectedMissedStart ? '✅' : '❌'}`);

            const hasHold = legsData.missedApproachWaypoints.some(wp => wp.pathTerm === 'HM');
            console.log(`    Contains HM hold: ${hasHold ? '✅' : '❌'}`);
        }

    } catch (e) {
        console.log('  ❌ Error:', e.message);
    }

    console.log('\n✅ API testing complete!');
}

testMissedApproachAPI().catch(console.error);
