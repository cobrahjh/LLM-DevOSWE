const http = require('http');
const WebSocket = require('ws');
function get(url) {
    return new Promise((resolve,reject) => {
        http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error',reject);
    });
}
async function main() {
    const tabs = await get('http://localhost:9222/json');
    const aiTab = tabs.find(t => t.url.includes('ai-autopilot'));
    if (!aiTab) { console.log('AI Autopilot tab not found'); return; }
    const ws = new WebSocket(aiTab.webSocketDebuggerUrl);
    ws.on('open', () => {
        ws.send(JSON.stringify({
            id: 1, method: 'Runtime.evaluate',
            params: {
                expression: 'JSON.stringify({ ts: widget._navState && widget._navState.timestamp, age: widget._navState ? Date.now()-(widget._navState.timestamp||0) : null, hasCdi: !!(widget._navState && widget._navState.cdi), broadcastCount: widget._navBroadcastCount })',
                returnByValue: true
            }
        }));
    });
    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (!msg.id) return;
        ws.close();
        try {
            const v = JSON.parse(msg.result.result.value);
            console.log('nav-state age:', v.age, 'ms');
            console.log('timestamp:', new Date(v.ts).toISOString());
            console.log('hasCdi:', v.hasCdi);
            console.log('broadcastCount:', v.broadcastCount);
        } catch(e) {
            console.log(msg.result && msg.result.result && msg.result.result.value);
        }
    });
    ws.on('error', e => { console.log('WS error:', e.message); });
}
main().catch(e => console.log('Error:', e.message));
