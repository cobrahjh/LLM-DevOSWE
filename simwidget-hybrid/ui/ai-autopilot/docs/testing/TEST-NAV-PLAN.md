# Flight Plan Navigation - Test Plan

## Test Environment
- **Server**: http://localhost:8080
- **MSFS**: Running, aircraft airborne
- **Current State**:
  - Altitude: 2313 ft MSL / 1057 ft AGL
  - Speed: 30 kts
  - Heading: 305°
  - AP: Engaged (HDG 270°, ALT 5000 ft)
  - GPS Flight Plan: 5 waypoints loaded
  - Active waypoint: #2 (125.8 nm, bearing 273.9°)

## Pages to Open
1. **AI Autopilot**: http://localhost:8080/ui/ai-autopilot/
2. **GTN750**: http://localhost:8080/ui/gtn750/

## Test Scenarios

### 1. GTN750 Nav State Broadcast
**Objective**: Verify GTN750 broadcasts nav-state via SafeChannel

**Steps**:
1. Open GTN750 in browser
2. Open browser DevTools → Console
3. Listen for SafeChannel messages:
   ```js
   const ch = new SafeChannel('SimGlass-sync');
   ch.onmessage = (e) => {
     if (e.data.type === 'nav-state') {
       console.log('Nav state:', e.data.data);
     }
   };
   ```
4. Verify messages arrive every 1 second
5. Check for:
   - `flightPlan` (departure, arrival, waypointCount, cruiseAltitude)
   - `activeWaypoint` (ident, distNm, bearingMag)
   - `cdi` (source, dtk, xtrk, toFrom)
   - `destDistNm`

**Expected**: Nav-state messages broadcast at 1 Hz with complete data structure

---

### 2. AI Autopilot Receives Nav State
**Objective**: Verify AI Autopilot pane receives and displays nav state

**Steps**:
1. Open AI Autopilot in browser
2. Open DevTools → Console
3. Check for nav-state receipt logs (throttled to every 10s):
   ```
   nav-state wp:XXXX dis:123.4 cdi:GPS dest:456nm
   ```
4. Verify `ruleEngine.getNavGuidance()` returns data:
   ```js
   // In AI Autopilot page console:
   widget.ruleEngine.getNavGuidance()
   ```

**Expected**:
- Console shows nav-state logs every 10s
- `getNavGuidance()` returns object with wpIdent, wpDist, cdiSource, xtrk, dtk

---

### 3. Nav-Guided Heading in CRUISE
**Objective**: Verify AI uses waypoint bearing for heading bug

**Steps**:
1. Ensure both GTN750 and AI Autopilot are open
2. Enable AI Autopilot (click ON button)
3. Wait for phase to reach CRUISE (if not already)
4. Observe "Phase Targets" heading display:
   - Should show waypoint ident + distance (e.g., "KDEN 125.8nm")
   - NOT raw heading like "HDG 305°"
5. Check AP Status → NAV row:
   - Should show "GPS" or "NAV/GPS" if NAV mode engaged
6. Open DevTools → Console, check command log for:
   - `HEADING_BUG_SET` commands with waypoint bearing
   - `AP_NAV1_HOLD` or `AP_HDG_HOLD` commands
7. Check tooltip on heading target (hover over waypoint display):
   - Should show DTK, XTRK details

**Expected**:
- Heading target shows waypoint ident, not raw heading
- Heading bug set to waypoint bearing or DTK intercept heading
- NAV mode engaged when XTRK < 2nm, HDG hold when XTRK > 2nm

---

### 4. Course Intercept When Off Track
**Objective**: Verify intercept heading when XTRK > 0.1nm

**Steps**:
1. In GTN750, note current DTK and XTRK
2. If XTRK < 0.5nm, manually fly off course:
   - Override heading (turn aircraft with mouse/controls)
   - Wait 30s for AI override cooldown
3. Re-enable AI or wait for it to resume
4. Observe heading bug command in console:
   - Should show intercept angle (DTK ± correction)
   - Example: `DTK 275° 1.2nm R → HDG 260°` (15° left correction)
5. Verify intercept angle scales with XTRK:
   - < 0.3nm: ~10° correction
   - 0.3-1.0nm: 10-30° proportional
   - > 1.0nm: 30° max correction

**Expected**:
- Heading bug set to intercept heading, not DTK
- Intercept angle proportional to XTRK
- Description shows DTK, XTRK, and target heading

---

### 5. NAV Mode vs HDG Mode Switching
**Objective**: Verify _shouldUseNavMode() logic

**Steps**:
1. Fly close to course (XTRK < 0.5nm)
2. Check AP Status → NAV row: should show "GPS" (NAV mode)
3. Check command log: should see `AP_NAV1_HOLD true, NAV tracking (CDI valid)`
4. Manually fly off course until XTRK > 2nm
5. Wait for AI to resume after override
6. Check AP Status → NAV row: should show "OFF" (HDG mode instead)
7. Check command log: should see `HEADING_BUG_SET` + `AP_HDG_HOLD`

**Expected**:
- NAV mode when: CDI source valid, XTRK < 2nm, TO flag
- HDG mode when: XTRK > 2nm or FROM flag or no CDI source
- Smooth transition between modes

---

### 6. Destination Distance TOD Calculation
**Objective**: Verify destDistNm feeds FlightPhase for CRUISE→DESCENT

**Steps**:
1. Set cruise altitude to match flight plan (if available)
2. Check `widget.flightPhase.destinationDist`:
   ```js
   widget.flightPhase.destinationDist
   ```
3. Should match GTN750 destDistNm
4. Fly toward destination and watch phase transition
5. Expected TOD at: `(cruiseAlt - destAlt) / 500 * 3` nm before dest
   - Example: 8500 ft cruise, 5000 ft dest → (3500/500)*3 = 21 nm TOD

**Expected**:
- `flightPhase.destinationDist` updates every 1s from nav-state
- CRUISE→DESCENT transition occurs at calculated TOD

---

### 7. APPROACH Phase Heading Fallback
**Objective**: Verify heading fallback when no APR mode available

**Steps**:
1. Descend to approach phase (< 3000 ft AGL)
2. If no glideslope available:
   - Should use DTK heading from CDI
   - Or fall back to runway heading if nav data missing
3. Check command log for:
   - `HEADING_BUG_SET` with DTK or runway heading
   - `AP_HDG_HOLD true, HDG hold (approach)`
4. If glideslope available:
   - Should engage `AP_APR_HOLD`

**Expected**:
- APR mode when glideslope valid
- HDG hold with DTK when no APR mode
- Runway heading fallback when no nav data

---

### 8. Graceful Fallback (No GTN750)
**Objective**: Verify behavior when GTN750 not open

**Steps**:
1. Close GTN750 browser tab
2. Wait 10 seconds
3. AI Autopilot should:
   - Stop receiving nav-state messages
   - `getNavGuidance()` returns null
   - Heading target shows raw heading "HDG 305°" instead of waypoint
   - Use current heading for HDG hold (legacy behavior)
4. Reopen GTN750
5. Nav state should resume within 1 second

**Expected**:
- No errors or crashes when GTN750 closed
- Graceful degradation to heading-based flight
- Automatic recovery when GTN750 reopened

---

## Manual Testing Checklist

- [ ] GTN750 broadcasts nav-state every 1s
- [ ] AI Autopilot receives nav-state (console logs)
- [ ] Heading target shows waypoint ident + distance
- [ ] NAV row shows GPS source when NAV mode engaged
- [ ] Heading bug set to waypoint bearing when on course
- [ ] Intercept heading computed when XTRK > 0.1nm
- [ ] NAV mode engages when XTRK < 2nm
- [ ] HDG mode with intercept when XTRK > 2nm
- [ ] destDistNm feeds FlightPhase.destinationDist
- [ ] CRUISE→DESCENT transition at TOD
- [ ] APPROACH uses DTK heading when no APR
- [ ] Graceful fallback when GTN750 closed
- [ ] No console errors during normal operation
- [ ] Pilot override still works (30s cooldown)
- [ ] Envelope protection overrides nav guidance

---

## Success Criteria

✅ All 8 test scenarios pass
✅ No JavaScript errors in console
✅ 213/213 automated tests pass
✅ Nav guidance visible in UI
✅ Smooth waypoint tracking in flight
✅ Graceful degradation without GTN750

---

## Known Limitations

1. **NAV mode requires GPS flight plan** - Won't track VOR radials yet
2. **No waypoint sequencing verification** - Assumes GTN750 manages waypoint transitions
3. **No hold pattern support** - Will track waypoint bearing, not hold entry/teardrops
4. **Single nav source** - Uses GPS only, not NAV1/NAV2 receivers

---

## Next Steps After Testing

If tests pass:
- [ ] Commit changes with test results
- [ ] Deploy to harold-pc for live testing
- [ ] Update MEMORY.md with flight plan navigation documentation
- [ ] Consider adding hysteresis to NAV/HDG mode switching (prevent oscillation)
- [ ] Add waypoint sequencing awareness (detect "FROM" waypoint, advance to next)
