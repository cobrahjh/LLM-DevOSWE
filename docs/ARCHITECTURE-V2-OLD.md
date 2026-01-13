# SimWidget Engine v2.0 - AI-Powered Architecture
**Version:** v2.1.0  
**Last Updated:** 2026-01-05  
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\ARCHITECTURE-V2.md

## Vision
An AI-powered flight assistant platform that combines:
- Real-time sim data
- Natural language interaction
- Smart flight assistance
- Voice control
- Extensible plugin system
- **Reusable component library** for rapid widget creation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Overlay    │  │    Mini      │  │    Voice     │  │   Web UI    │ │
│  │   Widgets    │  │   Widgets    │  │   Control    │  │  Designer   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────────┐
│        ELECTRON OVERLAY         │ │          WEB DASHBOARD              │
│  - Transparent windows          │ │  - Widget designer (React)          │
│  - Click-through                │ │  - Configuration                    │
│  - Mini widgets                 │ │  - Plugin marketplace               │
│  - System tray                  │ │  - Flight planning                  │
└─────────────────────────────────┘ └─────────────────────────────────────┘
                        │                       │
                        └───────────┬───────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CORE ENGINE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Widget     │  │    Event     │  │    State     │  │   Plugin    │ │
│  │   Runtime    │  │     Bus      │  │    Store     │  │   Loader    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    COMPONENT REGISTRY                             │  │
│  │  AxisPad | LinearSlider | RotaryKnob | PushButton | DataField    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────┐ ┌─────────────────────────────┐
│     AI AGENT LAYER      │ │  SIM BRIDGE │ │      EXTERNAL SERVICES      │
├─────────────────────────┤ ├─────────────┤ ├─────────────────────────────┤
│ ┌─────────────────────┐ │ │ SimConnect  │ │ ┌─────────┐ ┌────────────┐ │
│ │   Claude API        │ │ │ MobiFlight  │ │ │ Weather │ │  NOTAMs    │ │
│ │   - Co-pilot chat   │ │ │ FSUIPC      │ │ │   API   │ │    API     │ │
│ │   - Smart commands  │ │ │ HubHop      │ │ └─────────┘ └────────────┘ │
│ │   - Flight advice   │ │ └─────────────┘ │ ┌─────────┐ ┌────────────┐ │
│ └─────────────────────┘ │                 │ │ SimBrief│ │  LittleNav │ │
│ ┌─────────────────────┐ │                 │ │   API   │ │    API     │ │
│ │   Voice Agent       │ │                 │ └─────────┘ └────────────┘ │
│ │   - Speech to text  │ │                 │ ┌─────────┐ ┌────────────┐ │
│ │   - Text to speech  │ │                 │ │Navigraph│ │  Charts    │ │
│ │   - NL commands     │ │                 │ │   API   │ │    API     │ │
│ └─────────────────────┘ │                 │ └─────────┘ └────────────┘ │
└─────────────────────────┘                 └─────────────────────────────┘
```

---

## Component System Standard

All widgets are built from reusable components. Components follow a standardized naming convention and can be drag-dropped onto widget canvases.

### Component Naming Convention

| Category | Old Name | New Name | CSS Prefix | Purpose |
|----------|----------|----------|------------|---------|
| Input | joystick | `AxisPad` | swc-ap | Multi-axis control (yoke) |
| Input | slider | `LinearSlider` | swc-ls | Single-axis input |
| Input | knob | `RotaryKnob` | swc-rk | Rotary encoder |
| Input | button | `PushButton` | swc-pb | Momentary action |
| Input | toggle | `ToggleSwitch` | swc-ts | Two-state toggle |
| Input | rocker | `RockerSwitch` | swc-rs | Momentary up/down |
| Display | display | `DataField` | swc-df | Numeric/text value |
| Display | indicator | `StatusLamp` | swc-sl | On/off indicator |
| Display | gauge | `ProgressBar` | swc-pg | 0-100% bar |
| Display | label | `TextLabel` | swc-tl | Static annotation |
| Layout | spacer | `Spacer` | swc-sp | Gap/divider |

### CSS Class Convention (BEM)
```css
.swc-[type]           /* Base component */
.swc-[type]--active   /* Active state */
.swc-[type]--disabled /* Disabled state */
.swc-[type]__[part]   /* Component part */
```

---

## AxisPad Component (Joystick)

The `AxisPad` is a 2-axis input control for flight controls (yoke/stick).


### Visual Design
```
┌─────────────────────┐
│    ─────┼─────      │  <- Crosshair guides
│         │           │
│  ───────●───────    │  <- Center indicator
│         │           │
│    ─────┼─────      │
│                     │
│        [○]          │  <- Draggable knob
│                     │
└─────────────────────┘
```

### Configuration
```javascript
{
    type: 'AxisPad',
    id: 'flight-stick',
    label: 'Flight Controls',
    width: 150,
    height: 150,
    
    // X-axis (horizontal = aileron/roll)
    xAxis: {
        simvar: 'A:YOKE X POSITION',
        command: 'AXIS_AILERONS_SET',
        min: -16383,
        max: 16383,
        deadzone: 0.05,
        inverted: false
    },
    
    // Y-axis (vertical = elevator/pitch)
    yAxis: {
        simvar: 'A:YOKE Y POSITION',
        command: 'AXIS_ELEVATOR_SET',
        min: -16383,
        max: 16383,
        deadzone: 0.05,
        inverted: false
    },
    
    style: 'round',        // 'round' | 'square'
    showGrid: true,
    showCrosshair: true,
    returnToCenter: true,
    springStrength: 0.8
}
```

### Interaction Modes
1. **Drag Mode**: Click and drag the knob
2. **Touch Mode**: Touch/drag for mobile/tablet
3. **Click-to-Position**: Click anywhere to move knob
4. **Keyboard**: Arrow keys when focused

---

## Aircraft Data Sources

### MSFS 2024 Directory Structure
```
%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\
└── LocalCache\Packages\
    ├── Official\OneStore\     <- Default aircraft (Asobo)
    │   ├── asobo-aircraft-c172sp-classic\
    │   ├── asobo-aircraft-a320-neo\
    │   ├── asobo-aircraft-b7478i\
    │   └── ...
    └── Community\             <- Add-on aircraft
        ├── flybywire-aircraft-a320-neo\
        ├── pmdg-aircraft-737\
        ├── inibuilds-aircraft-a350\
        └── ...
```

### Variable Types by Source

| Type | Prefix | Source | Example |
|------|--------|--------|---------|
| SimVar | A: | SimConnect SDK | `A:PLANE ALTITUDE` |
| Local | L: | Aircraft-specific | `L:A32NX_AUTOPILOT_1_ACTIVE` |
| HTML | H: | Gauge variables | `H:A320_NEO_MFD_BTN_1` |
| Key Event | K: | Commands | `K:TOGGLE_NAV_LIGHTS` |

### Universal SimVars (ALL Aircraft)
These work with every aircraft and should be the default for widgets:

```javascript
// Flight Data
'PLANE ALTITUDE'              // feet
'PLANE HEADING DEGREES MAGNETIC' // degrees
'AIRSPEED INDICATED'          // knots
'VERTICAL SPEED'              // feet/min
'GROUND VELOCITY'             // knots

// Flight Controls
'AILERON POSITION'            // -1 to 1
'ELEVATOR POSITION'           // -1 to 1
'RUDDER POSITION'             // -1 to 1
'YOKE X POSITION'             // -1 to 1
'YOKE Y POSITION'             // -1 to 1

// Engine/Throttle
'GENERAL ENG THROTTLE LEVER POSITION:1'  // percent
'GENERAL ENG PROPELLER LEVER POSITION:1' // percent
'GENERAL ENG MIXTURE LEVER POSITION:1'   // percent

// Systems
'BRAKE PARKING POSITION'      // bool
'GEAR HANDLE POSITION'        // bool
'FLAPS HANDLE INDEX'          // number
'LIGHT NAV'                   // bool
'LIGHT BEACON'                // bool
```

### Aircraft-Specific L-Vars

#### FlyByWire A320 (Community)
```javascript
'L:A32NX_AUTOPILOT_1_ACTIVE'
'L:A32NX_AUTOPILOT_HEADING_SELECTED'
'L:A32NX_AUTOPILOT_ALTITUDE_SELECTED'
'L:A32NX_FCU_SPD_MANAGED_DASHES'
'L:A32NX_ELEC_AC_1_BUS_IS_POWERED'
```

#### PMDG 737 (Marketplace)
```javascript
'L:PMDG_737_MCP_HDGDial_Value'
'L:PMDG_737_MCP_ALTDial_Value'
'L:PMDG_737_MCP_VSDial_Value'
'L:PMDG_737_MCP_annunAP_A_Status'
```

#### IniBuilds A300/A350
```javascript
'L:INI_AUTOPILOT_ACTIVE'
'L:INI_MASTER_WARNING'
```

### MobiFlight WASM Integration
For L-Vars not exposed by SimConnect, use the MobiFlight WASM module:

```javascript
// Register with MobiFlight
// Send: MF.Clients.Add.SimWidget
// Receive: MF.Clients.Add.SimWidget.Finished

// Subscribe to L-Var
// Send: MF.SimVars.Add.(L:A32NX_AUTOPILOT_1_ACTIVE)
```

---

## Component Presets (Quick Setup)

Pre-configured components for common use cases:

```javascript
const COMPONENT_PRESETS = {
    // AxisPad Presets
    'yoke': {
        type: 'AxisPad',
        label: 'Yoke',
        xAxis: { simvar: 'A:YOKE X POSITION', command: 'AXIS_AILERONS_SET' },
        yAxis: { simvar: 'A:YOKE Y POSITION', command: 'AXIS_ELEVATOR_SET' }
    },
    
    // LinearSlider Presets
    'throttle': {
        type: 'LinearSlider',
        label: 'Throttle',
        orientation: 'vertical',
        simvar: 'A:GENERAL ENG THROTTLE LEVER POSITION:1',
        command: 'THROTTLE_SET'
    },
    'rudder': {
        type: 'LinearSlider',
        label: 'Rudder',
        orientation: 'horizontal',
        simvar: 'A:RUDDER POSITION',
        command: 'AXIS_RUDDER_SET',
        centerReturn: true
    },
    
    // RotaryKnob Presets
    'trim-wheel': {
        type: 'RotaryKnob',
        label: 'Trim',
        simvar: 'A:ELEVATOR TRIM POSITION',
        commandUp: 'ELEV_TRIM_UP',
        commandDown: 'ELEV_TRIM_DN'
    },
    'heading-bug': {
        type: 'RotaryKnob',
        label: 'HDG',
        simvar: 'A:AUTOPILOT HEADING LOCK DIR',
        commandUp: 'HEADING_BUG_INC',
        commandDown: 'HEADING_BUG_DEC'
    }
};
```

---


## Technology Stack

### Frontend
- **HTML/CSS/JS** - Core widget UI
- **React 18** - Web dashboard & designer
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management

### Backend
- **Node.js** - Runtime
- **Express** - HTTP server (port 8080)
- **WebSocket** - Real-time communication
- **node-simconnect** - MSFS connection

### Desktop
- **Electron** - Cross-platform overlay
- **AutoHotKey v2** - ChasePlane keystroke injection

### AI/ML
- **Claude API** - Natural language processing
- **Web Speech API** - Voice recognition

### Integrations
- **SimConnect SDK** - MSFS 2020/2024 connection
- **MobiFlight WASM** - L-Var access
- **HubHop API** - Community presets
- **SimBrief API** - Flight planning

---

## Data Flow

```
User Voice ──────┐
                 │
User Text ───────┼──▶ AI Agent ──▶ Intent Parser ──┬──▶ Sim Command
                 │         │                       │
User Input ──────┤         ▼                       ├──▶ Component Update
(AxisPad, etc)   │    Knowledge Base               │
                 │    - Universal SimVars          └──▶ External API
User Click ──────┘    - Aircraft L-Vars
                      - User preferences
```

---

## File Structure

```
SimWidget_Engine/
├── docs/
│   ├── COMPONENT-ARCHITECTURE.md    # Component specs
│   └── SIMVARS-REFERENCE.md         # Variable catalog
├── packages/
│   ├── components/                  # Reusable UI components
│   │   ├── AxisPad/
│   │   ├── LinearSlider/
│   │   ├── RotaryKnob/
│   │   └── ...
│   └── core/                        # Shared engine
├── simwidget-hybrid/
│   ├── backend/
│   │   ├── server.js                # Main server (port 8080)
│   │   └── camera-controller.js     # ChasePlane/native detection
│   ├── shared-ui/                   # Browser-compatible UI
│   ├── toolbar-panel/               # MSFS toolbar panel
│   └── widgets/                     # Widget implementations
├── overlay/                         # Electron overlay app
├── mcp-server/                      # Claude Desktop integration
├── ARCHITECTURE-V2.md               # This file
├── TODO.md                          # Development backlog
└── CLAUDE.md                        # AI context
```

---

## Development Phases

### Phase 1: Foundation ✓ COMPLETE
- [x] Basic SimConnect bridge
- [x] WebSocket server (port 8080)
- [x] Electron overlay
- [x] Flow Pro compatible API
- [x] Port Aircraft Control Widget
- [x] Smart camera controller (ChasePlane detection)
- [x] TCM/NCV keyboard injection

### Phase 2: Component System (CURRENT)
- [x] Define component naming convention
- [x] Document universal SimVars
- [x] Spec AxisPad (joystick) component
- [ ] Implement AxisPad component
- [ ] Create component registry
- [ ] Build widget canvas system
- [ ] Drag-and-drop component placement

### Phase 3: AI Integration
- [ ] Claude API integration
- [ ] Natural language command parsing
- [ ] Smart responses based on sim state
- [ ] Voice recognition (Web Speech API)

### Phase 4: Aircraft Profiles
- [ ] Auto-detect current aircraft
- [ ] Load aircraft-specific L-Vars
- [ ] MobiFlight WASM integration
- [ ] HubHop preset integration

### Phase 5: Web Dashboard
- [ ] React-based widget designer
- [ ] Component palette
- [ ] Cloud sync (optional)
- [ ] Plugin marketplace

### Phase 6: Community
- [ ] Open source release
- [ ] Plugin SDK
- [ ] Documentation site
- [ ] Community widgets

---

## Example AI Interactions

### Scenario 1: Approach Briefing
```
Pilot: "Brief me for the ILS 22L approach at KJFK"

AI: "ILS 22L Kennedy briefing:
- Localizer frequency: 111.5 
- Course: 224°
- Decision altitude: 200 feet
- Missed approach: Climb to 2000, right turn heading 270
- Current weather: Ceiling 800 broken, visibility 3 miles

I've set your NAV1 to 111.5 and course to 224. 
Ready to arm approach when you are."
```

### Scenario 2: Widget Control
```
Pilot: "Show me the yoke position"

AI: [Adds AxisPad component configured for yoke]
"I've added a yoke position display. You can drag it 
to control aileron and elevator inputs."
```

---

## Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| **WIDGET-CREATION-GUIDE.md** | `docs/` | How to create widgets & miniwidgets |
| **COMPONENT-REGISTRY.md** | `docs/` | Catalog of all UI components |
| **COMPONENT-ARCHITECTURE.md** | `docs/` | Component specifications & naming |
| **SIMVARS-REFERENCE.md** | `docs/` | Complete SimVar catalog |
| **MSFS2024-REFERENCE.md** | `simwidget-hybrid/` | MSFS SDK event reference |
| **TODO.md** | root | Development backlog |
| **CLAUDE.md** | root | AI context & quick reference |

---

## Changelog

### v2.1.0 (2026-01-05)
- Added Component System Standard section
- Added AxisPad (joystick) component specification
- Added Aircraft Data Sources section with L-Var documentation
- Added Component Presets section
- Updated Phase 1 as COMPLETE
- Added Phase 2 (Component System) as CURRENT
- Added Related Documents section
- **Created WIDGET-CREATION-GUIDE.md** - Full widget creation documentation
- **Created COMPONENT-REGISTRY.md** - Component catalog with all bindings

### v2.0.0 (2025-01-04)
- Initial AI-powered architecture vision
- AI Agent layer design
- Plugin system concept
