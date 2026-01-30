# HIVE SERVICE AUDIT
**Generated:** 2026-01-30

Complete inventory of all services, startup methods, dependencies, and web UIs.

---

## QUICK STATUS

```
CORE SERVICES (Always Required):
  Ollama       :11434  - LLM engine
  Relay        :8600   - Message bus (everything talks to this)
  Oracle       :3002   - LLM API, intel, weather
  Orchestrator :8500   - Watchdog for 18 services

WEB UIs:
  Dashboard    http://localhost:8899    - Main overview
  KittBox      http://localhost:8585    - Command Center
  Orchestrator http://localhost:8500    - Service control
  Hive-Mind    http://localhost:8701    - Activity monitor
  Terminal Hub http://localhost:8771    - Web terminals
```

---

## STARTUP METHODS

### Method 1: hive CLI (RECOMMENDED)
**Location:** `C:\LLM-DevOSWE\hive.bat`

Unified command interface. All services launch with **hidden windows** (no desktop clutter).

```bash
hive start              # Start all services
hive stop               # Stop all services
hive status             # Health check all services
hive restart oracle     # Restart specific service
hive open dashboard     # Open UI in browser
hive open all           # Open Dashboard, KittBox, Orchestrator
```

Startup order (via start-hive.bat):
```
1. Ollama        → LLM engine (if not running)
2. Relay :8600   → Message bus first (HiveStore)
3. Oracle :3002  → LLM API
4. Orchestrator  → Watchdog auto-starts remaining 15 services
```

**Usage:** Double-click or run from terminal

### Method 2: Orchestrator Auto-Start
Once Orchestrator (:8500) is running, it manages these 18 services:

| Priority | Service | Port | Auto-Restart | Directory |
|----------|---------|------|--------------|-----------|
| 0 | Oracle | 3002 | Yes | `C:\LLM-Oracle` |
| 1 | SimWidget | 8080 | Yes | `simwidget-hybrid\backend` |
| 2 | Agent/KittBox | 8585 | Yes | `Admin\agent` |
| 3 | Relay | 8600 | Yes | `Admin\relay` |
| 4 | Remote Support | 8590 | Yes | `Admin\remote-support` |
| 5 | Claude Bridge | 8601 | **No** | `Admin\claude-bridge` |
| 6 | KeySender | null | **No** | `KeySenderService` |
| 7 | Hive-Mind | 8701 | Yes | `Admin\hive-mind` |
| 8 | Terminal Hub | 8771 | Yes | `Admin\terminal-hub` |
| 9 | Hive Brain Admin | 8800 | Yes | `Admin\hive-brain` |
| 10 | Hive Oracle | 8850 | Yes | `Admin\hive-oracle` |
| 11 | Hive-Brain Discovery | 8810 | Yes | `Admin\hive-brain` |
| 12 | Master-Mind | 8820 | Yes | `Admin\master-mind` |
| 13 | Hive-Mesh | 8750 | Yes | `C:\DevClaude\Hivemind\mesh` |
| 14 | Personas | 8770 | Yes | `C:\DevClaude\Hivemind\personas` |
| 14 | MCP-Bridge | 8860 | Yes | `Admin\mcp-bridge` |
| 15 | Dashboard | 8899 | Yes | `Admin\hive-dashboard` |
| 16 | VoiceAccess | 8875 | Yes | `Admin\voiceaccess` |

### Method 3: Individual Startup
Manual start commands for each service:

```bash
# Oracle
cd C:\LLM-Oracle && node oracle.js

# Relay
cd C:\LLM-DevOSWE\Admin\relay && node relay-service.js

# KittBox
cd C:\LLM-DevOSWE\Admin\agent && node agent-server.js

# Dashboard
cd C:\LLM-DevOSWE\Admin\hive-dashboard && node server.js
```

---

## DEPENDENCY MAP

```
┌────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL                                   │
│  Ollama :11434 ─────────────────────────────────────┐              │
│  LM Studio :1234 (optional) ─────────────────────┐  │              │
└──────────────────────────────────────────────────┼──┼──────────────┘
                                                   │  │
┌──────────────────────────────────────────────────┼──┼──────────────┐
│                     CORE LAYER                   │  │              │
│                                                  ▼  ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐        │
│  │ Relay       │◄───│ Orchestrator│    │ Oracle          │        │
│  │ :8600       │    │ :8500       │    │ :3002           │        │
│  │ Message Bus │    │ Watchdog    │    │ LLM API         │        │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘        │
└─────────┼──────────────────┼───────────────────┼──────────────────┘
          │                  │                   │
          ▼                  ▼                   │
┌──────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                 │
│                                                                   │
│  SimWidget :8080      Agent/KittBox :8585     Remote :8590       │
│  (MSFS data)          (Command Center)        (Remote control)   │
│                                                                   │
│  Hive-Mind :8701      Terminal Hub :8771      Dashboard :8899    │
│  (Activity)           (Web terminals)         (Overview UI)       │
│                                                                   │
│  MCP-Bridge :8860     Master-Mind :8820       Hive Oracle :8850  │
│  (7 MCP servers)      (Parallel LLM)          (Distributed LLM)   │
│                                                                   │
│  VoiceAccess :8875    Personas :8770          Hive-Mesh :8750    │
│  (Voice commands)     (AI personas)           (Inter-service)     │
│                                                                   │
│  Hive Brain :8800     Brain Discovery :8810                       │
│  (Admin)              (Device discovery)                          │
└──────────────────────────────────────────────────────────────────┘
```

### Critical Dependencies:
- **All services** → Relay (:8600) for alerts/messages
- **All LLM services** → Ollama (:11434) or Oracle (:3002)
- **Orchestrator** → Nothing (runs independently)
- **Dashboard** → Orchestrator for status, Oracle for data

---

## WEB UIs

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | http://localhost:8899 | Main overview, intel, weather, alerts |
| KittBox | http://localhost:8585 | Command Center, chat, tasks |
| Orchestrator | http://localhost:8500 | Service control panel |
| Hive-Mind | http://localhost:8701 | Real-time activity monitor |
| Terminal Hub | http://localhost:8771 | Web-based terminals |
| Hive Brain | http://localhost:8800 | Admin/device discovery |
| Brain Discovery | http://localhost:8810 | Network scanning |
| Master-Mind | http://localhost:8820 | Parallel LLM queries |
| Hive Oracle | http://localhost:8850 | Distributed LLM |
| Personas | http://localhost:8770 | AI persona management |
| VoiceAccess | http://localhost:8875 | Voice command config |

---

## HEALTH ENDPOINTS

Quick health check script:
```powershell
$services = @{
    "Relay" = "http://localhost:8600/api/health"
    "Oracle" = "http://localhost:3002/api/health"
    "Orchestrator" = "http://localhost:8500/api/health"
    "Dashboard" = "http://localhost:8899/api/health"
    "KittBox" = "http://localhost:8585/api/health"
    "SimWidget" = "http://localhost:8080/api/status"
    "Hive-Mind" = "http://localhost:8701/api/health"
    "Terminal Hub" = "http://localhost:8771/api/health"
    "MCP-Bridge" = "http://localhost:8860/api/health"
    "Ollama" = "http://localhost:11434/api/tags"
}

foreach ($svc in $services.GetEnumerator()) {
    try {
        $r = Invoke-WebRequest -Uri $svc.Value -TimeoutSec 2 -ErrorAction Stop
        Write-Host "[OK] $($svc.Key)" -ForegroundColor Green
    } catch {
        Write-Host "[!!] $($svc.Key)" -ForegroundColor Red
    }
}
```

Or use: `curl http://localhost:8500/api/status` for all at once

---

## BATCH FILES

### Primary Startup
| File | Purpose |
|------|---------|
| `start-hive.bat` | **Main startup** - starts Ollama, Relay, Oracle, Orchestrator |
| `stop-hive.bat` | Stop all services |
| `hive-status.bat` | Check all service status |
| `setup.bat` | Install npm dependencies for all services |

### Service-Specific
| File | Purpose |
|------|---------|
| `Admin\relay\start.bat` | Start Relay only |
| `Admin\agent\start-agent.bat` | Start KittBox only |
| `Admin\hive-mind\start-hive-mind.bat` | Start Hive-Mind only |
| `Admin\remote-support\start.bat` | Start Remote Support |
| `Admin\terminal-hub\launch-bridge.bat` | Launch Terminal Hub bridge |

### Utility
| File | Purpose |
|------|---------|
| `start-kitt-live.bat` | Launch Kitt Live Electron app |
| `start-kitt-web.bat` | Open KittBox in browser |
| `claude-here.bat` | Open Claude Code in current directory |
| `Admin\tools\start-all-projects.bat` | Start all projects |

---

## EXTERNAL SERVICES (Not Orchestrator-Managed)

| Service | Port | Startup Method |
|---------|------|----------------|
| Ollama | 11434 | Auto-start or `ollama serve` |
| LM Studio | 1234 | Manual launch |
| Iris (ai-pc) | 1234 | Runs on 192.168.1.162 |
| HiveImmortal | N/A | NSSM Windows Service |
| Caddy | 443 | NSSM Windows Service |

---

## TROUBLESHOOTING

### Service won't start
1. Check orchestrator: `curl http://localhost:8500/api/status`
2. Check logs: `C:\LLM-DevOSWE\Admin\orchestrator\logs\orchestrator.log`
3. Manual start: `cd [service-dir] && node [entry-file].js`

### Dashboard blank/slow
1. Verify Orchestrator: `curl http://localhost:8500/api/health`
2. Verify Oracle: `curl http://localhost:3002/api/health`
3. Check browser console for errors

### Restart a specific service
```bash
curl -X POST http://localhost:8500/api/services/[service-id]/restart
```
Service IDs: oracle, simwidget, agent, relay, remote, bridge, hivemind, terminalhub, hivebrain, hiveoracle, hivebraindiscovery, mastermind, hivemesh, personas, mcpbridge, dashboard, voiceaccess

### Start all services
```bash
curl -X POST http://localhost:8500/api/start-all
```

---

## SUMMARY

**Total Services:** 18 orchestrator-managed + 3-5 external
**Total Web UIs:** 11 accessible interfaces
**Startup:** Use `start-hive.bat` (starts 4 core, orchestrator starts rest)
**Control:** http://localhost:8500 (Orchestrator) or Dashboard :8899
