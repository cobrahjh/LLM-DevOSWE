/**
 * Airways End-to-End Test Suite
 * Tests complete airways workflow from soft key to flight plan insertion
 */

class AirwaysE2ETests {
    constructor(serverPort = 8080) {
        this.serverPort = serverPort;
        this.results = {
            passed: [],
            failed: [],
            errors: []
        };
    }

    async runAll() {
        console.log('🧪 Airways End-to-End Test Suite\n');
        console.log('='.repeat(60));

        await this.testBackendAPI();
        await this.testSoftKeyButton();
        await this.testFlightPlanIntegration();
        await this.testSmartSuggestions();
        await this.testMapRendering();

        this.printSummary();
        return this.results;
    }

    // ===== BACKEND API TESTS =====

    async testBackendAPI() {
        console.log('\n📡 Backend API Tests');

        // Test 1: Fetch complete airway
        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/airway/V2`);
            const data = await response.json();

            this.assert(
                data.ident === 'V2',
                'API returns V2 airway',
                `Expected V2, got ${data.ident}`
            );

            this.assert(
                Array.isArray(data.fixes) && data.fixes.length > 0,
                'V2 airway has fixes',
                `Expected array with fixes, got ${data.fixes?.length || 0}`
            );

            this.assert(
                data.route_type === 'LOW' || data.route_type === 'BOTH',
                'V2 is LOW altitude airway',
                `Expected LOW, got ${data.route_type}`
            );
        } catch (e) {
            this.error('V2 airway fetch test', e);
        }

        // Test 2: Fetch airway with entry/exit
        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/airway/V2?entry=SEA&exit=BTG`);
            const data = await response.json();

            this.assert(
                data.entry === 'SEA',
                'API returns SEA as entry fix',
                `Expected SEA, got ${data.entry}`
            );

            this.assert(
                data.exit === 'BTG',
                'API returns BTG as exit fix',
                `Expected BTG, got ${data.exit}`
            );

            this.assert(
                data.fixes.length >= 2 && data.fixes.length <= 10,
                'SEA-BTG segment has reasonable fix count',
                `Expected 2-10 fixes, got ${data.fixes.length}`
            );

            // Verify first and last fix match entry/exit
            this.assert(
                data.fixes[0].ident === 'SEA',
                'First fix is entry (SEA)',
                `Expected SEA, got ${data.fixes[0]?.ident}`
            );

            this.assert(
                data.fixes[data.fixes.length - 1].ident === 'BTG',
                'Last fix is exit (BTG)',
                `Expected BTG, got ${data.fixes[data.fixes.length - 1]?.ident}`
            );
        } catch (e) {
            this.error('V2 SEA-BTG segment test', e);
        }

        // Test 3: Nearby airways
        try {
            const response = await fetch(`http://localhost:${this.serverPort}/api/navdb/nearby/airways?lat=47.449&lon=-122.309&range=100&limit=10`);
            const data = await response.json();

            this.assert(
                Array.isArray(data.items),
                'Nearby airways returns items array',
                'Missing items field'
            );

            this.assert(
                data.items.length > 0,
                'Found airways near Seattle',
                `Expected > 0 airways, got ${data.items.length}`
            );

            // Check for V2 in results (should be nearby Seattle)
            const v2Found = data.items.some(a => a.ident === 'V2');
            this.assert(
                v2Found,
                'V2 airway found near Seattle',
                'V2 not in nearby results'
            );
        } catch (e) {
            this.error('Nearby airways test', e);
        }
    }

    // ===== UI COMPONENT TESTS =====

    async testSoftKeyButton() {
        console.log('\n🔘 Soft Key Button Tests');

        if (!window.widget?.softKeys) {
            this.failed('Soft key integration', 'GTNSoftKeys not initialized');
            return;
        }

        const softKeys = window.widget.softKeys;

        // Test 1: AWY button exists in fpl-selected context
        const fplSelectedContext = softKeys.contexts.get('fpl-selected');
        this.assert(
            fplSelectedContext !== undefined,
            'fpl-selected context exists',
            'Context not found'
        );

        if (fplSelectedContext) {
            const awyButton = fplSelectedContext.find(k => k.label === 'AWY');
            this.assert(
                awyButton !== undefined,
                'AWY soft key exists in fpl-selected context',
                'AWY button not found in context'
            );

            this.assert(
                awyButton?.action === 'fpl-airway',
                'AWY button action is fpl-airway',
                `Expected fpl-airway, got ${awyButton?.action}`
            );
        }

        // Test 2: AWY button visibility (requires flight plan with waypoints)
        if (window.widget?.flightPlanManager) {
            const fplManager = window.widget.flightPlanManager;

            // Clear flight plan first
            fplManager.clearFlightPlan();

            // Add test waypoints
            fplManager.insertWaypoint({ ident: 'KSEA', lat: 47.449, lng: -122.309, type: 'AIRPORT' }, 0);
            fplManager.insertWaypoint({ ident: 'KPDX', lat: 45.588, lng: -122.598, type: 'AIRPORT' }, 1);

            // Select first waypoint
            if (window.widget.fplPage) {
                window.widget.fplPage.selectedWaypointIndex = 0;
                softKeys.setContext('fpl-selected');

                // Check if AWY button is visible
                const awyKey = softKeys.keys.find(k => k.dataset.action === 'fpl-airway');
                this.assert(
                    awyKey !== undefined,
                    'AWY soft key rendered in DOM',
                    'Button not found in DOM'
                );

                const label = awyKey?.querySelector('.sk-label')?.textContent;
                this.assert(
                    label === 'AWY',
                    'AWY button displays correct label',
                    `Expected "AWY", got "${label}"`
                );
            }
        }
    }

    // ===== FLIGHT PLAN INTEGRATION TESTS =====

    async testFlightPlanIntegration() {
        console.log('\n✈️  Flight Plan Integration Tests');

        if (!window.widget?.flightPlanManager) {
            this.failed('Flight plan integration', 'Flight plan manager not initialized');
            return;
        }

        const fplManager = window.widget.flightPlanManager;

        // Test 1: insertAirway method exists
        this.assert(
            typeof fplManager.insertAirway === 'function',
            'insertAirway method exists',
            'Missing insertAirway method'
        );

        // Test 2: Insert V2 airway
        try {
            fplManager.clearFlightPlan();
            fplManager.insertWaypoint({ ident: 'KSEA', lat: 47.449, lng: -122.309, type: 'AIRPORT' }, 0);
            fplManager.insertWaypoint({ ident: 'KPDX', lat: 45.588, lng: -122.598, type: 'AIRPORT' }, 1);

            const initialCount = fplManager.flightPlan.waypoints.length;

            // Insert V2 airway between KSEA and KPDX
            const result = await fplManager.insertAirway('V2', 'SEA', 'BTG');

            this.assert(
                result !== false,
                'insertAirway succeeds',
                'insertAirway returned false'
            );

            const newCount = fplManager.flightPlan.waypoints.length;
            this.assert(
                newCount > initialCount,
                'Airway waypoints added to flight plan',
                `Expected > ${initialCount}, got ${newCount}`
            );

            // Check waypoint properties
            const airwayWaypoints = fplManager.flightPlan.waypoints.filter(wp => wp.airway === 'V2');
            this.assert(
                airwayWaypoints.length > 0,
                'Waypoints tagged with airway V2',
                `Expected > 0, got ${airwayWaypoints.length}`
            );

            // Check MEA data
            const wpWithMEA = airwayWaypoints.find(wp => wp.minAlt !== undefined);
            this.assert(
                wpWithMEA !== undefined,
                'Waypoints include MEA data',
                'No waypoints have minAlt field'
            );

        } catch (e) {
            this.error('insertAirway test', e);
        }
    }

    // ===== SMART SUGGESTIONS TESTS =====

    async testSmartSuggestions() {
        console.log('\n🎯 Smart Suggestions Tests');

        if (!window.widget?.flightPlanManager) {
            this.failed('Smart suggestions', 'Flight plan manager not initialized');
            return;
        }

        const fplManager = window.widget.flightPlanManager;

        // Test 1: findConnectingAirways method exists
        this.assert(
            typeof fplManager.findConnectingAirways === 'function',
            'findConnectingAirways method exists',
            'Missing findConnectingAirways method'
        );

        // Test 2: Find airways connecting KSEA and KPDX
        try {
            const entryWp = { ident: 'KSEA', lat: 47.449, lon: -122.309 };
            const exitWp = { ident: 'KPDX', lat: 45.588, lon: -122.598 };

            const suggestions = await fplManager.findConnectingAirways(entryWp, exitWp, 47.449, -122.309);

            this.assert(
                Array.isArray(suggestions),
                'findConnectingAirways returns array',
                `Expected array, got ${typeof suggestions}`
            );

            // V2 should connect Seattle to Portland area
            const v2Suggestion = suggestions.find(s => s.ident === 'V2');
            if (v2Suggestion) {
                console.log(`  ℹ️  V2 suggestion: ${v2Suggestion.fixCount} fixes, MEA ${v2Suggestion.mea}ft, ${v2Suggestion.distance.toFixed(1)}nm`);

                this.assert(
                    v2Suggestion.fixCount > 0,
                    'V2 suggestion includes fix count',
                    `Expected > 0, got ${v2Suggestion.fixCount}`
                );

                this.assert(
                    v2Suggestion.mea > 0,
                    'V2 suggestion includes MEA',
                    `Expected > 0, got ${v2Suggestion.mea}`
                );
            } else {
                console.log('  ℹ️  V2 not in suggestions (may not connect these exact waypoints)');
            }

        } catch (e) {
            this.error('findConnectingAirways test', e);
        }
    }

    // ===== MAP RENDERING TESTS =====

    async testMapRendering() {
        console.log('\n🗺️  Map Rendering Tests');

        if (!window.widget?.mapRenderer) {
            this.failed('Map rendering', 'Map renderer not initialized');
            return;
        }

        const mapRenderer = window.widget.mapRenderer;

        // Test 1: renderAirways method exists
        this.assert(
            typeof mapRenderer.renderAirways === 'function',
            'renderAirways method exists',
            'Missing renderAirways method'
        );

        // Test 2: Airways data structure
        if (window.widget?.dataHandler) {
            const dataHandler = window.widget.dataHandler;

            // Airways should be fetched automatically in background
            // Check if we have nearby airways in state
            setTimeout(() => {
                const nearbyAirways = dataHandler.nearbyAirways || [];

                if (nearbyAirways.length > 0) {
                    console.log(`  ℹ️  ${nearbyAirways.length} nearby airways loaded for rendering`);

                    const airway = nearbyAirways[0];
                    this.assert(
                        airway.ident !== undefined,
                        'Airways have ident field',
                        'Missing ident field'
                    );

                    this.assert(
                        Array.isArray(airway.fixes),
                        'Airways have fixes array',
                        'Missing or invalid fixes field'
                    );
                } else {
                    console.log('  ℹ️  No nearby airways (may not be in range of airways)');
                }
            }, 1000);
        }

        // Test 3: Airways toggle function
        this.assert(
            typeof window.widget.toggleAirways === 'function',
            'toggleAirways function exists',
            'Missing toggleAirways function'
        );
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
    console.log('GTN750 detected - ready to test airways feature');
    console.log('Run: new AirwaysE2ETests().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export for use
if (typeof window !== 'undefined') {
    window.AirwaysE2ETests = AirwaysE2ETests;
}
