# ChasePlane vJoy Configuration Guide
# SimWidget_Engine - Harold-PC
# v1.0.0 - Last updated: 2026-01-06

## Overview

This guide configures ChasePlane to respond to vJoy virtual joystick buttons,
enabling SimWidget camera controls without keyboard simulation issues.

---

## Prerequisites

1. **vJoy installed** - C:\Program Files\vJoy\
2. **ChasePlane running** - Should detect vJoy as Device 6
3. **SimWidget server** - Running on port 8080

---

## Step 1: Configure vJoy

1. Open **Configure vJoy** from Start Menu
2. Ensure **Device 1** is enabled
3. Set **Number of Buttons** to at least 8
4. Click Apply

---

## Step 2: Bind in ChasePlane

Open ChasePlane and go to **Settings > Controls**

### Bind these vJoy buttons to camera functions:

| vJoy Button | ChasePlane Function       | SimWidget Command |
|-------------|---------------------------|-------------------|
| Button 1    | Toggle Cinematic Mode     | TCM               |
| Button 2    | Next Cinematic View       | NCV               |
| Button 3    | Previous Cinematic View   | PCV               |
| Button 4    | Toggle Internal/External  | VTG               |
| Button 5    | Drone Camera              | DRN               |
| Button 6    | Reset View                | RST               |

### Binding Process:
1. Click on the function you want to bind
2. Click "Bind"
3. Run this test command from PowerShell to press the button:
   ```powershell
   cd C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend
   powershell -ExecutionPolicy Bypass -File vjoy-control.ps1 -Command TCM
   ```
4. ChasePlane should detect "vJoy Button 1"
5. Confirm the binding
6. Repeat for each button

---

## Step 3: Test from SimWidget

### Via REST API:
```bash
curl -X POST http://192.168.1.192:8080/api/camera/cinematic
curl -X POST http://192.168.1.192:8080/api/camera/next
curl -X POST http://192.168.1.192:8080/api/camera/toggle
```

### Via WebSocket:
```javascript
ws.send(JSON.stringify({ type: 'command', command: 'TCM' }));
ws.send(JSON.stringify({ type: 'command', command: 'NCV' }));
```

---

## Troubleshooting

### vJoy not detected by ChasePlane
1. Restart ChasePlane after installing vJoy
2. Check vJoy Monitor to confirm device is active
3. Verify vJoy shows as input device in ChasePlane settings

### Button press not registered
1. Run vJoy Monitor to visualize button presses
2. Ensure vJoy Device 1 is not acquired by another app
3. Check PowerShell execution policy: `Set-ExecutionPolicy RemoteSigned`

### ChasePlane ignores binding
1. Ensure MSFS is running (ChasePlane may need sim connection)
2. Check ChasePlane is not in "Paused" state
3. Verify binding saved correctly

---

## File Locations

| File | Path |
|------|------|
| vJoy control script | C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\vjoy-control.ps1 |
| Camera module | C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\vjoy-camera.js |
| Server | C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\server.js |

---

## Quick Reference

```
SimWidget Button -> vJoy Button -> ChasePlane Function
      TCM       ->    Button 1  -> Toggle Cinematic Mode
      NCV       ->    Button 2  -> Next Cinematic View
      PCV       ->    Button 3  -> Previous Cinematic View
      VTG       ->    Button 4  -> Internal/External Toggle
      DRN       ->    Button 5  -> Drone Camera
      RST       ->    Button 6  -> Reset View
```
