# Sally — Command Pipeline & Learning System

**Last updated:** 2026-02-17
**Status:** Production architecture

---

## Overview

Sally has two parallel systems that work together:

1. **Rule Engine** — deterministic, runs at 30Hz, flies the plane
2. **LLM Advisor** — statistical, runs every 60s, tunes the rule engine

---

## Layer 1 — Flight Data (SimConnect → Server)

SimConnect streams flight data to `server.js` at ~30Hz via `simObjectData` events.

Data fields used by Sally include:
- `altitude`, `altitudeAGL`, `speed` (IAS), `groundSpeed`, `verticalSpeed`
- `heading`, `pitch`, `bank`
- `onGround`, `engineRpm`, `throttle`, `flapsIndex`, `gearDown`
- `apMaster`, `apHdgLock`, `apAltLock`, `apVsLock`, `apSpdLock`, `apNavLock`, `apAprLock`
- `latitude`, `longitude` (for ATC waypoint tracking)

The parsed `fd` object is passed to `ruleEngineServer.evaluate(fd)` every frame.

---

## Layer 2 — Rule Engine Server (30Hz decision loop)

**File:** `backend/ai-autopilot/rule-engine-server.js`

On every SimConnect frame:

```
SimConnect data → evaluate(fd)
  → flightPhase.update(fd)       // advance phase state machine
  → select phaseEngine           // pick engine for current phase
  → phaseEngine.evaluate(...)    // run phase rules
  → commandQueue.enqueue(cmd)    // buffer command
  → commandQueue.flush()         // send deduplicated commands
  → _directExecute(wsCmd)        // call server executeCommand()
```

**Phase engines loaded upfront (server doesn't lazy-load):**

| Phase | Engine |
|-------|--------|
| PREFLIGHT, TAXI | `RuleEngineGround` |
| TAKEOFF, DEPARTURE | `RuleEngineTakeoff` |
| CLIMB, CRUISE | `RuleEngineCruise` |
| DESCENT, APPROACH, LANDING | `RuleEngineApproach` |

---

## Layer 3 — Command Dispatch (server.js `executeCommand`)

**File:** `backend/server.js:2988`

Each command is routed to the correct MSFS 2024 interface:

| Command | Method | MSFS Interface |
|---------|--------|----------------|
| `THROTTLE_SET` | InputEvent | `ENGINE_THROTTLE_1` hash (0.0–1.0) |
| `AXIS_ELEVATOR_SET` | Legacy SimConnect | `transmitClientEvent` → -16383..+16383 |
| `AXIS_AILERONS_SET` | Legacy SimConnect | `transmitClientEvent` → -16383..+16383 |
| `AXIS_RUDDER_SET` | Legacy SimConnect | `transmitClientEvent` → -16383..+16383 |
| `STEERING_SET` | Legacy SimConnect | `transmitClientEvent` → -16383..+16383 |
| `PARKING_BRAKE_SET` | InputEvent | `LANDING_GEAR_PARKINGBRAKE` hash |
| `AP_MASTER` etc. | SimConnect event | `transmitClientEvent` via `eventMap` |
| `QUICK_PREFLIGHT` | SimConnect event | `PROCEDURE_AUTOSTART` or Ctrl+Q keypress |
| `ENGINE_AUTO_START` | SimConnect event | `ENGINE_AUTO_START` event |

### Held-Axes System (120Hz)

Flight controls (elevator, ailerons, rudder, throttle, steering) are **held**, not just sent once.

Once a non-zero value is set, `_heldAxes` stores it and `reapplyHeldAxes()` fires every **8ms (~120Hz)** to continuously override the joystick spring-center. This is what gives Sally authority over the physical joystick.

Setting a control to exactly **0** removes it from `_heldAxes` and the joystick regains control of that axis.

---

## Layer 4 — Command Value Conventions

Rule engine uses -100..+100 internally. `executeCommand` scales to SimConnect range:

| Control | Rule engine | SimConnect |
|---------|------------|-----------|
| Elevator | -100 = nose UP | -16383 = nose UP |
| Ailerons | -100 = roll LEFT | -16383 = roll LEFT |
| Rudder | +100 = yaw LEFT | +16383 = yaw LEFT |
| Throttle | 0..100% | 0.0..1.0 InputEvent |

> **LOCKED CONVENTIONS** — verified 2026-02-12. Do not change signs without in-sim test.

---

## Takeoff Sequence (Rule Engine Sub-Phases)

```
PREFLIGHT
  → QUICK_PREFLIGHT (remove chocks/covers)
  → Mixture RICH, brake release, idle throttle
  → Engine auto-start if RPM < 500
  → [engine RPM ≥ 500 OR throttle > 10%] → TAXI

TAXI
  → ENGINE_AUTO_START retry every 8s if still not running
  → ATC taxi route if available, else hold runway heading
  → Ground steer to waypoints / runway heading
  → Throttle: breakaway 40% → target 12kt GS
  → [GS > 25kt, ATC INACTIVE or CLEARED_TAKEOFF] → TAKEOFF

TAKEOFF sub-phases:
  BEFORE_ROLL  — center controls, release brake, ground steer
  ROLL         — full power (100%), wings level, steer runway, wait for Vr (55kt)
  ROTATE       — elevator -3% to -8% progressively, wings level, nose up trim
  LIFTOFF      — elevator -5%, wings level, wait for VS > 100 + AGL > 200ft
  INITIAL_CLIMB— elevator -4%, wait for IAS ≥ Vs1+15 (68kt) + AGL > 500ft
               — release controls, engage AP_MASTER + HDG_HOLD + VS_HOLD
  DEPARTURE    — retract flaps, set Vy speed (74kt), set cruise altitude
               → [AGL > 500ft] → CLIMB (flight-phase.js)
```

---

## Takeoff Speed Reference (C172 profile)

| Speed | KIAS | Purpose |
|-------|------|---------|
| Vr | 55 | Rotation (begin elevator pull) |
| Vs1 | 53 | Stall clean — used to compute AP handoff margin |
| AP handoff | Vs1 + 15 = 68 | Minimum safe speed to engage AP |
| Vx | 62 | Best angle climb |
| Vy | 74 | Best rate climb (departure target) |
| Vcruise | 110 | Normal cruise |

All speeds overridable via takeoff-tuner.html (`localStorage` key `simglass-takeoff-tuning`).

---

## Sally's Memory — What She Learns

### 1. Takeoff Tuning Parameters (persistent overrides)

Stored in `localStorage` (browser) and sent to server via `/api/ai-pilot/shared-state`.
Applied via `tuningGetter` in all rule engine instances.

Key tunable values:

| Parameter | Default | What it controls |
|-----------|---------|-----------------|
| `vrSpeed` | 55kt | Rotation speed |
| `rotateElevator` | -8% | Max elevator during ROTATE |
| `liftoffElevator` | -5% | Elevator during LIFTOFF |
| `climbElevator` | -4% | Elevator during INITIAL_CLIMB |
| `rollThrottle` | 100% | Throttle during ROLL |
| `handoffAgl` | 500ft | AGL to engage AP and hand off |
| `handoffSpeedMargin` | 15kt | Added to Vs1 for AP handoff speed |
| `liftoffAileronGain` | 3 | Bank correction strength |
| `departureVS` | 500fpm | VS target after AP handoff |

### 2. Takeoff Attempt Telemetry (per-flight data)

Tracked in `pane.js _trackTakeoffAttempt()` during TAKEOFF phase.
Saved via `POST /api/ai-pilot/takeoff-attempt`.

Per attempt records:
- Phases reached: `BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE`
- `rotateSpeed` — actual IAS when rotation started
- `liftoffSpeed` — actual IAS at wheel lift
- `maxAltGain`, `maxBank`, `maxPitch`, `minPitch`, `maxVs`, `minVs`
- `maxElevator`, `maxAileron`, `maxRudder` — max control surface deflections used
- Timeline: 2-second snapshots of IAS, VS, pitch, bank, AGL, control surfaces, sub-phase

### 3. LLM Learnings (cross-flight observations)

**File:** `backend/data/sally-learnings.json`

The LLM advisor writes `LEARNING: [confidence%] observation` lines in its response.
Server parses and persists these. If the same conclusion is reached twice, confidence auto-boosts.

```
LEARNING: [85%] Effective elevator authority is ~50% of commanded — joystick spring fights correction
LEARNING: [70%] Higher taxi throttle needed for breakaway due to limited nosewheel authority
```

Current learnings (2 stored):
- #1 [75%] Joystick fighting commands — effective authority ~50%
- #2 [65%] Higher throttle needed for ground steering

The LLM can also output `FORGET: #id` to remove a learning when evidence contradicts it.

### 4. LLM Tuning Output (applied to next attempt)

The LLM advisor outputs `TUNING_JSON: {param: value, ...}` after analyzing telemetry.
This directly adjusts Sally's rule engine parameters for the next flight.

Example:
```json
TUNING_JSON: {"rotateElevator": -10, "handoffSpeedMargin": 20}
```

### 5. Rule Engine State (restart recovery)

**File:** `backend/ai-autopilot/.rule-engine-state.json`

Stores `{ enabled, cruiseAlt }`. Auto-loaded on server start — Sally re-enables herself
after a server restart if she was flying before.

---

## LLM Advisor Context (what Sally sees when asked)

When the LLM advisory fires, it receives:
- Current flight data (altitude, speed, heading, VS, AP states)
- Full list of tunable parameters with current values and descriptions
- Last N takeoff attempt records with full telemetry + timeline
- All stored learnings with confidence levels and reinforcement counts
- Takeoff outcome (success/crash/abort) if applicable

The LLM outputs:
1. Analysis (2-3 sentences)
2. `TUNING_JSON: {...}` — parameter updates for next attempt
3. `LEARNING: [n%] ...` — new observations to persist
4. `FORGET: #id` — retract outdated learnings

---

## Full Pipeline Diagram

```
MSFS 2024 sim
    │ SimConnect (~30Hz)
    ▼
server.js — simObjectData handler
    │ fd = parsed flight data
    ▼
RuleEngineServer.evaluate(fd)
    │
    ├─ flightPhase.update(fd)          ← advances PREFLIGHT→TAXI→TAKEOFF→...
    │
    ├─ phaseEngine.evaluate(phase, fd) ← phase-specific rules
    │       PREFLIGHT: quick_preflight, brake, idle throttle
    │       TAXI:      engine start, ATC steer, speed control
    │       TAKEOFF:   BEFORE_ROLL→ROLL→ROTATE→LIFTOFF→INITIAL_CLIMB→DEPARTURE
    │       CLIMB:     AP altitude/VS hold
    │       CRUISE:    AP heading/speed hold
    │       APPROACH:  intercept, gear/flaps, glideslope
    │       LANDING:   flare, rollout, brake
    │
    ├─ commandQueue.enqueue(cmd)        ← deduplicates, rate-limits
    │
    └─ executeCommand(command, value)   ← dispatches to MSFS
            Throttle → InputEvent ENGINE_THROTTLE_1 (0–1.0)
            Elevator → transmitClientEvent AXIS_ELEVATOR_SET
            Ailerons → transmitClientEvent AXIS_AILERONS_SET
            Rudder   → transmitClientEvent AXIS_RUDDER_SET
            Steering → transmitClientEvent STEERING_SET
                │
                └─ _heldAxes (120Hz reapply) ← continuously overrides joystick

                        ↑
Every 60s (AI Has Controls mode):
LLM Advisor ← flight data + attempts + learnings
    │
    ├─ TUNING_JSON → update rule engine parameters
    └─ LEARNING:   → persist to sally-learnings.json
```

---

## Enabling Sally

Single action: click **"AI CONTROLS"** button in the pane UI.

This calls `POST /api/ai-autopilot/enable` which:
1. Starts the 30Hz rule engine evaluation loop
2. Saves enabled state to `.rule-engine-state.json` (auto-recovers on restart)
3. Starts the LLM advisory loop (every 60s)

Disabling calls `POST /api/ai-autopilot/disable` and releases all axes.
