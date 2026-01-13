/**
 * Relay Message Notifier v1.0.0
 *
 * Listens to relay WebSocket and shows Windows notifications
 * when new messages arrive from phone/Kitt.
 *
 * Run: node message-notifier.js
 *
 * Path: C:\DevOSWE\Admin\relay\message-notifier.js
 */

const WebSocket = require('ws');
const { exec } = require('child_process');
const path = require('path');

const RELAY_URL = 'ws://localhost:8600';
let ws = null;
let reconnectTimer = null;

function showNotification(title, message) {
    // Use PowerShell to show Windows toast notification
    const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

        $template = @"
        <toast>
            <visual>
                <binding template="ToastText02">
                    <text id="1">${title.replace(/"/g, "'")}</text>
                    <text id="2">${message.replace(/"/g, "'").substring(0, 100)}</text>
                </binding>
            </visual>
            <audio src="ms-winsoundevent:Notification.Default"/>
        </toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Kitt Message").Show($toast)
    `;

    exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
        if (err) {
            // Fallback: simple console beep + message
            console.log('\x07'); // Terminal bell
            console.log(`\n${'='.repeat(50)}`);
            console.log(`📱 NEW MESSAGE: ${title}`);
            console.log(`   ${message.substring(0, 80)}`);
            console.log(`${'='.repeat(50)}\n`);
        }
    });
}

function connect() {
    console.log(`Connecting to relay at ${RELAY_URL}...`);

    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
        console.log('✅ Connected to relay WebSocket');
        console.log('Listening for new messages...\n');
        if (reconnectTimer) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
        }
    });

    ws.on('message', (data) => {
        try {
            const event = JSON.parse(data.toString());

            if (event.type === 'task:created') {
                const task = event.data;
                console.log(`\n📱 New message from Kitt!`);
                console.log(`   ID: ${task.id}`);
                console.log(`   Content: ${task.content?.substring(0, 60)}...`);
                console.log(`   Tell Claude: "msg" or "check messages"\n`);

                showNotification('Kitt Message', task.content || 'New message from phone');
            }
        } catch (e) {
            // Ignore parse errors
        }
    });

    ws.on('close', () => {
        console.log('❌ Disconnected from relay');
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            console.log('WebSocket error:', err.message);
        }
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        console.log('Will retry in 5 seconds...');
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, 5000);
    }
}

// Startup
console.log('═'.repeat(50));
console.log('  Kitt Message Notifier v1.0.0');
console.log('═'.repeat(50));
console.log('Shows Windows notifications when phone messages arrive.');
console.log('Press Ctrl+C to exit.\n');

connect();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (ws) ws.close();
    process.exit(0);
});
