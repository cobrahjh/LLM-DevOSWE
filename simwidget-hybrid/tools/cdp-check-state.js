// CDP check state — evaluate AI autopilot internal state on harold-pc
// Usage: node tools/cdp-check-state.js [host]
const WebSocket = require('ws');
const http = require('http');

const HOST = process.argv[2] || '192.168.1.42';

const expr = `
(function() {
    const w = window.widget;
    if (!w) return JSON.stringify({error: 'no widget'});
    const d = w._lastFlightData || {};
    const q = w.commandQueue;
    return JSON.stringify({
        phase: w.flightPhase?.phase,
        subPhase: w.ruleEngine?.getTakeoffSubPhase(),
        ai: w.aiEnabled,
        autoCtrl: w._autoControlsEnabled,
        alt: Math.round(d.altitude || 0),
        agl: Math.round(d.altitudeAGL || 0),
        spd: Math.round(d.speed || 0),
        vs: Math.round(d.verticalSpeed || 0),
        thr: Math.round(d.throttle || 0),
        bank: Math.round(d.bank || 0),
        pitch: Math.round((d.pitch || 0) * 10) / 10,
        hdg: Math.round(d.heading || 0),
        ap: d.apMaster,
        apHdg: d.apHeadingLock,
        apVs: d.apVsHold,
        apAlt: d.apAltLock,
        cruiseAlt: w.flightPhase?.targetCruiseAlt,
        bankCorr: w.ruleEngine?._bankCorrectionActive,
        spdCorr: w.ruleEngine?._speedCorrectionActive,
        terrainAlert: w.ruleEngine?.getTerrainAlert(),
        last8: q?._log?.slice(0, 8).map(function(e) { return e.description; })
    });
})()
`;

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get(`http://${HOST}:9222/json`, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    const targets = await getTargets();
    const page = targets.find(t => t.url.includes('ai-autopilot'));
    if (!page) { console.error('Page not found'); process.exit(1); }

    const wsUrl = page.webSocketDebuggerUrl.replace('127.0.0.1', HOST);
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression: expr }
        }));
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 1) {
            const r = msg.result?.result;
            if (r?.type === 'string') {
                try {
                    const obj = JSON.parse(r.value);
                    console.log(JSON.stringify(obj, null, 2));
                } catch(e) {
                    console.log(r.value);
                }
            } else {
                console.log(JSON.stringify(r));
            }
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
    setTimeout(() => { console.error('Timeout'); ws.close(); process.exit(1); }, 5000);
}

run().catch(e => { console.error(e); process.exit(1); });
