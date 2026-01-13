# SimWidget Auto-Deploy Scripts v1.0.0
# One-click server restart and deployment tools
#
# Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\deploy.ps1
# Last Updated: 2025-01-07
#
# Usage:
#   .\deploy.ps1           - Restart server
#   .\deploy.ps1 -Status   - Check server status
#   .\deploy.ps1 -Stop     - Stop server only
#   .\deploy.ps1 -Logs     - Show recent logs
#   .\deploy.ps1 -Pull     - Git pull and restart

param(
    [switch]$Status,
    [switch]$Stop,
    [switch]$Logs,
    [switch]$Pull,
    [switch]$Help
)

$ServerDir = "C:\LLM-DevOSWE\simwidget-hybrid"
$ServerPort = 8080
$LogFile = "$ServerDir\server.log"

function Write-Header {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     SimWidget Auto-Deploy v1.0.0          ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Get-ServerProcess {
    # Find node process running on port 8080
    $conn = Get-NetTCPConnection -LocalPort $ServerPort -ErrorAction SilentlyContinue | 
            Where-Object { $_.State -eq 'Listen' } | 
            Select-Object -First 1
    
    if ($conn) {
        return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

function Show-Status {
    Write-Header
    $proc = Get-ServerProcess
    
    if ($proc) {
        Write-Host "✅ Server RUNNING" -ForegroundColor Green
        Write-Host "   PID: $($proc.Id)"
        Write-Host "   Port: $ServerPort"
        Write-Host "   Uptime: $([math]::Round((Get-Date) - $proc.StartTime).TotalMinutes, 1)) minutes"
        Write-Host "   URL: http://localhost:$ServerPort"
    } else {
        Write-Host "❌ Server STOPPED" -ForegroundColor Red
    }
    Write-Host ""
}

function Stop-Server {
    Write-Host "⏹ Stopping server..." -ForegroundColor Yellow
    
    $proc = Get-ServerProcess
    if ($proc) {
        # Kill the process tree (nodemon + node)
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        
        # Also kill any orphaned node processes in the server directory
        Get-Process -Name "node" -ErrorAction SilentlyContinue | 
            Where-Object { $_.Path -like "*SimWidget*" } | 
            Stop-Process -Force -ErrorAction SilentlyContinue
        
        Start-Sleep -Milliseconds 500
        Write-Host "✅ Server stopped" -ForegroundColor Green
    } else {
        Write-Host "ℹ Server was not running" -ForegroundColor Gray
    }
}

function Start-Server {
    Write-Host "▶ Starting server..." -ForegroundColor Yellow
    
    Push-Location $ServerDir
    
    # Start with nodemon in a new window
    $startInfo = @{
        FilePath = "cmd.exe"
        ArgumentList = "/c", "cd /d `"$ServerDir`" && npx nodemon backend/server.js"
        WindowStyle = "Minimized"
    }
    
    Start-Process @startInfo
    
    Pop-Location
    
    # Wait for server to start
    Write-Host "   Waiting for server..." -NoNewline
    $attempts = 0
    $maxAttempts = 10
    
    while ($attempts -lt $maxAttempts) {
        Start-Sleep -Milliseconds 500
        $proc = Get-ServerProcess
        if ($proc) {
            Write-Host " Ready!" -ForegroundColor Green
            Write-Host ""
            Write-Host "✅ Server started successfully" -ForegroundColor Green
            Write-Host "   PID: $($proc.Id)"
            Write-Host "   URL: http://localhost:$ServerPort"
            return $true
        }
        Write-Host "." -NoNewline
        $attempts++
    }
    
    Write-Host " Timeout" -ForegroundColor Red
    Write-Host "❌ Server failed to start" -ForegroundColor Red
    return $false
}

function Restart-Server {
    Write-Header
    Stop-Server
    Write-Host ""
    Start-Server
}

function Show-Logs {
    Write-Header
    Write-Host "📜 Recent server output:" -ForegroundColor Cyan
    Write-Host ""
    
    # Get node process and show recent console output
    $proc = Get-ServerProcess
    if ($proc) {
        Write-Host "(Server is running - check the server window for live logs)" -ForegroundColor Gray
    } else {
        Write-Host "(Server is not running)" -ForegroundColor Gray
    }
}

function Update-AndRestart {
    Write-Header
    Write-Host "📥 Pulling latest changes..." -ForegroundColor Yellow
    
    Push-Location $ServerDir
    
    $gitResult = git pull 2>&1
    Write-Host $gitResult
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Git pull successful" -ForegroundColor Green
        Write-Host ""
        Stop-Server
        Write-Host ""
        Start-Server
    } else {
        Write-Host "❌ Git pull failed" -ForegroundColor Red
    }
    
    Pop-Location
}

function Show-Help {
    Write-Header
    Write-Host "Usage: .\deploy.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  (none)     Restart server (stop + start)"
    Write-Host "  -Status    Show server status"
    Write-Host "  -Stop      Stop server only"
    Write-Host "  -Logs      Show recent logs"
    Write-Host "  -Pull      Git pull and restart"
    Write-Host "  -Help      Show this help"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\deploy.ps1"
    Write-Host "  .\deploy.ps1 -Status"
    Write-Host "  .\deploy.ps1 -Pull"
    Write-Host ""
}

# Main
if ($Help) {
    Show-Help
} elseif ($Status) {
    Show-Status
} elseif ($Stop) {
    Write-Header
    Stop-Server
} elseif ($Logs) {
    Show-Logs
} elseif ($Pull) {
    Update-AndRestart
} else {
    Restart-Server
}

Write-Host ""
