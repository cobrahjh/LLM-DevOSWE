# SimWidget MSFS 2024 Auto-Launch Addon
v1.0.0 - Last updated: 2026-01-09

## Overview
This addon automatically starts the SimWidget Engine server when MSFS 2024 launches.

## Installation

### Option 1: Copy exe.xml (Recommended)
1. Locate your MSFS 2024 exe.xml location:
   - **MS Store**: `%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\exe.xml`
   - **Steam**: `%APPDATA%\Microsoft Flight Simulator 2024\exe.xml`

2. If `exe.xml` doesn't exist, copy the entire file from this folder.

3. If `exe.xml` already exists, add this entry inside `<SimBase.Document>`:
   ```xml
   <Launch.Addon>
     <n>SimWidget Engine</n>
     <Disabled>false</Disabled>
     <ManualLoad>false</ManualLoad>
     <Path>C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\start-simwidget.bat</Path>
   </Launch.Addon>
   ```

### Option 2: Symlink (Advanced)
```powershell
# MS Store version
$exePath = "$env:LOCALAPPDATA\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache"
Copy-Item "C:\LLM-DevOSWE\SimWidget_Engine\Admin\msfs-addon\exe.xml" "$exePath\exe.xml"
```

## Manual Control

### Batch Files (Double-click)
- `start-simwidget.bat` - Start server
- `stop-simwidget.bat` - Stop server

### PowerShell (Full control)
```powershell
cd C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend

# Start
.\simwidget-manage.ps1 start

# Stop
.\simwidget-manage.ps1 stop

# Restart
.\simwidget-manage.ps1 restart

# Status
.\simwidget-manage.ps1 status
```

## Verify Installation
1. Start MSFS 2024
2. Check `http://localhost:8080` in browser
3. Should show SimWidget Engine homepage

## Troubleshooting
- **Server not starting**: Check if port 8080 is in use
- **MOCK mode**: Start server AFTER MSFS is running with aircraft loaded
- **exe.xml not working**: Verify path in exe.xml matches actual location
