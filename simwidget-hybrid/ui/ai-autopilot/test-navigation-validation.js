/**
 * Flight Plan Navigation Validation Test Suite
 * Type: test | Category: ai-autopilot
 * Path: ui/ai-autopilot/test-navigation-validation.js
 *
 * Comprehensive validation tests for GPS flight plan navigation system.
 * Tests waypoint tracking, course intercept, GTN750 integration, bearing calculations.
 *
 * Coverage:
 *   - Course intercept logic (proportional, 10-30°)
 *   - Nav heading calculation (FPL priority, CDI fallback)
 *   - Waypoint sequencing (0.5nm threshold)
 *   - Active waypoint management
 *   - Haversine distance calculations
 *   - Bearing calculations (great circle)
 *   - Nav state integration (GTN750 SafeChannel)
 *
 * Usage:
 *   Browser: Open in browser (auto-runs on DOMContentLoaded)
 *   Node.js: node test-navigation-validation.js
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

function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message || 'Close assertion failed'}\n  Expected: ${expected} (±${tolerance})\n  Actual: ${actual}`);
    }
}

function assertNotNull(value, message) {
    if (value == null) {
        throw new Error(message || 'Value should not be null/undefined');
    }
}

async function runTests() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Navigation Validation Test Suite v1.0.0 ║');
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

let RuleEngineCore;

// Browser environment
if (typeof window !== 'undefined') {
    // Load dependencies dynamically
    async function loadModules() {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'modules/rule-engine-core.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        RuleEngineCore = window.RuleEngineCore;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await loadModules();
        defineTests();
        await runTests();
    });

// Node.js environment
} else {
    // Create stubs for browser-only globals
    global.window = { _terrainGrid: null };
    global.WindCompensation = class { reset() {} };
    const ruleEngineModule = require('./modules/rule-engine-core.js');
    RuleEngineCore = ruleEngineModule.RuleEngineCore;
    defineTests();
    runTests().then(r => process.exit(r.fail > 0 ? 1 : 0));
}

// ==================== TEST DEFINITIONS ====================

function defineTests() {

    // ──────────────────────────────────────────────────────
    // Course Intercept Calculation Tests
    // ──────────────────────────────────────────────────────

    test('_computeInterceptHeading: on course (no correction)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, 0.05, 'TO');
        assertClose(heading, 90, 1, 'On course should have no correction');
    });

    test('_computeInterceptHeading: slight right offset (10° correction)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, 0.2, 'TO');
        assertClose(heading, 80, 2, '0.2nm right → 10° left correction');
    });

    test('_computeInterceptHeading: moderate right offset (proportional)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, 0.5, 'TO');
        assert(heading < 90, 'Right of course → turn left');
        assert(heading >= 70 && heading <= 80, 'Correction should be 10-20° for 0.5nm XTRK');
    });

    test('_computeInterceptHeading: large right offset (30° max)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, 1.5, 'TO');
        assertClose(heading, 60, 2, '1.5nm right → 30° left correction (max)');
    });

    test('_computeInterceptHeading: slight left offset (10° correction)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, -0.2, 'TO');
        assertClose(heading, 100, 2, '0.2nm left → 10° right correction');
    });

    test('_computeInterceptHeading: large left offset (30° max)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, -1.5, 'TO');
        assertClose(heading, 120, 2, '1.5nm left → 30° right correction (max)');
    });

    test('_computeInterceptHeading: FROM flag (no intercept)', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(90, 0.5, 'FROM');
        assertEquals(heading, 90, 'FROM flag should return DTK directly');
    });

    test('_computeInterceptHeading: 360° wrap-around', () => {
        const engine = new RuleEngineCore();
        const heading = engine._computeInterceptHeading(10, -0.5, 'TO');
        assert(heading >= 0 && heading < 360, 'Heading should wrap to 0-359°');
    });

    test('_computeInterceptHeading: proportional scaling 0.3nm → 1.0nm', () => {
        const engine = new RuleEngineCore();
        const h1 = engine._computeInterceptHeading(90, 0.3, 'TO');
        const h2 = engine._computeInterceptHeading(90, 0.65, 'TO');
        const h3 = engine._computeInterceptHeading(90, 1.0, 'TO');
        assert(h1 > h2 && h2 > h3, 'Correction should increase proportionally with XTRK');
        assertClose(h1, 80, 2, '0.3nm → 10° correction');
        assertClose(h3, 60, 2, '1.0nm → 30° correction');
    });

    // ──────────────────────────────────────────────────────
    // Nav Heading Calculation Tests
    // ──────────────────────────────────────────────────────

    test('_getNavHeading: no nav state (returns null)', () => {
        const engine = new RuleEngineCore();
        const result = engine._getNavHeading({ latitude: 40.0, longitude: -105.0 });
        assertEquals(result, null, 'No nav state should return null');
    });

    test('_getNavHeading: flight plan priority over CDI', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            name: 'KDEN-KCOS',
            waypoints: [
                { ident: 'KDEN', lat: 39.8617, lon: -104.6731 },
                { ident: 'KCOS', lat: 38.8058, lon: -104.7013 }
            ]
        };
        engine._activeWaypointIndex = 1;
        engine._navState = { cdi: { dtk: 120, source: 'GPS', xtrk: 0 } };

        const result = engine._getNavHeading({ latitude: 39.0, longitude: -104.7 });
        assertEquals(result.source, 'FPL', 'Flight plan should take priority');
        assertNotNull(result.heading, 'Should return heading');
        assert(result.description.includes('KCOS'), 'Description should include waypoint');
    });

    test('_getNavHeading: CDI with valid DTK', () => {
        const engine = new RuleEngineCore();
        engine._navState = {
            cdi: {
                dtk: 90,
                source: 'GPS',
                xtrk: 0.2,
                toFrom: 'TO'
            }
        };

        const result = engine._getNavHeading({});
        assertEquals(result.source, 'GPS', 'Should use GPS CDI');
        assertNotNull(result.heading, 'Should return heading with intercept');
    });

    test('_getNavHeading: active waypoint fallback', () => {
        const engine = new RuleEngineCore();
        engine._navState = {
            activeWaypoint: {
                ident: 'KDEN',
                lat: 39.8617,
                lon: -104.6731,
                distNm: 25.5,
                bearing: 15  // Precomputed bearing
            }
        };

        const result = engine._getNavHeading({ latitude: 39.0, longitude: -104.7 });
        assertEquals(result.source, 'WPT', 'Should use waypoint bearing');
        assertEquals(result.heading, 15, 'Should return waypoint bearing');
        assert(result.description.includes('KDEN'), 'Description should include waypoint');
    });

    // ──────────────────────────────────────────────────────
    // Waypoint Sequencing Tests
    // ──────────────────────────────────────────────────────

    test('sequenceWaypoint: no flight plan (returns false)', () => {
        const engine = new RuleEngineCore();
        const result = engine.sequenceWaypoint({ latitude: 40.0, longitude: -105.0 });
        assertEquals(result, false, 'No flight plan should return false');
    });

    test('sequenceWaypoint: far from waypoint (no sequence)', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 },
                { ident: 'WP2', lat: 38.8058, lon: -104.7013 }
            ]
        };
        engine._activeWaypointIndex = 0;

        // 50nm away from WP1
        const result = engine.sequenceWaypoint({ latitude: 40.5, longitude: -104.6 });
        assertEquals(result, false, 'Far from waypoint should not sequence');
        assertEquals(engine._activeWaypointIndex, 0, 'Active index should not change');
    });

    test('sequenceWaypoint: within 0.5nm threshold (sequences)', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 },
                { ident: 'WP2', lat: 39.8617, lon: -104.6 }
            ]
        };
        engine._activeWaypointIndex = 0;

        // Very close to WP1 (within 0.5nm)
        const result = engine.sequenceWaypoint({ latitude: 39.8617, longitude: -104.673 });
        assertEquals(result, true, 'Within 0.5nm should sequence');
        assertEquals(engine._activeWaypointIndex, 1, 'Should advance to next waypoint');
    });

    test('sequenceWaypoint: last waypoint (no sequence)', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 },
                { ident: 'WP2', lat: 39.8617, lon: -104.6 }
            ]
        };
        engine._activeWaypointIndex = 1;

        // At last waypoint
        const result = engine.sequenceWaypoint({ latitude: 39.8617, longitude: -104.6 });
        assertEquals(result, false, 'Last waypoint should not sequence beyond');
        assertEquals(engine._activeWaypointIndex, 2, 'Index should advance but no next waypoint');
    });

    // ──────────────────────────────────────────────────────
    // Active Waypoint Management Tests
    // ──────────────────────────────────────────────────────

    test('getActiveWaypoint: no flight plan', () => {
        const engine = new RuleEngineCore();
        const wp = engine.getActiveWaypoint();
        assertEquals(wp, null, 'No flight plan should return null');
    });

    test('getActiveWaypoint: valid index', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 },
                { ident: 'WP2', lat: 38.8058, lon: -104.7013 }
            ]
        };
        engine._activeWaypointIndex = 1;

        const wp = engine.getActiveWaypoint();
        assertEquals(wp.ident, 'WP2', 'Should return waypoint at active index');
    });

    test('getActiveWaypoint: index out of bounds', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 }
            ]
        };
        engine._activeWaypointIndex = 5;

        const wp = engine.getActiveWaypoint();
        assertEquals(wp, null, 'Out of bounds index should return null');
    });

    test('hasFlightPlan: no plan', () => {
        const engine = new RuleEngineCore();
        assertEquals(engine.hasFlightPlan(), false, 'No plan should return false');
    });

    test('hasFlightPlan: empty plan', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = { waypoints: [] };
        assertEquals(engine.hasFlightPlan(), false, 'Empty plan should return false');
    });

    test('hasFlightPlan: valid plan', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 }
            ]
        };
        assertEquals(engine.hasFlightPlan(), true, 'Valid plan should return true');
    });

    test('setActiveWaypointIndex: valid index', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 },
                { ident: 'WP2', lat: 38.8058, lon: -104.7013 },
                { ident: 'WP3', lat: 38.0, lon: -104.0 }
            ]
        };

        engine.setActiveWaypointIndex(2);
        assertEquals(engine._activeWaypointIndex, 2, 'Should set active index');
        assertEquals(engine.getActiveWaypoint().ident, 'WP3', 'Should activate WP3');
    });

    test('setActiveWaypointIndex: out of bounds (no change)', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 }
            ]
        };
        engine._activeWaypointIndex = 0;

        engine.setActiveWaypointIndex(5);
        assertEquals(engine._activeWaypointIndex, 0, 'Out of bounds should not change index');
    });

    test('setActiveWaypointIndex: negative index (no change)', () => {
        const engine = new RuleEngineCore();
        engine._flightPlan = {
            waypoints: [
                { ident: 'WP1', lat: 39.8617, lon: -104.6731 }
            ]
        };
        engine._activeWaypointIndex = 0;

        engine.setActiveWaypointIndex(-1);
        assertEquals(engine._activeWaypointIndex, 0, 'Negative index should not change');
    });

    // ──────────────────────────────────────────────────────
    // Haversine Distance Tests
    // ──────────────────────────────────────────────────────

    test('_haversineDistance: same point (0 distance)', () => {
        const engine = new RuleEngineCore();
        const dist = engine._haversineDistance(40.0, -105.0, 40.0, -105.0);
        assertClose(dist, 0, 0.01, 'Same point should be 0nm');
    });

    test('_haversineDistance: 1 degree latitude (~60nm)', () => {
        const engine = new RuleEngineCore();
        const dist = engine._haversineDistance(40.0, -105.0, 41.0, -105.0);
        assertClose(dist, 60, 3, '1° latitude ≈ 60nm');
    });

    test('_haversineDistance: known distance (KDEN to KCOS ~64nm)', () => {
        const engine = new RuleEngineCore();
        // Denver to Colorado Springs
        const dist = engine._haversineDistance(39.8617, -104.6731, 38.8058, -104.7013);
        assertClose(dist, 64, 5, 'KDEN to KCOS ≈ 64nm');
    });

    test('_haversineDistance: small distance (<1nm)', () => {
        const engine = new RuleEngineCore();
        const dist = engine._haversineDistance(40.0, -105.0, 40.005, -105.005);
        assert(dist < 1, 'Small delta should be < 1nm');
        assert(dist > 0, 'Distance should be positive');
    });

    // ──────────────────────────────────────────────────────
    // Bearing Calculation Tests
    // ──────────────────────────────────────────────────────

    test('_calculateBearing: due north', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 41.0, -105.0);
        assertClose(bearing, 0, 2, 'Due north should be 0°');
    });

    test('_calculateBearing: due east', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 40.0, -104.0);
        assertClose(bearing, 90, 3, 'Due east should be 90°');
    });

    test('_calculateBearing: due south', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 39.0, -105.0);
        assertClose(bearing, 180, 2, 'Due south should be 180°');
    });

    test('_calculateBearing: due west', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 40.0, -106.0);
        assertClose(bearing, 270, 3, 'Due west should be 270°');
    });

    test('_calculateBearing: northeast quadrant', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 41.0, -104.0);
        assert(bearing > 0 && bearing < 90, 'NE should be in 0-90° range');
    });

    test('_calculateBearing: southwest quadrant', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 39.0, -106.0);
        assert(bearing > 180 && bearing < 270, 'SW should be in 180-270° range');
    });

    test('_calculateBearing: 360° wrap (returns 0-359)', () => {
        const engine = new RuleEngineCore();
        const bearing = engine._calculateBearing(40.0, -105.0, 41.0, -105.0);
        assert(bearing >= 0 && bearing < 360, 'Bearing should be in 0-359° range');
    });

    test('_calculateBearing: known route (KDEN to KCOS ~180°)', () => {
        const engine = new RuleEngineCore();
        // Denver to Colorado Springs (roughly south)
        const bearing = engine._calculateBearing(39.8617, -104.6731, 38.8058, -104.7013);
        assertClose(bearing, 181, 5, 'KDEN to KCOS bearing ≈ 181° (south)');
    });

    // ──────────────────────────────────────────────────────
    // Nav State Integration Tests
    // ──────────────────────────────────────────────────────

    test('setNavState: stores nav state', () => {
        const engine = new RuleEngineCore();
        const navState = {
            cdi: { dtk: 90, source: 'GPS', xtrk: 0.2 },
            activeWaypoint: { ident: 'KDEN', distNm: 25 }
        };

        engine.setNavState(navState);
        assertEquals(engine._navState, navState, 'Should store nav state');
    });

    test('setExternalTerrainAlert: stores TAWS alert', () => {
        const engine = new RuleEngineCore();
        engine.setExternalTerrainAlert('WARNING');
        assertEquals(engine._externalTerrainAlert, 'WARNING', 'Should store TAWS alert');
    });

    test('setExternalTerrainAlert: clears alert with null', () => {
        const engine = new RuleEngineCore();
        engine._externalTerrainAlert = 'WARNING';
        engine.setExternalTerrainAlert(null);
        assertEquals(engine._externalTerrainAlert, null, 'Should clear alert');
    });

    console.log(`\nDefined ${tests.length} tests`);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests };
}
