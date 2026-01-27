# Service Registry
**Last Updated:** 2026-01-27
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
| 8771 | Terminal Hub | Core | `node C:\LLM-DevOSWE\Admin\terminal-hub\terminal-hub-server.js` |
| 8800 | Agents (HiveImmortal) | Core | DevClaude Hivemind Oracle (16 agents) |
| 8810 | Hive Brain | Core | `node C:\LLM-DevOSWE\Admin\hive-brain\hive-brain.js` |
| 8820 | Master Mind | Core | `node C:\LLM-DevOSWE\Admin\master-mind\master-mind.js` |
| 8850 | Hive Oracle | Core | `node C:\LLM-DevOSWE\Admin\hive-oracle\server.js` |
| 8830 | PMS50 GTN750 | Optional | `node C:\PMS50-Prototype\server.js` |
| 11434 | Ollama | External | `ollama serve` |
| 1234 | Iris (ai-pc) | External | LM Studio on 192.168.1.162 |
| 3003 | Hive Bridge (ai-pc) | External | `node C:\Hive\services\hive-bridge.js` |
| 8860 | MCP-Hive Bridge | Core | `node C:\LLM-DevOSWE\Admin\mcp-bridge\server.js` |
| 8870 | Hive Voice | Optional | `node C:\LLM-DevOSWE\Admin\hive-voice\voice-server.js` |
| 8899 | Hive Dashboard | Core | `node C:\LLM-DevOSWE\Admin\hive-dashboard\server.js` |

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
- **Purpose:** Message relay, task queue, WebSocket events, alert system
- **Endpoints:**
  - `GET /api/messages/pending` - Get pending messages
  - `POST /api/messages/:id/respond` - Respond to message
  - `GET /api/tasks` - List tasks
  - `GET /api/updates/:app` - Get app update manifest
  - `POST /api/alerts` - Create alert (severity, source, title, message, service)
  - `GET /api/alerts` - List alerts (filter: severity, since, unacked)
  - `POST /api/alerts/:id/ack` - Acknowledge alert
  - `GET /api/alerts/summary` - 24h alert summary
- **Database:** `C:\LLM-DevOSWE\Admin\relay\tasks.db` (SQLite)
- **Alert System:** Orchestrator sends service health alerts, Slack webhook support via SLACK_WEBHOOK_URL env var

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

### Terminal Hub (Port 8771)
- **Location:** `C:\LLM-DevOSWE\Admin\terminal-hub\terminal-hub-server.js`
- **Purpose:** Web-based terminal manager, multi-shell support, process monitoring
- **UI:** `http://localhost:8771`
- **HTTPS:** `https://192.168.1.42:8443/terminal/` (via Caddy)
- **WebSocket:** Real-time terminal I/O
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/terminals` - List all terminals
  - `POST /api/terminals` - Create new terminal
  - `DELETE /api/terminals/:id` - Kill terminal
  - `GET /api/terminals/:id/buffer` - Get terminal output buffer
  - `POST /api/terminals/wt` - Launch terminal in Windows Terminal
  - `POST /api/terminals/bridge` - Receive bridged output from WT
  - `GET /api/processes` - List running processes
  - `POST /api/processes/attach` - Attach to process (monitor)
  - `POST /api/processes/kill` - Kill a process
  - `GET /api/wt/windows` - List Windows Terminal windows
- **Features:**
  - Multi-shell support (PowerShell, CMD, Git Bash)
  - Real-time output streaming via WebSocket
  - Process list with CPU/RAM/window title
  - Windows Terminal integration with output bridging
  - Mobile responsive UI

### Agents / HiveImmortal Oracle (Port 8800)
- **Location:** `C:\DevClaude\Hivemind\Oracle\oracle.js` (managed by HiveImmortal)
- **Purpose:** Agent orchestration for DevClaude Hivemind
- **Endpoints:**
  - `GET /api/health` - Health check (returns agent count)
- **Features:**
  - 16 agents for task orchestration
  - Part of DevClaude Hivemind system

### Hive Brain (Port 8810)
- **Location:** `C:\LLM-DevOSWE\Admin\hive-brain\hive-brain.js`
- **NSSM Service:** HiveBrain
- **Purpose:** Device discovery and colony management
- **UI:** `http://localhost:8810`
- **Endpoints:**
  - `GET /api/health` - Health check
  - `POST /api/discover` - Trigger network scan
  - `GET /api/devices` - List all devices (known + discovered)
  - `GET /api/devices/:ip` - Get specific device
  - `POST /api/devices/:ip/approve` - Approve device to known
  - `DELETE /api/devices/:ip` - Remove device
  - `GET /api/enrollment` - Enrollment queue
  - `POST /api/scan/:ip` - Scan specific IP
  - `GET /api/colony` - All Hive nodes
- **Features:**
  - Network ping sweep (192.168.1.x)
  - Port scanning for Hive services
  - Device fingerprinting (OS, services)
  - Approval workflow for new devices
  - Background scanning every 5 minutes

### Master Mind (Port 8820)
- **Location:** `C:\LLM-DevOSWE\Admin\master-mind\master-mind.js`
- **NSSM Service:** HiveMasterMind
- **Purpose:** Parallel LLM orchestrator
- **UI:** `http://localhost:8820`
- **Endpoints:**
  - `GET /api/health` - Health check with backend status
  - `GET /api/backends` - List all LLM backends
  - `POST /api/backends/:id/toggle` - Enable/disable backend
  - `POST /api/query/parallel` - Query ALL backends simultaneously
  - `POST /api/query/smart` - First response wins (fastest)
  - `POST /api/query/:backend` - Query specific backend
  - `GET /api/stats` - Query statistics
  - `POST /api/stats/reset` - Reset statistics
- **Backends:**
  - Ollama (localhost:11434) - qwen3:8b
  - Nova (localhost:1234) - LM Studio local
  - Iris (192.168.1.162:1234) - LM Studio remote
- **Features:**
  - Parallel queries to all backends
  - Smart query (first response wins)
  - Result aggregation and consensus detection
  - Cost tracking for paid APIs (future)

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

### MCP-Hive Bridge (Port 8860)
- **Location:** `C:\LLM-DevOSWE\Admin\mcp-bridge\server.js`
- **Purpose:** Unified MCP server hub for all Hive AI
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/status` - All servers status with tool counts
  - `GET /api/servers` - List available MCP servers
  - `POST /api/servers/:name/start` - Start an MCP server
  - `POST /api/servers/:name/stop` - Stop an MCP server
  - `POST /api/servers/:name/tools/:tool` - Call a tool
  - `POST /api/tool/:tool` - Auto-route tool call
  - `GET /api/quick/search?q=` - Web search (Brave)
  - `GET /api/quick/read-file?path=` - Read file via MCP
  - `GET /api/quick/memory-recall?query=` - Memory recall
- **MCP Servers (11):** filesystem, memory, github, fetch, sqlite, git, time, sequential-thinking, puppeteer, slack, brave-search

### Hive Dashboard (Port 8899)
- **Location:** `C:\LLM-DevOSWE\Admin\hive-dashboard\server.js`
- **Purpose:** Command Center overview dashboard
- **UI:** `http://localhost:8899`
- **Panels:** Daily Briefing, Services, Intel Feed (HN/GitHub/Discoveries/Web Search), Health Trends, Anomalies, Models, MCP Servers, Alerts

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

### PMS50 GTN750 (Port 8830)
- **Location:** `C:\PMS50-Prototype\server.js`
- **NSSM Service:** PMS50GTN750
- **Purpose:** GTN750 avionics prototype for MSFS 2024
- **UI:** `http://localhost:8830`
- **WebSocket:** Real-time flight data updates
- **Endpoints:**
  - `GET /api/health` - Service health
  - `GET /api/state` - Aircraft & nav state
  - `GET /api/flightplan` - Current flight plan
  - `POST /api/flightplan` - Set flight plan
  - `POST /api/direct` - Direct-to waypoint
- **Features:**
  - GTN750 UI mockup with authentic styling
  - Map display with aircraft symbol
  - Navigation data fields (GS, DTK, TRK, DIS, ETE, BRG, ALT)
  - Flight plan line and waypoint display
  - CDI (Course Deviation Indicator)
  - Page tabs (MAP, TFC, WPT, AUX, FPL, PROC, NRST)
- **Planned:**
  - SimConnect integration for real MSFS data
  - Flight plan import (SimBrief, FMS)
  - Procedures (SID/STAR/Approaches)
  - Traffic display (TCAS)
  - Terrain awareness

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

### Hive Bridge (Port 3003)
- **Host:** 192.168.1.162 (ai-pc)
- **Location:** `C:\Hive\services\hive-bridge.js`
- **Purpose:** Bridges ai-pc LM Studio to Hive network
- **Endpoints:**
  - `GET /api/health` - Node health + LM Studio status + model list
  - `GET /api/info` - Node capabilities
  - `/v1/*` - Proxies to LM Studio OpenAI-compatible API
- **Capabilities:** llm, vision, embeddings
- **Firewall:** Ports 1234, 3003 open

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
