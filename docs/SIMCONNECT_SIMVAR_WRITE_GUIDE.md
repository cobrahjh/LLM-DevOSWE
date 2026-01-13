# SimConnect SimVar Write Guide v1.0.0
**Last Updated: 2025-01-07**

## Overview
This document captures the complete troubleshooting process for writing SimVar values via node-simconnect. Use this as a reference to avoid repeating debugging cycles.

---

## Quick Reference: Working Code Pattern

```javascript
const { RawBuffer } = require('node-simconnect');

// 1. Register writable data definition (during SimConnect init)
handle.addToDataDefinition(
    defId,                          // Unique definition ID (1, 2, 3...)
    'FUEL TANK LEFT MAIN LEVEL',    // SimVar name
    'Percent Over 100',             // Units (CRITICAL: not 'Percent')
    SimConnectDataType.FLOAT64,     // Data type
    0                               // Epsilon
);

// 2. Create data packet for writing
const rawBuffer = new RawBuffer(8);           // 8 bytes for FLOAT64
rawBuffer.writeFloat64(0.75);                 // Value in correct units

const dataPacket = {
    tagged: false,
    arrayCount: 0,
    buffer: rawBuffer
};

// 3. Write to SimConnect
simConnectConnection.setDataOnSimObject(defId, 0, dataPacket);
//                                      ^      ^  ^
//                                      |      |  └─ Data packet (NOT RawBuffer directly!)
//                                      |      └─ Object ID (0 = user aircraft)
//                                      └─ Definition ID
```

---

## Critical Lessons Learned

### Issue #1: Wrong Units
| ❌ WRONG | ✅ CORRECT |
|----------|------------|
| `'Percent'` | `'Percent Over 100'` |
| Values 0-100 | Values 0.0-1.0 |

**Symptom**: SimVar reads correctly but writes have no effect or wrong values.

**Fix**: Use `'Percent Over 100'` units and convert UI percentages:
```javascript
const percentOver100 = uiPercent / 100;  // 75% → 0.75
```

### Issue #2: Wrong API Signature
| ❌ WRONG | ✅ CORRECT |
|----------|------------|
| `setDataOnSimObject(defId, objId, 0, 0, buffer)` | `setDataOnSimObject(defId, objId, dataPacket)` |
| 5 parameters | 3 parameters |

**Symptom**: `buffer.getBuffer is not a function` error

**Fix**: Wrap RawBuffer in data packet object:
```javascript
const dataPacket = {
    tagged: false,
    arrayCount: 0,
    buffer: rawBuffer  // RawBuffer instance goes here
};
```

### Issue #3: Data Packet Structure
The node-simconnect `setDataOnSimObject` expects this exact structure:

```javascript
{
    tagged: boolean,      // false for most cases
    arrayCount: number,   // 0 for single values
    buffer: RawBuffer     // The actual data buffer
}
```

**How we discovered this**: Inspected the API source code:
```javascript
node -e "const sc = require('node-simconnect'); 
console.log(sc.SimConnectConnection.prototype.setDataOnSimObject.toString());"
```

---

## Testing Checklist

### Before Writing SimVars
- [ ] Verify SimVar name is spelled correctly (check SDK docs)
- [ ] Verify units match SDK documentation
- [ ] Use separate definition IDs for read vs write operations
- [ ] Confirm SimConnect connection is established

### Debug Commands

**Check RawBuffer works:**
```powershell
cd C:\LLM-DevOSWE\SimWidget_Engine\server
node -e "const { RawBuffer } = require('node-simconnect'); const rb = new RawBuffer(8); rb.writeFloat64(0.5); console.log('Buffer:', rb.getBuffer());"
```

**Check API signature:**
```powershell
node -e "const sc = require('node-simconnect'); console.log(sc.SimConnectConnection.prototype.setDataOnSimObject.toString());"
```

**Check available SimConnect exports:**
```powershell
node -e "console.log(Object.keys(require('node-simconnect')))"
```

---

## Fuel Tank SimVars Reference

### Tank Names & Definition IDs
| Tank Key | SimVar Name | Def ID |
|----------|-------------|--------|
| LeftMain | FUEL TANK LEFT MAIN LEVEL | 1 |
| RightMain | FUEL TANK RIGHT MAIN LEVEL | 2 |
| LeftAux | FUEL TANK LEFT AUX LEVEL | 3 |
| RightAux | FUEL TANK RIGHT AUX LEVEL | 4 |
| Center | FUEL TANK CENTER LEVEL | 5 |
| Center2 | FUEL TANK CENTER2 LEVEL | 6 |
| Center3 | FUEL TANK CENTER3 LEVEL | 7 |
| LeftTip | FUEL TANK LEFT TIP LEVEL | 8 |
| RightTip | FUEL TANK RIGHT TIP LEVEL | 9 |
| External1 | FUEL TANK EXTERNAL1 LEVEL | 10 |
| External2 | FUEL TANK EXTERNAL2 LEVEL | 11 |

### Units
| SimVar Type | Units | Value Range |
|-------------|-------|-------------|
| Tank Level | Percent Over 100 | 0.0 - 1.0 |
| Quantity | Gallons | 0 - capacity |
| Capacity | Gallons | Read-only |
| Flow Rate | Gallons per hour | Read-only |

---

## Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `buffer.getBuffer is not a function` | Passing RawBuffer directly | Wrap in `{ tagged, arrayCount, buffer }` object |
| No effect on SimVar | Wrong units | Use `'Percent Over 100'` not `'Percent'` |
| `EADDRINUSE` | Port conflict | Kill all node.exe and restart |
| `Unknown SimVar` | Typo in name | Check SDK docs for exact spelling |
| Value jumps back | SimConnect override | Use writable SimVar variant |

---

## SDK Documentation Links

- **MSFS SDK Home**: https://docs.flightsimulator.com/html/Introduction/Introduction.htm
- **Fuel SimVars**: https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_Fuel_Variables.htm
- **SimConnect Reference**: https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm

---

## Process Flow: Adding New Writable SimVar

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RESEARCH                                                 │
│    - Find SimVar in SDK docs                                │
│    - Note exact name, units, and data type                  │
│    - Check if SimVar is writable                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. REGISTER DEFINITION                                      │
│    handle.addToDataDefinition(                              │
│        uniqueDefId,           // Don't reuse existing IDs   │
│        'SIMVAR NAME',         // Exact spelling from SDK    │
│        'Correct Units',       // Match SDK documentation    │
│        SimConnectDataType.X,  // FLOAT64, INT32, etc.       │
│        0                      // Epsilon                    │
│    );                                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CREATE WRITE FUNCTION                                    │
│    function writeSimVar(value) {                            │
│        const rawBuffer = new RawBuffer(8);                  │
│        rawBuffer.writeFloat64(convertedValue);              │
│        const dataPacket = {                                 │
│            tagged: false,                                   │
│            arrayCount: 0,                                   │
│            buffer: rawBuffer                                │
│        };                                                   │
│        simConnectConnection.setDataOnSimObject(             │
│            defId, 0, dataPacket                             │
│        );                                                   │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. TEST                                                     │
│    - Check server logs for errors                           │
│    - Verify value changes in simulator                      │
│    - Test edge cases (0, max, negative)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. DEBUG (if needed)                                        │
│    - Check units match SDK                                  │
│    - Verify data packet structure                           │
│    - Inspect API with console.log                           │
│    - Compare with working code pattern above                │
└─────────────────────────────────────────────────────────────┘
```

---

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-07 | Initial guide from fuel widget debugging session |
