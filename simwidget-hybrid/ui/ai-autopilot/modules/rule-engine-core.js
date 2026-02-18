/**
 * Rule Engine Core — Base Class for Phase-Specific Engines
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine-core.js
 *
 * Base class containing shared utilities used by all phase-specific rule engines.
 * Provides command generation, flight control math, safety monitoring, and navigation utilities.
 * Phase-specific logic (PREFLIGHT, TAKEOFF, CRUISE, etc.) is implemented in subclasses.
 *
 * Refactored 2026-02-14 for memory optimization via lazy loading.
 */

class RuleEngineCore {
    constructor(options = {}) {
        this.profile = options.profile || null;
        this.commandQueue = options.commandQueue || null;
        this._tuningGetter = options.tuningGetter || null;
        this._holdsGetter = options.holdsGetter || null;
        this._lastPhase = null;
        this._lastCommands = {};  // track what we last commanded per axis
        this._takeoffSubPhase = null;
        this._runwayHeading = null;  // captured at takeoff roll start
        this._runwayHeadingLocked = false;

        // Terrain awareness (uses shared singleton from terrain-grid.js)
        this._terrainGrid = (typeof window !== 'undefined' && window._terrainGrid) || null;
        this._terrainAlert = null;     // current terrain alert: null | 'CAUTION' | 'WARNING'
        this._lastTerrainCheck = 0;

        // Nav state from GTN750 (via SafeChannel)
        this._navState = null;
        this._externalTerrainAlert = null;  // from GTN750 TAWS: null | 'CAUTION' | 'WARNING'

        // Flight plan execution
        this._flightPlan = null;  // { name, waypoints[], cruiseAltitude, totalDistance }
        this._activeWaypointIndex = 0;

        // Airport/runway awareness
        this._airportData = null;  // { icao, name, elevation, runways[], distance, bearing }
        this._activeRunway = null; // { id, heading, length } — best match for current heading+wind

        // Flight envelope monitoring
        this._envelopeAlert = null;   // null | 'BANK' | 'STALL' | 'OVERSPEED' | 'PITCH'
        this._lastEnvelopeLog = 0;    // throttle debug logging
        this._bankCorrectionActive = false;
        this._speedCorrectionActive = false;

        // ATC controller reference (for taxi waypoint steering)
        this._atc = null;

        // Pitch rate tracking (for derivative term in _targetPitch)
        this._lastPitch = null;
        this._lastPitchTime = null;

        // Adaptive bias — learns torque/P-factor compensation from observed drift
        this._rollBias = 0;    // positive = right aileron bias (counters left torque)

        // Wind compensation calculator
        this._windComp = typeof WindCompensation !== 'undefined' ? new WindCompensation() : null;

        // Dynamic flight envelope (computed every frame)
        this._envelope = null;  // latest computed envelope snapshot

        // Rotation timing — for progressive back pressure
        this._rotateStartTime = null;

        // Live-tunable parameters — change from console: widget.ruleEngine.tuning.xxx = value
        this.tuning = {
            rotateAuthority: 15,      // % max elevator deflection during ROTATE
            liftoffAuthority: 15,     // % max elevator during LIFTOFF
            initialClimbAuthority: 15,// % max elevator during INITIAL_CLIMB
            rotatePitch: 8,           // target pitch (deg) during rotation
            liftoffPitch: 7,          // target pitch (deg) during liftoff <100ft
            pGain: 1.2,              // proportional gain (low authority)
            pGainHigh: 2.0,          // proportional gain (high authority, >40% maxDefl)
            dGain: 0.8,              // derivative damping
            speedScaleVr: 55,        // reference speed for scaling (kts)
            speedScaleFloor: 0.5,    // minimum speed factor
            speedScaleAgl: 200,      // AGL below which speed scaling is disabled
            // Lateral control during takeoff
            rudderAuthority: 20,      // % max rudder deflection (yaw)
            bankAuthority: 25,        // % max aileron deflection (roll)
            rudderBias: 15,           // constant right-rudder offset (%) to counter P-factor yaw
            aileronBias: 5,           // constant right-roll offset (%) to counter torque roll
            // Safety thresholds — Sally reads these to know her limits
            safetyMaxPitch: 15,       // pitch (deg) where correction starts
            safetyCriticalPitch: 25,  // pitch (deg) for emergency correction
            safetyStallMarginKt: 5,   // IAS margin above stall speed (kts)
            safetyBaseCorrection: 10, // starting elevator correction (%)
            safetyEscalationRate: 1.5,// multiplier per escalation step
            safetyMaxCorrection: 60,  // absolute max correction (%)
        };

        // Adaptive safety state — Sally tracks whether her corrections are working
        this._safety = {
            active: false,         // currently intervening
            reason: null,          // 'PITCH' | 'STALL' | 'BOTH'
            startTime: 0,          // when intervention started
            startPitch: 0,         // pitch when intervention began
            escalation: 0,         // how many times she's had to escalate (0-5)
            lastCorrection: 0,     // last elevator value she applied
            lastCheckTime: 0,      // last time she checked if correction is working
            improving: false,      // is the situation getting better?
        };

        // Timeline recorder — logs every command with context
        this.timeline = [];       // array of { t, phase, sub, cmd, val, pitch, ias, agl, vs, desc }
        this._timelineMax = 500;  // keep last 500 entries
        this._timelineStart = Date.now();

        // Live computed values — read-only snapshot for UI display
        this.live = {
            phase: '', subPhase: '',
            pitch: 0, targetPitch: 0, pitchError: 0,
            ias: 0, agl: 0,
            elevator: 0, pTerm: 0, dTerm: 0,
            speedFactor: 1, densityFactor: 1, effectiveMaxDefl: 0,
            rudder: 0, aileron: 0, throttle: 0,
            gain: 0, pitchRate: 0,
            // Safety state
            safetyActive: false, safetyReason: '', safetyEscalation: 0,
            safetyCorrection: 0, stallMarginKt: 0,
        };
    }

    /**
     * Main evaluation method - delegates to phase-specific implementation
     * Subclasses override _evaluatePhase() to provide phase-specific logic
     */
    evaluate(phase, d, apState) {
        if (!this.profile || !this.commandQueue || !d) return;

        const phaseChanged = phase !== this._lastPhase;
        this._lastPhase = phase;
        this.live.phase = phase;
        this.live.throttle = d.throttle || 0;

        // Update live state
        this.live.pitch = d.pitch || 0;
        this.live.ias = d.speed || 0;
        this.live.agl = d.agl || 0;

        // Common pre-processing
        if (this._windComp && d.verticalSpeed != null) {
            const turbulence = this._windComp.detectTurbulence(d.verticalSpeed);
            // Turbulence detection can be used by phase handlers
        }

        // Clear command queue state on phase change
        if (phaseChanged && this.commandQueue) {
            this.commandQueue.updateApState({});
        }

        // Common safety monitoring (skip for preflight/taxi)
        if (phase !== 'PREFLIGHT' && phase !== 'TAXI' && phase !== 'TAKEOFF') {
            this._monitorFlightEnvelope(d, apState, phase);
            this._checkTerrain(d, apState, phase);
        }

        // Delegate to phase-specific handler (implemented by subclass)
        this._evaluatePhase(phase, d, apState, phaseChanged);
    }

    /**
     * Phase-specific evaluation - override in subclasses
     * @param {string} phase - current flight phase
     * @param {Object} d - flight data
     * @param {Object} apState - autopilot state
     * @param {boolean} phaseChanged - true if phase just changed
     */
    _evaluatePhase(phase, d, apState, phaseChanged) {
        // Implemented by subclasses (RuleEngineGround, RuleEngineTakeoff, etc.)
        console.warn(`RuleEngineCore: _evaluatePhase not implemented for phase ${phase}`);
    }

    _cmd(command, value, description) {
        if (this._lastCommands[command] === value) return; // dedup
        this._lastCommands[command] = value;
        this._logTimeline(command, value, description);
        this.commandQueue.enqueue({
            type: command,
            value: value,
            description: description || command
        });
    }

    /**
     * Push a value-set AP command (altitude, speed, VS, heading)
     */
    _cmdValue(command, value, description) {
        const lastVal = this._lastCommands[command];
        const isAxis = command.startsWith('AXIS_');
        // AXIS_* commands are momentary SimConnect events — must send every tick
        // to maintain deflection. Only dedup non-axis AP commands.
        // Exception: THROTTLE_SET and MIXTURE_SET must resend periodically to
        // re-establish held-axes after server restart or InputEvent re-enumeration.
        const criticalControl = (command === 'THROTTLE_SET' || command === 'MIXTURE_SET' || command === 'MIXTURE_RICH');
        if (!isAxis && !criticalControl) {
            if (lastVal !== undefined && Math.abs(lastVal - value) < 1) return;
        }
        this._lastCommands[command] = value;
        // Track live values for telemetry (elevator/aileron/throttle)
        if (command === 'AXIS_ELEVATOR_SET') this.live.elevator = value;
        else if (command === 'AXIS_AILERONS_SET') this.live.aileron = value;
        else if (command === 'THROTTLE_SET') this.live.throttle = value;
        this._logTimeline(command, value, description);
        this.commandQueue.enqueue({
            type: command,
            value: value,
            description: description || `${command} \u2192 ${value}`,
            priority: isAxis ? 'high' : 'normal'  // axis controls process first
        });
    }

    _logTimeline(command, value, description) {
        const L = this.live;
        this.timeline.push({
            t: ((Date.now() - this._timelineStart) / 1000).toFixed(2),
            phase: L.phase,
            sub: L.subPhase,
            cmd: command,
            val: typeof value === 'number' ? Math.round(value * 100) / 100 : value,
            pitch: L.pitch?.toFixed(1),
            ias: Math.round(L.ias),
            agl: Math.round(L.agl),
            vs: Math.round(this.live.pitchRate || 0),
            elev: L.elevator?.toFixed(1),
            desc: description || '',
        });
        if (this.timeline.length > this._timelineMax) {
            this.timeline.splice(0, this.timeline.length - this._timelineMax);
        }
    }

    getTimeline() { return this.timeline; }

    clearTimeline() {
        this.timeline = [];
        this._timelineStart = Date.now();
    }

    // ── Feedback Control Methods ──────────────────────────────────
    // These observe actual flight state and compute proportional inputs
    // to reach a target. No hardcoded deflections — the AI adapts to
    // what the aircraft is actually doing.

    /**
     * Target a pitch angle — adjusts elevator proportionally.
     * If current pitch is below target, pulls back; above, pushes forward.
     * @param {Object} d - flight data
     * @param {number} targetDeg - desired pitch in degrees (positive = nose up)
    _targetPitch(d, targetDeg, maxDeflection) {
        const pitch = d.pitch || 0;
        const error = targetDeg - pitch;  // positive = need more nose up
        // Sign convention: negative elevator = nose up, positive elevator = nose down
        // Density altitude compensation: thinner air needs more control deflection.
        // At sea level factor=1.0, at 5000ft ~1.15, at 10000ft ~1.35
        const altMSL = d.altitude || 0;
        const densityFactor = 1 + Math.max(0, altMSL) / 30000;
        // Speed-based authority scaling: less deflection at higher speeds.
        // Only applies above speedScaleAgl — during takeoff roll/rotation need full authority.
        const ias = d.speed || 0;
        const agl = d.altitudeAGL || 0;
        const t = this.tuning;
        const speedFactor = (ias > t.speedScaleVr && agl > t.speedScaleAgl) ? Math.max(t.speedScaleFloor, t.speedScaleVr / ias) : 1.0;
        const maxDefl = (maxDeflection || 30) * densityFactor * speedFactor;

        // Proportional term: gain scales with authority needed
        const gain = maxDefl > 40 ? t.pGainHigh : t.pGain;
        const pTerm = -error * gain;

        // Derivative term: strong damping to prevent porpoising
        const now = Date.now();
        const dt = this._lastPitchTime ? (now - this._lastPitchTime) / 1000 : 0.2;
        const clampedDt = Math.max(0.05, Math.min(dt, 1.0));  // guard against weird dt values
        const pitchRate = (pitch - (this._lastPitch != null ? this._lastPitch : pitch)) / clampedDt; // deg/sec
        this._lastPitch = pitch;
        this._lastPitchTime = now;
        const dTerm = pitchRate * t.dGain;

        // Combined: capped at ±maxDefl
        let elevator = Math.max(-maxDefl, Math.min(maxDefl, pTerm + dTerm));

        // Progressive nose-down assist when approaching safety threshold (uses tuning)
        const safetyThresh = this.tuning.safetyMaxPitch - 3;  // start 3° before safety kicks in
        if (pitch > safetyThresh) {
            const emergencyPush = (pitch - safetyThresh) * 1.5;
            elevator = Math.max(-maxDefl, Math.min(maxDefl + 20, elevator + emergencyPush));
        }

        // Update live snapshot for UI
        const L = this.live;
        L.pitch = pitch; L.targetPitch = targetDeg; L.pitchError = error;
        L.ias = ias; L.agl = agl;
        L.elevator = elevator; L.pTerm = pTerm; L.dTerm = dTerm;
        L.speedFactor = speedFactor; L.densityFactor = densityFactor;
        L.effectiveMaxDefl = maxDefl; L.gain = gain; L.pitchRate = pitchRate;

        this._cmdValue('AXIS_ELEVATOR_SET', Math.round(elevator * 10) / 10,
            `Pitch ${pitch.toFixed(1)}° → ${targetDeg}° (elev ${elevator > 0 ? '+' : ''}${elevator.toFixed(1)})`);
    }

    /**
     * Pitch for speed — the core airmanship principle: "pitch controls airspeed."
     * If too fast → pitch up (trade speed for altitude).
     * If too slow → pitch down (trade altitude for speed).
     * Converts speed error into a pitch target, then delegates to _targetPitch.
     * @param {Object} d - flight data
     * @param {number} targetKts - desired indicated airspeed
     * @param {number} maxDefl - max elevator authority
     */
    _pitchForSpeed(d, targetKts, maxDefl) {
        const ias = d.speed || 0;
        const speedErr = ias - targetKts;  // positive = too fast, negative = too slow
        const pitch = d.pitch || 0;

        // Convert speed error to pitch target:
        // Each knot off target → ~0.5° pitch adjustment
        // Clamped to safe range: -5° (nose down recovery) to +15° (max climb)
        let pitchTarget = speedErr * 0.5;

        // During takeoff/liftoff, maintain minimum climb pitch — don't level off just because
        // IAS is below Vy. A real pilot holds pitch for climb, not dive for speed at 200ft.
        const isTakeoff = this._takeoffSubPhase === 'LIFTOFF' || this._takeoffSubPhase === 'INITIAL_CLIMB';
        const minPitch = isTakeoff ? this.tuning.liftoffPitch : 0;

        if (ias > (this.profile?.speeds?.Vs1 || 53)) {
            pitchTarget = Math.max(minPitch, pitchTarget);
        }

        pitchTarget = Math.max(-5, Math.min(15, pitchTarget));

        this._targetPitch(d, pitchTarget, maxDefl);
    }

    /**
     * Target a heading — adjusts rudder or ailerons proportionally.
     * Computes shortest-path heading error and applies correction.
     * @param {Object} d - flight data
     * @param {number} targetHdg - desired heading in degrees
     * @param {string} axis - 'AXIS_RUDDER_SET' or 'AXIS_AILERONS_SET'
     * @param {number} maxDeflection - max control input magnitude
     */
    /**
     * Ground steering — adaptive rudder + wings level for taxi/takeoff roll.
     * Rudder gain scales inversely with speed: more at low speed, less at high speed.
     * Max deflection also adapts: full authority at low speed, limited at high speed.
     */
    _groundSteer(d, targetHdg) {
        if (targetHdg == null) return;
        const gs = d.groundSpeed || 0;
        const hdg = d.heading || 0;
        const hdgError = ((hdg - targetHdg + 540) % 360) - 180;  // positive = drifted right

        const ttSteer = this._getTakeoffTuning();
        const isTakeoffPhase = this._takeoffSubPhase === 'ROLL' || this._takeoffSubPhase === 'ROTATE' || this._takeoffSubPhase === 'LIFTOFF';

        // Gain: taxi uses gentle proportional control, takeoff uses aggressive tracking
        const taxiGain = ttSteer.taxiSteerGain ?? 2.0;
        const takeoffGain = Math.max(3.0, (ttSteer.steerGainBase ?? 8.0) - gs * (ttSteer.steerGainDecay ?? 0.06));
        const baseGain = isTakeoffPhase ? takeoffGain : taxiGain;

        // Max deflection: taxi limits to 40% to prevent over-correction oscillation
        const flightDefl = this.tuning.rudderAuthority || 20;
        const lowSpeedDefl = isTakeoffPhase ? (ttSteer.taxiRudderMaxLow ?? 60) : 40;
        const maxDefl = (gs < 30 || isTakeoffPhase) ? Math.max(flightDefl, lowSpeedDefl) : flightDefl;

        // Through server.js: positive RUDDER_SET value → left yaw in MSFS
        // Drifted right (+error) → need LEFT rudder (positive value) to correct
        // P-factor bias: full power pulls nose left — apply constant right rudder (negative)
        // Bias is ALWAYS applied at power — even with zero heading error (proactive, not reactive)
        const biasVal = ttSteer.rudderBias ?? this.tuning.rudderBias ?? 0;
        const bias = (d.throttle || 0) > 50 ? -biasVal : 0;
        const correction = Math.abs(hdgError) < (ttSteer.steerDeadband ?? 0.5) ? 0 : hdgError * baseGain;  // deadband on correction only

        // Derivative term — dampen oscillation by opposing heading rate of change
        const now = Date.now();
        let dTerm = 0;
        if (!isTakeoffPhase && this._lastSteerError !== undefined && this._lastSteerTime) {
            const dt = (now - this._lastSteerTime) / 1000;
            if (dt > 0 && dt < 1) {
                const rate = (hdgError - this._lastSteerError) / dt;
                dTerm = rate * (ttSteer.taxiSteerDGain ?? 0.8);
            }
        }
        this._lastSteerError = hdgError;
        this._lastSteerTime = now;

        const rudder = Math.max(-maxDefl, Math.min(maxDefl, correction + bias - dTerm));
        this.live.rudder = rudder;
        // Nosewheel steering (STEERING_SET) for ground turns — wider angle than rudder pedals.
        // STEERING_SET is overridden by AXIS_RUDDER_SET, so send steering ONLY on ground.
        // At speed or during takeoff roll, use AXIS_RUDDER_SET for aerodynamic authority.
        if (gs < 30 && !isTakeoffPhase) {
            this._cmdValue('STEERING_SET', Math.round(rudder),
                `Steer hdg ${Math.round(hdg)}→${Math.round(targetHdg)} (err ${hdgError > 0 ? '+' : ''}${hdgError.toFixed(1)}°)`);
        } else {
            this._cmdValue('AXIS_RUDDER_SET', Math.round(rudder),
                `Rudder hdg ${Math.round(hdg)}→${Math.round(targetHdg)} (err ${hdgError > 0 ? '+' : ''}${hdgError.toFixed(1)}°)`);
        }

        // Differential braking for ground steering — only for fine corrections during taxi.
        // During takeoff roll, brakes help counter P-factor and hold centerline.
        // For large heading errors (> 30°), do NOT brake — let nosewheel steering turn the plane.
        // Braking at large errors locks the wheels and prevents turning.
        const brakeSpeedLimit = isTakeoffPhase ? 65 : 30;  // kt
        const minHdgForBrake = isTakeoffPhase ? 1 : 15;    // degrees — taxi: only fine corrections
        const maxHdgForBrake = isTakeoffPhase ? 90 : 30;   // degrees — taxi: no brakes for big turns
        const useBrakes = d.onGround && gs < brakeSpeedLimit
            && Math.abs(hdgError) > minHdgForBrake
            && Math.abs(hdgError) < maxHdgForBrake;
        if (useBrakes) {
            const speedFactor = gs < 20 ? 1.0 : Math.max(0.3, 1.0 - (gs - 20) / 60);
            const brakePower = Math.min(50, Math.abs(hdgError) * 2) * speedFactor;
            if (hdgError > 0) {
                // Drifted right → brake LEFT wheel to turn left
                this._cmdValue('AXIS_LEFT_BRAKE_SET', Math.round(brakePower));
                this._cmdValue('AXIS_RIGHT_BRAKE_SET', 0);
            } else {
                // Drifted left → brake RIGHT wheel to turn right
                this._cmdValue('AXIS_LEFT_BRAKE_SET', 0);
                this._cmdValue('AXIS_RIGHT_BRAKE_SET', Math.round(brakePower));
            }
        } else if (d.onGround) {
            // Release both brakes when aligned or at speed
            this._cmdValue('AXIS_LEFT_BRAKE_SET', 0);
            this._cmdValue('AXIS_RIGHT_BRAKE_SET', 0);
        }

        // Roll bias accumulates for use after liftoff (P-factor compensation)
        // Negative AXIS_AILERONS_SET = roll LEFT, Positive = roll RIGHT.
        // Right bank (+) needs left roll (-) to correct → bias tracks -bank direction
        const bank = d.bank || 0;
        const powerFactor = Math.max(0.1, (d.throttle || 0) / 100);
        this._rollBias += -bank * 0.02 * powerFactor;  // right bank → negative bias → roll left
        this._rollBias *= 0.97;
        this._rollBias = Math.max(-20, Math.min(20, this._rollBias));
    }

    _targetHeading(d, targetHdg, axis, maxDeflection, gain) {
        if (targetHdg == null) return;
        const hdg = d.heading || 0;
        const error = ((hdg - targetHdg + 540) % 360) - 180;  // positive = heading right of target
        // Higher gain during takeoff — airborne rudder needs more authority than cruise
        const g = gain || (this._takeoffSubPhase ? 3.0 : 1.5);
        // Through server.js: positive RUDDER_SET value → left yaw in MSFS
        // Drifted right (+error) → need LEFT rudder (positive value) to correct
        let deflection = error * g;
        // P-factor/torque bias: C172 at full power pulls left — apply constant right rudder
        // (negative rudder = right yaw). Only during takeoff with power applied.
        if (axis === 'AXIS_RUDDER_SET' && this._takeoffSubPhase && (d.throttle || 0) > 50) {
            const bias = -(this.tuning.rudderBias || 0);  // negative = right rudder
            deflection += bias;
        }
        deflection = Math.max(-maxDeflection, Math.min(maxDeflection, deflection));
        this.live.rudder = deflection;
        this._cmdValue(axis, Math.round(deflection * 10) / 10,
            `${axis === 'AXIS_RUDDER_SET' ? 'Rudder' : 'Aileron'} hdg ${Math.round(hdg)}→${Math.round(targetHdg)} (err ${error > 0 ? '+' : ''}${Math.round(error)}°)`);
    }

    /**
     * Target a bank angle — adjusts ailerons proportionally.
     * @param {Object} d - flight data
     * @param {number} targetBank - desired bank degrees (0 = wings level)
     * @param {number} maxDeflection - max aileron input magnitude
     */
    _targetBank(d, targetBank, maxDeflection) {
        const bank = d.bank || 0;
        const error = bank - targetBank;  // positive = banked right of target

        // Smooth adaptive gain: linear interpolation from 2.0 (0° error) to 4.0 (15°+ error)
        const absError = Math.abs(error);
        const gain = 2.0 + Math.min(absError / 15, 1.0) * 2.0;

        // Apply accumulated roll bias (adaptive) + torque bias (tunable)
        let bias = this._rollBias || 0;
        // Verified empirically: positive AXIS_AILERONS_SET = roll LEFT in MSFS
        // Torque rolls aircraft left → need right roll → NEGATIVE aileron bias
        if (this._takeoffSubPhase && (d.throttle || 0) > 50) {
            bias -= (this.tuning.aileronBias || 0);  // negative = roll right (counter left torque)
        }

        // Positive AXIS_AILERONS_SET = roll LEFT in MSFS (verified by ground steering)
        // Banked right (+error) → positive aileron → roll left → corrects back to level
        const deflection = Math.max(-maxDeflection, Math.min(maxDeflection, error * gain + bias));
        this.live.aileron = deflection;
        this._cmdValue('AXIS_AILERONS_SET', Math.round(deflection * 10) / 10,
            `Bank ${bank.toFixed(1)}° → ${targetBank.toFixed(1)}° (ail ${deflection > 0 ? '+' : ''}${deflection.toFixed(1)})`);
    }

    /**
     * Airborne heading correction using AILERONS (bank toward target heading).
     * This is how a real pilot corrects heading in the air: bank, don't kick rudder.
     * Computes a small target bank angle based on heading error, then delegates to _targetBank.
     * @param {Object} d - flight data
     * @param {number} targetHdg - desired heading
     * @param {number} maxBank - max bank angle to command (degrees of aileron authority)
     */
    _bankToHeading(d, targetHdg, maxBank) {
        if (targetHdg == null) return;
        const hdg = d.heading || 0;
        const hdgError = ((hdg - targetHdg + 540) % 360) - 180;  // positive = drifted right of target

        // Convert heading error to bank angle: drift right → bank right to turn back
        // ~2° bank per 1° heading error, max ±15° (safe at low altitude)
        // Positive error (drifted right) → positive targetBank (bank right) → turn right...
        // Wait — drifted RIGHT means need to turn LEFT. So invert:
        const targetBank = Math.max(-15, Math.min(15, -hdgError * 2));

        this._targetBank(d, targetBank, maxBank);
    }

    /**
     * Apply rudder P-factor bias + minimal coordination during airborne takeoff.
     * NOT for heading correction — that's done by _bankToHeading via ailerons.
     * @param {Object} d - flight data
     * @param {number} maxDefl - max rudder deflection
     */
    _applyRudderBias(d, maxDefl) {
        // P-factor bias only (no heading correction — ailerons handle that)
        let rudder = 0;
        if ((d.throttle || 0) > 50) {
            rudder = -(this.tuning.rudderBias || 0);  // negative = right rudder = counter left yaw
        }
        rudder = Math.max(-maxDefl, Math.min(maxDefl, rudder));
        this.live.rudder = rudder;
        this._cmdValue('AXIS_RUDDER_SET', Math.round(rudder),
            `Rudder bias ${rudder > 0 ? '+' : ''}${Math.round(rudder)}% (P-factor)`);
    }

    // ── Nav Guidance Methods ─────────────────────────────────
    // Lateral navigation using GTN750 CDI/waypoint data.
    // Provides intercept headings, NAV mode decisions, and UI data.

    /**
     * Compute intercept heading to rejoin desired track.
     * Uses proportional intercept angle based on cross-track error.
     * @param {number} dtk - desired track (degrees true)
     * @param {number} xtrk - cross-track error (NM, positive = right of course)
     * @param {string} toFrom - 'TO' or 'FROM' flag
     * @returns {number} intercept heading (degrees)
     */
    _computeInterceptHeading(dtk, xtrk, toFrom) {
        // Accept both string 'FROM' and SimConnect numeric 2
        if (toFrom === 'FROM' || toFrom === 2) return dtk; // past waypoint — just track DTK

        const absXtrk = Math.abs(xtrk);
        let interceptAngle = 0;

        if (absXtrk < 0.1) {
            interceptAngle = 0;           // on course
        } else if (absXtrk < 0.3) {
            interceptAngle = 10;          // slight correction
        } else if (absXtrk <= 1.0) {
            // Proportional: 10° at 0.3nm to 30° at 1.0nm
            interceptAngle = 10 + (absXtrk - 0.3) / 0.7 * 20;
        } else {
            interceptAngle = 30;          // max intercept
        }

        // Apply intercept toward course: if right of course (positive xtrk), turn left
        const correction = xtrk > 0 ? -interceptAngle : interceptAngle;
        return ((dtk + correction) % 360 + 360) % 360;
    }

    /**
     * Get nav-derived heading for lateral guidance.
     * Priority: CDI DTK with intercept correction, then active waypoint bearing.
     * @param {Object} d - flightData
     * @returns {{ heading: number, source: string, description: string } | null}
     */
    _getNavHeading(d) {
        // Priority 0: Flight plan waypoints (from GTN750 FLY PLAN button)
        if (this._flightPlan && d) {
            // Try to sequence waypoint
            this.sequenceWaypoint(d);

            const wp = this.getActiveWaypoint();
            if (wp && d.latitude && d.longitude) {
                const bearing = this._calculateBearing(d.latitude, d.longitude, wp.lat, wp.lon);
                const dist = this._haversineDistance(d.latitude, d.longitude, wp.lat, wp.lon);

                return {
                    heading: Math.round(bearing),
                    source: 'FPL',
                    description: `${wp.ident} ${dist.toFixed(1)}nm (${this._activeWaypointIndex + 1}/${this._flightPlan.waypoints.length})`
                };
            }
        }

        const nav = this._navState;
        if (!nav) return null;

        // Priority 1: CDI with valid DTK
        if (nav.cdi && nav.cdi.dtk != null && nav.cdi.source) {
            const dtk = nav.cdi.dtk;
            const xtrk = nav.cdi.xtrk || 0;
            const toFrom = nav.cdi.toFrom || 'TO';
            const heading = this._computeInterceptHeading(dtk, xtrk, toFrom);
            const xtrkDesc = Math.abs(xtrk) < 0.1 ? 'on course' : `${Math.abs(xtrk).toFixed(1)}nm ${xtrk > 0 ? 'R' : 'L'}`;
            return {
                heading: Math.round(heading),
                source: nav.cdi.source,
                description: `DTK ${Math.round(dtk)}° ${xtrkDesc} → HDG ${Math.round(heading)}°`
            };
        }

        // Priority 2: Active waypoint bearing (direct-to fallback)
        if (nav.activeWaypoint && nav.activeWaypoint.bearing != null) {
            const bearing = nav.activeWaypoint.bearing;
            return {
                heading: Math.round(bearing),
                source: 'WPT',
                description: `Direct ${nav.activeWaypoint.ident || '???'} BRG ${Math.round(bearing)}°`
            };
        }

        return null;
    }

    _calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    /**
     * Determine if NAV mode should be engaged (vs heading bug fallback).
     * NAV mode is safe when CDI is valid, cross-track is small, and TO flag is active.
     * @returns {boolean}
     */
    _monitorFlightEnvelope(d, apState, phase) {
        if (!this.profile) return;
        const p = this.profile;
        const speeds = p.speeds;
        const limits = p.limits || {};

        const bank = d.bank || 0;           // degrees (positive = right)
        const pitch = d.pitch || 0;         // degrees (positive = nose up)
        const ias = d.speed || 0;           // KIAS
        const vs = d.verticalSpeed || 0;    // fpm
        const alt = d.altitude || 0;        // MSL
        const agl = d.altitudeAGL || 0;
        const gs = d.groundSpeed || 0;
        // MSFS 2024: onGround SimVar is unreliable (can report true at 300+ AGL).
        // Trust AGL as tiebreaker: only believe onGround if AGL also < 50ft.
        // Also consider on-ground if very low AGL regardless of SimVar.
        const onGround = (d.onGround && agl < 50) || (agl < 15 && Math.abs(vs) < 200);
        const absBank = Math.abs(bank);

        // Skip ground phases
        if (onGround) return;

        // Compute dynamic envelope (weight + bank adjusted stall speeds)
        const env = this._computeEnvelope(d);

        const now = Date.now();
        let alert = null;

        // ── BANK ANGLE PROTECTION ──
        // When AP is actively managing heading/nav, trust it — only intervene at extreme angles.
        // Without AP, use tighter limits especially at low altitude.
        const apManagingBank = apState.master && (apState.headingHold || apState.navHold);
        const lowAlt = agl < 1000;
        const maxBank = apManagingBank ? (limits.maxBank || 25) : (lowAlt ? 15 : (limits.maxBank || 25));
        const dangerBank = apManagingBank ? (limits.dangerBank || 35) : (lowAlt ? 20 : (limits.dangerBank || 35));
        const criticalBank = apManagingBank ? (limits.criticalBank || 45) : (lowAlt ? 30 : (limits.criticalBank || 45));

        if (absBank > criticalBank) {
            // Emergency: extreme bank — wings level immediately
            alert = 'BANK';
            if (apState.master) {
                // AP is on but failing to hold wings level — re-command heading
                this._cmdValue('HEADING_BUG_SET', Math.round(d.heading || 0), `BANK ${Math.round(bank)}° — wings level`);
                this._cmd('AP_HDG_HOLD', true, 'HDG hold — bank recovery');
                // Reduce VS if in a steep descending turn
                if (vs < -500) {
                    this._cmdValue('AP_VS_VAR_SET_ENGLISH', 0, 'Level off — bank recovery');
                }
            } else {
                // AP is OFF — use proportional aileron to level wings, then re-engage AP.
                // Gain of 0.8 with ±30 clamp prevents overshoot and bang-bang oscillation.
                // (Previous gain of 2x with ±80 caused wild aileron swings.)
                const bankCorr = -bank * 0.8;  // gentle proportional opposition
                const clampedCorr = Math.max(-30, Math.min(30, bankCorr));
                this._cmdValue('AXIS_AILERONS_SET', clampedCorr, `BANK ${Math.round(bank)}° — aileron recovery`);
                // Try to re-engage AP
                delete this._lastCommands['AP_MASTER'];
                this._cmd('AP_MASTER', true, 'Re-engage AP — bank recovery');
            }
            this._bankCorrectionActive = true;
        } else if (absBank > dangerBank) {
            // Dangerous bank — command shallower turn
            alert = 'BANK';
            if (apState.master && apState.headingHold) {
                // AP heading hold is allowing too much bank — nudge heading bug closer to current heading
                const targetHdg = d.apHdgSet || d.heading || 0;
                const currentHdg = d.heading || 0;
                const hdgDiff = ((targetHdg - currentHdg + 540) % 360) - 180;
                // Reduce the heading change to limit bank angle
                if (Math.abs(hdgDiff) > 10) {
                    const reducedHdg = (currentHdg + hdgDiff * 0.5 + 360) % 360;
                    this._cmdValue('HEADING_BUG_SET', Math.round(reducedHdg), `Reduce turn — bank ${Math.round(absBank)}°`);
                }
            }
            this._bankCorrectionActive = true;
        } else if (absBank > maxBank && !apManagingBank) {
            // Slightly over limit without AP — flag but don't spam commands
            this._bankCorrectionActive = true;
        } else {
            this._bankCorrectionActive = false;
        }

        // ── AIRSPEED PROTECTION (dynamic weight + bank adjusted) ──
        // Uses real-time stall speed from _computeEnvelope() instead of static POH values.
        // At lighter weight: stall speed decreases (more margin).
        // In a bank: load factor increases stall speed (less margin).
        // At 45° bank, stall speed increases ~19%. At 60° bank, ~41%.
        const vno = speeds.Vno || 129;
        const vne = speeds.Vne || 163;

        // Dynamic stall speed from envelope (falls back to static if envelope unavailable)
        const stallSpeed = env ? env.vsActive : ((d.flapsIndex > 0) ? (speeds.Vs0 || 48) : (speeds.Vs1 || 53));
        const stallProtect = stallSpeed + 5;   // hard protection: full power + nose down
        const stallWarn = stallSpeed + 10;      // soft warning: reduce descent

        // Dynamic Va — max speed for full deflection at current weight
        const vaDynamic = env ? env.vaDynamic : (speeds.Va || 99);

        if (ias > 0 && ias < stallProtect && !onGround && phase !== 'TAKEOFF') {
            // Stall protection — pitch down and add power
            alert = 'STALL';
            const stallInfo = env ? `Vs ${Math.round(stallSpeed)}kt @${Math.round(env.loadFactor * 10) / 10}G` : '';
            this._cmdValue('THROTTLE_SET', 100, `STALL: full power (IAS ${Math.round(ias)} < ${Math.round(stallProtect)} ${stallInfo})`);
            if (apState.master) {
                // Reduce pitch / lower nose — more aggressive if deep into stall
                const vsCmd = ias < stallSpeed ? -500 : -200;
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', vsCmd, 'STALL: nose down');
                this._cmd('AP_VS_HOLD', true, 'STALL: VS hold recovery');
            }
            // If in a steep bank AND stalling, wings level is priority
            if (absBank > 20 && apState.master) {
                this._cmdValue('HEADING_BUG_SET', Math.round(d.heading || 0), 'STALL+BANK: wings level');
                this._cmd('AP_HDG_HOLD', true, 'STALL: reduce bank');
            }
            this._speedCorrectionActive = true;
        } else if (ias > 0 && ias < stallWarn && !onGround && phase !== 'TAKEOFF') {
            // Approaching stall — increase power, reduce VS
            alert = alert || 'STALL_WARN';
            if (vs < -300) {
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', Math.min(vs + 200, 0), `Low IAS ${Math.round(ias)} (stall ${Math.round(stallSpeed)}) — reduce descent`);
            }
            // If bank is adding to stall risk, shallow the turn
            if (absBank > 25 && apState.master) {
                const currentHdg = d.heading || 0;
                this._cmdValue('HEADING_BUG_SET', Math.round(currentHdg), `Low speed + bank — shallow turn`);
            }
            this._speedCorrectionActive = true;
        } else if (ias > vne - 5) {
            // Near Vne — reduce power and increase pitch
            alert = 'OVERSPEED';
            this._cmdValue('THROTTLE_SET', 50, `OVERSPEED: reduce power (IAS ${Math.round(ias)} near Vne ${vne})`);
            if (apState.master && vs < -200) {
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', Math.min(vs + 500, 0), 'OVERSPEED: reduce descent rate');
            }
            this._speedCorrectionActive = true;
        } else if (ias > vno && phase !== 'DESCENT') {
            // Over Vno in non-descent phase — proportional power reduction
            const excess = ias - vno;
            const throttle = Math.max(50, Math.round(90 - excess * 2));
            this._cmdValue('THROTTLE_SET', throttle, `IAS ${Math.round(ias)} > Vno ${vno} — power ${throttle}%`);
            this._speedCorrectionActive = true;
        } else if (ias > vaDynamic && absBank > 20) {
            // Over dynamic Va in a turn — risk of structural damage from turbulence/gust
            // Advisory only — reduce speed or shallow the turn
            if (now - this._lastEnvelopeLog > 5000) {
                this._lastEnvelopeLog = now;
            }
            this._speedCorrectionActive = false;
        } else {
            this._speedCorrectionActive = false;
        }

        // ── PITCH MONITORING ──
        const maxPitchUp = limits.maxPitchUp || 20;
        const maxPitchDown = limits.maxPitchDown || -15;

        if (pitch > maxPitchUp && !onGround) {
            // Excessive nose-up — risk of stall
            alert = alert || 'PITCH';
            if (apState.master) {
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', Math.min(vs, 500), `Pitch ${Math.round(pitch)}° — reduce climb`);
            }
        } else if (pitch < maxPitchDown && !onGround) {
            // Excessive nose-down — risk of overspeed/CFIT
            alert = alert || 'PITCH';
            if (apState.master) {
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', Math.max(vs, -300), `Pitch ${Math.round(pitch)}° — reduce descent`);
            }
        }

        // ── VS LIMITS ──
        // C172 should not sustain extreme vertical speeds
        const maxVs = limits.maxVs || 1000;
        const minVs = limits.minVs || -1500;

        if (vs > maxVs + 200 && apState.master && phase !== 'TAKEOFF') {
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', maxVs, `VS ${Math.round(vs)} > max ${maxVs} — limiting`);
        } else if (vs < minVs - 200 && apState.master) {
            this._cmdValue('AP_VS_VAR_SET_ENGLISH', minVs, `VS ${Math.round(vs)} < min ${minVs} — limiting`);
        }

        // ── ALTITUDE DEVIATION (when AP ALT hold should be active) ──
        if (apState.master && apState.altitudeHold && phase === 'CRUISE') {
            const targetAlt = d.apAltSet || this._getCruiseAlt();
            const altDev = Math.abs(alt - targetAlt);
            if (altDev > 200) {
                // Drifting off target altitude — re-engage
                const correctVs = alt < targetAlt ? 300 : -300;
                this._cmdValue('AP_VS_VAR_SET_ENGLISH', correctVs, `ALT deviation ${Math.round(altDev)}ft — correcting`);
                this._cmd('AP_VS_HOLD', true, 'ALT correction VS hold');
            }
        }

        this._envelopeAlert = alert;
    }

    /** Get current envelope alert (for display) */
    getEnvelopeAlert() {
        return this._envelopeAlert;
    }

    /** Get latest computed flight envelope snapshot (for display/broadcast) */
    getEnvelope() {
        return this._envelope;
    }

    /**
     * Compute dynamic flight envelope based on current conditions.
     * Returns a snapshot of all computed limits adjusted for weight, bank, flaps.
     *
     * Key aerodynamics:
     *   Vs_actual = Vs_ref × √(W_current / W_ref) × √(loadFactor)
     *   loadFactor = 1 / cos(bankAngle)   (in level turn)
     *   Va_actual = Va_ref × √(W_current / W_ref)
     *
     * @param {Object} d - flightData from WebSocket
     * @returns {Object} envelope snapshot
     */
    _computeEnvelope(d) {
        const p = this.profile;
        if (!p || !p.weight || !p.speeds) return null;

        const w = p.weight;
        const speeds = p.speeds;
        const bank = Math.abs(d.bank || 0);
        const flapsOut = (d.flapsIndex || 0) > 0;

        // ── Estimate current aircraft weight ──
        // Use fuel data from WebSocket if available, otherwise estimate from capacity
        const fuelGal = (typeof d.fuelTotal === 'number' && d.fuelTotal > 0)
            ? d.fuelTotal
            : (w.maxUsefulLoad - w.defaultPayload) / w.fuelWeightPerGal; // fallback: full tanks
        const fuelWeight = fuelGal * w.fuelWeightPerGal;
        const payload = w.defaultPayload;                    // 340 lbs (2 pax)
        const estimatedWeight = w.empty + fuelWeight + payload;
        const clampedWeight = Math.min(estimatedWeight, w.maxGross * 1.1); // allow 10% over for realism

        // Weight ratio: lighter = lower stall speeds, heavier = higher
        const weightRatio = clampedWeight / w.maxGross;
        const sqrtWeightRatio = Math.sqrt(weightRatio);

        // ── Load factor from bank angle ──
        // In a coordinated level turn: loadFactor = 1 / cos(bank)
        // At 60° bank that's 2G, at 45° it's 1.41G
        const bankRad = bank * Math.PI / 180;
        const cosBank = Math.cos(bankRad);
        // Prevent division by zero at 90° — cap at 75° for calculation
        const loadFactor = cosBank > 0.26 ? (1 / cosBank) : 3.86; // 3.86G at 75°
        const sqrtLoadFactor = Math.sqrt(loadFactor);

        // ── Dynamic stall speeds ──
        // Reference Vs0/Vs1 in POH are at max gross weight, wings level
        const vs1Base = speeds.Vs1 || 53;    // clean stall at max gross
        const vs0Base = speeds.Vs0 || 48;    // full-flap stall at max gross

        // Adjust for weight (lighter = lower stall speed)
        const vs1Weight = vs1Base * sqrtWeightRatio;
        const vs0Weight = vs0Base * sqrtWeightRatio;

        // Adjust for bank (more bank = higher effective stall speed)
        const vs1Dynamic = vs1Weight * sqrtLoadFactor;
        const vs0Dynamic = vs0Weight * sqrtLoadFactor;

        // Active stall speed based on flap config
        const vsActive = flapsOut ? vs0Dynamic : vs1Dynamic;

        // ── Dynamic maneuvering speed ──
        // Va decreases with lighter weight (less structural margin needed)
        const vaBase = speeds.Va || 99;
        const vaDynamic = vaBase * sqrtWeightRatio;

        // ── Stall margins ──
        const ias = d.speed || 0;
        const stallMargin = ias > 0 ? ias - vsActive : 999;
        const stallMarginPct = ias > 0 ? ((ias - vsActive) / vsActive) * 100 : 999;

        // ── Speed margins ──
        const vno = speeds.Vno || 129;
        const vne = speeds.Vne || 163;
        const overspeedMargin = vne - ias;

        const envelope = {
            // Weight
            estimatedWeight: Math.round(clampedWeight),
            fuelWeight: Math.round(fuelWeight),
            fuelGal: Math.round(fuelGal * 10) / 10,
            weightRatio: Math.round(weightRatio * 100) / 100,
            payload,

            // Load factor
            bankAngle: Math.round(bank * 10) / 10,
            loadFactor: Math.round(loadFactor * 100) / 100,

            // Dynamic stall speeds (weight + bank adjusted)
            vs1Dynamic: Math.round(vs1Dynamic * 10) / 10,
            vs0Dynamic: Math.round(vs0Dynamic * 10) / 10,
            vsActive: Math.round(vsActive * 10) / 10,
            flapsOut,

            // Dynamic Va
            vaDynamic: Math.round(vaDynamic * 10) / 10,

            // Current margins
            stallMargin: Math.round(stallMargin * 10) / 10,
            stallMarginPct: Math.round(stallMarginPct),
            overspeedMargin: Math.round(overspeedMargin),

            // Reference (static POH) values for comparison
            vs1Ref: vs1Base,
            vs0Ref: vs0Base,
            vaRef: vaBase,

            timestamp: Date.now()
        };

        this._envelope = envelope;
        return envelope;
    }

    /**
     * Check terrain ahead and react if necessary.
     * Called from evaluate() during airborne phases.
     * Uses look-ahead along current heading to detect rising terrain.
     * @param {Object} d - flightData
     * @param {Object} apState - autopilot state
     * @param {string} phase - current flight phase
     */
    _checkTerrain(d, apState, phase) {
        if (!this._terrainGrid || !this._terrainGrid.loaded) return;

        // Throttle checks to once per 2 seconds (terrain doesn't change fast)
        const now = Date.now();
        if (now - this._lastTerrainCheck < 2000) return;
        this._lastTerrainCheck = now;

        const lat = d.latitude;
        const lon = d.longitude;
        const hdg = d.heading || 0;
        const alt = d.altitude || 0;         // MSL feet
        const vs = d.verticalSpeed || 0;     // fpm
        const gs = d.groundSpeed || 0;       // knots

        if (!lat || !lon || alt < 100) return; // Skip on ground or no position

        // Look ahead along current heading
        // Check at 2nm, 5nm, and 10nm ahead
        const lookAheadDistances = [2, 5, 10]; // NM
        const cosLat = Math.cos(lat * Math.PI / 180);
        const hdgRad = hdg * Math.PI / 180;

        let worstClearance = Infinity;
        let worstDist = 0;
        let worstElev = 0;

        for (const dist of lookAheadDistances) {
            const dLat = (dist / 60) * Math.cos(hdgRad);
            const dLon = (dist / 60) * Math.sin(hdgRad) / cosLat;
            const checkLat = lat + dLat;
            const checkLon = lon + dLon;

            const terrainFt = this._terrainGrid.getElevationFeet(checkLat, checkLon);
            if (terrainFt <= 0) continue; // Ocean or no data

            // Predict altitude at that distance given current VS and GS
            const timeToReachMin = gs > 30 ? (dist / gs) * 60 : 0; // minutes
            const predictedAlt = alt + (vs * timeToReachMin / 60); // feet at that point
            const clearance = predictedAlt - terrainFt;

            if (clearance < worstClearance) {
                worstClearance = clearance;
                worstDist = dist;
                worstElev = terrainFt;
            }
        }

        // Determine alert level based on predicted clearance
        const prevAlert = this._terrainAlert;

        if (worstClearance < 500) {
            // WARNING: Predicted terrain conflict within 500ft
            this._terrainAlert = 'WARNING';

            if (phase !== 'TAKEOFF' && phase !== 'LANDING') {
                // Climb immediately to clear terrain
                const safeAlt = worstElev + 1500; // 1500ft above highest terrain ahead
                if (apState.master) {
                    this._cmdValue('AP_ALT_VAR_SET_ENGLISH', safeAlt, `TERRAIN: climb to ${safeAlt}ft (terrain ${worstElev}ft at ${worstDist}nm)`);
                    this._cmd('AP_VS_HOLD', true, 'TERRAIN: VS hold for climb');
                    this._cmdValue('AP_VS_VAR_SET_ENGLISH', 1000, 'TERRAIN: max climb');
                }
            }
        } else if (worstClearance < 1500) {
            // CAUTION: Terrain within 1500ft clearance
            this._terrainAlert = 'CAUTION';
            // Advisory only — no automatic action, let pilot/LLM decide
        } else {
            this._terrainAlert = null;
        }

        // Merge external TAWS alert from GTN750 — trust the higher severity
        if (this._externalTerrainAlert) {
            const severityMap = { 'WARNING': 2, 'CAUTION': 1 };
            const localSev = severityMap[this._terrainAlert] || 0;
            const extSev = severityMap[this._externalTerrainAlert] || 0;
            if (extSev > localSev) {
                this._terrainAlert = this._externalTerrainAlert;
                // If GTN750 says WARNING and local didn't detect it, react
                if (this._externalTerrainAlert === 'WARNING' && localSev < 2 && phase !== 'TAKEOFF' && phase !== 'LANDING') {
                    const safeAlt = alt + 1500;
                    if (apState.master) {
                        this._cmdValue('AP_ALT_VAR_SET_ENGLISH', safeAlt, `TAWS: climb to ${safeAlt}ft (external alert)`);
                        this._cmd('AP_VS_HOLD', true, 'TAWS: VS hold for climb');
                        this._cmdValue('AP_VS_VAR_SET_ENGLISH', 1000, 'TAWS: max climb');
                    }
                }
            }
        }
    }

    /**
     * Push a toggle/boolean AP command
    _getCruiseAlt() {
        // Accessed via parent pane's flightPhase module
        return this._targetCruiseAlt || 8500;
    }

    /** Set target cruise altitude (called from pane) */
    setTargetCruiseAlt(alt) {
        this._targetCruiseAlt = alt;
    }

    /** Set ATC controller reference (called from pane.js) */
    setATCController(atc) {
        this._atc = atc || null;
    }

    /** Set nav state from GTN750 (called from pane via SafeChannel) */
    setNavState(nav) {
        this._navState = nav || null;
    }

    /**
     * Get nav guidance data for UI display and heading decisions.
     * Returns null if no nav state available.
     * @returns {{ wpIdent, wpDist, wpBearing, cdiSource, xtrk, dtk, toFrom, navMode, interceptHdg, destDist } | null}
     */
    getNavGuidance() {
        const nav = this._navState;
        if (!nav) return null;

        const wp = nav.activeWaypoint || null;
        const cdi = nav.cdi || null;

        // Normalize toFrom: SimConnect sends 1=TO, 2=FROM, 0=inactive. Also handle string 'FROM'.
        let toFrom = 'TO';
        const rawToFrom = cdi?.toFrom;
        if (rawToFrom === 2 || rawToFrom === 'FROM') toFrom = 'FROM';
        else if (rawToFrom === 0) toFrom = 'INACTIVE';

        // NAV mode: CDI source valid, on TO leg, within 2nm
        const useNav = !!(cdi?.source && toFrom === 'TO' && Math.abs(cdi.xtrk || 0) <= 2.0);

        // Intercept heading from CDI
        let interceptHdg = null;
        if (cdi?.dtk != null) {
            interceptHdg = this._computeInterceptHeading(cdi.dtk, cdi.xtrk || 0, toFrom);
        }

        return {
            wpIdent:    wp?.ident      ?? null,
            wpDist:     wp?.distNm     ?? null,
            wpBearing:  wp?.bearingMag ?? null,
            cdiSource:  cdi?.source    ?? null,
            xtrk:       cdi?.xtrk     ?? null,
            dtk:        cdi?.dtk      ?? null,
            toFrom,
            navMode:    useNav ? 'NAV' : 'HDG',
            interceptHdg,
            destDist:   nav.destDistNm ?? null,
        };
    }

    /** Set flight plan for execution (called from pane when GTN750 sends plan) */
    setFlightPlan(plan) {
        this._flightPlan = plan || null;
        this._activeWaypointIndex = 0;

        if (plan && plan.waypoints && plan.waypoints.length > 0) {
            console.log(`[RuleEngine] Flight plan set: ${plan.name} (${plan.waypoints.length} waypoints)`);
        }
    }

    /** Get current active waypoint from flight plan */
    getActiveWaypoint() {
        if (!this._flightPlan || !this._flightPlan.waypoints) return null;
        if (this._activeWaypointIndex >= this._flightPlan.waypoints.length) return null;
        return this._flightPlan.waypoints[this._activeWaypointIndex];
    }

    /** Check if flight plan is loaded */
    hasFlightPlan() {
        return !!(this._flightPlan && this._flightPlan.waypoints && this._flightPlan.waypoints.length > 0);
    }

    /** Set active waypoint index (for GTN750 sync) */
    setActiveWaypointIndex(index) {
        if (!this._flightPlan || !this._flightPlan.waypoints) return;
        if (index < 0 || index >= this._flightPlan.waypoints.length) return;
        this._activeWaypointIndex = index;
    }

    /** Sequence to next waypoint */
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

        // Sequence if within 0.5nm
        if (dist < 0.5) {
            this._activeWaypointIndex++;
            const nextWp = this.getActiveWaypoint();
            if (nextWp) {
                console.log(`[RuleEngine] Sequenced to waypoint ${this._activeWaypointIndex + 1}: ${nextWp.ident}`);
                return true;
            }
        }

        return false;
    }

    _haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /** Set external terrain alert from GTN750 TAWS (called from pane via SafeChannel) */
    setExternalTerrainAlert(level) {
        this._externalTerrainAlert = level || null;
    }

    /** Set nearest airport data and determine active runway */
    setAirportData(airport) {
        this._airportData = airport || null;
        this._activeRunway = null;
    }

    /** Set the active runway (best match for heading + wind) */
    setActiveRunway(runway) {
        this._activeRunway = runway || null;
    }

    /** Get current airport data (for debug/display) */
    getAirportData() {
        return this._airportData;
    }

    /** Get current active runway (for debug/display) */
    getActiveRunway() {
        return this._activeRunway;
    }

    /** Read takeoff tuner overrides — server-side getter or localStorage fallback */
    _getTakeoffTuning() {
        if (this._tuningGetter) return this._tuningGetter();
        try {
            const raw = localStorage.getItem('simglass-takeoff-tuning');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    /** Read takeoff phase holds — server-side getter or localStorage fallback */
    _getTakeoffHolds() {
        if (this._holdsGetter) return this._holdsGetter();
        try {
            const raw = localStorage.getItem('simglass-takeoff-holds');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    /** Check if a sub-phase transition is held */
    _isPhaseHeld(phaseId) {
        const holds = this._getTakeoffHolds();
        return !!holds[phaseId];
    }

    /** Reset command dedup tracking (e.g., on AI toggle) */
    reset() {
        this._lastCommands = {};
        this._lastPhase = null;
        this._takeoffSubPhase = null;
        this._runwayHeading = null;
        this._navState = null;
        this._externalTerrainAlert = null;
        this._airportData = null;
        this._activeRunway = null;
        this._envelopeAlert = null;
        this._envelope = null;
        this._bankCorrectionActive = false;
        this._speedCorrectionActive = false;
        this._lastPitch = null;
        this._lastPitchTime = null;
        this._rollBias = 0;
    }

    /** Update aircraft profile */
    setProfile(profile) {
        this.profile = profile;
        this.reset();
    }
}


// Export for Node.js (if needed for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngineCore };
}
