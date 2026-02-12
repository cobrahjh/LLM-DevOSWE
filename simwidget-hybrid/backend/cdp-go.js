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
    // Click AI toggle ON
    const r1 = await send('Runtime.evaluate', { expression: `
        (function() {
            const btn = document.getElementById('ai-toggle');
            if (btn) { btn.click(); return 'clicked ai-toggle, text now: ' + btn.textContent; }
            return 'ai-toggle not found';
        })()
    ` });
    console.log('AI:', r1.result?.result?.value);

    await new Promise(r => setTimeout(r, 500));

    // Click auto controls ON
    const r2 = await send('Runtime.evaluate', { expression: `
        (function() {
            const btn = document.getElementById('auto-controls-btn');
            if (btn) { btn.click(); return 'clicked auto-controls, text now: ' + btn.textContent; }
            return 'auto-controls not found';
        })()
    ` });
    console.log('Auto:', r2.result?.result?.value);

    await new Promise(r => setTimeout(r, 500));

    // Set cruise alt
    const r3 = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (w?.flightPhase) w.flightPhase.setCruiseAlt(11000);
            if (w?.ruleEngine) w.ruleEngine._targetCruiseAlt = 11000;
            return 'cruise=' + (w?.ruleEngine?._getCruiseAlt?.() || '?') + ' ai=' + w?.aiEnabled + ' auto=' + w?.autoControls;
        })()
    ` });
    console.log('State:', r3.result?.result?.value);

    // Monitor
    let airborne = 0;
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            alt: document.getElementById('target-alt')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,3).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r.result?.result?.value || '{}');
        console.log(`[${i}] ${s.phase} | alt=${s.alt} | ${s.log?.slice(0,2).join(' | ')}`);
        if (s.phase?.includes('CLIMB') || s.phase?.includes('CRUISE')) {
            airborne++;
            if (airborne >= 5) { console.log('--- Stable ---'); break; }
        }
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
