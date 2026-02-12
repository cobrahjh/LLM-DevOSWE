# Test Flight Plan Navigation NOW

## Step 1: Open Pages (30 seconds)

The batch file should have opened two browser tabs:
- GTN750: http://localhost:8080/ui/gtn750/
- AI Autopilot: http://localhost:8080/ui/ai-autopilot/

**If not open**, manually navigate to those URLs.

---

## Step 2: Run Browser Console Test (1 minute)

### In AI Autopilot Tab:

1. **Press F12** to open DevTools
2. **Click Console tab**
3. **Copy the entire contents** of `browser-console-test.js`
4. **Paste into console** and press Enter

### Expected Output:

```
============================================================
  AI AUTOPILOT NAV GUIDANCE - LIVE TEST
============================================================

✅ Widget object exists
✅ Rule engine exists
✅ getNavGuidance() method exists

📊 Nav Guidance Data:
✅ Waypoint ident present → KDEN
✅ Waypoint distance present → 125.8nm
✅ Waypoint bearing present → 275°
✅ CDI source present → GPS
✅ Cross-track present → -0.48nm
✅ DTK present → 275°
✅ Nav mode determined → HDG
✅ Intercept heading computed → 272°
✅ Intercept direction correct XTRK -0.48nm LEFT → turn RIGHT

🤖 AI Status:
✅ AI Autopilot enabled

🖥️  UI Elements:
✅ Heading element exists → "KDEN 125.8nm"
✅ Shows waypoint (not raw heading)

============================================================
  SUMMARY
============================================================
✅ PASSED: 14
❌ FAILED: 0
⚠️  WARNINGS: 0

🎉 ALL TESTS PASSED! Nav guidance working perfectly!
============================================================
```

---

## Step 3: Interpret Results

### ✅ ALL PASSED = Success!
- Nav guidance is working
- Waypoint displayed in UI
- Ready to commit

### ⚠️  WARNINGS
Most common: **"No nav guidance data - GTN750 not open"**

**Fix**:
1. Open GTN750 tab: http://localhost:8080/ui/gtn750/
2. Wait 2 seconds
3. Re-run the console test

### ❌ FAILURES
- Copy the full console output
- Check what failed
- Report to developer

---

## Step 4: Visual Verification (30 seconds)

### In AI Autopilot UI:

1. **Click ON button** (if not already enabled)

2. **Look at "Phase Targets" section**:
   - Heading row should show: **`KDEN 125.8nm`** ✅
   - NOT: `HDG 305°` ❌

3. **Look at "AP Status" section**:
   - NAV row should show: **`GPS`** ✅ (when on course)

4. **Hover over heading target**:
   - Tooltip should show: `DTK 275° | XTRK -0.5nm`

---

## Step 5: Quick Functionality Test (Optional, 2 minutes)

### Test Course Intercept:

1. In AI Autopilot console:
   ```js
   widget.ruleEngine.getNavGuidance()
   ```

2. Note the DTK and XTRK values

3. **If XTRK > 0.5nm**:
   - Heading bug should show intercept (not just DTK)
   - Command log should show: `DTK 275° 1.2nm R → HDG 260°`

4. **If XTRK < 0.5nm**:
   - NAV mode engaged
   - Command log shows: `AP_NAV1_HOLD true, NAV tracking`

---

## ✅ Success Criteria

**ALL of these must be true**:
- [ ] Browser console test shows ✅ PASSED (0 failures)
- [ ] Heading display shows waypoint ident + distance
- [ ] No console errors (red text)
- [ ] NAV row shows GPS source when on course

**If all checked** → **READY TO COMMIT!** 🎉

---

## 🚨 Troubleshooting

### "Widget object not found"
- Refresh the AI Autopilot page
- Make sure you're in the AI Autopilot tab, not GTN750

### "No nav guidance data"
- Open GTN750 tab: http://localhost:8080/ui/gtn750/
- Verify MSFS has GPS flight plan loaded
- Wait 2 seconds, re-run test

### "Still showing raw heading"
- Make sure GTN750 tab is open
- Enable AI Autopilot (click ON)
- Check console for nav-state receipt logs

### Console errors
- Copy full error message
- Note line numbers
- Check browser console in BOTH tabs

---

## What's Next?

### If Tests Pass:
1. ✅ Take screenshot of waypoint display
2. ✅ Run automated tests: `node tests/test-runner.js`
3. ✅ Commit changes
4. ✅ Update MEMORY.md
5. ✅ Deploy to harold-pc

### If Tests Fail:
1. Note which tests failed
2. Copy console output
3. Check MANUAL-TEST-GUIDE.md for detailed debugging
4. Report findings

---

**Ready? Run the browser console test now!** 🚀
