# GTN750 VNAV Guide

**Status**: ✅ FULLY IMPLEMENTED
**Version**: GTN750 v3.0+
**Date**: February 14, 2026

## Overview

The GTN750 includes complete VNAV (Vertical Navigation) support for precision vertical guidance during STAR and approach procedures.

## Features

### ✈️ Vertical Navigation
- **TOD Calculation** - Automatic Top of Descent point calculation
- **3° Descent Profile** - Standard glidepath (configurable 1-6°)
- **Altitude Constraints** - Parses AT/A/B restrictions from procedures
- **Vertical Deviation** - Real-time deviation from planned path (±feet)
- **Required VS** - Calculates descent rate needed to meet constraints
- **Auto-Enable** - Automatically activates for approaches with altitude constraints

### 📊 VNAV Modes

| Mode | Description | Indicator |
|------|-------------|-----------|
| **DISABLED** | VNAV system off | No display |
| **ARMED** | Within 2nm of TOD | "VNAV ARMED" |
| **ACTIVE** | Past TOD, descending | "VNAV PATH" |

### 🎯 Altitude Constraint Types

From ARINC 424 standard:

| Type | Symbol | Meaning | Example |
|------|--------|---------|---------|
| **AT** | @ | At specified altitude | @8000 = exactly 8,000ft |
| **A** (At or Above) | + | Minimum altitude | A5000 = 5,000ft or higher |
| **B** (At or Below) | - | Maximum altitude | B10000 = 10,000ft or lower |

---

## How VNAV Works

### TOD (Top of Descent) Calculation

VNAV calculates where to begin descent to meet altitude constraints:

```
Altitude to Lose = Current Altitude - Target Altitude
Descent Distance = Altitude to Lose ÷ Feet per NM

TOD Distance = Distance to Constraint - Descent Distance
```

**Example**:
- Current altitude: 12,000 ft
- Target altitude: 8,000 ft (constraint at 30nm ahead)
- Altitude to lose: 4,000 ft
- Descent rate: 300 ft/nm (3° angle)
- Descent distance: 4,000 ÷ 300 = 13.3 nm
- **TOD: 30nm - 13.3nm = 16.7nm from current position**

### Vertical Deviation

Once past TOD and descending:

```
Planned Altitude = TOD Altitude - (Distance Past TOD × Feet per NM)
Vertical Deviation = Current Altitude - Planned Altitude
```

**Indication**:
- **Positive** (+200ft) = Above planned path (descend faster)
- **Negative** (-150ft) = Below planned path (reduce descent)
- **±100ft** = On path (green)

---

## Usage

### Enabling VNAV

**Method 1: Soft Key**
1. Press **MAP** or **FPL** page button
2. Press **VNAV** soft key (bottom row)
3. VNAV indicator shows "VNAV ARMED" or "VNAV PATH"

**Method 2: Auto-Enable**
- VNAV automatically enables when loading an approach with altitude constraints
- No manual activation needed

### Using VNAV with Approaches

**Prerequisites**:
1. Load a STAR or Approach procedure with altitude constraints
2. Ensure current altitude is above first constraint
3. Enable VNAV (or rely on auto-enable)

**Workflow**:
1. Load approach (e.g., KBIH R12-Z)
2. VNAV auto-enables and calculates TOD
3. Fly at cruise altitude until TOD marker
4. At TOD, begin descent following vertical deviation indicator
5. VNAV guides descent to meet all altitude constraints

**Example - KBIH Runway 12 Approach**:
```
Current: 12,000 ft
Constraint 1: HEGIT @10,000 ft (25nm ahead)
Constraint 2: TEVOC @8,000 ft (15nm ahead)
Constraint 3: NEBSE @7,000 ft (5nm ahead)

VNAV calculates:
- TOD: 18nm from current position
- Required VS: -500 fpm (at 120kt GS)
- Vertical Deviation: +50 ft (slightly high, increase descent)
```

### Reading VNAV Display

**CDI Area**:
- **VNAV Indicator**: Shows "VNAV PATH" when active
- **Vertical Deviation**: "+200" = 200ft above path
- **Required VS**: "-650" = need 650fpm descent rate

**Map**:
- **TOD Marker**: Cyan "TOD" label at calculated descent point
- **Magenta Line**: Flight plan route
- **Yellow Constraint**: Waypoints with altitude restrictions

---

## Configuration

### Descent Angle

Default: **3.0°** (standard ILS glideslope)

Adjustable range: **1° - 6°**

**Common Angles**:
- **3°** - Standard ILS glideslope, comfortable descent
- **2.5°** - Shallow, for noise abatement
- **4°** - Steeper, for obstacle clearance
- **6°** - Maximum, emergency/short field

**Feet per NM at Different Angles**:
| Angle | Feet per NM | Example (1000ft drop) |
|-------|-------------|-----------------------|
| 2.5° | 260 ft/nm | 3.8 nm descent |
| 3.0° | 300 ft/nm | 3.3 nm descent |
| 4.0° | 400 ft/nm | 2.5 nm descent |
| 6.0° | 600 ft/nm | 1.7 nm descent |

---

## API Reference

### JavaScript API

```javascript
// Access VNAV manager
const vnav = window.widget.vnavManager;

// Enable/Disable VNAV
vnav.setEnabled(true);
vnav.setEnabled(false);

// Set descent angle (degrees)
vnav.setDescentAngle(3.5);  // 3.5° angle

// Calculate VNAV path
vnav.calculate(flightPlan, currentPosition, groundSpeed);

// Get VNAV status
const status = vnav.getStatus();
console.log(status);
// {
//   enabled: true,
//   armed: false,
//   active: true,
//   todDistance: 16.7,  // nm
//   verticalDeviation: 150,  // feet (+above, -below)
//   targetAltitude: 9500,  // feet
//   requiredVS: -650,  // fpm
//   nextConstraint: {
//     ident: "HEGIT",
//     altitude: 10000,
//     constraint: "@"
//   },
//   descentAngle: 3.0,
//   feetPerNm: 300
// }

// Get TOD position for map rendering
const todPos = vnav.getTODPosition(flightPlan.waypoints);
// { lat: 40.123, lon: -105.456, waypointIndex: 3, distance: 5.2 }

// Find next altitude constraint
const constraint = vnav.findNextConstraint(waypoints, activeWaypointIndex);
// { waypointIndex: 5, waypointIdent: "HEGIT", altitude: 10000, type: "@", distance: 25.0 }
```

---

## Examples

### Example 1: KBIH Runway 12 Approach

**Approach**: ILS or LOC RWY 12 (R12-Z)
**Procedure ID**: 10489

**Altitude Constraints**:
1. **HEGIT**: @10,000 ft
2. **TEVOC**: @8,000 ft
3. **NEBSE**: @7,000 ft (missed approach initial fix)

**Flight**:
```
Start: 12,000 ft cruise, 30nm from HEGIT
VNAV calculates:
  - TOD: 23.3nm from current position (6.7nm before HEGIT)
  - Descent distance: 6.7nm
  - Required VS at 120kt: -600 fpm

At TOD (23.3nm from start):
  - Begin descent, VNAV shows "VNAV PATH"
  - Target altitude: 12,000ft → 10,000ft over 6.7nm
  - Vertical deviation: ±100ft = on path

At HEGIT (17nm from start):
  - Current altitude: 10,000ft (on constraint)
  - VNAV recalculates for next constraint (TEVOC @8,000ft)
  - New TOD: immediate (already descending)
  - Vertical deviation: 0ft (perfect)

At TEVOC (7nm from start):
  - Current altitude: 8,000ft
  - Continue descent to NEBSE @7,000ft

Final Approach:
  - Capture glideslope at NEBSE
  - VNAV hands off to APR mode
```

### Example 2: KDEN STAR with Multiple Constraints

**STAR**: ROCKIES FIVE ARRIVAL
**Constraints**:
1. **@FL240** (24,000 ft)
2. **@16,000 ft**
3. **@11,000 ft**
4. **@8,000 ft** (at IAF)

**VNAV Behavior**:
- Calculates step-down descent profile
- Shows TOD for first constraint
- Recalculates after each constraint
- Provides continuous vertical guidance
- Integrates with autopilot (if coupled)

---

## Integration with Other Systems

### AI Autopilot

VNAV can be coupled with the AI Autopilot pane for full automation:

```javascript
// VNAV provides vertical guidance
const vnavStatus = window.widget.vnavManager.getStatus();

// AI Autopilot follows VNAV descent rate
aiAutopilot.setVerticalSpeed(vnavStatus.requiredVS);
```

**Benefits**:
- Hands-off descent management
- Automatic constraint compliance
- Smooth altitude transitions

### CDI Integration

VNAV vertical deviation displayed alongside CDI:

- **Lateral**: CDI shows cross-track error
- **Vertical**: VNAV shows altitude error
- **Combined**: Full 3D navigation guidance

---

## Troubleshooting

### "No VNAV available"
**Cause**: No altitude constraints in flight plan
**Solution**: Load a STAR or Approach with altitude restrictions

### "TOD already passed"
**Cause**: Aircraft is below TOD point
**Solution**:
- Level off or climb back to cruise altitude
- Reload approach to recalculate TOD
- VNAV will still provide vertical deviation guidance

### "Vertical deviation too large"
**Cause**: Off planned descent path by >500ft
**Solution**:
- Adjust descent rate to meet required VS
- If too high: increase descent rate
- If too low: reduce descent rate or level off

### "VNAV not auto-enabling"
**Cause**: Approach has no altitude constraints in database
**Solution**: Manually enable VNAV via soft key

---

## Advanced Features

### Custom Descent Angles

For special situations:

```javascript
// Noise abatement (shallow descent)
vnav.setDescentAngle(2.5);

// Obstacle clearance (steep descent)
vnav.setDescentAngle(5.0);

// Restore default
vnav.setDescentAngle(3.0);
```

### Manual TOD Override

If you want to start descent earlier or later:

```javascript
// Disable VNAV
vnav.setEnabled(false);

// Fly manually to desired point

// Re-enable VNAV
vnav.setEnabled(true);
// Recalculates from current position
```

---

## Limitations

1. **GPS Waypoints Only** - No VOR/NDB-based vertical navigation
2. **No RNAV LP/LPV** - Cannot fly RNP approaches with RF legs
3. **Single Constraint** - Calculates TOD to next constraint only (not full profile)
4. **No Autothrottle** - Manual speed management required
5. **No Step Climbs** - Descent only, not for climb constraints

---

## Future Enhancements

**Planned**:
- [ ] Multi-constraint path preview (full vertical profile)
- [ ] Autothrottle integration for speed management
- [ ] VNAV climb mode for departure constraints
- [ ] RNP approach support (RF legs)
- [ ] Temperature compensation for non-standard atmosphere
- [ ] Wind-corrected descent planning

---

## Testing

Run comprehensive VNAV test:

```javascript
// In browser console at http://192.168.1.42:8080/ui/gtn750/

new VNAVValidationTest().runAll()
```

**Test Coverage**:
- TOD calculation accuracy
- Altitude constraint parsing
- Vertical deviation monitoring
- Required VS calculation
- Mode transitions (ARMED → ACTIVE)
- Integration with real approach procedures

---

## Technical Details

### File Locations
- **Module**: `ui/gtn750/modules/gtn-vnav.js` (360 lines)
- **Instantiation**: `ui/gtn750/pane.js` line 139
- **Soft Keys**: `ui/gtn750/modules/gtn-softkeys.js` (VNAV toggle)
- **Map Rendering**: `ui/gtn750/modules/gtn-map-renderer.js` (TOD marker)

### Data Pipeline
1. **CIFP Database** → Altitude constraints (alt_desc, alt1, alt2)
2. **Backend API** → Parses constraints from procedures
3. **VNAV Module** → Calculates TOD and vertical path
4. **Map Renderer** → Draws TOD marker and route
5. **CDI Display** → Shows vertical deviation

### Math

**Descent Gradient**:
```
tan(angle) = opposite / adjacent
tan(3°) = altitude change / horizontal distance

Feet per NM = tan(3°) × 6076 ft/nm
           = 0.0524 × 6076
           = 318 ft/nm (rounded to 300)
```

**TOD Distance**:
```
TOD = Distance to Constraint - (Altitude to Lose / Feet per NM)
```

**Vertical Deviation**:
```
Planned Alt = TOD Alt - (Distance Past TOD × Feet per NM)
Deviation = Current Alt - Planned Alt
```

---

## Conclusion

VNAV is **fully implemented and production-ready** with:
- ✅ Automatic TOD calculation from CIFP altitude constraints
- ✅ 3° descent profile (configurable)
- ✅ Real-time vertical deviation monitoring
- ✅ Required VS calculation
- ✅ Auto-enable for approaches
- ✅ Map visualization with TOD marker

**Ready to use** for precision vertical navigation on STAR and approach procedures!

---

**Happy flying with VNAV!** ✈️📐
