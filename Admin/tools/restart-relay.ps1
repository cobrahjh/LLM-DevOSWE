$conn = Get-NetTCPConnection -LocalPort 8600 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Stopping relay (PID: $($conn.OwningProcess))..."
    Stop-Process -Id $conn.OwningProcess -Force
    Start-Sleep -Seconds 2
}

Write-Host "Starting relay..."
Set-Location "C:\LLM-DevOSWE\Admin\relay"
$proc = Start-Process -FilePath "node" -ArgumentList "relay-service.js" -PassThru -WindowStyle Hidden
Write-Host "Started relay with PID: $($proc.Id)"
Start-Sleep -Seconds 3

$health = Invoke-RestMethod -Uri "http://localhost:8600/api/health" -TimeoutSec 5
Write-Host "Health: $($health.status)"
