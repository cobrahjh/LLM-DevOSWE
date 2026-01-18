# Setup Claude Code project launcher
# Usage: .\setup-claude-project.ps1 -Name "ProjectName" -Path "C:\path" -Color "1F" -TabColor "#0066CC" -Guid "{guid}"

param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Path,
    [string]$Color = "1F",
    [string]$TabColor = "#0066CC",
    [string]$Guid = [guid]::NewGuid().ToString()
)

# Generate ASCII art from name (first 4 chars uppercase)
$shortName = $Name.Substring(0, [Math]::Min(4, $Name.Length)).ToUpper()

# Color names
$colorNames = @{
    "1F" = "BLUE"; "2F" = "GREEN"; "4F" = "RED"
    "5F" = "PURPLE"; "6F" = "YELLOW"; "0F" = "BLACK"
}
$colorLabel = if ($colorNames[$Color]) { $colorNames[$Color] } else { $Color }

# Create claude-here.bat
$batContent = @"
@echo off
title Claude Code - $Name
color $Color
cd /d $Path
echo.
echo   === $Name ===
echo   [$colorLabel]
echo.
claude --model opus --resume --dangerously-skip-permissions %*
pause
"@

$batPath = Join-Path $Path "claude-here.bat"
Set-Content -Path $batPath -Value $batContent -Encoding UTF8
Write-Host "Created: $batPath"

# Create project-specific shortcut script
$shortcutContent = @"
`$WshShell = New-Object -ComObject WScript.Shell
`$Desktop = [Environment]::GetFolderPath('Desktop')
`$Shortcut = `$WshShell.CreateShortcut("`$Desktop\Claude $Name.lnk")
`$Shortcut.TargetPath = "wt.exe"
`$Shortcut.Arguments = "-p {$Guid}"
`$Shortcut.WorkingDirectory = "$Path"
`$Shortcut.Description = "Resume Claude Code in $Name ($colorLabel Tab)"
`$Shortcut.WindowStyle = 1
`$Shortcut.Save()
Write-Host "Shortcut created: `$Desktop\Claude $Name.lnk"
"@

$shortcutPath = Join-Path $Path "create-shortcut.ps1"
Set-Content -Path $shortcutPath -Value $shortcutContent -Encoding UTF8
Write-Host "Created: $shortcutPath"

# Output Windows Terminal profile JSON
Write-Host ""
Write-Host "Add this to Windows Terminal settings.json profiles list:"
Write-Host @"
{
    "guid": "{$Guid}",
    "name": "$Name",
    "commandline": "cmd.exe /k $Path\claude-here.bat",
    "startingDirectory": "$Path",
    "tabColor": "$TabColor",
    "hidden": false
}
"@

Write-Host ""
Write-Host "Then run: powershell -ExecutionPolicy Bypass -File `"$shortcutPath`""
