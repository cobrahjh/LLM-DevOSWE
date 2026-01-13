# SimWidget Engine - Resources & Integration Discovery
**Version:** 1.0.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\RESOURCES-DISCOVERY.md`

---

## 1. Discovered Resources Summary

### MSFS 2024 SDK
| Resource | Path | Notes |
|----------|------|-------|
| **SimConnect.h** | `C:\MSFS 2024 SDK\SimConnect SDK\include\SimConnect.h` | 1018 lines - all enums, structs, data types |
| **SimConnect.dll** | `C:\MSFS 2024 SDK\SimConnect SDK\lib\` | Native library |
| **WASM SDK** | `C:\MSFS 2024 SDK\WASM\` | For in-sim modules |
| **Model Behaviors** | `C:\MSFS 2024 SDK\ModelBehaviorDefs\` | Asobo, WorkingTitle templates |

### FSUIPC7
| Resource | Path | Notes |
|----------|------|-------|
| **Events Database** | `C:\FSUIPC7\events.txt` | **22,359 lines** of L:var/H:var scripts |
| **WebSocket Server** | `localhost:2048` | Real-time SimVar access |
| **Aircraft Events** | `C:\FSUIPC7\EventFiles\` | FBW A320, WT CJ4, etc. |
| **H:Var Files** | `C:\FSUIPC7\HvarFiles\` | 222 A32NX H:vars |
| **Python SDK** | `C:\FSUIPC7\SDK\UIPC_SDK_Python.zip` | For Python integration |

### Lorby Axis & Ohs
| Resource | Path | Notes |
|----------|------|-------|
| **Web API** | `http://localhost:43380/webapi` | REST API |
| **WASM Hooks** | `C:\Program Files\LorbyAxisAndOhs_MSFS24\lorbysi-content-hooks\` | LVar read/write |
| **Gauge XMLs** | `C:\Program Files\LorbyAxisAndOhs_MSFS24\LorbyGauges\Gauges\` | Radio, gauge patterns |
| **Stream Deck Plugin** | `C:\Users\hjhar\AppData\Roaming\Elgato\StreamDeck\Plugins\com.lorbysi.aao.sdPlugin\` | WebSocket code |

### Fenix A320
| Resource | Path | Notes |
|----------|------|-------|
| **Main Exe** | `C:\Program Files\FenixSim A320\Fenix.exe` | .NET 4.8 app |
| **CDU App** | `C:\Program Files\FenixSim A320\deps\FenixCDU.exe` | Separate process |
| **Engine Data** | `C:\Program Files\FenixSim A320\deps\CFM565B*.bin` | Engine models |

### FS First Officer V6
| Resource | Path | Notes |
|----------|------|-------|
| **FSUIPC Client** | `fsuipcClient.dll` | Pre-built FSUIPC integration |
| **WAPID** | `FSUIPC_WAPID.dll` | WASM-FSUIPC bridge |
| **Vosk** | `libvosk.dll` | Offline speech recognition |
| **NavData** | `C:\Program Files\Flight Simulator First Officer V6\NavData\` | Airports, runways |

### Little Navmap
| Resource | Path | Notes |
|----------|------|-------|
| **Web API** | `http://localhost:8965/api` | OpenAPI 3.0 spec |
| **API Spec** | `C:\Program Files\Little Navmap\web\webapi.yaml` | 726 lines |
| **SimConnect DLLs** | `SimConnect_msfs_2020.dll`, `SimConnect_msfs_2024.dll` | Both versions |
| **Navigraph DB** | `C:\Program Files\Little Navmap\little_navmap_db\little_navmap_navigraph.sqlite` | Nav database |

### Navigraph Simlink
| Resource | Path | Notes |
|----------|------|-------|
| **WebSocket** | Uses `Qt5WebSockets.dll` | Real-time data |
| **Sim Server** | `sim.server` | Config file |

---

## 2. Sanity Check Results

### ✅ What We Have

| Component | Status | Path |
|-----------|--------|------|
| Device ID (UUID) | ✅ Implemented | `simwidget-hybrid/ui/shared/device-id.js` |
| Capability Detection | ✅ Implemented | `simwidget-hybrid/ui/shared/capability-detect.js` |
| Telemetry Design | ✅ Documented | `docs/TELEMETRY-DESIGN.md` |
| Platform Tracking | ✅ Implemented | desktop, mobile, msfs-panel, electron |
| Supabase Plan | ✅ Documented | Cloud hosting recommended |

### ⚠️ Missing/TODO

| Component | Status | Notes |
|-----------|--------|-------|
| Flow Pro DLLs | ❌ Not found | Flow Pro not installed |
| ChasePlane | ❌ Not installed | Only manager in Downloads |
| DLL Inspector | 🔶 Basic | Node.js PE parser exists, needs expansion |
| TinyWidgets | ❌ Not started | Single-function wheel widgets |
| Supabase Backend | ❌ Not implemented | Design exists, needs setup |

### Platform Limitations Matrix

| Feature | Desktop | Mobile | MSFS Panel | Electron |
|---------|---------|--------|------------|----------|
| localStorage | ✅ | ✅ | ❌ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| File Download | ✅ | ⚠️ | ❌ | ✅ |
| Notifications | ✅ | ⚠️ | ❌ | ✅ |
| Keyboard Shortcuts | ✅ | ❌ | ✅ | ✅ |
| Touch Input | ⚠️ | ✅ | ❌ | ⚠️ |
| Gamepad API | ✅ | ❌ | ❌ | ✅ |
| External Links | ✅ | ✅ | ❌ | ⚠️ |

---

## 3. DLL Inspection Capabilities

### What We Can Extract

**From SimConnect.h (already available):**
- All data types (`SIMCONNECT_DATATYPE_*`)
- Exception codes (`SIMCONNECT_EXCEPTION_*`)
- Receive IDs (`SIMCONNECT_RECV_ID_*`)
- Struct definitions (`SIMCONNECT_DATA_*`)
- Constants and limits

**From PE/DLL Analysis (possible with tools):**
- Exported function names
- Function signatures (partial)
- String constants
- Version info

**Tools for DLL Inspection:**
```javascript
// Node.js PE parser (already mentioned in TODO)
const pe = require('pe-parser');

async function inspectDLL(path) {
    const dll = await pe.parse(path);
    return {
        exports: dll.exports,
        imports: dll.imports,
        resources: dll.resources
    };
}
```

### DLLs Worth Inspecting

| DLL | Location | Potential Value |
|-----|----------|-----------------|
| `SimConnect.dll` | MSFS SDK | Full API exports |
| `fsuipcClient.dll` | FS First Officer | FSUIPC wrapper patterns |
| `NavigraphSimDetect.dll` | Navigraph | Sim detection logic |
| `LorbyLVarHookWASM.wasm` | Lorby AAO | LVAR access methods |

---

## 4. TinyWidgets Concept

### Single-Function Wheel Widgets

```javascript
// TinyWidget structure
const TinyWidget = {
    id: 'lights-nav-toggle',
    name: 'Nav Lights',
    icon: '💡',
    category: 'lights',
    action: {
        type: 'simvar',
        event: 'K:TOGGLE_NAV_LIGHTS',
        value: 1
    },
    state: {
        var: 'A:LIGHT NAV',
        unit: 'Bool'
    }
};
```

### Wheel Categories
- **Lights** (12 widgets): Nav, Beacon, Strobe, Landing, Taxi, Logo, Wing, etc.
- **Cameras** (6 widgets): Cinematic Toggle, Next View, External, Cockpit, etc.
- **Autopilot** (8 widgets): AP Master, HDG Hold, ALT Hold, NAV, APR, etc.
- **Engine** (6 widgets): Engine Start, Mixture Rich/Lean, Prop High/Low
- **Controls** (8 widgets): Gear, Flaps +/-, Spoilers, Parking Brake

### Dynamic Wheel Loading
```javascript
class WheelManager {
    constructor() {
        this.widgets = new Map();
        this.categories = new Map();
    }
    
    loadCategory(category) {
        return Array.from(this.widgets.values())
            .filter(w => w.category === category);
    }
    
    executeWidget(id) {
        const widget = this.widgets.get(id);
        if (widget) {
            return this.executeAction(widget.action);
        }
    }
}
```

---

## 5. Integration APIs Available

| Service | Port | Protocol | Auth |
|---------|------|----------|------|
| SimWidget Server | 8080 | HTTP/WS | None |
| FSUIPC WebSocket | 2048 | WS | None |
| Lorby AAO | 43380 | HTTP | None |
| ChasePlane | 8652 | HTTP | None |
| Little Navmap | 8965 | HTTP | None |
| Navigraph Simlink | TBD | WS | OAuth |

---

## 6. Recommended Next Steps

### High Priority
1. **Parse FSUIPC events.txt** → Create searchable SimVar database
2. **Extract Lorby AAO patterns** → Port gauge logic
3. **Implement TinyWidgets** → Start with lights category

### Medium Priority
4. **Setup Supabase** → Anonymous telemetry collection
5. **DLL Inspector expansion** → Extract more function signatures
6. **Little Navmap integration** → Airport/navdata access

### Low Priority
7. **ChasePlane reinstall** → Test camera API when needed
8. **Fenix A320 research** → Custom LVAR patterns
9. **FS First Officer patterns** → Voice command integration

---

## 7. Files Created/Updated

| File | Action |
|------|--------|
| `docs/RESOURCES-DISCOVERY.md` | **Created** - This file |

