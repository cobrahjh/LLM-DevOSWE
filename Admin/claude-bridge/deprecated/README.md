# Deprecated Claude Bridge Components

This directory contains abandoned/deprecated code from the Claude Bridge service.

---

## bridge-service.js (Port 8700)

**Deprecated:** 2026-02-09
**Reason:** Abandoned WebSocket prototype, superseded by bridge-server.js (8601)

### Why was it created?
WebSocket-based bridge for direct Claude Code CLI interaction with worker queue management.

### Why was it deprecated?
1. **Never deployed to production** - No evidence of active usage
2. **HTTP polling approach proven better** - bridge-server.js (8601) more reliable
3. **Relay consumer pattern preferred** - Better fits Hive architecture
4. **Zero dependencies** - No other services reference port 8700
5. **Resource waste** - Maintaining unused code

### What replaced it?
**Claude Bridge Active (8601):** `bridge-server.js`
- HTTP/Express architecture
- Relay queue consumer pattern
- Auto-polls every 3 seconds
- Production service (currently running)
- Integrated with entire Hive ecosystem

### Migration Notes
No migration needed - this service was never used in production.

### Technical Details

**Original Architecture:**
```
User/Service → WebSocket (8700) → Worker Queue → Claude CLI → Response
```

**Current Architecture (8601):**
```
Relay Queue → HTTP Polling (3s) → Claude CLI → Response → Relay
```

### Verification
```bash
# Confirm 8700 is not running
curl http://localhost:8700/health
# Connection refused (expected)

# Confirm 8601 is running
curl http://localhost:8601/api/health
# {"status":"ok",...} (expected)
```

### Code Preservation
The code is preserved here for reference in case:
- Future need for WebSocket-based approach
- Architecture insights for other services
- Historical context for decision-making

### Also Deprecated
- `service-install.js` - NSSM installer for bridge-service.js
- `service-uninstall.js` - NSSM uninstaller
- `Admin/agent/agent-ui/modules/claude-bridge.js` - UI module for WebSocket connection

All related code moved to deprecated/ folders.

### Related Documents
- [HIVE-DUPLICATE-AUDIT-2026-02-09.md](../../../docs/reports/HIVE-DUPLICATE-AUDIT-2026-02-09.md)
- [SERVICE-SEPARATION-RATIONALE.md](../../../docs/SERVICE-SEPARATION-RATIONALE.md)
- [SERVICE-REGISTRY.md](../../../SERVICE-REGISTRY.md)

---

**Do not restore this code without consulting the duplicate audit report.**
