// CDP screenshot + optional JS eval
// Usage: node tools/cdp-screenshot.js [output.png] [js-expression]
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const outFile = process.argv[2] || 'screenshot-cdp.png';
const evalExpr = process.argv[3] || null;

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
    if (!page) { console.error('AI Autopilot page not found'); process.exit(1); }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;

    ws.on('open', () => {
        // Eval JS if provided
        if (evalExpr) {
            ws.send(JSON.stringify({
                id: msgId++,
                method: 'Runtime.evaluate',
                params: { expression: evalExpr }
            }));
        }

        // Take screenshot
        ws.send(JSON.stringify({
            id: 100,
            method: 'Page.captureScreenshot',
            params: { format: 'png', quality: 90 }
        }));
    });

    ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 100 && msg.result?.data) {
            fs.writeFileSync(outFile, Buffer.from(msg.result.data, 'base64'));
            console.log('Screenshot saved:', outFile);
            ws.close();
            process.exit(0);
        } else if (msg.result?.result?.value) {
            console.log('Eval:', msg.result.result.value);
        }
    });

    setTimeout(() => { ws.close(); process.exit(1); }, 10000);
}

run().catch(e => { console.error(e); process.exit(1); });
