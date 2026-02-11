// Run keepalive + check data rate on AI autopilot tab
const WebSocket = require('ws');
const http = require('http');

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

function cdpSend(ws, method, params = {}) {
    const id = Date.now() + Math.random();
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 5000);
        const h = (m) => {
            try { const d = JSON.parse(m); if (d.id === id) { ws.off('message', h); clearTimeout(t); resolve(d); } } catch(e) {}
        };
        ws.on('message', h);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function run() {
    const targets = await getTargets();
    const simTabs = targets.filter(t => t.url.includes('8080') && t.type === 'page');
    const aiTab = targets.find(t => t.url.includes('ai-autopilot') && t.type === 'page');

    if (!aiTab) { console.error('No AI tab'); process.exit(1); }

    // Connect to ALL SimGlass tabs for keepalive
    const connections = [];
    for (const t of simTabs) {
        const ws = await new Promise(r => {
            const w = new WebSocket(t.webSocketDebuggerUrl);
            w.on('open', () => r(w));
            w.on('error', () => r(null));
            setTimeout(() => r(null), 3000);
        });
        if (ws) {
            connections.push({ ws, title: t.title, isAi: t.url.includes('ai-autopilot') });
        }
    }
    console.log(`Connected to ${connections.length} tabs for keepalive`);

    // Start keepalive pings every 250ms to ALL tabs
    const keepAliveId = setInterval(() => {
        connections.forEach(c => {
            if (c.ws.readyState === 1) {
                cdpSend(c.ws, 'Page.setWebLifecycleState', { state: 'active' });
            }
        });
    }, 250);

    // Also force focus on AI tab
    const aiConn = connections.find(c => c.isAi);
    if (aiConn) {
        await cdpSend(aiConn.ws, 'Page.bringToFront');
        await cdpSend(aiConn.ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });
    }

    // Wait 2s for keepalive to take effect
    await new Promise(r => setTimeout(r, 2000));

    // First reload the AI page to get fresh widget-base.js with Web Lock
    console.log('Reloading AI page with cache bypass...');
    await cdpSend(aiConn.ws, 'Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 5000));

    // Force active again after reload
    await cdpSend(aiConn.ws, 'Page.bringToFront');
    await cdpSend(aiConn.ws, 'Page.setWebLifecycleState', { state: 'active' });
    await cdpSend(aiConn.ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

    // Check baseline
    let res = await cdpSend(aiConn.ws, 'Runtime.evaluate', {
        expression: `JSON.stringify({ ws: window.widget?._wsCount, st: window.widget?.ws?.readyState })`
    });
    console.log('After reload:', res?.result?.result?.value);

    // Wait 3s and check rate
    await new Promise(r => setTimeout(r, 3000));
    res = await cdpSend(aiConn.ws, 'Runtime.evaluate', {
        expression: `window.widget?._wsCount`
    });
    const countA = res?.result?.result?.value;

    await new Promise(r => setTimeout(r, 5000));
    res = await cdpSend(aiConn.ws, 'Runtime.evaluate', {
        expression: `window.widget?._wsCount`
    });
    const countB = res?.result?.result?.value;
    console.log(`WS rate: ${countB - countA} msgs in 5s (${((countB - countA) / 5).toFixed(0)}/s)`);

    if ((countB - countA) > 50) {
        console.log('DATA FLOWING! Enabling AI...');

        // Enable AI
        await cdpSend(aiConn.ws, 'Runtime.evaluate', {
            expression: `(() => {
                const t = document.getElementById('ai-toggle');
                if (t && t.textContent === 'OFF') t.click();
                return 'AI: ' + t?.textContent;
            })()`
        });
        await new Promise(r => setTimeout(r, 500));

        // Enable auto-controls
        await cdpSend(aiConn.ws, 'Runtime.evaluate', {
            expression: `(() => {
                const b = document.getElementById('auto-controls-btn');
                if (b && !b.classList.contains('active')) b.click();
                return 'Controls: ' + (b?.classList.contains('active') ? 'ON' : 'OFF');
            })()`
        });

        // Monitor takeoff for 30s
        console.log('\nMonitoring takeoff for 30 seconds...');
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000));
            res = await cdpSend(aiConn.ws, 'Runtime.evaluate', {
                expression: `JSON.stringify({
                    ws: window.widget?._wsCount,
                    ph: window.widget?.flightPhase?.phase,
                    sub: window.widget?.ruleEngine?.getTakeoffSubPhase?.(),
                    spd: window.widget?._lastFlightData?.speed?.toFixed(0),
                    alt: window.widget?._lastFlightData?.altitudeAGL?.toFixed(0),
                    vs: window.widget?._lastFlightData?.verticalSpeed?.toFixed(0),
                    pch: window.widget?._lastFlightData?.pitch?.toFixed(1),
                    bnk: window.widget?._lastFlightData?.bank?.toFixed(1),
                    thr: window.widget?._lastFlightData?.throttle?.toFixed(0),
                    gnd: window.widget?._lastFlightData?.onGround
                })`
            });
            console.log(`  +${(i+1)*2}s:`, res?.result?.result?.value);
        }
    } else {
        console.log('Data rate too low. Tab still frozen.');

        // Final diagnostic
        res = await cdpSend(aiConn.ws, 'Runtime.evaluate', {
            expression: `JSON.stringify({
                wsCount: window.widget?._wsCount,
                wsState: window.widget?.ws?.readyState,
                visState: document.visibilityState,
                hasLock: 'checking...'
            })`
        });
        console.log('Diagnostic:', res?.result?.result?.value);
    }

    clearInterval(keepAliveId);
    connections.forEach(c => c.ws.close());
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
