// CDP: Hard reload AI Autopilot page, force active, enable AI + controls, verify data flow
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
    console.log('Target:', page.title, page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const msgId = id++;
            const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
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
            // 0. Force tab active to prevent background freezing
            console.log('Forcing tab active...');
            try { await send('Page.bringToFront'); } catch(e) { console.log('  bringToFront:', e.message); }
            try { await send('Page.setWebLifecycleState', { state: 'active' }); } catch(e) { console.log('  setLifecycle:', e.message); }

            // 1. Hard reload (bypass cache)
            console.log('Hard reloading page...');
            await send('Page.reload', { ignoreCache: true });

            // 2. Wait for page to fully load
            console.log('Waiting 5s for page load...');
            await new Promise(r => setTimeout(r, 5000));

            // 2b. Force active again after reload
            try { await send('Page.bringToFront'); } catch(e) {}
            try { await send('Page.setWebLifecycleState', { state: 'active' }); } catch(e) {}

            // 3. Check widget state
            let res = await send('Runtime.evaluate', {
                expression: `JSON.stringify({
                    widgetExists: !!window.widget,
                    wsReadyState: window.widget?.ws?.readyState,
                    _wsCount: window.widget?._wsCount,
                    hasData: !!window.widget?._lastFlightData,
                    aiEnabled: window.widget?.aiEnabled
                })`
            });
            console.log('After reload:', res.result?.result?.value);

            // 4. Wait for data
            console.log('Waiting 3s for data...');
            await new Promise(r => setTimeout(r, 3000));

            res = await send('Runtime.evaluate', {
                expression: `JSON.stringify({
                    wsReadyState: window.widget?.ws?.readyState,
                    _wsCount: window.widget?._wsCount,
                    hasData: !!window.widget?._lastFlightData,
                    alt: window.widget?._lastFlightData?.altitude?.toFixed(0),
                    spd: window.widget?._lastFlightData?.speed?.toFixed(0)
                })`
            });
            console.log('Data check:', res.result?.result?.value);

            // 5. Enable AI
            console.log('Enabling AI...');
            res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const toggle = document.getElementById('ai-toggle');
                    if (toggle && toggle.textContent === 'OFF') { toggle.click(); return 'clicked ON'; }
                    if (toggle && toggle.textContent === 'ON') return 'already ON';
                    return 'toggle not found: ' + (toggle?.textContent || 'null');
                })()`
            });
            console.log('  AI:', res.result?.result?.value);
            await new Promise(r => setTimeout(r, 500));

            // 6. Enable auto-controls
            console.log('Enabling auto controls...');
            res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const btn = document.getElementById('auto-controls-btn');
                    if (!btn) return 'btn not found';
                    if (!btn.classList.contains('active')) { btn.click(); return 'clicked active'; }
                    return 'already active';
                })()`
            });
            console.log('  Controls:', res.result?.result?.value);
            await new Promise(r => setTimeout(r, 1000));

            // 7. Check WS rate over 3 seconds
            res = await send('Runtime.evaluate', {
                expression: `window.widget?._wsCount`
            });
            const countA = res.result?.result?.value;
            await new Promise(r => setTimeout(r, 3000));
            res = await send('Runtime.evaluate', {
                expression: `window.widget?._wsCount`
            });
            const countB = res.result?.result?.value;
            console.log(`WS rate: ${countB - countA} msgs in 3s (${((countB - countA) / 3).toFixed(0)}/s)`);

            // 8. Final state
            res = await send('Runtime.evaluate', {
                expression: `JSON.stringify({
                    wsReadyState: window.widget?.ws?.readyState,
                    _wsCount: window.widget?._wsCount,
                    aiEnabled: window.widget?.aiEnabled,
                    autoControls: window.widget?._autoControlsEnabled,
                    phase: window.widget?.flightPhase?.phase,
                    subPhase: window.widget?.ruleEngine?.getTakeoffSubPhase?.(),
                    ruleAutoControls: window.widget?.ruleEngine?.autoControls,
                    altitude: window.widget?._lastFlightData?.altitude?.toFixed(0),
                    speed: window.widget?._lastFlightData?.speed?.toFixed(0),
                    heading: window.widget?._lastFlightData?.heading?.toFixed(0),
                    onGround: window.widget?._lastFlightData?.onGround,
                    parkingBrake: window.widget?._lastFlightData?.parkingBrake,
                    throttle: window.widget?._lastFlightData?.throttle?.toFixed(0)
                })`
            });
            console.log('Final state:', res.result?.result?.value);

        } catch (e) {
            console.error('Error:', e.message);
        }

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
