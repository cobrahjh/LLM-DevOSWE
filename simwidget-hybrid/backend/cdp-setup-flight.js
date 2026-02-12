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
c.on('open', async () => {
    // Wait for flight data to flow
    console.log('Waiting for flight data...');
    for (let i = 0; i < 15; i++) {
        const r = await send('Runtime.evaluate', { expression: `
            window.widget?.flightData ? 'has data' : 'no data'
        ` });
        if (r.result?.result?.value === 'has data') {
            console.log('Got flight data after ' + (i+1) + 's');
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    // Set cruise alt
    const r1 = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            if (w.flightPhase) w.flightPhase.setCruiseAlt(11000);
            if (w.ruleEngine) w.ruleEngine._targetCruiseAlt = 11000;
            return 'cruise=' + (w.ruleEngine?._getCruiseAlt?.() || '?');
        })()
    ` });
    console.log('Cruise:', r1.result?.result?.value);

    // Enable AI
    const r2 = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            if (!w.aiEnabled) {
                const toggle = document.querySelector('.ai-toggle');
                if (toggle) toggle.click();
            }
            return 'aiEnabled=' + w.aiEnabled;
        })()
    ` });
    console.log('AI:', r2.result?.result?.value);

    // Wait a beat then enable auto controls
    await new Promise(r => setTimeout(r, 1000));
    const r3 = await send('Runtime.evaluate', { expression: `
        (function() {
            const autoBtn = document.querySelector('.auto-controls-toggle');
            if (autoBtn && !autoBtn.classList.contains('active')) autoBtn.click();
            return 'autoControls clicked, class=' + autoBtn?.className;
        })()
    ` });
    console.log('Auto:', r3.result?.result?.value);

    // Verify
    await new Promise(r => setTimeout(r, 1000));
    const r4 = await send('Runtime.evaluate', { expression: `JSON.stringify({
        aiEnabled: window.widget?.aiEnabled,
        autoControls: window.widget?.autoControls,
        phase: window.widget?.flightPhase?.phase,
        cruise: window.widget?.ruleEngine?._getCruiseAlt?.(),
        hasData: !!window.widget?.flightData
    })` });
    console.log('State:', r4.result?.result?.value);

    // Monitor for 30s
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            alt: document.getElementById('target-alt')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,3).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r.result?.result?.value || '{}');
        console.log(`[${i}] ${s.phase} | alt=${s.alt} | ${s.log?.slice(0,2).join(' | ')}`);
        if (s.phase?.includes('CLIMB') || s.phase?.includes('CRUISE')) {
            console.log('--- Airborne! ---');
            break;
        }
    }

    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
