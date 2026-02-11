// Quick CDP diagnostic — check AI autopilot state and recent commands
const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const tabs = JSON.parse(d);
        const ai = tabs.find(t => t.title && t.title.includes('AI Autopilot'));
        if (!ai) { console.log('No AI Autopilot tab found'); process.exit(1); }

        const w = new WebSocket(ai.webSocketDebuggerUrl);
        w.on('open', () => {
            w.send(JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: {
                    expression: `JSON.stringify({
                        phase: window.widget?.flightPhase?.phase,
                        subPhase: window.widget?.ruleEngine?._takeoffSubPhase,
                        aiEnabled: window.widget?.aiEnabled,
                        autoControls: window.widget?.autoControls,
                        rollBias: window.widget?.ruleEngine?._rollBias?.toFixed(2),
                        yawBias: window.widget?.ruleEngine?._yawBias?.toFixed(2),
                        lastCmds: window.widget?.ruleEngine?._lastCommands,
                        queueLen: window.widget?.ruleEngine?.commandQueue?._queue?.length,
                        log: window.widget?.ruleEngine?.commandQueue?.getLog()?.slice(0, 15)
                    }, null, 2)`
                }
            }));
        });
        w.on('message', m => {
            const r = JSON.parse(m);
            if (r.id === 1) {
                console.log(r.result?.result?.value || 'No result');
                w.close();
                process.exit(0);
            }
        });
        setTimeout(() => { console.log('Timeout'); process.exit(1); }, 5000);
    });
}).on('error', e => { console.log('CDP not available:', e.message); process.exit(1); });
