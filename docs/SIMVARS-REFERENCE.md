# SimVars Reference for SimWidget Engine
**Version:** v1.0.0  
**Last Updated:** 2026-01-05  
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\docs\SIMVARS-REFERENCE.md

## Overview

This document catalogs SimConnect variables available for MSFS 2024 widgets. Variables are sourced from:
- **MSFS SDK Documentation** - Official SimVars
- **MobiFlight HubHop** - Community-contributed presets (hubhop.mobiflight.com)
- **FSUIPC7** - Offset mappings for legacy compatibility
- **Lorby AxisAndOhs** - Additional control mappings

## Currently Implemented SimVars (SimWidget Server)

### Flight Data (server.js v1.2)
| SimVar Name | Unit | Type | Description |
|-------------|------|------|-------------|
| PLANE ALTITUDE | feet | FLOAT64 | Current altitude |
| PLANE HEADING DEGREES MAGNETIC | degrees | FLOAT64 | Magnetic heading |
| AIRSPEED INDICATED | knots | FLOAT64 | Indicated airspeed |
| VERTICAL SPEED | feet/minute | FLOAT64 | Vertical speed |
| GROUND VELOCITY | knots | FLOAT64 | Ground speed |
| AMBIENT WIND DIRECTION | degrees | FLOAT64 | Wind direction |
| AMBIENT WIND VELOCITY | knots | FLOAT64 | Wind speed |

### Autopilot Controls (server.js v1.2)
| SimVar Name | Unit | Type | Description |
|-------------|------|------|-------------|
| AUTOPILOT MASTER | bool | INT32 | AP master switch |
| AUTOPILOT HEADING LOCK DIR | degrees | FLOAT64 | AP heading bug |
| AUTOPILOT ALTITUDE LOCK VAR | feet | FLOAT64 | AP target altitude |
| AUTOPILOT VERTICAL HOLD VAR | feet/min | FLOAT64 | AP target VS |

### Lighting (server.js v1.2)
| SimVar Name | Unit | Type | Description |
|-------------|------|------|-------------|
| LIGHT NAV | bool | INT32 | Nav lights |
| LIGHT BEACON | bool | INT32 | Beacon light |
| LIGHT LANDING | bool | INT32 | Landing lights |
| LIGHT TAXI | bool | INT32 | Taxi light |
| LIGHT STROBE | bool | INT32 | Strobe lights |

---

## Recommended SimVars for Future Widgets

### Engine Data
```
ENG N1 RPM:index               - N1 percentage (jets)
ENG N2 RPM:index               - N2 percentage (jets)
GENERAL ENG RPM:index          - Engine RPM
ENG FUEL FLOW GPH:index        - Fuel flow (gallons/hour)
ENG OIL PRESSURE:index         - Oil pressure (PSI)
ENG OIL TEMPERATURE:index      - Oil temp (Rankine)
ENG EXHAUST GAS TEMPERATURE:index - EGT
ENG CYLINDER HEAD TEMPERATURE:index - CHT (piston)
ENG TORQUE:index               - Torque (ft-lbs)
TURB ENG ITT:index             - ITT for turbines
```

### Fuel System
```
FUEL TOTAL QUANTITY            - Total fuel (gallons)
FUEL TOTAL QUANTITY WEIGHT     - Total fuel (pounds)
FUEL LEFT QUANTITY             - Left tank (gallons)
FUEL RIGHT QUANTITY            - Right tank (gallons)
FUEL TANK CENTER QUANTITY      - Center tank (gallons)
ESTIMATED FUEL FLOW            - Current consumption
```

### Navigation
```
NAV OBS:index                  - OBS setting
NAV RADIAL:index               - Current radial
NAV DME:index                  - DME distance (nm)
NAV CDI:index                  - CDI needle deflection
NAV GSI:index                  - Glideslope indicator
GPS GROUND SPEED               - GPS ground speed
GPS WP DISTANCE                - Distance to waypoint
GPS ETE                        - Estimated time enroute
GPS WP BEARING                 - Bearing to waypoint
```

### Aircraft State
```
PLANE LATITUDE                 - Latitude (degrees)
PLANE LONGITUDE                - Longitude (degrees)
PLANE ALT ABOVE GROUND         - AGL altitude
AIRSPEED TRUE                  - True airspeed
AIRSPEED MACH                  - Mach number
TOTAL WEIGHT                   - Aircraft weight
CG PERCENT                     - Center of gravity %
FLAPS HANDLE PERCENT           - Flap position
GEAR HANDLE POSITION           - Gear handle
SPOILERS HANDLE POSITION       - Spoiler position
BRAKE PARKING POSITION         - Parking brake
```

### Environment
```
AMBIENT TEMPERATURE            - OAT (Celsius)
AMBIENT PRESSURE               - Ambient pressure
BAROMETER PRESSURE             - Altimeter setting
AMBIENT VISIBILITY             - Visibility (meters)
AMBIENT PRECIP STATE           - Precipitation type
SEA LEVEL PRESSURE             - QNH
```

### Communications
```
COM ACTIVE FREQUENCY:index     - COM frequency
COM STANDBY FREQUENCY:index    - COM standby
NAV ACTIVE FREQUENCY:index     - NAV frequency
TRANSPONDER CODE:index         - Squawk code
```

---

## MobiFlight HubHop Integration

### Accessing HubHop Presets
HubHop (hubhop.mobiflight.com) provides 4000+ community presets for aircraft-specific controls.

**Variable Types:**
- **A-Vars (SimVars)** - Standard SimConnect variables
- **L-Vars (Local)** - Aircraft-specific local variables
- **H-Vars (HTML)** - HTML gauge variables
- **K-Vars (Key Events)** - Keyboard events

### Using MobiFlight WASM Module
The MobiFlight WASM module enables reading L-Vars not exposed by SimConnect:

```javascript
// Register client with MobiFlight
// Send: MF.Clients.Add.SimWidget
// Receive: MF.Clients.Add.SimWidget.Finished

// Add L-Var monitoring
// Send: MF.SimVars.Add.(L:A32NX_AUTOPILOT_1_ACTIVE)
```

### Aircraft-Specific L-Vars (Examples)

#### FBW A320
```
L:A32NX_AUTOPILOT_1_ACTIVE
L:A32NX_AUTOPILOT_HEADING_SELECTED
L:A32NX_AUTOPILOT_VS_SELECTED
L:A32NX_FCU_SPD_MANAGED_DASHES
L:A32NX_ELEC_AC_1_BUS_IS_POWERED
```

#### PMDG 737
```
L:PMDG_737_MCP_HDGDial_Value
L:PMDG_737_MCP_ALTDial_Value  
L:PMDG_737_MCP_VSDial_Value
L:PMDG_737_MCP_annunAP_A_Status
```

---

## FSUIPC7 Offset Reference

### Common Offsets
| Offset | Size | Description |
|--------|------|-------------|
| 0x0560 | 8 | Latitude (FS units) |
| 0x0568 | 8 | Longitude (FS units) |
| 0x0574 | 4 | Altitude (meters) |
| 0x02BC | 4 | IAS (knots * 128) |
| 0x02B4 | 4 | Ground speed (m/s * 65536) |
| 0x0580 | 4 | Heading (degrees * 65536/360) |
| 0x0842 | 2 | Wind direction |
| 0x0848 | 2 | Wind speed (knots) |
| 0x030C | 2 | Lights bitfield |

### FSUIPC to SimVar Mapping
FSUIPC provides offset-based access for compatibility with legacy tools. Most offsets map directly to SimVars.

---

## Lorby AxisAndOhs Reference

AxisAndOhs provides additional axis and button mappings, particularly useful for:
- Rotary encoder controls
- Multi-position switches
- Conditional assignments

### Key Features
- Calculator code execution
- Variable monitoring
- Custom event triggers
- Profile management

---

## Implementation Notes

### Adding New SimVars to SimWidget Server

1. **Add to data definition:**
```javascript
handle.addToDataDefinition(
    0,                           // Definition ID
    'SIMVAR NAME',               // SimVar name
    'unit',                      // Unit string
    SimConnectDataType.FLOAT64,  // Data type
    0                            // Epsilon (change threshold)
);
```

2. **Update state object:**
```javascript
const flightData = {
    existingVar: 0,
    newVar: 0,  // Add new property
};
```

3. **Read in data handler:**
```javascript
// Order must match addToDataDefinition order
flightData.newVar = d.readFloat64();
```

4. **Update mock data (optional):**
```javascript
flightData.newVar = mockValue + (Math.random() - 0.5) * variation;
```

### SimConnect Data Types
| Type | Size | JavaScript Read |
|------|------|-----------------|
| INT32 | 4 | readInt32() |
| INT64 | 8 | readInt64() |
| FLOAT32 | 4 | readFloat32() |
| FLOAT64 | 8 | readFloat64() |
| STRING256 | 256 | readString(256) |

---

## Resources

- **MSFS SDK SimVars:** https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/SimVars/
- **MobiFlight HubHop:** https://hubhop.mobiflight.com
- **MobiFlight WASM:** https://github.com/MobiFlight/MobiFlight-WASM-Module
- **FSUIPC7:** https://fsuipc.com/fsuipc7/
- **Lorby AxisAndOhs:** https://www.interlook.ch/axisandohs/

---

## Related Documents

- **COMPONENT-REGISTRY.md** - Shows which SimVars are bound to which UI elements
- **WIDGET-CREATION-GUIDE.md** - How to use SimVars in widgets
- **ARCHITECTURE-V2.md** - System architecture and data flow

---

## Changelog

### v1.1.0 (2026-01-05)
- Added Related Documents section
- Cross-referenced with COMPONENT-REGISTRY.md

### v1.0.0 (2026-01-05)
- Initial document creation
- Documented currently implemented SimVars
- Added recommended SimVars for future widgets
- Included MobiFlight, FSUIPC, and AxisAndOhs references
