/**
 * Relay Message Notifier v1.0.0
 *
 * Listens to relay WebSocket and shows Windows notifications
 * when new messages arrive from phone/Kitt.
 *
 * Run: node message-notifier.js
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\message-notifier.js
 */

const WebSocket = require('ws');
const { exec } = require('child_process');
const path = require('path');

const RELAY_URL = 'ws://localhost:8600';
let ws = null;
let reconnectTimer = null;

function showNotification(title, message) {
    // Play attention-grabbing sound
    exec('powershell -Command "[console]::beep(1000,200); [console]::beep(1200,200); [console]::beep(1000,200)"');

    // Show MessageBox popup (guaranteed visible, non-blocking)
    const safeMsg = message.replace(/'/g, "''").replace(/"/g, '').substring(0, 150);
    exec(`powershell -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safeMsg}', '📱 ${title}', 'OK', 'Information')"`, { windowsHide: false });

    // Console output
    console.log('\x07'); // Terminal bell
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📱 NEW MESSAGE: ${title}`);
    console.log(`   ${message.substring(0, 80)}`);
    console.log(`${'='.repeat(50)}\n`);
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
