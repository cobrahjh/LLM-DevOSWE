# SimWidget Windows Service Installer
# Requires Administrator privileges
# Version: 1.0.0

param(
    [Parameter(Position=0)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status')]
    [string]$Action = 'status'
)

$ServiceName = "SimWidget"
$DisplayName = "SimWidget MSFS Integration"
$Description = "Widget overlay system for Microsoft Flight Simulator 2024"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodePath = "C:\Program Files\nodejs\node.exe"
$ServerScript = Join-Path $ScriptDir "backend\server.js"
$NssmPath = "C:\nssm\nssm.exe"

function Test-Admin {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-NssmInstalled {
    return (Test-Path $NssmPath) -or (Get-Command nssm -ErrorAction SilentlyContinue)
}

function Get-NssmCommand {
    if (Test-Path $NssmPath) { return $NssmPath }
    if (Get-Command nssm -ErrorAction SilentlyContinue) { return "nssm" }
    return $null
}

function Show-Status {
    $nssm = Get-NssmCommand
    if ($nssm) {
        Write-Host "`n=== $ServiceName Service Status ===" -ForegroundColor Cyan
        & $nssm status $ServiceName 2>$null

        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Service: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running'){'Green'}else{'Yellow'})
            Write-Host "Display Name: $($service.DisplayName)"
            Write-Host "Start Type: $($service.StartType)"
        } else {
            Write-Host "Service not installed" -ForegroundColor Yellow
        }
    } else {
        Write-Host "NSSM not found. Install from https://nssm.cc/" -ForegroundColor Red
    }
}

function Install-SimWidgetService {
    if (-not (Test-Admin)) {
        Write-Host "Error: Administrator privileges required" -ForegroundColor Red
        return
    }

    if (-not (Test-NssmInstalled)) {
        Write-Host "Error: NSSM not found at $NssmPath" -ForegroundColor Red
        Write-Host "Download from: https://nssm.cc/download" -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path $NodePath)) {
        Write-Host "Error: Node.js not found at $NodePath" -ForegroundColor Red
        return
    }

    if (-not (Test-Path $ServerScript)) {
        Write-Host "Error: Server script not found at $ServerScript" -ForegroundColor Red
        return
    }

    $nssm = Get-NssmCommand

    # Check if already installed
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Service already exists. Use 'uninstall' first to reinstall." -ForegroundColor Yellow
        return
    }

    Write-Host "Installing $ServiceName service..." -ForegroundColor Cyan

    # Install service
    & $nssm install $ServiceName $NodePath $ServerScript

    # Configure service
    & $nssm set $ServiceName DisplayName $DisplayName
    & $nssm set $ServiceName Description $Description
    & $nssm set $ServiceName AppDirectory $ScriptDir
    & $nssm set $ServiceName Start SERVICE_AUTO_START
    & $nssm set $ServiceName AppStopMethodSkip 0
    & $nssm set $ServiceName AppStopMethodConsole 3000
    & $nssm set $ServiceName AppStopMethodWindow 3000
    & $nssm set $ServiceName AppStopMethodThreads 1000

    # Configure logging
    $LogDir = Join-Path $ScriptDir "logs"
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir | Out-Null
    }
    & $nssm set $ServiceName AppStdout (Join-Path $LogDir "service-stdout.log")
    & $nssm set $ServiceName AppStderr (Join-Path $LogDir "service-stderr.log")
    & $nssm set $ServiceName AppStdoutCreationDisposition 4
    & $nssm set $ServiceName AppStderrCreationDisposition 4
    & $nssm set $ServiceName AppRotateFiles 1
    & $nssm set $ServiceName AppRotateBytes 1048576

    Write-Host "Service installed successfully!" -ForegroundColor Green
    Write-Host "Use 'start' to start the service" -ForegroundColor Cyan
}

function Uninstall-SimWidgetService {
    if (-not (Test-Admin)) {
        Write-Host "Error: Administrator privileges required" -ForegroundColor Red
        return
    }

    $nssm = Get-NssmCommand
    if (-not $nssm) {
        Write-Host "Error: NSSM not found" -ForegroundColor Red
        return
    }

    Write-Host "Stopping and removing $ServiceName service..." -ForegroundColor Cyan

    # Stop first
    & $nssm stop $ServiceName 2>$null
    Start-Sleep -Seconds 2

    # Remove
    & $nssm remove $ServiceName confirm

    Write-Host "Service removed successfully!" -ForegroundColor Green
}

function Start-SimWidgetService {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "Service not installed. Run 'install' first." -ForegroundColor Yellow
        return
    }

    Write-Host "Starting $ServiceName..." -ForegroundColor Cyan
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 2

    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq 'Running') {
        Write-Host "Service started successfully!" -ForegroundColor Green
        Write-Host "SimWidget available at: http://localhost:8080" -ForegroundColor Cyan
    } else {
        Write-Host "Service failed to start. Check logs." -ForegroundColor Red
    }
}

function Stop-SimWidgetService {
    Write-Host "Stopping $ServiceName..." -ForegroundColor Cyan
    Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
    Write-Host "Service stopped." -ForegroundColor Green
}

function Restart-SimWidgetService {
    Stop-SimWidgetService
    Start-Sleep -Seconds 2
    Start-SimWidgetService
}

# Main
Write-Host "`n=== SimWidget Service Manager ===" -ForegroundColor Magenta

switch ($Action) {
    'install'   { Install-SimWidgetService }
    'uninstall' { Uninstall-SimWidgetService }
    'start'     { Start-SimWidgetService }
    'stop'      { Stop-SimWidgetService }
    'restart'   { Restart-SimWidgetService }
    'status'    { Show-Status }
}

Write-Host ""
