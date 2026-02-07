# Hot Reload for Widgets

## Overview

Hot reload provides live updates during development - CSS changes reload instantly without losing state, while JS/HTML changes trigger a full page reload.

## Features

- **Smart Reloading**: CSS hot-swaps without page refresh, JS/HTML full-reloads
- **Widget Filtering**: Only reloads when relevant files change (current widget or shared files)
- **Development Only**: Auto-detects localhost/development mode
- **Zero Configuration**: Works automatically when script is included

## Setup

Add the hot reload client to any widget HTML:

```html
<head>
    <link rel="stylesheet" href="styles.css">
    <script src="/ui/shared/hot-reload-client.js"></script>
</head>
```

The script will:
- Only activate in development (localhost, 127.0.0.1, or `?hotreload=true`)
- Connect to the same WebSocket server as the main app
- Listen for file-changed events from the backend

## How It Works

### Backend (backend/hot-reload.js)
- Watches `ui/`, `config/`, `backend/` with chokidar
- Broadcasts file-changed events to all connected WebSocket clients
- Already integrated into server.js

### Frontend (ui/shared/hot-reload-client.js)
- Connects WebSocket in development mode only
- Filters changes by widget path (e.g., only reload gtn750 if gtn750 files changed)
- Reloads relevant files:
  - **CSS**: Cache-busting reload of stylesheets
  - **JS**: Full page reload after 300ms
  - **HTML**: Full page reload after 300ms
  - **JSON**: Full page reload after 500ms
  - **Delete**: Full page reload after 500ms

### Widget Path Filtering

```javascript
// Example: /ui/gtn750/ only reloads for:
- ui/gtn750/**/*        (widget files)
- ui/shared/**/*        (shared library)
- config/**/*           (configuration)
```

## Manual Control

Access via browser console:

```javascript
// Check connection status
window.__hotReload.status()
// { connected: true, attempts: 0 }

// Manually reconnect
window.__hotReload.reconnect()

// Disconnect
window.__hotReload.disconnect()
```

## Testing

1. Start the server: `npm start`
2. Open widget in browser: `http://localhost:8080/ui/gtn750/`
3. Edit a CSS file (e.g., `ui/gtn750/styles.css`)
4. Watch the console for `[HotReload] File changed: ...`
5. CSS changes apply instantly without refresh

## Widgets with Hot Reload

Currently enabled:
- ✅ gtn750
- ✅ copilot-widget
- ✅ engine-monitor

To enable for other widgets, add the script tag to their `index.html`.

## Troubleshooting

**Not reloading?**
1. Check console for `[HotReload] Connected ✓`
2. Verify file path matches widget name
3. Check backend logs for file-changed events

**Too many reloads?**
- Shared file changes trigger reloads in all widgets - this is expected

**Reconnect issues?**
- Max 10 reconnect attempts with exponential backoff (2s → 10s)
- Check server WebSocket health

## Technical Details

| Setting | Value |
|---------|-------|
| Protocol | WebSocket (ws:// or wss://) |
| Max Reconnects | 10 attempts |
| Backoff | 2s × attempts, max 10s |
| CSS Cache-Bust | ?v=timestamp |
| Cleanup | beforeunload event |

## Notes

- Hot reload runs in an IIFE, no global pollution
- Uses try-catch for JSON parsing (ignores non-hot-reload WS messages)
- Reconnect timeout cleared on page unload to prevent memory leaks
- Changes to backend files may require server restart (not auto-detected by widgets)
