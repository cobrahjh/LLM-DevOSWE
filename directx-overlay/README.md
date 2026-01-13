# SimWidget DirectX Overlay

True DirectX overlay for MSFS that works in **exclusive fullscreen** mode!

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      MSFS Process                           │
│                                                             │
│  Game Rendering ──► DirectX 11 ──► Present() ──► Screen    │
│                          │                                  │
│                    [OUR HOOK]                               │
│                          │                                  │
│                   SimWidget draws                           │
│                   overlay on frame                          │
└─────────────────────────────────────────────────────────────┘
```

1. **SimWidgetInjector** injects our DLL into the MSFS process
2. **SimWidgetOverlay** hooks DirectX `Present()` function
3. Every frame, we draw our overlay using Direct2D
4. Data comes from our WebSocket server (SimConnect bridge)

## Requirements

- .NET 7.0 SDK
- Visual Studio 2022 (optional, for development)
- Microsoft Flight Simulator running
- SimWidget Server running (for live sim data)

## Building

### Command Line
```batch
build.bat
```

### Visual Studio
1. Open `SimWidgetOverlay.sln`
2. Build → Build Solution (Ctrl+Shift+B)

## Usage

1. **Start SimWidget Server** (for live data):
   ```
   cd "C:\LLM-DevOSWE\SimWidget Engine\server"
   npm start
   ```

2. **Start MSFS** and enter a flight

3. **Run the injector as Administrator**:
   ```
   SimWidgetInjector\bin\Release\net7.0-windows\SimWidgetInjector.exe
   ```

4. **Overlay appears!**

## Controls

| Key | Action |
|-----|--------|
| F10 | Toggle overlay visibility |

## Project Structure

```
directx-overlay/
├── SimWidgetOverlay/          # Hook DLL (injected into MSFS)
│   ├── DXHook.cs              # DirectX Present hook
│   ├── SimDataClient.cs       # WebSocket client for sim data
│   └── OverlayRenderer.cs     # Rendering utilities
├── SimWidgetInjector/         # Injector executable
│   └── Program.cs             # Main injector logic
├── build.bat                  # Build script
└── README.md
```

## Troubleshooting

### "Hook DLL not found"
Make sure to build the solution first with `build.bat`

### "Injection failed"
- Run injector as **Administrator**
- Check if anti-virus is blocking
- Make sure MSFS is running first

### Overlay not visible
- Check that SimWidget Server is running
- Press F10 to toggle visibility
- Check console for error messages

### Game crash
- This is experimental - DirectX hooking can be unstable
- Try restarting MSFS and the injector

## Future Enhancements

- [ ] Interactive buttons (mouse input)
- [ ] Drag to reposition
- [ ] Settings UI
- [ ] Multiple panel support
- [ ] Direct SimConnect (no server needed)
- [ ] Config file for position/size

## Technical Notes

### Why EasyHook?
EasyHook provides managed (C#) hooking without requiring C++ code. It handles:
- DLL injection
- Function hooking
- Thread safety
- x64 support

### Why Direct2D?
Direct2D integrates seamlessly with DirectX 11 swap chains, allowing us to draw 2D graphics efficiently on top of the 3D game.

### Performance Impact
Minimal - Direct2D drawing is GPU-accelerated and the hook adds negligible overhead.

## Disclaimer

⚠️ **Use at your own risk!**

DLL injection may trigger anti-virus software or game anti-cheat systems. This is intended for personal use only. The authors are not responsible for any issues arising from use of this software.

## License

MIT License - Use freely for personal projects.
