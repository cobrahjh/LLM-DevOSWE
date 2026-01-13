# SimWidget Master (O)
**Version:** v1.2.0  
**Last Updated:** 2026-01-10

Master service controller that manages all SimWidget services.

## Why Master (O)?

**Problem:** If Agent crashes, you can't use Agent to restart Agent.

**Solution:** Independent supervisor that survives when child services fail.

## Start Priority System

Master (O) uses a priority-based startup system:

| Priority | Method | When Used |
|----------|--------|-----------|
| 1 | **Windows Service** | If `winService` configured and service exists |
| 2 | **Spawn** | Fallback when no Windows Service available |

This allows flexible deployment: dev mode uses spawn, production uses Windows Services.

## Quick Start (Development Mode)

```bash
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\orchestrator
npm install
node orchestrator.js
```

Then open: http://localhost:8500

---

## Windows Service Installation (Recommended)

Running Master (O) as a Windows Service provides:
- ✅ **Auto-restart on crash** - OS restarts it automatically
- ✅ **Auto-start on boot** - Survives reboots
- ✅ **Protected shutdown** - Requires confirmation to stop
- ✅ **Background operation** - No terminal window needed

### Install as Service

**Run as Administrator:**
```bash
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\orchestrator

# Option 1: Use batch file (recommended)
install-service.bat

# Option 2: Direct node command
node service-install.js
```

### Service Commands

```bash
# Start service
net start "SimWidget Master O"

# Stop service
net stop "SimWidget Master O"

# Check status
sc query "SimWidget Master O"

# View in Services app
services.msc
```

### Uninstall Service

**Run as Administrator:**
```bash
uninstall-service.bat
# or
node service-uninstall.js
```

---

## Features

- **Web Dashboard** - Visual service control
- **Health Watchdog** - Auto-restart failed services (30s interval)
- **REST API** - Programmatic control
- **Protected Shutdown** - Requires confirmation code
- **Service Registry** - Centralized config

## Managed Services

| Service | Port | Auto-Restart |
|---------|------|--------------|
| Main Server | 8080 | ✅ |
| Agent (Kitt) | 8585 | ✅ |
| Remote Support | 8590 | ✅ |

## API Examples

```bash
# Start all services
curl -X POST http://localhost:8500/api/start-all

# Stop all services
curl -X POST http://localhost:8500/api/stop-all

# Restart specific service
curl -X POST http://localhost:8500/api/services/agent/restart

# Get status
curl http://localhost:8500/api/status

# Disable watchdog
curl -X POST http://localhost:8500/api/watchdog/disable

# Shutdown Master (PROTECTED - requires confirmation)
curl -X POST http://localhost:8500/api/shutdown \
  -H "Content-Type: application/json" \
  -d '{"confirm": "SHUTDOWN-MASTER"}'
```

## Watchdog

The watchdog checks service health every 30 seconds:
- Calls `/api/health` on each service
- Auto-restarts unhealthy services
- Max 3 restart attempts per service
- 60 second cooldown between restarts

## Files

```
Admin/orchestrator/
├── orchestrator.js       # Main service
├── package.json          # Dependencies
├── README.md             # This file
├── service-install.js    # Windows Service installer
├── service-uninstall.js  # Windows Service remover
├── service-status.js     # Check service status
├── install-service.bat   # Easy install (run as admin)
├── uninstall-service.bat # Easy uninstall (run as admin)
└── logs/
    └── orchestrator.log
```

## Shutdown Protection

Master (O) shutdown requires explicit confirmation:

```javascript
// This will be REJECTED:
fetch('/api/shutdown', { method: 'POST' });

// This will work:
fetch('/api/shutdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'SHUTDOWN-MASTER' })
});
```

This prevents accidental shutdown of the service supervisor.
