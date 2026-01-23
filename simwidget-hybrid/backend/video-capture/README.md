# Video Capture Prototypes

Multiple approaches for high-performance screen capture, from highest to lowest level.

## Quick Comparison

| Method | Capture | Transfer | Total | FPS | Dependencies |
|--------|---------|----------|-------|-----|--------------|
| nircmd (current) | ~100ms | ~50ms | ~150ms | 6 | nircmd.exe |
| WS Binary | ~80ms | ~5ms | ~85ms | 12 | Node.js, ws |
| Native C++ TCP | ~1ms | ~5ms | ~6ms | 60+ | VS Build Tools |
| Node Addon | ~5ms | ~10ms | ~15ms | 60 | node-gyp, VS |
| Shared Memory | ~1ms | <1ms | ~2ms | 120+ | VS Build Tools |

## Prototype 1: Native C++ TCP Server

Standalone executable that captures screen and serves frames over TCP.

**Location**: `capture-service.cpp`

**Build**:
```batch
build.bat
```
Or manually:
```batch
cl /EHsc /O2 capture-service.cpp /link d3d11.lib dxgi.lib ole32.lib ws2_32.lib
```

**Run**:
```batch
bin\capture-service.exe
```
Listens on port 9998, sends frames continuously to connected clients.

**Protocol**:
- Connect to TCP port 9998
- Receive: [4 bytes frame size][8 bytes header][BGRA pixels]
- Header: width (4 bytes), height (4 bytes)

## Prototype 2: Node.js Native Addon

N-API wrapper exposing Desktop Duplication API directly to Node.js.

**Location**: `node-addon/`

**Build**:
```batch
cd node-addon
npm install
npm run build
```

**Usage**:
```javascript
const capture = require('./node-addon');
capture.initialize();
const buffer = capture.captureFrame();
const { width, height, pixels } = capture.parseFrame(buffer);
```

**Test**:
```batch
cd node-addon
node test.js
```

## Prototype 3: WebSocket Binary Stream

Node.js server using nircmd + sharp with WebSocket transport.

**Location**: `ws-stream/`

**Run**:
```batch
cd ws-stream
node ws-server.js
```

**Client**: Open `ws-stream/ws-client.html` in browser.

**Protocol**:
- Connect to ws://localhost:9997
- Send: `{"type":"start","fps":30,"quality":60,"scale":0.5}`
- Receive: [8 bytes header][JPEG data]

## Prototype 4: Shared Memory

Fastest transfer - captures directly to memory-mapped file.

**Location**: `shm-capture/`

**Build**:
```batch
build.bat
```

**Run Capture Service**:
```batch
bin\shm-capture.exe 60    # 60 FPS target
```

**Read from Node.js**:
```javascript
const reader = require('./shm-capture/shm-reader');
reader.connect();  // Opens shared memory
const frame = reader.getFrame();  // Returns null if no new frame
```

**Note**: shm-reader.js requires `ffi-napi` and `ref-napi` packages.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Desktop Duplication API                   │
│                 (DXGI OutputDuplication)                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────┬─────────────────┬─────────────────┐
│  capture-       │   node-addon    │   shm-capture   │
│  service.exe    │   (N-API)       │   (Shared Mem)  │
│                 │                 │                 │
│  TCP :9998      │  Direct call    │  Memory-mapped  │
└────────┬────────┴────────┬────────┴────────┬────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┬─────────────────┬─────────────────┐
│  TCP Client     │   Node.js       │   shm-reader    │
│                 │   Server        │   (ffi-napi)    │
└────────┬────────┴────────┬────────┴────────┬────────┘
         │                 │                 │
         └────────────────┼─────────────────┘
                          ▼
                   ┌─────────────┐
                   │  WebSocket  │
                   │  to Browser │
                   └─────────────┘
```

## Requirements

- Windows 10/11 (Desktop Duplication API)
- Visual Studio Build Tools 2019/2022 (for C++ builds)
- Node.js 18+ (for WebSocket and addon)
- For node-addon: `node-gyp`, `windows-build-tools`

## Installation

1. **Quick test (WebSocket)**:
   ```batch
   cd ws-stream
   node ws-server.js
   # Open ws-client.html
   ```

2. **Build native executables**:
   ```batch
   build.bat
   ```

3. **Build Node addon**:
   ```batch
   cd node-addon
   npm install
   npm run build
   node test.js
   ```
