/**
 * Browser Console Test - Phase-Based Lazy Loading Verification
 *
 * Run this in browser console when AI Autopilot pane is loaded:
 * 1. Open http://192.168.1.42:8080/ui/ai-autopilot/ (or localhost:8080)
 * 2. Open DevTools Console (F12)
 * 3. Copy and paste this entire script
 *
 * Expected Results:
 * - ✓ RuleEngineCore class is loaded
 * - ✓ Phase engines object exists with null values (not loaded yet)
 * - ✓ Loaded modules set is empty (no phase modules loaded on page load)
 * - ✓ Widget pane instance exists
 * - ✓ Current phase is PREFLIGHT or TAXI
 *
 * After Phase Change (e.g., PREFLIGHT → TAXI):
 * - ✓ Console shows: "✓ Loaded ground module for TAXI phase"
 * - ✓ _loadedPhaseModules contains 'ground'
 * - ✓ _phaseEngines.ground is RuleEngineGround instance
 */

console.log('=== AI Autopilot Lazy Loading Verification ===\n');

// 1. Check RuleEngineCore is loaded
const coreLoaded = typeof RuleEngineCore !== 'undefined';
console.log(`${coreLoaded ? '✓' : '✗'} RuleEngineCore class loaded:`, coreLoaded);

// 2. Check widget instance exists
const widgetExists = typeof window.widget !== 'undefined' && window.widget !== null;
console.log(`${widgetExists ? '✓' : '✗'} Widget instance exists:`, widgetExists);

if (widgetExists) {
    // 3. Check phase engines structure
    const hasPhaseEngines = window.widget._phaseEngines !== undefined;
    console.log(`${hasPhaseEngines ? '✓' : '✗'} Phase engines object exists:`, hasPhaseEngines);

    if (hasPhaseEngines) {
        console.log('  - Phase engines:', {
            ground: window.widget._phaseEngines.ground ? 'Loaded (RuleEngineGround)' : 'Not loaded (null)',
            takeoff: window.widget._phaseEngines.takeoff ? 'Loaded (RuleEngineTakeoff)' : 'Not loaded (null)',
            cruise: window.widget._phaseEngines.cruise ? 'Loaded (RuleEngineCruise)' : 'Not loaded (null)',
            approach: window.widget._phaseEngines.approach ? 'Loaded (RuleEngineApproach)' : 'Not loaded (null)'
        });
    }

    // 4. Check loaded modules tracker
    const hasLoadedModules = window.widget._loadedPhaseModules !== undefined;
    console.log(`${hasLoadedModules ? '✓' : '✗'} Loaded modules set exists:`, hasLoadedModules);

    if (hasLoadedModules) {
        const loadedModules = Array.from(window.widget._loadedPhaseModules);
        console.log(`  - Modules loaded: ${loadedModules.length > 0 ? loadedModules.join(', ') : 'none (expected on initial load)'}` );
    }

    // 5. Check current phase
    const currentPhase = window.widget.flightPhase?.currentPhase;
    console.log(`\nCurrent flight phase: ${currentPhase || 'Unknown'}`);

    // 6. Check current rule engine
    const currentEngine = window.widget.ruleEngine;
    if (currentEngine) {
        const engineType = currentEngine.constructor.name;
        console.log(`Current rule engine: ${engineType}`);
        console.log(`  - Has evaluate method: ${typeof currentEngine.evaluate === 'function'}`);
        console.log(`  - Has _evaluatePhase method: ${typeof currentEngine._evaluatePhase === 'function'}`);
    } else {
        console.log('Current rule engine: null (not initialized yet)');
    }

    // 7. Memory optimization summary
    console.log('\n=== Memory Optimization Summary ===');
    console.log('Architecture: Phase-based lazy loading');
    console.log('Base module: RuleEngineCore (1,223 lines)');
    console.log('Phase modules: Ground (204), Takeoff (255), Cruise (151), Approach (198)');
    console.log('Expected savings: 30-33% per phase');
    console.log('\nPhase-to-Module Mapping:');
    console.log('  PREFLIGHT, TAXI → ground');
    console.log('  TAKEOFF, DEPARTURE → takeoff');
    console.log('  CLIMB, CRUISE → cruise');
    console.log('  DESCENT, APPROACH, LANDING → approach');

    // 8. Instructions for phase transition testing
    console.log('\n=== Test Phase Transitions ===');
    console.log('1. Enable AI Autopilot (click AI CONTROLS → ON)');
    console.log('2. Watch console for lazy loading messages:');
    console.log('   "✓ Loaded {module} module for {phase} phase"');
    console.log('3. Verify phase modules load only when needed');
    console.log('4. Check _loadedPhaseModules set grows as phases change');

} else {
    console.error('✗ Widget instance not found - page may not be fully loaded');
    console.log('Wait for page load and try again, or check for JavaScript errors');
}

console.log('\n=== Verification Complete ===\n');
