# SimWidget Hybrid

Flow Pro replacement for MSFS 2024 - modular widget overlay system.

**Server Version:** v1.11.0
**Status:** All 6 phases complete

---

## Quick Start

### 1. Start Server

```bash
cd simwidget-hybrid/backend
node server.js
```

Server runs on `http://localhost:8080`

### 2. Open Command Center

Browse to: http://localhost:8080

### 3. Launch Widgets

| Widget | URL | Description |
|--------|-----|-------------|
| Aircraft Control | `/ui/aircraft-control/` | Lights, gear, flaps, AP |
| Camera | `/ui/camera-widget/` | Camera views & presets |
| Flight Data | `/ui/flight-data-widget/` | Instruments & HUD |
| Fuel | `/ui/fuel-widget/` | Fuel management |
| Radio Stack | `/ui/radio-stack/` | COM, NAV, transponder |
| Plugin Manager | `/ui/plugin-manager/` | Third-party plugins |
| Otto Search | `/ui/otto-search/` | Command palette |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────┐          WebSocket       ┌─────────────┐ │
│  │   Widgets    │◄─────────────────────────►│  Backend    │ │
│  │  (Browser)   │         :8080             │   Server    │ │
│  └──────────────┘                           └──────┬──────┘ │
│                                                    │        │
│  ┌──────────────┐                           SimConnect      │
│  │   Plugins    │◄─────────────────────────┐       │        │
│  │  (3rd party) │                          │       ▼        │
│  └──────────────┘                      ┌───┴───────────┐   │
│                                        │   MSFS 2024   │   │
│                                        └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Phase 1: Core Flight
- Autopilot (HDG, ALT, VS, SPD)
- Engine controls (throttle, prop, mixture)
- Gear, flaps, parking brake
- Basic lights

### Phase 2: Complete Controls
- All 11 aircraft lights
- Trim controls (aileron, elevator, rudder)
- Electrical systems
- Door controls

### Phase 3: Radio & Navigation
- COM1/COM2 frequencies
- NAV1/NAV2 frequencies
- Transponder with presets

### Phase 4: Flight Instruments
- Attitude indicator
- Speed/altitude tapes
- G-force display
- Wind vector

### Phase 5: Environment
- Time of day control
- Weather presets
- Sim rate control
- Slew mode

### Phase 6: Advanced
- Panel Launcher (G1000 keys)
- Interaction Wheel (radial menu)
- Otto Search (command palette)
- Plugin System

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Flight data & connection |
| `/api/health` | GET | Full system health check |
| `/api/plugins` | GET | List all plugins |
| `/api/command` | POST | Send SimConnect command |
| `/api/keymaps` | GET | Keyboard mappings |
| `/api/camsys/state` | GET | Camera system state |

### WebSocket

Connect to `ws://localhost:8080` for real-time flight data:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === 'flightData') {
        console.log('Altitude:', data.altitude);
        console.log('Speed:', data.speed);
    }
};

// Send command
ws.send(JSON.stringify({
    type: 'command',
    command: 'GEAR_TOGGLE',
    value: 0
}));
```

---

## Project Structure

```
simwidget-hybrid/
├── backend/
│   ├── server.js           # Main server (v1.11.0)
│   ├── camera-system.js    # Camera controls
│   ├── key-sender.js       # Keyboard simulation
│   └── plugin-system/      # Plugin loader & API
├── ui/
│   ├── aircraft-control/   # Main control widget
│   ├── camera-widget/      # Camera controls
│   ├── flight-data-widget/ # Flight instruments
│   ├── fuel-widget/        # Fuel management
│   ├── radio-stack/        # Radio frequencies
│   ├── plugin-manager/     # Plugin management UI
│   ├── otto-search/        # Command palette
│   ├── interaction-wheel/  # Radial quick menu
│   └── panel-launcher/     # G1000 soft keys
├── plugins/
│   └── example-checklist/  # Example plugin
├── config/
│   └── keymaps.json        # Keyboard mappings
└── shared-ui/              # Common components
```

---

## Requirements

- **Node.js 18+**
- **Windows 10/11**
- **MSFS 2020/2024** (for SimConnect)

### Optional (for enhanced camera control)

- vJoy - Fastest camera input
- ChasePlane - Cinematic modes
- AutoHotKey - Key simulation

---

## Plugin System

Create third-party plugins in `plugins/` folder:

```
plugins/my-plugin/
├── plugin.json    # Manifest
└── index.html     # Entry point
```

Manifest example:
```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "Plugin description",
    "author": "Your Name",
    "category": "utility"
}
```

See `docs/PLUGIN-DEVELOPMENT.md` for full guide.

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/WIDGET-CREATION-GUIDE.md` | Create custom widgets |
| `docs/PLUGIN-DEVELOPMENT.md` | Plugin development |
| `docs/CAMERA-TROUBLESHOOTING.md` | Camera control issues |
| `docs/SIMVARS-REFERENCE.md` | SimConnect variables |

---

## Health Check

```bash
curl http://localhost:8080/api/health
```

Returns server version, uptime, SimConnect status, plugin count, and memory usage.

---

## License

MIT License
