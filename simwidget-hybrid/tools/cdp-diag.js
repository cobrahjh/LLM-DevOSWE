// CDP diagnostic for AI Autopilot data flow issue
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
        // 1. Check widget state
        let res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                widgetExists: !!window.widget,
                widgetClass: window.widget?.constructor?.name,
                _lastFlightData: window.widget?._lastFlightData !== null && window.widget?._lastFlightData !== undefined ? 'HAS_DATA' : String(window.widget?._lastFlightData),
                aiEnabled: window.widget?.aiEnabled,
                phase: window.widget?.flightPhase?.phase,
                wsReadyState: window.widget?.ws?.readyState,
                wsUrl: window.widget?.ws?.url,
                wsHasOnmessage: typeof window.widget?.ws?.onmessage === 'function',
                onMessageExists: typeof window.widget?.onMessage === 'function',
                _wsCount: window.widget?._wsCount
            })`
        });
        console.log('Widget state:', res.result?.result?.value);

        // 2. Check for console errors — enable console and check
        await send('Console.enable');

        // 3. Check if there are any JS errors by getting error count
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                errorLog: (window._consoleErrors || []).slice(-5),
                SimGlassBase: typeof SimGlassBase,
                RuleEngine: typeof RuleEngine,
                FlightPhase: typeof FlightPhase,
                CommandQueue: typeof CommandQueue,
                SafeChannel: typeof SafeChannel,
                AIRCRAFT_PROFILES: typeof AIRCRAFT_PROFILES
            })`
        });
        console.log('Classes:', res.result?.result?.value);

        // 4. Try to manually check if onMessage is the correct override
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                onMessageSource: window.widget?.onMessage?.toString().slice(0, 200),
                protoOnMessage: AiAutopilotPane.prototype.onMessage?.toString().slice(0, 200)
            })`
        });
        console.log('onMessage source:', res.result?.result?.value);

        // 5. Check if _lastFlightData has real content
        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                _lastFlightDataType: typeof window.widget?._lastFlightData,
                _lastFlightDataKeys: window.widget?._lastFlightData ? Object.keys(window.widget._lastFlightData).slice(0, 10) : null,
                altitude: window.widget?._lastFlightData?.altitude,
                speed: window.widget?._lastFlightData?.speed,
                heading: window.widget?._lastFlightData?.heading
            })`
        });
        console.log('Flight data:', res.result?.result?.value);

        // 6. Wait 3 seconds, check if data changes
        console.log('Waiting 3 seconds for data...');
        await new Promise(r => setTimeout(r, 3000));

        res = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                _wsCount: window.widget?._wsCount,
                _lastFlightDataType: typeof window.widget?._lastFlightData,
                hasData: window.widget?._lastFlightData !== null && window.widget?._lastFlightData !== undefined,
                altitude: window.widget?._lastFlightData?.altitude,
                speed: window.widget?._lastFlightData?.speed,
                wsReadyState: window.widget?.ws?.readyState
            })`
        });
        console.log('After 3s:', res.result?.result?.value);

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
