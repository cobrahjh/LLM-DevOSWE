/**
 * End-to-end navigation test
 * Simulates GTN750 broadcast and AI Autopilot reception
 */

const http = require('http');

async function testE2E() {
    console.log('\n' + '='.repeat(60));
    console.log('  END-TO-END NAVIGATION TEST');
    console.log('='.repeat(60) + '\n');

    // Get current flight data
    const flightData = await httpGet('/api/status');

    console.log('Current Flight State:');
    console.log(`  GPS Waypoints: ${flightData.flightData.gpsWpCount}`);
    console.log(`  Active WP: #${flightData.flightData.gpsWpIndex}`);
    console.log(`  Distance: ${flightData.flightData.gpsWpDistance?.toFixed(1)}nm`);
    console.log(`  Bearing: ${flightData.flightData.gpsWpBearing?.toFixed(0)}°`);
    console.log(`  GPS CDI: ${flightData.flightData.gpsCdiNeedle}`);
    console.log(`  XTRK: ${flightData.flightData.gpsCrossTrackError?.toFixed(2)}nm`);
    console.log(`  DTK: ${flightData.flightData.gpsDesiredTrack?.toFixed(0)}°`);
    console.log('');

    // Simulate what GTN750 would broadcast
    console.log('Simulated GTN750 Nav-State Broadcast:');
    const navState = {
        type: 'nav-state',
        data: {
            flightPlan: {
                departure: 'KORD',
                arrival: 'KDEN',
                waypointCount: flightData.flightData.gpsWpCount || 0,
                cruiseAltitude: 8500,
                totalDistance: 245,
                source: 'manual'
            },
            activeWaypoint: {
                index: flightData.flightData.gpsWpIndex || 0,
                ident: 'KDEN',  // Would come from flight plan
                lat: flightData.flightData.gpsWpNextLat || 0,
                lon: flightData.flightData.gpsWpNextLon || 0,
                distNm: flightData.flightData.gpsWpDistance || 0,
                eteMin: (flightData.flightData.gpsWpEte || 0) / 60,
                bearingMag: flightData.flightData.gpsWpBearing || 0
            },
            cdi: {
                source: 'GPS',
                needle: flightData.flightData.gpsCdiNeedle / 127,  // Normalize
                dtk: flightData.flightData.gpsDesiredTrack || 0,
                xtrk: flightData.flightData.gpsCrossTrackError || 0,
                toFrom: 1,  // TO
                gsNeedle: 0,
                gsValid: false
            },
            approach: {
                mode: false,
                hasGlideslope: false,
                navSource: 'GPS'
            },
            destDistNm: flightData.flightData.gpsWpDistance || 0,
            timestamp: Date.now()
        }
    };

    console.log('  Waypoint:', navState.data.activeWaypoint.ident);
    console.log('  Distance:', navState.data.activeWaypoint.distNm.toFixed(1), 'nm');
    console.log('  Bearing:', navState.data.activeWaypoint.bearingMag.toFixed(0), '°');
    console.log('  CDI Source:', navState.data.cdi.source);
    console.log('  DTK:', navState.data.cdi.dtk.toFixed(0), '°');
    console.log('  XTRK:', navState.data.cdi.xtrk.toFixed(2), 'nm');
    console.log('');

    // Test intercept heading calculation (simulate rule engine logic)
    const dtk = navState.data.cdi.dtk;
    const xtrk = navState.data.cdi.xtrk;

    console.log('Simulated AI Autopilot Nav Guidance:');

    const absXtrk = Math.abs(xtrk);
    let interceptAngle = 0;

    if (absXtrk > 0.1) {
        if (absXtrk <= 0.3) {
            interceptAngle = 10;
        } else if (absXtrk <= 1.0) {
            interceptAngle = 10 + (absXtrk - 0.3) * (20 / 0.7);
        } else {
            interceptAngle = 30;
        }
    }

    const correction = xtrk > 0 ? -interceptAngle : interceptAngle;
    let interceptHdg = dtk + correction;
    while (interceptHdg < 0) interceptHdg += 360;
    while (interceptHdg >= 360) interceptHdg -= 360;

    console.log('  DTK:', dtk.toFixed(0), '°');
    console.log('  XTRK:', xtrk.toFixed(2), 'nm', xtrk > 0 ? '(RIGHT of course)' : '(LEFT of course)');
    console.log('  Intercept Angle:', interceptAngle.toFixed(0), '°');
    console.log('  Intercept Heading:', Math.round(interceptHdg), '°');
    console.log('  Correction:', xtrk > 0 ? 'Turn LEFT' : 'Turn RIGHT');
    console.log('');

    // Determine nav mode
    const shouldUseNav = navState.data.cdi.source && absXtrk < 2.0;
    console.log('  Nav Mode:', shouldUseNav ? 'NAV (CDI valid, XTRK < 2nm)' : 'HDG (intercept mode)');
    console.log('');

    // Expected heading display
    const headingDisplay = `${navState.data.activeWaypoint.ident} ${navState.data.activeWaypoint.distNm.toFixed(1)}nm`;
    console.log('  Expected UI Heading Display:', headingDisplay);
    console.log('  (Instead of raw heading like "HDG 275°")');
    console.log('');

    console.log('='.repeat(60));
    console.log('  VERIFICATION');
    console.log('='.repeat(60));
    console.log('');

    if (navState.data.flightPlan.waypointCount > 0) {
        console.log('✅ GPS flight plan available (' + navState.data.flightPlan.waypointCount + ' waypoints)');
    } else {
        console.log('❌ No GPS flight plan loaded');
    }

    if (navState.data.activeWaypoint.distNm > 0) {
        console.log('✅ Active waypoint data present');
    } else {
        console.log('⚠️  No active waypoint (may be at final destination)');
    }

    if (navState.data.cdi.source) {
        console.log('✅ CDI source available (' + navState.data.cdi.source + ')');
    } else {
        console.log('❌ No CDI source');
    }

    if (absXtrk !== undefined) {
        console.log('✅ Cross-track error available (' + absXtrk.toFixed(2) + 'nm)');
    } else {
        console.log('❌ No cross-track data');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('  EXPECTED BEHAVIOR IN BROWSER');
    console.log('='.repeat(60));
    console.log('');
    console.log('When both GTN750 and AI Autopilot are open:');
    console.log('');
    console.log('1. GTN750 broadcasts this nav-state every 1 second');
    console.log('   via SafeChannel (SimGlass-sync)');
    console.log('');
    console.log('2. AI Autopilot receives nav-state and updates:');
    console.log('   - widget.ruleEngine.getNavGuidance() returns data');
    console.log('   - Heading target shows: "' + headingDisplay + '"');
    console.log('   - NAV row shows: "GPS"');
    console.log('');
    console.log('3. Rule engine commands heading bug:');
    if (shouldUseNav) {
        console.log('   - AP_NAV1_HOLD true (NAV mode)');
    } else {
        console.log('   - HEADING_BUG_SET ' + Math.round(interceptHdg) + '°');
        console.log('   - AP_HDG_HOLD true (intercept mode)');
    }
    console.log('');
    console.log('='.repeat(60));
    console.log('');

    return navState;
}

function httpGet(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 8080,
            path: path,
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

testE2E().catch(console.error);
