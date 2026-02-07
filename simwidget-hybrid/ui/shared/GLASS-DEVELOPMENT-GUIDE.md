# SimGlass glass Development Guide

**Last Updated:** February 2026
**Architecture Version:** SimGlassBase v2.0.0
**Coverage:** 48/48 glasses (100%)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [SimGlassBase Architecture](#simglassbase-architecture)
4. [Creating a New glass](#creating-a-new-glass)
5. [Lifecycle Hooks](#lifecycle-hooks)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Migration Guide](#migration-guide)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**SimGlassBase** is the standardized base class for all SimGlass glasses. It provides:

- ✅ **WebSocket management** - Automatic connection, reconnection, and cleanup
- ✅ **Lifecycle hooks** - Consistent onMessage/onConnect/onDisconnect pattern
- ✅ **Telemetry integration** - Automatic error capture and reporting
- ✅ **Settings infrastructure** - Built-in settings panel support
- ✅ **Resource cleanup** - Proper destroy() pattern with automatic WebSocket cleanup

**Why SimGlassBase?**
- Eliminates 1000+ lines of duplicate WebSocket code across 48 glasses
- Standardizes error handling and resource cleanup
- Reduces bugs (no more forgotten interval cleanup)
- Faster development (focus on glass logic, not infrastructure)

---

## Quick Start

### Minimal glass Template

```javascript
const API_BASE = `http://${window.location.hostname}:8080`;

class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-glass',
            widgetVersion: '1.0.0',
            autoConnect: true  // or false if no WebSocket needed
        });

        this.initElements();
        this.initEvents();
    }

    // Lifecycle hook - receives flight data
    onMessage(data) {
        // Update UI with flight data
        console.log('Flight data:', data);
    }

    initElements() {
        // Cache DOM elements
    }

    initEvents() {
        // Set up event listeners
    }

    destroy() {
        // Clean up timers, listeners, etc.
        super.destroy(); // ALWAYS call this last
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
    window.addEventListener('beforeunload', () => window.myWidget?.destroy());
});
```

---

## SimGlassBase Architecture

### Constructor Parameters

```javascript
super({
    widgetName: 'string',      // Required - unique glass identifier
    widgetVersion: 'string',   // Required - semantic version (e.g., '2.0.0')
    autoConnect: boolean       // Required - true for WebSocket, false for HTTP-only
});
```

### When to Use `autoConnect: true` vs `false`

**Use `autoConnect: true` when:**
- glass needs real-time flight data updates
- Displays live telemetry (altitude, speed, heading, etc.)
- Examples: flight-recorder, traffic, map, fuel, health-dashboard

**Use `autoConnect: false` when:**
- glass is a calculator or static tool
- Only uses HTTP API calls
- Uses other APIs (Web Speech, Canvas, etc.)
- Examples: voice-control, holding-calc, weight-balance, notepad

### What SimGlassBase Provides

```javascript
class SimGlassBase {
    // Properties available in your glass
    this.widgetName       // Your glass name
    this.widgetVersion    // Your glass version
    this.ws              // WebSocket instance (if autoConnect: true)
    this._destroyed      // Cleanup flag

    // Methods you can override
    onMessage(data)      // Called when WebSocket receives data
    onConnect()          // Called when WebSocket connects
    onDisconnect()       // Called when WebSocket disconnects

    // Methods you can use
    destroy()            // Cleanup - ALWAYS call super.destroy()
}
```

---

## Creating a New glass

### Step 1: Create glass Directory

```
ui/my-glass/
├── index.html        # glass HTML
├── glass.js         # glass logic (extends SimGlassBase)
├── styles.css        # glass styles
└── manifest.json     # glass metadata (optional)
```

### Step 2: HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My glass</title>
    <link rel="stylesheet" href="../shared/glass-base.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="glass-container">
        <!-- Your glass UI here -->
    </div>

    <!-- Load SimGlassBase FIRST -->
    <script src="../shared/glass-base.js"></script>

    <!-- Then load your glass -->
    <script src="glass.js"></script>
</body>
</html>
```

### Step 3: Implement glass Class

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-glass',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // Initialize state
        this.myData = null;
        this.myInterval = null;

        // Set up glass
        this.initElements();
        this.initEvents();
        this.loadSettings();
    }

    initElements() {
        // Cache DOM elements for performance
        this.displayElement = document.getElementById('display');
        this.buttonElement = document.getElementById('my-button');
    }

    initEvents() {
        // Set up event listeners
        this.buttonElement?.addEventListener('click', () => this.handleClick());
    }

    onMessage(data) {
        // Handle incoming flight data
        this.myData = data;
        this.updateDisplay();
    }

    onConnect() {
        console.log('[My glass] Connected to server');
    }

    onDisconnect() {
        console.log('[My glass] Disconnected from server');
    }

    updateDisplay() {
        if (!this.displayElement || !this.myData) return;
        this.displayElement.textContent = this.myData.altitude;
    }

    handleClick() {
        // Handle user interaction
    }

    loadSettings() {
        // Load settings from localStorage
    }

    destroy() {
        // Clean up intervals
        if (this.myInterval) {
            clearInterval(this.myInterval);
            this.myInterval = null;
        }

        // ALWAYS call super.destroy() last
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
    window.addEventListener('beforeunload', () => window.myWidget?.destroy());
});
```

---

## Lifecycle Hooks

### onMessage(data)

Called when WebSocket receives flight data (only if `autoConnect: true`).

```javascript
onMessage(data) {
    // data contains all flight telemetry
    console.log('Altitude:', data.altitude);
    console.log('Speed:', data.speed);
    console.log('Heading:', data.heading);

    // Update your UI
    this.updateDisplay(data);
}
```

**Available data fields:** See `backend/server.js` for complete list (~106 SimVars).

### onConnect()

Called when WebSocket successfully connects.

```javascript
onConnect() {
    console.log('[My glass] WebSocket connected');
    // Update connection indicator
    this.statusDot?.classList.add('connected');
}
```

### onDisconnect()

Called when WebSocket disconnects.

```javascript
onDisconnect() {
    console.log('[My glass] WebSocket disconnected');
    // Update connection indicator
    this.statusDot?.classList.remove('connected');
}
```

---

## Best Practices

### 1. Always Call super.destroy()

```javascript
destroy() {
    // Your cleanup first
    if (this.myInterval) clearInterval(this.myInterval);
    if (this.myTimeout) clearTimeout(this.myTimeout);

    // ALWAYS call super.destroy() LAST
    super.destroy();
}
```

### 2. Store Timer/Interval References

**❌ Bad:**
```javascript
setInterval(() => this.update(), 1000);  // Can't clean up!
```

**✅ Good:**
```javascript
this.updateInterval = setInterval(() => this.update(), 1000);

destroy() {
    if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
    }
    super.destroy();
}
```

### 3. Null-Check DOM Elements

```javascript
// DOM might not be ready yet
updateDisplay() {
    const element = document.getElementById('display');
    if (!element) return;  // Graceful degradation
    element.textContent = this.data;
}
```

### 4. Use Telemetry for Error Capture

```javascript
async fetchData() {
    try {
        const res = await fetch(`${API_BASE}/api/data`);
        return await res.json();
    } catch (e) {
        // Automatic telemetry capture
        if (window.telemetry) {
            telemetry.captureError(e, {
                operation: 'fetchData',
                glass: 'my-glass'
            });
        }
        return null;
    }
}
```

### 5. Version Your glass

```javascript
constructor() {
    super({
        widgetName: 'my-glass',
        widgetVersion: '2.0.0',  // Update on breaking changes
        autoConnect: true
    });
}
```

---

## Common Patterns

### Pattern: Settings Management

```javascript
const STORAGE_KEY = 'SimGlass_mywidget_settings';

class MyWidget extends SimGlassBase {
    constructor() {
        super({ /* ... */ });
        this.settings = {
            interval: 100,
            enabled: true
        };
        this.loadSettings();
    }

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
                    glass: 'my-glass',
                    storage: 'localStorage'
                });
            }
        }

        // Apply to UI after DOM ready
        setTimeout(() => {
            const intervalEl = document.getElementById('setting-interval');
            if (intervalEl) intervalEl.value = this.settings.interval;
        }, 0);
    }

    saveSettings() {
        this.settings.interval = parseInt(document.getElementById('setting-interval').value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    }
}
```

### Pattern: Multiple Timers

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({ /* ... */ });
        this.updateInterval = null;
        this.pollInterval = null;
        this.cleanupTimeout = null;
    }

    start() {
        this.updateInterval = setInterval(() => this.update(), 1000);
        this.pollInterval = setInterval(() => this.poll(), 5000);
        this.cleanupTimeout = setTimeout(() => this.cleanup(), 60000);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        super.destroy();
    }
}
```

### Pattern: RequestAnimationFrame Loop

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({ /* ... */ });
        this.rafId = null;
        this.startRendering();
    }

    startRendering() {
        const render = () => {
            if (this._destroyed) return;  // Stop if destroyed

            this.draw();  // Your render logic

            this.rafId = requestAnimationFrame(render);
        };
        render();
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        super.destroy();
    }
}
```

### Pattern: BroadcastChannel Communication

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({ /* ... */ });
        this.channel = new BroadcastChannel('SimGlass-sync');
        this.channel.onmessage = (e) => this.handleMessage(e.data);
    }

    sendToOtherWidgets(data) {
        this.channel.postMessage({
            type: 'my-event',
            data: data
        });
    }

    handleMessage(msg) {
        if (msg.type === 'other-event') {
            console.log('Received from other glass:', msg.data);
        }
    }

    destroy() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        super.destroy();
    }
}
```

### Pattern: Window-Exposed Methods (for inline handlers)

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({ /* ... */ });

        // Expose methods to window for onclick handlers
        window.myWidgetAction = (id) => this.handleAction(id);
    }

    handleAction(id) {
        console.log('Action called:', id);
    }

    destroy() {
        // Clean up window references
        delete window.myWidgetAction;
        super.destroy();
    }
}
```

---

## Migration Guide

### Converting Module-Level glass to SimGlassBase

**Before (Module-level pattern):**

```javascript
let ws = null;
let myData = null;
let myInterval = null;

function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
        myData = JSON.parse(event.data);
        updateDisplay();
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
}

function updateDisplay() {
    // Update UI
}

document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});
```

**After (SimGlassBase pattern):**

```javascript
class MyWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'my-glass',
            widgetVersion: '2.0.0',
            autoConnect: true  // SimGlassBase handles WebSocket
        });

        this.myData = null;  // Global → property
        this.myInterval = null;
        this.initElements();
    }

    onMessage(data) {  // ws.onmessage → lifecycle hook
        this.myData = data;
        this.updateDisplay();
    }

    updateDisplay() {  // Function → method
        // Update UI
    }

    destroy() {
        if (this.myInterval) {
            clearInterval(this.myInterval);
            this.myInterval = null;
        }
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.myWidget = new MyWidget();
    window.addEventListener('beforeunload', () => window.myWidget?.destroy());
});
```

### Migration Checklist

- [ ] Convert global variables to class properties
- [ ] Convert standalone functions to class methods
- [ ] Replace custom WebSocket with `autoConnect: true`
- [ ] Implement `onMessage()` lifecycle hook
- [ ] Add `destroy()` method with `super.destroy()`
- [ ] Add `beforeunload` listener
- [ ] Update version to v2.0.0
- [ ] Test WebSocket connection
- [ ] Test page refresh (cleanup)
- [ ] Check console for errors

---

## Examples

### Simple glass (Calculator - No WebSocket)

**holding-calc v2.0.0** - 237 lines

```javascript
class HoldingCalculator extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'holding-calc',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed
        });

        this.initElements();
        this.initEvents();
    }

    initElements() {
        this.inputInbound = document.getElementById('input-inbound');
        this.inputTurn = document.getElementById('input-turn');
        this.resultEntry = document.getElementById('result-entry');
    }

    initEvents() {
        document.getElementById('btn-calculate')
            .addEventListener('click', () => this.calculate());
    }

    calculate() {
        const inbound = parseInt(this.inputInbound.value);
        const turn = this.inputTurn.value;
        const entry = this.determineEntry(inbound, turn);
        this.resultEntry.textContent = entry;
    }

    destroy() {
        super.destroy();
    }
}
```

### Medium glass (Live Data Display)

**fuel v3.0.0** - 450 lines

```javascript
class FuelWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'fuel',
            widgetVersion: '3.0.0',
            autoConnect: true  // Needs real-time fuel data
        });

        this.tanks = {};
        this.initElements();
        this.initEvents();
    }

    onMessage(data) {
        // Update fuel tank data from WebSocket
        this.tanks.leftMain = data.fuelTankLeftMain;
        this.tanks.rightMain = data.fuelTankRightMain;
        this.updateDisplay();
    }

    updateDisplay() {
        // Update tank level UI
        this.updateTankLevel('left', this.tanks.leftMain);
        this.updateTankLevel('right', this.tanks.rightMain);
    }

    async setFuelPercent(percent) {
        // HTTP API call to set fuel
        await fetch(`${API_BASE}/api/fuel/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ percent })
        });
    }

    destroy() {
        super.destroy();
    }
}
```

### Complex glass (Multiple Intervals + Sessions)

**flight-recorder v2.0.0** - 863 lines

```javascript
class FlightRecorderWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-recorder',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.isRecording = false;
        this.playbackInterval = null;
        this.timerInterval = null;
        this.currentSession = null;
        this.savedSessions = [];

        this.loadSettings();
        this.loadSessions();
        this.initElements();
        this.initEvents();
    }

    onMessage(data) {
        // Record data point if recording
        if (this.isRecording && this.currentSession) {
            this.recordDataPoint(data);
        }
        this.updateCurrentData(data);
    }

    startRecording() {
        this.currentSession = this.createSession();
        this.isRecording = true;
        this.timerInterval = setInterval(() => this.updateDuration(), 100);
    }

    stopRecording() {
        this.isRecording = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.savedSessions.unshift(this.currentSession);
        this.saveSessions();
    }

    destroy() {
        // Stop recording if active
        if (this.isRecording) this.stopRecording();

        // Clear all intervals
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.playbackInterval) clearTimeout(this.playbackInterval);

        // Call parent cleanup
        super.destroy();
    }
}
```

---

## Troubleshooting

### WebSocket Not Connecting

**Symptom:** No data updates, console shows connection errors

**Check:**
1. Is backend server running? `curl http://localhost:8080/api/status`
2. Is `autoConnect: true` set?
3. Check browser console for WebSocket errors
4. Verify SimGlassBase is loaded before your glass

### Page Refresh Causes Errors

**Symptom:** Console errors on page reload

**Fix:** Ensure `destroy()` is called:

```javascript
window.addEventListener('beforeunload', () => window.myWidget?.destroy());
```

### Interval Keeps Running After Page Close

**Symptom:** Timers continue in background

**Fix:** Store interval ID and clear in `destroy()`:

```javascript
this.myInterval = setInterval(() => {}, 1000);

destroy() {
    if (this.myInterval) {
        clearInterval(this.myInterval);
        this.myInterval = null;
    }
    super.destroy();
}
```

### Data Not Updating

**Symptom:** UI shows stale data

**Check:**
1. Is `onMessage()` being called? Add `console.log('onMessage', data);`
2. Is `autoConnect: true`?
3. Are you updating the DOM correctly? Check element references

### Memory Leak

**Symptom:** Memory usage grows over time

**Fix:** Clean up ALL resources in `destroy()`:
- Intervals/timeouts
- Event listeners (if not on elements that get removed)
- BroadcastChannels
- Window-exposed methods
- AudioContext, Canvas, etc.

---

## Resources

**glass Base Files:**
- `ui/shared/glass-base.js` - SimGlassBase implementation
- `ui/shared/glass-base.css` - Base glass styles
- `ui/shared/themes.js` - Theme definitions

**Example glasses:**
- **Simple:** `ui/holding-calc/` (calculator, no WebSocket)
- **Medium:** `ui/fuel/` (live data display)
- **Complex:** `ui/flight-recorder/` (recording + playback)
- **Modular:** `ui/gtn750/` (6-module GPS system)

**Backend:**
- `backend/server.js` - WebSocket server, SimConnect integration
- `backend/CLAUDE.md` - Backend architecture documentation

---

## Migration History

**February 2026:** 48/48 glasses (100%) migrated to SimGlassBase

**Sessions:**
- Sessions 1-10: 44 glasses migrated
- Session 11: voice-control v2.0.0 (Web Speech API)
- Session 12: flight-recorder v2.0.0 (complex WebSocket with sessions)

**Impact:**
- Eliminated 1000+ lines of duplicate code
- Standardized lifecycle across all glasses
- Fixed systemic cleanup bugs
- Added comprehensive error handling

---

**Questions?** Check existing glasses in `ui/` for real-world examples.

**Contributing:** All new glasses MUST extend SimGlassBase.
