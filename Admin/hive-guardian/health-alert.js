/**
 * Health Alert - Monitors hive services and sends Windows notifications
 * Run standalone or called by hive-guardian
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'health-alerts.log');

// Services to monitor
const SERVICES = [
    { name: 'Ollama', port: 11434, url: 'http://localhost:11434/api/tags', critical: true },
    { name: 'Oracle', port: 3002, url: 'http://localhost:3002/api/health', critical: true },
    { name: 'Relay', port: 8600, url: 'http://localhost:8600/api/status', critical: false },
    { name: 'KittBox', port: 8585, url: 'http://localhost:8585/', critical: false },
    { name: 'Kitt Live', port: 8686, url: 'http://localhost:8686/', critical: false }
];

// Track service states to avoid duplicate alerts
const serviceState = {};
SERVICES.forEach(s => serviceState[s.name] = { online: null, lastAlert: 0 });

const ALERT_COOLDOWN = 60000; // Don't repeat alert within 60 seconds

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

// Windows toast notification using PowerShell
function sendToast(title, message, critical = false) {
    const ps = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = @"
        <toast>
            <visual>
                <binding template="ToastText02">
                    <text id="1">${title}</text>
                    <text id="2">${message}</text>
                </binding>
            </visual>
            <audio src="ms-winsoundevent:Notification.${critical ? 'Looping.Alarm' : 'Default'}"/>
        </toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Hive Guardian").Show($toast)
    `;

    exec(`powershell -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err) => {
        if (err) {
            // Fallback to simple msg command
            exec(`msg * "${title}: ${message}"`, () => {});
        }
    });
}

// Check single service health
function checkHealth(service) {
    return new Promise((resolve) => {
        const req = http.get(service.url, { timeout: 5000 }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

// Check all services and alert on failures
async function checkAllServices() {
    const now = Date.now();
    const failures = [];

    for (const service of SERVICES) {
        const online = await checkHealth(service);
        const state = serviceState[service.name];
        const wasOnline = state.online;

        state.online = online;

        // Service went down
        if (wasOnline === true && !online) {
            log(`ALERT: ${service.name} went OFFLINE`);
            failures.push(service);

            if (now - state.lastAlert > ALERT_COOLDOWN) {
                sendToast(
                    `🔴 ${service.name} DOWN`,
                    `Service on port ${service.port} is not responding`,
                    service.critical
                );
                state.lastAlert = now;
            }
        }

        // Service came back up
        if (wasOnline === false && online) {
            log(`RECOVERY: ${service.name} is back ONLINE`);
            sendToast(`🟢 ${service.name} RECOVERED`, `Service is back online`);
        }
    }

    return failures;
}

// Generate status report
function getStatusReport() {
    const report = ['=== HIVE STATUS REPORT ===', `Time: ${new Date().toISOString()}`, ''];

    for (const service of SERVICES) {
        const state = serviceState[service.name];
        const status = state.online === null ? 'UNKNOWN' : (state.online ? 'ONLINE' : 'OFFLINE');
        const icon = state.online ? '🟢' : (state.online === false ? '🔴' : '⚪');
        report.push(`${icon} ${service.name.padEnd(12)} ${status}`);
    }

    return report.join('\n');
}

// Main monitoring loop
async function main() {
    log('Health Alert starting...');

    // Initial check
    await checkAllServices();
    console.log(getStatusReport());

    // Continuous monitoring
    setInterval(async () => {
        await checkAllServices();
    }, 15000); // Check every 15 seconds
}

// CLI commands
if (process.argv[2] === '--status') {
    // Quick one-shot status
    (async () => {
        for (const service of SERVICES) {
            serviceState[service.name].online = await checkHealth(service);
        }
        console.log(getStatusReport());
    })();
} else if (process.argv[2] === '--test-alert') {
    sendToast('🔔 Test Alert', 'Health alert system is working!');
    console.log('Test alert sent');
} else {
    main();
}
