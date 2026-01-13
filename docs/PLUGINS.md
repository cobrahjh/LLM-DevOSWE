# SimWidget Engine - Plugin System
**Version:** 1.0.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\PLUGINS.md`

---

## Overview

SimWidget uses a modular plugin architecture. Users install only what they need.

## Installation Profiles

| Profile | Plugins | Size | Use Case |
|---------|---------|------|----------|
| **Lite** | core | ~5MB | Basic controls only |
| **Standard** | core, voice, recorder | ~15MB | Typical user |
| **Pro** | + lorby-bridge, telemetry | ~25MB | Power user |
| **Dev** | All plugins | ~30MB | Development |

---

## Available Plugins

### Core (Required)
- **ID:** `core`
- **Provides:** Flight data, basic controls, autopilot, lights, fuel, WebSocket API
- **Cannot be disabled**

### Voice Control
- **ID:** `voice-control`
- **Provides:** Voice commands via Web Speech API
- **Requires:** Chrome or Edge browser
- **Dependencies:** core

### Flight Recorder
- **ID:** `flight-recorder`
- **Provides:** Session recording, playback, export
- **Features:** Delta compression, position playback
- **Dependencies:** core

### Lorby AAO Bridge
- **ID:** `lorby-bridge`
- **Provides:** SimVar access via HTTP (no SimConnect needed)
- **Requires:** Lorby Axis & Ohs running with WebAPI
- **Dependencies:** core

### Telemetry (Optional)
- **ID:** `telemetry`
- **Provides:** Error tracking, usage analytics
- **Note:** Disabled by default, opt-in only

---

## Plugin Structure

```
plugins/
├── plugin-loader.js      # Core loader
├── plugins.json          # Enabled/disabled config
├── core/                 # Required plugin
│   ├── manifest.json
│   ├── index.js
│   └── ui/
├── voice-control/
│   ├── manifest.json
│   ├── index.js
│   └── ui/
├── flight-recorder/
│   ├── manifest.json
│   ├── index.js
│   └── ui/
└── lorby-bridge/
    ├── manifest.json
    └── index.js
```

---

## Manifest Format

```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "What it does",
    "author": "Your Name",
    "priority": 50,
    "enabled": true,
    
    "entry": "index.js",
    "dependencies": ["core"],
    
    "provides": ["feature-1", "feature-2"],
    
    "ui": [
        { "id": "widget-id", "name": "Widget Name", "path": "ui" }
    ],
    
    "routes": ["/api/my-plugin/*"],
    
    "config": {
        "option1": "default-value"
    }
}
```

---

## Plugin API

### Lifecycle Methods

```javascript
class MyPlugin {
    constructor(manifest, loader) {
        this.manifest = manifest;
        this.loader = loader;
    }

    async init(context) {
        // context.app = Express app
        // context.wss = WebSocket server
        // context.server = HTTP server
    }

    registerRoutes(app) {
        app.get('/api/my-plugin/status', (req, res) => {
            res.json({ ok: true });
        });
    }

    registerWebSocket(wss) {
        wss.on('connection', (ws) => {
            // Handle connections
        });
    }

    onEvent(event, data) {
        // Handle events from other plugins
    }

    async shutdown() {
        // Cleanup
    }
}

module.exports = MyPlugin;
```

### Inter-Plugin Communication

```javascript
// Broadcast to all plugins
this.loader.broadcast('my-event', { data: 'value' });

// Get another plugin
const core = this.loader.getPlugin('core');
core.updateFlightData({ altitude: 5000 });
```

---

## Configuration

Edit `plugins/plugins.json`:

```json
{
    "enabled": ["core", "voice-control"],
    "disabled": ["telemetry"]
}
```

Or use install profiles:
```javascript
const profile = config.installProfiles.standard;
await pluginLoader.loadAll(profile);
```

---

## Creating a New Plugin

1. Create folder: `plugins/my-plugin/`
2. Create `manifest.json` with required fields
3. Create `index.js` with plugin class
4. Add UI in `ui/` subfolder (optional)
5. Add to `plugins.json` enabled list
6. Restart server

---

## CLI Commands (Planned)

```bash
# List plugins
simwidget plugins list

# Enable/disable
simwidget plugins enable voice-control
simwidget plugins disable telemetry

# Install profile
simwidget plugins install --profile standard
```
