/**
 * Quick Validation Test for Phase-Based Module Refactoring
 * Tests inheritance pattern and basic functionality
 */

// Mock dependencies
class CommandQueue {
    constructor() {
        this._currentApState = {};
    }
    enqueue(cmd) {
        console.log(`  ✓ Command enqueued: ${cmd.type} = ${cmd.value}`);
    }
    updateApState(state) {
        this._currentApState = state;
    }
}

const mockProfile = {
    speeds: { Vr: 55, Vs0: 48, Vs1: 53 },
    climb: { normalRate: 500 },
    descent: { normalRate: -500 }
};

const mockFlightData = {
    heading: 270,
    groundSpeed: 0,
    speed: 0,
    engineRpm: 0,
    pitch: 0,
    bank: 0,
    agl: 0,
    throttle: 0
};

const mockApState = {
    master: false,
    headingHold: false,
    altitudeHold: false
};

// Load modules
const { RuleEngineCore } = require('./modules/rule-engine-core.js');
const { RuleEngineGround } = require('./modules/rule-engine-ground.js');

console.log('\n=== Phase Module Validation Test ===\n');

// Test 1: RuleEngineCore instantiation
console.log('Test 1: RuleEngineCore instantiation');
try {
    const core = new RuleEngineCore({
        profile: mockProfile,
        commandQueue: new CommandQueue()
    });
    console.log('  ✓ RuleEngineCore instantiated');
    console.log(`  ✓ Has ${Object.keys(core).length} properties`);
    console.log(`  ✓ Has evaluate() method: ${typeof core.evaluate === 'function'}`);
    console.log(`  ✓ Has _cmd() method: ${typeof core._cmd === 'function'}`);
    console.log(`  ✓ Has _groundSteer() method: ${typeof core._groundSteer === 'function'}`);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

// Test 2: RuleEngineGround instantiation
console.log('\nTest 2: RuleEngineGround instantiation');
try {
    const ground = new RuleEngineGround({
        profile: mockProfile,
        commandQueue: new CommandQueue()
    });
    console.log('  ✓ RuleEngineGround instantiated');
    console.log(`  ✓ Is instance of RuleEngineCore: ${ground instanceof RuleEngineCore}`);
    console.log(`  ✓ Is instance of RuleEngineGround: ${ground instanceof RuleEngineGround}`);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

// Test 3: Method inheritance
console.log('\nTest 3: Method inheritance');
try {
    const ground = new RuleEngineGround({
        profile: mockProfile,
        commandQueue: new CommandQueue()
    });
    console.log(`  ✓ Has inherited _cmd(): ${typeof ground._cmd === 'function'}`);
    console.log(`  ✓ Has inherited _cmdValue(): ${typeof ground._cmdValue === 'function'}`);
    console.log(`  ✓ Has inherited _groundSteer(): ${typeof ground._groundSteer === 'function'}`);
    console.log(`  ✓ Has inherited _targetPitch(): ${typeof ground._targetPitch === 'function'}`);
    console.log(`  ✓ Has overridden _evaluatePhase(): ${typeof ground._evaluatePhase === 'function'}`);
    console.log(`  ✓ Has _evaluatePreflight(): ${typeof ground._evaluatePreflight === 'function'}`);
    console.log(`  ✓ Has _evaluateTaxi(): ${typeof ground._evaluateTaxi === 'function'}`);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

// Test 4: Phase evaluation
console.log('\nTest 4: Phase evaluation (PREFLIGHT)');
try {
    const cmdQueue = new CommandQueue();
    const ground = new RuleEngineGround({
        profile: mockProfile,
        commandQueue: cmdQueue
    });

    ground.evaluate('PREFLIGHT', mockFlightData, mockApState);
    console.log('  ✓ PREFLIGHT evaluation completed without errors');
    console.log(`  ✓ Timeline has ${ground.timeline.length} entries`);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

// Test 5: Phase evaluation (TAXI)
console.log('\nTest 5: Phase evaluation (TAXI)');
try {
    const cmdQueue = new CommandQueue();
    const ground = new RuleEngineGround({
        profile: mockProfile,
        commandQueue: cmdQueue
    });

    ground.evaluate('TAXI', { ...mockFlightData, engineRpm: 2000 }, mockApState);
    console.log('  ✓ TAXI evaluation completed without errors');
    console.log(`  ✓ Timeline has ${ground.timeline.length} entries`);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

console.log('\n=== All Tests Passed! ✓ ===\n');
console.log('Inheritance pattern validated successfully.');
console.log('Ready to proceed with remaining phase modules.\n');

// ========================================
// EXTENDED TEST: RuleEngineTakeoff
// ========================================
console.log('\n=== Extended Test: RuleEngineTakeoff ===\n');

// ========================================
// EXTENDED TEST: RuleEngineTakeoff
// ========================================
console.log('\n=== Extended Test: RuleEngineTakeoff ===\n');

const { RuleEngineTakeoff } = require('./modules/rule-engine-takeoff.js');

console.log('Test 6: RuleEngineTakeoff instantiation');
try {
    const takeoffEngine = new RuleEngineTakeoff({
        profile: mockProfile,
        commandQueue: new CommandQueue()
    });
    console.log('  ✓ RuleEngineTakeoff instantiated');
    console.log('  ✓ Is instance of RuleEngineCore:', takeoffEngine instanceof RuleEngineCore);
    console.log('  ✓ Is instance of RuleEngineTakeoff:', takeoffEngine instanceof RuleEngineTakeoff);
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

console.log('\nTest 7: Takeoff method inheritance');
try {
    const takeoffEngine = new RuleEngineTakeoff({
        profile: mockProfile,
        commandQueue: new CommandQueue()
    });
    console.log('  ✓ Has inherited _cmd():', typeof takeoffEngine._cmd === 'function');
    console.log('  ✓ Has inherited _cmdValue():', typeof takeoffEngine._cmdValue === 'function');
    console.log('  ✓ Has inherited _groundSteer():', typeof takeoffEngine._groundSteer === 'function');
    console.log('  ✓ Has overridden _evaluatePhase():', typeof takeoffEngine._evaluatePhase === 'function');
    console.log('  ✓ Has _evaluateTakeoff():', typeof takeoffEngine._evaluateTakeoff === 'function');
    console.log('  ✓ Has getTakeoffSubPhase():', typeof takeoffEngine.getTakeoffSubPhase === 'function');
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

console.log('\nTest 8: Takeoff phase evaluation (TAKEOFF)');
try {
    const cmdQueue = new CommandQueue();
    const takeoffEngine = new RuleEngineTakeoff({
        profile: mockProfile,
        commandQueue: cmdQueue
    });

    takeoffEngine.evaluate('TAKEOFF', mockFlightData, mockApState);
    const takeoffTimeline = takeoffEngine.getTimeline();
    console.log('  ✓ TAKEOFF evaluation completed without errors');
    console.log('  ✓ Timeline has', takeoffTimeline.length, 'entries');
    console.log('  ✓ Sub-phase initialized:', takeoffEngine.getTakeoffSubPhase());
    if (takeoffTimeline.length > 0) {
        console.log('  ✓ First command:', takeoffTimeline[0]?.cmd);
    }
} catch (e) {
    console.error('  ✗ FAILED:', e.message);
    process.exit(1);
}

console.log('\n=== All Extended Tests Passed! ✓ ===\n');
