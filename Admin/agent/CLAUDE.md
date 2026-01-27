# Agent / KittBox

**Entry:** `agent-server.js` | **Port:** 8585 (HTTP), 8586 (HTTPS)

## What This Is
Command Center web UI — chat interface for Claude API, task execution, hot reload, and service management.

## Key Rules
- NEVER change port 8585
- This IS "KittBox" in the dashboard — same service, different name
- Supports both HTTP and HTTPS (self-signed certs)
- Hot reload engine watches for file changes

## Architecture
- Express.js + WebSocket
- Claude API integration for chat
- Service manager for controlling other Hive services
- Hot reload engine for live development

## Key Endpoints
```
GET  /api/health    - Health check
POST /api/chat      - Send chat message
GET  /api/tasks     - Task list
POST /api/execute   - Execute command
```

## Testing
```bash
curl http://localhost:8585/api/health
# Open in browser: http://localhost:8585
```
