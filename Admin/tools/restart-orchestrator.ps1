$conn = Get-NetTCPConnection -LocalPort 8500 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force
    Start-Sleep -Seconds 2
}
Start-Process -FilePath "node" -ArgumentList "orchestrator.js" -WorkingDirectory "C:\LLM-DevOSWE\Admin\orchestrator" -WindowStyle Hidden
Start-Sleep -Seconds 3
Invoke-RestMethod -Uri "http://localhost:8500/api/health" -TimeoutSec 5
