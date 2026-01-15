$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$Desktop\Claude LLM-DevOSWE.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/k C:\LLM-DevOSWE\claude-here.bat"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE"
$Shortcut.Description = "Resume Claude Code in LLM-DevOSWE"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created: $Desktop\Claude LLM-DevOSWE.lnk"
Write-Host "Double-click to resume your last Claude session"
