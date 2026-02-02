$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$toolsDir = "C:\LLM-DevOSWE\Admin\tools"

# Add Task shortcut
$shortcut = $WshShell.CreateShortcut("$desktop\Task - Add.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$toolsDir\tracker-add.ps1`""
$shortcut.WorkingDirectory = $toolsDir
$shortcut.Description = "Add new task to project tracker"
$shortcut.Save()

# Complete Task shortcut
$shortcut = $WshShell.CreateShortcut("$desktop\Task - Complete.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$toolsDir\tracker-complete.ps1`""
$shortcut.WorkingDirectory = $toolsDir
$shortcut.Description = "Complete a task in project tracker"
$shortcut.Save()

# Status shortcut
$shortcut = $WshShell.CreateShortcut("$desktop\Task - Status.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$toolsDir\tracker-status.ps1`""
$shortcut.WorkingDirectory = $toolsDir
$shortcut.Description = "View project tracker status"
$shortcut.Save()

Write-Host "Shortcuts created on desktop:" -ForegroundColor Green
Write-Host "  - Task - Add.lnk"
Write-Host "  - Task - Complete.lnk"
Write-Host "  - Task - Status.lnk"
