# SimWidget Engine
**Version:** v1.13.0
**Last updated:** 2026-01-13

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

## ⚠️ Before Starting Any Work

**Read [STANDARDS.md](STANDARDS.md) first!** Contains proven patterns, timing defaults, and lessons learned.

## ⚠️ Important Rules

- **NEVER use Anthropic API key for Kitt agent** - not cost effective. Use relay mode or direct Claude Code instead.
- **NEVER change ports without asking** - Do NOT modify ports for any process, service, or API unless explicitly approved by Harold. Changing ports breaks URLs and paths that are already memorized/bookmarked.
- **Continue changes without prompting** - Don't ask for confirmation, just make the changes and report what was done.
- **NEVER ask for permissions** - Just do it. No confirmation dialogs, no "shall I proceed?", no permission requests.
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

## User Shortcuts

- `msg` - check messages - poll relay for pending Kitt messages
- `mem` - memory - add to CLAUDE.md for future reference
- `ntt` - next todo task - work on next item from todo list
- `br` - add to todo options - add feature/option to todo module
- `mst` - make standard - add pattern/convention to STANDARDS.md
- `memstandards` - session reflection - review work and add patterns to STANDARDS.md
- `psreflect` - project reflection - give recommendations based on experience
- `ts` - test this - run tests on recent changes
- `rst` - reset - reset stuck services/state
- `rfr` - refactor from standards - refactor code to follow STANDARDS.md
- `chk` - check/verify - check status, syntax, or state
- `opn` - open UI - open browser to test
- `syn` - sync - test sync/reconcile features
- `cls` - clear/clean - clear stuck queues, logs, cache
- `idt` - I don't think/know - signals uncertainty, needs clarification
- `adi` - add debug item - add item to Debug Inspector
- `vl` - voice log - show/manage voice output history
- `syncmem` - sync memory - backup CLAUDE.md and STANDARDS.md to database
- `ayb` - are you busy? - check if Claude is ready for next task
- `dinsp` - debug inspector - refers to Debug Inspector tool/menu
- `wpan` - window/panel - refers to floating windows or panels
- `rvw` - review - review code for issues, clean up, optimize
- `hivesanitycheck` - hive sanity check - check all hive info (services status, ports, health, logs)

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
| 8800 | Hive Brain | Device discovery, colony management |
| 8850 | Hive Oracle | Distributed LLM orchestrator |
| 11434 | Ollama | Local LLM (qwen3-coder) |
| 1234 | LM Studio | Local LLM (qwen2.5-coder-14b) |

**Start all:** `C:\LLM-DevOSWE\start-all-servers.bat`
**Full details:** See `SERVICE-REGISTRY.md`

## Project Directories

| Directory | Purpose |
|-----------|---------|
| `C:\LLM-DevOSWE` | Main framework, services |
| `C:\LLM-Oracle` | Oracle daemon |
| `C:\kittbox-modules` | Desktop apps (Kitt Live) |
| `C:\kittbox-web` | KittBox web interface |
| `C:\twitch-disability-app` | Accessibility extension |
| `C:\devTinyAI` | AI sandbox |

**User Desktops (sync shortcuts to both):**
- `C:\Users\hjhar\Desktop` - Local desktop
- `C:\Users\hjhar\OneDrive\Desktop` - OneDrive synced desktop

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
├── CLAUDE.md                  # This file
├── ARCHITECTURE-V2.md         # System architecture v2.1
├── TODO.md                    # Development todo list
└── README.md                  # User documentation
```

## Key Components

### Server (`server/index.js`)
- Connects to MSFS via node-simconnect
- Exposes WebSocket on port 8484
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
