// CDP: Force-activate AI tab + monitor data flow in real time
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
    const page = targets.find(t => t.url.includes('ai-autopilot') && t.type === 'page');
    if (!page) { console.error('AI Autopilot page not found'); process.exit(1); }
    console.log('Target:', page.title, '(id:', page.id + ')');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const msgId = id++;
            const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 10000);
            const handler = (msg) => {
                const data = JSON.parse(msg);
                if (data.id === msgId) {
                    ws.off('message', handler);
                    clearTimeout(timeout);
                    resolve(data);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    ws.on('open', async () => {
        try {
            // Try ALL activation methods
            console.log('Activating tab with multiple methods...');

            // Method 1: Target.activateTarget (strongest)
            try {
                await send('Target.activateTarget', { targetId: page.id });
                console.log('  Target.activateTarget: OK');
            } catch(e) { console.log('  Target.activateTarget:', e.message); }

            // Method 2: Page.bringToFront
            try {
                await send('Page.bringToFront');
                console.log('  Page.bringToFront: OK');
            } catch(e) { console.log('  Page.bringToFront:', e.message); }

            // Method 3: Page.setWebLifecycleState
            try {
                await send('Page.setWebLifecycleState', { state: 'active' });
                console.log('  Page.setWebLifecycleState: OK');
            } catch(e) { console.log('  Page.setWebLifecycleState:', e.message); }

            // Method 4: Emulate user focus
            try {
                await send('Emulation.setFocusEmulationEnabled', { enabled: true });
                console.log('  Emulation.setFocusEmulationEnabled: OK');
            } catch(e) { console.log('  Emulation.setFocusEmulationEnabled:', e.message); }

            await new Promise(r => setTimeout(r, 1000));

            // Check WS count baseline
            let res = await send('Runtime.evaluate', {
                expression: `window.widget?._wsCount`
            });
            const countStart = res.result?.result?.value;
            console.log('WS count at start:', countStart);

            // Monitor for 10 seconds, checking every 2s
            for (let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 2000));

                // Keep forcing active every check
                try { await send('Page.bringToFront'); } catch(e) {}
                try { await send('Page.setWebLifecycleState', { state: 'active' }); } catch(e) {}

                res = await send('Runtime.evaluate', {
                    expression: `JSON.stringify({
                        ws: window.widget?._wsCount,
                        st: window.widget?.ws?.readyState,
                        ph: window.widget?.flightPhase?.phase,
                        sp: window.widget?._lastFlightData?.speed?.toFixed(0),
                        th: window.widget?._lastFlightData?.throttle?.toFixed(0)
                    })`
                });
                console.log(`  +${(i+1)*2}s:`, res.result?.result?.value);
            }

            const countEnd = (await send('Runtime.evaluate', { expression: `window.widget?._wsCount` })).result?.result?.value;
            console.log(`\nTotal: ${countEnd - countStart} msgs in 10s (${((countEnd - countStart) / 10).toFixed(0)}/s)`);

        } catch (e) {
            console.error('Error:', e.message);
        }

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
