// Test voice humanizer via CDP
const WebSocket = require('ws');
const http = require('http');
const HOST = process.argv[2] || '127.0.0.1';

const expr = `
(function() {
    const w = window.widget;
    if (!w) return JSON.stringify({error: 'no widget'});
    const d = w._lastFlightData || {};
    const test1 = w._humanizeSpeech('AP ALT hold, AP HDG, setting SPD to 74 kts');
    const test2 = w._humanizeSpeech('AP_VS_VAR_SET 700 fpm, AP_SPD_VAR_SET 74');
    const test3 = w._humanizeSpeech('VS +700, NM to destination, TAWS alert');
    const test4 = w._humanizeSpeech('AP_HDG_HOLD engaged, AP_ALT_HOLD at 8500');
    return JSON.stringify({
        phase: w.flightPhase ? w.flightPhase.phase : null,
        alt: Math.round(d.altitude || 0),
        agl: Math.round(d.altitudeAGL || 0),
        spd: Math.round(d.speed || 0),
        vs: Math.round(d.verticalSpeed || 0),
        ap: d.apMaster,
        test1: test1,
        test2: test2,
        test3: test3,
        test4: test4
    });
})()
`;

http.get(`http://${HOST}:9222/json`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const targets = JSON.parse(data);
        const page = targets.find(t => t.url.includes('ai-autopilot'));
        if (!page) { console.error('Page not found'); process.exit(1); }
        const wsUrl = page.webSocketDebuggerUrl.replace('127.0.0.1', HOST);
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr } }));
        });
        ws.on('message', raw => {
            const msg = JSON.parse(raw);
            if (msg.id === 1) {
                try { console.log(JSON.stringify(JSON.parse(msg.result.result.value), null, 2)); }
                catch(e) { console.log(msg.result.result.value); }
                ws.close(); process.exit(0);
            }
        });
        ws.on('error', e => { console.error(e.message); process.exit(1); });
        setTimeout(() => process.exit(1), 5000);
    });
}).on('error', e => { console.error(e.message); process.exit(1); });
