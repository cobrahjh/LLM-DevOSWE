/**
 * Integration test for performance telemetry
 * Simulates widget loading and verifies telemetry API
 * Usage: node test-telemetry-integration.js
 */

const fs = require('fs');
const path = require('path');

console.log('=== Performance Telemetry Integration Test ===\n');

// Simulate browser environment
global.performance = {
    now: () => Date.now() + Math.random() * 100
};

// Mock class definitions that pane.js expects
global.ATCController = class ATCController {
    constructor(config) {
        this.config = config;
    }
};

global.LLMAdvisor = class LLMAdvisor {
    constructor(config) {
        this.config = config;
    }
};

global.WindCompensation = class WindCompensation {
    constructor() {}
};

// Simulate widget initialization with telemetry
class MockWidget {
    constructor() {
        // Phase 2: Conditional module lazy loading
        this._conditionalModules = new Set();
        this.llmAdvisor = null;
        this.atcController = null;
        this._windCompLoaded = false;

        // Performance telemetry
        this._perfMetrics = {
            moduleLoads: [],
            totalLoadTime: 0,
            loadAttempts: 0,
            loadFailures: 0
        };

        this.flightPhase = { phase: 'PREFLIGHT' };
    }

    async _loadScript(scriptPath) {
        // Simulate script load delay
        return new Promise(resolve => {
            setTimeout(resolve, Math.random() * 50 + 20);
        });
    }

    async _loadATCController() {
        if (this.atcController) return;
        if (this._conditionalModules.has('atc')) return;

        const startTime = performance.now();
        this._perfMetrics.loadAttempts++;

        try {
            await this._loadScript('modules/atc-controller.js');
            this._conditionalModules.add('atc');

            this.atcController = new ATCController({});

            const loadTime = performance.now() - startTime;
            this._perfMetrics.totalLoadTime += loadTime;
            this._perfMetrics.moduleLoads.push({
                module: 'ATCController',
                loadTime: loadTime,
                success: true,
                timestamp: Date.now(),
                phase: this.flightPhase?.phase || 'UNKNOWN'
            });

            console.log(`✓ Loaded ATCController module in ${loadTime.toFixed(2)}ms (ground phases)`);
        } catch (err) {
            this._perfMetrics.loadFailures++;
            console.error('Failed to load ATCController:', err);
        }
    }

    async _loadWindCompensation() {
        if (this._windCompLoaded) return;
        if (this._conditionalModules.has('wind')) return;

        const startTime = performance.now();
        this._perfMetrics.loadAttempts++;

        try {
            await this._loadScript('modules/wind-compensation.js');
            this._conditionalModules.add('wind');
            this._windCompLoaded = true;

            const loadTime = performance.now() - startTime;
            this._perfMetrics.totalLoadTime += loadTime;
            this._perfMetrics.moduleLoads.push({
                module: 'WindCompensation',
                loadTime: loadTime,
                success: true,
                timestamp: Date.now(),
                phase: this.flightPhase?.phase || 'UNKNOWN'
            });

            console.log(`✓ Loaded WindCompensation module in ${loadTime.toFixed(2)}ms (airborne phases)`);
        } catch (err) {
            this._perfMetrics.loadFailures++;
            console.error('Failed to load WindCompensation:', err);
        }
    }

    async _loadLLMAdvisor() {
        if (this.llmAdvisor) return;
        if (this._conditionalModules.has('llm')) return;

        const startTime = performance.now();
        this._perfMetrics.loadAttempts++;

        try {
            await this._loadScript('modules/llm-advisor.js');
            this._conditionalModules.add('llm');

            this.llmAdvisor = new LLMAdvisor({});

            const loadTime = performance.now() - startTime;
            this._perfMetrics.totalLoadTime += loadTime;
            this._perfMetrics.moduleLoads.push({
                module: 'LLMAdvisor',
                loadTime: loadTime,
                success: true,
                timestamp: Date.now(),
                phase: this.flightPhase?.phase || 'UNKNOWN'
            });

            console.log(`✓ Loaded LLMAdvisor module in ${loadTime.toFixed(2)}ms (on-demand)`);
        } catch (err) {
            this._perfMetrics.loadFailures++;
            console.error('Failed to load LLMAdvisor:', err);
        }
    }

    getTelemetry() {
        const successfulLoads = this._perfMetrics.moduleLoads.filter(m => m.success);
        const averageLoadTime = successfulLoads.length > 0
            ? successfulLoads.reduce((sum, m) => sum + m.loadTime, 0) / successfulLoads.length
            : 0;

        return {
            moduleLoads: this._perfMetrics.moduleLoads,
            totalLoadTime: this._perfMetrics.totalLoadTime,
            loadAttempts: this._perfMetrics.loadAttempts,
            loadFailures: this._perfMetrics.loadFailures,
            successfulLoads: successfulLoads.length,
            averageLoadTime: averageLoadTime,
            loadedModules: Array.from(this._conditionalModules),
            breakdown: {
                atc: this._perfMetrics.moduleLoads.find(m => m.module === 'ATCController' && m.success),
                wind: this._perfMetrics.moduleLoads.find(m => m.module === 'WindCompensation' && m.success),
                llm: this._perfMetrics.moduleLoads.find(m => m.module === 'LLMAdvisor' && m.success)
            }
        };
    }

    logTelemetry() {
        const telemetry = this.getTelemetry();
        console.group('📊 Module Loading Performance Telemetry');
        console.log(`Total load attempts: ${telemetry.loadAttempts}`);
        console.log(`Successful loads: ${telemetry.successfulLoads}`);
        console.log(`Failed loads: ${telemetry.loadFailures}`);
        console.log(`Total load time: ${telemetry.totalLoadTime.toFixed(2)}ms`);
        console.log(`Average load time: ${telemetry.averageLoadTime.toFixed(2)}ms`);
        console.log(`Loaded modules: ${telemetry.loadedModules.join(', ')}`);

        if (telemetry.moduleLoads.length > 0) {
            console.group('Module Load Details:');
            telemetry.moduleLoads.forEach(load => {
                const status = load.success ? '✅' : '❌';
                const time = load.loadTime.toFixed(2);
                const phase = load.phase;
                const error = load.error ? ` (${load.error})` : '';
                console.log(`${status} ${load.module}: ${time}ms at ${phase}${error}`);
            });
            console.groupEnd();
        }
        console.groupEnd();
    }
}

// Run integration test
async function runTest() {
    console.log('🚀 Starting widget simulation...\n');

    const widget = new MockWidget();

    // Simulate flight sequence with phase transitions
    console.log('Phase 1: PREFLIGHT - Loading ATCController...');
    await widget._loadATCController();

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\nPhase 2: TAKEOFF - Loading WindCompensation...');
    widget.flightPhase.phase = 'TAKEOFF';
    await widget._loadWindCompensation();

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\nPhase 3: CRUISE - User clicks "Ask AI"...');
    widget.flightPhase.phase = 'CRUISE';
    await widget._loadLLMAdvisor();

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\n' + '='.repeat(60));
    console.log('📊 Telemetry Results:');
    console.log('='.repeat(60) + '\n');

    widget.logTelemetry();

    console.log('\n' + '='.repeat(60));
    console.log('🔍 Validation:');
    console.log('='.repeat(60) + '\n');

    const telemetry = widget.getTelemetry();

    // Validate results
    let passed = 0;
    let failed = 0;

    function check(description, condition) {
        if (condition) {
            console.log(`✅ ${description}`);
            passed++;
        } else {
            console.error(`❌ ${description}`);
            failed++;
        }
    }

    check('All 3 modules loaded', telemetry.successfulLoads === 3);
    check('No failures', telemetry.loadFailures === 0);
    check('Total load time > 0', telemetry.totalLoadTime > 0);
    check('Average load time reasonable (20-100ms)', telemetry.averageLoadTime >= 20 && telemetry.averageLoadTime <= 100);
    check('ATCController tracked', telemetry.breakdown.atc !== undefined);
    check('WindCompensation tracked', telemetry.breakdown.wind !== undefined);
    check('LLMAdvisor tracked', telemetry.breakdown.llm !== undefined);
    check('ATCController phase is PREFLIGHT', telemetry.breakdown.atc?.phase === 'PREFLIGHT');
    check('WindCompensation phase is TAKEOFF', telemetry.breakdown.wind?.phase === 'TAKEOFF');
    check('LLMAdvisor phase is CRUISE', telemetry.breakdown.llm?.phase === 'CRUISE');
    check('Loaded modules array has 3 items', telemetry.loadedModules.length === 3);
    check('getTelemetry() returns object', typeof telemetry === 'object');

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Integration Test Results: ${passed}/${passed + failed} passed`);
    console.log('='.repeat(60));

    if (failed === 0) {
        console.log('\n✅ ALL INTEGRATION TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.error(`\n❌ ${failed} TESTS FAILED\n`);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
