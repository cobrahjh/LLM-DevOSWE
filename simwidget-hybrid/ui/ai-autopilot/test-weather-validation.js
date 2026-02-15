/**
 * Weather & Wind Compensation Validation Test Suite
 * Type: test | Category: ai-autopilot
 * Path: ui/ai-autopilot/test-weather-validation.js
 *
 * Comprehensive validation tests for weather integration and wind compensation.
 * Tests wind triangle math, crosswind/headwind calculations, turbulence detection.
 *
 * Coverage:
 *   - Wind triangle calculations (heading correction, drift angle)
 *   - Crosswind components (runway operations)
 *   - Headwind/tailwind components
 *   - Turbulence detection (light/moderate/severe)
 *   - Ground speed calculations
 *   - Edge cases (calm wind, high wind, extreme angles)
 *
 * Usage:
 *   Browser: Open in browser (auto-runs on DOMContentLoaded)
 *   Node.js: node test-weather-validation.js
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

async function runTests() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Weather Validation Test Suite v1.0.0    ║');
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

let WindCompensation;

// Browser environment
if (typeof window !== 'undefined') {
    // Load dependencies dynamically
    async function loadModules() {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'modules/wind-compensation.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        WindCompensation = window.WindCompensation;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await loadModules();
        defineTests();
        await runTests();
    });

// Node.js environment
} else {
    // Create stub for Node.js (module uses window global)
    global.window = {};
    WindCompensation = require('./modules/wind-compensation.js');
    WindCompensation = global.window.WindCompensation;
    defineTests();
    runTests().then(r => process.exit(r.fail > 0 ? 1 : 0));
}

// ==================== TEST DEFINITIONS ====================

function defineTests() {

    // ──────────────────────────────────────────────────────
    // Wind Correction Calculation Tests
    // ──────────────────────────────────────────────────────

    test('calculateWindCorrection: calm wind (no correction)', () => {
        const wc = new WindCompensation();
        const result = wc.calculateWindCorrection(90, 100, 0, 0);
        assertEquals(result.heading, 90, 'Heading should match desired track');
        assertEquals(result.correction, 0, 'No correction needed');
        assertEquals(result.crosswind, 0, 'No crosswind');
        assertEquals(result.headwind, 0, 'No headwind');
    });

    test('calculateWindCorrection: direct headwind', () => {
        const wc = new WindCompensation();
        // Track 090°, wind from 090° at 20kt
        const result = wc.calculateWindCorrection(90, 100, 90, 20);
        assertEquals(result.heading, 90, 'Heading should match track (direct headwind)');
        assertEquals(result.correction, 0, 'No lateral correction for direct headwind');
        assertClose(result.crosswind, 0, 0.5, 'No crosswind component');
        assertClose(result.headwind, 20, 1, 'Should have 20kt headwind');
    });

    test('calculateWindCorrection: direct tailwind', () => {
        const wc = new WindCompensation();
        // Track 090°, wind from 270° at 20kt
        const result = wc.calculateWindCorrection(90, 100, 270, 20);
        assertEquals(result.heading, 90, 'Heading should match track (direct tailwind)');
        assertEquals(result.correction, 0, 'No lateral correction for direct tailwind');
        assertClose(result.crosswind, 0, 0.5, 'No crosswind component');
        assertClose(result.headwind, -20, 1, 'Should have 20kt tailwind (negative)');
    });

    test('calculateWindCorrection: right crosswind', () => {
        const wc = new WindCompensation();
        // Track 360° (north), wind from 090° (east) at 20kt
        const result = wc.calculateWindCorrection(360, 100, 90, 20);
        assert(result.heading < 360, 'Should crab left into wind');
        assert(result.correction < 0, 'Correction should be negative (left)');
        assertClose(result.crosswind, 20, 1, 'Should have 20kt right crosswind');
        assertClose(result.headwind, 0, 1, 'No headwind component');
    });

    test('calculateWindCorrection: left crosswind', () => {
        const wc = new WindCompensation();
        // Track 360° (north), wind from 270° (west) at 20kt
        const result = wc.calculateWindCorrection(360, 100, 270, 20);
        assert(result.heading > 0 || result.heading === 0, 'Should crab right into wind');
        assert(result.correction > 0, 'Correction should be positive (right)');
        assertClose(result.crosswind, -20, 1, 'Should have 20kt left crosswind (negative)');
        assertClose(result.headwind, 0, 1, 'No headwind component');
    });

    test('calculateWindCorrection: 45° quartering headwind', () => {
        const wc = new WindCompensation();
        // Track 360°, wind from 045° at 20kt
        const result = wc.calculateWindCorrection(360, 100, 45, 20);
        assert(result.heading < 360, 'Should crab into wind');
        assertClose(result.crosswind, 14.1, 2, 'Crosswind ~14kt (20 * sin(45°))');
        assertClose(result.headwind, 14.1, 2, 'Headwind ~14kt (20 * cos(45°))');
    });

    test('calculateWindCorrection: low airspeed (no correction)', () => {
        const wc = new WindCompensation();
        // Below minimum speed threshold
        const result = wc.calculateWindCorrection(90, 5, 180, 20);
        assertEquals(result.heading, 90, 'No correction below 10kt TAS');
        assertEquals(result.correction, 0, 'Correction should be zero');
    });

    test('calculateWindCorrection: low wind speed (no correction)', () => {
        const wc = new WindCompensation();
        // Below minimum wind threshold
        const result = wc.calculateWindCorrection(90, 100, 180, 0.5);
        assertEquals(result.heading, 90, 'No correction below 1kt wind');
        assertEquals(result.correction, 0, 'Correction should be zero');
    });

    test('calculateWindCorrection: ground speed increases with tailwind', () => {
        const wc = new WindCompensation();
        // 100kt TAS + 20kt tailwind = ~120kt GS
        const result = wc.calculateWindCorrection(90, 100, 270, 20);
        assertClose(result.effectiveGS, 120, 2, 'GS should be TAS + tailwind');
    });

    test('calculateWindCorrection: ground speed decreases with headwind', () => {
        const wc = new WindCompensation();
        // 100kt TAS - 20kt headwind = ~80kt GS
        const result = wc.calculateWindCorrection(90, 100, 90, 20);
        assertClose(result.effectiveGS, 80, 2, 'GS should be TAS - headwind');
    });

    // ──────────────────────────────────────────────────────
    // Crosswind Component Tests
    // ──────────────────────────────────────────────────────

    test('getCrosswindComponent: direct crosswind from right', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 090/20kt
        const xwind = wc.getCrosswindComponent(360, 90, 20);
        assertClose(xwind, 20, 0.1, 'Direct crosswind should be full wind speed');
    });

    test('getCrosswindComponent: direct crosswind from left', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 270/20kt
        const xwind = wc.getCrosswindComponent(360, 270, 20);
        assertClose(xwind, -20, 0.1, 'Left crosswind should be negative');
    });

    test('getCrosswindComponent: no crosswind (direct headwind)', () => {
        const wc = new WindCompensation();
        // Runway 09, wind 090/20kt
        const xwind = wc.getCrosswindComponent(90, 90, 20);
        assertClose(xwind, 0, 0.1, 'Direct headwind has no crosswind');
    });

    test('getCrosswindComponent: no crosswind (direct tailwind)', () => {
        const wc = new WindCompensation();
        // Runway 09, wind 270/20kt
        const xwind = wc.getCrosswindComponent(90, 270, 20);
        assertClose(xwind, 0, 0.1, 'Direct tailwind has no crosswind');
    });

    test('getCrosswindComponent: 45° angle from right', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 045/20kt (45° from right)
        const xwind = wc.getCrosswindComponent(360, 45, 20);
        assertClose(xwind, 14.1, 1, 'Crosswind = 20 * sin(45°) ≈ 14kt');
    });

    // ──────────────────────────────────────────────────────
    // Headwind Component Tests
    // ──────────────────────────────────────────────────────

    test('getHeadwindComponent: direct headwind', () => {
        const wc = new WindCompensation();
        // Runway 09, wind 090/20kt
        const hdwind = wc.getHeadwindComponent(90, 90, 20);
        assertClose(hdwind, 20, 0.1, 'Direct headwind should be full wind speed');
    });

    test('getHeadwindComponent: direct tailwind', () => {
        const wc = new WindCompensation();
        // Runway 09, wind 270/20kt
        const hdwind = wc.getHeadwindComponent(90, 270, 20);
        assertClose(hdwind, -20, 0.1, 'Tailwind should be negative');
    });

    test('getHeadwindComponent: no headwind (direct crosswind)', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 090/20kt (direct crosswind)
        const hdwind = wc.getHeadwindComponent(360, 90, 20);
        assertClose(hdwind, 0, 0.1, 'Direct crosswind has no headwind');
    });

    test('getHeadwindComponent: 45° quartering headwind', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 045/20kt
        const hdwind = wc.getHeadwindComponent(360, 45, 20);
        assertClose(hdwind, 14.1, 1, 'Headwind = 20 * cos(45°) ≈ 14kt');
    });

    test('getHeadwindComponent: 45° quartering tailwind', () => {
        const wc = new WindCompensation();
        // Runway 36, wind 225/20kt
        const hdwind = wc.getHeadwindComponent(360, 225, 20);
        assertClose(hdwind, -14.1, 1, 'Tailwind = -20 * cos(45°) ≈ -14kt');
    });

    // ──────────────────────────────────────────────────────
    // Turbulence Detection Tests
    // ──────────────────────────────────────────────────────

    test('detectTurbulence: smooth conditions (no turbulence)', () => {
        const wc = new WindCompensation();
        // Steady VS readings
        wc.detectTurbulence(100);
        wc.detectTurbulence(100);
        wc.detectTurbulence(100);
        const result = wc.detectTurbulence(100);
        assertEquals(result.isTurbulent, false, 'Smooth conditions should not be turbulent');
        assertEquals(result.severity, 0, 'Severity should be 0');
    });

    test('detectTurbulence: light turbulence', () => {
        const wc = new WindCompensation();
        // VS variance creating light turbulence (stdDev ~120 fpm)
        wc.detectTurbulence(0);
        wc.detectTurbulence(100);
        wc.detectTurbulence(50);
        wc.detectTurbulence(150);
        wc.detectTurbulence(100);
        const result = wc.detectTurbulence(200);
        assertEquals(result.isTurbulent, true, 'Should detect turbulence');
        assertEquals(result.severity, 1, 'Should be light turbulence');
    });

    test('detectTurbulence: moderate turbulence', () => {
        const wc = new WindCompensation();
        // Large VS swings (maxDelta > 500 fpm)
        wc.detectTurbulence(0);
        wc.detectTurbulence(300);
        wc.detectTurbulence(-200);
        wc.detectTurbulence(400);
        const result = wc.detectTurbulence(-300);
        assertEquals(result.isTurbulent, true, 'Should detect turbulence');
        assert(result.severity >= 2, 'Should be moderate or severe turbulence');
    });

    test('detectTurbulence: severe turbulence', () => {
        const wc = new WindCompensation();
        // Extreme VS swings (maxDelta > 1000 fpm)
        wc.detectTurbulence(0);
        wc.detectTurbulence(600);
        wc.detectTurbulence(-500);
        wc.detectTurbulence(700);
        const result = wc.detectTurbulence(-600);
        assertEquals(result.isTurbulent, true, 'Should detect turbulence');
        assertEquals(result.severity, 3, 'Should be severe turbulence');
    });

    test('detectTurbulence: insufficient data (no detection)', () => {
        const wc = new WindCompensation();
        // Less than 3 samples
        wc.detectTurbulence(0);
        const result = wc.detectTurbulence(500);
        assertEquals(result.isTurbulent, false, 'Need ≥3 samples for detection');
        assertEquals(result.severity, 0, 'Severity should be 0');
    });

    test('detectTurbulence: rolling window (10 samples max)', () => {
        const wc = new WindCompensation();
        // Fill with 15 samples, should keep only last 10
        for (let i = 0; i < 15; i++) {
            wc.detectTurbulence(i * 10);
        }
        assertEquals(wc._lastVSReadings.length, 10, 'Should keep only 10 samples');
        assertEquals(wc._lastVSReadings[0], 50, 'Oldest should be sample #5 (50 fpm)');
    });

    test('detectTurbulence: reset clears history', () => {
        const wc = new WindCompensation();
        wc.detectTurbulence(0);
        wc.detectTurbulence(100);
        wc.detectTurbulence(200);
        wc.reset();
        assertEquals(wc._lastVSReadings.length, 0, 'Reset should clear readings');
    });

    test('detectTurbulence: stdDev calculation accuracy', () => {
        const wc = new WindCompensation();
        // Known data: [0, 100, 200] → mean=100, variance=6666.67, stdDev≈81.6
        wc.detectTurbulence(0);
        wc.detectTurbulence(100);
        const result = wc.detectTurbulence(200);
        assertClose(result.stdDev, 82, 2, 'Standard deviation should be ~82 fpm');
    });

    test('detectTurbulence: maxDelta calculation', () => {
        const wc = new WindCompensation();
        // VS: 0 → 100 (Δ100) → 50 (Δ50) → 250 (Δ200) → maxDelta=200
        wc.detectTurbulence(0);
        wc.detectTurbulence(100);
        wc.detectTurbulence(50);
        const result = wc.detectTurbulence(250);
        assertEquals(result.vsDelta, 200, 'Max delta should be 200 fpm');
    });

    // ──────────────────────────────────────────────────────
    // Max Crosswind Tests
    // ──────────────────────────────────────────────────────

    test('getMaxCrosswind: typical GA aircraft', () => {
        const wc = new WindCompensation();
        const profile = { approachSpeed: 70 }; // 70kt approach
        const maxXwind = wc.getMaxCrosswind(profile);
        assertClose(maxXwind, 15, 2, 'Max crosswind ~15kt for 70kt approach');
    });

    test('getMaxCrosswind: fast approach speed', () => {
        const wc = new WindCompensation();
        const profile = { approachSpeed: 120 }; // 120kt approach
        const maxXwind = wc.getMaxCrosswind(profile);
        assert(maxXwind >= 20 && maxXwind <= 25, 'Should cap at 25kt max');
    });

    test('getMaxCrosswind: no profile (default)', () => {
        const wc = new WindCompensation();
        const profile = {}; // No approach speed
        const maxXwind = wc.getMaxCrosswind(profile);
        assertEquals(maxXwind, 20, 'Default max crosswind should be 20kt');
    });

    test('getMaxCrosswind: clamped to min 15kt', () => {
        const wc = new WindCompensation();
        const profile = { approachSpeed: 50 }; // Low approach speed
        const maxXwind = wc.getMaxCrosswind(profile);
        assert(maxXwind >= 15, 'Should clamp to min 15kt');
    });

    // ──────────────────────────────────────────────────────
    // Edge Cases & Boundary Tests
    // ──────────────────────────────────────────────────────

    test('calculateWindCorrection: 360° wrap-around', () => {
        const wc = new WindCompensation();
        // Track 010°, wind from 340° (left crosswind)
        const result = wc.calculateWindCorrection(10, 100, 340, 15);
        assert(result.heading >= 0 && result.heading < 360, 'Heading should wrap to 0-359°');
    });

    test('calculateWindCorrection: high wind scenario', () => {
        const wc = new WindCompensation();
        // 50kt wind at 90° to track (strong crosswind)
        const result = wc.calculateWindCorrection(360, 100, 90, 50);
        assert(Math.abs(result.correction) > 20, 'Strong wind should require large correction');
        assertClose(result.crosswind, 50, 1, 'Crosswind should be 50kt');
    });

    test('calculateWindCorrection: wind faster than airspeed', () => {
        const wc = new WindCompensation();
        // Edge case: 120kt wind, 100kt TAS
        const result = wc.calculateWindCorrection(90, 100, 180, 120);
        assert(result.heading >= 0 && result.heading < 360, 'Should still return valid heading');
        // Extreme tailwind → very high GS
        assert(result.effectiveGS > 150, 'GS should be very high with extreme tailwind');
    });

    test('getCrosswindComponent: runway 36 edge case', () => {
        const wc = new WindCompensation();
        // Runway 360 (north), wind from 001° (almost aligned)
        const xwind = wc.getCrosswindComponent(360, 1, 20);
        assertClose(xwind, 0.35, 0.5, 'Nearly aligned wind should have minimal crosswind');
    });

    test('getHeadwindComponent: 90° crosswind edge case', () => {
        const wc = new WindCompensation();
        // Exact 90° crosswind should have zero headwind
        const hdwind = wc.getHeadwindComponent(180, 90, 20);
        assertClose(hdwind, 0, 0.5, 'Pure crosswind should have no headwind');
    });

    console.log(`\nDefined ${tests.length} tests`);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runTests };
}
