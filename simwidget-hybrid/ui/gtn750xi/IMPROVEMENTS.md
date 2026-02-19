# GTN750Xi Glass — Improvements & Changelog

**Current Version:** v1.0+
**Last Updated:** 2026-02-19
**Base:** GTN 750 v3.0+

---

## GTN750Xi v1.0+ (2026-02-19 — Current)

### VCALC - Vertical Calculator ⭐ NEW

**What it is:** Planning utility that calculates time to Top of Descent (TOD) and required vertical speed to reach target altitude at a specified waypoint offset. Per Garmin GTN 750Xi Pilot's Guide Section 4.

**Features:**
- **Profile Configuration:**
  - Target Altitude (MSL or Above Waypoint)
  - VS Profile (descent rate in FPM)
  - Offset distance (NM before/after target waypoint)
  - Target Waypoint selection from active flight plan
- **Real-Time Calculations:**
  - VS Required to reach target (updates continuously)
  - Time to TOD (minutes:seconds)
  - Distance to TOD (NM)
- **Status Messages:**
  - "Descend to target" (normal descent mode)
  - "Approaching TOD" (within 1 minute)
  - "At target altitude" (already at or below target)
  - "Past TOD" (missed descent point)
  - "Inactive" / "Speed < 35kt" / "No flight plan" (inhibit conditions)
- **Settings:**
  - Display Messages toggle (enable/disable TOD advisories)
  - Restore Defaults button (resets all except Target Waypoint)
  - Settings persist to localStorage
- **Access:** AUX page > VCALC soft key
- **Soft Keys:** ENABLE, TARGET, MSG, RESET, BACK

**Files:**
- `pages/page-vcalc.js` (341 lines) — VcalcPage class
- Updated: `index.html`, `pane.js`, `modules/gtn-softkeys.js`, `styles.css`

**Inhibit Conditions (per spec):**
- Ground speed < 35 knots
- No active flight plan or direct-to destination
- SUSP, OBS, or Vectors-to-Final mode active (partial implementation)
- Navigating to waypoint after FAF (not yet implemented)

**Note:** VCALC and VNAV are mutually exclusive in real GTN 750Xi. Current implementation allows both — mutual exclusivity TBD.

---

### Trip Planning ⭐ NEW

**What it is:** Planning utility that calculates DTK, DIS, ETE, ETA, ESA, and sunrise/sunset times for direct courses or flight plan legs. Per Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-7 to 4-10).

**Two Modes:**
1. **Point-to-Point Mode:**
   - From/To waypoint selection from database
   - P. Position toggle (uses current aircraft coordinates as From waypoint)
   - Departure Date/Time inputs
   - Ground Speed input or Use Sensor Data
2. **Flight Plan Mode:**
   - Active flight plan (catalog TBD)
   - Leg selector (cumulative or specific leg)
   - Next/Prev navigation through legs
   - Departure Date/Time inputs
   - Ground Speed or Use Sensor Data

**Calculated Outputs:**
- **DTK** (Desired Track) — Magnetic bearing to destination
- **DIS** (Distance) — Nautical miles
- **ETE** (Estimated Time Enroute) — HH:MM format
- **ETA** (Estimated Time of Arrival) — Point-to-Point: ETA = ETE + depart time; Active FPL: ETA = now + ETE; Catalog: ETA = depart time + ETE
- **ESA** (En Route Safe Altitude) — Simplified: max(from elevation, to elevation) + 1000ft
- **Sunrise/Sunset** — Approximate solar calculation at destination coordinates

**Features:**
- Auto-calculate on entry (GTN 750Xi style)
- Settings persist to localStorage
- Dashes when leg completed or data invalid

**Access:** AUX page > TRIP soft key
**Soft Keys:** MODE, SENSOR, NEXT, PREV, BACK

**Files:**
- `pages/page-trip-planning.js` (390 lines) — TripPlanningPage class
- Updated: `index.html`, `pane.js`, `modules/gtn-softkeys.js`, `styles.css`

---

### Fuel Planning ⭐ NEW

**What it is:** Planning utility that calculates fuel required, reserves, range, efficiency, and endurance. Per Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-11 to 4-14).

**Two Modes:**
1. **Point-to-Point Mode:**
   - From/To waypoint selection
   - P. Position toggle
   - EST Fuel Remaining (GAL) — decrements in real-time every second
   - Fuel Flow (GPH)
   - Ground Speed or Use Sensor Data
2. **Flight Plan Mode:**
   - Active flight plan (catalog TBD)
   - Leg selector (cumulative or specific leg)
   - Next/Prev navigation
   - EST Fuel Remaining, Fuel Flow, Ground Speed inputs
   - Use Sensor Data toggle

**Calculated Outputs:**
- **Fuel Required** — Gallons needed to reach destination
- **Fuel at Destination** — EST Fuel Remaining - Fuel Required
- **Reserve at Destination** — Time remaining in HH:MM:SS format
- **Range** — Total distance possible with current fuel (NM)
- **Efficiency** — Nautical miles per gallon (NM/GAL)
- **Endurance** — Total flight time possible with current fuel (HH:MM:SS)

**Features:**
- Real-time fuel countdown (EST Fuel Remaining decrements once per second based on fuel flow)
- Use Sensor Data pulls fuelTotal, fuelFlow, groundSpeed from MSFS sim
- Auto-calculate on entry (GTN 750Xi style)
- Settings persist to localStorage
- "For planning purposes only" disclaimer

**Access:** AUX page > FUEL soft key
**Soft Keys:** MODE, SENSOR, NEXT, PREV, BACK

**Files:**
- `pages/page-fuel-planning.js` (374 lines) — FuelPlanningPage class
- Updated: `index.html`, `pane.js`, `modules/gtn-softkeys.js`, `styles.css`

**Note:** Fuel Range Ring integration (mentioned in Pilot's Guide) not yet wired to map display.

---

## Inherited from GTN 750 v3.0+

All features, fixes, and optimizations from GTN 750 v3.0+ are included in GTN750Xi v1.0+. See sections below for full history.

---

## v3.0+ (Inherited - 2026-02)

### MSFS 2024 Flight Plan Import
- FROM SIM button — loads active flight plan directly from MSFS 2024 sim state
- Load FPL File button — file picker for `.pln` files; auto-prompts when MSFS PLN not found
- Auto-selects nearest upcoming waypoint on flight plan load
- Synthesises departure/arrival waypoints from NavDB when PLN has none

### Airways
- 13,000+ Victor & Jet routes from FAA CIFP database
- AWY soft key on FPL page with airway insertion modal
- Smart suggestions — finds airways connecting two waypoints
- MEA (Minimum Enroute Altitude) display per segment
- Map visualization — airways as dashed blue lines

### Procedures (SID/STAR/Approach)
- 52,000+ procedures from FAA CIFP data pipeline
- Full SID/STAR/Approach loading with procedure preview on map
- Altitude and speed constraints parsed from CIFP
- Procedure details panel with waypoint list
- CDI lateral guidance for activated procedures
- ILS auto-tuning on approach activation
- Missed approach: GO AROUND button + automatic waypoint insertion

### VNAV (Vertical Navigation)
- `modules/gtn-vnav.js` (360 lines)
- TOD (Top of Descent) calculation with configurable descent angle (1–6°, default 3°)
- Altitude constraint mapping from CIFP (AT/A/B descriptors)
- Vertical deviation indicator (±feet from path)
- Required VS calculation for constraint compliance
- TOD marker on map (cyan label)
- Auto-enable for approaches with altitude restrictions

### AIRAC Navigation Database
- Full SQLite navdata with FAA CIFP pipeline
- AIRAC cycle metadata with expiry tracking and badge in SYSTEM page
- `/api/navdb/check-latest` endpoint for update checks
- Spatial index for fast waypoint/navaid lookups
- Replaces ad-hoc server lookups with authoritative database

### SafeTaxi Enhancements
- Static layer caching — 60–80% render performance boost
- Satellite imagery with toggle and opacity controls
- Satellite fallback when diagram data unavailable
- Auto-load on all pages (not just MAP)
- Comprehensive auto-load test suite

### UI & UX
- UI updates throttled to 5Hz via ThrottleManager (prevents frame overload)
- Keyboard shortcuts added
- Fuel planning module with range/endurance display
- Little Navmap integration — UDP position sharing
- URL hash navigation for direct page access (`#/fpl`, `#/proc`, etc.)
- ILS indicator and compact mode GPS status

### NEXRAD Weather Radar
- Real precipitation tiles via RainViewer API
- Color-coded intensity overlay on map
- SIM WX radar toggle for MSFS weather data
- METAR parser with color-coded airport symbols (VFR/MVFR/IFR/LIFR)
- SimConnect weather control integration

---

## v2.3.0 (Inherited - 2026-02-08)

### Stability Fixes
- Null crashes on lazy-loaded modules — all deferred module access uses optional chaining
- Page init ordering — `_ensurePageInstance()` creates page classes on first visit after script load
- RAF double-start — render loop IDs tracked and cancelled
- Resource leaks — resize/beforeunload handlers stored by ref and removed in `destroy()`

### Performance
- Waypoint position caching — 98% reduction in coordinate calculations; avg frame time 16.8ms → 14.5ms
- 95th percentile — 21.2ms → 18.9ms (below 20ms target)
- Traffic memory — circular buffer, max 100 targets, 30s stale cleanup; hard ceiling ~10MB
- Weather overlay — performance optimization pass

---

## v2.2.0 (Inherited - 2026-02-07)

### Code Quality
- Magic numbers eliminated — TAWS thresholds, sequencing params, audio settings extracted to named constants
- JSDoc coverage — 5% → 80%; all public methods documented
- Type definitions — `types.js` created with 15 `@typedef` entries
- Unit test suite — 38 tests, 100% pass rate
- Maintainability score — 7.2 → 9.1/10

---

## v2.1.0 (Inherited)

### Code Splitting
- 17 scripts loaded on startup → 13 critical + deferred modules
- Initial load time reduced by 40% (~2s → ~1.2s)
- Lazy module loading per page

---

## v2.0.0 (Inherited)

### SimGlassBase Migration
- All widgets migrated from standalone WebSocket to `SimGlassBase` shared connection
- Eliminated duplicate WebSocket implementation
- Standardized `handleSimData()` / `destroy()` lifecycle

### Error Handling
- 43 empty catch blocks replaced with structured error logging and telemetry
- Silent failures now surface in browser console and telemetry dashboard

### Memory & Lifecycle
- `requestAnimationFrame` loops given tracked IDs and cancelled in `destroy()`
- Eliminates render loop accumulation on page/widget re-init

---

## v1.x (Foundation - Inherited)

- Full Garmin GTN 750 modular architecture
- Phase 1: Moving map, flight plan, CDI, radio management
- Phase 2+3: Terrain, traffic, and weather overlays
- Phase 4: Procedures page with SID/STAR/Approach
- Phase 5: AUX page — timer and trip planning
- Phase 6: Charts, System pages, UI polish
- Extended CDI with nav source switching (GPS/NAV1/NAV2)

---

## GTN750Xi Roadmap

### Completed - Planning Utilities ✅

**Trip Planning** — ✅ Implemented (commit 9325a0b)
**Fuel Planning** — ✅ Implemented (commit 63868c0)
**VCALC** — ✅ Implemented (commit 75a2939)

### Planned - Additional Utilities (Phase 2)

**DALT/TAS/Wind Calculator**
- Density Altitude calculator
- True Airspeed calculator
- Wind direction/speed calculator
- Headwind/tailwind component
- Use Sensor Data toggle

### Planned - Additional Utilities (Phase 3)

**RAIM Prediction**
- GPS coverage availability prediction
- Waypoint/Date/Time inputs
- RAIM Available/Unavailable status

**Checklists**
- SD card simulation with chklist.ace support
- Group/Checklist selector
- Checkbox completion tracking
- Clear Current/Clear All functions

### Planned - Enhancements (Phase 4)

**VCALC Enhancements:**
- Messages page integration for TOD advisories
- SUSP/Vectors-to-Final mode inhibit logic
- FAF detection for post-FAF inhibit
- VNAV/VCALC mutual exclusivity enforcement
- Map display of VCALC descent profile

**Trip Planning Enhancements:**
- Catalog flight plan selection
- Accurate ESA with terrain database
- Time zone support (Local vs UTC)
- Waypoint picker modal UI

**Fuel Planning Enhancements:**
- Catalog flight plan selection
- Fuel Range Ring integration on map
- Waypoint picker modal UI

---

## Related Documents

- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) — Open issues including VCALC testing status
- [FEATURE-STATUS.md](FEATURE-STATUS.md) — Full feature audit
- [README.md](README.md) — User-facing feature guide
- [GTN750XI-INFO.md](GTN750XI-INFO.md) — GTN750Xi project overview and differences from GTN750
