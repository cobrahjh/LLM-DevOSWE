/**
 * Run browser-console-test.js via Chrome DevTools Protocol
 * Requires Chrome launched with --remote-debugging-port=9222
 * Usage: node tests/run-browser-test.js
 *
 * To launch Chrome:
 *   node -e "const {spawn}=require('child_process'),{CHROME_EXE,CHROME_PROFILE,CDP_PORT,GTN750_URL,AI_AUTOPILOT_URL}=require('./tests/config');const p=spawn(CHROME_EXE,['--remote-debugging-port='+CDP_PORT,'--user-data-dir='+CHROME_PROFILE,'--no-first-run',GTN750_URL,AI_AUTOPILOT_URL],{detached:true,stdio:'ignore'});p.unref();console.log('Chrome PID:',p.pid);"
 */
const http = require('http');
const WebSocket = require('ws');
const { BASE_URL, CDP_PORT } = require('./config');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

async function main() {
    const tabs = await get(`http://localhost:${CDP_PORT}/json`);
    const aiTab = tabs.find(t => t.url.includes('ai-autopilot'));
    const gtnTab = tabs.find(t => t.url.includes('gtn750'));

    console.log('GTN750 tab:      ', gtnTab ? 'found' : 'MISSING');
    console.log('AI Autopilot tab:', aiTab ? 'found' : 'MISSING');

    if (!aiTab) {
        console.log('ERROR: AI Autopilot tab not found in CDP');
        process.exit(1);
    }

    // Pre-warm: trigger a GTN750 broadcast so nav-state is fresh for the test
    if (gtnTab) {
        const wsGtn = new WebSocket(gtnTab.webSocketDebuggerUrl);
        await new Promise((res) => {
            wsGtn.on('open', () => {
                wsGtn.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'gtn750 && gtn750._broadcastNavState && gtn750._broadcastNavState(), "ok"', returnByValue: true } }));
            });
            wsGtn.on('message', () => { wsGtn.close(); res(); });
            wsGtn.on('error', res);
            setTimeout(res, 2000);
        });
        await new Promise(r => setTimeout(r, 400)); // let BroadcastChannel deliver
    }

    const ws = new WebSocket(aiTab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { ws.close(); reject(new Error('timeout after 15s')); }, 15000);
        let mid = 1;

        ws.on('open', () => {
            const expr = "fetch('/ui/ai-autopilot/browser-console-test.js').then(r=>r.text()).then(eval).then(r=>JSON.stringify(r||{})).catch(e=>'ERROR:'+e.message)";
            ws.send(JSON.stringify({
                id: mid++,
                method: 'Runtime.evaluate',
                params: { expression: expr, awaitPromise: true, returnByValue: true }
            }));
        });

        ws.on('message', raw => {
            const msg = JSON.parse(raw);
            if (!msg.id) return; // skip runtime events

            clearTimeout(timer);
            ws.close();

            const exc = msg.result && msg.result.exceptionDetails;
            const val = msg.result && msg.result.result && msg.result.result.value;

            if (exc) {
                console.log('Exception in browser:', exc.text);
                resolve();
                return;
            }

            if (!val) {
                console.log('No return value from test');
                resolve();
                return;
            }

            try {
                const r = JSON.parse(val);
                console.log('');
                console.log('--- Browser Test Results ---');
                console.log('Passed:  ', r.passed);
                console.log('Failed:  ', r.failed);
                console.log('Warnings:', r.warnings);

                if (r.fails && r.fails.length) {
                    console.log('');
                    console.log('Failures:');
                    r.fails.forEach(n => console.log('  ❌', n));
                }
                if (r.warns && r.warns.length) {
                    console.log('Warnings:');
                    r.warns.forEach(n => console.log('  ⚠️ ', n));
                }

                if (r.ng) {
                    console.log('');
                    console.log('Nav Guidance from getNavGuidance():');
                    console.log('  wpIdent:     ', r.ng.wpIdent);
                    console.log('  wpDist:      ', r.ng.wpDist);
                    console.log('  cdiSource:   ', r.ng.cdiSource);
                    console.log('  dtk:         ', r.ng.dtk);
                    console.log('  xtrk:        ', r.ng.xtrk);
                    console.log('  toFrom:      ', r.ng.toFrom);
                    console.log('  navMode:     ', r.ng.navMode);
                    console.log('  interceptHdg:', r.ng.interceptHdg);
                    console.log('  destDist:    ', r.ng.destDist);
                }

                console.log('');
                if (!r.failed) {
                    console.log('✅ All browser tests passed');
                } else {
                    console.log('❌ ' + r.failed + ' test(s) failed — check browser console for details');
                }
            } catch (e) {
                console.log('Raw result:', val);
            }

            resolve();
        });

        ws.on('error', reject);
    });
}

main().catch(e => {
    console.log('Error:', e.message);
    process.exit(1);
});
