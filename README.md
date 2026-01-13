# SimWidget Engine

A custom widget overlay engine for flight simulators, replacing Flow Pro.

## Features

- **Direct SimConnect Integration** - No middleware, direct connection to MSFS
- **WebSocket Communication** - Fast, real-time data streaming
- **Electron Overlay** - Transparent, always-on-top windows
- **ES6+ Support** - Modern JavaScript, no compatibility hacks
- **Mini Widgets** - Separate floating windows for key data
- **Flow Pro Compatible** - Same API, easy migration
- **Multi-Sim Ready** - Architecture supports X-Plane, DCS (future)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MSFS 2020/2024                      │
└─────────────────────────────────────────────────────────────┘
                              │
                        SimConnect API
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SimWidget Server                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ SimConnect  │───▶│  SimVar     │───▶│  WebSocket  │     │
│  │   Bridge    │    │   Cache     │    │   Server    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                              │              │
│  Port: 8484                                  │              │
└──────────────────────────────────────────────│──────────────┘
                                               │
                              WebSocket (ws://localhost:8484)
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Electron Overlay                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Widget    │    │   Engine    │    │    Mini     │     │
│  │  Container  │◀──▶│   Runtime   │───▶│   Windows   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                           │                                 │
│                     Flow Pro                                │
│                   Compatible API                            │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- MSFS 2020 or 2024
- Windows 10/11

### Installation

1. **Install Server Dependencies**
```bash
cd server
npm install
```

2. **Install Overlay Dependencies**
```bash
cd overlay
npm install
```

### Running

1. **Start MSFS** (must be running first)

2. **Start the Server**
```bash
cd server
npm start
```

3. **Start the Overlay**
```bash
cd overlay
npm start
```

## Widget Development

### Basic Widget Structure

```javascript
// my-widget.js

// Widget configuration
const widget = {
    id: 'my-widget',
    name: 'My Custom Widget',
    
    html: `
        <div class="my-widget">
            <h1 id="altitude">0 ft</h1>
        </div>
    `,
    
    css: `
        .my-widget { 
            background: rgba(0,0,0,0.8); 
            padding: 20px; 
        }
    `,
    
    init: (element, $api, engine) => {
        // Setup code here
        
        // Register 1Hz update loop
        loop_1hz(() => {
            const alt = $api.variables.get('A:INDICATED ALTITUDE', 'feet');
            element.querySelector('#altitude').textContent = Math.round(alt) + ' ft';
        });
    }
};

// Register with engine
SimWidgetEngine.registerWidget(widget);
```

### API Reference

#### $api.variables

```javascript
// Get a simvar value
const altitude = $api.variables.get('A:INDICATED ALTITUDE', 'feet');
const apOn = $api.variables.get('A:AUTOPILOT MASTER', 'bool');

// Send a K: event
$api.variables.set('K:TOGGLE_NAV_LIGHTS', 'Number', 1);

// Set a simvar value
$api.variables.set('A:AUTOPILOT ALTITUDE LOCK VAR', 'feet', 35000);
```

#### $api.datastore

```javascript
// Save widget state
$api.datastore.export({ x: 100, y: 200, enabled: true });

// Load widget state
const saved = $api.datastore.import();
```

#### Lifecycle Hooks

```javascript
// Called every second
loop_1hz(() => { /* update UI */ });

// Called 5 times per second
loop_5hz(() => { /* fast updates */ });

// Called on shutdown
exit(() => { /* cleanup */ });
```

## Mini Widgets

Create floating mini windows for key data:

```javascript
// Create mini widget
const miniId = await window.simWidget.createMiniWidget({
    title: 'Altitude',
    type: 'value',
    simvar: 'A:INDICATED ALTITUDE',
    suffix: ' ft',
    decimals: 0,
    width: 200,
    height: 100
});

// Close mini widget
await window.simWidget.closeMiniWidget(miniId);
```

## Keyboard Shortcuts

- **F12** - Toggle debug panel

## Project Structure

```
SimWidget_Engine/
├── server/
│   ├── package.json
│   └── index.js           # SimConnect bridge + WebSocket
├── overlay/
│   ├── package.json
│   ├── main.js            # Electron main process
│   ├── preload.js         # IPC bridge
│   └── renderer/
│       ├── index.html     # Main overlay
│       ├── engine.js      # Widget runtime
│       └── mini-widget.html
└── widgets/
    └── aircraft-control/  # Ported widget
```

## Migrating from Flow Pro

Most Flow Pro widgets work with minimal changes:

1. Remove `info()`, `state()`, `style()`, `run()` calls (optional, ignored)
2. Replace `this.$api` with the `$api` parameter in `init()`
3. Use `loop_1hz()` instead of Flow Pro's custom loop

## License

MIT

## Contributing

Pull requests welcome! See CONTRIBUTING.md for guidelines.
