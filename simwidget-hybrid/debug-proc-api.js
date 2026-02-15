/**
 * Debug script to check procedure API responses
 */

async function debugProcedureAPI() {
    const serverPort = 8080;
    const icao = 'KDEN';

    console.log('🔍 Debugging Procedure API\n');

    try {
        // Step 1: Get all procedures for KDEN
        console.log('1. Fetching procedures for KDEN...');
        const procsUrl = `http://localhost:${serverPort}/api/navdb/procedures/${icao}`;
        const procsResp = await fetch(procsUrl);

        if (!procsResp.ok) {
            console.log(`   ❌ Failed: ${procsResp.status} ${procsResp.statusText}`);
            return;
        }

        const procsData = await procsResp.json();
        console.log(`   ✅ Got ${procsData.approaches?.length || 0} approaches`);

        // Find H07-Z.ABBOO
        const targetProc = procsData.approaches?.find(p => p.name === 'H07-Z.ABBOO');
        if (!targetProc) {
            console.log('   ❌ H07-Z.ABBOO not found in approaches');
            console.log(`   First approach: ${procsData.approaches?.[0]?.name || 'None'}`);
            return;
        }

        console.log(`\n   Found: ${targetProc.name}`);
        console.log(`   ID: ${targetProc.id}`);
        console.log(`   Type: ${targetProc.approachType || targetProc.type}`);
        console.log(`   Runway: ${targetProc.runway || 'ALL'}`);

        // Step 2: Fetch procedure legs
        if (!targetProc.id) {
            console.log('\n   ⚠️ No ID field in procedure object');
            return;
        }

        console.log(`\n2. Fetching legs for procedure ID ${targetProc.id}...`);
        const legsUrl = `http://localhost:${serverPort}/api/navdb/procedure/${targetProc.id}/legs`;
        const legsResp = await fetch(legsUrl);

        if (!legsResp.ok) {
            console.log(`   ❌ Failed: ${legsResp.status} ${legsResp.statusText}`);
            const errorText = await legsResp.text();
            console.log(`   Error: ${errorText}`);
            return;
        }

        const legsData = await legsResp.json();
        console.log(`   ✅ Got ${legsData.waypoints?.length || 0} waypoints`);

        if (legsData.waypoints?.length > 0) {
            console.log('\n   Waypoints:');
            legsData.waypoints.forEach((wp, idx) => {
                console.log(`   ${idx + 1}. ${wp.ident} (${wp.lat?.toFixed(4)}, ${wp.lon?.toFixed(4)})`);
                if (wp.altDesc && wp.alt1) {
                    console.log(`      Alt: ${wp.altDesc} ${wp.alt1}ft`);
                }
                if (wp.speedLimit) {
                    console.log(`      Speed: ${wp.speedLimit}kt`);
                }
            });
        } else {
            console.log('   ⚠️ No waypoints in response');
            console.log(`   Response: ${JSON.stringify(legsData, null, 2)}`);
        }

        console.log('\n✅ Debug complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugProcedureAPI().catch(console.error);
