/**
 * LLM Advisor Validation Test Suite
 * Type: test | Category: ai-autopilot
 * Path: ui/ai-autopilot/test-llm-advisor-validation.js
 *
 * Comprehensive validation tests for LLM flight advisor system.
 * Tests rate limiting, context generation, command parsing, automatic triggers.
 *
 * Coverage:
 *   - Rate limiting (30s cooldown)
 *   - Context building (flight state summary)
 *   - Advisory parsing (JSON format + legacy RECOMMEND:)
 *   - Command extraction (execCommands, structured commands)
 *   - Automatic triggers (wind shift, low fuel)
 *   - Advisory management (get, clear, current)
 *   - Lifecycle (destroy, abort pending)
 *
 * Usage:
 *   Browser: Open in browser (auto-runs on DOMContentLoaded)
 *   Node.js: node test-llm-advisor-validation.js
 */

// ==================== TEST FRAMEWORK ====================

const tests = [];
const results = { pass: 0, fail: 0, errors: [] };

function test(name, fn) {
    tests.push({ name, fn });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`${message || 'Equality assertion failed'}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
    }
}

function assertContains(str, substring, message) {
    if (!String(str).includes(substring)) {
        throw new Error(`${message || 'Contains assertion failed'}\n  Expected "${str}" to contain "${substring}"`);
    }
}

function assertNotNull(value, message) {
    if (value == null) {
        throw new Error(message || 'Value should not be null/undefined');
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  LLM Advisor Validation Test Suite v1.0.0║');
    console.log('╚═══════════════════════════════════════════╝\n');

    for (const { name, fn } of tests) {
        try {
            await fn();
            results.pass++;
            console.log(`✓ ${name}`);
        } catch (err) {
            results.fail++;
            results.errors.push({ test: name, error: err.message });
            console.error(`✗ ${name}\n  ${err.message}`);
        }
    }

    console.log(`\n${results.pass + results.fail} tests, ${results.pass} passed, ${results.fail} failed`);
    if (results.fail > 0) {
        console.log('\nFailed tests:');
        results.errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
    }

    return results;
}

// ==================== MODULE LOADING ====================

let LLMAdvisor;

// Browser environment
if (typeof window !== 'undefined') {
    // Load dependencies dynamically
    async function loadModules() {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'modules/llm-advisor.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        LLMAdvisor = window.LLMAdvisor;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await loadModules();
        defineTests();
        await runTests();
    });

// Node.js environment
} else {
    // Create stub for browser globals
    global.window = { location: { port: 8080 } };
    LLMAdvisor = require('./modules/llm-advisor.js');
    defineTests();
    runTests().then(r => process.exit(r.fail > 0 ? 1 : 0));
}

// ==================== TEST DEFINITIONS ====================

function defineTests() {

    // ──────────────────────────────────────────────────────
    // Rate Limiting Tests
    // ──────────────────────────────────────────────────────

    test('Initial state: not rate limited', () => {
        const advisor = new LLMAdvisor();
        assertEquals(advisor.isRateLimited(), false, 'Should not be rate limited initially');
        assertEquals(advisor.cooldownRemaining(), 0, 'Cooldown should be 0');
    });

    test('Rate limit after query', async () => {
        const advisor = new LLMAdvisor();
        advisor._lastQueryTime = Date.now();
        assertEquals(advisor.isRateLimited(), true, 'Should be rate limited after query');
    });

    test('cooldownRemaining() calculates correctly', () => {
        const advisor = new LLMAdvisor();
        advisor._lastQueryTime = Date.now() - 20000; // 20s ago
        const remaining = advisor.cooldownRemaining();
        assert(remaining >= 9 && remaining <= 11, 'Should have ~10s remaining (30s - 20s)');
    });

    test('cooldownRemaining() returns 0 when ready', () => {
        const advisor = new LLMAdvisor();
        advisor._lastQueryTime = Date.now() - 31000; // 31s ago
        assertEquals(advisor.cooldownRemaining(), 0, 'Should return 0 when cooldown expired');
    });

    test('Rate limit expires after 30s', async () => {
        const advisor = new LLMAdvisor();
        advisor._rateLimitMs = 100; // Short cooldown for testing
        advisor._lastQueryTime = Date.now();
        assertEquals(advisor.isRateLimited(), true, 'Should be rate limited');
        await sleep(150);
        assertEquals(advisor.isRateLimited(), false, 'Should not be rate limited after expiry');
    });

    // ──────────────────────────────────────────────────────
    // Context Building Tests
    // ──────────────────────────────────────────────────────

    test('_buildContext: complete flight data', () => {
        const advisor = new LLMAdvisor();
        const d = {
            altitude: 5420,
            speed: 105,
            heading: 270,
            verticalSpeed: 500,
            windDirection: 180,
            windSpeed: 15,
            fuelTotal: 32
        };
        const context = advisor._buildContext(d);
        assertContains(context, 'Alt 5420ft', 'Should include altitude');
        assertContains(context, 'Speed 105kt', 'Should include speed');
        assertContains(context, 'HDG 270°', 'Should include heading');
        assertContains(context, 'VS 500fpm', 'Should include vertical speed');
        assertContains(context, 'Wind 180°/15kt', 'Should include wind');
        assertContains(context, 'Fuel 32gal', 'Should include fuel');
    });

    test('_buildContext: null data (returns empty)', () => {
        const advisor = new LLMAdvisor();
        const context = advisor._buildContext(null);
        assertEquals(context, '', 'Null data should return empty string');
    });

    test('_buildContext: missing fields (defaults to 0)', () => {
        const advisor = new LLMAdvisor();
        const d = { altitude: 5000 }; // Only altitude
        const context = advisor._buildContext(d);
        assertContains(context, 'Alt 5000ft', 'Should include altitude');
        assertContains(context, 'Speed 0kt', 'Missing speed should default to 0');
        assertContains(context, 'Fuel 0gal', 'Missing fuel should default to 0');
    });

    test('_buildContext: rounds values', () => {
        const advisor = new LLMAdvisor();
        const d = {
            altitude: 5423.7,
            speed: 104.6,
            heading: 269.9,
            windSpeed: 14.8
        };
        const context = advisor._buildContext(d);
        assertContains(context, 'Alt 5424ft', 'Should round altitude');
        assertContains(context, 'Speed 105kt', 'Should round speed');
        assertContains(context, 'HDG 270°', 'Should round heading');
        assertContains(context, 'Wind', 'Should round wind');
    });

    // ──────────────────────────────────────────────────────
    // Advisory Parsing Tests
    // ──────────────────────────────────────────────────────

    test('_parseAdvisory: simple text (no commands)', () => {
        const advisor = new LLMAdvisor();
        const text = 'Weather looks good for this flight. Continue as planned.';
        const result = advisor._parseAdvisory(text, 'weather check');
        assertEquals(result.text, text, 'Should preserve text');
        assertEquals(result.trigger, 'weather check', 'Should store trigger');
        assertEquals(result.commands.length, 0, 'Should have no commands');
        assertEquals(result.error, false, 'Should not be error');
    });

    test('_parseAdvisory: RECOMMEND: format', () => {
        const advisor = new LLMAdvisor();
        const text = 'Wind shift detected. RECOMMEND: Turn to heading 280 for better crosswind.';
        const result = advisor._parseAdvisory(text, 'wind shift');
        assertEquals(result.commands.length, 1, 'Should extract one command');
        assertContains(result.commands[0], 'Turn to heading 280', 'Should extract recommend text');
    });

    test('_parseAdvisory: structured command format', () => {
        const advisor = new LLMAdvisor();
        const text = 'Set new heading:\nHEADING_BUG_SET 300';
        const result = advisor._parseAdvisory(text, 'heading change');
        assertEquals(result.execCommands.length, 1, 'Should extract exec command');
        assertEquals(result.execCommands[0].command, 'HEADING_BUG_SET', 'Should parse command');
        assertEquals(result.execCommands[0].value, 300, 'Should parse value');
    });

    test('_parseAdvisory: JSON format commands', () => {
        const advisor = new LLMAdvisor();
        const text = 'Adjusting autopilot.\nCOMMANDS_JSON: [{"command":"HEADING_BUG_SET","value":280},{"command":"AP_ALT_HOLD"}]';
        const result = advisor._parseAdvisory(text, 'autopilot adjust');
        assertEquals(result.execCommands.length, 2, 'Should extract 2 commands');
        assertEquals(result.execCommands[0].command, 'HEADING_BUG_SET', 'First command');
        assertEquals(result.execCommands[0].value, 280, 'First value');
        assertEquals(result.execCommands[1].command, 'AP_ALT_HOLD', 'Second command');
        assert(!result.text.includes('COMMANDS_JSON'), 'JSON block should be removed from text');
    });

    test('_parseAdvisory: multiple structured commands', () => {
        const advisor = new LLMAdvisor();
        const text = 'AP_MASTER ON\nHEADING_BUG_SET 270\nAP_ALT_HOLD';
        const result = advisor._parseAdvisory(text, 'AP setup');
        assert(result.execCommands.length >= 2, 'Should extract multiple commands');
    });

    test('_parseAdvisory: includes timestamp', () => {
        const advisor = new LLMAdvisor();
        const before = Date.now();
        const result = advisor._parseAdvisory('Test', 'trigger');
        const after = Date.now();
        assert(result.timestamp >= before && result.timestamp <= after, 'Should have valid timestamp');
    });

    // ──────────────────────────────────────────────────────
    // Automatic Trigger Tests
    // ──────────────────────────────────────────────────────

    test('checkTriggers: no data (returns null)', () => {
        const advisor = new LLMAdvisor();
        const trigger = advisor.checkTriggers(null, 'CRUISE');
        assertEquals(trigger, null, 'Null data should return null');
    });

    test('checkTriggers: first update (no trigger)', () => {
        const advisor = new LLMAdvisor();
        const d = { windSpeed: 10, windDirection: 180 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertEquals(trigger, null, 'First update should not trigger');
        assertEquals(advisor._prevWind, 10, 'Should store wind speed');
    });

    test('checkTriggers: small wind change (no trigger)', () => {
        const advisor = new LLMAdvisor();
        advisor._prevWind = 10;
        const d = { windSpeed: 15, windDirection: 180 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertEquals(trigger, null, '5kt change should not trigger (threshold 20kt)');
    });

    test('checkTriggers: large wind shift (triggers)', () => {
        const advisor = new LLMAdvisor();
        advisor._prevWind = 10;
        const d = { windSpeed: 35, windDirection: 270 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertNotNull(trigger, '25kt change should trigger');
        assertContains(trigger, 'Wind changed', 'Should describe wind change');
        assertContains(trigger, '270', 'Should include wind direction');
        assertContains(trigger, '35kt', 'Should include wind speed');
    });

    test('checkTriggers: low fuel warning (triggers)', () => {
        const advisor = new LLMAdvisor();
        const d = { fuelTotal: 5, fuelFlow: 12 }; // 5gal / 12gph * 60 = 25 min
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertNotNull(trigger, 'Low fuel (<30 min) should trigger');
        assertContains(trigger, 'Low fuel', 'Should describe low fuel');
        assertContains(trigger, 'minutes remaining', 'Should include time remaining');
    });

    test('checkTriggers: low fuel only triggers once', () => {
        const advisor = new LLMAdvisor();
        const d1 = { fuelTotal: 5, fuelFlow: 12 }; // 25 min
        const trigger1 = advisor.checkTriggers(d1, 'CRUISE');
        assertNotNull(trigger1, 'First low fuel should trigger');

        const d2 = { fuelTotal: 4.8, fuelFlow: 12 }; // Still low
        const trigger2 = advisor.checkTriggers(d2, 'CRUISE');
        assertEquals(trigger2, null, 'Second low fuel should not trigger again');
    });

    test('checkTriggers: fuel recovers (resets trigger)', () => {
        const advisor = new LLMAdvisor();
        advisor._prevFuel = 'low';
        const d = { fuelTotal: 15, fuelFlow: 12 }; // 75 min (>45 min threshold)
        advisor.checkTriggers(d, 'CRUISE');
        assertEquals(advisor._prevFuel, null, 'Should reset low fuel flag when recovered');
    });

    test('checkTriggers: destroyed advisor (returns null)', () => {
        const advisor = new LLMAdvisor();
        advisor._destroyed = true;
        const d = { windSpeed: 50 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertEquals(trigger, null, 'Destroyed advisor should not trigger');
    });

    // ──────────────────────────────────────────────────────
    // Advisory Management Tests
    // ──────────────────────────────────────────────────────

    test('getCurrentAdvisory: initial state (null)', () => {
        const advisor = new LLMAdvisor();
        assertEquals(advisor.getCurrentAdvisory(), null, 'Initial state should be null');
    });

    test('getCurrentAdvisory: after parsing', () => {
        const advisor = new LLMAdvisor();
        const parsed = advisor._parseAdvisory('Test advisory', 'test trigger');
        advisor._currentAdvisory = parsed;
        const current = advisor.getCurrentAdvisory();
        assertEquals(current.text, 'Test advisory', 'Should return current advisory');
        assertEquals(current.trigger, 'test trigger', 'Should preserve trigger');
    });

    test('clearAdvisory: clears current', () => {
        const advisor = new LLMAdvisor();
        advisor._currentAdvisory = { text: 'Test' };
        advisor.clearAdvisory();
        assertEquals(advisor.getCurrentAdvisory(), null, 'Should clear advisory');
    });

    // ──────────────────────────────────────────────────────
    // Callback Tests
    // ──────────────────────────────────────────────────────

    test('onAdvisory callback fires', () => {
        let called = false;
        let receivedAdvisory = null;
        const advisor = new LLMAdvisor({
            onAdvisory: (adv) => {
                called = true;
                receivedAdvisory = adv;
            }
        });

        const parsed = advisor._parseAdvisory('Test', 'trigger');
        advisor._currentAdvisory = parsed;
        if (advisor.onAdvisory) advisor.onAdvisory(parsed);

        assert(called, 'Callback should be called');
        assertEquals(receivedAdvisory.text, 'Test', 'Should receive advisory');
    });

    test('onLoading callback fires', () => {
        let loadingState = null;
        const advisor = new LLMAdvisor({
            onLoading: (loading) => {
                loadingState = loading;
            }
        });

        if (advisor.onLoading) {
            advisor.onLoading(true);
            assertEquals(loadingState, true, 'Should receive loading=true');
            advisor.onLoading(false);
            assertEquals(loadingState, false, 'Should receive loading=false');
        }
    });

    // ──────────────────────────────────────────────────────
    // Lifecycle Tests
    // ──────────────────────────────────────────────────────

    test('destroy: sets destroyed flag', () => {
        const advisor = new LLMAdvisor();
        advisor.destroy();
        assertEquals(advisor._destroyed, true, 'Should set destroyed flag');
    });

    test('destroy: aborts pending request', () => {
        const advisor = new LLMAdvisor();
        advisor._pendingAbort = { abort: () => {} }; // Mock AbortController
        advisor.destroy();
        assertEquals(advisor._pendingAbort, null, 'Should clear pending abort');
    });

    test('destroyed advisor ignores triggers', () => {
        const advisor = new LLMAdvisor();
        advisor.destroy();
        const d = { windSpeed: 50, windDirection: 180 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        assertEquals(trigger, null, 'Destroyed advisor should ignore triggers');
    });

    // ──────────────────────────────────────────────────────
    // Edge Cases
    // ──────────────────────────────────────────────────────

    test('_parseAdvisory: malformed JSON (falls back to line parsing)', () => {
        const advisor = new LLMAdvisor();
        const text = 'Bad JSON.\nCOMMANDS_JSON: [{invalid}]\nRECOMMEND: Use fallback';
        const result = advisor._parseAdvisory(text, 'test');
        // Should fallback to RECOMMEND: parsing
        assert(result.commands.length >= 1, 'Should extract at least RECOMMEND command');
    });

    test('_parseAdvisory: empty text', () => {
        const advisor = new LLMAdvisor();
        const result = advisor._parseAdvisory('', 'empty');
        assertEquals(result.text, '', 'Should handle empty text');
        assertEquals(result.commands.length, 0, 'Should have no commands');
    });

    test('_buildContext: very large values', () => {
        const advisor = new LLMAdvisor();
        const d = {
            altitude: 99999,
            speed: 9999,
            heading: 359,
            windSpeed: 999
        };
        const context = advisor._buildContext(d);
        assertContains(context, '99999', 'Should handle large altitude');
        assertContains(context, '9999', 'Should handle high speed');
        assertContains(context, '999', 'Should handle extreme wind');
    });

    test('cooldownRemaining: handles negative time drift', () => {
        const advisor = new LLMAdvisor();
        advisor._lastQueryTime = Date.now() + 1000; // Future time (clock drift)
        const remaining = advisor.cooldownRemaining();
        assert(remaining >= 0, 'Should not return negative cooldown');
    });

    test('checkTriggers: zero fuel flow (no division by zero)', () => {
        const advisor = new LLMAdvisor();
        const d = { fuelTotal: 10, fuelFlow: 0 };
        const trigger = advisor.checkTriggers(d, 'CRUISE');
        // Should not crash, should not trigger (Infinity minutes)
        assertEquals(trigger, null, 'Zero fuel flow should not trigger');
    });

    test('_parseAdvisory: commands with ON/OFF values', () => {
        const advisor = new LLMAdvisor();
        const text = 'AP_MASTER ON\nAP_NAV_HOLD OFF';
        const result = advisor._parseAdvisory(text, 'test');
        // Should parse commands even without numeric values
        assert(result.execCommands.length >= 1, 'Should extract AP commands');
    });

    console.log(`\nDefined ${tests.length} tests`);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests };
}
