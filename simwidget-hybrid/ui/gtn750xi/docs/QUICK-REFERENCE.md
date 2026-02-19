# GTN750 Quick Reference Guide

Fast lookup for common GTN750 operations and visual indicators.

## Flight Plan Route Colors

| Color | Meaning | Details |
|-------|---------|---------|
| **Magenta Thick** | Active leg | Currently flying this segment |
| **Magenta Solid** | Future direct legs | Direct waypoint-to-waypoint |
| **Cyan Dashed** | Airway segments | Flying along named airway (J75, V230, etc.) |
| **Purple Dimmed** | Completed legs | Already passed these waypoints |
| **Magenta Dashed** | DTK course line | Desired track guidance |
| **Cyan Circle** | Turn anticipation | Shows turn radius at waypoint |

## Waypoint Symbol Colors

| Color | Symbol | Meaning |
|-------|--------|---------|
| **Magenta** | ◆ + Ring | Active waypoint (flying to) |
| **Cyan** | ◆ | Future waypoint |
| **Gray** | ◆ | Passed waypoint |

## Softkey Functions by Page

### MAP Page
| Key | Function |
|-----|----------|
| MENU | Map settings submenu |
| TER | Toggle terrain overlay |
| TFC | Toggle traffic overlay |
| WX | Toggle weather overlay |
| VNAV | Toggle vertical navigation |
| CDI | CDI source menu |

### FPL Page
| Key | Function |
|-----|----------|
| SAVE | Save flight plan to file |
| LOAD | Load saved flight plan |
| FLY PLAN | Send to AI Autopilot |
| VNAV | Toggle VNAV |
| INFO | Show flight plan statistics |
| D→ | Direct-to waypoint |

### FPL Page (Waypoint Selected)
| Key | Function |
|-----|----------|
| DELETE | Remove waypoint |
| INSERT | Add waypoint before |
| MOVE ▲ | Move waypoint up |
| MOVE ▼ | Move waypoint down |
| ACTV LEG | Set as active waypoint |
| D→ | Direct-to this waypoint |

### PROC Page
| Key | Function |
|-----|----------|
| DEP | Select departure procedure |
| ARR | Select arrival procedure |
| APR | Select approach procedure |
| LOAD | Load selected procedure |
| CHART | View procedure chart |
| BACK | Return to previous page |

### NRST Page
| Key | Function |
|-----|----------|
| APT | Show nearest airports |
| VOR | Show nearest VORs |
| NDB | Show nearest NDBs |
| FIX | Show nearest fixes |
| D→ | Direct-to selected item |
| BACK | Return to previous page |

## CDI Scaling Modes

| Mode | Full Scale | When Active | Badge Color |
|------|-----------|-------------|-------------|
| **ENR** | 5.0 nm | >30nm from destination | Green |
| **TERM** | 1.0 nm | Within 30nm of destination | Cyan |
| **APR** | 0.3 nm | Within 2nm with approach | Magenta |

## Map Orientation Modes

| Mode | Display | Use Case |
|------|---------|----------|
| **North Up** | North always at top | General navigation, chart reading |
| **Track Up** | Current track at top | Following GPS track |
| **Heading Up** | Current heading at top | VOR/ILS navigation |

## Common Workflows

### Load and Fly a Flight Plan

1. **FPL** page → **LOAD** softkey
2. Select from recent plans or browse file
3. Click plan to activate
4. **MAP** page → verify route display
5. **FLY PLAN** softkey → sends to AI Autopilot
6. Route sequences automatically as you fly

### Add a Procedure to Flight Plan

1. **PROC** page
2. **DEP** / **ARR** / **APR** softkey
3. Select procedure from list
4. Select transition (if applicable)
5. **LOAD** softkey
6. **FPL** page → verify waypoints added

### Direct-To Waypoint

1. Press **D→** softkey (from any page)
2. Enter waypoint identifier
3. Or select from flight plan / nearest / recent
4. Confirm selection
5. Route updates with direct course

### Save Current Weather

1. **AUX** page → Environment tab
2. **CAPTURE WEATHER** button
3. Enter preset name
4. Download .WPR file
5. Place in `MSFS\Weather\Presets\` folder

## Data Field Displays

### Top Bar (Always Visible)
- Left: COM1/COM2 active frequencies
- Center: Flight plan departure → arrival
- Right: Transponder code, mode, reply indicator

### Map Data Fields (Configurable)
- **BRG**: Bearing to active waypoint (magnetic)
- **DIS**: Distance to active waypoint (nm)
- **ETE**: Estimated time enroute (minutes)
- **GS**: Ground speed (knots)
- **TRK**: Current track (magnetic)
- **ALT**: GPS altitude (feet MSL)
- **DTK**: Desired track (magnetic)
- **XTK**: Cross-track error (nm, L/R)

## Altitude Constraint Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| @8000 | At exactly | Must cross at 8,000 ft |
| +5000 | At or above | Cross at or above 5,000 ft |
| -3000 | At or below | Cross at or below 3,000 ft |
| 5000-8000 | Between | Cross between 5,000-8,000 ft |

## Audio Alerts

| Sound | Meaning |
|-------|---------|
| **Beep** (880Hz, 150ms) | Waypoint sequenced |
| **Chime** (continuous) | VNAV altitude alert |
| **Voice** | TAWS terrain warning |

## Keyboard Shortcuts

| Key | Function |
|-----|----------|
| **Page Up/Down** | Change pages |
| **Arrow Keys** | Navigate lists / move cursor |
| **Enter** | Select / confirm |
| **Escape** | Back / cancel |
| **+/-** | Zoom in/out on map |
| **Home** | Return to MAP page |

## Status Indicators

### Top Right Corner
| Icon | Meaning |
|------|---------|
| **GPS** | GPS lock acquired |
| **↕** | VNAV active |
| **⊕** | Holding pattern active |
| **APT** | AI Autopilot engaged |

### Bottom Bar
| Text | Meaning |
|------|---------|
| **GPS / NAV1 / NAV2** | Active CDI source |
| **ENR / TERM / APR** | CDI scaling mode |
| **OBS** | OBS mode suspended sequencing |

## Performance Tips

### Smooth Map Rendering
- Use declutter level 2 for large flight plans (>50 waypoints)
- Terrain overlay may lag on low-end hardware
- Traffic overlay updates every 1 second

### Battery Saving (Standalone Browser)
- Close unused panes (TERRAIN, TRAFFIC, WX if not needed)
- Reduce map range for less data processing
- Use compact mode (hides some visual elements)

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Route not showing | Check FPL page has waypoints, switch to MAP page |
| Waypoint won't sequence | Verify OBS not active (suspends sequencing) |
| No GPS data | Check WebSocket connection (green dot in status) |
| Terrain not displaying | Verify terrain data files in `ui/shared/data/` |
| Frequencies won't tune | Check SimConnect connection to MSFS |
| Flight plan lost | Check localStorage, load from recent plans |
| Map frozen | Refresh browser, check renderer is running |

## File Locations

| Type | Location |
|------|----------|
| **Flight Plans** | `ui/gtn750/flight-plans/*.json` |
| **User Waypoints** | `ui/gtn750/user-waypoints/*.json` |
| **Weather Presets** | Download → paste to MSFS Weather\Presets |
| **Navigation Data** | `backend/data/navdb.sqlite` (13K airports) |
| **Terrain Data** | `ui/shared/data/terrain-grid-10km.bin` |

## Default Settings

| Setting | Default | Range |
|---------|---------|-------|
| Map Range | 25 nm | 0.5 - 500 nm |
| Map Orientation | Heading Up | North / Track / Heading |
| Declutter Level | 0 | 0 (full) - 2 (minimal) |
| CDI Source | GPS | GPS / NAV1 / NAV2 |
| VNAV | Disabled | On / Off |
| Terrain Overlay | Enabled | On / Off |
| Traffic Overlay | Enabled | On / Off |

## External Integrations

### AI Autopilot
- **FLY PLAN** button sends flight plan
- Waypoint sequencing synchronized
- Nav-state broadcast every 1 second

### Voice Control
- "Request taxi" → ATC ground clearance
- "Load flight plan [name]" → Activates saved plan
- "Direct to [waypoint]" → Direct-to function

### SimBrief (Planned)
- Import flight plans from SimBrief OFP
- Parse route strings automatically
- One-click import with fuel/performance data

## Version Info

**GTN750 Pane Version**: Check `ui/gtn750/pane.js` header
**Navigation Database**: FAA CIFP (28-day AIRAC cycle)
**Last Updated**: February 2026

---

For detailed documentation, see:
- [Map Route Visualization](./MAP-ROUTE-VISUALIZATION.md)
- [Flight Plan Management](./FLIGHT-PLAN-MANAGEMENT.md)
- [Navigation Integration](./NAV-INTEGRATION.md)
