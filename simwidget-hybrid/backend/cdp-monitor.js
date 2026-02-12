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
    let climbSeen = 0;
    for (let i = 0; i < 60; i++) {
        const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            alt: document.getElementById('target-alt')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,5).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r.result?.result?.value || '{}');
        const phase = s.phase || '';
        console.log(`[${i}] ${phase} | hdg=${s.hdg} alt=${s.alt}`);
        if (s.log) s.log.slice(0, 3).forEach(l => console.log('    ' + l));

        if (phase.includes('CLIMB') || phase.includes('CRUISE')) {
            climbSeen++;
            if (climbSeen >= 5) {
                console.log('--- Airborne and stable, done ---');
                break;
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
