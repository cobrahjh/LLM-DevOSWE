# GTN750 Glass v2.3.0 - Known Issues

**Last Updated:** 2026-02-08
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

## 🟡 Missing Features (Roadmap)

### Procedures (Phase 2 - 3-4 weeks)

**Missing:**
- SID/STAR/Approach loading
- Procedure database
- Altitude/speed constraints
- Missed approach handling

**Status:** Architecture ready, database design in progress
**Blocking:** AIRAC database implementation

### Airways (Phase 3 - 2-3 weeks)

**Missing:**
- Victor routes (V1-V999)
- Jet routes (J1-J999)
- Airway selection in FPL
- Auto-insert intermediate waypoints

**Status:** Deferred until procedures complete
**Dependency:** Phase 2 database

### VNAV (Phase 3 - 2-3 weeks)

**Missing:**
- Top of Descent (TOD) calculation
- Vertical profile display
- Altitude constraints
- Speed/altitude coupling

**Status:** Design phase
**Complexity:** High - Requires energy management calculations

### AIRAC Database (Phase 2 - 2 weeks)

**Missing:**
- SQLite waypoint/navaid database
- AIRAC cycle metadata
- Auto-update mechanism
- Spatial index for queries

**Status:** Critical path item for Phase 2
**Current:** Uses server API for ad-hoc lookups

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
**Fix:** Auto-initialize on first user interaction (low priority)

### Canvas Performance in Safari

**Issue:** Safari canvas rendering slower than Chrome/Edge
**Impact:** 45-50 FPS vs 60 FPS on same hardware
**Workaround:** Use Chrome or Edge for best performance
**Fix:** Not feasible - Safari canvas acceleration limitations

---

## ✅ Resolved Issues

### Null Crashes on Lazy-Loaded Modules ✅
- **Was:** handleSimData, _getCdiState, initSyncListener, bindEvents accessed flightPlanManager/dataHandler before deferred init completed — crash on first WebSocket message
- **Now:** All lazy-loaded module access uses optional chaining
- **Resolved:** v2.3.0 (commit d55832b)

### Page Classes Created Before Scripts Loaded ✅
- **Was:** initOverlays instantiated ProceduresPage, AuxPage, ChartsPage, NearestPage, SystemPage before their scripts were loaded by loadPageModule
- **Now:** _ensurePageInstance() creates page instances on first visit after script load
- **Resolved:** v2.3.0 (commit d55832b)

### RAF Double-Start and Resource Leaks ✅
- **Was:** Page render loops (terrain/traffic/weather) could double-start, resize/beforeunload handlers never cleaned up, initSoftKeys polled forever if class unavailable
- **Now:** RAF IDs tracked and cancelled, stored handler refs removed in destroy(), soft key retries capped at 50
- **Resolved:** v2.3.0 (commit d55832b)

### Performance Spikes ✅
- **Was:** Frame time spiked to 23ms with all overlays, 95th percentile above 20ms target
- **Now:** Waypoint position caching (98% calc reduction), avg 16.8→14.5ms, 95th 21.2→18.9ms
- **Resolved:** v2.3.0 (commit 0a752f8)

### Traffic Memory Growth ✅
- **Was:** Traffic history accumulated unbounded, reaching 11.2MB after 10 minutes
- **Now:** Circular buffer with max 100 targets, 30s stale cleanup, hard ceiling ~10MB
- **Resolved:** v2.3.0 (commit 0a752f8)

### Code Quality (Magic Numbers, JSDoc, Tests) ✅
- **Was:** Hardcoded thresholds, 5% JSDoc coverage, 0% test coverage
- **Now:** All constants named, 80% JSDoc, 38 unit tests (100% pass), maintainability 7.2→9.1
- **Resolved:** v2.2.0 (commit 507d749)

### Code Splitting ✅
- **Was:** 17 scripts loaded immediately, 2-second initial load
- **Now:** 13 critical scripts, 500ms deferred, 40% faster load
- **Resolved:** v2.1.0 (commit 8ec0bf1)

### Duplicate WebSocket Code ✅
- **Was:** Each widget reimplemented WebSocket connection
- **Now:** SimGlassBase provides standardized connection
- **Resolved:** v2.0.0 (SimGlassBase migration)

### Silent Error Swallowing ✅
- **Was:** 43 empty catch blocks across codebase
- **Now:** All errors logged with telemetry
- **Resolved:** v2.0.0 (5-batch error handling fix)

### Memory Leaks (RAF/Timers) ✅
- **Was:** requestAnimationFrame loops never stopped
- **Now:** Proper destroy() pattern with cleanup
- **Resolved:** v2.0.0 (lifecycle fixes)

---

## 🐛 Bug Tracker Integration

Report issues at: https://github.com/cobrahjh/LLM-DevOSWE/issues

**Labels:**
- `gtn750` - GTN750-specific issues
- `performance` - Performance-related
- `enhancement` - Feature requests
- `bug` - Confirmed bugs
- `documentation` - Docs improvements

---

## 📊 Monitoring

### Telemetry Collection

Production telemetry is collected for:
- Frame render times (95th/99th percentile)
- Module load times (per module)
- Memory usage (initial, peak, after 30min)
- Error rates by module

**Dashboard:** http://localhost:8080/ui/gtn750/performance-dashboard.html

### Health Checks

```bash
# Check GTN750 status
curl http://localhost:8080/api/health

# Run test suite
npm test -- --grep "GTN750"

# Check bundle size
du -sh ui/gtn750/*.js ui/gtn750/modules/*.js
```

---

## 🔍 Debugging Tips

### Map Not Rendering
1. Check browser console for errors
2. Verify canvas element exists: `document.getElementById('map-canvas')`
3. Check WebSocket connection: Green dot in status bar
4. Clear cache: Ctrl+F5

### Waypoint Sequencing Issues
1. Check OBS mode: Should be OFF for auto-sequencing
2. Verify ground speed: Must be >15kt
3. Check distance threshold: `console.log(threshold)` in checkWaypointSequencing
4. Verify track error: Should be <120° or distance <0.2nm

### CDI Needle Stuck
1. Check nav source: GPS/NAV1/NAV2 indicator
2. Verify flight plan loaded: FPL page should show waypoints
3. Check signal: NAV1/NAV2 require signal >10%
4. Test with OBS mode toggle

### Performance Issues
1. Disable overlays: Terrain/Traffic/Weather toggles
2. Reduce map range: Lower zoom = fewer calculations
3. Check frame time: F12 → Performance → Record
4. Monitor memory: F12 → Memory → Take snapshot

---

## 📝 Version Compatibility

| GTN750 Version | SimGlassBase | Node.js | MSFS |
|----------------|--------------|---------|------|
| v2.3.0 (current) | v2.0.0+ | 18.0+ | 2020/2024 |
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
2. Verify you're on latest version (v2.3.0)
3. Test in Chrome/Edge (Safari has known limitations)
4. Include browser console errors in report
5. Provide reproduction steps

**Template:**
```markdown
**GTN750 Version:** v2.3.0
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

---

## 📅 Release Schedule

- **v3.0.0** (Mar 2026): Procedures database (SID/STAR/Approach)
- **v3.5.0** (Apr 2026): Airways and VNAV
- **v4.0.0** (May 2026): TypeScript migration

Stay updated: Watch repository for release announcements.
