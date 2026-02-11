// CDP: Debug WebSocket data flow at the browser level
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
            // 1. Inject a raw WS message counter that bypasses the widget
            console.log('Injecting raw WS message counter...');
            let res = await send('Runtime.evaluate', {
                expression: `(() => {
                    // Patch the existing WS to count raw messages
                    window._rawWsCount = 0;
                    window._rawWsErrors = [];
                    const origOnMessage = window.widget?.ws?.onmessage;
                    if (window.widget?.ws) {
                        const origHandler = window.widget.ws.onmessage;
                        window.widget.ws.onmessage = function(event) {
                            window._rawWsCount++;
                            try {
                                if (origHandler) origHandler.call(this, event);
                            } catch(e) {
                                window._rawWsErrors.push(e.message);
                            }
                        };
                        return 'patched ws.onmessage, readyState=' + window.widget.ws.readyState;
                    }
                    return 'no widget or ws';
                })()`
            });
            console.log('Patch result:', res.result?.result?.value);

            // 2. Also try addEventListener as backup
            res = await send('Runtime.evaluate', {
                expression: `(() => {
                    window._listenerWsCount = 0;
                    if (window.widget?.ws) {
                        window.widget.ws.addEventListener('message', () => {
                            window._listenerWsCount++;
                        });
                        return 'added listener';
                    }
                    return 'no ws';
                })()`
            });
            console.log('Listener:', res.result?.result?.value);

            // 3. Check current state
            res = await send('Runtime.evaluate', {
                expression: `JSON.stringify({
                    widgetWsCount: window.widget?._wsCount,
                    rawWsCount: window._rawWsCount,
                    listenerWsCount: window._listenerWsCount,
                    wsReadyState: window.widget?.ws?.readyState,
                    wsBufferedAmount: window.widget?.ws?.bufferedAmount,
                    wsProtocol: window.widget?.ws?.protocol,
                    wsUrl: window.widget?.ws?.url
                })`
            });
            console.log('Before wait:', res.result?.result?.value);

            // 4. Wait 5 seconds and check all counters
            console.log('Waiting 5 seconds...');
            await new Promise(r => setTimeout(r, 5000));

            res = await send('Runtime.evaluate', {
                expression: `JSON.stringify({
                    widgetWsCount: window.widget?._wsCount,
                    rawWsCount: window._rawWsCount,
                    listenerWsCount: window._listenerWsCount,
                    rawWsErrors: window._rawWsErrors?.slice(-3),
                    wsReadyState: window.widget?.ws?.readyState,
                    wsBufferedAmount: window.widget?.ws?.bufferedAmount
                })`
            });
            console.log('After 5s:', res.result?.result?.value);

            // 5. Try creating a completely independent WS to test
            console.log('Creating independent WS test...');
            res = await send('Runtime.evaluate', {
                expression: `new Promise((resolve) => {
                    const testWs = new WebSocket('ws://127.0.0.1:8080');
                    let count = 0;
                    testWs.onmessage = () => count++;
                    testWs.onopen = () => {
                        setTimeout(() => {
                            testWs.close();
                            resolve(JSON.stringify({ independentMsgs: count }));
                        }, 3000);
                    };
                    testWs.onerror = (e) => resolve(JSON.stringify({ error: 'ws error' }));
                    setTimeout(() => resolve(JSON.stringify({ timeout: true, count })), 5000);
                })`,
                awaitPromise: true
            });
            console.log('Independent WS test:', res.result?.result?.value);

        } catch (e) {
            console.error('Error:', e.message);
        }

        ws.close();
        process.exit(0);
    });

    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
}

run().catch(e => { console.error(e); process.exit(1); });
