// CDP send command — send a SimConnect command through the AI autopilot page's WebSocket
const WebSocket = require('ws');
const http = require('http');

const command = process.argv[2] || 'MIXTURE_RICH';
const value = process.argv[3] ? Number(process.argv[3]) : undefined;

const wsPayload = value !== undefined
    ? `JSON.stringify({type:"command",command:"${command}",value:${value}})`
    : `JSON.stringify({type:"command",command:"${command}"})`;

const expr = `
(function() {
    var w = window.widget;
    if (!w || !w.ws) return JSON.stringify({error: 'no ws'});
    if (w.ws.readyState !== 1) return JSON.stringify({error: 'ws not open', state: w.ws.readyState});
    var msg = ${wsPayload};
    w.ws.send(msg);
    return JSON.stringify({ok: true, sent: msg});
})()
`;

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    const targets = await getTargets();
    const page = targets.find(t => t.url.includes('ai-autopilot'));
    if (!page) { console.error('Page not found'); process.exit(1); }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression: expr }
        }));
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 1) {
            const r = msg.result?.result;
            if (r?.type === 'string') {
                try {
                    console.log(JSON.stringify(JSON.parse(r.value), null, 2));
                } catch(e) {
                    console.log(r.value);
                }
            } else {
                console.log(JSON.stringify(r, null, 2));
            }
            ws.close();
            process.exit(0);
        }
    });

    setTimeout(() => { console.error('Timeout'); ws.close(); process.exit(1); }, 5000);
}

run().catch(e => { console.error(e); process.exit(1); });
