@echo off
echo Starting bridge with ID=%1 URL=%2 Title=%3
echo Script path: %~dp0wt-bridge.ps1
powershell -NoLogo -ExecutionPolicy Bypass -File "%~dp0wt-bridge.ps1" -TerminalId %1 -HubUrl %2 -Title "%~3"
if errorlevel 1 (
    echo ERROR: PowerShell script failed
    pause
)
