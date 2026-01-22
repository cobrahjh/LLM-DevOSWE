# Hive Protocols

Standard protocols all AI agents must implement when joining the Hive.

---

## Protocol 1: File State Tracking

**Purpose:** Track all file operations across all AI for session awareness and recovery.

### Requirements

Every Hive AI must:
1. Report file reads to Relay
2. Report file writes/edits to Relay
3. Report file creates to Relay
4. Use consistent session IDs

### Implementation

#### Option A: Use FileTracker Library (Node.js)

```javascript
const FileTracker = require('C:/LLM-DevOSWE/Admin/relay/lib/file-tracker.js');

// Initialize on startup
const tracker = new FileTracker('my-ai-session-001', {
    source: 'my-ai-name'  // e.g., 'oracle', 'kitt', 'iris'
});

// Create named session (optional but recommended)
await tracker.createSession('My AI Work Session', 'Description of what I'm doing');

// Report file operations
tracker.read('/path/to/file.js');
tracker.edit('/path/to/file.js', { lines_changed: 10 });
tracker.create('/path/to/new-file.js');
tracker.write('/path/to/file.js', { file_size: 1024 });
tracker.delete('/path/to/old-file.js');

// End session when done
await tracker.endSession();
```

#### Option B: Direct API Calls

```bash
# Create session
curl -X POST http://localhost:8600/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"id":"my-session","name":"My Work","tags":["ai-name"]}'

# Report file operation
curl -X POST http://localhost:8600/api/session/files \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session",
    "file_path": "/path/to/file.js",
    "operation": "read"
  }'

# End session
curl -X POST http://localhost:8600/api/sessions/my-session/end
```

### API Reference

**Relay Base URL:** `http://localhost:8600`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions` | POST | Create session |
| `/api/sessions` | GET | List sessions |
| `/api/sessions/:id` | GET | Get session details |
| `/api/sessions/:id` | PATCH | Update session |
| `/api/sessions/:id/end` | POST | End session |
| `/api/session/files` | POST | Record file operation |
| `/api/session/files/:session_id` | GET | Get session files |
| `/api/session/files/:session_id/summary` | GET | Get session summary |

### Operations

| Operation | When to Use |
|-----------|-------------|
| `read` | Reading file contents |
| `edit` | Modifying existing file |
| `create` | Creating new file |
| `write` | Overwriting file |
| `delete` | Removing file |

### Session Naming Convention

```
{ai-name}-{task-type}-{timestamp}
```

Examples:
- `oracle-intel-gather-1705936800000`
- `kitt-user-chat-1705936800000`
- `claude-feature-impl-1705936800000`

---

## Protocol 2: Health Reporting

**Purpose:** All AI report health status to enable monitoring.

### Requirements

Every Hive AI must expose:
- `GET /api/health` - Return health status

### Response Format

```json
{
  "status": "ok",
  "service": "service-name",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

## Protocol 3: Graceful Shutdown

**Purpose:** Clean shutdown without data loss.

### Requirements

Every Hive AI must:
1. Handle SIGTERM/SIGINT signals
2. Complete in-progress operations
3. End any active sessions
4. Flush logs/state to disk

### Implementation

```javascript
process.on('SIGTERM', async () => {
    console.log('[Service] Shutting down...');
    await tracker.endSession();
    // ... cleanup
    process.exit(0);
});
```

---

## Checklist for New AI

When creating a new Hive AI, ensure:

- [ ] FileTracker integrated for file operations
- [ ] Health endpoint exposed
- [ ] Graceful shutdown handler
- [ ] Session created on startup
- [ ] Session ended on shutdown
- [ ] Source identifier set (e.g., 'oracle', 'kitt')

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Initial protocols (file tracking, health, shutdown) |
