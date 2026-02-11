// Take screenshot of GTN750 via CDP (Chrome DevTools Protocol)
// Edge must be running with --remote-debugging-port=9222
const http = require('http');
const fs = require('fs');

const CDP_PORT = 9222;

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function cdpSend(ws, method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 100000);
        const handler = (msg) => {
            const d = JSON.parse(msg.toString());
            if (d.id === id) {
                ws.removeListener('message', handler);
                resolve(d.result);
            }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => reject(new Error('CDP timeout')), 10000);
    });
}

async function main() {
    // Get list of tabs
    const tabs = JSON.parse(await fetch(`http://localhost:${CDP_PORT}/json`));
    const gtnTab = tabs.find(t => t.url.includes('gtn750')) || tabs[0];

    if (!gtnTab) {
        console.error('No GTN750 tab found');
        process.exit(1);
    }

    console.log('Connecting to:', gtnTab.title, gtnTab.url);

    const WebSocket = require('ws');
    const ws = new WebSocket(gtnTab.webSocketDebuggerUrl);

    ws.on('open', async () => {
        try {
            // Set viewport to 1280x900
            await cdpSend(ws, 'Emulation.setDeviceMetricsOverride', {
                width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
            });

            // Reload page to pick up new code
            await cdpSend(ws, 'Page.reload', { ignoreCache: true });

            // Wait for render
            await new Promise(r => setTimeout(r, 5000));

            // Take screenshot
            const result = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });

            // Save
            fs.writeFileSync('C:\\LLM-DevOSWE\\screenshot-xpdr.png', Buffer.from(result.data, 'base64'));
            console.log('Screenshot saved');

            // Reset viewport
            await cdpSend(ws, 'Emulation.clearDeviceMetricsOverride');

            ws.close();
            process.exit(0);
        } catch (e) {
            console.error('Error:', e.message);
            ws.close();
            process.exit(1);
        }
    });
}

main().catch(e => { console.error(e); process.exit(1); });
