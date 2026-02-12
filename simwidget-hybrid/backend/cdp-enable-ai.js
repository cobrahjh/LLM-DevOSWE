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
    // Enable AI + auto controls, verify cruise alt
    const r = await send('Runtime.evaluate', { expression: `
        (function() {
            const w = window.widget;
            if (!w) return 'no widget';
            // Ensure cruise alt is 11000
            if (w.flightPhase) w.flightPhase.setCruiseAlt(11000);
            if (w.ruleEngine) {
                w.ruleEngine._cruiseAlt = 11000;
                w.ruleEngine._lastCommands = {};
            }
            // Enable AI if not already on
            if (!w.aiEnabled) {
                const toggle = document.querySelector('.ai-toggle');
                if (toggle) toggle.click();
            }
            // Enable auto controls if not already on
            setTimeout(() => {
                const autoBtn = document.querySelector('.auto-controls-toggle');
                if (autoBtn && !autoBtn.classList.contains('active')) autoBtn.click();
            }, 500);
            return 'AI enabled, cruise 11000ft';
        })()
    ` });
    console.log(r.result?.result?.value);

    // Monitor takeoff for 60 seconds
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const r2 = await send('Runtime.evaluate', { expression: `JSON.stringify({
            phase: document.getElementById('phase-name')?.textContent,
            hdg: document.getElementById('target-hdg')?.textContent,
            alt: document.getElementById('target-alt')?.textContent,
            log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,3).map(e=>e.textContent)
        })` });
        const s = JSON.parse(r2.result?.result?.value || '{}');
        console.log(`[${i}] ${s.phase} | hdg=${s.hdg} alt=${s.alt} | ${s.log?.slice(0,2).join(' | ')}`);

        // Stop monitoring once in CLIMB or CRUISE
        if (s.phase && (s.phase.includes('CLIMB') || s.phase.includes('CRUISE'))) {
            // Get a few more samples
            for (let j = 0; j < 3; j++) {
                await new Promise(r => setTimeout(r, 3000));
                const r3 = await send('Runtime.evaluate', { expression: `JSON.stringify({
                    phase: document.getElementById('phase-name')?.textContent,
                    hdg: document.getElementById('target-hdg')?.textContent,
                    alt: document.getElementById('target-alt')?.textContent,
                    log: Array.from(document.querySelectorAll('.log-entry .log-cmd')).slice(0,3).map(e=>e.textContent)
                })` });
                const s3 = JSON.parse(r3.result?.result?.value || '{}');
                console.log(`[${i}+${j+1}] ${s3.phase} | hdg=${s3.hdg} alt=${s3.alt} | ${s3.log?.slice(0,2).join(' | ')}`);
            }
            break;
        }
    }
    c.close();
    process.exit(0);
});
c.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
