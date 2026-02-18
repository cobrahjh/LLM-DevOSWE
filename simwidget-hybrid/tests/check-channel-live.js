/**
 * Live connectivity test:
 * 1. On AI Autopilot tab: record current nav-state timestamp
 * 2. On GTN750 tab: trigger a manual broadcast
 * 3. Wait 200ms
 * 4. On AI Autopilot tab: check if timestamp changed
 */
const http = require('http');
const WebSocket = require('ws');
function get(url) {
    return new Promise((resolve,reject) => {
        http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error',reject);
    });
}
function cdpEval(wsUrl, expr) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => { ws.close(); reject(new Error('CDP timeout')); }, 5000);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
        });
        ws.on('message', raw => {
            const msg = JSON.parse(raw);
            if (!msg.id) return;
            clearTimeout(timer);
            ws.close();
            resolve(msg.result && msg.result.result && msg.result.result.value);
        });
        ws.on('error', reject);
    });
}

async function main() {
    const tabs = await get('http://localhost:9222/json');
    const gtnTab = tabs.find(t => t.url.includes('gtn750'));
    const aiTab = tabs.find(t => t.url.includes('ai-autopilot'));
    if (!gtnTab || !aiTab) { console.log('Tabs not found'); return; }

    // Step 1: Record current AI Autopilot nav-state timestamp
    const before = await cdpEval(aiTab.webSocketDebuggerUrl,
        'String(widget._navState && widget._navState.timestamp)');
    console.log('Before broadcast — nav-state timestamp:', before);

    // Step 2: Trigger manual broadcast from GTN750
    const result = await cdpEval(gtnTab.webSocketDebuggerUrl,
        'gtn750._broadcastNavState(); "triggered at:" + Date.now()');
    console.log('GTN750 broadcast:', result);

    // Step 3: Wait 300ms for BroadcastChannel delivery
    await new Promise(r => setTimeout(r, 300));

    // Step 4: Check AI Autopilot nav-state timestamp
    const after = await cdpEval(aiTab.webSocketDebuggerUrl,
        'JSON.stringify({ ts: widget._navState && widget._navState.timestamp, age: widget._navState ? Date.now()-(widget._navState.timestamp||0) : null })');
    console.log('After broadcast  — nav-state:', JSON.parse(after || '{}'));

    const beforeTs = parseInt(before) || 0;
    const afterTs = (JSON.parse(after || '{}').ts) || 0;
    if (afterTs > beforeTs) {
        console.log('SUCCESS: nav-state updated (+' + (afterTs - beforeTs) + 'ms)');
    } else {
        console.log('FAIL: nav-state NOT updated (channel broken?)');
    }
}
main().catch(e => console.log('Error:', e.message, e.stack));
