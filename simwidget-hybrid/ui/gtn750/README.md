# GTN 750 GPS Widget

Full-featured Garmin GTN 750 GPS emulator for Microsoft Flight Simulator with modular architecture, flight planning, navigation, and map rendering.

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

### 📄 Multiple Pages
- **MAP** - Moving map with overlays
- **FPL** - Flight plan management
- **NRST** - Nearest airports/navaids
- **PROC** - Departure/arrival/approach procedures (placeholder)
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
- Press `REMOVE` to delete
- Waypoints auto-sequence as you fly

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
| `FMS` | FMS mode (vs. heading) |
| `D→` | Direct-To from selected waypoint |
| `MENU` | Flight plan options |
| `FPL` | Edit flight plan |

### NRST Page
| Key | Function |
|-----|----------|
| `APT` | Nearest airports |
| `VOR` | Nearest VORs |
| `NDB` | Nearest NDBs |
| `INT` | Nearest intersections |
| `D→` | Direct-To selected |

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
│   ├── gtn-core.js           # Math & formatting utilities
│   ├── gtn-data-fields.js    # Corner data fields
│   ├── gtn-cdi.js            # CDI, OBS, nav source
│   ├── gtn-flight-plan.js    # FPL management
│   ├── gtn-map-renderer.js   # Canvas rendering
│   ├── gtn-data-handler.js   # WebSocket (browser)
│   ├── gtn-simvar-handler.js # SimVar (native)
│   └── gtn-pages.js          # Page manager
├── overlays/
│   ├── terrain-overlay.js    # Elevation shading
│   ├── traffic-overlay.js    # TCAS display
│   ├── weather-overlay.js    # NEXRAD radar
│   └── map-controls.js       # Zoom/pan controls
└── pages/
    ├── page-proc.js          # Procedures page
    ├── page-aux.js           # Auxiliary page
    ├── page-charts.js        # Charts page
    ├── page-nrst.js          # Nearest page
    └── page-system.js        # System settings

Total: ~3800 lines across 19 files
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
