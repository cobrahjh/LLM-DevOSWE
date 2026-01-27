# Terminal Hub

**Port:** 8771
**Web UI:** http://localhost:8771
**HTTPS:** https://192.168.1.192:8443/terminal/

Web-based terminal manager for the Hive. Manage multiple shell sessions, monitor processes, and bridge Windows Terminal output.

---

## Features

- **Multi-shell support** - PowerShell, CMD, Git Bash
- **Real-time output** - WebSocket streaming
- **Process monitor** - View running apps with CPU/RAM stats
- **Windows Terminal integration** - Launch WT tabs with output bridged back
- **Mobile responsive** - Works on phone via HTTPS

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TERMINAL HUB UI                          │
│                  http://localhost:8771                      │
├─────────────────────────────────────────────────────────────┤
│  Sidebar          │  Terminal Output                        │
│  ┌─────────────┐  │  ┌─────────────────────────────────┐   │
│  │ Terminals   │  │  │ PS C:\> dir                     │   │
│  │ - PowerShell│  │  │ Directory of C:\                │   │
│  │ - CMD       │  │  │ ...                             │   │
│  │ - Git Bash  │  │  └─────────────────────────────────┘   │
│  │ - WT Bridge │  │                                        │
│  ├─────────────┤  │  ┌─────────────────────────────────┐   │
│  │ Apps        │  │  │ > command input                 │   │
│  │ - node      │  │  └─────────────────────────────────┘   │
│  │ - python    │  │                                        │
│  └─────────────┘  │                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 TERMINAL HUB SERVER                         │
│              terminal-hub-server.js :8771                   │
├─────────────────────────────────────────────────────────────┤
│  Terminal Manager        │  Process Manager                 │
│  - spawn shells          │  - Get-Process list              │
│  - stdin/stdout pipes    │  - CPU/RAM monitoring            │
│  - buffer management     │  - Kill processes                │
│                          │                                  │
│  Windows Terminal Bridge │                                  │
│  - wt.exe launcher       │                                  │
│  - HTTP bridge endpoint  │                                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │PowerShell│   │   CMD    │   │ Git Bash │
        │ process  │   │ process  │   │ process  │
        └──────────┘   └──────────┘   └──────────┘
```

---

## Windows Terminal Bridge

Launch terminals that run inside Windows Terminal but stream output back to Terminal Hub.

```
┌─────────────────┐     HTTP POST        ┌─────────────────┐
│ Windows Terminal│ ──────────────────▶  │  Terminal Hub   │
│                 │  /api/terminals/     │                 │
│ ┌─────────────┐ │     bridge           │ ┌─────────────┐ │
│ │ wt-bridge.ps1│ │                     │ │ Terminal #4 │ │
│ │ Send-ToHub() │ │                     │ │ [WT Badge]  │ │
│ └─────────────┘ │                     │ └─────────────┘ │
└─────────────────┘                     └─────────────────┘
```

**Files:**
- `wt-bridge.ps1` - PowerShell script that runs in WT, sends output via HTTP
- `launch-bridge.bat` - Batch launcher for proper argument handling

---

## API Endpoints

### Terminals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/terminals` | List all terminals |
| POST | `/api/terminals` | Create new terminal |
| DELETE | `/api/terminals/:id` | Kill terminal |
| GET | `/api/terminals/:id/buffer` | Get terminal output |
| POST | `/api/terminals/wt` | Launch in Windows Terminal |
| POST | `/api/terminals/bridge` | Receive WT bridge output |

### Processes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/processes` | List running processes |
| POST | `/api/processes/attach` | Monitor a process |
| POST | `/api/processes/kill` | Kill a process |
| GET | `/api/wt/windows` | List Windows Terminal windows |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

---

## WebSocket

Connect to `ws://localhost:8771/?id=N` to stream terminal output.

**Messages received:**
```json
{"type": "output", "data": "PS C:\\> "}
{"type": "exit", "code": 0}
{"type": "error", "message": "..."}
```

**Messages to send:**
```json
{"type": "input", "data": "dir\r\n"}
```

---

## Usage Examples

### Create a terminal
```bash
curl -X POST http://localhost:8771/api/terminals \
  -H "Content-Type: application/json" \
  -d '{"title":"My Shell","shell":"powershell","cwd":"C:\\Projects"}'
```

### Launch Windows Terminal tab
```bash
curl -X POST http://localhost:8771/api/terminals/wt \
  -H "Content-Type: application/json" \
  -d '{"title":"Dev Shell","shell":"powershell"}'
```

### Get terminal output
```bash
curl http://localhost:8771/api/terminals/1/buffer
```

### List processes
```bash
curl http://localhost:8771/api/processes
```

### Monitor a process
```bash
curl -X POST http://localhost:8771/api/processes/attach \
  -H "Content-Type: application/json" \
  -d '{"pid":12345,"name":"node"}'
```

---

## UI Features

### Header Buttons
- **+ New** - Create terminal (opens modal)
- **+ WT** - Launch in Windows Terminal
- **↻** - Refresh terminal list

### Sidebar Tabs
- **Terminals** - List of active terminals
- **Apps** - Running processes with stats

### Terminal List
- Click to select terminal
- Green dot = running, Red = dead
- **WT** badge = Windows Terminal bridge
- **X** button to close

### Apps List
- Shows process name, PID, CPU, RAM
- Window title (if available)
- **Attach** - Monitor process stats
- **Kill** - Terminate process
- **Filter** - "Only apps with windows"

---

## Shell Configurations

| Shell | Path | Args |
|-------|------|------|
| PowerShell | `powershell.exe` | `-NoLogo -NoExit` |
| CMD | `cmd.exe` | `/K` |
| Git Bash | `C:\Program Files\Git\usr\bin\bash.exe` | `--login -i` |

---

## Default Terminals

On startup, creates 3 terminals:
1. PowerShell - `C:\LLM-DevOSWE`
2. CMD - `C:\LLM-DevOSWE`
3. Git Bash - `/c/LLM-DevOSWE`

---

## Files

```
Admin/terminal-hub/
├── terminal-hub-server.js  # Main server
├── terminal-hub.html       # Web UI
├── wt-bridge.ps1          # Windows Terminal bridge script
├── launch-bridge.bat      # Batch launcher for WT
└── README.md              # This file
```
