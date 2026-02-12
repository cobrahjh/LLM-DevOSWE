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
    // Check what URL the advisor is using
    const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
        origin: window.location.origin,
        advisorPort: window._pane?.llmAdvisor?.serverPort,
        advisorError: document.querySelector('.advisory-content')?.textContent
    })` });
    console.log(JSON.parse(r.result?.result?.value || '{}'));

    // Check if the advisor endpoint is accessible from the browser's perspective
    const r2 = await send('Runtime.evaluate', { expression: `
        fetch(window.location.origin + '/api/ai-pilot/advisory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test' })
        }).then(r => r.status + ' ' + r.statusText).catch(e => 'ERROR: ' + e.message)
    `, awaitPromise: true });
    console.log('Advisory endpoint test:', r2.result?.result?.value);

    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
