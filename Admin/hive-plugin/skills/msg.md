---
name: msg
description: Check relay messages and pending tasks
---

# Check Relay Messages

Check for pending messages and tasks in the relay queue.

## Quick Check

```bash
# Pending messages
curl -s http://localhost:8600/api/messages/pending

# Queue status
curl -s http://localhost:8600/api/health
```

## Response

Returns pending messages that need processing:
```json
{
  "messages": [...],
  "count": 2
}
```

Health endpoint shows queue status:
```json
{
  "queue": {
    "pending": 0,
    "processing": 0,
    "completed": 10,
    "failed": 0
  }
}
```
