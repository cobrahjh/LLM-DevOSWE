/**
 * Test performance telemetry functionality
 * Usage: node test-telemetry.js
 */

const fs = require('fs');
const path = require('path');

console.log('=== Performance Telemetry Tests ===\n');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`✓ ${description}`);
        passCount++;
    } catch (err) {
        console.error(`✗ ${description}`);
        console.error(`  Error: ${err.message}`);
        failCount++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Read pane.js
const paneJs = fs.readFileSync(path.join(__dirname, 'pane.js'), 'utf8');

// Test 1: Telemetry object initialization
test('Telemetry object initialized in constructor', () => {
    assert(paneJs.includes('this._perfMetrics = {'), 'Should have _perfMetrics object');
    assert(paneJs.includes('moduleLoads: []'), 'Should track moduleLoads array');
    assert(paneJs.includes('totalLoadTime: 0'), 'Should track totalLoadTime');
    assert(paneJs.includes('loadAttempts: 0'), 'Should track loadAttempts');
    assert(paneJs.includes('loadFailures: 0'), 'Should track loadFailures');
});

// Test 2: Performance timing in _loadATCController
test('ATCController has performance timing', () => {
    const methodMatch = paneJs.match(/async _loadATCController\(\) \{[\s\S]*?^\s{4}\}/m);
    assert(methodMatch, 'Should find _loadATCController method');
    const method = methodMatch[0];
    assert(method.includes('const startTime = performance.now()'), 'Should capture start time');
    assert(method.includes('this._perfMetrics.loadAttempts++'), 'Should increment load attempts');
    assert(method.includes('const loadTime = performance.now() - startTime'), 'Should calculate load time');
    assert(method.includes('this._perfMetrics.totalLoadTime += loadTime'), 'Should accumulate total time');
    assert(method.includes('this._perfMetrics.moduleLoads.push({'), 'Should log module load');
    assert(method.includes('module: \'ATCController\''), 'Should record module name');
    assert(method.includes('loadTime: loadTime'), 'Should record load time');
    assert(method.includes('success: true'), 'Should record success status');
    assert(method.includes('this._perfMetrics.loadFailures++'), 'Should track failures');
});

// Test 3: Performance timing in _loadWindCompensation
test('WindCompensation has performance timing', () => {
    const methodMatch = paneJs.match(/async _loadWindCompensation\(\) \{[\s\S]*?^\s{4}\}/m);
    assert(methodMatch, 'Should find _loadWindCompensation method');
    const method = methodMatch[0];
    assert(method.includes('const startTime = performance.now()'), 'Should capture start time');
    assert(method.includes('this._perfMetrics.loadAttempts++'), 'Should increment load attempts');
    assert(method.includes('const loadTime = performance.now() - startTime'), 'Should calculate load time');
    assert(method.includes('this._perfMetrics.moduleLoads.push({'), 'Should log module load');
    assert(method.includes('module: \'WindCompensation\''), 'Should record module name');
});

// Test 4: Performance timing in _loadLLMAdvisor
test('LLMAdvisor has performance timing', () => {
    const methodMatch = paneJs.match(/async _loadLLMAdvisor\(\) \{[\s\S]*?^\s{4}\}/m);
    assert(methodMatch, 'Should find _loadLLMAdvisor method');
    const method = methodMatch[0];
    assert(method.includes('const startTime = performance.now()'), 'Should capture start time');
    assert(method.includes('this._perfMetrics.loadAttempts++'), 'Should increment load attempts');
    assert(method.includes('const loadTime = performance.now() - startTime'), 'Should calculate load time');
    assert(method.includes('this._perfMetrics.moduleLoads.push({'), 'Should log module load');
    assert(method.includes('module: \'LLMAdvisor\''), 'Should record module name');
});

// Test 5: getTelemetry method exists
test('getTelemetry method implemented', () => {
    assert(paneJs.includes('getTelemetry()'), 'Should have getTelemetry method');
    const methodMatch = paneJs.match(/getTelemetry\(\) \{[\s\S]*?^\s{4}\}/m);
    assert(methodMatch, 'Should find getTelemetry method body');
    const method = methodMatch[0];
    assert(method.includes('moduleLoads:'), 'Should return moduleLoads');
    assert(method.includes('totalLoadTime:'), 'Should return totalLoadTime');
    assert(method.includes('loadAttempts:'), 'Should return loadAttempts');
    assert(method.includes('loadFailures:'), 'Should return loadFailures');
    assert(method.includes('successfulLoads:'), 'Should return successfulLoads count');
    assert(method.includes('averageLoadTime:'), 'Should calculate average load time');
    assert(method.includes('loadedModules:'), 'Should return loaded modules array');
    assert(method.includes('breakdown:'), 'Should provide breakdown by module');
});

// Test 6: logTelemetry method exists
test('logTelemetry method implemented', () => {
    assert(paneJs.includes('logTelemetry()'), 'Should have logTelemetry method');
    const methodMatch = paneJs.match(/logTelemetry\(\) \{[\s\S]*?^\s{4}\}/m);
    assert(methodMatch, 'Should find logTelemetry method body');
    const method = methodMatch[0];
    assert(method.includes('console.group'), 'Should use console.group for formatting');
    assert(method.includes('Total load attempts'), 'Should log total attempts');
    assert(method.includes('Successful loads'), 'Should log successful loads');
    assert(method.includes('Failed loads'), 'Should log failures');
    assert(method.includes('Total load time'), 'Should log total time');
    assert(method.includes('Average load time'), 'Should log average time');
    assert(method.includes('Loaded modules'), 'Should log loaded modules');
    assert(method.includes('Module Load Details'), 'Should log detailed breakdown');
});

// Test 7: Enhanced console messages with timing
test('Console log messages include timing', () => {
    assert(
        paneJs.includes('console.log(`✓ Loaded ATCController module in ${loadTime.toFixed(2)}ms'),
        'ATCController log should include timing'
    );
    assert(
        paneJs.includes('console.log(`✓ Loaded WindCompensation module in ${loadTime.toFixed(2)}ms'),
        'WindCompensation log should include timing'
    );
    assert(
        paneJs.includes('console.log(`✓ Loaded LLMAdvisor module in ${loadTime.toFixed(2)}ms'),
        'LLMAdvisor log should include timing'
    );
});

// Test 8: Success/failure tracking
test('Success and failure tracking implemented', () => {
    const atcMethod = paneJs.match(/async _loadATCController\(\) \{[\s\S]*?^\s{4}\}/m)[0];
    assert(atcMethod.includes('success: true'), 'Should track successful loads');
    assert(atcMethod.includes('success: false'), 'Should track failed loads in catch block');
    assert(atcMethod.includes('error: err.message'), 'Should capture error messages');
});

// Test 9: Timestamp tracking
test('Timestamp tracking for all loads', () => {
    const loadPattern = /moduleLoads\.push\(\{[\s\S]*?timestamp: Date\.now\(\)/g;
    const matches = paneJs.match(loadPattern);
    assert(matches && matches.length >= 6, 'Should have timestamps in all 6 moduleLoads.push calls (3 success + 3 failure)');
});

// Test 10: Phase tracking
test('Flight phase tracking in telemetry', () => {
    const phasePattern = /phase: this\.flightPhase\?\.phase \|\| 'UNKNOWN'/g;
    const matches = paneJs.match(phasePattern);
    assert(matches && matches.length >= 6, 'Should track phase in all moduleLoads.push calls');
});

// Results
console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passCount}/${passCount + failCount} passed, ${failCount} failed`);

if (failCount === 0) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
} else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
}
