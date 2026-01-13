# TinyWidget Architecture
**Version:** 1.0.0  
**Last Updated:** 2025-01-07  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\TINYWIDGET-ARCHITECTURE.md`

---

## Overview

TinyWidgets are **single-function micro-widgets** that can be dynamically loaded into an interaction wheel, quick panel, or any container. Each TinyWidget is a self-contained action with minimal footprint.

---

## Design Principles

1. **Single Responsibility** - One action per TinyWidget
2. **Self-Describing** - Manifest contains all metadata
3. **Hot-Loadable** - Can be added/removed at runtime
4. **Stateless** - No persistent state (uses SimConnect data)
5. **Portable** - JSON manifest + JS function

---

## TinyWidget Structure

```
tinywidgets/
├── manifest.json           # Registry of all TinyWidgets
├── lights/
│   ├── nav-toggle.json     # Manifest
│   └── nav-toggle.js       # Action code
├── autopilot/
│   ├── hdg-sync.json
│   └── hdg-sync.js
└── camera/
    ├── cockpit-view.json
    └── cockpit-view.js
```

---

## Manifest Format

### Individual TinyWidget (`nav-toggle.json`)

```json
{
    "id": "lights-nav-toggle",
    "name": "NAV Lights",
    "category": "lights",
    "icon": "💡",
    "color": "#4ade80",
    "description": "Toggle navigation lights",
    "action": "toggle",
    "simvar": {
        "read": "A:LIGHT NAV",
        "event": "K:TOGGLE_NAV_LIGHTS"
    },
    "display": {
        "type": "led",
        "onColor": "#4ade80",
        "offColor": "#3f3f46"
    },
    "tags": ["lights", "exterior", "required"],
    "platforms": ["desktop", "mobile", "msfs-panel"]
}
```

### Master Registry (`manifest.json`)

```json
{
    "version": "1.0.0",
    "categories": {
        "lights": {
            "name": "Lights",
            "icon": "💡",
            "color": "#fbbf24"
        },
        "autopilot": {
            "name": "Autopilot",
            "icon": "🎯",
            "color": "#3b82f6"
        },
        "camera": {
            "name": "Camera",
            "icon": "📷",
            "color": "#8b5cf6"
        }
    },
    "widgets": [
        "lights/nav-toggle",
        "lights/beacon-toggle",
        "lights/strobe-toggle",
        "autopilot/hdg-sync",
        "autopilot/alt-hold",
        "camera/cockpit-view",
        "camera/external-view"
    ]
}
```

---

## Action Types

| Type | Description | Example |
|------|-------------|---------|
| `toggle` | On/Off state | Lights, AP modes |
| `trigger` | Fire once | Gear toggle, view change |
| `set` | Set specific value | Heading bug, altitude |
| `increment` | Increase value | Zoom in, alt +100 |
| `decrement` | Decrease value | Zoom out, alt -100 |
| `cycle` | Cycle through options | Camera views |

---

## Action Code Format

### Simple Toggle (`nav-toggle.js`)

```javascript
// TinyWidget: NAV Lights Toggle
// Category: Lights
// Action: toggle

(function(api, state) {
    // Toggle the light
    api.send('TOGGLE_NAV_LIGHTS');
    
    // Return new state for display
    return { active: !state.active };
})
```

### Value Setter (`hdg-sync.js`)

```javascript
// TinyWidget: Sync Heading Bug
// Category: Autopilot
// Action: trigger

(function(api, state, flightData) {
    // Set heading bug to current heading
    const currentHeading = Math.round(flightData.heading);
    api.send('HEADING_BUG_SET', currentHeading);
    
    return { value: currentHeading };
})
```

### Increment (`alt-inc.js`)

```javascript
// TinyWidget: Altitude +100
// Category: Autopilot
// Action: increment

(function(api, state, flightData) {
    const newAlt = Math.min(45000, flightData.apAltSet + 100);
    api.send('AP_ALT_VAR_SET_ENGLISH', newAlt);
    
    return { value: newAlt };
})
```

---

## Display Types

| Type | Visual | Use Case |
|------|--------|----------|
| `led` | Colored dot | On/off states |
| `button` | Pressable button | Triggers |
| `value` | Number display | Settings |
| `gauge` | Mini arc gauge | Percentages |
| `icon` | Icon only | Simple actions |

---

## Wheel Integration

```javascript
class ActionWheel {
    constructor(container) {
        this.container = container;
        this.widgets = [];
        this.activeCategory = null;
    }
    
    async loadWidgets() {
        const manifest = await fetch('/tinywidgets/manifest.json').then(r => r.json());
        
        for (const widgetPath of manifest.widgets) {
            const config = await fetch(`/tinywidgets/${widgetPath}.json`).then(r => r.json());
            const code = await fetch(`/tinywidgets/${widgetPath}.js`).then(r => r.text());
            
            this.widgets.push({
                config,
                action: new Function('api', 'state', 'flightData', code)
            });
        }
    }
    
    render() {
        // Render circular wheel with widgets
        const angleStep = 360 / this.widgets.length;
        
        this.widgets.forEach((widget, i) => {
            const angle = i * angleStep;
            const btn = this.createButton(widget, angle);
            this.container.appendChild(btn);
        });
    }
    
    createButton(widget, angle) {
        const btn = document.createElement('button');
        btn.className = 'wheel-btn';
        btn.innerHTML = widget.config.icon;
        btn.title = widget.config.name;
        btn.style.transform = `rotate(${angle}deg) translateY(-80px)`;
        
        btn.addEventListener('click', () => this.execute(widget));
        return btn;
    }
    
    execute(widget) {
        const result = widget.action(this.api, widget.state, this.flightData);
        widget.state = { ...widget.state, ...result };
        this.updateDisplay(widget);
    }
}
```

---

## Quick Examples

### Lights Category

| ID | Name | Icon | Action |
|----|------|------|--------|
| `nav-toggle` | NAV | 💡 | Toggle nav lights |
| `beacon-toggle` | BCN | 🔴 | Toggle beacon |
| `strobe-toggle` | STRB | ⚡ | Toggle strobes |
| `landing-toggle` | LAND | 🔦 | Toggle landing lights |
| `taxi-toggle` | TAXI | 🚕 | Toggle taxi lights |

### Autopilot Category

| ID | Name | Icon | Action |
|----|------|------|--------|
| `ap-master` | AP | 🎯 | Toggle AP master |
| `hdg-hold` | HDG | 🧭 | Toggle heading hold |
| `hdg-sync` | SYNC | ↻ | Sync heading bug |
| `alt-hold` | ALT | ⬆️ | Toggle altitude hold |
| `alt-inc` | +100 | ➕ | Altitude +100ft |
| `alt-dec` | -100 | ➖ | Altitude -100ft |

### Camera Category

| ID | Name | Icon | Action |
|----|------|------|--------|
| `cockpit` | CPT | 🎯 | Cockpit view |
| `external` | EXT | 🛫 | External view |
| `drone` | DRN | 🚁 | Drone camera |
| `showcase` | SHW | 🎬 | Showcase view |

---

## Benefits

1. **Modular** - Add/remove without touching core code
2. **User-Customizable** - Users can create their own
3. **Wheel-Ready** - Designed for radial menu
4. **Lightweight** - ~1KB per widget
5. **Discoverable** - Self-describing manifest
6. **Shareable** - JSON + JS = easy to distribute

---

## File Locations

| File | Purpose |
|------|---------|
| `/tinywidgets/manifest.json` | Master registry |
| `/tinywidgets/{category}/{id}.json` | Widget manifest |
| `/tinywidgets/{category}/{id}.js` | Widget action |
| `/ui/shared/action-wheel.js` | Wheel component |
| `/ui/shared/tinywidget-loader.js` | Dynamic loader |
