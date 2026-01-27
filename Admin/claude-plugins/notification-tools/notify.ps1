# Claude Code Notification Hook - Windows Toast Notifications
# Triggers Windows toast notification when Claude Code completes tasks
# Hook type: Notification

param()

$input = $null
try {
    $input = $Input | Out-String
} catch {}

$title = "Claude Code"
$message = "Task completed"

if ($input) {
    try {
        $json = $input | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json.message) { $message = $json.message }
    } catch {
        if ($input -match '"message"\s*:\s*"([^"]*)"') {
            $message = $Matches[1]
        }
    }
}

# Terminal bell
[Console]::Beep(800, 200)

# Windows Toast Notification via PowerShell
try {
    # Try BurntToast module first (best experience)
    if (Get-Module -ListAvailable -Name BurntToast -ErrorAction SilentlyContinue) {
        Import-Module BurntToast
        New-BurntToastNotification -Text $title, $message -AppLogo $null
    } else {
        # Fallback: Windows built-in notification via .NET
        Add-Type -AssemblyName System.Windows.Forms
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.BalloonTipTitle = $title
        $notify.BalloonTipText = $message
        $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $notify.Visible = $true
        $notify.ShowBalloonTip(5000)
        Start-Sleep -Milliseconds 5100
        $notify.Dispose()
    }
} catch {
    # Last resort: simple message box (non-blocking via job)
    Start-Job -ScriptBlock {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($using:message, $using:title, 'OK', 'Information')
    } | Out-Null
}
