# Clear Stuck Items

Clear stuck queues, logs, or cache.

Options:
1. **Clear relay queue**:
   ```bash
   curl -X POST http://localhost:8600/api/tasks/cleanup
   ```

2. **Clear dead letters**:
   ```bash
   curl -X DELETE http://localhost:8600/api/tasks/dead-letters
   ```

3. **Clear logs**:
   ```bash
   curl -X DELETE "http://localhost:8600/api/logs?days=7"
   ```

4. **Reset HiveImmortal state**:
   ```bash
   rm C:\DevClaude\Hivemind\bootstrap\immortal-state.json
   nssm restart HiveImmortal
   ```

Ask user what specifically needs clearing.
