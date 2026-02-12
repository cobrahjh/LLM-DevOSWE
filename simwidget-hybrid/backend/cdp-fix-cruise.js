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
    const r = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            // Fix cruise alt — correct property name
            if (w.ruleEngine) {
                w.ruleEngine._targetCruiseAlt = 11000;
                w.ruleEngine._lastCommands = {};
            }
            if (w.flightPhase) {
                w.flightPhase.targetCruiseAlt = 11000;
            }
            return 'Fixed: _targetCruiseAlt=11000, getCruiseAlt=' + (w.ruleEngine._getCruiseAlt ? w.ruleEngine._getCruiseAlt() : 'N/A');
        })()
    ` });
    console.log(r.result?.result?.value);
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
