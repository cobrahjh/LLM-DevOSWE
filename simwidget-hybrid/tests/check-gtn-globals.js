const http = require('http');
const WebSocket = require('ws');
function get(url) {
    return new Promise((resolve,reject) => {
        http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error',reject);
    });
}
async function main() {
    const tabs = await get('http://localhost:9222/json');
    const gtnTab = tabs.find(t => t.url.includes('gtn750'));
    if (!gtnTab) { console.log('GTN750 tab not found'); return; }
    const ws = new WebSocket(gtnTab.webSocketDebuggerUrl);
    let mid = 1;
    const send = (expr) => ws.send(JSON.stringify({ id: mid++, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    const results = {};

    ws.on('open', () => {
        // Check document readyState, URL, and common widget variable names
        send('JSON.stringify({ ready: document.readyState, url: location.href, title: document.title })');
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (!msg.id) return;

        if (msg.id === 1) {
            try { console.log('Page state:', JSON.parse(msg.result.result.value)); } catch(e) { console.log(msg.result.result.value); }
            // Check for widget vars
            send('JSON.stringify({ widget: typeof widget, pane: typeof pane, gtn: typeof gtn, GTN750Pane: typeof GTN750Pane, app: typeof app, simglass: typeof simglass })');
        } else if (msg.id === 2) {
            try { console.log('Globals:', JSON.parse(msg.result.result.value)); } catch(e) { console.log(msg.result.result.value); }
            // Get console errors
            send('window.__errors ? JSON.stringify(window.__errors) : "no __errors"');
        } else if (msg.id === 3) {
            console.log('Errors:', msg.result.result.value);
            ws.close();
        }
    });
    ws.on('error', e => { console.log('WS error:', e.message); });
}
main().catch(e => console.log('Error:', e.message));
