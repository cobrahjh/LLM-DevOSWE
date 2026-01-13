# Test Keyboard Shortcut Sending to MSFS
# Run this script while MSFS is running to diagnose keyboard issues

Write-Host "=== SimWidget Keyboard Test ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Find MSFS process
Write-Host "Step 1: Looking for MSFS process..." -ForegroundColor Yellow
$msfs = Get-Process | Where-Object { $_.MainWindowTitle -like '*Flight Simulator*' }

if ($msfs) {
    Write-Host "  FOUND: $($msfs.ProcessName) (PID: $($msfs.Id))" -ForegroundColor Green
    Write-Host "  Window Title: $($msfs.MainWindowTitle)" -ForegroundColor Green
} else {
    Write-Host "  NOT FOUND - trying alternative search..." -ForegroundColor Red
    $msfs = Get-Process | Where-Object { $_.ProcessName -like '*FlightSimulator*' }
    if ($msfs) {
        Write-Host "  FOUND by process name: $($msfs.ProcessName) (PID: $($msfs.Id))" -ForegroundColor Green
    } else {
        Write-Host "  MSFS is not running!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please start MSFS and run this script again." -ForegroundColor Yellow
        exit
    }
}

Write-Host ""

# Step 2: List all processes with "flight" or "simulator" in name
Write-Host "Step 2: All matching processes:" -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like '*flight*' -or $_.ProcessName -like '*simulator*' } | ForEach-Object {
    Write-Host "  - $($_.ProcessName) | PID: $($_.Id) | Title: '$($_.MainWindowTitle)'" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Test focus activation
Write-Host "Step 3: Testing window focus..." -ForegroundColor Yellow
Add-Type -AssemblyName Microsoft.VisualBasic

try {
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Write-Host "  AppActivate succeeded" -ForegroundColor Green
} catch {
    Write-Host "  AppActivate FAILED: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

Write-Host ""

# Step 4: Test SendKeys
Write-Host "Step 4: Sending test keystroke (Alt+Z) in 3 seconds..." -ForegroundColor Yellow
Write-Host "  Make sure MSFS is visible!" -ForegroundColor Cyan
Start-Sleep -Seconds 3

Add-Type -AssemblyName System.Windows.Forms

# Re-focus MSFS
[Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
Start-Sleep -Milliseconds 200

# Send Alt+Z
[System.Windows.Forms.SendKeys]::SendWait('%z')
Write-Host "  Sent Alt+Z (%z)" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Step 5: Sending Alt+X in 2 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

[Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('%x')
Write-Host "  Sent Alt+X (%x)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Did the camera change in MSFS?" -ForegroundColor Yellow
Write-Host "If NO, check your MSFS keybindings for:" -ForegroundColor Yellow
Write-Host "  - Toggle Drone Camera (should be Alt+Z or similar)" -ForegroundColor Gray
Write-Host "  - Next Fixed Camera (should be Alt+X or similar)" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
