# SimWidget Engine - Widget Inventory & Standards
**Version:** 1.0.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\WIDGET-INVENTORY.md`

---

## Widget Types

| Type | Purpose | Examples |
|------|---------|----------|
| **Control** | User input, aircraft manipulation | Aircraft Control, Camera, Keymap Editor |
| **Display** | Read-only data visualization | Flight Data, Fuel Widget |
| **Tool** | Utility functions | Voice Control, Flight Recorder |
| **TinyWidget** | Single-action micro-widgets | Light toggles, AP buttons |

---

## Current Widget Inventory

### Full Widgets

| Widget | Type | Version | Components |
|--------|------|---------|------------|
| Aircraft Control | Control | v1.2.0 | Header, Autopilot Panel, Engine Panel, Lights Panel, AxisPad, Settings |
| Flight Data | Display | v1.1.0 | Header, Data Grid, Wind Indicator |
| Fuel Widget | Display/Control | v2.3.0 | Header, Tank Visualization, Controls, Stats |
| Camera Widget | Control | v1.0.0 | Header, View Buttons, Zoom Slider |
| Voice Control | Tool | v1.0.0 | Header, Status, Command List, Settings |
| Flight Recorder | Tool | v1.4.0 | Header, Transport Controls, Session List, Stats |
| Keymap Editor | Tool | v3.0.0 | Header, Category Tabs, Binding Grid, Import/Export |

### TinyWidgets (13)

| Category | Count | Widgets |
|----------|-------|---------|
| Lights | 5 | nav, beacon, strobe, landing, taxi |
| Autopilot | 5 | master, hdg-hold, hdg-sync, alt-hold, vs-hold |
| Camera | 3 | cockpit, external, drone |

---

## Standard File Structure

```
widget-name/
├── index.html       # Entry point (required)
├── widget.js        # Logic (required)
├── widget.css       # Styles (required)
└── manifest.json    # Metadata (optional but recommended)
```

---

## Default Components by Widget Type

### 1. CONTROL Widget Components

Control widgets manipulate aircraft state.

**Required Components:**
- Header with title and controls
- Primary action area (buttons, sliders)
- Status indicator (connection state)
- Settings panel

**Optional Components:**
- Secondary controls
- Feedback display
- Presets/profiles

**Example Layout:**
```
┌─────────────────────────────────┐
│ [Icon] Widget Name    [👁][⚙️] │  ← Header
├─────────────────────────────────┤
│ ● Connected                     │  ← Status
├─────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ BTN │ │ BTN │ │ BTN │       │  ← Primary Actions
│  └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│  Label ═══════════○═══ Value   │  ← Sliders
├─────────────────────────────────┤
│  [Secondary Controls]           │  ← Optional
└─────────────────────────────────┘
```

---

### 2. DISPLAY Widget Components

Display widgets show read-only data.

**Required Components:**
- Header with title
- Data grid or visualization
- Update indicator

**Optional Components:**
- Trend graphs
- Min/max tracking
- Export button

**Example Layout:**
```
┌─────────────────────────────────┐
│ [Icon] Widget Name    [👁][⚙️] │  ← Header
├─────────────────────────────────┤
│  Altitude      │  Heading      │
│  ┌──────────┐  │  ┌──────────┐ │
│  │  12,500  │  │  │   275°   │ │  ← Data Cards
│  │    ft    │  │  │          │ │
│  └──────────┘  │  └──────────┘ │
├─────────────────────────────────┤
│  Speed         │  V/S         │
│  ┌──────────┐  │  ┌──────────┐ │
│  │   245    │  │  │  +1,200  │ │
│  │   kts    │  │  │   fpm    │ │
│  └──────────┘  │  └──────────┘ │
└─────────────────────────────────┘
```

---

### 3. TOOL Widget Components

Tool widgets provide utility functions.

**Required Components:**
- Header with title
- Primary action button(s)
- Status/progress indicator
- Output/results area

**Optional Components:**
- History/log
- Settings panel
- Export/import

**Example Layout:**
```
┌─────────────────────────────────┐
│ [Icon] Widget Name    [👁][⚙️] │  ← Header
├─────────────────────────────────┤
│  ┌─────────────────────────────┐│
│  │  ● Status Message           ││  ← Status Area
│  └─────────────────────────────┘│
├─────────────────────────────────┤
│  [▶ Start] [⏸ Pause] [⏹ Stop] │  ← Transport/Actions
├─────────────────────────────────┤
│  ┌─────────────────────────────┐│
│  │ Output / Results / Log      ││  ← Results Area
│  │ ─────────────────────────── ││
│  │ Item 1                      ││
│  │ Item 2                      ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

---

### 4. TINYWIDGET Components

Single-action micro-widgets.

**Required Components:**
- Icon/indicator
- Label
- Single action (tap/toggle)

**Example Layout:**
```
┌───────────┐
│    💡     │  ← Icon (state indicator)
│   NAV     │  ← Label
│   [ON]    │  ← State badge
└───────────┘
```

---

## Standard Component Library

### Header Component

```html
<div class="widget-header">
    <div class="header-left">
        <span class="widget-icon">✈️</span>
        <h1 class="widget-title">Widget Name</h1>
    </div>
    <div class="header-controls">
        <button class="btn-icon" id="btn-transparency" title="Toggle Transparency">👁</button>
        <button class="btn-icon" id="btn-settings" title="Settings">⚙️</button>
    </div>
</div>
```

### Status Indicator Component

```html
<div class="status-bar">
    <span class="status-dot" id="status-dot"></span>
    <span class="status-text" id="status-text">Connecting...</span>
</div>
```

### Button Component

```html
<!-- Standard Button -->
<button class="btn btn-primary">Action</button>

<!-- Icon Button -->
<button class="btn btn-icon">🎯</button>

<!-- Toggle Button -->
<button class="btn btn-toggle" data-active="false">
    <span class="toggle-label">OFF</span>
</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>
```

### Slider Component

```html
<div class="slider-group">
    <label class="slider-label">
        <span class="label-text">Heading</span>
        <span class="label-value" id="hdg-value">275°</span>
    </label>
    <input type="range" class="slider" id="hdg-slider" 
           min="0" max="359" value="275">
</div>
```

### Data Card Component

```html
<div class="data-card">
    <div class="data-label">Altitude</div>
    <div class="data-value" id="altitude">12,500</div>
    <div class="data-unit">ft</div>
</div>
```

### Panel/Section Component

```html
<div class="panel">
    <div class="panel-header">
        <span class="panel-title">Autopilot</span>
        <button class="panel-toggle">▼</button>
    </div>
    <div class="panel-content">
        <!-- Panel contents -->
    </div>
</div>
```

### Transport Controls Component

```html
<div class="transport-controls">
    <button class="btn btn-record" id="btn-record">⏺ Record</button>
    <button class="btn btn-pause" id="btn-pause" disabled>⏸ Pause</button>
    <button class="btn btn-stop" id="btn-stop" disabled>⏹ Stop</button>
    <button class="btn btn-play" id="btn-play" disabled>▶ Play</button>
</div>
```

### List Component

```html
<div class="list-container">
    <div class="list-header">
        <span class="list-title">Sessions</span>
        <span class="list-count">(3)</span>
    </div>
    <ul class="list">
        <li class="list-item">
            <span class="item-icon">📄</span>
            <span class="item-text">Session 1</span>
            <span class="item-meta">2:30</span>
        </li>
    </ul>
</div>
```

### Settings Panel Component

```html
<div class="settings-panel" id="settings-panel" hidden>
    <div class="settings-header">
        <span>Settings</span>
        <button class="btn-close" id="settings-close">✕</button>
    </div>
    <div class="settings-content">
        <div class="setting-row">
            <label>Option Name</label>
            <input type="checkbox" id="setting-option">
        </div>
        <div class="setting-row">
            <label>Select Option</label>
            <select id="setting-select">
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
            </select>
        </div>
    </div>
</div>
```

---

## CSS Class Reference

### Layout Classes
| Class | Purpose |
|-------|---------|
| `.widget-container` | Root container |
| `.widget-header` | Top bar with title/controls |
| `.widget-content` | Main content area |
| `.widget-footer` | Bottom bar (optional) |

### Component Classes
| Class | Purpose |
|-------|---------|
| `.btn` | Base button |
| `.btn-primary` | Primary action |
| `.btn-secondary` | Secondary action |
| `.btn-danger` | Destructive action |
| `.btn-icon` | Icon-only button |
| `.btn-toggle` | Toggle state button |
| `.slider` | Range input |
| `.slider-group` | Slider with label |
| `.data-card` | Data display card |
| `.panel` | Collapsible section |
| `.list` | Scrollable list |
| `.status-bar` | Connection status |

### State Classes
| Class | Purpose |
|-------|---------|
| `.active` | Active/on state |
| `.disabled` | Disabled state |
| `.loading` | Loading state |
| `.error` | Error state |
| `.connected` | Connected state |
| `.disconnected` | Disconnected state |

### Utility Classes
| Class | Purpose |
|-------|---------|
| `.hidden` | Display none |
| `.transparent` | 50% opacity mode |
| `.desktop-only` | Hide on mobile |
| `.mobile-only` | Hide on desktop |

---

## Manifest Schema

```json
{
    "id": "widget-id",
    "name": "Widget Display Name",
    "version": "1.0.0",
    "type": "control|display|tool|tiny",
    "author": "Author Name",
    "description": "Widget description",
    "category": "Category Name",
    "entry": "index.html",
    "width": 320,
    "height": 400,
    "minWidth": 200,
    "minHeight": 200,
    "resizable": true,
    "transparent": true,
    "simVars": ["VAR1", "VAR2"],
    "commands": ["CMD1", "CMD2"],
    "dependencies": ["shared/widget-base.js"],
    "settings": {
        "option1": { "type": "boolean", "default": true },
        "option2": { "type": "number", "default": 50, "min": 0, "max": 100 }
    }
}
```

---

## Creating a New Widget

1. Copy appropriate template from `templates/`
2. Update `manifest.json` with widget info
3. Implement widget logic in `widget.js`
4. Style with `widget.css` (extend base styles)
5. Add to test suite
6. Document in this inventory

See `docs/WIDGET-CREATION-GUIDE.md` for detailed instructions.
