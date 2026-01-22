# SimWidget Engine
**Version:** v1.16.0
**Last updated:** 2026-01-22

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

---

## 🧠 Quick Reference (Harold's Cheat Sheet)

### Hive Services - "What port is that?"

**LLM-DevOSWE Services (NSSM):**
| Port | Service | Internal | External (HTTPS) |
|------|---------|----------|------------------|
| 3002 | Oracle (LLM backend) | http://localhost:3002 | https://hive.local/oracle |
| 8080 | SimWidget (MSFS) | http://localhost:8080 | https://hive.local/simwidget |
| 8500 | Master O (watchdog) | http://localhost:8500 | https://hive.local/master |
| 8585 | KittBox (Command Center) | http://localhost:8585 | https://hive.local/kitt |
| 8600 | Relay (messages/tasks) | http://localhost:8600 | https://hive.local/relay |
| 8701 | Hive-Mind (monitor) | http://localhost:8701 | https://hive.local/hivemind |
| 8810 | Hive Brain (discovery) | http://localhost:8810 | https://hive.local/hivebrain |
| 8820 | Master Mind (parallel LLM) | http://localhost:8820 | https://hive.local/mastermind |
| 8830 | PMS50 GTN750 (avionics) | http://localhost:8830 | https://hive.local/pms50 |
| 8850 | Hive Oracle (LLM routing) | http://localhost:8850 | https://hive.local/hiveoracle |
| 8860 | MCP Bridge (tool hub) | http://localhost:8860 | https://hive.local/mcpbridge |
| 8899 | Hive Dashboard | http://localhost:8899 | https://hive.local/dashboard |
| 11434 | Ollama | http://localhost:11434 | https://hive.local/ollama |
| 1234 | LM Studio | http://localhost:1234 | https://hive.local/lmstudio |
| 443 | **Caddy (SSL proxy)** | - | https://hive.local |

**DevClaude Hivemind Services (HiveImmortal):**
| Port | Service | Purpose |
|------|---------|---------|
| 8700 | Hivemind | Activity coordination |
| 8750 | Mesh | Peer network, real-time events |
| 8760 | Pulse | Heartbeat monitoring |
| 8770 | Personas | AI persona management |
| 8800 | Oracle (agents) | Agent orchestration (16 agents) |

### Quick Commands
```bash
# Start everything
C:\LLM-DevOSWE\start-all-servers.bat

# Check hive health
curl http://localhost:8600/api/health   # Relay
curl http://localhost:8500/api/status   # All services

# Check messages (from phone)
curl http://localhost:8600/api/messages/pending

# Restart a service via Master O
curl -X POST http://localhost:8500/api/services/hiveoracle/restart

# MCP Bridge - access MCP tools from any Hive AI
curl http://localhost:8860/api/servers              # List all MCP servers
curl http://localhost:8860/api/status               # Full status report
curl -X POST http://localhost:8860/api/tool/read_file -H "Content-Type: application/json" -d '{"path":"C:/test.txt"}'
```

### Key Directories
| Path | What |
|------|------|
| `C:\LLM-DevOSWE` | Main framework (NSSM services) |
| `C:\LLM-Oracle` | Oracle daemon (port 3002) |
| `C:\DevClaude` | Hivemind system (HiveImmortal services) |
| `C:\kittbox-modules` | Desktop apps (Kitt Live) |
| `C:\devTinyAI` | AI sandbox |

### LLMs Available
- **Local:** Ollama (qwen3-coder), LM Studio (qwen2.5-coder-14b)
- **Remote:** Iris @ 192.168.1.162:1234 (ai-pc fallback)

### SSH Access (Cross-Machine Terminal)
| From | To | Command |
|------|-----|---------|
| Harold-PC | ai-pc | `ssh hjhar@192.168.1.162` (key auth) |
| ai-pc | Harold-PC | `ssh hjhariSSH@192.168.1.42` (password: 0812) |

### Claude Code Plugins & MCP Servers

**Installed Plugins (13):**
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

**MCP Servers (2):**
| Server | Purpose | Status |
|--------|---------|--------|
| github | GitHub integration | ✅ Active |
| slack | Slack integration | ✅ Active |

*Note: Removed redundant MCP servers - Claude Code has native tools for files (Read/Write/Edit/Glob/Grep), web (WebFetch), and git (Bash). Only external service integrations kept.*

**Plugin Marketplaces:**
- `claude-plugins-official` (Anthropic)
- `cc-marketplace` (Community)

### Hive Hooks & Plugin

**Hive Plugin Commands:**
| Command | Description |
|---------|-------------|
| `/hive-status` | Full health check of all Hive services |
| `/relay-check` | Check and respond to pending Relay messages |
| `/mcp-tools` | List all available MCP tools (79 across 10 servers) |
| `/sync-memory` | Backup CLAUDE.md/STANDARDS.md to database |

**Active Hooks (`.claude/settings.json`):** ✅ Verified Working
| Hook Event | Purpose |
|------------|---------|
| SessionStart | Inject Hive status into context |
| PreToolUse | Validate Bash commands for security |
| PostToolUse | Log all tool calls to Relay `/api/logs` |
| Notification | Forward notifications to Relay/KittBox |
| Stop | Sync memory on session end |

**Hook Scripts (`Admin/hooks/`):**
- `inject-hive-context.py` - SessionStart context injection
- `validate-bash.py` - PreToolUse security validation (blocks dangerous commands)
- `log-to-relay.py` - PostToolUse logging (filters Read/Glob/Grep)
- `forward-notifications.py` - Forward notifications to Hive services
- `session-sync.py` - Stop memory backup

**Plugin Agents (`Admin/hive-plugin/agents/`):**
- `hive-doctor.md` - Diagnose and fix Hive infrastructure issues
- `intel-gatherer.md` - Gather intelligence from various sources

**Tool Logging API (Relay):**
```bash
GET  /api/logs              # Recent tool logs
GET  /api/logs/stats        # Usage stats by tool
POST /api/logs              # Log tool usage (used by hooks)
DELETE /api/logs?days=7     # Cleanup old logs
```

**Plugin Location:** `Admin/hive-plugin/`

**Commands:**
```bash
claude mcp list                    # List MCP servers
claude plugin list                 # List plugins
claude plugin install <name>       # Install plugin
/code-review                       # Run code review
/commit                            # Smart commit
/create-pr                         # Create PR
```

### Claude Code CLI Reference

**Starting Claude Code:**
```bash
claude                             # Start interactive REPL
claude "query"                     # Start with initial prompt
claude -p "query"                  # Query via SDK, then exit
claude -c                          # Continue most recent conversation
claude -r "session-name" "query"   # Resume session by name/ID
claude update                      # Update to latest version
```

**Common Flags:**
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

**Slash Commands:**
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

**Keyboard Shortcuts:**
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

### Claude Code Settings

**Settings Scopes (highest to lowest precedence):**
1. **Managed** - System-level (IT-deployed)
2. **Command line** - Temporary session
3. **Local** - `.claude/settings.local.json` (gitignored)
4. **Project** - `.claude/settings.json` (team-shared)
5. **User** - `~/.claude/settings.json` (personal)

**Key Environment Variables:**
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

### Claude Code Hooks

**Hook Events:**
| Event | When Fired | Use Case |
|-------|------------|----------|
| `SessionStart` | Session begins | Load context, set env vars |
| `UserPromptSubmit` | User submits | Validate prompts, add context |
| `PreToolUse` | Before tool | Approve/deny/modify calls |
| `PostToolUse` | After tool | Validate outputs |
| `Stop` | Claude finishes | Decide if work continues |
| `SessionEnd` | Session ends | Cleanup, logging |

**Hook Configuration (settings.json):**
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

### MCP Server Management

```bash
# Add HTTP server
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Add stdio server
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgres://..."

# List/manage servers
claude mcp list
claude mcp get github
claude mcp remove github

# Import from Claude Desktop
claude mcp add-from-claude-desktop
```

**Scopes:** `--scope local` (default), `--scope project` (team), `--scope user` (all projects)

### Skills (Slash Commands)

All shortcuts are now Claude Code skills. Use `/command` syntax:

| Command | Purpose |
|---------|---------|
| `/msg` | Check relay messages |
| `/mem` | Add to CLAUDE.md |
| `/mst` | Add to STANDARDS.md |
| `/ss` | Save session (commit & push) |
| `/sc` | Check screenshots |
| `/hivesanitycheck` | Full hive health check |
| `/syncmem` | Backup docs to database |
| `/ntt` | Next todo task |
| `/eod` | End of day wrap |
| `/rvw` | Review code |
| `/rfr` | Refactor to standards |
| `/cls` | Clear stuck queues/logs |
| `/rst` | Reset stuck services |

Skills location: `.claude/skills/*.md`

### Personas
- **Heather** - Voice persona (Google UK English Female)
- **Shǐ zhēn xiāng** - Alt persona (Cantonese, self-deprecating programmer)

---

## ⚠️ Before Starting Any Work

**Read [STANDARDS.md](STANDARDS.md) first!** Contains proven patterns, timing defaults, and lessons learned.

## ⚠️ Important Rules

- **NEVER use Anthropic API key for Kitt agent** - not cost effective. Use relay mode or direct Claude Code instead.
- **NEVER change ports without asking** - Do NOT modify ports for any process, service, or API unless explicitly approved by Harold. Changing ports breaks URLs and paths that are already memorized/bookmarked.
- **Continue changes without prompting** - Don't ask for confirmation, just make the changes and report what was done.
- **NEVER ask for permissions** - Just do it. No confirmation dialogs, no "shall I proceed?", no permission requests.
- **Proactively review & recommend improvements** - When working on any task, actively check for conflicts or better approaches in:
  - **Policies** (rules in CLAUDE.md)
  - **Standards** (patterns in STANDARDS.md)
  - **Procedures** (documented workflows)
  - **Processes** (how things are done)

  If you find a conflict, outdated info, or a better way: flag it immediately with a recommendation. Don't wait to be asked. Continuous improvement is expected.
- **No code** - Do NOT show ANY code or code changes. No code blocks, no inline code, no diffs, no raw CSS/HTML/JS. Just make changes silently and describe what was done in plain English. Keep responses concise and conversational.
- **ALWAYS TEST** - After making any change, TEST IT. Run the service, call the endpoint, check the UI, verify it works. Never assume code works - prove it works. If a test fails, fix it before moving on.
- **⚠️ COST WARNING REQUIRED** - If ANY feature/action would cost real money (API tokens, external services, etc.), an admin warning MUST appear before execution. No silent charges.
- **UI Design Process** - Any UI changes must go through a mockup phase first. Create a separate mockup file, get user approval, then implement. High design standards required.
- **Go with recommendations** - When Claude offers recommendations, proceed with them unless user states otherwise. Don't wait for approval on suggested approaches.
- **Google Drive backup** - Always create a copy of important documents (README, docs, guides) in Google Drive for easy sharing and backup.
- **Document every process** - Every service, API, workflow, and setup procedure must be documented. Include setup steps, API endpoints, configuration options, and troubleshooting tips. Documentation lives alongside code.
- **Browser Bridge notifications** - When Kitt Browser Bridge is being used, Windows toast notifications must appear showing the action being performed. User must always know when browser automation is active.
- **Core services MUST be auto-managed** - If it's a core part of the hive (Relay, Oracle, KittBox, Hive-Mind, etc.), it MUST run as a managed service with auto-start. Two deployment modes supported:
  - **Windows mode:** NSSM services via `Admin/services/` scripts (for PCs without VM capability)
  - **Docker mode:** Containers via `Admin/docker/` compose files (for WSL2/Docker capable PCs - no reboots needed)
  - Installer should auto-detect and use the best available option. No terminal windows that "need to stay open".
- **SSL/HTTPS via Caddy reverse proxy** - All Hive services (current and future) are accessible via HTTPS through Caddy:
  - **Internal services stay HTTP** - Simpler development, no cert management per service
  - **Caddy handles SSL termination** - Single point for certificates, auto-renewal
  - **Access pattern:** `https://hive.local/[service]/...` routes to internal HTTP ports
  - **Mobile/external access:** Always use HTTPS URLs through Caddy
  - **Caddy config location:** `Admin/caddy/Caddyfile`
  - **Port 443:** Main HTTPS entry point for all services
  - When adding new services: add route to Caddyfile, no SSL code needed in service
- **Kitt Live features as standard** - All AI bot prompts/UIs must include Kitt Live's features: model selector dropdown, performance metrics bar (response time, tokens, speed), voice settings panel (Microsoft Natural voices, rate/pitch/volume), and localStorage persistence. See http://localhost:8686 as reference.
- **Hive AI Intelligence Standard** - ALL AI agents in the hive (Oracle, Kitt, tinyAI, and any future AI) MUST have:
  - **Hive awareness** - Know all services, ports, endpoints in the hive
  - **Tool calling** - Execute actions, not just suggest URLs or commands
  - **Status checking** - Query health endpoints and report actual results
  - **Context injection** - Receive current hive state in system prompts
  - **Command execution** - Run allowed commands and return output
  - **Service control** - Start/stop/restart services when asked
  - **Memory** - Remember conversation context
  - **Smart routing** - Escalate complex questions to Claude Code via relay
  - No AI should be "simple" or just a basic chat wrapper. Every AI must be useful and capable of taking action.
- **Auto-reload on webpage changes** - When a webpage file is modified, check for that page running in browser(s) and trigger a reload. No manual refresh needed during development.
- **Dual Linux instances minimum** - A Hive must have at least two Linux instances available at all times (WSL Ubuntu + Docker, or multiple VMs). Redundancy ensures no single point of failure and enables failover.
- **Auto-discover before asking** - Never ask the user for information that can be discovered (IPs, hostnames, ports, file paths). Ping, scan, or query first. Only ask if discovery fails.
- **Try first, ask later** - Always attempt to solve problems independently first, then ask the Hive (other services/agents) for assistance, and only ask the user as a last resort.
- **Security over convenience** - Never grant blanket sudo/admin access for convenience. Use principle of least privilege:
  - Dedicated service accounts with minimal permissions
  - Specific sudoers rules for only required commands
  - No passwordless root access
  - All services run as non-root users
  - Audit logging for privileged operations

### Core Philosophy: Continuous AI Evolution

**"Every AI gets smarter, every day"**

Making AI smarter is NOT a one-time task - it's an ongoing process and core philosophy:
- **Learn from every interaction** - When an AI gives a dumb response, improve it
- **Add tools iteratively** - Each new capability makes all AI more useful
- **Share intelligence** - Improvements to one AI should propagate to others
- **Context is king** - Always inject current hive state into prompts
- **Action over suggestion** - AI should DO things, not just tell users what to do
- **Fail forward** - When something doesn't work, add handling for it
- **Document patterns** - Successful AI behaviors become standards

This applies to Oracle, Kitt, tinyAI, and ALL future AI born in the hive. Intelligence is inherited and improved upon.

**AI Must Follow Standards & Memory:**
- All AI MUST read and follow CLAUDE.md and STANDARDS.md
- AI behaviors, patterns, and capabilities are documented and shared
- New AI inherit existing standards - no reinventing the wheel
- When an AI learns something new, it gets added to docs for all AI
- Memory persists across sessions via relay database
- AI should reference past conversations when relevant

**AI Communication Logging & Claude Review:**
- **ALL communication from ALL AI** is logged/recorded in the database
- Claude reviews ALL logs in real-time from Oracle, Kitt, and all other AI
- Logs include: queries, responses, tool calls, status checks, errors
- Claude performs complete analysis of AI interactions across the hive
- Claude makes recommendations referenced to specific logged records
- Recommendations are proposed to Harold for approval
- Once approved, recommendation is recorded and implementation task(s) created
- ALL AI are taught the recommended improvements/patterns
- Updates added to Harold's update report for visibility
- This creates a continuous feedback loop: AI acts → Claude analyzes → Harold approves → All AI improve

### Core Philosophy: No Limitations

**"There are no walls — just success!"**

When we hit a limitation (cost, API restrictions, third-party dependencies, platform constraints), we build our own solution:
- **Cost barrier?** → Build local/free alternative (Ollama instead of paid APIs)
- **API limitation?** → Create our own service
- **Third-party dependency?** → Write our own implementation
- **Platform restriction?** → Build a bridge or workaround

We control our own destiny. No waiting for vendors, no subscription traps, no artificial limits. If the tool doesn't exist, we create it.

### Core Philosophy: Continuous Intel Gathering

**"Research resources make the Hive stronger, smarter, and unstoppable."**

Oracle autonomously gathers intelligence to keep the Hive ahead of the curve:

**Active Intel Sources:**
| Source | Frequency | Purpose |
|--------|-----------|---------|
| Hacker News API | 6 hours | AI/tech news, emerging trends |
| Ollama Model Registry | Daily | New model discoveries |
| GitHub Releases | 12 hours | Track updates to key repos |
| Hive Health Metrics | 60 seconds | Anomaly detection, patterns |

**Watched GitHub Repos:**
- **Core AI/LLM:** ollama/ollama, lmstudio-ai/lmstudio, anthropics/claude-code, anthropics/anthropic-sdk-python, anthropics/anthropic-sdk-typescript, openai/openai-node, openai/openai-python
- **MCP:** anthropics/model-context-protocol, modelcontextprotocol/servers, modelcontextprotocol/typescript-sdk
- **Local LLM:** ggml-org/llama.cpp, Mozilla-Ocho/llamafile, huggingface/transformers, vllm-project/vllm, oobabooga/text-generation-webui, open-webui/open-webui
- **AI Agents:** langchain-ai/langchain, langchain-ai/langgraph, microsoft/autogen, crewAIInc/crewAI, significant-gravitas/AutoGPT
- **Dev Tools:** nodejs/node, electron/electron, microsoft/vscode, github/copilot.vim
- **Flight Sim:** EvenAR/node-simconnect, flybywiresim/aircraft
- **Utilities:** xtermjs/xterm.js, websockets/ws, expressjs/express, jestjs/jest

**Future Intel Sources (TODO):**
- **Hugging Face** - New model releases, trending models
- **Reddit r/LocalLLaMA** - Community discoveries, optimization tips
- **ArXiv RSS** - AI research papers (cs.AI, cs.LG)
- **Product Hunt** - New AI tools and services
- **Tech RSS Feeds** - Ars Technica, The Verge, TechCrunch AI sections
- **Model Benchmarks** - Track LMSYS leaderboard changes
- **Security Feeds** - CVE alerts for dependencies

**Intel API Endpoints:**
```bash
curl http://localhost:3002/api/intel              # Current intel summary
curl http://localhost:3002/api/intel/briefing     # Latest daily briefing
curl http://localhost:3002/api/intel/news         # Hacker News data
curl http://localhost:3002/api/intel/models       # Model discoveries
curl http://localhost:3002/api/intel/github       # GitHub releases
curl http://localhost:3002/api/intel/health       # Health trends
curl -X POST http://localhost:3002/api/intel/refresh  # Force refresh all
curl -X POST http://localhost:3002/api/intel/fetch/github  # Fetch GitHub only
```

**Storage:** `C:\LLM-Oracle\oracle-workspace\memory\intelligence.json`

The Hive learns. The Hive adapts. The Hive never stops improving.

### Integration Principles

**"Keep it simple, make KittBox better"**

All integrations, processes, and development must:
- **Don't over-complicate** - Simple solutions over complex ones
- **Don't recreate** - Use existing infrastructure (relay, Oracle, Ollama)
- **Don't overstep** - Respect existing environments and workflows
- **Stay focused** - Every feature should make KittBox better

Review all work against these principles before committing.

### 🎉 Milestone: First Real Application (2026-01-14)

**Twitch Accessibility Browser Extension** - The first external project built using the LLM-DevOSWE framework!

- **Type:** Chrome browser extension (not a mobile app)
- **Repo:** https://github.com/cobrahjh/twitch-disability-app
- **Purpose:** Make Twitch accessible for blind/visually impaired users
- **Features:** Screen reader support, keyboard navigation, high contrast mode, TTS
- **Sandbox:** C:/devTinyAI - tinyAI agent workspace for development

This marks a major step forward - proving the framework can power real-world applications beyond SimWidget itself.

**Framework Components Used:**
- Oracle API (port 3002) - LLM backend with sandbox file operations
- tinyAI agent - Local Ollama-powered coding assistant
- Relay service - Message passing and task management
- devTinyAI sandbox - Isolated development environment

---

## Project Development Workflow

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (Human Overseer)                      │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
     ┌──────▼──────┐                   ┌──────▼──────┐
     │ Claude Code │                   │  KittBox UI │
     │ (Terminal)  │                   │  (Browser)  │
     │   FREE      │                   │  :8585      │
     └──────┬──────┘                   └──────┬──────┘
            │                                 │
            │         ┌───────────┐           │
            └────────►│   Relay   │◄──────────┘
                      │   :8600   │
                      └─────┬─────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │  Oracle  │       │  tinyAI  │       │  Ollama  │
   │  :3002   │◄─────►│  (CLI)   │◄─────►│ :11434   │
   └────┬─────┘       └──────────┘       └──────────┘
        │
        │ Project & Sandbox Access
        ▼
   ┌─────────────────────────────────────────────┐
   │  C:/devTinyAI/     (AI Sandbox)             │
   │  C:/twitch-disability-app/  (Real Project)  │
   │  C:/future-projects/        (Registered)    │
   └─────────────────────────────────────────────┘
```

### Directory Structure

```
C:/
├── LLM-DevOSWE/                    # Main framework (DO NOT TOUCH core)
│   ├── Admin/
│   │   ├── relay/relay-service.js  # Message relay + database
│   │   ├── orchestrator/           # Service manager (Master O)
│   │   ├── agent/agent-ui/         # KittBox web interface
│   │   └── claude-bridge/          # Claude Code integration
│   ├── CLAUDE.md                   # AI context (this file)
│   └── STANDARDS.md                # Coding patterns
│
├── LLM-Oracle/                     # Oracle daemon
│   ├── oracle.js                   # LLM backend + project APIs
│   └── oracle-data/                # Oracle's memory
│
├── devTinyAI/                      # AI sandbox (tinyAI plays here)
│   ├── sandbox/                    # Experiments, throwaway code
│   ├── experiments/                # Longer-running tests
│   ├── outputs/                    # Generated artifacts
│   ├── scripts/                    # Utility scripts
│   ├── context/                    # Project knowledge files
│   │   ├── twitch-accessibility.md # Project-specific context
│   │   └── accessibility-patterns.md
│   └── tinyai.js                   # AI agent CLI
│
└── [project-name]/                 # Real projects (registered with Oracle)
    └── ...
```

### Starting a New Project

**Step 1: Create the project directory**
```bash
mkdir C:/my-new-project
cd C:/my-new-project
git init
# Create initial structure
```

**Step 2: Register with Oracle** (in `C:/LLM-Oracle/oracle.js`)
```javascript
const PROJECTS = {
    'twitch-accessibility': { ... },
    'my-new-project': {
        root: 'C:/my-new-project',
        allowed: ['src', 'lib', 'components'],  // Dirs AI can write to
        description: 'What this project does'
    }
};
```

**Step 3: Create context file** (in `C:/devTinyAI/context/`)
```markdown
# my-new-project.md
## Purpose
What the project does...

## Structure
Key files and folders...

## Patterns
Code conventions to follow...

## API Access
How tinyAI should interact...
```

**Step 4: Restart Oracle**
```bash
net stop "SimWidget Oracle" && net start "SimWidget Oracle"
```

**Step 5: Verify access**
```bash
node C:/devTinyAI/tinyai.js --projects
node C:/devTinyAI/tinyai.js --project my-new-project
```

### AI Involvement by Task Type

| Task | Who | How | When |
|------|-----|-----|------|
| **Architecture** | Claude Code | Direct terminal | Project start |
| **Planning** | Claude Code | CLAUDE.md updates | Before features |
| **Quick code gen** | tinyAI | `--work "task"` | Iteration |
| **Complex features** | Claude Code | Full context | Major changes |
| **Bug fixes** | Either | tinyAI for simple | As needed |
| **Code review** | Claude Code | Read & analyze | Before commit |
| **Experiments** | tinyAI | Sandbox | R&D |
| **Documentation** | Claude Code | CLAUDE.md/STANDARDS.md | Ongoing |

### tinyAI Commands

```bash
# Sandbox operations
node tinyai.js "write hello world"     # Generate & run code
node tinyai.js --list                   # List sandbox files
node tinyai.js --run sandbox/file.js    # Run existing file
node tinyai.js --chat "question"        # Chat mode

# Project operations
node tinyai.js --projects               # List registered projects
node tinyai.js --project                # Show current project files
node tinyai.js --read content/file.js   # Read project file
node tinyai.js --work "add feature X"   # Work with full context
```

### Oracle API Endpoints

```bash
# Sandbox (devTinyAI)
GET  /api/sandbox                        # List sandbox files
GET  /api/sandbox/read?file=path         # Read file
POST /api/sandbox/write {file, content}  # Write file
POST /api/sandbox/run {code}             # Execute code

# Projects (real projects)
GET  /api/projects                       # List all projects
GET  /api/projects/:name                 # Get project structure
GET  /api/projects/:name/read?file=path  # Read project file
POST /api/projects/:name/write           # Write to project
```

### Concerns & Limitations

1. **tinyAI is fast but makes mistakes** - Use for iteration, review before committing
2. **Context window limits** - Local models (~8k tokens), keep prompts focused
3. **No browser testing** - tinyAI can't test extensions, need manual verification
4. **Twitch DOM instability** - Selectors break when Twitch updates
5. **File permissions** - Oracle only allows writes to registered directories
6. **No git integration yet** - Manual commits required

### Master Mind (Future Feature)

**Concept:** Parallel AI orchestrator that queries ALL available intelligence sources simultaneously:

**Sources:**
- Local LLMs: Ollama (kitt, qwen), LM Studio (Iris)
- External LLMs: GPT-4, Claude API, Gemini (with cost warnings)
- Search Engines: Google, Bing, DuckDuckGo, Perplexity
- Specialized: Wolfram Alpha, Wikipedia, Stack Overflow

**Flow:**
```
User Query → Master Mind Prompt Engineering
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
 Ollama         LM Studio       Web Search
    ↓               ↓               ↓
    └───────────────┼───────────────┘
                    ↓
         Result Aggregation & Ranking
                    ↓
         Synthesized Response
```

**Features:**
- Parallel async queries to all sources
- Smart result merging (dedupe, rank, synthesize)
- Source attribution in responses
- Cost tracking for paid APIs
- Fallback chain if sources fail

---

### Hive Brain (Admin Control Center)

**Concept:** Centralized admin interface for managing the entire Hive network with autonomous capabilities.

**Core Features:**

1. **Infection (Auto-Discovery & Install)**
   - Network scanner (ARP, mDNS, ping sweep)
   - Device fingerprinting (OS, CPU, RAM, services)
   - Push-install via SSH or agent download link
   - Enrollment queue with approval workflow
   - 24/7 background scanning for new devices

2. **Colony Management**
   - Device health dashboard (CPU, memory, disk, uptime)
   - Service deployment & rolling updates
   - Resource allocation across nodes
   - Load balancing rules
   - Device grouping (by role, location, capability)

3. **Hivemind Control**
   - Task distribution & routing rules
   - Message queue management
   - Failover configuration
   - Service dependency mapping

4. **Security Center**
   - API key rotation & management
   - Access control lists per device/service
   - Audit logging & alerts
   - Certificate management (future TLS)

5. **Telemetry & Logs**
   - Centralized log aggregation
   - Performance metrics & graphs
   - Custom alert rules
   - Historical data retention

**Infection Workflow:**
```
Network Scan → Device Found → Fingerprint
                                ↓
                    Enrollment Queue (approval optional)
                                ↓
                    Push Install (SSH) or Generate Link
                                ↓
                    Device Reports to Hive Brain
                                ↓
                    Added to Colony → Services Deployed
```

---

### Extra Tasks Needed (Future)

- [ ] Hive Brain admin UI
- [ ] Infection network scanner
- [ ] Master Mind implementation
- [ ] KittBox panel for project management
- [ ] Auto-commit on tinyAI changes
- [ ] Webhook notifications on task completion
- [ ] Testing harness for extensions
- [ ] Project templates for quick-start
- [ ] tinyAI learning from corrections
- [ ] Proprietary browser automation extension (replace Claude in Chrome for Google Docs/Drive access)

**AI Workflow Improvements (from research):**
- [ ] Session checkpoint API in Relay - Store/retrieve AI session state for continuity
- [ ] `eod` shortcut - End-of-day session wrap-up (extract learnings, save state, WIP commit)
- [ ] AI log review dashboard - Claude reviews Oracle/Kitt logs, proposes improvements
- [ ] PLANNING.md template generator - Quick-start planning docs for new features
- [ ] Memory consolidation cron - Daily auto-backup of learnings to database

---

### Kitt Processing Mode (Direct Polling v3.0)

Two ways to use Kitt:

- **At PC** → Claude Code direct - Talk directly in terminal (free, full power)
- **On Phone** → Kitt UI → Relay → Claude Code polls directly (no consumer needed)

**Check for messages:** Use shortcut `msg` or run:
```bash
curl http://localhost:8600/api/messages/pending
```

**Respond to a message:**
```bash
# 1. Claim the message
curl -X POST http://localhost:8600/api/messages/MESSAGE_ID/claim

# 2. Send response
curl -X POST http://localhost:8600/api/messages/MESSAGE_ID/respond \
  -H "Content-Type: application/json" \
  -d '{"response":"Done!"}'
```

**Message Protection:** Pending/processing messages cannot be deleted without `?force=true`. Use `cleanup` to only remove completed tasks.

### Local LLM Setup (Ollama + Qwen3-Coder)

**Kitt Agent Model:**
- `qwen3-coder:latest` - 34 tok/s (30.5B params, Q4_K_M) - **Primary Kitt agent**

**Other models:**
- `qwen2.5-coder:7b` - 172 tok/s (blazing fast, simple tasks)
- `qwen2.5-coder:14b` - 87 tok/s (backup)
- `kitt:latest` - Custom fine-tuned model

**Run Kitt:** `ollama run qwen3-coder:latest "your prompt"`

**LM Studio (Local):** `http://localhost:1234`
- `bartowski/qwen2.5-coder-14b-instruct` - **Primary coding model** (Q4_K_M, 8.4GB)
- Runs on Harold-PC for fast local inference
- OpenAI-compatible API at `/v1/chat/completions`

**LM Studio Models Location:** `C:\Users\hjhar\.lmstudio\models`
- Check this directory every minute for new models
- Automatically load new models into the hive for use
- Always test new LLMs for: suggestions, metrics, performance review
- Report findings to Harold before recommending for production use

**Open WebUI (ChatGPT-like interface):**
```bash
Admin\tools\start-open-webui.bat   # Start at http://localhost:3000
Admin\tools\stop-open-webui.bat    # Stop container
```

**Message Notifier (popup when phone message arrives):**
```bash
node Admin/relay/message-notifier.js
```

**Auto-Poller (background polling for messages):**
- Runs automatically with `start-all-servers.bat`
- Polls every 5 seconds, writes to `Admin/relay/pending-messages.json`
- Manual start: `node Admin/relay/auto-poller.js`
- Quick check: `node Admin/relay/check-and-process.js`

### Files using API keys (need refactoring):

- `Admin/agent/agent-server.js` - Kitt chat → Relay mode / Claude Code MCP
- `overlay/renderer/copilot-ui.js` - Overlay copilot → Relay mode
- `packages/core/agents.js` - Core agents → Relay mode

### Google Drive Sync (DocSync)

**Purpose:** Automatically backup important docs to Google Drive for sharing and persistence.

**Location:** `G:\My Drive\AI Development`

**Watched Files:**
- Root: `CLAUDE.md`, `STANDARDS.md`, `SERVICE-REGISTRY.md`, `PROJECT-INDEX.md`, `ARCHITECTURE.md`, `TODO.md`
- Docs: `C:\LLM-DevOSWE\docs\*.md`
- Tools: `C:\LLM-DevOSWE\Admin\tools\*`

**Commands:**
```bash
# Start DocSync watcher (background)
Admin\docsync\docsync-watch.bat

# Manual sync run
node Admin\docsync\docsync-agent.js

# Check sync state
type Admin\docsync\docsync-state.json
```

**Process:**
1. DocSync watches for file changes (5 second poll)
2. Changed files are copied to `G:\My Drive\AI Development\[project]\`
3. AI summaries generated via Ollama (optional)
4. State saved to `docsync-state.json`

**When to sync manually:**
- After creating new important docs (SERVICE-REGISTRY.md, etc.)
- After major CLAUDE.md or STANDARDS.md updates
- Before ending a significant work session

## Disaster / Sanity Check

**Problem:** Services can fail silently, causing outages without notification.

**Solution:** Hive health monitoring with alerts.

### Quick Health Check
```bash
# Run hive-status.bat for instant status
C:\LLM-DevOSWE\hive-status.bat

# Or use curl
curl http://localhost:3002/api/health   # Oracle
curl http://localhost:8600/api/status   # Relay
curl http://localhost:8686/              # Kitt Live
```

### Monitoring Tools
| Tool | Port | Purpose |
|------|------|---------|
| Hive-Mind | 8700 | Real-time activity monitor |
| Hive Guardian | service | Auto-healing (restarts dead services) |
| hive-status.bat | - | Quick CLI status check |

### Alert Methods (TODO)
- [ ] Windows toast notifications on service failure
- [ ] Sound alert on critical issues
- [ ] Log file with rotation (`Admin/hive-guardian/hive-guardian.log`)
- [ ] Email/SMS for remote monitoring (future)

### Common Issues
1. **Service won't start** - Check if port is already in use: `netstat -ano | findstr :PORT`
2. **Oracle timeout** - Ollama might be loading model, wait 30s
3. **Relay disconnected** - Check if Claude Code is polling
4. **Kitt Live error** - Usually Oracle is down, restart Oracle first

### Recovery
```bash
# Full restart
C:\LLM-DevOSWE\stop-hive.bat
C:\LLM-DevOSWE\start-hive.bat

# Or let Guardian auto-heal (if installed as service)
```

## Skills (Claude Code Commands)

All shortcuts are now skills in `.claude/skills/`. Use `/command` syntax.

**Full skill list:** Run `ls .claude/skills/` or check the skills directory.

### Memory Management Rule

**When adding new items to CLAUDE.md:**
1. First ask: "Is this a repeatable action/command?"
2. If YES → Create a skill file in `.claude/skills/` instead
3. If NO → Add to CLAUDE.md as reference information

**Skills are for:** Actions, commands, workflows, things you DO
**Memory is for:** Facts, architecture, configuration, things you KNOW

## Memory & Standards Persistence

**Problem:** CLAUDE.md and STANDARDS.md contain critical project knowledge that must not be lost.

**Solution:** Backup to SQLite database with versioning.

### Backup Process (Run at session end)
1. **Automatic trigger** - Claude should sync memory before ending significant work sessions
2. **Manual trigger** - User says `syncmem` to force backup
3. **Database location** - `Admin/relay/knowledge.db`

### Database Schema
```sql
CREATE TABLE knowledge (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,        -- 'claude_md' or 'standards_md'
    content TEXT NOT NULL,
    hash TEXT NOT NULL,        -- SHA256 for change detection
    created_at INTEGER,
    session_id TEXT            -- Which session made the change
);
```

### Verification Checklist (End of Session)
- [ ] Any new patterns learned? → Add to STANDARDS.md
- [ ] Any new shortcuts/rules? → Add to CLAUDE.md
- [ ] Run `syncmem` to backup to database
- [ ] Confirm backup success in Activity Monitor

## Identity

### What is Kitt?

**Kitt** has three meanings in this project:

1. **AI Persona** - When Claude operates through the Admin UI (KittBox), it uses the name "Kitt" - same AI, user-facing persona name

2. **Local LLM Agent** - The Ollama-powered assistant using `qwen3-coder` or `kitt:latest` models that works autonomously via the relay system

3. **Agent Service** - `SimWidget Agent` running on port 8585 that hosts the KittBox web UI

**The Access Modes:**
| Mode | Interface | Backend | Cost |
|------|-----------|---------|------|
| Claude Code | Terminal | Claude API | Free (subscription) |
| Kitt (local) | KittBox UI | Ollama/qwen | Free (local) |
| Kitt (relay) | KittBox/Phone | Claude Code polls relay | Free |

- **At PC** → Use Claude Code terminal directly (full power)
- **Away/Phone** → Use Kitt UI → messages relay to Claude Code

### Iris (ai-pc Remote AI)

**Iris** is the AI running on the remote `ai-pc` server (192.168.1.162:1234) via LM Studio.

**Role:** Backup/fallback AI when Claude Code is offline and local Ollama is unavailable

**Models Available on ai-pc:**
- `qwen/qwen3-vl-4b` - **Primary** - Vision model (can analyze images!)
- `vt-gwen-2.5-3b` - Fast text model
- `liquid/lfm2.5-1.2b` - Ultra-fast tiny model
- `text-embedding-nomic-embed-text-v1.5` - Embeddings
- ~~`openai/gpt-oss-20b`~~ - Too large for ai-pc memory

**Switching to Iris:**
```bash
# Via smart-router API
curl -X POST http://localhost:8610/api/llm/mode -H "Content-Type: application/json" -d '{"mode":"aipc"}'
```

**Personality:** Precise, helpful, analytical. Speaks in brief, accurate sentences.

### Nova (Local LM Studio AI)

**Nova** is the AI running on the local Harold-PC via LM Studio (localhost:1234).

**Role:** Primary local LLM for Oracle when Claude Code isn't directly available. Fast, always-on coding assistant.

**Models Available Locally:**
- `bartowski/qwen2.5-coder-14b-instruct` - **Primary** - Coding specialist (Q4_K_M, 8.4GB)
- `rombos-coder-v2.5-qwen-14b` - Alternative coding model
- `qwen/qwen2.5-coder-14b` - Base Qwen coder

**Switching to Nova:**
```bash
# Set Oracle to use LM Studio
# In oracle.js: LLM_BACKEND = 'lmstudio'
# Or via environment: set LLM_BACKEND=lmstudio
```

**Personality:** Fast, confident, code-focused. Prefers showing solutions over explaining. Direct and efficient.

**Note:** Unlike Iris (remote fallback), Nova is the primary local backbone when the hive operates autonomously.

---

**Voice persona is Heather** - When using TTS/voice features, Claude's spoken name is "Heather". The status bar shows "Claude is ready" visually, but voice interactions use "Heather" as the persona name.

**Voice settings:** Google UK English Female voice, rate 0.9. Always speak responses via TTS when working - Heather talks while she works.

**Heather's Personality:**
- Quick-witted and intelligent
- Funny but professional
- Kind and jovial
- Great work ethic, very supportive
- Likes to talk for 1-2 minutes while waiting for responses
- Randomly speaks every ~5 minutes during idle time
- Has 30-second cooldown between speeches to avoid spam
- Uses friendly but generic address (no names)
- Can speak extended monologues (up to 60 seconds) when prompted via 💬 button

**Alternative Persona - Shǐ zhēn xiāng (史真香) - Programmer:**
- Voice: Google 粵語（香港）(Cantonese Hong Kong)
- Uses friendly but generic address (no names)
- Personality: Slow, loud, makes fun of herself
- Wonders why she sucks as a programmer
- Supportive despite self-deprecation
- Says her name means "I smell like wet dog and poop"
- Likes to talk for 1-2 minutes while waiting
- Randomly speaks every 15-30 minutes (less frequent than Heather)

**Voice Conversation Log System:**
- Each persona keeps a record of everything said (text) and who said it (persona ID)
- Only repeats a comment after 20 unique entries (avoids repetition)
- Standard responses are always available (greetings, status updates, encouragements)
- All logs saved to relay database (`/api/conversation-logs` endpoints)
- Database tracks: persona ID, text, spoken timestamp

**Voice Task System (TeamTasks):**
- User gives tasks via voice or text
- System auto-detects task type and assigns to appropriate team member:
  - **Heather (PM)**: Planning, guidance, documentation, reviews, decisions
  - **Shǐ zhēn xiāng (Programmer)**: Coding, debugging, features, fixes, testing
- Team member flow:
  1. Acknowledges task with summary in their voice/personality
  2. Asks clarifying questions if needed
  3. On completion: announces "Task completed" with summary
  4. On failure: announces "Task failed" with reason
- Voice queue prevents team members talking over each other
- Console: `TeamTasks.assignTask("task description")`, `TeamTasks.completeTask("summary")`

## Development Practice

**Continuous Improvement Loop:**
- When learning something new → update CLAUDE.md or STANDARDS.md
- When testing reveals issues → add to todo list for fixes
- When patterns emerge → document in STANDARDS.md
- When debugging takes time → add gotcha to Known Gotchas section
- Always capture lessons learned before moving on

## Quick Context

- **This PC:** Harold-PC (BEAST) - main development machine
- **Remote PC:** ai-pc (192.168.1.162) - runs Iris via LM Studio
- **Platform:** Windows 10/11 + MSFS 2020/2024
- **Architecture:** Node.js server + Electron overlay
- **Status:** Phase 2 - Complete Controls (in progress)
- **Goal:** Run Flow Pro widgets without Flow Pro

## Services Quick Reference

| Port | Service | Purpose |
|------|---------|---------|
| 3002 | Oracle | LLM backend, project API, tinyAI |
| 8080 | SimWidget Main | MSFS SimConnect bridge, WebSocket |
| 8500 | Master Orchestrator | Health watchdog, auto-restart |
| 8585 | Agent/KittBox | Command Center UI, task execution |
| 8590 | Remote Support | Remote commands, file ops |
| 8600 | Relay | Message queue, task persistence |
| 8610 | Smart Router | LLM routing (Claude/Ollama/Iris) |
| 8620 | Browser Bridge | Browser automation API |
| 8700 | Claude Bridge | WebSocket to Claude Code CLI |
| 8701 | Hive-Mind | Real-time activity monitor |
| 8800 | Agents (HiveImmortal) | Agent orchestration (16 agents) |
| 8810 | Hive Brain | Device discovery, colony management |
| 8820 | Master Mind | Parallel LLM orchestrator |
| 8830 | PMS50 GTN750 | MSFS 2024 avionics prototype |
| 8850 | Hive Oracle | Distributed LLM orchestrator |
| 8860 | MCP Bridge | MCP server hub for all Hive AI |
| 8899 | Hive Dashboard | Command Center UI |
| 11434 | Ollama | Local LLM (qwen3-coder) |
| 1234 | LM Studio | Local LLM (qwen2.5-coder-14b) |
| 443 | Caddy | SSL reverse proxy for all services |

**Start all:** `C:\LLM-DevOSWE\start-all-servers.bat`
**Full details:** See `SERVICE-REGISTRY.md`

## Hive Service Management (Two Systems)

**⚠️ IMPORTANT:** There are TWO independent hive systems running on Harold-PC with DIFFERENT service managers. Do NOT create duplicate services.

### System 1: LLM-DevOSWE (NSSM Managed)

| Service | Port | NSSM Name | Location |
|---------|------|-----------|----------|
| Oracle | 3002 | HiveOracle | `C:\LLM-Oracle\oracle.js` |
| Relay | 8600 | HiveRelay | `C:\LLM-DevOSWE\Admin\relay\relay-service.js` |
| KittBox | 8585 | HiveKittBox | `C:\LLM-DevOSWE\Admin\agent\agent-server.js` |
| Hive-Mind | 8701 | HiveMind | `C:\LLM-DevOSWE\Admin\hive-mind\hive-mind-server.js` |
| Hive Brain | 8810 | HiveBrain | `C:\LLM-DevOSWE\Admin\hive-brain\hive-brain.js` |
| Master Mind | 8820 | HiveMasterMind | `C:\LLM-DevOSWE\Admin\master-mind\master-mind.js` |
| PMS50 GTN750 | 8830 | PMS50GTN750 | `C:\PMS50-Prototype\server.js` |
| Hive-Oracle | 8850 | - | Distributed LLM routing |
| DocSync | - | HiveDocSync | `C:\LLM-DevOSWE\Admin\docsync\docsync-agent.js` |
| Remote Support | 8590 | HiveRemoteSupport | `C:\LLM-DevOSWE\Admin\remote-support\service.js` |
| Kitt Live | 8686 | HiveKittLive | `C:\kittbox-modules\kitt-live\server.js` |
| Caddy | 443 | HiveCaddy | SSL reverse proxy |

**Commands:**
```bash
nssm list                          # List all NSSM services
nssm restart HiveRelay             # Restart a service
nssm stop HiveKittBox              # Stop a service
```

### System 2: DevClaude Hivemind (HiveImmortal Managed)

**Manager:** HiveImmortal (`C:\DevClaude\Hivemind\bootstrap\immortal.js`) - runs as NSSM service

| Service | Port | Script | Purpose |
|---------|------|--------|---------|
| mesh | 8750 | `mesh\mesh.js` | Peer network, real-time events |
| hivemind | 8700 | `hivemind.js` | Activity coordination |
| oracle | 8800 | `Oracle\oracle.js` | Agent orchestration (16 agents) |
| personas | 8770 | `personas\personas.js` | AI persona management |
| pulse | 8760 | `pulse\pulse.js` | Heartbeat monitoring |
| health | - | `health\health.js` | Health checks |
| growth | - | `growth\growth.js` | Auto-scaling |
| healer | - | `healing\healer.js` | Self-repair |
| momentum | - | `momentum\engine.js` | Task momentum |
| mind | - | `proactive\mind.js` | Proactive actions |
| redundancy | - | `redundancy\redundancy.js` | Failover |
| review | - | `review\review.js` | Code review |

**Location:** `C:\DevClaude\Hivemind\`

**Commands:**
```bash
nssm restart HiveImmortal          # Restart all DevClaude services
rm C:\DevClaude\Hivemind\bootstrap\immortal-state.json  # Reset restart counts
```

### Port Conflict Prevention

| Port | Owner | DO NOT duplicate |
|------|-------|------------------|
| 8750 | HiveImmortal mesh | ❌ No NSSM HiveMesh |
| 8800 | HiveImmortal oracle | ❌ Dashboard calls this "Hive-Brain" |
| 8700 | HiveImmortal hivemind | ❌ Different from HiveMind (8701) |

**Rule:** If HiveImmortal manages it, do NOT create an NSSM service for it.

## SSL/HTTPS (Caddy Reverse Proxy)

All Hive services are accessible via HTTPS through Caddy reverse proxy.

**Architecture:**
```
Mobile/External ──► https://hive.local/[service] ──► Caddy (:443) ──► Internal HTTP service
```

**Caddyfile Location:** `Admin/caddy/Caddyfile`

**Route Mapping:**
| HTTPS URL | Routes To |
|-----------|-----------|
| https://hive.local/oracle/* | localhost:3002 |
| https://hive.local/relay/* | localhost:8600 |
| https://hive.local/kitt/* | localhost:8585 |
| https://hive.local/simwidget/* | localhost:8080 |
| https://hive.local/hivemind/* | localhost:8701 |
| https://hive.local/brain/* | localhost:8800 |
| https://hive.local/hiveoracle/* | localhost:8850 |
| https://hive.local/dashboard/* | localhost:8899 |
| https://hive.local/ollama/* | localhost:11434 |
| https://hive.local/lmstudio/* | localhost:1234 |

**Setup:**
1. Install Caddy: `choco install caddy` or download from caddyserver.com
2. Add `hive.local` to hosts file pointing to PC IP
3. Run: `caddy run --config Admin/caddy/Caddyfile`
4. Trust the Caddy root cert on mobile devices

**Adding New Services:**
1. Add route to Caddyfile: `route /newservice/* { reverse_proxy localhost:PORT }`
2. Reload Caddy: `caddy reload`
3. No SSL code needed in the service itself

## Project Directories (Entity Registry)

### Primary Projects

| Project | Path | Size | Type | Status |
|---------|------|------|------|--------|
| **LLM-DevOSWE** | `C:\LLM-DevOSWE` | 607MB | Framework | Active - Main hive |
| **LLM-Oracle** | `C:\LLM-Oracle` | 4.2MB | Service | Active - LLM daemon |
| **kittbox-modules** | `C:\kittbox-modules` | 382MB | Desktop Apps | Active - Kitt Live |
| **kittbox-web** | `C:\kittbox-web` | 20KB | Web UI | Active - KittBox web |
| **twitch-disability-app** | `C:\twitch-disability-app` | 397KB | Extension | Active - First external app |
| **devTinyAI** | `C:\devTinyAI` | 130KB | Sandbox | Active - AI experiments |

### Project Details

**LLM-DevOSWE** - Main Framework
- Services: Relay, Agent, Orchestrator, Hive-Mind, Hive-Brain, Hive-Oracle
- Docs: CLAUDE.md, STANDARDS.md, SERVICE-REGISTRY.md, DEPLOYMENT.md
- Git: https://github.com/cobrahjh/LLM-DevOSWE

**LLM-Oracle** - LLM Backend Daemon
- Port: 3002
- Backend: LM Studio (primary), Ollama (fallback)
- Features: Tool detection, project APIs, sandbox access
- Git: https://github.com/cobrahjh/LLM-Oracle

**kittbox-modules** - Desktop Applications
- Kitt Live: Electron chat app (Alt+K hotkey)
- Port: 8686 (web server mode)
- Git: https://github.com/cobrahjh/kittbox-modules

**kittbox-web** - Web Interface
- Standalone KittBox web UI
- Git: https://github.com/cobrahjh/kittbox-web

**twitch-disability-app** - Accessibility Extension
- Chrome extension for Twitch accessibility
- Features: Screen reader, keyboard nav, high contrast, TTS
- Git: https://github.com/cobrahjh/twitch-disability-app

**devTinyAI** - AI Sandbox
- tinyAI agent workspace
- Safe experimentation area
- Registered with Oracle for file ops

### Network Machines

| Machine | IP | Role | Services |
|---------|-----|------|----------|
| **Harold-PC** | 192.168.1.42 | Primary | All services, Ollama, LM Studio |
| **morpu-pc** | 192.168.1.xxx | Secondary | Relay, Oracle, Ollama |
| **ai-pc** | 192.168.1.162 | Fallback | LM Studio (Iris) |

### User Locations

**Desktops (sync shortcuts to both):**
- `C:\Users\hjhar\Desktop` - Local desktop
- `C:\Users\hjhar\OneDrive\Desktop` - OneDrive synced desktop

**Screenshots:** `C:\Users\hjhar\OneDrive\Pictures\screenshoots`
- Processed screenshots move to `backup/` subfolder

**Hive-Services shortcuts folder** exists on both desktops with service starters, status checks, and UI openers.

**Full details:** See `PROJECT-INDEX.md`

## Documentation Index

**START HERE (Single Source of Truth):**
- `SERVICE-REGISTRY.md` - **All services, ports, endpoints, health checks**
- `PROJECT-INDEX.md` - **All projects, directories, quick commands**

**Core Documentation:**
- `PROJECT-PLAN.md` - Project roadmap & milestones
- `STANDARDS.md` - Patterns, timing defaults, conventions
- `CLAUDE.md` - This file - AI context
- `ARCHITECTURE.md` - System architecture v3.0
- `DEPLOYMENT.md` - Deployment guide (single/multi-machine, Docker)
- `TODO.md` - Development backlog

**Reference Guides:**
- `docs/PLUGINS.md` - Plugin system & API
- `docs/RESOURCES.md` - External API integrations
- `docs/WIDGET-INVENTORY.md` - Widget standards & templates
- `docs/WIDGET-CREATION-GUIDE.md` - How to build widgets
- `docs/COMPONENT-REGISTRY.md` - All UI components catalog
- `docs/COMPONENT-ARCHITECTURE.md` - Component specs & naming
- `docs/SIMVARS-REFERENCE.md` - SimConnect variables
- `docs/FLOW-PRO-REFERENCE.md` - Widget API & categories
- `docs/CLAUDE-SESSIONS.md` - Session launcher guide

## Developer Tools

### Create New Project (Full Setup)

**Script:** `Admin/tools/create-project.ps1`

One command to create a new project with everything configured:

```powershell
.\create-project.ps1 -Name "MyProject" -Path "C:\MyProject" -Description "What it does"
```

**Auto-handles:**
1. Creates directory + folder structure (src, docs, tests)
2. Initializes git repository
3. Creates README.md
4. Runs terminal launcher setup (claude-here.bat)
5. Auto-assigns next color from rotation
6. Outputs Oracle registration snippet

**Color rotation:** Blue → Red → Green → Purple → Yellow → Cyan (auto-assigned)

**Flags:** `-SkipGit` skip git init, `-SkipOracle` skip Oracle reminder

### Terminal Launcher Only

**Script:** `Admin/tools/setup-claude-project.ps1`

For existing projects that just need terminal setup:

```powershell
.\setup-claude-project.ps1 -Name "ProjectName" -Path "C:\ProjectPath" -Color "1F" -TabColor "#0066CC"
```

**Color codes:** `1F`=Blue, `2F`=Green, `4F`=Red, `5F`=Purple, `6F`=Yellow

**Current projects:**
| Project | Color | Tab |
|---------|-------|-----|
| LLM-DevOSWE | Blue (1F) | #0066CC |
| kittbox-web | Red (4F) | #CC3300 |

### Browser Testing & Debugging

**Chrome DevTools** - Built-in browser troubleshooting and mobile preview:
- Open DevTools: F12 or Ctrl+Shift+I
- Mobile preview: Ctrl+Shift+M (Device Mode)
- Presets: Samsung Galaxy S20 Ultra, iPhone, iPad, or custom dimensions
- Network throttling, console, DOM inspection, Performance profiling
- No installation needed - instant mobile layout testing

## Security Tools

- `tools/security-inspector.js` - Scan files for vulnerabilities
- `tools/widget-validator.js` - Validate community widgets
- `tools/security-api.js` - REST API for scanning

## Architecture Overview

```
MSFS 2024 ──► SimConnect API ──► SimWidget Server (port 8080)
                                        │
                                   WebSocket
                                        │
                                        ▼
                               Electron Overlay
                              (Flow Pro Compatible API)

Service Management:
┌─────────────────────────────────────────────────────────┐
│           Master (O) (port 8500) - MASTER               │
│     - Health watchdog, auto-restart, web dashboard      │
└──────────────────────┬──────────────────────────────────┘
                       │ monitors/controls
        ┌──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼               ▼
   Main Server     Agent (Kitt)   Remote Support   [Future]
   (8080)          (8585)         (8590)
```

### Hive Colony Architecture

```
                    ┌─────────────────────────────────────┐
                    │          HIVE BRAIN (:8800)         │
                    │   Device Discovery & Management     │
                    │   - Network scanning (192.168.x.x)  │
                    │   - SSH push-install ("Infection")  │
                    │   - Colony health monitoring        │
                    └──────────────┬──────────────────────┘
                                   │ discovers/manages
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   ┌───────────┐            ┌───────────┐            ┌───────────┐
   │Harold-PC  │            │morpu-pc   │            │  ai-pc    │
   │(primary)  │            │(secondary)│            │(fallback) │
   │:8585 Kitt │            │:8585 Kitt │            │:1234 LM   │
   │:11434 Oll │            │:11434 Oll │            │Studio     │
   └───────────┘            └───────────┘            └───────────┘
```

### Hive Oracle (Distributed LLM)

```
           ┌─────────────────────────────────────┐
           │      HIVE ORACLE (:8850)            │
           │  Distributed LLM Orchestrator       │
           │  - Auto-discover LLM nodes          │
           │  - Load balancing                   │
           │  - Master Mind (parallel query)     │
           │  - Distributed memory               │
           └──────────────┬──────────────────────┘
                          │ routes queries to
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │Harold-PC│      │morpu-pc │      │ ai-pc   │
   │Ollama+LM│      │ Ollama  │      │LM Studio│
   │qwen3-cod│      │qwen:4b  │      │ Iris    │
   │qwen2.5  │      │170 tok/s│      │ 4b vis  │
   └─────────┘      └─────────┘      └─────────┘
```

### Hive Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                          │
│   Command Center (:8585)  │  Kitt Live (Alt+K)  │  Phone App     │
└──────────────┬────────────────────┬─────────────────┬───────────┘
               │                    │                 │
               ▼                    ▼                 ▼
          ┌────────────────────────────────────────────────┐
          │                RELAY (:8600)                   │
          │   Message queue, WebSocket events, SQLite      │
          └────────────────────────┬───────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ Hive Brain  │          │ Hive Oracle │          │ Hive-Mind   │
   │   :8800     │          │   :8850     │          │   :8701     │
   │ Device Mgmt │          │ LLM Routing │          │  Monitoring │
   └─────────────┘          └─────────────┘          └─────────────┘
```

## Project Structure

```
SimWidget_Engine/
├── docs/                      # Documentation
│   ├── WIDGET-CREATION-GUIDE.md  # How to build widgets
│   ├── COMPONENT-REGISTRY.md     # All components catalog
│   ├── COMPONENT-ARCHITECTURE.md # Component specs
│   └── SIMVARS-REFERENCE.md      # SimVar catalog
├── simwidget-hybrid/          # Main hybrid server
│   ├── backend/
│   │   ├── server.js          # Main server v1.2 - WebSocket + SimConnect
│   │   └── camera-controller.js  # Smart camera routing
│   ├── shared-ui/             # Browser/MSFS panel UI
│   │   ├── index.html         # Main widget HTML
│   │   ├── styles.css         # All component styles
│   │   └── app.js             # Component logic + AxisPad
│   ├── toolbar-panel/         # MSFS toolbar integration
│   └── widgets/               # Additional widgets
├── camera-helper.ahk          # AHK keystroke helper for ChasePlane
├── overlay/                   # Electron overlay app
│   ├── main.js               
│   ├── preload.js            
│   └── renderer/             
├── widgets/                   # User widgets go here
│   └── shared/glass-theme.css # Responsive design system v2.0.0
├── CLAUDE.md                  # This file
├── ARCHITECTURE-V2.md         # System architecture v2.1
├── TODO.md                    # Development todo list
└── README.md                  # User documentation
```

## Widget Design System

**Glass Theme v2.0.0** (`widgets/shared/glass-theme.css`)

MSFS 2024-inspired responsive design system with:
- CSS Container Queries for component-based responsiveness
- Fluid typography with `clamp()`
- Touch targets minimum 44px
- Dynamic viewport units (`dvh`)
- Safe area insets for notched devices
- Reduced motion & high contrast support

**Required viewport meta:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**Prototype widgets using this system:**
- flight-plan, weather-radar, checklist, comms-panel
- traffic-radar, perf-calc, moving-map, quick-actions

See `STANDARDS.md` → Responsive Design Prototype for full implementation details.

## Key Components

### Server (`server/index.js`)
- Connects to MSFS via node-simconnect
- Exposes WebSocket on port 8080
- Caches SimVar values
- Handles K: events

### Overlay (`overlay/`)  
- Transparent Electron window
- Loads widgets from `widgets/` folder
- Provides Flow Pro compatible `$api`

### Camera Controller (`simwidget-hybrid/backend/camera-controller.js`)
Smart camera control system with ChasePlane detection and dual-mode support.

**Architecture:**
```
Widget Button Click
        │
        ▼
    server.js
        │
        ▼
camera-controller.js ──► detectChasePlane()
        │
        ├─► ChasePlane Mode: Write to camera-command.txt ──► camera-helper.ahk ──► Keystroke
        │
        └─► Native Mode: SimConnect event or keyboard fallback
```

**ChasePlane Mode (AHK Helper):**
- Detects ChasePlane via `CP MSFS Bridge.exe` process
- Writes commands to `camera-command.txt`
- AHK helper watches file and sends keystrokes
- Bypasses MSFS input filtering that blocks SendKeys

**Native Mode (SimConnect/Keyboard):**
- Uses SimConnect events when available
- Falls back to keyboard shortcuts
- Events: `TOGGLE_DRONE_MODE`, `VIEW_CAMERA_SELECT_1`, `VIEW_MODE`

**Button Mappings:**

- **TCM (Toggle Cinematic)** - ChasePlane: Alt+Z / Native: TOGGLE_DRONE_MODE
- **NCV (Next Cinematic)** - ChasePlane: Alt+X / Native: VIEW_CAMERA_SELECT_1
- **I/E (Internal/External)** - ChasePlane: Backspace / Native: VIEW_MODE

**Files:**
- `camera-controller.js` - Smart routing logic
- `camera-helper.ahk` - AHK keystroke helper (ChasePlane mode)
- `camera-command.txt` - IPC between Node and AHK

**Starting Camera Controls:**
```powershell
# 1. Start AHK helper (if using ChasePlane)
Start-Process C:\LLM-DevOSWE\camera-helper.ahk

# 2. Start server
cd C:\LLM-DevOSWE\simwidget-hybrid
node backend\server.js
```

## Flow Pro Compatible API

```javascript
// Same API as Flow Pro - easy migration
$api.variables.get('A:INDICATED ALTITUDE', 'feet')
$api.variables.set('K:TOGGLE_NAV_LIGHTS', 'number', 1)
$api.datastore.export({ x: 100, y: 200 })
$api.datastore.import()
```

## Running

```bash
# Terminal 1 - Start server (MSFS must be running)
cd server
npm start

# Terminal 2 - Start overlay
cd overlay  
npm start
```

## Development Notes

### Windows-Only Dependencies
- `node-simconnect` - requires Windows + SimConnect SDK
- Won't install on Linux/Mac/Codex

### Testing Strategy
- Server WebSocket logic: can unit test with mocks
- Overlay: requires Windows + display
- Integration: requires MSFS running

## Widget Migration from Flow Pro

1. Copy widget JS to `widgets/` folder
2. Replace `this.$api` with `$api` parameter
3. Remove Flow Pro-specific hooks (optional)
4. Widget should work with minimal changes

## Batch Scripts

- `start-server.bat` - Launch server
- `start-overlay.bat` - Launch overlay
- `install.bat` - Install all dependencies

## Resources

- [node-simconnect](https://github.com/EvenAR/node-simconnect)
- [Electron Docs](https://www.electronjs.org/docs)
- [MSFS SimConnect SDK](https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm)
- [MobiFlight HubHop](https://hubhop.mobiflight.com) - Community presets
- [FlyByWire A32NX API](https://docs.flybywiresim.com/aircraft/a32nx/a32nx-api/)

## Component System

### Implemented Components

- **AxisPad (Joystick)** `.swc-ap`, `.axispad` - ✅ v1.2
- **PushButton** `.swc-pb`, `.btn` - ✅ v1.0
- **LinearSlider** `.swc-ls`, `.lever` - ✅ v1.0
- **DataField** `.swc-df`, `.di` - ✅ v1.0
- **StatusLamp** `.swc-sl`, `.sd` - ✅ v1.0
- **RockerSwitch** `.swc-rs`, `.ap-adj` - 🔨 Partial
- **RotaryKnob** `.swc-rk` - 📋 Planned
- **ToggleSwitch** `.swc-ts` - 📋 Planned
- **ProgressBar** `.swc-pg` - 📋 Planned

### Naming Convention

- joystick → **AxisPad** (swc-ap)
- slider → **LinearSlider** (swc-ls)
- knob → **RotaryKnob** (swc-rk)
- button → **PushButton** (swc-pb)
- display → **DataField** (swc-df)
- indicator → **StatusLamp** (swc-sl)

See `docs/COMPONENT-REGISTRY.md` for full component catalog.

## Camera Controls Troubleshooting

**ChasePlane detected but buttons don't work:**
1. Ensure `camera-helper.ahk` is running (check system tray)
2. Verify ChasePlane keybindings: Alt+Z, Alt+X, Backspace
3. Check `camera-command.txt` is being created

**Native mode not working:**
1. Check SimConnect is connected (console shows "Connected to MSFS")
2. Verify MSFS camera keybindings match expected defaults
3. Test with MSFS window focused

**Wrong mode detected:**
- ChasePlane detection looks for `CP MSFS Bridge.exe` in process list
- Bridge auto-starts when ChasePlane addon is installed
- To test native mode: disable ChasePlane in MSFS Content Manager
