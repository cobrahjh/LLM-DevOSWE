# WASM Camera Prototypes

Testing different WASM patterns to find what works with MSFS 2024.

## Current Problem

Our `simwidget_camera.wasm` is only **1.8 KB** while working addons are **190 KB - 2.2 MB**.

## Reference Addons (by size)

| Addon | Size | Pattern |
|-------|------|---------|
| Navigraph EFB | 190 KB | Datastore |
| Miltech MH60 | 299 KB | Weapons system |
| Fenix Display | 420 KB | Display module |
| FBW systems | 814 KB | Full aircraft |
| Lorby LVar Hook | 990 KB | Pure LVar access |
| Typical Weather | 1.0 MB | Weather module |
| FBW fbw | 1.2 MB | Fly-by-wire |
| Lorby LVar 2024 | 1.3 MB | MSFS 2024 version |
| **Flow Pro** | **1.7 MB** | Widget system |
| MobiFlight | 1.8 MB | Event module |
| WinWing | 2.2 MB | Hardware |

## Prototypes

### proto1_minimal.cpp
Simplest LVar registration using `register_named_variable`.

### proto2_gauge.cpp
Uses gauge_callback pattern with PANEL_SERVICE events.

### proto3_simconnect.cpp
Creates SimConnect client within WASM.

### proto4_commbus.cpp
Uses MSFS CommBus for cross-module communication.

## Building

Run on Harold-PC with MSFS 2024 SDK:

```batch
cd C:\LLM-DevOSWE\wasm-camera\prototypes
build_all.bat
```

## Expected Results

If SDK links correctly, each prototype should be **200KB+** minimum.

If still tiny (~2KB), the issue is:
1. SDK headers not found
2. libmsfs.a not linking
3. Wrong toolchain version

## Debugging

Check the build output for:
- "undefined symbol" warnings
- Missing header errors
- Linker errors

Compare `.obj` size to `.wasm` size - if `.obj` is small, compile failed.
