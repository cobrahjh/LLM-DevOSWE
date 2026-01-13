# Install SimWidget Services v1.0.0
# Last Updated: 2026-01-09
# Run as Administrator

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SimWidget Services Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Define paths
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = $BaseDir
$SimWidgetDir = Join-Path $BaseDir "..\..\simwidget-hybrid\backend"
$RemoteDir = Join-Path $BaseDir "..\remote-support"

# Service definitions
$Services = @(
    @{
        Name = "SimWidgetAgent"
        DisplayName = "SimWidget Agent Service"
        Description = "SimWidget AI Development Assistant"
        Script = Join-Path $AgentDir "agent-server.js"
        Port = 8585
    },
    @{
        Name = "SimWidgetEngine"
        DisplayName = "SimWidget Engine Service"
        Description = "SimWidget Flight Simulation Backend"
        Script = Join-Path $SimWidgetDir "server.js"
        Port = 8080
    },
    @{
        Name = "SimWidgetRemote"
        DisplayName = "SimWidget Remote Support Service"
        Description = "SimWidget Remote Support Server"
        Script = Join-Path $RemoteDir "server.js"
        Port = 8590
    }
)

# Find node.exe
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Host "ERROR: Node.js not found in PATH" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "Using Node.js: $NodePath" -ForegroundColor Green

# Install nssm if not present (Non-Sucking Service Manager)
$NssmPath = Join-Path $AgentDir "tools\nssm.exe"
$NssmDir = Join-Path $AgentDir "tools"

if (-not (Test-Path $NssmPath)) {
    Write-Host "Downloading NSSM (service wrapper)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $NssmDir -Force | Out-Null
    
    $NssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $NssmZip = Join-Path $env:TEMP "nssm.zip"
    
    try {
        Invoke-WebRequest -Uri $NssmUrl -OutFile $NssmZip
        Expand-Archive -Path $NssmZip -DestinationPath $env:TEMP -Force
        Copy-Item "$env:TEMP\nssm-2.24\win64\nssm.exe" $NssmPath
        Remove-Item $NssmZip -Force
        Remove-Item "$env:TEMP\nssm-2.24" -Recurse -Force
        Write-Host "NSSM downloaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not download NSSM, using sc.exe instead" -ForegroundColor Yellow
        $NssmPath = $null
    }
}

# Install each service
foreach ($svc in $Services) {
    Write-Host ""
    Write-Host "Installing $($svc.DisplayName)..." -ForegroundColor Cyan
    
    # Check if service exists
    $existing = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Service already exists, removing..." -ForegroundColor Yellow
        Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
        & sc.exe delete $svc.Name | Out-Null
        Start-Sleep -Seconds 2
    }
    
    # Check script exists
    if (-not (Test-Path $svc.Script)) {
        Write-Host "  ERROR: Script not found: $($svc.Script)" -ForegroundColor Red
        continue
    }
    
    # Install using NSSM or sc.exe
    if ($NssmPath -and (Test-Path $NssmPath)) {
        & $NssmPath install $svc.Name $NodePath $svc.Script
        & $NssmPath set $svc.Name DisplayName $svc.DisplayName
        & $NssmPath set $svc.Name Description $svc.Description
        & $NssmPath set $svc.Name AppDirectory (Split-Path $svc.Script)
        & $NssmPath set $svc.Name Start SERVICE_AUTO_START
        & $NssmPath set $svc.Name AppStdout (Join-Path $AgentDir "logs\$($svc.Name)-stdout.log")
        & $NssmPath set $svc.Name AppStderr (Join-Path $AgentDir "logs\$($svc.Name)-stderr.log")
        & $NssmPath set $svc.Name AppRotateFiles 1
        & $NssmPath set $svc.Name AppRotateBytes 1048576
    } else {
        # Fallback to sc.exe (limited functionality)
        $binPath = "`"$NodePath`" `"$($svc.Script)`""
        & sc.exe create $svc.Name binPath= $binPath DisplayName= $svc.DisplayName start= auto
        & sc.exe description $svc.Name $svc.Description
    }
    
    # Verify installation
    $installed = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($installed) {
        Write-Host "  ✓ Service installed successfully" -ForegroundColor Green
        Write-Host "  Port: $($svc.Port)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Service installation failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  Start all:   Start-Service SimWidget*"
Write-Host "  Stop all:    Stop-Service SimWidget*"
Write-Host "  Status:      Get-Service SimWidget*"
Write-Host ""
Write-Host "Or use Admin Kit UI for service control" -ForegroundColor Gray
Write-Host ""

pause
