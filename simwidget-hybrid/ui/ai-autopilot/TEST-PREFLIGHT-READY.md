# AI Autopilot PREFLIGHT Auto-Ready Test Procedure

**Date**: February 15, 2026
**Feature**: SET_AIRCRAFT_READY command during PREFLIGHT phase
**Status**: ✅ Code deployed, awaiting MSFS verification

---

## What This Tests

The AI Autopilot should automatically:
1. Detect PREFLIGHT phase (engine off, on ground)
2. Send SET_AIRCRAFT_READY command to MSFS
3. Remove chocks, wheel covers, and pitot covers
4. Complete walk-around inspection
5. Transition to TAXI phase when engine starts

---

## Prerequisites

1. **MSFS 2024** running on commander-pc
2. **SimGlass server** running (port 8080)
3. **Aircraft** at gate/parking with:
   - Engine OFF
   - Parking brake ON
   - Ground equipment visible (chocks, covers, cones)

---

## Test Procedure

### Step 1: Load Aircraft in Cold & Dark

```
1. Launch MSFS 2024
2. Select C172 Skyhawk (or any GA aircraft)
3. Choose airport: KSEA (or any airport with visible ground equipment)
4. Select parking spot at gate
5. Set time: Daytime (for visibility)
6. Load flight with "COLD & DARK" state
   - Engine OFF
   - All systems OFF
   - Ground equipment visible
```

**Expected state:**
- Engine RPM: 0
- Chocks: VISIBLE under wheels
- Wheel covers: VISIBLE on gear
- Pitot cover: VISIBLE (red flag)
- Ground power: CONNECTED (yellow cable)

---

### Step 2: Enable AI Autopilot

**Option A: Via Browser**
```
1. Open http://192.168.1.42:8080/ui/ai-autopilot/
2. Click "OFF" button (turns green "AI HAS CONTROLS")
3. Watch UI for phase change: PREFLIGHT
```

**Option B: Via API**
```bash
curl -X POST http://192.168.1.42:8080/api/ai-autopilot/enable
```

---

### Step 3: Monitor PREFLIGHT Phase

**Watch for these changes in MSFS:**

✅ **Ground equipment should disappear:**
- [ ] Chocks removed from wheels
- [ ] Wheel covers removed
- [ ] Pitot cover removed
- [ ] Ground power disconnected
- [ ] Cones/markers removed

✅ **Command log verification:**
```bash
# Check command log for SET_AIRCRAFT_READY
curl -s http://192.168.1.42:8080/api/ai-autopilot/state | \
  grep -o '"commandLog":\[.*\]' | \
  grep 'SET_AIRCRAFT_READY'
```

**Expected output:**
```json
{
  "time": 1771213XXX,
  "type": "SET_AIRCRAFT_READY",
  "value": true,
  "description": "Aircraft ready for taxi (removes chocks/covers)"
}
```

---

### Step 4: Verify Phase Transition

**PREFLIGHT actions:**
1. SET_AIRCRAFT_READY sent (chocks/covers removed)
2. MIXTURE_SET to 100% (rich)
3. PARKING_BRAKE_SET to 0 (released)
4. THROTTLE_SET to 20% (idle-up)
5. ENGINE_AUTO_START sent (Ctrl+E)

**Expected timeline:**
- T+0s: AI Autopilot enabled → PREFLIGHT phase
- T+0.1s: SET_AIRCRAFT_READY sent → ground equipment vanishes
- T+0.5s: MIXTURE, BRAKE, THROTTLE commands
- T+1s: ENGINE_AUTO_START (engine starts cranking)
- T+3s: Engine running → TAXI phase

---

## Verification Checklist

### Visual Verification (MSFS)
- [ ] Aircraft initially has chocks/covers visible
- [ ] After enabling autopilot, chocks/covers disappear
- [ ] Ground equipment cables disconnect
- [ ] Aircraft ready for taxi (no walk-around needed)

### Command Log Verification (API)
```bash
# Get full command log (now 100 entries)
curl -s http://192.168.1.42:8080/api/ai-autopilot/state | \
  python3 -c "import sys, json; \
    data = json.load(sys.stdin); \
    log = data['commandLog']; \
    print('Commands sent:'); \
    for cmd in log: \
      print(f\"  {cmd['type']:20s} - {cmd['description']}\")"
```

**Expected commands in order:**
```
  SET_AIRCRAFT_READY   - Aircraft ready for taxi (removes chocks/covers)
  MIXTURE_SET          - Mixture RICH
  PARKING_BRAKE_SET    - Release parking brake for taxi
  THROTTLE_SET         - Idle-up throttle
  ENGINE_AUTO_START    - Engine auto-start (retry)
```

### Phase Verification
```bash
# Monitor phase changes in real-time
watch -n 0.5 'curl -s http://192.168.1.42:8080/api/ai-autopilot/state | \
  grep -o "\"phase\":\"[^\"]*\"" | head -1'
```

**Expected sequence:**
```
"phase":"PREFLIGHT"   ← Ground equipment visible
"phase":"PREFLIGHT"   ← SET_AIRCRAFT_READY sent here
"phase":"PREFLIGHT"   ← Ground equipment removed
"phase":"PREFLIGHT"   ← Engine starting
"phase":"TAXI"        ← Engine running, ready to taxi
```

---

## Troubleshooting

### Ground Equipment Not Disappearing

**Possible causes:**
1. **MSFS doesn't recognize SET_AIRCRAFT_READY event**
   - MSFS might use a different event name
   - Check MSFS SDK for correct event: `READY_TO_FLY`, `SET_AIRCRAFT_FLIGHT_READY`, etc.

2. **Event not mapped in SimConnect**
   - Verify event in `backend/server.js` line ~3786
   - Check server console for "Mapped X client events" message

3. **Command not being sent**
   - Check command log for SET_AIRCRAFT_READY entry
   - If missing, check `_preflightReadySent` flag logic

### PREFLIGHT Phase Too Short

If PREFLIGHT → TAXI happens instantly:
1. Engine already running (check `engineRunning` in flight data)
2. Ground speed > 1kt (aircraft moving)
3. Reload MSFS in true cold & dark state

### Command Not in Log

If SET_AIRCRAFT_READY not visible:
1. Command log shows last 100 entries (was 30)
2. PREFLIGHT phase very short (< 1 second)
3. Use real-time monitoring: `watch -n 0.1 'curl -s .../state | grep commandLog'`

---

## Alternative Event Names to Try

If SET_AIRCRAFT_READY doesn't work, edit `backend/server.js` line ~3786 and try:

```javascript
// Option 1: MSFS standard ready-to-fly event
'READY_TO_FLY',

// Option 2: Aircraft flight ready state
'SET_AIRCRAFT_FLIGHT_READY',

// Option 3: Toggle ground equipment
'TOGGLE_GROUND_EQUIPMENT',

// Option 4: Complete preflight check
'COMPLETE_PREFLIGHT_CHECK',
```

After changing, restart service:
```bash
ssh hjhar@192.168.1.42 "powershell -Command \"Restart-Service simglassmainserver\""
```

---

## Success Criteria

✅ **PASS** if all of these are true:
1. Aircraft starts with visible chocks/covers
2. AI Autopilot enabled in PREFLIGHT phase
3. SET_AIRCRAFT_READY appears in command log
4. Chocks/covers disappear from aircraft
5. Phase transitions to TAXI after engine start

❌ **FAIL** if:
- Ground equipment remains visible after autopilot enabled
- SET_AIRCRAFT_READY not in command log
- MSFS shows error/warning about unknown event

---

## Current Status

**Deployment**: ✅ Complete (commit dd64393)
**Code Review**: ✅ All files verified
**Tests**: ✅ 250/250 passing
**Command Log**: ✅ Increased to 100 entries
**MSFS Verification**: ⏳ Awaiting user test

**Next Step**: Load MSFS in cold & dark and follow test procedure above.
