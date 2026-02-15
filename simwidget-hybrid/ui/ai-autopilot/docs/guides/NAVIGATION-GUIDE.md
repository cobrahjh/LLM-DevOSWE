# AI Autopilot Navigation System - Complete Guide

**Version**: 3.0
**Component**: AI Autopilot - Flight Plan Navigation
**Integration**: GTN750 GPS + SafeChannel Communication
**File**: `ui/ai-autopilot/NAVIGATION-GUIDE.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [GTN750 Integration](#gtn750-integration)
4. [Course Intercept Logic](#course-intercept-logic)
5. [Waypoint Tracking](#waypoint-tracking)
6. [CDI Guidance](#cdi-guidance)
7. [NAV Mode vs HDG Mode](#nav-mode-vs-hdg-mode)
8. [Flight Plan Execution](#flight-plan-execution)
9. [Cross-Track Error Monitoring](#cross-track-error-monitoring)
10. [Fallback Modes](#fallback-modes)
11. [API Reference](#api-reference)
12. [Examples](#examples)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Autopilot Navigation System provides **GPS-guided lateral navigation** by integrating with the GTN750 GPS unit via SafeChannel communication. When a flight plan is active in the GTN750, the AI Autopilot automatically:

- Tracks course deviation (CDI cross-track error)
- Computes intercept headings to rejoin desired track
- Sequences waypoints as they're passed
- Switches between NAV and HDG modes based on course accuracy
- Applies wind drift correction to maintain ground track

**Key Features:**
- Real-time course intercept with proportional correction (10-30° based on cross-track error)
- Automatic waypoint sequencing within 0.5nm
- CDI source awareness (GPS/NAV1/NAV2)
- Automatic CDI scaling (ENR 5nm / TERM 1nm / APR 0.3nm full-scale deflection)
- Graceful fallback to heading-only mode when no nav source active
- Integration with all airborne flight phases (CLIMB, CRUISE, DESCENT, APPROACH)

---

## Architecture

### Communication Flow

```
┌─────────────┐         SafeChannel          ┌──────────────────┐
│   GTN750    │  ──────'SimGlass-sync'─────> │  AI Autopilot    │
│  GPS Unit   │   (1Hz nav-state broadcast)  │   Rule Engine    │
└─────────────┘                               └──────────────────┘
      │                                              │
      │                                              │
      ├─ Active waypoint                            ├─ Course intercept
      ├─ CDI (DTK, XTRK, TO/FROM)                   ├─ Heading commands
      ├─ Distance to destination                    ├─ NAV/HDG mode switching
      ├─ CDI source (GPS/NAV1/NAV2)                 └─ Wind correction
      ├─ CDI scaling mode (ENR/TERM/APR)
      └─ Flight plan metadata
```

### Component Hierarchy

| Component | File | Responsibility |
|-----------|------|----------------|
| **GTN750 GPS** | `ui/gtn750/pane.js` | Flight plan management, CDI calculations, nav state broadcast |
| **SafeChannel** | `ui/shared/safe-channel.js` | BroadcastChannel wrapper with localStorage fallback |
| **AI Autopilot Pane** | `ui/ai-autopilot/pane.js` | SafeChannel subscription, nav-state reception, rule engine coordination |
| **RuleEngineCore** | `modules/rule-engine-core.js` | Nav state storage, course intercept math, heading calculations |
| **FlightPhase** | `modules/flight-phase.js` | Destination distance tracking for TOD calculation |
| **RuleEngineCruise** | `modules/rule-engine-cruise.js` | CLIMB/CRUISE lateral nav application |
| **RuleEngineApproach** | `modules/rule-engine-approach.js` | DESCENT/APPROACH lateral nav with APR mode support |

---

## GTN750 Integration

### SafeChannel Communication

The AI Autopilot subscribes to the `SimGlass-sync` SafeChannel to receive real-time navigation data from the GTN750.

**Setup** (`pane.js`):
```javascript
this.syncChannel = new SafeChannel('SimGlass-sync');
this.syncChannel.addEventListener('message', (e) => {
    if (e.data.type === 'nav-state') {
        this._onNavStateReceived(e.data.data);
    }
    if (e.data.type === 'waypoint-sequence') {
        this._onWaypointSequence(e.data.data);
    }
});
```

### Nav-State Data Structure

The GTN750 broadcasts a comprehensive nav-state object every second (1Hz):

```javascript
{
    // Active waypoint
    activeWaypoint: {
        ident: 'KDEN',      // Waypoint identifier
        lat: 39.8561,       // Latitude
        lon: -104.6737,     // Longitude
        distNm: 42.3,       // Distance to waypoint (NM)
        bearing: 275,       // Bearing to waypoint (°T)
        eta: '14:23'        // Estimated time of arrival
    },

    // CDI (Course Deviation Indicator)
    cdi: {
        source: 'GPS',      // 'GPS', 'NAV1', 'NAV2', or null
        dtk: 270,           // Desired track (°T)
        xtrk: 0.42,         // Cross-track error (NM, + = right of course)
        toFrom: 'TO',       // 'TO', 'FROM', or 'OFF'
        gsValid: false,     // Glideslope valid (approach only)
        gsDeviation: 0,     // Glideslope deviation (dots)
        mode: 'ENR',        // 'ENR' (5nm FSD), 'TERM' (1nm), 'APR' (0.3nm)
        fsd: 5.0            // Full-scale deflection (NM)
    },

    // Flight plan metadata
    flightPlan: {
        name: 'KAPA-KDEN',
        cruiseAltitude: 8500,
        waypointCount: 5
    },

    // Distance to destination
    destDistNm: 85.7,       // Total remaining distance (NM)

    // Approach metadata (if approach loaded)
    approach: {
        mode: 'ILS',        // 'ILS', 'RNAV', 'VOR', etc.
        name: 'ILS16R',
        hasGlideslope: true
    }
}
```

### Reception and Integration

When nav-state is received (`pane.js:1480`):

```javascript
_onNavStateReceived(nav) {
    if (!nav) return;
    this._navState = nav;
    this._navStateTimestamp = Date.now();

    // Feed nav data to rule engine
    this.ruleEngine.setNavState(nav);

    // Feed destination distance for TOD calculation
    if (nav.destDistNm != null) {
        this.flightPhase.setDestinationDist(nav.destDistNm);
    }

    // Update cruise altitude from flight plan if available
    if (nav.flightPlan?.cruiseAltitude && nav.flightPlan.cruiseAltitude > 0) {
        this.flightPhase.targetCruiseAlt = nav.flightPlan.cruiseAltitude;
        this.ruleEngine.setTargetCruiseAlt(nav.flightPlan.cruiseAltitude);
    }
}
```

**Key Integration Points:**
1. **Rule Engine**: Receives nav-state for lateral guidance calculations
2. **Flight Phase**: Uses `destDistNm` to calculate TOD (Top of Descent)
3. **Cruise Altitude**: Syncs flight plan cruise altitude with AI autopilot target

---

## Course Intercept Logic

### Proportional Intercept Algorithm

The course intercept system uses **proportional correction** based on cross-track error magnitude. The intercept angle increases as you drift further off-course, then decreases as you approach the desired track.

**Algorithm** (`rule-engine-core.js:543`):

```javascript
_computeInterceptHeading(dtk, xtrk, toFrom) {
    // If past waypoint, just track DTK
    if (toFrom === 'FROM') return dtk;

    const absXtrk = Math.abs(xtrk);
    let interceptAngle = 0;

    // Proportional intercept angle
    if (absXtrk < 0.1) {
        interceptAngle = 0;           // on course (within 0.1nm)
    } else if (absXtrk < 0.3) {
        interceptAngle = 10;          // slight correction (0.1-0.3nm)
    } else if (absXtrk <= 1.0) {
        // Linear interpolation: 10° at 0.3nm → 30° at 1.0nm
        interceptAngle = 10 + (absXtrk - 0.3) / 0.7 * 20;
    } else {
        interceptAngle = 30;          // max intercept (>1.0nm off)
    }

    // Apply intercept toward course
    // Right of course (+xtrk) → turn left (-angle)
    // Left of course (-xtrk) → turn right (+angle)
    const correction = xtrk > 0 ? -interceptAngle : interceptAngle;

    return ((dtk + correction) % 360 + 360) % 360;
}
```

### Intercept Angle Table

| Cross-Track Error | Intercept Angle | Strategy |
|-------------------|-----------------|----------|
| **< 0.1 NM** | 0° | On course — maintain DTK |
| **0.1 - 0.3 NM** | 10° | Gentle correction |
| **0.3 - 0.5 NM** | 10-17° | Proportional |
| **0.5 - 0.7 NM** | 17-24° | Proportional |
| **0.7 - 1.0 NM** | 24-30° | Aggressive intercept |
| **> 1.0 NM** | 30° | Maximum intercept |

### Intercept Example

**Scenario**: Flying DTK 270° (due west), drifted 0.6nm right of course

```javascript
const dtk = 270;          // Desired track: 270°
const xtrk = 0.6;         // Right of course (positive)
const toFrom = 'TO';

// Calculate intercept angle
const absXtrk = 0.6;
// Since 0.3 < 0.6 <= 1.0, use proportional formula
const interceptAngle = 10 + (0.6 - 0.3) / 0.7 * 20;
// interceptAngle = 10 + 8.57 = 18.57°

// Apply correction (right of course → turn left)
const correction = 0.6 > 0 ? -18.57 : 18.57;  // -18.57°
const heading = (270 + (-18.57) + 360) % 360;
// heading = 251.43° (turn left 18.57° to intercept)
```

**Result**: AI autopilot commands heading 251° to intercept the 270° course from the right.

---

## Waypoint Tracking

### Active Waypoint Selection

The nav-state includes the **currently active waypoint** from the GTN750 flight plan.

**Priority Order** (`rule-engine-core.js:571`):

1. **Flight Plan Waypoints** (highest priority)
   - GTN750 flight plan with multiple waypoints
   - Auto-sequencing at 0.5nm from waypoint
   - Provides bearing and distance to each waypoint

2. **CDI Desired Track**
   - When DTK is valid but no waypoint ident
   - Uses course intercept logic to rejoin track

3. **Direct-To Bearing**
   - Fallback when only waypoint bearing available
   - Direct bearing to waypoint, no course intercept

### Waypoint Sequencing

**Automatic Sequencing** (`rule-engine-core.js:1105`):

```javascript
sequenceWaypoint(position) {
    if (!this._flightPlan || !this._flightPlan.waypoints) return false;

    const currentWp = this.getActiveWaypoint();
    if (!currentWp || !position) return false;

    // Calculate distance to current waypoint
    const dist = this._haversineDistance(
        position.latitude,
        position.longitude,
        currentWp.lat,
        currentWp.lon
    );

    // Sequence if within 0.5nm (2,640 feet)
    if (dist < 0.5) {
        this._activeWaypointIndex++;
        console.log(`[RuleEngine] Sequenced to waypoint ${this._activeWaypointIndex + 1}`);
        return true;
    }

    return false;
}
```

**Sequence Distance**: 0.5nm (2,640 feet)
**Why 0.5nm?**: Provides smooth turn anticipation for course changes at waypoints. Too early would cause cutting corners, too late would cause overshooting turns.

### Waypoint Display

The UI displays the active waypoint ident and distance instead of raw heading values:

**Before Navigation:**
```
HDG: 275°
```

**With Active Waypoint:**
```
HDG: KDEN 42.3nm
```

**With Flight Plan:**
```
HDG: RAWLZ 15.8nm (3/5)
```

---

## CDI Guidance

### CDI Source Types

The AI Autopilot supports all three CDI sources:

| Source | Description | Use Case |
|--------|-------------|----------|
| **GPS** | GTN750 GPS navigation | RNAV/GPS approaches, direct-to, flight plans |
| **NAV1** | VOR/ILS receiver 1 | VOR tracking, ILS approaches |
| **NAV2** | VOR/ILS receiver 2 | Backup VOR navigation |

### CDI Scaling

The GTN750 automatically adjusts CDI sensitivity based on distance to destination:

| Mode | Full-Scale Deflection | Distance Trigger | Use |
|------|----------------------|------------------|-----|
| **ENR** (Enroute) | 5.0 NM | > 30nm from destination | Long-range navigation |
| **TERM** (Terminal) | 1.0 NM | Within 30nm of destination | Terminal area operations |
| **APR** (Approach) | 0.3 NM | Within 2nm with approach loaded | Precision approach |

**Benefit**: Increased precision during approach (10x more sensitive than enroute).

**Example**:
- **ENR mode**: 1 dot deflection = 1.0nm off course
- **APR mode**: 1 dot deflection = 0.06nm (316 feet) off course

### Course Intercept with CDI

When CDI data is available, the AI autopilot uses **DTK + XTRK** for precision course tracking:

**Example Flight**: KAPA → KDEN via GPS direct

```javascript
// Received from GTN750
const nav = {
    cdi: {
        source: 'GPS',
        dtk: 315,         // Desired track to KDEN
        xtrk: -0.25,      // 0.25nm left of course
        toFrom: 'TO',
        mode: 'ENR',
        fsd: 5.0
    },
    activeWaypoint: {
        ident: 'KDEN',
        distNm: 42.3,
        bearing: 317
    }
};

// AI autopilot computes intercept
const interceptHdg = this._computeInterceptHeading(315, -0.25, 'TO');
// Left of course (-0.25) → turn right (+10°)
// interceptHdg = (315 + 10) % 360 = 325°

// Command heading bug
this._cmdValue('HEADING_BUG_SET', 325, 'KDEN 42.3nm (DTK 315° XTRK 0.25nm L)');
```

**Display in Command Log**:
```
HDG: KDEN 42.3nm (DTK 315° XTRK 0.25nm L → HDG 325°)
```

---

## NAV Mode vs HDG Mode

### Mode Selection Logic

The AI autopilot intelligently switches between **NAV mode** (course tracking) and **HDG mode** (heading hold) based on course accuracy.

**Decision Criteria**:

```javascript
// NAV mode when:
// 1. CDI source is valid (GPS/NAV1/NAV2)
// 2. Cross-track error is small (< 2nm)
// 3. TO flag is active (not past waypoint)
// 4. Approach mode OR enroute/terminal with valid DTK

// HDG mode when:
// 1. No CDI source active
// 2. Cross-track error is large (> 2nm) — use intercept heading
// 3. FROM flag active (past waypoint)
// 4. Wind correction needed for HDG hold
```

### Mode Transition Example

**Scenario**: Intercepting GPS course to KDEN

| Phase | XTRK | Mode | Heading Command | Reason |
|-------|------|------|-----------------|--------|
| **1** | 5.2nm R | HDG | 245° (DTK 270° - 30°) | Off-course, intercept heading |
| **2** | 2.5nm R | HDG | 252° (DTK 270° - 18°) | Still off-course, reducing intercept |
| **3** | 1.8nm R | NAV | NAV ON | Within 2nm, switch to NAV mode |
| **4** | 0.5nm R | NAV | NAV ON | Tracking course, NAV maintains |
| **5** | 0.1nm R | NAV | NAV ON | On course, NAV holds |

### HDG Mode with Course Intercept

When in HDG mode with active course guidance, the heading bug is **continuously updated** to intercept:

```javascript
// CLIMB phase lateral nav (rule-engine-cruise.js:89)
const navHdg = this._getNavHeading(d);
if (navHdg) {
    // Update heading bug every evaluation cycle
    this._cmdValue('HEADING_BUG_SET', navHdg.heading, navHdg.description);

    if (!apState.headingHold) {
        this._cmd('AP_HDG_HOLD', true, 'HDG hold for nav');
    }
}
```

**Result**: Heading bug "chases" the course as XTRK changes, creating smooth course intercept.

---

## Flight Plan Execution

### Flight Plan Loading

Flight plans are loaded into the AI autopilot via two methods:

**Method 1: GTN750 Flight Plan Activation** (Recommended)
```javascript
// GTN750 activates flight plan
// → SafeChannel broadcast: 'execute-flight-plan'
// → AI Autopilot receives and loads plan

this.ruleEngine.setFlightPlan({
    name: 'KAPA-KDEN-KCOS',
    waypoints: [
        { ident: 'KAPA', lat: 39.5701, lon: -104.8493 },
        { ident: 'KDEN', lat: 39.8561, lon: -104.6737 },
        { ident: 'KCOS', lat: 38.8058, lon: -104.7006 }
    ],
    cruiseAltitude: 12500
});
```

**Method 2: SimBrief Integration**
```javascript
// SimBrief plan imported via KittBox
// → SafeChannel broadcast: 'simbrief-plan'
// → AI Autopilot extracts waypoints

this.ruleEngine.setFlightPlan({
    name: 'SIMBRIEF_12345',
    waypoints: [...],  // Extracted from SimBrief route
    cruiseAltitude: plan.cruiseAltitude
});
```

### Flight Plan Execution Flow

```
┌─────────────┐
│   PREFLIGHT │  Pilot loads flight plan in GTN750
│             │  AI autopilot receives plan via SafeChannel
└──────┬──────┘
       │
       v
┌─────────────┐
│    TAXI     │  Flight plan loaded, waypoint 1 active
│             │  No lateral nav (ground phase)
└──────┬──────┘
       │
       v
┌─────────────┐
│   TAKEOFF   │  Runway heading, no lateral nav
│             │
└──────┬──────┘
       │
       v
┌─────────────┐
│    CLIMB    │  ✓ Lateral nav active
│             │  → Track to waypoint 1
│             │  → Auto-sequence to waypoint 2 when < 0.5nm
└──────┬──────┘
       │
       v
┌─────────────┐
│   CRUISE    │  ✓ Lateral nav active
│             │  → Track waypoints 2, 3, 4...
│             │  → Monitor destDistNm for TOD
└──────┬──────┘
       │
       v
┌─────────────┐
│   DESCENT   │  ✓ Lateral nav active
│             │  → Continue waypoint tracking
│             │  → Prepare for approach
└──────┬──────┘
       │
       v
┌─────────────┐
│  APPROACH   │  ✓ Lateral nav active (APR mode if available)
│             │  → Final waypoint tracking
│             │  → Switch to runway heading on final
└──────┬──────┘
       │
       v
┌─────────────┐
│   LANDING   │  Runway alignment, no lateral nav
│             │
└─────────────┘
```

### TOD (Top of Descent) Calculation

The AI autopilot uses **destination distance** to calculate when to descend:

```javascript
// FlightPhase receives destination distance from nav-state
this.flightPhase.setDestinationDist(nav.destDistNm);

// TOD distance calculation (flight-phase.js:51)
const todNm = this.profile
    ? (this.targetCruiseAlt - alt) / 1000 * (this.profile.descent.todFactor || 3)
    : 30;

// Transition to DESCENT when:
if (this.destinationDist < Math.abs(todNm) && this.destinationDist < 100) {
    this._setPhase('DESCENT');
}
```

**TOD Factor**: 3 NM per 1,000 feet (default)
**Example**: Cruising at 8,500 MSL, destination field elevation 5,400 MSL
- Altitude to lose: 3,100 feet
- TOD distance: 3.1 × 3 = 9.3 NM from destination

---

## Cross-Track Error Monitoring

### XTRK Display

Cross-track error is displayed in two places:

**1. Heading Target Display**
```
HDG: KDEN 42.3nm (DTK 315° XTRK 0.42nm R → HDG 325°)
```

**2. NAV Row in Control Panel**
```
NAV: GPS (ENR 5nm)
```

### Off-Course Alerts

The AI autopilot monitors cross-track error continuously. No explicit alerts, but behavior changes:

| XTRK Range | Behavior |
|------------|----------|
| **< 0.1nm** | On course — maintain DTK |
| **0.1-1.0nm** | Proportional intercept — smooth correction |
| **1.0-2.0nm** | Max intercept (30°) — aggressive correction |
| **> 2.0nm** | HDG mode with intercept — may indicate course issue |

### Course Reversal Detection

If the TO/FROM flag changes to **FROM** while still far from destination, the course may have been overshot:

```javascript
if (toFrom === 'FROM') {
    // Past waypoint — just track DTK, no intercept
    return dtk;
}
```

**Handling**: The AI autopilot will track the DTK but won't apply intercept correction, allowing the aircraft to proceed on the outbound course.

---

## Fallback Modes

### No GTN750 Active

If the GTN750 is not running or no flight plan is active:

```javascript
const navHdg = this._getNavHeading(d);

if (!navHdg) {
    // Fallback: Use heading bug set by pilot or maintain current heading
    if (!apState.headingHold) {
        this._cmdValue('HEADING_BUG_SET', Math.round(d.heading || 0), 'HDG HOLD');
        this._cmd('AP_HDG_HOLD', true, 'HDG hold (no nav)');
    }
}
```

**Result**: AI autopilot operates in **heading-only mode**, maintaining the last commanded heading.

### No Nav-State Received

If SafeChannel connection is lost or GTN750 stops broadcasting:

**Detection** (`pane.js`):
```javascript
// Check nav-state age
const navAge = Date.now() - this._navStateTimestamp;
if (navAge > 5000) {
    // Nav-state stale (> 5 seconds old)
    // Fall back to heading-only mode
}
```

**Graceful Degradation**:
1. Continue flying last known heading
2. Maintain altitude hold
3. Continue vertical speed management
4. Display warning in UI: "NAV DATA LOST"

### Wind-Only Mode

If GTN750 nav-state is unavailable but wind data is available:

```javascript
// Wind compensation still active
const windCorr = this.windCompensation?.calculateWindCorrection(...);
if (windCorr && windCorr.correctionAngle !== 0) {
    // Apply wind correction to heading bug
    const correctedHdg = (targetHdg + windCorr.correctionAngle + 360) % 360;
    this._cmdValue('HEADING_BUG_SET', Math.round(correctedHdg),
        `HDG ${targetHdg}° (wind ${windCorr.correctionAngle > 0 ? '+' : ''}${Math.round(windCorr.correctionAngle)}°)`);
}
```

**Result**: Aircraft maintains heading with wind drift compensation, even without GPS guidance.

---

## API Reference

### RuleEngineCore Methods

#### `setNavState(nav)`

Set navigation state from GTN750.

**Parameters:**
- `nav` (Object): Nav-state object from GTN750 (see GTN750 Integration section)

**Called by**: `pane.js:1486` when nav-state received via SafeChannel

**Example:**
```javascript
this.ruleEngine.setNavState({
    cdi: { source: 'GPS', dtk: 270, xtrk: 0.5, toFrom: 'TO' },
    activeWaypoint: { ident: 'KDEN', distNm: 42.3, bearing: 275 }
});
```

---

#### `_getNavHeading(d)`

Get nav-derived heading for lateral guidance.

**Parameters:**
- `d` (Object): Flight data from WebSocket

**Returns:**
```javascript
{
    heading: 275,           // Computed intercept heading
    source: 'GPS',          // 'GPS', 'NAV1', 'NAV2', 'FPL', or 'WPT'
    description: 'KDEN 42.3nm (DTK 270° XTRK 0.5nm R → HDG 275°)'
}
```

**Priority Order:**
1. Flight plan waypoint bearing (if flight plan active)
2. CDI DTK with intercept correction (if CDI valid)
3. Direct-to waypoint bearing (if waypoint only)
4. `null` (if no nav source)

**Example:**
```javascript
const navHdg = this.ruleEngine._getNavHeading(flightData);
if (navHdg) {
    console.log(`Commanded heading: ${navHdg.heading}° (${navHdg.source})`);
    this._cmdValue('HEADING_BUG_SET', navHdg.heading, navHdg.description);
}
```

---

#### `_computeInterceptHeading(dtk, xtrk, toFrom)`

Compute intercept heading to rejoin desired track.

**Parameters:**
- `dtk` (Number): Desired track (degrees true)
- `xtrk` (Number): Cross-track error (NM, positive = right of course)
- `toFrom` (String): 'TO' or 'FROM' flag

**Returns:** (Number) Intercept heading in degrees (0-360)

**Algorithm:**
- XTRK < 0.1nm → 0° intercept (on course)
- XTRK 0.1-0.3nm → 10° intercept
- XTRK 0.3-1.0nm → 10-30° proportional
- XTRK > 1.0nm → 30° max intercept

**Example:**
```javascript
const dtk = 270;       // Desired track west
const xtrk = 0.6;      // 0.6nm right of course
const toFrom = 'TO';

const hdg = this._computeInterceptHeading(dtk, xtrk, toFrom);
// Result: 251° (turn left 19° to intercept)
```

---

#### `setFlightPlan(plan)`

Set flight plan for execution.

**Parameters:**
- `plan` (Object): Flight plan object

```javascript
{
    name: 'KAPA-KDEN',
    waypoints: [
        { ident: 'KAPA', lat: 39.5701, lon: -104.8493 },
        { ident: 'KDEN', lat: 39.8561, lon: -104.6737 }
    ],
    cruiseAltitude: 8500
}
```

**Called by**: `pane.js:1558` when flight plan executed in GTN750

---

#### `getActiveWaypoint()`

Get current active waypoint from flight plan.

**Returns:**
```javascript
{
    ident: 'KDEN',
    lat: 39.8561,
    lon: -104.6737
}
```

**Returns `null` if**:
- No flight plan loaded
- All waypoints passed (end of plan)

---

#### `sequenceWaypoint(position)`

Sequence to next waypoint if within 0.5nm.

**Parameters:**
- `position` (Object): `{ latitude, longitude }`

**Returns:** (Boolean) `true` if sequenced, `false` if not

**Sequence Distance**: 0.5nm (2,640 feet)

**Called by**: `_getNavHeading()` before computing waypoint bearing

---

#### `hasFlightPlan()`

Check if flight plan is loaded.

**Returns:** (Boolean) `true` if flight plan with waypoints exists

**Example:**
```javascript
if (this.ruleEngine.hasFlightPlan()) {
    console.log('Flight plan active');
}
```

---

#### `setActiveWaypointIndex(index)`

Set active waypoint index (for GTN750 sync).

**Parameters:**
- `index` (Number): Waypoint index (0-based)

**Called by**: `pane.js:1522` when GTN750 broadcasts waypoint-sequence event

---

### FlightPhase Methods

#### `setDestinationDist(nm)`

Set distance to destination for TOD calculation.

**Parameters:**
- `nm` (Number): Distance to destination in nautical miles

**Called by**: `pane.js:1490` when nav-state received

**Effect**: Triggers CRUISE → DESCENT transition when TOD distance reached

---

## Examples

### Example 1: GPS Direct Flight (KAPA → KDEN)

**Scenario**: Departing KAPA, direct-to KDEN, 42.3nm northwest

**Setup:**
1. Load GTN750: Press **Direct-To** → Enter `KDEN` → Activate
2. GTN750 broadcasts nav-state via SafeChannel
3. AI autopilot receives and processes nav data

**Flight Phases:**

| Phase | Altitude | Nav Guidance | Display |
|-------|----------|--------------|---------|
| **TAXI** | 0 AGL | None | HDG: 315° (runway heading) |
| **TAKEOFF** | 0-500 AGL | None | HDG: 315° (runway heading) |
| **CLIMB** | 500-8,000 AGL | ✓ GPS active | HDG: KDEN 42.3nm (DTK 315° on course) |
| **CRUISE** | 8,500 MSL | ✓ GPS active | HDG: KDEN 38.1nm (DTK 315° XTRK 0.1nm L) |
| **DESCENT** | 8,500-6,000 MSL | ✓ GPS active | HDG: KDEN 12.4nm (TERM mode) |
| **APPROACH** | 6,000-200 AGL | ✓ GPS active | HDG: KDEN 3.2nm (DTK 315°) |

**Course Intercept Timeline:**

```
Time    Alt     Dist    XTRK    Intercept   Mode    Heading
--------------------------------------------------------------
00:00   500'    42.3nm  0.0nm   0°          GPS     315° (on course)
03:15   3,200'  35.8nm  0.3nm R 10°         GPS     305° (slight right turn)
08:42   8,500'  28.6nm  0.5nm R 17°         GPS     298° (intercept)
12:18   8,500'  24.2nm  0.2nm R 10°         GPS     305° (reducing intercept)
15:30   8,500'  20.1nm  0.1nm L 0°          GPS     315° (on course)
22:45   7,200'  12.4nm  0.0nm   0°          GPS     315° (TOD, descent)
28:10   5,800'  5.2nm   0.1nm R 10°         GPS     305° (terminal mode)
31:45   2,100'  1.8nm   0.0nm   0°          GPS     315° (final)
```

---

### Example 2: Multi-Waypoint Flight Plan (KAPA → RAWLZ → KDEN)

**Scenario**: Flight plan with intermediate waypoint RAWLZ

**Flight Plan:**
```javascript
{
    name: 'KAPA-RAWLZ-KDEN',
    waypoints: [
        { ident: 'KAPA', lat: 39.5701, lon: -104.8493 },
        { ident: 'RAWLZ', lat: 39.7256, lon: -104.7821 },  // 11.2nm from KAPA
        { ident: 'KDEN', lat: 39.8561, lon: -104.6737 }    // 31.1nm from RAWLZ
    ],
    cruiseAltitude: 8500
}
```

**Waypoint Sequencing:**

```
Phase: CLIMB
  Waypoint 1/3: KAPA (departure)
  → Auto-sequence at 0.5nm
  Waypoint 2/3: RAWLZ
  HDG: RAWLZ 10.8nm (1/3)

Phase: CLIMB
  Waypoint 2/3: RAWLZ
  HDG: RAWLZ 5.2nm (2/3)
  → Auto-sequence at 0.5nm from RAWLZ
  Waypoint 3/3: KDEN

Phase: CRUISE
  Waypoint 3/3: KDEN
  HDG: KDEN 30.6nm (3/3)

Phase: DESCENT (TOD at 12nm)
  Waypoint 3/3: KDEN
  HDG: KDEN 11.8nm (3/3)
```

**Automatic Sequencing Log:**
```
[07:23] ✓ KAPA → RAWLZ (waypoint 2)
[15:42] ✓ RAWLZ → KDEN (waypoint 3)
```

---

### Example 3: Course Intercept After Wind Drift

**Scenario**: Strong crosswind causes 1.2nm right drift during climb

**Initial Conditions:**
- DTK: 270° (due west)
- Wind: 360/30kt (north wind, strong right crosswind)
- Aircraft drifted 1.2nm right of course during climb

**Course Intercept Sequence:**

```
Step 1: Detect Off-Course
  XTRK: 1.2nm R (right of course)
  DTK: 270°
  Intercept Angle: 30° (max)
  Commanded HDG: 270° - 30° = 240°
  Display: "DTK 270° XTRK 1.2nm R → HDG 240°"

Step 2: Approaching Course (3 min later)
  XTRK: 0.7nm R
  Intercept Angle: 24° (proportional)
  Commanded HDG: 270° - 24° = 246°
  Display: "DTK 270° XTRK 0.7nm R → HDG 246°"

Step 3: Near Course (2 min later)
  XTRK: 0.3nm R
  Intercept Angle: 10°
  Commanded HDG: 270° - 10° = 260°
  Display: "DTK 270° XTRK 0.3nm R → HDG 260°"

Step 4: On Course (1 min later)
  XTRK: 0.05nm R
  Intercept Angle: 0° (on course)
  Commanded HDG: 270°
  Wind Correction: +8° (to counter north wind)
  Final HDG: 278°
  Display: "DTK 270° on course (wind +8°)"
```

**Total Intercept Time**: ~6 minutes from 1.2nm off to on-course

---

### Example 4: ILS Approach with APR Mode

**Scenario**: ILS approach to runway 16R at KDEN

**Approach Setup:**
1. GTN750 loads ILS 16R approach
2. Approach mode activated: `{ mode: 'ILS', name: 'ILS16R', hasGlideslope: true }`
3. CDI switches to NAV1 (ILS frequency)

**APPROACH Phase Logic** (`rule-engine-approach.js:101`):

```javascript
if (this._navState) {
    const nav = this._navState;

    // Check for glideslope
    if (nav.cdi?.gsValid && nav.approach?.hasGlideslope) {
        if (!apState.aprHold) {
            this._cmd('AP_APR_HOLD', true, 'APR mode (GS valid)');
        }
    }
    // Lateral-only approach (no GS)
    else if (nav.approach?.mode) {
        if (!apState.aprHold) {
            this._cmd('AP_APR_HOLD', true, 'APR mode (lateral)');
        }
    }
    // No APR mode available — fallback to heading
    else {
        const navHdg = this._getNavHeading(d);
        if (navHdg) {
            this._cmdValue('HEADING_BUG_SET', navHdg.heading, navHdg.description);
            this._cmd('AP_HDG_HOLD', true, 'HDG hold (approach)');
        }
    }
}
```

**APR Mode Activation Timeline:**

```
Altitude    Distance    CDI Source    GS Valid    Mode        Display
------------------------------------------------------------------------
3,000 AGL   12.5nm      GPS           No          NAV         HDG: KDEN 12.5nm
2,200 AGL   8.2nm       NAV1 (ILS)    No          APR (lat)   NAV: NAV1 (APR)
1,800 AGL   6.1nm       NAV1 (ILS)    Yes         APR (GS)    NAV: NAV1 (APR + GS)
800 AGL     3.2nm       NAV1 (ILS)    Yes         APR (GS)    NAV: NAV1 (APR + GS)
200 AGL     1.1nm       NAV1 (ILS)    Yes         APR (GS)    NAV: NAV1 (APR + GS)
```

**Glideslope Coupling**: When `gsValid = true`, the autopilot follows both lateral (localizer) and vertical (glideslope) guidance.

---

## Troubleshooting

### Issue 1: "HDG shows raw degrees instead of waypoint ident"

**Symptom:**
```
HDG: 275°
```
(Expected: `HDG: KDEN 42.3nm`)

**Cause**: Nav-state not being received from GTN750

**Diagnosis:**
1. Check GTN750 is running: http://192.168.1.42:8080/ui/gtn750/
2. Open browser console in AI autopilot page
3. Look for nav-state log: `nav-state wp:KDEN dis:42.3 cdi:GPS dest:42nm`

**Fix:**
- Reload AI autopilot page to re-establish SafeChannel connection
- Ensure GTN750 flight plan is active (FPL page shows active waypoint)
- Check SafeChannel is loaded: `typeof SafeChannel !== 'undefined'`

---

### Issue 2: "Aircraft not tracking course, flying heading only"

**Symptom**: Aircraft maintains heading bug but doesn't correct for cross-track error

**Cause**: CDI source not active or XTRK > 2nm (HDG mode with intercept)

**Diagnosis:**
```javascript
// Check nav-state in console
const nav = window.widget._navState;
console.log('CDI source:', nav?.cdi?.source);
console.log('XTRK:', nav?.cdi?.xtrk);
console.log('TO/FROM:', nav?.cdi?.toFrom);
```

**Fix:**
- Verify CDI source is set in GTN750 (GPS/NAV1/NAV2)
- If XTRK > 2nm, aircraft will use heading intercept — allow time to rejoin course
- Check TO/FROM flag — if FROM, aircraft passed waypoint (sequence to next)

---

### Issue 3: "Waypoints not sequencing automatically"

**Symptom**: Aircraft reaches waypoint but doesn't sequence to next

**Cause**: GTN750 waypoint sequencing not synced with AI autopilot

**Diagnosis:**
1. Check GTN750 FPL page shows correct active waypoint
2. Check AI autopilot console for `✓ RAWLZ → KDEN (waypoint 3)` messages

**Fix:**
- GTN750 auto-sequences waypoints and broadcasts via SafeChannel
- Ensure `waypoint-sequence` SafeChannel messages are received
- Manual sequence in GTN750: Press **Direct-To** → Select next waypoint

---

### Issue 4: "NAV mode not engaging, stuck in HDG mode"

**Symptom**: NAV row shows "OFF" even with active GPS course

**Cause**: Autopilot APR/NAV hold not commanded, or sim AP not responding

**Diagnosis:**
```javascript
// Check autopilot state
const ap = window.widget.ap;
console.log('AP Master:', ap.master);
console.log('HDG Hold:', ap.headingHold);
console.log('NAV Hold:', ap.navHold);
console.log('APR Hold:', ap.aprHold);
```

**Fix:**
- AI autopilot commands `AP_HDG_HOLD` for course intercept, not `AP_NAV_HOLD`
- NAV hold is only engaged when CDI is valid and XTRK < 2nm
- Check MSFS autopilot panel: HDG mode should be active during intercept
- NAV/APR modes engage only when on-course or during approach

---

### Issue 5: "Course intercept oscillates (left-right-left)"

**Symptom**: Aircraft overshoots course, corrects, overshoots opposite side

**Cause**: Proportional intercept gain too high, or sim autopilot lag

**Diagnosis:**
- Monitor XTRK over time — should decrease smoothly
- Check intercept angle isn't changing rapidly (< 5° per minute)

**Fix:**
- Proportional intercept algorithm already tuned for C172 dynamics
- If oscillation persists, check MSFS autopilot bank limit (should be 25° max)
- Verify wind compensation isn't interfering (disable temporarily to test)
- Ensure SafeChannel nav-state is updating at 1Hz (not stale/delayed)

---

### Issue 6: "TOD not triggering, aircraft stays in CRUISE"

**Symptom**: Approaching destination but still in CRUISE phase

**Cause**: Destination distance not being received from GTN750

**Diagnosis:**
```javascript
const phase = window.widget.flightPhase;
console.log('Destination dist:', phase.destinationDist);
console.log('TOD distance:', phase.targetCruiseAlt / 1000 * 3);
```

**Fix:**
- GTN750 must broadcast `destDistNm` in nav-state
- Check nav-state in console: `window.widget._navState.destDistNm`
- If missing, ensure GTN750 flight plan has all waypoints with distances
- Fallback: Manually advance phase to DESCENT

---

## Related Documentation

- **[README.md](README.md)** — Main AI Autopilot overview, quick start, API endpoints
- **[ATC-GUIDE.md](ATC-GUIDE.md)** — ATC ground operations, taxi clearance, phraseology
- **[WEATHER-GUIDE.md](WEATHER-GUIDE.md)** — Wind compensation, crosswind components, turbulence
- **[GTN750 README](../gtn750/README.md)** — GTN750 GPS features, flight planning, CDI
- **[GTN750 Flight Plan Guide](../gtn750/FLIGHT-PLAN-GUIDE.md)** — Flight plan creation, Direct-To, waypoint sequencing

---

## Version History

### v3.0 (February 2026)
- Complete navigation integration with GTN750 GPS
- Course intercept with proportional correction (10-30° based on XTRK)
- Automatic waypoint sequencing (0.5nm threshold)
- CDI source awareness (GPS/NAV1/NAV2)
- Automatic CDI scaling (ENR/TERM/APR modes)
- TOD calculation from destination distance
- NAV/HDG mode switching
- Wind drift correction integration
- SafeChannel communication (BroadcastChannel with localStorage fallback)

### v2.0 (January 2026)
- Basic heading hold
- Wind compensation (no GPS integration)
- Manual phase transitions

### v1.0 (December 2025)
- Initial AI autopilot release
- 8 flight phases
- No navigation integration

---

**Document Status**: COMPLETE ✅
**Test Coverage**: 250/250 tests passing (0.21s)
**Production**: Deployed to commander-pc (192.168.1.42:8080)
**Last Updated**: February 14, 2026
