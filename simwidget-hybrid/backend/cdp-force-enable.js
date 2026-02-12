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
    // Check what buttons exist
    const r0 = await send('Runtime.evaluate', { expression: `JSON.stringify({
        toggles: Array.from(document.querySelectorAll('button, .toggle, [class*=toggle]')).map(e => ({
            tag: e.tagName,
            class: e.className,
            text: e.textContent?.trim()?.slice(0,30),
            id: e.id
        })),
        wsState: window.widget?.ws?.readyState,
        hasWidget: !!window.widget,
        methods: window.widget ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.widget)).filter(k => k.includes('ai') || k.includes('AI') || k.includes('enable') || k.includes('toggle')) : []
    })` });
    const state = JSON.parse(r0.result?.result?.value || '{}');
    console.log('Toggles:', JSON.stringify(state.toggles, null, 2));
    console.log('WS:', state.wsState, 'Widget:', state.hasWidget);
    console.log('Methods:', state.methods);

    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
