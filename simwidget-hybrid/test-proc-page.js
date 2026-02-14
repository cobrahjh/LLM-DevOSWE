/**
 * Test PROC Page Functionality
 * Run in browser console on GTN750 PROC page
 */

async function testProcPage() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function test(name, condition, details = '') {
        const passed = Boolean(condition);
        results.tests.push({ name, passed, details });
        if (passed) {
            results.passed++;
            console.log(`✓ ${name}`);
        } else {
            results.failed++;
            console.error(`✗ ${name}`, details);
        }
        return passed;
    }

    console.log('=== GTN750 PROC Page Tests ===\n');

    // Test 1: Page elements exist
    test('PROC page element exists',
        document.getElementById('page-proc'));

    test('PROC tabs exist',
        document.querySelectorAll('.proc-tab').length === 3);

    test('Airport input exists',
        document.getElementById('proc-apt'));

    test('Procedure list exists',
        document.getElementById('proc-list'));

    // Test 2: ProceduresPage instance exists
    const hasInstance = window.widget?.proceduresPage || window.gtn750?.proceduresPage;
    test('ProceduresPage instance exists', hasInstance);

    if (hasInstance) {
        const procPage = window.widget?.proceduresPage || window.gtn750?.proceduresPage;

        // Test 3: Load procedures for KDEN
        console.log('\n--- Testing procedure loading for KDEN ---');
        try {
            await procPage.loadProcedures('KDEN');

            test('Departures loaded',
                procPage.procedures.departures.length > 0,
                `Found ${procPage.procedures.departures.length} departures`);

            test('Arrivals loaded',
                procPage.procedures.arrivals.length > 0,
                `Found ${procPage.procedures.arrivals.length} arrivals`);

            test('Approaches loaded',
                procPage.procedures.approaches.length > 0,
                `Found ${procPage.procedures.approaches.length} approaches`);

            // Test 4: Tab switching
            console.log('\n--- Testing tab switching ---');
            procPage.switchType('dep');
            test('Switch to DEP tab', procPage.procedureType === 'dep');

            procPage.switchType('arr');
            test('Switch to ARR tab', procPage.procedureType === 'arr');

            procPage.switchType('apr');
            test('Switch to APR tab', procPage.procedureType === 'apr');

            // Test 5: Select first approach
            console.log('\n--- Testing procedure selection ---');
            if (procPage.procedures.approaches.length > 0) {
                const firstApproach = procPage.procedures.approaches[0];
                await procPage.selectProcedure(firstApproach);

                test('Procedure selected',
                    procPage.selectedProcedure?.id === firstApproach.id,
                    `Selected: ${firstApproach.name}`);

                test('Preview waypoints loaded',
                    procPage.previewWaypoints.length > 0,
                    `${procPage.previewWaypoints.length} waypoints`);

                // Log first few waypoints
                console.log('\nFirst 5 waypoints:');
                procPage.previewWaypoints.slice(0, 5).forEach((wp, i) => {
                    console.log(`  ${i + 1}. ${wp.ident} (${wp.lat?.toFixed(4)}, ${wp.lon?.toFixed(4)}) ${wp.altDesc || ''} ${wp.altitude || ''}`);
                });
            }

            // Test 6: API endpoints
            console.log('\n--- Testing API endpoints ---');
            const navdbStatus = await fetch('http://localhost:8080/api/navdb/status')
                .then(r => r.json())
                .catch(e => null);

            test('NavDB API accessible',
                navdbStatus?.loaded === true,
                `Database: ${navdbStatus?.database}`);

        } catch (error) {
            test('Procedure loading', false, error.message);
        }
    }

    // Test 7: Soft keys
    console.log('\n--- Testing soft keys ---');
    const softKeys = document.querySelectorAll('.gtn-softkey');
    test('Soft keys rendered', softKeys.length === 6);

    const expectedLabels = ['DEP', 'ARR', 'APR', 'LOAD', 'CHART', 'BACK'];
    const actualLabels = Array.from(softKeys).map(sk => sk.textContent.trim());
    test('Soft key labels correct',
        expectedLabels.every((label, i) => actualLabels[i]?.includes(label)),
        `Expected: ${expectedLabels.join(', ')} | Actual: ${actualLabels.join(', ')}`);

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total: ${results.passed + results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    return results;
}

// Auto-run if page is PROC
if (window.location.hash === '#proc' || document.getElementById('page-proc')?.style.display !== 'none') {
    console.log('PROC page detected, running tests...\n');
    testProcPage().then(results => {
        console.log('\nTests complete!');
        if (results.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.warn(`⚠️ ${results.failed} test(s) failed`);
        }
    });
} else {
    console.log('Navigate to PROC page first (#proc), then run: testProcPage()');
}
