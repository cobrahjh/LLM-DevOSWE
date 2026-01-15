# Kitt Browser Bridge

Proprietary browser automation extension for the LLM-DevOSWE framework.

## Overview

This extension provides browser automation capabilities without third-party dependencies. It connects to a local WebSocket server and executes commands from Claude Code or other agents.

## Architecture

```
Claude Code / Kitt Agent
         │
         │ HTTP REST API
         ▼
    Bridge Server (port 8620)
         │
         │ WebSocket
         ▼
    Browser Extension
         │
         │ Chrome APIs
         ▼
    Web Pages (Google Docs, etc.)
```

## Installation

### 1. Start the Bridge Server

```bash
cd C:/LLM-DevOSWE/Admin/browser-extension
node bridge-server.js
```

Or add to your startup scripts.

### 2. Load the Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `C:/LLM-DevOSWE/Admin/browser-extension`

### 3. Verify Connection

The extension popup should show "Connected" when the bridge server is running.

## API Reference

### GET /status
Check if extension is connected.

```bash
curl http://localhost:8620/status
```

### GET /tabs
List all open tabs.

```bash
curl http://localhost:8620/tabs
```

### GET /active
Get the active tab.

```bash
curl http://localhost:8620/active
```

### POST /navigate
Navigate a tab to URL.

```bash
curl -X POST http://localhost:8620/navigate \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "url": "https://docs.google.com"}'
```

### POST /newtab
Open a new tab.

```bash
curl -X POST http://localhost:8620/newtab \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.google.com/document/create"}'
```

### POST /click
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

### POST /type
Type text into an element.

```bash
curl -X POST http://localhost:8620/type \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "input[name=title]", "text": "My Document"}'
```

### POST /input
Set input value directly.

```bash
curl -X POST http://localhost:8620/input \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "selector": "input.rename", "value": "New Title"}'
```

### POST /read
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

### POST /execute
Execute JavaScript in page context.

```bash
curl -X POST http://localhost:8620/execute \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123, "code": "document.title"}'
```

### POST /screenshot
Capture visible tab as base64 PNG.

```bash
curl -X POST http://localhost:8620/screenshot \
  -H "Content-Type: application/json" \
  -d '{"tabId": 123}'
```

## Usage from Claude Code

```javascript
// Helper function
async function browser(endpoint, params = {}) {
    const res = await fetch(`http://localhost:8620${endpoint}`, {
        method: endpoint === '/status' || endpoint === '/tabs' || endpoint === '/active' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(params).length ? JSON.stringify(params) : undefined
    });
    return res.json();
}

// Examples
await browser('/status');
await browser('/newtab', { url: 'https://docs.google.com/document/create' });
await browser('/type', { tabId: 123, text: 'Hello World' });
```

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
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

## Security Notes

- Only accepts connections from localhost
- No external network access
- Runs in isolated extension context
- Commands require explicit tab IDs
