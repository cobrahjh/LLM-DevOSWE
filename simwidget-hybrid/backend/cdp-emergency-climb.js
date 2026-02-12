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
    // Set cruise altitude to 10000 via window.widget
    const r = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            // Update cruise alt
            if (w.flightPhase) {
                w.flightPhase.setCruiseAlt(10000);
                w.flightPhase.targetCruiseAlt = 10000;
            }
            // Update rule engine
            if (w.ruleEngine) {
                w.ruleEngine._cruiseAlt = 10000;
                w.ruleEngine._lastCommands = {};
            }
            // Force back to CLIMB
            if (w.flightPhase) {
                w.flightPhase._manualPhase = false;
                w.flightPhase.phase = 'CLIMB';
                w.flightPhase.phaseIndex = 3;
                w.flightPhase._phaseEntryTime = Date.now();
            }
            return 'OK: cruise=10000, phase=CLIMB, dedup cleared';
        })()
    ` });
    console.log('Result:', r.result?.result?.value);

    // Monitor for 12 seconds
    for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const r2 = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            alt: document.getElementById('target-alt')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,3).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r2.result?.result?.value || '{}');
        console.log(`[${i}] phase=${s.phase} alt=${s.alt} | ${s.log?.join(' | ')}`);
    }

    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
