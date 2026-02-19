# GTN750 Glass v3.0+ - Known Issues

**Last Updated:** 2026-02-19
**Status:** Production Ready ✅

---

## 🟢 Non-Critical Issues (Cosmetic/Performance)

### Weather Overlay Load Time

**Issue:** Weather overlay loads in ~124ms
**Target:** <100ms
**Impact:** Low - One-time load, not visible to user
**Workaround:** None needed
**Fix Planned:** Progressive tile loading (center first, spiral out)

---

## 🟡 Implemented But Untested / Incomplete

### VNAV (Vertical Navigation)

**Status:** Fully coded (`modules/gtn-vnav.js`, 360 lines), not validated with real flights
**Missing:**
- Integration testing with real STAR/approach data
- User documentation

**What works:** TOD calculation, altitude constraint parsing, vertical deviation indicator, required VS, TOD marker on map, auto-enable for approaches
**Test:** `new AdvancedFeaturesTest().runAll()` in browser console

---

### Holding Patterns

**Status:** Entry calculation and pattern drawing implemented (`modules/gtn-holding.js`, 378 lines)
**Missing:**
- Integration with HM/HA/HF procedure legs
- Automatic hold entry on published holds

**What works:** Direct/teardrop/parallel entry calculation, state machine, leg time config, racetrack drawing

---

### User Waypoints

**Status:** Storage and management implemented (`modules/gtn-user-waypoints.js`, 450 lines)
**Missing:**
- Page not wired into main navigation menu
- Backend SQLite storage (currently localStorage only)

**What works:** Create from lat/lon or current position, display in NRST, use in flight plans, GPX import/export

---

### TCAS

**Status:** Alert logic implemented (`modules/gtn-tcas.js`, 480 lines), no live traffic data
**Missing:**
- SimConnect AI aircraft data integration
- Multiplayer traffic feed

**What works:** TA/RA alerts, proximity calculation, audio callouts, relative altitude display, mode selection

---

### Altitude Alerts

**Status:** Deviation monitoring implemented (`modules/gtn-altitude-alerts.js`, 360 lines)
**Missing:**
- UI settings panel for configuring alert thresholds

**What works:** Target altitude setting, ±200/500/1000ft deviation monitoring, audio + visual annunciation

---

### Fuel Monitor

**Status:** Calculations implemented (`modules/gtn-fuel-monitor.js`, 410 lines), no live data
**Missing:**
- Real fuel data from SimConnect (currently mock values)
- UI panel integration

**What works:** Flow calculation, range/endurance estimation, reserves monitoring, low fuel warnings

---

## 🔴 Not Implemented

### Flight Plan Save/Load

**Status:** Soft keys exist, no backend
**Needed:** `POST /api/gtn750/save-fpl` / `POST /api/gtn750/load-fpl`, Garmin `.fpl` XML or JSON format, file picker UI

---

### Weather Radar (NEXRAD)

**Status:** WX soft key exists, no data source
**Needed:** NEXRAD data API, precipitation overlay, color-coded intensity, declutter integration

---

### Charts Integration

**Status:** CHARTS page links to ChartFox only
**Needed:** Embedded approach plates (PDF viewer), chart download/cache, zoom/pan controls

---

### Airspace Boundaries

**Status:** Not started
**Needed:** Class B/C/D boundary data, polygon rendering, altitude-based display filtering

---

## 🔵 Browser/Platform Limitations

### BroadcastChannel in MSFS Panels

**Issue:** BroadcastChannel API may not work in MSFS native panels
**Impact:** Cross-widget sync disabled in MSFS panel mode
**Workaround:** Use browser mode for multi-screen setups
**Fix Possible:** Add localStorage polling fallback (low priority)

### Audio Chime in Some Browsers

**Issue:** Web Audio API requires user gesture in some browsers
**Impact:** Sequence chime may not play on first waypoint
**Workaround:** Click map to initialize audio context

### Canvas Performance in Safari

**Issue:** Safari canvas rendering slower than Chrome/Edge
**Impact:** 45-50 FPS vs 60 FPS on same hardware
**Workaround:** Use Chrome or Edge
**Fix:** Not feasible — Safari canvas acceleration limitations

---

## ✅ Resolved Issues

### Procedures (SID/STAR/Approach) ✅
- **Was:** Not implemented
- **Now:** 52,000+ procedures from FAA CIFP, full SID/STAR/Approach loading, altitude/speed constraints, missed approach with GO AROUND button and auto waypoint insertion, ILS auto-tuning
- **Resolved:** Multiple commits (365ac12 → 0681621)

### Airways ✅
- **Was:** Not implemented
- **Now:** 13,000+ Victor & Jet routes, airway selection in FPL, auto-insert intermediate waypoints, smart suggestions, map display
- **Resolved:** Multiple commits (c5d0bef → 40f4642)

### AIRAC Database ✅
- **Was:** Not implemented — ad-hoc server API lookups only
- **Now:** Full SQLite navdata with FAA CIFP pipeline, AIRAC cycle metadata, expiry tracking, spatial queries, auto-update check endpoint
- **Resolved:** `745584e`, `12f04a1`, `cd4e137`

### VNAV TOD Calculation ✅
- **Was:** Design phase
- **Now:** TOD calc, vertical profile, altitude constraints, speed coupling all implemented in `gtn-vnav.js`
- **Resolved:** `fbc9d3b`, `e799ae4`

### Null Crashes on Lazy-Loaded Modules ✅
- **Was:** handleSimData, _getCdiState, initSyncListener, bindEvents crashed on first WebSocket message
- **Now:** All lazy-loaded module access uses optional chaining
- **Resolved:** v2.3.0 (commit d55832b)

### Page Classes Created Before Scripts Loaded ✅
- **Was:** initOverlays instantiated pages before their scripts were loaded
- **Now:** _ensurePageInstance() creates page instances on first visit after script load
- **Resolved:** v2.3.0 (commit d55832b)

### RAF Double-Start and Resource Leaks ✅
- **Was:** Render loops could double-start, resize/beforeunload handlers never cleaned up
- **Now:** RAF IDs tracked and cancelled, stored handler refs removed in destroy()
- **Resolved:** v2.3.0 (commit d55832b)

### Performance Spikes ✅
- **Was:** Frame time spiked to 23ms with all overlays active
- **Now:** Waypoint position caching (98% calc reduction), avg 16.8→14.5ms, 95th 21.2→18.9ms
- **Resolved:** v2.3.0 (commit 0a752f8)

### Traffic Memory Growth ✅
- **Was:** Traffic history accumulated unbounded, reaching 11.2MB after 10 minutes
- **Now:** Circular buffer, max 100 targets, 30s stale cleanup, hard ceiling ~10MB
- **Resolved:** v2.3.0 (commit 0a752f8)

### Code Quality ✅
- **Was:** Magic numbers, 5% JSDoc coverage, 0% test coverage
- **Now:** All constants named, 80% JSDoc, 38 unit tests (100% pass), maintainability 7.2→9.1
- **Resolved:** v2.2.0 (commit 507d749)

### Code Splitting ✅
- **Was:** 17 scripts loaded immediately, 2-second initial load
- **Now:** 13 critical scripts, 500ms deferred, 40% faster load
- **Resolved:** v2.1.0 (commit 8ec0bf1)

### Duplicate WebSocket Code ✅
- **Was:** Each widget reimplemented WebSocket connection
- **Now:** SimGlassBase provides standardized connection
- **Resolved:** v2.0.0

### Silent Error Swallowing ✅
- **Was:** 43 empty catch blocks across codebase
- **Now:** All errors logged with telemetry
- **Resolved:** v2.0.0

### Memory Leaks (RAF/Timers) ✅
- **Was:** requestAnimationFrame loops never stopped
- **Now:** Proper destroy() pattern with cleanup
- **Resolved:** v2.0.0

---

## 🐛 Bug Tracker

Report issues at: https://github.com/cobrahjh/LLM-DevOSWE/issues

**Labels:** `gtn750`, `performance`, `enhancement`, `bug`, `documentation`

---

## 📊 Monitoring

### Telemetry
- Frame render times (95th/99th percentile)
- Module load times
- Memory usage (initial, peak, after 30min)
- Error rates by module

**Dashboard:** http://192.168.1.42:8080/ui/gtn750/performance-dashboard.html

### Health Checks

```bash
curl http://192.168.1.42:8080/api/health
npm test -- --grep "GTN750"
du -sh ui/gtn750/*.js ui/gtn750/modules/*.js
```

---

## 🔍 Debugging Tips

### Map Not Rendering
1. Check browser console for errors
2. Verify canvas element: `document.getElementById('map-canvas')`
3. Check WebSocket connection: green dot in status bar
4. Clear cache: Ctrl+F5

### Waypoint Sequencing Issues
1. Check OBS mode: should be OFF for auto-sequencing
2. Verify ground speed: must be >15kt
3. Check distance threshold: `console.log(threshold)` in checkWaypointSequencing
4. Verify track error: should be <120° or distance <0.2nm

### CDI Needle Stuck
1. Check nav source: GPS/NAV1/NAV2 indicator
2. Verify flight plan loaded: FPL page should show waypoints
3. Check signal: NAV1/NAV2 require signal >10%
4. Test with OBS mode toggle

### Performance Issues
1. Disable overlays: Terrain/Traffic/Weather toggles
2. Reduce map range: lower zoom = fewer calculations
3. Check frame time: F12 → Performance → Record
4. Monitor memory: F12 → Memory → Take snapshot

---

## 📊 Version Compatibility

| GTN750 Version | SimGlassBase | Node.js | MSFS |
|----------------|--------------|---------|------|
| v3.0+ (current) | v2.0.0+ | 18.0+ | 2020/2024 |
| v2.3.0 | v2.0.0+ | 18.0+ | 2020/2024 |
| v2.2.0 | v2.0.0+ | 18.0+ | 2020/2024 |
| v2.1.0 | v2.0.0+ | 18.0+ | 2020/2024 |
| v2.0.0 | v2.0.0 | 18.0+ | 2020/2024 |
| v1.5.0 | v1.1.0 | 16.0+ | 2020 |

**Breaking Changes:**
- v2.0.0: SimGlassBase migration (localStorage keys changed)
- v2.1.0: Code splitting (module loader required)
- v2.3.0: Page instances lazy-created (no longer available at initOverlays time)

---

## 🤝 Contributing

Before reporting an issue:
1. Check this document for known issues
2. Verify you're on the latest version
3. Test in Chrome/Edge (Safari has known limitations)
4. Include browser console errors in report
5. Provide reproduction steps

**Template:**
```markdown
**GTN750 Version:** v3.0+
**Browser:** Chrome 131
**MSFS Version:** 2024
**Issue:** Brief description
**Steps to Reproduce:**
1. Step one
2. Step two
**Expected:** What should happen
**Actual:** What actually happened
**Console Errors:** (paste here)
```
