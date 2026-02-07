# Contributing to SimGlass

Thank you for your interest in contributing to SimGlass! This guide will help you get started with developing widgets, fixing bugs, and adding features.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Architecture Overview](#architecture-overview)
3. [Creating a New Widget](#creating-a-new-widget)
4. [Widget Best Practices](#widget-best-practices)
5. [Testing](#testing)
6. [Code Standards](#code-standards)
7. [Submitting Changes](#submitting-changes)

---

## Development Setup

### Prerequisites

- **Node.js** 16+ and npm
- **MSFS 2020 or 2024** (optional - mock mode works without)
- **Git** for version control
- **Code editor** (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/cobrahjh/LLM-DevOSWE.git
cd LLM-DevOSWE/simwidget-hybrid

# Install dependencies
npm install

# Start the development server
npm run dev

# Run tests
npm test
```

The server will start on `http://localhost:8080` with hot-reload enabled.

### Project Structure

```
simwidget-hybrid/
├── backend/                 # Node.js server
│   ├── server.js           # Main server (151KB)
│   ├── copilot-api.js      # AI copilot routes
│   ├── weather-api.js      # Weather API integration
│   ├── camera-controller.js # Camera system
│   └── *.js                # Other backend modules
├── ui/                      # Frontend widgets
│   ├── shared/             # Shared libraries (39 files, 11k lines)
│   │   ├── widget-base.js  # SimGlassBase class (WebSocket + lifecycle)
│   │   ├── telemetry.js    # Error tracking
│   │   ├── platform-utils.js # Platform detection
│   │   ├── themes.js       # Theme system (7 themes)
│   │   └── ...
│   ├── gtn750/             # GTN 750 GPS (most complex widget)
│   ├── copilot-widget/     # AI copilot with LLM integration
│   ├── fuel-widget/        # Fuel management
│   └── .../                # 49 total widgets
├── tests/                   # Test framework
│   ├── test-runner.js      # Main test suite (26 tests)
│   └── README.md           # Test documentation
├── config.json             # Server configuration
└── README.md               # User documentation
```

---

## Architecture Overview

### Backend (Node.js + Express)

**Port:** 8080
**Stack:** Express + WebSocket (`ws`) + SimConnect

```javascript
// Simplified server architecture
const express = require('express');
const WebSocket = require('ws');
const app = express();

// 1. SimConnect integration (106 SimVars)
simConnectConnection.on('data', (data) => {
    flightData = data;
    broadcastToClients(flightData); // Send to all widgets
});

// 2. WebSocket broadcasting (30s ping/pong heartbeat)
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('message', handleCommand);
    ws.on('close', () => clients.delete(ws));
});

// 3. REST API endpoints
app.get('/api/simvars', (req, res) => res.json(flightData));
app.post('/api/command', executeSimCommand);
```

**Key Features:**
- Mock data mode when MSFS not running
- Hot-reload support (CSS/JS live updates)
- Plugin system with hot-reload
- License-gated AI copilot routes
- Encrypted API key storage (AES-256-CBC)

### Frontend (Vanilla JS + WebSocket)

Widgets use one of two patterns:

#### Pattern 1: SimGlassBase (Recommended for new widgets)

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-widget',
            widgetVersion: '1.0.0',
            autoConnect: true
        });
        this.initUI();
    }

    // Lifecycle hooks
    onConnect() {
        console.log('WebSocket connected');
    }

    onDisconnect() {
        console.log('WebSocket disconnected');
    }

    onMessage(data) {
        // data = flight data from SimConnect
        this.updateDisplay(data);
    }

    destroy() {
        // Clean up timers, intervals, etc.
        super.destroy(); // Handles WebSocket cleanup
    }
}
```

**Benefits:**
- Automatic WebSocket connection + reconnection (exponential backoff)
- Built-in lifecycle hooks
- Telemetry integration
- Settings panel support
- ~40 lines less boilerplate per widget

**21 widgets migrated:** traffic, multiplayer, copilot, flightplan, atc, failures, flightlog, mobile-companion, health-dashboard, map, fuel, flight-data, landing, performance, environment, flight-instructor, autopilot, engine-monitor, toolbar-panel, tinywidgets, and more.

#### Pattern 2: Functional/Global (For simple widgets)

```javascript
// No class, just functions
let ws = null;
let flightData = {};

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.hostname}:8080`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateDisplay(data);
    };
}

function updateDisplay(data) {
    document.getElementById('altitude').textContent = data.altitude;
}
```

Use for: Static widgets, simple displays, calculators without real-time data.

---

## Creating a New Widget

### Step 1: Create Widget Directory

```bash
cd ui
mkdir my-widget
cd my-widget
```

### Step 2: Create `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Widget - SimGlass</title>
    <link rel="stylesheet" href="/ui/shared/widget-common.css">
    <link rel="stylesheet" href="styles.css">
    <script src="/ui/shared/hot-reload-client.js"></script>
</head>
<body>
    <div class="widget-container">
        <div class="widget-header">
            <span class="widget-title">My Widget</span>
        </div>
        <div class="widget-content">
            <div id="altitude">---</div>
        </div>
    </div>

    <!-- SimGlassBase Dependencies -->
    <script src="/ui/shared/platform-utils.js"></script>
    <script src="/ui/shared/telemetry.js"></script>
    <script src="/ui/shared/settings-panel.js"></script>
    <script src="/ui/shared/feedback-section.js"></script>
    <script src="/ui/shared/widget-base.js"></script>

    <script src="widget.js"></script>
</body>
</html>
```

### Step 3: Create `widget.js`

```javascript
/**
 * My Widget - SimGlass
 * Description of what this widget does
 */

class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-widget',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        this.initUI();
    }

    initUI() {
        this.elements = {
            altitude: document.getElementById('altitude')
        };
    }

    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.updateDisplay(msg.data);
        }
    }

    updateDisplay(data) {
        if (data.altitude !== undefined) {
            this.elements.altitude.textContent =
                Math.round(data.altitude) + ' ft';
        }
    }

    destroy() {
        // Clean up custom resources here
        super.destroy(); // MUST call this
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
    window.addEventListener('beforeunload', () =>
        window.myWidget?.destroy()
    );
});
```

### Step 4: Create `styles.css`

```css
.widget-container {
    padding: 20px;
}

#altitude {
    font-size: 48px;
    font-weight: bold;
    text-align: center;
    margin: 20px 0;
}
```

### Step 5: Test Your Widget

1. Navigate to `http://localhost:8080/ui/my-widget/`
2. Open DevTools Console (F12) to check for errors
3. Verify WebSocket connection
4. Test with MSFS running or in mock mode

---

## Widget Best Practices

### 1. Lifecycle Management

**ALWAYS implement `destroy()`** to prevent memory leaks:

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({...});
        this._timerId = null;
        this._intervalId = null;
    }

    startPolling() {
        this._intervalId = setInterval(() => {
            this.fetchData();
        }, 5000);
    }

    destroy() {
        // Clear timers
        if (this._timerId) clearTimeout(this._timerId);
        if (this._intervalId) clearInterval(this._intervalId);

        // Cancel animation frames
        if (this._rafId) cancelAnimationFrame(this._rafId);

        // Close audio contexts
        if (this._audioContext) this._audioContext.close();

        // MUST call parent destroy
        super.destroy();
    }
}
```

### 2. Error Handling

**NEVER use silent catch blocks:**

```javascript
// ❌ BAD - Silent error swallowing
try {
    const data = JSON.parse(input);
} catch (e) {}

// ✅ GOOD - Use telemetry
try {
    const data = JSON.parse(input);
} catch (e) {
    if (window.telemetry) {
        telemetry.captureError(e, {
            operation: 'parseInput',
            widget: 'my-widget',
            inputLength: input?.length
        });
    }
}
```

### 3. WebSocket Best Practices

If extending SimGlassBase (recommended):
- `onConnect()` - Connection established
- `onDisconnect()` - Connection lost (auto-reconnect active)
- `onMessage(msg)` - New data received

If manual WebSocket:
- Implement exponential backoff reconnection
- Handle `onclose`, `onerror`, `onmessage`
- Clean up in `beforeunload` event

### 4. Performance

**For high-frequency updates (60Hz+):**

```javascript
class FastWidget extends SimGlassBase {
    onMessage(msg) {
        // Debounce expensive operations
        if (this._rafId) return; // Skip if RAF already queued

        this._rafId = requestAnimationFrame(() => {
            this.updateDisplay(msg.data);
            this._rafId = null;
        });
    }
}
```

**For localStorage:**

```javascript
// Throttle saves
saveSettings() {
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem('my-widget-settings',
                JSON.stringify(this.settings));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveSettings',
                    widget: 'my-widget',
                    storage: 'localStorage'
                });
            }
        }
    }, 1000);
}
```

### 5. Cross-Widget Communication

Use BroadcastChannel for widget-to-widget messages:

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({...});
        this.syncChannel = new BroadcastChannel('simglass-sync');
        this.syncChannel.onmessage = (e) => this.handleSync(e);
    }

    handleSync(event) {
        const { type, data } = event.data;

        switch (type) {
            case 'route-update':
                this.displayRoute(data);
                break;
            case 'position-update':
                this.updatePosition(data);
                break;
        }
    }

    broadcastRoute(route) {
        this.syncChannel.postMessage({
            type: 'route-update',
            data: route,
            source: 'my-widget'
        });
    }

    destroy() {
        this.syncChannel.close();
        super.destroy();
    }
}
```

**Standard message types:**
- `route-update` - Flight plan changes
- `position-update` - Aircraft position
- `weather-update` - METAR data
- `command` - Widget commands

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# API tests only
npm run test:api

# WebSocket tests only
npm run test:ws
```

### Adding Widget Tests

Edit `tests/test-runner.js` and add your widget to the `WIDGETS_TO_TEST` array:

```javascript
const WIDGETS_TO_TEST = [
    'aircraft-control',
    'camera-widget',
    'my-widget', // Add your widget here
    // ...
];
```

Tests verify:
- Widget HTML loads (200 status)
- No JavaScript errors on page load
- Essential DOM elements exist

### Manual Testing Checklist

- [ ] Widget loads without console errors
- [ ] WebSocket connection established (check Network tab)
- [ ] Data updates in real-time
- [ ] Works in mock mode (MSFS not running)
- [ ] Works with MSFS running
- [ ] Settings persist across reloads
- [ ] No memory leaks (run for 5+ minutes, check DevTools Memory)
- [ ] Mobile responsive (if applicable)
- [ ] Theme changes work correctly
- [ ] Destroy cleanup (refresh page, check console for errors)

---

## Code Standards

### File Naming

- Widget files: lowercase with hyphens (`my-widget/`)
- JavaScript: camelCase (`widget.js`, `myFunction()`)
- CSS: kebab-case (`.widget-container`, `.my-class`)
- Classes: PascalCase (`MyWidget`, `SimGlassBase`)

### Code Style

```javascript
// Use modern ES6+ syntax
const myFunction = (param) => {
    // Single quotes for strings
    const message = 'Hello';

    // Template literals for interpolation
    console.log(`Value: ${param}`);

    // Destructuring where appropriate
    const { altitude, speed } = flightData;

    // Arrow functions for callbacks
    setTimeout(() => this.update(), 1000);
};

// Async/await over Promise chains
async fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        this.process(data);
    } catch (e) {
        this.handleError(e);
    }
}
```

### Comments

```javascript
/**
 * Multi-line JSDoc for classes/functions
 * @param {Object} data - Flight data from SimConnect
 * @returns {string} Formatted altitude string
 */
function formatAltitude(data) {
    // Single-line comments for inline explanations
    const alt = Math.round(data.altitude);
    return `${alt} ft`;
}
```

### Git Commit Messages

```
type: Short description (50 chars max)

Longer explanation if needed (wrap at 72 chars).
- Bullet points for multiple changes
- Another change

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Build/tooling

---

## Submitting Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-widget
```

### 2. Make Changes

- Follow code standards above
- Add tests if applicable
- Update documentation

### 3. Test Thoroughly

```bash
npm test
# Manual testing in browser
```

### 4. Commit

```bash
git add ui/my-widget/
git commit -m "feat: Add my-widget for altitude display

- Real-time altitude monitoring
- Mock mode support
- Extends SimGlassBase

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 5. Push and Create PR

```bash
git push origin feature/my-widget
# Create pull request on GitHub
```

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] No console errors in browser
- [ ] Documentation updated (README.md, this file)
- [ ] Follows code standards
- [ ] Includes destroy() cleanup
- [ ] Uses telemetry for errors
- [ ] Works in mock mode
- [ ] Responsive on mobile (if UI widget)

---

## Additional Resources

### Documentation

- [README.md](README.md) - User guide and widget catalog
- [WIDGET-CATALOG.md](WIDGET-CATALOG.md) - Complete widget reference
- [TODO.md](TODO.md) - Planned features and tasks
- [ui/copilot-widget/README.md](ui/copilot-widget/README.md) - AI copilot implementation guide

### Code Examples

- **Simple widget**: `ui/timer-widget/` - Stopwatch with localStorage
- **SimGlassBase**: `ui/fuel-widget/` - Multi-tank fuel management
- **Complex widget**: `ui/gtn750/` - Multi-module architecture
- **API integration**: `ui/weather-widget/` - External API calls
- **AI integration**: `ui/copilot-widget/` - LLM streaming chat

### Architecture References

- **Module extraction**: See `ui/gtn750/` for pattern of breaking large widgets into modules
- **Lifecycle management**: See `MEMORY.md` for destroy() patterns
- **Error handling**: All 43 silent catches fixed with telemetry
- **WebSocket**: SimGlassBase provides auto-reconnect with exponential backoff

---

## Questions?

- **GitHub Issues**: https://github.com/cobrahjh/LLM-DevOSWE/issues
- **Discussions**: Check existing widgets for similar functionality
- **Testing**: `npm test` catches most common issues

---

**Happy coding!** 🚀

The SimGlass community appreciates your contribution to making flight simulation more accessible and powerful.
