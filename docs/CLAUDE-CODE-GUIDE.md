# Claude Code Guide

Complete reference for Claude Code CLI usage, settings, hooks, and MCP servers.

---

## Starting Claude Code

```bash
claude                             # Start interactive REPL
claude "query"                     # Start with initial prompt
claude -p "query"                  # Query via SDK, then exit
claude -c                          # Continue most recent conversation
claude -r "session-name" "query"   # Resume session by name/ID
claude update                      # Update to latest version
```

---

## Common Flags

| Flag | Description |
|------|-------------|
| `-p, --print` | Print response without interactive mode |
| `-c, --continue` | Load most recent conversation |
| `-r, --resume` | Resume specific session |
| `--model` | Set model (sonnet, opus, haiku) |
| `--permission-mode` | Begin in specified mode (plan, acceptEdits, etc) |
| `--tools` | Restrict available tools |
| `--output-format` | Specify output (text, json, stream-json) |
| `--max-turns` | Limit agentic turns |
| `--max-budget-usd` | Maximum spending limit |
| `--debug` | Enable debug mode |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/compact` | Compact conversation |
| `/config` | Open Settings |
| `/context` | Visualize context usage |
| `/cost` | Show token usage |
| `/doctor` | Check installation health |
| `/export` | Export conversation |
| `/help` | Get usage help |
| `/init` | Initialize CLAUDE.md |
| `/mcp` | Manage MCP servers |
| `/memory` | Edit CLAUDE.md files |
| `/model` | Change AI model |
| `/permissions` | View/update permissions |
| `/plan` | Enter plan mode |
| `/resume` | Resume conversation |
| `/rewind` | Rewind conversation/code |
| `/stats` | Show usage stats |
| `/tasks` | List background tasks |
| `/vim` | Enable vim editing |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current input/generation |
| `Ctrl+D` | Exit session |
| `Ctrl+G` | Open in text editor |
| `Ctrl+L` | Clear terminal |
| `Ctrl+O` | Toggle verbose output |
| `Ctrl+R` | Reverse search history |
| `Ctrl+B` | Background running tasks |
| `Esc+Esc` | Rewind code/conversation |
| `Shift+Tab` | Toggle permission modes |
| `Alt+P` | Switch model |
| `Alt+T` | Toggle extended thinking |
| `!` prefix | Bash mode (run directly) |
| `@` prefix | File path mention |

---

## Settings

### Scopes (highest to lowest precedence)

1. **Managed** - System-level (IT-deployed)
2. **Command line** - Temporary session
3. **Local** - `.claude/settings.local.json` (gitignored)
4. **Project** - `.claude/settings.json` (team-shared)
5. **User** - `~/.claude/settings.json` (personal)

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API key for Claude SDK |
| `ANTHROPIC_MODEL` | Default model |
| `BASH_DEFAULT_TIMEOUT_MS` | Command timeout |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output (default: 32000) |
| `MAX_MCP_OUTPUT_TOKENS` | MCP response limit (default: 25000) |
| `MCP_TIMEOUT` | MCP server startup timeout |
| `HTTP_PROXY` / `HTTPS_PROXY` | Proxy settings |
| `DISABLE_TELEMETRY` | Opt out of telemetry |

---

## Hooks

### Hook Events

| Event | When Fired | Use Case |
|-------|------------|----------|
| `SessionStart` | Session begins | Load context, set env vars |
| `UserPromptSubmit` | User submits | Validate prompts, add context |
| `PreToolUse` | Before tool | Approve/deny/modify calls |
| `PostToolUse` | After tool | Validate outputs |
| `Stop` | Claude finishes | Decide if work continues |
| `SessionEnd` | Session ends | Cleanup, logging |

### Configuration Example

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./scripts/validate-bash.sh",
        "timeout": 60
      }]
    }]
  }
}
```

### Hive Hook Scripts

Located in `Admin/hooks/`:

| Script | Event | Purpose |
|--------|-------|---------|
| `inject-hive-context.py` | SessionStart | Inject Hive status into context |
| `validate-bash.py` | PreToolUse | Security validation (blocks dangerous commands) |
| `log-to-relay.py` | PostToolUse | Log tool calls to Relay |
| `forward-notifications.py` | Notification | Forward to Hive services |
| `session-sync.py` | Stop | Memory backup |

---

## MCP Server Management

### Adding Servers

```bash
# Add HTTP server
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Add stdio server
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgres://..."

# Import from Claude Desktop
claude mcp add-from-claude-desktop
```

### Managing Servers

```bash
claude mcp list              # List all servers
claude mcp get github        # Get server details
claude mcp remove github     # Remove server
```

### Scopes

- `--scope local` (default) - Current project only
- `--scope project` - Team shared
- `--scope user` - All projects

### Active MCP Servers

| Server | Purpose | Status |
|--------|---------|--------|
| github | GitHub integration | ✅ Active |
| slack | Slack integration | ✅ Active |

*Note: Claude Code has native tools for files (Read/Write/Edit/Glob/Grep), web (WebFetch), and git (Bash). Only external service integrations needed as MCP servers.*

---

## Plugins

### Installed Plugins

| Plugin | Source | Purpose |
|--------|--------|---------|
| code-review | official | Code review automation |
| security-guidance | official | Security best practices |
| commit-commands | official | Git commit helpers |
| pr-review-toolkit | official | PR review workflow |
| frontend-design | official | UI/UX design assistance |
| commit | cc-marketplace | Smart commits |
| create-pr | cc-marketplace | PR creation |
| fix-github-issue | cc-marketplace | Issue resolution |
| debugger | cc-marketplace | Debug assistance |
| api-tester | cc-marketplace | API testing |
| test-writer-fixer | cc-marketplace | Test automation |
| backend-architect | cc-marketplace | Architecture design |

### Plugin Commands

```bash
claude plugin list                 # List plugins
claude plugin install <name>       # Install plugin
/code-review                       # Run code review
/commit                            # Smart commit
/create-pr                         # Create PR
```

### Plugin Marketplaces

- `claude-plugins-official` (Anthropic)
- `cc-marketplace` (Community)

---

## Custom Skills

All shortcuts are Claude Code skills in `.claude/skills/*.md`:

| Command | Purpose |
|---------|---------|
| `/msg` | Check relay messages |
| `/mem` | Add to CLAUDE.md |
| `/mst` | Add to STANDARDS.md |
| `/cp` | Commit and push |
| `/ss` | Save session (commit & push) |
| `/sc` | Check screenshots |
| `/syncmem` | Backup docs to database |
| `/hivesanitycheck` | Full hive health check |

---

## Tool Logging API

```bash
GET  /api/logs              # Recent tool logs
GET  /api/logs/stats        # Usage stats by tool
POST /api/logs              # Log tool usage (used by hooks)
DELETE /api/logs?days=7     # Cleanup old logs
```
