/**
 * AI Autopilot - Flight Phases Validation Tests
 *
 * Tests the 8-phase flight state machine:
 * PREFLIGHT → TAXI → TAKEOFF → CLIMB → CRUISE → DESCENT → APPROACH → LANDING
 *
 * Also tests 6 takeoff sub-phases:
 * BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
 *
 * Run in browser console: http://localhost:8080/ui/ai-autopilot/
 * Or run with Node.js: node test-phases-validation.js
 */

// ============================================================================
// Test Framework
// ============================================================================

const tests = [];
const results = { passed: 0, failed: 0, errors: [] };

function test(name, fn) {
    tests.push({ name, fn });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

function assertInRange(value, min, max, message) {
    if (value < min || value > max) {
        throw new Error(`${message || 'Value out of range'}: ${value} not in [${min}, ${max}]`);
    }
}

async function runTests() {
    console.log('\n=== AI Autopilot - Flight Phases Validation Tests ===\n');

    for (const t of tests) {
        try {
            await t.fn();
            results.passed++;
            console.log(`✓ ${t.name}`);
        } catch (err) {
            results.failed++;
            results.errors.push({ test: t.name, error: err.message });
            console.error(`✗ ${t.name}`);
            console.error(`  ${err.message}`);
        }
    }

    console.log(`\nRESULTS: ${results.passed}/${tests.length} passed, ${results.failed} failed`);
    if (results.failed === 0) {
        console.log('✅ ALL TESTS PASSED');
    } else {
        console.error('❌ SOME TESTS FAILED');
        console.error('\nErrors:');
        results.errors.forEach(e => console.error(`  - ${e.test}: ${e.error}`));
    }

    return results;
}

// ============================================================================
// Test Setup
// ============================================================================

let FlightPhase;

// Load module for testing
if (typeof require !== 'undefined') {
    // Node.js environment
    FlightPhase = require('./modules/flight-phase.js');
} else {
    // Browser environment
    if (typeof window.FlightPhase === 'undefined') {
        console.error('FlightPhase not loaded. Load modules/flight-phase.js first.');
    }
    FlightPhase = window.FlightPhase;
}

// ============================================================================
// Phase Transition Tests
// ============================================================================

test('FlightPhase class exists', () => {
    assert(typeof FlightPhase === 'function', 'FlightPhase should be a constructor');
});

test('FlightPhase constructor initializes with defaults', () => {
    const fp = new FlightPhase();
    assertEquals(fp.phase, 'PREFLIGHT', 'Should start in PREFLIGHT');
    assertEquals(fp.phaseIndex, 0, 'Phase index should be 0');
    assertEquals(fp.targetCruiseAlt, 8500, 'Default cruise alt should be 8500');
    assert(Array.isArray(fp.PHASES), 'PHASES should be an array');
    assertEquals(fp.PHASES.length, 8, 'Should have 8 phases');
});

test('FlightPhase constructor accepts options', () => {
    const fp = new FlightPhase({
        targetCruiseAlt: 10500,
        fieldElevation: 5400
    });
    assertEquals(fp.targetCruiseAlt, 10500, 'Should set custom cruise alt');
    assertEquals(fp.fieldElevation, 5400, 'Should set field elevation');
});

test('PREFLIGHT → TAXI transition (engine running)', () => {
    const fp = new FlightPhase();
    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        heading: 0,
        onGround: true,
        engineRunning: true,
        throttle: 0
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'TAXI', 'Should transition to TAXI when engine running');
});

test('PREFLIGHT → TAXI transition (throttle applied)', () => {
    const fp = new FlightPhase();
    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        heading: 0,
        onGround: true,
        engineRunning: false,
        throttle: 15  // Throttle applied before engineRunning updates
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'TAXI', 'Should transition to TAXI when throttle > 10%');
});

test('TAXI → TAKEOFF transition (no ATC)', () => {
    const fp = new FlightPhase();
    fp.phase = 'TAXI';
    fp.phaseIndex = 1;

    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 30,
        groundSpeed: 30,
        verticalSpeed: 0,
        heading: 170,
        onGround: true,
        engineRunning: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'TAKEOFF', 'Should transition to TAKEOFF at GS > 25kt');
});

test('TAXI → PREFLIGHT transition (engine shutdown)', () => {
    const fp = new FlightPhase();
    fp.phase = 'TAXI';
    fp.phaseIndex = 1;

    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 0,
        groundSpeed: 0,
        verticalSpeed: 0,
        heading: 0,
        onGround: true,
        engineRunning: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'PREFLIGHT', 'Should return to PREFLIGHT on engine shutdown');
});

test('TAKEOFF → CLIMB transition', () => {
    const fp = new FlightPhase();
    fp.phase = 'TAKEOFF';
    fp.phaseIndex = 2;

    const flightData = {
        altitude: 6000,
        altitudeAGL: 600,
        speed: 75,
        groundSpeed: 75,
        verticalSpeed: 500,
        heading: 170,
        onGround: false,
        engineRunning: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CLIMB', 'Should transition to CLIMB at AGL > 500ft');
});

test('TAKEOFF → TAXI transition (rejected takeoff)', () => {
    const fp = new FlightPhase();
    fp.phase = 'TAKEOFF';
    fp.phaseIndex = 2;

    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 5,
        groundSpeed: 5,
        verticalSpeed: 0,
        heading: 170,
        onGround: true,
        engineRunning: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'TAXI', 'Should return to TAXI on rejected takeoff (GS < 10)');
});

test('CLIMB → CRUISE transition', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });
    fp.phase = 'CLIMB';
    fp.phaseIndex = 3;

    const flightData = {
        altitude: 8400,  // Within 200ft of target
        altitudeAGL: 3000,
        speed: 90,
        groundSpeed: 100,
        verticalSpeed: 300,
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CRUISE', 'Should transition to CRUISE within 200ft of cruise alt');
});

test('CRUISE → DESCENT transition (TOD reached)', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });
    fp.phase = 'CRUISE';
    fp.phaseIndex = 4;
    fp.destinationDist = 8;  // 8nm from destination
    fp.profile = { descent: { todFactor: 3 } };

    const flightData = {
        altitude: 8500,
        altitudeAGL: 3100,
        speed: 100,
        groundSpeed: 100,
        verticalSpeed: 0,
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    // TOD = (8500 - assume dest at 5400) / 1000 * 3 = 9.3nm
    // Since destDist (8nm) < TOD (9.3nm), should descend
    assertEquals(phase, 'DESCENT', 'Should transition to DESCENT when TOD reached');
});

test('CRUISE → DESCENT transition (manual descent)', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });
    fp.phase = 'CRUISE';
    fp.phaseIndex = 4;
    fp._phaseEntryTime = Date.now() - 35000;  // 35 seconds in cruise

    const flightData = {
        altitude: 7900,  // 600ft below cruise
        altitudeAGL: 2500,
        speed: 100,
        groundSpeed: 100,
        verticalSpeed: -400,  // Descending
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'DESCENT', 'Should transition to DESCENT on sustained descent');
});

test('DESCENT → APPROACH transition (low altitude + APR mode)', () => {
    const fp = new FlightPhase();
    fp.phase = 'DESCENT';
    fp.phaseIndex = 5;

    const flightData = {
        altitude: 7400,
        altitudeAGL: 2000,
        speed: 90,
        groundSpeed: 90,
        verticalSpeed: -500,
        heading: 160,
        onGround: false,
        apAprLock: true  // Approach mode engaged
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'APPROACH', 'Should transition to APPROACH at AGL < 3000 with APR mode');
});

test('DESCENT → APPROACH transition (low altitude fallback)', () => {
    const fp = new FlightPhase();
    fp.phase = 'DESCENT';
    fp.phaseIndex = 5;

    const flightData = {
        altitude: 7000,
        altitudeAGL: 1600,
        speed: 85,
        groundSpeed: 85,
        verticalSpeed: -500,
        heading: 160,
        onGround: false,
        apAprLock: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'APPROACH', 'Should transition to APPROACH at AGL < 2000');
});

test('APPROACH → LANDING transition', () => {
    const fp = new FlightPhase();
    fp.phase = 'APPROACH';
    fp.phaseIndex = 6;

    const flightData = {
        altitude: 5550,
        altitudeAGL: 150,
        speed: 60,
        groundSpeed: 60,
        verticalSpeed: -300,
        heading: 160,
        onGround: false,
        gearDown: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'LANDING', 'Should transition to LANDING at AGL < 200 with gear down');
});

test('APPROACH → CLIMB transition (go-around)', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });
    fp.phase = 'APPROACH';
    fp.phaseIndex = 6;

    const flightData = {
        altitude: 8200,  // Climbing back up
        altitudeAGL: 2800,
        speed: 80,
        groundSpeed: 80,
        verticalSpeed: 600,  // Climbing
        heading: 160,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CLIMB', 'Should transition to CLIMB on go-around (alt gain + VS > 300)');
});

test('LANDING → TAXI transition', () => {
    const fp = new FlightPhase();
    fp.phase = 'LANDING';
    fp.phaseIndex = 7;

    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 20,
        groundSpeed: 20,
        verticalSpeed: 0,
        heading: 160,
        onGround: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'TAXI', 'Should transition to TAXI when on ground and GS < 30');
});

test('LANDING → CLIMB transition (go-around from landing)', () => {
    const fp = new FlightPhase();
    fp.phase = 'LANDING';
    fp.phaseIndex = 7;

    const flightData = {
        altitude: 5900,
        altitudeAGL: 500,
        speed: 70,
        groundSpeed: 70,
        verticalSpeed: 400,
        heading: 160,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CLIMB', 'Should transition to CLIMB on go-around from landing');
});

// ============================================================================
// Catch-Up Logic Tests
// ============================================================================

test('Catch-up: Detect cruise state on page load', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });

    const flightData = {
        altitude: 8500,
        altitudeAGL: 3100,
        speed: 100,
        groundSpeed: 100,
        verticalSpeed: 0,
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CRUISE', 'Should detect cruise state and jump from PREFLIGHT');
});

test('Catch-up: Detect climb state', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });

    const flightData = {
        altitude: 7000,
        altitudeAGL: 1600,
        speed: 85,
        groundSpeed: 85,
        verticalSpeed: 500,  // Climbing
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CLIMB', 'Should detect climb state from VS > 100');
});

test('Catch-up: Detect approach state (low altitude)', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });

    const flightData = {
        altitude: 7000,
        altitudeAGL: 1600,
        speed: 85,
        groundSpeed: 85,
        verticalSpeed: 0,
        heading: 160,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'APPROACH', 'Should detect approach state from low AGL < 2000');
});

test('Catch-up: Default to climb when airborne', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 8500 });

    const flightData = {
        altitude: 6500,
        altitudeAGL: 1100,
        speed: 75,
        groundSpeed: 75,
        verticalSpeed: 50,  // Slight climb
        heading: 270,
        onGround: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CLIMB', 'Should default to CLIMB when airborne');
});

// ============================================================================
// Manual Phase Control Tests
// ============================================================================

test('setManualPhase locks to specific phase', () => {
    const fp = new FlightPhase();

    fp.setManualPhase('CRUISE');
    assertEquals(fp.phase, 'CRUISE', 'Should set phase to CRUISE');
    assertEquals(fp._manualPhase, true, 'Manual phase flag should be true');

    // Try to update with different conditions
    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 0,
        groundSpeed: 0,
        onGround: true
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'CRUISE', 'Should stay in CRUISE despite ground conditions');
});

test('resumeAuto re-enables automatic transitions', () => {
    const fp = new FlightPhase();

    fp.setManualPhase('CRUISE');
    fp.resumeAuto();
    assertEquals(fp._manualPhase, false, 'Manual phase flag should be false');

    // Should now transition normally
    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        speed: 0,
        groundSpeed: 0,
        onGround: true,
        engineRunning: false
    };

    const phase = fp.update(flightData);
    assertEquals(phase, 'PREFLIGHT', 'Should transition to PREFLIGHT normally');
});

test('forcePhase immediately transitions', () => {
    const fp = new FlightPhase();

    fp.forcePhase('TAKEOFF');
    assertEquals(fp.phase, 'TAKEOFF', 'Should force transition to TAKEOFF');
    assertEquals(fp.phaseIndex, 2, 'Phase index should match TAKEOFF');
});

// ============================================================================
// Progress Tracking Tests
// ============================================================================

test('getProgress returns correct percentage', () => {
    const fp = new FlightPhase();

    fp.phase = 'PREFLIGHT';
    fp.phaseIndex = 0;
    assertEquals(fp.getProgress(), 0, 'PREFLIGHT should be 0%');

    fp.phase = 'TAXI';
    fp.phaseIndex = 1;
    assertInRange(fp.getProgress(), 14, 14, 'TAXI should be 14%');

    fp.phase = 'CRUISE';
    fp.phaseIndex = 4;
    assertInRange(fp.getProgress(), 57, 57, 'CRUISE should be 57%');

    fp.phase = 'LANDING';
    fp.phaseIndex = 7;
    assertEquals(fp.getProgress(), 100, 'LANDING should be 100%');
});

// ============================================================================
// Phase Configuration Tests
// ============================================================================

test('setCruiseAlt updates target altitude', () => {
    const fp = new FlightPhase();

    fp.setCruiseAlt(10500);
    assertEquals(fp.targetCruiseAlt, 10500, 'Should update cruise altitude');
});

test('setCruiseAlt clamps to profile limits', () => {
    const fp = new FlightPhase({
        profile: { limits: { ceiling: 12000 } }
    });

    fp.setCruiseAlt(15000);
    assertEquals(fp.targetCruiseAlt, 12000, 'Should clamp to ceiling limit');

    fp.setCruiseAlt(500);
    assertEquals(fp.targetCruiseAlt, 1000, 'Should clamp to minimum 1000ft');
});

test('setDestinationDist updates distance', () => {
    const fp = new FlightPhase();

    fp.setDestinationDist(42.3);
    assertEquals(fp.destinationDist, 42.3, 'Should update destination distance');
});

test('setFieldElevation updates elevation', () => {
    const fp = new FlightPhase();

    fp.setFieldElevation(5400);
    assertEquals(fp.fieldElevation, 5400, 'Should update field elevation');
});

// ============================================================================
// State Serialization Tests
// ============================================================================

test('getState returns complete state', () => {
    const fp = new FlightPhase({ targetCruiseAlt: 10500 });
    fp.phase = 'CRUISE';
    fp.phaseIndex = 4;

    const state = fp.getState();

    assertEquals(state.phase, 'CRUISE', 'State should include phase');
    assertEquals(state.phaseIndex, 4, 'State should include phaseIndex');
    assertEquals(state.progress, 57, 'State should include progress');
    assertEquals(state.targetCruiseAlt, 10500, 'State should include targetCruiseAlt');
    assertEquals(state.manualPhase, false, 'State should include manualPhase flag');
    assert(typeof state.phaseAge === 'number', 'State should include phaseAge');
});

// ============================================================================
// Phase Age Tests
// ============================================================================

test('Phase age increments over time', async () => {
    const fp = new FlightPhase();
    fp.phase = 'CRUISE';
    fp._phaseEntryTime = Date.now();

    const age1 = fp._phaseAge();
    await new Promise(resolve => setTimeout(resolve, 100));
    const age2 = fp._phaseAge();

    assert(age2 > age1, 'Phase age should increase over time');
    assertInRange(age2 - age1, 90, 120, 'Phase age delta should be ~100ms');
});

// ============================================================================
// Phase Callback Tests
// ============================================================================

test('onPhaseChange callback fires on transition', () => {
    let callbackFired = false;
    let oldPhase = null;
    let newPhase = null;

    const fp = new FlightPhase({
        onPhaseChange: (newP, oldP) => {
            callbackFired = true;
            oldPhase = oldP;
            newPhase = newP;
        }
    });

    const flightData = {
        altitude: 5400,
        altitudeAGL: 0,
        onGround: true,
        engineRunning: true
    };

    fp.update(flightData);

    assert(callbackFired, 'Callback should fire on phase change');
    assertEquals(oldPhase, 'PREFLIGHT', 'Callback should receive old phase');
    assertEquals(newPhase, 'TAXI', 'Callback should receive new phase');
});

// ============================================================================
// Run Tests
// ============================================================================

if (typeof window !== 'undefined') {
    // Browser environment - run automatically
    window.addEventListener('DOMContentLoaded', runTests);
} else {
    // Node.js environment - export for external runner
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { runTests, tests, results };
    }
}

// Also allow manual execution
if (typeof window !== 'undefined') {
    window.runPhasesValidationTests = runTests;
}

console.log('✓ test-phases-validation.js loaded');
console.log('Run tests: runPhasesValidationTests()');
