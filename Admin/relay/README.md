# SimWidget Relay Service v1.0.0
**Last Updated:** 2026-01-10

Message bridge between Agent Kitt (phone) and Claude Desktop - eliminates API costs!

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Agent Kitt  │────▶│  Relay Service  │◀────│ Claude App   │
│   (Phone)   │◀────│    (8600)       │────▶│ (Desktop)    │
└─────────────┘     └─────────────────┘     └──────────────┘
        │                   │                      │
        │    POST /queue    │   GET /pending       │
        │    GET  /queue/id │   POST /respond      │
```

## Quick Start

```bash
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\relay
npm install
node relay-service.js
```

**UI:** http://192.168.1.42:8600

## Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/queue | Agent sends message |
| GET | /api/queue/pending | Claude checks for messages |
| POST | /api/queue/respond | Claude sends response |
| GET | /api/queue/:id | Agent polls for response |
| GET | /api/queue | List all messages |
| DELETE | /api/queue/:id | Delete message |
| DELETE | /api/queue | Clear completed |
| GET | /api/health | Health check |

## Enable Relay Mode in Agent

**Option 1: Environment Variable**
```bash
set RELAY_MODE=true
node agent-server.js
```

**Option 2: API Call**
```bash
curl -X POST http://192.168.1.42:8585/api/relay -H "Content-Type: application/json" -d "{\"enabled\": true}"
```

**Option 3: .env file**
```
RELAY_MODE=true
RELAY_URL=http://localhost:8600
```

## Claude Desktop Processing

When relay mode is enabled, tell Claude Desktop:

> "Check the kitt queue and process any pending messages"

Claude will:
1. Call GET /api/queue/pending
2. Process the message using Desktop Commander tools
3. Call POST /api/queue/respond with the result

## Cost Savings

| Mode | Cost | Model |
|------|------|-------|
| Direct API | $3+/day | Sonnet 4 |
| Relay | $0 (Pro subscription) | Opus 4.5 |

## Files

- `relay-service.js` - Main service
- `queue.json` - Persisted message queue
- `relay.log` - Service logs
