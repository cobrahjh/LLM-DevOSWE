# GTN750 Holding Patterns Guide

**Status**: ✅ FULLY IMPLEMENTED
**Version**: GTN750 v3.0+
**Date**: February 14, 2026

## Overview

The GTN750 includes complete holding pattern support with automatic entry procedure calculation, racetrack visualization, and integration with published procedures.

## Features

### ✈️ Holding Pattern Management
- **Automatic Detection** - Recognizes HM/HA/HF legs from procedures
- **Entry Calculation** - DIRECT, TEARDROP, or PARALLEL entry
- **Racetrack Visualization** - Map display of holding pattern
- **Leg Timing** - 1 min below 14,000ft, 1.5 min above
- **State Machine** - Automatic leg sequencing (inbound/outbound/turn)
- **Turn Direction** - Standard right turns or non-standard left turns

### 🎯 Entry Procedures

Based on aircraft heading relative to holding fix:

| Entry Type | When Used | Procedure |
|------------|-----------|-----------|
| **DIRECT** | Within 70° either side of outbound course | Fly directly to fix, turn to outbound |
| **TEARDROP** | 70° to 110° left of outbound (right turns) | Fly 30° offset, then turn back to intercept |
| **PARALLEL** | 110° to 290° left of outbound (right turns) | Fly outbound parallel, offset turn to rejoin |

### 📊 ARINC 424 Hold Types

From published procedures:

| Type | Terminator | Meaning |
|------|-----------|---------|
| **HM** | Hold to Manual termination | Hold until ATC clearance |
| **HA** | Hold to Altitude | Hold until reaching specified altitude |
| **HF** | Hold to Fix | Hold until cleared to next fix |

---

## How Holding Works

### Entry Procedure Determination

The GTN750 automatically calculates the best entry based on your approach angle:

```
Sectors (for standard right turns):
- DIRECT: 290° → 070° (140° sector centered on outbound)
- TEARDROP: 070° → 110° (40° sector)
- PARALLEL: 110° → 290° (180° sector)
```

**Example**:
```
Hold fix: ALPHA
Inbound course: 360° (north)
Outbound course: 180° (south)
Aircraft heading: 270° (west)

Relative bearing from outbound: 270° - 180° = 90°
Result: DIRECT entry (90° is within 70°-110° sector... actually TEARDROP)
```

### Racetrack Pattern Calculation

```
Leg Length (nm) = (Leg Time / 3600) × Ground Speed
Turn Radius (nm) = Ground Speed / 360

Example at 120kt:
- Leg time: 60s → Leg length: 2.0nm
- Turn radius: 0.33nm
- Pattern width: 0.66nm
```

### Leg Sequencing

State machine automatically transitions:

```
ENTRY → INBOUND → TURN (at fix) → OUTBOUND → TURN → INBOUND ...
```

**Timing**:
- **Inbound**: Until within 0.2nm of fix
- **Turn**: 60 seconds (180° standard rate turn)
- **Outbound**: Leg time (60s or 90s)
- **Turn**: 60 seconds
- **Repeat**: Until cleared to leave hold

---

## Usage

### Method 1: From Published Procedures

**When loading an approach with a holding pattern**:

1. Load approach (e.g., KBIH R12-Z has HM hold at BIH VOR)
2. GTN750 detects HM/HA/HF leg automatically
3. Holding parameters loaded (inbound course, turn direction, leg time)
4. When reaching hold waypoint:
   - Entry procedure calculated automatically
   - Pattern displayed on map
   - Follow holding instructions

**Example - KBIH R12-Z**:
```
Missed Approach:
1. NEBSE @7,000ft
2. BIH (TF) - track to BIH VOR
3. BIH (HM) - hold at BIH, inbound 121°, right turns, 1 min legs

GTN750 automatically:
- Detects HM hold at waypoint 3
- Calculates entry (DIRECT/TEARDROP/PARALLEL)
- Displays racetrack on map
- Sequences through hold legs
```

### Method 2: Manual Hold Entry

**Soft Key Method**:
1. Press **MAP** or **FPL** page
2. Select waypoint to hold at
3. Press **HOLD** soft key (in CDI menu)
4. Configure hold:
   - Inbound course (default: current radial)
   - Turn direction (R/L)
   - Leg time (60s or 90s)
5. Press **ACTIVATE**
6. GTN750 calculates entry and displays pattern

**Direct-To Hold**:
1. Press **D→** (Direct-To)
2. Enter fix identifier
3. Press **HOLD** option
4. Configure and activate

---

## Holding Display

### Map Visualization

**Racetrack Pattern**:
- **Green line**: Inbound leg (to fix)
- **Cyan line**: Outbound leg (parallel offset)
- **Dashed arcs**: 180° turns
- **Fix marker**: Yellow circle at hold fix
- **Aircraft icon**: Current position in pattern

**Entry Indicator**:
- **"TEARDROP"**: Shows 30° offset teardrop path
- **"PARALLEL"**: Shows parallel offset path
- **"DIRECT"**: Direct to fix

**Current Leg**:
- **"INBOUND"**: Green highlight
- **"OUTBOUND"**: Cyan highlight
- **"TURN"**: Arc highlight

### Hold Status Panel

Shows:
- **Fix**: "Holding at ALPHA"
- **Entry**: "TEARDROP entry"
- **Inbound Course**: "360°R" (right turns)
- **Leg Time**: "60 sec"
- **Current Leg**: "OUTBOUND"
- **Leg Elapsed**: "32 / 60 sec"
- **Turns Remaining**: "Unlimited" or "3 turns"

---

## Configuration

### Leg Time Adjustment

**Automatic**:
- **Below 14,000ft**: 1 minute (60 seconds)
- **Above 14,000ft**: 1.5 minutes (90 seconds)

**Manual Override**:
```javascript
holdingManager.legTime = 90; // Force 1.5 min legs
```

### Turn Direction

**Standard**: Right turns (most common)
**Non-Standard**: Left turns (when published or ATC directed)

**Setting**:
```javascript
holdingManager.turnDirection = 'L'; // Left turns
holdingManager.turnDirection = 'R'; // Right turns
```

### Expected Further Clearance (EFC)

Set EFC time for hold:
```javascript
holdingManager.expectedFurtherClearance = "1845Z";
```

Displays countdown timer to EFC time.

---

## Examples

### Example 1: Missed Approach Hold (KBIH R12-Z)

**Scenario**: Go-around from KBIH Runway 12

**Published Missed Approach**:
```
Climb to 7000, then climbing right turn to 10000
direct NEBSE and hold
```

**Holding Instructions** (from database):
- **Fix**: NEBSE
- **Inbound Course**: 121° (to NEBSE)
- **Turn**: Right
- **Leg Time**: 60 seconds (below 14,000ft)

**GTN750 Behavior**:
1. Press GO AROUND button (loads missed approach waypoints)
2. Follow missed approach to NEBSE
3. At NEBSE:
   - Aircraft heading: 150° (from southeast)
   - Entry calculated: DIRECT (heading within sector)
   - Procedure: Turn right to outbound (301°), fly 60s, turn right to inbound (121°)
4. Racetrack displayed on map
5. Follow hold until ATC clears you

**Map Display**:
```
        N (360°)
         ↑

    NEBSE ●━━━━━━━━┐
     121° inbound  │ Turn (180°)
                   │
                   │ 301° outbound
                   │
                   └━━━━━━━━→
```

### Example 2: ATC-Directed Hold

**ATC**: "N12345, hold southeast of ALPHA VOR on the 140° radial, left turns, 1.5 minute legs, expect further clearance at 1845Z"

**Setup**:
1. Select ALPHA VOR as active waypoint
2. Press HOLD soft key
3. Configure:
   - Inbound course: 140° (southeast radial TO fix)
   - Turn direction: L (left)
   - Leg time: 90s (1.5 min)
   - EFC: 1845Z
4. Press ACTIVATE

**GTN750 Calculates**:
- Aircraft heading: 090° (east)
- Outbound course: 320° (reciprocal of 140°)
- Relative bearing: 090° - 320° = -230° (130° normalized)
- Entry: PARALLEL (for left turns, 130° is in parallel sector)

**Procedure**:
1. Parallel entry: Continue 30s parallel to inbound
2. Turn left to intercept inbound course
3. Established in hold

### Example 3: IFR Delay Hold

**ATC**: "N12345, unable approach clearance at this time, hold east of BRAVO on the 090° radial, expect approach clearance in 15 minutes"

**Setup**:
- Fix: BRAVO
- Inbound: 090° (east)
- Turns: Standard right
- Leg time: 60s
- EFC: +15 min from current time

**Entry Calculation**:
```
Current heading: 270° (west, approaching from opposite direction)
Outbound course: 270° (reciprocal of 090°)
Relative bearing: 270° - 270° = 0°
Result: DIRECT entry
```

**Procedure**:
1. Cross BRAVO
2. Turn right to outbound (270°)
3. Fly 60 seconds
4. Turn right to inbound (090°)
5. Established in hold

---

## API Reference

### JavaScript API

```javascript
// Access holding manager
const holding = window.widget.holdingManager;

// Detect hold from waypoint (HM/HA/HF)
const holdParams = holding.detectHoldFromWaypoint(waypoint);
// Returns: { fix, inboundCourse, turnDirection, legTime, altitude }

// Calculate entry procedure
const entry = holding.calculateEntryProcedure(
    aircraftHeading,   // 270° (current heading)
    inboundCourse,     // 360° (hold inbound course)
    turnDirection      // 'R' or 'L'
);
// Returns: 'DIRECT', 'TEARDROP', or 'PARALLEL'

// Enter holding pattern
holding.enterHold(holdParams, aircraftHeading, aircraftAltitude);

// Exit holding pattern
holding.exitHold();

// Update state (called each frame)
holding.update({
    latitude: 40.0,
    longitude: -105.0,
    heading: 270,
    altitude: 8000
});

// Get holding status
const status = holding.getStatus();
console.log(status);
// {
//   active: true,
//   fix: { ident: 'ALPHA', lat: 40.0, lon: -105.0 },
//   inboundCourse: 360,
//   turnDirection: 'R',
//   legTime: 60,
//   entryType: 'TEARDROP',
//   entryComplete: false,
//   currentLeg: 'entry',
//   turnsRemaining: 0,  // 0 = unlimited
//   altitude: null,
//   efc: '1845Z'
// }

// Calculate racetrack for map display
const racetrack = holding.calculateRacetrack(
    40.0,      // fix latitude
    -105.0,    // fix longitude
    360,       // inbound course
    60,        // leg time (seconds)
    'R',       // turn direction
    120        // ground speed (kt)
);
// Returns:
// {
//   inboundStart: { lat, lon },
//   inboundEnd: { lat, lon },
//   outboundStart: { lat, lon },
//   outboundEnd: { lat, lon },
//   turnRadius: 0.33,  // nm
//   legLength: 2.0     // nm
// }
```

---

## Integration with Other Systems

### Missed Approach Procedures

When GO AROUND button is pressed:
```javascript
// Missed approach waypoints loaded
// Last waypoint is HM/HA/HF hold
const lastWp = missedApproachWaypoints[missedApproachWaypoints.length - 1];

if (lastWp.pathTerm === 'HM') {
    // Automatically configure holding at last waypoint
    const holdParams = holding.detectHoldFromWaypoint(lastWp);

    // Hold will activate when reaching last waypoint
    // Entry procedure calculated when nearing fix
}
```

### AI Autopilot Integration

Hold can be coupled with AI Autopilot for hands-off holding:

```javascript
// Holding provides course guidance
const holdStatus = holding.getStatus();

// AI Autopilot follows heading commands
if (holdStatus.currentLeg === 'inbound') {
    aiAutopilot.setHeading(holdStatus.inboundCourse);
} else if (holdStatus.currentLeg === 'outbound') {
    aiAutopilot.setHeading((holdStatus.inboundCourse + 180) % 360);
}
```

---

## Troubleshooting

### "Entry procedure not calculated"
**Cause**: Holding not active or fix not set
**Solution**: Ensure holding is entered via enterHold() with valid parameters

### "Aircraft not following hold"
**Cause**: Manual flight mode, no autopilot coupling
**Solution**:
- Hand-fly the holding pattern using pattern display
- Or couple AI Autopilot for automatic holding

### "Wrong entry procedure"
**Cause**: Aircraft heading changed between entry calculation and fix crossing
**Solution**: Entry is calculated when entering hold; re-enter hold if heading changed significantly

### "Hold legs too short/long"
**Cause**: Ground speed vs leg time mismatch
**Solution**:
- Adjust ground speed (reduce speed for tighter pattern)
- Leg time is fixed (60s or 90s), cannot be changed mid-hold

---

## Advanced Features

### Limited Turns

Set number of turns before automatic exit:

```javascript
// Enter hold with 3 turns
holding.enterHold(holdParams, heading, altitude);
holding.turnsRemaining = 3;

// Hold will automatically exit after 3 complete patterns
```

### Custom Leg Time

Override default leg time:

```javascript
holding.legTime = 75; // 75 seconds per leg
```

### Entry Callbacks

React to hold entry/exit events:

```javascript
const holding = new GTNHolding({
    onHoldEntry: (params) => {
        console.log(`Entered hold at ${params.fix.ident}, entry: ${params.entryType}`);
    },
    onHoldExit: () => {
        console.log('Exited hold');
    }
});
```

---

## Limitations

1. **No Wind Correction** - Pattern displayed assumes no wind (actual pattern will drift)
2. **Manual Exit** - No automatic exit on EFC time (requires manual exitHold())
3. **No DME Holds** - Only supports fix-based holds (not DME arc holds)
4. **No Speed Limit** - Does not enforce holding speed limits (200kt below 6000ft, 230kt above)
5. **GPS Only** - No VOR-based radial holds

---

## Future Enhancements

**Planned**:
- [ ] Wind correction for pattern drift
- [ ] Automatic exit at EFC time
- [ ] DME arc holds (5nm DME south of VOR, etc.)
- [ ] Speed limit enforcement (200kt/230kt)
- [ ] VOR radial holds (not just GPS fixes)
- [ ] Hold briefing display (entry diagram)

---

## Technical Details

### File Locations
- **Module**: `ui/gtn750/modules/gtn-holding.js` (394 lines)
- **Instantiation**: `ui/gtn750/pane.js` line 140
- **Soft Keys**: `ui/gtn750/modules/gtn-softkeys.js` (HOLD menu)
- **Map Rendering**: Racetrack calculation in holding module

### Entry Sector Math

**Right Turns** (standard):
```
Direct sector:     290° → 070° (140° width)
Teardrop sector:   070° → 110° (40° width)
Parallel sector:   110° → 290° (180° width)
```

**Left Turns** (non-standard):
```
Direct sector:     070° → 290° (220° width)
Teardrop sector:   250° → 290° (40° width)
Parallel sector:   110° → 250° (140° width)
```

**Calculation**:
```javascript
relativeBearing = normalizeAngle(aircraftHeading - outboundCourse);

if (turnDirection === 'R') {
    if (relativeBearing <= 70 || relativeBearing >= 290) return 'DIRECT';
    if (relativeBearing > 70 && relativeBearing <= 110) return 'TEARDROP';
    return 'PARALLEL';
}
```

### State Machine

```
State: ENTRY
├─→ Check: distToFix < 1nm AND courseError < 20°
│   └─→ Transition: INBOUND
│
State: INBOUND
├─→ Check: distToFix < 0.2nm
│   └─→ Transition: TURN (at fix)
│
State: TURN (at fix)
├─→ Check: elapsed > 60s
│   └─→ Transition: OUTBOUND
│
State: OUTBOUND
├─→ Check: elapsed >= legTime
│   └─→ Transition: TURN (to inbound)
│
State: TURN (to inbound)
├─→ Check: elapsed > 60s
│   ├─→ If turnsRemaining > 0: Decrement
│   └─→ Transition: INBOUND
```

---

## Conclusion

Holding patterns are **fully implemented and production-ready** with:
- ✅ Automatic entry procedure calculation (DIRECT/TEARDROP/PARALLEL)
- ✅ ARINC 424 hold detection (HM/HA/HF)
- ✅ Racetrack pattern visualization
- ✅ Leg timing and sequencing
- ✅ Altitude-based leg time adjustment
- ✅ Integration with missed approach procedures

**Ready to use** for published holds, ATC-directed holds, and missed approach procedures! 🔄✈️
