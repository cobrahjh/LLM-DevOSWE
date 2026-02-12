const ws = require('ws');
const c = new ws('ws://127.0.0.1:9223/devtools/browser/2f17ace1-31d9-472c-a4af-a5dd4d0e78f5');
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
    // Create new tab with GTN750
    const result = await send('Target.createTarget', { url: 'http://192.168.1.42:8080/ui/gtn750/' });
    console.log('Created GTN750 tab:', JSON.stringify(result));
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
