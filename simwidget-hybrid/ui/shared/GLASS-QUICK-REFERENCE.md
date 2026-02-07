# SimGlassBase Quick Reference

## Minimal Widget Template

```javascript
const API_BASE = `http://${window.location.hostname}:8080`;

class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-widget',
            widgetVersion: '1.0.0',
            autoConnect: true  // true = WebSocket, false = HTTP only
        });
        this.initElements();
        this.initEvents();
    }

    onMessage(data) {
        // Receive flight data (if autoConnect: true)
    }

    initElements() {
        // Cache DOM elements
    }

    initEvents() {
        // Set up event listeners
    }

    destroy() {
        // Clean up timers, listeners, etc.
        super.destroy(); // ALWAYS last
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
    window.addEventListener('beforeunload', () => window.myWidget?.destroy());
});
```

## autoConnect Decision Tree

```
Need real-time flight data? ────YES──→ autoConnect: true
    │
    NO
    │
    ↓
Is it a calculator/tool? ──────YES──→ autoConnect: false
```

## Common Cleanup Patterns

### Interval
```javascript
this.interval = setInterval(() => {}, 1000);

destroy() {
    if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
    }
    super.destroy();
}
```

### Timeout
```javascript
this.timeout = setTimeout(() => {}, 1000);

destroy() {
    if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
    }
    super.destroy();
}
```

### RequestAnimationFrame
```javascript
this.rafId = requestAnimationFrame(() => {});

destroy() {
    if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
    super.destroy();
}
```

### BroadcastChannel
```javascript
this.channel = new BroadcastChannel('SimGlass-sync');

destroy() {
    if (this.channel) {
        this.channel.close();
        this.channel = null;
    }
    super.destroy();
}
```

### Window Methods
```javascript
window.myMethod = () => this.handle();

destroy() {
    delete window.myMethod;
    super.destroy();
}
```

## Error Handling

```javascript
try {
    await fetch(`${API_BASE}/api/endpoint`);
} catch (e) {
    if (window.telemetry) {
        telemetry.captureError(e, {
            operation: 'operationName',
            widget: 'my-widget'
        });
    }
}
```

## Settings Pattern

```javascript
const STORAGE_KEY = 'SimGlass_mywidget_settings';

loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    } catch (e) {
        if (window.telemetry) {
            telemetry.captureError(e, {
                operation: 'loadSettings',
                widget: 'my-widget'
            });
        }
    }
}

saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
}
```

## Available Flight Data (onMessage)

```javascript
onMessage(data) {
    data.altitude        // Feet MSL
    data.speed          // Knots IAS
    data.heading        // Degrees
    data.verticalSpeed  // Feet per minute
    data.latitude       // Decimal degrees
    data.longitude      // Decimal degrees
    data.groundSpeed    // Knots
    data.fuelTotal      // Gallons
    data.throttle       // 0-100%
    data.flapsIndex     // 0-4
    data.gearDown       // Boolean
    data.apMaster       // Boolean
    // ... ~106 SimVars total
}
```

## File Structure

```
ui/my-widget/
├── index.html      # Load widget-base.js FIRST, then widget.js
├── widget.js       # Extends SimGlassBase
├── styles.css      # Widget styles
└── manifest.json   # Optional metadata
```

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Widget</title>
    <link rel="stylesheet" href="../shared/widget-base.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="widget-container">
        <!-- Your UI here -->
    </div>

    <script src="../shared/widget-base.js"></script>
    <script src="widget.js"></script>
</body>
</html>
```

## Checklist: New Widget

- [ ] Extends SimGlassBase
- [ ] Calls `super()` with widgetName, widgetVersion, autoConnect
- [ ] Implements `destroy()` with `super.destroy()` last
- [ ] Adds `beforeunload` listener
- [ ] Cleans up ALL timers/intervals
- [ ] Tests page refresh (no console errors)
- [ ] Versioned (1.0.0, 2.0.0, etc.)

## Checklist: Migration

- [ ] Globals → class properties
- [ ] Functions → class methods
- [ ] Custom WebSocket → `autoConnect: true`
- [ ] ws.onmessage → `onMessage(data)`
- [ ] Add `destroy()` method
- [ ] Add `beforeunload` listener
- [ ] Version to v2.0.0
- [ ] Test connection + cleanup

## Examples by Complexity

| Complexity | Widget | Lines | Features |
|------------|--------|-------|----------|
| Simple | holding-calc | 237 | Calculator, no WebSocket |
| Medium | fuel | 450 | Live data, HTTP API |
| Complex | flight-recorder | 863 | WebSocket + sessions + intervals |
| Modular | gtn750 | 1250 | 6 modules, orchestration |

See `WIDGET-DEVELOPMENT-GUIDE.md` for detailed documentation.
