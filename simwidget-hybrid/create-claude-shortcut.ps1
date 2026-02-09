# Create Claude Code Desktop Shortcut with Permissions Bypass
# Target: Desktop (auto-detects current user)

$username = $env:USERNAME
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\Claude Code (GTN750).lnk"

Write-Host "Creating Claude Code shortcut..." -ForegroundColor Cyan

# Create WScript Shell COM object
$WScriptShell = New-Object -ComObject WScript.Shell

# Create shortcut
$Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "C:\Windows\System32\cmd.exe"
$Shortcut.Arguments = "/k cd /d C:\LLM-DevOSWE\simwidget-hybrid\ui\gtn750 && claude --dangerously-skip-permissions"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE\simwidget-hybrid\ui\gtn750"
$Shortcut.Description = "Claude Code for GTN750 development (auto-approve)"
$Shortcut.IconLocation = "C:\Windows\System32\SHELL32.dll,1"  # Document icon
$Shortcut.WindowStyle = 1  # Normal window
$Shortcut.Save()

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Claude Code shortcut created!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $shortcutPath" -ForegroundColor White
Write-Host "Working Directory: C:\LLM-DevOSWE\simwidget-hybrid\ui\gtn750" -ForegroundColor Cyan
Write-Host "Permissions: Auto-approve (--dangerously-skip-permissions)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Double-click 'Claude Code (GTN750)' to start development session!" -ForegroundColor Yellow
Write-Host ""
