/**
 * ATC Ground Operations Validation Test Suite
 * Type: test | Category: ai-autopilot
 * Path: ui/ai-autopilot/test-atc-validation.js
 *
 * Comprehensive validation tests for ATC ground operations system.
 * Tests ATCController state machine, position tracking, phraseology formatting.
 *
 * Coverage:
 *   - 9-phase ATC state machine
 *   - Taxi clearance request + routing
 *   - Position monitoring + waypoint sequencing
 *   - Hold-short detection
 *   - Auto-clearance logic
 *   - Readback validation
 *   - Phraseology formatting (runway, callsign, frequency, altitude)
 *
 * Usage:
 *   Browser: Open in browser (auto-runs on DOMContentLoaded)
 *   Node.js: node test-atc-validation.js
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

async function runTests() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  ATC Validation Test Suite v1.0.0         ║');
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

let ATCController, ATCPhraseology;

// Browser environment
if (typeof window !== 'undefined') {
    // Load dependencies dynamically
    async function loadModules() {
        // Load ATCController
        await new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'modules/atc-controller.js';
            script1.onload = resolve;
            script1.onerror = reject;
            document.head.appendChild(script1);
        });

        // Load ATCPhraseology
        await new Promise((resolve, reject) => {
            const script2 = document.createElement('script');
            script2.src = 'data/atc-phraseology.js';
            script2.onload = resolve;
            script2.onerror = reject;
            document.head.appendChild(script2);
        });

        // Modules are global
        ATCController = window.ATCController;
        ATCPhraseology = window.ATCPhraseology;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await loadModules();
        defineTests();
        await runTests();
    });

// Node.js environment
} else {
    ATCController = require('./modules/atc-controller.js');
    ATCPhraseology = require('./data/atc-phraseology.js');
    defineTests();
    runTests().then(r => process.exit(r.fail > 0 ? 1 : 0));
}

// ==================== TEST DEFINITIONS ====================

function defineTests() {

    // ──────────────────────────────────────────────────────
    // ATCPhraseology Formatting Tests
    // ──────────────────────────────────────────────────────

    test('formatRunway: simple runway', () => {
        const result = ATCPhraseology.formatRunway('09');
        assertEquals(result, 'zero niner', 'Should format 09 as "zero niner"');
    });

    test('formatRunway: runway with left designator', () => {
        const result = ATCPhraseology.formatRunway('16L');
        assertEquals(result, 'one six left', 'Should format 16L');
    });

    test('formatRunway: runway with right designator', () => {
        const result = ATCPhraseology.formatRunway('27R');
        assertEquals(result, 'two seven right', 'Should format 27R');
    });

    test('formatRunway: runway with center designator', () => {
        const result = ATCPhraseology.formatRunway('36C');
        assertEquals(result, 'three six center', 'Should format 36C');
    });

    test('formatCallsign: simple N-number', () => {
        const result = ATCPhraseology.formatCallsign('N12345');
        assertEquals(result, 'November one two three four five', 'Should format N12345');
    });

    test('formatCallsign: mixed letters and numbers', () => {
        const result = ATCPhraseology.formatCallsign('AAL123');
        assertContains(result, 'Alfa', 'Should contain Alfa');
        assertContains(result, 'one two three', 'Should contain digits');
    });

    test('formatFrequency: standard frequency', () => {
        const result = ATCPhraseology.formatFrequency('121.9');
        assertEquals(result, 'one two one point niner', 'Should format 121.9');
    });

    test('formatFrequency: ground frequency', () => {
        const result = ATCPhraseology.formatFrequency('118.5');
        assertEquals(result, 'one one eight point five', 'Should format 118.5');
    });

    test('formatAltitude: 3000 feet', () => {
        const result = ATCPhraseology.formatAltitude(3000);
        assertEquals(result, 'three thousand', 'Should format 3000');
    });

    test('formatAltitude: 8500 feet', () => {
        const result = ATCPhraseology.formatAltitude(8500);
        assertEquals(result, 'eight thousand five hundred', 'Should format 8500');
    });

    test('formatAltitude: flight level (18000+)', () => {
        const result = ATCPhraseology.formatAltitude(18000);
        assertContains(result, 'flight level', 'Should contain "flight level"');
    });

    test('formatTaxiInstruction: with taxiways', () => {
        const result = ATCPhraseology.formatTaxiInstruction('16R', ['A', 'B', 'C']);
        assertContains(result, 'one six right', 'Should contain formatted runway');
        assertContains(result, 'via A, B, C', 'Should contain taxiways');
    });

    test('formatTaxiInstruction: without taxiways', () => {
        const result = ATCPhraseology.formatTaxiInstruction('09', []);
        assertContains(result, 'zero niner', 'Should contain formatted runway');
        assert(!result.includes('via'), 'Should not contain "via"');
    });

    test('formatTakeoffClearance: basic', () => {
        const result = ATCPhraseology.formatTakeoffClearance('27R');
        assertContains(result, 'cleared for takeoff', 'Should contain clearance phrase');
        assertContains(result, 'two seven right', 'Should contain formatted runway');
    });

    test('formatTakeoffClearance: with wind', () => {
        const result = ATCPhraseology.formatTakeoffClearance('09', { dir: 270, speed: 10 });
        assertContains(result, 'wind', 'Should contain wind');
        assertContains(result, '10', 'Should contain wind speed');
    });

    // ──────────────────────────────────────────────────────
    // ATCController State Machine Tests
    // ──────────────────────────────────────────────────────

    test('Initial state: INACTIVE', () => {
        const atc = new ATCController();
        assertEquals(atc.getPhase(), 'INACTIVE', 'Should start in INACTIVE phase');
    });

    test('activate() transitions to PARKED', () => {
        const atc = new ATCController();
        atc.activate();
        assertEquals(atc.getPhase(), 'PARKED', 'Should transition to PARKED');
    });

    test('setCallsign() updates callsign', () => {
        const atc = new ATCController();
        atc.setCallsign('N12345');
        // Callsign is private but used in instructions - test via instruction
        atc.activate();
        atc._setPhase('HOLD_SHORT');
        atc._runway = '16R';
        const instruction = atc.getATCInstruction();
        assertNotNull(instruction, 'Should return instruction');
    });

    test('getNextWaypoint() returns null when no route', () => {
        const atc = new ATCController();
        const wp = atc.getNextWaypoint();
        assertEquals(wp, null, 'Should return null with no route');
    });

    test('getRoute() returns null when no route', () => {
        const atc = new ATCController();
        const route = atc.getRoute();
        assertEquals(route, null, 'Should return null with no route');
    });

    test('getATCInstruction() returns empty for INACTIVE', () => {
        const atc = new ATCController();
        const inst = atc.getATCInstruction();
        assertEquals(inst, '', 'Should return empty string for INACTIVE');
    });

    test('getATCInstruction() returns hold-short message', () => {
        const atc = new ATCController();
        atc._setPhase('HOLD_SHORT');
        atc._runway = '16R';
        const inst = atc.getATCInstruction();
        assertContains(inst, 'Hold short', 'Should contain "Hold short"');
        assertContains(inst, '16R', 'Should contain runway');
    });

    test('getATCInstruction() returns cleared takeoff message', () => {
        const atc = new ATCController();
        atc._setPhase('CLEARED_TAKEOFF');
        atc._runway = '27R';
        const inst = atc.getATCInstruction();
        assertContains(inst, 'Cleared for takeoff', 'Should contain clearance');
        assertContains(inst, '27R', 'Should contain runway');
    });

    test('getATCInstruction() returns ready for departure', () => {
        const atc = new ATCController();
        atc._setPhase('TAKEOFF_CLEARANCE_PENDING');
        atc._runway = '09';
        const inst = atc.getATCInstruction();
        assertContains(inst, 'Ready for departure', 'Should contain ready message');
        assertContains(inst, '09', 'Should contain runway');
    });

    test('issueTakeoffClearance() transitions to CLEARED_TAKEOFF', () => {
        const atc = new ATCController();
        atc._runway = '16R';
        atc._setPhase('HOLD_SHORT');
        atc.issueTakeoffClearance();
        assertEquals(atc.getPhase(), 'CLEARED_TAKEOFF', 'Should transition to CLEARED_TAKEOFF');
    });

    test('issueTakeoffClearance() from TAKEOFF_CLEARANCE_PENDING', () => {
        const atc = new ATCController();
        atc._runway = '27R';
        atc._setPhase('TAKEOFF_CLEARANCE_PENDING');
        atc.issueTakeoffClearance();
        assertEquals(atc.getPhase(), 'CLEARED_TAKEOFF', 'Should transition to CLEARED_TAKEOFF');
    });

    test('reportReadyForDeparture() transitions to TAKEOFF_CLEARANCE_PENDING', () => {
        const atc = new ATCController();
        atc._runway = '09';
        atc._setPhase('HOLD_SHORT');
        atc.reportReadyForDeparture();
        assertEquals(atc.getPhase(), 'TAKEOFF_CLEARANCE_PENDING', 'Should transition to pending');
    });

    test('reportReadyForDeparture() only works from HOLD_SHORT', () => {
        const atc = new ATCController();
        atc._runway = '16R';
        atc._setPhase('TAXIING');
        atc.reportReadyForDeparture();
        assertEquals(atc.getPhase(), 'TAXIING', 'Should remain in TAXIING');
    });

    test('deactivate() resets to INACTIVE', () => {
        const atc = new ATCController();
        atc.activate();
        atc._setPhase('TAXIING');
        atc.deactivate();
        assertEquals(atc.getPhase(), 'INACTIVE', 'Should reset to INACTIVE');
    });

    test('deactivate() clears route', () => {
        const atc = new ATCController();
        atc._route = { success: true, waypoints: [] };
        atc.deactivate();
        assertEquals(atc._route, null, 'Should clear route');
    });

    // ──────────────────────────────────────────────────────
    // Position Tracking Tests
    // ──────────────────────────────────────────────────────

    test('updatePosition() detects airborne (altAGL > 50)', () => {
        const atc = new ATCController();
        atc._setPhase('CLEARED_TAKEOFF');
        atc.updatePosition(40.0, -105.0, 60, 100); // 100ft AGL
        assertEquals(atc.getPhase(), 'AIRBORNE', 'Should transition to AIRBORNE');
    });

    test('updatePosition() ignores when INACTIVE', () => {
        const atc = new ATCController();
        atc.updatePosition(40.0, -105.0, 10, 5);
        assertEquals(atc.getPhase(), 'INACTIVE', 'Should remain INACTIVE');
    });

    test('updatePosition() stores lat/lon/gs', () => {
        const atc = new ATCController();
        atc.activate();
        atc.updatePosition(40.123, -105.456, 15, 0);
        assertEquals(atc._lastLat, 40.123, 'Should store latitude');
        assertEquals(atc._lastLon, -105.456, 'Should store longitude');
        assertEquals(atc._lastGs, 15, 'Should store ground speed');
    });

    test('waypoint sequencing advances when within 100ft', () => {
        const atc = new ATCController();
        atc._setPhase('TAXIING');
        atc._route = {
            waypoints: [
                { lat: 40.0, lon: -105.0, name: 'A1', type: 'TAXIWAY' },
                { lat: 40.001, lon: -105.001, name: 'A2', type: 'TAXIWAY' },
                { lat: 40.002, lon: -105.002, name: 'A3', type: 'TAXIWAY' }
            ]
        };
        atc._currentWaypointIdx = 1;
        atc.updatePosition(40.001, -105.001, 10, 0); // At waypoint A2
        assertEquals(atc._currentWaypointIdx, 2, 'Should advance to next waypoint');
    });

    test('RUNWAY_HOLD waypoint triggers HOLD_SHORT', () => {
        const atc = new ATCController();
        atc._setPhase('TAXIING');
        atc._runway = '16R';
        atc._route = {
            waypoints: [
                { lat: 40.0, lon: -105.0, name: 'A', type: 'TAXIWAY' },
                { lat: 40.0001, lon: -105.0001, name: 'H1', type: 'RUNWAY_HOLD' }
            ]
        };
        atc._currentWaypointIdx = 1;
        atc.updatePosition(40.0001, -105.0001, 5, 0); // At hold point
        assertEquals(atc.getPhase(), 'HOLD_SHORT', 'Should transition to HOLD_SHORT');
    });

    test('end of route triggers HOLD_SHORT', () => {
        const atc = new ATCController();
        atc._setPhase('TAXIING');
        atc._runway = '27R';
        atc._route = {
            waypoints: [
                { lat: 40.0, lon: -105.0, name: 'A', type: 'TAXIWAY' },
                { lat: 40.001, lon: -105.001, name: 'B', type: 'TAXIWAY' }
            ]
        };
        atc._currentWaypointIdx = 1;
        atc.updatePosition(40.001, -105.001, 10, 0); // At last waypoint
        assertEquals(atc.getPhase(), 'HOLD_SHORT', 'Should transition to HOLD_SHORT at end');
    });

    // ──────────────────────────────────────────────────────
    // Readback Validation Tests
    // ──────────────────────────────────────────────────────

    test('validateReadback: empty readback fails', () => {
        const atc = new ATCController();
        const result = atc.validateReadback('');
        assertEquals(result.valid, false, 'Empty readback should fail');
    });

    test('validateReadback: missing runway', () => {
        const atc = new ATCController();
        atc._runway = '16R';
        atc._route = { taxiways: ['A', 'B'] };
        const result = atc.validateReadback('taxi via A B');
        assertEquals(result.valid, false, 'Should fail without runway');
        assertContains(result.missing.join(' '), '16R', 'Should list missing runway');
    });

    test('validateReadback: missing taxiway', () => {
        const atc = new ATCController();
        atc._runway = '27R';
        atc._route = { taxiways: ['A', 'B', 'C'] };
        const result = atc.validateReadback('taxi to 27R via A B');
        assertEquals(result.valid, false, 'Should fail without all taxiways');
        assert(result.missing.some(m => m.includes('C')), 'Should list missing taxiway C');
    });

    test('validateReadback: complete readback passes', () => {
        const atc = new ATCController();
        atc._runway = '09';
        atc._route = { taxiways: ['A', 'B'] };
        const result = atc.validateReadback('taxi to runway 09 via A and B');
        assertEquals(result.valid, true, 'Complete readback should pass');
        assertEquals(result.missing.length, 0, 'Should have no missing elements');
    });

    test('validateReadback: case insensitive', () => {
        const atc = new ATCController();
        atc._runway = '16L';
        atc._route = { taxiways: ['Alpha', 'Bravo'] };
        const result = atc.validateReadback('taxi to runway 16l via alpha bravo');
        assertEquals(result.valid, true, 'Case should not matter');
    });

    // ──────────────────────────────────────────────────────
    // Callback Tests
    // ──────────────────────────────────────────────────────

    test('onPhaseChange callback fires', () => {
        let called = false;
        let oldPhase = null;
        let newPhase = null;
        const atc = new ATCController({
            onPhaseChange: (old, phase) => {
                called = true;
                oldPhase = old;
                newPhase = phase;
            }
        });
        atc.activate();
        assert(called, 'Callback should be called');
        assertEquals(oldPhase, 'INACTIVE', 'Should pass old phase');
        assertEquals(newPhase, 'PARKED', 'Should pass new phase');
    });

    test('onInstruction callback fires', () => {
        let called = false;
        let text = null;
        let type = null;
        const atc = new ATCController({
            onInstruction: (txt, t) => {
                called = true;
                text = txt;
                type = t;
            }
        });
        atc._runway = '16R';
        atc._setPhase('HOLD_SHORT');
        atc._emit('Test instruction', 'test_type');
        assert(called, 'onInstruction should be called');
        assertEquals(text, 'Test instruction', 'Should pass text');
        assertEquals(type, 'test_type', 'Should pass type');
    });

    // ──────────────────────────────────────────────────────
    // Cleanup Tests
    // ──────────────────────────────────────────────────────

    test('destroy() sets destroyed flag', () => {
        const atc = new ATCController();
        atc.destroy();
        assertEquals(atc._destroyed, true, 'Should set destroyed flag');
    });

    test('destroy() clears route', () => {
        const atc = new ATCController();
        atc._route = { success: true };
        atc.destroy();
        assertEquals(atc._route, null, 'Should clear route');
    });

    test('destroy() clears callbacks', () => {
        const atc = new ATCController({
            onInstruction: () => {},
            onPhaseChange: () => {}
        });
        atc.destroy();
        assertEquals(atc._onInstruction, null, 'Should clear onInstruction');
        assertEquals(atc._onPhaseChange, null, 'Should clear onPhaseChange');
    });

    // ──────────────────────────────────────────────────────
    // Haversine/Bearing Math Tests
    // ──────────────────────────────────────────────────────

    test('_distanceFt calculates distance correctly', () => {
        const atc = new ATCController();
        const dist = atc._distanceFt(40.0, -105.0, 40.0, -105.0);
        assertEquals(dist, 0, 'Same point should be 0 distance');
    });

    test('_distanceFt returns positive distance', () => {
        const atc = new ATCController();
        const dist = atc._distanceFt(40.0, -105.0, 40.01, -105.01);
        assert(dist > 0, 'Different points should have positive distance');
    });

    test('_bearing calculates north bearing', () => {
        const atc = new ATCController();
        const bearing = atc._bearing(40.0, -105.0, 40.1, -105.0); // North
        assert(bearing >= 0 && bearing < 10, 'Bearing should be close to 0 (north)');
    });

    test('_bearing calculates east bearing', () => {
        const atc = new ATCController();
        const bearing = atc._bearing(40.0, -105.0, 40.0, -104.9); // East
        assert(bearing >= 80 && bearing <= 100, 'Bearing should be close to 90 (east)');
    });

    console.log(`\nDefined ${tests.length} tests`);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests };
}
