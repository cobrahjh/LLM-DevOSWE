const test = async () => {
    console.log('🧪 Testing SafeTaxi Auto-Load on Harold-PC\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Server Status
        const response = await fetch('http://localhost:8080/api/status');
        const data = await response.json();

        console.log('\n📡 1. Server Status:');
        console.log('   Connected to MSFS:', data.connected ? '✅ YES' : '❌ NO');
        console.log('   Flight Data:', data.flightData ? '✅ Available' : '❌ Not Available');

        if (!data.flightData) {
            console.log('\n⚠️  No flight data - is MSFS running with aircraft loaded?');
            return;
        }

        // Test 2: Current Flight Data
        console.log('\n✈️  2. Current Flight Data:');
        console.log('   Position:',
            data.flightData.latitude?.toFixed(4), ',',
            data.flightData.longitude?.toFixed(4));
        console.log('   Altitude MSL:', data.flightData.altitude, 'ft');
        console.log('   AGL:', data.flightData.agl || 'N/A', 'ft');
        console.log('   Ground Speed:', data.flightData.groundSpeed?.toFixed(1), 'kts');
        console.log('   Heading:', data.flightData.heading?.toFixed(0), '°');
        console.log('   Vertical Speed:', data.flightData.verticalSpeed?.toFixed(0), 'fpm');

        // Test 3: Auto-Load Conditions
        const agl = data.flightData.agl || 999;
        const gs = data.flightData.groundSpeed || 999;
        const onGround = agl < 50 && gs < 5;

        console.log('\n🎯 3. Auto-Load Conditions:');
        console.log('   AGL < 50ft?', agl < 50 ? '✅' : '❌', `(${agl}ft)`);
        console.log('   GS < 5kts?', gs < 5 ? '✅' : '❌', `(${gs.toFixed(1)}kts)`);
        console.log('   AUTO-LOAD:', onGround ? '✅ WOULD TRIGGER' : '⚠️  CONDITIONS NOT MET');

        // Test 4: Nearby Airports
        const lat = data.flightData.latitude;
        const lon = data.flightData.longitude;

        console.log('\n🛫 4. Nearby Airports (10nm radius):');
        const airportResp = await fetch(
            `http://localhost:8080/api/navdb/nearby/airports?lat=${lat}&lon=${lon}&range=10&limit=5`
        );

        if (!airportResp.ok) {
            console.log('   ❌ Failed to query airports:', airportResp.status);
            return;
        }

        const airportData = await airportResp.json();
        const airports = airportData.items || airportData;

        if (airports.length === 0) {
            console.log('   ⚠️  No airports found within 10nm');
        } else {
            airports.forEach((apt, i) => {
                console.log(`   ${i + 1}. ${apt.icao} - ${apt.name} (${apt.distance?.toFixed(1)}nm)`);
            });

            console.log('\n   📍 Nearest:', airports[0].icao, 'at', airports[0].distance?.toFixed(1), 'nm');

            if (onGround) {
                console.log(`   ✅ WOULD AUTO-LOAD: ${airports[0].icao}`);
            } else {
                console.log(`   ℹ️  Would load ${airports[0].icao} when on ground`);
            }
        }

        // Test 5: Check GTN750 Page
        console.log('\n📄 5. GTN750 Widget Status:');
        const gtnResp = await fetch('http://localhost:8080/ui/gtn750/');
        console.log('   GTN750 accessible:', gtnResp.ok ? '✅ YES' : '❌ NO');

        // Test 6: Check SafeTaxi Page Module
        console.log('\n🔧 6. SafeTaxi Module Status:');
        const taxiResp = await fetch('http://localhost:8080/ui/gtn750/pages/page-taxi.js');
        if (taxiResp.ok) {
            const code = await taxiResp.text();
            const hasApiFixl = code.includes('data.items || data');
            const hasAutoLoad = code.includes('autoLoadNearestAirport');
            const hasGroundDetection = code.includes('agl < 50') && code.includes('groundSpeed < 5');

            console.log('   API format fix:', hasApiFixl ? '✅ Deployed' : '❌ Missing');
            console.log('   Auto-load method:', hasAutoLoad ? '✅ Present' : '❌ Missing');
            console.log('   Ground detection:', hasGroundDetection ? '✅ Active' : '❌ Missing');
        } else {
            console.log('   ❌ SafeTaxi module not accessible');
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary:');
        console.log('='.repeat(60));
        console.log('✅ Server running and accessible');
        console.log(data.connected ? '✅ MSFS connected' : '❌ MSFS not connected');
        console.log(data.flightData ? '✅ Flight data available' : '❌ No flight data');
        console.log(airports.length > 0 ? `✅ Found ${airports.length} nearby airports` : '❌ No airports found');
        console.log(onGround ? '✅ Auto-load would trigger NOW' : 'ℹ️  Auto-load ready (waiting for ground conditions)');

        console.log('\n💡 Next Steps:');
        if (!onGround) {
            console.log('   1. Land the aircraft or reduce speed to <5kts on ground');
            console.log('   2. Open GTN750: http://localhost:8080/ui/gtn750/');
            console.log('   3. Stay on MAP page (not TAXI)');
            console.log('   4. Watch for auto-load in console');
            console.log('   5. Switch to TAXI page - diagram should be loaded!');
        } else {
            console.log('   1. Open GTN750: http://localhost:8080/ui/gtn750/');
            console.log('   2. Open browser console (F12)');
            console.log(`   3. Auto-load should trigger for ${airports[0]?.icao}`);
            console.log('   4. Switch to TAXI page to see diagram!');
        }

    } catch (e) {
        console.log('\n❌ Test Error:', e.message);
        console.log('   Stack:', e.stack);
    }
};

test();
