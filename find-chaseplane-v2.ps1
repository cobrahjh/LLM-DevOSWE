# Find ChasePlane's exact process name
# Run this with ChasePlane running

Write-Host "=== Finding ChasePlane Process ===" -ForegroundColor Cyan
Write-Host ""

# Get all processes and filter for likely candidates
Write-Host "Processes that might be ChasePlane:" -ForegroundColor Yellow
Get-Process | Where-Object { 
    $_.Path -like '*ChasePlane*' -or
    $_.Path -like '*Parallel*' -or
    $_.Path -like '*p42*' -or
    $_.ProcessName -match 'chase|plane|p42|parallel|42'
} | Format-Table ProcessName, Id, Path -AutoSize

Write-Host ""
Write-Host "All processes with visible windows (for reference):" -ForegroundColor Yellow
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | 
    Select-Object ProcessName, Id, MainWindowTitle | 
    Format-Table -AutoSize

Write-Host ""
Write-Host "If you see ChasePlane above, note its ProcessName." -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
