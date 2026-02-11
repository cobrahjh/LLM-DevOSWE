// CDP check descent state — detailed AP mode debugging
const WebSocket = require('ws');
const http = require('http');
const HOST = process.argv[2] || '127.0.0.1';

const expr = `
(function() {
    const w = window.widget;
    if (!w) return JSON.stringify({error: 'no widget'});
    const d = w._lastFlightData || {};
    const q = w.commandQueue;
    return JSON.stringify({
        phase: w.flightPhase ? w.flightPhase.phase : null,
        ai: w.aiEnabled,
        alt: Math.round(d.altitude || 0),
        agl: Math.round(d.altitudeAGL || 0),
        spd: Math.round(d.speed || 0),
        vs: Math.round(d.verticalSpeed || 0),
        thr: Math.round(d.throttle || 0),
        pitch: Math.round((d.pitch || 0) * 10) / 10,
        apMaster: d.apMaster,
        apAltLock: d.apAltLock,
        apVsHold: d.apVsHold,
        apHdgLock: d.apHeadingLock,
        apNavLock: d.apNavLock,
        apAprLock: d.apAprLock,
        apVsSet: d.apVsSet,
        apAltSet: d.apAltSet,
        spdCorr: w.ruleEngine ? w.ruleEngine._speedCorrectionActive : null,
        envAlert: w.ruleEngine ? w.ruleEngine._envelopeAlert : null,
        flaps: d.flapsIndex,
        last10: q ? q._log.slice(0, 10).map(function(e) { return e.description; }) : []
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
