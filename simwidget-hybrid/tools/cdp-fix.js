// CDP fix: resume if paused, reconnect WS, verify data flow
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
    console.log('Target:', page.title);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const msgId = id++;
            const handler = (msg) => {
                const data = JSON.parse(msg);
                if (data.id === msgId) { ws.off('message', handler); resolve(data); }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    ws.on('open', async () => {
        // 1. Enable debugger domain and check if paused
        await send('Debugger.enable');
        console.log('Debugger enabled');

        // 2. Resume execution in case it's paused at a breakpoint
        try {
            await send('Debugger.resume');
            console.log('Resumed execution (was possibly paused)');
        } catch (e) {
            console.log('Resume not needed or failed:', e.message);
        }

        // 3. Disable debugger to prevent future pauses
        await send('Debugger.disable');
        console.log('Debugger disabled');

        // 4. Check current wsCount
        let res = await send('Runtime.evaluate', {
            expression: `window.widget?._wsCount`
        });
        const countBefore = res.result?.result?.value;
        console.log('WS count before:', countBefore);

        // 5. Force WS reconnect if stale
        res = await send('Runtime.evaluate', {
            expression: `(() => {
                const w = window.widget;
                if (!w) return 'no widget';
                if (w.ws) {
                    try { w.ws.close(); } catch(e) {}
                }
                // SimGlassBase has connect() method
                setTimeout(() => w.connect(), 500);
                return 'reconnecting...';
            })()`
        });
        console.log('Reconnect:', res.result?.result?.value);

        // 6. Wait for reconnect + some messages
        await new Promise(r => setTimeout(r, 4000));

        // 7. Check if data is flowing now
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                _wsCount: window.widget?._wsCount,
                wsReadyState: window.widget?.ws?.readyState,
                hasData: !!window.widget?._lastFlightData,
                altitude: window.widget?._lastFlightData?.altitude?.toFixed(0),
                speed: window.widget?._lastFlightData?.speed?.toFixed(0),
                phase: window.widget?.flightPhase?.phase,
                aiEnabled: window.widget?.aiEnabled,
                rulePhase: window.widget?.ruleEngine?.phase
            })`
        });
        console.log('After reconnect:', res.result?.result?.value);

        // 8. Wait 2 more seconds and check count delta
        const countMid = JSON.parse(res.result?.result?.value)?._wsCount;
        await new Promise(r => setTimeout(r, 2000));

        res = await send('Runtime.evaluate', {
            expression: `window.widget?._wsCount`
        });
        const countAfter = res.result?.result?.value;
        console.log(`WS rate: ${countAfter - countMid} msgs in 2s (${((countAfter - countMid) / 2).toFixed(0)}/s)`);

        // 9. Final state
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                _wsCount: window.widget?._wsCount,
                phase: window.widget?.flightPhase?.phase,
                subPhase: window.widget?.ruleEngine?.getTakeoffSubPhase?.(),
                aiEnabled: window.widget?.aiEnabled,
                autoControls: window.widget?.ruleEngine?.autoControls,
                altitude: window.widget?._lastFlightData?.altitude?.toFixed(0),
                speed: window.widget?._lastFlightData?.speed?.toFixed(0),
                heading: window.widget?._lastFlightData?.heading?.toFixed(0),
                onGround: window.widget?._lastFlightData?.onGround
            })`
        });
        console.log('Final state:', res.result?.result?.value);

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
