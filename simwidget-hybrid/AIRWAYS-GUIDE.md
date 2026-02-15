# GTN750 Airways Guide

**Status**: ✅ FULLY IMPLEMENTED
**Version**: GTN750 v3.0+
**Date**: February 14, 2026

## Overview

The GTN750 includes complete airways support for Victor (low altitude) and Jet (high altitude) routes using real FAA CIFP navigation data.

## Features

### ✈️ Airways Database
- **13,000+ airways** from FAA CIFP data (AIRAC cycle)
- **Victor routes** (low altitude, < 18,000 ft)
- **Jet routes** (high altitude, ≥ 18,000 ft)
- **MEA data** (Minimum Enroute Altitude)
- **Bidirectional traversal** (can fly airways in either direction)

### 🗺️ Map Display
- Airways rendered as **dashed light blue lines**
- **Airway labels** at segment midpoints
- **Auto-refresh** - Nearby airways fetched every 15 seconds
- **Declutter support** - Hidden at high zoom levels (2+)

### 🎯 Smart Suggestions
When inserting an airway between two waypoints, the GTN750 automatically:
- Searches for airways connecting both waypoints
- Displays **MEA** (Minimum Enroute Altitude)
- Shows **distance** and **fix count**
- Sorts by **shortest distance** first

### 📍 Waypoint Integration
- Airway identifier stored on each waypoint (`wp.airway`)
- Displays as **"FIX via V2"** in flight plan
- Altitude restrictions (MEA) preserved
- Smart waypoint sequencing

## How to Use Airways

### Method 1: Insert Between Existing Waypoints

**Prerequisites**: Have at least 2 waypoints in your flight plan

**Steps**:
1. Press **FPL** page button
2. Click on a waypoint to select it (cursor highlights waypoint)
3. Press **AWY** soft key (bottom row, 2nd button)
4. GTN750 shows **suggested airways** connecting selected waypoint to next waypoint
5. Click a suggestion to auto-insert, or manually enter:
   - **Airway ID** (e.g., V2, J45, Q100)
   - **Entry Fix** (already filled)
   - **Exit Fix** (already filled)
6. Press **INSERT** button

**Example**:
```
Flight Plan: KSEA → KPDX
1. Select KSEA
2. Press AWY
3. GTN750 suggests: "V2 - 3 fixes • MEA 5,000 ft • 121 nm"
4. Click V2 suggestion
5. Airway inserted: KSEA → SEA → BTG → KPDX
```

### Method 2: Manual Airway Entry

**Steps**:
1. Press **FPL** page
2. Select any waypoint
3. Press **AWY** soft key
4. Manually enter:
   - **Airway**: V4, J146, Q100, etc.
   - **Entry Fix**: Starting waypoint identifier
   - **Exit Fix**: Ending waypoint identifier
5. Press **INSERT**

**Example**:
```
Airway: V23
Entry:  RADDY
Exit:   HAWKZ

Result: All fixes between RADDY and HAWKZ on V23 inserted
```

### Method 3: Airway Notation (Future)

**Planned syntax** (not yet implemented):
```
KSEA..V2..KPDX        # Via Victor 2
KDEN..J45..KSFO       # Via Jet 45
KBOS..V3..KEWR..J75..KATL  # Multiple airways
```

## Airways on Map

### Viewing Airways
Airways are automatically displayed on the map when:
- Within **200nm** of aircraft position
- Zoom level **< 50nm** range
- Declutter level **< 2**

### Visual Indicators
- **Dashed blue lines** - Airway routes
- **Airway labels** - ID displayed at midpoints (V2, J45, etc.)
- **Flight plan airways** - Solid magenta line with airway name

### Toggle Airways Display
```javascript
// Enable/disable airways on map
window.widget.toggleAirways()
```

## API Reference

### Backend Endpoints

```http
GET /api/navdb/airway/:ident
```
**Parameters**:
- `ident` - Airway identifier (V2, J45, Q100)
- `entry` (optional) - Entry fix identifier
- `exit` (optional) - Exit fix identifier

**Response**:
```json
{
  "ident": "V2",
  "route_type": "LOW",
  "entry": "SEA",
  "exit": "BTG",
  "fixes": [
    { "ident": "SEA", "lat": 47.449, "lon": -122.309, "min_alt": 5000, "max_alt": 17999 },
    { "ident": "OLM", "lat": 46.973, "lon": -122.902, "min_alt": 5000, "max_alt": 17999 },
    { "ident": "BTG", "lat": 46.093, "lon": -123.006, "min_alt": 5000, "max_alt": 17999 }
  ],
  "source": "navdb"
}
```

```http
GET /api/navdb/nearby/airways?lat={lat}&lon={lon}&range={nm}&limit={n}
```
**Parameters**:
- `lat` - Latitude (decimal degrees)
- `lon` - Longitude (decimal degrees)
- `range` - Search radius in nm (default: 100)
- `limit` - Max results (default: 20)

**Response**:
```json
{
  "items": [
    { "ident": "V2", "type": "LOW", "distance_nm": 15.3 },
    { "ident": "J45", "type": "HIGH", "distance_nm": 45.7 }
  ],
  "count": 2
}
```

### JavaScript API

```javascript
// Insert airway into flight plan
await flightPlanManager.insertAirway('V2', 'SEA', 'BTG');

// Show airways modal
flightPlanManager.showAirwaysModal({
  selectedWp: { ident: 'KSEA', lat: 47.449, lon: -122.309 },
  nextWp: { ident: 'KPDX', lat: 45.588, lon: -122.598 },
  lat: 47.449,
  lon: -122.309
});

// Find connecting airways
await flightPlanManager.findConnectingAirways(entryWp, exitWp, lat, lon);
```

## Common Airways

### West Coast (USA)
| Airway | Type | Route | MEA |
|--------|------|-------|-----|
| **V2** | Victor | KSEA-KPDX-KSFO | 5,000+ |
| **V23** | Victor | KSFO-KLAX-KSAN | 4,000+ |
| **J45** | Jet | KSEA-KSLC-KDEN | 18,000+ |
| **J100** | Jet | KSFO-KLAS-KPHX | 18,000+ |

### East Coast (USA)
| Airway | Type | Route | MEA |
|--------|------|-------|-----|
| **V3** | Victor | KBOS-KJFK-KDCA | 3,000+ |
| **V39** | Victor | KATL-KMCO-KMIA | 2,000+ |
| **J75** | Jet | KBOS-KEWR-KATL | 18,000+ |
| **J174** | Jet | KORD-KCLE-KEWR | 18,000+ |

### Central (USA)
| Airway | Type | Route | MEA |
|--------|------|-------|-----|
| **V4** | Victor | KDEN-KICT-KSTL | 8,000+ |
| **V8** | Victor | KPHX-KABQ-KDFW | 9,000+ |
| **J146** | Jet | KDEN-KDFW-KHOU | 18,000+ |

## Troubleshooting

### "No airways found nearby"
**Cause**: Not in range of any airways
**Solution**: Airways are centered on US airspace. Try a position near a major airport.

### "No airways connect these waypoints"
**Cause**: Waypoints are not on a common airway
**Solution**:
- Check that both waypoints are valid fixes on airways
- Try intermediate waypoints
- Use multiple airways (FIX1..AWY1..FIX2..AWY2..FIX3)

### Airways not displaying on map
**Cause**: Zoom level too high or airways disabled
**Solution**:
- Zoom out to < 50nm range
- Check declutter level (should be < 2)
- Toggle airways: `window.widget.toggleAirways()`

### Airway waypoints have wrong altitude
**Cause**: MEA is minimum, not assigned altitude
**Solution**: Manually set altitude constraints in flight plan. MEA is a restriction, not a flight level assignment.

## Examples

### Example 1: Seattle to Portland via V2

**Flight Plan**:
```
KSEA → KPDX (direct: 121 nm)
```

**Add Airway**:
1. FPL page → Select KSEA
2. Press AWY
3. Select "V2" from suggestions
4. Result: KSEA → SEA → OLM → BTG → KPDX (3 airway fixes inserted)

**Benefits**:
- Follows published route
- MEA guidance (5,000 ft minimum)
- ATC-friendly routing

### Example 2: Denver to Dallas via J146

**Flight Plan**:
```
KDEN → KDFW (direct: 582 nm)
```

**Add Airway**:
1. FPL page → Select KDEN
2. Press AWY
3. Manually enter:
   - Airway: J146
   - Entry: DEN
   - Exit: UKW (Purcell VOR)
4. Press INSERT
5. Result: KDEN → DEN → ALS → TCC → UKW → KDFW

**Benefits**:
- High altitude routing (18,000+ ft)
- Published jet route
- Waypoints with navaid references

### Example 3: Cross-country with Multiple Airways

**Route**: KSFO → KLAS → KDEN → KORD

**Method**:
1. Add waypoints: KSFO, KLAS, KDEN, KORD
2. Select KSFO → Press AWY → Insert J100 to KLAS
3. Select KLAS → Press AWY → Insert J4 to KDEN
4. Select KDEN → Press AWY → Insert J94 to KORD

**Result**: Complete cross-country routing on published airways

## Tips & Best Practices

### ✅ DO
- Use airways for IFR flight planning
- Check MEA before setting cruise altitude
- Verify airway is appropriate for your altitude (Victor < 18,000, Jet ≥ 18,000)
- Use smart suggestions - GTN750 finds the best routes
- Check airway on map before inserting

### ❌ DON'T
- Don't use high-altitude (J) airways below 18,000 ft
- Don't ignore MEA restrictions
- Don't mix incompatible airway types without transition fixes
- Don't delete individual airway waypoints - remove the whole airway segment

### 🎯 Pro Tips
1. **Use NRST to find fixes** - Find nearby VORs/NDBs to use as entry/exit points
2. **Airways auto-update** - Map shows nearby airways automatically, no refresh needed
3. **MEA is minimum** - Always fly at or above MEA, but you can fly higher
4. **Declutter smartly** - Airways hidden at high declutter to reduce map clutter
5. **Check chart** - Cross-reference with IFR enroute charts for accuracy

## Known Limitations

1. **No automatic airway continuation** - Must manually connect multiple airways
2. **No SID/STAR integration** - Airways must be added separately from procedures
3. **MEA only** - No MOCA, MAA, or other altitude data
4. **US-centric** - FAA CIFP data covers primarily US airspace
5. **28-day cycle** - AIRAC data needs periodic updates (manual)

## Future Enhancements

**Planned**:
- [ ] Airway notation parsing ("KSEA..V2..KPDX" format)
- [ ] Auto-connect airways (if exit of AWY1 = entry of AWY2)
- [ ] SID/STAR integration with airways
- [ ] MOCA/MAA altitude data
- [ ] International airways (ICAO data)
- [ ] Airway conflict warnings (altitude, direction)
- [ ] Preferred routes database

## Technical Details

### Database Schema
```sql
CREATE TABLE airways (
    id INTEGER PRIMARY KEY,
    ident TEXT NOT NULL,         -- V2, J45, Q100
    seq INTEGER NOT NULL,          -- Waypoint sequence number
    fix_ident TEXT NOT NULL,       -- Waypoint identifier
    fix_lat REAL,                  -- Latitude (degrees)
    fix_lon REAL,                  -- Longitude (degrees)
    route_type TEXT,               -- LOW, HIGH, BOTH
    min_alt INTEGER,               -- MEA in feet
    max_alt INTEGER,               -- Maximum altitude
    direction TEXT                 -- FORWARD, BACKWARD, BOTH
);
```

### Data Source
- **FAA CIFP** - Coded Instrument Flight Procedures
- **Format**: ARINC 424 (fixed-width text)
- **Record Type**: ER (Enroute Airway)
- **Update Frequency**: 28-day AIRAC cycle
- **Coverage**: ~13,000 airways in US airspace

### File Locations
- **Database**: `backend/data/navdb.sqlite`
- **API**: `backend/navdata-api.js` (lines 438-492)
- **Flight Plan**: `ui/gtn750/modules/gtn-flight-plan.js` (lines 1097-1420)
- **Map Renderer**: `ui/gtn750/modules/gtn-map-renderer.js` (lines 1245-1330)
- **Soft Keys**: `ui/gtn750/modules/gtn-softkeys.js` (lines 90-97)

## Version History

**v3.0.0** (Feb 2026) - Airways Implementation
- ✅ Backend API for airway queries
- ✅ Flight plan integration (insertAirway method)
- ✅ Smart suggestions (findConnectingAirways)
- ✅ Map display (renderAirways)
- ✅ AWY soft key on FPL page
- ✅ MEA data display
- ✅ Bidirectional traversal

**v2.6.0** (Feb 2026) - Procedures Update
- Backend infrastructure for airways
- Database schema created
- API endpoints added

## Support

**Issues**: Report at https://github.com/cobrahjh/LLM-DevOSWE/issues
**Documentation**: See GTN750 README.md
**Test URL**: http://192.168.1.42:8080/ui/gtn750/

---

**Happy flying with airways!** ✈️
