# Create GTN750 Browser Mode Desktop Shortcut
# Target: harold-pc Desktop

$username = "hjhar"
$desktopPath = "C:\Users\$username\Desktop"
$shortcutPath = "$desktopPath\GTN750 v2.3.0.lnk"
$targetUrl = "http://localhost:8080/ui/gtn750/"

Write-Host "Creating GTN750 desktop shortcut..." -ForegroundColor Cyan

# Create WScript Shell COM object
$WScriptShell = New-Object -ComObject WScript.Shell

# Create shortcut
$Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$Shortcut.Arguments = "--new-window --app=$targetUrl"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE\simwidget-hybrid"
$Shortcut.Description = "GTN750 Glass v2.3.0 - Performance Optimized GPS"
$Shortcut.IconLocation = "C:\Windows\System32\SHELL32.dll,165"  # Globe icon
$Shortcut.Save()

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Desktop shortcut created!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $shortcutPath" -ForegroundColor White
Write-Host "Target: $targetUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Double-click 'GTN750 v2.3.0' on desktop to launch!" -ForegroundColor Yellow
Write-Host ""
