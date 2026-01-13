# SimWidget Hybrid

A dual-development setup for MSFS 2024 aircraft control widget with:
- **Fast browser development** (instant refresh)
- **MSFS toolbar panel** (fullscreen compatible)

Both share the same UI code and connect to a common backend server.

---

## Dual-PC Development Setup

This project uses a **two-PC workflow** with Google Drive sync:

| PC | Role | Path |
|----|------|------|
| **Development PC** | Edit code, Claude AI | `C:\LLM-DevOSWE\SimWidget Engine\simwidget-hybrid\` |
| **Remote PC** | Run MSFS, test UI | `G:\Other computers\Claude Development Enviroment\DevClaude\SimWidget Engine\simwidget-hybrid\` |

### How It Works
1. **Development PC** has Google Drive sync enabled on `C:\LLM-DevOSWE\`
2. **Remote PC** accesses the shared folder via `G:\Other computers\Claude Development Enviroment\DevClaude\`
3. Files edited on Development PC automatically sync to Remote PC
4. Remote PC runs the backend server and MSFS for testing

### Workflow
1. Edit files on **Development PC** (via Claude AI or manually)
2. Files sync via Google Drive
3. Restart server on **Remote PC** or refresh browser
4. Test changes immediately

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────┐                    ┌──────────────────┐  │
│  │   Browser    │────┐               │                  │  │
│  │ localhost:8080│    │   WebSocket  │   SimConnect     │  │
│  └──────────────┘    ├──────────────►│     (MSFS)       │  │
│                      │               │                  │  │
│  ┌──────────────┐    │               └──────────────────┘  │
│  │   Toolbar    │────┘                        ▲            │
│  │    Panel     │                             │            │
│  └──────────────┘         ┌───────────────────┘            │
│                           │                                │
│                    ┌──────┴───────┐                        │
│                    │   Backend    │                        │
│                    │   Server     │                        │
│                    │  (Node.js)   │                        │
│                    └──────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### On Remote PC (MSFS Testing)

1. **Start the server** - Double-click:
   ```
   G:\Other computers\Claude Development Enviroment\DevClaude\SimWidget Engine\simwidget-hybrid\start-server.bat
   ```

2. **Open browser:** http://localhost:8080

3. **(Optional) Start MSFS** for live SimConnect data

### On Development PC (Code Editing)

Edit files in:
```
C:\LLM-DevOSWE\SimWidget Engine\simwidget-hybrid\shared-ui\
```

Changes sync automatically via Google Drive.

---

## Project Structure

```
simwidget-hybrid/
├── backend/
│   ├── package.json      # Node.js dependencies
│   └── server.js         # WebSocket + SimConnect server
│
├── shared-ui/            # UI code (works in both browser & panel)
│   ├── index.html        # Main HTML
│   ├── styles.css        # Styles
│   └── app.js            # WebSocket client + UI logic
│
├── toolbar-panel/        # MSFS toolbar panel wrapper
│   └── index.html        # Loads shared-ui from localhost
│
├── start-server.bat      # Launch script for Remote PC
└── README.md
```

---

## Features

### Flight Data
- Altitude, Speed, Heading, Vertical Speed
- Real-time updates via WebSocket
- V/S color coding (green=climb, orange=descent)

### Systems Control
- Parking Brake toggle
- Landing Gear toggle
- Flaps toggle

### Lights Control
- NAV, BCN, STRB, LDG, TAXI
- Click to toggle on/off
- Green indicator = ON

### Engine Status
- Running state (ON/OFF)
- Throttle percentage

### Connection Status
- 🟢 Green dot = Connected to MSFS
- 🟡 Yellow dot = Mock mode (no MSFS)
- 🔴 Red dot = Backend disconnected

---

## Backend API

### WebSocket (ws://localhost:8080)

**Incoming Messages:**
```json
{
  "type": "flightData",
  "data": {
    "altitude": 5000,
    "speed": 120,
    "heading": 270,
    "verticalSpeed": 500,
    "parkingBrake": false,
    "gearDown": true,
    ...
  }
}
```

**Outgoing Commands:**
```json
{
  "type": "command",
  "command": "TOGGLE_NAV_LIGHTS",
  "value": 0
}
```

### REST API

**GET /api/status**
Returns current flight data and connection status.

**POST /api/command**
```json
{
  "command": "GEAR_TOGGLE",
  "value": 0
}
```

---

## Customization

### Adding New SimVars

1. Edit `backend/server.js`
2. Add to `handle.addToDataDefinition()`
3. Update `flightData` object in data handler
4. Update `shared-ui/app.js` `updateUI()` method
5. Add UI elements in `shared-ui/index.html`

### Styling

Edit `shared-ui/styles.css`. Changes sync via Google Drive and appear after browser refresh.

---

## Troubleshooting

### "Backend Not Running" in toolbar panel
- Run `start-server.bat` on Remote PC
- Check that port 8080 is not blocked

### Port 8080 already in use
- Close any existing server windows
- Or run in cmd: `taskkill /F /IM node.exe`

### No SimConnect data
- Make sure MSFS 2024 is running
- Backend shows "Running in MOCK mode" if MSFS not detected

### Files not syncing
- Check Google Drive sync status on Development PC
- Ensure Remote PC has network access to Google Drive folder

### WebSocket connection failed
- Check firewall settings for localhost:8080
- Try restarting the backend server

---

## Path Reference

| Description | Development PC | Remote PC |
|-------------|----------------|-----------|
| Project Root | `C:\LLM-DevOSWE\SimWidget Engine\simwidget-hybrid\` | `G:\Other computers\Claude Development Enviroment\DevClaude\SimWidget Engine\simwidget-hybrid\` |
| Shared UI | `...\shared-ui\` | `...\shared-ui\` |
| Backend | `...\backend\` | `...\backend\` |
| Start Script | N/A | `...\start-server.bat` |

---

## License

MIT License
