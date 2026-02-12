const ws = require('ws');
const c = new ws('ws://127.0.0.1:9223/devtools/page/B116763D862F0DC7005EBA2201DB0DF7');
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
    let foundAirborne = false;
    for (let i = 0; i < 30; i++) {
        const expr = `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            valNav: document.getElementById('valNav')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,8).map(e=>e.textContent)
        })`;
        const r = await send('Runtime.evaluate', { expression: expr });
        const s = JSON.parse(r.result?.result?.value || '{}');
        const phase = s.phase || '';
        console.log(`[${i}] ${phase} | hdg: ${s.hdg} | nav: ${s.valNav}`);
        if (s.log) s.log.slice(0, 5).forEach(l => console.log('    ' + l));
        
        if (phase.includes('CLIMB') || phase.includes('CRUISE')) {
            if (!foundAirborne) {
                foundAirborne = true;
                console.log('--- AIRBORNE! Waiting 8s for nav commands ---');
                await new Promise(r => setTimeout(r, 8000));
                continue;
            } else {
                console.log('--- DONE ---');
                break;
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
