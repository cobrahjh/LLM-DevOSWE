# Uninstall SimWidget Services v1.0.0
# Last Updated: 2026-01-09
# Run as Administrator

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SimWidget Services Uninstaller" -ForegroundColor Cyan
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

# Service names
$ServiceNames = @("SimWidgetAgent", "SimWidgetEngine", "SimWidgetRemote")

# NSSM path
$NssmPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "tools\nssm.exe"

foreach ($svcName in $ServiceNames) {
    Write-Host ""
    Write-Host "Removing $svcName..." -ForegroundColor Cyan
    
    $service = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Host "  Service not found, skipping" -ForegroundColor Gray
        continue
    }
    
    # Stop service
    if ($service.Status -eq 'Running') {
        Write-Host "  Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Remove using NSSM or sc.exe
    if (Test-Path $NssmPath) {
        & $NssmPath remove $svcName confirm
    } else {
        & sc.exe delete $svcName
    }
    
    Start-Sleep -Seconds 1
    
    # Verify removal
    $removed = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if (-not $removed) {
        Write-Host "  ✓ Service removed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Service removal may require reboot" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Uninstallation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services have been removed." -ForegroundColor Gray
Write-Host "Use Dev Mode for development testing." -ForegroundColor Gray
Write-Host ""

pause
