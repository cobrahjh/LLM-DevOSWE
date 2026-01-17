/**
 * Relay Message Notifier v2.0.0
 *
 * Shows Windows toast notifications when Kitt messages arrive.
 * Uses both WebSocket (real-time) and HTTP polling (backup).
 *
 * Run: node message-notifier.js
 */

const WebSocket = require('ws');
const { exec } = require('child_process');

const RELAY_WS = 'ws://localhost:8600';
const RELAY_HTTP = 'http://localhost:8600';
const POLL_INTERVAL = 5000;

let ws = null;
let reconnectTimer = null;
const notifiedIds = new Set();

function showToast(title, message) {
    const safeTitle = title.replace(/'/g, "''").replace(/"/g, "'");
    const safeMsg = message.replace(/'/g, "''").replace(/"/g, "'").substring(0, 200);

    // Windows Toast Notification
    const ps = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument;
        $xml.LoadXml('<toast duration="long"><visual><binding template="ToastText02"><text id="1">${safeTitle}</text><text id="2">${safeMsg}</text></binding></visual><audio src="ms-winsoundevent:Notification.IM"/></toast>');
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml);
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Kitt').Show($toast)
    `.replace(/\n/g, ' ');

    exec(`powershell -Command "${ps}"`, (err) => {
        if (err) {
            // Fallback to BurntToast or MessageBox
            exec(`powershell -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safeMsg}', '${safeTitle}', 'OK', 'Information')"`);
        }
    });

    // Sound alert
    exec('powershell -Command "[console]::beep(800,200); [console]::beep(1000,200)"');

    // Console output
    console.log('\x07');
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📨 ${title}`);
    console.log(`   ${message.substring(0, 80)}`);
    console.log(`   → Use "msg" to respond`);
    console.log(`${'='.repeat(50)}\n`);
}

function handleNewMessage(id, content, source = 'unknown') {
    if (notifiedIds.has(id)) return;
    notifiedIds.add(id);

    // Keep set size manageable
    if (notifiedIds.size > 100) {
        const arr = Array.from(notifiedIds);
        arr.slice(0, 50).forEach(i => notifiedIds.delete(i));
    }

    showToast('📨 Kitt Message', content);
}

// WebSocket connection for real-time events
function connectWebSocket() {
    console.log(`Connecting WebSocket to ${RELAY_WS}...`);

    ws = new WebSocket(RELAY_WS);

    ws.on('open', () => {
        console.log('✅ WebSocket connected (real-time mode)');
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    });

    ws.on('message', (data) => {
        try {
            const event = JSON.parse(data.toString());
            if (event.type === 'task:created' && event.data) {
                handleNewMessage(event.data.id, event.data.content || 'New message', 'websocket');
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        console.log('WebSocket disconnected, using HTTP polling...');
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            console.log('WebSocket error:', err.message);
        }
    });
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectWebSocket();
        }, 10000);
    }
}

// HTTP polling as backup
async function pollMessages() {
    try {
        const res = await fetch(`${RELAY_HTTP}/api/messages/pending`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.count > 0) {
            for (const msg of data.messages) {
                handleNewMessage(msg.id, msg.content, 'http-poll');
            }
        }
    } catch (e) {
        // Relay might be down
    }
}

// Startup
console.log('═'.repeat(50));
console.log('  Kitt Message Notifier v2.0.0');
console.log('═'.repeat(50));
console.log('Toast notifications when Kitt messages arrive.');
console.log('Press Ctrl+C to exit.\n');

connectWebSocket();
setInterval(pollMessages, POLL_INTERVAL);
pollMessages(); // Check immediately

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (ws) ws.close();
    process.exit(0);
});
