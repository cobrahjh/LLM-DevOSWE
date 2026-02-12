const ws = require('ws');
const fs = require('fs');
const c = new ws('ws://127.0.0.1:9223/devtools/page/752D09BF400A4597B6E383448CC6DB3D');
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
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) {
        const buf = Buffer.from(r.result.data, 'base64');
        const path = 'C:/Users/Stone-PC/Desktop/gtn750-cruise.png';
        fs.writeFileSync(path, buf);
        console.log('Screenshot saved:', path, '(' + buf.length + ' bytes)');
    } else {
        console.log('Failed:', JSON.stringify(r));
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
