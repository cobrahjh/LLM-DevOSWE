# /sync-memory - Backup Memory to Database

Backup CLAUDE.md and STANDARDS.md to the Relay knowledge database.

## Instructions

1. Read current CLAUDE.md from `C:/LLM-DevOSWE/CLAUDE.md`
2. Read current STANDARDS.md from `C:/LLM-DevOSWE/STANDARDS.md`

3. Calculate SHA256 hash of each file

4. Send backup to Relay:
   ```
   POST http://localhost:8600/api/knowledge/backup
   {
     "type": "claude_md" or "standards_md",
     "content": "<file contents>",
     "hash": "<sha256 hash>",
     "timestamp": "<ISO timestamp>",
     "source": "manual-sync"
   }
   ```

5. Report success/failure for each file

6. Show hash comparison if previous backup exists

## Output Format

```
=== MEMORY SYNC ===

CLAUDE.md:
  Size: 45,230 bytes
  Hash: abc123...
  Status: Backed up successfully

STANDARDS.md:
  Size: 12,450 bytes
  Hash: def456...
  Status: Backed up successfully

Both files synced to Relay database.
```
