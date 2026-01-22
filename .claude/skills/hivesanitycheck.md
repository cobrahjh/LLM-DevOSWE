# Hive Sanity Check

Full health check of all Hive services, ports, and status.

## Check all services:

```bash
# Core Hive Services (LLM-DevOSWE / NSSM)
curl -s http://localhost:3002/api/health   # Oracle (LLM)
curl -s http://localhost:8600/api/health   # Relay
curl -s http://localhost:8585/api/health   # KittBox
curl -s http://localhost:8701/api/health   # Hive-Mind
curl -s http://localhost:8500/api/status   # Master-O

# DevClaude Hivemind (HiveImmortal)
curl -s http://localhost:8800/api/health   # Hive-Brain/Oracle
curl -s http://localhost:8750/health       # Mesh
curl -s http://localhost:8700/health       # Hivemind
curl -s http://localhost:8760/health       # Pulse
curl -s http://localhost:8770/health       # Personas

# External
curl -s http://localhost:11434/api/tags    # Ollama
curl -s http://localhost:1234/v1/models    # LM Studio
```

## Report format:
Show each service with status (OK/DOWN), port, and any issues found.
