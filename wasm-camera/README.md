# SimWidget Camera WASM Module

**Version:** 0.2.0  
**Last Updated:** 2026-01-08

## Overview

Custom WASM module for smooth camera control in MSFS 2024. Runs inside the simulator at 30-60Hz for per-frame camera updates with smooth interpolation.

## Architecture

```
SimWidget Server (Node.js)
    ↓ WebSocket commands
Camera Bridge (camera-bridge.js)
    ↓ LVar write via SimConnect
WASM Module (runs inside MSFS at ~60Hz)
    ↓ Per-frame updates, writes relative offsets to LVars
Camera Bridge
    ↓ Reads LVars, calls SimConnect_CameraSetRelative6DOF
Drone Camera (smooth interpolation)
```

## Communication Protocol

### LVars (Server → WASM)

| LVar | Type | Description |
|------|------|-------------|
| `L:SIMWIDGET_CAM_CMD` | Number | Command: 0=none, 1=flyby, 3=toggle, 4=next, 5=reset |
| `L:SIMWIDGET_CAM_SMOOTH` | Number | Smoothing factor 0-100 |

### LVars (WASM → Server)

| LVar | Type | Description |
|------|------|-------------|
| `L:SIMWIDGET_CAM_READY` | Number | 1 when WASM initialized |
| `L:SIMWIDGET_CAM_STATUS` | Number | Current mode (0=off, 2=flyby) |
| `L:SIMWIDGET_CAM_REL_X/Y/Z` | Number | Relative offset from aircraft (feet) |
| `L:SIMWIDGET_CAM_REL_PITCH` | Number | Camera pitch offset (degrees) |
| `L:SIMWIDGET_CAM_REL_HDG` | Number | Camera heading offset (degrees) |

## Building

### Prerequisites

- MSFS 2024 SDK (C:\MSFS 2024 SDK)
- Visual Studio 2022 with MSFS plugin installed

### Option 1: Visual Studio

1. Open `SimWidgetCamera.sln`
2. Select Release|MSFS
3. Build Solution

### Option 2: Command Line

Run `build_v4.bat` from Harold-PC:

```batch
cd C:\LLM-DevOSWE\SimWidget_Engine\wasm-camera
build_v4.bat
```

### Output

- `build/simwidget_camera.wasm` - Compiled module
- `package/simwidget-camera/` - MSFS Community package

## Installation

1. Build the WASM module
2. Copy `package/simwidget-camera/` to MSFS Community folder:
   - Steam: `%APPDATA%\Microsoft Flight Simulator\Packages\Community\`
   - MS Store: `%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community\`
3. Restart MSFS

## Flyby Presets

| # | Distance | Alt Offset | Angle | Description |
|---|----------|------------|-------|-------------|
| 1 | 2000ft | -100ft | 45° | Side front left |
| 2 | 3000ft | -200ft | -90° | Side right |
| 3 | 1500ft | 0ft | 180° | Behind |
| 4 | 4000ft | -500ft | 30° | Far front left low |
| 5 | 2500ft | +200ft | -45° | Front right high |

## Server Integration

```javascript
const CameraBridge = require('./camera-bridge');
const bridge = new CameraBridge(simConnect);
await bridge.init();

// Start flyby
await bridge.startFlyby();

// Next position
await bridge.nextPosition();

// Reset
await bridge.resetCamera();
```

## Files

```
wasm-camera/
├── src/
│   └── simwidget_camera.cpp    # WASM source
├── build/                       # Compiled output
├── package/
│   └── simwidget-camera/       # MSFS Community package
│       ├── manifest.json
│       ├── layout.json
│       ├── module.xml
│       └── Modules/
│           └── simwidget_camera.wasm
├── build_v4.bat                # Build script
├── SimWidgetCamera.sln         # VS solution
└── README.md
```
