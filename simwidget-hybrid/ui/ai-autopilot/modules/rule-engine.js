/**
 * Rule Engine — Per-Phase AP Command Generation
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/rule-engine.js
 *
 * Produces AP and flight control commands based on current flight phase and aircraft profile.
 * Commands are pushed to the command queue for rate-limited execution.
 * TAKEOFF phase uses sub-phases for procedure-aware control:
 *   BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
 */

class RuleEngine {
    constructor(options = {}) {
        this.profile = options.profile || null;
        this.commandQueue = options.commandQueue || null;
        this._lastPhase = null;
        this._lastCommands = {};  // track what we last commanded per axis
        this._takeoffSubPhase = null;
        this._runwayHeading = null;  // captured at takeoff roll start

        // Terrain awareness (uses shared singleton from terrain-grid.js)
        this._terrainGrid = (typeof window !== 'undefined' && window._terrainGrid) || null;
        this._terrainAlert = null;     // current terrain alert: null | 'CAUTION' | 'WARNING'
        this._lastTerrainCheck = 0;

        // Nav state from GTN750 (via SafeChannel)
        this._navState = null;
        this._externalTerrainAlert = null;  // from GTN750 TAWS: null | 'CAUTION' | 'WARNING'

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

        // Dynamic flight envelope (computed every frame)
        this._envelope = null;  // latest computed envelope snapshot

        // Rotation timing — for progressive back pressure
        this._rotateStartTime = null;
    }

    /**
     * Evaluate rules for current phase and flight data.
     * Generates AP commands and pushes them to the command queue.
     * @param {string} phase - current flight phase
     * @param {Object} d - flightData from WebSocket
     * @param {Object} apState - current AP engaged states
     */
    evaluate(phase, d, apState) {
        if (!this.profile || !this.commandQueue || !d) return;

        const p = this.profile;
        const speeds = p.speeds;
        const phaseChanged = phase !== this._lastPhase;
        this._lastPhase = phase;

        // Reset takeoff sub-phase when leaving TAKEOFF
        if (phaseChanged && phase !== 'TAKEOFF') {
            this._takeoffSubPhase = null;
            this._runwayHeading = null;
        }
        // Reset adaptive biases on phase regression (crash recovery)
        // Bias learned at full power doesn't apply at taxi power
        if (phaseChanged && (phase === 'PREFLIGHT' || phase === 'TAXI')) {
            this._rollBias = 0;
        }

        // ── Parking brake safety ──
        // Release parking brake whenever AI has controls and throttle is above idle.
        // This catches cases where onGround data is wrong or phase skips TAKEOFF.
        if (d.parkingBrake && (d.throttle > 20 || phase === 'TAKEOFF') && phase !== 'LANDING') {
            delete this._lastCommands['PARKING_BRAKES'];
            this._cmd('PARKING_BRAKES', true, 'Release parking brake (safety)');
        }

        // Continuous flight envelope monitoring (every frame, not just phase changes)
        if (phase !== 'PREFLIGHT' && phase !== 'TAXI') {
            this._monitorFlightEnvelope(d, apState, phase);
            this._checkTerrain(d, apState, phase);
        }

        switch (phase) {
            case 'PREFLIGHT':
                // No AP during preflight — force-clear dedup (toggle can be stale)
                if (apState.master) {
                    delete this._lastCommands['AP_MASTER'];
                    this._cmd('AP_MASTER', false, 'Disengage AP on ground');
                }
                // Prepare aircraft for taxi: mixture rich, release brake, idle-up throttle
                this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH');
                if (d.parkingBrake) {
                    this._cmd('PARKING_BRAKES', true, 'Release parking brake for taxi');
                }
                this._cmdValue('THROTTLE_SET', 35, 'Idle-up throttle');
                // Capture heading and start steering immediately — don't wait for TAXI
                if (!this._runwayHeading) {
                    if (this._activeRunway?.heading) {
                        this._runwayHeading = this._activeRunway.heading;
                    } else {
                        this._runwayHeading = Math.round(d.heading || 0);
                    }
                }
                if (d.groundSpeed > 0.5) {
                    this._groundSteer(d, this._runwayHeading);
                }
                break;

            case 'TAXI':
                // Disengage AP on ground — force-clear dedup (toggle can be stale)
                if (apState.master) {
                    delete this._lastCommands['AP_MASTER'];
                    this._cmd('AP_MASTER', false, 'Disengage AP on ground');
                }
                this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH for takeoff');

                // ATC hold-short gate: if ATC is active and we're at HOLD_SHORT,
                // stop the aircraft and wait for clearance
                if (this._atc && (this._atc.getPhase() === 'HOLD_SHORT' || this._atc.getPhase() === 'TAKEOFF_CLEARANCE_PENDING')) {
                    this._cmdValue('THROTTLE_SET', 0, 'Hold short — awaiting clearance');
                    if (!d.parkingBrake) {
                        delete this._lastCommands['PARKING_BRAKES'];
                        this._cmd('PARKING_BRAKES', true, 'Parking brake — hold short');
                    }
                    break;
                }

                // Use ATC waypoint for steering if available, else runway heading
                {
                    let steerTarget;
                    if (this._atc && this._atc.getPhase() === 'TAXIING') {
                        const wp = this._atc.getNextWaypoint();
                        if (wp) steerTarget = wp.bearing;
                    }
                    if (steerTarget == null) {
                        // Capture runway heading early for ground track
                        if (!this._runwayHeading) {
                            if (this._activeRunway?.heading) {
                                this._runwayHeading = this._activeRunway.heading;
                            } else {
                                this._runwayHeading = Math.round(d.heading || 0);
                            }
                        }
                        steerTarget = this._runwayHeading;
                    }
                    this._groundSteer(d, steerTarget);

                    const gs = d.groundSpeed || 0;
                    const hdg = d.heading || 0;
                    const hdgError = Math.abs(((hdg - steerTarget + 540) % 360) - 180);
                    // Heading-aware throttle: align first, then accelerate
                    let thr;
                    if (hdgError > 15) {
                        thr = Math.max(15, 20 - hdgError * 0.3);
                    } else {
                        const targetGS = 25;
                        const speedError = targetGS - gs;
                        thr = Math.max(25, Math.min(70, 55 + speedError * 0.8));
                    }
                    this._cmdValue('THROTTLE_SET', Math.round(thr), `Taxi (GS ${Math.round(gs)}, hdg err ${Math.round(hdgError)}°)`);
                }
                break;

            case 'TAKEOFF':
                this._evaluateTakeoff(d, apState, phaseChanged);
                break;

            case 'CLIMB':
                // Release manual controls so AP can take over
                if (phaseChanged) {
                    this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release elevator for AP');
                    this._cmdValue('AXIS_RUDDER_SET', 0, 'Release rudder for AP');
                    this._cmdValue('AXIS_AILERONS_SET', 0, 'Release ailerons for AP');
                }
                // Climb power — full throttle until cruise
                this._cmdValue('THROTTLE_SET', 100, 'Climb power');
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for climb');
                    // Set heading bug to current heading for HDG hold
                    this._cmdValue('AP_HDG_VAR_SET', Math.round(d.heading || 0), 'HDG ' + Math.round(d.heading || 0));
                    this._cmd('AP_HDG_HOLD', true, 'HDG hold');
                }
                // Set climb VS — adapts to available speed margin.
                // At higher altitudes, power decreases — VS must be reduced to maintain airspeed.
                // Skip entirely when stall protection is active — let it push nose down.
                if (!this._speedCorrectionActive) {
                    const ias = d.speed || 0;
                    const stallMargin = ias - ((speeds.Vs1 || 53) + 10);  // margin above stall+10
                    let climbVS = p.climb.normalRate;  // default 700
                    if (stallMargin < 15) {
                        // Low margin — reduce climb rate proportionally (min 200fpm)
                        climbVS = Math.max(200, Math.round(climbVS * Math.max(0.3, stallMargin / 15)));
                    }
                    if (phaseChanged || !apState.vsHold) {
                        this._cmd('AP_VS_HOLD', true, 'VS hold for climb');
                    }
                    this._cmdValue('AP_VS_VAR_SET', climbVS, 'VS +' + climbVS);
                }
                if (phaseChanged) {
                    this._cmdValue('AP_ALT_VAR_SET', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());
                    this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy)');
                }
                // Transition from HDG to NAV if available
                if (d.apNavLock === false && phaseChanged) {
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                break;

            case 'CRUISE': {
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for cruise');
                }
                if (phaseChanged) {
                    // Level off
                    this._cmd('AP_ALT_HOLD', true, 'ALT hold at cruise');
                    this._cmdValue('AP_VS_VAR_SET', 0, 'VS 0 (level)');
                    this._cmdValue('AP_SPD_VAR_SET', speeds.Vcruise, 'SPD ' + speeds.Vcruise + ' (cruise)');
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                // Speed-maintaining throttle: no auto-throttle in C172 AP,
                // so rule engine must manage throttle to reach target speed.
                const ias = d.speed || 0;
                const spdDiff = speeds.Vcruise - ias;
                let cruiseThrottle;
                if (spdDiff > 15) cruiseThrottle = 100;       // way below target — full power
                else if (spdDiff > 5) cruiseThrottle = 90;    // building speed
                else if (spdDiff > -5) cruiseThrottle = 80;   // near target
                else cruiseThrottle = 70;                      // above target — reduce
                this._cmdValue('THROTTLE_SET', cruiseThrottle, 'Cruise throttle ' + cruiseThrottle + '%');
                break;
            }

            case 'DESCENT': {
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for descent');
                }
                if (phaseChanged) {
                    this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.DESCENT, 'SPD ' + p.phaseSpeeds.DESCENT);
                    this._cmd('AP_NAV1_HOLD', true, 'NAV tracking');
                }
                // Continuously enforce VS descent (dedup prevents spam)
                this._cmd('AP_VS_HOLD', true, 'VS hold for descent');
                this._cmdValue('AP_VS_VAR_SET', p.descent.normalRate, 'VS ' + p.descent.normalRate);
                // Descent throttle: keep power high until speed builds from gravity.
                // Pitching nose-down in descent adds speed via gravity — don't cut throttle
                // until speed is above descent target, or stall protection will fight descent.
                const desIas = d.speed || 0;
                const desTarget = p.phaseSpeeds.DESCENT || 100;
                let desThrottle;
                if (desIas < desTarget - 10) desThrottle = 75;    // below target — maintain power
                else if (desIas < desTarget + 5) desThrottle = 55; // near target — moderate power
                else if (desIas < desTarget + 15) desThrottle = 40; // above target — reduce
                else desThrottle = 25;                              // well above target — pull back
                this._cmdValue('THROTTLE_SET', desThrottle, 'Descent throttle ' + desThrottle + '%');
                break;
            }

            case 'APPROACH': {
                if (!apState.master) {
                    this._cmd('AP_MASTER', true, 'Engage AP for approach');
                }
                const aprAgl = d.altitudeAGL || 0;
                if (phaseChanged) {
                    this._cmdValue('AP_SPD_VAR_SET', p.phaseSpeeds.APPROACH, 'SPD ' + p.phaseSpeeds.APPROACH);
                    this._cmd('AP_VS_HOLD', true, 'VS hold for approach');
                    this._cmdValue('AP_VS_VAR_SET', p.descent.approachRate, 'VS ' + p.descent.approachRate);
                }
                // Progressive flap deployment (use notch # as value to bypass dedup)
                const flaps = d.flapsIndex || 0;
                if (flaps < 1) {
                    this._cmd('FLAPS_DOWN', 1, 'Flaps 1 for approach');
                } else if (aprAgl < 800 && flaps < 2) {
                    this._cmd('FLAPS_DOWN', 2, 'Flaps 2 below 800 AGL');
                } else if (aprAgl < 400 && flaps < 3) {
                    this._cmd('FLAPS_DOWN', 3, 'Full flaps below 400 AGL');
                }
                // Use nav data from GTN750 for smarter approach mode selection
                if (this._navState) {
                    const nav = this._navState;
                    if (nav.cdi?.gsValid && nav.approach?.hasGlideslope) {
                        if (!apState.aprHold || phaseChanged) {
                            this._cmd('AP_APR_HOLD', true, 'APR mode (GS valid)');
                        }
                    } else if (nav.approach?.mode) {
                        if (!apState.aprHold || phaseChanged) {
                            this._cmd('AP_APR_HOLD', true, 'APR mode (lateral)');
                        }
                    }
                }
                // Fixed approach power with flaps — speed settles to ~75kts.
                // Only intervene near stall or overspeed.
                const aprIas = d.speed || 0;
                let aprThrottle = 40;                           // base approach power (with flaps)
                if (aprIas < (speeds.Vs0 || 48) + 10) aprThrottle = 55;  // stall margin — add power
                else if (aprIas > (speeds.Vfe || 85) - 5) aprThrottle = 25;  // flap overspeed — pull back
                this._cmdValue('THROTTLE_SET', aprThrottle, 'Approach throttle ' + aprThrottle + '%');
                break;
            }

            case 'LANDING': {
                const lndAgl = d.altitudeAGL || 0;
                const lndGs = d.groundSpeed || 0;
                const lndOnGround = lndAgl < 10 && d.onGround !== false;
                // Ensure full flaps (use notch 4 to bypass dedup from approach flaps)
                if ((d.flapsIndex || 0) < 3) {
                    this._cmd('FLAPS_DOWN', 4, 'Full flaps for landing');
                }
                if (!lndOnGround) {
                    // ── Airborne: progressive VS reduction for gentle touchdown ──
                    if (lndAgl > 100) {
                        // High on final — normal descent
                        if (!apState.master) this._cmd('AP_MASTER', true, 'AP for final');
                        this._cmd('AP_VS_HOLD', true, 'VS hold final');
                        this._cmdValue('AP_VS_VAR_SET', -300, 'VS -300 (final)');
                        this._cmdValue('THROTTLE_SET', 35, 'Final throttle');
                    } else if (lndAgl > 50) {
                        // Short final — gentle
                        if (apState.master) {
                            this._cmdValue('AP_VS_VAR_SET', -200, 'VS -200 (short final)');
                        }
                        this._cmdValue('THROTTLE_SET', 25, 'Short final throttle');
                    } else if (lndAgl > 20) {
                        // Pre-flare — very gentle
                        if (apState.master) {
                            this._cmdValue('AP_VS_VAR_SET', -100, 'VS -100 (pre-flare)');
                        }
                        this._cmdValue('THROTTLE_SET', 15, 'Pre-flare throttle');
                    } else {
                        // Below 20ft — disengage AP, idle power, slight nose up
                        if (apState.master) {
                            delete this._lastCommands['AP_MASTER'];
                            this._cmd('AP_MASTER', false, 'AP off — flare');
                        }
                        this._cmdValue('THROTTLE_SET', 0, 'Idle for flare');
                        this._cmdValue('AXIS_ELEVATOR_SET', -30, 'Nose up for flare');
                    }
                } else {
                    // ── On ground: rollout ──
                    if (apState.master) {
                        delete this._lastCommands['AP_MASTER'];
                        this._cmd('AP_MASTER', false, 'AP off — on ground');
                    }
                    this._cmdValue('THROTTLE_SET', 0, 'Idle on rollout');
                    this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release elevator');
                    this._cmdValue('AXIS_RUDDER_SET', 0, 'Center rudder');
                    this._cmdValue('AXIS_AILERONS_SET', 0, 'Center ailerons');
                    // Retract flaps on ground
                    if ((d.flapsIndex || 0) > 0) {
                        this._cmd('FLAPS_UP', true, 'Retract flaps after landing');
                    }
                    if (lndGs < 40 && lndGs > 5 && !d.parkingBrake) {
                        delete this._lastCommands['PARKING_BRAKES'];
                        this._cmd('PARKING_BRAKES', true, 'Braking');
                    }
                }
                break;
            }
        }
    }

    /**
     * Takeoff sub-phase state machine.
     * Sub-phases: BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE
     */
    _evaluateTakeoff(d, apState, phaseChanged) {
        const p = this.profile;
        const speeds = p.speeds;
        const tk = p.takeoff || {};
        const ias = d.speed || 0;
        const agl = d.altitudeAGL || 0;
        const gs = d.groundSpeed || 0;
        const vs = d.verticalSpeed || 0;
        // MSFS 2024: onGround SimVar sometimes false on the ground, but reliable when airborne.
        // Use AGL < 10 as primary, with SimVar as tiebreaker.
        const onGround = agl < 10 && d.onGround !== false;

        // Initialize sub-phase on entry
        if (phaseChanged || !this._takeoffSubPhase) {
            this._takeoffSubPhase = 'BEFORE_ROLL';
        }

        // Ensure AP is off during takeoff — manual controls only until INITIAL_CLIMB
        // Force-clear dedup cache because AP_MASTER is a toggle — the sim can re-engage
        // independently, making our cached 'false' stale.
        if (apState.master && this._takeoffSubPhase !== 'INITIAL_CLIMB' && this._takeoffSubPhase !== 'DEPARTURE') {
            delete this._lastCommands['AP_MASTER'];
            this._cmd('AP_MASTER', false, 'AP off for takeoff');
        }

        switch (this._takeoffSubPhase) {
            case 'BEFORE_ROLL':
                // Verify configuration: mixture rich, correct flaps
                this._cmdValue('MIXTURE_SET', 100, 'Mixture RICH for takeoff');
                // Release parking brake if set
                if (d.parkingBrake) {
                    this._cmd('PARKING_BRAKES', true, 'Release parking brake');
                }
                // Advance to ROLL
                this._takeoffSubPhase = 'ROLL';
                break;

            case 'ROLL':
                // POH: Full power for takeoff
                if (d.parkingBrake) {
                    this._cmd('PARKING_BRAKES', true, 'Release parking brake');
                }
                this._cmdValue('THROTTLE_SET', 100, 'Full power');
                // Capture runway heading once
                if (!this._runwayHeading) {
                    this._runwayHeading = this._activeRunway?.heading || Math.round(d.heading || 0);
                }
                // Neutral elevator — aircraft builds speed on its own
                this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Neutral elevator');
                this._groundSteer(d, this._runwayHeading);
                // POH: Rotate at Vr
                if (ias >= (speeds.Vr || 55)) {
                    this._takeoffSubPhase = 'ROTATE';
                    this._rotateStartTime = Date.now();
                }
                break;

            case 'ROTATE':
                this._cmdValue('THROTTLE_SET', 100, 'Full power');
                // Target 8° pitch with very low authority — feedback prevents over-rotation
                this._targetPitch(d, 8, 10);
                // Wings level — prevent bank buildup during rotation and liftoff
                this._targetBank(d, 0, 10);
                this._groundSteer(d, this._runwayHeading);
                // Airborne — transition
                if (!onGround) {
                    this._takeoffSubPhase = 'LIFTOFF';
                }
                break;

            case 'LIFTOFF':
                // POH: Full power climb — pitch to 8° nose up for initial climb
                this._cmdValue('THROTTLE_SET', 100, 'Full power climb');
                // Gentle pitch target — C172 overshoots easily, max 10% authority
                if (agl < 100) {
                    this._targetPitch(d, 8, 10);
                } else {
                    this._pitchForSpeed(d, speeds.Vy || 74, 10);
                }
                // Wings level — counter P-factor/torque roll
                this._targetBank(d, 0, 10);
                // Coordinated rudder — track runway heading
                this._targetHeading(d, this._runwayHeading || d.heading, 'AXIS_RUDDER_SET', 10);
                // Stall protection: if near stall, push nose down immediately
                if (d.stallWarning || ias < (speeds.Vs1 || 53)) {
                    this._cmdValue('AXIS_ELEVATOR_SET', 10, 'STALL: nose down');
                }
                // Advance when climbing and at safe altitude
                if (vs > 100 && agl > (tk.initialClimbAgl || 200)) {
                    this._takeoffSubPhase = 'INITIAL_CLIMB';
                }
                break;

            case 'INITIAL_CLIMB':
                // Continue full power Vy climb until AP handoff
                this._cmdValue('THROTTLE_SET', 100, 'Full power climb');
                // Pitch for Vy — gentle authority (max 10%)
                this._pitchForSpeed(d, speeds.Vy || 74, 10);
                // Wings level + coordinated rudder
                this._targetBank(d, 0, 10);
                this._targetHeading(d, this._runwayHeading || d.heading, 'AXIS_RUDDER_SET', 10);
                // Stall protection
                if (d.stallWarning || ias < (speeds.Vs1 || 53)) {
                    this._cmdValue('AXIS_ELEVATOR_SET', 10, 'STALL: nose down');
                }
                // Engage AP when speed is safe and altitude sufficient
                {
                    const stallMargin = (speeds.Vs1 || 53) + 15;
                    if (ias >= stallMargin && agl > (tk.flapRetractAgl || 500)) {
                        // Release manual controls, hand off to AP
                        this._cmdValue('AXIS_ELEVATOR_SET', 0, 'Release for AP');
                        this._cmdValue('AXIS_RUDDER_SET', 0, 'Release for AP');
                        this._cmdValue('AXIS_AILERONS_SET', 0, 'Release for AP');
                        if (!apState.master) {
                            this._cmd('AP_MASTER', true, 'Engage AP');
                            const hdg = Math.round(d.heading || this._runwayHeading || 0);
                            this._cmdValue('HEADING_BUG_SET', hdg, 'HDG ' + hdg + '\u00B0');
                        }
                        this._cmd('AP_HDG_HOLD', true, 'HDG hold');
                        this._cmd('AP_VS_HOLD', true, 'VS hold');
                        this._cmdValue('AP_VS_VAR_SET', p.climb.normalRate || 500, 'VS +' + (p.climb.normalRate || 500));
                        this._takeoffSubPhase = 'DEPARTURE';
                    }
                }
                break;

            case 'DEPARTURE':
                // Retract flaps, set climb speed, set cruise alt target
                this._cmd('FLAPS_UP', true, 'Retract flaps');
                this._cmdValue('AP_SPD_VAR_SET', speeds.Vy, 'SPD ' + speeds.Vy + ' (Vy climb)');
                this._cmdValue('AP_ALT_VAR_SET', this._getCruiseAlt(), 'ALT ' + this._getCruiseAlt());
                // Do NOT engage AP_ALT_HOLD here — it captures current alt (~800ft)
                // and prevents the CLIMB phase from commanding VS climb to cruise
                this._cmd('LANDING_LIGHTS_TOGGLE', true, 'Lights off after departure');
                // Sub-phase complete — flight-phase.js will transition to CLIMB at 500+ AGL
                break;
        }
    }

    /** Get the current takeoff sub-phase (for debug display) */
    getTakeoffSubPhase() {
        return this._takeoffSubPhase;
    }

    /** Get current terrain alert level (for debug display) */
    getTerrainAlert() {
        return this._terrainAlert;
    }

    /**
     * Continuous flight envelope monitoring — runs EVERY evaluation cycle.
     * Monitors bank angle, airspeed, pitch, VS, and altitude deviations.
     * C172-specific limits applied from aircraft profile.
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
        // MSFS 2024: onGround SimVar sometimes false on the ground, but reliable when airborne.
        // Use AGL < 10 as primary, with SimVar as tiebreaker.
        const onGround = agl < 10 && d.onGround !== false;
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
                    this._cmdValue('AP_VS_VAR_SET', 0, 'Level off — bank recovery');
                }
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
                this._cmdValue('AP_VS_VAR_SET', vsCmd, 'STALL: nose down');
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
                this._cmdValue('AP_VS_VAR_SET', Math.min(vs + 200, 0), `Low IAS ${Math.round(ias)} (stall ${Math.round(stallSpeed)}) — reduce descent`);
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
                this._cmdValue('AP_VS_VAR_SET', Math.min(vs + 500, 0), 'OVERSPEED: reduce descent rate');
            }
            this._speedCorrectionActive = true;
        } else if (ias > vno && phase !== 'DESCENT') {
            // Over Vno in non-descent phase — reduce power
            this._cmdValue('THROTTLE_SET', 70, `IAS ${Math.round(ias)} > Vno ${vno} — reduce power`);
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
                this._cmdValue('AP_VS_VAR_SET', Math.min(vs, 500), `Pitch ${Math.round(pitch)}° — reduce climb`);
            }
        } else if (pitch < maxPitchDown && !onGround) {
            // Excessive nose-down — risk of overspeed/CFIT
            alert = alert || 'PITCH';
            if (apState.master) {
                this._cmdValue('AP_VS_VAR_SET', Math.max(vs, -300), `Pitch ${Math.round(pitch)}° — reduce descent`);
            }
        }

        // ── VS LIMITS ──
        // C172 should not sustain extreme vertical speeds
        const maxVs = limits.maxVs || 1000;
        const minVs = limits.minVs || -1500;

        if (vs > maxVs + 200 && apState.master && phase !== 'TAKEOFF') {
            this._cmdValue('AP_VS_VAR_SET', maxVs, `VS ${Math.round(vs)} > max ${maxVs} — limiting`);
        } else if (vs < minVs - 200 && apState.master) {
            this._cmdValue('AP_VS_VAR_SET', minVs, `VS ${Math.round(vs)} < min ${minVs} — limiting`);
        }

        // ── ALTITUDE DEVIATION (when AP ALT hold should be active) ──
        if (apState.master && apState.altitudeHold && phase === 'CRUISE') {
            const targetAlt = d.apAltSet || this._getCruiseAlt();
            const altDev = Math.abs(alt - targetAlt);
            if (altDev > 200) {
                // Drifting off target altitude — re-engage
                const correctVs = alt < targetAlt ? 300 : -300;
                this._cmdValue('AP_VS_VAR_SET', correctVs, `ALT deviation ${Math.round(altDev)}ft — correcting`);
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
                    this._cmdValue('AP_ALT_VAR_SET', safeAlt, `TERRAIN: climb to ${safeAlt}ft (terrain ${worstElev}ft at ${worstDist}nm)`);
                    this._cmd('AP_VS_HOLD', true, 'TERRAIN: VS hold for climb');
                    this._cmdValue('AP_VS_VAR_SET', 1000, 'TERRAIN: max climb');
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
                        this._cmdValue('AP_ALT_VAR_SET', safeAlt, `TAWS: climb to ${safeAlt}ft (external alert)`);
                        this._cmd('AP_VS_HOLD', true, 'TAWS: VS hold for climb');
                        this._cmdValue('AP_VS_VAR_SET', 1000, 'TAWS: max climb');
                    }
                }
            }
        }
    }

    /**
     * Push a toggle/boolean AP command
     */
    _cmd(command, value, description) {
        if (this._lastCommands[command] === value) return; // dedup
        this._lastCommands[command] = value;
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
        // Tighter dedup for continuous flight controls (AXIS_*) — they need frequent updates
        const isAxis = command.startsWith('AXIS_');
        const tolerance = isAxis ? 0.1 : 1;
        if (lastVal !== undefined && Math.abs(lastVal - value) < tolerance) return;
        this._lastCommands[command] = value;
        this.commandQueue.enqueue({
            type: command,
            value: value,
            description: description || `${command} \u2192 ${value}`,
            priority: isAxis ? 'high' : 'normal'  // axis controls process first
        });
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
     */
    _targetPitch(d, targetDeg, maxDeflection) {
        const pitch = d.pitch || 0;
        const error = targetDeg - pitch;  // positive = need more nose up
        // Sign convention: negative elevator = nose up, positive elevator = nose down
        const maxDefl = maxDeflection || 30;

        // Proportional term: gain scales with authority needed
        const gain = maxDefl > 40 ? 3.0 : 1.8;
        const pTerm = -error * gain;

        // Derivative term: strong damping to prevent porpoising
        const now = Date.now();
        const dt = this._lastPitchTime ? (now - this._lastPitchTime) / 1000 : 0.2;
        const clampedDt = Math.max(0.05, Math.min(dt, 1.0));  // guard against weird dt values
        const pitchRate = (pitch - (this._lastPitch != null ? this._lastPitch : pitch)) / clampedDt; // deg/sec
        this._lastPitch = pitch;
        this._lastPitchTime = now;
        const dTerm = pitchRate * 1.2;  // strong damping — oppose rapid pitch changes

        // Combined: capped at ±maxDefl
        let elevator = Math.max(-maxDefl, Math.min(maxDefl, pTerm + dTerm));

        // Gentle emergency: if pitch > 12°, progressively add nose-down
        if (pitch > 12) {
            const emergencyPush = (pitch - 12) * 2.0;  // gentle push, not slam
            elevator = Math.max(-maxDefl, Math.min(maxDefl + 20, elevator + emergencyPush));
        }

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

        // Minimum pitch: don't go negative unless we're dangerously slow
        // After liftoff, maintain at least a slight climb
        if (ias > (this.profile?.speeds?.Vs1 || 53)) {
            pitchTarget = Math.max(0, pitchTarget);  // never push nose below horizon if above stall
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

        // Deadband: don't correct if error < 0.5°
        if (Math.abs(hdgError) < 0.5) return;

        // Gain: lower at speed (aerodynamic authority increases)
        const baseGain = Math.max(3.0, 8.0 - gs * 0.06);
        const maxDefl = 60;

        // Through server.js: positive RUDDER_SET value → left yaw in MSFS
        // Drifted right (+error) → need LEFT rudder (positive value) to correct
        const rudder = Math.max(-maxDefl, Math.min(maxDefl, hdgError * baseGain));
        this._cmdValue('AXIS_RUDDER_SET', Math.round(rudder),
            `Rudder hdg ${Math.round(hdg)}→${Math.round(targetHdg)} (err ${hdgError > 0 ? '+' : ''}${hdgError.toFixed(1)}°)`);

        // Roll bias accumulates for use after liftoff (P-factor compensation)
        const bank = d.bank || 0;
        const powerFactor = Math.max(0.1, (d.throttle || 0) / 100);
        this._rollBias += -bank * 0.02 * powerFactor;
        this._rollBias *= 0.97;
        this._rollBias = Math.max(-20, Math.min(20, this._rollBias));
    }

    _targetHeading(d, targetHdg, axis, maxDeflection, gain) {
        if (targetHdg == null) return;
        const hdg = d.heading || 0;
        const error = ((hdg - targetHdg + 540) % 360) - 180;  // positive = heading right of target
        const g = gain || 1.5;
        // Through server.js: positive RUDDER_SET value → left yaw in MSFS
        // Drifted right (+error) → need LEFT rudder (positive value) to correct
        const deflection = Math.max(-maxDeflection, Math.min(maxDeflection, error * g));
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

        // Apply accumulated roll bias (P-factor/torque compensation learned on ground)
        const bias = this._rollBias || 0;

        // Positive AILERON_SET = roll left (opposing right bank). Positive error = banked right → positive aileron.
        const deflection = Math.max(-maxDeflection, Math.min(maxDeflection, error * gain + bias));
        this._cmdValue('AXIS_AILERONS_SET', Math.round(deflection * 10) / 10,
            `Bank ${bank.toFixed(1)}° → ${targetBank.toFixed(1)}° (ail ${deflection > 0 ? '+' : ''}${deflection.toFixed(1)})`);
    }

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

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
}
