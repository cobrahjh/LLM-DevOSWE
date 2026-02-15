# AI Autopilot Flight Phases - Complete Guide

**Version**: 3.0
**Component**: AI Autopilot - Flight Phase State Machine
**Phases**: 8 Sequential Phases (PREFLIGHT → LANDING)
**File**: `ui/ai-autopilot/PHASES-GUIDE.md`

---

## Table of Contents

1. [Overview](#overview)
2. [Phase State Machine](#phase-state-machine)
3. [Phase Transitions](#phase-transitions)
4. [Phase Details](#phase-details)
   - [PREFLIGHT](#phase-1-preflight)
   - [TAXI](#phase-2-taxi)
   - [TAKEOFF](#phase-3-takeoff)
   - [CLIMB](#phase-4-climb)
   - [CRUISE](#phase-5-cruise)
   - [DESCENT](#phase-6-descent)
   - [APPROACH](#phase-7-approach)
   - [LANDING](#phase-8-landing)
5. [Takeoff Sub-Phases](#takeoff-sub-phases)
6. [Phase Management](#phase-management)
7. [Transition Conditions](#transition-conditions)
8. [Catch-Up Logic](#catch-up-logic)
9. [Manual Phase Control](#manual-phase-control)
10. [Progress Tracking](#progress-tracking)
11. [API Reference](#api-reference)
12. [Examples](#examples)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Autopilot uses an **8-phase sequential state machine** to model a complete IFR/VFR flight from cold-and-dark startup to landing.

**Flight Phases:**
1. **PREFLIGHT** — Engine start, systems check
2. **TAXI** — Taxi to runway, ATC clearance
3. **TAKEOFF** — Takeoff roll, rotation, liftoff (6 sub-phases)
4. **CLIMB** — Climb to cruise altitude
5. **CRUISE** — Level flight at cruise altitude
6. **DESCENT** — Descent from cruise to approach altitude
7. **APPROACH** — Final approach and landing preparation
8. **LANDING** — Landing, rollout, taxi to parking

**Key Features:**
- **Automatic transition** based on real-time flight data (altitude, speed, position)
- **Catch-up logic** detects mid-flight state (e.g., reloading page while cruising)
- **Manual override** for testing or special procedures
- **Progress tracking** (0-100% through flight phases)
- **Phase callbacks** for UI updates and logging
- **ATC integration** gates taxi-to-takeoff transition on clearance

---

## Phase State Machine

### State Diagram

```
     ┌──────────────┐
     │  PREFLIGHT   │  Engine off → Engine start
     └──────┬───────┘
            │ Engine running + on ground
            ▼
     ┌──────────────┐
     │     TAXI     │  Taxi to runway, ATC clearance
     └──────┬───────┘
            │ Ground speed > 25kt + ATC cleared
            ▼
     ┌──────────────┐
     │   TAKEOFF    │  6 sub-phases: BEFORE_ROLL → DEPARTURE
     └──────┬───────┘
            │ Airborne + AGL > 500ft
            ▼
     ┌──────────────┐
     │    CLIMB     │  Climb to cruise altitude
     └──────┬───────┘
            │ Altitude ≥ target cruise - 200ft
            ▼
     ┌──────────────┐
     │    CRUISE    │  Level flight at cruise altitude
     └──────┬───────┘
            │ Distance to dest < TOD distance
            ▼
     ┌──────────────┐
     │   DESCENT    │  Descent to approach altitude
     └──────┬───────┘
            │ AGL < 3,000ft or APR mode
            ▼
     ┌──────────────┐
     │   APPROACH   │  Final approach to runway
     └──────┬───────┘
            │ AGL < 200ft + gear down
            ▼
     ┌──────────────┐
     │   LANDING    │  Landing, rollout, taxi to parking
     └──────┬───────┘
            │ On ground + GS < 30kt
            └────────► TAXI (or PREFLIGHT if engine shutdown)
```

### Phase Progression

| Phase | Duration (Typical) | Key Activities |
|-------|-------------------|----------------|
| **PREFLIGHT** | 1-2 min | Engine start, systems check, flight plan review |
| **TAXI** | 2-5 min | Taxi to runway, ATC clearance, lineup |
| **TAKEOFF** | 1-2 min | Takeoff roll, rotation, liftoff, initial climb |
| **CLIMB** | 5-10 min | Climb to cruise altitude (e.g., 3,000 → 8,500 MSL) |
| **CRUISE** | 10-60+ min | Level flight at cruise altitude |
| **DESCENT** | 5-10 min | Descent from cruise to approach altitude |
| **APPROACH** | 3-5 min | Final approach, landing setup |
| **LANDING** | 1-2 min | Landing, rollout, taxi to parking |

**Total Flight Time**: 30-90+ minutes (depending on distance)

---

## Phase Transitions

### Automatic Transitions

All phase transitions are **automatic** based on real-time flight data. The `FlightPhase.update()` method is called every frame (~60Hz) to evaluate transition conditions.

**Transition Triggers:**

| From | To | Condition |
|------|----|-----------|
| **PREFLIGHT** | TAXI | Engine running OR throttle > 10% (on ground) |
| **TAXI** | TAKEOFF | Ground speed > 25kt AND (no ATC OR ATC cleared) |
| **TAXI** | PREFLIGHT | GS < 1kt AND engine shutdown |
| **TAKEOFF** | CLIMB | Airborne AND AGL > 500ft |
| **TAKEOFF** | TAXI | GS < 10kt AND on ground (rejected takeoff) |
| **CLIMB** | CRUISE | Altitude ≥ (target cruise - 200ft) |
| **CRUISE** | DESCENT | Distance to dest < TOD distance (or manual descent) |
| **DESCENT** | APPROACH | AGL < 3,000ft (or AGL < 2,000ft without APR mode) |
| **APPROACH** | LANDING | AGL < 200ft AND gear down |
| **APPROACH** | CLIMB | Altitude gain > 500ft AND VS > 300 (go-around) |
| **LANDING** | TAXI | On ground AND GS < 30kt |
| **LANDING** | CLIMB | Not on ground AND AGL > 500ft (go-around) |

### ATC Gate (TAXI → TAKEOFF)

When ATC is active, the transition from TAXI to TAKEOFF requires **takeoff clearance**:

```javascript
// flight-phase.js:81
if (gs > 25 && onGround && (!this._atc || this._atc.getPhase() === 'INACTIVE' || this._atc.getPhase() === 'CLEARED_TAKEOFF')) {
    this._setPhase('TAKEOFF');
}
```

**Without ATC**: Transition at GS > 25kt (pilot assumed to be on takeoff roll)
**With ATC**: Transition only when `atcPhase === 'CLEARED_TAKEOFF'`

---

## Phase Details

### Phase 1: PREFLIGHT

**Purpose**: Engine start, systems initialization, flight plan review

**Entry Conditions:**
- Default starting phase (or from TAXI if engine shutdown)
- Aircraft on ground, engine off

**Characteristics:**
- **No autopilot commands** — pilot in control
- **No flight controls** — aircraft stationary
- **Systems checks** — fuel, flaps, trim, lights

**Transition Out:**
```javascript
// Exit when engine running OR throttle applied
if ((engineRunning || d.throttle > 10) && onGround) {
    this._setPhase('TAXI');
}
```

**Why Throttle Check?**: The AI autopilot may command throttle before the `engineRunning` SimVar updates. This allows smooth phase transition even when SimConnect has slight lag.

**Typical Activities:**
1. AI autopilot waits for engine start (manual or automated)
2. No control inputs sent to simulator
3. Phase transitions when throttle applied or engine starts

**Duration**: 1-2 minutes (until pilot or AI starts engine)

---

### Phase 2: TAXI

**Purpose**: Taxi from parking to runway, ATC clearance, lineup

**Entry Conditions:**
- Engine running OR throttle > 10%
- Aircraft on ground

**Characteristics:**
- **ATC ground operations** — taxi clearance, route planning (if ATC active)
- **Ground steering** — rudder commands to follow taxiways
- **Speed control** — throttle commands to maintain taxi speed
- **No autopilot** — manual control during taxi

**Transition Out (TAXI → TAKEOFF):**
```javascript
// ATC gate: require takeoff clearance if ATC active
if (gs > 25 && onGround && (!this._atc || this._atc.getPhase() === 'INACTIVE' || this._atc.getPhase() === 'CLEARED_TAKEOFF')) {
    this._setPhase('TAKEOFF');
}
```

**Transition Out (TAXI → PREFLIGHT):**
```javascript
// Return to preflight if engine shutdown during taxi
if (gs < 1 && !engineRunning) {
    this._setPhase('PREFLIGHT');
}
```

**ATC Integration:**
- If ATC active: Taxi route provided, waypoint sequencing, hold-short detection
- If ATC inactive: Free taxi, pilot controls heading

**Typical Activities:**
1. Taxi from parking to runway (3-5 minutes)
2. Request taxi clearance (ATC)
3. Follow taxi route (yellow taxiway lines on map)
4. Hold short of runway, request takeoff clearance
5. Line up on runway centerline

**Duration**: 2-5 minutes (depending on airport size and taxi distance)

---

### Phase 3: TAKEOFF

**Purpose**: Takeoff roll, rotation, liftoff, initial climb

**Entry Conditions:**
- Ground speed > 25kt
- On ground
- ATC cleared for takeoff (if ATC active)

**Characteristics:**
- **6 sub-phases** — BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
- **Manual flight controls** — direct elevator, aileron, rudder commands
- **Autopilot OFF** — AP disabled until INITIAL_CLIMB sub-phase
- **Critical flight phase** — most complex automation

**Sub-Phases** (see [Takeoff Sub-Phases](#takeoff-sub-phases) section for details):
1. **BEFORE_ROLL** — Final checks, brakes released, aligned on runway
2. **ROLL** — Full throttle, ground steering, wings level
3. **ROTATE** — Vr reached, progressive elevator input, pitch up
4. **LIFTOFF** — Airborne, maintain climb attitude, wings level
5. **INITIAL_CLIMB** — Climb to 500+ AGL, hand off to autopilot
6. **DEPARTURE** — Flaps retracted, autopilot engaged, heading/altitude set

**Transition Out (TAKEOFF → CLIMB):**
```javascript
// Exit when airborne and safely above terrain
if (!onGround && agl > 500) {
    this._setPhase('CLIMB');
}
```

**Transition Out (TAKEOFF → TAXI):**
```javascript
// Rejected takeoff — abort and return to taxi
if (gs < 10 && onGround) {
    this._setPhase('TAXI');
}
```

**Typical Activities:**
1. Release brakes, throttle to 100%
2. Accelerate down runway, maintain centerline
3. Rotate at Vr (55kt for C172)
4. Liftoff, maintain wings level
5. Climb to 500 AGL, engage autopilot
6. Retract flaps, set climb VS and speed

**Duration**: 1-2 minutes (from brake release to 500 AGL)

---

### Phase 4: CLIMB

**Purpose**: Climb from departure altitude to cruise altitude

**Entry Conditions:**
- Airborne
- AGL > 500ft (post-takeoff)

**Characteristics:**
- **Autopilot engaged** — HDG, VS, SPD modes active
- **Lateral navigation** — GPS course tracking (if GTN750 active)
- **Flaps retracted** — clean configuration for climb
- **Climb speed** — Vy (76kt for C172) for best rate of climb
- **Climb VS** — +500 fpm (adjustable based on speed margin)

**Transition Out (CLIMB → CRUISE):**
```javascript
// Transition when reaching target cruise altitude
if (alt >= this.targetCruiseAlt - 200) {
    this._setPhase('CRUISE');
}
```

**Activities:**
- **Throttle**: 100% (full power climb)
- **Autopilot modes**: HDG + VS + SPD
- **VS target**: +500 fpm (reduced if low speed margin)
- **Speed target**: Vy (76kt for C172)
- **Lateral nav**: GPS course tracking (if flight plan active)
- **Flaps**: Retracted (auto-retract if DEPARTURE didn't complete)

**Typical Climb:**
- **Departure altitude**: 500 AGL (~6,000 MSL at KDEN)
- **Cruise altitude**: 8,500 MSL
- **Climb time**: ~5 minutes (2,500 ft @ 500 fpm)
- **Distance**: ~8 NM (at 100kt ground speed)

**Duration**: 5-10 minutes (depending on cruise altitude)

---

### Phase 5: CRUISE

**Purpose**: Level flight at cruise altitude

**Entry Conditions:**
- Altitude ≥ (target cruise - 200ft)

**Characteristics:**
- **Level flight** — ALT hold engaged
- **Cruise speed** — Vcruise (100kt for C172)
- **Lateral navigation** — GPS waypoint tracking (if flight plan active)
- **Fuel management** — cruise power setting for efficiency
- **Longest phase** — most of the flight time

**Transition Out (CRUISE → DESCENT):**
```javascript
// Transition when TOD (Top of Descent) reached
if (this.destinationDist < Math.abs(todNm) && this.destinationDist < 100) {
    this._setPhase('DESCENT');
}

// Manual descent detected
else if (vs < -300 && alt < this.targetCruiseAlt - 500 && this._phaseAge() > 30000) {
    this._setPhase('DESCENT');
}

// Cruise altitude lowered
else if (alt > this.targetCruiseAlt + 500 && this._phaseAge() > 5000) {
    this._setPhase('DESCENT');
}
```

**Activities:**
- **Throttle**: 70-90% (cruise power, speed-dependent)
- **Autopilot modes**: HDG + ALT + SPD
- **VS target**: 0 fpm (level flight)
- **Speed target**: Vcruise (100kt for C172)
- **Lateral nav**: GPS waypoint tracking
- **TOD monitoring**: Continuous distance-to-destination check

**TOD Calculation:**
- **TOD distance** = (Altitude to lose) / 1,000 × 3 NM
- **Example**: 8,500 MSL cruise → 5,400 MSL destination field = 3,100 ft to lose
  - TOD = 3.1 × 3 = **9.3 NM** from destination

**Typical Activities:**
1. Level off at cruise altitude
2. Reduce throttle to cruise power (~80%)
3. Engage ALT hold
4. Track GPS course (if flight plan active)
5. Monitor fuel, weather, traffic
6. Approach TOD point for descent

**Duration**: 10-60+ minutes (depending on flight distance)

---

### Phase 6: DESCENT

**Purpose**: Descend from cruise altitude to approach altitude

**Entry Conditions:**
- Distance to destination < TOD distance
- OR sustained descent detected (VS < -300 fpm for 30+ seconds)
- OR cruising above new target altitude

**Characteristics:**
- **Descent VS** — -500 fpm (normal descent rate)
- **Speed control** — reduce to descent speed (~100kt for C172)
- **Lateral navigation** — continue GPS tracking
- **Approach preparation** — flaps, gear, landing checks

**Transition Out (DESCENT → APPROACH):**
```javascript
// Transition when approach mode engaged OR low altitude
if (agl < 3000 && (d.apAprLock || d.apNavLock)) {
    this._setPhase('APPROACH');
} else if (agl < 2000) {
    this._setPhase('APPROACH');
}
```

**Activities:**
- **Throttle**: 55-75% (descent power, speed-dependent)
- **Autopilot modes**: HDG/NAV + VS + SPD
- **VS target**: -500 fpm (normal descent)
- **Speed target**: 100kt (descent speed)
- **Lateral nav**: GPS waypoint tracking
- **Approach setup**: Review approach plates, brief procedures

**Typical Descent:**
- **Start altitude**: 8,500 MSL
- **End altitude**: ~6,000 MSL (approach altitude)
- **Descent**: 2,500 ft @ -500 fpm = 5 minutes
- **Distance**: ~9 NM (calculated TOD)

**Duration**: 5-10 minutes (depending on altitude to lose)

---

### Phase 7: APPROACH

**Purpose**: Final approach to runway, landing preparation

**Entry Conditions:**
- AGL < 3,000ft with approach mode engaged
- OR AGL < 2,000ft (fallback)

**Characteristics:**
- **Approach mode** — APR mode (ILS/RNAV) if available, HDG fallback
- **Flaps extended** — progressive flap deployment (1 → 2 → 3)
- **Gear down** — landing gear extended
- **Reduced speed** — approach speed (65kt for C172)
- **Precision flying** — tight altitude/course tolerances

**Transition Out (APPROACH → LANDING):**
```javascript
// Transition when close to touchdown
if (agl < 200 && gearDown) {
    this._setPhase('LANDING');
}
```

**Transition Out (APPROACH → CLIMB):**
```javascript
// Go-around detected
if (alt > this.targetCruiseAlt - 500 && vs > 300) {
    this._setPhase('CLIMB');
}
```

**Activities:**
- **Throttle**: 40% (approach power)
- **Autopilot modes**: APR (if available) or HDG + VS
- **VS target**: -500 fpm (approach descent)
- **Speed target**: 65kt (approach speed for C172)
- **Flaps**: Progressive deployment
  - AGL < approach: Flaps 1
  - AGL < 800ft: Flaps 2
  - AGL < 400ft: Flaps 3 (full)
- **Lateral nav**: APR mode localizer tracking or GPS course

**APR Mode Logic:**
```javascript
// If glideslope valid, engage APR mode
if (nav.cdi?.gsValid && nav.approach?.hasGlideslope) {
    this._cmd('AP_APR_HOLD', true, 'APR mode (GS valid)');
}
// Lateral-only approach
else if (nav.approach?.mode) {
    this._cmd('AP_APR_HOLD', true, 'APR mode (lateral)');
}
// No APR mode — fallback to heading
else {
    const navHdg = this._getNavHeading(d);
    this._cmdValue('HEADING_BUG_SET', navHdg.heading, navHdg.description);
}
```

**Typical Activities:**
1. Intercept final approach course
2. Engage APR mode (ILS/RNAV)
3. Track localizer/GPS course
4. Follow glideslope (if ILS)
5. Deploy flaps progressively
6. Reduce speed to approach speed
7. Configure for landing (gear down, full flaps)

**Duration**: 3-5 minutes (from 3,000 AGL to 200 AGL)

---

### Phase 8: LANDING

**Purpose**: Landing, rollout, taxi to parking

**Entry Conditions:**
- AGL < 200ft
- Gear down

**Characteristics:**
- **Flare and touchdown** — autopilot hands off near ground
- **Rollout** — maintain centerline, slow to taxi speed
- **Taxi to parking** — exit runway, return to ramp
- **Go-around detection** — abort landing if airborne again

**Transition Out (LANDING → TAXI):**
```javascript
// Normal landing completion
if (onGround && gs < 30) {
    this._setPhase('TAXI');
}
```

**Transition Out (LANDING → CLIMB):**
```javascript
// Go-around detected
if (!onGround && agl > 500) {
    this._setPhase('CLIMB');
}
```

**Activities:**
- **Autopilot**: AP typically disengaged near ground (manual flare)
- **Throttle**: Idle (reduce to 0% on touchdown)
- **Rollout**: Maintain runway centerline, apply brakes
- **Exit runway**: Turn off at taxiway, slow to taxi speed
- **Taxi to parking**: Return to ramp or gate

**Typical Activities:**
1. Flare at 10-20 AGL
2. Touchdown on main wheels
3. Lower nose wheel gently
4. Apply brakes, slow to taxi speed
5. Exit runway at first available taxiway
6. Taxi to parking or gate
7. Shutdown (returns to PREFLIGHT)

**Duration**: 1-2 minutes (from touchdown to parking)

---

## Takeoff Sub-Phases

The **TAKEOFF** phase is divided into **6 sub-phases** for precise control during the critical takeoff sequence.

### Sub-Phase Flow

```
BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
```

### Sub-Phase 1: BEFORE_ROLL

**Purpose**: Final pre-takeoff checks, lineup on runway

**Conditions:**
- Entry: Phase changed to TAKEOFF
- Exit: Ground speed > 3kt (brakes released, moving)

**Actions:**
- **Flight controls**: Center elevator, ailerons, rudder
- **Mixture**: RICH (100%)
- **Parking brake**: Release
- **Ground steering**: Maintain runway heading

**Why GS > 3kt?**: MSFS 2024 `parkingBrake` SimVar is unreliable. Using ground speed > 3kt proves the brakes are actually released.

**Code**:
```javascript
// Recenter ALL flight controls
this._cmdValue('AXIS_ELEVATOR_SET', 0.0001, 'Center elevator');
this._cmdValue('AXIS_AILERONS_SET', 0.0001, 'Center ailerons');
this._cmdValue('AXIS_RUDDER_SET', 0, 'Center rudder');
this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH for takeoff');
this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake');

// Ground steering while waiting
if (!this._runwayHeading) {
    this._runwayHeading = this._activeRunway?.heading || Math.round(d.heading || 0);
}
this._groundSteer(d, this._runwayHeading);

// Advance when moving
if (gs > 3) {
    this._takeoffSubPhase = 'ROLL';
}
```

**Duration**: < 1 second (instant transition once moving)

---

### Sub-Phase 2: ROLL

**Purpose**: Takeoff roll, acceleration to Vr

**Conditions:**
- Entry: GS > 3kt
- Exit: IAS ≥ Vr (55kt for C172)

**Actions:**
- **Throttle**: 100% (full power)
- **Elevator**: Neutral (0.0001 to keep held-axes active)
- **Ailerons**: Wings-level correction (bank > 3° → aileron correction)
- **Rudder**: Ground steering to maintain centerline

**Wings-Level Logic:**
```javascript
// Torque from full power rolls left — correct with right aileron
const bank = d.bank || 0;
if (Math.abs(bank) > 3) {
    const ailCorr = -bank * 2;  // Negate bank for correct direction
    this._cmdValue('AXIS_AILERONS_SET', Math.max(-25, Math.min(25, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
}
```

**Ground Steering:**
- Rudder commands to maintain runway centerline
- Progressive correction based on heading error

**Code**:
```javascript
this._cmdValue('PARKING_BRAKE_SET', 0, 'Release parking brake');
this._cmdValue('AXIS_ELEVATOR_SET', 0.0001, 'Elevator neutral');
this._cmdValue('THROTTLE_SET', 100, 'Full power');

// Ground steering
this._groundSteer(d, this._runwayHeading);

// Transition at Vr
if (ias >= speeds.Vr) {  // 55kt for C172
    this._takeoffSubPhase = 'ROTATE';
    this._rotateStartTime = Date.now();
}
```

**Duration**: ~30-40 seconds (0 → 55kt @ 100% throttle)

---

### Sub-Phase 3: ROTATE

**Purpose**: Pitch up for liftoff

**Conditions:**
- Entry: IAS ≥ Vr (55kt)
- Exit: Not on ground (airborne)

**Actions:**
- **Elevator**: Progressive pitch-up (-3° initial, -2°/sec to max -8°)
- **Ailerons**: Wings-level correction
- **Rudder**: Ground steering (until airborne)
- **Trim**: Nose-up trim to reduce elevator pressure

**Progressive Rotation:**
```javascript
const rotMax = -8;  // Max elevator deflection
const rotElapsed = (Date.now() - this._rotateStartTime) / 1000;
const rotElev = Math.max(rotMax, -3 - rotElapsed * 2);
// Result: -3° at t=0, -5° at t=1s, -7° at t=2s, -8° at t=2.5s
this._cmdValue('AXIS_ELEVATOR_SET', rotElev, `Rotate — elevator ${Math.round(rotElev)}`);
```

**Why Progressive?**: Instant full elevator causes over-rotation and tail strike. Progressive rotation mimics real-world pilot technique.

**Code**:
```javascript
// Progressive rotation
const rotMax = -8;
const rotElapsed = (Date.now() - this._rotateStartTime) / 1000;
const rotElev = Math.max(rotMax, -3 - rotElapsed * 2);
this._cmdValue('AXIS_ELEVATOR_SET', rotElev, `Rotate — elevator ${Math.round(rotElev)}`);

// Wings-level correction
const bank = d.bank || 0;
if (Math.abs(bank) > 2) {
    const ailCorr = -bank * 2;
    this._cmdValue('AXIS_AILERONS_SET', Math.max(-30, Math.min(30, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
}

// Ground steering until airborne
this._groundSteer(d, this._runwayHeading);

// Trim nose up
this._cmd('ELEV_TRIM_UP', true, 'Trim nose up');

// Transition when airborne
if (!onGround) {
    this._takeoffSubPhase = 'LIFTOFF';
}
```

**Duration**: 2-5 seconds (from Vr to liftoff)

---

### Sub-Phase 4: LIFTOFF

**Purpose**: Initial climb after liftoff

**Conditions:**
- Entry: Airborne (not on ground)
- Exit: VS > 100 fpm AND AGL > 200ft

**Actions:**
- **Elevator**: Hold climb attitude (-5°)
- **Ailerons**: Wings-level correction (bank > 3° → aileron correction)
- **Throttle**: 100% (full power climb)

**Code**:
```javascript
this._cmdValue('THROTTLE_SET', 100, 'Full power climb');
this._cmdValue('AXIS_ELEVATOR_SET', -5, 'Climb — elevator -5');

// Wings-level correction
const bank = d.bank || 0;
if (Math.abs(bank) > 3) {
    const ailCorr = -bank * 3;
    this._cmdValue('AXIS_AILERONS_SET', Math.max(-30, Math.min(30, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
}

// Transition when climbing and above 200 AGL
if (vs > 100 && agl > 200) {
    this._takeoffSubPhase = 'INITIAL_CLIMB';
}
```

**Duration**: 10-20 seconds (from liftoff to 200 AGL)

---

### Sub-Phase 5: INITIAL_CLIMB

**Purpose**: Climb to safe altitude, prepare for autopilot handoff

**Conditions:**
- Entry: VS > 100 fpm AND AGL > 200ft
- Exit: IAS ≥ (Vs1 + 15kt) AND AGL > 500ft

**Actions:**
- **Elevator**: Climb attitude (-4°)
- **Ailerons**: Wings-level correction
- **Throttle**: 100% (full power climb)
- **Autopilot handoff**: Engage AP when speed/altitude safe

**Handoff Criteria:**
- **Speed margin**: IAS ≥ (Vs1 + 15kt) = 68kt for C172
- **Altitude**: AGL > 500ft

**Code**:
```javascript
this._cmdValue('THROTTLE_SET', 100, 'Full power climb');
this._cmdValue('AXIS_ELEVATOR_SET', -4, 'Climb — elevator -4');

// Wings-level correction
const bank = d.bank || 0;
if (Math.abs(bank) > 3) {
    const ailCorr = -bank * 3;
    this._cmdValue('AXIS_AILERONS_SET', Math.max(-30, Math.min(30, ailCorr)), `Wings level (bank ${Math.round(bank)}°)`);
}

// Autopilot handoff
const stallMargin = speeds.Vs1 + 15;  // 53 + 15 = 68kt
if (ias >= stallMargin && agl > 500) {
    // Release flight controls
    this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release for AP');
    this._cmdValue('AXIS_RUDDER_SET', 0, 'Release for AP');
    this._cmdValue('AXIS_AILERONS_SET', 0, 'Release for AP');

    // Engage autopilot
    if (!apState.master) {
        this._cmd('AP_MASTER', true, 'Engage AP');
        const hdg = Math.round(d.heading || this._runwayHeading || 0);
        this._cmdValue('HEADING_BUG_SET', hdg, 'HDG ' + hdg + '°');
    }

    this._cmd('AP_HDG_HOLD', true, 'HDG hold');
    this._cmd('AP_VS_HOLD', true, 'VS hold');
    this._cmdValue('AP_VS_VAR_SET_ENGLISH', 500, 'VS +500');

    // Verify AP is flying before advancing
    if (apState.master) {
        this._takeoffSubPhase = 'DEPARTURE';
    }
}
```

**Duration**: 10-30 seconds (from 200 AGL to 500 AGL)

---

### Sub-Phase 6: DEPARTURE

**Purpose**: Clean up configuration, continue climb

**Conditions:**
- Entry: Autopilot engaged
- Exit: Flight phase transitions to CLIMB (AGL > 500ft)

**Actions:**
- **Flaps**: Retract
- **Autopilot**: Set climb speed (Vy), cruise altitude
- **Lights**: Landing lights off (post-departure)

**Code**:
```javascript
// Retract flaps
if ((d.flapsIndex || 0) > 0) {
    delete this._lastCommands['FLAPS_UP'];
    this._cmd('FLAPS_UP', true, 'Retract flaps');
}

// Set climb speed and altitude
this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy climb)');
this._cmdValue('AP_ALT_VAR_SET_ENGLISH', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());

// Landing lights off
this._cmd('LANDING_LIGHTS_TOGGLE', true, 'Lights off after departure');
```

**Why No ALT Hold?**: Engaging ALT hold here would capture the current altitude (~500-800ft) and prevent climb to cruise. The CLIMB phase will manage vertical navigation with VS hold.

**Duration**: 1-2 seconds (instant cleanup, then phase transitions to CLIMB)

---

## Phase Management

### FlightPhase Class

The `FlightPhase` class (`modules/flight-phase.js`, 217 lines) manages the state machine.

**Constructor Options:**
```javascript
const flightPhase = new FlightPhase({
    targetCruiseAlt: 8500,           // Target cruise altitude (MSL)
    fieldElevation: 5400,            // Field elevation for AGL calculations
    profile: aircraftProfile,        // Aircraft profile (speeds, limits, etc.)
    onPhaseChange: (newPhase, oldPhase) => {
        console.log(`Phase transition: ${oldPhase} → ${newPhase}`);
    }
});
```

**Update Method:**
```javascript
// Called every frame (~60Hz) to evaluate transitions
const currentPhase = flightPhase.update(flightData);
```

**Phase Callback:**
```javascript
// Triggered on every phase transition
onPhaseChange(newPhase, oldPhase) {
    // Update UI
    this._updatePhaseDisplay(newPhase);

    // Log transition
    console.log(`[FlightPhase] ${oldPhase} → ${newPhase}`);

    // Load phase-specific rule engine module
    if (newPhase === 'TAKEOFF' || newPhase === 'DEPARTURE') {
        this._loadPhaseModule('takeoff');
    } else if (newPhase === 'CLIMB' || newPhase === 'CRUISE') {
        this._loadPhaseModule('cruise');
    }
    // ... etc.
}
```

---

## Transition Conditions

### Detailed Transition Logic

```javascript
switch (this.phase) {
    case 'PREFLIGHT':
        // Engine running OR throttle applied
        if ((engineRunning || d.throttle > 10) && onGround) {
            this._setPhase('TAXI');
        }
        break;

    case 'TAXI':
        // Takeoff roll detected (GS > 25kt)
        // ATC gate: require clearance if ATC active
        if (gs > 25 && onGround && (!this._atc || this._atc.getPhase() === 'INACTIVE' || this._atc.getPhase() === 'CLEARED_TAKEOFF')) {
            this._setPhase('TAKEOFF');
        }
        // Engine shutdown — return to preflight
        else if (gs < 1 && !engineRunning) {
            this._setPhase('PREFLIGHT');
        }
        break;

    case 'TAKEOFF':
        // Airborne and safe altitude
        if (!onGround && agl > 500) {
            this._setPhase('CLIMB');
        }
        // Rejected takeoff
        else if (gs < 10 && onGround) {
            this._setPhase('TAXI');
        }
        break;

    case 'CLIMB':
        // Reached cruise altitude
        if (alt >= this.targetCruiseAlt - 200) {
            this._setPhase('CRUISE');
        }
        break;

    case 'CRUISE':
        // TOD reached (distance to dest < calculated TOD distance)
        if (this.destinationDist < Math.abs(todNm) && this.destinationDist < 100) {
            this._setPhase('DESCENT');
        }
        // Manual descent detected (VS < -300 for 30+ seconds)
        else if (vs < -300 && alt < this.targetCruiseAlt - 500 && this._phaseAge() > 30000) {
            this._setPhase('DESCENT');
        }
        // Cruise altitude lowered (flying above new target)
        else if (alt > this.targetCruiseAlt + 500 && this._phaseAge() > 5000) {
            this._setPhase('DESCENT');
        }
        break;

    case 'DESCENT':
        // Approach altitude reached with approach mode
        if (agl < 3000 && (d.apAprLock || d.apNavLock)) {
            this._setPhase('APPROACH');
        }
        // Approach altitude reached without approach mode
        else if (agl < 2000) {
            this._setPhase('APPROACH');
        }
        break;

    case 'APPROACH':
        // Near ground, gear down → landing
        if (agl < 200 && gearDown) {
            this._setPhase('LANDING');
        }
        // Go-around detected (altitude gain)
        else if (alt > this.targetCruiseAlt - 500 && vs > 300) {
            this._setPhase('CLIMB');
        }
        break;

    case 'LANDING':
        // On ground, slowing down → taxi
        if (onGround && gs < 30) {
            this._setPhase('TAXI');
        }
        // Go-around (airborne again)
        else if (!onGround && agl > 500) {
            this._setPhase('CLIMB');
        }
        break;
}
```

---

## Catch-Up Logic

### Mid-Flight Engagement

If the AI autopilot page is loaded while already in flight, the catch-up logic detects the current flight state and jumps to the correct phase.

**Catch-Up Triggers:**
- Phase is PREFLIGHT or TAXI
- Aircraft is airborne (not on ground)
- AGL > 100ft
- IAS > 30kt (not hovering/stalling)

**Catch-Up Logic:**
```javascript
// flight-phase.js:54-67
if ((this.phase === 'PREFLIGHT' || this.phase === 'TAXI') && !onGround && agl > 100 && ias > 30) {
    if (alt >= this.targetCruiseAlt - 200) {
        // Cruising at target altitude
        this._setPhase('CRUISE');
    } else if (vs > 100) {
        // Climbing (positive vertical speed)
        this._setPhase('CLIMB');
    } else if (agl < 2000) {
        // Low altitude, assume approach
        this._setPhase('APPROACH');
    } else {
        // Default: assume climbing
        this._setPhase('CLIMB');
    }
}
```

**Example Scenarios:**

| Altitude | VS | AGL | Detected Phase |
|----------|----|----|----------------|
| 8,500 MSL | 0 fpm | 3,100 AGL | CRUISE (at target altitude) |
| 6,000 MSL | +500 fpm | 600 AGL | CLIMB (positive VS) |
| 5,800 MSL | -300 fpm | 1,400 AGL | APPROACH (low altitude) |
| 3,200 MSL | +200 fpm | 800 AGL | CLIMB (default) |

---

## Manual Phase Control

### Manual Override

The pilot can manually override the phase for testing or special procedures.

**Set Manual Phase:**
```javascript
flightPhase.setManualPhase('CRUISE');
// Phase locked to CRUISE, no automatic transitions
```

**Resume Automatic Transitions:**
```javascript
flightPhase.resumeAuto();
// Phase transitions resume automatically
```

**Force Phase (from Takeoff Tuner):**
```javascript
flightPhase.forcePhase('TAKEOFF');
// Force transition to TAKEOFF (used by takeoff tuner UI)
```

### Manual Phase API

| Method | Effect |
|--------|--------|
| `setManualPhase(phase)` | Lock to specific phase, disable automatic transitions |
| `resumeAuto()` | Resume automatic phase detection |
| `forcePhase(phase)` | Force immediate transition to phase (from UI) |

**Use Cases:**
- **Testing**: Lock to TAKEOFF to test rotation logic
- **Special procedures**: Hold in CRUISE for fuel dumping
- **Emergency**: Force APPROACH for missed approach practice

---

## Progress Tracking

### Progress Percentage

The flight phase provides a **0-100% progress** indicator based on the current phase.

**Calculation:**
```javascript
getProgress() {
    return Math.round((this.phaseIndex / (this.PHASES.length - 1)) * 100);
}
```

**Phase Progress:**

| Phase | Phase Index | Progress % |
|-------|-------------|------------|
| PREFLIGHT | 0 | 0% |
| TAXI | 1 | 14% |
| TAKEOFF | 2 | 29% |
| CLIMB | 3 | 43% |
| CRUISE | 4 | 57% |
| DESCENT | 5 | 71% |
| APPROACH | 6 | 86% |
| LANDING | 7 | 100% |

**UI Display:**
```javascript
const progress = flightPhase.getProgress();
progressBar.style.width = progress + '%';
progressLabel.textContent = `${progress}% Complete`;
```

### Phase Age

Track how long the aircraft has been in the current phase:

```javascript
const phaseAge = flightPhase._phaseAge();  // Milliseconds since phase entry
console.log(`In ${phase} for ${(phaseAge / 1000).toFixed(0)} seconds`);
```

**Use Cases:**
- **Transition delays**: Require minimum phase age before transition (e.g., CRUISE → DESCENT after 30 seconds)
- **Performance metrics**: Log phase durations
- **Timeout detection**: Alert if stuck in phase too long

---

## API Reference

### FlightPhase Methods

#### `update(flightData)`

Evaluate phase transitions based on current flight data.

**Parameters:**
- `flightData` (Object): WebSocket flight data

**Returns:** (String) Current phase name

**Example:**
```javascript
const phase = flightPhase.update({
    altitude: 8500,
    altitudeAGL: 3100,
    speed: 100,
    groundSpeed: 105,
    verticalSpeed: 0,
    heading: 270,
    onGround: false,
    engineRunning: true,
    gearDown: false
});
// Returns: 'CRUISE'
```

---

#### `setManualPhase(phase)`

Lock to specific phase, disable automatic transitions.

**Parameters:**
- `phase` (String): Phase name ('PREFLIGHT', 'TAXI', etc.)

**Example:**
```javascript
flightPhase.setManualPhase('CRUISE');
// Phase locked to CRUISE
```

---

#### `resumeAuto()`

Resume automatic phase detection.

**Example:**
```javascript
flightPhase.resumeAuto();
// Automatic transitions resume
```

---

#### `forcePhase(phase)`

Force immediate transition to phase (from takeoff tuner UI).

**Parameters:**
- `phase` (String): Phase name

**Example:**
```javascript
flightPhase.forcePhase('TAKEOFF');
// Immediately transition to TAKEOFF
```

---

#### `getProgress()`

Get progress percentage (0-100) through flight phases.

**Returns:** (Number) Progress percentage

**Example:**
```javascript
const progress = flightPhase.getProgress();
// Returns: 57 (if in CRUISE phase)
```

---

#### `setCruiseAlt(altitude)`

Set target cruise altitude.

**Parameters:**
- `altitude` (Number): Target cruise altitude in feet MSL

**Example:**
```javascript
flightPhase.setCruiseAlt(10500);
// Target cruise altitude set to 10,500 MSL
```

---

#### `setDestinationDist(nm)`

Set distance to destination for TOD calculation.

**Parameters:**
- `nm` (Number): Distance to destination in nautical miles

**Called by**: `pane.js` when nav-state received from GTN750

---

#### `setFieldElevation(ft)`

Set field elevation for AGL calculations.

**Parameters:**
- `ft` (Number): Field elevation in feet MSL

---

#### `getState()`

Get current state for serialization.

**Returns:**
```javascript
{
    phase: 'CRUISE',
    phaseIndex: 4,
    progress: 57,
    targetCruiseAlt: 8500,
    manualPhase: false,
    phaseAge: 120500  // milliseconds
}
```

---

## Examples

### Example 1: Complete IFR Flight (KAPA → KDEN)

**Flight Plan**: KAPA (departure) → KDEN (destination), 42.3nm

**Phase Timeline:**

| Time | Phase | Altitude | Speed | Event |
|------|-------|----------|-------|-------|
| 00:00 | PREFLIGHT | 0 AGL | 0 kt | Engine start |
| 00:30 | TAXI | 0 AGL | 5 kt | Taxi to runway 17L |
| 05:00 | TAXI | 0 AGL | 0 kt | Hold short, request takeoff clearance |
| 05:30 | TAKEOFF | 0 AGL | 0 kt | **BEFORE_ROLL** — Line up runway 17L |
| 05:35 | TAKEOFF | 0 AGL | 25 kt | **ROLL** — Full power, accelerating |
| 06:05 | TAKEOFF | 0 AGL | 55 kt | **ROTATE** — Vr reached, pitch up |
| 06:10 | TAKEOFF | 15 AGL | 62 kt | **LIFTOFF** — Airborne, maintain climb |
| 06:25 | TAKEOFF | 250 AGL | 68 kt | **INITIAL_CLIMB** — Autopilot handoff |
| 06:40 | TAKEOFF | 520 AGL | 72 kt | **DEPARTURE** — Flaps retract, AP engaged |
| 06:45 | CLIMB | 600 AGL | 76 kt | Climb to 8,500 MSL |
| 11:30 | CRUISE | 8,500 MSL | 100 kt | Level off, cruise power |
| 33:00 | CRUISE | 8,500 MSL | 100 kt | TOD point (9.3nm from KDEN) |
| 33:00 | DESCENT | 8,500 MSL | 100 kt | Descend at -500 fpm |
| 38:00 | DESCENT | 6,000 MSL | 90 kt | 1,800 AGL, prepare for approach |
| 38:00 | APPROACH | 6,000 MSL | 85 kt | Final approach, APR mode |
| 40:30 | APPROACH | 5,600 MSL | 70 kt | Flaps 1 deployed |
| 41:00 | APPROACH | 5,550 MSL | 65 kt | 150 AGL, full flaps |
| 41:15 | LANDING | 5,420 MSL | 60 kt | 20 AGL, flare for touchdown |
| 41:30 | LANDING | 5,400 MSL | 45 kt | Touchdown, rollout |
| 42:00 | TAXI | 0 AGL | 10 kt | Exit runway, taxi to parking |

**Total Flight Time**: 42 minutes

---

### Example 2: Go-Around (APPROACH → CLIMB)

**Scenario**: Unstable approach, pilot initiates go-around at 800 AGL

**Phase Transition:**

| Time | Phase | Altitude | Event |
|------|-------|----------|-------|
| 40:00 | APPROACH | 6,000 MSL (1,600 AGL) | Final approach, descending |
| 40:45 | APPROACH | 5,800 MSL (800 AGL) | Unstable approach detected |
| 40:50 | APPROACH | 5,850 MSL (850 AGL) | Pilot adds power, pitch up |
| 41:00 | CLIMB | 6,200 MSL (1,200 AGL) | **Go-around detected** (alt gain + VS > 300) |
| 41:30 | CLIMB | 7,000 MSL (2,000 AGL) | Climbing, re-enter pattern |

**Go-Around Detection:**
```javascript
// flight-phase.js:127-130
if (alt > this.targetCruiseAlt - 500 && vs > 300) {
    // Missed approach / go-around
    this._setPhase('CLIMB');
}
```

---

### Example 3: Mid-Flight Engagement (Catch-Up)

**Scenario**: Page reloaded while cruising at 8,500 MSL

**Catch-Up Logic:**

```javascript
// Aircraft state at page load:
altitude: 8,500 MSL
altitudeAGL: 3,100 AGL
speed: 100 kt
verticalSpeed: 0 fpm
onGround: false

// Catch-up detects cruising state
// flight-phase.js:58
if (alt >= this.targetCruiseAlt - 200) {
    this._setPhase('CRUISE');
}

// Result: Immediate transition to CRUISE (skips PREFLIGHT/TAXI/TAKEOFF/CLIMB)
```

---

## Troubleshooting

### Issue 1: "Phase stuck in TAKEOFF, won't advance to CLIMB"

**Symptom**: Aircraft airborne, climbing, but still in TAKEOFF phase

**Cause**: AGL < 500ft (transition requires AGL > 500)

**Diagnosis:**
```javascript
console.log('Altitude AGL:', flightData.altitudeAGL);
console.log('On ground:', flightData.onGround);
```

**Fix**:
- Ensure AGL > 500ft before transition
- Check field elevation is set correctly (`setFieldElevation()`)
- Verify `onGround` SimVar is false

---

### Issue 2: "Phase transitions too quickly from TAXI to TAKEOFF"

**Symptom**: Phase changes to TAKEOFF at low ground speed (15-20kt)

**Cause**: Transition threshold is GS > 25kt

**Fix**:
- Lower threshold (not recommended — 25kt is standard for takeoff roll)
- Check ATC clearance gate (may be bypassing clearance check)

---

### Issue 3: "CRUISE → DESCENT not triggering at TOD"

**Symptom**: Aircraft passes TOD point, stays in CRUISE

**Cause**: `destinationDist` not being updated (GTN750 not broadcasting)

**Diagnosis:**
```javascript
console.log('Dest dist:', flightPhase.destinationDist);
console.log('TOD dist:', (flightPhase.targetCruiseAlt - altitude) / 1000 * 3);
```

**Fix**:
- Ensure GTN750 flight plan is active
- Check nav-state broadcast includes `destDistNm`
- Manual descent fallback: Descend with VS < -300 for 30+ seconds

---

### Issue 4: "Phase manually set, won't resume automatic"

**Symptom**: Called `setManualPhase('CRUISE')`, now stuck in CRUISE

**Cause**: Manual phase lock prevents automatic transitions

**Fix**:
```javascript
flightPhase.resumeAuto();
// Automatic transitions resume
```

---

### Issue 5: "Go-around not detected during LANDING"

**Symptom**: Aircraft airborne again, still in LANDING phase

**Cause**: AGL < 500ft (go-around requires AGL > 500)

**Diagnosis:**
```javascript
console.log('AGL:', flightData.altitudeAGL);
console.log('On ground:', flightData.onGround);
```

**Fix**:
- Climb to AGL > 500ft
- Phase will transition to CLIMB automatically

---

### Issue 6: "TAXI → PREFLIGHT transition unwanted"

**Symptom**: Engine running, taxiing, but phase reverts to PREFLIGHT

**Cause**: GS < 1kt AND `engineRunning = false`

**Diagnosis:**
```javascript
console.log('Engine running:', flightData.engineRunning);
console.log('Ground speed:', flightData.groundSpeed);
```

**Fix**:
- Ensure engine is actually running (check MSFS engine state)
- Check SimConnect `engineRunning` SimVar is true
- If engine actually shutdown, transition is correct

---

## Related Documentation

- **[README.md](README.md)** — Main AI Autopilot overview, quick start, all features
- **[ATC-GUIDE.md](ATC-GUIDE.md)** — ATC ground operations, taxi clearance, phraseology
- **[WEATHER-GUIDE.md](WEATHER-GUIDE.md)** — Wind compensation, crosswind, turbulence
- **[NAVIGATION-GUIDE.md](NAVIGATION-GUIDE.md)** — GTN750 integration, course intercept, waypoint tracking

---

## Version History

### v3.0 (February 2026)
- 8 sequential flight phases with automatic transitions
- Takeoff sub-phases (6 sub-phases: BEFORE_ROLL → DEPARTURE)
- ATC integration (taxi-to-takeoff clearance gate)
- Catch-up logic for mid-flight engagement
- Manual phase control for testing
- Progress tracking (0-100%)
- Go-around detection (APPROACH/LANDING → CLIMB)
- TOD calculation from destination distance

### v2.0 (January 2026)
- 6 flight phases (no PREFLIGHT/TAXI)
- Basic automatic transitions
- No catch-up logic

### v1.0 (December 2025)
- Initial phase system
- Manual phase control only

---

**Document Status**: COMPLETE ✅
**Test Coverage**: 250/250 tests passing (0.21s)
**Production**: Deployed to commander-pc (192.168.1.42:8080)
**Last Updated**: February 14, 2026
