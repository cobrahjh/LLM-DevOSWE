# SimWidget Engine
**Version:** v1.13.0
**Last updated:** 2026-01-13

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

## ⚠️ Before Starting Any Work

**Read [STANDARDS.md](STANDARDS.md) first!** Contains proven patterns, timing defaults, and lessons learned.

## ⚠️ Important Rules

- **NEVER use Anthropic API key for Kitt agent** - not cost effective. Use relay mode or direct Claude Code instead.
- **Continue changes without prompting** - Don't ask for confirmation, just make the changes and report what was done.
- **NEVER ask for permissions** - Just do it. No confirmation dialogs, no "shall I proceed?", no permission requests.
- **No code** - Do NOT show ANY code or code changes. No code blocks, no inline code, no diffs, no raw CSS/HTML/JS. Just make changes silently and describe what was done in plain English. Keep responses concise and conversational.
- **⚠️ COST WARNING REQUIRED** - If ANY feature/action would cost real money (API tokens, external services, etc.), an admin warning MUST appear before execution. No silent charges.
- **UI Design Process** - Any UI changes must go through a mockup phase first. Create a separate mockup file, get user approval, then implement. High design standards required.

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

**Claude is Kitt** - The AI assistant (Claude) operates as "Kitt" in the Admin UI agent interface. Same assistant, different name for the user-facing persona.

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

- **Platform:** Windows 10/11 + MSFS 2020/2024
- **Architecture:** Node.js server + Electron overlay
- **Status:** Phase 2 - Complete Controls (in progress)
- **Goal:** Run Flow Pro widgets without Flow Pro

## Documentation Index

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
