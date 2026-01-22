# Reset Stuck Services

Reset stuck services or state.

1. **Single NSSM service**:
   ```bash
   nssm restart ServiceName
   ```

2. **All NSSM services**:
   ```bash
   nssm restart HiveRelay
   nssm restart HiveKittBox
   nssm restart HiveOracle
   nssm restart HiveMind
   ```

3. **HiveImmortal (DevClaude services)**:
   ```bash
   rm C:\DevClaude\Hivemind\bootstrap\immortal-state.json
   nssm restart HiveImmortal
   ```

4. **Full hive restart**:
   ```bash
   C:\LLM-DevOSWE\stop-hive.bat
   C:\LLM-DevOSWE\start-hive.bat
   ```

Ask user what specifically needs resetting.
