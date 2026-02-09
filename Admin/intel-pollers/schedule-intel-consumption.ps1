# Schedule Intel Consumption - Windows Task Scheduler Setup
# Creates scheduled tasks for automated intel collection and consumption

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status
)

$TaskNameCollect = "Hive-IntelCollect"
$TaskNameConsume = "Hive-IntelConsume"
$ScriptPath = $PSScriptRoot
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $NodePath) {
    Write-Error "Node.js not found in PATH. Please install Node.js first."
    exit 1
}

function Install-IntelTasks {
    Write-Host "Installing Intel Automation Tasks..." -ForegroundColor Cyan

    # Task 1: Intel Collection (every 6 hours)
    $ActionCollect = New-ScheduledTaskAction `
        -Execute $NodePath `
        -Argument "`"$ScriptPath\daily-intel-curator.js`" --collect" `
        -WorkingDirectory $ScriptPath

    $TriggerCollect = @(
        New-ScheduledTaskTrigger -Daily -At "03:00AM"
        New-ScheduledTaskTrigger -Daily -At "09:00AM"
        New-ScheduledTaskTrigger -Daily -At "03:00PM"
        New-ScheduledTaskTrigger -Daily -At "09:00PM"
    )

    $SettingsCollect = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable

    Register-ScheduledTask `
        -TaskName $TaskNameCollect `
        -Action $ActionCollect `
        -Trigger $TriggerCollect `
        -Settings $SettingsCollect `
        -Description "Hive Intel Collection - Fetch and analyze tech news every 6 hours" `
        -Force

    Write-Host "  + $TaskNameCollect created (runs every 6 hours)" -ForegroundColor Green

    # Task 2: Intel Consumption (daily at 8 AM)
    $ActionConsume = New-ScheduledTaskAction `
        -Execute $NodePath `
        -Argument "`"$ScriptPath\intel-consumer.js`" --consume" `
        -WorkingDirectory $ScriptPath

    $TriggerConsume = New-ScheduledTaskTrigger -Daily -At "08:00AM"

    $SettingsConsume = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable

    Register-ScheduledTask `
        -TaskName $TaskNameConsume `
        -Action $ActionConsume `
        -Trigger $TriggerConsume `
        -Settings $SettingsConsume `
        -Description "Hive Intel Consumption - Generate briefing and auto-queue high-priority items" `
        -Force

    Write-Host "  + $TaskNameConsume created (runs daily at 8 AM)" -ForegroundColor Green

    Write-Host "`nTasks installed successfully!" -ForegroundColor Green
    Write-Host "`nSchedule:" -ForegroundColor Yellow
    Write-Host "  - Intel collection: Every 6 hours (3 AM, 9 AM, 3 PM, 9 PM)"
    Write-Host "  - Intel consumption: Daily at 8 AM"
    Write-Host "`nManage tasks:"
    Write-Host "  - View: taskschd.msc"
    Write-Host "  - Run now: schtasks /run /tn `"$TaskNameCollect`""
    Write-Host "  - Disable: schtasks /change /tn `"$TaskNameCollect`" /disable"
}

function Uninstall-IntelTasks {
    Write-Host "Uninstalling Intel Automation Tasks..." -ForegroundColor Cyan

    try {
        Unregister-ScheduledTask -TaskName $TaskNameCollect -Confirm:$false -ErrorAction Stop
        Write-Host "  + $TaskNameCollect removed" -ForegroundColor Green
    } catch {
        Write-Host "  i $TaskNameCollect not found" -ForegroundColor Gray
    }

    try {
        Unregister-ScheduledTask -TaskName $TaskNameConsume -Confirm:$false -ErrorAction Stop
        Write-Host "  + $TaskNameConsume removed" -ForegroundColor Green
    } catch {
        Write-Host "  i $TaskNameConsume not found" -ForegroundColor Gray
    }

    Write-Host "`nTasks uninstalled." -ForegroundColor Green
}

function Show-TaskStatus {
    Write-Host "Intel Automation Status" -ForegroundColor Cyan
    Write-Host "=" * 60

    $taskCollect = Get-ScheduledTask -TaskName $TaskNameCollect -ErrorAction SilentlyContinue
    $taskConsume = Get-ScheduledTask -TaskName $TaskNameConsume -ErrorAction SilentlyContinue

    if ($taskCollect) {
        $infoCollect = Get-ScheduledTaskInfo -TaskName $TaskNameCollect
        Write-Host ""
        Write-Host $TaskNameCollect -ForegroundColor Yellow
        Write-Host "  State: $($taskCollect.State)"
        Write-Host "  Last Run: $($infoCollect.LastRunTime)"
        Write-Host "  Last Result: $($infoCollect.LastTaskResult)"
        Write-Host "  Next Run: $($infoCollect.NextRunTime)"
    } else {
        Write-Host ""
        Write-Host "$TaskNameCollect NOT INSTALLED" -ForegroundColor Red
    }

    if ($taskConsume) {
        $infoConsume = Get-ScheduledTaskInfo -TaskName $TaskNameConsume
        Write-Host ""
        Write-Host $TaskNameConsume -ForegroundColor Yellow
        Write-Host "  State: $($taskConsume.State)"
        Write-Host "  Last Run: $($infoConsume.LastRunTime)"
        Write-Host "  Last Result: $($infoConsume.LastTaskResult)"
        Write-Host "  Next Run: $($infoConsume.NextRunTime)"
    } else {
        Write-Host ""
        Write-Host "$TaskNameConsume NOT INSTALLED" -ForegroundColor Red
    }

    # Check consumption status via API
    Write-Host ""
    Write-Host "Consumption Status (API):" -ForegroundColor Yellow
    try {
        $status = Invoke-RestMethod -Uri "http://localhost:3002/api/intel/curated/consumption-status" -ErrorAction Stop
        $lastBriefing = if ($status.lastBriefing) { $status.lastBriefing } else { 'Never' }
        $lastAutoQueue = if ($status.lastAutoQueue) { $status.lastAutoQueue } else { 'Never' }
        Write-Host "  Last Briefing: $lastBriefing"
        Write-Host "  Last Auto-Queue: $lastAutoQueue"
        Write-Host "  Total Briefings: $($status.totalBriefings)"
        Write-Host "  Total Queued: $($status.totalQueued)"
        Write-Host "  Approved Items: $($status.approvedItems)"
        Write-Host "  Unqueued High-Priority: $($status.unqueuedHighPriority)"
    } catch {
        Write-Host "  x Oracle not responding (is it running?)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host ("=" * 60)
}

# Main
if ($Install) {
    Install-IntelTasks
} elseif ($Uninstall) {
    Uninstall-IntelTasks
} elseif ($Status) {
    Show-TaskStatus
} else {
    Write-Host @"

Schedule Intel Consumption - Setup Script
==========================================

Usage:
  .\schedule-intel-consumption.ps1 -Install    # Create scheduled tasks
  .\schedule-intel-consumption.ps1 -Uninstall  # Remove scheduled tasks
  .\schedule-intel-consumption.ps1 -Status     # View task status

Tasks:
  1. Hive-IntelCollect  - Fetch intel every 6 hours (3 AM, 9 AM, 3 PM, 9 PM)
  2. Hive-IntelConsume  - Process intel daily at 8 AM (briefing + auto-queue)

Manual Testing:
  node daily-intel-curator.js --collect       # Collect intel now
  node intel-consumer.js --consume            # Consume intel now
  node intel-consumer.js --status             # Check consumption status

"@
}
