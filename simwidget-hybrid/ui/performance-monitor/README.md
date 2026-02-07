# Performance Monitor Widget

Real-time monitoring of SimGlass system health, widget performance, and browser metrics.

## Features

### WebSocket Monitoring
- **Connection Status** - Real-time WebSocket state (Connected/Disconnected/Connecting)
- **Latency Tracking** - Round-trip message latency with color-coded thresholds:
  - Green: < 50ms (excellent)
  - Yellow: 50-100ms (acceptable)
  - Red: > 100ms (degraded)
- **Message Rate** - Messages received per second from server
- **Reconnect Counter** - Track connection stability

### Browser Performance
- **FPS (Frames Per Second)** - Real-time frame rate monitoring via `requestAnimationFrame`
  - Green: ≥ 55 FPS (smooth)
  - Yellow: 30-54 FPS (acceptable)
  - Red: < 30 FPS (degraded)
- **Memory Usage** - JavaScript heap usage (if `performance.memory` API available)
  - Shows: `usedMB / totalMB` with percentage-based color coding
  - Green: < 70% (healthy)
  - Yellow: 70-85% (elevated)
  - Red: > 85% (critical)
- **CPU Time** - Total script execution time since page load
- **DOM Node Count** - Number of HTML elements in the document

### Error Tracking
- **Total Errors** - All errors captured since page load
- **Recent Errors** - Errors in the last hour
- **Error Rate** - Errors per minute with color coding:
  - Green: 0 errors/min (healthy)
  - Yellow: 1-4 errors/min (elevated)
  - Red: ≥ 5 errors/min (critical)
- **Last Error** - Most recent error message (truncated to 40 chars, hover for full text)

### System Health Checks
Polls server endpoints every 10 seconds to check:

| Service | Endpoint | Status Indicator |
|---------|----------|------------------|
| **API Server** | `/api/status` | Green (Online) / Red (Offline) |
| **SimConnect** | `/api/status` | Green (Connected) / Yellow (Mock Mode) / Red (Unknown) |
| **Camera Service** | `/api/camera/status` | Green (Available) / Yellow (Limited) / Red (Unavailable) |

### Performance Charts
- **60-Second Latency Graph** - Rolling timeline of WebSocket latency
- Auto-scales to maximum latency value
- Blue line chart with grid background
- Real-time updates every second

### Event Log
- **Last 10 Events** - Chronological log of important events
- Color-coded by severity:
  - Blue border: Info events (e.g., "Performance monitor started")
  - Green border: Success events (e.g., "WebSocket connected")
  - Yellow border: Warning events (e.g., "WebSocket disconnected")
  - Red border + background: Error events (e.g., widget errors)
- Timestamps in local time
- Auto-scrolling with max 50 events stored

## Usage

### Accessing the Widget

Navigate to: `http://localhost:8080/ui/performance-monitor/`

Or add to your widget launcher/toolbar.

### Interpreting Metrics

**Healthy System:**
- WebSocket: Connected, < 50ms latency, steady message rate
- Browser: ≥ 55 FPS, < 70% memory, DOM nodes stable
- Errors: 0/min error rate, no recent errors
- Health: All green status dots

**Degraded Performance:**
- Yellow latency (50-100ms): Network congestion or high server load
- Yellow FPS (30-54): Heavy rendering load, consider reducing visual complexity
- Yellow memory (70-85%): Approaching memory limits, may need page refresh
- Yellow health dots: Service partially available or in fallback mode

**Critical Issues:**
- Red latency (> 100ms): Severe network issues or server overload
- Red FPS (< 30): Unplayable performance, reduce widget count or visual effects
- Red memory (> 85%): Risk of browser crashes, refresh page immediately
- Red health dots: Service offline or failing

### Reset Statistics

Click the 🔄 button in the top-right to reset all counters and metrics. Confirmation dialog will appear.

**Resets:**
- Message rate counter
- Reconnect counter
- Latency history (chart will clear)
- Error counts and timestamps
- Event log

**Does NOT reset:**
- Current WebSocket connection state
- Real-time metrics (FPS, memory, latency)
- System health status

## Integration with Telemetry

The widget hooks into the global `window.telemetry.captureError()` function to track all errors across ALL widgets. This means:

- Errors from ANY widget will appear in the Performance Monitor's error metrics
- Error rate and counts reflect system-wide issues
- Last error may be from a different widget

To see which widget an error came from, check the Event Log — error events include the widget name.

## Architecture

**Extends:** `SimGlassBase` v1.0.0

**Lifecycle:**
- `constructor()` - Initializes metrics, starts monitoring intervals
- `onConnect()` - WebSocket connected callback
- `onDisconnect()` - WebSocket disconnected callback, increments reconnect counter
- `onMessage(msg)` - Tracks message rate and latency per message
- `destroy()` - Cleans up intervals and RAF loop

**Update Intervals:**
- Metrics: 1000ms (1 second)
- Health checks: 10000ms (10 seconds)
- FPS: ~60Hz via `requestAnimationFrame`
- Chart: 1000ms (synced with metrics)

**Performance Impact:**
- Minimal: < 1% CPU on modern hardware
- ~2-5 MB memory footprint
- No blocking operations
- RAF loop shares frame budget with other widgets

## Development Notes

### Adding New Metrics

To add a new metric, follow this pattern:

```javascript
// 1. Add DOM element to index.html
<div class="metric-item">
    <span class="metric-label">New Metric</span>
    <span class="metric-value" id="new-metric">---</span>
</div>

// 2. Cache element in initUI()
this.elements = {
    // ...
    newMetric: document.getElementById('new-metric')
};

// 3. Update in appropriate function
updateBrowserMetrics() {
    const value = getMetricValue();
    this.elements.newMetric.textContent = value;
    this.elements.newMetric.className = 'metric-value ' + getStatusClass(value);
}
```

### Error Tracking Hook

The widget patches `telemetry.captureError()` to intercept all errors:

```javascript
const originalCapture = telemetry.captureError.bind(telemetry);
telemetry.captureError = (error, context) => {
    this.trackError(error, context);
    return originalCapture(error, context);  // Call original
};
```

This is non-destructive — the original telemetry function still runs.

### Chart Rendering

The latency chart uses HTML5 Canvas with manual rendering:

```javascript
// Auto-scales to max latency
const maxLatency = Math.max(...this.wsLatencyHistory.map(h => h.latency), 100);

// Maps time to X position (60-second window)
const x = w - (age / timeWindow) * w;

// Maps latency to Y position (inverted, 0 at bottom)
const y = h - (point.latency / maxLatency) * h;
```

Grid lines drawn every 25% of height for reference.

## Version History

**v1.0.0** (2025-02-07)
- Initial release
- WebSocket, browser, error, and health monitoring
- 60-second latency chart
- Event log with color-coded severity
- Reset statistics button
- Mobile responsive layout
