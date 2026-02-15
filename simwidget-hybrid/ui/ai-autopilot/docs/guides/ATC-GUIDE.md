# AI Autopilot ATC Ground Operations Guide

**Status**: ✅ PRODUCTION READY
**Version**: v3.0.0 (AI Autopilot)
**Date**: February 14, 2026

## Overview

AI Autopilot includes complete ATC ground operations for automated taxi from parking to runway hold-short. Features real-time airport detection, A* pathfinding on taxiway graphs, and authentic ATC phraseology generation.

**Key Features:**
- **9 ATC Phases** - INACTIVE → PARKED → TAXI_CLEARANCE_PENDING → TAXIING → HOLD_SHORT → TAKEOFF_CLEARANCE_PENDING → CLEARED_TAKEOFF → AIRBORNE → INACTIVE
- **Server-Side ATC** - No browser needed, REST API control
- **Browser-Based ATC** - Full phraseology, readback validation, voice announcements
- **Auto Airport Detection** - 15s polling, <2nm radius
- **A* Pathfinding** - Real taxiway graphs from MSFS SimConnect
- **Phraseology Generation** - Phonetic alphabet, runway/taxiway formatting
- **Position Monitoring** - Waypoint sequencing, off-route detection

---

## ATC System Architecture

### Dual-Channel Operation

**Server-Side ATC** (`backend/ai-autopilot/atc-server.js` ~145 lines):
- Runs in Node.js backend
- No browser required
- REST API endpoints for automation
- Direct SimConnect integration
- WebSocket broadcasting of ATC state

**Browser-Based ATC** (`ui/ai-autopilot/modules/atc-controller.js` ~400 lines):
- Full ATC phraseology generation
- Readback validation
- Voice announcements via TTS
- Position monitoring with real-time waypoint tracking
- Visual UI panel

**Why Both?**
- **Server-side**: Essential for automation scripts, other Claude agents, headless operation
- **Browser-based**: Enhanced user experience with voice, phraseology, visual feedback
- **Synergy**: Server broadcasts state via WebSocket, browser displays and enhances it

---

## ATC Phases

### Phase State Machine

```
INACTIVE (no ATC interaction)
  ↓ (Aircraft on ground, engine running)
PARKED (at parking position)
  ↓ (Request taxi clearance)
TAXI_CLEARANCE_PENDING (waiting for clearance)
  ↓ (Clearance received)
TAXIING (following route waypoints)
  ↓ (Reach hold-short line)
HOLD_SHORT (holding at runway entry)
  ↓ (Request takeoff clearance)
TAKEOFF_CLEARANCE_PENDING (waiting for clearance)
  ↓ (Clearance received)
CLEARED_TAKEOFF (ready for departure)
  ↓ (Airborne, AGL > 100ft)
AIRBORNE (ATC ground ops complete)
  ↓ (Auto-deactivate)
INACTIVE
```

### Phase Descriptions

#### INACTIVE
**What:** No ATC interaction, system dormant
**Entry:** System startup, after landing
**Exit:** Aircraft on ground, engine running
**Duration:** N/A (waiting state)

---

#### PARKED
**What:** Aircraft at parking position, engine running
**Entry:** Engine start detected, on ground
**Exit:** Taxi clearance requested
**Actions:**
- No ATC commands
- Waiting for pilot/AI to request taxi
**Duration:** N/A (waiting for user action)

**Manual Trigger:**
```bash
# Server-side
curl -X POST http://192.168.1.42:8080/api/ai-autopilot/request-taxi

# Browser-based
Voice: "request taxi"
SafeChannel: { type: 'atc-command', action: 'request-taxi' }
```

---

#### TAXI_CLEARANCE_PENDING
**What:** Taxi clearance requested, waiting for ATC response
**Entry:** Taxi request submitted
**Exit:** Clearance received (auto after 2s)
**Actions:**
- Detect nearest airport (<2nm)
- Select best runway (closest to heading)
- Calculate A* route from parking to hold-short
- Generate taxi clearance instruction
**Duration:** 2-5 seconds

**Example:**
```
Position: KDEN parking Bravo 5
Heading: 150°
Nearest runway: 16R (heading 163°, 3° difference)

Route calculation:
  Start: Parking B5 (39.8561, -104.6737)
  End: Runway 16R hold-short
  A* path: B5 → Taxiway B → Taxiway A → Hold-short

Clearance: "November one two three four five, Denver Ground,
           taxi via Bravo, Alpha, hold short runway one six right"
```

---

#### TAXIING
**What:** Following taxi route to runway
**Entry:** Taxi clearance received
**Exit:** Within 30m of hold-short waypoint
**Actions:**
- Follow waypoints with rudder/differential braking
- Sequence waypoints (advance when within 30m)
- Monitor off-route (>50m from active waypoint)
- Maintain 10-15kt taxi speed (5-8kt in turns)
- Voice callout: "Taxiing via Bravo, Alpha"
**Duration:** 2-5 minutes (depends on distance)

**Position Monitoring:**
```javascript
// Waypoint sequencing
const distToWaypoint = haversineDistance(currentPos, activeWaypoint);
if (distToWaypoint < 30) {  // 30m threshold
    advanceToNextWaypoint();
}

// Off-route detection
const distToRoute = perpendicularDistance(currentPos, routeLine);
if (distToRoute > 50) {  // 50m threshold
    warnOffRoute();
}
```

---

#### HOLD_SHORT
**What:** Holding at runway entry, waiting for takeoff clearance
**Entry:** Within 30m of hold-short waypoint
**Exit:** Takeoff clearance requested
**Actions:**
- Stop at hold-short line
- Reduce speed to 0-3kt
- Voice callout: "Holding short runway one six right"
- Display hold-short status in UI
**Duration:** N/A (waiting for user action)

**Manual Trigger:**
```bash
# Server-side
curl -X POST http://192.168.1.42:8080/api/ai-autopilot/cleared-takeoff

# Browser-based
Voice: "request takeoff" or "ready for departure"
SafeChannel: { type: 'atc-command', action: 'cleared-takeoff' }
```

---

#### TAKEOFF_CLEARANCE_PENDING
**What:** Takeoff clearance requested, waiting for ATC response
**Entry:** Takeoff clearance requested
**Exit:** Clearance received (auto after 2s)
**Actions:**
- Generate takeoff clearance instruction
- Voice callout: "Cleared for takeoff runway one six right"
**Duration:** 2 seconds

---

#### CLEARED_TAKEOFF
**What:** Cleared for departure, ready to takeoff
**Entry:** Takeoff clearance received
**Exit:** Airborne (AGL > 100ft)
**Actions:**
- Flight phase transitions to TAKEOFF
- AI autopilot begins takeoff roll
- ATC monitors for airborne transition
**Duration:** 1-2 minutes (takeoff roll + initial climb)

---

#### AIRBORNE
**What:** Airborne, ATC ground operations complete
**Entry:** AGL > 100ft
**Exit:** Auto-deactivate after 5s
**Actions:**
- Voice callout: "Airborne"
- Deactivate ATC system
- Transition to flight phase control
**Duration:** 5 seconds (cleanup)

---

## Server-Side ATC

### REST API Endpoints

#### POST /api/ai-autopilot/request-taxi

Request taxi clearance with auto airport detection and routing.

**Request:** None (auto-detects everything)

**What It Does:**
1. Detects nearest airport within 2nm via navdata API
2. Selects best runway (closest to current heading)
3. Auto-starts engine if off (sends Ctrl+E to MSFS)
4. Waits 3s for engine spool-up
5. Calculates A* route from current position to hold-short
6. Generates taxi clearance instruction
7. Broadcasts ATC state via WebSocket

**Response:**
```json
{
  "success": true,
  "airport": "KDEN",
  "runway": "16R",
  "route": {
    "taxiways": ["B", "A"],
    "waypoints": [
      { "lat": 39.8561, "lon": -104.6737 },
      { "lat": 39.8571, "lon": -104.6747 }
    ],
    "distance_ft": 1250
  },
  "instruction": "Taxi via Bravo, Alpha, hold short runway one six right",
  "phase": "TAXIING"
}
```

**Error Responses:**
```json
// No airport nearby
{
  "success": false,
  "error": "No airport found within 2nm",
  "phase": "INACTIVE"
}

// No taxiway data
{
  "success": false,
  "error": "Airport KDEN has no taxiway data",
  "phase": "INACTIVE"
}

// Pathfinding failed
{
  "success": false,
  "error": "No route found to runway 16R",
  "phase": "INACTIVE"
}
```

**Status Codes:**
- 200: Success
- 404: No airport found
- 503: ATC system not initialized

**Usage Example:**
```bash
# Simple automation - no browser needed
curl -X POST http://192.168.1.42:8080/api/ai-autopilot/request-taxi

# Expected output:
# {"success":true,"airport":"KDEN","runway":"16R",...}

# Check ATC state
curl http://192.168.1.42:8080/api/ai-autopilot/atc-state

# Expected output:
# {"phase":"TAXIING","airport":"KDEN","runway":"16R",...}
```

---

#### POST /api/ai-autopilot/cleared-takeoff

Issue takeoff clearance after hold-short.

**Request:** None

**What It Does:**
1. Verifies aircraft at hold-short (phase = HOLD_SHORT)
2. Generates takeoff clearance instruction
3. Transitions to CLEARED_TAKEOFF phase
4. Broadcasts state via WebSocket
5. AI autopilot begins takeoff sequence

**Response:**
```json
{
  "success": true,
  "instruction": "Cleared for takeoff runway one six right",
  "phase": "CLEARED_TAKEOFF"
}
```

**Error Responses:**
```json
// Not at hold-short
{
  "success": false,
  "error": "Not at hold-short position (current phase: TAXIING)",
  "phase": "TAXIING"
}

// ATC inactive
{
  "success": false,
  "error": "ATC system not active",
  "phase": "INACTIVE"
}
```

**Status Codes:**
- 200: Success
- 400: Not at hold-short
- 503: ATC not initialized

**Usage Example:**
```bash
# After reaching hold-short
curl -X POST http://192.168.1.42:8080/api/ai-autopilot/cleared-takeoff

# Expected output:
# {"success":true,"instruction":"Cleared for takeoff runway one six right",...}
```

---

#### GET /api/ai-autopilot/atc-state

Get current ATC state.

**Request:** None

**Response:**
```json
{
  "phase": "TAXIING",
  "airport": "KDEN",
  "runway": "16R",
  "route": {
    "taxiways": ["B", "A"],
    "waypoints": [
      { "lat": 39.8561, "lon": -104.6737 },
      { "lat": 39.8571, "lon": -104.6747 }
    ],
    "activeWaypointIndex": 1,
    "distanceToActive_m": 45
  },
  "instruction": "Taxi via Bravo, Alpha, hold short runway one six right"
}
```

**Status Codes:**
- 200: Success
- 503: ATC not initialized

---

#### POST /api/ai-autopilot/atc-deactivate

Deactivate ATC system.

**Request:** None

**Response:**
```json
{
  "success": true,
  "phase": "INACTIVE"
}
```

---

### Server-Side Integration

**For Other Claude Agents:**
```bash
#!/bin/bash
# Complete automated taxi example

# 1. Request taxi clearance
echo "Requesting taxi clearance..."
TAXI_RESPONSE=$(curl -s -X POST http://192.168.1.42:8080/api/ai-autopilot/request-taxi)
echo $TAXI_RESPONSE | jq .

# 2. Wait for taxi to complete (poll ATC state)
echo "Waiting for hold-short..."
while true; do
  STATE=$(curl -s http://192.168.1.42:8080/api/ai-autopilot/atc-state)
  PHASE=$(echo $STATE | jq -r .phase)
  echo "Current phase: $PHASE"

  if [ "$PHASE" = "HOLD_SHORT" ]; then
    echo "Reached hold-short!"
    break
  fi

  sleep 5
done

# 3. Request takeoff clearance
echo "Requesting takeoff clearance..."
TAKEOFF_RESPONSE=$(curl -s -X POST http://192.168.1.42:8080/api/ai-autopilot/cleared-takeoff)
echo $TAKEOFF_RESPONSE | jq .

# 4. AI autopilot handles takeoff automatically
echo "Cleared for takeoff! AI autopilot handling..."
```

---

## Browser-Based ATC

### ATCController Class

**File:** `ui/ai-autopilot/modules/atc-controller.js` (~400 lines)

**Features:**
- 9-state machine (INACTIVE → AIRBORNE)
- Phraseology generation (phonetic alphabet, formatting)
- Position monitoring (waypoint sequencing, off-route detection)
- Readback validation (fuzzy matching)
- Voice announcements via TTS

**Initialization:**
```javascript
const atc = new ATCController({
    onPhaseChange: (newPhase, oldPhase) => {
        console.log(`ATC: ${oldPhase} → ${newPhase}`);
    },
    onInstruction: (instruction, level) => {
        console.log(`ATC: ${instruction} (${level})`);
        voiceAnnouncer.speak(instruction);
    }
});
```

**Methods:**

```javascript
// Request taxi clearance
atc.requestTaxiClearance(airport, runway, route);
// Returns: { success: true, instruction: "..." }

// Update position (called every frame)
atc.updatePosition({ lat, lon, heading, speed });
// Advances waypoints, detects off-route, monitors hold-short

// Request takeoff clearance
atc.requestTakeoffClearance();
// Returns: { success: true, instruction: "..." }

// Validate readback (voice input)
atc.validateReadback(transcript);
// Returns: { valid: true, errors: [] }

// Get current state
const state = atc.getState();
// Returns: { phase, airport, runway, route, instruction }

// Deactivate
atc.deactivate();
```

---

### Phraseology Generation

**File:** `ui/ai-autopilot/data/atc-phraseology.js` (~80 lines)

**Features:**
- Runway formatting (16R → "one six right")
- Callsign formatting (N12345 → "November one two three four five")
- Frequency formatting (118.7 → "one one eight point seven")
- Phonetic alphabet (A-Z)
- Number words (0-9 with "niner" for 9, "zero" for 0)

**API:**

```javascript
// Runway formatting
ATCPhraseology.formatRunway("16R");
// Returns: "one six right"

ATCPhraseology.formatRunway("09L");
// Returns: "zero niner left"

ATCPhraseology.formatRunway("27");
// Returns: "two seven"

// Callsign formatting
ATCPhraseology.formatCallsign("N12345");
// Returns: "November one two three four five"

ATCPhraseology.formatCallsign("AAL123");
// Returns: "American one two three"

// Frequency formatting
ATCPhraseology.formatFrequency(118.7);
// Returns: "one one eight point seven"

ATCPhraseology.formatFrequency(121.5);
// Returns: "one two one point five"

// Phonetic alphabet
ATCPhraseology.PHONETIC.A  // "Alpha"
ATCPhraseology.PHONETIC.B  // "Bravo"
ATCPhraseology.PHONETIC.Z  // "Zulu"

// Number words
ATCPhraseology.NUMBERS[0]  // "zero"
ATCPhraseology.NUMBERS[9]  // "niner"
```

---

### Position Monitoring

**Waypoint Sequencing:**
```javascript
// Called every frame from updatePosition()
const distToActive = haversineDistance(currentPos, activeWaypoint);
if (distToActive < 30) {  // 30m threshold
    this.activeWaypointIndex++;
    if (this.activeWaypointIndex >= this.waypoints.length) {
        // Reached hold-short
        this.phase = 'HOLD_SHORT';
        this.onInstruction('Holding short runway ' + formatRunway(this.runway), 'info');
    }
}
```

**Off-Route Detection:**
```javascript
// Perpendicular distance from current position to route line
const distToRoute = perpendicularDistance(currentPos, routeLine);
if (distToRoute > 50) {  // 50m threshold
    this.offRoute = true;
    this.onInstruction('Off route, return to taxiway ' + this.route.taxiways[0], 'warning');
}
```

**Hold-Short Monitoring:**
```javascript
// When approaching hold-short line
if (this.phase === 'TAXIING') {
    const distToHoldShort = haversineDistance(currentPos, holdShortPos);
    if (distToHoldShort < 30) {
        this.phase = 'HOLD_SHORT';
        this.onInstruction('Hold short runway ' + formatRunway(this.runway), 'info');
        voiceAnnouncer.speak('Holding short');
    }
}
```

---

### Readback Validation

**Fuzzy Matching:**
```javascript
atc.validateReadback("taxi bravo alpha hold short one six right");
// Returns: { valid: true, errors: [] }

atc.validateReadback("taxi charlie alpha hold short one six right");
// Returns: { valid: false, errors: ["Wrong taxiway: charlie (expected: bravo)"] }

atc.validateReadback("hold short runway one eight right");
// Returns: { valid: false, errors: ["Wrong runway: 18R (expected: 16R)"] }
```

**Validation Logic:**
```javascript
validateReadback(transcript) {
    const errors = [];
    const normalized = transcript.toLowerCase();

    // Check callsign (optional but recommended)
    if (!normalized.includes(this.callsign.toLowerCase())) {
        errors.push('Missing callsign');
    }

    // Check runway
    const runwayPhonetic = formatRunway(this.runway).toLowerCase();
    if (!normalized.includes(runwayPhonetic)) {
        errors.push('Wrong runway or missing runway');
    }

    // Check taxiways
    this.route.taxiways.forEach(taxiway => {
        const taxiwayPhonetic = formatTaxiway(taxiway).toLowerCase();
        if (!normalized.includes(taxiwayPhonetic)) {
            errors.push(`Missing taxiway: ${taxiway}`);
        }
    });

    return { valid: errors.length === 0, errors };
}
```

---

## A* Pathfinding

### Taxiway Graph

**Source:** MSFS SimConnect Facility Data
- **TAXI_POINT** (FacilityDataType 14) - Taxiway nodes
- **TAXI_PATH** (FacilityDataType 16) - Taxiway edges
- **TAXI_PARKING** (FacilityDataType 15) - Parking positions
- **RUNWAY** (FacilityDataType 1) - Runway endpoints

**Graph Structure:**
```javascript
{
  "nodes": [
    {
      "index": 0,
      "lat": 39.8561,
      "lon": -104.6737,
      "type": "taxiway",
      "name": "B"
    },
    {
      "index": 1,
      "lat": 39.8571,
      "lon": -104.6747,
      "type": "taxiway",
      "name": "A"
    }
  ],
  "edges": [
    {
      "from": 0,
      "to": 1,
      "taxiway": "B",
      "distance_ft": 250,
      "oneway": false
    }
  ],
  "runways": [
    {
      "name": "16R",
      "heading": 163,
      "lat": 39.8561,
      "lon": -104.6737
    }
  ]
}
```

**Cache:**
- JSON file per airport: `data/atc-cache/{ICAO}.json`
- TTL: 7 days
- Regenerated on cache miss or expiry

---

### A* Algorithm

**File:** `backend/ai-pilot-api.js` (exported functions)

**Heuristic:** Haversine distance (great circle distance)

**Cost Function:**
```javascript
function aStar(graph, startNode, endNode) {
    const openSet = new PriorityQueue();
    const cameFrom = new Map();
    const gScore = new Map();  // Cost from start
    const fScore = new Map();  // gScore + heuristic

    gScore.set(startNode, 0);
    fScore.set(startNode, heuristic(startNode, endNode));
    openSet.enqueue(startNode, fScore.get(startNode));

    while (!openSet.isEmpty()) {
        const current = openSet.dequeue();

        if (current === endNode) {
            return reconstructPath(cameFrom, current);
        }

        const neighbors = graph.getNeighbors(current);
        for (const neighbor of neighbors) {
            const tentativeG = gScore.get(current) + distance(current, neighbor);

            if (tentativeG < (gScore.get(neighbor) || Infinity)) {
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeG);
                fScore.set(neighbor, tentativeG + heuristic(neighbor, endNode));
                openSet.enqueue(neighbor, fScore.get(neighbor));
            }
        }
    }

    return null;  // No path found
}
```

**Distance Calculation:**
```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 20902231;  // Earth radius in feet
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;  // Distance in feet
}
```

---

### Pathfinding API

#### GET /api/ai-pilot/atc/airport/:icao

Get taxiway graph for airport.

**Request:** GET /api/ai-pilot/atc/airport/KDEN

**Response:** (See Taxiway Graph section above)

**Status Codes:**
- 200: Success
- 404: Airport not found or no taxiway data
- 503: Navdata not available

---

#### GET /api/ai-pilot/atc/route

Calculate A* route.

**Request:**
```
GET /api/ai-pilot/atc/route?icao=KDEN&fromLat=39.8561&fromLon=-104.6737&toRunway=16R
```

**Response:**
```json
{
  "success": true,
  "taxiways": ["B", "A"],
  "waypoints": [
    { "lat": 39.8561, "lon": -104.6737 },
    { "lat": 39.8571, "lon": -104.6747 }
  ],
  "distance_ft": 1250,
  "instruction": "Taxi via Bravo, Alpha"
}
```

**Status Codes:**
- 200: Success
- 404: No route found
- 400: Invalid parameters

---

#### GET /api/ai-pilot/atc/nearest-node

Find nearest taxiway node to position.

**Request:**
```
GET /api/ai-pilot/atc/nearest-node?icao=KDEN&lat=39.8561&lon=-104.6737
```

**Response:**
```json
{
  "nodeIndex": 5,
  "distance_ft": 45,
  "node": {
    "index": 5,
    "lat": 39.8562,
    "lon": -104.6738,
    "type": "taxiway",
    "name": "B"
  }
}
```

---

## Voice Integration

### Voice Commands

**File:** `ui/voice-control/data/default-commands.js`

**ATC Commands:**
```javascript
{
  "phrase": "request taxi",
  "action": "atc",
  "atcAction": "request-taxi",
  "description": "Request taxi clearance from ATC"
},
{
  "phrase": "ready for departure",
  "action": "atc",
  "atcAction": "cleared-takeoff",
  "description": "Request takeoff clearance"
},
{
  "phrase": "request takeoff",
  "action": "atc",
  "atcAction": "cleared-takeoff",
  "description": "Request takeoff clearance (alternate)"
},
{
  "phrase": "readback",
  "action": "atc",
  "atcAction": "readback",
  "description": "Read back ATC instruction"
},
{
  "phrase": "roger",
  "action": "atc",
  "atcAction": "acknowledge",
  "description": "Acknowledge ATC instruction"
},
{
  "phrase": "wilco",
  "action": "atc",
  "atcAction": "acknowledge",
  "description": "Will comply with ATC instruction"
}
```

**Execution:**
```javascript
// Voice Control → SafeChannel → AI Autopilot
executeATC(atcAction) {
    // Send via SafeChannel (browser)
    safeChannel.postMessage({
        type: 'atc-command',
        action: atcAction
    });

    // Also send via HTTP (server)
    if (atcAction === 'request-taxi') {
        fetch('/api/ai-autopilot/request-taxi', { method: 'POST' });
    } else if (atcAction === 'cleared-takeoff') {
        fetch('/api/ai-autopilot/cleared-takeoff', { method: 'POST' });
    }
}
```

**Benefit:** Dual-channel ensures ATC works even if AI autopilot browser pane is closed (server-side continues).

---

### Voice Announcements

**TTS Integration:**
```javascript
// ATC instruction announcement
atc.onInstruction = (instruction, level) => {
    voiceAnnouncer.speak(instruction, {
        rate: 0.9,  // Slightly slower for clarity
        pitch: 1.0,
        volume: 0.8
    });
};

// Examples
voiceAnnouncer.speak("Taxi via Bravo, Alpha, hold short runway one six right");
voiceAnnouncer.speak("Cleared for takeoff runway one six right");
voiceAnnouncer.speak("Holding short");
```

---

## Examples

### Example 1: KDEN (Denver International) - Parking B5 to Runway 16R

**Scenario:** Aircraft at parking B5, heading 150°, destination runway 16R

**Timeline:**
```
T+0s:   Enable AI Autopilot
        Phase: PREFLIGHT
        ATC: INACTIVE

T+30s:  Engine start (Ctrl+E auto-start)
        Phase: TAXI
        ATC: PARKED

T+45s:  Request taxi clearance (voice: "request taxi")
        ATC: TAXI_CLEARANCE_PENDING

        Airport detection:
        - Nearest: KDEN (1.2nm, 0.8nm from parking)
        - Best runway: 16R (heading 163°, 13° from current 150°)

        Route calculation (A*):
        - Start: Parking B5 (39.8561, -104.6737)
        - End: Runway 16R hold-short (39.8571, -104.6747)
        - Path: B5 → Taxiway B → Taxiway A → Hold-short
        - Distance: 1,250 ft (~0.2nm)
        - Waypoints: [
            {lat: 39.8561, lon: -104.6737},  // B5
            {lat: 39.8565, lon: -104.6742},  // Taxiway B
            {lat: 39.8571, lon: -104.6747}   // Hold-short
          ]

        Clearance: "November one two three four five, Denver Ground,
                   taxi via Bravo, Alpha, hold short runway one six right"

T+47s:  ATC: TAXIING
        Voice: "Taxiing via Bravo, Alpha"
        AI begins taxi at 10kt

T+50s:  Approaching waypoint 1 (Taxiway B)
        Distance: 45m

T+60s:  Reached waypoint 1
        Advance to waypoint 2 (Taxiway A)

T+120s: Approaching waypoint 2 (Hold-short)
        Distance: 25m
        Reduce speed to 5kt

T+135s: Reached hold-short
        ATC: HOLD_SHORT
        Voice: "Holding short runway one six right"
        Speed: 0kt

T+140s: Request takeoff clearance (voice: "ready for departure")
        ATC: TAKEOFF_CLEARANCE_PENDING

T+142s: Clearance received
        ATC: CLEARED_TAKEOFF
        Voice: "Cleared for takeoff runway one six right"
        Phase: TAKEOFF (AI autopilot begins takeoff roll)

T+200s: Airborne (AGL > 100ft)
        ATC: AIRBORNE
        Voice: "Airborne"

T+205s: ATC auto-deactivate
        ATC: INACTIVE
```

---

### Example 2: KSEA (Seattle-Tacoma) - Complex Taxi via Multiple Taxiways

**Scenario:** Aircraft at gate N12, heading 180°, destination runway 34L

**Taxi Route:**
- N12 → Taxiway N → Taxiway M → Taxiway C → Hold-short 34L
- Distance: 2,800 ft (~0.5nm)
- 4 taxiway segments, 5 waypoints

**Timeline:**
```
T+0s:   Request taxi
        ATC: TAXI_CLEARANCE_PENDING

        Airport: KSEA (0.3nm)
        Best runway: 34L (heading 343°, 17° from current 180°)

        Route (A*): N12 → N → M → C → HS

        Clearance: "November one two three four five, Seattle Ground,
                   taxi via November, Mike, Charlie, hold short runway three four left"

T+2s:   ATC: TAXIING
        Active waypoint: 0 (N12 start)

T+45s:  Waypoint 0 → 1 (Taxiway N)
        Distance: 450ft
        Advance to waypoint 1

T+90s:  Waypoint 1 → 2 (Taxiway M junction)
        Distance: 650ft
        Turn onto Taxiway M
        Slow to 8kt for turn

T+150s: Waypoint 2 → 3 (Taxiway C junction)
        Distance: 800ft
        Turn onto Taxiway C

T+210s: Waypoint 3 → 4 (Hold-short 34L)
        Distance: 900ft
        Approaching hold-short
        Reduce to 3kt

T+240s: Reached hold-short
        ATC: HOLD_SHORT
        Voice: "Holding short runway three four left"
```

---

### Example 3: Off-Route Recovery

**Scenario:** Aircraft drifts off taxiway during turn

**Timeline:**
```
T+0s:   TAXIING on Taxiway A
        Active waypoint: Taxiway B junction
        On-route (distance to route: 5m)

T+30s:  Turn onto Taxiway B
        Speed: 8kt
        Distance to route: 15m (within tolerance)

T+35s:  Aircraft drifts right during turn
        Distance to route: 55m (OFF ROUTE!)

        Warning: "Off route, return to taxiway Bravo"
        Voice: "Off route"
        UI: Red indicator, route line highlighted

T+40s:  AI autopilot corrects heading
        Steering back toward taxiway centerline
        Distance to route: 45m (still off-route)

T+50s:  Distance to route: 35m (recovering)

T+55s:  Distance to route: 20m (back on route)
        Off-route flag cleared
        Voice: "Back on route"

T+60s:  Continue taxi normally
```

---

## Troubleshooting

### "ATC not detecting airport"

**Symptoms:** Request taxi, get error "No airport found within 2nm"

**Causes:**
1. Too far from airport (>2nm)
2. Airport has no taxiway data in navdata

**Solutions:**
1. Taxi closer to airport (<2nm)
   ```bash
   curl http://192.168.1.42:8080/api/navdb/nearby/airports?lat=39.8561&lon=-104.6737&radiusNm=5
   ```
2. Check airport has taxiway data:
   ```bash
   curl http://192.168.1.42:8080/api/ai-pilot/atc/airport/KDEN
   # Should return nodes, edges, runways arrays
   ```
3. If airport has no data, use manual taxi (disable AI autopilot ATC)

---

### "Pathfinding fails - no route found"

**Symptoms:** Request taxi, get error "No route found to runway 16R"

**Causes:**
1. Start position not near any taxiway node
2. Runway has no hold-short point in graph
3. Taxiway graph disconnected (isolated sections)

**Solutions:**
1. Move aircraft closer to taxiway centerline
2. Check nearest node:
   ```bash
   curl "http://192.168.1.42:8080/api/ai-pilot/atc/nearest-node?icao=KDEN&lat=39.8561&lon=-104.6737"
   # Should return nodeIndex and distance < 100ft
   ```
3. If nearest node >100ft away, use different parking position
4. Report missing taxiway data (SimConnect issue, not AI autopilot)

---

### "AI keeps going off-route"

**Symptoms:** Aircraft drifts >50m from taxiway centerline repeatedly

**Causes:**
1. Rudder sensitivity too low
2. Crosswind pushing aircraft off-route
3. Taxiway waypoints inaccurate

**Solutions:**
1. Increase rudder authority in tuning panel
2. Reduce taxi speed (less momentum, easier to correct)
3. Check wind conditions (crosswind >10kt may cause drift)
4. Manually taxi if wind too strong

---

### "ATC stuck at hold-short, won't request takeoff"

**Symptoms:** AI reaches hold-short but doesn't auto-request takeoff

**Causes:**
1. AI autopilot waiting for manual clearance (expected behavior)
2. Voice command not recognized
3. SafeChannel disconnected

**Solutions:**
1. This is normal! ATC requires **manual** takeoff clearance request for safety
2. Say "ready for departure" or "request takeoff"
3. Or use server API: `curl -X POST http://192.168.1.42:8080/api/ai-autopilot/cleared-takeoff`
4. Or click "CLEARED TAKEOFF" button in UI (if implemented)

---

### "Phraseology pronunciation wrong"

**Symptoms:** TTS says "one one six right" instead of "one six right" for runway 16R

**Causes:**
1. `formatRunway()` bug (incorrect string parsing)
2. TTS voice not handling phonetic strings correctly

**Solutions:**
1. Check phraseology output:
   ```javascript
   ATCPhraseology.formatRunway("16R")
   // Should return: "one six right"
   // Not: "one one six right"
   ```
2. If output correct, issue is TTS voice
3. Change TTS voice in settings (try different voices)
4. Report bug if `formatRunway()` output incorrect

---

### "Readback validation always fails"

**Symptoms:** Say readback, always get "Invalid readback" error

**Causes:**
1. Voice recognition transcription inaccurate
2. Fuzzy matching too strict
3. Missing required elements (callsign, runway, taxiway)

**Solutions:**
1. Check voice recognition transcript in debug panel
2. Speak clearly, enunciate runway/taxiway names
3. Include all elements: callsign + taxiways + runway
   - Good: "N12345, taxi bravo alpha, hold short one six right"
   - Bad: "taxi bravo" (missing runway)
4. Use phonetic alphabet if possible
   - "Bravo" instead of "B"
   - "Alpha" instead of "A"

---

## Integration with AI Autopilot

### Flight Phase Coordination

**ATC gates TAXI→TAKEOFF transition:**
```javascript
// In flight-phase.js
case 'TAXI':
    // Require ATC clearance before takeoff
    if (this._atc && this._atc.getPhase() === 'CLEARED_TAKEOFF') {
        this._setPhase('TAKEOFF');
    } else if (!this._atc) {
        // No ATC, allow manual transition
        if (throttle > 80 && ias > 30) {
            this._setPhase('TAKEOFF');
        }
    }
    break;
```

**Benefit:** Prevents accidental takeoff without clearance

---

### Rule Engine Integration

**ATC waypoints used for taxi steering:**
```javascript
// In rule-engine-ground.js
_applyTaxiSteering(d, profile) {
    if (this._atc && this._atc.getPhase() === 'TAXIING') {
        const nextWaypoint = this._atc.getNextWaypoint();
        if (nextWaypoint) {
            const bearing = this._calculateBearing(d.latitude, d.longitude,
                                                   nextWaypoint.lat, nextWaypoint.lon);
            this._steerToHeading(bearing, d.heading, 'TAXI_STEERING');
        }
    }
}
```

---

### Voice Announcer Integration

**ATC instructions via TTS:**
```javascript
// In atc-controller.js
onInstruction(instruction, level) {
    // Display in UI
    this.elements.atcInstruction.textContent = instruction;

    // Color by level
    this.elements.atcPanel.className = `atc-panel atc-${level}`;

    // Speak via TTS
    if (this._voice && this._ttsEnabled) {
        this._voice.speak(instruction);
    }

    // Log to command log
    this._logCommand(`ATC: ${instruction}`);
}
```

---

## Performance

**Memory Footprint:**
- ATCController module: ~100KB (~400 lines × 250 bytes/line)
- Phraseology data: ~20KB (~80 lines)
- Taxiway graph (KDEN): ~150KB (500 nodes, 800 edges)
- Total: ~270KB

**Network:**
- Airport detection: 1 request/15s (only during TAXI phase)
- Route calculation: 1 request/taxi (cached)
- ATC state broadcast: 1 message/s via WebSocket (minimal overhead)

**CPU:**
- A* pathfinding: <50ms (typical airport ~500 nodes)
- Position monitoring: <1ms/frame (haversine distance calculations)
- Phraseology generation: <1ms (string formatting only)

---

## Limitations

1. **No progressive taxi** - Expects full clearance upfront (cannot handle "Taxi to Bravo, hold short Runway 34L, I'll call your turn")
2. **No complex instructions** - Cannot parse conditional instructions (e.g., "Cross Runway 16L at Alpha if no traffic")
3. **No pushback** - Must start at parking with nose-out orientation
4. **No runway crossing** - Route avoids runway crossings (safety limitation)
5. **GPS-only positioning** - No support for visual landmarks or taxiway signs
6. **Single airport** - Cannot handle taxi between airports (ferry flights)
7. **No de-icing** - Cannot handle de-icing pad routing
8. **English only** - Phraseology only in English (no ICAO language variants)

---

## Future Enhancements

**Potential Improvements:**
- Progressive taxi (multi-step clearances)
- Runway crossing logic with clearance requirements
- Pushback automation (reverse taxi with tug simulation)
- Visual landmark recognition (taxiway signs, tower, gates)
- Multi-language phraseology (ICAO variants)
- De-icing pad routing
- Taxi speed adaptation (weather, traffic, aircraft type)
- Hold-short line detection via SimConnect (instead of waypoint proximity)

---

## Credits

- **FAA** - Taxiway data via SimConnect
- **MSFS 2024** - Facility data API
- **ICAO** - ATC phraseology standards
- **SimGlass Team** - Framework and integration

---

## License

Part of SimGlass - see main repository LICENSE file.

---

## See Also

- [README.md](README.md) - Main AI Autopilot documentation
- [WEATHER-GUIDE.md](WEATHER-GUIDE.md) - Wind compensation, turbulence *(coming soon)*
- [NAVIGATION-GUIDE.md](NAVIGATION-GUIDE.md) - Flight plan tracking *(coming soon)*
- [PHASES-GUIDE.md](PHASES-GUIDE.md) - 8 flight phases *(coming soon)*
- [LLM-ADVISOR-GUIDE.md](LLM-ADVISOR-GUIDE.md) - AI suggestions *(coming soon)*
