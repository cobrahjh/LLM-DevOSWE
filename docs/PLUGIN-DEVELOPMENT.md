# SimWidget Plugin Development Guide

Create third-party plugins for SimWidget using the plugin system.

---

## Overview

Plugins are self-contained widgets that can be:
- Discovered automatically from the `plugins/` folder
- Enabled/disabled via the Plugin Manager UI
- Managed via REST API

---

## Quick Start

### 1. Create Plugin Folder

```
simwidget-hybrid/plugins/my-plugin/
```

### 2. Create Manifest

`plugins/my-plugin/plugin.json`:
```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "What this plugin does",
    "author": "Your Name",
    "category": "utility",
    "entry": "index.html",
    "icon": "icon.png"
}
```

### 3. Create Entry Point

`plugins/my-plugin/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Plugin</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            padding: 16px;
        }
    </style>
</head>
<body>
    <h1>My Plugin</h1>
    <script>
        // Your plugin code
    </script>
</body>
</html>
```

### 4. Refresh Plugins

```bash
curl -X POST http://localhost:8080/api/plugins/refresh
```

---

## Manifest Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (lowercase, hyphens) |
| `name` | Yes | Display name |
| `version` | Yes | Semantic version (1.0.0) |
| `description` | No | Short description |
| `author` | No | Author name |
| `category` | No | Category for grouping |
| `entry` | No | Entry file (default: index.html) |
| `icon` | No | Icon file path |
| `commands` | No | Plugin commands array |
| `settings` | No | Configurable settings array |

### Categories

- `utility` - General tools
- `navigation` - Nav aids
- `display` - Information displays
- `communication` - Radio/comms
- `weather` - Weather tools
- `traffic` - Traffic awareness
- `general` - Other

### Commands

```json
{
    "commands": [
        {
            "name": "preflight",
            "description": "Open pre-flight checklist"
        }
    ]
}
```

### Settings

```json
{
    "settings": [
        {
            "key": "autoAdvance",
            "type": "boolean",
            "default": true,
            "label": "Auto-advance on completion"
        },
        {
            "key": "volume",
            "type": "number",
            "default": 50,
            "label": "Sound volume"
        }
    ]
}
```

---

## Connecting to SimWidget

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'flightData') {
        updateDisplay(msg.data);
    }
};
```

### Flight Data Available

```javascript
{
    altitude: 5000,        // feet
    speed: 120,            // knots IAS
    heading: 270,          // degrees
    verticalSpeed: 500,    // fpm
    groundSpeed: 135,      // knots
    latitude: 47.123,      // degrees
    longitude: -122.456,   // degrees
    // ... see full list in API docs
}
```

### Sending Commands

```javascript
// Via WebSocket
ws.send(JSON.stringify({
    type: 'command',
    command: 'GEAR_TOGGLE',
    value: 0
}));

// Via REST API
fetch('http://localhost:8080/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'GEAR_TOGGLE', value: 0 })
});
```

---

## Plugin API

### List Plugins
```
GET /api/plugins
```

### Get Plugin
```
GET /api/plugins/:id
```

### Enable Plugin
```
POST /api/plugins/:id/enable
```

### Disable Plugin
```
POST /api/plugins/:id/disable
```

### Refresh (Rescan)
```
POST /api/plugins/refresh
```

---

## Styling Guidelines

Match SimWidget dark theme:

```css
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-card: rgba(255,255,255,0.03);
    --text-primary: #e0e0e0;
    --text-secondary: #888;
    --accent-cyan: #00d4ff;
    --accent-green: #00ff88;
    --accent-red: #ff6666;
    --border: rgba(255,255,255,0.1);
}

body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
    color: var(--text-primary);
}

.card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
}

button {
    background: rgba(0,212,255,0.2);
    border: 1px solid rgba(0,212,255,0.4);
    color: var(--accent-cyan);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
}
```

---

## Example: Flight Timer Plugin

`plugins/flight-timer/plugin.json`:
```json
{
    "id": "flight-timer",
    "name": "Flight Timer",
    "version": "1.0.0",
    "description": "Track flight time with start/stop",
    "author": "SimWidget",
    "category": "utility"
}
```

`plugins/flight-timer/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Flight Timer</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: #e0e0e0;
            padding: 20px;
            text-align: center;
        }
        .timer {
            font-size: 48px;
            font-family: 'Consolas', monospace;
            color: #00d4ff;
            margin: 20px 0;
        }
        button {
            padding: 12px 24px;
            margin: 5px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .start { background: #00ff88; color: #000; }
        .stop { background: #ff6666; color: #fff; }
        .reset { background: #444; color: #fff; }
    </style>
</head>
<body>
    <h2>Flight Timer</h2>
    <div class="timer" id="display">00:00:00</div>
    <button class="start" onclick="start()">Start</button>
    <button class="stop" onclick="stop()">Stop</button>
    <button class="reset" onclick="reset()">Reset</button>

    <script>
        let seconds = 0;
        let interval = null;

        function start() {
            if (!interval) {
                interval = setInterval(() => {
                    seconds++;
                    updateDisplay();
                }, 1000);
            }
        }

        function stop() {
            clearInterval(interval);
            interval = null;
        }

        function reset() {
            stop();
            seconds = 0;
            updateDisplay();
        }

        function updateDisplay() {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            document.getElementById('display').textContent =
                `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    </script>
</body>
</html>
```

---

## Testing

1. Place plugin in `simwidget-hybrid/plugins/`
2. Refresh: `POST /api/plugins/refresh`
3. Enable: `POST /api/plugins/your-plugin/enable`
4. Open: `http://localhost:8080/plugins/your-plugin/`

Or use the Plugin Manager UI:
`http://localhost:8080/ui/plugin-manager/`

---

## Best Practices

1. **Self-contained** - Include all CSS/JS in your HTML or plugin folder
2. **Responsive** - Design for various window sizes
3. **Dark theme** - Match SimWidget aesthetics
4. **Error handling** - Handle WebSocket disconnects gracefully
5. **Lightweight** - Minimize dependencies
6. **Documented** - Clear plugin.json description
