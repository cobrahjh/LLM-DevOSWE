# SafeTaxi Auto-Load Test Procedure

**Date:** 2026-02-13
**Feature:** Auto-load airport diagrams on landing
**Status:** ✅ READY FOR TESTING

---

## Quick Browser Console Test

Open browser console (F12) and paste this code:

```javascript
// Enable debug mode to see auto-load logs
localStorage.setItem('gtn750-debug', 'true');

// Simulate landing at KSEA
const testLanding = () => {
    console.log('🧪 Testing SafeTaxi Auto-Load...\n');

    // Inject test flight data
    const testData = {
        latitude: 47.449,
        longitude: -122.309,
        agl: 30,           // < 50ft = on ground
        groundSpeed: 3,    // < 5kts = stationary
        altitude: 433,
        heading: 90,
        verticalSpeed: 0
    };

    // Trigger update if GTN750Pane exists
    if (window.gtnPane && window.gtnPane.taxiPage) {
        console.log('✓ Found SafeTaxi page instance');
        console.log('✓ Triggering update with landing data...');
        window.gtnPane.taxiPage.update(testData);

        setTimeout(() => {
            if (window.gtnPane.taxiPage.diagram?.airport) {
                console.log('✅ AUTO-LOAD SUCCESS!');
                console.log('   Airport:', window.gtnPane.taxiPage.diagram.airport.icao);
            } else {
                console.log('⏳ Auto-load in progress... check logs');
            }
        }, 2000);
    } else {
        console.log('⚠️  GTN750 not fully loaded yet');
        console.log('   Wait a moment and try again');
    }
};

testLanding();
```

**Expected Result:**
- Console shows: `[SafeTaxi] Auto-loading nearest airport: KSEA`
- Console shows: `[SafeTaxi] KSEA loaded`
- Status label shows: "KSEA loaded" in green

---

## Manual Test Procedure

### Prerequisites
- ✅ MSFS 2024 running
- ✅ SimWidget server running (port 8080)
- ✅ Aircraft on ground at any airport

### Test Steps

#### Test 1: Auto-Load While on Other Page

1. **Open GTN750**
   - Navigate to: http://localhost:8080/ui/gtn750/

2. **Stay on MAP or FPL page**
   - Do NOT go to TAXI page yet
   - This tests background auto-load

3. **Land the aircraft** (or start on ground)
   - Ensure AGL < 50 feet
   - Ensure Ground Speed < 5 knots
   - Wait 1-2 seconds

4. **Open browser console** (F12)
   - Look for: `[SafeTaxi] Auto-loading nearest airport: [ICAO]`
   - This confirms auto-load triggered

5. **Switch to TAXI page**
   - Click TAXI page button
   - Diagram should appear immediately (already loaded!)
   - Airport ICAO should be in input field

**Expected:**
- ✅ Diagram loads in background
- ✅ Switching to TAXI shows loaded diagram
- ✅ No "Loading..." delay

**If it fails:**
- Check console for errors
- Verify AGL < 50 and GS < 5
- Check if NavDB has diagram for airport

---

#### Test 2: Auto-Load While on TAXI Page

1. **Navigate to TAXI page first**
   - Click TAXI page button
   - Canvas should be empty

2. **Land the aircraft**
   - Ensure AGL < 50 feet
   - Ensure Ground Speed < 5 knots

3. **Observe auto-load**
   - Status changes to "Loading..." (yellow)
   - Then "XXXX loaded" (green)
   - Diagram appears on canvas

**Expected:**
- ✅ Auto-load triggers immediately
- ✅ Diagram renders in real-time
- ✅ Ownship position shows on diagram

---

#### Test 3: Airport Transition

1. **Land at first airport**
   - Auto-load triggers for airport A

2. **Taxi to different airport** (>5nm away)
   - Use slew mode or AI taxi

3. **Cross 5nm threshold**
   - Watch console for distance checks
   - Should see: `[SafeTaxi] Distance from XXXX: X.Xnm - reloading nearest`

4. **Observe auto-reload**
   - Old diagram replaced with new airport
   - Ownship re-centers on new airport

**Expected:**
- ✅ Detects distance > 5nm
- ✅ Auto-loads new nearest airport
- ✅ Seamless transition

---

## Debug Mode

Enable detailed logging:

```javascript
localStorage.setItem('gtn750-debug', 'true');
location.reload();
```

**Console Messages to Look For:**

```
[SafeTaxi] Auto-loading nearest airport: KSEA
[SafeTaxi] Distance from KSEA: 0.5nm
[SafeTaxi] KSEA loaded
```

Disable debug mode:

```javascript
localStorage.removeItem('gtn750-debug');
location.reload();
```

---

## Troubleshooting

### Auto-load not triggering

**Check flight data:**
```javascript
// In browser console
console.log(window.gtnPane?.data);
```

Look for:
- `agl: X` → Must be < 50
- `groundSpeed: X` → Must be < 5

**Check SafeTaxi page exists:**
```javascript
console.log(window.gtnPane?.taxiPage);
```

Should return SafeTaxiPage instance, not undefined.

**Check update is being called:**
```javascript
// Add temporary logging
const originalUpdate = window.gtnPane.taxiPage.update;
window.gtnPane.taxiPage.update = function(data) {
    console.log('Update called:', data.agl, 'ft AGL,', data.groundSpeed, 'kts GS');
    return originalUpdate.call(this, data);
};
```

Should see updates every frame.

---

### API not returning airports

**Test API directly:**
```javascript
fetch('http://localhost:8080/api/navdb/nearby/airports?lat=47.449&lon=-122.309&range=5&limit=1')
    .then(r => r.json())
    .then(data => console.log('Airports:', data.items || data));
```

**If no airports found:**
- Increase range: `range=10` or `range=20`
- Check position is valid (not ocean, not polar)
- Verify NavDB is populated (check /api/navdb/status)

---

### Diagram not loading

**Check diagram data API:**
```javascript
fetch('http://localhost:8080/api/airport-diagrams/KSEA')
    .then(r => r.json())
    .then(data => console.log('Diagram data:', data));
```

**If 404:**
- Airport doesn't have diagram data
- Only major airports (Class B/C) have diagrams
- Try different airport (KLAX, KJFK, KDEN, etc.)

---

## Performance Verification

### Check update frequency

```javascript
let updateCount = 0;
const originalUpdate = window.gtnPane.taxiPage.update;
window.gtnPane.taxiPage.update = function(data) {
    updateCount++;
    return originalUpdate.call(this, data);
};

setTimeout(() => {
    console.log('Updates per 10 seconds:', updateCount);
    // Should be ~600 (60fps * 10s)
}, 10000);
```

### Check render only when visible

```javascript
let renderCount = 0;
const originalRender = window.gtnPane.taxiPage.render;
window.gtnPane.taxiPage.render = function() {
    renderCount++;
    console.log('Render called (count:', renderCount, ')');
    return originalRender.call(this);
};
```

When NOT on TAXI page: renderCount should stay 0
When ON TAXI page: renderCount should increase

---

## Success Criteria

- ✅ Auto-load triggers when AGL < 50ft and GS < 5kts
- ✅ Works regardless of which page is currently visible
- ✅ API format handling works ({items: [...]} and [...])
- ✅ Distance-based reload works (>5nm triggers reload)
- ✅ Diagram appears when switching to TAXI page
- ✅ Console logs show auto-load activity (in debug mode)
- ✅ No unnecessary renders when TAXI page not visible

---

## Known Limitations

1. **Range limitation:** Only searches 5nm radius
   - If nearest airport is >5nm away, auto-load won't trigger
   - Increase range in code if needed for remote airfields

2. **Diagram availability:** Not all airports have diagrams
   - Small GA airports may not have diagram data
   - Try major airports for testing

3. **API throttling:** Nearby airports query on every update cycle
   - Could be optimized to query less frequently
   - Not a performance issue currently

---

## Test Results Template

| Test Case | Status | Notes |
|-----------|--------|-------|
| Auto-load while on MAP page | ☐ Pass / ☐ Fail | |
| Auto-load while on FPL page | ☐ Pass / ☐ Fail | |
| Auto-load while on TAXI page | ☐ Pass / ☐ Fail | |
| Airport transition (>5nm) | ☐ Pass / ☐ Fail | |
| API format handling | ☐ Pass / ☐ Fail | |
| Update runs continuously | ☐ Pass / ☐ Fail | |
| Render only when visible | ☐ Pass / ☐ Fail | |

**Tested by:** _______________
**Date:** _______________
**MSFS Version:** _______________
**SimWidget Version:** _______________

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Related Commits:** 631f21d, f655427
