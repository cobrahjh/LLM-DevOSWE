// Set cruise altitude and reset AI autopilot state for new flight
const ws = require('ws');
const c = new ws('ws://127.0.0.1:9223/devtools/page/2FF67CD8F88576410C1B09A26A5CFC91');
let id = 1;
function send(m, p = {}) {
    return new Promise(r => {
        const i = id++;
        c.on('message', function h(d) {
            const msg = JSON.parse(d);
            if (msg.id === i) { c.removeListener('message', h); r(msg); }
        });
        c.send(JSON.stringify({ id: i, method: m, params: p }));
    });
}

const cruiseAlt = parseInt(process.argv[2]) || 11000;

c.on('open', async () => {
    const r = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            // Set cruise altitude
            if (w.flightPhase) {
                w.flightPhase.setCruiseAlt(${cruiseAlt});
                w.flightPhase.targetCruiseAlt = ${cruiseAlt};
            }
            if (w.ruleEngine) {
                w.ruleEngine._cruiseAlt = ${cruiseAlt};
                w.ruleEngine._lastCommands = {};
            }
            // Reset phase to PREFLIGHT
            if (w.flightPhase) {
                w.flightPhase._manualPhase = false;
                w.flightPhase.phase = 'PREFLIGHT';
                w.flightPhase.phaseIndex = 0;
                w.flightPhase._phaseEntryTime = Date.now();
            }
            // Disable AI (will re-enable manually)
            if (w.aiEnabled) {
                const toggle = document.querySelector('.ai-toggle');
                if (toggle) toggle.click();
            }
            return 'Cruise=${cruiseAlt}ft, phase=PREFLIGHT, AI off';
        })()
    ` });
    console.log(r.result?.result?.value);
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
