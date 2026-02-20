# GTN750Xi Planning Utilities - Browser Testing Instructions

**URL:** http://192.168.1.42:8080/ui/gtn750xi/

---

## Quick Test - All Utilities (Copy/Paste into Browser Console)

Open browser console (F12) and run:

```javascript
// Test all Planning utilities exist and have correct elements
const tests = {
    VCALC: {
        page: document.getElementById('page-vcalc'),
        inputs: ['vcalc-target-alt', 'vcalc-alt-type', 'vcalc-vs-profile', 'vcalc-offset', 'vcalc-offset-dir', 'vcalc-target-wpt'],
        outputs: ['vcalc-status', 'vcalc-vs-required', 'vcalc-time-tod', 'vcalc-dist-tod']
    },
    'Trip Planning': {
        page: document.getElementById('page-trip-planning'),
        inputs: ['trip-mode', 'trip-p-pos', 'trip-from-wpt', 'trip-to-wpt', 'trip-ground-speed'],
        outputs: ['trip-result-dtk', 'trip-result-dis', 'trip-result-ete', 'trip-result-eta']
    },
    'Fuel Planning': {
        page: document.getElementById('page-fuel-planning'),
        inputs: ['fuel-mode', 'fuel-est-remaining', 'fuel-flow', 'fuel-ground-speed'],
        outputs: ['fuel-result-required', 'fuel-result-range', 'fuel-result-efficiency']
    },
    'DALT/TAS/Winds': {
        page: document.getElementById('page-dalt-tas-winds'),
        inputs: ['dalt-indicated-alt', 'dalt-baro', 'dalt-cas', 'dalt-tat', 'dalt-hdg', 'dalt-trk'],
        outputs: ['dalt-result-density', 'dalt-result-tas', 'dalt-result-wind-dir']
    },
    Checklists: {
        page: document.getElementById('page-checklists'),
        inputs: ['checklist-group-name', 'checklist-name'],
        outputs: ['checklist-items', 'checklist-status']
    }
};

let passed = 0, failed = 0;
Object.entries(tests).forEach(([name, test]) => {
    console.log(`\n${name}:`);
    if (!test.page) { console.log('  ❌ Page not found'); failed++; return; }
    console.log('  ✅ Page exists');

    const missingInputs = test.inputs.filter(id => !document.getElementById(id));
    const missingOutputs = test.outputs.filter(id => !document.getElementById(id));

    if (missingInputs.length === 0) { console.log('  ✅ All inputs exist'); passed++; }
    else { console.log(`  ❌ Missing inputs: ${missingInputs.join(', ')}`); failed++; }

    if (missingOutputs.length === 0) { console.log('  ✅ All outputs exist'); passed++; }
    else { console.log(`  ❌ Missing outputs: ${missingOutputs.join(', ')}`); failed++; }
});

console.log(`\n📊 Total: ${passed} passed, ${failed} failed`);
```

---

## Manual Test - VCALC Step-by-Step

### 1. Navigate to VCALC
- Click **AUX** home button (or press `a` key)
- Click **VCALC** soft key (4th button from left)

### 2. Verify Page Loaded
You should see:
- Title: "VERTICAL CALCULATOR"
- Inputs section with 6 controls:
  - Target ALT: `3000` FT
  - Altitude Type: `MSL` button
  - VS Profile: `500` FPM
  - Offset: `5` NM
  - Before/After: `Before` button
  - Target Waypoint: `----` button
- Status section:
  - Status: `Inactive`
  - VS Required: `--- FPM`
  - Time to TOD: `--:--`
  - Dist to TOD: `--- NM`
- Setup section:
  - Display Messages checkbox (checked)
  - Restore Defaults button
- Soft keys: **ENABLE**, **TARGET**, **MSG**, **RESET**, blank, **BACK**

### 3. Test ENABLE Toggle
**Action:** Press **ENABLE** soft key

**Expected:**
- ENABLE button should highlight/toggle
- Status should change from "Inactive" to either:
  - "No flight plan" (if no flight plan loaded)
  - "Speed < 35kt" (if ground speed too low)
  - "Descend to target" (if conditions are met)

### 4. Test with Flight Plan
**Prerequisite:** Load a flight plan first (go to FPL page, import SimBrief or FROM SIM)

**Action:** Return to VCALC, press ENABLE

**Expected if flying at cruise altitude (e.g., 10,000 ft) with target 3000 ft:**
- Status: "Descend to target"
- VS Required: Shows negative value (e.g., "-502 FPM")
- Time to TOD: Shows time (e.g., "12:30")
- Dist to TOD: Shows distance (e.g., "25.3 NM")

**Verify real-time updates:**
- As you fly closer, Time to TOD and Dist to TOD should decrease
- VS Required should adjust based on remaining distance

### 5. Test Input Changes
**Action:** Change Target ALT to 2000

**Expected:**
- VS Required should recalculate immediately
- New value should reflect steeper descent (more negative VS)

**Action:** Change Offset to 10

**Expected:**
- Dist to TOD should change (TOD point moved further back)
- VS Required should adjust (less steep descent needed)

### 6. Test Altitude Type Toggle
**Action:** Click "MSL" button

**Expected:**
- Button should change to "Above WPT"
- If target waypoint is an airport, target altitude becomes field elevation + your input
- Calculations should update

### 7. Test Before/After Toggle
**Action:** Click "Before" button

**Expected:**
- Button changes to "After"
- Dist to TOD calculation reverses (offset added instead of subtracted)
- If target is last waypoint, button should become disabled (can't go After)

### 8. Test RESET
**Action:** Press **RESET** soft key

**Expected:**
- All values restore to defaults:
  - Target ALT: 3000
  - Altitude Type: MSL
  - VS Profile: 500
  - Offset: 5
  - Before/After: Before
- Target Waypoint excluded (per spec)

### 9. Test MSG Toggle
**Action:** Press **MSG** soft key

**Expected:**
- Display Messages checkbox should toggle
- State persists (refresh page, should remember setting)

---

## Expected Calculation Example

**Scenario:**
- Current altitude: 10,000 ft
- Target altitude: 3,000 ft (MSL)
- Offset: 5 NM Before
- Target waypoint: Last waypoint in flight plan, 30 NM away
- Ground speed: 120 kt

**Expected Calculations:**
- Altitude delta: 10,000 - 3,000 = 7,000 ft
- Distance to TOD: 30 - 5 = 25 NM
- Time to TOD: (25 / 120) × 60 = 12.5 minutes = 12:30
- VS Required: -(7,000 / 12.5) = -560 fpm
- Status: "Descend to target"

**As you approach:**
- At 15 NM to TOD → Time: 7:30, VS Required: -560 fpm (same)
- At 1 NM to TOD → Status changes to "Approaching TOD"
- At 0 NM to TOD → Status: "At TOD" or "Past TOD"
- Below 3,000 ft → Status: "At target altitude", VS Required: 0

---

## Troubleshooting

**Status shows "Inactive":**
- Press ENABLE soft key

**Status shows "No flight plan":**
- Load a flight plan first (FPL page > SIMBRIEF or FROM SIM)
- Return to VCALC and press ENABLE

**Status shows "Speed < 35kt":**
- Aircraft must be moving >35 kt for VCALC to activate
- Start flight or use sim slew mode

**VS Required shows "--- FPM":**
- VCALC is disabled or inhibited
- Press ENABLE soft key
- Check Status message for reason

**Values don't update:**
- Verify you pressed ENABLE
- Check flight plan is active
- Verify aircraft is moving >35 kt
- Try pressing RESET and reconfiguring

---

## Success Criteria

VCALC passes if:
- ✅ Page loads with all inputs/outputs visible
- ✅ ENABLE soft key toggles on/off
- ✅ Status changes based on flight conditions
- ✅ VS Required calculates when enabled with flight plan
- ✅ Values update in real-time during flight
- ✅ Input changes trigger immediate recalculation
- ✅ RESET restores defaults
- ✅ Settings persist after page reload

---

**After testing VCALC, test the other utilities using similar steps.**
