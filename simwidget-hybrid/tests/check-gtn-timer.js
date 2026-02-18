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

    // Also check AI Autopilot nav-state age
    const aiTab = tabs.find(t => t.url.includes('ai-autopilot'));

    const ws = new WebSocket(gtnTab.webSocketDebuggerUrl);
    let mid = 1;
    const send = (expr) => ws.send(JSON.stringify({ id: mid++, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));

    ws.on('open', () => {
        send('JSON.stringify({ timer: !!gtn750._navBroadcastTimer, timerValue: gtn750._navBroadcastTimer })');
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (!msg.id) return;
        if (msg.id === 1) {
            try {
                const v = JSON.parse(msg.result.result.value);
                console.log('GTN750 _navBroadcastTimer active:', v.timer, '(value:', v.timerValue, ')');
            } catch(e) {
                console.log(msg.result && msg.result.result && msg.result.result.value);
            }
            ws.close();
            // Now check AI Autopilot nav-state age
            checkAiNavState(aiTab);
        }
    });
    ws.on('error', e => { console.log('WS error:', e.message); });
}

async function checkAiNavState(aiTab) {
    if (!aiTab) return;
    const ws2 = new WebSocket(aiTab.webSocketDebuggerUrl);
    ws2.on('open', () => {
        ws2.send(JSON.stringify({
            id: 1, method: 'Runtime.evaluate',
            params: {
                expression: 'JSON.stringify({ age: widget._navState ? Date.now() - (widget._navState.timestamp || 0) : null })',
                returnByValue: true
            }
        }));
    });
    ws2.on('message', raw => {
        const msg = JSON.parse(raw);
        if (!msg.id) return;
        ws2.close();
        try {
            const v = JSON.parse(msg.result.result.value);
            console.log('AI Autopilot nav-state age:', v.age, 'ms', v.age < 3000 ? '(FRESH)' : '(STALE)');
        } catch(e) {
            console.log(msg.result && msg.result.result && msg.result.result.value);
        }
    });
}

main().catch(e => console.log('Error:', e.message));
