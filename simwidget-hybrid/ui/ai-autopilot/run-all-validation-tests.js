/**
 * Run All Validation Tests
 * Executes all 5 validation test suites and reports results
 */

const { execSync } = require('child_process');
const path = require('path');

const tests = [
    'test-phases-validation.js',
    'test-atc-validation.js',
    'test-weather-validation.js',
    'test-navigation-validation.js',
    'test-llm-advisor-validation.js'
];

console.log('═══════════════════════════════════════════════════════');
console.log('  AI AUTOPILOT - VALIDATION TEST SUITE');
console.log('═══════════════════════════════════════════════════════\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

tests.forEach(testFile => {
    console.log(`\n▶ Running ${testFile}...`);
    try {
        // Special handling for phases test which exports runTests function
        let output;
        if (testFile === 'test-phases-validation.js') {
            output = execSync(`node -e "const t=require('./test-phases-validation.js'); t.runTests(); console.log(t.results.passed + ' tests, ' + t.results.passed + ' passed, ' + t.results.failed + ' failed');"`, {
                cwd: __dirname,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } else {
            output = execSync(`node ${testFile}`, {
                cwd: __dirname,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
        }

        // Parse test results from output
        const match = output.match(/(\d+) tests?, (\d+) passed, (\d+) failed/);
        if (match) {
            const [, total, passed, failed] = match;
            totalPassed += parseInt(passed);
            totalFailed += parseInt(failed);
            results.push({
                file: testFile,
                passed: parseInt(passed),
                failed: parseInt(failed),
                status: parseInt(failed) === 0 ? '✅' : '❌'
            });
            console.log(`  ${passed}/${total} passed ${parseInt(failed) === 0 ? '✅' : '❌'}`);
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error.message}`);
        results.push({
            file: testFile,
            passed: 0,
            failed: 1,
            status: '❌'
        });
        totalFailed++;
    }
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════\n');

results.forEach(r => {
    console.log(`${r.status} ${r.file.padEnd(40)} ${r.passed} passed`);
});

console.log('\n───────────────────────────────────────────────────────');
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
console.log(`STATUS: ${totalFailed === 0 ? '✅ ALL TESTS PASSING' : '❌ SOME TESTS FAILED'}`);
console.log('═══════════════════════════════════════════════════════\n');

process.exit(totalFailed > 0 ? 1 : 0);
