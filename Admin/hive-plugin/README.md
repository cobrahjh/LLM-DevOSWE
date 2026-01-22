# Hive Plugin for Claude Code

Official plugin for Harold's Hive integration with Claude Code.

## Installation

```bash
# From the plugin directory
claude plugin install C:/LLM-DevOSWE/Admin/hive-plugin

# Or add to settings.json
{
  "plugins": ["C:/LLM-DevOSWE/Admin/hive-plugin"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/hive-status` | Full health check of all Hive services |
| `/relay-check` | Check and respond to pending Relay messages |
| `/mcp-tools` | List all available MCP tools |
| `/sync-memory` | Backup CLAUDE.md/STANDARDS.md to database |

## Skills

| Skill | Description |
|-------|-------------|
| `hive-aware` | Automatic Hive context and service awareness |

## Usage

### Check Hive Status
```
/hive-status
```

### Check Messages from Phone
```
/relay-check
```

### List MCP Tools
```
/mcp-tools
```

### Backup Memory
```
/sync-memory
```

## Requirements

- Relay service running on port 8600
- MCP Bridge running on port 8860
- Other Hive services as needed

## Configuration

The plugin works with the hook configuration in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{"matcher": "startup", "hooks": [{"type": "command", "command": "python C:/LLM-DevOSWE/Admin/hooks/inject-hive-context.py"}]}],
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "python C:/LLM-DevOSWE/Admin/hooks/log-to-relay.py"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "python C:/LLM-DevOSWE/Admin/hooks/session-sync.py"}]}]
  }
}
```

## Version History

- 1.0.0 - Initial release with core commands and skills
