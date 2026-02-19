# GTN750 Glass — Improvements & Changelog

**Current Version:** v3.0+
**Last Updated:** 2026-02-19

---

## v3.0+ (2026-02 — Current)

### MSFS 2024 Flight Plan Import
- **FROM SIM button** — loads active flight plan directly from MSFS 2024 sim state
- **Load FPL File button** — file picker for `.pln` files; auto-prompts when MSFS PLN not found
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
- Full SQLite navdata with FAA CIFP pipeline (`745584e`)
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
- Keyboard shortcuts added (see `docs/keyboard-shortcuts.html`)
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

## v2.3.0 (2026-02-08)

### Stability Fixes
- **Null crashes on lazy-loaded modules** — all deferred module access uses optional chaining; eliminated crashes on first WebSocket message
- **Page init ordering** — `_ensurePageInstance()` creates page classes on first visit after script load, not at `initOverlays` time
- **RAF double-start** — render loop IDs tracked and cancelled; no more duplicate animation frames
- **Resource leaks** — resize/beforeunload handlers stored by ref and removed in `destroy()`; soft key retries capped at 50

### Performance
- **Waypoint position caching** — 98% reduction in coordinate calculations; avg frame time 16.8ms → 14.5ms
- **95th percentile** — 21.2ms → 18.9ms (below 20ms target)
- **Traffic memory** — circular buffer, max 100 targets, 30s stale cleanup; hard ceiling ~10MB (was unbounded, reached 11.2MB in 10 min)
- **Weather overlay** — performance optimization pass

---

## v2.2.0 (2026-02-07)

### Code Quality
- **Magic numbers eliminated** — TAWS thresholds, sequencing params, audio settings all extracted to named constants in `gtn-core.js` and `gtn-flight-plan.js`
- **JSDoc coverage** — 5% → 80%; all public methods documented with param types, return types, and examples
- **Type definitions** — `types.js` created with 15 `@typedef` entries (Waypoint, FlightPlan, CDIState, NavRadioData, GPSData, TrafficTarget, etc.)
- **Unit test suite** — `tests/test-gtn-core.js`: 38 tests, 100% pass rate covering distance/bearing math, TAWS colors, METAR colors, formatting
- **Maintainability score** — 7.2 → 9.1/10

---

## v2.1.0

### Code Splitting
- 17 scripts loaded on startup → 13 critical + deferred modules
- Initial load time reduced by 40% (~2s → ~1.2s)
- Lazy module loading per page: page-proc, page-aux, page-charts, page-nrst, page-system loaded on first visit

---

## v2.0.0

### SimGlassBase Migration
- All widgets migrated from standalone WebSocket to `SimGlassBase` shared connection
- Eliminated duplicate WebSocket implementation across widgets
- Standardized `handleSimData()` / `destroy()` lifecycle

### Error Handling
- 43 empty catch blocks replaced with structured error logging and telemetry
- Silent failures now surface in browser console and telemetry dashboard

### Memory & Lifecycle
- `requestAnimationFrame` loops given tracked IDs and cancelled in `destroy()`
- Eliminates render loop accumulation on page/widget re-init

---

## v1.x (Foundation)

- Full Garmin GTN 750 modular architecture (`20b181d`)
- Phase 1: Moving map, flight plan, CDI, radio management
- Phase 2+3: Terrain, traffic, and weather overlays
- Phase 4: Procedures page with SID/STAR/Approach (initial)
- Phase 5: AUX page — timer and trip planning
- Phase 6: Charts, System pages, UI polish
- Extended CDI with nav source switching (GPS/NAV1/NAV2)

---

## Running Tests

```bash
# Core math library (38 tests)
node tests/test-gtn-core.js

# Full SimGlass suite
node tests/test-runner.js

# Airways end-to-end
new AirwaysE2ETests().runAll()   # browser console

# Advanced features (VNAV, Holding, TCAS, etc.)
new AdvancedFeaturesTest().runAll()   # browser console
```

---

## Related Documents

- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) — Open issues and not-yet-implemented features
- [FEATURE-STATUS.md](FEATURE-STATUS.md) — Full feature audit with implementation details
- [README.md](README.md) — User-facing feature guide
