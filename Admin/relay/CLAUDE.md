# Relay Service + HiveStore

**Entry:** `relay-service.js` | **Port:** 8600 | **DB:** `relay.db` (SQLite/WAL)

## What This Is
Message queue, task persistence, WebSocket event bus, and alert system for the entire Hive. Houses **HiveStore** - the unified SQLite persistence layer (18 tables, better-sqlite3 + WAL mode).

## Key Rules
- NEVER change the port (8600) — everything depends on it
- SQLite database `tasks.db` — never delete, always migrate
- Alert cooldown is 60s per source — don't lower it or alerts spam
- Auto-expire stale alerts after 24h, auto-ack on recovery

## Architecture
- Express.js REST API + WebSocket broadcast
- Consumer polling pattern (services pull messages)
- Task queue with states: pending, processing, completed, failed, needs_review, rejected
- Alert system with severity levels: info, warning, error, critical

## Key Endpoints
```
GET  /api/health          - Health check
GET  /api/messages/pending - Pending messages
POST /api/alerts           - Create alert
GET  /api/alerts           - List alerts (filter: severity, since, unacked)
POST /api/alerts/:id/ack   - Acknowledge alert
GET  /api/alerts/summary   - 24h summary
```

## Testing
```bash
curl http://localhost:8600/api/health
curl http://localhost:8600/api/alerts/summary
```
