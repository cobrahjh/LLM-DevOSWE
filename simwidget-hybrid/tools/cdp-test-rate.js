// Focused test: activate AI tab, reload, measure WS rate accurately
const WebSocket = require('ws');
const http = require('http');

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

let data = '';

async function run() {
    // Get targets
    const raw = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });
    const targets = JSON.parse(raw);
    const aiTab = targets.find(t => t.url.includes('ai-autopilot') && t.type === 'page');
    if (!aiTab) { console.error('No AI tab'); process.exit(1); }

    const ws = new WebSocket(aiTab.webSocketDebuggerUrl);
    ws.setMaxListeners(100);
    let msgId = 1;

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = msgId++;
            const timeout = setTimeout(() => resolve({ error: 'timeout' }), 8000);
            const handler = (raw) => {
                const msg = JSON.parse(raw);
                if (msg.id === id) {
                    ws.off('message', handler);
                    clearTimeout(timeout);
                    resolve(msg);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    ws.on('open', async () => {
        // Step 1: Activate tab
        console.log('Step 1: Activating tab...');
        await send('Target.activateTarget', { targetId: aiTab.id });
        await send('Page.bringToFront');
        console.log('  Done');

        // Step 2: Check visibility
        let res = await send('Runtime.evaluate', {
            expression: `document.visibilityState`
        });
        console.log('  visibilityState:', res.result?.result?.value);

        // Step 3: Reload
        console.log('Step 2: Reloading...');
        await send('Page.reload', { ignoreCache: true });
        await new Promise(r => setTimeout(r, 5000));

        // Step 4: Re-activate after reload
        await send('Page.bringToFront');

        // Step 5: Check state
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                vis: document.visibilityState,
                ws: window.widget?._wsCount,
                st: window.widget?.ws?.readyState,
                has: !!window.widget?._lastFlightData
            })`
        });
        console.log('After reload:', res.result?.result?.value);

        // Step 6: Measure rate
        console.log('Step 3: Measuring WS rate (10s)...');
        res = await send('Runtime.evaluate', { expression: `window.widget?._wsCount` });
        const start = res.result?.result?.value || 0;

        // Ping setWebLifecycleState every 200ms during measurement
        const iv = setInterval(async () => {
            await send('Page.setWebLifecycleState', { state: 'active' });
        }, 200);

        await new Promise(r => setTimeout(r, 10000));
        clearInterval(iv);

        res = await send('Runtime.evaluate', { expression: `window.widget?._wsCount` });
        const end = res.result?.result?.value || 0;
        const rate = (end - start) / 10;
        console.log(`  ${end - start} msgs in 10s = ${rate.toFixed(1)}/s`);

        if (rate > 5) {
            console.log('DATA FLOWING OK');
        } else {
            console.log('STILL FROZEN. Tab visibility may not matter when MSFS is fullscreen.');
            console.log('Need Edge restart with --disable-backgrounding-occluded-windows');
        }

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
