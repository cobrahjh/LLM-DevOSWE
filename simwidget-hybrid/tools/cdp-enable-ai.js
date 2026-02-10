// Quick CDP script to enable AI autopilot + auto controls on harold-pc
// Usage: node tools/cdp-enable-ai.js
const WebSocket = require('ws');
const http = require('http');

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    const targets = await getTargets();
    const page = targets.find(t => t.url.includes('ai-autopilot'));

    if (!page) {
        console.error('AI Autopilot page not found in CDP targets');
        process.exit(1);
    }

    console.log('Found:', page.title, page.url);
    const ws = new WebSocket(page.webSocketDebuggerUrl.replace('127.0.0.1', '127.0.0.1'));
    let id = 1;

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const msgId = id++;
            const handler = (msg) => {
                const data = JSON.parse(msg);
                if (data.id === msgId) {
                    ws.off('message', handler);
                    resolve(data);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    ws.on('open', async () => {
        // Reload page to reconnect to updated server
        console.log('Reloading page...');
        await send('Page.reload');
        await new Promise(r => setTimeout(r, 4000));

        // Check state
        let res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                aiEnabled: window.widget?.aiEnabled,
                phase: window.widget?.ruleEngine?.phase,
                ws: window.widget?.ws?.readyState
            })`
        });
        console.log('After reload:', res.result?.result?.value);

        // Click AI toggle ON
        console.log('Enabling AI...');
        await send('Runtime.evaluate', {
            expression: `
                const toggle = document.getElementById('ai-toggle');
                if (toggle && toggle.textContent === 'OFF') toggle.click();
                'clicked'
            `
        });
        await new Promise(r => setTimeout(r, 500));

        // Click auto-controls ON
        console.log('Enabling auto controls...');
        await send('Runtime.evaluate', {
            expression: `
                const ctrl = document.getElementById('auto-controls-btn');
                if (ctrl && !ctrl.classList.contains('active')) ctrl.click();
                'clicked auto-controls-btn'
            `
        });
        await new Promise(r => setTimeout(r, 2000));

        // Final status
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                aiEnabled: window.widget?.aiEnabled,
                autoControls: window.widget?.ruleEngine?.autoControls,
                phase: window.widget?.ruleEngine?.phase,
                subPhase: window.widget?.ruleEngine?.getTakeoffSubPhase?.(),
                heading: window.widget?.lastData?.heading?.toFixed(0),
                speed: window.widget?.lastData?.speed?.toFixed(0),
                throttle: window.widget?.lastData?.throttle?.toFixed(0)
            })`
        });
        console.log('Final state:', res.result?.result?.value);

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
