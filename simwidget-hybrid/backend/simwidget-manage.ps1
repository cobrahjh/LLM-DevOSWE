# SimWidget Engine - PowerShell Management Script
# v1.0.0 - Last updated: 2026-01-09
#
# Usage:
#   .\simwidget-manage.ps1 start   - Start the server
#   .\simwidget-manage.ps1 stop    - Stop the server
#   .\simwidget-manage.ps1 restart - Restart the server
#   .\simwidget-manage.ps1 status  - Check server status

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'status'
)

$ServerPath = "C:\LLM-DevOSWE\simwidget-hybrid\backend"
$Port = 8080

function Get-SimWidgetStatus {
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

function Start-SimWidget {
    $status = Get-SimWidgetStatus
    if ($status.Running) {
        Write-Host "SimWidget already running (PID: $($status.PID))" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Starting SimWidget Engine..." -ForegroundColor Cyan
    Push-Location $ServerPath
    Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Minimized
    Pop-Location
    
    Start-Sleep -Seconds 2
    $status = Get-SimWidgetStatus
    if ($status.Running) {
        Write-Host "SimWidget started successfully (PID: $($status.PID))" -ForegroundColor Green
    } else {
        Write-Host "Failed to start SimWidget" -ForegroundColor Red
    }
}

function Stop-SimWidget {
    $status = Get-SimWidgetStatus
    if (-not $status.Running) {
        Write-Host "SimWidget is not running" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Stopping SimWidget (PID: $($status.PID))..." -ForegroundColor Cyan
    Stop-Process -Id $status.PID -Force -ErrorAction SilentlyContinue
    Write-Host "SimWidget stopped" -ForegroundColor Green
}

function Show-Status {
    $status = Get-SimWidgetStatus
    if ($status.Running) {
        Write-Host "SimWidget Engine: " -NoNewline
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
        Write-Host "SimWidget Engine: " -NoNewline
        Write-Host "STOPPED" -ForegroundColor Red
    }
}

# Execute action
switch ($Action) {
    'start'   { Start-SimWidget }
    'stop'    { Stop-SimWidget }
    'restart' { Stop-SimWidget; Start-Sleep -Seconds 1; Start-SimWidget }
    'status'  { Show-Status }
}
