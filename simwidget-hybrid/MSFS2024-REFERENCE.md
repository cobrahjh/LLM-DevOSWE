# MSFS 2024 SimConnect Reference
**Version:** v1.0.0
**Last Updated:** 2026-01-05

Quick reference for SimWidget development based on official MSFS 2024 SDK documentation.

## Default Keyboard Shortcuts

| Action | Key | Notes |
|--------|-----|-------|
| Cockpit/External View Toggle | **BACKSPACE** | Toggle between internal and external camera |
| Toggle Drone Camera | SHIFT + X | |
| External View Look Down | SHIFT + I | |
| External View Look Left | SHIFT + L | |
| External View Look Right | SHIFT + J | |
| External View Look Up | SHIFT + K | |
| Load Custom Camera 1-4 | SHIFT + F1-F4 | |
| Save Custom Camera 1-4 | SHIFT + F5-F8 | |
| Photo Mode Toggle | SHIFT + V | |

## SimConnect Key Events (Used in SimWidget)

### Autopilot Events
| Event | Description | Value |
|-------|-------------|-------|
| `AP_MASTER` | Toggle autopilot master | - |
| `AP_HDG_HOLD` | Toggle heading hold | - |
| `AP_ALT_HOLD` | Toggle altitude hold | - |
| `AP_VS_HOLD` | Toggle vertical speed hold | - |
| `AP_PANEL_SPEED_HOLD` | Toggle speed hold | - |
| `HEADING_BUG_SET` | Set heading bug directly | 0-359 degrees |
| `AP_ALT_VAR_SET_ENGLISH` | Set altitude directly | feet |
| `AP_VS_VAR_SET_ENGLISH` | Set vertical speed directly | fpm (can be negative) |
| `AP_SPD_VAR_SET` | Set airspeed directly | knots |
| `HEADING_BUG_INC` / `_DEC` | Increment/decrement heading | - |
| `AP_ALT_VAR_INC` / `_DEC` | Increment/decrement altitude | - |
| `AP_VS_VAR_INC` / `_DEC` | Increment/decrement V/S | - |
| `AP_SPD_VAR_INC` / `_DEC` | Increment/decrement speed | - |

### Engine Control Events
| Event | Description | Value |
|-------|-------------|-------|
| `THROTTLE_SET` | Set throttle | 0-16383 |
| `PROP_PITCH_SET` | Set propeller pitch | 0-16383 |
| `MIXTURE_SET` | Set mixture | 0-16383 |
| `ENGINE_AUTO_START` | Auto-start engine | - |
| `ENGINE_AUTO_SHUTDOWN` | Auto-shutdown engine | - |

### Light Events
| Event | Description |
|-------|-------------|
| `TOGGLE_NAV_LIGHTS` | Toggle navigation lights |
| `TOGGLE_BEACON_LIGHTS` | Toggle beacon lights |
| `STROBES_TOGGLE` | Toggle strobe lights |
| `LANDING_LIGHTS_TOGGLE` | Toggle landing lights |
| `TOGGLE_TAXI_LIGHTS` | Toggle taxi lights |

### View/Camera Events
| Event | Description | Notes |
|-------|-------------|-------|
| `VIEW_MODE` | Toggle cockpit/external view | BACKSPACE key (SimConnect) |

### Keyboard Shortcuts (via PowerShell SendKeys)
| Command | Keys Sent | Description |
|---------|-----------|-------------|
| `KEY_TOGGLE_CINEMATIC` | Left Alt + Z | Toggle cinematic/showcase mode (TCM button) |
| `KEY_NEXT_CINEMATIC` | Left Alt + X | Next cinematic camera view (NCV button) |

**Note:** Camera keyboard shortcuts bypass SimConnect (which has known camera event issues) and send actual key presses to MSFS. Configure these keybindings in MSFS Options → Controls → Camera.

### Flight Control Events
| Event | Description | Value |
|-------|-------------|-------|
| `AXIS_AILERONS_SET` | Set aileron position | -16383 to 16383 |
| `AXIS_ELEVATOR_SET` | Set elevator position | -16383 to 16383 |
| `AXIS_RUDDER_SET` | Set rudder position | -16383 to 16383 |
| `CENTER_AILER_RUDDER` | Center all controls | - |

### Systems Events
| Event | Description |
|-------|-------------|
| `PARKING_BRAKES` | Toggle parking brake |
| `GEAR_TOGGLE` | Toggle landing gear |
| `FLAPS_UP` | Retract flaps |
| `FLAPS_DOWN` | Extend flaps |

## SimConnect SimVars (Data Reading)

### Flight Data
| SimVar | Unit | Type |
|--------|------|------|
| `PLANE ALTITUDE` | feet | FLOAT64 |
| `AIRSPEED INDICATED` | knots | FLOAT64 |
| `PLANE HEADING DEGREES MAGNETIC` | degrees | FLOAT64 |
| `VERTICAL SPEED` | feet per minute | FLOAT64 |

### Autopilot Data
| SimVar | Unit | Type |
|--------|------|------|
| `AUTOPILOT MASTER` | Bool | INT32 |
| `AUTOPILOT HEADING LOCK` | Bool | INT32 |
| `AUTOPILOT ALTITUDE LOCK` | Bool | INT32 |
| `AUTOPILOT VERTICAL HOLD` | Bool | INT32 |
| `AUTOPILOT AIRSPEED HOLD` | Bool | INT32 |
| `AUTOPILOT HEADING LOCK DIR` | degrees | FLOAT64 |
| `AUTOPILOT ALTITUDE LOCK VAR` | feet | FLOAT64 |
| `AUTOPILOT VERTICAL HOLD VAR` | feet per minute | FLOAT64 |
| `AUTOPILOT AIRSPEED HOLD VAR` | knots | FLOAT64 |

### Fuel Data
| SimVar | Unit | Type |
|--------|------|------|
| `FUEL TOTAL QUANTITY` | gallons | FLOAT64 |
| `ENG FUEL FLOW GPH:1` | gallons per hour | FLOAT64 |
| `FUEL LEFT QUANTITY` | gallons | FLOAT64 |
| `FUEL RIGHT QUANTITY` | gallons | FLOAT64 |

### Engine Data
| SimVar | Unit | Type |
|--------|------|------|
| `GENERAL ENG THROTTLE LEVER POSITION:1` | Percent | FLOAT64 |
| `GENERAL ENG PROPELLER LEVER POSITION:1` | Percent | FLOAT64 |
| `GENERAL ENG MIXTURE LEVER POSITION:1` | Percent | FLOAT64 |
| `ENG COMBUSTION:1` | Bool | INT32 |

### System Status
| SimVar | Unit | Type |
|--------|------|------|
| `BRAKE PARKING POSITION` | Bool | INT32 |
| `GEAR HANDLE POSITION` | Bool | INT32 |
| `FLAPS HANDLE INDEX` | Number | INT32 |
| `LIGHT NAV` | Bool | INT32 |
| `LIGHT BEACON` | Bool | INT32 |
| `LIGHT STROBE` | Bool | INT32 |
| `LIGHT LANDING` | Bool | INT32 |
| `LIGHT TAXI` | Bool | INT32 |

### Flight Control Data
| SimVar | Unit | Type | Range |
|--------|------|------|-------|
| `AILERON POSITION` | Position | FLOAT64 | -1.0 to 1.0 |
| `ELEVATOR POSITION` | Position | FLOAT64 | -1.0 to 1.0 |
| `RUDDER POSITION` | Position | FLOAT64 | -1.0 to 1.0 |

## SDK Documentation Links
- Key Events: https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/Key_Events/Key_Events.htm
- SimVars: https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/SimVars/Simulation_Variables.htm
- SimConnect SDK: https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/SimConnect/SimConnect_SDK.htm

## Notes
- SimConnect value conversion for levers: 0-100% maps to 0-16383
- SimConnect value conversion for flight controls: -100 to 100 maps to -16383 to 16383
- VIEW_MODE event corresponds to BACKSPACE key (Cockpit/External toggle)
- All Bool SimVars return INT32 (0 = false, non-zero = true)
- Flight control positions return -1.0 to 1.0 (convert to -100 to 100 for display)
- Camera/View events may not work reliably via SimConnect (known SDK limitation)
