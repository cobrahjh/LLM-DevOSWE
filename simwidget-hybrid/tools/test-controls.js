// Test if controls affect FLIGHT DYNAMICS (not just animation)
// Sends command, waits, reads pitch/bank to see if they changed
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:8080');

let flightData = null;

ws.on('open', async () => {
    console.log('Connected. Waiting for flight data...\n');
    await new Promise(r => setTimeout(r, 2000));

    if (!flightData) { console.log('No flight data received'); ws.close(); return; }

    const startPitch = flightData.pitch;
    const startBank = flightData.bank;
    console.log(`Starting: pitch=${startPitch?.toFixed(1)}° bank=${startBank?.toFixed(1)}°\n`);

    // Test 1: Elevator via InputEvent (AXIS_ELEVATOR_SET → UNKNOWN_TAIL_ELEVATOR)
    console.log('>>> TEST 1: AXIS_ELEVATOR_SET +80 (InputEvent elevator)');
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_ELEVATOR_SET', value: 80 }));
    await new Promise(r => setTimeout(r, 3000));
    console.log(`  Result: pitch=${flightData.pitch?.toFixed(1)}° (was ${startPitch?.toFixed(1)}°) Δ=${(flightData.pitch - startPitch).toFixed(1)}°`);
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_ELEVATOR_SET', value: 0 }));
    await new Promise(r => setTimeout(r, 2000));

    const mid1Pitch = flightData.pitch;
    const mid1Bank = flightData.bank;

    // Test 2: Ailerons via InputEvent (AXIS_AILERONS_SET → UNKNOWN_AILERON_LEFT/RIGHT)
    console.log('\n>>> TEST 2: AXIS_AILERONS_SET +80 (InputEvent ailerons)');
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_AILERONS_SET', value: 80 }));
    await new Promise(r => setTimeout(r, 3000));
    console.log(`  Result: bank=${flightData.bank?.toFixed(1)}° (was ${mid1Bank?.toFixed(1)}°) Δ=${(flightData.bank - mid1Bank).toFixed(1)}°`);
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_AILERONS_SET', value: 0 }));
    await new Promise(r => setTimeout(r, 2000));

    // Test 3: Rudder via RUDDER_SET (known working)
    console.log('\n>>> TEST 3: RUDDER_SET +80 (legacy rudder - baseline)');
    const startHdg = flightData.heading;
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_RUDDER_SET', value: 80 }));
    await new Promise(r => setTimeout(r, 3000));
    console.log(`  Result: hdg=${flightData.heading?.toFixed(1)}° (was ${startHdg?.toFixed(1)}°) Δ=${(flightData.heading - startHdg).toFixed(1)}°`);
    ws.send(JSON.stringify({ type: 'command', command: 'AXIS_RUDDER_SET', value: 0 }));

    console.log('\n=== SUMMARY ===');
    console.log('If Δ pitch changed → elevator InputEvent affects flight dynamics');
    console.log('If Δ bank changed → aileron InputEvent affects flight dynamics');
    console.log('If Δ heading changed → rudder RUDDER_SET affects flight dynamics');

    await new Promise(r => setTimeout(r, 1000));
    ws.close();
    process.exit(0);
});

ws.on('message', msg => {
    try {
        const d = JSON.parse(msg);
        if (d.type === 'flightData' && d.data) flightData = d.data;
    } catch (e) {}
});

ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
