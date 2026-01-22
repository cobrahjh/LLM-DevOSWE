# Add to Backlog/Todo

Add a feature request or option to the todo/backlog.

```bash
# Add task to relay
curl -X POST http://localhost:8600/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"content":"TASK_DESCRIPTION","priority":"normal"}'
```

Priority options: `low`, `normal`, `high`, `mustdo`

Or add to TODO.md file if it's a longer-term backlog item.
