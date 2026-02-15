# ATC Bot - Quick Start

AI flight bot that knows airport layouts and issues proper taxi clearances.

## What You Got

**Core System**
- ✅ Taxi graph loader (reads MSFS taxiway data via SimConnect)
- ✅ A* pathfinding (finds routes through airports)
- ✅ ATC phraseology generator (proper ICAO/FAA format)
- ✅ Readback validator (checks pilot responses)
- ✅ Position monitor (detects off-route)
- ✅ State machine (Parked → Taxi → Hold Short → Takeoff)

**How Taxi Navigation Works**
```
Your Question: "Airports are huge, how does bot know where to taxi?"

Answer: SimConnect exposes the taxiway graph!

┌─────────────────────────────────────┐
│ MSFS 2024 Airport Data              │
│                                     │
│ TAXI_POINT: Nodes (lat/lon)        │
│   Node 0: Gate 23A                  │
│   Node 1: Taxiway Alpha             │
│   Node 42: Runway 16R threshold     │
│                                     │
│ TAXI_PATH: Edges (connections)     │
│   0→1: "Echo" (150m)                │
│   1→42: "Alpha" (200m)              │
└─────────────────────────────────────┘
         ↓ (Query via SimConnect)
┌─────────────────────────────────────┐
│ TaxiGraph.cs                        │
│ - Builds graph in memory            │
│ - Caches to JSON                    │
│ - A* pathfinding                    │
└─────────────────────────────────────┘
         ↓
Route: [Gate 23A → Echo → Alpha → Rwy 16R]
ATC: "Taxi to runway 16R via Echo, Alpha, hold short 16R"
```

## Files Created

```
ATC-Bot/
├── TaxiGraph.cs           - Graph + A* pathfinding (350 lines)
├── FacilityDataLoader.cs  - SimConnect queries (300 lines)
├── ATCController.cs       - State machine + logic (250 lines)
├── Program.cs             - Example usage (150 lines)
├── ATCBot.csproj          - Build config
├── README.md              - Full documentation
└── PHRASEOLOGY.md         - ATC phrase reference
```

## Quick Build

```bash
# 1. Open in VS
cd C:\DevClaude\ATC-Bot
dotnet build

# 2. Update SimConnect path in ATCBot.csproj
# Change: C:\MSFS SDK\SimConnect SDK\lib\managed\...
# To your actual SDK path

# 3. Run
dotnet run
```

## Test It

```
> load KSEA
[TaxiGraph] Loaded KSEA from cache: 342 nodes

> taxi 16R
[ATC]: N12345, taxi to runway one six right via Echo, Alpha, Bravo, hold short runway one six right

> readback N12345 taxi 16R via Echo Alpha Bravo hold short 16R
[ATC]: N12345, readback correct

> status
Phase: TaxiToRunway
Assigned Runway: 16R
Route: Echo -> Alpha -> Bravo
```

## Next Steps

**Phase 1: Ground Ops** (Already Built) ✅
- Load airport graph
- Issue taxi clearance
- Validate readback
- Monitor position

**Phase 2: Voice Integration**
```csharp
// Add to Program.cs
var stt = new WhisperSTT();
var tts = new ElevenLabsTTS();

stt.OnSpeech += (text) => {
    var result = atc.ValidateReadback(text);
    tts.Speak(result.Response);
};
```

**Phase 3: Auto-Pilot**
```csharp
// Make bot actually fly
var autopilot = new SimConnectAutopilot(simConnect);

atc.OnRouteCalculated += (route) => {
    autopilot.FollowPath(route.NodePath);
};
```

## Integration Options

### Option A: Standalone App
Run as-is, control via console or HTTP API

### Option B: Hive Service
```javascript
// Hivemind service wrapper
const atc = spawn('dotnet', ['run', '--project', 'C:\\DevClaude\\ATC-Bot']);

http.post('/atc/taxi', (req, res) => {
  atc.stdin.write(`taxi ${req.body.runway}\n`);
});
```

### Option C: SimWidget Engine Plugin
Add as module to your flight sim framework

## Key Concepts

**Graph Cache**
- First load: Queries SimConnect (2-5 sec)
- Saves: `C:\DevClaude\ATC-Bot\airports\KSEA.graph.json`
- Next load: <100ms from disk
- Auto-updates if scenery changes

**Readback Validation**
Must include:
1. Callsign (N12345 or abbreviated)
2. Runway number (16R, 24L)
3. Key actions (via, hold short)

**State Machine**
```
Parked → TaxiToRunway → HoldShort → TakeoffClearance → Departure
```

## Troubleshooting

**"No airport data found"**
- Verify MSFS running
- Check SimConnect connected
- Ensure airport in sim (not all have taxi data)

**"Path not found"**
- Airport graph incomplete
- Try different runway
- Check for closed taxiways

**"Readback always fails"**
- Check callsign matches (set in controller)
- Verify runway format (16R not 16 Right)
- Enable debug logging

## What's Missing (Future)

- [ ] Voice (STT/TTS)
- [ ] Auto-pilot integration
- [ ] Multiple frequencies (ground/tower/departure)
- [ ] Traffic awareness
- [ ] Wind-based runway assignment
- [ ] IFR clearances (STAR/SID)
- [ ] ATIS generation

## Resources

- `README.md` - Full architecture docs
- `PHRASEOLOGY.md` - Complete ATC phrase reference
- MSFS SDK Docs: https://docs.flightsimulator.com
- SimConnect API: /6_Programming_APIs/SimConnect/

---

**Built for Hive**
Port 8780 recommended for ATC service
Event mesh integration ready
