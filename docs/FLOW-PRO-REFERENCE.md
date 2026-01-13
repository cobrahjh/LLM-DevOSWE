# Flow Pro Widget Reference
**Version:** 1.0.0  
**Last Updated:** 2025-01-07

Complete reference of Flow Pro categories, widgets, and API patterns for SimWidget Engine compatibility.

---

## Category Structure

| # | Category | Items | Priority | SimWidget Status |
|---|----------|-------|----------|------------------|
| 1 | AUTOPILOT | 6 | ✅ HIGH | Implemented |
| 2 | CAMERAS | 5 | ✅ HIGH | Implemented |
| 3 | CONTROLS | 12 | 🔶 HIGH | Partial |
| 4 | LIGHTS | 11 | 🔶 HIGH | Partial (5/11) |
| 5 | ENGINES | 1 | ✅ HIGH | Implemented |
| 6 | FUEL | 1 | ✅ HIGH | Implemented |
| 7 | RADIOS | 7 | 🔶 MEDIUM | Not started |
| 8 | INSTRUMENTS | 2 | 🔶 MEDIUM | Not started |
| 9 | HUD | 6 | 🔶 MEDIUM | Not started |
| 10 | DOORS | 9 | 🔷 MEDIUM | Not started |
| 11 | ELECTRICAL | 3 | 🔷 MEDIUM | Not started |
| 12 | TIME OF DAY | 13 | 🔷 LOW | Not started |
| 13 | WEATHER | 50 | 🔷 LOW | Not started |
| 14 | POSITION | 3 | 🔷 LOW | Not started |
| 15 | UTILITIES | 7 | 🔷 LOW | Not started |
| 16 | MSFS PANELS | 21 | ⬜ LOW | Panel launcher |
| 17 | GAME | 6 | ⬜ LOW | Not started |
| 18 | GAME SERVERS | 4 | ⬜ SKIP | Multiplayer |
| 19 | STREAMING | 1-3 | ⬜ SKIP | Twitch integration |
| 20 | DEV TOOLS | 3 | ⬜ SKIP | Debug only |

**Total: ~170 items across 20 categories**

---

## Priority Roadmap

### Phase 1: Core Flight (DONE ✅)
- [x] Autopilot (HDG, ALT, VS, SPD, master)
- [x] Cameras (views, zoom, pan, presets)
- [x] Engine controls (throttle, prop, mixture)
- [x] Basic lights (nav, beacon, strobe, landing, taxi)
- [x] Basic controls (gear, flaps, spoilers, parking brake)
- [x] Fuel display

### Phase 2: Complete Controls (IN PROGRESS 🔶)
- [ ] Additional lights (logo, wing, cabin, panel, recognition, ice)
- [ ] Additional controls (trim, cowl flaps, carburetor heat, pitot heat)
- [ ] Doors (main, cargo, emergency exits)
- [ ] Electrical (battery, alternator, avionics master)

### Phase 3: Radio & Navigation
- [ ] COM1/COM2 (active, standby, swap)
- [ ] NAV1/NAV2 (active, standby, swap)
- [ ] ADF frequency
- [ ] Transponder (code, mode)
- [ ] DME

### Phase 4: Information & HUD
- [ ] Instrument overlays
- [ ] G-force display
- [ ] Wind vector
- [ ] Control input visualization
- [ ] Altitude/speed tape

### Phase 5: Environment
- [ ] Time of day controls
- [ ] Weather presets
- [ ] Position/teleport

### Phase 6: Advanced (Optional)
- [ ] MSFS panel launcher
- [ ] Game settings
- [ ] Utilities

---

## Detailed Category Contents

### AUTOPILOT (6 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| AP Master | K:AP_MASTER | ✅ |
| Heading Hold | K:AP_HDG_HOLD | ✅ |
| Altitude Hold | K:AP_ALT_HOLD | ✅ |
| VS Hold | K:AP_VS_HOLD | ✅ |
| Speed Hold | K:AP_PANEL_SPEED_HOLD | ✅ |
| Approach | K:AP_APR_HOLD | ❌ |

### CAMERAS (5 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Cockpit View | K:VIEW_COCKPIT | ✅ |
| External View | K:VIEW_EXTERNAL | ✅ |
| Drone | K:TOGGLE_DRONE | ✅ |
| Next Camera | K:VIEW_CAMERA_SELECT | ✅ |
| Reset View | K:VIEW_RESET | ✅ |

### CONTROLS (12 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Gear Toggle | K:GEAR_TOGGLE | ✅ |
| Flaps Up | K:FLAPS_UP | ✅ |
| Flaps Down | K:FLAPS_DOWN | ✅ |
| Spoilers | K:SPOILERS_TOGGLE | ✅ |
| Parking Brake | K:PARKING_BRAKES | ✅ |
| Aileron Trim L | K:AILERON_TRIM_LEFT | ❌ |
| Aileron Trim R | K:AILERON_TRIM_RIGHT | ❌ |
| Elevator Trim Up | K:ELEV_TRIM_UP | ❌ |
| Elevator Trim Dn | K:ELEV_TRIM_DN | ❌ |
| Rudder Trim L | K:RUDDER_TRIM_LEFT | ❌ |
| Rudder Trim R | K:RUDDER_TRIM_RIGHT | ❌ |
| Cowl Flaps | K:COWLFLAP_SET | ❌ |

### LIGHTS (11 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Nav Lights | K:TOGGLE_NAV_LIGHTS | ✅ |
| Beacon | K:TOGGLE_BEACON_LIGHTS | ✅ |
| Strobes | K:STROBES_TOGGLE | ✅ |
| Landing | K:LANDING_LIGHTS_TOGGLE | ✅ |
| Taxi | K:TOGGLE_TAXI_LIGHTS | ✅ |
| Logo | K:TOGGLE_LOGO_LIGHTS | ❌ |
| Wing | K:TOGGLE_WING_LIGHTS | ❌ |
| Cabin | K:TOGGLE_CABIN_LIGHTS | ❌ |
| Panel | K:PANEL_LIGHTS_TOGGLE | ❌ |
| Recognition | K:TOGGLE_RECOGNITION_LIGHTS | ❌ |
| Ice Lights | K:TOGGLE_ICE_LIGHTS | ❌ |

### ENGINES (1 item)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Engine Master | Multiple | ✅ (throttle/prop/mixture) |

### FUEL (1 item)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Fuel Level | A:FUEL TOTAL QUANTITY | ✅ |
| Add Fuel | K:ADD_FUEL_QUANTITY | ❌ |
| Fuel Capacity | A:FUEL TOTAL CAPACITY | ❌ |

### DOORS (9 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Main Door | K:TOGGLE_AIRCRAFT_EXIT | ❌ |
| Cargo Front | K:TOGGLE_AIRCRAFT_EXIT_2 | ❌ |
| Cargo Rear | K:TOGGLE_AIRCRAFT_EXIT_3 | ❌ |
| Emergency 1-6 | K:TOGGLE_AIRCRAFT_EXIT_4-9 | ❌ |

### ELECTRICAL (3 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Battery | K:TOGGLE_MASTER_BATTERY | ❌ |
| Alternator | K:TOGGLE_MASTER_ALTERNATOR | ❌ |
| Avionics | K:TOGGLE_AVIONICS_MASTER | ❌ |

### RADIOS (7 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| COM1 Active | A:COM ACTIVE FREQUENCY:1 | ❌ |
| COM1 Standby | A:COM STANDBY FREQUENCY:1 | ❌ |
| COM1 Swap | K:COM_STBY_RADIO_SWAP | ❌ |
| COM2 Active | A:COM ACTIVE FREQUENCY:2 | ❌ |
| NAV1 Active | A:NAV ACTIVE FREQUENCY:1 | ❌ |
| Transponder | A:TRANSPONDER CODE:1 | ❌ |
| XPDR Mode | K:XPNDR_SET | ❌ |

### HUD (6 items)
| Widget | Description | SimWidget |
|--------|-------------|-----------|
| Control Inputs | Stick/rudder visualization | ❌ |
| G-Force | Current G display | ❌ |
| Wind Vector | Wind direction/speed | ❌ |
| Altitude Tape | Vertical speed indicator | ❌ |
| Speed Tape | IAS/TAS display | ❌ |
| Compass | Heading rose | ❌ |

### TIME OF DAY (13 items)
| Widget | SimVar/Event | SimWidget |
|--------|--------------|-----------|
| Dawn | K:TIME_SET | ❌ |
| Morning | K:TIME_SET | ❌ |
| Noon | K:TIME_SET | ❌ |
| Afternoon | K:TIME_SET | ❌ |
| Dusk | K:TIME_SET | ❌ |
| Night | K:TIME_SET | ❌ |
| +1 Hour | K:ZULU_HOURS_INC | ❌ |
| -1 Hour | K:ZULU_HOURS_DEC | ❌ |
| +10 Min | K:ZULU_MINUTES_INC | ❌ |
| -10 Min | K:ZULU_MINUTES_DEC | ❌ |
| Real Time | K:REAL_TIME | ❌ |
| Time x2 | K:SIM_RATE_INCR | ❌ |
| Time x1 | K:SIM_RATE | ❌ |

### WEATHER (50 items)
Presets for various weather conditions - uses internal MSFS weather system.

---

## Flow Pro Widget API

### Basic Structure
```javascript
// ACTION - runs on widget click
run(() => {
    this.$api.variables.set("K:EVENT_NAME", "Type", value);
})

// INFO - displays text on widget
info(() => {
    const val = this.$api.variables.get("A:SIMVAR", "Units");
    return 'Label: ' + val;
})
```

### API Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `this.$api.variables.get(simvar, units)` | Read SimVar | `get("A:AIRSPEED INDICATED", "Knots")` |
| `this.$api.variables.set(event, type, val)` | Send event | `set("K:AP_MASTER", "Bool", 1)` |
| `this.$api.datastore.get(key)` | Read stored value | `get("myKey")` |
| `this.$api.datastore.set(key, val)` | Store value | `set("myKey", 123)` |

### Variable Types

| Prefix | Type | Example |
|--------|------|---------|
| `A:` | Aircraft SimVar (read) | `A:FUEL TOTAL QUANTITY` |
| `K:` | Key Event (write) | `K:TOGGLE_NAV_LIGHTS` |
| `L:` | Local Variable | `L:CUSTOM_VAR` |
| `E:` | Environment | `E:LOCAL TIME` |

### Unit Types
- `Number` - Generic number
- `Bool` - Boolean (0/1)
- `Knots` - Speed
- `Feet` - Altitude
- `Gallons` - Fuel volume
- `Percent` - 0-100
- `Degrees` - Heading/angle
- `Radians` - Angle
- `Position` - -1 to 1

---

## Widget Code Examples

### Fuel Level Display
```javascript
run(() => {
    this.$api.variables.set("K:ADD_FUEL_QUANTITY", "Number", 1);
})
info(() => {
    return 'Fuel level <br/>' + Math.round(
        this.$api.variables.get("A:FUEL TOTAL QUANTITY", "Gallons") / 
        this.$api.variables.get("A:FUEL TOTAL CAPACITY", "Gallons") * 100
    ) + '%';
})
```

### Toggle Nav Lights
```javascript
run(() => {
    this.$api.variables.set("K:TOGGLE_NAV_LIGHTS", "Bool", 1);
})
info(() => {
    const on = this.$api.variables.get("A:LIGHT NAV", "Bool");
    return 'Nav Lights: ' + (on ? 'ON' : 'OFF');
})
```

### Gear Toggle with Status
```javascript
run(() => {
    this.$api.variables.set("K:GEAR_TOGGLE", "Bool", 1);
})
info(() => {
    const down = this.$api.variables.get("A:GEAR HANDLE POSITION", "Bool");
    return 'Gear: ' + (down ? 'DOWN' : 'UP');
})
```

### Heading Bug Set
```javascript
run(() => {
    const current = this.$api.variables.get("A:PLANE HEADING DEGREES MAGNETIC", "Degrees");
    this.$api.variables.set("K:HEADING_BUG_SET", "Degrees", Math.round(current));
})
info(() => {
    const bug = this.$api.variables.get("A:AUTOPILOT HEADING LOCK DIR", "Degrees");
    return 'HDG Bug: ' + Math.round(bug) + '°';
})
```

---

## Adding New Examples

When sharing Flow widget code, I'll add it here with:
1. Widget name/purpose
2. Original Flow code
3. SimWidget equivalent
4. SimVars/Events used
