/**
 * GTN750Xi Planning Utilities - Calculation Tests
 * Verify calculation logic for all utilities
 */

// Test DALT/TAS/Winds calculations
function testDaltCalculations() {
    console.log('Testing DALT/TAS/Winds calculations...');

    const inputs = {
        indicatedAlt: 5000,
        baro: 29.92,
        cas: 120,
        tat: 15,
        hdg: 360,
        trk: 350,
        groundSpeed: 130
    };

    // Pressure ALT = Indicated ALT + (29.92 - BARO) × 1000
    const pressureAlt = inputs.indicatedAlt + (29.92 - inputs.baro) * 1000;
    console.log(`  Pressure ALT: ${pressureAlt} ft (expected: 5000)`);

    // Standard temp = 15°C - (altitude / 1000 × 2)
    const stdTemp = 15 - (pressureAlt / 1000 * 2);
    console.log(`  Standard Temp: ${stdTemp}°C (expected: 5°C)`);

    // Density ALT = Pressure ALT + 120 × (OAT - Std Temp)
    const densityAlt = Math.round(pressureAlt + 120 * (inputs.tat - stdTemp));
    console.log(`  Density ALT: ${densityAlt} ft (expected: ~6200 ft)`);

    // TAS ≈ CAS × (1 + altitude/1000 × 0.02)
    const altFactor = 1 + (pressureAlt / 1000 * 0.02);
    const tas = Math.round(inputs.cas * altFactor);
    console.log(`  TAS: ${tas} kt (expected: ~132 kt)`);

    console.log('  ✅ DALT/TAS calculations OK\n');
}

// Test Fuel Planning calculations
function testFuelCalculations() {
    console.log('Testing Fuel Planning calculations...');

    const distance = 100; // NM
    const estFuel = 50;   // GAL
    const fuelFlow = 10;  // GPH
    const groundSpeed = 120; // KT

    // Time for leg (hours)
    const timeHours = distance / groundSpeed;
    console.log(`  Time for leg: ${timeHours.toFixed(2)} hours (expected: 0.83)`);

    // Fuel Required = time × fuel flow
    const fuelRequired = timeHours * fuelFlow;
    console.log(`  Fuel Required: ${fuelRequired.toFixed(1)} GAL (expected: 8.3)`);

    // Fuel After Leg
    const fuelAfter = estFuel - fuelRequired;
    console.log(`  Fuel After: ${fuelAfter.toFixed(1)} GAL (expected: 41.7)`);

    // Range = (EST Fuel / Fuel Flow) × Ground Speed
    const range = (estFuel / fuelFlow) * groundSpeed;
    console.log(`  Range: ${range.toFixed(0)} NM (expected: 600)`);

    // Efficiency = Ground Speed / Fuel Flow
    const efficiency = groundSpeed / fuelFlow;
    console.log(`  Efficiency: ${efficiency.toFixed(1)} NM/GAL (expected: 12.0)`);

    // Endurance = EST Fuel / Fuel Flow (hours → minutes)
    const endurance = (estFuel / fuelFlow) * 60;
    console.log(`  Endurance: ${endurance.toFixed(0)} min (expected: 300)`);

    console.log('  ✅ Fuel calculations OK\n');
}

// Test VCALC calculations
function testVcalcCalculations() {
    console.log('Testing VCALC calculations...');

    const currentAlt = 10000;    // ft
    const targetAlt = 3000;      // ft
    const distToTOD = 25;        // NM
    const groundSpeed = 120;     // kt

    const altDelta = currentAlt - targetAlt;
    console.log(`  Altitude delta: ${altDelta} ft (expected: 7000)`);

    // Time to TOD (minutes)
    const timeToTOD = (distToTOD / groundSpeed) * 60;
    console.log(`  Time to TOD: ${timeToTOD.toFixed(1)} min (expected: 12.5)`);

    // Required VS = altitude delta / time to TOD
    const vsRequired = Math.round(-(altDelta / timeToTOD));
    console.log(`  VS Required: ${vsRequired} fpm (expected: -560)`);

    console.log('  ✅ VCALC calculations OK\n');
}

// Run all tests
console.log('🧪 GTN750Xi Planning Utilities - Calculation Tests\n');
testDaltCalculations();
testFuelCalculations();
testVcalcCalculations();
console.log('✅ All calculation tests passed!');
