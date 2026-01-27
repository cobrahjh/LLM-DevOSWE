# SimWidget Engine - System Architecture
**Version:** 3.1.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\ARCHITECTURE.md`

---

## Overview

SimWidget Engine is a comprehensive flight simulator widget system for Microsoft Flight Simulator 2024, designed as a professional-grade replacement for Flow Pro. The system provides real-time flight data visualization, aircraft control, and extensible widget architecture.

### Key Features
- **Real-time SimConnect integration** - Direct MSFS 2024 data streaming
- **WebSocket server** - Live flight data broadcast to all connected clients
- **Modular widget system** - Independent, reusable UI components
- **GUID-based keymap system** - v3.0 reversible configuration
- **Flow Pro API compatibility** - Easy widget migration
- **Professional UI styling** - 7 switchable color schemes

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  Aircraft    │ │    Fuel      │ │   Camera     │ │   Keymap     │       │
│  │  Control     │ │   Widget     │ │   Widget     │ │   Editor     │       │
│  │  Widget      │ │              │ │              │ │              │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│                          WebSocket (ws://localhost:8080)                    │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                            SERVER LAYER                                      │
│                      (Node.js + Express + WS)                               │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     server.js (v1.9.0)                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   REST API  │  │  WebSocket  │  │  SimConnect │  │   Camera   │  │   │
│  │  │  /api/*     │  │   Server    │  │   Bridge    │  │   System   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                              │                         │
│         ┌─────────┴─────────┐          ┌─────────┴─────────┐               │
│         ▼                   ▼          ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐  ┌─────────────┐ ┌──────────────┐     │
│  │ key-sender  │    │   keymaps   │  │   camera-   │ │   camera-    │     │
│  │    .js      │    │   .json     │  │  controller │ │   system     │     │
│  │  (v3.0.0)   │    │  (v3.0)     │  │    .js      │ │     .js      │     │
│  └──────┬──────┘    └─────────────┘  └─────────────┘ └──────────────┘     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────┐                                                       │
│  │ KeySenderService│  (.NET TCP server for fast key injection)             │
│  │   Port 5111     │                                                       │
│  └─────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIMULATOR LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   Microsoft Flight Simulator 2024                    │   │
│  │                        SimConnect SDK                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
C:\LLM-DevOSWE\SimWidget_Engine\
│
├── 📄 CLAUDE.md                     # AI assistant context
├── 📄 ARCHITECTURE.md               # This document
├── 📄 STANDARDS.md                  # Coding standards
├── 📄 TODO.md                       # Development roadmap
├── 📄 DIRECTORY-STRUCTURE.md        # Full directory map
│
├── 📁 docs/                         # Documentation
│   ├── FLOW-PRO-REFERENCE.md        # Flow Pro widget API (170 widgets)
│   ├── SIMVARS-REFERENCE.md         # SimConnect variables
│   ├── WIDGET-CREATION-GUIDE.md     # Widget development guide
│   └── COMPONENT-REGISTRY.md        # UI component catalog
│
├── 📁 simwidget-hybrid/             # ⭐ MAIN APPLICATION
│   ├── 📁 backend/                  # Node.js server
│   │   ├── server.js                # Main server (v1.5.0)
│   │   ├── key-sender.js            # Keymap manager (v3.0.0)
│   │   ├── camera-controller.js     # Camera detection
│   │   ├── camera-system.js         # Native MSFS camera
│   │   ├── vjoy-controller.js       # vJoy integration
│   │   └── vjoy-camera.js           # vJoy camera controls
│   │
│   ├── 📁 config/                   # Configuration
│   │   └── keymaps.json             # v3.0 GUID-based keymaps
│   │
│   ├── 📁 shared-ui/                # Shared libraries
│   │   └── flow-api.js              # Flow Pro API layer
│   │
│   └── 📁 ui/                       # Widget UIs
│       ├── aircraft-control/        # ✈️ Main control widget
│       ├── fuel-widget/             # ⛽ Fuel management
│       ├── camera-widget/           # 📷 Camera controls
│       ├── flight-data-widget/      # 📊 Flight data display
│       └── keymap-editor/           # ⌨️ Key configuration
│
├── 📁 KeySenderService/             # .NET TCP key sender
│   ├── Program.cs                   # Service code
│   └── bin/Release/net8.0/          # Compiled binary
│
├── 📁 overlay/                      # Electron overlay
│   ├── main.js                      # Electron main
│   └── renderer/                    # UI renderer
│
└── 📁 packages/                     # Reusable components
    └── components/                  # UI component library
```

---

## Server Architecture (v1.5.0)

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| **HTTP Server** | `server.js` | Express server on port 8080 |
| **WebSocket** | `server.js` | Real-time flight data broadcast |
| **SimConnect** | `server.js` | MSFS data & commands |
| **Key Sender** | `key-sender.js` | Keymap CRUD & TCP key injection |
| **Camera Controller** | `camera-controller.js` | ChasePlane/native detection |
| **Camera System** | `camera-system.js` | MSFS camera state machine |

### REST API Endpoints

```
GET  /                          # Server index page
GET  /api/status                # Connection status + flight data

# Keymaps (v3.0)
GET  /api/keymaps               # All keymaps + conflicts
GET  /api/keymaps/:category     # Category keymaps
POST /api/keymaps/:category     # Add new entry
POST /api/keymaps/:category/:id # Update key/trigger
PATCH /api/keymaps/:category/:id # Rename entry
DELETE /api/keymaps/:category/:id # Delete (non-default only)
GET  /api/keymaps/export/v2     # Export v2.0 format
POST /api/keymaps/export/v2     # Save v2.0 backup

# Commands
POST /api/command               # SimConnect command
POST /api/sendkey               # Send keyboard key

# Camera
GET  /api/camsys/state          # Camera state
POST /api/camsys/:action        # Camera action
POST /api/camera/:action        # Legacy vJoy camera

# Debug
GET  /api/debug/history         # Key send history
GET  /api/debug/keysender       # Key sender status
GET  /api/debug/camera          # Camera debug info
```

### WebSocket Protocol

**Server → Client:**
```javascript
{
  type: 'flightData',
  data: {
    // Flight
    altitude: 5000,
    speed: 120,
    heading: 270,
    verticalSpeed: 500,
    groundSpeed: 130,
    
    // Autopilot
    apMaster: true,
    apHdgLock: true,
    apHdgSet: 270,
    apAltSet: 5000,
    apVsSet: 0,
    apSpdSet: 120,
    
    // Fuel
    fuelTotal: 42.5,
    fuelCapacity: 56.0,
    fuelFlow: 8.2,
    fuelLeft: 21.3,
    fuelRight: 21.2,
    
    // Systems
    navLight: true,
    beaconLight: true,
    gearDown: true,
    parkingBrake: false,
    
    // Engine
    throttle: 65,
    propeller: 100,
    mixture: 100,
    
    // Controls
    aileron: 0,
    elevator: 0,
    rudder: 0,
    
    connected: true
  }
}
```

**Client → Server:**
```javascript
// Standard command
{ type: 'command', command: 'THROTTLE_SET', value: 75 }

// Categorized command (fuel, etc.)
{ type: 'command', category: 'fuel', action: 'setPercent', percent: 50 }
```

---

## Keymap System (v3.0)

### GUID-Based Format
```json
{
  "camera": {
    "cam-001-cockpit-vfr": {
      "originalId": "cockpitVFR",
      "name": "Cockpit VFR",
      "key": "F10",
      "trigger": "",
      "isDefault": true
    },
    "cam-custom-12345": {
      "originalId": null,
      "name": "My Custom View",
      "key": "Ctrl+F5",
      "trigger": "takeoff",
      "isDefault": false
    }
  }
}
```

### Features
- **GUID IDs** - Unique identifiers for each entry
- **originalId** - Backward compatibility with v2.0
- **Reversibility** - Export to v2.0 for rollback
- **Add/Delete/Rename** - Full CRUD operations
- **Conflict detection** - Warns on duplicate keys

### Key Sender Flow
```
Widget → WebSocket → server.js → key-sender.js → TCP:5111 → KeySenderService → MSFS
                                      ↓
                               keymaps.json
```

---

## SimConnect Integration

### Data Definitions (35 variables)
```javascript
// Flight
'PLANE ALTITUDE'                    // feet
'AIRSPEED INDICATED'                // knots
'PLANE HEADING DEGREES MAGNETIC'    // degrees
'VERTICAL SPEED'                    // feet/min
'GROUND VELOCITY'                   // knots

// Autopilot
'AUTOPILOT MASTER'                  // bool
'AUTOPILOT HEADING LOCK'            // bool
'AUTOPILOT ALTITUDE LOCK'           // bool
'AUTOPILOT HEADING LOCK DIR'        // degrees
'AUTOPILOT ALTITUDE LOCK VAR'       // feet

// Fuel
'FUEL TOTAL QUANTITY'               // gallons
'FUEL TOTAL CAPACITY'               // gallons
'ENG FUEL FLOW GPH:1'               // gph
'FUEL LEFT QUANTITY'                // gallons
'FUEL RIGHT QUANTITY'               // gallons

// Lights
'LIGHT NAV', 'LIGHT BEACON', 'LIGHT STROBE'
'LIGHT LANDING', 'LIGHT TAXI'

// Controls
'AILERON POSITION', 'ELEVATOR POSITION', 'RUDDER POSITION'
```

### Mapped Events (35 events)
```javascript
// Lights
'TOGGLE_NAV_LIGHTS', 'TOGGLE_BEACON_LIGHTS', 'STROBES_TOGGLE'
'LANDING_LIGHTS_TOGGLE', 'TOGGLE_TAXI_LIGHTS'

// Systems
'PARKING_BRAKES', 'GEAR_TOGGLE', 'FLAPS_UP', 'FLAPS_DOWN'

// Autopilot
'AP_MASTER', 'AP_HDG_HOLD', 'AP_ALT_HOLD', 'AP_VS_HOLD'
'HEADING_BUG_SET', 'AP_ALT_VAR_SET_ENGLISH', 'AP_VS_VAR_SET_ENGLISH'

// Controls
'AXIS_AILERONS_SET', 'AXIS_ELEVATOR_SET', 'AXIS_RUDDER_SET'
'THROTTLE_SET', 'PROP_PITCH_SET', 'MIXTURE_SET'

// Fuel
'ADD_FUEL_QUANTITY'
```

---

## Widget System

### Available Widgets

| Widget | URL | Purpose |
|--------|-----|---------|
| **Aircraft Control** | `/ui/aircraft-control/` | AP, throttle, lights, fuel |
| **Fuel Widget** | `/ui/fuel-widget/` | Fuel management & display |
| **Camera Widget** | `/ui/camera-widget/` | Camera view controls |
| **Flight Data** | `/ui/flight-data-widget/` | Flight instruments |
| **Keymap Editor** | `/ui/keymap-editor/` | Key binding config |

### Widget Structure
```
ui/<widget-name>/
├── index.html      # Entry point
├── widget.js       # Logic (or app.js)
├── widget.css      # Styles (or styles.css)
└── manifest.json   # Optional metadata
```

### Widget Lifecycle
```javascript
class Widget {
  constructor() {
    this.ws = null;
    this.init();
  }
  
  init() {
    this.connectWebSocket();
    this.bindEvents();
  }
  
  connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:8080');
    this.ws.onmessage = (e) => this.handleData(JSON.parse(e.data));
  }
  
  handleData(data) {
    if (data.type === 'flightData') {
      this.updateDisplay(data.data);
    }
  }
  
  sendCommand(command, value) {
    this.ws.send(JSON.stringify({ type: 'command', command, value }));
  }
}
```

---

## Flow Pro API Compatibility

### flow-api.js Interface
```javascript
const api = new FlowAPI(serverUrl);

// SimVar access (maps to flightData)
api.variables.get('A:FUEL TOTAL QUANTITY', 'Gallons');

// Event sending (maps to WebSocket commands)
api.variables.set('K:TOGGLE_NAV_LIGHTS', 'Number', 1);

// Widget state persistence
api.datastore.get('myKey');
api.datastore.set('myKey', value);
```

### SimVar Mappings (40+)
```javascript
'A:PLANE ALTITUDE' → flightData.altitude
'A:FUEL TOTAL QUANTITY' → flightData.fuelTotal
'A:AUTOPILOT HEADING LOCK DIR' → flightData.apHdgSet
'A:LIGHT NAV' → flightData.navLight
```

### Event Mappings (40+)
```javascript
'K:TOGGLE_NAV_LIGHTS' → { command: 'TOGGLE_NAV_LIGHTS' }
'K:AP_MASTER' → { command: 'AP_MASTER' }
'K:THROTTLE_SET' → { command: 'THROTTLE_SET', value }
```

---

## Camera System

### Detection Priority
1. **ChasePlane** - If running (WebSocket port 8652)
2. **PowerShell-Direct** - SendKeys fallback
3. **Native MSFS** - SimConnect camera events

### Camera Commands
| Action | Key | SimConnect |
|--------|-----|------------|
| Toggle Cinematic | Alt+Z | VIEW_MODE |
| Next Cinematic | Alt+X | - |
| Cockpit | End | CHASE_VIEW_TOGGLE |
| External | F12 | - |
| Drone | Insert | DRONE_TOGGLE |

---

## Development Network

| Machine | IP | Role |
|---------|-----|------|
| **Harold-PC** | 192.168.1.192 | MSFS + Server |
| **Morpu-PC** | 192.168.1.97 | Development |

**Drive Mapping:**
```powershell
net use H: \\192.168.1.192\DevClaude
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Server** | Node.js, Express, ws |
| **SimConnect** | node-simconnect |
| **Key Injection** | .NET 8 (KeySenderService) |
| **Frontend** | HTML/CSS/JS (vanilla) |
| **Overlay** | Electron |
| **Scripting** | PowerShell, AutoHotKey |

---

## Version History

### v3.0.0 (2025-01-07)
- Complete architecture refactor
- Added Fuel Widget documentation
- Documented WebSocket protocol
- Added SimConnect variable/event lists
- Documented keymap v3.0 system
- Added Flow Pro API compatibility layer
- Updated directory structure

### v2.1.0 (2026-01-05)
- Component system standard
- AxisPad specification
- Aircraft data sources

### v2.0.0 (2025-01-04)
- Initial AI-powered architecture
- Plugin system concept
