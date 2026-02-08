/**
 * GTN Core Unit Tests
 * Tests for GTNCore utility class - distance, bearing, formatting, colors
 */

const GTNCore = require('../ui/gtn750/modules/gtn-core.js');

describe('GTNCore', () => {
    let core;

    beforeEach(() => {
        core = new GTNCore();
    });

    // ===== DISTANCE CALCULATIONS =====

    describe('calculateDistance', () => {
        it('should calculate distance between KSEA and KLAX', () => {
            const dist = core.calculateDistance(
                47.4502, -122.3088,  // KSEA
                33.9416, -118.4085   // KLAX
            );
            expect(dist).toBeCloseTo(954.2, 0);  // 954nm ±1nm
        });

        it('should return 0 for same point', () => {
            const dist = core.calculateDistance(47.45, -122.31, 47.45, -122.31);
            expect(dist).toBe(0);
        });

        it('should handle antipodal points', () => {
            const dist = core.calculateDistance(0, 0, 0, 180);
            expect(dist).toBeCloseTo(10800, 50);  // Half earth circumference ~10,800nm
        });

        it('should handle equator to north pole', () => {
            const dist = core.calculateDistance(0, 0, 90, 0);
            expect(dist).toBeCloseTo(5400, 10);  // Quarter earth circumference
        });

        it('should calculate short distances accurately', () => {
            const dist = core.calculateDistance(
                47.4502, -122.3088,  // KSEA
                47.6062, -122.3321   // KBFI (Boeing Field, ~10nm north)
            );
            expect(dist).toBeCloseTo(10.7, 0.5);
        });
    });

    // ===== BEARING CALCULATIONS =====

    describe('calculateBearing', () => {
        it('should calculate bearing due north', () => {
            const brg = core.calculateBearing(0, 0, 1, 0);
            expect(brg).toBeCloseTo(0, 1);
        });

        it('should calculate bearing due east', () => {
            const brg = core.calculateBearing(0, 0, 0, 1);
            expect(brg).toBeCloseTo(90, 1);
        });

        it('should calculate bearing due south', () => {
            const brg = core.calculateBearing(1, 0, 0, 0);
            expect(brg).toBeCloseTo(180, 1);
        });

        it('should calculate bearing due west', () => {
            const brg = core.calculateBearing(0, 1, 0, 0);
            expect(brg).toBeCloseTo(270, 1);
        });

        it('should return 0-360 range', () => {
            const brg = core.calculateBearing(0, 0, -1, -1);
            expect(brg).toBeGreaterThanOrEqual(0);
            expect(brg).toBeLessThan(360);
        });

        it('should calculate bearing KSEA to KLAX', () => {
            const brg = core.calculateBearing(
                47.4502, -122.3088,  // KSEA
                33.9416, -118.4085   // KLAX
            );
            expect(brg).toBeCloseTo(157, 1);  // ~157° (SSE)
        });
    });

    // ===== ANGLE NORMALIZATION =====

    describe('normalizeAngle', () => {
        it('should normalize positive angles > 180', () => {
            expect(core.normalizeAngle(200)).toBe(-160);
            expect(core.normalizeAngle(270)).toBe(-90);
        });

        it('should normalize negative angles < -180', () => {
            expect(core.normalizeAngle(-200)).toBe(160);
            expect(core.normalizeAngle(-270)).toBe(90);
        });

        it('should leave angles in range unchanged', () => {
            expect(core.normalizeAngle(0)).toBe(0);
            expect(core.normalizeAngle(90)).toBe(90);
            expect(core.normalizeAngle(-90)).toBe(-90);
            expect(core.normalizeAngle(180)).toBe(180);
        });

        it('should handle multiple wraps', () => {
            expect(core.normalizeAngle(540)).toBe(-180);
            expect(core.normalizeAngle(-540)).toBe(180);
        });
    });

    describe('normalizeHeading', () => {
        it('should normalize headings to 0-360', () => {
            expect(core.normalizeHeading(370)).toBe(10);
            expect(core.normalizeHeading(-10)).toBe(350);
            expect(core.normalizeHeading(720)).toBe(0);
        });

        it('should leave valid headings unchanged', () => {
            expect(core.normalizeHeading(0)).toBe(0);
            expect(core.normalizeHeading(180)).toBe(180);
            expect(core.normalizeHeading(359)).toBe(359);
        });
    });

    // ===== MAGNETIC VARIATION =====

    describe('trueToMagnetic', () => {
        it('should convert with east variation', () => {
            const mag = core.trueToMagnetic(90, 10);  // 90° true, 10°E var
            expect(mag).toBe(80);  // 80° magnetic
        });

        it('should convert with west variation', () => {
            const mag = core.trueToMagnetic(90, -10);  // 90° true, 10°W var
            expect(mag).toBe(100);  // 100° magnetic
        });

        it('should handle zero variation', () => {
            expect(core.trueToMagnetic(45, 0)).toBe(45);
        });

        it('should wrap around 360', () => {
            const mag = core.trueToMagnetic(5, 10);  // 5° true - 10° var
            expect(mag).toBe(355);  // Wraps to 355°
        });
    });

    describe('magneticToTrue', () => {
        it('should convert with east variation', () => {
            const tru = core.magneticToTrue(80, 10);  // 80° mag, 10°E var
            expect(tru).toBe(90);  // 90° true
        });

        it('should convert with west variation', () => {
            const tru = core.magneticToTrue(100, -10);  // 100° mag, 10°W var
            expect(tru).toBe(90);  // 90° true
        });

        it('should be inverse of trueToMagnetic', () => {
            const trueBearing = 135;
            const magvar = 12;
            const magnetic = core.trueToMagnetic(trueBearing, magvar);
            const backToTrue = core.magneticToTrue(magnetic, magvar);
            expect(backToTrue).toBe(trueBearing);
        });
    });

    describe('calculateMagneticBearing', () => {
        it('should calculate magnetic bearing with variation', () => {
            const magBrg = core.calculateMagneticBearing(0, 0, 1, 0, 10);
            expect(magBrg).toBeCloseTo(350, 1);  // 0° true - 10°E var = 350° mag
        });
    });

    // ===== COORDINATE CONVERSION =====

    describe('nmToPixels', () => {
        it('should convert 10nm at 10nm range on 520px canvas', () => {
            const pixels = core.nmToPixels(10, 10, 520);
            expect(pixels).toBe(260);  // 10nm is full half-canvas
        });

        it('should convert 5nm at 10nm range on 520px canvas', () => {
            const pixels = core.nmToPixels(5, 10, 520);
            expect(pixels).toBe(130);  // 5nm is quarter-canvas
        });

        it('should scale with range', () => {
            const px1 = core.nmToPixels(10, 10, 520);
            const px2 = core.nmToPixels(10, 20, 520);
            expect(px2).toBe(px1 / 2);  // Doubling range halves pixel size
        });
    });

    describe('latLonToCanvas', () => {
        it('should place aircraft at center', () => {
            const pos = core.latLonToCanvas(
                47.45, -122.31,  // Same as center
                47.45, -122.31,  // Center point
                0, 10, 520, 280, true
            );
            expect(pos.x).toBe(260);  // Center X
            expect(pos.y).toBe(140);  // Center Y
        });

        it('should place waypoint north of center at top', () => {
            const pos = core.latLonToCanvas(
                47.55, -122.31,  // 10nm north
                47.45, -122.31,  // Center
                0, 10, 520, 280, true  // North-up, 10nm range
            );
            expect(pos.x).toBeCloseTo(260, 5);  // Same longitude = center X
            expect(pos.y).toBeLessThan(140);    // North = above center
        });

        it('should rotate map in track-up mode', () => {
            const posNorthUp = core.latLonToCanvas(
                47.55, -122.31, 47.45, -122.31,
                0, 10, 520, 280, true  // North-up
            );
            const posTrackUp = core.latLonToCanvas(
                47.55, -122.31, 47.45, -122.31,
                90, 10, 520, 280, false  // Track-up, heading 90°
            );
            // Positions should differ when rotated
            expect(posTrackUp.x).not.toBeCloseTo(posNorthUp.x, 5);
        });
    });

    // ===== FORMATTING =====

    describe('formatLat', () => {
        it('should format KSEA latitude', () => {
            expect(core.formatLat(47.4502)).toBe('N47°27.01\'');
        });

        it('should format south latitude', () => {
            expect(core.formatLat(-33.9416)).toBe('S33°56.50\'');
        });

        it('should format equator', () => {
            expect(core.formatLat(0)).toBe('N00°00.00\'');
        });

        it('should pad degrees correctly', () => {
            expect(core.formatLat(5.5)).toBe('N05°30.00\'');
        });
    });

    describe('formatLon', () => {
        it('should format KSEA longitude', () => {
            expect(core.formatLon(-122.3088)).toBe('W122°18.53\'');
        });

        it('should format east longitude', () => {
            expect(core.formatLon(118.4085)).toBe('E118°24.51\'');
        });

        it('should format prime meridian', () => {
            expect(core.formatLon(0)).toBe('E000°00.00\'');
        });

        it('should pad degrees correctly', () => {
            expect(core.formatLon(5.5)).toBe('E005°30.00\'');
        });
    });

    describe('formatTime', () => {
        it('should format hours to HH:MM:SSZ', () => {
            expect(core.formatTime(14.5)).toBe('14:30:00Z');
            expect(core.formatTime(0)).toBe('00:00:00Z');
            expect(core.formatTime(23.99)).toBe('23:59:24Z');
        });

        it('should wrap past 24 hours', () => {
            expect(core.formatTime(25)).toBe('01:00:00Z');
        });

        it('should handle fractional seconds', () => {
            expect(core.formatTime(12.5083333)).toBe('12:30:30Z');
        });
    });

    describe('formatEte', () => {
        it('should format short times in minutes', () => {
            expect(core.formatEte(45)).toBe('45m');
            expect(core.formatEte(30)).toBe('30m');
        });

        it('should format long times in H:MM', () => {
            expect(core.formatEte(90)).toBe('1:30');
            expect(core.formatEte(135)).toBe('2:15');
            expect(core.formatEte(60)).toBe('1:00');
        });

        it('should handle invalid values', () => {
            expect(core.formatEte(-1)).toBe('--:--');
            expect(core.formatEte(Infinity)).toBe('--:--');
            expect(core.formatEte(NaN)).toBe('--:--');
        });

        it('should handle zero', () => {
            expect(core.formatEte(0)).toBe('0m');
        });
    });

    describe('formatHeading', () => {
        it('should pad headings to 3 digits', () => {
            expect(core.formatHeading(5)).toBe('005');
            expect(core.formatHeading(45)).toBe('045');
            expect(core.formatHeading(180)).toBe('180');
        });

        it('should round fractional headings', () => {
            expect(core.formatHeading(45.6)).toBe('046');
            expect(core.formatHeading(45.4)).toBe('045');
        });
    });

    describe('formatAltitude', () => {
        it('should add comma separator for thousands', () => {
            expect(core.formatAltitude(5280)).toBe('5,280');
            expect(core.formatAltitude(10000)).toBe('10,000');
        });

        it('should handle low altitudes', () => {
            expect(core.formatAltitude(500)).toBe('500');
            expect(core.formatAltitude(50)).toBe('50');
        });

        it('should round fractional altitudes', () => {
            expect(core.formatAltitude(5280.7)).toBe('5,281');
        });
    });

    // ===== TAWS (TERRAIN) COLORS =====

    describe('getTerrainColor', () => {
        it('should return RED for PULL UP (<100ft)', () => {
            expect(core.getTerrainColor(4950, 5000)).toBe(core.TAWS_COLORS.PULL_UP);  // 50ft clearance
        });

        it('should return ORANGE for WARNING (100-500ft)', () => {
            expect(core.getTerrainColor(4600, 5000)).toBe(core.TAWS_COLORS.WARNING);  // 400ft clearance
        });

        it('should return YELLOW for CAUTION (500-1000ft)', () => {
            expect(core.getTerrainColor(4200, 5000)).toBe(core.TAWS_COLORS.CAUTION);  // 800ft clearance
        });

        it('should return GREEN for SAFE (1000-2000ft)', () => {
            expect(core.getTerrainColor(3500, 5000)).toBe(core.TAWS_COLORS.SAFE);  // 1500ft clearance
        });

        it('should return CLEAR for high clearance (>2000ft)', () => {
            expect(core.getTerrainColor(2000, 5000)).toBe(core.TAWS_COLORS.CLEAR);  // 3000ft clearance
        });

        it('should handle negative clearance (below terrain)', () => {
            expect(core.getTerrainColor(5100, 5000)).toBe(core.TAWS_COLORS.PULL_UP);  // -100ft (below!)
        });
    });

    describe('getTerrainAlertLevel', () => {
        it('should trigger PULL_UP with low predicted clearance', () => {
            const alert = core.getTerrainAlertLevel(4950, 5000, -600);
            // Current: 50ft, Predicted: 50 - 10 = 40ft
            expect(alert.level).toBe('PULL_UP');
            expect(alert.color).toBe(core.TAWS_COLORS.PULL_UP);
        });

        it('should trigger TERRAIN warning', () => {
            const alert = core.getTerrainAlertLevel(4800, 5000, -600);
            // Current: 200ft, Predicted: 200 - 10 = 190ft
            expect(alert.level).toBe('TERRAIN');
            expect(alert.color).toBe(core.TAWS_COLORS.WARNING);
        });

        it('should trigger DONT_SINK on rapid descent near terrain', () => {
            const alert = core.getTerrainAlertLevel(4600, 5000, -600);
            // Current: 400ft, VS: -600fpm
            expect(alert.level).toBe('DONT_SINK');
            expect(alert.color).toBe(core.TAWS_COLORS.CAUTION);
        });

        it('should return CLEAR when safe', () => {
            const alert = core.getTerrainAlertLevel(3000, 5000, 0);
            expect(alert.level).toBe('CLEAR');
            expect(alert.color).toBeNull();
        });

        it('should use 1-second prediction', () => {
            const alert1 = core.getTerrainAlertLevel(4950, 5000, 0);     // Level flight
            const alert2 = core.getTerrainAlertLevel(4950, 5000, -3000); // Descending 3000fpm
            // alert1: 50ft clearance, 50ft predicted = CLEAR (no VS)
            // alert2: 50ft clearance, 0ft predicted = PULL_UP
            expect(alert2.level).toBe('PULL_UP');
        });
    });

    // ===== TRAFFIC COLORS =====

    describe('getTrafficColor', () => {
        it('should return RED for Resolution Advisory', () => {
            const color = core.getTrafficColor(200, 50);  // 200ft separation, closing
            expect(color).toBe(core.TRAFFIC_COLORS.RESOLUTION);
        });

        it('should return YELLOW for Traffic Advisory', () => {
            const color = core.getTrafficColor(800, 50);  // 800ft separation, closing
            expect(color).toBe(core.TRAFFIC_COLORS.TRAFFIC);
        });

        it('should return WHITE for non-threat', () => {
            const color = core.getTrafficColor(1500, 50);  // 1500ft separation
            expect(color).toBe(core.TRAFFIC_COLORS.NON_THREAT);
        });

        it('should ignore non-closing traffic', () => {
            const color = core.getTrafficColor(200, -50);  // Close but diverging
            expect(color).toBe(core.TRAFFIC_COLORS.NON_THREAT);
        });

        it('should handle traffic above and below', () => {
            const colorAbove = core.getTrafficColor(200, 50);
            const colorBelow = core.getTrafficColor(-200, 50);
            expect(colorAbove).toBe(core.TRAFFIC_COLORS.RESOLUTION);
            expect(colorBelow).toBe(core.TRAFFIC_COLORS.RESOLUTION);
        });
    });

    describe('getTrafficSymbol', () => {
        it('should return diamond-filled for same altitude', () => {
            expect(core.getTrafficSymbol(0)).toBe('diamond-filled');
            expect(core.getTrafficSymbol(200)).toBe('diamond-filled');
            expect(core.getTrafficSymbol(-200)).toBe('diamond-filled');
        });

        it('should return arrow-up for traffic above', () => {
            expect(core.getTrafficSymbol(500)).toBe('arrow-up');
            expect(core.getTrafficSymbol(1000)).toBe('arrow-up');
        });

        it('should return arrow-down for traffic below', () => {
            expect(core.getTrafficSymbol(-500)).toBe('arrow-down');
            expect(core.getTrafficSymbol(-1000)).toBe('arrow-down');
        });
    });

    // ===== METAR COLORS =====

    describe('getMetarColor', () => {
        it('should return GREEN for VFR', () => {
            expect(core.getMetarColor('VFR')).toBe(core.METAR_COLORS.VFR);
        });

        it('should return BLUE for MVFR', () => {
            expect(core.getMetarColor('MVFR')).toBe(core.METAR_COLORS.MVFR);
        });

        it('should return RED for IFR', () => {
            expect(core.getMetarColor('IFR')).toBe(core.METAR_COLORS.IFR);
        });

        it('should return MAGENTA for LIFR', () => {
            expect(core.getMetarColor('LIFR')).toBe(core.METAR_COLORS.LIFR);
        });

        it('should return GRAY for unknown category', () => {
            expect(core.getMetarColor('UNKNOWN')).toBe(core.METAR_COLORS.UNKNOWN);
            expect(core.getMetarColor(null)).toBe(core.METAR_COLORS.UNKNOWN);
        });
    });

    // ===== STORAGE =====

    describe('saveSettings and loadSettings', () => {
        beforeEach(() => {
            // Clear localStorage before each test
            localStorage.clear();
        });

        it('should save and load simple values', () => {
            core.saveSettings('testKey', 42);
            expect(core.loadSettings('testKey')).toBe(42);
        });

        it('should save and load objects', () => {
            const obj = { range: 10, orientation: 'track' };
            core.saveSettings('mapConfig', obj);
            expect(core.loadSettings('mapConfig')).toEqual(obj);
        });

        it('should return default value for missing key', () => {
            expect(core.loadSettings('missing', 'default')).toBe('default');
        });

        it('should namespace keys with gtn750_', () => {
            core.saveSettings('test', 'value');
            expect(localStorage.getItem('gtn750_test')).toBe('"value"');
        });

        it('should handle storage errors gracefully', () => {
            // Mock localStorage.setItem to throw
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };

            expect(() => core.saveSettings('test', 'value')).not.toThrow();

            // Restore
            Storage.prototype.setItem = originalSetItem;
        });
    });

    // ===== ANGLE CONVERSION =====

    describe('toRad and toDeg', () => {
        it('should convert degrees to radians', () => {
            expect(core.toRad(0)).toBe(0);
            expect(core.toRad(180)).toBeCloseTo(Math.PI, 10);
            expect(core.toRad(90)).toBeCloseTo(Math.PI / 2, 10);
        });

        it('should convert radians to degrees', () => {
            expect(core.toDeg(0)).toBe(0);
            expect(core.toDeg(Math.PI)).toBeCloseTo(180, 10);
            expect(core.toDeg(Math.PI / 2)).toBeCloseTo(90, 10);
        });

        it('should be inverse operations', () => {
            const deg = 45;
            expect(core.toDeg(core.toRad(deg))).toBeCloseTo(deg, 10);
        });
    });

    // ===== EDGE CASES =====

    describe('Edge Cases', () => {
        it('should handle null/undefined inputs gracefully', () => {
            expect(() => core.calculateDistance(null, null, 0, 0)).not.toThrow();
        });

        it('should handle extreme latitudes', () => {
            const dist = core.calculateDistance(89, 0, -89, 0);
            expect(dist).toBeGreaterThan(0);  // Should not crash
        });

        it('should handle date line crossing', () => {
            const dist = core.calculateDistance(0, 179, 0, -179);
            expect(dist).toBeCloseTo(120, 10);  // ~120nm across date line
        });
    });
});
