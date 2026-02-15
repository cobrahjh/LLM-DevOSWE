# RuleEngineTakeoff Module

## Overview
Extracted takeoff and departure phase logic from the monolithic rule-engine.js into a dedicated module for memory optimization and maintainability.

## File Details
- **Path**: `/c/LLM-DevOSWE/simwidget-hybrid/ui/ai-autopilot/modules/rule-engine-takeoff.js`
- **Size**: 255 lines (~14KB)
- **Created**: 2026-02-14

## Structure

### Class: RuleEngineTakeoff
Extends `RuleEngineCore` with takeoff-specific logic.

### Constructor State
- `_takeoffSubPhase` - Current sub-phase within TAKEOFF
- `_rotateStartTime` - Timestamp when rotation began
- `_runwayHeading` - Runway heading for ground steering

### Methods

#### _evaluatePhase(phase, d, apState, phaseChanged)
Phase router that handles:
- TAKEOFF phase
- DEPARTURE phase (routed to _evaluateTakeoff)

#### _evaluateTakeoff(d, apState, phaseChanged)
Main takeoff handler managing 6 sub-phases:

1. **BEFORE_ROLL**
   - Center flight controls (0.0001 for held-axes)
   - Set mixture rich
   - Release parking brake
   - Ground steering to runway heading
   - Advance when groundSpeed > 3

2. **ROLL**
   - Maintain elevator neutral
   - Wings-level correction (aileron control)
   - Full throttle
   - Ground steering
   - Advance at Vr (rotation speed)

3. **ROTATE**
   - Progressive elevator (-3° to -8°, -2°/sec)
   - Wings-level during rotation
   - Trim nose up
   - Advance when airborne (onGround = false)

4. **LIFTOFF**
   - Maintain climb elevator (-5°)
   - Wings-level correction
   - Advance at 200+ AGL with positive VS

5. **INITIAL_CLIMB**
   - Maintain climb elevator (-4°)
   - Wings-level correction
   - Hand off to autopilot when safe (IAS > Vs1+15, AGL > 500)
   - Engage HDG and VS hold
   - Advance when AP master is on

6. **DEPARTURE**
   - Retract flaps
   - Set speed (Vy) and altitude (cruise)
   - Turn off landing lights
   - Flight-phase.js will transition to CLIMB at 500+ AGL

#### getTakeoffSubPhase()
Returns current sub-phase for debug display.

## Integration Points

### Dependencies (from RuleEngineCore)
- `_cmd(type, value, reason)` - Queue sim command
- `_cmdValue(type, value, reason)` - Queue value command
- `_groundSteer(d, heading)` - Rudder steering
- `_getTakeoffTuning()` - Get tuner overrides
- `_isPhaseHeld(phase)` - Check phase hold
- `_getCruiseAlt()` - Get cruise altitude
- `profile` - Aircraft performance profile
- `timeline` - Command history

### External Data
- Flight data object (heading, speed, AGL, bank, etc.)
- Autopilot state object (master, headingHold, etc.)
- Takeoff tuner overrides (localStorage)

## Testing
Validated via `test-phase-modules.js`:
- Instantiation
- Inheritance from RuleEngineCore
- Method presence
- Phase evaluation (TAKEOFF)
- Timeline generation
- Sub-phase initialization

All tests passing (255 lines, 6 commands in BEFORE_ROLL phase).

## Next Steps
This module follows the same pattern as `rule-engine-ground.js`. Remaining phases to extract:
- CLIMB (rule-engine-climb.js)
- CRUISE (rule-engine-cruise.js)
- DESCENT (rule-engine-descent.js)
- APPROACH (rule-engine-approach.js)
- LANDING (rule-engine-landing.js)
