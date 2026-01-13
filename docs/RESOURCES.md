# SimWidget Engine - Integration Resources & APIs
**Version:** 1.0.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\RESOURCES.md`

---

## Quick Reference - Available APIs

| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| **Lorby AAO WebAPI** | 43380 | HTTP REST | ✅ Active |
| **FSUIPC7 WebSocket** | 2048 | WebSocket | ✅ Active |
| **Little Navmap** | 8965 | HTTP REST | ✅ Active |
| **ChasePlane** | 8652 | HTTP | ❌ Not Installed |
| **SimWidget Server** | 8080 | HTTP/WS | ✅ Our Server |
| **MobiFlight** | - | SimConnect | ✅ Installed |
| **Navigraph Simlink** | - | WebSocket | ✅ Installed |

---

## 1. Lorby Axis & Ohs WebAPI

### Connection Details
```
URL: http://localhost:43380/webapi
Refresh Rate: 100ms (configurable)
Long Click: 750ms
Repeat Rate: 250ms
```

### Endpoints (from Stream Deck plugin analysis)

#### Connection Check
```http
GET http://localhost:43380/webapi?conn=1
Response: "OK" if connected
```

#### Execute Event
```http
GET http://localhost:43380/webapi?evt={script}
```

#### Read SimVar
```http
GET http://localhost:43380/webapi?var={simvar}
Response: numeric value
```

#### Bulk Variable Request
```http
GET http://localhost:43380/webapi?vars={var1}|{var2}|{var3}
Response: pipe-separated values
```

### Action Types Supported
| Type | Description |
|------|-------------|
| `button` | Single press action |
| `event` | SimConnect event trigger |
| `toggle` | On/Off toggle |
| `onoff` | Explicit on/off states |
| `dualevent` | Press + Long press events |
| `gaugetext` | Text gauge display |
| `steamgauge` | Round gauge display |
| `slidergauge` | Linear gauge display |
| `lvarimage` | Image based on LVar |
| `multigauge` | Multiple gauges |
| `rotary` | Rotary encoder input |

### Data Files Location
```
C:\Users\hjhar\AppData\Local\LORBY_SI\LorbyAxisAndOhsMSFS24\
├── lvarscan.csv              # 708 discovered LVars
├── MSFS_HTML_Events.xml      # 260 H: events (AS1000, etc.)
├── CustomEvents_MSFS2024.xml # User-defined events
├── LvarBvarMappings_*.xml    # Variable mappings
└── ConfigDatabase_*.xml      # Device configurations
```

---

## 2. FSUIPC7 WebSocket Server

### Connection Details
```
URL: ws://localhost:2048
Format: JSON
Update Rate: 6Hz (configurable)
```

### Message Format
```javascript
// Subscribe to SimVar
{ "command": "subscribe", "name": "Altitude", "unit": "feet" }

// Read LVar
{ "command": "lvar.get", "name": "A32NX_FCU_ALT_MANAGED" }

// Write LVar
{ "command": "lvar.set", "name": "A32NX_FCU_ALT_MANAGED", "value": 1 }

// Execute H:event
{ "command": "hvar", "name": "A320_Neo_FCU_HDG_PUSH" }
```

### Events Database
```
Location: C:\FSUIPC7\events.txt
Lines: 22,359 events
Format: EventName#RPN_Script
```

### Aircraft-Specific Files
```
C:\FSUIPC7\EventFiles\
├── flybywire-aircraft-a320-neo.evt
├── pmdg-737-*.evt
└── workingtitle-aircraft-cj4.evt

C:\FSUIPC7\HvarFiles\
└── A32NX FBW.hvar (222 H:variables)
```

---

## 3. Little Navmap Web API

### Connection Details
```
URL: http://localhost:8965/api
Spec: OpenAPI 3.0 (webapi.yaml - 726 lines)
```

### Key Endpoints

#### Airport Info
```http
GET /api/airport/info?ident=KJFK
```

#### Map Image
```http
GET /api/map/image?toplat=40&bottomlat=39&leftlon=-75&rightlon=-74&width=512&height=512
```

#### Sim Info
```http
GET /api/sim/info
Response: { connected, aircraft, position, ... }
```

#### User Aircraft
```http
GET /api/sim/aircraft
```

### Full API Spec
```
C:\Program Files\Little Navmap\web\webapi.yaml
```

---

## 4. MobiFlight Connector

### HubHop Presets Database
```
Location: C:\Users\hjhar\AppData\Local\MobiFlight\MobiFlight Connector\Presets\
File: msfs2020_hubhop_presets.json (16MB, ~50,000+ presets)
```

### Preset Structure
```json
{
  "id": "uuid",
  "path": "Vendor.Aircraft.System.Label",
  "vendor": "Microsoft",
  "aircraft": "Generic", 
  "system": "Avionics",
  "label": "AS1000_PFD_VOL_1_DEC",
  "code": "(>H:AS1000_PFD_VOL_1_DEC)",
  "presetType": "Input",
  "description": "Garmin G1000"
}
```

### Other Preset Files
```
msfs2020_eventids.cip       # Core MSFS events
msfs2020_simvars.cip        # SimVar definitions
presets_eventids_pmdg_*.cip # PMDG-specific
```

---

## 5. Stream Deck Integration

### Lorby AAO Plugin
```
Location: C:\Users\hjhar\AppData\Roaming\Elgato\StreamDeck\Plugins\com.lorbysi.aao.sdPlugin\
Key Files:
├── js/main.js       # WebSocket to Stream Deck
├── js/aaoDeck.js    # Action handlers (1215 lines)
└── settings.js      # AAO_URL = "http://localhost:43380/webapi"
```

### PilotsDeck Plugin
```
Location: com.extension.pilotsdeck.sdPlugin
```

---

## 6. Third-Party Addon APIs

### SayIntentions AI
```
Location: C:\Users\hjhar\AppData\Roaming\SayIntentionsAI\
Features:
- SimConnect integration (Microsoft.FlightSimulator.SimConnect.dll)
- Deepgram speech recognition
- AWS Transcribe support
- Azure Cognitive Services
```

### GSX Pro (Virtuali)
```
Location: C:\Users\hjhar\AppData\Roaming\Virtuali\
Key LVar: FSDT_GSX_PUSHBACK_STATUS
Files:
├── Airplanes/        # Aircraft configs
├── GSX/              # Ground service models
└── GSXLiveryManager/ # Livery management
```

### SimAppPro (WinWing)
```
Location: C:\Users\hjhar\AppData\Roaming\SimAppPro\
Features:
- vJoy integration
- Device calibration
- Game preset management
- MCDU/MFD displays
```

### FlightControlReplay V5
```
Location: C:\Users\hjhar\AppData\Roaming\FlightControlReplay V5 for MSFS P3D\
Key File: FSXEventIDString.xml (SimConnect events)
```

---

## 7. MSFS 2024 SDK Resources

### SimConnect Header
```
Location: C:\MSFS 2024 SDK\SimConnect SDK\include\SimConnect.h
Lines: 1018
Key Enums:
- SIMCONNECT_RECV_ID_*    (40+ receive types)
- SIMCONNECT_DATATYPE_*   (18 data types)
- SIMCONNECT_EXCEPTION_*  (40+ error codes)
```

### WASM SDK
```
Location: C:\MSFS 2024 SDK\WASM\
For: In-sim gauge development
```

### Model Behaviors
```
Location: C:\MSFS 2024 SDK\ModelBehaviorDefs\
├── Asobo/        # Default aircraft behaviors
├── WorkingTitle/ # G1000/G3000 behaviors
└── Localization/ # Text resources
```

---

## 8. Fenix A320

### Installation
```
Location: C:\Program Files\FenixSim A320\
Components:
├── Fenix.exe          # Main app
├── deps/FenixCDU.exe  # CDU display
├── deps/FenixSystem.exe
└── EFB/efb.bin        # Electronic Flight Bag
```

### App Data
```
Location: C:\Users\hjhar\AppData\Local\FenixApp\
```

---

## 9. Key LVar/HVar References

### From Lorby lvarscan.csv (708 LVars)
```
L:FSDT_GSX_PUSHBACK_STATUS      # GSX pushback
L:p42_cp_*                       # ChasePlane camera (if installed)
L:A32NX_*                        # FlyByWire A320
L:WT_*                           # Working Title
```

### From FSUIPC H:var Files
```
H:A320_Neo_FCU_HDG_PUSH
H:A320_Neo_FCU_SPEED_INC
H:A32NX_EFIS_L_CHRONO_PUSHED
```

### Common K: Events
```
K:TOGGLE_NAV_LIGHTS
K:AP_MASTER
K:HEADING_BUG_INC
K:FLAPS_INCR
```

---

## 10. Integration Priority Matrix

| Integration | Effort | Value | Priority |
|-------------|--------|-------|----------|
| Lorby AAO WebAPI | Low | High | ⭐⭐⭐ |
| FSUIPC WebSocket | Medium | High | ⭐⭐⭐ |
| MobiFlight HubHop | Low | High | ⭐⭐⭐ |
| Little Navmap API | Low | Medium | ⭐⭐ |
| GSX LVars | Low | Medium | ⭐⭐ |
| SimAppPro Events | Medium | Low | ⭐ |

---

## 11. Code Examples

### Lorby AAO Connection Test
```javascript
async function testLorbyAAO() {
    const response = await fetch('http://localhost:43380/webapi?conn=1');
    const result = await response.text();
    return result === 'OK';
}
```

### FSUIPC WebSocket Client
```javascript
const ws = new WebSocket('ws://localhost:2048');
ws.onopen = () => {
    ws.send(JSON.stringify({
        command: 'subscribe',
        name: 'PLANE ALTITUDE',
        unit: 'feet'
    }));
};
```

### MobiFlight Preset Lookup
```javascript
const presets = require('./msfs2020_hubhop_presets.json');
const a320Events = presets.filter(p => 
    p.aircraft === 'A320' || p.path.includes('A32NX')
);
```

---

## Files Created/Updated

| File | Action |
|------|--------|
| `docs/RESOURCES.md` | **Created** - This comprehensive API reference |

