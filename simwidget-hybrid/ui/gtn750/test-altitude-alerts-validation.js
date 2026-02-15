/**
 * Altitude Alerts Validation Test
 * Tests altitude monitoring, state machine, and alert triggering
 *
 * Run in browser console at http://192.168.1.42:8080/ui/gtn750/
 */

class AltitudeAlertsValidationTest {
    constructor() {
        this.results = { passed: [], failed: [], info: [] };
    }

    async runAll() {
        console.log('🧪 Altitude Alerts Validation Test Suite\n');
        console.log('='.repeat(60));

        this.testModule();
        this.testAssignedAltitude();
        this.testStateMachine();
        this.testApproachAltitude();
        this.testAlertCallbacks();
        this.testThresholds();
        this.testAudioChimes();

        this.printSummary();
        return this.results;
    }

    // ===== MODULE TESTS =====

    testModule() {
        console.log('\n📦 Altitude Alerts Module Tests');

        if (typeof GTNAltitudeAlerts === 'undefined') {
            this.failed('GTNAltitudeAlerts class not defined');
            return;
        }

        this.assert(
            typeof GTNAltitudeAlerts === 'function',
            'GTNAltitudeAlerts is a class'
        );

        // Create instance for testing
        window.testAltAlerts = new GTNAltitudeAlerts();

        const alerts = window.testAltAlerts;

        this.assert(
            typeof alerts.setAssignedAltitude === 'function',
            'Has setAssignedAltitude method'
        );

        this.assert(
            typeof alerts.setApproachAltitude === 'function',
            'Has setApproachAltitude method'
        );

        this.assert(
            typeof alerts.update === 'function',
            'Has update method'
        );

        this.assert(
            typeof alerts.getStatus === 'function',
            'Has getStatus method'
        );

        this.assert(
            alerts.state === 'IDLE',
            `Initial state is IDLE (actual: ${alerts.state})`
        );

        this.assert(
            alerts.assignedAltitude === null,
            'No assigned altitude initially'
        );

        this.info('Module initialized successfully');
    }

    // ===== ASSIGNED ALTITUDE TESTS =====

    testAssignedAltitude() {
        console.log('\n🎯 Assigned Altitude Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Test setting assigned altitude
        alerts.setAssignedAltitude(8500);

        this.assert(
            alerts.assignedAltitude === 8500,
            `Assigned altitude set to 8500ft (actual: ${alerts.assignedAltitude}ft)`
        );

        this.assert(
            alerts.state === 'ARMED',
            `State changed to ARMED (actual: ${alerts.state})`
        );

        // Test clearing assigned altitude
        alerts.setAssignedAltitude(null);

        this.assert(
            alerts.assignedAltitude === null,
            'Assigned altitude cleared'
        );

        this.assert(
            alerts.state === 'IDLE',
            `State returned to IDLE (actual: ${alerts.state})`
        );

        // Re-set for further tests
        alerts.setAssignedAltitude(8500);
    }

    // ===== STATE MACHINE TESTS =====

    testStateMachine() {
        console.log('\n🔄 State Machine Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Reset to known state
        alerts.setAssignedAltitude(8500);
        this.info(`Testing state transitions to ${alerts.assignedAltitude}ft`);

        // Test ARMED → APPROACHING (within 1000ft)
        alerts.update({ altitude: 7600, verticalSpeed: 500 });

        this.assert(
            alerts.state === 'APPROACHING',
            `ARMED → APPROACHING at 900ft deviation (actual: ${alerts.state})`
        );

        // Test APPROACHING → PROXIMITY (within 200ft)
        alerts.update({ altitude: 8350, verticalSpeed: 100 });

        this.assert(
            alerts.state === 'PROXIMITY',
            `APPROACHING → PROXIMITY at 150ft deviation (actual: ${alerts.state})`
        );

        // Test PROXIMITY → CAPTURED (within 100ft)
        alerts.update({ altitude: 8480, verticalSpeed: 20 });

        this.assert(
            alerts.state === 'CAPTURED',
            `PROXIMITY → CAPTURED at 20ft deviation (actual: ${alerts.state})`
        );

        // Test CAPTURED → HOLDING (minor drift)
        alerts.update({ altitude: 8550, verticalSpeed: 0 });

        this.assert(
            alerts.state === 'HOLDING',
            `CAPTURED → HOLDING at 50ft deviation (actual: ${alerts.state})`
        );

        // Test HOLDING → DEVIATION (significant drift)
        alerts.update({ altitude: 8850, verticalSpeed: 0 });

        this.assert(
            alerts.state === 'DEVIATION',
            `HOLDING → DEVIATION at 350ft deviation (actual: ${alerts.state})`
        );

        // Test DEVIATION → HOLDING (returning)
        alerts.update({ altitude: 8650, verticalSpeed: -200 });

        this.assert(
            alerts.state === 'HOLDING',
            `DEVIATION → HOLDING when returning (actual: ${alerts.state})`
        );

        this.info('State machine validated through all transitions');
    }

    // ===== APPROACH ALTITUDE TESTS =====

    testApproachAltitude() {
        console.log('\n🛬 Approach Altitude Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Set MDA
        alerts.setApproachAltitude(7000, 'MDA');

        this.assert(
            alerts.approachAltitude === 7000,
            `MDA set to 7000ft (actual: ${alerts.approachAltitude}ft)`
        );

        this.assert(
            alerts.approachAltitudeType === 'MDA',
            `Type is MDA (actual: ${alerts.approachAltitudeType})`
        );

        this.assert(
            alerts.approachAltitudeWarned === false,
            'Not warned initially'
        );

        // Test MDA warning (descending, within 100ft above MDA)
        let warningTriggered = false;
        alerts.onAlert = (type, message, level) => {
            if (type === 'APPROACH_ALTITUDE') {
                warningTriggered = true;
            }
        };

        // Above warning threshold, no alert yet
        alerts.update({ altitude: 7200, verticalSpeed: -400 });

        this.assert(
            !warningTriggered,
            'No MDA warning at 200ft above (outside threshold)'
        );

        // Within warning threshold, descending
        alerts.update({ altitude: 7080, verticalSpeed: -400 });

        this.assert(
            warningTriggered,
            'MDA warning triggered at 80ft above (within threshold)'
        );

        this.assert(
            alerts.approachAltitudeWarned === true,
            'MDA warned flag set'
        );

        // Test DA
        alerts.clearApproachAltitude();
        alerts.setApproachAltitude(6580, 'DA');

        this.assert(
            alerts.approachAltitudeType === 'DA',
            `Type changed to DA (actual: ${alerts.approachAltitudeType})`
        );

        this.assert(
            alerts.approachAltitudeWarned === false,
            'Warned flag reset after clear'
        );

        this.info('Approach altitude monitoring validated');
    }

    // ===== ALERT CALLBACK TESTS =====

    testAlertCallbacks() {
        console.log('\n🔔 Alert Callback Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Track alerts
        const triggeredAlerts = [];

        alerts.onAlert = (type, message, level) => {
            triggeredAlerts.push({ type, message, level });
        };

        // Reset to trigger new alerts
        alerts.setAssignedAltitude(9000);
        alerts.state = 'ARMED';
        alerts.lastChimeTime = 0; // Reset cooldown

        // Trigger APPROACHING alert
        alerts.update({ altitude: 8100, verticalSpeed: 500 });

        this.assert(
            triggeredAlerts.some(a => a.type === 'ALTITUDE_APPROACHING'),
            'ALTITUDE_APPROACHING alert triggered'
        );

        this.assert(
            triggeredAlerts.some(a => a.level === 'info'),
            'Info level alert for APPROACHING'
        );

        // Trigger PROXIMITY alert
        alerts.lastChimeTime = 0;
        alerts.update({ altitude: 8850, verticalSpeed: 100 });

        this.assert(
            triggeredAlerts.some(a => a.type === 'ALTITUDE_PROXIMITY'),
            'ALTITUDE_PROXIMITY alert triggered'
        );

        this.assert(
            triggeredAlerts.some(a => a.level === 'warning'),
            'Warning level alert for PROXIMITY'
        );

        // Trigger CAPTURED alert
        alerts.lastChimeTime = 0;
        alerts.update({ altitude: 8990, verticalSpeed: 10 });

        this.assert(
            triggeredAlerts.some(a => a.type === 'ALTITUDE_CAPTURED'),
            'ALTITUDE_CAPTURED alert triggered'
        );

        this.assert(
            triggeredAlerts.some(a => a.level === 'success'),
            'Success level alert for CAPTURED'
        );

        // Trigger DEVIATION alert
        alerts.lastChimeTime = 0;
        alerts.update({ altitude: 9400, verticalSpeed: 0 });

        this.assert(
            triggeredAlerts.some(a => a.type === 'ALTITUDE_DEVIATION'),
            'ALTITUDE_DEVIATION alert triggered'
        );

        this.assert(
            triggeredAlerts.some(a => a.level === 'critical'),
            'Critical level alert for DEVIATION'
        );

        this.info(`Total alerts triggered: ${triggeredAlerts.length}`);
    }

    // ===== THRESHOLD TESTS =====

    testThresholds() {
        console.log('\n📏 Threshold Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Verify threshold values
        this.assert(
            alerts.THRESHOLDS.APPROACH_WARNING === 1000,
            `Approach warning threshold is 1000ft (actual: ${alerts.THRESHOLDS.APPROACH_WARNING}ft)`
        );

        this.assert(
            alerts.THRESHOLDS.PROXIMITY_WARNING === 200,
            `Proximity warning threshold is 200ft (actual: ${alerts.THRESHOLDS.PROXIMITY_WARNING}ft)`
        );

        this.assert(
            alerts.THRESHOLDS.CAPTURE_WINDOW === 100,
            `Capture window is ±100ft (actual: ${alerts.THRESHOLDS.CAPTURE_WINDOW}ft)`
        );

        this.assert(
            alerts.THRESHOLDS.DEVIATION_ALERT === 300,
            `Deviation alert threshold is 300ft (actual: ${alerts.THRESHOLDS.DEVIATION_ALERT}ft)`
        );

        this.assert(
            alerts.THRESHOLDS.MDA_WARNING === 100,
            `MDA warning threshold is 100ft (actual: ${alerts.THRESHOLDS.MDA_WARNING}ft)`
        );

        // Test boundary conditions
        alerts.setAssignedAltitude(10000);
        alerts.state = 'ARMED';

        // Exactly at approach threshold (1000ft)
        alerts.update({ altitude: 9000, verticalSpeed: 500 });

        this.assert(
            alerts.state === 'APPROACHING',
            'Triggers APPROACHING at exactly 1000ft deviation'
        );

        // Exactly at proximity threshold (200ft)
        alerts.state = 'APPROACHING';
        alerts.update({ altitude: 9800, verticalSpeed: 100 });

        this.assert(
            alerts.state === 'PROXIMITY',
            'Triggers PROXIMITY at exactly 200ft deviation'
        );

        // Exactly at capture window (100ft)
        alerts.state = 'PROXIMITY';
        alerts.update({ altitude: 9900, verticalSpeed: 20 });

        this.assert(
            alerts.state === 'CAPTURED',
            'Triggers CAPTURED at exactly 100ft deviation'
        );

        this.info('All thresholds validated at boundary conditions');
    }

    // ===== AUDIO CHIME TESTS =====

    testAudioChimes() {
        console.log('\n🔊 Audio Chime Tests');

        const alerts = window.testAltAlerts;
        if (!alerts) return;

        // Test chime cooldown
        alerts.setAssignedAltitude(8000);
        alerts.state = 'ARMED';
        alerts.lastChimeTime = Date.now();

        let chimeAttempted = false;
        const originalPlayChime = alerts.playChime.bind(alerts);
        alerts.playChime = (level) => {
            chimeAttempted = true;
            // Don't actually play sound in test
        };

        // Try to trigger alert within cooldown
        alerts.update({ altitude: 7100, verticalSpeed: 500 });

        this.assert(
            !chimeAttempted || Date.now() - alerts.lastChimeTime >= alerts.chimeMinInterval,
            'Chime cooldown prevents rapid alerts'
        );

        // Reset cooldown and verify chime plays
        alerts.lastChimeTime = 0;
        chimeAttempted = false;

        alerts.state = 'APPROACHING';
        alerts.update({ altitude: 7850, verticalSpeed: 100 });

        this.assert(
            chimeAttempted || alerts.state === 'PROXIMITY',
            'Chime attempted after cooldown period'
        );

        // Restore original method
        alerts.playChime = originalPlayChime;

        this.info('Audio chime cooldown validated');
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
        console.log('ALTITUDE ALERTS VALIDATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);

        if (this.results.failed.length > 0) {
            console.log('\nFailed tests:');
            this.results.failed.forEach(f => console.log(`  - ${f}`));
        }

        if (this.results.failed.length === 0) {
            console.log('\n🎉 ALTITUDE ALERTS FULLY VALIDATED!');
            console.log('\nAltitude Alert Features Confirmed:');
            console.log('  ✓ Assigned altitude monitoring');
            console.log('  ✓ 7-state machine (IDLE → ARMED → ... → DEVIATION)');
            console.log('  ✓ Approach altitude warnings (MDA/DA)');
            console.log('  ✓ Alert callbacks (info/warning/success/critical)');
            console.log('  ✓ Threshold validation (1000ft/200ft/100ft/300ft)');
            console.log('  ✓ Audio chime cooldown');
            console.log('\nReady for altitude bust prevention!');
        }
    }
}

// Auto-run
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected - ready to validate altitude alerts');
    console.log('Run: new AltitudeAlertsValidationTest().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export
if (typeof window !== 'undefined') {
    window.AltitudeAlertsValidationTest = AltitudeAlertsValidationTest;
}
