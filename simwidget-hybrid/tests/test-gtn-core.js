/**
 * GTN Core Unit Tests v1.0.0
 * Tests for GTNCore utility class - distance, bearing, formatting, colors
 *
 * Usage: node test-gtn-core.js
 */

const path = require('path');

// Load GTNCore
const GTNCore = require(path.join(__dirname, '../ui/gtn750/modules/gtn-core.js'));

// Simple test framework
let passed = 0;
let failed = 0;
let currentSuite = '';

function log(msg, color = 'white') {
    const colors = {
        green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
        cyan: '\x1b[36m', white: '\x1b[37m', reset: '\x1b[0m'
    };
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function suite(name) {
    currentSuite = name;
    log(`\n${name}`, 'cyan');
}

function test(description, fn) {
    try {
        fn();
        passed++;
        log(`  ✓ ${description}`, 'green');
    } catch (e) {
        failed++;
        log(`  ✗ ${description}`, 'red');
        log(`    ${e.message}`, 'red');
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertClose(actual, expected, tolerance = 0.1, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} Expected ${expected} ±${tolerance}, got ${actual}`);
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
}

// ===== RUN TESTS =====

log('\n🧪 GTN Core Unit Tests v1.0.0\n', 'cyan');

const core = new GTNCore();

// ===== DISTANCE CALCULATIONS =====

suite('Distance Calculations');

test('calculateDistance: KSEA to KLAX', () => {
    const dist = core.calculateDistance(47.4502, -122.3088, 33.9416, -118.4085);
    assertClose(dist, 830, 5, 'KSEA-KLAX distance');  // ~830nm great circle
});

test('calculateDistance: Same point', () => {
    const dist = core.calculateDistance(47.45, -122.31, 47.45, -122.31);
    assertEqual(dist, 0, 'Same point');
});

test('calculateDistance: Short distance (~10nm)', () => {
    const dist = core.calculateDistance(47.4502, -122.3088, 47.6062, -122.3321);
    assertClose(dist, 9.4, 0.5, 'KSEA-KBFI');  // ~9.4nm great circle
});

// ===== BEARING CALCULATIONS =====

suite('Bearing Calculations');

test('calculateBearing: Due north', () => {
    const brg = core.calculateBearing(0, 0, 1, 0);
    assertClose(brg, 0, 1, 'North bearing');
});

test('calculateBearing: Due east', () => {
    const brg = core.calculateBearing(0, 0, 0, 1);
    assertClose(brg, 90, 1, 'East bearing');
});

test('calculateBearing: KSEA to KLAX', () => {
    const brg = core.calculateBearing(47.4502, -122.3088, 33.9416, -118.4085);
    assertClose(brg, 166, 2, 'KSEA-KLAX bearing (SSE)');  // ~166° initial bearing
});

test('calculateBearing: Returns 0-360 range', () => {
    const brg = core.calculateBearing(0, 0, -1, -1);
    assert(brg >= 0 && brg < 360, `Bearing ${brg} should be 0-360`);
});

// ===== ANGLE NORMALIZATION =====

suite('Angle Normalization');

test('normalizeAngle: Positive > 180', () => {
    assertEqual(core.normalizeAngle(200), -160, 'normalize 200');
    assertEqual(core.normalizeAngle(270), -90, 'normalize 270');
});

test('normalizeAngle: Negative < -180', () => {
    assertEqual(core.normalizeAngle(-200), 160, 'normalize -200');
});

test('normalizeHeading: Wrap around 360', () => {
    assertEqual(core.normalizeHeading(370), 10, 'normalize 370');
    assertEqual(core.normalizeHeading(-10), 350, 'normalize -10');
});

// ===== MAGNETIC VARIATION =====

suite('Magnetic Variation');

test('trueToMagnetic: East variation', () => {
    assertEqual(core.trueToMagnetic(90, 10), 80, '90T - 10E = 80M');
});

test('trueToMagnetic: West variation', () => {
    assertEqual(core.trueToMagnetic(90, -10), 100, '90T - 10W = 100M');
});

test('magneticToTrue: Inverse operation', () => {
    const mag = core.trueToMagnetic(135, 12);
    const tru = core.magneticToTrue(mag, 12);
    assertEqual(tru, 135, 'Round-trip conversion');
});

// ===== COORDINATE CONVERSION =====

suite('Coordinate Conversion');

test('nmToPixels: Full half-canvas', () => {
    const px = core.nmToPixels(10, 10, 520);
    assertEqual(px, 260, '10nm @ 10nm range = 260px');
});

test('latLonToCanvas: Aircraft at center', () => {
    const pos = core.latLonToCanvas(47.45, -122.31, 47.45, -122.31, 0, 10, 520, 280, true);
    assertEqual(pos.x, 260, 'Center X');
    assertEqual(pos.y, 140, 'Center Y');
});

// ===== FORMATTING =====

suite('Formatting');

test('formatLat: KSEA', () => {
    assertEqual(core.formatLat(47.4502), "N47°27.01'", 'KSEA latitude');
});

test('formatLon: KSEA', () => {
    assertEqual(core.formatLon(-122.3088), "W122°18.53'", 'KSEA longitude');
});

test('formatTime: 14:30', () => {
    assertEqual(core.formatTime(14.5), '14:30:00Z', '14.5 hours');
});

test('formatEte: Short time', () => {
    assertEqual(core.formatEte(45), '45m', '45 minutes');
});

test('formatEte: Long time', () => {
    assertEqual(core.formatEte(135), '2:15', '2:15 hours');
});

test('formatEte: Invalid', () => {
    assertEqual(core.formatEte(-1), '--:--', 'Negative time');
    assertEqual(core.formatEte(Infinity), '--:--', 'Infinity');
});

test('formatHeading: Padding', () => {
    assertEqual(core.formatHeading(5), '005', 'Pad to 3 digits');
    assertEqual(core.formatHeading(45), '045', 'Pad to 3 digits');
});

test('formatAltitude: Comma separator', () => {
    assertEqual(core.formatAltitude(5280), '5,280', 'Thousands separator');
});

// ===== TAWS COLORS =====

suite('TAWS (Terrain) Colors');

test('getTerrainColor: PULL UP (<100ft)', () => {
    assertEqual(core.getTerrainColor(4950, 5000), core.TAWS_COLORS.PULL_UP, '50ft clearance = RED');
});

test('getTerrainColor: WARNING (100-500ft)', () => {
    assertEqual(core.getTerrainColor(4600, 5000), core.TAWS_COLORS.WARNING, '400ft clearance = ORANGE');
});

test('getTerrainColor: CAUTION (500-1000ft)', () => {
    assertEqual(core.getTerrainColor(4200, 5000), core.TAWS_COLORS.CAUTION, '800ft clearance = YELLOW');
});

test('getTerrainColor: SAFE (1000-2000ft)', () => {
    assertEqual(core.getTerrainColor(3500, 5000), core.TAWS_COLORS.SAFE, '1500ft clearance = GREEN');
});

test('getTerrainAlertLevel: PULL_UP prediction', () => {
    const alert = core.getTerrainAlertLevel(4950, 5000, -600);
    assertEqual(alert.level, 'PULL_UP', 'Predicted low clearance');
});

test('getTerrainAlertLevel: DONT_SINK', () => {
    const alert = core.getTerrainAlertLevel(4600, 5000, -600);
    assertEqual(alert.level, 'DONT_SINK', 'Rapid descent near terrain');
});

// ===== TRAFFIC COLORS =====

suite('Traffic (TCAS) Colors');

test('getTrafficColor: Resolution Advisory', () => {
    const color = core.getTrafficColor(200, 50);
    assertEqual(color, core.TRAFFIC_COLORS.RESOLUTION, '200ft + closing = RED');
});

test('getTrafficColor: Traffic Advisory', () => {
    const color = core.getTrafficColor(800, 50);
    assertEqual(color, core.TRAFFIC_COLORS.TRAFFIC, '800ft + closing = YELLOW');
});

test('getTrafficColor: Non-threat', () => {
    const color = core.getTrafficColor(1500, 50);
    assertEqual(color, core.TRAFFIC_COLORS.NON_THREAT, '1500ft = WHITE');
});

test('getTrafficSymbol: Same altitude', () => {
    assertEqual(core.getTrafficSymbol(0), 'diamond-filled', '0ft = diamond');
});

test('getTrafficSymbol: Above', () => {
    assertEqual(core.getTrafficSymbol(500), 'arrow-up', '500ft above = up arrow');
});

test('getTrafficSymbol: Below', () => {
    assertEqual(core.getTrafficSymbol(-500), 'arrow-down', '-500ft below = down arrow');
});

// ===== METAR COLORS =====

suite('METAR Colors');

test('getMetarColor: VFR', () => {
    assertEqual(core.getMetarColor('VFR'), core.METAR_COLORS.VFR, 'VFR = GREEN');
});

test('getMetarColor: IFR', () => {
    assertEqual(core.getMetarColor('IFR'), core.METAR_COLORS.IFR, 'IFR = RED');
});

test('getMetarColor: Unknown', () => {
    assertEqual(core.getMetarColor(null), core.METAR_COLORS.UNKNOWN, 'null = GRAY');
});

// ===== FINAL SUMMARY =====

log('\n' + '='.repeat(50), 'white');
log(`\n📊 Test Results:`, 'white');
log(`   Passed: ${passed}`, 'green');
log(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green');
log(`   Total:  ${passed + failed}`, 'cyan');
log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`, failed > 0 ? 'yellow' : 'green');

process.exit(failed > 0 ? 1 : 0);
