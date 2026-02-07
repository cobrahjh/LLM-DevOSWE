# SimGlass Backend

**Entry:** `server.js` | **Port:** 8080

## What This Is
Main SimGlass server — MSFS flight sim overlay backend with camera control, telemetry, plugin system, and WebSocket streaming.

## Key Rules
- NEVER change port 8080
- SimConnect integration for MSFS 2020/2024 flight data
- Camera controller uses priority input methods: TCP KeySender (5ms) > FastKeySender (32ms) > PowerShell (400ms)
- Plugin system auto-discovers plugins in `../plugins/`
- Hot reload via chokidar file watcher

## Architecture
- Express.js + WebSocket (ws package)
- SimConnect for flight data streaming
- Camera controller with ChasePlane detection
- Key sender with GUID-based keymaps
- Plugin system with manifest-based discovery

## Key Files
| File | Purpose |
|------|---------|
| `server.js` | Main server, routes, WebSocket |
| `camera-controller.js` | Camera views, ChasePlane, input routing |
| `key-sender.js` | Multi-method key input (TCP, PowerShell, native) |
| `fast-key-sender.js` | Persistent PowerShell for fast keys |
| `platform-detector.js` | vJoy, SendKeys, SimConnect detection |
| `keymaps.json` | Camera view key mappings |

## Key Endpoints
```
GET  /api/status           - Full status with flight data
GET  /api/camera/status    - Camera mode and AHK status
POST /api/camera/:action   - Trigger camera view
GET  /api/wasm-camera/status - WASM module status
```

## Testing
```bash
curl http://localhost:8080/api/status
```
