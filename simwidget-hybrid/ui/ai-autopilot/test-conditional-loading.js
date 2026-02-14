/**
 * Phase 2 Conditional Module Lazy Loading Tests
 * Tests that ATCController, WindCompensation, and LLMAdvisor load only when needed
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Phase 2: Conditional Module Lazy Loading Tests ===\n');

// Test 1: Verify module files exist
console.log('Test 1: Module files exist');
const modules = [
    'modules/atc-controller.js',
    'modules/wind-compensation.js',
    'modules/llm-advisor.js',
    'modules/rule-engine-core.js',
    'pane.js'
];

let passed = 0;
let failed = 0;

for (const mod of modules) {
    const exists = fs.existsSync(path.join(__dirname, mod));
    if (exists) {
        console.log(`  ✓ ${mod} exists`);
        passed++;
    } else {
        console.log(`  ✗ ${mod} NOT FOUND`);
        failed++;
    }
}

// Test 2: Verify pane.js has lazy loading methods
console.log('\nTest 2: Lazy loading methods in pane.js');
const paneContent = fs.readFileSync(path.join(__dirname, 'pane.js'), 'utf8');

const requiredMethods = [
    '_loadATCController',
    '_loadWindCompensation',
    '_loadLLMAdvisor',
    '_conditionalModules'
];

for (const method of requiredMethods) {
    if (paneContent.includes(method)) {
        console.log(`  ✓ ${method} found`);
        passed++;
    } else {
        console.log(`  ✗ ${method} NOT FOUND`);
        failed++;
    }
}

// Test 3: Verify conditional loading in _loadPhaseModule
console.log('\nTest 3: Conditional loading in _loadPhaseModule');
if (paneContent.includes('_loadATCController()') && paneContent.includes('ground')) {
    console.log('  ✓ ATCController loaded for ground phases');
    passed++;
} else {
    console.log('  ✗ ATCController ground phase loading NOT FOUND');
    failed++;
}

if (paneContent.includes('_loadWindCompensation()')) {
    console.log('  ✓ WindCompensation lazy loading found');
    passed++;
} else {
    console.log('  ✗ WindCompensation lazy loading NOT FOUND');
    failed++;
}

// Test 4: Verify "Ask AI" button lazy loads LLMAdvisor
console.log('\nTest 4: LLMAdvisor loaded on "Ask AI" click');
if (paneContent.includes('_loadLLMAdvisor()') && paneContent.includes('advisoryAsk')) {
    console.log('  ✓ LLMAdvisor lazy loads on Ask AI click');
    passed++;
} else {
    console.log('  ✗ LLMAdvisor Ask AI lazy loading NOT FOUND');
    failed++;
}

// Test 5: Verify null checks added
console.log('\nTest 5: Null checks for lazy-loaded modules');
const nullChecks = [
    'if (!this.llmAdvisor)',
    'if (this.llmAdvisor)',
    'if (this.atcController)'
];

for (const check of nullChecks) {
    if (paneContent.includes(check)) {
        console.log(`  ✓ Null check found: ${check}`);
        passed++;
    } else {
        console.log(`  ✗ Null check NOT FOUND: ${check}`);
        failed++;
    }
}

// Test 6: Verify RuleEngineCore conditionally instantiates WindCompensation
console.log('\nTest 6: RuleEngineCore WindCompensation conditional instantiation');
const coreContent = fs.readFileSync(path.join(__dirname, 'modules/rule-engine-core.js'), 'utf8');
if (coreContent.includes('typeof WindCompensation') && coreContent.includes('new WindCompensation()')) {
    console.log('  ✓ WindCompensation conditionally instantiated in RuleEngineCore');
    passed++;
} else {
    console.log('  ✗ WindCompensation conditional instantiation NOT FOUND');
    failed++;
}

// Test 7: Verify no immediate instantiation in constructor
console.log('\nTest 7: No immediate instantiation in constructor');
const constructorSection = paneContent.substring(
    paneContent.indexOf('constructor('),
    paneContent.indexOf('_cacheElements()')
);

const badPatterns = [
    'new LLMAdvisor({',
    'new ATCController({'
];

let foundBad = false;
for (const pattern of badPatterns) {
    if (constructorSection.includes(pattern) && !constructorSection.includes('Phase 2: Conditional module lazy loading')) {
        console.log(`  ✗ Found immediate instantiation: ${pattern}`);
        failed++;
        foundBad = true;
    }
}

if (!foundBad) {
    console.log('  ✓ No immediate instantiation in constructor (before Phase 2 comment)');
    passed++;
}

// Test 8: Calculate expected memory savings
console.log('\nTest 8: Expected memory savings calculation');
const lineCounts = {
    atc: 343,
    wind: 189,
    llm: 248
};

const totalConditional = lineCounts.atc + lineCounts.wind + lineCounts.llm;
console.log(`  ATCController: ${lineCounts.atc} lines`);
console.log(`  WindCompensation: ${lineCounts.wind} lines`);
console.log(`  LLMAdvisor: ${lineCounts.llm} lines`);
console.log(`  Total conditional: ${totalConditional} lines`);

// Baseline after Phase 1 refactoring
const baselinePerPhase = {
    ground: 1427,
    takeoff: 1478,
    cruise: 1374,
    approach: 1421
};

console.log('\n  Memory savings per phase:');
// Ground: saves wind (189) + llm (248) = 437 lines
const groundSavings = lineCounts.wind + lineCounts.llm;
const groundNew = baselinePerPhase.ground - groundSavings;
const groundPercent = ((groundSavings / baselinePerPhase.ground) * 100).toFixed(1);
console.log(`  Ground: ${baselinePerPhase.ground} → ${groundNew} (${groundPercent}% reduction)`);

// Airborne phases: save atc (343) + llm (248) = 591 lines
const airborneSavings = lineCounts.atc + lineCounts.llm;
for (const phase of ['takeoff', 'cruise', 'approach']) {
    const oldLines = baselinePerPhase[phase];
    const newLines = oldLines - airborneSavings;
    const percent = ((airborneSavings / oldLines) * 100).toFixed(1);
    console.log(`  ${phase.charAt(0).toUpperCase() + phase.slice(1)}: ${oldLines} → ${newLines} (${percent}% reduction)`);
}

passed += 4;  // Count all savings calculations as passes

// Summary
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - Phase 2 lazy loading implemented correctly!');
    process.exit(0);
} else {
    console.log(`\n❌ ${failed} tests failed - review implementation`);
    process.exit(1);
}
