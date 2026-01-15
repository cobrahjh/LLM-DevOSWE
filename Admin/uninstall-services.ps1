# SimWidget Services Uninstaller v2.0.0
# Project: C:\LLM-DevOSWE
# Run as Administrator

param(
    [switch]$KeepMaster
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\LLM-DevOSWE"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SimWidget Services Uninstaller v2.0.0" -ForegroundColor Cyan
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

# Service IDs to uninstall
$ServiceIds = @(
    "simwidgetclaudebridge.exe",
    "simwidgetremotesupport.exe",
    "simwidgetmainserver.exe",
    "simwidgetagent.exe",
    "simwidgetrelay.exe",
    "simwidgetkeysender"
)

if (-not $KeepMaster) {
    $ServiceIds += "simwidgetmastero.exe"
}

Write-Host "Stopping and removing services..." -ForegroundColor Yellow
Write-Host ""

foreach ($svcId in $ServiceIds) {
    $svc = Get-Service -Name $svcId -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Host "Removing: $svcId" -ForegroundColor Cyan

        # Stop if running
        if ($svc.Status -eq 'Running') {
            Write-Host "  Stopping..." -ForegroundColor Gray
            Stop-Service -Name $svcId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }

        # Delete service
        Write-Host "  Deleting..." -ForegroundColor Gray
        & sc.exe delete $svcId | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  SUCCESS: Removed" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: May require reboot to fully remove" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Skipping: $svcId (not installed)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uninstallation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($KeepMaster) {
    Write-Host "Note: Master Orchestrator was kept (--KeepMaster)" -ForegroundColor Yellow
}

Write-Host "To reinstall, run: Admin\install-services.ps1" -ForegroundColor Gray
Write-Host ""
pause
