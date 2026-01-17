# Service Registry
**Last Updated:** 2026-01-16
**Single source of truth for all services, ports, and endpoints**

---

## Quick Reference

| Port | Service | Status | Start Command |
|------|---------|--------|---------------|
| 3002 | Oracle | Core | `node C:\LLM-Oracle\oracle.js` |
| 8080 | SimWidget Main | Core | `node C:\LLM-DevOSWE\simwidget-hybrid\backend\server.js` |
| 8500 | Master Orchestrator | Core | `node C:\LLM-DevOSWE\Admin\orchestrator\orchestrator.js` |
| 8585 | Agent/KittBox UI | Core | `node C:\LLM-DevOSWE\Admin\agent\agent-server.js` |
| 8590 | Remote Support | Core | `node C:\LLM-DevOSWE\Admin\remote-support\service.js` |
| 8600 | Relay | Core | `node C:\LLM-DevOSWE\Admin\relay\relay-service.js` |
| 8610 | Smart Router | Optional | `node C:\LLM-DevOSWE\Admin\claude-bridge\smart-router.js` |
| 8620 | Browser Bridge | Optional | `node C:\LLM-DevOSWE\Admin\browser-extension\bridge-server.js` |
| 8621 | Google Drive | Optional | `node C:\LLM-DevOSWE\Admin\google-drive\drive-service.js` |
| 8700 | Claude Bridge | Optional | `node C:\LLM-DevOSWE\Admin\claude-bridge\bridge-service.js` |
| 8701 | Hive-Mind | Core | `node C:\LLM-DevOSWE\Admin\hive-mind\hive-mind-server.js` |
| 8800 | Hive Brain | Core | `node C:\LLM-DevOSWE\Admin\hive-brain\server.js` |
| 8850 | Hive Oracle | Core | `node C:\LLM-DevOSWE\Admin\hive-oracle\server.js` |
| 11434 | Ollama | External | `ollama serve` |
| 1234 | Iris (ai-pc) | External | LM Studio on 192.168.1.162 |

---

## Core Services (Always Run)

### Oracle (Port 3002)
- **Location:** `C:\LLM-Oracle\oracle.js`
- **Purpose:** LLM backend, project file access, sandbox operations, tinyAI API
- **Endpoints:**
  - `POST /api/ask` - Ask LLM a question
  - `GET /api/sandbox` - List sandbox files
  - `POST /api/sandbox/write` - Write to sandbox
  - `GET /api/projects` - List registered projects
- **Database:** `C:\LLM-Oracle\oracle-data\memory.json`

### Relay (Port 8600)
- **Location:** `C:\LLM-DevOSWE\Admin\relay\relay-service.js`
- **Purpose:** Message relay, task queue, WebSocket events, update distribution
- **Endpoints:**
  - `GET /api/messages/pending` - Get pending messages
  - `POST /api/messages/:id/respond` - Respond to message
  - `GET /api/tasks` - List tasks
  - `GET /api/updates/:app` - Get app update manifest
- **Database:** `C:\LLM-DevOSWE\Admin\relay\tasks.db` (SQLite)

### Agent/KittBox (Port 8585)
- **Location:** `C:\LLM-DevOSWE\Admin\agent\agent-server.js`
- **Purpose:** Command Center web UI, Claude API integration, task execution
- **UI:** `http://localhost:8585` (Command Center)
- **Endpoints:**
  - `POST /api/chat` - Send chat message
  - `GET /api/tasks` - Get task list
  - `POST /api/execute` - Execute command

### Master Orchestrator (Port 8500)
- **Location:** `C:\LLM-DevOSWE\Admin\orchestrator\orchestrator.js`
- **Purpose:** Health watchdog, service auto-restart, dashboard
- **UI:** `http://localhost:8500`
- **Monitors:** All core services

### SimWidget Main (Port 8080)
- **Location:** `C:\LLM-DevOSWE\simwidget-hybrid\backend\server.js`
- **Purpose:** MSFS SimConnect bridge, flight data WebSocket, widget API
- **WebSocket:** `ws://localhost:8080`
- **Endpoints:**
  - `GET /api/status` - Connection status
  - `POST /api/command` - Send SimConnect command
  - `GET /api/keymaps` - Get key mappings

### Remote Support (Port 8590)
- **Location:** `C:\LLM-DevOSWE\Admin\remote-support\service.js`
- **Purpose:** Remote command execution, file operations, service control

### Hive-Mind (Port 8701)
- **Location:** `C:\LLM-DevOSWE\Admin\hive-mind\hive-mind-server.js`
- **Purpose:** Real-time activity monitor, service health dashboard
- **UI:** `http://localhost:8701`
- **WebSocket:** Real-time activity feed
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/hive/status` - All services status
  - `GET /api/activity` - Activity log

### Hive Brain (Port 8800)
- **Location:** `C:\LLM-DevOSWE\Admin\hive-brain\server.js`
- **Purpose:** Central admin control center, device discovery, infection (auto-install)
- **UI:** `http://localhost:8800`
- **WebSocket:** Real-time colony updates
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/colony` - List all devices
  - `POST /api/scan` - Start network scan
  - `GET /api/pending` - Devices awaiting approval
  - `POST /api/approve/:ip` - Approve device
  - `POST /api/infect/:ip` - Install Hive on device
  - `POST /api/device` - Add device manually
  - `GET /api/device/:ip/health` - Check device health
- **Features:**
  - Network scanner (192.168.x.x)
  - Device fingerprinting (OS, ports, services)
  - SSH push-install or manual link
  - Colony health monitoring

### Hive Oracle (Port 8850)
- **Location:** `C:\LLM-DevOSWE\Admin\hive-oracle\server.js`
- **Purpose:** Distributed LLM orchestrator across the colony
- **UI:** `http://localhost:8850`
- **WebSocket:** Real-time node discovery and status
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/nodes` - List all LLM nodes
  - `GET /api/nodes/:id` - Get specific node info
  - `POST /api/query` - Route query to best available LLM
  - `POST /api/mastermind` - Query ALL nodes in parallel
  - `GET /api/stats` - Load balancing statistics
  - `POST /api/memory/store` - Store in distributed memory
  - `GET /api/memory/recall` - Recall from distributed memory
- **Features:**
  - Auto-discovery of LLM nodes (Ollama, LM Studio, etc.)
  - Load balancing with health checks
  - Master Mind: parallel query to all nodes
  - Distributed memory across colony
  - Consensus aggregation for multiple responses

---

## Optional Services

### Smart Router (Port 8610)
- **Location:** `C:\LLM-DevOSWE\Admin\claude-bridge\smart-router.js`
- **Purpose:** Routes to Claude Code (priority) or fallback LLM (Ollama/Iris)

### Browser Bridge (Port 8620)
- **Location:** `C:\LLM-DevOSWE\Admin\browser-extension\bridge-server.js`
- **Purpose:** Browser automation API, tab control, screenshots

### Google Drive Service (Port 8621)
- **Location:** `C:\LLM-DevOSWE\Admin\google-drive\drive-service.js`
- **Purpose:** Google Drive API, document backup, OAuth

### Claude Bridge (Port 8700)
- **Location:** `C:\LLM-DevOSWE\Admin\claude-bridge\bridge-service.js`
- **Purpose:** WebSocket bridge to Claude Code CLI

### Terminal Bridge (Port 8701)
- **Location:** `C:\LLM-DevOSWE\Admin\terminal-bridge\terminal-bridge.js`
- **Purpose:** Streams Claude Code output to Command Center

---

## External Services

### Ollama (Port 11434)
- **Host:** localhost
- **Purpose:** Local LLM inference
- **Models:**
  - `qwen3-coder:latest` - Primary (30.5B, 34 tok/s)
  - `qwen2.5-coder:7b` - Fast (172 tok/s)
  - `kitt:latest` - Custom fine-tuned

### Iris (Port 1234)
- **Host:** 192.168.1.162 (ai-pc)
- **Purpose:** Remote LLM fallback
- **Models:** qwen3-vl-4b (vision), vt-gwen-2.5-3b

---

## Desktop Apps

### Kitt Live
- **Location:** `C:\kittbox-modules\kitt-live`
- **Type:** Electron desktop app
- **Hotkey:** Alt+K to toggle
- **Purpose:** Voice/text AI assistant with TTS

---

## Health Check

```powershell
# Quick check all core services
$ports = @(3002, 8080, 8500, 8585, 8590, 8600)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Write-Host "OK: Port $port" -ForegroundColor Green }
    else { Write-Host "DOWN: Port $port" -ForegroundColor Red }
}
```

---

## Network Diagram

```
                    ┌─────────────────────────────────────┐
                    │           USER INTERFACES           │
                    ├─────────────────────────────────────┤
                    │  Command Center    Kitt Live        │
                    │  :8585 (web)       Alt+K (desktop)  │
                    │  Phone (KittBox)                    │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         RELAY SERVICE :8600         │
                    │  Message queue, task persistence    │
                    │  SQLite database, WebSocket events  │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Oracle :3002   │    │  Agent :8585    │    │ Smart Router    │
│  LLM Backend    │    │  Task Executor  │    │    :8610        │
│  Project API    │    │  Command Center │    │  LLM Routing    │
└────────┬────────┘    └─────────────────┘    └────────┬────────┘
         │                                             │
         │              ┌──────────────────────────────┤
         ▼              ▼                              ▼
┌─────────────────┐ ┌─────────────────┐    ┌─────────────────┐
│ Ollama :11434   │ │ Claude Code     │    │ Iris :1234      │
│ Local LLM       │ │ (Terminal)      │    │ Remote LLM      │
│ qwen3-coder     │ │ FREE            │    │ ai-pc backup    │
└─────────────────┘ └─────────────────┘    └─────────────────┘
```
