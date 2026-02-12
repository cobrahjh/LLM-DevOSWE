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
    // Sample every 3 seconds for 30 seconds to see nav guidance evolution
    for (let i = 0; i < 10; i++) {
        const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            valNav: document.getElementById('valNav')?.textContent,
            navGuidance: window._pane?.ruleEngine?.getNavGuidance?.() || 'no method',
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,5).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r.result?.result?.value || '{}');
        console.log(`[${i}] phase=${s.phase} hdg=${s.hdg} nav=${s.valNav}`);
        if (s.navGuidance && typeof s.navGuidance === 'object') {
            const g = s.navGuidance;
            console.log(`    wp=${g.wpIdent} dist=${g.wpDist}nm dtk=${g.dtk} xtrk=${g.xtrk} navMode=${g.navMode} intercept=${g.interceptHdg}`);
        }
        if (s.log) s.log.slice(0, 3).forEach(l => console.log('    cmd: ' + l));
        await new Promise(r => setTimeout(r, 3000));
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
