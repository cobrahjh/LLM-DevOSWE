# ATC Bot for MSFS 2024

AI-powered Air Traffic Control bot that knows airport taxiway layouts and can issue proper taxi clearances with readback validation.

## How It Works

### Architecture

```
┌──────────────┐
│  MSFS 2024   │
│  SimConnect  │
└──────┬───────┘
       │
       ├─► Aircraft Position (lat/lon/speed/alt)
       │
       ├─► Airport Facility Data (taxiway graph)
       │   ├─ TAXI_POINT (nodes)
       │   ├─ TAXI_PATH (edges)
       │   ├─ TAXI_PARKING (gates)
       │   └─ RUNWAY (thresholds)
       │
┌──────▼───────────────────────┐
│   FacilityDataLoader         │
│   - Queries SimConnect       │
│   - Builds taxiway graph     │
│   - Caches to disk           │
└──────┬───────────────────────┘
       │
┌──────▼───────────────────────┐
│   TaxiGraph                  │
│   - Nodes (taxiway points)   │
│   - Edges (connections)      │
│   - A* Pathfinding           │
│   - Route → Taxiway Names    │
└──────┬───────────────────────┘
       │
┌──────▼───────────────────────┐
│   ATCController              │
│   - State Machine            │
│   - Phraseology Generator    │
│   - Readback Validator       │
│   - Position Monitor         │
└──────────────────────────────┘
```

### Taxi Navigation Solution

**Problem**: Airports are huge. How does the bot know where to taxi?

**Solution**: SimConnect exposes the **taxiway graph** via Facility Data API:

1. **Query Airport Layout** (one-time per airport)
   - `TAXI_POINT`: Network nodes (lat/lon/index)
   - `TAXI_PATH`: Edges connecting nodes
   - `TAXI_PARKING`: Gate positions
   - `RUNWAY`: Threshold positions

2. **Build Graph**
   ```
   Nodes: {
     0: { lat: 47.449, lon: -122.309, type: "normal" },
     1: { lat: 47.450, lon: -122.310, type: "normal" },
     42: { lat: 47.451, lon: -122.308, type: "runway", name: "16R" }
   }
   
   Edges: {
     0 → 1: { taxiway: "Alpha", distance: 150m },
     1 → 42: { taxiway: "Bravo", distance: 200m }
   }
   ```

3. **Pathfinding** (A* algorithm)
   ```
   Aircraft at Gate 23 (node 50)
   Target: Runway 16R (node 42)
   
   Path: [50 → 12 → 5 → 1 → 42]
   Names: ["Echo", "Alpha", "Bravo"]
   
   ATC: "Taxi to runway 16R via Echo, Alpha, Bravo, hold short runway 16R"
   ```

4. **Cache System**
   - First visit: Query SimConnect (~2-5 sec)
   - Save to: `C:\DevClaude\ATC-Bot\airports\{ICAO}.graph.json`
   - Next visit: Instant load from cache

### State Machine

```
Parked
  ↓ (request taxi)
TaxiToRunway ←─┐ (monitor position)
  ↓            │
HoldShort ─────┘ (off route: "verify position")
  ↓ (all clear)
TakeoffClearance
  ↓ (wheels up)
Departure
  ↓
Enroute
  ↓
Approach
  ↓
Landing
  ↓
TaxiToGate
```

### Readback Validation

ATC issues clearance:
```
"November one two three four five, taxi to runway two four right 
via Alpha, Bravo, hold short runway two four right"
```

Bot validates pilot readback must include:
- ✅ Callsign (N12345 or 12345)
- ✅ Runway (24R or two four right)
- ✅ At least one taxiway name (Alpha, Bravo)

If incorrect:
```
"Readback incorrect. Confirm runway two four right. Taxi via Alpha, Bravo..."
```

## Project Structure

```
ATC-Bot/
├── TaxiGraph.cs             # Graph data structure + A* pathfinding
├── FacilityDataLoader.cs    # SimConnect facility data query
├── ATCController.cs         # Main ATC logic + state machine
├── Program.cs               # Example integration
└── airports/                # Cached graphs
    ├── KSEA.graph.json
    ├── KLAX.graph.json
    └── ...
```

## Building

### Requirements
- .NET 8.0+
- MSFS 2024 SimConnect SDK
- Windows (SimConnect requirement)

### Setup

1. **Install SimConnect SDK**
   ```
   MSFS 2024 SDK → SimConnect SDK → lib/SimConnect.dll
   ```

2. **Create Project**
   ```bash
   dotnet new console -n ATCBot
   cd ATCBot
   ```

3. **Add SimConnect Reference**
   ```bash
   dotnet add reference "C:\MSFS SDK\SimConnect SDK\lib\managed\Microsoft.FlightSimulator.SimConnect.dll"
   ```

4. **Copy Source Files**
   - Copy all .cs files from this folder
   - Replace default Program.cs

5. **Build**
   ```bash
   dotnet build
   ```

## Usage

### Basic Example

```csharp
// Initialize
var simConnect = new SimConnect("ATC Bot", IntPtr.Zero, 0, null, 0);
var atcController = new ATCController(simConnect);

// Load airport (queries taxiway graph)
atcController.LoadAirport("KSEA");

// Issue taxi clearance
string clearance = atcController.IssueTaxiClearance("16R");
// Output: "N12345, taxi to runway 16R via Echo, Alpha, Bravo, hold short runway 16R"

// Validate pilot readback
var result = atcController.ValidateReadback("N12345, taxi 16R via Echo Alpha Bravo hold short 16R");
if (result.IsCorrect) {
    Console.WriteLine("Readback correct");
} else {
    Console.WriteLine($"Readback incorrect: {result.Response}");
}

// Monitor position (call every second)
atcController.UpdateAircraftState(lat, lon, altAGL, speed);
string warning = atcController.MonitorTaxi();
if (warning != null) {
    Console.WriteLine(warning); // "N12345, verify position"
}
```

## Integration with Voice

### Speech-to-Text (STT)
```csharp
using Azure.CognitiveServices.Speech;

var speechConfig = SpeechConfig.FromSubscription(key, region);
var recognizer = new SpeechRecognizer(speechConfig);

recognizer.Recognized += (s, e) => {
    string pilotSpeech = e.Result.Text;
    var result = atcController.ValidateReadback(pilotSpeech);
    SpeakTTS(result.Response);
};
```

### Text-to-Speech (TTS)
```csharp
void SpeakTTS(string message) {
    var synthesizer = new SpeechSynthesizer(speechConfig);
    
    // Convert to phonetic alphabet
    message = message
        .Replace("16R", "one six right")
        .Replace("24L", "two four left")
        .Replace("Alpha", "alfa")
        .Replace("Bravo", "bravo");
    
    synthesizer.SpeakTextAsync(message);
}
```

## Hive Integration

### Service Architecture
```
Port 8780: ATC Service
├─ HTTP endpoint: POST /atc/taxi
├─ SimConnect manager (one per MSFS instance)
└─ WebSocket for live updates

Event Mesh (8750):
├─ aircraft.position.update
├─ atc.clearance.issued
└─ atc.readback.validated
```

### Hive Service Example
```javascript
// C:\DevClaude\Hivemind\services\atc-service.js
const { spawn } = require('child_process');
const express = require('express');

class ATCService {
  constructor() {
    this.app = express();
    this.atcProcess = null;
  }

  start() {
    // Start .NET ATC bot
    this.atcProcess = spawn('dotnet', [
      'run', 
      '--project', 
      'C:\\DevClaude\\ATC-Bot'
    ]);

    // REST API
    this.app.post('/atc/taxi', (req, res) => {
      const { icao, runway } = req.body;
      // Send command to ATC bot via stdin
      this.atcProcess.stdin.write(`load ${icao}\ntaxi ${runway}\n`);
      res.json({ status: 'ok' });
    });

    this.app.listen(8780);
    console.log('[Hive] ATC Service on 8780');
  }
}
```

## Advanced Features

### Progressive Taxi
For complex routes, issue one segment at a time:
```
ATC: "Taxi via Echo"
[Aircraft reaches Echo]
ATC: "Continue taxi via Alpha"
[Aircraft reaches Alpha]
ATC: "Continue via Bravo, hold short runway 16R"
```

### Dynamic Rerouting
If aircraft goes off route:
```csharp
if (OffRoute) {
    var newRoute = graph.GetRoute(currentLat, currentLon, assignedRunway);
    atcController.UpdateRoute(newRoute);
}
```

### Construction/NOTAM
Mark paths as closed:
```csharp
graph.SetPathClosed("Alpha", true);
// Pathfinder automatically avoids closed paths
```

## Testing

### Manual Test
```
load KSEA
taxi 16R
readback N12345 taxi 16R via Echo Alpha Bravo hold short 16R
status
```

### Test Graph Loading
```csharp
var graph = new TaxiGraph("KSEA");
graph.LoadAirport(simConnect);
Console.WriteLine($"Loaded {graph.Nodes.Count} nodes");
```

### Test Pathfinding
```csharp
var route = graph.GetRoute(47.449, -122.309, "16R");
Console.WriteLine($"Route: {string.Join(" → ", route.TaxiwayNames)}");
```

## Performance

- **Graph Load**: 2-5 sec (first time), <100ms (cached)
- **Pathfinding**: <50ms for typical airport
- **Memory**: ~5MB per airport graph
- **CPU**: <1% during normal operation

## Future Enhancements

- [ ] Voice integration (Whisper + ElevenLabs)
- [ ] Multi-frequency (ground/tower/departure)
- [ ] Traffic awareness (other aircraft)
- [ ] Runway assignment logic (wind, traffic)
- [ ] IFR clearances (STAR/SID/approach)
- [ ] Emergency procedures
- [ ] ATIS generation

## Troubleshooting

**Graph won't load**
- Verify SimConnect connection
- Check MSFS 2024 is running
- Ensure airport exists in sim

**Wrong taxiway names**
- Check if using payware scenery (different graph)
- Clear cache and reload
- Verify taxiway names match MSFS labels

**Readback always fails**
- Enable debug logging
- Check expected vs actual text
- Verify callsign matches

## License

MIT - Built for the Hive ecosystem
