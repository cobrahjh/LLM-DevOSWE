# GTN750 User Waypoints Guide

**Status**: ✅ FULLY IMPLEMENTED
**Version**: GTN750 v3.0+
**Date**: February 14, 2026

## Overview

The GTN750 includes complete user waypoint management for creating, storing, and navigating custom waypoints. Perfect for VFR reporting points, practice areas, private strips, and points of interest.

## Features

### ✈️ Waypoint Management
- **Create Waypoints** - Custom navigation points with names and coordinates
- **5 Categories** - VRP, POI, PVT, PRC, WPT with color-coded icons
- **500 Waypoint Limit** - Store up to 500 custom waypoints
- **localStorage Persistence** - Waypoints saved automatically
- **Search & Nearest** - Find waypoints by name or proximity
- **Import/Export** - GPX and CSV file format support

### 📊 Waypoint Categories

| Category | Icon | Color | Description |
|----------|------|-------|-------------|
| **VRP** | ▲ | Cyan | VFR Reporting Point |
| **POI** | ★ | Yellow | Point of Interest |
| **PVT** | ⊕ | Orange | Private Strip |
| **PRC** | ○ | Green | Practice Area |
| **WPT** | ● | White | General Waypoint |

---

## How User Waypoints Work

### Creating a Waypoint

User waypoints require:
1. **Identifier** - 3-5 alphanumeric characters (e.g., "LAKE1", "VRP01")
2. **Coordinates** - Latitude and longitude (decimal degrees)
3. **Category** - One of the 5 categories (default: WPT)
4. **Name** - Optional descriptive name (default: identifier)
5. **Notes** - Optional notes or description

**Example**:
```javascript
{
    ident: "LAKE1",
    name: "Big Lake Reporting Point",
    lat: 40.5678,
    lon: -105.1234,
    category: "VRP",
    notes: "Report position 2nm north of lake"
}
```

### Storage and Persistence

Waypoints are stored in browser localStorage:
- **Storage Key**: `gtn750-user-waypoints`
- **Auto-save**: Enabled (saves after every create/update/delete)
- **Data Format**: JSON with version number
- **Persistence**: Survives browser restarts, cleared if localStorage cleared

---

## Usage

### Method 1: Create from Current Position

**Quick Save Your Position**:
1. Press **USER WPT** soft key (on MAP or FPL page)
2. GTN750 pre-fills current latitude/longitude
3. Enter identifier (e.g., `HOME1`)
4. Optionally add name and notes
5. Select category
6. Press **SAVE**
7. Waypoint created and displayed on map

### Method 2: Manual Entry

**Create Waypoint by Coordinates**:
1. Press **USER WPT** soft key
2. Select **CREATE NEW**
3. Enter identifier: `PARK1`
4. Enter latitude: `40.5678`
5. Enter longitude: `-105.1234`
6. Enter name: `Airport Parking`
7. Select category: `POI`
8. Add notes: `Free parking near terminal`
9. Press **SAVE**

### Method 3: Import from GPX

**Import Waypoints from GPS**:
1. Export waypoints from GPS device as GPX file
2. Press **USER WPT** soft key
3. Select **IMPORT**
4. Choose **GPX Format**
5. Select file or paste GPX data
6. GTN750 parses waypoints and imports
7. Shows import summary (imported/skipped)

### Method 4: Import from CSV

**Bulk Import from Spreadsheet**:
1. Create CSV with columns: Identifier, Name, Latitude, Longitude, Category, Notes
2. Press **USER WPT** soft key
3. Select **IMPORT** → **CSV Format**
4. Select CSV file
5. GTN750 imports all rows
6. Shows import summary

**CSV Format Example**:
```csv
Identifier,Name,Latitude,Longitude,Category,Notes
LAKE1,Big Lake,40.5678,-105.1234,VRP,Report 2nm north of lake
HOME1,Home Base,40.1234,-104.5678,POI,Private hangar location
PRAC1,Practice Area,40.9876,-105.6543,PRC,Maneuvers zone
```

---

## Managing Waypoints

### Viewing Waypoints

**List All Waypoints**:
1. Press **USER WPT** soft key
2. View list sorted by identifier
3. Filter by category (VRP/POI/PVT/PRC/WPT)
4. Scroll to select waypoint

**View on Map**:
- User waypoints displayed with category icons
- Color-coded by category
- Identifiers shown at zoom level 5+

### Editing Waypoints

**Update Waypoint Details**:
1. Press **USER WPT** soft key
2. Select waypoint from list
3. Press **EDIT** soft key
4. Modify name, coordinates, category, or notes
5. Press **SAVE**
6. Changes saved automatically

### Deleting Waypoints

**Remove Single Waypoint**:
1. Press **USER WPT** soft key
2. Select waypoint
3. Press **DELETE** soft key
4. Confirm deletion
5. Waypoint removed and map updated

**Clear All Waypoints**:
1. Press **USER WPT** soft key
2. Press **OPTIONS** soft key
3. Select **CLEAR ALL**
4. Confirm deletion
5. All user waypoints removed

---

## Using User Waypoints for Navigation

### Direct-To User Waypoint

**Navigate to Custom Waypoint**:
1. Press **D→** (Direct-To)
2. Type user waypoint identifier (e.g., `LAKE1`)
3. GTN750 searches user waypoints AND database
4. User waypoints shown with category icon
5. Select waypoint
6. Press **ACTIVATE**
7. Map switches to MAP page, route displayed

**Example**:
```
D→ LAKE1 [Enter]
→ Shows: "LAKE1 - Big Lake Reporting Point ▲"
→ Activate → Route set to LAKE1
```

### Adding to Flight Plan

**Insert User Waypoint in FPL**:
1. Press **FPL** page button
2. Click insertion point in flight plan
3. Press **+ Add Waypoint**
4. Type user waypoint identifier
5. GTN750 recognizes user waypoint
6. Waypoint inserted with category icon
7. Flight plan recalculates

**Example Flight Plan**:
```
1. KAPA (Centennial Airport)
2. LAKE1 (User - VRP)
3. PRAC1 (User - Practice Area)
4. HOME1 (User - POI)
5. KBJC (Rocky Mountain Airport)
```

### NRST (Nearest) Integration

**Find Nearest User Waypoints**:
1. Press **NRST** page button
2. Select **USER** tab
3. See nearest 10 user waypoints
4. Sorted by distance from current position
5. Shows bearing and distance
6. Press waypoint to activate Direct-To

---

## Import/Export

### Exporting Waypoints

**Export to GPX**:
1. Press **USER WPT** soft key
2. Press **OPTIONS** → **EXPORT**
3. Select **GPX Format**
4. GTN750 generates GPX file
5. Download to computer
6. Compatible with Garmin, Foreflight, etc.

**Export to CSV**:
1. Press **USER WPT** soft key
2. Press **OPTIONS** → **EXPORT**
3. Select **CSV Format**
4. GTN750 generates CSV file
5. Download to computer
6. Open in Excel/Sheets for editing

**GPX Output Example**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GTN750 SimGlass">
  <metadata>
    <name>GTN750 User Waypoints</name>
    <time>2026-02-14T18:30:00Z</time>
  </metadata>
  <wpt lat="40.5678" lon="-105.1234">
    <name>Big Lake Reporting Point</name>
    <desc>Report position 2nm north of lake</desc>
    <sym>VRP</sym>
  </wpt>
</gpx>
```

### Importing Waypoints

**Import from Foreflight**:
1. Export waypoints from Foreflight as GPX
2. Import into GTN750 via GPX import
3. Waypoints converted to GTN750 format
4. Category assigned based on symbol

**Import from Excel**:
1. Create CSV with required columns
2. Save as `.csv` file
3. Import into GTN750 via CSV import
4. Each row becomes a waypoint

**Import Behavior**:
- **Duplicate Identifiers**: Skipped (shows warning)
- **Invalid Coordinates**: Skipped (shows error)
- **Missing Required Fields**: Skipped (shows error)
- **Max Limit**: Import stops at 500 waypoints
- **Auto-save**: All imported waypoints saved automatically

---

## API Reference

### JavaScript API

```javascript
// Access user waypoints manager
const userWaypoints = window.widget.userWaypointsManager;

// Create a waypoint
const waypoint = userWaypoints.createWaypoint({
    ident: "LAKE1",
    name: "Big Lake Reporting Point",
    lat: 40.5678,
    lon: -105.1234,
    category: "VRP",
    notes: "Report 2nm north of lake"
});
// Returns: waypoint object or null on error

// Get a waypoint
const wp = userWaypoints.getWaypoint("LAKE1");
console.log(wp);
// {
//   ident: "LAKE1",
//   name: "Big Lake Reporting Point",
//   lat: 40.5678,
//   lon: -105.1234,
//   category: "VRP",
//   notes: "Report 2nm north of lake",
//   created: "2026-02-14T18:30:00.000Z",
//   modified: "2026-02-14T18:30:00.000Z",
//   isUserWaypoint: true
// }

// Update a waypoint
userWaypoints.updateWaypoint("LAKE1", {
    name: "Lake Waypoint",
    notes: "Updated notes"
});
// Returns: true if updated successfully

// Delete a waypoint
userWaypoints.deleteWaypoint("LAKE1");
// Returns: true if deleted successfully

// Get all waypoints
const all = userWaypoints.getAllWaypoints();
// Returns: array of all waypoints

// Get waypoints by category
const vrps = userWaypoints.getAllWaypoints("VRP");
// Returns: array of VRP waypoints only

// Search waypoints
const results = userWaypoints.searchWaypoints("lake");
// Returns: array of waypoints matching "lake" in ident or name

// Find nearest waypoints
const nearest = userWaypoints.findNearest(40.0, -105.0, 5);
// Returns: 5 nearest waypoints with distance and bearing

// Import GPX
const gpxData = '<?xml version="1.0"?>...';
const importResult = userWaypoints.importGPX(gpxData);
console.log(importResult);
// { imported: 5, skipped: 2, errors: [] }

// Export GPX
const gpx = userWaypoints.exportGPX();
// Returns: GPX XML string

// Import CSV
const csvData = 'Identifier,Name,Latitude,Longitude,Category,Notes\nLAKE1,...';
const csvResult = userWaypoints.importCSV(csvData);
console.log(csvResult);
// { imported: 5, skipped: 1, errors: [] }

// Export CSV
const csv = userWaypoints.exportCSV();
// Returns: CSV string

// Get statistics
const stats = userWaypoints.getStats();
console.log(stats);
// {
//   total: 25,
//   byCategory: { VRP: 5, POI: 10, PVT: 3, PRC: 2, WPT: 5 }
// }

// Clear all waypoints
userWaypoints.clearAll();
// Deletes all waypoints and saves
```

---

## Examples

### Example 1: VFR Reporting Points

**Scenario**: Create reporting points for local VFR flight following

**Setup**:
1. Create waypoints for common landmarks:
   - `LAKE1` - Big Lake (40.5678, -105.1234)
   - `TOWER1` - Water Tower (40.6789, -105.2345)
   - `BRIDGE1` - Highway Bridge (40.7890, -105.3456)
2. Assign category: VRP (cyan triangle icon)
3. Add notes with reporting phraseology

**Flight Plan**:
```
KAPA → LAKE1 → TOWER1 → BRIDGE1 → KBJC
```

**Usage**:
- ATC: "Report Big Lake"
- Pilot: Check GTN750 for distance/bearing to LAKE1
- At LAKE1: "Over Big Lake, 3,500 feet"

### Example 2: Practice Area

**Scenario**: Mark practice area boundaries

**Setup**:
1. Create 4 waypoints for corners:
   - `PRC1` - Northeast corner
   - `PRC2` - Northwest corner
   - `PRC3` - Southwest corner
   - `PRC4` - Southeast corner
2. Assign category: PRC (green circle icon)
3. Add notes: "Stall/slow flight practice area"

**Display**:
- 4 green circles on map forming practice area boundary
- Easy to stay within designated airspace
- Direct-To any corner to return to area

### Example 3: Private Strips

**Scenario**: Store locations of private grass strips

**Setup**:
1. Create waypoints for each strip:
   - `PVT1` - Jones Farm Strip (40.1234, -105.6789)
   - `PVT2` - Mountain Strip (40.2345, -105.7890)
2. Assign category: PVT (orange ⊕ icon)
3. Add notes: "1,500ft grass, lights available, 303-555-1234"

**Navigation**:
- Press D→ PVT1
- GTN750 shows distance, bearing, ETE
- Land at private strip

---

## Integration with Other Systems

### Direct-To

User waypoints integrated into Direct-To search:
```javascript
// Direct-To searches both database AND user waypoints
// User waypoints shown with category icon
// Example: "LAKE1 ▲ (User - VRP)"
```

### Flight Plan

User waypoints insertable into flight plans:
```javascript
// Flight plan allows user waypoints anywhere
// Displayed with category icon in waypoint list
// Distance calculations same as database waypoints
```

### NRST (Nearest)

Dedicated user waypoint nearest list:
```javascript
// NRST → USER tab
// Shows 10 nearest user waypoints
// Updated in real-time as aircraft moves
```

### Map Display

User waypoints displayed on map:
- **Icons**: Category-specific icons (▲★⊕○●)
- **Colors**: Category colors (cyan/yellow/orange/green/white)
- **Labels**: Identifier shown at zoom level 5+
- **Selection**: Click to select, shows details panel

---

## Troubleshooting

### "Waypoint identifier already exists"
**Cause**: Identifier must be unique across all user waypoints
**Solution**: Choose different identifier (e.g., LAKE1 → LAKE2)

### "Maximum waypoint limit reached"
**Cause**: 500 waypoint limit enforced
**Solution**: Delete unused waypoints or export/clear old ones

### "Invalid identifier format"
**Cause**: Identifier must be 3-5 alphanumeric characters
**Solution**: Use valid format (e.g., "LAKE1" not "Lake Point 1")

### "Waypoints not showing on map"
**Cause**: Zoom level too far out
**Solution**: Zoom in to level 5+ to see waypoint labels

### "Import failed - no waypoints imported"
**Cause**: Invalid GPX/CSV format
**Solution**: Check file format matches GTN750 requirements

### "Waypoints disappeared after restart"
**Cause**: localStorage cleared or browser private mode
**Solution**: Export waypoints to GPX as backup

---

## Advanced Features

### Batch Operations

Create multiple waypoints programmatically:
```javascript
const waypoints = [
    { ident: "VRP01", lat: 40.1, lon: -105.1, category: "VRP" },
    { ident: "VRP02", lat: 40.2, lon: -105.2, category: "VRP" },
    { ident: "VRP03", lat: 40.3, lon: -105.3, category: "VRP" }
];

waypoints.forEach(wp => {
    userWaypoints.createWaypoint(wp);
});
```

### Custom Categories

While 5 categories are built-in, you can use notes to add custom tags:
```javascript
userWaypoints.createWaypoint({
    ident: "FUEL1",
    name: "Cheapest Fuel",
    lat: 40.5,
    lon: -105.5,
    category: "POI",
    notes: "TAG:FUEL | $3.50/gal | Self-serve"
});

// Search by tag
const fuelWaypoints = userWaypoints.getAllWaypoints()
    .filter(wp => wp.notes.includes("TAG:FUEL"));
```

### Change Notifications

React to waypoint changes:
```javascript
const userWaypoints = new GTNUserWaypoints({
    onChange: (action, waypoint) => {
        console.log(`Waypoint ${action}: ${waypoint.ident}`);
        // action: 'create', 'update', 'delete', 'clear'
    }
});
```

---

## Limitations

1. **500 Waypoint Limit** - Cannot exceed 500 user waypoints
2. **localStorage Only** - No cloud sync (export for backup)
3. **No Altitude** - User waypoints don't store altitude restrictions
4. **No Routes** - Cannot define multi-waypoint routes (use flight plan instead)
5. **Identifier Collision** - If user waypoint matches database identifier, database wins

---

## Best Practices

1. **Use Descriptive Identifiers** - `LAKE1` better than `WPT01`
2. **Add Notes** - Future you will thank present you
3. **Regular Backups** - Export to GPX monthly
4. **Category Consistency** - Use categories as intended (VRP for reporting points, not general waypoints)
5. **Coordinate Precision** - Use 6 decimal places (±0.1m accuracy)

---

## Technical Details

### File Locations
- **Module**: `ui/gtn750/modules/gtn-user-waypoints.js` (573 lines)
- **Storage**: Browser localStorage (`gtn750-user-waypoints`)
- **Instantiation**: `ui/gtn750/pane.js` (if integrated)

### Data Format
```json
{
  "version": 1,
  "waypoints": [
    {
      "ident": "LAKE1",
      "name": "Big Lake Reporting Point",
      "lat": 40.5678,
      "lon": -105.1234,
      "category": "VRP",
      "notes": "Report 2nm north of lake",
      "created": "2026-02-14T18:30:00.000Z",
      "modified": "2026-02-14T18:30:00.000Z",
      "isUserWaypoint": true
    }
  ],
  "lastSaved": "2026-02-14T18:30:00.000Z"
}
```

### Coordinate Validation
- **Latitude**: -90° to +90°
- **Longitude**: -180° to +180°
- **Precision**: 6 decimal places recommended (~0.1m accuracy)

### Search Algorithm
1. **Exact Match**: Identifier exactly matches query → ranked first
2. **Starts With**: Identifier starts with query → ranked second
3. **Contains**: Identifier or name contains query → ranked third
4. **Alphabetical**: Ties broken by alphabetical order

---

## Conclusion

User Waypoints is **fully implemented and production-ready** with:
- ✅ Create, update, delete waypoint management
- ✅ 5 categories with color-coded icons
- ✅ GPX and CSV import/export
- ✅ localStorage persistence
- ✅ Search and nearest waypoint functions
- ✅ Integration with Direct-To, FPL, NRST

**Ready to use** for custom navigation points, VFR reporting, practice areas, and private strips! 📍✈️
