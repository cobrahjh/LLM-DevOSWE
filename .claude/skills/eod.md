# End of Day Session Wrap

End-of-day wrap up routine:

1. **Review session work** - What was accomplished today?
2. **Extract learnings** - Any new patterns or lessons learned?
3. **Update STANDARDS.md** - Add any new patterns discovered
4. **Sync memory** - Backup CLAUDE.md and STANDARDS.md to database
5. **WIP commit** - Commit any work-in-progress with "[WIP]" prefix
6. **List pending** - Show any unfinished tasks for tomorrow

```bash
# Check what changed today
git diff --stat
git log --oneline --since="8 hours ago"

# Sync memory
curl -X POST http://localhost:8600/api/knowledge/backup -H "Content-Type: application/json" -d '{"type":"claude_md"}'
```
