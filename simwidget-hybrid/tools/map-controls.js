// Map flight control commands to surface positions via SimVar readback
// Tests ELEVATOR_SET, AILERON_SET, RUDDER_SET legacy events (now routed from AXIS_*_SET)
const WebSocket = require('ws');
const http = require('http');
const ws = new WebSocket('ws://192.168.1.42:8080');

function readStatus() {
    return new Promise((resolve, reject) => {
        http.get('http://192.168.1.42:8080/api/status', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d).flightData || JSON.parse(d)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function sendCmd(command, value) {
    ws.send(JSON.stringify({ type: 'command', command, value }));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mapControls() {
    // Read baseline
    let fd = await readStatus();
    console.log(`BASELINE: elevPos=${fd.elevatorPos?.toFixed(2)} ailPos=${fd.aileronPos?.toFixed(2)} rudPos=${fd.rudderPos?.toFixed(2)}`);
    console.log(`          yokeY=${fd.yokeY?.toFixed(2)} yokeX=${fd.yokeX?.toFixed(2)} pitch=${fd.pitch?.toFixed(1)}° bank=${fd.bank?.toFixed(1)}°\n`);

    // First center everything
    sendCmd('CENTER_AILER_RUDDER', 0);
    await sleep(1000);
    fd = await readStatus();
    console.log(`AFTER CENTER: elevPos=${fd.elevatorPos?.toFixed(2)} ailPos=${fd.aileronPos?.toFixed(2)} rudPos=${fd.rudderPos?.toFixed(2)}\n`);

    // === ELEVATOR (AXIS_ELEVATOR_SET → ELEVATOR_SET) ===
    console.log('=== ELEVATOR (AXIS_ELEVATOR_SET → ELEVATOR_SET legacy) ===');
    const elevValues = [-80, -50, -25, 0, 25, 50, 80];
    for (const val of elevValues) {
        sendCmd('AXIS_ELEVATOR_SET', val);
        await sleep(800);
        fd = await readStatus();
        console.log(`  cmd=${val.toString().padStart(4)} → elevPos=${fd.elevatorPos?.toFixed(3).padStart(7)} yokeY=${fd.yokeY?.toFixed(3).padStart(7)} pitch=${fd.pitch?.toFixed(1)}°`);
    }
    sendCmd('AXIS_ELEVATOR_SET', 0);
    await sleep(500);

    // === AILERONS (AXIS_AILERONS_SET → AILERON_SET) ===
    console.log('\n=== AILERONS (AXIS_AILERONS_SET → AILERON_SET legacy) ===');
    for (const val of elevValues) {
        sendCmd('AXIS_AILERONS_SET', val);
        await sleep(800);
        fd = await readStatus();
        console.log(`  cmd=${val.toString().padStart(4)} → ailPos=${fd.aileronPos?.toFixed(3).padStart(7)} yokeX=${fd.yokeX?.toFixed(3).padStart(7)} bank=${fd.bank?.toFixed(1)}°`);
    }
    sendCmd('AXIS_AILERONS_SET', 0);
    await sleep(500);

    // === RUDDER (AXIS_RUDDER_SET → RUDDER_SET) — known working ===
    console.log('\n=== RUDDER (AXIS_RUDDER_SET → RUDDER_SET legacy) ===');
    for (const val of elevValues) {
        sendCmd('AXIS_RUDDER_SET', val);
        await sleep(800);
        fd = await readStatus();
        console.log(`  cmd=${val.toString().padStart(4)} → rudPos=${fd.rudderPos?.toFixed(3).padStart(7)} hdg=${fd.heading?.toFixed(1)}°`);
    }
    sendCmd('AXIS_RUDDER_SET', 0);

    console.log('\nDone.');
    await sleep(1000);
    ws.close();
    process.exit(0);
}

ws.on('open', () => {
    console.log('Connected to harold-pc. Waiting for SimConnect...\n');
    setTimeout(mapControls, 3000);
});

ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
