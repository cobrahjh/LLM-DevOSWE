const ws = require('ws');
const c = new ws('ws://127.0.0.1:9223/devtools/page/2FF67CD8F88576410C1B09A26A5CFC91');
let id = 1;
function send(m, p = {}) {
    return new Promise(r => {
        const i = id++;
        c.on('message', function h(d) {
            const msg = JSON.parse(d);
            if (msg.id === i) { c.removeListener('message', h); r(msg); }
        });
        c.send(JSON.stringify({ id: i, method: m, params: p }));
    });
}
c.on('open', async () => {
    const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
        wsConnected: window.widget?.ws?.readyState,
        aiEnabled: window.widget?.aiEnabled,
        autoControls: window.widget?.autoControls,
        phase: window.widget?.flightPhase?.phase,
        cruiseAlt: window.widget?.ruleEngine?._targetCruiseAlt,
        getCruise: window.widget?.ruleEngine?._getCruiseAlt?.(),
        lastData: window.widget?.flightData ? {
            engine: window.widget.flightData.engineRunning,
            throttle: window.widget.flightData.throttle,
            onGround: window.widget.flightData.onGround,
            agl: window.widget.flightData.altitudeAGL,
            gs: window.widget.flightData.groundSpeed
        } : 'no data'
    })` });
    console.log(JSON.stringify(JSON.parse(r.result?.result?.value || '{}'), null, 2));
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
