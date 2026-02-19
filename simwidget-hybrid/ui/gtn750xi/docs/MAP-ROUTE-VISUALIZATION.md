# GTN750 Map Route Visualization

Complete guide to the flight plan route display on the GTN750 moving map.

## Overview

The GTN750 automatically displays your active flight plan as a visual route overlay on the map page. The route updates in real-time as you fly, with intelligent highlighting of past, current, and future legs.

## Visual Elements

### 1. Route Lines

**Completed Legs** (Where You've Been)
- **Color**: Dimmed purple (`rgba(128, 0, 128, 0.4)`)
- **Style**: Thin solid line (1px)
- **Purpose**: Shows your track history
- **Visibility**: Always shown when waypoints have been passed

**Future Legs** (Where You're Going)
- **Direct Segments**: Magenta solid line (`#ff00ff`, 2px)
- **Airway Segments**: Cyan dashed line (`#00ffff`, 2px, 8px dash / 4px gap)
- **Purpose**: Shows planned route ahead
- **Auto-detection**: Airway vs direct based on waypoint `airway` property

**Active Leg** (Current Navigation)
- **Glow Effect**: 6px magenta glow (`rgba(255, 0, 255, 0.3)`)
- **Core Line**: 3px solid magenta (`#ff00ff`)
- **Purpose**: Clearly highlights the leg you're currently flying
- **Updates**: Automatically when waypoint sequences

### 2. Waypoint Symbols

**Diamond Markers**
- **Size**: 12px diagonal (6px from center to point)
- **Active Waypoint**: Magenta diamond + 10px outer ring
- **Future Waypoints**: Cyan diamonds
- **Passed Waypoints**: Gray diamonds (50% opacity)

**Waypoint Labels**
- **Active**: Bold 11px Consolas, magenta
- **Future**: 10px Consolas, green
- **Passed**: 10px Consolas, gray (hidden at declutter level 2+)
- **Position**: 8px offset to the right of symbol

**Altitude Constraints** (When Present)
- Shown below waypoint label
- Format: `@8000` (at), `+5000` (at or above), `-3000` (at or below), `5000-8000` (between)
- Hidden on passed waypoints
- Hidden at declutter level 1+

### 3. Turn Anticipation Circles

**When Shown**
- Turns greater than 10° between legs
- Groundspeed > 30 knots
- Not hidden by declutter level 2+

**Calculation**
- **Turn Radius**: `(groundspeed²) / 52.5 / 60` nautical miles (assumes 25° bank)
- **Lead Distance**: `radius × tan(turn_angle / 2)`
- **Threshold**: Capped at 2nm maximum

**Appearance**
- **Active Waypoint**: Cyan (`rgba(0, 255, 255, 0.4)`), 2px dashed (4px dash / 4px gap)
- **Future Waypoints**: Dim cyan (`rgba(0, 200, 200, 0.2)`), 1px dashed
- **Purpose**: Shows when to start turning for smooth navigation

### 4. Desired Track (DTK) Line

**When Shown**
- GPS CDI source active
- DTK value available

**Appearance**
- **Color**: Semi-transparent magenta (`rgba(255, 0, 255, 0.5)`)
- **Style**: 1px dashed line (5px dash / 5px gap)
- **Length**: 80% of map width/height
- **Purpose**: Shows ideal track to active waypoint

### 5. Airway Labels

**When Shown**
- Waypoint has `airway` property (e.g., "J75", "V230")
- Not hidden by declutter level 2+

**Position**
- Midpoint of airway segment

**Appearance**
- **Text**: 10px monospace, cyan
- **Background**: Black rectangle with 60% opacity for readability
- **Purpose**: Identifies airway routes

## Declutter Levels

The map automatically hides elements based on declutter setting:

| Level | Hidden Elements |
|-------|----------------|
| **0** (Full Detail) | None - all elements shown |
| **1** (Medium) | Altitude constraints |
| **2** (High) | Turn anticipation circles, airway labels, passed waypoint labels |

Change declutter: Press **MENU** softkey → Map settings

## How It Works

### Automatic Display

1. **Load a flight plan** in the FPL page
2. **Switch to MAP page** - route appears automatically
3. **Route updates** as you fly and waypoints sequence

### Position Caching

For performance, waypoint screen positions are cached and only recalculated when:
- Aircraft moves significantly (>0.01° lat/lon)
- Map range changes
- Map rotation changes

Cache key: `${lat},${lon},${range},${rotation}`

### Data Flow

```
FlightPlanManager.flightPlan
         ↓
GTN750Pane.getRendererState()
         ↓
GTNMapRenderer.renderRoute()
         ↓
Canvas 2D drawing
```

## Troubleshooting

**Route not showing:**
- ✓ Check flight plan is loaded (FPL page shows waypoints)
- ✓ Verify you're on MAP page (not TERRAIN, TRAFFIC, etc.)
- ✓ Ensure waypoints have valid lat/lon coordinates
- ✓ Try declutter level 0 for full visibility

**Route looks wrong:**
- Check waypoint sequence in FPL page
- Verify active waypoint index (should have magenta highlight)
- Ensure aircraft position is valid (lat/lon not 0,0)

**Performance issues:**
- Large flight plans (>50 waypoints) may cause slight lag
- Position cache helps minimize recalculation
- Declutter level 2 reduces draw calls

## Integration with Other Systems

### Waypoint Sequencing
- Route updates automatically when `GTNFlightPlan.sequenceToNextWaypoint()` is called
- Active leg highlight moves to next segment
- Turn anticipation circles update

### AI Autopilot
- Route visible while AI Autopilot flies the plan
- Both systems use same `activeWaypointIndex`
- Synchronized via SafeChannel `waypoint-sequence` events

### VNAV (Vertical Navigation)
- Top of Descent (TOD) marker shown on route when VNAV enabled
- Altitude constraints displayed at waypoints

## Technical Details

### File Location
`ui/gtn750/modules/gtn-map-renderer.js` (lines 799-990)

### Key Methods
- `renderRoute(ctx, cx, cy, w, h, state)` - Main rendering
- `renderWaypoint(ctx, x, y, waypoint, isActive, isCompleted, declutterLevel)` - Symbol drawing
- `latLonToCanvas(lat, lon, ...)` - Coordinate projection (in GTNCore)

### State Requirements
```javascript
{
  flightPlan: {
    waypoints: [
      { lat, lng, ident, airway?, altitude?, altDesc?, ... }
    ]
  },
  activeWaypointIndex: number,
  map: { range, orientation },
  data: { latitude, longitude, heading, groundSpeed }
}
```

### Canvas Layers (Draw Order)
1. Range rings (background)
2. Terrain overlay
3. Fuel range ring
4. Weather overlay
5. Airways (ambient)
6. **Flight plan route** ← This layer
7. TOD marker (VNAV)
8. Holding pattern
9. OBS course line
10. Traffic overlay
11. Aircraft symbol
12. Compass rose
13. Wind vector
14. Bearing pointers

## Examples

### Simple 3-Waypoint Route
```
KSEA → KPDX → KSFO
  |      |      |
Cyan  Magenta  Cyan
```
- KSEA to KPDX: Active leg (magenta, thick)
- KPDX to KSFO: Future leg (magenta, normal)

### Airway Route
```
KDEN → (J75) → DVC → (Direct) → KLAS
  |             |                 |
Cyan         Cyan              Cyan
           (dashed)          (solid)
```
- J75 airway segment: Cyan dashed line
- Direct segment: Magenta solid line

### With Turn Anticipation
```
        ○ WPT2
       /|
      / |
WPT1 ●  | (Turn circle at WPT1)
```
- Circle radius based on speed and turn angle
- Helps pilot anticipate turn start point

## Related Documentation

- [Flight Plan Management](./FLIGHT-PLAN-MANAGEMENT.md)
- [Waypoint Sequencing](./WAYPOINT-SEQUENCING.md)
- [GTN750 Map Controls](./MAP-CONTROLS.md)
- [Navigation Integration](./NAV-INTEGRATION.md)

## Version History

- **v1.0** (Feb 2024) - Initial implementation with modularization
- **v1.1** (Feb 2024) - Added airway differentiation (cyan dashed)
- **v1.2** (Feb 2024) - Turn anticipation circles
- **v1.3** (Feb 2026) - Waypoint sequencing sync with AI Autopilot

---

**Note**: This feature has been fully implemented since the GTN750 modularization. If you're not seeing routes, verify your flight plan is loaded and you're viewing the MAP page.
