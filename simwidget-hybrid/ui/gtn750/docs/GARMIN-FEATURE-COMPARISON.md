# GTN750 SimGlass vs Garmin Official Feature Comparison

**Source:** Garmin GTN750Xi Pilot's Guide (190-02327-03 Rev. G)
**Date:** February 19, 2026
**SimGlass Version:** GTN750 v3.0+

---

## Legend
- ✅ **Fully Implemented** — Feature complete and tested
- 🟨 **Partially Implemented** — Core functionality exists, missing options/polish
- ❌ **Not Implemented** — Feature absent
- 🔵 **Not Applicable** — MSFS limitation or hardware requirement

---

## Map Display & Orientation

| Feature | Status | Notes |
|---------|--------|-------|
| **North Up** orientation | ✅ | Working |
| **Track Up** orientation | ✅ | Working |
| **Heading Up** orientation | ✅ | Working |
| **North Up Above** auto-switch | ❌ | Not implemented — auto-switches to North Up at configurable zoom level |
| **Ownship Icon** positioning | ✅ | Aircraft symbol at GPS position |
| **Map Range** (0.5-500 nm) | ✅ | Full range supported with zoom controls |
| **Declutter Levels** (0-2) | ✅ | 3 levels implemented |

---

## Auto Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Auto Zoom** | ❌ | Not implemented — automatically adjusts range to show next waypoint |
| **Auto Zoom Min/Max** settings | ❌ | Not implemented |
| **Auto Zoom SafeTaxi** on ground | ❌ | SafeTaxi exists but not auto-triggered |
| **Visual Approach Selector** | ❌ | Not implemented — activates at set distance from destination |

---

## Track & Navigation Indicators

| Feature | Status | Notes |
|---------|--------|-------|
| **Track Vector** line | ❌ | Not implemented — dashed line showing future track |
| **Track Vector Length** options | ❌ | Not implemented (30s/1min/2min/5min/10min) |
| **DTK Course Line** | ✅ | Magenta dashed desired track line shown |
| **Cross-Track Error** display | ✅ | XTK shown in data fields |
| **Turn Anticipation Circles** | ✅ | Cyan dashed circles at waypoints |

---

## Range Rings & Overlays

| Feature | Status | Notes |
|---------|--------|-------|
| **NAV Range Ring** | ❌ | Not implemented — fixed distance rings for VOR/NDB tuning |
| **Glide Range Ring** (fixed-wing) | ❌ | Not implemented — shows gliding distance to 50ft AGL |
| **Best Glide Airport Indicator** | ❌ | Not implemented — cyan arrows to nearest reachable airport |
| **Fuel Range Ring** | ❌ | Not implemented — endurance-based range (requires EIS) |
| **Fuel Range Ring Enhanced** | ❌ | Not implemented — shows reserve fuel vs empty circles |
| **Selected Altitude Range Arc** | ❌ | Not implemented — shows where aircraft reaches selected alt (requires GDU/TXi) |

---

## Altitude & Speed Constraints

| Feature | Status | Notes |
|---------|--------|-------|
| **Altitude Constraints** display | ✅ | Shows @8000, +5000, -3000, 5000-8000 formats |
| **Constraints: Off** | ✅ | Toggle works |
| **Constraints: Selected Only** | 🟨 | Partially — no UI selector for modes |
| **Constraints: Selected & Active** | 🟨 | Partially implemented |
| **Constraints: All** | ✅ | Default mode |
| **Speed Constraints** labels | ❌ | Not implemented (GTN Xi v21.02+ feature) |
| **Active Constraint** highlighting | 🟨 | Basic highlighting, not full VNAV integration |

---

## Chart & Topography

| Feature | Status | Notes |
|---------|--------|-------|
| **TOPO Scale** overlay | ❌ | Not implemented — elevation scale display |
| **Chart Color Scheme** (Day/Night) | ❌ | Not implemented — single color scheme only |
| **FliteCharts** display | ❌ | Not implemented (would require chart database) |
| **ChartView** display | ❌ | Not implemented (would require chart database) |

---

## Aviation Data Display

| Feature | Status | Notes |
|---------|--------|-------|
| **Airport Symbols** | ✅ | Towered/non-towered/serviced/soft shown |
| **Runway Extensions** (5nm) | ❌ | Not implemented — centerline projection for visual approaches |
| **Heliports** display | ❌ | Not in navdb |
| **VOR** display | ✅ | Working |
| **NDB** display | ✅ | Working |
| **Intersection (FIX)** display | ✅ | Working |
| **User Waypoints** | ✅ | Full CRUD support |
| **VRP** (Visual Reporting Point) | ❌ | Not in navdb |
| **Airways** display | ✅ | Cyan dashed for airway segments |
| **Airway Labels** | ✅ | Shows J75, V230 at midpoint |
| **TFR** (Temporary Flight Restriction) | ❌ | Not implemented (would require live data feed) |
| **ATK** (Air Traffic Area) | ❌ | Not in navdb |
| **Fly-over Waypoint** symbol | ❌ | Not implemented (requires ARINC 424 flyover flag) |

---

## SafeTaxi

| Feature | Status | Notes |
|---------|--------|-------|
| **SafeTaxi Diagrams** | ✅ | Airport surface overlay with taxiways/runways |
| **Aircraft Position on SafeTaxi** | ✅ | Ownship shows on diagram |
| **SafeTaxi Range** selector | 🟨 | Auto-scales, no manual range selector |
| **Hot Spot** information | 🟨 | Hot spots shown but no info popup |
| **Construction Area** markings | ❌ | Not in navdb |
| **Airport Beacon** display | ❌ | Not in navdb |

---

## Airspace Display

| Feature | Status | Notes |
|---------|--------|-------|
| **Class A-G Airspace** | ✅ | Full support |
| **Restricted Airspace** | ✅ | Working |
| **MOA** (Military Operations Area) | ✅ | Working |
| **TMA/AWY** display | ✅ | Working |
| **Airspace Labels** | ✅ | Shows name and altitude limits |
| **Smart Airspace** | ❌ | Not implemented — auto-de-emphasizes non-pertinent airspace |
| **Airspace Info** popup | ✅ | Shows floor/ceiling/type |
| **Airspace Frequencies** list | ❌ | Not implemented |
| **Airspace Range** settings | ❌ | No per-type range filters |

---

## Traffic

| Feature | Status | Notes |
|---------|--------|-------|
| **Traffic Overlay** | ✅ | TCAS display on map |
| **Traffic Range** selector | 🟨 | Fixed range, no UI selector |
| **All Traffic** mode | ✅ | Default |
| **Alerts Only** mode | 🟨 | Alerts shown but no mode toggle |
| **Traffic Type** filter | ❌ | No ADS-B vs TIS-B filtering |

---

## Weather

| Feature | Status | Notes |
|---------|--------|-------|
| **NEXRAD** overlay | ✅ | Working (via shared weather API) |
| **Weather Source** selector | ❌ | No FIS-B/SiriusXM/Connext switching |
| **Weather Radar** overlay | 🔵 | Not applicable (requires onboard radar hardware) |
| **Stormscope Lightning** | 🔵 | Not applicable (requires Stormscope hardware) |
| **Datalink Weather Menu** | ❌ | No advanced weather controls |

---

## Terrain & Obstacles

| Feature | Status | Notes |
|---------|--------|-------|
| **Terrain Overlay** | ✅ | Color-coded elevation display |
| **Terrain Alerts (TAWS)** | ✅ | Working with audio alerts |
| **Point Obstacles** display | ❌ | Not implemented |
| **Point Obstacle Range** setting | ❌ | Not implemented |
| **HOT Line Range** | ❌ | Not implemented — High Obstacle Terrain alert range |

---

## Land Data

| Feature | Status | Notes |
|---------|--------|-------|
| **Road Detail** levels | ❌ | Not implemented |
| **City Detail** levels | ❌ | Not implemented |
| **State/Province Names** | ❌ | Not implemented |
| **River/Lake Detail** levels | ❌ | Not implemented |
| **Restore Defaults** per tab | ❌ | No multi-tab settings organization |

---

## Map Interactions

| Feature | Status | Notes |
|---------|--------|-------|
| **Panning** | 🟨 | Mouse drag works, no touch pan mode |
| **Zooming** (+/- keys) | ✅ | Keyboard and scroll wheel zoom |
| **Map Info** popup | 🟨 | Basic info, missing bearing/distance/elevation |
| **Stacked Objects** "Next" button | ❌ | Not implemented — cycle through overlapping items |
| **Graphical Flight Plan Editing** | ❌ | Not implemented — drag-and-drop waypoint editing |
| **Undo** (9 levels) | ❌ | Not part of graphical edit |
| **Temporary Flight Plan** banner | ❌ | Not implemented |
| **Create Waypoint** from map tap | ❌ | Not implemented |

---

## Flight Plan Route Visualization

| Feature | Status | Notes |
|---------|--------|-------|
| **Active Leg** thick magenta | ✅ | Working |
| **Future Direct Legs** magenta | ✅ | Working |
| **Airway Segments** cyan dashed | ✅ | Working |
| **Completed Legs** dimmed purple | ✅ | Working |
| **Waypoint Symbols** (diamonds) | ✅ | Active/future/past color-coded |
| **Waypoint Labels** | ✅ | Ident shown with offset |
| **Altitude Constraint** labels | ✅ | Shown below waypoint |
| **Turn Anticipation** circles | ✅ | Based on groundspeed and bank angle |

---

## CDI & Navigation Source

| Feature | Status | Notes |
|---------|--------|-------|
| **GPS** CDI source | ✅ | Working |
| **NAV1** CDI source | ✅ | Working |
| **NAV2** CDI source | ✅ | Working |
| **CDI Auto-Scaling** (ENR/TERM/APR) | ✅ | 5nm / 1nm / 0.3nm modes |
| **OBS Mode** | ✅ | Suspends sequencing |
| **Course Deviation** display | ✅ | CDI bar on map |

---

## Data Fields

| Feature | Status | Notes |
|---------|--------|-------|
| **4 Corner Data Fields** | ✅ | Fully customizable |
| **BRG** (Bearing to waypoint) | ✅ | Working |
| **DIS** (Distance to waypoint) | ✅ | Working |
| **ETE** (Time enroute) | ✅ | Working |
| **GS** (Ground speed) | ✅ | Working |
| **TRK** (Track) | ✅ | Working |
| **ALT** (GPS altitude) | ✅ | Working |
| **DTK** (Desired track) | ✅ | Working |
| **XTK** (Cross-track error) | ✅ | Working |
| **12+ Data Field Types** | ✅ | Full catalog available |

---

## Audio Alerts

| Feature | Status | Notes |
|---------|--------|-------|
| **Waypoint Sequence** beep (880Hz) | ✅ | Working |
| **VNAV Altitude Alert** chime | 🟨 | VNAV exists but alert not wired |
| **TAWS Terrain Warning** voice | ✅ | Working via shared terrain system |
| **Traffic Alert** audio | 🟨 | TCAS exists but no audio alerts |

---

## Summary Statistics

| Category | ✅ Implemented | 🟨 Partial | ❌ Missing | 🔵 N/A | Total |
|----------|---------------|-----------|-----------|--------|-------|
| **Map Display** | 6 | 0 | 1 | 0 | 7 |
| **Auto Features** | 0 | 0 | 4 | 0 | 4 |
| **Track/Nav** | 3 | 0 | 2 | 0 | 5 |
| **Range Rings** | 0 | 0 | 6 | 0 | 6 |
| **Constraints** | 3 | 3 | 1 | 0 | 7 |
| **Charts/Topo** | 0 | 0 | 4 | 0 | 4 |
| **Aviation Data** | 5 | 0 | 8 | 0 | 13 |
| **SafeTaxi** | 2 | 2 | 2 | 0 | 6 |
| **Airspace** | 5 | 0 | 3 | 0 | 8 |
| **Traffic** | 1 | 2 | 2 | 0 | 5 |
| **Weather** | 1 | 0 | 2 | 2 | 5 |
| **Terrain** | 2 | 0 | 3 | 0 | 5 |
| **Land Data** | 0 | 0 | 5 | 0 | 5 |
| **Interactions** | 1 | 2 | 5 | 0 | 8 |
| **Route Viz** | 8 | 0 | 0 | 0 | 8 |
| **CDI/Nav** | 6 | 0 | 0 | 0 | 6 |
| **Data Fields** | 9 | 0 | 0 | 0 | 9 |
| **Audio** | 2 | 2 | 0 | 0 | 4 |
| **TOTAL** | **54** | **11** | **48** | **2** | **115** |

**Implementation Rate:** 47% fully implemented, 57% with partial/full support

---

## Priority Recommendations for Implementation

### High Priority (User-Facing, High Value)
1. **Auto Zoom** — Automatically adjusts map range to show next waypoint (enhances usability)
2. **NAV Range Ring** — Distance reference circles (basic map utility)
3. **Track Vector** — Shows future track projection (situational awareness)
4. **Runway Extensions** — 5nm centerline projection for visual approaches (landing aid)
5. **Graphical Flight Plan Editing** — Drag-and-drop waypoint editing on map (workflow improvement)

### Medium Priority (Nice-to-Have)
6. **North Up Above** — Auto-switch to North Up at configurable zoom
7. **Glide Range Ring** — Emergency planning aid for engine failure
8. **Visual Approach Selector** — Auto-activates at distance from destination
9. **Constraints Display Modes** — UI selector for Off/Selected/Active/All
10. **Stacked Objects "Next"** — Cycle through overlapping map items

### Low Priority (Data/Hardware Limited)
11. **Point Obstacles** display — Requires obstacle database
12. **TFR** display — Requires live data feed
13. **Smart Airspace** — Auto-de-emphasis logic
14. **Road/City/River Detail** — Requires basemap data

### Not Feasible (Hardware/MSFS Limitation)
- Weather Radar overlay (requires onboard radar)
- Stormscope Lightning (requires Stormscope hardware)
- Selected Altitude Range Arc (requires GDU/TXi integration)
- Fuel Range Ring Enhanced (requires Garmin EIS)

---

## Notes

- **SimGlass strengths:** Core navigation, flight planning, route visualization, data fields, CDI/nav sources
- **SimGlass gaps:** Auto-zoom features, range rings, graphical editing, advanced airspace/weather controls
- **Data limitations:** Some features require datasets not in MSFS or our navdb (TFRs, obstacles, VRPs, road detail)
- **Hardware limitations:** Weather radar, Stormscope, altitude range arc require physical avionics integration

---

**Document Version:** 1.0
**Last Updated:** February 19, 2026
**Source PDF:** Garmin GTN750Xi Pilot's Guide 190-02327-03 Rev. G (622 pages)
