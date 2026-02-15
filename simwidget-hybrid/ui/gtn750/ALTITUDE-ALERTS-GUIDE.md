# GTN750 Altitude Alerts Guide

**Status**: ✅ FULLY IMPLEMENTED
**Version**: GTN750 v3.0+
**Date**: February 14, 2026

## Overview

The GTN750 includes complete altitude alert system for preventing altitude busts and providing situational awareness during IFR operations. Monitors assigned altitude and approach minimums (MDA/DA).

## Features

### ✈️ Altitude Monitoring
- **Assigned Altitude Tracking** - Monitors pilot-set target altitude
- **State Machine** - 7 states from ARMED to CAPTURED to DEVIATION
- **Approach Altitude Warnings** - MDA/DA alerts 100ft before minimums
- **Audio Alerts** - Different chime patterns for each alert level
- **Deviation Detection** - Alerts if >300ft off assigned altitude
- **Visual Indicators** - Color-coded status display

### 📊 Alert States

| State | Deviation | Color | Description |
|-------|-----------|-------|-------------|
| **IDLE** | - | Gray | No assigned altitude |
| **ARMED** | >1,000ft | Cyan | Assigned altitude set, not approaching |
| **APPROACHING** | 200-1,000ft | Yellow | Within 1,000ft of target |
| **PROXIMITY** | 100-200ft | Amber | Very close to target |
| **CAPTURED** | ±100ft | Green | On target altitude |
| **HOLDING** | 100-200ft | Green | Holding near target (minor deviation) |
| **DEVIATION** | >300ft | Red | Significant deviation from assigned |

### 🔔 Alert Levels

| Level | Sound | Pattern | When Triggered |
|-------|-------|---------|----------------|
| **Info** | 440Hz | Single beep | Approaching assigned altitude (1000ft) |
| **Warning** | 660Hz | Single beep | Proximity to target (200ft), approaching MDA/DA |
| **Success** | 880Hz | Triple beep | Altitude captured (within ±100ft) |
| **Critical** | 800Hz | Double beep | Altitude deviation (>300ft off) |

---

## How Altitude Alerts Work

### State Machine Flow

```
IDLE (no assigned altitude)
  ↓ (Set assigned altitude)
ARMED (waiting, >1000ft deviation)
  ↓ (Approaching target)
APPROACHING (200-1000ft deviation)
  ↓ (Very close)
PROXIMITY (100-200ft deviation)
  ↓ (Captured)
CAPTURED (±100ft on target) ← Success chime
  ↓ (Drift off)
HOLDING (100-200ft deviation)
  ↓ (Significant deviation)
DEVIATION (>300ft off) ← Critical alert
```

### Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| **Approach Warning** | 1,000ft | Triggers APPROACHING state |
| **Proximity Warning** | 200ft | Triggers PROXIMITY state |
| **Capture Window** | ±100ft | Altitude captured |
| **Deviation Alert** | 300ft | Significant deviation warning |
| **MDA Warning** | 100ft | Approach minimum warning |

---

## Usage

### Setting Assigned Altitude

**Method 1: Direct Entry**:
1. Press **ALT** soft key on MAP page
2. Enter target altitude (e.g., `8500`)
3. Press **SET**
4. GTN750 enters ARMED state
5. Chime when approaching, proximity, and captured

**Method 2: From ATC Clearance**:
1. Receive ATC clearance: "Climb and maintain 8,500"
2. Press **ALT** soft key
3. Enter `8500`
4. Press **SET**
5. Monitor altitude alerts during climb

**Method 3: From Autopilot**:
- If AI Autopilot sets altitude, GTN750 automatically tracks it
- Alerts work seamlessly with autopilot altitude hold

### Monitoring Assigned Altitude

**During Climb to 8,500ft**:
```
Current: 5,000ft → ARMED (cyan)
Current: 7,600ft → APPROACHING (yellow) + info chime
Current: 8,350ft → PROXIMITY (amber) + warning chime
Current: 8,480ft → CAPTURED (green) + triple success chime
Current: 8,510ft → HOLDING (green, minor drift)
Current: 8,850ft → DEVIATION (red) + double critical chime
```

### Approach Altitude Warnings

**Setting MDA/DA**:
1. Load approach procedure (e.g., KBIH R12-Z)
2. GTN750 automatically sets MDA from procedure (e.g., 7,000ft MSL)
3. During descent on approach:
   - At 7,100ft (100ft above MDA): Warning chime + "Approaching MDA 7,000ft"
   - At MDA: Decision to land or go-around

**MDA vs DA**:
- **MDA** (Minimum Descent Altitude) - Non-precision approach, level off and look for runway
- **DA** (Decision Altitude) - Precision approach (ILS), continue descent to DA then decide

---

## Alert Examples

### Example 1: IFR Climb to Assigned Altitude

**Scenario**: Cleared to climb and maintain 12,000ft from 4,000ft

**Timeline**:
```
T+0s:   Set assigned altitude: 12,000ft
        State: ARMED (cyan)
        No alerts yet

T+120s: Current: 11,000ft (1,000ft below)
        State: APPROACHING (yellow)
        Alert: Info chime + "Approaching 12,000ft"

T+180s: Current: 11,850ft (150ft below)
        State: PROXIMITY (amber)
        Alert: Warning chime + "150ft to assigned"

T+190s: Current: 11,980ft (20ft below)
        State: CAPTURED (green)
        Alert: Triple success chime + "Captured 12,000ft"

T+200s: Current: 12,050ft (50ft above)
        State: HOLDING (green)
        No alert (minor drift acceptable)

T+210s: Current: 12,010ft (10ft above)
        State: CAPTURED (green)
        Back in capture window
```

### Example 2: Altitude Bust Warning

**Scenario**: Assigned 8,000ft, climbing through distracted, altitude bust

**Timeline**:
```
T+0s:   Set assigned: 8,000ft
        State: ARMED

T+60s:  Current: 7,800ft
        State: PROXIMITY
        Alert: Warning chime

T+65s:  Current: 8,020ft
        State: CAPTURED
        Alert: Triple chime

T+75s:  Current: 8,150ft (continuing climb, missed level-off)
        State: HOLDING

T+85s:  Current: 8,400ft (400ft above assigned!)
        State: DEVIATION (red)
        Alert: CRITICAL double chime + "Altitude deviation 400ft"
        Action: Immediately descend back to 8,000ft!

ATC:    "N12345, verify assigned altitude 8,000"
Pilot:  "Descending back to 8,000, N12345"
```

### Example 3: Non-Precision Approach MDA Warning

**Scenario**: RNAV approach to KBIH Runway 12, MDA 7,000ft

**Setup**:
- Load KBIH R12-Z approach
- GTN750 sets MDA: 7,000ft MSL
- Descending from 9,000ft

**Timeline**:
```
Current: 8,500ft
        Descending -500fpm
        No MDA warning yet

Current: 7,200ft
        Still descending
        No warning yet

Current: 7,100ft (100ft above MDA)
        Descending -400fpm
        Alert: Warning chime + "Approaching MDA 7,000ft"
        Pilot: Begin looking for runway environment

Current: 7,000ft (at MDA)
        Decision:
        - Runway in sight? Continue descent to land
        - No runway? Missed approach, climb immediately
```

---

## Display

### Altitude Alert Status Panel

**Location**: Top of GTN750 screen

**Display Elements**:
```
┌─────────────────────────────────┐
│ ALT ALERT: PROXIMITY            │ ← State label
│ Assigned: 8,500 ft              │ ← Target altitude
│ Current:  8,380 ft (-120)       │ ← Current & deviation
│ ━━━━━━━━━━━━━━━━━━━━━━━━━       │ ← Progress bar (amber)
└─────────────────────────────────┘
```

**Color Coding**:
- **Gray**: IDLE (no assigned altitude)
- **Cyan**: ARMED (approaching from far)
- **Yellow**: APPROACHING (within 1,000ft)
- **Amber**: PROXIMITY (within 200ft)
- **Green**: CAPTURED/HOLDING (on target)
- **Red**: DEVIATION (>300ft off)

### Audio Indicators

**Info Chime** (APPROACHING):
- Single beep, 440Hz, 0.1s
- "Approaching assigned altitude"

**Warning Chime** (PROXIMITY, MDA):
- Single beep, 660Hz, 0.2s
- "Very close to target" or "Approaching MDA"

**Success Chime** (CAPTURED):
- Triple beep, 880Hz, 0.15s each
- "Altitude captured"

**Critical Chime** (DEVIATION):
- Double beep, 800Hz, 0.3s each
- "Altitude deviation - return to assigned"

---

## API Reference

### JavaScript API

```javascript
// Access altitude alerts manager
const altAlerts = window.widget.altitudeAlertsManager;

// Set assigned altitude
altAlerts.setAssignedAltitude(8500);
// Sets target altitude to 8,500ft, enters ARMED state

// Set approach altitude (MDA or DA)
altAlerts.setApproachAltitude(7000, 'MDA');
// Sets MDA to 7,000ft, will warn 100ft before

altAlerts.setApproachAltitude(6580, 'DA');
// Sets DA to 6,580ft (decision altitude for ILS)

// Clear approach altitude
altAlerts.clearApproachAltitude();
// Removes MDA/DA monitoring

// Update alerts (called each frame)
altAlerts.update({
    altitude: 8450,
    verticalSpeed: -200
});
// Updates state machine, triggers alerts if needed

// Get current status
const status = altAlerts.getStatus();
console.log(status);
// {
//   assignedAltitude: 8500,
//   state: "PROXIMITY",
//   stateColor: "#ffaa00",
//   stateLabel: "PROXIMITY",
//   approachAltitude: 7000,
//   approachAltitudeType: "MDA"
// }

// Register alert callback
altAlerts.onAlert = (type, message, level) => {
    console.log(`${level.toUpperCase()}: ${message}`);
    // type: 'ALTITUDE_APPROACHING', 'ALTITUDE_PROXIMITY', 'ALTITUDE_CAPTURED',
    //       'ALTITUDE_DEVIATION', 'APPROACH_ALTITUDE'
    // level: 'info', 'warning', 'success', 'critical'
};

// Clean up
altAlerts.destroy();
```

---

## Integration with Other Systems

### AI Autopilot

Altitude alerts work seamlessly with AI Autopilot altitude hold:

```javascript
// AI Autopilot sets altitude to 8,500ft
aiAutopilot.setAltitude(8500);

// GTN750 altitude alerts automatically track
altAlerts.setAssignedAltitude(8500);

// During altitude hold:
// - CAPTURED state when within ±100ft
// - DEVIATION alert if autopilot fails or pilot disconnects
```

### Approach Procedures

Automatic MDA/DA setting from loaded approaches:

```javascript
// Load approach (e.g., KBIH R12-Z)
gtn750.loadApproach(10489);

// GTN750 reads MDA from procedure
const mda = approachData.minimums.mda; // 7000ft

// Automatically set MDA alert
altAlerts.setApproachAltitude(mda, 'MDA');

// Warn 100ft before MDA during descent
```

### Voice Announcements

Integrate with TTS for voice callouts:

```javascript
altAlerts.onAlert = (type, message, level) => {
    if (type === 'ALTITUDE_PROXIMITY') {
        voiceAnnouncer.speak("Two hundred feet to assigned altitude");
    } else if (type === 'ALTITUDE_CAPTURED') {
        voiceAnnouncer.speak("Altitude captured");
    } else if (type === 'ALTITUDE_DEVIATION') {
        voiceAnnouncer.speak("Altitude deviation, return to assigned");
    } else if (type === 'APPROACH_ALTITUDE') {
        voiceAnnouncer.speak(`Approaching ${altAlerts.approachAltitudeType}`);
    }
};
```

---

## Troubleshooting

### "No altitude alerts"
**Cause**: Assigned altitude not set
**Solution**: Press ALT soft key and enter target altitude

### "Alerts triggering too early"
**Cause**: Normal behavior - 1,000ft approach warning is standard
**Solution**: This is intentional for early awareness, ignore if desired

### "Audio chimes not playing"
**Cause**: Browser autoplay policy or audio context not initialized
**Solution**: Click GTN750 screen to activate audio context

### "Deviation alert won't stop"
**Cause**: Aircraft is >300ft off assigned altitude
**Solution**: Return to assigned altitude to clear alert

### "MDA warning not triggering"
**Cause**: MDA not set or approach not loaded
**Solution**: Load approach or manually set MDA via `setApproachAltitude()`

---

## Best Practices

1. **Always Set Assigned Altitude** - Set immediately after ATC clearance
2. **Monitor State Transitions** - Watch for APPROACHING → PROXIMITY → CAPTURED
3. **Respond to Deviation Alerts** - Immediately return to assigned altitude
4. **Use for IFR Operations** - Essential for altitude awareness in IMC
5. **Verify MDA/DA** - Cross-check with approach plate before descent

---

## Limitations

1. **Manual Entry Required** - Must manually enter assigned altitude (no ATC auto-sync)
2. **No Altitude Preselect** - Cannot pre-program multiple altitude changes
3. **Single Assigned Altitude** - Only one target altitude at a time
4. **No Step Descent** - Cannot program step-down fixes
5. **GPS Altitude** - Uses GPS altitude, not pressure altitude from transponder

---

## Advanced Features

### Custom Alert Thresholds

Modify thresholds for different operations:

```javascript
// Tighten capture window for precision flying
altAlerts.THRESHOLDS.CAPTURE_WINDOW = 50; // ±50ft instead of ±100ft

// Extend approach warning for slower aircraft
altAlerts.THRESHOLDS.APPROACH_WARNING = 1500; // 1,500ft instead of 1,000ft

// Earlier MDA warning for turbulence
altAlerts.THRESHOLDS.MDA_WARNING = 200; // 200ft instead of 100ft
```

### Disable Audio Chimes

For quiet operations:

```javascript
// Override playChime to do nothing
altAlerts.playChime = () => {};

// Alerts still trigger, visual-only
```

### Custom Alert Actions

Execute custom code on alerts:

```javascript
altAlerts.onAlert = (type, message, level) => {
    switch (type) {
        case 'ALTITUDE_DEVIATION':
            // Flash warning light
            flashWarningLight();
            // Log to flight recorder
            flightRecorder.logEvent('ALTITUDE_BUST', message);
            break;

        case 'APPROACH_ALTITUDE':
            // Automatically trigger go-around prep
            aiAutopilot.prepareGoAround();
            break;

        case 'ALTITUDE_CAPTURED':
            // Log successful altitude capture
            console.log('Altitude stabilized');
            break;
    }
};
```

---

## Technical Details

### File Locations
- **Module**: `ui/gtn750/modules/gtn-altitude-alerts.js` (388 lines)
- **Instantiation**: `ui/gtn750/pane.js` (if integrated)
- **Audio**: Web Audio API for alert chimes

### State Machine Logic

```javascript
// State transitions (simplified)
updateAssignedAltitudeState(currentAltitude, verticalSpeed) {
    const deviation = currentAltitude - this.assignedAltitude;
    const absDeviation = Math.abs(deviation);

    switch (this.state) {
        case 'ARMED':
            if (absDeviation < 100) this.state = 'CAPTURED';
            else if (absDeviation < 1000) this.state = 'APPROACHING';
            break;

        case 'APPROACHING':
            if (absDeviation < 100) this.state = 'CAPTURED';
            else if (absDeviation < 200) this.state = 'PROXIMITY';
            break;

        case 'CAPTURED':
            if (absDeviation > 100 && absDeviation < 200) this.state = 'HOLDING';
            else if (absDeviation >= 300) this.state = 'DEVIATION';
            break;

        case 'DEVIATION':
            if (absDeviation < 300) this.state = 'HOLDING';
            // Repeat alert every 5s
            break;
    }
}
```

### Altitude History

Maintains 10-sample history for trend detection:

```javascript
this.altitudeHistory.push(currentAltitude);
if (this.altitudeHistory.length > 10) {
    this.altitudeHistory.shift();
}

// Can be used for:
// - Vertical speed calculation
// - Trend prediction
// - Overshoot detection
```

---

## Conclusion

Altitude Alerts is **fully implemented and production-ready** with:
- ✅ Assigned altitude monitoring with 7-state machine
- ✅ Approach altitude warnings (MDA/DA)
- ✅ Audio alerts with different chime patterns
- ✅ Color-coded visual status display
- ✅ Deviation detection (>300ft off assigned)
- ✅ Integration with autopilot and approach procedures

**Ready to use** for preventing altitude busts and enhancing IFR situational awareness! 📏✈️
