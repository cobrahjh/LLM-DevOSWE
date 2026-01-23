---
name: syncmem
description: Backup CLAUDE.md and STANDARDS.md to the relay SQLite database
---

# Sync Memory to Database

Backup CLAUDE.md and STANDARDS.md to the relay SQLite database.

## Quick Sync (Both Files)

```bash
curl -s -X POST http://localhost:8600/api/knowledge/sync
```

## Individual Backups

```bash
# Check current backup status
curl -s http://localhost:8600/api/knowledge/status

# Backup CLAUDE.md
curl -X POST http://localhost:8600/api/knowledge/backup \
  -H "Content-Type: application/json" \
  -d '{"type":"claude_md","path":"C:/LLM-DevOSWE/CLAUDE.md"}'

# Backup STANDARDS.md
curl -X POST http://localhost:8600/api/knowledge/backup \
  -H "Content-Type: application/json" \
  -d '{"type":"standards_md","path":"C:/LLM-DevOSWE/STANDARDS.md"}'
```

## Response

Success returns:
```json
{
  "success": true,
  "results": [
    {"type": "claude_md", "changed": true, "hash": "abc123..."},
    {"type": "standards_md", "changed": false, "hash": "def456..."}
  ],
  "changed": 1
}
```

Confirm successful backup with hash comparison.
