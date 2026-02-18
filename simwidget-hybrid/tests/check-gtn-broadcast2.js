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

    ws.on('open', () => {
        send([
            'JSON.stringify({',
            '  exists: typeof gtn750 !== "undefined",',
            '  hasSyncChannel: !!(gtn750 && gtn750.syncChannel),',
            '  hasBroadcastInterval: !!(gtn750 && gtn750._navBroadcastInterval),',
            '  lastBroadcast: gtn750 && gtn750._lastNavBroadcast,',
            '  wsReady: gtn750 && gtn750._wsReady,',
            '})'
        ].join(''));
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (!msg.id) return;

        if (msg.id === 1) {
            try {
                const v = JSON.parse(msg.result.result.value);
                console.log('GTN750 instance:', v);
                // Now trigger a manual broadcast to see if SafeChannel works
                send('gtn750 && gtn750._broadcastNavState ? (gtn750._broadcastNavState(), "broadcast triggered") : "no _broadcastNavState method"');
            } catch(e) {
                console.log('Error:', msg.result && msg.result.result && msg.result.result.value);
                ws.close();
            }
        } else if (msg.id === 2) {
            console.log('Manual broadcast result:', msg.result && msg.result.result && msg.result.result.value);
            ws.close();
        }
    });
    ws.on('error', e => { console.log('WS error:', e.message); });
}
main().catch(e => console.log('Error:', e.message));
