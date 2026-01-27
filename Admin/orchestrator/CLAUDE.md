# Master Orchestrator (Master-O)

**Entry:** `orchestrator.js` | **Port:** 8500

## What This Is
Service watchdog that monitors, auto-restarts, and reports on all Hive services.

## Key Rules
- NEVER change port 8500
- Max 3 restart attempts per service, 60s cooldown between restarts
- Require 3 consecutive healthy checks before resetting restart count (prevents restart loops)
- KeySender has `autoRestart: false` (no start command)
- Sends alerts to Relay (:8600) on service state changes
- UNREACHABLE alerts fire once per failure cycle, not repeatedly

## Architecture
- Express.js REST API
- 30s health check interval via watchdog loop
- Spawns services via `child_process.spawn` with correct `cwd`
- Tracks `previousHealthState` and `consecutiveHealthy` counters

## Service Registry
Services defined in `SERVICES` object with: id, name, port, dir, start command, health endpoint, autoRestart flag.

## Key Endpoints
```
GET  /api/health              - Orchestrator health
GET  /api/status              - All services status
GET  /api/services            - Service registry
POST /api/services/:id/restart - Restart a service
POST /api/start-all           - Start all services
```

## Testing
```bash
curl http://localhost:8500/api/health
curl http://localhost:8500/api/status
```
