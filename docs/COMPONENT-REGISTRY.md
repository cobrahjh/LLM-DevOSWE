# SimWidget Engine - Component Registry
**Version:** v1.1.0  
**Last Updated:** 2025-01-07  
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\docs\COMPONENT-REGISTRY.md

---

## Overview

This document catalogs all UI components, buttons, controls, and elements available in SimWidget Engine. Use this as a reference when building widgets.

---

## Shared Components

### Connection Status Indicator

Standard status indicator for all widgets showing connection state.

**Location:** `/ui/shared/widget-common.css`, `/ui/shared/widget-base.js`

**HTML:**
```html
<span class="connection-status" id="conn-status" title="Disconnected">●</span>
```

**CSS Classes:**
| Class | Color | State |
|-------|-------|-------|
| `.connection-status` | Red (#f87171) | Disconnected (default) |
| `.connection-status.connected` | Green (#4ade80) | Connected to MSFS |
| `.connection-status.connecting` | Yellow (#fbbf24) | Connecting (animated) |

**JavaScript:**
```javascript
// Using SimWidgetBase class
const widget = new SimWidgetBase();
widget.updateConnectionStatus('connected'); // 'connected', 'connecting', 'disconnected', 'mock'

// Manual update
const el = document.getElementById('conn-status');
el.classList.add('connected');
el.title = 'Connected to MSFS';
```

### Widget Header

Standard header structure for all widgets.

**HTML:**
```html
<div class="widget-header">
    <span class="widget-title">✈️ WIDGET NAME</span>
    <span class="widget-brand">SimWidget</span>
    <span class="connection-status" id="conn-status" title="Disconnected">●</span>
</div>
```

### Platform Visibility Classes

Hide/show elements based on platform.

| Class | Desktop | Mobile | MSFS Panel |
|-------|---------|--------|------------|
| `.desktop-only` | ✅ | ❌ | ❌ |
| `.mobile-only` | ❌ | ✅ | ❌ |
| `.msfs-panel-only` | ❌ | ❌ | ✅ |

**Usage:**
```html
<button class="desktop-only">Desktop Feature</button>
<button class="mobile-only">Touch Control</button>
```

---

## Aircraft Control Auto-Detection

SimWidget automatically detects which engine controls are used by the current aircraft and hides unused controls.

### How It Works

1. **Sample Collection** - First 20 updates (~2 seconds) of flight data
2. **Variance Analysis** - If a control never changes and is stuck at 0% or 100%, it's probably not used
3. **Auto-Hide** - Unused controls fade out with smooth CSS transition

### Detection Results by Aircraft Type

| Aircraft Type | Throttle | Propeller | Mixture | Detection Logic |
|---------------|----------|-----------|---------|-----------------|
| Fixed-pitch piston | ✅ | ❌ (stuck at 100%) | ✅ | C172, C152 |
| Variable-pitch piston | ✅ | ✅ | ✅ | C182, Bonanza |
| Turboprop | ✅ | ✅ | ✅* | King Air |
| Jet | ✅ | ❌ (stuck at 100%) | ❌ (stuck at 0%) | Airliners |

**Detection Rules:**
- **Propeller**: Hide only if stuck at 100% with zero variance (fixed-pitch)
- **Mixture**: Hide only if stuck at 0% (jets) - NEVER hide if at usable value like 100%

### Manual Override

```javascript
// Force show a control
window.simWidget.setControlVisibility('propeller', true);

// Force hide a control
window.simWidget.setControlVisibility('mixture', false);
```

### Configuration

In `app.js`, modify `controlDetection` defaults:
```javascript
this.controlDetection = {
    throttle: { visible: true },   // Always visible
    propeller: { visible: false }, // Force hidden
    mixture: { visible: true }     // Auto-detect
};
```

---

## AxisPad Configuration

The AxisPad joystick control has configurable inversion and sensitivity settings.

### Sensitivity Control

A sensitivity slider is available in the Flight Controls section:
- Range: 10% to 100%
- Default: 50%
- Affects: AxisPad (aileron/elevator) and Rudder slider

**Lower sensitivity** = smaller control deflections (smoother, finer control)
**Higher sensitivity** = larger control deflections (more responsive)

### Inversion Settings

In `app.js`, modify `axisConfig`:
```javascript
this.axisConfig = {
    invertAileron: true,   // Flip LEFT/RIGHT direction
    invertElevator: false  // Flip UP/DOWN direction
};
```

### Default Behavior
- **Drag RIGHT** → Roll RIGHT (with invertAileron: true)
- **Drag UP** → Nose UP

---

## Component Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Implemented | Fully working, tested |
| 🔨 In Progress | Partially implemented |
| 📋 Planned | Designed, not built |
| ❌ Deprecated | Do not use |

---

## Input Components

### Sensitivity Slider
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-05 |
| **CSS Class** | `.sensitivity-control`, `.sens-slider` |
| **Type** | Range slider (10-100%) |
| **Purpose** | Adjust responsiveness of flight controls |

**Affects:**
- AxisPad (aileron + elevator)
- Rudder slider

**Element IDs:**
- `fc-sensitivity` - The slider input
- `sens-value` - Value display (e.g., "50%")

---

### AxisPad (Joystick Control)
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-05 |
| **CSS Class** | `.swc-ap`, `.axispad` |
| **Type** | 2-axis drag input |
| **Purpose** | Flight control (aileron + elevator) |

**Configuration:**
```javascript
{
    xAxis: {
        simvar: 'A:YOKE X POSITION',
        command: 'AXIS_AILERONS_SET',
        range: [-100, 100]
    },
    yAxis: {
        simvar: 'A:YOKE Y POSITION', 
        command: 'AXIS_ELEVATOR_SET',
        range: [-100, 100]
    },
    returnToCenter: true,
    style: 'round'
}
```

**Files:**
- HTML: `simwidget-hybrid/shared-ui/index.html` (lines 130-145)
- CSS: `simwidget-hybrid/shared-ui/styles.css` (lines 521-692)
- JS: `simwidget-hybrid/shared-ui/app.js` (setupAxisPad method)

---

### LinearSlider
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-04 |
| **CSS Class** | `.swc-ls`, `.lever`, `.fc-slider`, `.ap-slider` |
| **Type** | Single-axis range input |
| **Purpose** | Throttle, mixture, AP values, flight controls |

**Variants:**
| Variant | CSS Class | Orientation | Use Case |
|---------|-----------|-------------|----------|
| Engine Lever | `.lever` | Vertical | Throttle, Prop, Mixture |
| Flight Control | `.fc-slider` | Horizontal | Aileron, Elevator, Rudder |
| Autopilot | `.ap-slider` | Horizontal | HDG, ALT, VS, SPD |

**Commands Supported:**
- `THROTTLE_SET` (0-100)
- `PROP_PITCH_SET` (0-100)
- `MIXTURE_SET` (0-100)
- `AXIS_AILERONS_SET` (-100 to 100)
- `AXIS_ELEVATOR_SET` (-100 to 100)
- `AXIS_RUDDER_SET` (-100 to 100)
- `HEADING_BUG_SET` (0-359)
- `AP_ALT_VAR_SET_ENGLISH` (0-45000)
- `AP_VS_VAR_SET_ENGLISH` (-4000 to 4000)
- `AP_SPD_VAR_SET` (60-400)

---

### RotaryKnob
| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **CSS Class** | `.swc-rk` |
| **Type** | Rotary encoder input |
| **Purpose** | Heading bug, altimeter, radio tuning |

**Planned Features:**
- Click-drag rotation
- Scroll wheel support
- Fine/coarse adjustment modes
- Numeric display integration

---

### PushButton
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-04 |
| **CSS Class** | `.swc-pb`, `.btn` |
| **Type** | Momentary action button |
| **Purpose** | Toggle lights, systems, AP modes |

**States:**
| State | CSS Modifier | Description |
|-------|--------------|-------------|
| Default | - | Idle state |
| Hover | `:hover` | Mouse over |
| Active | `:active` | Being clicked |
| On | `.on` | Toggle is active |
| Warning | `.warn` | Caution state |

**Current Instances:**

| Button ID | Label | Command | Section |
|-----------|-------|---------|---------|
| `btn-brk` | P.BRK | `PARKING_BRAKES` | Systems |
| `btn-gear` | GEAR | `GEAR_TOGGLE` | Systems |
| `btn-flaps` | FLAPS | `FLAPS_UP/DOWN` | Systems |
| `btn-nav` | NAV | `TOGGLE_NAV_LIGHTS` | Lights |
| `btn-bcn` | BCN | `TOGGLE_BEACON_LIGHTS` | Lights |
| `btn-strb` | STRB | `STROBES_TOGGLE` | Lights |
| `btn-ldg` | LDG | `LANDING_LIGHTS_TOGGLE` | Lights |
| `btn-taxi` | TAXI | `TOGGLE_TAXI_LIGHTS` | Lights |
| `btn-ap` | AP | `AP_MASTER` | Autopilot |
| `btn-hdg` | HDG | `AP_HDG_HOLD` | Autopilot |
| `btn-alt` | ALT | `AP_ALT_HOLD` | Autopilot |
| `btn-vs` | VS | `AP_VS_HOLD` | Autopilot |
| `btn-spd` | SPD | `AP_PANEL_SPEED_HOLD` | Autopilot |
| `btn-view` | I/E | `VIEW_MODE` | Camera |
| `btn-cine` | TCM | `KEY_TOGGLE_CINEMATIC` | Camera |
| `btn-nextcam` | NCV | `KEY_NEXT_CINEMATIC` | Camera |
| `btn-center` | CENTER | `CENTER_AILER_RUDDER` | Flight Controls |

---

### ToggleSwitch
| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **CSS Class** | `.swc-ts` |
| **Type** | Two-state toggle |
| **Purpose** | On/off switches |

---

### RockerSwitch
| Property | Value |
|----------|-------|
| **Status** | 🔨 In Progress |
| **CSS Class** | `.swc-rs`, `.ap-adj` |
| **Type** | Momentary up/down |
| **Purpose** | Increment/decrement values |

**Current Implementation:**
- AP adjustment buttons (+/−) with press-and-hold repeat

**Commands:**
| Button | Command |
|--------|---------|
| HDG − | `HEADING_BUG_DEC` |
| HDG + | `HEADING_BUG_INC` |
| ALT − | `AP_ALT_VAR_DEC` |
| ALT + | `AP_ALT_VAR_INC` |
| VS − | `AP_VS_VAR_DEC` |
| VS + | `AP_VS_VAR_INC` |
| SPD − | `AP_SPD_VAR_DEC` |
| SPD + | `AP_SPD_VAR_INC` |

---

## Display Components

### DataField
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-04 |
| **CSS Class** | `.swc-df`, `.di` |
| **Type** | Numeric/text display |
| **Purpose** | Show flight data values |

**Structure:**
```html
<div class="di">
    <span class="dl">Label</span>
    <span class="dv">Value</span>
</div>
```

**Current Instances:**

| Element ID | Label | SimVar | Unit | Section |
|------------|-------|--------|------|---------|
| `acw-alt` | Altitude | `PLANE ALTITUDE` | ft | Flight Data |
| `acw-spd` | Speed | `AIRSPEED INDICATED` | kts | Flight Data |
| `acw-hdg` | Heading | `PLANE HEADING DEGREES MAGNETIC` | ° | Flight Data |
| `acw-vs` | V/S | `VERTICAL SPEED` | fpm | Flight Data |
| `fuel-total` | Total | `FUEL TOTAL QUANTITY` | gal | Fuel |
| `fuel-flow` | Flow | `ENG FUEL FLOW GPH:1` | gph | Fuel |
| `fuel-left` | Left Tank | `FUEL LEFT QUANTITY` | gal | Fuel |
| `fuel-right` | Right Tank | `FUEL RIGHT QUANTITY` | gal | Fuel |
| `fuel-endur` | Endurance | (calculated) | h:mm | Fuel |
| `acw-eng` | Status | `ENG COMBUSTION:1` | ON/OFF | Engine |
| `acw-time` | Time | `LOCAL TIME` | hh:mm | Footer |

---

### StatusLamp (Indicator)
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **Added** | 2026-01-04 |
| **CSS Class** | `.swc-sl`, `.sd` |
| **Type** | On/off indicator light |
| **Purpose** | Show boolean states |

**States:**
| State | CSS Class | Color |
|-------|-----------|-------|
| Off | `.off` | Dark gray |
| On | `.on` | Green (#22c55e) |

**Used In:** All toggle buttons (lights, systems, AP modes)

---

### ProgressBar
| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **CSS Class** | `.swc-pg` |
| **Type** | 0-100% bar display |
| **Purpose** | Fuel level, engine power |

---

### TextLabel
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **CSS Class** | `.swc-tl`, `.sh`, `.dl` |
| **Type** | Static text |
| **Purpose** | Section headers, labels |

**Variants:**
| Variant | CSS Class | Use |
|---------|-----------|-----|
| Section Header | `.sh` | "FLIGHT DATA", "AUTOPILOT" |
| Data Label | `.dl` | "Altitude", "Speed" |
| Footer Text | `.ftr span` | "SimWidget v1.0" |

---

## Layout Components

### Section
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **CSS Class** | `.sec` |
| **Purpose** | Group related controls |

**Current Sections:**
1. Flight Data
2. Systems
3. Autopilot
4. Fuel
5. Lights
6. Camera
7. Flight Controls
8. Engine

---

### DataGrid
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **CSS Class** | `.dg` |
| **Purpose** | 2-column data layout |

---

### ButtonRow
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **CSS Class** | `.sr` |
| **Purpose** | Horizontal button group |

---

### Spacer
| Property | Value |
|----------|-------|
| **Status** | 📋 Planned |
| **CSS Class** | `.swc-sp` |
| **Purpose** | Visual gap/divider |

---

## Container Components

### Widget Header
| Property | Value |
|----------|-------|
| **CSS Class** | `.hdr` |
| **Contains** | Title, aircraft name, connection status |

---

### Widget Footer
| Property | Value |
|----------|-------|
| **CSS Class** | `.ftr` |
| **Contains** | Version, sim time |

---

### Connection Indicator
| Property | Value |
|----------|-------|
| **Status** | ✅ Implemented |
| **CSS Class** | `.conn` |
| **Element ID** | `conn-status` |

**States:**
| State | CSS Class | Color | Meaning |
|-------|-----------|-------|---------|
| Connected | `.connected` | Green | Live MSFS data |
| Mock | `.mock` | Yellow | Using simulated data |
| Connecting | `.connecting` | Blue | Establishing connection |
| Disconnected | `.disconnected` | Red | No server connection |

---

## SimVar Bindings

### Currently Bound SimVars

| SimVar | Unit | Element(s) |
|--------|------|------------|
| `PLANE ALTITUDE` | feet | `acw-alt` |
| `AIRSPEED INDICATED` | knots | `acw-spd` |
| `PLANE HEADING DEGREES MAGNETIC` | degrees | `acw-hdg` |
| `VERTICAL SPEED` | fpm | `acw-vs` |
| `BRAKE PARKING POSITION` | bool | `btn-brk` indicator |
| `GEAR HANDLE POSITION` | bool | `btn-gear` indicator |
| `FLAPS HANDLE INDEX` | number | `btn-flaps` indicator |
| `LIGHT NAV` | bool | `btn-nav` indicator |
| `LIGHT BEACON` | bool | `btn-bcn` indicator |
| `LIGHT STROBE` | bool | `btn-strb` indicator |
| `LIGHT LANDING` | bool | `btn-ldg` indicator |
| `LIGHT TAXI` | bool | `btn-taxi` indicator |
| `AUTOPILOT MASTER` | bool | `btn-ap` indicator |
| `AUTOPILOT HEADING LOCK` | bool | `btn-hdg` indicator |
| `AUTOPILOT ALTITUDE LOCK` | bool | `btn-alt` indicator |
| `AUTOPILOT VERTICAL HOLD` | bool | `btn-vs` indicator |
| `AUTOPILOT AIRSPEED HOLD` | bool | `btn-spd` indicator |
| `AUTOPILOT HEADING LOCK DIR` | degrees | `ap-hdg`, `ap-hdg-slider` |
| `AUTOPILOT ALTITUDE LOCK VAR` | feet | `ap-alt`, `ap-alt-slider` |
| `AUTOPILOT VERTICAL HOLD VAR` | fpm | `ap-vs`, `ap-vs-slider` |
| `AUTOPILOT AIRSPEED HOLD VAR` | knots | `ap-spd`, `ap-spd-slider` |
| `FUEL TOTAL QUANTITY` | gallons | `fuel-total` |
| `ENG FUEL FLOW GPH:1` | gph | `fuel-flow` |
| `FUEL LEFT QUANTITY` | gallons | `fuel-left` |
| `FUEL RIGHT QUANTITY` | gallons | `fuel-right` |
| `ENG COMBUSTION:1` | bool | `acw-eng` |
| `GENERAL ENG THROTTLE LEVER POSITION:1` | percent | `lever-thr`, `val-thr` |
| `GENERAL ENG PROPELLER LEVER POSITION:1` | percent | `lever-prop`, `val-prop` |
| `GENERAL ENG MIXTURE LEVER POSITION:1` | percent | `lever-mix`, `val-mix` |
| `AILERON POSITION` | position | `axispad-ail` |
| `ELEVATOR POSITION` | position | `axispad-elv` |
| `RUDDER POSITION` | position | `fc-rud`, `val-rud` |
| `LOCAL TIME` | hours | `acw-time` |

---

## Command Bindings

### Currently Bound Commands

| Command | Element(s) | Value Range |
|---------|------------|-------------|
| `PARKING_BRAKES` | `btn-brk` | toggle |
| `GEAR_TOGGLE` | `btn-gear` | toggle |
| `FLAPS_UP` | `btn-flaps` | - |
| `FLAPS_DOWN` | `btn-flaps` | - |
| `TOGGLE_NAV_LIGHTS` | `btn-nav` | toggle |
| `TOGGLE_BEACON_LIGHTS` | `btn-bcn` | toggle |
| `STROBES_TOGGLE` | `btn-strb` | toggle |
| `LANDING_LIGHTS_TOGGLE` | `btn-ldg` | toggle |
| `TOGGLE_TAXI_LIGHTS` | `btn-taxi` | toggle |
| `AP_MASTER` | `btn-ap` | toggle |
| `AP_HDG_HOLD` | `btn-hdg` | toggle |
| `AP_ALT_HOLD` | `btn-alt` | toggle |
| `AP_VS_HOLD` | `btn-vs` | toggle |
| `AP_PANEL_SPEED_HOLD` | `btn-spd` | toggle |
| `HEADING_BUG_SET` | `ap-hdg-slider` | 0-359 |
| `HEADING_BUG_INC` | HDG + button | - |
| `HEADING_BUG_DEC` | HDG − button | - |
| `AP_ALT_VAR_SET_ENGLISH` | `ap-alt-slider` | 0-45000 |
| `AP_ALT_VAR_INC` | ALT + button | - |
| `AP_ALT_VAR_DEC` | ALT − button | - |
| `AP_VS_VAR_SET_ENGLISH` | `ap-vs-slider` | -4000 to 4000 |
| `AP_VS_VAR_INC` | VS + button | - |
| `AP_VS_VAR_DEC` | VS − button | - |
| `AP_SPD_VAR_SET` | `ap-spd-slider` | 60-400 |
| `AP_SPD_VAR_INC` | SPD + button | - |
| `AP_SPD_VAR_DEC` | SPD − button | - |
| `THROTTLE_SET` | `lever-thr` | 0-100 |
| `PROP_PITCH_SET` | `lever-prop` | 0-100 |
| `MIXTURE_SET` | `lever-mix` | 0-100 |
| `AXIS_AILERONS_SET` | AxisPad X | -100 to 100 |
| `AXIS_ELEVATOR_SET` | AxisPad Y | -100 to 100 |
| `AXIS_RUDDER_SET` | `fc-rud` | -100 to 100 |
| `CENTER_AILER_RUDDER` | `btn-center` | - |
| `VIEW_MODE` | `btn-view` | toggle |
| `KEY_TOGGLE_CINEMATIC` | `btn-cine` | - |
| `KEY_NEXT_CINEMATIC` | `btn-nextcam` | - |

---

## File Locations

### Shared UI Components
| File | Path | Purpose |
|------|------|---------|
| index.html | `simwidget-hybrid/shared-ui/index.html` | Main widget HTML |
| styles.css | `simwidget-hybrid/shared-ui/styles.css` | All component styles |
| app.js | `simwidget-hybrid/shared-ui/app.js` | Component logic |

### Widget Examples
| Widget | Path |
|--------|------|
| Aircraft Control | `widgets/aircraft-control/` |
| Flight Data | `widgets/flight-data-widget/` |

### Documentation
| Document | Path |
|----------|------|
| Component Architecture | `docs/COMPONENT-ARCHITECTURE.md` |
| SimVars Reference | `docs/SIMVARS-REFERENCE.md` |
| Widget Creation Guide | `docs/WIDGET-CREATION-GUIDE.md` |
| This Registry | `docs/COMPONENT-REGISTRY.md` |

---

## Changelog

### v1.2.0 (2026-01-05)
- Added Sensitivity Slider component for flight controls
- Sensitivity affects AxisPad and Rudder (10% - 100%)
- Default sensitivity set to 50%

### v1.1.0 (2026-01-05)
- Added Aircraft Control Auto-Detection section
- Added AxisPad Configuration section with inversion settings
- Propeller/Mixture controls auto-hide for fixed-pitch and jet aircraft

### v1.0.0 (2026-01-05)
- Initial component registry
- Documented all implemented components
- Listed all SimVar and command bindings
- Added status tracking for each component
- Included file locations
