# Find what P42 process is being detected
Write-Host "=== What's Being Detected ===" -ForegroundColor Cyan

$processes = Get-Process | Where-Object { 
    $_.ProcessName -match 'chase|p42|parallel' -or 
    $_.MainWindowTitle -match 'ChasePlane' 
}

if ($processes) {
    foreach ($p in $processes) {
        Write-Host "Process: $($p.ProcessName)" -ForegroundColor Yellow
        Write-Host "  PID: $($p.Id)"
        Write-Host "  Path: $($p.Path)"
        Write-Host "  Window: $($p.MainWindowTitle)"
        Write-Host ""
    }
} else {
    Write-Host "Nothing matched!" -ForegroundColor Green
}

Write-Host "Press any key..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
