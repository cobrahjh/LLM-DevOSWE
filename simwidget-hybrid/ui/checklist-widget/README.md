# Checklist Widget

Comprehensive aircraft-specific checklists for Microsoft Flight Simulator with 18 aircraft profiles, audio callouts, progress tracking, and multiplayer synchronization.

## Features

### ✈️ 18 Aircraft Profiles
**General Aviation** (6 aircraft):
- Generic GA - Universal light aircraft checklist
- Cessna 172 Skyhawk - World's most popular trainer
- Cessna 208 Caravan - Utility turboprop
- Diamond DA40 - Modern glass cockpit trainer
- Diamond DA62 - Twin-engine GA
- Cirrus SR22 - High-performance single

**Turboprop** (4 aircraft):
- TBM 930 - Fast single-engine turboprop
- Pilatus PC-12 - Versatile utility aircraft
- King Air 350 - Business twin turboprop
- ATR 72-600 - Regional airliner

**Business Jets** (2 aircraft):
- Cessna Citation CJ4 - Light jet
- Cessna Citation Longitude - Super-midsize jet

**Regional Jets** (1 aircraft):
- Bombardier CRJ-700 - 70-seat regional jet

**Airliners** (5 aircraft):
- Airbus A320 - Narrowbody classic
- Airbus A320neo - Modern variant
- Boeing 737 - World's most common airliner
- Boeing 747 - Queen of the Skies
- Boeing 747-8 - Latest 747 variant
- Boeing 787 Dreamliner - Composite widebody

### 📋 7 Flight Phases
Each aircraft includes checklists for:
1. **Pre-Flight** - Exterior walk-around, preflight checks
2. **Startup** - Battery, avionics, engine start sequence
3. **Taxi** - Post-start, taxi preparation
4. **Takeoff** - Before takeoff, lineup checks
5. **Cruise** - Climb, cruise configuration
6. **Landing** - Approach, before landing, final checks
7. **Shutdown** - Parking, securing aircraft

Note: Some airliners use Descent/Approach phases instead of combined Landing.

### 🔊 Audio Callouts
- **Text-to-speech** - Reads each checklist item aloud
- **Challenge-response** - Announces item name and expected action
- **Auto-advance** - Moves to next item after completion
- **Toggle on/off** - 🔊 button in header

### 📊 Progress Tracking
- **Visual progress bar** - Shows completion percentage
- **Item counter** - "5/12" items completed
- **Persistent state** - Saves progress per aircraft/checklist
- **Reset anytime** - ↺ button clears current checklist

### ⌨️ Keyboard Navigation
- **Space** - Toggle current item
- **↑/↓** - Navigate items
- **←/→** - Previous/Next checklist
- **R** - Reset current checklist
- **A** - Toggle audio
- **1-7** - Jump to specific phase

### 🎨 Visual States
- ⬜ **Unchecked** - Gray, pending
- ✅ **Checked** - Green, completed
- ⚠️ **Warning items** - Yellow highlight (critical items)
- 🔴 **Alert items** - Red highlight (safety-critical)

### 🔄 Multiplayer Sync
- **Shared state** - All crew members see same checklist
- **Real-time updates** - Check/uncheck syncs instantly
- **Aircraft sync** - Changing aircraft updates all users
- **Phase sync** - Tab changes broadcast to crew

### 📱 Mobile Responsive
- **Touch optimized** - Large tap targets
- **Swipe navigation** - Swipe between phases
- **Auto-scroll** - Keeps current item visible
- **Landscape support** - Works in all orientations

## Usage

### 1. Open the Widget

```
http://localhost:8080/ui/checklist-widget/
```

### 2. Select Your Aircraft

Click the aircraft dropdown and choose your aircraft:
- Matches MSFS aircraft automatically (if detected)
- Manually select if auto-detection fails
- Selection persists to localStorage

### 3. Navigate Checklist Phases

**Using tabs**:
- Click phase tab (Pre-Flight, Startup, etc.)
- Active tab highlighted in blue

**Using buttons**:
- Click `← Prev` or `Next →` buttons
- Cycles through phases in order

**Using keyboard**:
- Press number keys 1-7 for phases
- Press ← / → arrow keys

### 4. Complete Items

**Click/tap method**:
- Click checkbox or item text to toggle
- Item turns green when checked

**Keyboard method**:
- Use ↑/↓ to navigate
- Press Space to toggle current item

**Auto-advance**:
- Enable in settings for automatic progression
- Moves to next unchecked item after 1 second

### 5. Enable Audio Callouts

1. Click **🔊** button in header
2. Speaker icon shows audio enabled
3. Each item announced as: "Battery... ON"
4. Browser may request microphone permission (for voice control, optional)

### 6. Reset Progress

**Current checklist only**:
- Click **↺** button in header
- Unchecks all items in current phase

**All checklists**:
- Settings → Reset All Checklists
- Clears progress for entire aircraft

**Change aircraft**:
- Select different aircraft from dropdown
- Progress saved separately per aircraft

## Checklist Examples

### Cessna 172 - Engine Start
```
☐ Preflight Inspection ......... COMPLETE
☐ Seats, Belts ................. ADJUST & SECURE
☐ Fuel Selector ................ BOTH
☐ Avionics Master Switch ....... OFF
☐ Beacon ....................... ON
☐ Throttle ..................... OPEN 1/4 INCH
☐ Mixture ...................... FULL RICH
☐ Carburetor Heat .............. COLD
☐ Master Switch ................ ON
☐ Propeller Area ............... CLEAR
☐ Ignition Switch .............. START
☐ Oil Pressure ................. CHECK (30 sec)
☐ Avionics Master Switch ....... ON
☐ Navigation Lights ............ AS REQUIRED
☐ Flashing Beacon .............. ON
```

### Boeing 737 - Before Takeoff
```
☐ Flight Controls .............. CHECKED
☐ Flaps ....................... SET FOR TAKEOFF
☐ Stabilizer Trim .............. SET
☐ Takeoff Briefing ............. COMPLETE
☐ Cabin Report ................. RECEIVED
☐ Engine Start Levers .......... IDLE DETENT
☐ Recall ....................... CHECKED
☐ Autobrake .................... RTO
☐ Transponder .................. TA/RA
☐ Strobe Lights ................ ON
☐ Below the Line ............... COMPLETE
```

### Airbus A320neo - Approach
```
☐ ATIS ......................... OBTAINED
☐ Approach Briefing ............ COMPLETE
☐ Seat Belts ................... ON
☐ Minimum ...................... SET & CHECKED
☐ Altimeters ................... SET & CROSS-CHECKED
☐ Landing Elevation ............ CHECKED
☐ ILS Frequency ................ SET & IDENTIFIED
☐ Autopilot .................... AS REQUIRED
☐ Autobrake .................... AS REQUIRED
☐ Go-Around Altitude ........... SET
☐ Cabin ........................ ADVISE
```

## Customization

### Aircraft-Specific Items
Each aircraft has **realistic, accurate** checklists based on:
- Manufacturer's Pilot Operating Handbooks (POH)
- Flight Operations Manuals (FOM)
- Standard Operating Procedures (SOP)
- Real-world airline procedures

### Creating Custom Checklists

**Option 1: Use Checklist Maker Widget**
1. Open `/ui/checklist-maker/`
2. Create custom checklist
3. Export as JSON
4. Import into checklist widget

**Option 2: Edit Source Code**
1. Open `pane.js`
2. Find `AIRCRAFT_CHECKLISTS` object
3. Add new aircraft entry:
```javascript
myaircraft: {
    name: 'My Custom Aircraft',
    checklists: {
        preflight: {
            name: 'Pre-Flight',
            items: [
                { text: 'Item Name', action: 'EXPECTED ACTION' },
                { text: 'Battery', action: 'ON' }
            ]
        },
        startup: { ... },
        // ... more phases
    }
}
```
4. Add to aircraft selector dropdown in `index.html`
5. Refresh widget to see changes

### Warning/Alert Items
Mark critical items with special styling:
```javascript
{ text: 'Parking Brake', action: 'SET', critical: true }  // Red alert
{ text: 'Fuel Quantity', action: 'CHECK', warning: true }  // Yellow warning
```

## Settings

### Audio Settings
- **Enable Audio Callouts** - Toggle TTS on/off
- **Voice** - Select TTS voice (browser-dependent)
- **Rate** - Speech speed (0.5x to 2x)
- **Pitch** - Voice pitch adjustment

### Display Settings
- **Font Size** - Small, Medium, Large, X-Large
- **Compact Mode** - Reduces spacing for more items visible
- **Show Actions** - Toggle action column visibility
- **Highlight Current** - Auto-scroll and highlight active item

### Behavior Settings
- **Auto-Advance** - Move to next item after completion
- **Confirm Reset** - Ask before resetting checklist
- **Remember Aircraft** - Auto-select last used aircraft
- **Sync with Crew** - Enable multiplayer synchronization

### Keyboard Shortcuts
- **Customize keys** - Remap navigation shortcuts
- **Enable shortcuts** - Global toggle for keyboard control

All settings persist to `localStorage`.

## Multiplayer Synchronization

### How It Works
Uses **BroadcastChannel API** for real-time sync:
```javascript
// Sent when item checked
{
    type: 'checklist-update',
    action: 'toggleItem',
    data: { index: 3 },
    source: 'checklist-widget'
}

// Sent when aircraft/phase changes
{
    type: 'checklist-update',
    action: 'changeChecklist',
    data: { aircraft: 'c172', checklist: 'startup' },
    source: 'checklist-widget'
}
```

### Compatible Widgets
- **Mobile Companion** - Remote checklist control
- **Voice Control** - "Check next item" commands
- **Flight Instructor** - Monitors checklist compliance

### Setup for Multiplayer
1. Both pilots open checklist widget
2. Select same aircraft
3. Items check/uncheck in real-time
4. Progress bars stay synchronized

**Note**: Requires widgets open in same browser context (same machine or same network).

## Voice Commands

With Voice Control widget active:
- "Next item" - Advance to next unchecked
- "Previous item" - Go back one item
- "Check item" - Toggle current item
- "Reset checklist" - Clear all checks
- "Next phase" - Move to next checklist
- "Read item" - Announce current item

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `Space` | Toggle current item |
| `Enter` | Toggle current item |
| `↑` | Previous item |
| `↓` | Next item |
| `←` | Previous phase |
| `→` | Next phase |
| `Home` | First item |
| `End` | Last item |
| `1-7` | Jump to phase (1=Pre-Flight, 7=Shutdown) |
| `R` | Reset current checklist |
| `A` | Toggle audio callouts |
| `Ctrl+R` | Reset all checklists |
| `Esc` | Close settings/dialogs |

## Performance

### Memory Usage
- **Base**: ~2MB (widget + UI)
- **Checklists**: ~500KB (all 18 aircraft)
- **Audio**: +2MB when TTS active
- **Total**: ~4-5MB typical

### Storage
- **localStorage**: ~50KB per aircraft
- **Total**: ~1MB for all progress data
- **Cleared**: On browser cache clear

### CPU Usage
- **Idle**: <0.1% CPU
- **Audio active**: ~2-5% CPU (TTS processing)
- **Sync active**: <1% CPU (BroadcastChannel)

## Troubleshooting

### Audio Not Working
- **Check permissions**: Browser may block audio autoplay
- **Verify TTS support**: Some browsers don't support Web Speech API
- **Test in Chrome/Edge**: Best TTS support
- **Reload page**: Sometimes TTS engine needs refresh

### Items Not Checking
- **Click target**: Ensure clicking checkbox or text, not whitespace
- **Touch issues**: Try tapping checkbox directly
- **Keyboard mode**: Press Space with item selected

### Progress Not Saving
- **Check localStorage**: Browser may block storage
- **Private/Incognito**: Progress doesn't persist in private mode
- **Clear cache**: Old data may conflict, try clearing browser data

### Aircraft Dropdown Empty
- **JavaScript error**: Check browser console (F12)
- **File corruption**: Verify `pane.js` loaded correctly
- **Network issue**: Ensure widget files accessible

### Sync Not Working
- **Same browser**: BroadcastChannel requires same browser instance
- **Check network**: For remote sync, use compatible widgets
- **Firewall**: May block WebSocket connections

## Architecture

### File Structure
```
checklist-widget/
├── index.html           # Main HTML with aircraft selector
├── pane.js             # Widget logic (2222 lines)
├── styles.css           # Checklist styling
└── README.md            # This file

Total: 2400+ lines
```

### Code Organization
```javascript
// Aircraft database (lines 1-1800)
const AIRCRAFT_CHECKLISTS = {
    generic: { ... },     // ~100 lines
    c172: { ... },        // ~120 lines
    // ... 16 more aircraft
};

// Widget class (lines 1850-2222)
class ChecklistWidget extends SimGlassBase {
    constructor() { ... }
    renderChecklist() { ... }
    toggleItem() { ... }
    handleAudio() { ... }
    // ... multiplayer sync methods
}
```

### State Management
```javascript
{
    currentAircraft: 'c172',
    currentChecklist: 'startup',
    checkedItems: {
        'c172_startup': [0, 1, 2, 5],  // Checked item indices
        'c172_takeoff': [0, 1]
    },
    audioEnabled: true
}
```

State saved per aircraft+phase, persists to localStorage.

## Development

### Adding a New Aircraft
1. Define checklist object in `AIRCRAFT_CHECKLISTS`
2. Add to `<select id="aircraft-select">` in `index.html`
3. Test all 7 phases for completeness
4. Verify audio pronunciation of items

### Adding a New Phase
1. Add phase to aircraft's `checklists` object
2. Add tab button in `index.html`
3. Update phase order in `getPhasesForAircraft()`
4. Test navigation and persistence

### Audio Customization
```javascript
// Change TTS settings
this.speechRate = 1.0;    // Speed (0.5 - 2.0)
this.speechPitch = 1.0;   // Pitch (0 - 2)
this.speechVolume = 1.0;  // Volume (0 - 1)
```

## Version History

**v2.0.0** (2026-02-07) - Widget→Glass Rebrand
- Renamed widget.js → pane.js
- SimGlassBase v2.0.0 migration
- Proper lifecycle with destroy() methods
- Updated terminology throughout

**v1.5.0** (2025-12-15) - Expanded Fleet
- Added 5 new aircraft (DA40, DA62, SR22, B787, ATR72)
- Regional jet checklists (CRJ-700)
- Improved airliner procedures

**v1.0.0** (2025-11-01) - Initial Release
- 13 aircraft profiles
- 7 flight phase checklists
- Audio callouts with TTS
- Progress tracking
- Multiplayer sync

## Credits

- **Aircraft manufacturers** - Checklist sources (POH, FOM)
- **Real-world pilots** - Procedure validation
- **SimGlass Team** - Widget framework
- **Contributors** - Aircraft-specific additions

## License

Part of SimGlass - see main repository LICENSE file.
