const ws = require('ws');
const pageId = '2FF67CD8F88576410C1B09A26A5CFC91';
const gtnId = '752D09BF400A4597B6E383448CC6DB3D';
let id = 1;

function connectAndRun(targetId, label, fn) {
    return new Promise((resolve, reject) => {
        const c = new ws(`ws://127.0.0.1:9223/devtools/page/${targetId}`);
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
        c.on('open', async () => {
            try {
                await fn(send, label);
                c.close();
                resolve();
            } catch (e) { reject(e); }
        });
        c.on('error', e => reject(e));
    });
}

(async () => {
    // Step 1: Reload both pages to get new code
    console.log('Reloading AI Autopilot...');
    await connectAndRun(pageId, 'AP', async (send) => {
        await send('Page.reload', { ignoreCache: true });
    });
    console.log('Reloading GTN750...');
    await connectAndRun(gtnId, 'GTN', async (send) => {
        await send('Page.reload', { ignoreCache: true });
    });

    // Wait for pages to load
    console.log('Waiting 5s for pages to load...');
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: Set cruise alt and enable AI
    console.log('Setting cruise 11000 and enabling AI...');
    await connectAndRun(pageId, 'AP', async (send) => {
        const r = await send('Runtime.evaluate', { expression: `
            (function() {
                const w = window.widget;
                if (!w) return 'no widget yet';
                if (w.flightPhase) w.flightPhase.setCruiseAlt(11000);
                if (w.ruleEngine) w.ruleEngine._targetCruiseAlt = 11000;
                // Enable AI
                if (!w.aiEnabled) {
                    const toggle = document.querySelector('.ai-toggle');
                    if (toggle) toggle.click();
                }
                // Enable auto controls after short delay
                setTimeout(() => {
                    const autoBtn = document.querySelector('.auto-controls-toggle');
                    if (autoBtn && !autoBtn.classList.contains('active')) autoBtn.click();
                }, 500);
                return 'cruise=11000, AI enabled, getCruiseAlt=' + (w.ruleEngine?._getCruiseAlt?.() || '?');
            })()
        ` });
        console.log('Result:', r.result?.result?.value);
    });

    // Step 3: Monitor takeoff
    console.log('Monitoring...');
    await connectAndRun(pageId, 'AP', async (send) => {
        let airborne = 0;
        for (let i = 0; i < 40; i++) {
            const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
                phase: document.getElementById('phase-name')?.textContent,
                hdg: document.getElementById('target-hdg')?.textContent,
                alt: document.getElementById('target-alt')?.textContent,
                log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,4).map(e=>e.textContent)
            })` });
            const s = JSON.parse(r.result?.result?.value || '{}');
            const phase = s.phase || '';
            console.log(`[${i}] ${phase} | hdg=${s.hdg} alt=${s.alt}`);
            if (s.log) s.log.slice(0, 2).forEach(l => console.log('    ' + l));

            if (phase.includes('CLIMB') || phase.includes('CRUISE')) {
                airborne++;
                if (airborne >= 5) {
                    console.log('--- Stable in ' + phase + ' ---');
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    });

    process.exit(0);
})();
