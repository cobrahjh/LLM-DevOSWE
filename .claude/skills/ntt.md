# Next Todo Task

Get and work on the next pending task from the relay task queue.

```bash
# Get next pending task
curl -s http://localhost:8600/api/tasks/next

# Or list all pending tasks
curl -s "http://localhost:8600/api/tasks?status=pending"
```

1. Fetch the next pending task
2. Display task content and priority
3. Claim the task: `curl -X POST http://localhost:8600/api/tasks/TASK_ID/claim`
4. Work on completing the task
5. Mark complete when done: `curl -X POST http://localhost:8600/api/tasks/TASK_ID/complete -H "Content-Type: application/json" -d '{"response":"What was done"}'`
