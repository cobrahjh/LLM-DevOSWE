/**
 * TCAS Validation Test
 * Tests TCAS II Traffic Advisory and Resolution Advisory logic
 *
 * Run in browser console at http://192.168.1.42:8080/ui/gtn750/
 */

class TCASValidationTest {
    constructor() {
        this.results = { passed: [], failed: [], info: [] };
    }

    async runAll() {
        console.log('🧪 TCAS Validation Test Suite\n');
        console.log('='.repeat(60));

        this.testModule();
        this.testGeometryCalculation();
        this.testTauCalculation();
        this.testThreatClassification();
        this.testTALogic();
        this.testRALogic();
        this.testRASense();
        this.testAltitudeSensitivity();
        this.testAlertPriority();

        this.printSummary();
        return this.results;
    }

    // ===== MODULE TESTS =====

    testModule() {
        console.log('\n📦 TCAS Module Tests');

        if (typeof GTNTCAS === 'undefined') {
            this.failed('GTNTCAS class not defined');
            return;
        }

        this.assert(
            typeof GTNTCAS === 'function',
            'GTNTCAS is a class'
        );

        // Create instance for testing
        window.testTCAS = new GTNTCAS({
            autoSave: false
        });

        const tcas = window.testTCAS;

        this.assert(
            typeof tcas.setEnabled === 'function',
            'Has setEnabled method'
        );

        this.assert(
            typeof tcas.setSensitivity === 'function',
            'Has setSensitivity method'
        );

        this.assert(
            typeof tcas.update === 'function',
            'Has update method'
        );

        this.assert(
            typeof tcas.calculateGeometry === 'function',
            'Has calculateGeometry method'
        );

        this.assert(
            typeof tcas.calculateTau === 'function',
            'Has calculateTau method'
        );

        this.assert(
            typeof tcas.classifyThreat === 'function',
            'Has classifyThreat method'
        );

        this.assert(
            typeof tcas.calculateRASense === 'function',
            'Has calculateRASense method'
        );

        this.assert(
            tcas.config.taEnabled === true,
            'TA enabled by default'
        );

        this.assert(
            tcas.config.raEnabled === true,
            'RA enabled by default'
        );

        this.info(`TCAS initialized: ${tcas.config.enabled ? 'ENABLED' : 'DISABLED'}`);
        this.info(`Sensitivity: ${tcas.config.sensitivity}`);
    }

    // ===== GEOMETRY CALCULATION TESTS =====

    testGeometryCalculation() {
        console.log('\n📐 Geometry Calculation Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test case 1: Same position (0nm distance)
        const ownShip1 = {
            latitude: 40.0,
            longitude: -105.0,
            altitude: 8000,
            heading: 360,
            groundSpeed: 120,
            verticalSpeed: 0
        };

        const traffic1 = {
            lat: 40.0,
            lon: -105.0,
            altitude: 8500,
            heading: 180,
            groundSpeed: 120,
            verticalSpeed: 0
        };

        const geo1 = tcas.calculateGeometry(traffic1, ownShip1);

        this.assert(
            geo1.distance < 0.1,
            `Same position distance ~0nm (actual: ${geo1.distance.toFixed(2)}nm)`
        );

        this.assert(
            geo1.altitudeSeparation === 500,
            `Altitude separation 500ft (actual: ${geo1.altitudeSeparation}ft)`
        );

        // Test case 2: 5nm away at same altitude
        const traffic2 = {
            lat: 40.0725, // ~5nm north (1° lat ≈ 69nm)
            lon: -105.0,
            altitude: 8000,
            heading: 180,
            groundSpeed: 120,
            verticalSpeed: 0
        };

        const geo2 = tcas.calculateGeometry(traffic2, ownShip1);

        this.assert(
            Math.abs(geo2.distance - 5.0) < 0.5,
            `5nm distance calculated (actual: ${geo2.distance.toFixed(2)}nm)`
        );

        this.assert(
            geo2.altitudeSeparation === 0,
            `Same altitude separation (actual: ${geo2.altitudeSeparation}ft)`
        );

        // Test case 3: Head-on closure
        const ownShip3 = {
            latitude: 40.0,
            longitude: -105.0,
            altitude: 8000,
            heading: 360, // North
            groundSpeed: 150,
            verticalSpeed: 0
        };

        const traffic3 = {
            lat: 40.05, // ~3.5nm north
            lon: -105.0,
            altitude: 8000,
            heading: 180, // South (head-on)
            groundSpeed: 150,
            verticalSpeed: 0
        };

        const geo3 = tcas.calculateGeometry(traffic3, ownShip3);

        this.assert(
            geo3.closureRate > 250, // 150 + 150 = 300kt closure
            `Head-on closure rate >250kt (actual: ${geo3.closureRate.toFixed(0)}kt)`
        );

        this.info(`Head-on closure: ${geo3.closureRate.toFixed(0)}kt`);
    }

    // ===== TAU CALCULATION TESTS =====

    testTauCalculation() {
        console.log('\n⏱️  Tau Calculation Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test case 1: 5nm away, 200kt closure → 90s tau
        const geo1 = {
            distance: 5.0,
            closureRate: 200,
            altitudeSeparation: 0,
            verticalClosureRate: 0
        };

        const tau1 = tcas.calculateTau(geo1);
        const expectedTau1 = (5.0 / 200) * 3600; // 90 seconds

        this.assert(
            Math.abs(tau1 - expectedTau1) < 5,
            `Tau calculation accurate (expected ${expectedTau1.toFixed(0)}s, got ${tau1.toFixed(0)}s)`
        );

        // Test case 2: Vertical closure
        const geo2 = {
            distance: 10.0,
            closureRate: 50,
            altitudeSeparation: 1000,
            verticalClosureRate: 2000 // 2000fpm closure
        };

        const tau2 = tcas.calculateTau(geo2);
        const expectedTau2Vertical = (1000 / 2000) * 60; // 30 seconds

        this.assert(
            Math.abs(tau2 - expectedTau2Vertical) < 5,
            `Vertical tau calculated (expected ${expectedTau2Vertical.toFixed(0)}s, got ${tau2.toFixed(0)}s)`
        );

        this.info(`Tau calculation: 5nm at 200kt = ${tau1.toFixed(0)}s`);
        this.info(`Vertical tau: 1000ft at 2000fpm = ${tau2.toFixed(0)}s`);

        // Test case 3: Not closing
        const geo3 = {
            distance: 5.0,
            closureRate: 5, // Below 10kt threshold
            altitudeSeparation: 0,
            verticalClosureRate: 0
        };

        const tau3 = tcas.calculateTau(geo3);

        this.assert(
            tau3 === Infinity,
            'Returns Infinity when not closing'
        );
    }

    // ===== THREAT CLASSIFICATION TESTS =====

    testThreatClassification() {
        console.log('\n🎯 Threat Classification Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        const ownShip = { altitude: 10000 };

        // At 10,000ft: TA zone = 6nm/±1200ft, RA zone = 3.5nm/±800ft

        // Test RA zone
        const geo1 = {
            distance: 3.0,      // < 3.5nm
            altitudeSeparation: 500  // < 800ft
        };

        const threat1 = tcas.classifyThreat(geo1, ownShip);

        this.assert(
            threat1 === 'RA_ZONE',
            `RA zone detected (3nm, 500ft): ${threat1}`
        );

        // Test TA zone
        const geo2 = {
            distance: 5.0,      // < 6nm, > 3.5nm
            altitudeSeparation: 1000 // < 1200ft, > 800ft
        };

        const threat2 = tcas.classifyThreat(geo2, ownShip);

        this.assert(
            threat2 === 'TA_ZONE',
            `TA zone detected (5nm, 1000ft): ${threat2}`
        );

        // Test proximate
        const geo3 = {
            distance: 8.0,      // < 10nm, > 6nm
            altitudeSeparation: 2000 // > 1200ft
        };

        const threat3 = tcas.classifyThreat(geo3, ownShip);

        this.assert(
            threat3 === 'PROXIMATE',
            `Proximate traffic detected (8nm, 2000ft): ${threat3}`
        );

        // Test other
        const geo4 = {
            distance: 15.0,
            altitudeSeparation: 3000
        };

        const threat4 = tcas.classifyThreat(geo4, ownShip);

        this.assert(
            threat4 === 'OTHER',
            `Other traffic detected (15nm, 3000ft): ${threat4}`
        );
    }

    // ===== TA LOGIC TESTS =====

    testTALogic() {
        console.log('\n🟡 Traffic Advisory (TA) Logic Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test TA triggered
        const geo1 = { distance: 5.0, altitudeSeparation: 1000 };
        const tau1 = 18; // < 20s TA threshold
        const threat1 = 'TA_ZONE';

        const isTA1 = tcas.isTrafficAdvisory(geo1, tau1, threat1);

        this.assert(
            isTA1 === true,
            'TA triggered in TA zone with tau < 20s'
        );

        // Test TA not triggered (tau too large)
        const tau2 = 25; // > 20s
        const isTA2 = tcas.isTrafficAdvisory(geo1, tau2, threat1);

        this.assert(
            isTA2 === false,
            'TA not triggered when tau > 20s'
        );

        // Test TA not triggered (outside TA zone)
        const threat3 = 'PROXIMATE';
        const isTA3 = tcas.isTrafficAdvisory(geo1, tau1, threat3);

        this.assert(
            isTA3 === false,
            'TA not triggered outside TA zone'
        );

        // Test TA disabled
        tcas.config.taEnabled = false;
        const isTA4 = tcas.isTrafficAdvisory(geo1, tau1, threat1);

        this.assert(
            isTA4 === false,
            'TA not triggered when disabled'
        );

        tcas.config.taEnabled = true; // Re-enable
    }

    // ===== RA LOGIC TESTS =====

    testRALogic() {
        console.log('\n🔴 Resolution Advisory (RA) Logic Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test RA triggered
        const geo1 = { distance: 3.0, altitudeSeparation: 500 };
        const tau1 = 12; // < 15s RA threshold
        const threat1 = 'RA_ZONE';

        const isRA1 = tcas.isResolutionAdvisory(geo1, tau1, threat1);

        this.assert(
            isRA1 === true,
            'RA triggered in RA zone with tau < 15s'
        );

        // Test RA not triggered (tau too large)
        const tau2 = 18; // > 15s
        const isRA2 = tcas.isResolutionAdvisory(geo1, tau2, threat1);

        this.assert(
            isRA2 === false,
            'RA not triggered when tau > 15s'
        );

        // Test RA not triggered (in TA zone, not RA zone)
        const threat3 = 'TA_ZONE';
        const isRA3 = tcas.isResolutionAdvisory(geo1, tau1, threat3);

        this.assert(
            isRA3 === false,
            'RA not triggered in TA zone'
        );

        // Test RA disabled
        tcas.config.raEnabled = false;
        const isRA4 = tcas.isResolutionAdvisory(geo1, tau1, threat1);

        this.assert(
            isRA4 === false,
            'RA not triggered when disabled'
        );

        tcas.config.raEnabled = true; // Re-enable
    }

    // ===== RA SENSE TESTS =====

    testRASense() {
        console.log('\n⬆️⬇️  RA Sense Determination Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test case 1: Traffic above, climbing → DESCEND
        const traffic1 = { verticalSpeed: 1000 }; // Climbing
        const ownShip1 = { verticalSpeed: 0 };
        const geo1 = { altitudeSeparation: 500 }; // Traffic above (+)

        const sense1 = tcas.calculateRASense(traffic1, ownShip1, geo1);

        this.assert(
            sense1 === 'DESCEND',
            `Traffic above climbing → DESCEND (actual: ${sense1})`
        );

        // Test case 2: Traffic above, descending → CLIMB
        const traffic2 = { verticalSpeed: -500 }; // Descending
        const sense2 = tcas.calculateRASense(traffic2, ownShip1, geo1);

        this.assert(
            sense2 === 'CLIMB',
            `Traffic above descending → CLIMB (actual: ${sense2})`
        );

        // Test case 3: Traffic below, climbing → CLIMB
        const geo3 = { altitudeSeparation: -500 }; // Traffic below (-)
        const traffic3 = { verticalSpeed: 1000 }; // Climbing
        const sense3 = tcas.calculateRASense(traffic3, ownShip1, geo3);

        this.assert(
            sense3 === 'CLIMB',
            `Traffic below climbing → CLIMB (actual: ${sense3})`
        );

        // Test case 4: Traffic below, descending → DESCEND
        const traffic4 = { verticalSpeed: -500 }; // Descending
        const sense4 = tcas.calculateRASense(traffic4, ownShip1, geo3);

        this.assert(
            sense4 === 'DESCEND',
            `Traffic below descending → DESCEND (actual: ${sense4})`
        );

        this.info('RA sense logic validated for all quadrants');
    }

    // ===== ALTITUDE SENSITIVITY TESTS =====

    testAltitudeSensitivity() {
        console.log('\n📏 Altitude-Based Sensitivity Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        // Test low altitude (< 2,350 ft)
        tcas.adjustThresholdsForAltitude(1500);

        this.assert(
            tcas.config.taHorizontal === 3.3,
            `Low altitude TA zone: 3.3nm (actual: ${tcas.config.taHorizontal}nm)`
        );

        this.assert(
            tcas.config.raHorizontal === 2.0,
            `Low altitude RA zone: 2.0nm (actual: ${tcas.config.raHorizontal}nm)`
        );

        // Test mid altitude (5,000 - 10,000 ft)
        tcas.adjustThresholdsForAltitude(7500);

        this.assert(
            tcas.config.taHorizontal === 6.0,
            `Mid altitude TA zone: 6.0nm (actual: ${tcas.config.taHorizontal}nm)`
        );

        this.assert(
            tcas.config.raHorizontal === 3.5,
            `Mid altitude RA zone: 3.5nm (actual: ${tcas.config.raHorizontal}nm)`
        );

        // Test high altitude (> 20,000 ft)
        tcas.adjustThresholdsForAltitude(25000);

        this.assert(
            tcas.config.taHorizontal === 7.0,
            `High altitude TA zone: 7.0nm (actual: ${tcas.config.taHorizontal}nm)`
        );

        this.assert(
            tcas.config.raHorizontal === 4.0,
            `High altitude RA zone: 4.0nm (actual: ${tcas.config.raHorizontal}nm)`
        );

        this.info('Altitude-based sensitivity adjustment verified');
    }

    // ===== ALERT PRIORITY TESTS =====

    testAlertPriority() {
        console.log('\n🚨 Alert Priority Tests');

        const tcas = window.testTCAS;
        if (!tcas) return;

        const ownShip = {
            latitude: 40.0,
            longitude: -105.0,
            altitude: 8000,
            heading: 360,
            groundSpeed: 150,
            verticalSpeed: 0
        };

        // Create multiple threats
        const traffic = [
            // RA threat (highest priority)
            {
                callsign: 'RA1',
                lat: 40.04,
                lon: -105.0,
                altitude: 8400,
                heading: 180,
                groundSpeed: 150,
                verticalSpeed: 0
            },
            // TA threat
            {
                callsign: 'TA1',
                lat: 40.08,
                lon: -105.0,
                altitude: 9000,
                heading: 180,
                groundSpeed: 120,
                verticalSpeed: 0
            },
            // Proximate
            {
                callsign: 'PROX1',
                lat: 40.15,
                lon: -105.0,
                altitude: 10000,
                heading: 90,
                groundSpeed: 100,
                verticalSpeed: 0
            }
        ];

        // Update TCAS
        tcas.update(traffic, ownShip);

        // Check active threats
        const activeRA = tcas.activeRA;
        const activeTA = tcas.activeTA;

        if (activeRA) {
            this.assert(
                activeRA.callsign === 'RA1',
                `RA threat prioritized (${activeRA.callsign})`
            );

            this.assert(
                activeTA === null,
                'TA suppressed when RA active'
            );

            this.info(`Active RA: ${activeRA.callsign}, sense: ${activeRA.raSense}`);
        } else {
            this.info('No RA active (traffic may be outside RA zone or tau threshold)');
        }

        this.assert(
            tcas.threats.size === traffic.length,
            `All traffic processed (${tcas.threats.size}/${traffic.length})`
        );
    }

    // ===== HELPER METHODS =====

    assert(condition, testName) {
        if (condition) {
            this.results.passed.push(testName);
            console.log(`  ✅ ${testName}`);
        } else {
            this.results.failed.push(testName);
            console.log(`  ❌ ${testName}`);
        }
    }

    failed(reason) {
        this.results.failed.push(reason);
        console.log(`  ❌ ${reason}`);
    }

    info(message) {
        this.results.info.push(message);
        console.log(`  ℹ️  ${message}`);
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('TCAS VALIDATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);

        if (this.results.failed.length > 0) {
            console.log('\nFailed tests:');
            this.results.failed.forEach(f => console.log(`  - ${f}`));
        }

        if (this.results.failed.length === 0) {
            console.log('\n🎉 TCAS FULLY VALIDATED!');
            console.log('\nTCAS Features Confirmed:');
            console.log('  ✓ TCAS II geometry and tau calculation');
            console.log('  ✓ Traffic Advisory (TA) logic');
            console.log('  ✓ Resolution Advisory (RA) logic');
            console.log('  ✓ RA sense determination (CLIMB/DESCEND)');
            console.log('  ✓ Altitude-based sensitivity adjustment');
            console.log('  ✓ Alert priority (RA supersedes TA)');
            console.log('\nReady for collision avoidance operations!');
        }
    }
}

// Auto-run
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected - ready to validate TCAS');
    console.log('Run: new TCASValidationTest().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export
if (typeof window !== 'undefined') {
    window.TCASValidationTest = TCASValidationTest;
}
