# SimWidget Component Architecture
**Version:** v1.0.0  
**Last Updated:** 2025-01-05  
**Path:** C:\LLM-DevOSWE\SimWidget_Engine\docs\COMPONENT-ARCHITECTURE.md

## Overview

This document defines the standardized component system for SimWidget Engine widgets. Components are reusable UI elements that can be placed on widget canvases and bound to SimConnect variables.

---

## Naming Conventions

### Component Type Naming

| Old Name | New Name | Purpose |
|----------|----------|---------|
| display | `DataField` | Show numeric/text values |
| button | `PushButton` | Momentary action triggers |
| indicator | `StatusLamp` | On/off visual indicator |
| gauge | `ProgressBar` | 0-100% linear display |
| label | `TextLabel` | Static text annotation |
| spacer | `Spacer` | Layout gap/divider |
| knob | `RotaryKnob` | Rotary encoder input |
| slider | `LinearSlider` | Single-axis linear input |
| joystick | `AxisPad` | Multi-axis control input |
| toggle | `ToggleSwitch` | Two-state toggle |
| rocker | `RockerSwitch` | Momentary up/down |

### Category Naming

```
swc-  = SimWidget Component (prefix for all)
-df   = DataField
-pb   = PushButton
-sl   = StatusLamp
-pg   = ProgressBar
-tl   = TextLabel
-sp   = Spacer
-rk   = RotaryKnob
-ls   = LinearSlider
-ap   = AxisPad
-ts   = ToggleSwitch
-rs   = RockerSwitch
```

### CSS Class Convention

```css
.swc-[type]           /* Base component class */
.swc-[type]--active   /* Active state */
.swc-[type]--disabled /* Disabled state */
.swc-[type]__[part]   /* Component part (BEM) */
```

---

## Component Base Class

All components inherit from `SWComponent`:

```javascript
class SWComponent {
    constructor(config) {
        this.id = config.id || crypto.randomUUID();
        this.type = config.type;
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 100;
        this.height = config.height || 100;
        this.simvar = config.simvar || null;
        this.unit = config.unit || 'number';
        this.command = config.command || null;
        this.label = config.label || '';
        this.enabled = config.enabled !== false;
        this.value = 0;
        this.element = null;
    }
    
    // Lifecycle methods
    render(container) { /* Create DOM element */ }
    update(value) { /* Update with new simvar value */ }
    destroy() { /* Cleanup */ }
    
    // Serialization
    toJSON() { /* Export config */ }
    static fromJSON(json) { /* Create from config */ }
}
```

---

## Universal SimVars (Work with ALL Aircraft)

### Flight Controls (AxisPad/LinearSlider compatible)

| SimVar | Unit | Range | Command |
|--------|------|-------|---------|
| `AILERON POSITION` | position | -1 to 1 | `AXIS_AILERONS_SET` |
| `ELEVATOR POSITION` | position | -1 to 1 | `AXIS_ELEVATOR_SET` |
| `RUDDER POSITION` | position | -1 to 1 | `AXIS_RUDDER_SET` |
| `YOKE X POSITION` | position | -1 to 1 | (same as aileron) |
| `YOKE Y POSITION` | position | -1 to 1 | (same as elevator) |

### Throttle/Engine (LinearSlider compatible)

| SimVar | Unit | Range | Command |
|--------|------|-------|---------|
| `GENERAL ENG THROTTLE LEVER POSITION:1` | percent | 0-100 | `THROTTLE_SET` |
| `PROPELLER LEVER POSITION:1` | percent | 0-100 | `PROP_PITCH_SET` |
| `MIXTURE LEVER POSITION:1` | percent | 0-100 | `MIXTURE_SET` |

### Trim (RotaryKnob/RockerSwitch compatible)

| SimVar | Unit | Range | Command Up | Command Down |
|--------|------|-------|------------|--------------|
| `ELEVATOR TRIM POSITION` | degrees | -20 to +20 | `ELEV_TRIM_UP` | `ELEV_TRIM_DN` |
| `RUDDER TRIM PCT` | percent | -100 to 100 | `RUDDER_TRIM_LEFT` | `RUDDER_TRIM_RIGHT` |
| `AILERON TRIM PCT` | percent | -100 to 100 | `AILERON_TRIM_LEFT` | `AILERON_TRIM_RIGHT` |

---

## AxisPad Component (Joystick)

The `AxisPad` is a 2-axis input control that maps to dual SimVars.

### Configuration

```javascript
{
    type: 'AxisPad',
    id: 'flight-stick',
    label: 'Flight Controls',
    width: 150,
    height: 150,
    
    // X-axis (horizontal movement)
    xAxis: {
        simvar: 'A:YOKE X POSITION',
        unit: 'position',
        command: 'AXIS_AILERONS_SET',
        min: -16383,
        max: 16383,
        center: 0,
        deadzone: 0.05,
        sensitivity: 1.0,
        inverted: false
    },
    
    // Y-axis (vertical movement)
    yAxis: {
        simvar: 'A:YOKE Y POSITION',
        unit: 'position',
        command: 'AXIS_ELEVATOR_SET',
        min: -16383,
        max: 16383,
        center: 0,
        deadzone: 0.05,
        sensitivity: 1.0,
        inverted: false
    },
    
    // Visual options
    style: 'round',      // 'round' | 'square'
    showGrid: true,
    showCrosshair: true,
    returnToCenter: true,
    springStrength: 0.8
}
```

### Visual Design

```
┌─────────────────────┐
│    ─────┼─────      │  <- Crosshair guides
│         │           │
│  ───────●───────    │  <- Center indicator
│         │           │
│    ─────┼─────      │
│                     │
│        [○]          │  <- Draggable knob
│                     │
└─────────────────────┘
```

### Interaction Modes

1. **Drag Mode**: Click and drag the knob
2. **Touch Mode**: Touch/drag for mobile
3. **Click-to-Position**: Click anywhere to move knob
4. **Keyboard**: Arrow keys when focused

---

## Component Registry

```javascript
const ComponentRegistry = {
    // Input Components
    'AxisPad': AxisPadComponent,
    'LinearSlider': LinearSliderComponent,
    'RotaryKnob': RotaryKnobComponent,
    'PushButton': PushButtonComponent,
    'ToggleSwitch': ToggleSwitchComponent,
    'RockerSwitch': RockerSwitchComponent,
    
    // Display Components
    'DataField': DataFieldComponent,
    'StatusLamp': StatusLampComponent,
    'ProgressBar': ProgressBarComponent,
    'TextLabel': TextLabelComponent,
    
    // Layout Components
    'Spacer': SpacerComponent,
    'Panel': PanelComponent,
    'Divider': DividerComponent
};
```

---

## Presets (Quick Component Setup)

### Flight Control Presets

```javascript
const PRESETS = {
    'yoke': {
        type: 'AxisPad',
        label: 'Yoke',
        xAxis: { simvar: 'A:YOKE X POSITION', command: 'AXIS_AILERONS_SET' },
        yAxis: { simvar: 'A:YOKE Y POSITION', command: 'AXIS_ELEVATOR_SET' }
    },
    
    'rudder-pedals': {
        type: 'LinearSlider',
        label: 'Rudder',
        orientation: 'horizontal',
        simvar: 'A:RUDDER POSITION',
        command: 'AXIS_RUDDER_SET',
        centerReturn: true
    },
    
    'throttle': {
        type: 'LinearSlider',
        label: 'Throttle',
        orientation: 'vertical',
        simvar: 'A:GENERAL ENG THROTTLE LEVER POSITION:1',
        command: 'THROTTLE_SET',
        centerReturn: false
    },
    
    'trim-wheel': {
        type: 'RotaryKnob',
        label: 'Trim',
        simvar: 'A:ELEVATOR TRIM POSITION',
        commandUp: 'ELEV_TRIM_UP',
        commandDown: 'ELEV_TRIM_DN'
    }
};
```

---

## Widget Canvas System

Widgets are composed of a canvas where components can be freely positioned:

```javascript
class WidgetCanvas {
    constructor(container, config) {
        this.container = container;
        this.components = new Map();
        this.selectedComponent = null;
        this.editMode = false;
        this.gridSize = 10;
        this.snapToGrid = true;
    }
    
    // Component management
    addComponent(type, config) { /* Add to canvas */ }
    removeComponent(id) { /* Remove from canvas */ }
    getComponent(id) { /* Get by ID */ }
    
    // Selection
    selectComponent(id) { /* Select for editing */ }
    deselectAll() { /* Clear selection */ }
    
    // Positioning
    moveComponent(id, x, y) { /* Move component */ }
    resizeComponent(id, w, h) { /* Resize component */ }
    
    // Serialization
    exportLayout() { /* Export all components */ }
    importLayout(data) { /* Import components */ }
}
```

---

## Related Documents

- **COMPONENT-REGISTRY.md** - Complete catalog of implemented components
- **WIDGET-CREATION-GUIDE.md** - How to use components in widgets
- **SIMVARS-REFERENCE.md** - SimVar catalog for data binding

---

## Changelog

### v1.1.0 (2026-01-05)
- Added Related Documents section
- AxisPad component now implemented in shared-ui
- Cross-referenced with COMPONENT-REGISTRY.md

### v1.0.0 (2025-01-05)
- Initial component architecture definition
- Defined naming conventions (Old → New)
- Documented universal SimVars for all aircraft
- Created AxisPad (joystick) specification
- Established preset system
- Widget canvas system design
