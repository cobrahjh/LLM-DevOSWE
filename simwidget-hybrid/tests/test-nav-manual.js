/**
 * Nav Guidance Integration Tests — server-side
 * node tests/test-nav-manual.js
 */
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const { BASE_URL } = require('./config');

let passed = 0, failed = 0;
const p = (n, d) => { passed++; console.log(`  \x1b[32m✓\x1b[0m ${n}${d ? ' \x1b[90m' + d + '\x1b[0m' : ''}`); };
const f = (n, d) => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? ' \x1b[90m' + d + '\x1b[0m' : ''}`); };

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`${BASE_URL}${path}`, res => {
            let b = ''; res.on('data', c => b += c);
            res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(b) }); } catch { resolve({ s: res.statusCode, d: b }); } });
        }).on('error', reject);
    });
}

function post(path, body) {
    return new Promise(resolve => {
        const payload = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 8080, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ s: res.statusCode, d: b })); });
        req.write(payload); req.end();
    });
}

function intercept(dtk, xtrk, toFrom) {
    if (toFrom === 'FROM' || toFrom === 2) return dtk;
    const abs = Math.abs(xtrk);
    let a = 0;
    if (abs < 0.1) a = 0;
    else if (abs < 0.3) a = 10;
    else if (abs <= 1.0) a = 10 + (abs - 0.3) / 0.7 * 20;
    else a = 30;
    const c = xtrk > 0 ? -a : a;
    return ((dtk + c) % 360 + 360) % 360;
}

(async () => {
    console.log('\x1b[36m\n── Unit: intercept heading math ──\x1b[0m');
    intercept(275, 0.05, 'TO') === 275 ? p('on course → no correction', 'HDG 275°') : f('on course');
    intercept(275, 0.2, 'TO') === 265  ? p('0.2nm right → 10° left → HDG 265°') : f('slight correction');
    intercept(275, 1.5, 'TO') === 245  ? p('1.5nm right → max 30° → HDG 245°') : f('max correction', `got ${intercept(275,1.5,'TO')}`);
    intercept(275, -0.5, 'TO') > 275   ? p('0.5nm left → right correction') : f('left correction');
    intercept(275, 2.0, 2) === 275     ? p('toFrom=2 (SimConnect FROM) → no correction') : f('toFrom=2 fix');
    intercept(275, 2.0, 'FROM') === 275? p('toFrom=FROM (string) → no correction') : f('toFrom=FROM string');
    intercept(350, 1.5, 'TO') === 320  ? p('wrap-around: DTK 350° - 30° = 320°') : f('wrap-around', `got ${intercept(350,1.5,'TO')}`);

    console.log('\x1b[36m\n── Unit: NAV/HDG mode switching ──\x1b[0m');
    const shouldNav = (nav) => {
        if (!nav || !nav.cdi) return false;
        if (!nav.cdi.source) return false;
        const toFrom = nav.cdi.toFrom;
        if (toFrom === 'FROM' || toFrom === 2) return false;
        if (Math.abs(nav.cdi.xtrk || 0) > 2.0) return false;
        return true;
    };
    shouldNav({ cdi: { source: 'GPS', xtrk: 0.1, toFrom: 'TO' } })  ? p('XTRK=0.1nm, TO → NAV mode') : f('XTRK=0.1 TO');
    shouldNav({ cdi: { source: 'GPS', xtrk: 0.1, toFrom: 1 } })      ? p('toFrom=1 (SimConnect TO) → NAV mode') : f('toFrom=1 TO');
    !shouldNav({ cdi: { source: 'GPS', xtrk: 2.1, toFrom: 'TO' } })  ? p('XTRK=2.1nm → HDG mode') : f('XTRK 2.1 threshold');
    !shouldNav({ cdi: { source: 'GPS', xtrk: 0.1, toFrom: 2 } })     ? p('toFrom=2 (FROM) → HDG mode') : f('toFrom=2 FROM mode');
    !shouldNav({ cdi: { source: null, xtrk: 0.1, toFrom: 'TO' } })   ? p('no CDI source → HDG mode') : f('null source');
    !shouldNav(null)                                                   ? p('null nav → HDG mode (graceful)') : f('null nav');

    console.log('\x1b[36m\n── Source: rule-engine-core.js ──\x1b[0m');
    const core = fs.readFileSync('./ui/ai-autopilot/modules/rule-engine-core.js', 'utf8');
    core.includes('getNavGuidance()') ? p('getNavGuidance() method defined') : f('getNavGuidance() missing');
    core.includes('interceptHdg')     ? p('interceptHdg field returned') : f('interceptHdg missing');
    core.includes('navMode')          ? p('navMode field returned') : f('navMode missing');
    core.includes('toFrom === 2')     ? p('toFrom=2 (numeric FROM) handled') : f('toFrom=2 fix missing');
    core.includes('toFrom === \'FROM\'') ? p('toFrom=FROM (string) handled') : f('toFrom string missing');

    console.log('\x1b[36m\n── API: endpoints ──\x1b[0m');
    let r = await get('/api/status');
    r.s === 200 ? p('GET /api/status → 200') : f('GET /api/status', `HTTP ${r.s}`);
    const fd = r.d.flightData;
    (fd && fd.gpsWpCount > 0) ? p('GPS flight plan active', `${fd.gpsWpCount} waypoints`) : f('GPS flight plan');
    (fd && fd.gpsCrossTrackError != null) ? p('XTRK streaming', `${fd.gpsCrossTrackError.toFixed(2)}nm`) : f('XTRK null');
    (fd && fd.gpsDesiredTrack != null) ? p('DTK streaming', `${fd.gpsDesiredTrack}°`) : f('DTK null');
    (fd && fd.apMaster != null) ? p('AP master state', fd.apMaster ? 'ON' : 'OFF') : f('AP master missing');

    r = await get('/api/ai-pilot/status');
    r.s === 200 ? p('GET /api/ai-pilot/status → 200', `phase: ${r.d.phase}`) : f('ai-pilot/status', `HTTP ${r.s}`);

    // shared-state: airport key (was 400 before fix)
    const pr = await post('/api/ai-pilot/shared-state', { key: 'airport', data: { icao: 'KORD', distance: 2.1 } });
    pr.s === 200 ? p('POST shared-state key=airport → 200 (fixed from 400)') : f('shared-state airport', `HTTP ${pr.s}`);

    // shared-state: tuning key
    const pr2 = await post('/api/ai-pilot/shared-state', { key: 'tuning', data: { vrSpeed: 55 } });
    pr2.s === 200 ? p('POST shared-state key=tuning → 200') : f('shared-state tuning', `HTTP ${pr2.s}`);

    // shared-state: invalid key still rejected
    const pr3 = await post('/api/ai-pilot/shared-state', { key: 'invalid', data: {} });
    pr3.s === 400 ? p('POST shared-state key=invalid → 400 (correctly rejected)') : f('invalid key not rejected', `HTTP ${pr3.s}`);

    r = await get('/ui/gtn750/');      r.s === 200 ? p('GTN750 widget accessible') : f('GTN750 widget', `HTTP ${r.s}`);
    r = await get('/ui/ai-autopilot/'); r.s === 200 ? p('AI Autopilot widget accessible') : f('AI Autopilot widget', `HTTP ${r.s}`);
    r = await get('/ui/ai-autopilot/browser-console-test.js');
    r.s === 200 ? p('browser-console-test.js served') : f('browser-console-test.js', `HTTP ${r.s}`);

    console.log('\x1b[36m\n── WebSocket: live GPS nav stream ──\x1b[0m');
    await new Promise(resolve => {
        const ws = new WebSocket(BASE_URL.replace('http', 'ws'));
        let n = 0;
        const timer = setTimeout(() => { ws.close(); f('WS timeout — no data in 6s'); resolve(); }, 6000);
        ws.on('open', () => p('WebSocket connected'));
        ws.on('message', raw => {
            try {
                const m = JSON.parse(raw);
                if (m.type === 'flightData' && ++n === 5) {
                    clearTimeout(timer); ws.close();
                    const d = m.data;
                    (d.gpsWpCount > 0) ? p('GPS plan active in WS stream', `${d.gpsWpCount} waypoints`) : f('GPS plan in WS');
                    (d.gpsCrossTrackError != null) ? p('XTRK in WS', `${d.gpsCrossTrackError.toFixed(2)}nm`) : f('XTRK in WS');
                    (d.gpsDesiredTrack != null) ? p('DTK in WS', `${d.gpsDesiredTrack}°`) : f('DTK in WS');
                    (d.gpsWpBearing != null) ? p('WP bearing in WS', `${Math.round(d.gpsWpBearing)}°`) : f('WP bearing in WS');
                    (d.gpsWpDistance != null) ? p('WP distance in WS', `${d.gpsWpDistance.toFixed(1)}nm`) : f('WP distance in WS');
                    resolve();
                }
            } catch (e) { f('WS parse', e.message); }
        });
        ws.on('error', e => { clearTimeout(timer); f('WS error', e.message); resolve(); });
    });

    console.log('\n\x1b[36m════════════════════════════════════════\x1b[0m');
    console.log(`${failed === 0 ? '\x1b[32m' : '\x1b[31m'}  Passed: ${passed}  Failed: ${failed}\x1b[0m`);
    if (failed === 0) {
        console.log('\x1b[32m✅ All server-side tests passed!\x1b[0m');
    }
    console.log('\x1b[33m\n📋 Browser (AI Autopilot console):\x1b[0m');
    console.log("  fetch('/ui/ai-autopilot/browser-console-test.js').then(r=>r.text()).then(eval)");
})();
