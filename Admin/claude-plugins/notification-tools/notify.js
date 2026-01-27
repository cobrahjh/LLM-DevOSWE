// Claude Code Notification Hook - Node.js version (cross-platform)
// Triggers Windows toast notification when Claude Code completes tasks
// Usage: node notify.js (reads JSON from stdin)

const { exec } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    let message = 'Task completed';
    try {
        const data = JSON.parse(input);
        if (data.message) message = data.message;
    } catch {}

    // Terminal bell
    process.stdout.write('\x07');

    // Windows toast via PowerShell (no external modules needed)
    const ps = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;
        $xml = [Windows.Data.Xml.Dom.XmlDocument]::new();
        $xml.LoadXml('<toast><visual><binding template="ToastText02"><text id="1">Claude Code</text><text id="2">${message.replace(/'/g, "''")}</text></binding></visual></toast>');
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml);
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($toast);
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${ps}"`, (err) => {
        if (err) {
            // Fallback: simple balloon notification
            exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.BalloonTipTitle = 'Claude Code'; $n.BalloonTipText = '${message.replace(/'/g, "''")}'; $n.Visible = $true; $n.ShowBalloonTip(3000); Start-Sleep -Seconds 4; $n.Dispose()"`, () => {});
        }
    });
});
