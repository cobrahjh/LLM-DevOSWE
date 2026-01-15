$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$Desktop\Project Tracker.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/k C:\LLM-DevOSWE\Admin\tools\tracker.bat"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE\Admin\tools"
$Shortcut.Description = "Project Task & Feature Tracker"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created: $Desktop\Project Tracker.lnk"
