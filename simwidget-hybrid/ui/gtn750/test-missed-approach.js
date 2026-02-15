/**
 * Missed Approach Test Suite for GTN750
 * Tests all aspects of missed approach detection, UI, and flight plan integration
 */

class MissedApproachTests {
    constructor(serverPort = 8080) {
        this.serverPort = serverPort;
        this.results = {
            passed: [],
            failed: [],
            errors: []
        };
    }

    async runAll() {
        console.log('🧪 Missed Approach Test Suite\n');
        console.log('='.repeat(60));

        await this.testAPIDetection();
        await this.testAPIResponse();
        await this.testProcedurePageIntegration();
        await this.testGoAroundButton();
        await this.testFlightPlanLoading();
        await this.testVisualIndicators();

        this.printSummary();
        return this.results;
    }

    // ===== API TESTS =====

    async testAPIDetection() {
        console.log('\n📡 API Detection Tests');

        // Test 1: Procedure WITH missed approach
        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/procedure/10489/legs`);
            const data = await response.json();

            this.assert(
                data.hasMissedApproach === true,
                'API detects missed approach for KBIH R12-Z',
                `Expected hasMissedApproach=true, got ${data.hasMissedApproach}`
            );

            this.assert(
                data.missedApproachWaypoints?.length === 3,
                'API returns 3 missed approach waypoints',
                `Expected 3 waypoints, got ${data.missedApproachWaypoints?.length || 0}`
            );

            this.assert(
                data.missedApproachWaypoints?.[0]?.ident === 'NEBSE',
                'First missed waypoint is NEBSE',
                `Expected NEBSE, got ${data.missedApproachWaypoints?.[0]?.ident}`
            );

            this.assert(
                data.missedApproachWaypoints?.[2]?.pathTerm === 'HM',
                'Last missed waypoint is HM hold',
                `Expected HM, got ${data.missedApproachWaypoints?.[2]?.pathTerm}`
            );
        } catch (e) {
            this.error('API detection test', e);
        }

        // Test 2: Procedure WITHOUT missed approach
        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/procedures/KDEN`);
            const data = await response.json();

            if (data.approaches?.length > 0) {
                const simpleApproach = data.approaches[0];
                const legsResp = await fetch(`http://localhost:${this.serverPort}/api/navdb/procedure/${simpleApproach.id}/legs`);
                const legsData = await legsResp.json();

                // Note: This may or may not have missed approach depending on procedure
                console.log(`  ℹ️  ${simpleApproach.ident}: hasMissedApproach=${legsData.hasMissedApproach}`);
            }
        } catch (e) {
            this.error('API no-missed test', e);
        }
    }

    async testAPIResponse() {
        console.log('\n📦 API Response Structure Tests');

        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/procedure/10489/legs`);
            const data = await response.json();

            this.assert(
                data.procedure !== undefined,
                'Response includes procedure metadata',
                'Missing procedure field'
            );

            this.assert(
                Array.isArray(data.waypoints),
                'Response includes waypoints array',
                'Missing or invalid waypoints field'
            );

            this.assert(
                Array.isArray(data.missedApproachWaypoints),
                'Response includes missedApproachWaypoints array',
                'Missing or invalid missedApproachWaypoints field'
            );

            this.assert(
                typeof data.hasMissedApproach === 'boolean',
                'Response includes hasMissedApproach boolean',
                `Expected boolean, got ${typeof data.hasMissedApproach}`
            );

            // Validate waypoint structure
            const missedWp = data.missedApproachWaypoints[0];
            this.assert(
                missedWp.ident && missedWp.lat && missedWp.lon,
                'Missed waypoints have required fields',
                `Missing required fields in waypoint: ${JSON.stringify(missedWp)}`
            );

            this.assert(
                missedWp.type === 'MISSED',
                'Missed waypoints marked with type=MISSED',
                `Expected type=MISSED, got ${missedWp.type}`
            );
        } catch (e) {
            this.error('API response structure test', e);
        }
    }

    // ===== UI COMPONENT TESTS =====

    async testProcedurePageIntegration() {
        console.log('\n🎯 Procedure Page Integration Tests');

        if (!window.widget?.proceduresPage) {
            this.failed('Procedure page integration', 'ProceduresPage not initialized');
            return;
        }

        const procPage = window.widget.proceduresPage;

        // Test showDetailsPanel stores missed approach data
        try {
            const proc = { id: 10489, name: 'R12-Z', runway: 'R', type: 'APPROACH' };
            const waypoints = [
                { ident: 'HEGIT', lat: 39.0, lon: -109.0 },
                { ident: 'TEVOC', lat: 39.1, lon: -109.1 }
            ];
            const missedWaypoints = [
                { ident: 'NEBSE', lat: 39.2, lon: -109.2, type: 'MISSED' },
                { ident: 'BIH', lat: 39.3, lon: -109.3, type: 'MISSED' }
            ];

            procPage.showDetailsPanel(proc, waypoints, missedWaypoints);

            this.assert(
                procPage.missedApproachWaypoints?.length === 2,
                'ProceduresPage stores missed approach waypoints',
                `Expected 2 waypoints, got ${procPage.missedApproachWaypoints?.length || 0}`
            );
        } catch (e) {
            this.error('showDetailsPanel test', e);
        }

        // Test activateMissedApproach method exists
        this.assert(
            typeof procPage.activateMissedApproach === 'function',
            'ProceduresPage has activateMissedApproach method',
            'Missing activateMissedApproach method'
        );
    }

    async testGoAroundButton() {
        console.log('\n🔘 GO AROUND Button Tests');

        const goAroundBtn = document.getElementById('proc-go-around-btn');
        const missedControls = document.getElementById('proc-missed-controls');

        this.assert(
            goAroundBtn !== null,
            'GO AROUND button element exists',
            'Button not found in DOM'
        );

        this.assert(
            missedControls !== null,
            'Missed approach controls container exists',
            'Container not found in DOM'
        );

        if (goAroundBtn) {
            this.assert(
                goAroundBtn.textContent.includes('GO AROUND'),
                'Button displays GO AROUND text',
                `Expected "GO AROUND", got "${goAroundBtn.textContent}"`
            );

            const styles = window.getComputedStyle(goAroundBtn);
            this.assert(
                styles.backgroundColor !== 'rgba(0, 0, 0, 0)',
                'Button has background color',
                'Button background is transparent'
            );
        }

        // Test visibility logic
        if (window.widget?.proceduresPage) {
            const procPage = window.widget.proceduresPage;

            // With missed approach waypoints
            procPage.procedureType = 'apr';
            const waypoints = [{ ident: 'WP1', lat: 0, lon: 0 }];
            const missedWaypoints = [{ ident: 'MISSED1', lat: 0, lon: 0, type: 'MISSED' }];

            procPage.showDetailsPanel({ name: 'TEST' }, waypoints, missedWaypoints);

            this.assert(
                missedControls.style.display !== 'none',
                'GO AROUND button shows for approaches with missed approach',
                `Display is "${missedControls.style.display}"`
            );

            // Without missed approach waypoints
            procPage.showDetailsPanel({ name: 'TEST' }, waypoints, null);

            this.assert(
                missedControls.style.display === 'none',
                'GO AROUND button hides when no missed approach',
                `Display should be "none", got "${missedControls.style.display}"`
            );
        }
    }

    // ===== FLIGHT PLAN INTEGRATION TESTS =====

    async testFlightPlanLoading() {
        console.log('\n✈️  Flight Plan Loading Tests');

        if (!window.widget?.flightPlanManager) {
            this.failed('Flight plan loading', 'Flight plan manager not initialized');
            return;
        }

        const fplManager = window.widget.flightPlanManager;

        // Test loadProcedure with 'missed' type
        try {
            const initialCount = fplManager.flightPlan?.waypoints?.length || 0;

            const missedWaypoints = [
                { ident: 'NEBSE', lat: 39.0, lon: -109.0, type: 'MISSED' },
                { ident: 'BIH', lat: 39.1, lon: -109.1, type: 'MISSED' }
            ];

            fplManager.loadProcedure('missed', { name: 'TEST MISSED' }, missedWaypoints);

            const newCount = fplManager.flightPlan?.waypoints?.length || 0;

            this.assert(
                newCount === initialCount + 2,
                'Flight plan manager adds missed approach waypoints',
                `Expected ${initialCount + 2} waypoints, got ${newCount}`
            );

            // Check waypoint types
            const lastWaypoints = fplManager.flightPlan.waypoints.slice(-2);
            const allMissed = lastWaypoints.every(wp =>
                wp.type === 'MISSED' || wp.procedureType === 'MISSED'
            );

            this.assert(
                allMissed,
                'Added waypoints are marked as MISSED type',
                'Not all waypoints have MISSED type'
            );
        } catch (e) {
            this.error('loadProcedure test', e);
        }
    }

    // ===== VISUAL INDICATOR TESTS =====

    async testVisualIndicators() {
        console.log('\n🎨 Visual Indicator Tests');

        // Test CSS classes exist
        const styles = document.styleSheets;
        let foundMissedClass = false;
        let foundMissedBadge = false;

        for (let sheet of styles) {
            try {
                for (let rule of sheet.cssRules || sheet.rules) {
                    if (rule.selectorText?.includes('missed-approach')) {
                        foundMissedClass = true;
                    }
                    if (rule.selectorText?.includes('fpl-missed-badge')) {
                        foundMissedBadge = true;
                    }
                }
            } catch (e) {
                // CORS may block reading external stylesheets
            }
        }

        this.assert(
            foundMissedClass,
            'CSS includes .missed-approach class',
            'Class not found in stylesheets'
        );

        this.assert(
            foundMissedBadge,
            'CSS includes .fpl-missed-badge class',
            'Badge class not found in stylesheets'
        );

        // Test map renderer visual differentiation
        if (typeof GTNMapRenderer !== 'undefined') {
            console.log('  ✓ GTNMapRenderer class available');
            console.log('  ℹ️  Map rendering visual test requires manual verification');
        }
    }

    // ===== HELPER METHODS =====

    assert(condition, testName, failureMessage) {
        if (condition) {
            this.results.passed.push(testName);
            console.log(`  ✅ ${testName}`);
        } else {
            this.results.failed.push({ test: testName, reason: failureMessage });
            console.log(`  ❌ ${testName}: ${failureMessage}`);
        }
    }

    failed(testName, reason) {
        this.results.failed.push({ test: testName, reason });
        console.log(`  ❌ ${testName}: ${reason}`);
    }

    error(testName, error) {
        this.results.errors.push({ test: testName, error: error.message, stack: error.stack });
        console.log(`  💥 ${testName}: ERROR - ${error.message}`);
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total tests: ${this.results.passed.length + this.results.failed.length + this.results.errors.length}`);
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);
        console.log(`💥 Errors: ${this.results.errors.length}`);

        if (this.results.failed.length > 0) {
            console.log('\nFailed tests:');
            this.results.failed.forEach(f => console.log(`  - ${f.test}: ${f.reason}`));
        }

        if (this.results.errors.length > 0) {
            console.log('\nErrors:');
            this.results.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
        }

        if (this.results.failed.length === 0 && this.results.errors.length === 0) {
            console.log('\n🎉 ALL TESTS PASSED!');
        } else {
            console.log('\n⚠️  SOME TESTS FAILED');
        }
    }
}

// Auto-run if in GTN750 page
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected - ready to test missed approach feature');
    console.log('Run: new MissedApproachTests().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export for use
if (typeof window !== 'undefined') {
    window.MissedApproachTests = MissedApproachTests;
}
