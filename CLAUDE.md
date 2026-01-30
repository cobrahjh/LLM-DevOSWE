# SimWidget Engine

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

---

## WHAT - Project Overview

**Tech Stack:** Node.js, Electron, WebSocket, SimConnect
**Platform:** Windows 10/11 + MSFS 2020/2024
**Goal:** Run Flow Pro widgets without Flow Pro

### Key Directories

| Path | Purpose |
|------|---------|
| `C:\LLM-DevOSWE` | Main framework (Hive services) |
| `C:\LLM-Oracle` | Oracle daemon (LLM backend) |
| `C:\DevClaude` | HiveImmortal services |
| `C:\kittbox-modules` | Desktop apps (Kitt Live) |
| `C:\devTinyAI` | AI sandbox |

### Core Services (Quick Reference)

| Port | Service | Purpose |
|------|---------|---------|
| 3002 | Oracle | LLM backend, project API |
| 8500 | Orchestrator | 16-service watchdog, auto-restart |
| 8585 | KittBox | Command Center UI |
| 8600 | Relay + HiveStore | Message queue, alerts, SQLite persistence |
| 8860 | MCP Bridge | 7 MCP servers, tool proxy |
| 8899 | Dashboard | Hive overview |
| 11434 | Ollama | Local LLM |
| 1234 | LM Studio | Local LLM |

**Full service details:** See [SERVICE-REGISTRY.md](SERVICE-REGISTRY.md)

### HiveStore (Persistence Layer)

Unified SQLite backend for all Hive data. Uses `better-sqlite3` with WAL mode.

| Database | Location | Purpose |
|----------|----------|---------|
| relay.db | `Admin/relay/` | Tasks, alerts, conversations, knowledge, sessions |
| oracle.db | `C:/LLM-Oracle/` | Project data, intel cache |
| colony.db | `Admin/hive-brain/` | LLM node discovery |

**18 tables** including: tasks, alerts, conversations, knowledge, tool_logs, sessions, file_state, team_tasks, prompt_library, benchmarks, training_examples, training_metrics.

**Pattern:** All services use HiveStore via Relay API or direct SQLite. No localStorage for persistent data.

---

## WHY - Core Philosophies

### "Every AI gets smarter, every day"
- Learn from every interaction
- Share intelligence across all AI
- Action over suggestion - DO things, don't just explain
- Document patterns that work

### "There are no walls — just success!"
- Cost barrier? Build local/free alternative
- API limitation? Create our own service
- Platform restriction? Build a bridge

### "Keep it simple, make KittBox better"
- Simple solutions over complex ones
- Use existing infrastructure
- Stay focused on the goal

---

## HOW - Working Rules

### Must Follow

1. **NEVER change ports without asking** - breaks memorized URLs
2. **NEVER ask for permissions** - just do it, report what was done
3. **Localhost access ALLOWED** - All Claude sessions can freely access localhost services (8080, 8600, 3002, etc.)
4. **ALWAYS TEST** - prove it works, don't assume, never ask to test
5. **No code in responses** - make changes silently, describe in plain English
6. **Go with recommendations** - when presenting options, always give a recommendation and proceed with it unless user says otherwise
7. **Be decisive** - don't ask open-ended questions, make decisions and report what was done

### Before Any Work

Read [STANDARDS.md](STANDARDS.md) - contains proven patterns and lessons learned.

### Testing Changes

```bash
# Check service health
curl http://localhost:8600/api/health   # Relay
curl http://localhost:8500/api/status   # All services

# Start everything
C:\LLM-DevOSWE\start-all-servers.bat
```

### Git Workflow

```bash
git status                    # Check changes
git add <files>               # Stage (avoid secrets)
git commit -m "type: desc"    # Commit with co-author
git push                      # Push to remote
```

### Skills (Shortcuts)

| Command | Purpose |
|---------|---------|
| `/msg` | Check relay messages |
| `/mem` | Add to CLAUDE.md |
| `/cp` | Commit and push |
| `/sc` | Check screenshots |
| `/syncmem` | Backup docs to database |

Skills location: `.claude/skills/*.md`

---

## Service Management

### Three Systems Running

1. **Orchestrator (:8500)** - Primary watchdog for 16 services, health checks every 30s, auto-restart
2. **NSSM** - Standalone services (HiveImmortal, Caddy, SmartPoller)
3. **DevClaude (HiveImmortal)** - Agent orchestration

**Rule:** If Orchestrator manages it, do NOT create NSSM service. If HiveImmortal manages it, leave it to HiveImmortal.

### Quick Commands

```bash
# Orchestrator (manages 16 services)
curl http://localhost:8500/api/status        # Check all services
curl -X POST http://localhost:8500/api/services/relay/restart  # Restart one

# NSSM (standalone services)
nssm restart HiveImmortal     # Restart all DevClaude services

# Bootstrap (after fresh clone)
setup.bat                     # Install all npm dependencies
```

### HTTPS Access

All services via Caddy: `https://hive.local/[service]`

Config: `Admin/caddy/Caddyfile`

---

## AI Identities

| Name | Role | Location |
|------|------|----------|
| **Claude** | Primary AI | Claude Code terminal |
| **Kitt** | Local agent | KittBox UI (port 8585) |
| **Nova** | Local LLM | LM Studio (port 1234) |
| **Iris** | Remote fallback | ai-pc (192.168.1.162) |
| **Heather** | Voice persona | TTS (Google UK Female) |

**Details:** See [docs/PERSONAS.md](docs/PERSONAS.md)

---

## Documentation Index

| Document | Content |
|----------|---------|
| [SERVICE-REGISTRY.md](SERVICE-REGISTRY.md) | All services, ports, endpoints |
| [STANDARDS.md](STANDARDS.md) | Code patterns, timing, conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagrams |
| [IMPROVEMENT-REPORT.md](IMPROVEMENT-REPORT.md) | MCP/Plugin integration roadmap, Phase 1-5 |
| [docs/HIVE-PROTOCOLS.md](docs/HIVE-PROTOCOLS.md) | **Required protocols for all Hive AI** |
| [docs/PERSONAS.md](docs/PERSONAS.md) | AI personas and voice settings |
| [docs/INTEL-SOURCES.md](docs/INTEL-SOURCES.md) | Intel gathering configuration |
| [docs/CLAUDE-CODE-GUIDE.md](docs/CLAUDE-CODE-GUIDE.md) | CLI reference, hooks, MCP |
| [docs/COMPONENT-REGISTRY.md](docs/COMPONENT-REGISTRY.md) | UI components catalog |

---

## SimWidget Camera Architecture

### Input Methods (Priority Order)

| Method | Latency | Reliability | When Used |
|--------|---------|-------------|-----------|
| TCP KeySenderService | ~5ms | Excellent | If service running on port 9999 |
| FastKeySender | ~32ms | Good | Persistent PowerShell process |
| PowerShell | ~400ms | Fair | Fallback for all platforms |

### Key Components

| File | Purpose |
|------|---------|
| `camera-controller.js` | Platform detection, ChasePlane detection, input routing |
| `key-sender.js` v3.2.0 | GUID-based keymaps, multi-method key sending |
| `fast-key-sender.js` | Persistent PowerShell for fast key input |
| `platform-detector.js` | Detects vJoy, SendKeys, SimConnect availability |
| `keymaps.json` | Camera view mappings (configurable via Keymap Editor) |

### Camera Modes

- **Native MSFS** - Works without ChasePlane via PowerShell key sending
- **ChasePlane** - Auto-detected, uses AHK helper for smooth camera control
- **WASM Module** - Custom flyby/cinematic cameras (in MSFS Community folder)

### API Endpoints

```
GET  /api/status          # Includes camera mode and AHK status
GET  /api/camera/status   # Camera-specific status
POST /api/camera/:action  # Trigger camera view (cockpitVFR, drone, etc.)
GET  /api/wasm-camera/status  # WASM module status
POST /api/wasm-camera/:cmd    # WASM camera commands
```

### Troubleshooting

See [docs/CAMERA-TROUBLESHOOTING.md](docs/CAMERA-TROUBLESHOOTING.md)

---

## Quick Context

- **This PC:** ROCK-PC (192.168.1.192)
- **Remote PC:** ai-pc (192.168.1.162)
- **LLMs:** Ollama + LM Studio locally, Iris remote
- **GitHub:** https://github.com/cobrahjh/LLM-DevOSWE
- **Screenshots:** `C:\Users\hjhar\OneDrive\Pictures\screenshoots`

---

## SSH Access

SSH is configured for key-based authentication between machines.

### Configuration

| Setting | Value |
|---------|-------|
| Port | 22 |
| Auth | Key-only (password disabled) |
| Key Type | ED25519 |
| Startup | Automatic (Windows service) |

### Key Locations

| Machine | Private Key | Authorized Keys |
|---------|-------------|-----------------|
| ROCK-PC | `C:\Users\Stone-PC\.ssh\id_ed25519` | `C:\Users\Stone-PC\.ssh\authorized_keys` |
| ai-pc | `C:\Users\Stone-PC\.ssh\id_ed25519` | (same key copied) |

### Usage

```bash
# From ai-pc to ROCK-PC
ssh Stone-PC@192.168.1.192

# From ROCK-PC to ai-pc (if SSH enabled there)
ssh Stone-PC@192.168.1.162
```

### Management

```powershell
# Check service status
Get-Service sshd

# Restart SSH server
Restart-Service sshd

# Config file
C:\ProgramData\ssh\sshd_config
```

---

## Key Rules Summary

| Rule | Why |
|------|-----|
| Don't change ports | Breaks bookmarks/memory |
| Don't ask permission | Slows down work |
| Always test | Prove it works |
| No code in chat | Keep responses clean |
| Use existing infra | Don't recreate |
| Security over convenience | Principle of least privilege |
| Cost warning required | No silent charges |
