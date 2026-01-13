# Test sending keys to ChasePlane window directly
# Maybe ChasePlane only listens when its own window has focus

Write-Host "=== ChasePlane Direct Input Test ===" -ForegroundColor Cyan

# Find ChasePlane process
Write-Host "Looking for ChasePlane..." -ForegroundColor Yellow
$cp = Get-Process | Where-Object { $_.ProcessName -like '*ChasePlane*' -or $_.MainWindowTitle -like '*ChasePlane*' }

if ($cp) {
    Write-Host "Found: $($cp.ProcessName) (PID: $($cp.Id))" -ForegroundColor Green
    Write-Host "Window Title: '$($cp.MainWindowTitle)'" -ForegroundColor Green
} else {
    Write-Host "ChasePlane process not found by name, listing all processes with windows..." -ForegroundColor Yellow
    Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
        if ($_.ProcessName -like '*42*' -or $_.ProcessName -like '*chase*' -or $_.ProcessName -like '*parallel*') {
            Write-Host "  - $($_.ProcessName) | PID: $($_.Id) | Title: '$($_.MainWindowTitle)'" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "All processes with 'chase', 'plane', 'p42', or 'parallel' in name:" -ForegroundColor Yellow
Get-Process | Where-Object { 
    $_.ProcessName -like '*chase*' -or 
    $_.ProcessName -like '*plane*' -or 
    $_.ProcessName -like '*p42*' -or 
    $_.ProcessName -like '*parallel*'
} | ForEach-Object {
    Write-Host "  - $($_.ProcessName) | PID: $($_.Id) | Title: '$($_.MainWindowTitle)'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
