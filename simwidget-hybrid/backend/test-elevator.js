/**
 * test-elevator.js — Find ANY method that moves elevator in MSFS 2024
 * Tests: legacy axis event, rapid trim, AP pitch, continuous commands
 */
const http = require('http');
const host = process.argv[2] || '192.168.1.42';
const port = 8080;

function api(method, path, body) {
    return new Promise((resolve, reject) => {
        const opts = { hostname: host, port, path, method, headers: { 'Content-Type': 'application/json' } };
        const req = http.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getState() {
    const s = await api('GET', '/api/status');
    const fd = s.flightData || {};
    return {
        elev: fd.elevatorPos?.toFixed(4),
        yoke: fd.yokeY?.toFixed(4),
        pitch: fd.pitch?.toFixed(2),
        rudder: fd.rudderPos?.toFixed(4),
        aileron: fd.aileronPos?.toFixed(4),
        apMaster: fd.apMaster,
        gs: fd.groundSpeed?.toFixed(1)
    };
}

async function sendCmd(command, value) {
    return api('POST', '/api/command', { command, value });
}

async function show(label) {
    const s = await getState();
    console.log(`  [${label}] elev=${s.elev} yoke=${s.yoke} rud=${s.rudder} ail=${s.aileron} pitch=${s.pitch} AP=${s.apMaster}`);
    return s;
}

async function main() {
    console.log(`Finding elevator control — ${host}:${port}\n`);

    await show('baseline');

    // ── Test 1: AXIS_ELEVATOR_SET via legacy transmitClientEvent (not InputEvent) ──
    // Add a new command that bypasses the InputEvent intercept
    console.log('\n── 1: AXIS_ELEVATOR_SET_LEGACY (bypass InputEvent) ──');
    await sendCmd('AXIS_ELEVATOR_SET_LEGACY', -80);
    await sleep(800);
    await show('after -80');
    await sendCmd('AXIS_ELEVATOR_SET_LEGACY', 80);
    await sleep(800);
    await show('after +80');
    await sendCmd('AXIS_ELEVATOR_SET_LEGACY', 0);
    await sleep(800);
    await show('after 0');

    // ── Test 2: Rapid-fire ELEV_TRIM_UP (50 times, 50ms apart) ──
    console.log('\n── 2: 50x ELEV_TRIM_UP rapid-fire ──');
    await show('before');
    for (let i = 0; i < 50; i++) {
        await sendCmd('ELEV_TRIM_UP', 0);
        await sleep(50);
    }
    await sleep(500);
    await show('after 50x trim up');
    // Reset
    for (let i = 0; i < 50; i++) {
        await sendCmd('ELEV_TRIM_DN', 0);
        await sleep(50);
    }
    await sleep(500);
    await show('after 50x trim dn');

    // ── Test 3: AP pitch hold ──
    console.log('\n── 3: AP_MASTER + AP_VS_HOLD + VS +500 ──');
    await sendCmd('AP_MASTER', 0);
    await sleep(500);
    await sendCmd('AP_VS_HOLD', 0);
    await sleep(300);
    await sendCmd('AP_VS_VAR_SET_ENGLISH', 500);
    await sleep(1500);
    await show('AP VS +500');
    await sendCmd('AP_MASTER', 0);  // toggle off
    await sleep(500);
    await show('AP off');

    // ── Test 4: Continuous elevator commands at high rate ──
    console.log('\n── 4: Continuous ELEVATOR_SET -10000 for 3 seconds ──');
    const start = Date.now();
    let count = 0;
    while (Date.now() - start < 3000) {
        await sendCmd('ELEVATOR_SET', -10000);
        count++;
        await sleep(30);
    }
    console.log(`  Sent ${count} commands in 3s`);
    await show('after spam');
    await sendCmd('ELEVATOR_SET', 0);

    // ── Test 5: CENTER_AILER_RUDDER ──
    console.log('\n── 5: CENTER_AILER_RUDDER ──');
    await sendCmd('CENTER_AILER_RUDDER', 0);
    await sleep(500);
    await show('after center');

    console.log('\n' + '═'.repeat(70));
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
