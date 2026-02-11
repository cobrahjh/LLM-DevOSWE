// CDP eval — run JS in AI autopilot page context
const WebSocket = require('ws');
const http = require('http');

const expr = process.argv[2] || 'document.title';

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
            if (r?.type === 'string') console.log(r.value);
            else if (r?.value !== undefined) console.log(JSON.stringify(r.value));
            else console.log(JSON.stringify(r));
            ws.close();
            process.exit(0);
        }
    });

    setTimeout(() => { console.error('Timeout'); ws.close(); process.exit(1); }, 5000);
}

run().catch(e => { console.error(e); process.exit(1); });
