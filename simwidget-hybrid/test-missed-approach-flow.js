/**
 * Complete Missed Approach Flow Test
 * Run this in browser console at: http://192.168.1.42:8080/ui/gtn750/
 */

async function testMissedApproachFlow() {
    console.log('🧪 Testing Complete Missed Approach Flow\n');

    const tests = [];
    const errors = [];

    // Test 1: API returns missed approach data
    console.log('Test 1: API returns missed approach data for KBIH R12-Z');
    try {
        const response = await fetch('http://192.168.1.42:8080/api/navdb/procedure/10489/legs');
        const data = await response.json();

        if (!data.hasMissedApproach) {
            errors.push('Test 1 FAILED: hasMissedApproach should be true');
        } else if (!data.missedApproachWaypoints || data.missedApproachWaypoints.length !== 3) {
            errors.push(`Test 1 FAILED: Expected 3 missed approach waypoints, got ${data.missedApproachWaypoints?.length || 0}`);
        } else {
            tests.push('✅ Test 1 PASSED: API returns missed approach data');
            console.log(`   - hasMissedApproach: ${data.hasMissedApproach}`);
            console.log(`   - missedApproachWaypoints: ${data.missedApproachWaypoints.length}`);
            console.log(`   - Waypoints: ${data.missedApproachWaypoints.map(w => w.ident).join(', ')}`);
        }
    } catch (e) {
        errors.push(`Test 1 ERROR: ${e.message}`);
    }

    // Test 2: ProceduresPage loads missed approach data
    console.log('\nTest 2: ProceduresPage stores missed approach data');
    if (!window.widget || !window.widget.proceduresPage) {
        errors.push('Test 2 FAILED: ProceduresPage not initialized');
    } else {
        // Simulate loading KBIH R12-Z
        const procPage = window.widget.proceduresPage;
        try {
            const response = await fetch('http://192.168.1.42:8080/api/navdb/procedure/10489/legs');
            const data = await response.json();

            if (data.waypoints && data.missedApproachWaypoints) {
                // Simulate what happens when user clicks on R12-Z
                const proc = { id: 10489, name: 'R12-Z', runway: 'R', type: 'APPROACH' };
                const waypoints = data.waypoints.map(wp => ({ ...wp, lng: wp.lon }));
                const missedWaypoints = data.missedApproachWaypoints.map(wp => ({ ...wp, lng: wp.lon }));

                procPage.showDetailsPanel(proc, waypoints, missedWaypoints);

                if (procPage.missedApproachWaypoints && procPage.missedApproachWaypoints.length === 3) {
                    tests.push('✅ Test 2 PASSED: ProceduresPage stores missed approach data');
                    console.log(`   - Stored waypoints: ${procPage.missedApproachWaypoints.map(w => w.ident).join(', ')}`);
                } else {
                    errors.push(`Test 2 FAILED: Expected 3 stored waypoints, got ${procPage.missedApproachWaypoints?.length || 0}`);
                }
            }
        } catch (e) {
            errors.push(`Test 2 ERROR: ${e.message}`);
        }
    }

    // Test 3: GO AROUND button visibility
    console.log('\nTest 3: GO AROUND button visibility');
    const goAroundBtn = document.getElementById('proc-go-around-btn');
    const missedControls = document.getElementById('proc-missed-controls');

    if (!goAroundBtn || !missedControls) {
        errors.push('Test 3 FAILED: GO AROUND button elements not found');
    } else {
        const isVisible = missedControls.style.display !== 'none';
        if (isVisible) {
            tests.push('✅ Test 3 PASSED: GO AROUND button is visible');
            console.log('   - Button style:', window.getComputedStyle(goAroundBtn).background);
        } else {
            errors.push('Test 3 FAILED: GO AROUND button should be visible');
        }
    }

    // Test 4: Click GO AROUND and check flight plan
    console.log('\nTest 4: Click GO AROUND loads waypoints into flight plan');
    if (window.widget && window.widget.flightPlanManager && window.widget.proceduresPage) {
        const fplManager = window.widget.flightPlanManager;
        const procPage = window.widget.proceduresPage;

        // Store initial waypoint count
        const initialCount = fplManager.flightPlan?.waypoints?.length || 0;

        // Simulate GO AROUND button click
        try {
            procPage.activateMissedApproach();

            // Check if waypoints were added
            const newCount = fplManager.flightPlan?.waypoints?.length || 0;
            const addedCount = newCount - initialCount;

            if (addedCount === 3) {
                tests.push('✅ Test 4 PASSED: Missed approach waypoints added to flight plan');
                console.log(`   - Added waypoints: ${addedCount}`);
                console.log(`   - Total waypoints: ${newCount}`);

                // Check waypoint types
                const missedWaypoints = fplManager.flightPlan.waypoints.slice(-3);
                console.log('   - Missed waypoints:', missedWaypoints.map(w => `${w.ident} (${w.type})`).join(', '));

                const allMissed = missedWaypoints.every(w => w.type === 'MISSED' || w.procedureType === 'MISSED');
                if (allMissed) {
                    tests.push('✅ Test 4a PASSED: Waypoints marked as MISSED type');
                } else {
                    errors.push('Test 4a FAILED: Not all waypoints marked as MISSED type');
                }
            } else {
                errors.push(`Test 4 FAILED: Expected 3 added waypoints, got ${addedCount}`);
            }
        } catch (e) {
            errors.push(`Test 4 ERROR: ${e.message}`);
        }
    } else {
        errors.push('Test 4 FAILED: Flight plan manager not initialized');
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tests: ${tests.length + errors.length}`);
    console.log(`Passed: ${tests.length}`);
    console.log(`Failed: ${errors.length}\n`);

    if (tests.length > 0) {
        console.log('PASSED TESTS:');
        tests.forEach(t => console.log(t));
        console.log('');
    }

    if (errors.length > 0) {
        console.log('FAILED TESTS:');
        errors.forEach(e => console.log('❌', e));
        console.log('');
    }

    if (errors.length === 0) {
        console.log('🎉 ALL TESTS PASSED!');
    } else {
        console.log('⚠️  SOME TESTS FAILED');
    }

    return { tests, errors };
}

// Auto-run if in GTN750 page
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected, ready to test missed approach flow');
    console.log('Run: testMissedApproachFlow()');
} else {
    console.log('⚠️  This test should be run at: http://192.168.1.42:8080/ui/gtn750/');
}

// Export for manual execution
if (typeof module !== 'undefined') {
    module.exports = { testMissedApproachFlow };
}
