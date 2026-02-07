# SimGlass Hybrid

Flow Pro replacement for MSFS 2024 - modular widget overlay system.

**Server Version:** v1.11.0
**Status:** 54 widgets available | 60 automated tests passing

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

#### Flight Controls

| Widget | URL | Description |
|--------|-----|-------------|
| Aircraft Control | `/ui/aircraft-control/` | Lights, gear, flaps, AP |
| Camera | `/ui/camera-widget/` | Camera views & presets |
| WASM Camera | `/ui/wasm-camera/` | Custom flyby/cinematic modes |
| Environment | `/ui/environment/` | Time, weather, sim rate |
| Fuel | `/ui/fuel-widget/` | Fuel management |
| Radio Stack | `/ui/radio-stack/` | COM, NAV, transponder |

#### Flight Data

| Widget | URL | Description |
|--------|-----|-------------|
| Flight Data | `/ui/flight-data-widget/` | PFD-style instruments |
| Flight Dashboard | `/ui/flight-dashboard/` | Overview gauges |
| Map | `/ui/map-widget/` | Live position with weather overlay |
| Weather | `/ui/weather-widget/` | METAR/TAF display |
| Timer | `/ui/timer-widget/` | Flight timer & stopwatch |

#### Flight Planning

| Widget | URL | Description |
|--------|-----|-------------|
| Flight Plan | `/ui/flightplan-widget/` | Waypoints & progress |
| SimBrief | `/ui/simbrief-widget/` | Import SimBrief OFP |
| Charts | `/ui/navigraph-widget/` | FREE charts (FAA, SkyVector) |
| Charts Alt | `/ui/charts-widget/` | ChartFox, FAA, Eurocontrol |
| GTN 750 | `/ui/gtn750/` | GPS navigation mock |
| Checklist | `/ui/checklist-widget/` | Aircraft checklists |

#### AI & Voice

| Widget | URL | Description |
|--------|-----|-------------|
| AI Copilot | `/ui/copilot-widget/` | Intelligent flight assistant |
| Voice Control | `/ui/voice-control/` | Voice commands |
| Otto Search | `/ui/otto-search/` | Command palette |

#### Utilities

| Widget | URL | Description |
|--------|-----|-------------|
| Notepad | `/ui/notepad-widget/` | Flight notes, ATIS |
| Flight Recorder | `/ui/flight-recorder/` | Record & replay |
| Video Viewer | `/ui/video-viewer/` | Stream display |
| Keymap Editor | `/ui/keymap-editor/` | Configure keybinds |
| Dashboard | `/ui/dashboard/` | System status |
| Services Panel | `/ui/services-panel/` | Hive services |

#### System

| Widget | URL | Description |
|--------|-----|-------------|
| Performance Monitor | `/ui/performance-monitor/` | Real-time system health & metrics |
| Panel Launcher | `/ui/panel-launcher/` | Quick launch all widgets |
| Interaction Wheel | `/ui/interaction-wheel/` | Radial quick menu |
| Plugin Manager | `/ui/plugin-manager/` | Third-party plugins |
| TinyWidgets | `/ui/tinywidgets/` | Compact mini-widgets |

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

### Core Flight Controls
- Autopilot (HDG, ALT, VS, SPD, NAV)
- Engine controls (throttle, prop, mixture)
- Gear, flaps, spoilers, parking brake
- All 11 aircraft lights
- Trim controls (aileron, elevator, rudder)

### Radio & Navigation
- COM1/COM2 frequencies with presets
- NAV1/NAV2 frequencies
- Transponder with mode selector
- GTN 750 mock display

### Flight Instruments
- PFD-style attitude indicator
- Speed/altitude tapes
- G-force display
- Wind vector & heading

### Flight Planning
- SimBrief OFP import
- Flight plan waypoint display
- Progress tracking with ETE
- FREE charts (FAA DTPP, SkyVector, ChartFox)
- 18 aircraft checklists

### AI & Automation
- AI Copilot with callouts & suggestions
- Voice control commands
- Otto Search command palette

### Cross-Widget Communication
Widgets communicate via BroadcastChannel:
- **SimBrief → Flight Plan**: Import route data
- **Flight Plan → Map**: Display waypoints on map
- **Flight Plan → Copilot**: Route-aware suggestions
- **Map → Flight Plan**: Waypoint selection sync
- **Weather → Map**: METAR overlay at airports

### Environment
- Time of day control
- Weather presets
- Sim rate control
- Slew mode

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
│   ├── aircraft-control/   # Lights, gear, flaps, AP
│   ├── camera-widget/      # Camera views & presets
│   ├── charts-widget/      # ChartFox, FAA, Eurocontrol
│   ├── checklist-widget/   # Aircraft checklists (18 aircraft)
│   ├── copilot-widget/     # AI flight assistant
│   ├── dashboard/          # System status
│   ├── environment/        # Time, weather, sim rate
│   ├── flight-dashboard/   # Overview gauges
│   ├── flight-data-widget/ # PFD-style instruments
│   ├── flightplan-widget/  # Waypoints & progress
│   ├── flight-recorder/    # Record & replay
│   ├── fuel-widget/        # Fuel management
│   ├── gtn750/             # GPS navigation mock
│   ├── interaction-wheel/  # Radial quick menu
│   ├── keymap-editor/      # Configure keybinds
│   ├── map-widget/         # Live position + weather
│   ├── navigraph-widget/   # FREE charts (FAA, SkyVector)
│   ├── notepad-widget/     # Flight notes
│   ├── otto-search/        # Command palette
│   ├── panel-launcher/     # Quick launch (30 widgets)
│   ├── plugin-manager/     # Third-party plugins
│   ├── radio-stack/        # COM, NAV, transponder
│   ├── services-panel/     # Hive services
│   ├── simbrief-widget/    # SimBrief OFP import
│   ├── timer-widget/       # Flight timer
│   ├── tinywidgets/        # Compact mini-widgets
│   ├── video-viewer/       # Stream display
│   ├── voice-control/      # Voice commands
│   ├── wasm-camera/        # Cinematic cameras
│   └── weather-widget/     # METAR/TAF display
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
