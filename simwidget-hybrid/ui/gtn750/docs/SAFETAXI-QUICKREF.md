# SafeTaxi Quick Reference

## What is SafeTaxi?

Airport surface diagram viewer showing your real-time position on the airport layout. Perfect for taxi operations, finding gates, and runway navigation.

## Quick Start

### Auto-Load (Recommended)
1. Land at any airport
2. SafeTaxi automatically loads diagram when on ground (AGL < 50ft, GS < 5kts)
3. Press `TAXI` page button to view

### Manual Load
1. Press `TAXI` page button
2. Type airport ICAO (e.g., `KSEA`)
3. Press `LOAD` or Enter

## Button Controls

| Button | What It Does |
|--------|--------------|
| **LOAD** | Load diagram for typed airport |
| **CENTER** | Center view on your aircraft |
| **ZOOM+** | Zoom in (show more detail) |
| **ZOOM-** | Zoom out (show more area) |
| **AUTO** | Auto-scale to fit entire airport |
| **FOLLOW** | Auto-follow ON/OFF (keeps you centered) |
| **TRK UP** | Track-up ON/OFF (map rotates with aircraft) |

## Mouse Controls

- **Left-click + drag** → Pan around diagram
- **Mouse wheel** → Zoom in/out
- **Double-click** → Quick center on ownship

## What You See

### Runways
- **Blue rectangles** with white centerlines
- **Numbers** at each end (always upright, easy to read)
- **Hold-short lines** (red/white stripes) before each runway

### Taxiways
- **Gray lines** with labels (Alpha, Bravo, etc.)
- Connects runways to parking areas

### Parking
- **Blue squares** = Gates (airline terminals)
- **Yellow squares** = Ramps (general aviation)
- **Green squares** = FBOs (fuel, services)

### Safety
- **Orange areas** = Hotspots (complex intersections, be careful!)
- **Hold-short lines** = STOP before crossing runway

### Your Aircraft
- **Cyan/yellow triangle** pointing in your heading direction
- Updates in real-time as you taxi

### Scale Bar
- **Bottom-left corner** shows distance reference
- Auto-adjusts based on zoom level (100ft to 5000ft)

## Modes Explained

### North-Up Mode (Default)
- North is always at the top
- Traditional map orientation
- Best for: Planning, general situational awareness

### Track-Up Mode
- Map rotates so your heading is always "up"
- Like a car GPS
- Best for: Active taxi operations, intuitive steering

### Auto-Follow Mode
- Camera automatically centers on your aircraft
- You stay in the middle, map moves around you
- Best for: Long taxi routes, keeping ownship in view

## Pro Tips

1. **Enable FOLLOW + TRK UP together** for car GPS-style navigation
2. **Use AUTO button** when first loading to see whole airport
3. **Watch hold-short lines** - they mark runway entry points
4. **Orange hotspots** = areas with high incursion rates, slow down
5. **Mouse drag** is faster than buttons for quick panning
6. **Diagram auto-reloads** if you taxi to a different airport (>5nm away)

## Color Code

| Color | Meaning |
|-------|---------|
| Blue | Runways, gates |
| Gray | Taxiways |
| Yellow | Ramps, parking |
| Green | FBOs, services |
| Orange | Hotspots (caution!) |
| Red/White | Hold-short lines (STOP!) |
| Cyan/Yellow | Your aircraft |
| White | Labels, scale bar |

## Status Messages

| Message | What It Means |
|---------|---------------|
| "Loading..." (yellow) | Downloading airport data |
| "KSEA loaded" (green) | Diagram ready to use |
| "Failed to load" (red) | Airport not found or no diagram available |
| "Auto-follow: ON" (green) | Camera will track your movement |
| "Track-up: ON" (green) | Map rotates with your heading |

## Troubleshooting

### Diagram Won't Load
- Check airport ICAO spelling
- Not all airports have diagrams (major airports only)
- Verify server is running (port 8080)

### Can't See My Aircraft
- Verify you're on the ground at the airport
- Try pressing **CENTER** button
- Check if you're too far zoomed in or out
- Make sure SimConnect is sending position data

### Auto-Load Not Working
- Must be on ground (AGL < 50 feet)
- Must be moving slowly (GS < 5 knots)
- Wait a moment - auto-load has 1-2 second delay

### Position Looks Wrong
- Diagram uses Web Mercator projection (very accurate)
- If position still seems off, try reloading the diagram
- Check that MSFS scenery is up to date

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Switch to TAXI page |
| `+` | Zoom in |
| `-` | Zoom out |
| `Space` | Center on ownship |
| `Esc` | Close any dialogs |

## When to Use SafeTaxi

✅ **USE IT FOR:**
- Finding your gate after landing
- Planning taxi route before departure
- Identifying taxiway names
- Avoiding runway incursions (watch hold-short lines!)
- Complex airports (multi-runway, large terminals)
- Night operations (better than looking outside)
- Low visibility conditions

❌ **DON'T RELY ON IT FOR:**
- Real-world flight operations (not FAA certified)
- Critical decision-making (simulation only)
- Airports without diagrams

## Airport Coverage

SafeTaxi works best at:
- Class B airports (major hubs: KSEA, KLAX, KJFK, etc.)
- Class C airports (medium hubs)
- Large Class D airports

Some small airports may not have detailed diagrams available.

## Technical Details

- **Projection:** Web Mercator (EPSG:3857) - same as Google Maps
- **Accuracy:** Sub-meter precision at airport scale
- **Update Rate:** Real-time (follows SimConnect position updates)
- **Canvas:** Responsive sizing (adapts to your screen)
- **Data Source:** NavDB via SimWidget server (port 8080)

## Need More Info?

See full documentation: [SAFETAXI-IMPROVEMENTS.md](SAFETAXI-IMPROVEMENTS.md)

---

**Version:** 2.4.0
**Last Updated:** 2026-02-13
**Part of:** GTN750 GPS Widget
