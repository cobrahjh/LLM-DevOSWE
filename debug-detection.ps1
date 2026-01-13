# Test the EXACT command from camera-controller.js
Write-Host "=== Testing Exact Detection Command ===" -ForegroundColor Cyan

$result = Get-Process | Where-Object { $_.Path -like '*ChasePlane*' -or $_.Path -like '*p42-util-chaseplane*' } | Select-Object -First 1 | ForEach-Object { $_.ProcessName }

Write-Host "Result: '$result'" -ForegroundColor Yellow
Write-Host "Length: $($result.Length)" -ForegroundColor Yellow

if ($result.Trim().Length -gt 0) {
    Write-Host "DETECTED!" -ForegroundColor Red
} else {
    Write-Host "NOT detected" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== All processes with paths containing 'chase' or 'p42' ===" -ForegroundColor Cyan
Get-Process | Where-Object { $_.Path -like '*chase*' -or $_.Path -like '*p42*' } | ForEach-Object {
    Write-Host "  $($_.ProcessName): $($_.Path)"
}

Write-Host ""
Write-Host "Press any key..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
