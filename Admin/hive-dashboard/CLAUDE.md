# Hive Dashboard

**Entry:** `server.js` | **Port:** 8899 | **UI:** `index.html`

## What This Is
Single-page dashboard showing all Hive services, health trends, intel feed, MCP servers, alerts, and anomalies.

## Key Rules
- NEVER change port 8899
- Auto-refreshes every 30 seconds
- All data fetched client-side from other services (Oracle :3002, Relay :8600, MCP :8860, Orchestrator :8500)
- Native Node.js HTTP server (no Express) — keep it lightweight
- Services list defined in `SERVICES` array in `index.html`

## Architecture
- Static file server (`server.js`) + single-page app (`index.html`)
- Client-side JavaScript fetches from multiple service APIs
- Health trends stored in-memory (1440 samples rolling)
- Collapsible bottom panels: Anomalies, Models, MCP Servers, Alerts

## When Adding Services
Add to the `SERVICES` array in `index.html` with: name, port, endpoint, path, desc, hive (boolean).

## Key API Dependencies
- Oracle (:3002) — briefing, intel feed, models, health trends
- Relay (:8600) — alerts
- MCP Bridge (:8860) — MCP server status
- Orchestrator (:8500) — service restart, diagnostics

## Testing
```bash
curl http://localhost:8899/api/health
# Open in browser: http://localhost:8899
```
