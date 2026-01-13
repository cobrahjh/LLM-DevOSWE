# SimWidget Engine - Widget Creation Guide
**Version:** v1.0.0  
**Last Updated:** 2026-01-05  
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\docs\WIDGET-CREATION-GUIDE.md

---

## Table of Contents

1. [Overview](#overview)
2. [Widget Types](#widget-types)
3. [Quick Start](#quick-start)
4. [Widget Structure](#widget-structure)
5. [Using Components](#using-components)
6. [Data Binding](#data-binding)
7. [Sending Commands](#sending-commands)
8. [Styling Guidelines](#styling-guidelines)
9. [MiniWidget Creation](#miniwidget-creation)
10. [Testing Your Widget](#testing-your-widget)
11. [Publishing](#publishing)

---

## Overview

SimWidget Engine allows you to create custom widgets for Microsoft Flight Simulator 2024. Widgets connect to the simulator via WebSocket and can:

- **Display** real-time flight data (altitude, speed, heading, etc.)
- **Control** aircraft systems (lights, autopilot, flight controls)
- **Interact** with the user via buttons, sliders, and joystick-style inputs

### Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Your Widget   │ ◄─────────────────►│  SimWidget      │
│   (HTML/JS/CSS) │    port 8080       │  Server         │
└─────────────────┘                    └────────┬────────┘
                                                │
                                        SimConnect API
                                                │
                                       ┌────────▼────────┐
                                       │   MSFS 2024     │
                                       └─────────────────┘
```

---

## Widget Types

### Full Widget
- Complete panel with multiple sections
- Typically 300-400px wide
- Contains multiple components (buttons, displays, sliders)
- Example: Aircraft Control Widget

### MiniWidget
- Compact, single-purpose display
- Typically 80-150px wide
- Shows 1-3 data points
- Always visible, minimal interaction
- Example: Altitude indicator, Speed tape

### Overlay Widget
- Transparent background
- Click-through except for interactive elements
- Used for HUD-style displays
- Example: Flight path indicator

---

## Quick Start

### 1. Create Widget Folder

```
SimWidget_Engine/
└── simwidget-hybrid/
    └── widgets/
        └── my-widget/           ← Create this folder
            ├── widget.html      ← Main HTML
            ├── widget.css       ← Styles
            ├── widget.js        ← Logic
            └── manifest.json    ← Metadata
```

### 2. Create manifest.json

```json
{
    "id": "my-widget",
    "name": "My Custom Widget",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "A custom widget for MSFS",
    "type": "widget",
    "size": {
        "width": 300,
        "height": 400
    },
    "minSize": {
        "width": 200,
        "height": 300
    }
}
```

### 3. Create Basic HTML

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>My Widget</title>
    <link rel="stylesheet" href="widget.css">
</head>
<body>
    <div class="widget">
        <div class="widget-header">
            <span class="widget-title">MY WIDGET</span>
            <span class="conn-status" id="conn">●</span>
        </div>
        
        <div class="widget-content">
            <!-- Your components here -->
            <div class="data-field">
                <span class="label">Altitude</span>
                <span class="value" id="altitude">0 ft</span>
            </div>
        </div>
    </div>
    
    <script src="widget.js"></script>
</body>
</html>
```

### 4. Create Widget JavaScript

```javascript
class MyWidget {
    constructor() {
        this.ws = null;
        this.connect();
    }
    
    connect() {
        // Connect to SimWidget server
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);
        
        this.ws.onopen = () => {
            console.log('Connected to SimWidget');
            document.getElementById('conn').style.color = '#22c55e';
        };
        
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'flightData') {
                this.updateUI(msg.data);
            }
        };
        
        this.ws.onclose = () => {
            document.getElementById('conn').style.color = '#ef4444';
            setTimeout(() => this.connect(), 3000);
        };
    }
    
    updateUI(data) {
        // Update displays with flight data
        document.getElementById('altitude').textContent = 
            Math.round(data.altitude).toLocaleString() + ' ft';
    }
    
    sendCommand(command, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: command,
                value: value
            }));
        }
    }
}

// Initialize widget
document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
});
```

---

## Widget Structure

### Recommended Sections

```html
<div class="widget">
    <!-- Header: Title and connection status -->
    <div class="widget-header">...</div>
    
    <!-- Content: Main widget area -->
    <div class="widget-content">
        
        <!-- Section: Group related items -->
        <div class="section">
            <div class="section-header">FLIGHT DATA</div>
            <div class="section-content">
                <!-- Components go here -->
            </div>
        </div>
        
    </div>
    
    <!-- Footer: Optional status bar -->
    <div class="widget-footer">...</div>
</div>
```

### CSS Class Naming Convention

Use the `swc-` prefix for SimWidget Components:

```css
.swc-[type]           /* Base component */
.swc-[type]--active   /* Active state modifier */
.swc-[type]--disabled /* Disabled state modifier */
.swc-[type]__[part]   /* Component sub-part */
```

Examples:
- `.swc-pb` - PushButton
- `.swc-pb--active` - Active PushButton
- `.swc-pb__icon` - PushButton icon part

---

## Using Components

### Available Components

| Component | Class | Purpose |
|-----------|-------|---------|
| AxisPad | `swc-ap` | 2-axis joystick control |
| LinearSlider | `swc-ls` | Single-axis slider |
| RotaryKnob | `swc-rk` | Rotary encoder |
| PushButton | `swc-pb` | Momentary button |
| ToggleSwitch | `swc-ts` | On/off toggle |
| RockerSwitch | `swc-rs` | Up/down momentary |
| DataField | `swc-df` | Numeric/text display |
| StatusLamp | `swc-sl` | On/off indicator |
| ProgressBar | `swc-pg` | 0-100% bar |
| TextLabel | `swc-tl` | Static text |

### Component Examples

#### DataField (Display Value)
```html
<div class="swc-df">
    <span class="swc-df__label">ALTITUDE</span>
    <span class="swc-df__value" id="alt-value">0</span>
    <span class="swc-df__unit">FT</span>
</div>
```

#### PushButton (Toggle Light)
```html
<button class="swc-pb" data-cmd="TOGGLE_NAV_LIGHTS">
    <span class="swc-sl" id="nav-indicator"></span>
    <span class="swc-pb__label">NAV</span>
</button>
```

#### LinearSlider (Throttle)
```html
<div class="swc-ls swc-ls--vertical">
    <label class="swc-ls__label">THR</label>
    <input type="range" class="swc-ls__input" 
           data-cmd="THROTTLE_SET" 
           min="0" max="100" value="0">
    <span class="swc-ls__value" id="thr-value">0%</span>
</div>
```

#### AxisPad (Joystick)
```html
<div class="swc-ap" id="yoke-pad">
    <div class="swc-ap__grid"></div>
    <div class="swc-ap__crosshair-h"></div>
    <div class="swc-ap__crosshair-v"></div>
    <div class="swc-ap__center"></div>
    <div class="swc-ap__knob" id="yoke-knob"></div>
</div>
```

---

## Data Binding

### Available Flight Data

The server sends `flightData` messages with these properties:

```javascript
{
    // Basic Flight
    altitude: 0,        // feet
    speed: 0,           // knots (IAS)
    heading: 0,         // degrees magnetic
    verticalSpeed: 0,   // feet per minute
    groundSpeed: 0,     // knots
    
    // Autopilot
    apMaster: false,
    apHdgLock: false,
    apAltLock: false,
    apVsLock: false,
    apSpdLock: false,
    apHdgSet: 0,        // degrees
    apAltSet: 0,        // feet
    apVsSet: 0,         // fpm
    apSpdSet: 0,        // knots
    
    // Systems
    parkingBrake: false,
    gearDown: true,
    flapsIndex: 0,
    
    // Lights
    navLight: false,
    beaconLight: false,
    strobeLight: false,
    landingLight: false,
    taxiLight: false,
    
    // Engine
    engineRunning: false,
    throttle: 0,        // percent
    propeller: 0,       // percent
    mixture: 0,         // percent
    
    // Flight Controls
    aileron: 0,         // -100 to 100
    elevator: 0,        // -100 to 100
    rudder: 0,          // -100 to 100
    
    // Fuel
    fuelTotal: 0,       // gallons
    fuelFlow: 0,        // gph
    fuelLeft: 0,        // gallons
    fuelRight: 0,       // gallons
    
    // Environment
    windDirection: 0,   // degrees
    windSpeed: 0,       // knots
    
    // Status
    connected: false,   // SimConnect status
    localTime: 0        // sim time (hours)
}
```

### Updating UI from Data

```javascript
updateUI(data) {
    // Simple text update
    this.setText('alt-value', Math.round(data.altitude));
    
    // Formatted value
    this.setText('hdg-value', 
        data.heading.toFixed(0).padStart(3, '0') + '°');
    
    // Conditional styling
    const vsEl = document.getElementById('vs-value');
    vsEl.textContent = data.verticalSpeed.toFixed(0);
    vsEl.className = data.verticalSpeed > 0 ? 'climb' : 
                     data.verticalSpeed < 0 ? 'descend' : 'level';
    
    // Toggle indicator
    this.setIndicator('nav-indicator', data.navLight);
}

setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

setIndicator(id, isOn) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', isOn);
}
```

---

## Sending Commands

### Command Format

```javascript
sendCommand(command, value = 0) {
    this.ws.send(JSON.stringify({
        type: 'command',
        command: command,
        value: value
    }));
}
```

### Available Commands

#### Lights
| Command | Description |
|---------|-------------|
| `TOGGLE_NAV_LIGHTS` | Toggle navigation lights |
| `TOGGLE_BEACON_LIGHTS` | Toggle beacon |
| `STROBES_TOGGLE` | Toggle strobes |
| `LANDING_LIGHTS_TOGGLE` | Toggle landing lights |
| `TOGGLE_TAXI_LIGHTS` | Toggle taxi light |

#### Systems
| Command | Value | Description |
|---------|-------|-------------|
| `PARKING_BRAKES` | - | Toggle parking brake |
| `GEAR_TOGGLE` | - | Toggle landing gear |
| `FLAPS_UP` | - | Retract flaps one notch |
| `FLAPS_DOWN` | - | Extend flaps one notch |

#### Autopilot
| Command | Value | Description |
|---------|-------|-------------|
| `AP_MASTER` | - | Toggle AP master |
| `AP_HDG_HOLD` | - | Toggle heading hold |
| `AP_ALT_HOLD` | - | Toggle altitude hold |
| `AP_VS_HOLD` | - | Toggle VS hold |
| `HEADING_BUG_SET` | 0-359 | Set heading bug |
| `AP_ALT_VAR_SET_ENGLISH` | feet | Set target altitude |
| `AP_VS_VAR_SET_ENGLISH` | fpm | Set target VS |

#### Flight Controls
| Command | Value | Description |
|---------|-------|-------------|
| `AXIS_AILERONS_SET` | -100 to 100 | Set aileron position |
| `AXIS_ELEVATOR_SET` | -100 to 100 | Set elevator position |
| `AXIS_RUDDER_SET` | -100 to 100 | Set rudder position |
| `CENTER_AILER_RUDDER` | - | Center all controls |

#### Engine
| Command | Value | Description |
|---------|-------|-------------|
| `THROTTLE_SET` | 0-100 | Set throttle position |
| `PROP_PITCH_SET` | 0-100 | Set propeller pitch |
| `MIXTURE_SET` | 0-100 | Set mixture |

#### Camera
| Command | Description |
|---------|-------------|
| `VIEW_MODE` | Toggle internal/external view |
| `KEY_TOGGLE_CINEMATIC` | Toggle cinematic mode |
| `KEY_NEXT_CINEMATIC` | Next cinematic camera |

---

## Styling Guidelines

### Color Palette

```css
:root {
    /* Background */
    --bg-dark: #0d1117;
    --bg-panel: #1a1f2e;
    --bg-section: rgba(0, 0, 0, 0.25);
    
    /* Text */
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    
    /* Accent */
    --accent-blue: #38bdf8;
    --accent-cyan: #22d3ee;
    --accent-green: #22c55e;
    --accent-red: #ef4444;
    --accent-yellow: #eab308;
    --accent-orange: #f97316;
    
    /* Borders */
    --border-subtle: rgba(100, 180, 255, 0.2);
    --border-active: rgba(56, 189, 248, 0.6);
}
```

### Typography

```css
/* Headers */
.widget-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Section headers */
.section-header {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
}

/* Data values */
.swc-df__value {
    font-size: 15px;
    font-weight: 600;
    font-family: 'Consolas', 'Monaco', monospace;
}

/* Labels */
.swc-df__label {
    font-size: 9px;
    text-transform: uppercase;
}
```

### Button States

```css
.swc-pb {
    background: linear-gradient(180deg, 
        rgba(55, 65, 85, 0.95), 
        rgba(35, 45, 65, 0.95));
    border: 1px solid var(--border-subtle);
}

.swc-pb:hover {
    border-color: var(--border-active);
    transform: translateY(-1px);
}

.swc-pb:active {
    transform: translateY(1px);
}

.swc-pb--active {
    background: linear-gradient(180deg,
        rgba(34, 197, 94, 0.35),
        rgba(22, 130, 62, 0.35));
    border-color: rgba(34, 197, 94, 0.6);
}
```

---

## MiniWidget Creation

MiniWidgets are compact, always-visible displays for critical information.

### MiniWidget manifest.json

```json
{
    "id": "altitude-mini",
    "name": "Altitude MiniWidget",
    "version": "1.0.0",
    "type": "miniwidget",
    "size": {
        "width": 100,
        "height": 60
    },
    "alwaysOnTop": true,
    "transparent": true
}
```

### MiniWidget HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="mini.css">
</head>
<body>
    <div class="miniwidget">
        <div class="mini-label">ALT</div>
        <div class="mini-value" id="alt">0</div>
        <div class="mini-unit">FT</div>
    </div>
    <script src="mini.js"></script>
</body>
</html>
```

### MiniWidget CSS

```css
body {
    margin: 0;
    background: transparent;
    font-family: 'Segoe UI', sans-serif;
}

.miniwidget {
    background: rgba(13, 17, 23, 0.85);
    border: 1px solid rgba(100, 180, 255, 0.3);
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
}

.mini-label {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
}

.mini-value {
    font-size: 24px;
    font-weight: 700;
    color: #22d3ee;
    font-family: 'Consolas', monospace;
}

.mini-unit {
    font-size: 8px;
    color: #64748b;
}
```

### MiniWidget Best Practices

1. **Keep it simple** - Show only 1-3 values
2. **Large text** - Must be readable at a glance
3. **High contrast** - Use bright colors on dark background
4. **Minimal interaction** - Click-through where possible
5. **Update efficiently** - Only update changed values

---

## Testing Your Widget

### Local Testing

1. Start the SimWidget server:
```powershell
cd C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid
node backend\server.js
```

2. Open your widget in browser:
```
http://localhost:8080/widgets/my-widget/widget.html
```

3. Without MSFS running, you'll see mock data updating

### With MSFS

1. Start MSFS 2024
2. Load a flight
3. Start SimWidget server
4. Open widget - data should be live

### Debug Tips

- Open browser DevTools (F12) for console logs
- Check Network tab for WebSocket connection
- Server logs show SimConnect status

---

## Publishing

### Folder Structure for Distribution

```
my-widget/
├── manifest.json      ← Required
├── widget.html        ← Main file
├── widget.css
├── widget.js
├── README.md          ← Usage instructions
├── screenshot.png     ← Preview image
└── CHANGELOG.md       ← Version history
```

### manifest.json for Publishing

```json
{
    "id": "my-widget",
    "name": "My Custom Widget",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Description for marketplace",
    "type": "widget",
    "license": "MIT",
    "repository": "https://github.com/you/my-widget",
    "keywords": ["autopilot", "lights", "controls"],
    "size": {
        "width": 300,
        "height": 400
    },
    "simvars": [
        "PLANE ALTITUDE",
        "AUTOPILOT MASTER"
    ],
    "commands": [
        "AP_MASTER",
        "TOGGLE_NAV_LIGHTS"
    ]
}
```

---

## Changelog

### v1.0.0 (2026-01-05)
- Initial documentation
- Widget and MiniWidget creation guides
- Component usage examples
- Styling guidelines
- Command reference
