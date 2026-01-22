# Sync Memory to Database

Backup CLAUDE.md and STANDARDS.md to the relay SQLite database.

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

Confirm successful backup with hash comparison.
