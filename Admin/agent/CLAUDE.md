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

---

## Enhanced Dev Tracker

Full file intelligence system with git integration, real-time file watching, metrics tracking, and HiveDrop broadcast.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  DevTrackerEnhanced                      │
│  (Admin/agent/lib/dev-tracker-enhanced.js)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  GitTracker  │  │ FileWatcher  │  │   HiveDrop   │  │
│  │  (git-       │  │ (file-       │  │   UDP 8750   │  │
│  │  tracker.js) │  │ watcher.js)  │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                  │          │
│    Git diff/log     Chokidar watch     Broadcast to    │
│    Commit info      File events        Hive Mesh       │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   dev-tracker.json    │
              │   (logs/dev-tracker)  │
              └───────────────────────┘
```

### Modules

| File | Purpose |
|------|---------|
| `lib/dev-tracker-enhanced.js` | Main orchestrator combining all features |
| `lib/git-tracker.js` | Git operations: diff, log, status, commit tracking |
| `lib/file-watcher.js` | Chokidar-based real-time file monitoring |

### API Endpoints

```
GET  /api/dev-tracker              # All tracker data
GET  /api/dev-tracker/today        # Today's tasks
GET  /api/dev-tracker/metrics      # Aggregate metrics
GET  /api/dev-tracker/commits      # Recent commits (?count=N)
GET  /api/dev-tracker/status       # Tracker status

POST /api/dev-tracker/task         # Add task (legacy)
POST /api/dev-tracker/task/start   # Start tracking a task
POST /api/dev-tracker/task/complete # Complete active task

POST /api/dev-tracker/watch/start  # Start watching a repo
POST /api/dev-tracker/watch/stop   # Stop watching a repo
```

### Task Lifecycle

```bash
# 1. Start a task
curl -X POST http://localhost:8585/api/dev-tracker/task/start \
  -H "Content-Type: application/json" \
  -d '{"title":"Add login feature","category":"feature"}'

# 2. Work on files... (file changes are tracked automatically)

# 3. Complete the task (captures git diff, metrics)
curl -X POST http://localhost:8585/api/dev-tracker/task/complete \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Task Record Structure

```json
{
  "id": "task-1770065658993",
  "title": "Enhanced Dev Tracker Implementation",
  "category": "feature",
  "status": "completed",
  "startedAt": "2026-02-02T20:54:18.993Z",
  "completedAt": "2026-02-02T20:54:30.052Z",
  "duration": 0,
  "files": [
    {
      "path": "C:\\LLM-DevOSWE\\Admin\\agent\\agent-server.js",
      "filename": "agent-server.js",
      "ext": ".js",
      "operation": "modified",
      "linesAdded": 216,
      "linesRemoved": 89,
      "status": "modified"
    }
  ],
  "metrics": {
    "totalLinesAdded": 240,
    "totalLinesRemoved": 2,
    "filesCreated": 0,
    "filesModified": 4,
    "filesDeleted": 0,
    "totalFiles": 9
  },
  "commit": {
    "hash": "abc123",
    "message": "feat: Add feature",
    "author": "cobrahjh",
    "timestamp": "2026-02-02T20:55:00Z"
  }
}
```

### Watch a Repository

```bash
# Start watching (enables file tracking + git integration)
curl -X POST http://localhost:8585/api/dev-tracker/watch/start \
  -H "Content-Type: application/json" \
  -d '{"path":"C:/LLM-DevOSWE"}'

# Check status
curl http://localhost:8585/api/dev-tracker/status
# Returns: { watchedRepos: ["C:\\LLM-DevOSWE"], fileWatcher: { isActive: true }, ... }
```

### HiveDrop Integration

Events broadcast to Hive Mesh (UDP 8750):
- `devtracker.task.started` - Task begins
- `devtracker.task.completed` - Task ends with metrics
- `devtracker.file` - File change detected

### Git Safe Directory

The service runs as SYSTEM. Git requires safe.directory config:
```bash
git config --system --add safe.directory '*'
```

### Dependencies

- `chokidar` - File watching (added to package.json)
