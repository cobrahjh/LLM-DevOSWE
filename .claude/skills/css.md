# Create Session Shortcut

Create a desktop shortcut to launch Claude Code in this project directory.

1. Create a .bat file or shortcut on desktop
2. Set working directory to C:\LLM-DevOSWE
3. Launch Claude Code with project context

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Claude-LLM-DevOSWE.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/k cd /d C:\LLM-DevOSWE && claude"
$Shortcut.WorkingDirectory = "C:\LLM-DevOSWE"
$Shortcut.Save()
```
