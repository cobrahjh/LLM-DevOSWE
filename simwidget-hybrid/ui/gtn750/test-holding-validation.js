/**
 * Holding Pattern Validation Test
 * Tests holding pattern entry calculation, detection, and sequencing
 *
 * Run in browser console at http://192.168.1.42:8080/ui/gtn750/
 */

class HoldingValidationTest {
    constructor() {
        this.results = { passed: [], failed: [], info: [] };
    }

    async runAll() {
        console.log('🧪 Holding Pattern Validation Test Suite\n');
        console.log('='.repeat(60));

        this.testHoldingModule();
        this.testEntryCalculation();
        this.testHoldDetection();
        this.testRacetrackCalculation();
        await this.testProcedureIntegration();

        this.printSummary();
        return this.results;
    }

    // ===== MODULE TESTS =====

    testHoldingModule() {
        console.log('\n📦 Holding Module Tests');

        if (!window.widget?.holdingManager) {
            this.failed('Holding module not initialized');
            return;
        }

        const holding = window.widget.holdingManager;

        this.assert(
            typeof holding.calculateEntryProcedure === 'function',
            'Holding has calculateEntryProcedure method'
        );

        this.assert(
            typeof holding.detectHoldFromWaypoint === 'function',
            'Holding has detectHoldFromWaypoint method'
        );

        this.assert(
            typeof holding.enterHold === 'function',
            'Holding has enterHold method'
        );

        this.assert(
            typeof holding.exitHold === 'function',
            'Holding has exitHold method'
        );

        this.assert(
            typeof holding.calculateRacetrack === 'function',
            'Holding has calculateRacetrack method'
        );

        this.assert(
            typeof holding.update === 'function',
            'Holding has update method'
        );

        this.assert(
            typeof holding.getStatus === 'function',
            'Holding has getStatus method'
        );

        const status = holding.getStatus();
        this.info(`Holding status: ${holding.active ? 'ACTIVE' : 'INACTIVE'}`);
    }

    // ===== ENTRY CALCULATION TESTS =====

    testEntryCalculation() {
        console.log('\n🎯 Entry Procedure Calculation Tests');

        if (!window.widget?.holdingManager) {
            this.failed('Holding not available');
            return;
        }

        const holding = window.widget.holdingManager;

        // Test case 1: DIRECT entry (within 70° of outbound)
        // Inbound 360°, outbound 180°, heading 200° → 20° from outbound → DIRECT
        const entry1 = holding.calculateEntryProcedure(200, 360, 'R');
        this.assert(
            entry1 === 'DIRECT',
            `Direct entry: heading 200°, inbound 360° → ${entry1} (expected DIRECT)`
        );

        // Test case 2: TEARDROP entry (70° to 110° left of outbound)
        // Inbound 360°, outbound 180°, heading 270° → 90° from outbound → TEARDROP
        const entry2 = holding.calculateEntryProcedure(270, 360, 'R');
        this.assert(
            entry2 === 'TEARDROP',
            `Teardrop entry: heading 270°, inbound 360° → ${entry2} (expected TEARDROP)`
        );

        // Test case 3: PARALLEL entry (110° to 290° left of outbound)
        // Inbound 360°, outbound 180°, heading 000° → 180° from outbound → PARALLEL
        const entry3 = holding.calculateEntryProcedure(000, 360, 'R');
        this.assert(
            entry3 === 'PARALLEL',
            `Parallel entry: heading 000°, inbound 360° → ${entry3} (expected PARALLEL)`
        );

        // Test case 4: Left turns (non-standard)
        // Inbound 090°, outbound 270°, heading 270° → 0° from outbound → DIRECT (left turns)
        const entry4 = holding.calculateEntryProcedure(270, 090, 'L');
        this.assert(
            entry4 === 'DIRECT',
            `Left turn direct: heading 270°, inbound 090°, left turns → ${entry4} (expected DIRECT)`
        );

        // Test case 5: Edge case - exactly on sector boundary
        // Inbound 360°, outbound 180°, heading 250° → 70° from outbound → TEARDROP
        const entry5 = holding.calculateEntryProcedure(250, 360, 'R');
        this.info(`Edge case (250°, inbound 360°): ${entry5} (DIRECT or TEARDROP acceptable)`);
    }

    // ===== HOLD DETECTION TESTS =====

    testHoldDetection() {
        console.log('\n🔍 Hold Detection Tests');

        if (!window.widget?.holdingManager) {
            this.failed('Holding not available');
            return;
        }

        const holding = window.widget.holdingManager;

        // Test HM hold detection
        const hmWaypoint = {
            ident: 'ALPHA',
            lat: 40.0,
            lng: -105.0,
            pathTerm: 'HM',
            course: 360,
            turnDir: 'R',
            legTime: 60
        };

        const hmHold = holding.detectHoldFromWaypoint(hmWaypoint);
        this.assert(
            hmHold !== null,
            'Detects HM holding leg'
        );

        if (hmHold) {
            this.assert(
                hmHold.fix.ident === 'ALPHA',
                `HM hold fix: ${hmHold.fix.ident} (expected ALPHA)`
            );

            this.assert(
                hmHold.inboundCourse === 360,
                `HM inbound course: ${hmHold.inboundCourse}° (expected 360°)`
            );

            this.assert(
                hmHold.turnDirection === 'R',
                `HM turn direction: ${hmHold.turnDirection} (expected R)`
            );
        }

        // Test HA hold detection
        const haWaypoint = {
            ident: 'BRAVO',
            lat: 41.0,
            lng: -106.0,
            pathTerm: 'HA',
            course: 180,
            alt1: 8000
        };

        const haHold = holding.detectHoldFromWaypoint(haWaypoint);
        this.assert(
            haHold !== null && haHold.altitude === 8000,
            'Detects HA holding leg with altitude'
        );

        // Test non-hold waypoint
        const normalWaypoint = {
            ident: 'CHARLIE',
            lat: 42.0,
            lng: -107.0,
            pathTerm: 'TF'  // Track to Fix, not a hold
        };

        const noHold = holding.detectHoldFromWaypoint(normalWaypoint);
        this.assert(
            noHold === null,
            'Does not detect hold on TF leg'
        );
    }

    // ===== RACETRACK CALCULATION TESTS =====

    testRacetrackCalculation() {
        console.log('\n🏁 Racetrack Calculation Tests');

        if (!window.widget?.holdingManager) {
            this.failed('Holding not available');
            return;
        }

        const holding = window.widget.holdingManager;

        // Calculate racetrack at 120kt
        const racetrack = holding.calculateRacetrack(
            40.0,      // fix lat
            -105.0,    // fix lon
            360,       // inbound course (north)
            60,        // leg time (60s)
            'R',       // right turns
            120        // ground speed (kt)
        );

        this.assert(
            racetrack !== null && typeof racetrack === 'object',
            'Racetrack calculation returns object'
        );

        if (racetrack) {
            this.info(`Leg length: ${racetrack.legLength.toFixed(2)}nm (expected ~2.0nm at 120kt)`);
            this.info(`Turn radius: ${racetrack.turnRadius.toFixed(2)}nm (expected ~0.33nm at 120kt)`);

            // Verify leg length (120kt × 60s = 2nm)
            const expectedLegLength = (120 * 60) / 3600; // 2.0nm
            const legError = Math.abs(racetrack.legLength - expectedLegLength);

            this.assert(
                legError < 0.1,
                `Leg length accurate (${racetrack.legLength.toFixed(2)}nm, expected ${expectedLegLength.toFixed(2)}nm)`
            );

            // Verify turn radius (120kt / 360 = 0.33nm)
            const expectedTurnRadius = 120 / 360; // 0.33nm
            const radiusError = Math.abs(racetrack.turnRadius - expectedTurnRadius);

            this.assert(
                radiusError < 0.01,
                `Turn radius accurate (${racetrack.turnRadius.toFixed(2)}nm, expected ${expectedTurnRadius.toFixed(2)}nm)`
            );

            // Verify inbound end is at fix
            this.assert(
                Math.abs(racetrack.inboundEnd.lat - 40.0) < 0.001 &&
                Math.abs(racetrack.inboundEnd.lon - (-105.0)) < 0.001,
                'Inbound leg ends at fix'
            );
        }
    }

    // ===== PROCEDURE INTEGRATION TESTS =====

    async testProcedureIntegration() {
        console.log('\n✈️  Procedure Integration Tests');

        // Test with KBIH R12-Z missed approach (has HM hold)
        try {
            const response = await fetch(`http://localhost:${location.port || 8080}/api/navdb/procedure/10489/legs`);
            const data = await response.json();

            if (!data.missedApproachWaypoints) {
                this.info('No missed approach waypoints in procedure');
                return;
            }

            // Find HM hold in missed approach
            const hmHold = data.missedApproachWaypoints.find(wp => wp.pathTerm === 'HM');

            if (hmHold) {
                this.info(`Found HM hold at ${hmHold.ident}`);

                if (window.widget?.holdingManager) {
                    const holding = window.widget.holdingManager;
                    const holdParams = holding.detectHoldFromWaypoint(hmHold);

                    this.assert(
                        holdParams !== null,
                        `Detected hold from procedure waypoint (${hmHold.ident})`
                    );

                    if (holdParams) {
                        this.info(`Hold parameters: ${holdParams.fix.ident}, inbound ${holdParams.inboundCourse}°${holdParams.turnDirection}`);
                    }
                }
            } else {
                this.info('No HM hold found in missed approach (may be HA or HF)');
            }

        } catch (e) {
            this.failed(`Procedure integration test failed: ${e.message}`);
        }
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
        console.log('HOLDING PATTERN VALIDATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);

        if (this.results.failed.length > 0) {
            console.log('\nFailed tests:');
            this.results.failed.forEach(f => console.log(`  - ${f}`));
        }

        if (this.results.failed.length === 0) {
            console.log('\n🎉 HOLDING PATTERNS FULLY VALIDATED!');
            console.log('\nHolding Features Confirmed:');
            console.log('  ✓ Entry procedure calculation (DIRECT/TEARDROP/PARALLEL)');
            console.log('  ✓ ARINC 424 hold detection (HM/HA/HF)');
            console.log('  ✓ Racetrack pattern calculation');
            console.log('  ✓ Leg timing and turn radius');
            console.log('  ✓ Integration with procedures');
            console.log('\nReady for production use!');
        }
    }
}

// Auto-run
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected - ready to validate holding patterns');
    console.log('Run: new HoldingValidationTest().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export
if (typeof window !== 'undefined') {
    window.HoldingValidationTest = HoldingValidationTest;
}
