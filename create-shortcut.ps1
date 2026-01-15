$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$Desktop\Claude LLM-DevOSWE.lnk")
$Shortcut.TargetPath = "wt.exe"
$Shortcut.Arguments = "-p {11111111-1111-1111-1111-111111111111}"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE"
$Shortcut.Description = "Resume Claude Code in LLM-DevOSWE (Blue Tab)"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created: $Desktop\Claude LLM-DevOSWE.lnk"
Write-Host "Opens Windows Terminal with BLUE tab"
