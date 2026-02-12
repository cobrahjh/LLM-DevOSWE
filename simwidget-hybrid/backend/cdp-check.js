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
        phase: document.getElementById('phase-name')?.textContent,
        hdg: document.getElementById('target-hdg')?.textContent,
        alt: document.getElementById('target-alt')?.textContent,
        spd: document.getElementById('target-spd')?.textContent,
        valNav: document.getElementById('valNav')?.textContent,
        aiEnabled: document.querySelector('.ai-toggle')?.classList?.contains('active'),
        log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,10).map(e=>e.textContent)
    })` });
    const s = JSON.parse(r.result?.result?.value || '{}');
    console.log(JSON.stringify(s, null, 2));
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
