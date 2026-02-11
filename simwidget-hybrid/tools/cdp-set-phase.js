// Set flight phase via CDP
// Usage: node tools/cdp-set-phase.js APPROACH [host]
const WebSocket = require('ws');
const http = require('http');
const PHASE = process.argv[2] || 'APPROACH';
const HOST = process.argv[3] || '127.0.0.1';

const expr = `
(function() {
    const w = window.widget;
    if (!w || !w.flightPhase) return JSON.stringify({error: 'no widget'});
    w.flightPhase.setManualPhase('${PHASE}');
    w.flightPhase.resumeAuto();
    return JSON.stringify({
        phase: w.flightPhase.phase,
        manualPhase: w.flightPhase._manualPhase,
        success: true
    });
})()
`;

http.get(`http://${HOST}:9222/json`, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const targets = JSON.parse(data);
        const page = targets.find(t => t.url.includes('ai-autopilot'));
        if (!page) { console.error('Page not found'); process.exit(1); }
        const ws = new WebSocket(page.webSocketDebuggerUrl.replace('127.0.0.1', HOST));
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr } }));
        });
        ws.on('message', raw => {
            const msg = JSON.parse(raw);
            if (msg.id === 1) {
                try { console.log(JSON.stringify(JSON.parse(msg.result.result.value), null, 2)); }
                catch(e) { console.log(msg.result.result.value); }
                ws.close(); process.exit(0);
            }
        });
        ws.on('error', e => { console.error(e.message); process.exit(1); });
        setTimeout(() => process.exit(1), 5000);
    });
}).on('error', e => { console.error(e.message); process.exit(1); });
