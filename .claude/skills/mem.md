# Add to CLAUDE.md

Add the user's information to CLAUDE.md for future reference.

1. Read current CLAUDE.md to find the appropriate section
2. Add the new information in the correct location
3. Keep formatting consistent with existing content
4. Backup to database for persistence:
   ```bash
   curl -X POST http://localhost:8600/api/knowledge/backup \
     -H "Content-Type: application/json" \
     -d '{"type":"claude_md","path":"C:/LLM-DevOSWE/CLAUDE.md"}'
   ```
5. Confirm what was added and that DB backup succeeded

Location: C:\LLM-DevOSWE\CLAUDE.md
