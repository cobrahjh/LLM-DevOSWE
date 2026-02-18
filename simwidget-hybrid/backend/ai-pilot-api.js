/**
 * AI Pilot API Routes
 * Server-side API for the AI Autopilot pane.
 * Pattern follows copilot-api.js: exports setupAiPilotRoutes(app, getFlightData)
 */

const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// ── Backend Terrain Grid Loader ──────────────────────────────────────
// Loads the 10km binary terrain grid for server-side elevation lookups
// Used in LLM prompts and terrain API endpoint
const TERRAIN_BIN = path.join(__dirname, '..', 'ui', 'shared', 'data', 'terrain-grid-10km.bin');
let _terrainGrid = null; // { width, height, latMin, latMax, lonMin, lonMax, cellDeg, data: Int16Array }

// Shared state for cross-machine pane sync (AI Autopilot ↔ GTN750)
const _sharedState = { autopilot: null, nav: null, airport: null, tuning: null, lastUpdate: 0 };

// ── Sally Performance Metrics ───────────────────────────────────────
const _perfMetrics = {
    queries: [],       // last 50 queries: { time, durationMs, provider, model, promptTokens, responseTokens, responseLen }
    totalQueries: 0,
    totalErrors: 0,
    startTime: Date.now()
};

function logQueryMetric(metric) {
    _perfMetrics.queries.push(metric);
    if (_perfMetrics.queries.length > 50) _perfMetrics.queries.shift();
    _perfMetrics.totalQueries++;
}

function getPerfSummary() {
    const q = _perfMetrics.queries;
    const recent = q.slice(-20);  // last 20 for averages
    const durations = recent.map(r => r.durationMs).filter(d => d > 0);
    const responseLens = recent.map(r => r.responseLen).filter(l => l > 0);

    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const maxDuration = durations.length ? Math.max(...durations) : 0;
    const minDuration = durations.length ? Math.min(...durations) : 0;
    const avgResponseLen = responseLens.length ? Math.round(responseLens.reduce((a, b) => a + b, 0) / responseLens.length) : 0;

    // Queries per minute (last 5 minutes)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentCount = q.filter(r => r.time > fiveMinAgo).length;
    const qpm = Math.round(recentCount / 5 * 10) / 10;

    // System memory
    const mem = process.memoryUsage();

    return {
        totalQueries: _perfMetrics.totalQueries,
        totalErrors: _perfMetrics.totalErrors,
        uptime_s: Math.round((Date.now() - _perfMetrics.startTime) / 1000),
        recentQueries: recent.length,
        avgResponseTime_ms: avgDuration,
        maxResponseTime_ms: maxDuration,
        minResponseTime_ms: minDuration,
        avgResponseLength: avgResponseLen,
        queriesPerMinute: qpm,
        memory: {
            heapUsed_mb: Math.round(mem.heapUsed / 1048576 * 10) / 10,
            heapTotal_mb: Math.round(mem.heapTotal / 1048576 * 10) / 10,
            rss_mb: Math.round(mem.rss / 1048576 * 10) / 10,
            external_mb: Math.round((mem.external || 0) / 1048576 * 10) / 10
        },
        lastQuery: q.length > 0 ? q[q.length - 1] : null,
        history: q.slice(-20).map(r => ({
            time: r.time,
            durationMs: r.durationMs,
            responseLen: r.responseLen,
            learnings: r.learnings || 0,
            tuningChanged: r.tuningChanged || false,
            error: r.error || false
        }))
    };
}

// ── Takeoff Attempt Logger ──────────────────────────────────────────
// Persists takeoff attempts so Sally can learn from previous results
const TAKEOFF_LOG_PATH = path.join(__dirname, '..', 'data', 'takeoff-attempts.json');
let _takeoffAttempts = [];
try {
    if (fs.existsSync(TAKEOFF_LOG_PATH)) {
        _takeoffAttempts = JSON.parse(fs.readFileSync(TAKEOFF_LOG_PATH, 'utf8'));
    }
} catch (_) { _takeoffAttempts = []; }

// ── Sally's Conversation Log ────────────────────────────────────────
// Every exchange (user message + Sally's response) persisted for review.
const CONVO_LOG_PATH = path.join(__dirname, '..', 'data', 'sally-conversations.json');
let _sallyConversations = [];
try {
    if (fs.existsSync(CONVO_LOG_PATH)) {
        _sallyConversations = JSON.parse(fs.readFileSync(CONVO_LOG_PATH, 'utf8'));
    }
} catch (_) { _sallyConversations = []; }

function logConversation(entry) {
    _sallyConversations.push(entry);
    // Keep last 200 conversations
    if (_sallyConversations.length > 200) {
        _sallyConversations = _sallyConversations.slice(-200);
    }
    try {
        const dir = path.dirname(CONVO_LOG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONVO_LOG_PATH, JSON.stringify(_sallyConversations, null, 2));
    } catch (e) {
        console.warn('[AI-Pilot] Failed to save conversation log:', e.message);
    }
}

// ── Sally's Learnings — Persistent Observations ─────────────────────
// Stable conclusions Sally derives from analyzing attempts.
// Survives across sessions. Injected into her system prompt.
const LEARNINGS_PATH = path.join(__dirname, '..', 'data', 'sally-learnings.json');
let _sallyLearnings = [];
try {
    if (fs.existsSync(LEARNINGS_PATH)) {
        _sallyLearnings = JSON.parse(fs.readFileSync(LEARNINGS_PATH, 'utf8'));
    }
} catch (_) { _sallyLearnings = []; }

function saveLearnings() {
    try {
        const dir = path.dirname(LEARNINGS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LEARNINGS_PATH, JSON.stringify(_sallyLearnings, null, 2));
    } catch (e) {
        console.warn('[AI-Pilot] Failed to save learnings:', e.message);
    }
}

/**
 * Parse LEARNING: lines from Sally's response and persist them.
 * Format: LEARNING: [85%] observation text here
 * Deduplicates by checking similarity — reinforces confidence if same conclusion repeated.
 */
function parseLearnings(text) {
    const lines = text.split('\n');
    const newLearnings = [];
    for (const line of lines) {
        const match = line.match(/^LEARNING:\s*(?:\[(\d+)%?\])?\s*(.+)/i);
        if (match) {
            const confidence = match[1] ? Math.min(100, Math.max(10, parseInt(match[1]))) : 50;
            const observation = match[2].trim();
            if (observation.length < 10) continue;  // skip trivial

            // Check similarity to existing learnings
            let reinforced = false;
            for (const existing of _sallyLearnings) {
                const existWords = new Set(existing.observation.toLowerCase().split(/\s+/));
                const newWords = observation.toLowerCase().split(/\s+/);
                const overlap = newWords.filter(w => existWords.has(w)).length;
                const similarity = overlap / Math.max(newWords.length, 1);

                if (similarity > 0.7) {
                    // Reinforcement: same conclusion reached again → boost confidence
                    existing.reinforcements = (existing.reinforcements || 0) + 1;
                    existing.confidence = Math.min(99, (existing.confidence || 50) + 10);
                    existing.lastReinforced = new Date().toISOString();
                    existing.observation = observation;  // update wording to latest
                    reinforced = true;
                    console.log(`[AI-Pilot] Learning #${existing.id} reinforced → ${existing.confidence}% (×${existing.reinforcements})`);
                    break;
                }
            }

            if (!reinforced) {
                newLearnings.push({
                    id: _sallyLearnings.length + newLearnings.length + 1,
                    time: new Date().toISOString(),
                    observation,
                    confidence,
                    reinforcements: 0,
                    attemptRef: _takeoffAttempts.length,
                    category: categorizeLearning(observation)
                });
            }
        }
    }
    if (newLearnings.length > 0) {
        _sallyLearnings.push(...newLearnings);
        // Keep only last 100 learnings
        if (_sallyLearnings.length > 100) {
            _sallyLearnings = _sallyLearnings.slice(-100);
        }
        saveLearnings();
        console.log(`[AI-Pilot] Sally saved ${newLearnings.length} new learning(s): ${newLearnings.map(l => `[${l.confidence}%] ${l.observation.slice(0, 50)}`).join('; ')}`);
    }
    return newLearnings;
}

/** Auto-categorize a learning by keyword matching */
function categorizeLearning(text) {
    const t = text.toLowerCase();
    if (t.includes('elevator') || t.includes('pitch') || t.includes('rotate') || t.includes('nose')) return 'elevator';
    if (t.includes('aileron') || t.includes('bank') || t.includes('roll') || t.includes('wing')) return 'aileron';
    if (t.includes('rudder') || t.includes('yaw') || t.includes('heading') || t.includes('p-factor')) return 'rudder';
    if (t.includes('throttle') || t.includes('power') || t.includes('engine')) return 'throttle';
    if (t.includes('speed') || t.includes('vr') || t.includes('vs1') || t.includes('stall')) return 'speed';
    if (t.includes('joystick') || t.includes('deflection') || t.includes('authority')) return 'control';
    if (t.includes('transition') || t.includes('phase') || t.includes('handoff')) return 'phase';
    return 'general';
}

function loadTerrainGrid() {
    if (_terrainGrid) return _terrainGrid;
    try {
        if (!fs.existsSync(TERRAIN_BIN)) return null;
        const buf = fs.readFileSync(TERRAIN_BIN);
        const magic = buf.toString('ascii', 0, 4);
        if (magic !== 'TGRD') return null;
        _terrainGrid = {
            width:  buf.readUInt16LE(6),
            height: buf.readUInt16LE(8),
            latMin: buf.readInt32LE(10) / 1000,
            latMax: buf.readInt32LE(14) / 1000,
            lonMin: buf.readInt32LE(18) / 1000,
            lonMax: buf.readInt32LE(22) / 1000,
            cellDeg: buf.readInt32LE(26) / 100000,
            data: new Int16Array(buf.buffer, buf.byteOffset + 32, buf.readUInt16LE(6) * buf.readUInt16LE(8))
        };
        console.log(`[AI-Pilot] Terrain grid loaded: ${_terrainGrid.width}x${_terrainGrid.height}, ${(_terrainGrid.cellDeg * 111.12).toFixed(1)}km/cell`);
        return _terrainGrid;
    } catch (e) {
        console.warn('[AI-Pilot] Terrain grid load failed:', e.message);
        return null;
    }
}

function getTerrainElevFt(lat, lon) {
    const tg = loadTerrainGrid();
    if (!tg) return 0;
    const row = Math.floor((tg.latMax - lat) / tg.cellDeg);
    const col = Math.floor((lon - tg.lonMin) / tg.cellDeg);
    if (row < 0 || row >= tg.height || col < 0 || col >= tg.width) return 0;
    return Math.round(tg.data[row * tg.width + col] * 3.28084);
}

function getTerrainAhead(lat, lon, hdg, distNm) {
    const tg = loadTerrainGrid();
    if (!tg) return [];
    const cosLat = Math.cos(lat * Math.PI / 180);
    const hdgRad = hdg * Math.PI / 180;
    const points = [];
    for (const d of [2, 5, 10, 20]) {
        if (d > distNm) break;
        const dLat = (d / 60) * Math.cos(hdgRad);
        const dLon = (d / 60) * Math.sin(hdgRad) / cosLat;
        const elevFt = getTerrainElevFt(lat + dLat, lon + dLon);
        points.push({ distNm: d, elevFt });
    }
    return points;
}
// ─────────────────────────────────────────────────────────────────────

// Load copilot config (reuses same license/API key)
function getCopilotConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            return config.copilot || {};
        }
    } catch (e) {
        console.error('[AI-Pilot] Config load error:', e.message);
    }
    return {};
}

// AI Pilot system prompt — specialized for autopilot advisory
function buildAiPilotPrompt(flightData) {
    const fd = flightData || {};
    return `You are an AI flight advisor named Sally for a Cessna 172 in Microsoft Flight Simulator.
You provide concise, actionable autopilot and flight control recommendations.
Keep responses to 2-3 sentences maximum.
ALWAYS respond in English only. Never use other languages, special characters, emoji, or markdown formatting (no #, *, _, etc.).
Your text is read aloud via TTS. NEVER say "JSON", "commands JSON", "tuning JSON", "API", "endpoint", "parameter", "SimConnect", or any programming terms. Speak naturally as a pilot would. Put any machine-readable blocks silently at the end.
When recommending changes, prefix with "RECOMMEND:" on its own line.

C172 V-SPEEDS (POH at max gross 2550 lbs): Vr=55, Vx=62, Vy=74, Vcruise=110, Vfe=85, Va=99, Vno=129, Vne=163, Vref=65, Vs0=48, Vs1=53
C172 LIMITS: Max bank 25° (AP), critical bank 45°, max pitch +20°/-15°, max VS +1000/-1500 fpm, ceiling 14000ft
STALL SPEED IS DYNAMIC: Stall speed changes with weight and bank angle.
- Lighter aircraft stalls at LOWER speed: Vs = Vs_ref × √(currentWeight / maxGross)
- In a bank, stall speed INCREASES: Vs = Vs × √(1/cos(bankAngle))
- At 30° bank: stall speed +7%. At 45° bank: +19%. At 60° bank: +41%.
- ALWAYS use the DYNAMIC stall speed from the envelope data, not the static POH values.
SPEED ENVELOPE: Below dynamic stall speed +10 is warning zone. Above Vno needs power reduction. Near Vne is emergency.

CRITICAL: The autopilot (AP) is ONLY used in the air, NEVER on the ground. Ground taxi uses throttle and rudder steering only. AP Master, heading hold, altitude hold, and VS hold are all OFF during taxi, takeoff roll, and landing rollout. AP is first engaged at 200 AGL after liftoff.

PROCEDURES BY PHASE:
- PREFLIGHT/TAXI: AP is OFF. Steer with rudder only. Throttle controls taxi speed. No AP commands ever on the ground.
- BEFORE TAKEOFF: Runup at 1800 RPM, check mags (125 RPM max drop), flaps 0-10°, trim takeoff.
- TAKEOFF ROLL: Full throttle, mixture rich. Steer with rudder (NO AP). At 55 KIAS (Vr) rotate with ~10° pitch up.
- INITIAL CLIMB: At 200 AGL with positive climb, NOW engage AP, HDG hold, VS +700. This is the FIRST time AP is used.
- DEPARTURE (500+ AGL): Retract flaps, set Vy (74 kt), set cruise altitude target.
- CLIMB: Maintain Vy, full throttle, lean above 3000 ft.
- CRUISE: Level at target alt, set cruise power (2200-2400 RPM), lean mixture.
- DESCENT: Enrich mixture, reduce power, -500 fpm, monitor carb heat.
- APPROACH: Mixture rich, carb heat on, flaps as needed, 65-75 KIAS. Disengage AP below 200 AGL.
- LANDING: Full flaps, 60-65 KIAS (Vref), AP OFF, flare at 10-20 ft AGL.

CURRENT FLIGHT STATE:
- Altitude: ${Math.round(fd.altitude || 0)} ft MSL, ${Math.round(fd.altitudeAGL || 0)} ft AGL
- Speed: ${Math.round(fd.speed || 0)} KIAS, GS ${Math.round(fd.groundSpeed || 0)} kt
- Heading: ${Math.round(fd.heading || 0)}°, Track ${Math.round(fd.groundTrack || 0)}°
- Bank: ${Math.round(fd.bank || 0)}°, Pitch: ${(fd.pitch || 0).toFixed(1)}°
- VS: ${Math.round(fd.verticalSpeed || 0)} fpm
- On Ground: ${fd.onGround ? 'Yes' : 'No'}
- Stall Warning: ${fd.stallWarning ? 'YES ⚠' : 'No'}, Overspeed: ${fd.overspeedWarning ? 'YES ⚠' : 'No'}
- AP Master: ${fd.apMaster ? 'ON' : 'OFF'}
- AP HDG: ${fd.apHdgLock ? Math.round(fd.apHdgSet || 0) + '°' : 'OFF'}
- AP ALT: ${fd.apAltLock ? Math.round(fd.apAltSet || 0) + ' ft' : 'OFF'}
- AP VS: ${fd.apVsLock ? Math.round(fd.apVsSet || 0) + ' fpm' : 'OFF'}
- Wind: ${Math.round(fd.windDirection || 0)}°/${Math.round(fd.windSpeed || 0)} kt
- Fuel: ${Math.round(fd.fuelTotal || 0)} gal, Flow: ${(fd.fuelFlow || 0).toFixed(1)} gph
- Gear: ${fd.gearDown ? 'DOWN' : 'UP'}, Flaps: ${fd.flapsIndex || 0}
- Mixture: ${Math.round(fd.mixture || 0)}%, Throttle: ${Math.round(fd.throttle || 0)}%
- Engine RPM: ${Math.round(fd.engineRpm || 0)}
- Lat/Lon: ${(fd.latitude || 0).toFixed(4)}, ${(fd.longitude || 0).toFixed(4)}
${buildEnvelopeContext(fd)}${buildTerrainContext(fd)}${buildNavContext()}${buildAirportContext()}${buildTakeoffContext()}`;
}

function buildEnvelopeContext(fd) {
    const apState = _sharedState.autopilot;
    const env = apState?.envelope;
    if (!env) {
        // Fallback: compute basic envelope from flight data if no shared state
        const fuelGal = fd.fuelTotal || 42;
        const weight = 1680 + (fuelGal * 6) + 340; // empty + fuel + payload
        const bank = Math.abs(fd.bank || 0);
        const bankRad = bank * Math.PI / 180;
        const cosB = Math.cos(bankRad);
        const lf = cosB > 0.26 ? (1 / cosB) : 3.86;
        const wr = Math.sqrt(weight / 2550);
        const slr = Math.sqrt(lf);
        const vs1d = Math.round(53 * wr * slr);
        const vs0d = Math.round(48 * wr * slr);
        const vsAct = (fd.flapsIndex > 0) ? vs0d : vs1d;
        const margin = (fd.speed || 0) - vsAct;
        return `\nDYNAMIC ENVELOPE (computed):
- Est. Weight: ${Math.round(weight)} lbs (${Math.round(weight/2550*100)}% MTOW)
- Bank: ${Math.round(bank)}°, Load Factor: ${lf.toFixed(2)}G
- Dynamic Stall: ${vsAct} kt (clean ${vs1d}, flaps ${vs0d}) vs POH ${(fd.flapsIndex > 0) ? 48 : 53} kt
- Stall Margin: ${Math.round(margin)} kt${margin < 10 ? ' ⚠ LOW' : ''}
- Dynamic Va: ${Math.round(99 * wr)} kt (POH 99 at max gross)`;
    }
    let ctx = `\nDYNAMIC ENVELOPE (real-time):
- Weight: ${env.estimatedWeight} lbs (${Math.round(env.weightRatio * 100)}% MTOW), Fuel: ${env.fuelGal} gal
- Bank: ${env.bankAngle}°, Load Factor: ${env.loadFactor}G
- Dynamic Stall: ${Math.round(env.vsActive)} kt (clean ${Math.round(env.vs1Dynamic)}, flaps ${Math.round(env.vs0Dynamic)}) vs POH Vs1=${env.vs1Ref}/Vs0=${env.vs0Ref}
- Stall Margin: ${env.stallMargin} kt (${env.stallMarginPct}%)${env.stallMargin < 10 ? ' ⚠ CRITICALLY LOW' : env.stallMargin < 15 ? ' ⚠ LOW' : ''}
- Dynamic Va: ${Math.round(env.vaDynamic)} kt (POH ${env.vaRef} at max gross)
- Overspeed Margin: ${env.overspeedMargin} kt to Vne`;
    return ctx;
}

function buildTerrainContext(fd) {
    const lat = fd.latitude, lon = fd.longitude, hdg = fd.heading;
    if (!lat || !lon) return '';
    const here = getTerrainElevFt(lat, lon);
    const ahead = getTerrainAhead(lat, lon, hdg || 0, 20);
    if (!ahead.length && here <= 0) return '';
    let ctx = `\nTERRAIN (max elevation per ~10km cell):
- Below aircraft: ${here} ft MSL`;
    for (const p of ahead) {
        if (p.elevFt > 0) ctx += `\n- ${p.distNm}nm ahead: ${p.elevFt} ft MSL`;
    }
    const alt = fd.altitude || 0;
    const worstAhead = ahead.reduce((max, p) => p.elevFt > max ? p.elevFt : max, 0);
    if (worstAhead > 0 && alt > 0) {
        const clearance = Math.round(alt - worstAhead);
        ctx += `\n- Min clearance ahead: ${clearance} ft ${clearance < 1000 ? '⚠ LOW' : ''}`;
    }
    return ctx;
}

function buildNavContext() {
    const nav = _sharedState.nav;
    if (!nav) return '';
    let ctx = '\nNAVIGATION (from GTN750):';
    if (nav.flightPlan) {
        const fp = nav.flightPlan;
        ctx += `\n- Route: ${fp.departure || '?'} → ${fp.arrival || '?'} (${fp.waypointCount || 0} waypoints)`;
        if (fp.cruiseAltitude) ctx += `\n- Cruise Alt: ${fp.cruiseAltitude} ft`;
        if (fp.totalDistance) ctx += `\n- Total Distance: ${fp.totalDistance.toFixed(0)} nm`;
    }
    if (nav.activeWaypoint) {
        const wp = nav.activeWaypoint;
        ctx += `\n- Active WP: ${wp.ident} (${wp.distNm?.toFixed(1) || '?'} nm, ETE ${wp.eteMin?.toFixed(1) || '?'} min, BRG ${wp.bearingMag?.toFixed(0) || '?'}°)`;
    }
    if (nav.cdi) {
        ctx += `\n- CDI: ${nav.cdi.source}, DTK ${nav.cdi.dtk?.toFixed(0) || '?'}°, XTRK ${nav.cdi.xtrk?.toFixed(1) || '0'} nm`;
        if (nav.cdi.gsValid) ctx += ', GS valid';
    }
    if (nav.destDistNm != null) {
        ctx += `\n- Remaining: ${nav.destDistNm.toFixed(0)} nm`;
    }
    return ctx;
}

function buildAirportContext() {
    const aptData = _sharedState.airport;
    if (!aptData) return '';
    const apt = aptData.airport;
    const rwy = aptData.activeRunway;
    if (!apt) return '';
    let ctx = '\nAIRPORT/RUNWAY:';
    ctx += `\n- Nearest: ${apt.icao || '?'} (${apt.name || '?'})`;
    ctx += `\n- Distance: ${apt.distance?.toFixed(1) || '?'} nm, Bearing: ${apt.bearing?.toFixed(0) || '?'}°`;
    ctx += `\n- Field Elevation: ${apt.elevation || '?'} ft MSL`;
    if (apt.runways?.length) {
        ctx += `\n- Runways: ${apt.runways.map(r => `${r.id}(${r.length || '?'}ft)`).join(', ')}`;
    }
    if (rwy) {
        ctx += `\n- Active Runway: ${rwy.id}, Heading ${rwy.heading}°, Length ${rwy.length || '?'} ft`;
        ctx += `\n- USE THIS RUNWAY HEADING (${rwy.heading}°) for takeoff/approach alignment`;
    }
    return ctx;
}

function buildTakeoffContext() {
    // Sally's complete system knowledge — architecture, physics, parameters.
    // NO suggested values or ranges. She derives everything from attempt telemetry.
    const attempts = _takeoffAttempts.slice(-10); // last 10 attempts
    let ctx = `
AI AUTOPILOT TAKEOFF SYSTEM — You are the TUNING ENGINEER.
Analyze telemetry from previous attempts. Output new parameter values. Achieve successful takeoffs.
You must derive ALL values empirically from attempt results. No guessing — observe, reason, adjust.

SYSTEM ARCHITECTURE:
- Rule Engine: Browser-side, evaluates flight data every ~200ms, sends commands per sub-phase
- Command Queue: AP commands rate-limited (2/sec), axis commands (elevator/aileron/throttle) bypass queue at 50ms intervals
- Server Held-Axes: Dedicated 60Hz timer reapplies axis commands via SimConnect transmitClientEvent
- Physical joystick polls at ~60-120Hz, constantly sending axis=0 (spring-center)
- Our 60Hz timer fights the joystick — effective deflection is roughly HALF of commanded value
- Example: commanding -80% elevator → actual surface deflection ~40% due to joystick winning ~50% of frames

SUB-PHASE FLOW (sequential, each must complete before next):
BEFORE_ROLL → ROLL → ROTATE → LIFTOFF → INITIAL_CLIMB → DEPARTURE

BEFORE_ROLL:
- Centers all axes (near-zero, not zero — zero releases held-axes)
- Releases parking brake, sets mixture
- Immediately transitions to ROLL

ROLL:
- Throttle at rollThrottle, elevator/ailerons near-zero, rudder steers runway heading
- Transition: IAS >= vrSpeed → ROTATE

ROTATE:
- Progressive elevator: starts at a ramp start value, increases by rampRate per second toward rotateElevator max
- Rudder steering continues, trim nose up applied
- Transition: wheels leave ground (not onGround) → LIFTOFF
- Timeout: if still on ground after rotateTimeout seconds → force LIFTOFF

LIFTOFF:
- Elevator held at liftoffElevator (constant, not progressive)
- Wings-level aileron corrections: bank × liftoffAileronGain, clamped to ±liftoffAileronMax
- Aileron only activates when |bank| > liftoffBankThreshold
- Transition: VS > liftoffVsThreshold AND AGL > liftoffClimbAgl → INITIAL_CLIMB

INITIAL_CLIMB:
- Elevator at climbElevator, aileron corrections same pattern as LIFTOFF
- Transition: IAS >= Vs1 + handoffSpeedMargin AND AGL > handoffAgl → DEPARTURE (AP handoff)

DEPARTURE:
- Releases all manual axes (elevator=0, aileron=0, rudder=0)
- Engages autopilot: AP_MASTER, HDG hold (current heading), VS hold at departureVS
- Retracts flaps, sets climb speed and cruise altitude

TUNABLE PARAMETERS (all set via TUNING_JSON — name: what it controls):
TAXI:
  taxiThrottleMin — minimum throttle during taxi (for steering authority)
  taxiThrottleMax — maximum throttle during taxi
  taxiTargetGS — target ground speed during taxi (knots)
  taxiHdgErrorThreshold — heading error above which throttle reduces (degrees)
  rudderBias — constant rudder offset to counter P-factor yaw (negative = right rudder)
  steerGainBase — rudder proportional gain at low speed
  steerGainDecay — how much gain reduces per knot of ground speed
  taxiRudderMaxLow — max rudder deflection at low ground speed
  steerDeadband — heading error below which rudder correction is zero (degrees)
ROLL:
  rollThrottle — throttle during takeoff roll (%)
  vrSpeed — rotation speed, IAS at which ROTATE begins (knots)
ROTATE:
  rotateElevator — maximum elevator deflection for rotation (negative = nose up, %)
  rotateRampRate — progressive elevator increase rate (%/second, used as: rampStart - elapsed × rate)
  rotateThrottle — throttle during rotation (%, defaults to rollThrottle)
  rotateTimeout — max seconds on ground before forcing LIFTOFF transition
LIFTOFF:
  liftoffElevator — constant elevator hold during initial liftoff (negative = nose up, %)
  liftoffAileronGain — aileron correction per degree of bank deviation (higher = more aggressive)
  liftoffAileronMax — maximum aileron deflection for wings-level correction (%)
  liftoffBankThreshold — bank angle below which no aileron correction applied (degrees)
  liftoffVsThreshold — minimum vertical speed to transition to INITIAL_CLIMB (fpm)
  liftoffClimbAgl — minimum AGL to transition to INITIAL_CLIMB (feet)
  liftoffThrottle — throttle during liftoff (%, defaults to rollThrottle)
INITIAL_CLIMB:
  climbElevator — elevator during climb phase (negative = nose up, %)
  climbAileronGain — aileron correction gain during climb
  climbAileronMax — maximum aileron deflection during climb (%)
  climbBankThreshold — bank threshold for aileron correction during climb (degrees)
  handoffSpeedMargin — IAS above Vs1 required for AP handoff (knots)
  handoffAgl — minimum AGL for AP handoff (feet)
  climbPhaseThrottle — throttle during initial climb (%, defaults to rollThrottle)
DEPARTURE:
  departureVS — vertical speed for AP after handoff (fpm)
  departureSpeed — target speed after handoff (knots, defaults to Vy)
CLIMB (after AP engaged):
  climbThrottle — throttle during climb phase (%)
  climbVS — AP vertical speed during climb (fpm)

MSFS 2024 PHYSICS & QUIRKS:
- Elevator: negative value = nose UP, positive = nose DOWN. Passed through directly to SimConnect.
- Ailerons: negative = roll LEFT, positive = roll RIGHT. No negation.
- Rudder: positive = yaw LEFT, negative = yaw RIGHT. Single-shot (no held-axes needed).
- Throttle: 0-100%. Uses InputEvent (only control that works via InputEvent).
- Elevator/Ailerons: Legacy transmitClientEvent (InputEvents produce zero deflection).
- Joystick constantly fights our commands — effective authority is ~50% of commanded value.
- SIM ON GROUND SimVar is unreliable — we use AGL < 50ft as fallback.
- C172 P-factor: full power pulls nose LEFT, requiring right rudder compensation.
- Torque effect: full power rolls aircraft LEFT, requiring right aileron compensation.

SAFETY HARD CLAMPS (server-enforced, you cannot exceed these):
- Elevator: ±90%
- Ailerons: ±80%
- Throttle: 0-100%
- Rudder: ±100%
- AP altitude: 0-45000 ft
- AP VS: -6000 to +6000 fpm

TUNING PHILOSOPHY — HARD-SET RULES:
The current tuner values are HARD-SET by the pilot. Treat them as correct baseline rules.
Do NOT change parameters unless you have VERY HIGH CONFIDENCE that a specific value
is directly causing a failure, backed by clear telemetry evidence across multiple attempts.

When in doubt: DO NOT CHANGE VALUES. The defaults work. Only fix what is clearly broken.
Small incremental adjustments (5-10%) are preferred over large jumps.
Never change more than 2 parameters at once — isolate variables.

HOW TO OUTPUT TUNING CHANGES (use sparingly):
After analyzing attempt results, output a TUNING_JSON block on its own line:
TUNING_JSON: {"paramName": value, "paramName2": value2}
Only include parameters you want to change. Omitted parameters keep their current values.
The rule engine applies your values on the next takeoff attempt.

REASONING REQUIREMENTS:
- You MUST have clear telemetry evidence from at least 2 attempts showing the same failure
- For each parameter you change, explain WHY with specific numbers from telemetry
- State your confidence level (LOW/MEDIUM/HIGH) — only change at HIGH confidence
- If an attempt crashed due to bank spiral, focus on aileron parameters
- If the plane didn't rotate, focus on elevator parameters
- If speed was wrong at rotation, focus on vrSpeed
- Consider that effective deflection is ~50% of commanded due to joystick fighting
- If unsure, say "keeping current values" and explain what data you'd need to see`;

    if (attempts.length > 0) {
        ctx += '\n\nPREVIOUS TAKEOFF ATTEMPTS (most recent last):';
        for (const a of attempts) {
            ctx += `\n\n--- ATTEMPT #${a.id} [${a.time}] — ${(a.outcome || 'unknown').toUpperCase()} ---`;
            ctx += `\nPhases reached: ${(a.phasesReached || []).join(' → ')}`;
            if (a.tuningUsed && Object.keys(a.tuningUsed).length > 0) {
                ctx += '\nTuning values used:';
                for (const [k, v] of Object.entries(a.tuningUsed)) {
                    ctx += ` ${k}=${v}`;
                }
            }
            if (a.telemetry) {
                const t = a.telemetry;
                ctx += '\nTelemetry:';
                if (t.maxAltGain != null) ctx += ` maxAltGain=${t.maxAltGain}ft`;
                if (t.maxBank != null) ctx += ` maxBank=${t.maxBank}°`;
                if (t.maxHdgError != null) ctx += ` maxHdgErr=${t.maxHdgError}°`;
                if (t.maxPitch != null) ctx += ` maxPitch=${t.maxPitch}°`;
                if (t.minPitch != null) ctx += ` minPitch=${t.minPitch}°`;
                if (t.rotateSpeed != null) ctx += ` rotateIAS=${t.rotateSpeed}kt`;
                if (t.liftoffSpeed != null) ctx += ` liftoffIAS=${t.liftoffSpeed}kt`;
                if (t.maxVs != null) ctx += ` maxVS=${t.maxVs}fpm`;
                if (t.minVs != null) ctx += ` minVS=${t.minVs}fpm`;
                if (t.duration_s != null) ctx += ` duration=${t.duration_s}s`;
                if (t.maxElevator != null) ctx += ` maxElev=${t.maxElevator}%`;
                if (t.maxAileron != null) ctx += ` maxAil=${t.maxAileron}%`;
                if (t.maxRudder != null) ctx += ` maxRud=${t.maxRudder}%`;
            }
            if (a.timeline && a.timeline.length > 0) {
                ctx += '\nTimeline (key moments):';
                for (const snap of a.timeline.slice(0, 15)) {  // limit to 15 snapshots
                    ctx += `\n  t=${snap.t}s sub=${snap.sub} IAS=${snap.ias}kt VS=${snap.vs}fpm pitch=${snap.pitch}° bank=${snap.bank}° AGL=${snap.agl}ft`;
                    if (snap.elev != null) ctx += ` elev=${snap.elev}%`;
                    if (snap.ail != null) ctx += ` ail=${snap.ail}%`;
                    if (snap.event) ctx += ` [${snap.event}]`;
                }
            }
            if (a.notes) ctx += `\nNotes: ${a.notes}`;
        }
    } else {
        ctx += `\n\nNO PREVIOUS ATTEMPTS — This is the first takeoff.
You must choose initial parameter values based on your knowledge of C172 aerodynamics.
Key consideration: joystick fights commands at ~50% effectiveness.
After the attempt, telemetry will show what happened so you can adjust.`;
    }

    // Inject Sally's accumulated learnings
    if (_sallyLearnings.length > 0) {
        const recent = _sallyLearnings.slice(-20);  // last 20 learnings
        ctx += '\n\nYOUR PREVIOUS LEARNINGS (observations you recorded — confidence % shown):';
        for (const l of recent) {
            const conf = l.confidence || 50;
            const reinf = l.reinforcements ? ` ×${l.reinforcements} confirmed` : '';
            const cat = l.category ? ` [${l.category}]` : '';
            ctx += `\n- #${l.id} [${conf}%${reinf}]${cat} ${l.observation}`;
        }
        ctx += '\nBuild on these. If you reach the same conclusion again, re-state it (confidence will increase automatically).';
        ctx += '\nIf new evidence contradicts a learning, output FORGET: #id to remove it.';
    } else {
        ctx += '\n\nNO PREVIOUS LEARNINGS — After analyzing results, record observations using LEARNING: lines.';
        ctx += '\nInclude your confidence: LEARNING: [75%] observation here';
    }

    ctx += `\n
OUTPUT FORMAT — Include ALL of these in your response:
1. Brief analysis (2-3 sentences explaining what you observe in the data)
2. TUNING_JSON: {param: value, ...} — parameters to change (omit unchanged ones)
3. LEARNING: [confidence%] observation — stable observations to remember
   Include a confidence percentage [10-99%] based on evidence strength.
   Low confidence (10-40%): hypothesis based on limited data
   Medium confidence (41-70%): supported by 1-2 attempts
   High confidence (71-99%): confirmed across multiple attempts
   If re-stating a previous learning, it will be automatically reinforced.
   To correct a wrong learning: FORGET: #id`;

    return ctx;
}

/** Scale API-level values to SimConnect axis range (0-16383 or -16383 to +16383) */
function scaleSimValue(command, value) {
    if (command === 'THROTTLE_SET' || command === 'MIXTURE_SET' || command === 'MIXTURE1_SET' || command === 'PROP_PITCH_SET') {
        return Math.round((value / 100) * 16383);  // 0-100% → 0-16383
    }
    if (command === 'AXIS_ELEVATOR_SET' || command === 'AXIS_RUDDER_SET' || command === 'AXIS_AILERONS_SET') {
        return Math.round((value / 50) * 16383);   // -50 to +50 → -16383 to +16383
    }
    return Math.round(value || 0);
}

// ── A* Pathfinding for Taxi Routing ──────────────────────────────────
// Binary heap priority queue + haversine-based A* for airport taxi graphs.

function haversineFt(lat1, lon1, lat2, lon2) {
    const R = 20902231; // Earth radius in feet
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find nearest node in graph to a lat/lon position */
function findNearestNode(graph, lat, lon) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < graph.nodes.length; i++) {
        const n = graph.nodes[i];
        const d = haversineFt(lat, lon, n.lat, n.lon);
        if (d < bestDist) { bestDist = d; best = i; }
    }
    return { nodeIndex: best, distance_ft: Math.round(bestDist) };
}

/** Find runway hold-short node by runway ident */
function findRunwayNode(graph, runway) {
    const rwy = String(runway).toUpperCase();
    // Try RUNWAY_HOLD first, then RUNWAY_THRESHOLD
    for (const type of ['RUNWAY_HOLD', 'RUNWAY_THRESHOLD']) {
        const node = graph.nodes.find(n => n.type === type && graph.runways.some(r =>
            r.ident.toUpperCase() === rwy && (r.nodeIndex === n.index || r.thresholdIndex === n.index)));
        if (node) return node.index;
    }
    // Fallback: match by runway data
    const rwyData = graph.runways.find(r => r.ident.toUpperCase() === rwy);
    return rwyData ? (rwyData.nodeIndex ?? -1) : -1;
}

/** Build adjacency list from edges (bidirectional) */
function buildAdjacency(graph) {
    const adj = new Map();
    for (const n of graph.nodes) adj.set(n.index, []);
    for (const e of graph.edges) {
        adj.get(e.from)?.push({ to: e.to, cost: e.distance_ft || 100, taxiway: e.taxiway });
        adj.get(e.to)?.push({ to: e.from, cost: e.distance_ft || 100, taxiway: e.taxiway });
    }
    return adj;
}

/**
 * A* pathfinding on airport taxi graph.
 * @returns {{ success, nodePath, taxiways, instruction, distance_ft, waypoints }}
 */
function aStarRoute(graph, startIdx, goalIdx) {
    if (startIdx < 0 || goalIdx < 0) return { success: false, error: 'Invalid start or goal node' };
    if (startIdx === goalIdx) return { success: true, nodePath: [startIdx], taxiways: [], distance_ft: 0, waypoints: [graph.nodes[startIdx]] };

    const adj = buildAdjacency(graph);
    const goalNode = graph.nodes[goalIdx];

    // Binary heap priority queue (min-heap by f-score)
    const open = [{ idx: startIdx, f: 0 }];
    const gScore = new Map([[startIdx, 0]]);
    const cameFrom = new Map();
    const closed = new Set();

    const pushHeap = (item) => {
        open.push(item);
        let i = open.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (open[p].f <= open[i].f) break;
            [open[p], open[i]] = [open[i], open[p]];
            i = p;
        }
    };
    const popHeap = () => {
        const top = open[0];
        const last = open.pop();
        if (open.length > 0) {
            open[0] = last;
            let i = 0;
            while (true) {
                let smallest = i;
                const l = 2 * i + 1, r = 2 * i + 2;
                if (l < open.length && open[l].f < open[smallest].f) smallest = l;
                if (r < open.length && open[r].f < open[smallest].f) smallest = r;
                if (smallest === i) break;
                [open[i], open[smallest]] = [open[smallest], open[i]];
                i = smallest;
            }
        }
        return top;
    };

    while (open.length > 0) {
        const current = popHeap();
        if (current.idx === goalIdx) {
            // Reconstruct path
            const path = [goalIdx];
            let c = goalIdx;
            while (cameFrom.has(c)) { c = cameFrom.get(c); path.unshift(c); }

            // Extract taxiway names from edges along path
            const taxiwaySet = new Set();
            const taxiwayList = [];
            for (let i = 0; i < path.length - 1; i++) {
                const edge = graph.edges.find(e =>
                    (e.from === path[i] && e.to === path[i + 1]) ||
                    (e.to === path[i] && e.from === path[i + 1]));
                if (edge?.taxiway && !taxiwaySet.has(edge.taxiway)) {
                    taxiwaySet.add(edge.taxiway);
                    taxiwayList.push(edge.taxiway);
                }
            }

            const waypoints = path.map(idx => {
                const n = graph.nodes[idx];
                return { lat: n.lat, lon: n.lon, name: n.name, type: n.type, index: idx };
            });

            // Find target runway ident
            const goalRwy = graph.runways.find(r => r.nodeIndex === goalIdx || r.thresholdIndex === goalIdx);
            const rwyIdent = goalRwy?.ident || 'unknown';
            const instruction = taxiwayList.length > 0
                ? `taxi to runway ${rwyIdent} via ${taxiwayList.join(', ')}`
                : `taxi to runway ${rwyIdent}`;

            return {
                success: true,
                nodePath: path,
                taxiways: taxiwayList,
                instruction,
                distance_ft: Math.round(gScore.get(goalIdx) || 0),
                waypoints
            };
        }

        closed.add(current.idx);
        const neighbors = adj.get(current.idx) || [];
        for (const n of neighbors) {
            if (closed.has(n.to)) continue;
            const tentG = (gScore.get(current.idx) || 0) + n.cost;
            if (tentG < (gScore.get(n.to) ?? Infinity)) {
                cameFrom.set(n.to, current.idx);
                gScore.set(n.to, tentG);
                const nNode = graph.nodes[n.to];
                const h = haversineFt(nNode.lat, nNode.lon, goalNode.lat, goalNode.lon);
                pushHeap({ idx: n.to, f: tentG + h });
            }
        }
    }

    return { success: false, error: 'No route found' };
}
// ─────────────────────────────────────────────────────────────────────

function setupAiPilotRoutes(app, getFlightData, getSimConnect, eventMap, extras) {

    const getFacilityGraph = extras?.requestFacilityGraph || null;

    // Map API command names to actual SimConnect event names
    // (API uses short names, SimConnect uses _ENGLISH suffix for value-set events)
    const COMMAND_TO_EVENT = {
        'AP_MASTER': 'AP_MASTER',
        'TOGGLE_FLIGHT_DIRECTOR': 'TOGGLE_FLIGHT_DIRECTOR',
        'YAW_DAMPER_TOGGLE': 'YAW_DAMPER_TOGGLE',
        'AP_HDG_HOLD': 'AP_HDG_HOLD',
        'AP_ALT_HOLD': 'AP_ALT_HOLD',
        'AP_VS_HOLD': 'AP_VS_HOLD',
        'AP_AIRSPEED_HOLD': 'AP_PANEL_SPEED_HOLD',
        'AP_NAV1_HOLD': 'AP_NAV1_HOLD',
        'AP_APR_HOLD': 'AP_APR_HOLD',
        'AP_BC_HOLD': 'AP_BC_HOLD',
        'HEADING_BUG_INC': 'HEADING_BUG_INC',
        'HEADING_BUG_DEC': 'HEADING_BUG_DEC',
        'HEADING_BUG_SET': 'HEADING_BUG_SET',
        'AP_ALT_VAR_INC': 'AP_ALT_VAR_INC',
        'AP_ALT_VAR_DEC': 'AP_ALT_VAR_DEC',
        'AP_ALT_VAR_SET': 'AP_ALT_VAR_SET_ENGLISH',
        'AP_VS_VAR_INC': 'AP_VS_VAR_INC',
        'AP_VS_VAR_DEC': 'AP_VS_VAR_DEC',
        'AP_VS_VAR_SET': 'AP_VS_VAR_SET_ENGLISH',
        'AP_SPD_VAR_INC': 'AP_SPD_VAR_INC',
        'AP_SPD_VAR_DEC': 'AP_SPD_VAR_DEC',
        'AP_SPD_VAR_SET': 'AP_SPD_VAR_SET',
        // Flight control commands
        'THROTTLE_SET': 'THROTTLE_SET',
        'MIXTURE_SET': 'MIXTURE1_SET',
        'PROP_PITCH_SET': 'PROP_PITCH_SET',
        'FLAPS_UP': 'FLAPS_UP',
        'FLAPS_DOWN': 'FLAPS_DOWN',
        'AXIS_ELEVATOR_SET': 'AXIS_ELEVATOR_SET',
        'AXIS_RUDDER_SET': 'AXIS_RUDDER_SET',
        'AXIS_AILERONS_SET': 'AXIS_AILERONS_SET',
        'CENTER_AILER_RUDDER': 'CENTER_AILER_RUDDER',
        'PARKING_BRAKES': 'PARKING_BRAKES',
        // Engine start
        'TOGGLE_STARTER1': 'TOGGLE_STARTER1',
        'SET_STARTER1_HELD': 'SET_STARTER1_HELD',
        'MAGNETO1_OFF': 'MAGNETO1_OFF',
        'MAGNETO1_BOTH': 'MAGNETO1_BOTH',
        'MAGNETO1_START': 'MAGNETO1_START',
        'LANDING_LIGHTS_TOGGLE': 'LANDING_LIGHTS_TOGGLE'
    };

    // Status endpoint
    app.get('/api/ai-pilot/status', (req, res) => {
        const fd = getFlightData();
        const cfg = getCopilotConfig();
        const sc = getSimConnect ? getSimConnect() : null;
        res.json({
            hasLlm: !!(cfg.licenseKey),
            simConnected: !!sc,
            phase: 'UNKNOWN',  // phase is tracked client-side
            flightData: {
                altitude: Math.round(fd.altitude || 0),
                speed: Math.round(fd.speed || 0),
                heading: Math.round(fd.heading || 0),
                vs: Math.round(fd.verticalSpeed || 0),
                onGround: fd.onGround || false,
                apMaster: fd.apMaster || false
            }
        });
    });

    // Command execution — validates, then fires SimConnect event directly
    app.post('/api/ai-pilot/command', express_json_guard, (req, res) => {
        const { command, value } = req.body;

        if (!command || !COMMAND_TO_EVENT[command]) {
            return res.status(400).json({ error: 'Invalid command: ' + command });
        }

        // Safety limits for value commands
        if (command.includes('_SET') && value !== undefined) {
            if (command.includes('ALT') && (value < 0 || value > 45000)) {
                return res.status(400).json({ error: 'Altitude out of range (0-45000)' });
            }
            if (command.includes('VS') && (value < -6000 || value > 6000)) {
                return res.status(400).json({ error: 'VS out of range (-6000 to 6000)' });
            }
            if (command.includes('SPD') && (value < 40 || value > 500)) {
                return res.status(400).json({ error: 'Speed out of range (40-500)' });
            }
            if (command === 'HEADING_BUG_SET' && (value < 0 || value > 360)) {
                return res.status(400).json({ error: 'Heading out of range (0-360)' });
            }
            if (command === 'THROTTLE_SET' && (value < 0 || value > 100)) {
                return res.status(400).json({ error: 'Throttle out of range (0-100)' });
            }
            if (command === 'MIXTURE_SET' && (value < 0 || value > 100)) {
                return res.status(400).json({ error: 'Mixture out of range (0-100)' });
            }
            if (command === 'AXIS_ELEVATOR_SET' && (value < -50 || value > 50)) {
                return res.status(400).json({ error: 'Elevator out of range (-50 to 50)' });
            }
        }

        // Resolve the actual SimConnect event name
        const simEventName = COMMAND_TO_EVENT[command];
        const sc = getSimConnect ? getSimConnect() : null;

        // Scale values for SimConnect (0-100% → 0-16383, etc.)
        const simValue = scaleSimValue(command, value || 0);

        if (!sc || !eventMap || eventMap[simEventName] === undefined) {
            // SimConnect not available — command is valid but can't execute
            console.log(`[AI-Pilot] ${command} validated (SimConnect not connected)`);
            return res.json({ success: true, command, simEvent: simEventName, value: simValue, executed: false });
        }

        const eventId = eventMap[simEventName];

        try {
            sc.transmitClientEvent(0, eventId, simValue, 1, 16);
            console.log(`[AI-Pilot] ${command} → ${simEventName} (eventId: ${eventId}, value: ${simValue})`);
            res.json({ success: true, command, simEvent: simEventName, value: simValue, executed: true });
        } catch (e) {
            console.error(`[AI-Pilot] SimConnect error: ${e.message}`);
            res.status(500).json({ error: 'SimConnect transmit failed: ' + e.message });
        }
    });

    // Advisory endpoint — proxies to copilot chat with AI pilot system prompt
    app.post('/api/ai-pilot/advisory', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        // Reuse copilot license validation
        let validateKey;
        try {
            validateKey = require('./copilot-license').validateKey;
        } catch (e) {
            return res.status(500).json({ error: 'License module not available' });
        }

        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'Valid copilot license required for AI advisory' });
        }

        const provider = cfg.provider || 'openai';
        const isLocal = provider.startsWith('ollama') || provider.startsWith('lmstudio');

        const apiKey = isLocal ? 'not-needed' : decryptApiKey(cfg);
        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured' });
        }

        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        const flightData = getFlightData();
        const systemPrompt = buildAiPilotPrompt(flightData);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message.slice(0, 2000) }
        ];

        const model = cfg.model || getDefaultModel(provider);
        const abortController = new AbortController();
        const timeout = isLocal ? 120000 : 30000;
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            if (provider === 'anthropic') {
                await proxyAnthropic(apiKey, model, messages, res, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider, cfg);
                await proxyOpenAI(apiKey, model, messages, res, abortController, baseUrl);
            }
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (!res.headersSent) {
                res.status(502).json({ error: err.message });
            }
        }
    });

    // Auto-advise endpoint — asks AI, parses commands, executes them in one call
    app.post('/api/ai-pilot/auto-advise', express_json_guard, async (req, res) => {
        const cfg = getCopilotConfig();

        let validateKey;
        try {
            validateKey = require('./copilot-license').validateKey;
        } catch (e) {
            return res.status(500).json({ error: 'License module not available' });
        }

        const licenseResult = validateKey(cfg.licenseKey);
        if (!licenseResult.valid) {
            return res.status(403).json({ error: 'Valid license required' });
        }

        const provider = cfg.provider || 'openai';
        const isLocal = provider.startsWith('ollama') || provider.startsWith('lmstudio');

        const apiKey = isLocal ? 'not-needed' : decryptApiKey(cfg);
        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured' });
        }

        const { message } = req.body;
        const flightData = getFlightData();
        const fd = flightData || {};

        const systemPrompt = buildAiPilotPrompt(flightData) + `\n
IMPORTANT: After your brief advice, output a JSON block with the exact AP commands to execute.
Use this exact format on its own line:
COMMANDS_JSON: [{"command":"COMMAND_NAME","value":NUMBER}, ...]

Valid commands and value ranges:
AP COMMANDS:
- HEADING_BUG_SET (0-360)
- AP_ALT_VAR_SET (0-45000, altitude in feet)
- AP_VS_VAR_SET (-6000 to 6000, fpm)
- AP_SPD_VAR_SET (40-500, knots)
- AP_HDG_HOLD (no value, toggles heading hold)
- AP_ALT_HOLD (no value, toggles altitude hold)
- AP_VS_HOLD (no value, toggles VS hold)
- AP_MASTER (no value, toggles AP master)

FLIGHT CONTROL COMMANDS:
- THROTTLE_SET (0-100, percentage)
- MIXTURE_SET (0-100, percentage)
- AXIS_ELEVATOR_SET (-50 to 50, pitch control: negative = nose up)
- FLAPS_UP (no value, retract one notch)
- FLAPS_DOWN (no value, extend one notch)
- PARKING_BRAKES (no value, toggle)
- LANDING_LIGHTS_TOGGLE (no value, toggle)

For toggle commands, omit the value field. Only include commands that need to CHANGE from current state.
For takeoff: use THROTTLE_SET 100, then AXIS_ELEVATOR_SET -25 at Vr, then AP_MASTER after liftoff.

CRITICAL: Your spoken text is read aloud via TTS. NEVER mention "JSON", "COMMANDS_JSON", "TUNING_JSON", "API", "endpoint", "parameter", "SimConnect", or any technical/programming terms in your conversational text. Speak naturally as a pilot would. Put the COMMANDS_JSON block silently at the end with no introduction.`;

        const userMsg = message || `Current phase of flight: altitude ${Math.round(fd.altitude||0)}ft, speed ${Math.round(fd.speed||0)}kt, heading ${Math.round(fd.heading||0)}. Recommend optimal AP settings.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg.slice(0, 2000) }
        ];

        const model = cfg.model || getDefaultModel(provider);
        const abortController = new AbortController();
        const timeout = isLocal ? 120000 : 30000;
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            // Get non-streaming response for parsing
            const _queryStart = Date.now();
            let fullText = '';
            if (provider === 'anthropic') {
                fullText = await fetchAnthropic(apiKey, model, messages, abortController);
            } else {
                const baseUrl = getProviderBaseUrl(provider, cfg);
                fullText = await fetchOpenAI(apiKey, model, messages, abortController, baseUrl);
            }
            clearTimeout(timeoutId);

            // Parse commands from response
            const commands = parseCommandsFromText(fullText);
            const executed = [];
            const sc = getSimConnect ? getSimConnect() : null;

            for (const cmd of commands) {
                if (!COMMAND_TO_EVENT[cmd.command]) continue;
                const simEventName = COMMAND_TO_EVENT[cmd.command];
                const simValue = scaleSimValue(cmd.command, cmd.value || 0);

                if (sc && eventMap && eventMap[simEventName] !== undefined) {
                    try {
                        sc.transmitClientEvent(0, eventMap[simEventName], simValue, 1, 16);
                        executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: true });
                        console.log(`[AI-Pilot Auto] ${cmd.command} → ${simEventName} = ${simValue}`);
                    } catch (e) {
                        executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: false, error: e.message });
                    }
                } else {
                    executed.push({ command: cmd.command, simEvent: simEventName, value: simValue, executed: false });
                }
            }

            // Parse TUNING_JSON from Sally's response — she adjusts takeoff parameters
            let tuning = null;
            const tuningMatch = fullText.match(/TUNING_JSON:\s*(\{[\s\S]*?\})/);
            if (tuningMatch) {
                try {
                    tuning = JSON.parse(tuningMatch[1]);
                    _sharedState.tuning = tuning;
                    _sharedState.lastUpdate = Date.now();
                    console.log('[AI-Pilot] Sally tuning update:', JSON.stringify(tuning));
                } catch (e) {
                    console.warn('[AI-Pilot] Failed to parse TUNING_JSON:', e.message);
                }
            }

            // Parse LEARNING: lines — Sally's stable observations
            const newLearnings = parseLearnings(fullText);

            // Parse FORGET: #id — Sally correcting a wrong learning
            const forgetMatches = fullText.matchAll(/FORGET:\s*#?(\d+)/gi);
            for (const m of forgetMatches) {
                const forgetId = parseInt(m[1]);
                const idx = _sallyLearnings.findIndex(l => l.id === forgetId);
                if (idx >= 0) {
                    const removed = _sallyLearnings.splice(idx, 1)[0];
                    saveLearnings();
                    console.log(`[AI-Pilot] Sally forgot learning #${forgetId}: ${removed.observation.slice(0, 60)}`);
                }
            }

            // Log performance metric
            logQueryMetric({
                time: Date.now(),
                durationMs: Date.now() - _queryStart,
                provider,
                model,
                responseLen: fullText.length,
                learnings: newLearnings.length,
                tuningChanged: !!tuning,
                error: false
            });

            // Log conversation for review
            logConversation({
                id: _sallyConversations.length + 1,
                time: new Date().toISOString(),
                phase: fd.flightPhase || null,
                userMessage: message || '(auto-advise)',
                sallyResponse: fullText,
                commands: executed.map(c => c.type || c),
                tuning: tuning || null,
                learnings: newLearnings.length,
                durationMs: Date.now() - _queryStart
            });

            res.json({
                success: true,
                advisory: fullText,
                commands: executed,
                tuning,
                simConnected: !!sc
            });

        } catch (err) {
            clearTimeout(timeoutId);
            _perfMetrics.totalErrors++;
            logQueryMetric({ time: Date.now(), durationMs: 0, provider, model, responseLen: 0, error: true });

            // Provide helpful error messages for common failures
            let errorMsg = err.message;
            if (err.message.includes('fetch failed') || err.code === 'ECONNREFUSED') {
                if (provider.startsWith('lmstudio')) {
                    errorMsg = 'LM Studio is not running. Please start LM Studio or change provider in settings.';
                } else if (provider.startsWith('ollama')) {
                    errorMsg = 'Ollama is not running. Please start Ollama or change provider in settings.';
                } else {
                    errorMsg = `Unable to reach ${provider} API. Check network connection and provider settings.`;
                }
            }

            res.status(502).json({ error: errorMsg });
        }
    });

    // Aircraft profiles endpoint
    app.get('/api/ai-pilot/profiles', (req, res) => {
        // Return available profile names (actual data is client-side)
        res.json({
            profiles: ['C172'],
            default: 'C172'
        });
    });

    // ── Terrain API ──────────────────────────────────────────────────
    app.get('/api/ai-pilot/terrain', (req, res) => {
        const fd = getFlightData();
        const lat = parseFloat(req.query.lat) || fd.latitude;
        const lon = parseFloat(req.query.lon) || fd.longitude;
        const hdg = parseFloat(req.query.hdg) || fd.heading || 0;
        const range = parseFloat(req.query.range) || 20;

        if (!lat || !lon) return res.json({ error: 'No position data', terrain: null });

        const here = getTerrainElevFt(lat, lon);
        const ahead = getTerrainAhead(lat, lon, hdg, range);
        const clearance = fd.altitude ? Math.round(fd.altitude - here) : null;

        res.json({
            position: { lat, lon, hdg },
            terrainBelow: here,
            clearance,
            ahead,
            gridLoaded: !!_terrainGrid
        });
    });

    // ── Shared State API (cross-machine pane sync) ───────────────────
    app.post('/api/ai-pilot/shared-state', express_json_guard, (req, res) => {
        const { key, data } = req.body;
        if (!key || (key !== 'autopilot' && key !== 'nav')) {
            return res.status(400).json({ error: 'key must be "autopilot" or "nav"' });
        }
        _sharedState[key] = data;
        _sharedState.lastUpdate = Date.now();
        res.json({ ok: true });
    });

    app.get('/api/ai-pilot/shared-state', (req, res) => {
        res.json({
            autopilot: _sharedState.autopilot,
            nav: _sharedState.nav,
            airport: _sharedState.airport,
            lastUpdate: _sharedState.lastUpdate
        });
    });

    app.get('/api/ai-pilot/shared-state/:key', (req, res) => {
        const key = req.params.key;
        if (key !== 'autopilot' && key !== 'nav') {
            return res.status(400).json({ error: 'key must be "autopilot" or "nav"' });
        }
        res.json({ [key]: _sharedState[key], lastUpdate: _sharedState.lastUpdate });
    });

    // ── Takeoff Attempt Logger API ─────────────────────────────────
    // Browser POSTs attempt telemetry when takeoff ends (success or failure).
    // Sally reads this history to learn what works and what doesn't.

    app.post('/api/ai-pilot/takeoff-attempt', express_json_guard, (req, res) => {
        const attempt = req.body;
        if (!attempt || !attempt.outcome) {
            return res.status(400).json({ error: 'outcome required' });
        }

        // Assign sequential ID
        attempt.id = _takeoffAttempts.length + 1;
        attempt.time = attempt.time || new Date().toISOString();

        _takeoffAttempts.push(attempt);

        // Keep only last 50 attempts
        if (_takeoffAttempts.length > 50) {
            _takeoffAttempts = _takeoffAttempts.slice(-50);
        }

        // Persist to disk
        try {
            const dir = path.dirname(TAKEOFF_LOG_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(TAKEOFF_LOG_PATH, JSON.stringify(_takeoffAttempts, null, 2));
        } catch (e) {
            console.warn('[AI-Pilot] Failed to save takeoff log:', e.message);
        }

        console.log(`[AI-Pilot] Takeoff attempt #${attempt.id}: ${attempt.outcome} (phases: ${(attempt.phasesReached || []).join('→')})`);
        res.json({ ok: true, id: attempt.id, totalAttempts: _takeoffAttempts.length });
    });

    app.get('/api/ai-pilot/takeoff-attempts', (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        res.json({
            attempts: _takeoffAttempts.slice(-limit),
            total: _takeoffAttempts.length
        });
    });

    // Get/set Sally's tuning values (stored server-side, browser polls)
    app.get('/api/ai-pilot/tuning', (req, res) => {
        res.json({ tuning: _sharedState.tuning || null });
    });

    // Set individual tuning values (from diagnostics UI or external tool)
    app.post('/api/ai-pilot/tuning', express_json_guard, (req, res) => {
        const updates = req.body;
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Body must be a tuning params object' });
        }
        _sharedState.tuning = { ...(_sharedState.tuning || {}), ...updates };
        _sharedState.lastUpdate = Date.now();
        console.log('[AI-Pilot] Tuning updated via API:', JSON.stringify(updates));
        res.json({ ok: true, tuning: _sharedState.tuning });
    });

    // Reset all Sally learning — clears learnings, attempts, tuning, and tells browsers to wipe localStorage
    app.post('/api/ai-pilot/reset-learning', (req, res) => {
        // Archive before clearing
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        try {
            if (_sallyLearnings.length > 0)
                fs.writeFileSync(path.join(__dirname, '..', 'data', `sally-learnings-${ts}.json`), JSON.stringify(_sallyLearnings, null, 2));
            if (_takeoffAttempts.length > 0)
                fs.writeFileSync(path.join(__dirname, '..', 'data', `takeoff-attempts-${ts}.json`), JSON.stringify(_takeoffAttempts, null, 2));
            if (_sallyConversations.length > 0)
                fs.writeFileSync(path.join(__dirname, '..', 'data', `sally-conversations-${ts}.json`), JSON.stringify(_sallyConversations, null, 2));
            console.log(`[AI-Pilot] Archived learnings/attempts/conversations with timestamp ${ts}`);
        } catch (e) { console.warn('[AI-Pilot] Archive failed:', e.message); }
        _sallyLearnings = [];
        saveLearnings();
        _takeoffAttempts = [];
        try { fs.writeFileSync(TAKEOFF_LOG_PATH, '[]'); } catch (_) {}
        _sallyConversations = [];
        try { fs.writeFileSync(CONVO_LOG_PATH, '[]'); } catch (_) {}
        _sharedState.tuning = null;
        // Broadcast to all connected WS clients to clear localStorage tuning
        if (global.wss) {
            const msg = JSON.stringify({ type: 'clearTuning' });
            for (const client of global.wss.clients) {
                if (client.readyState === 1) client.send(msg);
            }
        }
        console.log('[AI-Pilot] Sally learning fully reset');
        res.json({ ok: true, message: 'Learnings, attempts, and tuning all cleared' });
    });

    // Sally's learnings — persistent observations
    app.get('/api/ai-pilot/learnings', (req, res) => {
        res.json({ learnings: _sallyLearnings, total: _sallyLearnings.length });
    });

    app.delete('/api/ai-pilot/learnings', (req, res) => {
        _sallyLearnings = [];
        saveLearnings();
        res.json({ ok: true, message: 'All learnings cleared' });
    });

    app.delete('/api/ai-pilot/learnings/:id', (req, res) => {
        const id = parseInt(req.params.id);
        const idx = _sallyLearnings.findIndex(l => l.id === id);
        if (idx >= 0) {
            const removed = _sallyLearnings.splice(idx, 1)[0];
            saveLearnings();
            res.json({ ok: true, removed: removed.observation });
        } else {
            res.status(404).json({ error: 'Learning not found' });
        }
    });

    // Sally's conversation log
    app.get('/api/ai-pilot/conversations', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        res.json({ conversations: _sallyConversations.slice(-limit), total: _sallyConversations.length });
    });

    app.delete('/api/ai-pilot/conversations', (req, res) => {
        // Archive old conversations before clearing
        if (_sallyConversations.length > 0) {
            try {
                const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const archivePath = path.join(__dirname, '..', 'data', `sally-conversations-${ts}.json`);
                fs.writeFileSync(archivePath, JSON.stringify(_sallyConversations, null, 2));
                console.log(`[AI-Pilot] Archived ${_sallyConversations.length} conversations to ${path.basename(archivePath)}`);
            } catch (e) {
                console.warn('[AI-Pilot] Failed to archive conversations:', e.message);
            }
        }
        _sallyConversations = [];
        try { fs.writeFileSync(CONVO_LOG_PATH, '[]'); } catch (_) {}
        res.json({ ok: true, message: 'Conversation log archived and cleared' });
    });

    // Sally performance metrics
    app.get('/api/ai-pilot/performance', (req, res) => {
        res.json(getPerfSummary());
    });

    // ── ATC Ground Operations API ────────────────────────────────────

    /** GET /api/ai-pilot/atc/airport/:icao — Full taxiway graph */
    app.get('/api/ai-pilot/atc/airport/:icao', async (req, res) => {
        const icao = req.params.icao?.toUpperCase();
        if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
            return res.status(400).json({ error: 'Invalid ICAO code' });
        }
        try {
            const graph = getFacilityGraph
                ? await getFacilityGraph(icao)
                : getMockFacilityGraphFallback(icao);
            if (!graph) return res.status(404).json({ error: 'No data for ' + icao });
            res.json(graph);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /** GET /api/ai-pilot/atc/route — A* taxi routing */
    app.get('/api/ai-pilot/atc/route', async (req, res) => {
        const { icao, fromLat, fromLon, toRunway } = req.query;
        if (!icao || !fromLat || !fromLon || !toRunway) {
            return res.status(400).json({ error: 'Required: icao, fromLat, fromLon, toRunway' });
        }
        try {
            const graph = getFacilityGraph
                ? await getFacilityGraph(icao.toUpperCase())
                : getMockFacilityGraphFallback(icao.toUpperCase());
            if (!graph) return res.status(404).json({ error: 'No graph for ' + icao });

            const start = findNearestNode(graph, parseFloat(fromLat), parseFloat(fromLon));
            const goalIdx = findRunwayNode(graph, toRunway);

            if (start.nodeIndex < 0) return res.json({ success: false, error: 'No nearby node found' });
            if (goalIdx < 0) return res.json({ success: false, error: 'Runway ' + toRunway + ' not found in graph' });

            const route = aStarRoute(graph, start.nodeIndex, goalIdx);
            res.json(route);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /** GET /api/ai-pilot/atc/nearest-node — Find nearest graph node */
    app.get('/api/ai-pilot/atc/nearest-node', async (req, res) => {
        const { icao, lat, lon } = req.query;
        if (!icao || !lat || !lon) {
            return res.status(400).json({ error: 'Required: icao, lat, lon' });
        }
        try {
            const graph = getFacilityGraph
                ? await getFacilityGraph(icao.toUpperCase())
                : getMockFacilityGraphFallback(icao.toUpperCase());
            if (!graph) return res.status(404).json({ error: 'No graph for ' + icao });

            const result = findNearestNode(graph, parseFloat(lat), parseFloat(lon));
            if (result.nodeIndex >= 0) {
                const node = graph.nodes[result.nodeIndex];
                res.json({ nodeIndex: result.nodeIndex, distance_ft: result.distance_ft, name: node.name, type: node.type });
            } else {
                res.json({ nodeIndex: -1, distance_ft: -1, name: null, type: null });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /** DELETE /api/ai-pilot/atc/cache/:icao — Clear cached graph */
    app.delete('/api/ai-pilot/atc/cache/:icao', (req, res) => {
        const icao = req.params.icao?.toUpperCase();
        const cachePath = path.join(__dirname, '..', 'data', 'atc-cache', `${icao}.json`);
        try {
            if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath);
                res.json({ ok: true, deleted: icao });
            } else {
                res.json({ ok: true, message: 'No cache for ' + icao });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ── Say Intentions Voice ATC Integration ────────────────────────────
    const SayIntentionsAPI = require('./say-intentions-api');
    const sayIntentions = new SayIntentionsAPI();

    app.get('/api/ai-pilot/atc/voice/status', (req, res) => {
        res.json({
            enabled: sayIntentions.isEnabled(),
            available: true
        });
    });

    app.post('/api/ai-pilot/atc/voice/ground', express_json_guard, async (req, res) => {
        const { airport, runway, position, callsign, route } = req.body;
        if (!airport || !runway || !callsign) {
            return res.status(400).json({ error: 'Missing required fields: airport, runway, callsign' });
        }

        const result = await sayIntentions.requestGroundClearance({
            airport,
            runway,
            position: position || 'parking',
            callsign,
            route: route || []
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(502).json(result);
        }
    });

    app.post('/api/ai-pilot/atc/voice/takeoff', express_json_guard, async (req, res) => {
        const { airport, runway, callsign } = req.body;
        if (!airport || !runway || !callsign) {
            return res.status(400).json({ error: 'Missing required fields: airport, runway, callsign' });
        }

        const result = await sayIntentions.requestTakeoffClearance({
            airport,
            runway,
            callsign
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(502).json(result);
        }
    });

    app.post('/api/ai-pilot/atc/voice/pilot', express_json_guard, async (req, res) => {
        const { airport, callsign, message, context } = req.body;
        if (!airport || !callsign || !message) {
            return res.status(400).json({ error: 'Missing required fields: airport, callsign, message' });
        }

        const result = await sayIntentions.sendPilotTransmission({
            airport,
            callsign,
            message,
            context: context || 'ground'
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(502).json(result);
        }
    });

    app.get('/api/ai-pilot/atc/voice/frequency/:airport/:type', async (req, res) => {
        const { airport, type } = req.params;
        const result = await sayIntentions.getFrequency(airport.toUpperCase(), type);

        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    });
}

/** Inline mock graph fallback (when server.js doesn't provide requestFacilityGraph) */
function getMockFacilityGraphFallback(icao) {
    return {
        icao,
        nodes: [
            { index: 0, lat: 47.4490, lon: -122.3088, name: 'GATE_A1', type: 'PARKING' },
            { index: 1, lat: 47.4492, lon: -122.3080, name: 'A', type: 'TAXIWAY' },
            { index: 2, lat: 47.4500, lon: -122.3070, name: 'B', type: 'TAXIWAY' },
            { index: 3, lat: 47.4510, lon: -122.3060, name: 'C', type: 'TAXIWAY' },
            { index: 4, lat: 47.4520, lon: -122.3050, name: 'RWY_16R', type: 'RUNWAY_HOLD' },
            { index: 5, lat: 47.4530, lon: -122.3045, name: '16R_THR', type: 'RUNWAY_THRESHOLD' }
        ],
        edges: [
            { from: 0, to: 1, taxiway: 'Alpha', distance_ft: 250 },
            { from: 1, to: 2, taxiway: 'Alpha', distance_ft: 400 },
            { from: 2, to: 3, taxiway: 'Bravo', distance_ft: 350 },
            { from: 3, to: 4, taxiway: 'Charlie', distance_ft: 300 },
            { from: 4, to: 5, taxiway: null, distance_ft: 150 }
        ],
        parking: [{ name: 'GATE_A1', lat: 47.4490, lon: -122.3088, nodeIndex: 0 }],
        runways: [{ ident: '16R', lat: 47.4530, lon: -122.3045, heading: 160, nodeIndex: 4, thresholdIndex: 5 }],
        source: 'mock', cached: false, timestamp: Date.now()
    };
}

// Provider base URL mapping
// Supports remote hosts: 'ollama-aipc', 'lmstudio-rockpc', etc.
function getProviderBaseUrl(provider, cfg) {
    // Custom base URL from config takes priority
    if (cfg && cfg.customBaseUrl) return cfg.customBaseUrl;

    switch (provider) {
        case 'ollama': return 'http://localhost:11434/v1';
        case 'ollama-aipc': return 'http://192.168.1.162:11434/v1';
        case 'ollama-rockpc': return 'http://192.168.1.192:11434/v1';
        case 'lmstudio': return 'http://localhost:1234/v1';
        case 'lmstudio-rockpc': return 'http://192.168.1.192:1234/v1';
        case 'lmstudio-aipc': return 'http://192.168.1.162:1234/v1';
        case 'openai': default: return 'https://api.openai.com/v1';
    }
}

// Default model per provider
function getDefaultModel(provider) {
    if (provider.startsWith('ollama')) return 'qwen2.5-coder:32b';
    if (provider.startsWith('lmstudio')) return 'qwen2.5-7b-instruct';
    switch (provider) {
        case 'anthropic': return 'claude-sonnet-4-5-20250929';
        case 'openai': default: return 'gpt-4o';
    }
}

// OpenAI-compatible streaming proxy (works for OpenAI, Ollama, LM Studio)
async function proxyOpenAI(apiKey, model, messages, res, abortController, baseUrl) {
    const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 300 }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(`LLM error (${response.status}) from ${url}`);
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.on('close', () => abortController.abort());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') {
                    res.write('data: {"done":true}\n\n');
                    continue;
                }
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                } catch (e) { /* skip */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return;
        throw e;
    }
    res.end();
}

// Simplified Anthropic streaming proxy
async function proxyAnthropic(apiKey, model, messages, res, abortController) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model, system: systemMsg?.content || '',
            messages: chatMessages, stream: true, max_tokens: 256
        }),
        signal: abortController.signal
    });

    if (!response.ok) {
        throw new Error(`Anthropic error (${response.status})`);
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.on('close', () => abortController.abort());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        res.write(`data: ${JSON.stringify({ chunk: parsed.delta.text })}\n\n`);
                    } else if (parsed.type === 'message_stop') {
                        res.write('data: {"done":true}\n\n');
                    }
                } catch (e) { /* skip */ }
            }
        }
    } catch (e) {
        if (abortController.signal.aborted) return;
        throw e;
    }
    res.end();
}

// Decrypt API key helper (reused across endpoints)
function decryptApiKey(cfg) {
    if (!cfg.apiKeyEncrypted) return '';
    try {
        const crypto = require('crypto');
        const os = require('os');
        const SALT = 'SimGlass-Copilot-KeyStore';
        const key = crypto.createHash('sha256').update(os.hostname() + SALT).digest();
        const [ivHex, encrypted] = cfg.apiKeyEncrypted.split(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return '';
    }
}

// Non-streaming OpenAI-compatible fetch (for auto-advise parsing)
async function fetchOpenAI(apiKey, model, messages, abortController, baseUrl) {
    const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey !== 'not-needed') headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, max_tokens: 800 }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`LLM error (${response.status}) from ${url}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// Non-streaming Anthropic fetch (for auto-advise parsing)
async function fetchAnthropic(apiKey, model, messages, abortController) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content
    }));
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, system: systemMsg?.content || '', messages: chatMessages, max_tokens: 800 }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`Anthropic error (${response.status})`);
    const data = await response.json();
    return data.content?.[0]?.text || '';
}

// Parse AP commands from LLM response text
function parseCommandsFromText(text) {
    const commands = [];

    // Try JSON format first: COMMANDS_JSON: [...]
    const jsonMatch = text.match(/COMMANDS_JSON:\s*(\[[\s\S]*?\])/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { /* fall through to line parsing */ }
    }

    // Fallback: parse COMMAND VALUE lines
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.replace(/^[-*\s]+/, '').trim();
        // Match patterns like: HEADING_BUG_SET 300, THROTTLE_SET: 100, AP_HDG_HOLD ON
        const match = trimmed.match(/^((?:AP_|HEADING_|TOGGLE_|YAW_|THROTTLE_|MIXTURE_|PROP_|FLAPS_|AXIS_|PARKING_|LANDING_)\w+)[\s:]+(-?\d+|ON|OFF)?$/i);
        if (match) {
            const cmd = { command: match[1].toUpperCase() };
            if (match[2] && match[2] !== 'ON' && match[2] !== 'OFF') {
                cmd.value = parseInt(match[2]);
            }
            commands.push(cmd);
        }
    }

    return commands;
}

// Middleware guard
function express_json_guard(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'JSON body required' });
    }
    next();
}

/** Get shared state (used by server-side rule engine for tuning data) */
function getSharedState() { return _sharedState; }

module.exports = { setupAiPilotRoutes, getSharedState, findNearestNode, findRunwayNode, aStarRoute };
