---
name: hive-aware
description: Hive-aware operations with automatic service discovery, Claude Code integration, and context
version: 2.0.0
---

# Hive-Aware Operations

When working in Harold's Hive environment, follow these patterns.

## Claude Code Integration

### Hooks (Automatic)
- **SessionStart**: Hive status injected automatically
- **PostToolUse**: All tool calls logged to Relay database
- **Stop**: Memory backed up on session end
- **PreToolUse**: Bash commands validated for security

### Plugin Commands
| Command | Description |
|---------|-------------|
| `/hive-status` | Full health check of all services |
| `/relay-check` or `/msg` | Check pending Relay messages |
| `/sync-memory` or `/syncmem` | Backup memory to database |
| `/mcp-tools` | List available MCP tools |

### MCP Servers Available
filesystem, memory, github, puppeteer, fetch, sqlite, git, sequential-thinking

## Service Endpoints

Always use these endpoints for Hive operations:

| Service | Port | Health Check | Purpose |
|---------|------|--------------|---------|
| Relay | 8600 | /api/health | Message queue, tasks |
| Oracle | 3002 | /api/health | LLM backend, intel |
| MCP Bridge | 8860 | /api/health | MCP tool access |
| Master O | 8500 | /api/health | Service watchdog |
| KittBox | 8585 | /api/health | Command Center UI |
| Hive-Mind | 8701 | /api/health | Activity monitor |
| Hive Brain | 8800 | /api/health | Colony management |
| Hive Oracle | 8850 | /api/health | Distributed LLM |
| Dashboard | 8899 | /api/health | Command Center |

## Before Any Operation

1. Check if relevant service is healthy
2. Use MCP Bridge for tool operations when possible
3. Log significant actions to Relay

## File Operations

Prefer MCP Bridge for file operations:
```bash
curl -X POST http://localhost:8860/api/tool/read_file \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/file"}'
```

## Memory Operations

Use MCP memory server for persistent knowledge:
```bash
curl -X POST http://localhost:8860/api/quick/memory-store \
  -H "Content-Type: application/json" \
  -d '{"entities": [{"name": "fact", "type": "knowledge", "observations": ["..."]}]}'
```

## Messaging

Check for pending messages:
```bash
curl http://localhost:8600/api/messages/pending
```

## Standards

Always follow patterns in:
- `C:/LLM-DevOSWE/CLAUDE.md` - Project context
- `C:/LLM-DevOSWE/STANDARDS.md` - Coding conventions
