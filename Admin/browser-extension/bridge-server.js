/**
 * Kitt Browser Bridge Server v1.1.0
 * HTTP API that communicates with browser extension via WebSocket
 *
 * Port: 8620
 *
 * Endpoints:
 *   GET  /status          - Check connection status
 *   GET  /tabs            - List all tabs
 *   POST /navigate        - Navigate to URL
 *   POST /click           - Click element
 *   POST /type            - Type text
 *   POST /read            - Read page content
 *   POST /execute         - Execute JavaScript
 *   POST /screenshot      - Capture tab
 *
 * Tab Grouping (v1.1.0):
 *   GET  /groups          - List all tab groups
 *   POST /group           - Create group from tabs {tabIds[], title?, color?}
 *   POST /group/add       - Add tabs to group {groupId, tabIds[]}
 *   POST /opengroup       - Open URLs in new group {urls[], title?, color?}
 *   POST /ungroup         - Remove tabs from group {tabIds[]}
 *   POST /group/collapse  - Collapse/expand group {groupId, collapsed?}
 */

const http = require('http');
const WebSocket = require('ws');
const { exec } = require('child_process');

const PORT = 8620;

// Windows toast notification
function notify(title, message) {
    const ps = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = '<toast><visual><binding template="ToastText02"><text id="1">${title}</text><text id="2">${message}</text></binding></visual></toast>'
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Kitt Browser Bridge').Show($toast)
    `.replace(/\n/g, ' ');

    exec(`powershell -Command "${ps}"`, { windowsHide: true }, (err) => {
        if (err) console.log('[Notify] Toast failed, using console');
    });

    console.log(`[Bridge] 🔔 ${title}: ${message}`);
}

// Action descriptions for notifications
const ACTION_NAMES = {
    getTabs: 'Listing tabs',
    getActiveTab: 'Getting active tab',
    navigate: 'Navigating',
    newTab: 'Opening new tab',
    closeTab: 'Closing tab',
    focusTab: 'Focusing tab',
    click: 'Clicking element',
    type: 'Typing text',
    setInputValue: 'Setting input',
    readPage: 'Reading page',
    executeScript: 'Running script',
    screenshot: 'Taking screenshot',
    createGroup: 'Creating tab group',
    addToGroup: 'Adding to group',
    openUrlsInGroup: 'Opening URLs in group',
    listGroups: 'Listing groups',
    ungroupTabs: 'Ungrouping tabs',
    collapseGroup: 'Collapsing group'
};

// State
let extensionSocket = null;
let pendingRequests = new Map();
let requestId = 0;

// Create WebSocket server for extension
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('[Bridge] Extension connected');
    notify('Kitt Browser Bridge', 'Extension connected ✓');
    extensionSocket = ws;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'connect') {
                console.log(`[Bridge] Agent: ${msg.agent} v${msg.version}`);
                return;
            }

            if (msg.type === 'response') {
                const pending = pendingRequests.get(msg.id);
                if (pending) {
                    pending.resolve(msg);
                    pendingRequests.delete(msg.id);
                }
            }
        } catch (err) {
            console.error('[Bridge] Parse error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Bridge] Extension disconnected');
        extensionSocket = null;
    });

    ws.on('error', (err) => {
        console.error('[Bridge] WebSocket error:', err);
    });
});

// Send command to extension
function sendToExtension(action, params = {}) {
    return new Promise((resolve, reject) => {
        if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
            reject(new Error('Extension not connected'));
            return;
        }

        // Show notification
        const actionName = ACTION_NAMES[action] || action;
        const detail = params.url || params.selector || params.text?.substring(0, 30) || '';
        notify('Kitt Browser', `${actionName}${detail ? ': ' + detail : ''}`);

        const id = ++requestId;
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('Request timeout'));
        }, 30000);

        pendingRequests.set(id, {
            resolve: (data) => {
                clearTimeout(timeout);
                resolve(data);
            },
            reject
        });

        extensionSocket.send(JSON.stringify({ id, action, params }));
    });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse body for POST
    let body = '';
    if (req.method === 'POST') {
        for await (const chunk of req) {
            body += chunk;
        }
    }
    const params = body ? JSON.parse(body) : {};

    try {
        let result;

        switch (req.url) {
            case '/status':
                result = {
                    connected: extensionSocket?.readyState === WebSocket.OPEN,
                    pendingRequests: pendingRequests.size
                };
                break;

            case '/tabs':
                result = await sendToExtension('getTabs');
                break;

            case '/active':
                result = await sendToExtension('getActiveTab');
                break;

            case '/navigate':
                result = await sendToExtension('navigate', params);
                break;

            case '/newtab':
                result = await sendToExtension('newTab', params);
                break;

            case '/close':
                result = await sendToExtension('closeTab', params);
                break;

            case '/focus':
                result = await sendToExtension('focusTab', params);
                break;

            case '/click':
                result = await sendToExtension('click', params);
                break;

            case '/type':
                result = await sendToExtension('type', params);
                break;

            case '/input':
                result = await sendToExtension('setInputValue', params);
                break;

            case '/read':
                result = await sendToExtension('readPage', params);
                break;

            case '/execute':
                result = await sendToExtension('executeScript', params);
                break;

            case '/screenshot':
                result = await sendToExtension('screenshot', params);
                break;

            // Tab grouping endpoints
            case '/group':
                result = await sendToExtension('createGroup', params);
                break;

            case '/group/add':
                result = await sendToExtension('addToGroup', params);
                break;

            case '/opengroup':
                result = await sendToExtension('openUrlsInGroup', params);
                break;

            case '/groups':
                result = await sendToExtension('listGroups', params);
                break;

            case '/ungroup':
                result = await sendToExtension('ungroupTabs', params);
                break;

            case '/group/collapse':
                result = await sendToExtension('collapseGroup', params);
                break;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
        }

        res.writeHead(200);
        res.end(JSON.stringify(result));

    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
    }
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Kitt Browser Bridge Server v1.0.0');
    console.log(`HTTP API: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Waiting for extension to connect...');
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET  /status     - Connection status');
    console.log('  GET  /tabs       - List tabs');
    console.log('  GET  /active     - Get active tab');
    console.log('  POST /navigate   - {tabId?, url}');
    console.log('  POST /newtab     - {url?}');
    console.log('  POST /click      - {tabId, selector | x,y}');
    console.log('  POST /type       - {tabId, selector?, text}');
    console.log('  POST /input      - {tabId, selector, value}');
    console.log('  POST /read       - {tabId, selector?}');
    console.log('  POST /execute    - {tabId, code}');
    console.log('  POST /screenshot - {tabId?}');
    console.log('');
    console.log('Tab Grouping:');
    console.log('  GET  /groups        - List all groups');
    console.log('  POST /group         - {tabIds[], title?, color?}');
    console.log('  POST /group/add     - {groupId, tabIds[]}');
    console.log('  POST /opengroup     - {urls[], title?, color?}');
    console.log('  POST /ungroup       - {tabIds[]}');
    console.log('  POST /group/collapse- {groupId, collapsed?}');
});
