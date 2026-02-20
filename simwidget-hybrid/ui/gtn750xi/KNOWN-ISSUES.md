# GTN750Xi Glass v1.0+ - Known Issues

**Last Updated:** 2026-02-19
**Status:** Experimental Build ⚠️

---

## 🆕 GTN750Xi Specific - New Features

### VCALC (Vertical Calculator) ⭐

**Status:** Implemented (2026-02-19), not yet flight tested
**What works:** Time to TOD calculation, VS required, profile settings (Target ALT, VS Profile, Offset, Target Waypoint), status messages, enable/disable toggle
**Missing:**
- Real-flight validation
- Integration with Messages page for TOD advisories
- SUSP/OBS/Vectors-to-Final inhibit logic (partial)
- FAF detection for post-FAF inhibit
- VNAV/VCALC mutual exclusivity enforcement

**Access:** AUX page > VCALC soft key

---

### Trip Planning ⭐

**Status:** Implemented (2026-02-19), not yet flight tested
**What works:** Point-to-Point mode (From/To waypoints, P.Position), Flight Plan mode (Active FPL, leg selector), DTK/DIS/ETE/ETA calculations, ESA estimation, Sunrise/Sunset times, Use Sensor Data toggle, Next/Prev leg navigation
**Missing:**
- Real-flight validation
- Catalog flight plan selection (currently Active FPL only)
- Accurate ESA calculation (requires terrain database; currently uses max elevation + 1000ft)
- Time zone handling for Local vs UTC (currently approximate)

**Access:** AUX page > TRIP soft key

---

### Fuel Planning ⭐

**Status:** Implemented (2026-02-19), not yet flight tested
**What works:** Point-to-Point mode, Flight Plan mode, EST Fuel Remaining with real-time countdown, Fuel Required/After/Reserve calculations, Range/Efficiency/Endurance outputs, Use Sensor Data toggle, Next/Prev leg navigation
**Missing:**
- Real-flight validation
- Catalog flight plan selection (currently Active FPL only)
- Fuel Range Ring integration on map (mentioned in guide but not wired)

**Access:** AUX page > FUEL soft key

### DALT/TAS/Wind Calculator ⭐

**Status:** Implemented (2026-02-19), not yet flight tested
**What works:** Density Altitude calculation (ISA standard), TAS calculation (CAS corrected for altitude/temp), Wind vector calculation (direction/speed/headwind component), Use Sensor Data toggle (pulls all inputs from sim), auto-calculate on entry, RESET function
**Missing:**
- Real-flight validation
- Pressure ALT mode when ADC sensor provides it (currently uses Indicated ALT conversion)
- RAT (Ram Air Temperature) option vs TAT (installer configurable per guide; currently TAT only)

**Access:** AUX page > DALT soft key

---

### Checklists ⭐

**Status:** Implemented (2026-02-19), not yet flight tested
**What works:** Group/Checklist selection, scrollable checklist with checkbox UI, tap to toggle completion, completed items turn green with check mark, completion status bar ("LIST NOT FINISHED" / "LIST IS FINISHED"), Clear Current Checklist, Clear All Checklists, Go to Next Checklist, checkboxes clear on page reload (per spec)
**Included:** 10 Normal Procedures checklists (Preflight → Engine Shutdown), 4 Emergency Procedures checklists (Engine Fire, Engine Failure, Electrical Fire), total 77 inspection items
**Missing:**
- Real-flight validation
- SD card file upload UI (currently uses hardcoded default checklists)
- Group/Checklist selection modal (MENU soft key placeholder)
- Custom checklist editor integration

**Access:** AUX page > CHKLIST soft key

---

## 🟡 Inherited - Untested Features

---

### RAIM Prediction

**Status:** Not implemented
**Needed:**
- Waypoint Identifier input
- Arrival Date/Time inputs
- Compute RAIM button
- Status output: RAIM Available / Unavailable / Computing

**Impact:** Low — WAAS assumed available in sim
**Note:** Only remaining Planning utility from Pilot's Guide Section 4

---

### VNAV (Vertical Navigation)

**Status:** Fully coded (`modules/gtn-vnav.js`, 360 lines), not validated with real flights
**Missing:**
- Integration testing with real STAR/approach data
- VNAV/VCALC mutual exclusivity enforcement

**What works:** TOD calculation, altitude constraint parsing, vertical deviation indicator, required VS, TOD marker on map, auto-enable for approaches

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
- Backend SQLite storage (currently localStorage only)

**What works:** Create from lat/lon or current position, display in NRST, use in flight plans, GPX import/export, page wired into navigation

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
- Full Fuel Planning utility page

**What works:** Flow calculation, range/endurance estimation, reserves monitoring, low fuel warnings

---

## 🟢 Non-Critical Issues

### Weather Overlay Load Time

**Issue:** Weather overlay loads in ~124ms
**Target:** <100ms
**Impact:** Low - One-time load, not visible to user
**Workaround:** None needed
**Fix Planned:** Progressive tile loading (center first, spiral out)

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

## 🐛 Bug Tracker

Report issues at: https://github.com/cobrahjh/LLM-DevOSWE/issues

**Labels:** `gtn750xi`, `vcalc`, `utilities`, `performance`, `enhancement`, `bug`, `documentation`

---

## 📊 Monitoring

### Telemetry
- Frame render times (95th/99th percentile)
- Module load times
- Memory usage (initial, peak, after 30min)
- Error rates by module

**Dashboard:** http://192.168.1.42:8080/ui/gtn750xi/performance-dashboard.html

### Health Checks

```bash
curl http://192.168.1.42:8080/api/health
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
3. Check distance threshold
4. Verify track error: should be <120° or distance <0.2nm

### CDI Needle Stuck
1. Check nav source: GPS/NAV1/NAV2 indicator
2. Verify flight plan loaded: FPL page should show waypoints
3. Check signal: NAV1/NAV2 require signal >10%
4. Test with OBS mode toggle

### VCALC Not Calculating
1. Verify VCALC is enabled (ENABLE soft key active)
2. Check ground speed: must be >35kt
3. Ensure flight plan is active with waypoints
4. Verify target waypoint is set
5. Check OBS/SUSP mode is not active

---

## 📊 Version Compatibility

| GTN750Xi Version | Base GTN750 | SimGlassBase | Node.js | MSFS |
|------------------|-------------|--------------|---------|------|
| v1.0+ (current) | v3.0+ | v2.0.0+ | 18.0+ | 2020/2024 |

**GTN750Xi Differences:**
- Independent versioning from GTN750
- Experimental features (VCALC, enhanced utilities)
- Same codebase foundation, parallel deployment
- Access: `/ui/gtn750xi/` vs `/ui/gtn750/`

---

## 🤝 Contributing

Before reporting an issue:
1. Check this document for known issues
2. Verify you're on the latest version
3. Test in Chrome/Edge (Safari has known limitations)
4. Specify if issue is GTN750Xi-specific or inherited
5. Include browser console errors in report
6. Provide reproduction steps

**Template:**
```markdown
**GTN750Xi Version:** v1.0+
**Browser:** Chrome 131
**MSFS Version:** 2024
**Feature:** VCALC / Trip Planning / etc.
**Issue:** Brief description
**Steps to Reproduce:**
1. Step one
2. Step two
**Expected:** What should happen
**Actual:** What actually happened
**Console Errors:** (paste here)
```
