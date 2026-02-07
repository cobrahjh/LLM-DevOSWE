# Kitt Browser Bridge v2.0.0

Browser automation extension with BrowserMCP-compatible features for the LLM-DevOSWE framework.

## Overview

This extension provides browser automation capabilities matching BrowserMCP functionality. It connects to a local WebSocket server and executes commands from Claude Code or other agents.

## Architecture

```
Claude Code / Kitt Agent
         |
         | HTTP REST API
         v
    Bridge Server (port 8620)
         |
         | WebSocket
         v
    Browser Extension
         |
         | Chrome APIs
         v
    Web Pages
```

## Installation

### 1. Start the Bridge Server

```bash
cd C:/LLM-DevOSWE/Admin/browser-extension
node bridge-server.js
```

### 2. Load the Extension

1. Open Chrome -> `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `C:/LLM-DevOSWE/Admin/browser-extension`

### 3. Verify Connection

The extension popup should show "Connected" when the bridge server is running.

## API Reference

### Navigation

#### GET /status
Check if extension is connected.
```bash
curl http://localhost:8620/status
```

#### GET /tabs
List all open tabs.
```bash
curl http://localhost:8620/tabs
```

#### GET /active
Get the active tab.
```bash
curl http://localhost:8620/active
```

#### POST /navigate
Navigate a tab to URL.
```bash
curl -X POST http://localhost:8620/navigate \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "url": "https://example.com"}'
```

#### POST /back
Go back in browser history.
```bash
curl -X POST http://localhost:8620/back \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

#### POST /forward
Go forward in browser history.
```bash
curl -X POST http://localhost:8620/forward \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

#### POST /newtab
Open a new tab.
```bash
curl -X POST http://localhost:8620/newtab \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

#### POST /close
Close a tab.
```bash
curl -X POST http://localhost:8620/close \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

#### POST /focus
Focus a tab.
```bash
curl -X POST http://localhost:8620/focus \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

### Interaction

#### POST /click
Click an element by selector or coordinates.
```bash
# By selector
curl -X POST http://localhost:8620/click \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "button.submit"}'

# By coordinates
curl -X POST http://localhost:8620/click \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "x": 500, "y": 300}'
```

#### POST /type
Type text into an element. Use `submit: true` to press Enter after.
```bash
curl -X POST http://localhost:8620/type \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "input[name=search]", "text": "hello", "submit": true}'
```

#### POST /hover
Hover over an element.
```bash
curl -X POST http://localhost:8620/hover \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": ".menu-item"}'
```

#### POST /drag
Drag and drop between elements.
```bash
curl -X POST http://localhost:8620/drag \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "from": "#draggable", "to": "#dropzone"}'
```

#### POST /key
Press a keyboard key.
```bash
curl -X POST http://localhost:8620/key \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "key": "Enter"}'
```

Supported keys: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`, `Space`, or any single character.

#### POST /select
Select an option in a dropdown.
```bash
curl -X POST http://localhost:8620/select \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "select#country", "values": ["US"]}'
```

### Data & Inspection

#### POST /snapshot
Capture accessibility snapshot of the page. Returns a tree structure with element references, roles, and names.
```bash
curl -X POST http://localhost:8620/snapshot \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

#### POST /screenshot
Capture visible tab as base64 PNG.
```bash
curl -X POST http://localhost:8620/screenshot \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

#### POST /read
Read page content.
```bash
# Read entire page
curl -X POST http://localhost:8620/read \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'

# Read specific element
curl -X POST http://localhost:8620/read \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "#content"}'
```

#### GET /console
Get console logs from the page.
```bash
curl "http://localhost:8620/console?tabId=123"
```

#### POST /execute
Execute JavaScript in page context.
```bash
curl -X POST http://localhost:8620/execute \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "code": "document.title"}'
```

### Timing

#### POST /wait
Wait for specified seconds.
```bash
curl -X POST http://localhost:8620/wait \
  -H "Content-Type: application/json" \
  -d '{"time": 2}'
```

### Tab Grouping

#### GET /groups
List all tab groups.
```bash
curl http://localhost:8620/groups
```

#### POST /group
Create a group from existing tabs.
```bash
curl -X POST http://localhost:8620/group \
  -H "Content-Type: application/json" \
  -d '{"tabIds": [123, 456], "title": "Research", "color": "blue"}'
```

#### POST /group/add
Add tabs to an existing group.
```bash
curl -X POST http://localhost:8620/group/add \
  -H "Content-Type: application/json" \
  -d '{"groupId": 1, "tabIds": [789]}'
```

#### POST /opengroup
Open URLs in a new group.
```bash
curl -X POST http://localhost:8620/opengroup \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://a.com", "https://b.com"], "title": "Docs", "color": "green"}'
```

#### POST /ungroup
Remove tabs from their group.
```bash
curl -X POST http://localhost:8620/ungroup \
  -H "Content-Type: application/json" \
  -d '{"tabIds": [123]}'
```

#### POST /group/collapse
Collapse or expand a tab group.
```bash
curl -X POST http://localhost:8620/group/collapse \
  -H "Content-Type: application/json" \
  -d '{"groupId": 1, "collapsed": true}'
```

## Feature Comparison with BrowserMCP

| Feature | Kitt Bridge | BrowserMCP |
|---------|-------------|------------|
| Navigate | Yes | Yes |
| Go Back | Yes | Yes |
| Go Forward | Yes | Yes |
| Click | Yes | Yes |
| Type Text | Yes | Yes |
| Hover | Yes | Yes |
| Drag & Drop | Yes | Yes |
| Press Key | Yes | Yes |
| Select Option | Yes | Yes |
| Snapshot | Yes | Yes |
| Screenshot | Yes | Yes |
| Console Logs | Yes | Yes |
| Wait | Yes | Yes |
| Tab Groups | Yes | - |

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (v2.0.0) |
| `background.js` | Service worker, WebSocket client |
| `content.js` | Page interaction scripts |
| `bridge-server.js` | Node.js HTTP/WebSocket server |
| `popup.html/js` | Extension popup UI |

## Troubleshooting

### Extension shows "Disconnected"
- Ensure bridge-server.js is running
- Check port 8620 is not in use
- Restart the extension

### Commands timeout
- Check the target tab exists
- Ensure the page is fully loaded
- Verify selectors are correct

### Cannot interact with page
- Some pages block content scripts (chrome://, extensions)
- Try refreshing the target page
- Check console for errors

### Console logs not captured
- The console capture is injected on first request
- Previous logs before injection are not captured
- Refresh the page and try again

## Security Notes

- Only accepts connections from localhost
- No external network access
- Runs in isolated extension context
- Commands require explicit tab IDs
