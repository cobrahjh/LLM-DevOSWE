# SimGlass Fuel Data Provider

MSFS 2024 HTML Gauge that provides real-time fuel data to SimGlass widgets.

## Features
- Reads all fuel tank levels and capacities
- Updates every 500ms
- Broadcasts data via localStorage
- Zero performance impact (invisible 1x1px gauge)
- Works with any aircraft

## Installation

### Automatic (Recommended)
```bash
cd C:/LLM-DevOSWE/simwidget-hybrid/wasm-modules/simglass-fuel
./deploy.ps1
```

### Manual
1. Copy entire `simglass-fuel` folder to:
   `C:/Users/YOUR_USERNAME/AppData/Local/Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/Packages/Community/`

2. Restart MSFS 2024

## Usage

The gauge runs automatically when MSFS starts. Fuel data is available in `localStorage` under key `simglass_fuel_data`.

Data format:
```json
{
  "connected": true,
  "timestamp": 1234567890,
  "fuelTotal": 42.5,
  "fuelCapacity": 56.0,
  "fuelFlow": 8.2,
  "fuelTankLeftMain": 21.3,
  "fuelTankRightMain": 21.2,
  ...
}
```

## Integration with Fuel Widget

The fuel widget automatically detects and uses WASM data when available. No configuration needed.

## Troubleshooting

**Data not updating?**
- Check MSFS Developer Mode console for errors
- Verify gauge is loaded: Look for "[SimGlass Fuel] Provider initialized"
- Restart MSFS after installation

**Widget still showing mock data?**
- Open browser DevTools → Application → Local Storage
- Check for `simglass_fuel_data` key
- Verify timestamp is recent

## Version
1.0.0 - Initial release
