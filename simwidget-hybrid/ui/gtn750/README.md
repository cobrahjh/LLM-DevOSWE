# GTN 750 GPS Widget

Full-featured Garmin GTN 750 GPS emulator for Microsoft Flight Simulator with modular architecture, flight planning, navigation, and map rendering.

## 📚 Documentation

**[→ Open HTML Documentation](docs/index.html)** - Complete interactive documentation

Quick links:
- [User Guide](docs/user-guide.html) - How to use all features
- [Plugin Development](docs/plugins.html) - Extend GTN750 with custom pages
- [Keyboard Shortcuts](docs/keyboard-shortcuts.html) - Complete keyboard reference
- [Troubleshooting](docs/troubleshooting.html) - Common issues and solutions
- [SafeTaxi Guide](docs/safetaxi.html) - Airport diagram documentation

## Features

### 🗺️ Moving Map Display
- **Multi-resolution** - 7 zoom levels (2nm to 200nm)
- **3 orientation modes** - North Up, Track Up, Heading Up
- **Live position tracking** - Real-time aircraft position with heading indicator
- **Smooth panning** - Touch/click to pan map, double-click to re-center
- **Range ring** - Visual distance reference
- **Compass rose** - Dynamic orientation indicator

### ✈️ Flight Planning
- **Route management** - Add, edit, remove waypoints
- **Direct-To** - Instant direct navigation to any waypoint
- **Auto-sequencing** - Automatic waypoint progression
- **Route visualization** - Magenta line from origin to destination
- **Distance/bearing** - Real-time calculations to active waypoint
- **ETE calculation** - Estimated time enroute based on groundspeed
- **Cross-fill** - Syncs with FlightPlan widget via BroadcastChannel
- **Airways (NEW v3.0.0)** - Victor & Jet routes with MEA data
  - 13,000+ airways from FAA CIFP database
  - Smart suggestions - Finds airways connecting two waypoints
  - MEA display - Shows Minimum Enroute Altitude for each airway
  - Map visualization - Airways shown as dashed blue lines
  - Easy insertion - AWY soft key on FPL page
  - See [AIRWAYS-GUIDE.md](../AIRWAYS-GUIDE.md) for complete documentation
- **VNAV (NEW v3.0.0)** - Vertical Navigation with TOD calculation
  - Automatic Top of Descent (TOD) calculation
  - 3° descent profile (configurable 1-6°)
  - Altitude constraints from CIFP procedures (AT/A/B)
  - Vertical deviation indicator (±feet from path)
  - Required VS calculation for constraint compliance
  - Auto-enable for approaches with altitude restrictions
  - See [VNAV-GUIDE.md](../VNAV-GUIDE.md) for complete documentation

### 🧭 CDI & Navigation
- **Course Deviation Indicator** - Visual needle with ±10° scale
- **OBS mode** - Manual course selection
- **NAV source selection** - GPS, NAV1, NAV2
- **TO/FROM indicator** - Automatic waypoint direction
- **XTK display** - Cross-track error in nautical miles
- **Bearing pointer** - Shows bearing to active waypoint

### 📡 Radio Management
- **Dual COM** - COM1/COM2 with active/standby swap
- **Dual NAV** - NAV1/NAV2 frequency management
- **Transponder** - 4-digit code with mode selection
- **Preset swap** - Quick frequency exchange
- **Sync with radio-stack** - Cross-widget integration

### 🛫 Airport & Navigation Database
- **NRST (Nearest)** - Find nearby airports, VORs, NDBs, intersections
- **Distance sorting** - Automatically sorted by proximity
- **Identifier search** - Type ICAO code for instant lookup
- **Runway information** - Length, heading, surface type
- **Frequency data** - Tower, ATIS, ground frequencies
- **AIRAC navdb** - Real FAA CIFP data (52,000+ procedures)

### 🛫 Procedures (NEW v2.6.0)
- **SID/STAR/Approach** - Departure, arrival, and approach procedures
- **Real AIRAC data** - 13,000+ airports, 52,000+ procedures from FAA CIFP
- **Procedure preview** - Visualize route on map (cyan dashed line)
- **Waypoint details** - Distance, bearing, altitude constraints, speed limits
- **Details panel** - Comprehensive waypoint-by-waypoint breakdown
- **ILS auto-tune** - One-click NAV1 frequency setup for ILS approaches
- **Chart integration** - Direct link to approach plates (ChartFox)
- **Load to flight plan** - Smart insertion (DEP after origin, ARR before dest, APR at end)

### 🌦️ Map Overlays
- **Terrain** - Elevation shading with configurable opacity
- **Traffic** - TCAS-style traffic display with altitude tags
- **Weather** - NEXRAD radar overlay (when available)
- **Airspace** - Controlled airspace boundaries (future)

### ⚙️ Data Fields
- **4 corner fields** - Customizable display
- **12 field types** - GS, TRK, ALT, VS, DTK, BRG, DIS, ETE, ETA, FUEL, WIND, TMP
- **Real-time updates** - Live sim data integration
- **Touch to customize** - Click any field to change

### 🛬 SafeTaxi Page (NEW v2.4.0)
- **Airport surface diagrams** - Real-time ownship position on airport layouts
- **Web Mercator projection** - Sub-meter accuracy for precise positioning
- **Track-up & North-up** - Configurable orientation modes
- **Auto-follow mode** - Automatic camera centering on aircraft
- **Smart auto-load** - Automatic diagram loading when on ground
- **Safety features** - Hold-short lines, hotspots, parking positions
- **Scale indicator** - Dynamic distance reference bar
- **Interactive controls** - Pan, zoom, and center operations
- **Responsive canvas** - Adapts to any screen size

### 📄 Multiple Pages
- **MAP** - Moving map with overlays
- **FPL** - Flight plan management
- **NRST** - Nearest airports/navaids
- **TAXI** - SafeTaxi airport surface diagrams
- **PROC** - Departure/arrival/approach procedures (NEW v2.6.0)
- **AUX** - Auxiliary functions
- **CHARTS** - Approach plate viewer (integration ready)
- **SYSTEM** - Settings and configuration

## Architecture

### Modular Design
The GTN750 uses a **module extraction pattern** to keep code organized and maintainable:

| Module | Lines | Purpose |
|--------|-------|---------|
| `GTNCore` | ~150 | Math utilities, geo calculations, formatting |
| `GTNDataFields` | ~180 | Corner data field management |
| `GTNCdi` | ~400 | CDI, OBS, NAV source, holding patterns |
| `GTNFlightPlan` | ~500 | Flight plan, Direct-To, sequencing |
| `GTNMapRenderer` | ~800 | Canvas rendering (map, compass, route) |
| `GTNDataHandler` | ~220 | WebSocket data (browser mode) |
| `GTNSimVarHandler` | ~150 | SimVar API (MSFS native mode) |
| **widget.js** | ~1250 | **Orchestrator** (wires everything together) |

### Dual-Mode Operation

**Browser Mode** (default):
- Uses WebSocket connection to server:8080
- Full GTNDataHandler with reconnection logic
- Works in web browsers, external panels

**MSFS Native Mode**:
- Uses SimConnect SimVar API directly
- GTNSimVarHandler replaces GTNDataHandler
- Runs inside MSFS 2024 panel windows
- Lower latency, no network dependency

Mode auto-detected based on `window.simvar` availability.

### State Management
```javascript
// Shared state via getter pattern (not duplicated)
const getState = () => ({
    data: this.data,           // Aircraft position, radios
    map: this.map,             // Zoom, orientation, overlays
    flightPlan: this.flightPlanManager.flightPlan,
    activeLeg: this.flightPlanManager.activeLeg
});

// Map renderer gets snapshot each frame
this.mapRenderer.render(getState());
```

## Usage

### 1. Open the Widget

```
http://localhost:8080/ui/gtn750/
```

### 2. Basic Navigation

**Zoom**: Click `-` / `+` buttons or use mouse wheel
**Pan**: Click and drag on map
**Re-center**: Double-click map or click crosshair button
**Orientation**: Click `TRKU` to cycle North/Track/Heading

### 3. Flight Planning

**Create a Route**:
1. Press `FPL` page button
2. Click `+ Add Waypoint`
3. Type waypoint identifier (e.g., `KSEA`)
4. Press Enter to add
5. Repeat for all waypoints

**Activate Direct-To**:
1. Press `D→` soft key
2. Type waypoint identifier
3. Press `ACTIVATE`
4. Map switches to MAP page automatically

**Edit Flight Plan**:
- Click waypoint to select
- Press `DELETE` to remove
- Waypoints auto-sequence as you fly

**Insert Airways (NEW v3.0.0)**:
1. Press `FPL` page button
2. Click waypoint to select (entry fix)
3. Press `AWY` soft key
4. See smart suggestions for airways connecting to next waypoint
5. Click a suggestion or manually enter:
   - Airway identifier (e.g., V2, J45)
   - Entry fix (pre-filled)
   - Exit fix (pre-filled)
6. Press `INSERT`
7. All waypoints along airway inserted automatically
8. MEA (Minimum Enroute Altitude) shown for each airway

**Example**: Insert V2 airway between KSEA and KPDX
- Flight plan: KSEA → KPDX
- Select KSEA → Press AWY
- See suggestion: "V2 - 3 fixes • MEA 5,000 ft • 121 nm"
- Click V2 → Inserts SEA → OLM → BTG waypoints

See [AIRWAYS-GUIDE.md](../AIRWAYS-GUIDE.md) for complete airways documentation.

**Using VNAV (Vertical Navigation) (NEW v3.0.0)**:
1. Load a STAR or Approach with altitude constraints
2. VNAV auto-enables (or press VNAV soft key on MAP/FPL page)
3. Fly at cruise altitude until TOD (Top of Descent) marker
4. At TOD, begin descent following vertical deviation indicator
5. VNAV guides descent to meet all altitude constraints

**Example**: KBIH R12-Z approach
- Constraints: HEGIT @10,000ft, TEVOC @8,000ft, NEBSE @7,000ft
- Current: 12,000ft cruise, 30nm from HEGIT
- VNAV calculates TOD: 23.3nm from current position
- At TOD: Begin descent, VNAV shows "VNAV PATH"
- Vertical deviation: ±100ft = on path (green)

**VNAV Display**:
- **TOD Marker**: Cyan "TOD" label on map at calculated descent point
- **VNAV Indicator**: "VNAV ARMED" (approaching TOD) or "VNAV PATH" (descending)
- **Vertical Deviation**: "+200" = 200ft above path, "-150" = 150ft below path
- **Required VS**: "-650" = need 650fpm descent rate to meet constraint

See [VNAV-GUIDE.md](../VNAV-GUIDE.md) for complete VNAV documentation.

**Holding Patterns (NEW v3.0.0)**:
1. Load an approach with a holding pattern (e.g., KBIH R12-Z missed approach)
2. GTN750 detects HM/HA/HF legs automatically
3. When reaching hold waypoint, entry procedure calculated (DIRECT/TEARDROP/PARALLEL)
4. Racetrack pattern displayed on map
5. Follow holding instructions until ATC clears you

**Example**: KBIH R12-Z missed approach hold at BIH VOR
- Fix: BIH VOR
- Inbound: 121° (to BIH)
- Turns: Standard right
- Leg time: 60 seconds (below 14,000ft)
- Entry: DIRECT (heading within 70° sector)
- Procedure: Turn right to outbound (301°), fly 60s, turn right to inbound (121°)

**Holding Display**:
- **Racetrack Pattern**: Green inbound leg, cyan outbound leg, dashed turn arcs
- **Fix Marker**: Yellow circle at hold fix
- **Entry Indicator**: Shows TEARDROP, PARALLEL, or DIRECT entry path
- **Status Panel**: Current leg (INBOUND/OUTBOUND/TURN), elapsed time, turns remaining

**Manual Hold Entry**:
1. Select waypoint to hold at
2. Press `HOLD` soft key (in CDI menu)
3. Configure: Inbound course, turn direction (R/L), leg time (60s/90s)
4. Press `ACTIVATE`
5. Entry procedure calculated automatically

See [HOLDING-GUIDE.md](../HOLDING-GUIDE.md) for complete holding patterns documentation.

**User Waypoints (NEW v3.0.0)**:
1. Create custom navigation waypoints with coordinates and names
2. Store up to 500 user waypoints in localStorage
3. 5 categories: VRP (reporting points), POI (points of interest), PVT (private strips), PRC (practice areas), WPT (general)
4. Search, nearest, import/export (GPX/CSV)
5. Use in Direct-To, flight plans, and NRST pages

**Create from Current Position**:
1. Press `USER WPT` soft key
2. GTN750 pre-fills current lat/lon
3. Enter identifier (3-5 alphanumeric, e.g., `HOME1`)
4. Add name and notes (optional)
5. Select category
6. Press `SAVE`
7. Waypoint displayed on map with category icon

**Example**: Save home airport parking spot
- Identifier: `PARK1`
- Name: `Airport Parking`
- Category: POI (yellow star icon)
- Notes: `Free parking near terminal`
- Coordinates: Auto-filled from current position

**Navigate to User Waypoint**:
1. Press `D→` (Direct-To)
2. Type `PARK1`
3. GTN750 finds user waypoint (shows ★ icon)
4. Press `ACTIVATE`
5. Route to user waypoint displayed

**Import/Export**:
- **Export GPX**: Backup waypoints to file, compatible with Garmin/Foreflight
- **Export CSV**: Open in Excel for editing
- **Import GPX**: Restore from backup or import from GPS device
- **Import CSV**: Bulk import from spreadsheet

See [USER-WAYPOINTS-GUIDE.md](../USER-WAYPOINTS-GUIDE.md) for complete user waypoints documentation.

**TCAS (Traffic Collision Avoidance System) (NEW v3.0.0)**:
1. TCAS II implementation with Traffic Advisories (TA) and Resolution Advisories (RA)
2. Altitude-based sensitivity adjustment (detection zones scale with altitude)
3. Tau calculation (time to closest approach) for threat assessment
4. RA sense determination (CLIMB/DESCEND commands)
5. Audio alerts: "Traffic, Traffic" (TA), "Climb, Climb" or "Descend, Descend" (RA)

**Traffic Advisory (TA)**:
- Triggered: Traffic within 6nm horizontal, ±1,200ft vertical, tau < 20s (at cruise altitude)
- Audio: "Traffic, Traffic" + chime
- Visual: Amber circle on traffic display
- Action: Monitor traffic, prepare for possible RA, **do not maneuver based on TA**

**Resolution Advisory (RA)**:
- Triggered: Traffic within 3.5nm horizontal, ±800ft vertical, tau < 15s (at cruise altitude)
- Audio: "Climb, Climb" or "Descend, Descend"
- Visual: Red square on traffic display
- Action: **Immediately follow RA command**, notify ATC "Following TCAS RA"

**Example**: Head-on conflict at 8,000ft
- T-20s: TA "Traffic, Traffic" (5nm, amber circle)
- T-15s: RA "Descend, Descend" at 2,000 fpm (3.8nm, red square)
- T-5s: "Clear of Conflict" (traffic passes overhead)
- Return to assigned altitude, report to ATC

**Sensitivity Modes**:
- **NORMAL**: Standard sensitivity (default)
- **ABOVE**: Reduced sensitivity above aircraft (use below Class B)
- **BELOW**: Reduced sensitivity below aircraft (use over terrain)

**Altitude-Based Detection Zones**:
| Altitude | TA Horizontal | RA Horizontal |
|----------|---------------|---------------|
| < 2,350 ft | 3.3nm | 2.0nm |
| 2,350 - 5,000 ft | 4.8nm | 2.8nm |
| > 10,000 ft | 6.0nm | 3.5nm |

See [TCAS-GUIDE.md](../TCAS-GUIDE.md) for complete TCAS documentation.

### 4. Using the CDI

**GPS Mode** (default):
- CDI shows deviation from flight plan route
- Needle centers when on course
- XTK shows cross-track distance

**OBS Mode**:
1. Press `OBS` soft key
2. CDI freezes on current waypoint
3. Turn OBS knob to set desired course
4. Press `OBS` again to resume sequencing

**NAV Mode**:
1. Click NAV source indicator (top right)
2. Select `NAV1` or `NAV2`
3. CDI shows deviation from VOR radial

### 5. Finding Nearest Airports

1. Press `NRST` page button
2. Select `APT` tab
3. See list sorted by distance
4. Click airport to see details
5. Press `D→` for direct-to

### 6. Radio Frequencies

**Tune COM**:
1. Click COM standby frequency
2. Type new frequency
3. Click `⇄` to swap active/standby

**Tune NAV**:
1. Click NAV standby frequency
2. Type new frequency
3. Click `⇄` to swap

**Transponder**:
1. Click XPDR code
2. Type 4-digit code
3. Press Enter

### 7. SafeTaxi Airport Diagrams

**Auto-Load** (when on ground):
- Diagram loads automatically when AGL < 50ft and GS < 5kts
- Reloads if you taxi to a different airport (>5nm away)

**Manual Load**:
1. Press `TAXI` page button
2. Type airport ICAO code (e.g., `KSEA`)
3. Press `LOAD` or hit Enter

**Controls**:
- **ZOOM +/-** - Zoom in/out on diagram
- **CENTER** - Center on ownship position
- **AUTO** - Auto-scale and center on airport
- **FOLLOW** - Toggle auto-follow mode (keeps ownship centered)
- **TRK UP** - Toggle track-up orientation (map rotates with aircraft)
- **Mouse drag** - Pan around diagram
- **Mouse wheel** - Zoom in/out

**Display Features**:
- Runways with numbers (always upright for readability)
- Taxiways with labels
- Hold-short lines (red/white stripes at runway entries)
- Parking positions (gates, ramps, FBOs)
- Hotspots (safety-critical areas in orange)
- Scale indicator (distance reference bar)
- Ownship position with heading indicator

## Soft Keys

Bottom row of 12 soft keys changes per page:

### MAP Page
| Key | Function |
|-----|----------|
| `TOPO` | Toggle terrain overlay |
| `TFC` | Toggle traffic overlay |
| `WX` | Toggle weather overlay |
| `D→` | Direct-To dialog |
| `MENU` | Map options menu |

### FPL Page
| Key | Function |
|-----|----------|
| `DELETE` | Remove selected waypoint |
| `AWY` | Insert airway (NEW v3.0.0) |
| `MOVE ▲` | Move waypoint up |
| `MOVE ▼` | Move waypoint down |
| `ACTV LEG` | Activate leg to waypoint |
| `D→` | Direct-To from selected waypoint |

### NRST Page
| Key | Function |
|-----|----------|
| `APT` | Nearest airports |
| `VOR` | Nearest VORs |
| `NDB` | Nearest NDBs |
| `INT` | Nearest intersections |
| `D→` | Direct-To selected |

### TAXI Page
| Key | Function |
|-----|----------|
| `LOAD` | Load airport diagram |
| `CENTER` | Center on ownship |
| `ZOOM+` | Zoom in |
| `ZOOM-` | Zoom out |
| `AUTO` | Auto-scale diagram |
| `FOLLOW` | Toggle auto-follow |
| `TRK UP` | Toggle track-up mode |

## Data Field Customization

Click any of the 4 corner data fields to customize:

**Available Fields**:
- **GS** - Ground Speed (kt)
- **TRK** - Track (°)
- **ALT** - Altitude (ft)
- **VS** - Vertical Speed (fpm)
- **DTK** - Desired Track (°)
- **BRG** - Bearing to waypoint (°)
- **DIS** - Distance to waypoint (nm)
- **ETE** - Estimated Time Enroute (mm:ss)
- **ETA** - Estimated Time of Arrival (HH:MM)
- **FUEL** - Fuel Remaining (gal)
- **WIND** - Wind (dir/speed)
- **TMP** - Temperature (°C)

Settings persist to localStorage.

## Cross-Widget Integration

### BroadcastChannel Messages

**Sent** (via `SimGlass-sync`):
```javascript
// Flight plan updates
{
    type: 'route-update',
    waypoints: [{ident, lat, lon, altitude}, ...],
    source: 'gtn750'
}

// Direct-To activation
{
    type: 'direct-to',
    waypoint: {ident, lat, lon},
    source: 'gtn750'
}
```

**Received**:
```javascript
// From flightplan-widget or simbrief-widget
{
    type: 'route-update',
    waypoints: [{ident, lat, lon}, ...],
    source: 'flightplan-widget'
}
```

### Compatible Widgets
- **FlightPlan Widget** - Syncs route bidirectionally
- **SimBrief Widget** - Import OFP directly to GTN750
- **Map Widget** - Shows GTN750 route on full-screen map
- **Radio Stack** - Syncs COM/NAV frequencies

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `M` | Switch to MAP page |
| `F` | Switch to FPL page |
| `N` | Switch to NRST page |
| `T` | Switch to TAXI page |
| `D` | Open Direct-To |
| `+` / `-` | Zoom in/out |
| `Space` | Re-center map |
| `O` | Toggle OBS mode |
| `Esc` | Close dialogs |

## Settings Persistence

Saved to `localStorage`:
```javascript
{
    mapRange: 10,
    mapOrientation: 'track',
    dataFields: ['gs', 'trk', 'alt', 'dis'],
    showTerrain: false,
    showTraffic: true,
    showWeather: false,
    declutterLevel: 0,
    brightness: 80
}
```

## Performance

### Rendering
- **60 FPS** target with requestAnimationFrame
- **Canvas optimization** - Only redraws on state change
- **Lazy loading** - Pages load on first access
- **Debounced updates** - Position updates throttled to 10Hz

### Memory
- **Base**: ~5MB (HTML + modules)
- **Map tiles**: +2-5MB (depends on zoom)
- **Flight plan**: +100KB per 50 waypoints
- **Total**: ~10MB typical usage

### Network
- **WebSocket**: Persistent connection, ~1KB/s data
- **Map tiles**: Cached in browser, ~50KB per tile
- **Database queries**: On-demand, <10KB per request

## Troubleshooting

### Map Not Updating
- **Check connection**: Green dot should show in header
- **Verify sim running**: Map needs position data
- **Clear cache**: Ctrl+F5 to force reload

### Flight Plan Not Sequencing
- **Check distance**: Must be within 0.5nm of waypoint
- **Verify altitude**: Some waypoints have altitude constraints
- **OBS mode**: Disable OBS to resume auto-sequencing

### CDI Not Moving
- **NAV source**: Ensure GPS mode is selected
- **Flight plan**: Must have active leg
- **Check scale**: ±10° is wide, may appear stuck

### Radio Frequencies Not Saving
- **Check SimConnect**: Frequency control requires live sim
- **Verify permissions**: Browser may block SimConnect
- **Use radio-stack**: Dedicated radio widget more reliable

### Terrain Overlay Blank
- **Database required**: Terrain tiles need to be downloaded
- **Check zoom**: Terrain only shows at <50nm range
- **Toggle on/off**: Sometimes needs refresh

## Development

### File Structure
```
gtn750/
├── index.html          # Main HTML with canvas
├── widget.js           # Orchestrator (1273 lines)
├── styles.css          # GTN750 styling
├── modules/
│   ├── gtn-core.js              # Math & formatting utilities
│   ├── gtn-data-fields.js       # Corner data fields
│   ├── gtn-cdi.js               # CDI, OBS, nav source
│   ├── gtn-flight-plan.js       # FPL management
│   ├── gtn-map-renderer.js      # Canvas rendering
│   ├── gtn-airport-diagram.js   # SafeTaxi diagram renderer
│   ├── gtn-data-handler.js      # WebSocket (browser)
│   ├── gtn-simvar-handler.js    # SimVar (native)
│   └── gtn-pages.js             # Page manager
├── overlays/
│   ├── terrain-overlay.js    # Elevation shading
│   ├── traffic-overlay.js    # TCAS display
│   ├── weather-overlay.js    # NEXRAD radar
│   └── map-controls.js       # Zoom/pan controls
├── pages/
│   ├── page-proc.js          # Procedures page
│   ├── page-aux.js           # Auxiliary page
│   ├── page-charts.js        # Charts page
│   ├── page-nrst.js          # Nearest page
│   ├── page-taxi.js          # SafeTaxi page
│   └── page-system.js        # System settings
└── docs/
    └── SAFETAXI-IMPROVEMENTS.md  # SafeTaxi feature documentation

Total: ~4500 lines across 21 files
```

### Module Communication
Modules communicate via:
1. **Constructor injection** - `{ core, elements, serverPort }`
2. **Callback functions** - `onWaypointChanged()`, `onDirectToActivated()`
3. **Shared state getters** - `getState()` returns snapshot
4. **Direct method calls** - `this.mapRenderer.render(state)`

**No global state** - All state owned by widget.js orchestrator.

### Adding a New Page
1. Create `pages/page-newname.js`
2. Define page HTML in `index.html` with `id="page-newname"`
3. Register in `GTNPages.registerPage('newname', handler)`
4. Add soft key definitions
5. Wire to orchestrator in `widget.js`

### Adding a New Data Field
1. Add to `GTNDataFields.FIELD_TYPES` map
2. Define `label` and `getValue()` function
3. Field automatically available in customization

## Version History

**v2.4.0** (2026-02-13) - SafeTaxi Airport Diagrams
- ✅ New TAXI page with airport surface diagrams
- ✅ Web Mercator projection for accurate positioning
- ✅ Track-up and North-up orientation modes
- ✅ Auto-follow mode with continuous ownship centering
- ✅ Smart auto-load (ground detection, distance checking)
- ✅ Responsive canvas sizing
- ✅ Scale indicator with dynamic range
- ✅ Hold-short lines (runway safety markings)
- ✅ Parking positions (gates, ramps, FBOs)
- ✅ Hotspot highlighting (safety-critical areas)
- ✅ Upright runway numbers (always readable)
- ✅ ETE rounding fix (nearest minute)
- ✅ Interactive controls (pan, zoom, center)
- ✅ Mouse drag and wheel support
- ✅ 100% test pass rate (245 automated + 26 manual)
- See [docs/SAFETAXI-IMPROVEMENTS.md](docs/SAFETAXI-IMPROVEMENTS.md) for details

**v2.3.0** (2026-02-07) - Performance Optimizations
- ✅ Waypoint position caching (98% calculation reduction)
- ✅ Traffic circular buffer (max 100 targets, 30s timeout)
- ✅ Frame time: 23ms → 20ms (target met!)
- ✅ Memory: 11.2MB → 9.8MB after 10min (target met!)
- ✅ 60 FPS sustained with all overlays
- All performance targets achieved

**v2.2.0** (2026-02-07) - Code Quality & Testing
- ✅ Extracted all magic numbers to named constants
- ✅ Comprehensive JSDoc type annotations (80% coverage)
- ✅ Unit test suite (38 tests, 100% passing)
- ✅ Type definition file (15 TypeScript-ready types)
- ✅ Known issues documentation
- Enhanced maintainability score: 7.2 → 9.1

**v2.1.0** (2026-02-07) - Code Splitting
- ModuleLoader utility for lazy loading
- 3-tier loading: Critical → Deferred (500ms) → On-demand
- 40% faster initial load (13 scripts vs 17)
- 30% memory reduction until features accessed
- Performance tested and documented

**v2.0.0** (2026-02-07) - Modular Architecture
- Extracted 6 modules for maintainability
- Added GTNCore utility library
- Dual-mode operation (WebSocket + SimVar)
- Proper lifecycle with destroy() methods
- BroadcastChannel integration
- SimGlassBase v2.0.0 migration

**v1.5.0** (2026-01-15) - Flight Planning
- Flight plan management (add/remove/edit)
- Direct-To functionality
- Auto-sequencing waypoints
- Cross-fill with FlightPlan widget

**v1.0.0** (2025-12-10) - Initial Release
- Moving map with 7 zoom levels
- CDI with GPS/NAV1/NAV2 modes
- Nearest airports database
- COM/NAV/XPDR management
- Basic terrain overlay

## Future Enhancements

Planned features:
- **Airways** - Victor/Jet route display
- **Procedures** - SID/STAR/Approach loading
- **Vertical nav** - VNAV descent planning
- **Wind vectors** - Aloft wind display
- **Track history** - Breadcrumb trail
- **User waypoints** - Custom waypoint creation
- **Flight log** - Automatic position logging
- **Database updates** - AIRAC cycle support

## Credits

- **Garmin** - GTN 750 design inspiration
- **SimGlass Team** - Widget framework
- **OpenStreetMap** - Map tile data (future)
- **Contributors** - Testing and feedback

## License

Part of SimGlass - see main repository LICENSE file.
