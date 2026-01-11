# SimWidget Engine
**Version:** v1.10.0  
**Last updated:** 2026-01-09

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

## ⚠️ Before Starting Any Work

**Read [STANDARDS.md](STANDARDS.md) first!** Contains proven patterns, timing defaults, and lessons learned.

## ⚠️ Important Rules

- **NEVER use Anthropic API key for Kitt agent** - not cost effective. Use relay mode or direct Claude Code instead.

### Files using API keys (need refactoring):
| File | Usage | Refactor To |
|------|-------|-------------|
| `Admin/agent/agent-server.js` | Kitt chat | Relay mode / Claude Code MCP |
| `overlay/renderer/copilot-ui.js` | Overlay copilot | Relay mode |
| `packages/core/agents.js` | Core agents | Relay mode |

## User Shortcuts

| Shortcut | Meaning |
|----------|---------|
| `mem` | memory - add to CLAUDE.md for future reference |
| `ntt` | next todo task - work on next item from todo list |
| `br` | add to todo options - add feature/option to todo module |
| `mst` | make standard - add pattern/convention to STANDARDS.md |
| `memstandards` | session reflection - review session work and add learned patterns to STANDARDS.md |
| `psreflect` | project reflection - give recommendations based on project experience |
| `ts` | test this - run tests on recent changes |
| `rst` | reset - reset stuck services/state |
| `rfr` | refactor from standards - refactor code to follow STANDARDS.md |
| `chk` | check/verify - check status, syntax, or state |
| `opn` | open UI - open browser to test |
| `syn` | sync - test sync/reconcile features |
| `cls` | clear/clean - clear stuck queues, logs, cache |
| `idt` | I don't think/know - signals uncertainty, needs clarification |

## Identity

**Claude is Kitt** - The AI assistant (Claude) operates as "Kitt" in the Admin UI agent interface. Same assistant, different name for the user-facing persona.

## Development Practice

**Continuous Improvement Loop:**
- When learning something new → update CLAUDE.md or STANDARDS.md
- When testing reveals issues → add to todo list for fixes
- When patterns emerge → document in STANDARDS.md
- When debugging takes time → add gotcha to Known Gotchas section
- Always capture lessons learned before moving on

## Quick Context

- **Platform:** Windows 10/11 + MSFS 2020/2024
- **Architecture:** Node.js server + Electron overlay
- **Status:** Phase 2 - Complete Controls (in progress)
- **Goal:** Run Flow Pro widgets without Flow Pro

## Documentation Index

| Document | Path | Purpose |
|----------|------|---------|
| **PROJECT-PLAN.md** | `PROJECT-PLAN.md` | **Project roadmap & milestones** |
| **PLUGINS.md** | `docs/PLUGINS.md` | **Plugin system & API** |
| **RESOURCES.md** | `docs/RESOURCES.md` | **External API integrations** |
| **WIDGET-INVENTORY.md** | `docs/WIDGET-INVENTORY.md` | **Widget standards & templates** |
| **STANDARDS.md** | `STANDARDS.md` | **Patterns, timing defaults, conventions** |
| **CLAUDE.md** | `CLAUDE.md` | This file - AI context |
| **ARCHITECTURE.md** | `ARCHITECTURE.md` | System architecture v3.0 |
| **TODO.md** | `TODO.md` | Development backlog |
| **Widget Creation Guide** | `docs/WIDGET-CREATION-GUIDE.md` | How to build widgets |
| **Component Registry** | `docs/COMPONENT-REGISTRY.md` | All UI components catalog |
| **Component Architecture** | `docs/COMPONENT-ARCHITECTURE.md` | Component specs & naming |
| **SimVars Reference** | `docs/SIMVARS-REFERENCE.md` | SimConnect variables |
| **Flow Pro Reference** | `docs/FLOW-PRO-REFERENCE.md` | Widget API & categories |

## Security Tools

| Tool | Path | Purpose |
|------|------|---------|
| **Security Inspector** | `tools/security-inspector.js` | Scan files for vulnerabilities |
| **Widget Validator** | `tools/widget-validator.js` | Validate community widgets |
| **Security API** | `tools/security-api.js` | REST API for scanning |

## Architecture Overview

```
MSFS 2024 ──► SimConnect API ──► SimWidget Server (port 8080)
                                        │
                                   WebSocket
                                        │
                                        ▼
                               Electron Overlay
                              (Flow Pro Compatible API)

Service Management:
┌─────────────────────────────────────────────────────────┐
│           Master (O) (port 8500) - MASTER               │
│     - Health watchdog, auto-restart, web dashboard      │
└──────────────────────┬──────────────────────────────────┘
                       │ monitors/controls
        ┌──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼               ▼
   Main Server     Agent (Kitt)   Remote Support   [Future]
   (8080)          (8585)         (8590)           
```

## Project Structure

```
SimWidget_Engine/
├── docs/                      # Documentation
│   ├── WIDGET-CREATION-GUIDE.md  # How to build widgets
│   ├── COMPONENT-REGISTRY.md     # All components catalog
│   ├── COMPONENT-ARCHITECTURE.md # Component specs
│   └── SIMVARS-REFERENCE.md      # SimVar catalog
├── simwidget-hybrid/          # Main hybrid server
│   ├── backend/
│   │   ├── server.js          # Main server v1.2 - WebSocket + SimConnect
│   │   └── camera-controller.js  # Smart camera routing
│   ├── shared-ui/             # Browser/MSFS panel UI
│   │   ├── index.html         # Main widget HTML
│   │   ├── styles.css         # All component styles
│   │   └── app.js             # Component logic + AxisPad
│   ├── toolbar-panel/         # MSFS toolbar integration
│   └── widgets/               # Additional widgets
├── camera-helper.ahk          # AHK keystroke helper for ChasePlane
├── overlay/                   # Electron overlay app
│   ├── main.js               
│   ├── preload.js            
│   └── renderer/             
├── widgets/                   # User widgets go here
├── CLAUDE.md                  # This file
├── ARCHITECTURE-V2.md         # System architecture v2.1
├── TODO.md                    # Development todo list
└── README.md                  # User documentation
```

## Key Components

### Server (`server/index.js`)
- Connects to MSFS via node-simconnect
- Exposes WebSocket on port 8484
- Caches SimVar values
- Handles K: events

### Overlay (`overlay/`)  
- Transparent Electron window
- Loads widgets from `widgets/` folder
- Provides Flow Pro compatible `$api`

### Camera Controller (`simwidget-hybrid/backend/camera-controller.js`)
Smart camera control system with ChasePlane detection and dual-mode support.

**Architecture:**
```
Widget Button Click
        │
        ▼
    server.js
        │
        ▼
camera-controller.js ──► detectChasePlane()
        │
        ├─► ChasePlane Mode: Write to camera-command.txt ──► camera-helper.ahk ──► Keystroke
        │
        └─► Native Mode: SimConnect event or keyboard fallback
```

**ChasePlane Mode (AHK Helper):**
- Detects ChasePlane via `CP MSFS Bridge.exe` process
- Writes commands to `camera-command.txt`
- AHK helper watches file and sends keystrokes
- Bypasses MSFS input filtering that blocks SendKeys

**Native Mode (SimConnect/Keyboard):**
- Uses SimConnect events when available
- Falls back to keyboard shortcuts
- Events: `TOGGLE_DRONE_MODE`, `VIEW_CAMERA_SELECT_1`, `VIEW_MODE`

**Button Mappings:**
| Button | ChasePlane | Native MSFS |
|--------|------------|-------------|
| TCM (Toggle Cinematic) | Alt+Z | TOGGLE_DRONE_MODE |
| NCV (Next Cinematic) | Alt+X | VIEW_CAMERA_SELECT_1 |
| I/E (Internal/External) | Backspace | VIEW_MODE |

**Files:**
- `camera-controller.js` - Smart routing logic
- `camera-helper.ahk` - AHK keystroke helper (ChasePlane mode)
- `camera-command.txt` - IPC between Node and AHK

**Starting Camera Controls:**
```powershell
# 1. Start AHK helper (if using ChasePlane)
Start-Process C:\DevOSWE\camera-helper.ahk

# 2. Start server
cd C:\DevOSWE\simwidget-hybrid
node backend\server.js
```

## Flow Pro Compatible API

```javascript
// Same API as Flow Pro - easy migration
$api.variables.get('A:INDICATED ALTITUDE', 'feet')
$api.variables.set('K:TOGGLE_NAV_LIGHTS', 'number', 1)
$api.datastore.export({ x: 100, y: 200 })
$api.datastore.import()
```

## Running

```bash
# Terminal 1 - Start server (MSFS must be running)
cd server
npm start

# Terminal 2 - Start overlay
cd overlay  
npm start
```

## Development Notes

### Windows-Only Dependencies
- `node-simconnect` - requires Windows + SimConnect SDK
- Won't install on Linux/Mac/Codex

### Testing Strategy
- Server WebSocket logic: can unit test with mocks
- Overlay: requires Windows + display
- Integration: requires MSFS running

## Widget Migration from Flow Pro

1. Copy widget JS to `widgets/` folder
2. Replace `this.$api` with `$api` parameter
3. Remove Flow Pro-specific hooks (optional)
4. Widget should work with minimal changes

## Batch Scripts

- `start-server.bat` - Launch server
- `start-overlay.bat` - Launch overlay
- `install.bat` - Install all dependencies

## Resources

- [node-simconnect](https://github.com/EvenAR/node-simconnect)
- [Electron Docs](https://www.electronjs.org/docs)
- [MSFS SimConnect SDK](https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm)
- [MobiFlight HubHop](https://hubhop.mobiflight.com) - Community presets
- [FlyByWire A32NX API](https://docs.flybywiresim.com/aircraft/a32nx/a32nx-api/)

## Component System

### Implemented Components
| Component | CSS Class | Status |
|-----------|-----------|--------|
| AxisPad (Joystick) | `.swc-ap`, `.axispad` | ✅ v1.2 |
| PushButton | `.swc-pb`, `.btn` | ✅ v1.0 |
| LinearSlider | `.swc-ls`, `.lever` | ✅ v1.0 |
| DataField | `.swc-df`, `.di` | ✅ v1.0 |
| StatusLamp | `.swc-sl`, `.sd` | ✅ v1.0 |
| RockerSwitch | `.swc-rs`, `.ap-adj` | 🔨 Partial |
| RotaryKnob | `.swc-rk` | 📋 Planned |
| ToggleSwitch | `.swc-ts` | 📋 Planned |
| ProgressBar | `.swc-pg` | 📋 Planned |

### Naming Convention
| Old Name | New Name | Prefix |
|----------|----------|--------|
| joystick | AxisPad | swc-ap |
| slider | LinearSlider | swc-ls |
| knob | RotaryKnob | swc-rk |
| button | PushButton | swc-pb |
| display | DataField | swc-df |
| indicator | StatusLamp | swc-sl |

See `docs/COMPONENT-REGISTRY.md` for full component catalog.

## Camera Controls Troubleshooting

**ChasePlane detected but buttons don't work:**
1. Ensure `camera-helper.ahk` is running (check system tray)
2. Verify ChasePlane keybindings: Alt+Z, Alt+X, Backspace
3. Check `camera-command.txt` is being created

**Native mode not working:**
1. Check SimConnect is connected (console shows "Connected to MSFS")
2. Verify MSFS camera keybindings match expected defaults
3. Test with MSFS window focused

**Wrong mode detected:**
- ChasePlane detection looks for `CP MSFS Bridge.exe` in process list
- Bridge auto-starts when ChasePlane addon is installed
- To test native mode: disable ChasePlane in MSFS Content Manager
