# Flight Plan Navigation - Manual Test Guide

**Quick Start**: Run `open-test-pages.bat` to open both pages automatically.

---

## Setup (30 seconds)

1. **Run the batch file**:
   ```
   cd C:\LLM-DevOSWE\simwidget-hybrid\ui\ai-autopilot
   open-test-pages.bat
   ```

   OR manually open:
   - http://localhost:8080/ui/gtn750/
   - http://localhost:8080/ui/ai-autopilot/

2. **Open DevTools in BOTH tabs**:
   - Press `F12` in GTN750 tab
   - Press `F12` in AI Autopilot tab

3. **Verify MSFS is running** with a GPS flight plan loaded

---

## Test 1: Verify Nav State Broadcasting (2 minutes)

### GTN750 Tab

**Console Check**:
```js
// Paste in GTN750 console:
const testCh = new SafeChannel('SimGlass-sync');
let count = 0;
testCh.onmessage = (e) => {
  if (e.data.type === 'nav-state') {
    count++;
    console.log(`[${count}] Nav-state:`, e.data.data.activeWaypoint?.ident,
                e.data.data.activeWaypoint?.distNm?.toFixed(1) + 'nm');
  }
};
console.log('Listening for nav-state broadcasts...');
```

**Expected**: Messages every 1 second like:
```
[1] Nav-state: KDEN 125.8nm
[2] Nav-state: KDEN 125.7nm
[3] Nav-state: KDEN 125.6nm
```

**✅ PASS if**: Messages appear every ~1 second with waypoint data

---

## Test 2: Verify AI Autopilot Receives Nav State (1 minute)

### AI Autopilot Tab

**Console Check 1** - Watch for nav-state logs (throttled to every 10s):
- Look for: `nav-state wp:XXXX dis:123.4 cdi:GPS dest:456nm`

**Console Check 2** - Check nav guidance method:
```js
// Paste in AI Autopilot console:
widget.ruleEngine.getNavGuidance()
```

**Expected Output**:
```js
{
  wpIdent: "KDEN",
  wpDist: 125.8,
  wpEte: 42.3,
  wpBearing: 275,
  cdiSource: "GPS",
  xtrk: -0.48,
  dtk: 275,
  navMode: "NAV",  // or "HDG" if XTRK > 2nm
  interceptHdg: 275,
  destDist: 456.2
}
```

**✅ PASS if**: Object returned with waypoint data (not null)

---

## Test 3: Verify UI Displays Waypoint Info (1 minute)

### AI Autopilot Tab (Visual Inspection)

**Enable AI Autopilot**:
- Click the **ON** button in AI Autopilot UI

**Check "Phase Targets" section**:
- **Heading row** should show:
  - ✅ **CORRECT**: `KDEN 125.8nm` (waypoint + distance)
  - ❌ **WRONG**: `HDG 305°` (raw heading)

**Hover over the heading target**:
- Tooltip should show: `DTK 275° | XTRK -0.5nm` (or similar)

**Check "AP Status" section**:
- **NAV row** should show:
  - ✅ When on course (XTRK < 2nm): `GPS` or `NAV/GPS`
  - ✅ When off course (XTRK > 2nm): `OFF` (using HDG mode instead)

**✅ PASS if**: Waypoint ident displays, NOT raw heading

---

## Test 4: Verify Course Intercept Logic (3 minutes)

### Prerequisites
- AI Autopilot enabled
- Currently in CRUISE or CLIMB phase

### Steps

1. **Check current nav state**:
   ```js
   // In AI Autopilot console:
   const ng = widget.ruleEngine.getNavGuidance();
   console.log(`DTK: ${ng.dtk}°, XTRK: ${ng.xtrk?.toFixed(2)}nm`);
   ```

2. **Manually fly off course** (if XTRK < 1nm):
   - Override heading with mouse/controls
   - Turn 20-30° away from DTK
   - Wait 30 seconds for AI override cooldown

3. **Re-enable AI** or wait for it to resume

4. **Check command log** (scroll down in AI Autopilot UI):
   - Look for `HEADING_BUG_SET` command
   - Should show intercept heading description like:
     ```
     DTK 275° 1.2nm R → HDG 260°
     ```
   - The intercept angle should be:
     - ~10° if XTRK 0.1-0.3nm
     - 10-30° if XTRK 0.3-1.0nm
     - 30° max if XTRK > 1.0nm

5. **Verify correction direction**:
   - If aircraft is RIGHT of course (XTRK > 0): should turn LEFT (HDG < DTK)
   - If aircraft is LEFT of course (XTRK < 0): should turn RIGHT (HDG > DTK)

**✅ PASS if**:
- Intercept heading computed (not just DTK)
- Correction direction correct
- Angle proportional to XTRK

---

## Test 5: Verify NAV/HDG Mode Switching (2 minutes)

### Scenario A: On Course (XTRK < 2nm)

1. Ensure aircraft is close to course (fly toward DTK)
2. Wait for XTRK to drop below 0.5nm
3. **Check console** for command:
   ```
   AP_NAV1_HOLD true, NAV tracking (CDI valid)
   ```
4. **Check AP Status → NAV row**: Should show `GPS`

**✅ PASS if**: NAV mode engaged when on course

### Scenario B: Off Course (XTRK > 2nm)

1. Manually fly off course again
2. Wait for XTRK > 2nm
3. AI should switch to HDG mode
4. **Check console** for commands:
   ```
   HEADING_BUG_SET XXX, DTK 275° 2.5nm R → HDG 245°
   AP_HDG_HOLD true, HDG hold (nav intercept)
   ```
5. **Check AP Status → NAV row**: Should show `OFF`

**✅ PASS if**:
- Switches to HDG mode when XTRK > 2nm
- Uses intercept heading, not just DTK

---

## Test 6: Verify Graceful Fallback (1 minute)

1. **With both pages open and AI enabled**, verify waypoint displayed

2. **Close GTN750 tab**

3. **Check AI Autopilot**:
   - Heading target should change to: `HDG 305°` (raw heading)
   - No console errors
   - AI continues to fly (uses current heading)

4. **Reopen GTN750 tab**: http://localhost:8080/ui/gtn750/

5. **Within 1-2 seconds**:
   - Waypoint display should return
   - Nav guidance resumes

**✅ PASS if**: No crashes, graceful degradation, automatic recovery

---

## Test 7: Verify TOD Calculation (Optional, 5 minutes)

**Only if you have time and are in cruise**:

1. Check destination distance:
   ```js
   widget.flightPhase.destinationDist
   ```
   Should match GTN750 destination distance

2. Calculate expected TOD:
   ```
   TOD = (cruiseAlt - destAlt) / 500 * 3
   Example: (8500 - 5000) / 500 * 3 = 21 nm before destination
   ```

3. Fly toward destination and watch phase transition
4. CRUISE → DESCENT should occur at calculated TOD distance

**✅ PASS if**: Phase transition occurs at expected distance

---

## Quick Checklist

Run through and check each:

- [ ] GTN750 broadcasts nav-state every 1s
- [ ] AI Autopilot receives nav-state (console logs visible)
- [ ] Heading target shows waypoint ident + distance (not raw heading)
- [ ] Tooltip shows DTK/XTRK when hovering
- [ ] NAV row shows `GPS` when NAV mode engaged
- [ ] Intercept heading computed when XTRK > 0.1nm
- [ ] Intercept angle proportional (10-30°)
- [ ] Correction direction correct (left if right of course, vice versa)
- [ ] NAV mode when XTRK < 2nm
- [ ] HDG mode when XTRK > 2nm
- [ ] No console errors during normal operation
- [ ] Graceful fallback when GTN750 closed
- [ ] Automatic recovery when GTN750 reopened
- [ ] destDistNm feeds FlightPhase (optional)

---

## What to Do If a Test Fails

### Console Errors
- Copy the full error message
- Check line numbers
- Report to developer

### Nav State Not Flowing
- Verify both pages open in same browser
- Check SafeChannel compatibility (localStorage fallback should work)
- Refresh both pages

### Waypoint Not Displaying
- Check `widget.ruleEngine.getNavGuidance()` returns data
- Verify GPS flight plan loaded in MSFS
- Check AI Autopilot is enabled

### Wrong Intercept Heading
- Note actual DTK, XTRK, and computed heading
- Verify correction direction (should turn TOWARD course)
- Report specific values

---

## Success Criteria

**All tests pass** = Ready to commit! 🎉

**Any test fails** = Debug before committing

**Partial failures** = Document as known limitations

---

## After Testing

If all tests pass:
1. Take screenshots of waypoint display
2. Run `git status` to review changes
3. Commit with detailed message
4. Update MEMORY.md
5. Deploy to harold-pc

Good luck! 🚀
