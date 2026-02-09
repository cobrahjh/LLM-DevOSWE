# SimGlass Server Restart Script
# Run as Administrator

Write-Host "Stopping SimGlass server..." -ForegroundColor Yellow

# Stop all node.exe processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Starting SimGlass server with remote SimConnect config..." -ForegroundColor Cyan
Write-Host "Remote host: 192.168.1.42 (harold-pc)" -ForegroundColor Cyan

# Start server
Set-Location "C:\LLM-DevOSWE\simwidget-hybrid\backend"
Start-Process node -ArgumentList "server.js" -NoNewWindow

Write-Host "`nServer starting..." -ForegroundColor Green
Write-Host "Check status in 5 seconds: curl http://localhost:8080/api/status" -ForegroundColor White

Start-Sleep -Seconds 5

# Check if server started
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 3
    Write-Host "`n✓ Server running: v$($response.version)" -ForegroundColor Green
    Write-Host "✓ Uptime: $($response.uptimeFormatted)" -ForegroundColor Green
    if ($response.simconnect.connected) {
        Write-Host "✓ SimConnect: CONNECTED to harold-pc" -ForegroundColor Green
    } else {
        Write-Host "⚠ SimConnect: Not connected (Mock mode)" -ForegroundColor Yellow
        Write-Host "  Make sure MSFS is running on harold-pc (192.168.1.42)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n✗ Server not responding" -ForegroundColor Red
}
