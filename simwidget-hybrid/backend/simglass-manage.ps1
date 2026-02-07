# SimGlass Engine - PowerShell Management Script
# v1.0.0 - Last updated: 2026-01-09
#
# Usage:
#   .\SimGlass-manage.ps1 start   - Start the server
#   .\SimGlass-manage.ps1 stop    - Stop the server
#   .\SimGlass-manage.ps1 restart - Restart the server
#   .\SimGlass-manage.ps1 status  - Check server status

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'status'
)

$ServerPath = "C:\LLM-DevOSWE\simwidget-hybrid\backend"
$Port = 8080

function Get-SimGlassStatus {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        return @{
            Running = $true
            PID = $conn.OwningProcess
            ProcessName = $proc.ProcessName
        }
    }
    return @{ Running = $false }
}

function Start-SimGlass {
    $status = Get-SimGlassStatus
    if ($status.Running) {
        Write-Host "SimGlass already running (PID: $($status.PID))" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Starting SimGlass Engine..." -ForegroundColor Cyan
    Push-Location $ServerPath
    Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Minimized
    Pop-Location
    
    Start-Sleep -Seconds 2
    $status = Get-SimGlassStatus
    if ($status.Running) {
        Write-Host "SimGlass started successfully (PID: $($status.PID))" -ForegroundColor Green
    } else {
        Write-Host "Failed to start SimGlass" -ForegroundColor Red
    }
}

function Stop-SimGlass {
    $status = Get-SimGlassStatus
    if (-not $status.Running) {
        Write-Host "SimGlass is not running" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Stopping SimGlass (PID: $($status.PID))..." -ForegroundColor Cyan
    Stop-Process -Id $status.PID -Force -ErrorAction SilentlyContinue
    Write-Host "SimGlass stopped" -ForegroundColor Green
}

function Show-Status {
    $status = Get-SimGlassStatus
    if ($status.Running) {
        Write-Host "SimGlass Engine: " -NoNewline
        Write-Host "RUNNING" -ForegroundColor Green
        Write-Host "  PID: $($status.PID)"
        Write-Host "  Port: $Port"
        Write-Host "  URL: http://localhost:$Port"
        
        # Check MSFS connection
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$Port/api/status" -TimeoutSec 2
            if ($response.connected) {
                Write-Host "  MSFS: " -NoNewline
                Write-Host "CONNECTED" -ForegroundColor Green
            } else {
                Write-Host "  MSFS: " -NoNewline
                Write-Host "MOCK MODE" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  API: " -NoNewline
            Write-Host "NOT RESPONDING" -ForegroundColor Red
        }
    } else {
        Write-Host "SimGlass Engine: " -NoNewline
        Write-Host "STOPPED" -ForegroundColor Red
    }
}

# Execute action
switch ($Action) {
    'start'   { Start-SimGlass }
    'stop'    { Stop-SimGlass }
    'restart' { Stop-SimGlass; Start-Sleep -Seconds 1; Start-SimGlass }
    'status'  { Show-Status }
}
