# /hive-status - Full Hive Health Check

Check the health status of all Hive services and report any issues.

## Instructions

1. Check health of all core services by calling their `/api/health` endpoints:
   - Relay (8600)
   - Oracle (3002)
   - MCP Bridge (8860)
   - Master O (8500)
   - KittBox (8585)
   - Hive-Mind (8701)
   - Hive Brain (8800)
   - Hive Oracle (8850)
   - Hive Dashboard (8899)

2. Check MCP Bridge status for active servers at `http://localhost:8860/api/status`

3. Check for pending Relay messages at `http://localhost:8600/api/messages/pending`

4. Check Ollama status at `http://localhost:11434/api/tags`

5. Check LM Studio status at `http://localhost:1234/v1/models`

6. Present a formatted summary table showing:
   - Service name
   - Port
   - Status (OK/OFFLINE/ERROR)
   - Any additional info (uptime, error messages)

7. If any services are offline, suggest restart commands.

## Output Format

```
=== HIVE STATUS REPORT ===

Core Services:
  [OK] Relay        :8600  (uptime: 2h 15m)
  [OK] Oracle       :3002  (uptime: 2h 15m)
  [!!] KittBox      :8585  OFFLINE
  ...

MCP Bridge:
  Status: 3/10 servers online
  Active: filesystem, memory, time

Pending Messages: 2 awaiting response

LLM Backends:
  [OK] Ollama       :11434  (3 models loaded)
  [--] LM Studio    :1234   not running
```
