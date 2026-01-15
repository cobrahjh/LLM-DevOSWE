# SimWidget Services Installer v2.0.0
# Project: C:\LLM-DevOSWE
# Run as Administrator
#
# Installs all SimWidget services as Windows Services using node-windows

param(
    [switch]$Force,
    [switch]$SkipMaster
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\LLM-DevOSWE"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SimWidget Services Installer v2.0.0" -ForegroundColor Cyan
Write-Host "  Project: $ProjectRoot" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Find node.exe
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Host "ERROR: Node.js not found in PATH" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "Using Node.js: $NodePath" -ForegroundColor Green

# Service definitions
$Services = @(
    @{
        Id = "simwidgetmastero.exe"
        Name = "SimWidget Master O"
        Description = "SimWidget Master Orchestrator - Service manager"
        Script = "$ProjectRoot\Admin\orchestrator\orchestrator.js"
        WorkDir = "$ProjectRoot\Admin\orchestrator"
        Port = 8500
    },
    @{
        Id = "simwidgetrelay.exe"
        Name = "SimWidget Relay"
        Description = "SimWidget Relay Service - Message queue"
        Script = "$ProjectRoot\Admin\relay\relay-service.js"
        WorkDir = "$ProjectRoot\Admin\relay"
        Port = 8600
    },
    @{
        Id = "simwidgetagent.exe"
        Name = "SimWidget Agent"
        Description = "SimWidget Agent (Kitt) - AI Assistant"
        Script = "$ProjectRoot\Admin\agent\agent-server.js"
        WorkDir = "$ProjectRoot\Admin\agent"
        Port = 8585
    },
    @{
        Id = "simwidgetmainserver.exe"
        Name = "SimWidget Main Server"
        Description = "SimWidget Main Server - Flight sim backend"
        Script = "$ProjectRoot\simwidget-hybrid\backend\server.js"
        WorkDir = "$ProjectRoot\simwidget-hybrid\backend"
        Port = 8080
    },
    @{
        Id = "simwidgetremotesupport.exe"
        Name = "SimWidget Remote Support"
        Description = "SimWidget Remote Support Server"
        Script = "$ProjectRoot\Admin\remote-support\service.js"
        WorkDir = "$ProjectRoot\Admin\remote-support"
        Port = 8590
    },
    @{
        Id = "simwidgetclaudebridge.exe"
        Name = "SimWidget Claude Bridge"
        Description = "SimWidget Claude Bridge - CLI integration"
        Script = "$ProjectRoot\Admin\claude-bridge\bridge-server.js"
        WorkDir = "$ProjectRoot\Admin\claude-bridge"
        Port = 8601
    }
)

# Install node-windows globally if not present
Write-Host "Checking node-windows..." -ForegroundColor Yellow
$nodeWindowsPath = npm list -g node-windows 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing node-windows globally..." -ForegroundColor Yellow
    npm install -g node-windows
}

# Install each service
foreach ($svc in $Services) {
    if ($SkipMaster -and $svc.Id -eq "simwidgetmastero.exe") {
        Write-Host "Skipping Master Orchestrator (--SkipMaster)" -ForegroundColor Gray
        continue
    }

    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "Installing: $($svc.Name)" -ForegroundColor Cyan
    Write-Host "  Script: $($svc.Script)" -ForegroundColor Gray
    Write-Host "  Port: $($svc.Port)" -ForegroundColor Gray
    Write-Host "----------------------------------------" -ForegroundColor Cyan

    # Check if script exists
    if (-not (Test-Path $svc.Script)) {
        Write-Host "  ERROR: Script not found!" -ForegroundColor Red
        continue
    }

    # Check if service already exists
    $existing = Get-Service -Name $svc.Id -ErrorAction SilentlyContinue
    if ($existing) {
        if ($Force) {
            Write-Host "  Service exists, removing..." -ForegroundColor Yellow
            Stop-Service -Name $svc.Id -Force -ErrorAction SilentlyContinue
            & sc.exe delete $svc.Id | Out-Null
            Start-Sleep -Seconds 2
        } else {
            Write-Host "  Service already exists. Use -Force to reinstall." -ForegroundColor Yellow
            continue
        }
    }

    # Create daemon directory
    $daemonDir = Join-Path $svc.WorkDir "daemon"
    if (-not (Test-Path $daemonDir)) {
        New-Item -ItemType Directory -Path $daemonDir -Force | Out-Null
    }

    # Create install script for node-windows
    $globalModules = (npm root -g).Trim()
    $installScript = @"
const Service = require('$($globalModules.Replace("\", "\\"))\\node-windows').Service;
const svc = new Service({
    name: '$($svc.Name)',
    description: '$($svc.Description)',
    script: '$($svc.Script.Replace("\", "\\"))',
    nodeOptions: [],
    workingDirectory: '$($svc.WorkDir.Replace("\", "\\"))'
});
svc.on('install', () => {
    console.log('Service installed, starting...');
    svc.start();
});
svc.on('alreadyinstalled', () => console.log('Already installed'));
svc.on('error', (err) => console.error('Error:', err));
svc.install();
"@

    $tempScript = Join-Path $env:TEMP "install-$($svc.Id).js"
    $installScript | Out-File -FilePath $tempScript -Encoding UTF8

    # Run install
    Push-Location $svc.WorkDir
    try {
        & node $tempScript
        Start-Sleep -Seconds 2

        # Verify
        $installed = Get-Service -Name $svc.Id -ErrorAction SilentlyContinue
        if ($installed) {
            Write-Host "  SUCCESS: Service installed" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Service may not have installed correctly" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
        Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services installed for: $ProjectRoot" -ForegroundColor Gray
Write-Host ""
Write-Host "Quick Commands:" -ForegroundColor Yellow
Write-Host "  Start all:   Get-Service simwidget* | Start-Service"
Write-Host "  Stop all:    Get-Service simwidget* | Stop-Service"
Write-Host "  Status:      Get-Service simwidget*"
Write-Host ""
Write-Host "Or use shortcuts in: $ProjectRoot\shortcuts\" -ForegroundColor Gray
Write-Host ""
pause
