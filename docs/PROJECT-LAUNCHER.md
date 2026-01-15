# Project Launcher Guide

Unified launcher for all development projects and services.

## Quick Start

```batch
C:\LLM-DevOSWE\Admin\tools\start-all-projects.bat
```

## Menu Options

| Option | Description |
|--------|-------------|
| 1 | Start LLM-DevOSWE services only |
| 2 | Start Claude sessions only |
| 3 | Start everything (services + Claude) |
| 4 | Status check |

## Projects

| Project | Terminal Color | GUID |
|---------|---------------|------|
| LLM-DevOSWE | 🔵 Blue | `{11111111-1111-1111-1111-111111111111}` |
| kittbox-web | 🔴 Red | `{22222222-2222-2222-2222-222222222222}` |

## Services (LLM-DevOSWE)

| Port | Service | Purpose |
|------|---------|---------|
| 8500 | Master (O) | Service orchestrator, dashboard |
| 8080 | Main Server | SimConnect, WebSocket |
| 8585 | Agent (Kitt) | Claude chat assistant |
| 8590 | Remote Support | Remote command API |
| 8600 | Relay | Message relay service |

## Individual Launchers

### Start Services Only
```batch
C:\LLM-DevOSWE\start-all-servers.bat
```

### Start Claude Sessions
```batch
:: LLM-DevOSWE (Blue)
wt -p "{11111111-1111-1111-1111-111111111111}"

:: kittbox-web (Red)
wt -p "{22222222-2222-2222-2222-222222222222}"

:: Both
wt -p "{11111111-1111-1111-1111-111111111111}" ; new-tab -p "{22222222-2222-2222-2222-222222222222}"
```

### Desktop Shortcuts
- `Claude LLM-DevOSWE.lnk` - Blue terminal
- `Claude kittbox-web.lnk` - Red terminal

## Status Check

### Check Running Services
```powershell
netstat -ano | findstr "8080 8500 8585 8590 8600"
```

### Dashboard
http://localhost:8500

## Typical Workflow

**Morning startup:**
1. Run `start-all-projects.bat`
2. Choose option `3` (everything)
3. Services start + both Claude terminals open

**Quick Claude session:**
1. Double-click desktop shortcut, OR
2. Run launcher → option `2` → choose project

**Check status:**
1. Run launcher → option `4`
2. Or visit http://localhost:8500

## Related Docs

- [CLAUDE-SESSIONS.md](CLAUDE-SESSIONS.md) - Terminal setup details
- [WINDOWS-SERVICES.md](WINDOWS-SERVICES.md) - Service management
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System overview
