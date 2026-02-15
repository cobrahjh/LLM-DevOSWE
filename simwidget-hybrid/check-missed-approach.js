/**
 * Check for missed approach data in navdb
 */

async function checkMissedApproach() {
    const serverPort = 8080;
    const icao = 'KDEN';

    console.log('🔍 Checking for missed approach data\n');

    try {
        // Get KDEN approaches
        const procsUrl = `http://localhost:${serverPort}/api/navdb/procedures/${icao}`;
        const procsResp = await fetch(procsUrl);
        const procsData = await procsResp.json();

        // Find any approach (prefer ILS, but take first if none)
        let approach = procsData.approaches.find(a => a.name && a.name.toUpperCase().includes('ILS'));
        if (!approach) {
            approach = procsData.approaches[0];
        }
        if (!approach) {
            console.log('No approaches found');
            return;
        }

        console.log(`Approach: ${approach.name} (ID: ${approach.id})`);

        // Get procedure legs
        const legsUrl = `http://localhost:${serverPort}/api/navdb/procedure/${approach.id}/legs`;
        const legsResp = await fetch(legsUrl);
        const legsData = await legsResp.json();

        console.log(`Total waypoints: ${legsData.waypoints.length}`);

        // Analyze leg types
        const legTypes = {};
        legsData.waypoints.forEach(wp => {
            if (wp.legType) {
                legTypes[wp.legType] = (legTypes[wp.legType] || 0) + 1;
            }
        });

        console.log('\nLeg types breakdown:');
        Object.entries(legTypes).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        // Check for missed approach indicators
        const possibleMissed = legsData.waypoints.filter(wp =>
            (wp.legType && (wp.legType.includes('M') || wp.legType.startsWith('H'))) ||
            (wp.waypointType && wp.waypointType.includes('MISSED'))
        );

        console.log(`\nPotential missed approach legs: ${possibleMissed.length}`);

        if (possibleMissed.length > 0) {
            console.log('\nMissed approach waypoints:');
            possibleMissed.forEach((wp, idx) => {
                console.log(`  ${idx + 1}. ${wp.ident} - legType: ${wp.legType || 'N/A'}, waypointType: ${wp.waypointType || 'N/A'}`);
            });
        }

        // Show all waypoints with details
        console.log('\n\nAll waypoints:');
        legsData.waypoints.forEach((wp, idx) => {
            console.log(`${idx + 1}. ${wp.ident.padEnd(8)} - legType: ${(wp.legType || 'N/A').padEnd(4)} fix: ${wp.fixIdent || 'N/A'}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkMissedApproach().catch(console.error);
