const http = require('http');
const WebSocket = require('ws');
const { CDP_PORT } = require('./config');

function get(url) {
    return new Promise((resolve,reject) => {
        http.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d))); }).on('error',reject);
    });
}
function cdpCmd(wsUrl, method, params) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);
        ws.on('open', () => ws.send(JSON.stringify({ id: 1, method, params: params || {} })));
        ws.on('message', raw => { clearTimeout(t); ws.close(); resolve(JSON.parse(raw)); });
        ws.on('error', reject);
    });
}

async function main() {
    const tabs = await get(`http://localhost:${CDP_PORT}/json`);
    const aiTab = tabs.find(t => t.url.includes('ai-autopilot'));
    const gtnTab = tabs.find(t => t.url.includes('gtn750'));

    if (gtnTab) {
        await cdpCmd(gtnTab.webSocketDebuggerUrl, 'Page.reload', { ignoreCache: true });
        console.log('GTN750 reloaded (cache cleared)');
    }
    if (aiTab) {
        await cdpCmd(aiTab.webSocketDebuggerUrl, 'Page.reload', { ignoreCache: true });
        console.log('AI Autopilot reloaded (cache cleared)');
    }
    console.log('Waiting 8s for widgets to init...');
}
main().catch(e => console.log('Error:', e.message));
