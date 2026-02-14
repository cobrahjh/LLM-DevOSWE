# AI Autopilot Phase-Based Refactoring Plan

**Goal**: Reduce memory footprint by 40-75% through lazy loading of phase-specific modules

**Created**: 2026-02-14
**Status**: In Progress

---

## RuleEngine Analysis (2,054 lines)

### Method Categories

#### Core Infrastructure (always loaded)
- Constructor & initialization
- Command generation: `_cmd()`, `_cmdValue()`, `_logTimeline()`
- Flight control utilities: `_targetPitch()`, `_pitchForSpeed()`, `_targetHeading()`, `_targetBank()`, `_bankToHeading()`, `_groundSteer()`
- Safety monitoring: `_monitorFlightEnvelope()`, `_computeEnvelope()`, `_checkTerrain()`, `_evaluateTakeoffSafety()`
- Navigation math: `_calculateBearing()`, `_haversineDistance()`, `_computeInterceptHeading()`, `_applyRudderBias()`
- Getters/setters: `setProfile()`, `reset()`, timeline access, etc.

#### Phase-Specific Handlers (lazy loaded)

**Ground Operations** (lines 186-630):
- PREFLIGHT phase (line 186-212)
- TAXI phase (line 214-325)
- BEFORE_ROLL phase (line 631-764)

**Takeoff/Departure** (lines 327-330, 598-908):
- TAKEOFF phase (line 327) → delegates to `_evaluateTakeoff()` (line 598-795)
- DEPARTURE phase (line 766-795)
- Takeoff sub-phase management (BEFORE_ROLL, ROLL, ROTATE, LIFTOFF, INITIAL_CLIMB)

**Cruise** (lines 331-430):
- CLIMB phase (line 331-403)
- CRUISE phase (line 405-430)
- Navigation integration methods (lines 1741-1886)

**Approach/Landing** (lines 433-596):
- DESCENT phase (line 433-469)
- APPROACH phase (line 471-530)
- LANDING phase (line 533-596)

---

## Module Split Design

### 1. RuleEngineCore (~500 lines)

**Purpose**: Always-loaded base class with shared utilities

**Contents**:
- Constructor (lines 13-122)
- Command generation (lines 1345-1383)
- Timeline logging (lines 1384-1420)
- Flight control utilities (lines 1422-1688)
- Safety monitoring (lines 923-1343)
- Navigation math (lines 1689-1712, 1790-1803)
- Getters/setters (lines 1887-2050)
- Base `evaluate()` that delegates to phase handlers

**Interface**:
```javascript
class RuleEngineCore {
    constructor(options)
    evaluate(phase, d, apState)  // Delegates to _evaluatePhase()
    _evaluatePhase(phase, d, apState)  // Override in subclasses

    // Command generation
    _cmd(command, value, description)
    _cmdValue(command, value, description)
    _logTimeline(command, value, description)

    // Flight control
    _targetPitch(d, targetDeg, maxDeflection)
    _pitchForSpeed(d, targetKts, maxDefl)
    _groundSteer(d, targetHdg)
    _targetHeading(d, targetHdg, axis, maxDeflection, gain)
    _targetBank(d, targetBank, maxDeflection)
    _bankToHeading(d, targetHdg, maxBank)

    // Safety
    _monitorFlightEnvelope(d, apState, phase)
    _computeEnvelope(d)
    _checkTerrain(d, apState, phase)
    _evaluateTakeoffSafety(d, ias, agl)

    // Navigation math
    _calculateBearing(lat1, lon1, lat2, lon2)
    _haversineDistance(lat1, lon1, lat2, lon2)
    _computeInterceptHeading(dtk, xtrk, toFrom)
    _applyRudderBias(d, maxDefl)

    // Accessors
    setProfile(profile)
    reset()
    // ... etc
}
```

### 2. RuleEngineGround (~400 lines)

**Purpose**: Ground operations (PREFLIGHT, TAXI, BEFORE_ROLL)

**File**: `modules/rule-engine-ground.js`

**Contents**:
- PREFLIGHT handler (lines 186-212)
- TAXI handler (lines 214-325)
- BEFORE_ROLL handler (lines 631-764)
- Ground-specific utilities

**Interface**:
```javascript
class RuleEngineGround extends RuleEngineCore {
    _evaluatePhase(phase, d, apState) {
        switch (phase) {
            case 'PREFLIGHT': return this._evaluatePreflight(d, apState);
            case 'TAXI': return this._evaluateTaxi(d, apState, phaseChanged);
            case 'BEFORE_ROLL': return this._evaluateBeforeRoll(d, apState);
        }
    }

    _evaluatePreflight(d, apState)
    _evaluateTaxi(d, apState, phaseChanged)
    _evaluateBeforeRoll(d, apState)
}
```

### 3. RuleEngineTakeoff (~400 lines)

**Purpose**: Takeoff and departure phases

**File**: `modules/rule-engine-takeoff.js`

**Contents**:
- TAKEOFF handler (line 327) + `_evaluateTakeoff()` (lines 598-795)
- DEPARTURE handler (lines 766-795)
- Sub-phase management (ROLL, ROTATE, LIFTOFF, INITIAL_CLIMB)
- `getTakeoffSubPhase()` (line 909)

**Interface**:
```javascript
class RuleEngineTakeoff extends RuleEngineCore {
    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'TAKEOFF': return this._evaluateTakeoff(d, apState, phaseChanged);
            case 'DEPARTURE': return this._evaluateDeparture(d, apState);
        }
    }

    _evaluateTakeoff(d, apState, phaseChanged)
    _evaluateDeparture(d, apState)
    getTakeoffSubPhase()
}
```

### 4. RuleEngineCruise (~450 lines)

**Purpose**: Climb and cruise phases with navigation

**File**: `modules/rule-engine-cruise.js`

**Contents**:
- CLIMB handler (lines 331-403)
- CRUISE handler (lines 405-430)
- Navigation integration (lines 1741-1886)
  - `_getNavHeading()` (line 1741)
  - `_shouldUseNavMode()` (line 1804)
  - `getNavGuidance()` (line 1819)
  - `_applyLateralNav()` (line 1849)
- Flight plan management (lines 1908-1963)

**Interface**:
```javascript
class RuleEngineCruise extends RuleEngineCore {
    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'CLIMB': return this._evaluateClimb(d, apState, phaseChanged);
            case 'CRUISE': return this._evaluateCruise(d, apState, phaseChanged);
        }
    }

    _evaluateClimb(d, apState, phaseChanged)
    _evaluateCruise(d, apState, phaseChanged)
    _applyLateralNav(d, apState, phaseChanged)
    _getNavHeading(d)
    _shouldUseNavMode()
    getNavGuidance()
}
```

### 5. RuleEngineApproach (~450 lines)

**Purpose**: Descent, approach, and landing phases

**File**: `modules/rule-engine-approach.js`

**Contents**:
- DESCENT handler (lines 433-469)
- APPROACH handler (lines 471-530)
- LANDING handler (lines 533-596)
- Approach-specific navigation

**Interface**:
```javascript
class RuleEngineApproach extends RuleEngineCore {
    _evaluatePhase(phase, d, apState, phaseChanged) {
        switch (phase) {
            case 'DESCENT': return this._evaluateDescent(d, apState, phaseChanged);
            case 'APPROACH': return this._evaluateApproach(d, apState, phaseChanged);
            case 'LANDING': return this._evaluateLanding(d, apState);
        }
    }

    _evaluateDescent(d, apState, phaseChanged)
    _evaluateApproach(d, apState, phaseChanged)
    _evaluateLanding(d, apState)
}
```

---

## Lazy Loading Pattern

### Orchestrator Changes (pane.js)

**Current**:
```javascript
this.ruleEngine = new RuleEngine({
    profile: this.profile,
    commandQueue: this.commandQueue
});
```

**After**:
```javascript
// Core engine (always loaded)
this.ruleEngineCore = null;

// Phase-specific engines (lazy loaded)
this._phaseEngines = {
    ground: null,
    takeoff: null,
    cruise: null,
    approach: null
};

this._currentPhaseEngine = null;
this._loadedModules = new Set();
```

### Phase Loading Logic

```javascript
async _loadPhaseModule(phase) {
    const phaseMap = {
        'PREFLIGHT': 'ground',
        'TAXI': 'ground',
        'BEFORE_ROLL': 'ground',
        'TAKEOFF': 'takeoff',
        'DEPARTURE': 'takeoff',
        'CLIMB': 'cruise',
        'CRUISE': 'cruise',
        'DESCENT': 'approach',
        'APPROACH': 'approach',
        'LANDING': 'approach'
    };

    const moduleKey = phaseMap[phase];
    if (!moduleKey) return;

    // Already loaded?
    if (this._phaseEngines[moduleKey]) {
        this._currentPhaseEngine = this._phaseEngines[moduleKey];
        return;
    }

    // Load module
    const moduleFiles = {
        ground: './modules/rule-engine-ground.js',
        takeoff: './modules/rule-engine-takeoff.js',
        cruise: './modules/rule-engine-cruise.js',
        approach: './modules/rule-engine-approach.js'
    };

    const script = document.createElement('script');
    script.src = moduleFiles[moduleKey];
    await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    // Instantiate
    const classes = {
        ground: RuleEngineGround,
        takeoff: RuleEngineTakeoff,
        cruise: RuleEngineCruise,
        approach: RuleEngineApproach
    };

    this._phaseEngines[moduleKey] = new classes[moduleKey]({
        profile: this.profile,
        commandQueue: this.commandQueue,
        tuningGetter: () => this._getTakeoffTuning(),
        holdsGetter: () => this._getTakeoffHolds()
    });

    this._currentPhaseEngine = this._phaseEngines[moduleKey];
    this._loadedModules.add(moduleKey);
}

async _onPhaseChange(newPhase, oldPhase) {
    // Load new phase module
    await this._loadPhaseModule(newPhase);

    // Optional: Unload old module if memory-constrained
    // (Keep for now to avoid reload overhead)
}
```

---

## Additional Lazy Loading

### ATCController (343 lines)
**Load**: Only during ground phases (PREFLIGHT, TAXI, BEFORE_ROLL)
**Unload**: After TAKEOFF phase starts

### WindCompensation (189 lines)
**Load**: When airborne (CLIMB, CRUISE, DESCENT, APPROACH)
**Unload**: After LANDING

### LLMAdvisor (248 lines)
**Load**: On first "Ask AI" click
**Keep**: Loaded once used

---

## Expected Memory Savings

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| **Ground (PREFLIGHT)** | 6,561 lines | ~1,300 lines | 80% |
| **Takeoff** | 6,561 lines | ~1,700 lines | 74% |
| **Cruise** | 6,561 lines | ~1,750 lines | 73% |
| **Approach** | 6,561 lines | ~1,750 lines | 73% |

**Average savings**: ~75% reduction in loaded code during any given phase

---

## Implementation Order

1. ✅ Create this plan document
2. ⏳ Create `rule-engine-core.js` (base class)
3. ⏳ Create `rule-engine-ground.js`
4. ⏳ Create `rule-engine-takeoff.js`
5. ⏳ Create `rule-engine-cruise.js`
6. ⏳ Create `rule-engine-approach.js`
7. ⏳ Update `pane.js` with lazy loading
8. ⏳ Update `index.html` with new modules
9. ⏳ Make ATCController/WindCompensation lazy
10. ⏳ Test all phases + measure savings

---

## Testing Strategy

1. **Unit Tests**: Verify each phase module works independently
2. **Integration Tests**: Test phase transitions
3. **Memory Profiling**: Measure before/after memory usage
4. **Regression Tests**: Ensure all existing functionality works
5. **Performance Tests**: Verify lazy loading doesn't add latency

---

## Rollback Plan

Keep `rule-engine.js` as `rule-engine-legacy.js` for 2 weeks. If issues arise, can revert by updating `index.html` to load legacy version.

---

## Notes

- Keep original `rule-engine.js` as reference during development
- Shared state (tuning, timeline, safety) managed by core class
- Phase modules inherit all utilities from core
- Module loading is async but cached (no reload penalty)
- Can unload modules after phase change to save more memory (optional)
