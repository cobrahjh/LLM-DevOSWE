# Add to STANDARDS.md

Add a pattern, convention, or lesson learned to STANDARDS.md.

1. Read current STANDARDS.md to find the appropriate section
2. Add the new pattern/convention in the correct location
3. Include context about when/why to use this pattern
4. Keep formatting consistent
5. Backup to database for persistence:
   ```bash
   curl -X POST http://localhost:8600/api/knowledge/backup \
     -H "Content-Type: application/json" \
     -d '{"type":"standards_md","path":"C:/LLM-DevOSWE/STANDARDS.md"}'
   ```
6. Confirm what was added and that DB backup succeeded

Location: C:\LLM-DevOSWE\STANDARDS.md
