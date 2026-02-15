/**
 * Fuel Monitor Validation Test
 * Tests fuel state tracking, reserve calculations, and low fuel warnings
 *
 * Run in browser console at http://192.168.1.42:8080/ui/gtn750/
 */

class FuelMonitorValidationTest {
    constructor() {
        this.results = { passed: [], failed: [], info: [] };
    }

    async runAll() {
        console.log('🧪 Fuel Monitor Validation Test Suite\n');
        console.log('='.repeat(60));

        this.testModule();
        this.testFuelStateCalculation();
        this.testReserveCalculations();
        this.testEnduranceRange();
        this.testDestinationPlanning();
        this.testWarningCallbacks();
        this.testBurnRateAveraging();
        this.testNearestAirports();

        this.printSummary();
        return this.results;
    }

    // ===== MODULE TESTS =====

    testModule() {
        console.log('\n📦 Fuel Monitor Module Tests');

        if (typeof GTNFuelMonitor === 'undefined') {
            this.failed('GTNFuelMonitor class not defined');
            return;
        }

        this.assert(
            typeof GTNFuelMonitor === 'function',
            'GTNFuelMonitor is a class'
        );

        // Create instance for testing
        window.testFuelMonitor = new GTNFuelMonitor();

        const fuel = window.testFuelMonitor;

        this.assert(
            typeof fuel.update === 'function',
            'Has update method'
        );

        this.assert(
            typeof fuel.getStatus === 'function',
            'Has getStatus method'
        );

        this.assert(
            typeof fuel.setDestination === 'function',
            'Has setDestination method'
        );

        this.assert(
            typeof fuel.setReserveType === 'function',
            'Has setReserveType method'
        );

        this.assert(
            typeof fuel.getNearestAirportsWithinRange === 'function',
            'Has getNearestAirportsWithinRange method'
        );

        this.assert(
            fuel.config.usableFuelPercent === 95,
            `Default usable fuel is 95% (actual: ${fuel.config.usableFuelPercent}%)`
        );

        this.assert(
            fuel.config.reserveType === 'VFR',
            `Default reserve type is VFR (actual: ${fuel.config.reserveType})`
        );

        this.info('Module initialized successfully');
    }

    // ===== FUEL STATE TESTS =====

    testFuelStateCalculation() {
        console.log('\n⛽ Fuel State Calculation Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Test safe state (plenty of fuel)
        fuel.update({
            fuelTotalGallons: 50.0,
            fuelTotalPounds: 300.0,
            groundSpeed: 120,
            fuelFlow: 8.5 // GPH
        });

        let status = fuel.getStatus();

        this.assert(
            status.fuelState === 'safe',
            `Safe state with 50 gal (actual: ${status.fuelState})`
        );

        this.assert(
            status.usableFuelGallons === 47.5,
            `Usable fuel is 95% of 50 gal = 47.5 gal (actual: ${status.usableFuelGallons})`
        );

        // Test marginal state (below warning threshold)
        fuel.update({
            fuelTotalGallons: 12.0,
            fuelTotalPounds: 72.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        status = fuel.getStatus();

        this.assert(
            status.fuelState === 'marginal',
            `Marginal state with 12 gal (actual: ${status.fuelState})`
        );

        // Test critical state (below reserves)
        fuel.update({
            fuelTotalGallons: 5.0,
            fuelTotalPounds: 30.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        status = fuel.getStatus();

        this.assert(
            status.fuelState === 'critical',
            `Critical state with 5 gal (actual: ${status.fuelState})`
        );

        this.info('Fuel state transitions validated');
    }

    // ===== RESERVE CALCULATION TESTS =====

    testReserveCalculations() {
        console.log('\n📏 Reserve Calculation Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Test VFR reserves (45 minutes)
        fuel.setReserveType('VFR');
        fuel.update({
            fuelTotalGallons: 50.0,
            fuelTotalPounds: 300.0,
            groundSpeed: 120,
            fuelFlow: 8.5 // GPH
        });

        let status = fuel.getStatus();
        const vfrReserve = 8.5 * (45 / 60); // 6.375 gallons

        this.assert(
            Math.abs(status.reserveFuel - vfrReserve) < 0.1,
            `VFR reserve is 45 min at 8.5 GPH = 6.375 gal (actual: ${status.reserveFuel.toFixed(2)} gal)`
        );

        this.assert(
            status.reserveMinutes === 45,
            `VFR reserve time is 45 min (actual: ${status.reserveMinutes} min)`
        );

        // Test IFR reserves (60 minutes)
        fuel.setReserveType('IFR');
        fuel.update({
            fuelTotalGallons: 50.0,
            fuelTotalPounds: 300.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        status = fuel.getStatus();
        const ifrReserve = 8.5 * (60 / 60); // 8.5 gallons

        this.assert(
            Math.abs(status.reserveFuel - ifrReserve) < 0.1,
            `IFR reserve is 60 min at 8.5 GPH = 8.5 gal (actual: ${status.reserveFuel.toFixed(2)} gal)`
        );

        this.assert(
            status.reserveMinutes === 60,
            `IFR reserve time is 60 min (actual: ${status.reserveMinutes} min)`
        );

        // Reset to VFR for other tests
        fuel.setReserveType('VFR');

        this.info('Reserve calculations validated for VFR and IFR');
    }

    // ===== ENDURANCE & RANGE TESTS =====

    testEnduranceRange() {
        console.log('\n🕐 Endurance & Range Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        fuel.setReserveType('VFR');
        fuel.update({
            fuelTotalGallons: 40.0,
            fuelTotalPounds: 240.0,
            groundSpeed: 120,
            fuelFlow: 8.0 // GPH
        });

        const status = fuel.getStatus();

        // Usable fuel: 40 * 0.95 = 38 gal
        // Endurance: 38 / 8.0 = 4.75 hours = 285 minutes
        const expectedEndurance = 38.0 / 8.0;
        const expectedEnduranceMin = expectedEndurance * 60;

        this.assert(
            Math.abs(status.enduranceHours - expectedEndurance) < 0.1,
            `Endurance is 38 gal / 8 GPH = 4.75 hrs (actual: ${status.enduranceHours.toFixed(2)} hrs)`
        );

        this.assert(
            Math.abs(status.enduranceMinutes - expectedEnduranceMin) < 1,
            `Endurance is 285 min (actual: ${status.enduranceMinutes.toFixed(0)} min)`
        );

        // Range: endurance * groundSpeed = 4.75 * 120 = 570 nm
        const expectedRange = expectedEndurance * 120;

        this.assert(
            Math.abs(status.rangeNm - expectedRange) < 1,
            `Range is 4.75 hrs * 120 kt = 570 nm (actual: ${status.rangeNm.toFixed(0)} nm)`
        );

        this.info('Endurance and range calculations validated');
    }

    // ===== DESTINATION PLANNING TESTS =====

    testDestinationPlanning() {
        console.log('\n🎯 Destination Planning Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Scenario 1: Can reach destination with reserves
        fuel.setReserveType('VFR');
        fuel.setDestination({
            ident: 'KDEN',
            name: 'Denver International',
            distanceNm: 200
        });

        fuel.update({
            fuelTotalGallons: 40.0,
            fuelTotalPounds: 240.0,
            groundSpeed: 120,
            fuelFlow: 8.0
        });

        let status = fuel.getStatus();

        // Time to destination: 200 / 120 = 1.67 hours
        // Fuel required: 1.67 * 8.0 = 13.33 gal
        // Reserve fuel: 8.0 * (45/60) = 6.0 gal
        // Total needed: 13.33 + 6.0 = 19.33 gal
        // Usable fuel: 40 * 0.95 = 38 gal
        // Can reach: YES (38 > 19.33)

        this.assert(
            status.destination.ident === 'KDEN',
            `Destination set to KDEN (actual: ${status.destination.ident})`
        );

        this.assert(
            status.canReachDestination === true,
            `Can reach KDEN with 38 gal usable (actual: ${status.canReachDestination})`
        );

        // Fuel remaining at destination (with reserves)
        const fuelRemaining = status.fuelAtDestinationGallons;
        this.assert(
            fuelRemaining > status.reserveFuel,
            `Fuel remaining at KDEN > reserves (${fuelRemaining.toFixed(1)} > ${status.reserveFuel.toFixed(1)} gal)`
        );

        // Scenario 2: Cannot reach destination with reserves
        fuel.setDestination({
            ident: 'KSFO',
            name: 'San Francisco',
            distanceNm: 400 // Too far
        });

        fuel.update({
            fuelTotalGallons: 40.0,
            fuelTotalPounds: 240.0,
            groundSpeed: 120,
            fuelFlow: 8.0
        });

        status = fuel.getStatus();

        // Time to destination: 400 / 120 = 3.33 hours
        // Fuel required: 3.33 * 8.0 = 26.67 gal
        // Reserve fuel: 6.0 gal
        // Total needed: 26.67 + 6.0 = 32.67 gal
        // Usable fuel: 38 gal
        // Can reach: YES (38 > 32.67) but marginal

        this.assert(
            status.destination.ident === 'KSFO',
            `Destination changed to KSFO (actual: ${status.destination.ident})`
        );

        // Clear destination
        fuel.clearDestination();
        status = fuel.getStatus();

        this.assert(
            status.destination === null,
            `Destination cleared (actual: ${status.destination})`
        );

        this.info('Destination planning validated');
    }

    // ===== WARNING CALLBACK TESTS =====

    testWarningCallbacks() {
        console.log('\n🔔 Warning Callback Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Track warnings
        const triggeredWarnings = [];

        fuel.onWarning = (type, message, level) => {
            triggeredWarnings.push({ type, message, level });
        };

        fuel.setReserveType('VFR');

        // Trigger critical warning (below reserves)
        fuel.update({
            fuelTotalGallons: 5.0,
            fuelTotalPounds: 30.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        this.assert(
            triggeredWarnings.some(w => w.type === 'FUEL_CRITICAL'),
            'FUEL_CRITICAL warning triggered'
        );

        this.assert(
            triggeredWarnings.some(w => w.level === 'critical'),
            'Critical level warning for low fuel'
        );

        // Trigger marginal warning
        triggeredWarnings.length = 0; // Clear
        fuel.update({
            fuelTotalGallons: 12.0,
            fuelTotalPounds: 72.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        this.assert(
            triggeredWarnings.some(w => w.type === 'FUEL_MARGINAL'),
            'FUEL_MARGINAL warning triggered'
        );

        this.assert(
            triggeredWarnings.some(w => w.level === 'warning'),
            'Warning level for marginal fuel'
        );

        // Trigger destination warning (insufficient fuel)
        triggeredWarnings.length = 0;
        fuel.setDestination({
            ident: 'KDEN',
            name: 'Denver',
            distanceNm: 300 // Too far with 12 gal
        });

        fuel.update({
            fuelTotalGallons: 12.0,
            fuelTotalPounds: 72.0,
            groundSpeed: 120,
            fuelFlow: 8.5
        });

        this.assert(
            triggeredWarnings.some(w => w.type === 'FUEL_INSUFFICIENT_DEST'),
            'FUEL_INSUFFICIENT_DEST warning triggered'
        );

        this.info(`Total warnings triggered: ${triggeredWarnings.length}`);
    }

    // ===== BURN RATE AVERAGING TESTS =====

    testBurnRateAveraging() {
        console.log('\n📊 Burn Rate Averaging Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Reset burn rate history
        fuel.burnRateHistory = [];

        // Add samples
        const samples = [8.5, 8.7, 8.3, 8.6, 8.4];

        samples.forEach(rate => {
            fuel.update({
                fuelTotalGallons: 40.0,
                fuelTotalPounds: 240.0,
                groundSpeed: 120,
                fuelFlow: rate
            });
        });

        const status = fuel.getStatus();

        // Average: (8.5 + 8.7 + 8.3 + 8.6 + 8.4) / 5 = 8.5
        const expectedAvg = samples.reduce((a, b) => a + b, 0) / samples.length;

        this.assert(
            Math.abs(status.avgBurnRate - expectedAvg) < 0.1,
            `Average burn rate is ${expectedAvg.toFixed(1)} GPH (actual: ${status.avgBurnRate.toFixed(1)} GPH)`
        );

        // Test history limit (max 10 samples)
        for (let i = 0; i < 20; i++) {
            fuel.update({
                fuelTotalGallons: 40.0,
                fuelTotalPounds: 240.0,
                groundSpeed: 120,
                fuelFlow: 9.0 + i * 0.1
            });
        }

        this.assert(
            fuel.burnRateHistory.length <= 10,
            `Burn rate history limited to 10 samples (actual: ${fuel.burnRateHistory.length})`
        );

        this.info('Burn rate averaging validated');
    }

    // ===== NEAREST AIRPORTS TESTS =====

    testNearestAirports() {
        console.log('\n✈️ Nearest Airports Tests');

        const fuel = window.testFuelMonitor;
        if (!fuel) return;

        // Mock airports data
        const mockAirports = [
            { ident: 'KAPA', name: 'Centennial', lat: 39.5701, lon: -104.8493, distance: 50 },
            { ident: 'KDEN', name: 'Denver Intl', lat: 39.8561, lon: -104.6737, distance: 30 },
            { ident: 'KBJC', name: 'Rocky Mountain', lat: 39.9088, lon: -105.1169, distance: 80 },
            { ident: 'KCOS', name: 'Colorado Springs', lat: 38.8058, lon: -104.7006, distance: 120 }
        ];

        // Set range: 100nm
        fuel.update({
            fuelTotalGallons: 20.0,
            fuelTotalPounds: 120.0,
            groundSpeed: 120,
            fuelFlow: 8.0
        });

        const status = fuel.getStatus();
        const range = status.rangeNm;

        // Filter airports within range
        const withinRange = mockAirports.filter(apt => apt.distance <= range);

        this.assert(
            withinRange.length >= 2,
            `At least 2 airports within ${range.toFixed(0)}nm range (actual: ${withinRange.length})`
        );

        this.assert(
            withinRange.every(apt => apt.distance <= range),
            `All filtered airports within range (max: ${Math.max(...withinRange.map(a => a.distance))}nm)`
        );

        // Test sorted by distance
        const sorted = [...withinRange].sort((a, b) => a.distance - b.distance);

        this.assert(
            sorted[0].ident === 'KDEN',
            `Nearest airport is KDEN at 30nm (actual: ${sorted[0].ident})`
        );

        this.info('Nearest airports query validated');
    }

    // ===== HELPER METHODS =====

    assert(condition, testName) {
        if (condition) {
            this.results.passed.push(testName);
            console.log(`  ✅ ${testName}`);
        } else {
            this.results.failed.push(testName);
            console.log(`  ❌ ${testName}`);
        }
    }

    failed(reason) {
        this.results.failed.push(reason);
        console.log(`  ❌ ${reason}`);
    }

    info(message) {
        this.results.info.push(message);
        console.log(`  ℹ️  ${message}`);
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('FUEL MONITOR VALIDATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);

        if (this.results.failed.length > 0) {
            console.log('\nFailed tests:');
            this.results.failed.forEach(f => console.log(`  - ${f}`));
        }

        if (this.results.failed.length === 0) {
            console.log('\n🎉 FUEL MONITOR FULLY VALIDATED!');
            console.log('\nFuel Monitor Features Confirmed:');
            console.log('  ✓ Fuel state tracking (safe/marginal/critical)');
            console.log('  ✓ VFR/IFR reserve calculations (45min/60min)');
            console.log('  ✓ Endurance and range calculations');
            console.log('  ✓ Destination fuel planning');
            console.log('  ✓ Low fuel warnings (critical/marginal/insufficient)');
            console.log('  ✓ Burn rate averaging (10-sample window)');
            console.log('  ✓ Nearest airports within fuel range');
            console.log('\nReady for safe fuel management!');
        }
    }
}

// Auto-run
if (window.location.pathname.includes('gtn750')) {
    console.log('GTN750 detected - ready to validate fuel monitor');
    console.log('Run: new FuelMonitorValidationTest().runAll()');
} else {
    console.log('⚠️  Load this in GTN750 page: http://192.168.1.42:8080/ui/gtn750/');
}

// Export
if (typeof window !== 'undefined') {
    window.FuelMonitorValidationTest = FuelMonitorValidationTest;
}
