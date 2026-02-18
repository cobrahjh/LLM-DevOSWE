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
    ws.on('open', () => {
        // Check GTN750 broadcast state and trigger a manual broadcast check
        ws.send(JSON.stringify({
            id: 1, method: 'Runtime.evaluate',
            params: {
                expression: [
                    'JSON.stringify({',
                    '  hasSyncChannel: !!(typeof widget !== "undefined" && widget.syncChannel),',
                    '  broadcastInterval: !!(typeof widget !== "undefined" && widget._navBroadcastInterval),',
                    '  navStateTs: typeof widget !== "undefined" && widget._flightPlan ? "hasFlightPlan" : "noFlightPlan",',
                    '  lastBroadcast: typeof widget !== "undefined" && widget._lastNavBroadcast,',
                    '  widgetReady: typeof widget !== "undefined",',
                    '})'
                ].join(''),
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
            console.log('GTN750 syncChannel:', v.hasSyncChannel);
            console.log('GTN750 navBroadcastInterval:', v.broadcastInterval);
            console.log('GTN750 flightPlan:', v.navStateTs);
            console.log('GTN750 lastBroadcast:', v.lastBroadcast);
            console.log('GTN750 widgetReady:', v.widgetReady);
        } catch(e) {
            console.log('raw:', msg.result && msg.result.result && msg.result.result.value);
        }
    });
    ws.on('error', e => { console.log('WS error:', e.message); });
}
main().catch(e => console.log('Error:', e.message));
