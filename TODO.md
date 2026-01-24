# SimWidget Engine - TODO List
**Version:** v2.8.0
**Last updated:** 2026-01-23

> 📋 **See [PROJECT-PLAN.md](PROJECT-PLAN.md) for full roadmap & milestones**

---

## 🧠 Memory & Standards Backup

### Status: ✅ DONE (Core) / 📋 Enhancements Pending

**Goal:** Persist CLAUDE.md and STANDARDS.md to SQLite database with versioning.

**Why:** Critical project knowledge must not be lost. Database provides:
- Version history
- Change detection (hash comparison)
- Session tracking
- Recovery capability

**Completed:**
- [x] Create `knowledge` table in relay SQLite database
- [x] Add backup API endpoint (`POST /api/knowledge/backup`)
- [x] Add restore API endpoint (`GET /api/knowledge/restore/:type`)
- [x] Add sync API endpoint (`POST /api/knowledge/sync`)
- [x] Add status API endpoint (`GET /api/knowledge/status`)
- [x] Add list API endpoint (`GET /api/knowledge/list/:type`)
- [x] Add "Sync Memory" button to Quick Actions in KittBox

**Remaining Enhancements:**
- [ ] Auto-backup on session end (hook or reminder)
- [ ] Show backup status in Activity Monitor
- [ ] Add diff view for comparing versions

**API Endpoints:**
- `POST /api/knowledge/sync` - Backup both files at once
- `POST /api/knowledge/backup` - Backup single file
- `GET /api/knowledge/status` - Get backup status
- `GET /api/knowledge/list/:type` - List all backups
- `GET /api/knowledge/restore/:type` - Get backup content
- `POST /api/knowledge/restore/:type` - Restore to file

**Schema:** See CLAUDE.md "Memory & Standards Persistence" section.

---

## 💭 Design Thoughts

### No Hardcoded Values (Priority: Thought)
**Principle:** Avoid hardcoded values in webpages/modules/widgets that users may want or need to change.

**Apply to:**
- Port numbers (8080, 8500, 8585, 8590)
- IP addresses (192.168.1.42)
- File paths
- API endpoints
- Timing/intervals (watchdog 30s, cooldowns)
- Limits (max retries, buffer sizes)
- Colors/themes
- Labels/text

**Solution Pattern:**
- Centralized config file (`config.json` or `.env`)
- Runtime config API (`/api/config`)
- UI settings panel for user-adjustable values
- Environment variable overrides

**Status:** Abstract idea - implement incrementally as modules are touched.

---

## WASM Camera Module

### Status: ✅ COMPILED & INSTALLED

Custom WASM module for ChasePlane-like smooth camera control.

**Location:** `wasm-camera/`

- [x] Create project structure
- [x] Write camera state management (simwidget_camera.cpp v0.2.0)
- [x] Implement flyby position calculation (5 presets)
- [x] Add smooth interpolation logic
- [x] Create LVar communication protocol
- [x] Write build scripts (build_v4.bat)
- [x] Create MSFS package structure
- [x] Create camera-bridge.js for server integration
- [x] Install VS 2022 MSFS SDK plugin
- [x] **Compile WASM module** ✅ 11.5KB
- [x] Install to MSFS Community folder
- [x] Add server API endpoints (/api/wasm-camera)
- [x] Create WASM Camera Widget UI
- [x] Add tower view mode ✅ 2026-01-23
- [ ] **Test in MSFS 2024** ← NEXT STEP
- [ ] Add more cinematic presets

**LVars (Server → WASM):**
- `L:SIMWIDGET_CAM_CMD` - Commands: 0=none, 1=flyby, 2=tower, 3=toggle, 4=next, 5=reset
- `L:SIMWIDGET_CAM_SMOOTH` - Smoothing factor 0-100

**LVars (WASM → Server):**
- `L:SIMWIDGET_CAM_READY` - Module loaded flag
- `L:SIMWIDGET_CAM_STATUS` - Current mode
- `L:SIMWIDGET_CAM_REL_X/Y/Z` - Relative camera offset (feet)
- `L:SIMWIDGET_CAM_REL_PITCH/HDG` - Camera orientation

---

## Flow Pro Parity Roadmap

See **docs/FLOW-PRO-REFERENCE.md** for complete category/widget documentation.

> **Status:** ~95% complete (Phase 1-6 done)

### Phase 1: Core Flight ✅ COMPLETE
- [x] Autopilot (HDG, ALT, VS, SPD, master)
- [x] Cameras (views, zoom, pan, presets)
- [x] Engine controls (throttle, prop, mixture)
- [x] Basic lights (nav, beacon, strobe, landing, taxi)
- [x] Basic controls (gear, flaps, spoilers, parking brake)
- [x] Fuel display (quantity, flow, endurance)
- [x] Keymap Editor v3.0 (GUID-based, add/delete/rename)
- [x] Flow Pro API compatibility layer

### Phase 2: Complete Controls ✅ COMPLETE
- [x] Additional lights (logo, wing, cabin, panel, recognition)
- [x] Trim controls (aileron, elevator, rudder trim)
- [x] Pitot heat, carb heat, structural deice
- [x] Doors (main, cargo)
- [x] Electrical (battery, alternator, avionics master)

### Phase 3: Radio & Navigation ✅ COMPLETE
- [x] COM1/COM2 (active, standby, swap)
- [x] NAV1/NAV2 (active, standby, swap)
- [x] ADF frequency
- [x] Transponder (code, mode)
- [x] DME (distance + speed for NAV1/NAV2)

### Phase 4: Information & HUD ✅ COMPLETE
- [x] Altitude tape (0-50k ft)
- [x] Speed tape (IAS 0-400 kts)
- [x] Attitude indicator (pitch/bank)
- [x] Control input visualization
- [x] G-force display with min/max tracking
- [x] Wind vector

### Phase 5: Environment ✅ COMPLETE
- [x] Time of day controls + slider + presets
- [x] Weather presets (9 conditions)
- [x] Sim rate controls (¼x to 8x)
- [x] Pause/Resume, Slew mode
- [x] Repair & Refuel

### Phase 6: Advanced ✅ COMPLETE
- [x] Panel Launcher (G1000 soft keys, avionics power)
- [x] Interaction Wheel (radial menu with live state)
- [x] Otto Search Bar (45+ commands, fuzzy search)
- [x] Plugin System (discovery, enable/disable, Plugin Manager UI)

---

## High Priority

### AxisPad (Joystick) Component ✅ COMPLETE
- [x] **Create AxisPad component class** ✓ IMPLEMENTED 2025-01-05
- [x] **Add to shared-ui for testing** ✓ ADDED
- [x] **Full MSFS testing** - AXIS_AILERONS_SET/AXIS_ELEVATOR_SET verified (2026-01-22)

### Smart Installer / First-Run Setup Wizard ✅ COMPLETE
- [x] **Auto-detection on first run:**
  - MSFS version detection (2020 vs 2024)
  - ChasePlane detection
  - AutoHotKey detection
  - Keybinding configuration

- [x] **4-step wizard UI** with progress indicator
- [x] **Save user configuration to config.json**

### Camera Controls Compatibility ✅ TESTED
- [x] **Native MSFS camera controls work WITHOUT ChasePlane**
- [x] PowerShell key sending via send-key.ps1
- [x] FastKeySender for ~32ms latency (12x improvement)

---

## Known Limitations (Workarounds Needed)

### Browser Extension JS Execution
- **Issue:** Cannot execute JavaScript directly in browser tabs due to extension permission conflicts
- **Impact:** Can't clear localStorage, run diagnostics, or manipulate DOM directly
- **Workaround:** Added `clearTaskState()` function exposed globally - user must run in console
- **Future:** Create MCP endpoint or admin API to handle these operations server-side

### Future Resources to Build
- [ ] Admin API for browser state management (clear cache, localStorage, etc.)
- [ ] Server-side task state reset endpoint
- [ ] Health check endpoint that auto-clears stale state
- [ ] CLI commands for common operations

---

## Kitt Live Voice & TTS Features

### Voice Engine Enhancements
- [ ] **Microsoft Natural Voices priority** - Show Natural voices at top with star icon ✅ DONE
- [ ] **Voice categories/filtering** - Filter by language, gender, accent
- [ ] **Voice preview on hover** - Play sample when hovering over voice option
- [ ] **Voice presets** - Save favorite voice+rate+pitch+volume combinations
- [ ] **Quick preset buttons** - "Heather", "Shǐ zhēn xiāng", "Professional", "Fast"
- [ ] **ElevenLabs integration** - Premium cloud voices (with cost warning)
- [ ] **Azure Neural TTS** - Microsoft Azure voices (with cost warning)
- [ ] **Coqui TTS local** - Free offline neural voices
- [ ] **Voice cloning** - Clone user's voice locally (Coqui/Tortoise)

### Speech Recognition Enhancements
- [ ] **Whisper model selector** - tiny/base/small/medium/large
- [ ] **Language detection** - Auto-detect spoken language
- [ ] **Continuous listening mode** - Keep transcribing without click-to-stop
- [x] **Wake word** - "Hey Kitt" to activate ✅ 2026-01-23
- [ ] **Noise suppression** - Filter background noise before transcription
- [ ] **Speaker diarization** - Identify different speakers

### Kitt Intelligence & Tool Use
- [ ] **Hive-aware responses** - Kitt knows about all services, can check status directly
- [ ] **Tool calling** - Kitt can execute commands, not just suggest URLs
- [ ] **Status command** - Actually query service health endpoints and report results
- [ ] **Context injection** - Feed Kitt current hive state (services, ports, health)
- [ ] **Command execution** - Run allowed bash commands and return results
- [ ] **File reading** - Read logs, configs when asked
- [ ] **Service control** - Start/stop/restart services via voice
- [ ] **Smart routing** - Route complex questions to Claude Code via relay
- [ ] **Memory recall** - Remember conversation context across sessions
- [ ] **Proactive alerts** - Notify when services go down

### Voice Persona System
- [ ] **Persona manager** - Create/edit/delete voice personas
- [ ] **Per-persona settings** - Voice, rate, pitch, volume, personality prompt
- [ ] **Persona shortcuts** - Quick-switch hotkeys
- [ ] **Conversation history per persona** - Track what each persona has said

### Responsive & Device-Specific Layouts
- [ ] **Desktop PC layout** - Full-featured, multi-panel, keyboard shortcuts
- [ ] **Tablet layout** - Touch-optimized, larger buttons, swipe gestures
- [ ] **Mobile portrait** - Single column, bottom input, thumb-friendly
- [ ] **Mobile landscape** - Side-by-side chat/controls
- [ ] **Android PWA** - Install as app, native feel, push notifications
- [ ] **iOS PWA** - Safari Add to Home Screen support
- [ ] **TV/Large display** - Voice-first, minimal UI, large text
- [ ] **Electron desktop** - Native window controls, system tray, hotkeys
- [ ] **Auto-detect device** - MediaQuery + UserAgent detection
- [ ] **Layout switcher** - Manual override in settings
- [ ] **Touch vs mouse** - Different interaction patterns
- [ ] **Orientation handling** - Smooth portrait/landscape transitions

---

## UI Feature Requests

### Active Tasks - Claude Code Integration
- [ ] **Track Claude Code activity** - Record tasks when user talks to Claude directly (not via Kitt)
- [ ] **Claude Code status API** - Endpoint to report current task from Claude Code session
- [ ] **Unified task view** - Show all tasks regardless of source (Kitt, Relay, Claude Code)
- [ ] **Activity reconciliation** - All Claude work flows to Recent Activity on completion
- [ ] **Claude activity in Activity Monitor** - Show Claude's current work in the Activity Monitor panel
- [ ] **Claude activity in server logs** - Log Claude activity to agent server logs for debugging

### Live Activity Stream (Comprehensive)
- [ ] **Relay consumer 100% uptime** - Re-engineer relay consumer for reliability:
  - Auto-restart on crash
  - Health monitoring
  - Run as Windows service
  - Watchdog process
- [ ] **Real-time activity panel** - WebSocket-based live updates showing:
  - Task submitted → Relay received → Consumer picked up → Response sent
  - Actual timestamps for each stage
  - Message content preview
- [ ] **Relay consumer log streaming** - Stream consumer stdout to UI via WebSocket
- [ ] **Claude thinking indicator** - Show when Claude is actively processing vs idle
- [ ] **Activity history** - Scrollable log of recent activity with filters
- [ ] **Stage timing** - Show how long each stage took (queue time, processing time, etc.)

### Debug Inspector
- [ ] **Input prompts for debug items** - When adding debug items that require input (e.g., "fix X", "change Y to Z"), prompt user for the specific input before sending command

### Claude Code Terminal Integration
- [ ] **Show Claude Code terminal on CC** - Stream current Claude Code session output to Command Center:
  - Create WebSocket bridge from Claude Code CLI to Admin UI
  - Display real-time terminal output in Claude Tasks card or dedicated panel
  - Show current working directory, command history
  - Allow sending commands from CC to active Claude Code session
  - Bidirectional communication (CC ↔ Claude Code)

### Window Management
- [ ] **Dockable windows** - Update design for all dashboard cards/panels to be dockable:
  - Drag windows to screen edges to snap/dock
  - Dock windows together (side-by-side, tabbed)
  - Save/restore dock layouts
  - Undock to floating mode
  - Minimize to dock bar
- [ ] **Window snapping** - Snap zones for corners and edges (already partial in ClaudeTerminal)
- [ ] **Layout presets** - Save and switch between different window arrangements

### TODO System Enhancement
- [ ] **Master TODO sync** - Import tasks from master TODO.md into session todo list
- [ ] **GUID-based task IDs** - All tasks use unique GUID (e.g., `task-{timestamp}-{random6}`) for tracking across flat files and session data
- [ ] **Smart priority recommendation** - If priority not set, auto-recommend based on:
  - Project phase (from PROJECT-PLAN.md)
  - Current active tasks
  - Task dependencies
  - Task age/staleness
- [ ] **Unified task format** - Standardize task structure:
  - `id`: GUID
  - `content`: Task description
  - `priority`: high/normal/low (auto if not set)
  - `source`: master/session/user
  - `status`: pending/in_progress/completed
  - `createdAt`: ISO timestamp
  - `linkedTo`: Reference to master TODO item (if imported)
- [ ] **Flat file persistence** - Save session tasks to JSON with GUID references
- [ ] **Master TODO parser** - Parse TODO.md markdown into importable task objects

### Kitt Task Processing Rewrite (Admin UI) ✅ IMPLEMENTED 2026-01-11
- [x] **Rewrite bubble task handling** - New task-bubbles.js module with state-based rendering
- [x] **Claude activity monitoring** - TaskProcessor polls relay/kitt status every 3s
- [x] **Task queue coordination** - TaskProcessor queues tasks when Claude is busy
- [x] **State machine for task flow** - States: idle → queued → waiting_for_claude → claude_processing → complete/error
- [x] **Visual feedback** - TaskBubbles shows progress bars, status dots, queue position
- [x] **Timeout handling** - 5min pickup timeout, 30min processing timeout

**New Modules:**
- `modules/task-processor.js` - State machine, queue management, Claude monitoring
- `modules/task-bubbles.js` - Visual bubble rendering with state colors

**Fixed Issues:**
- Claude activity detected via relay queue + kitt status API
- Task bubbles update in real-time with state transitions
- Race conditions prevented by task queue coordination

---

## Medium Priority

### ChasePlane API Integration
- [ ] Discover ChasePlane REST/WebSocket API on port 42042
- [ ] Replace AHK helper with direct API calls if available

### Startup Automation
- [x] Auto-start camera-helper.ahk when server starts ✓ v1.2
- [x] Add AHK helper status to `/api/status` endpoint (v1.14.0)
- [x] **MSFS EXE.xml addon** - Auto-launch SimWidget with MSFS (2026-01-09)
- [x] **start-simwidget.bat** - Manual start script (2026-01-09)
- [x] **stop-simwidget.bat** - Manual stop script (2026-01-09)
- [x] **simwidget-manage.ps1** - PowerShell management start/stop/restart/status (2026-01-09)
- [x] **Windows Service installer** - install-service.ps1 for NSSM service mode ✅ 2026-01-23

---

## Low Priority

### Project Management Philosophy
- [ ] **Consider todo priority as lowest priority** - Focus on core functionality over task management overhead. TODOs should guide development but not become a burden that slows progress. Prefer working code over perfect documentation.

### Documentation
- [x] FLOW-PRO-REFERENCE.md - Complete category/widget docs
- [x] STANDARDS.md - Project conventions and patterns
- [x] CAMERA-TROUBLESHOOTING.md - Camera control troubleshooting guide
- [x] PLUGIN-DEVELOPMENT.md - Plugin development guide
- [x] Update CLAUDE.md with camera controller architecture

---

## Completed ✓

### 2026-01-23
- [x] **Widget Catalog** - 50+ widgets documented in WIDGET-CATALOG.md
- [x] **Keyboard Shortcuts** - Ctrl+K search, Ctrl+1-5 widgets, Ctrl+Shift+T theme
- [x] **Widget Search** - Fuzzy search launcher for all widgets
- [x] **Night Mode** - Auto-switch theme based on system/sim time
- [x] **Widget Presets** - VFR, IFR, Airliner, Training configurations
- [x] **Checklist Maker** - Create custom aircraft checklists
- [x] **Tower View Camera** - WASM camera tower perspective mode
- [x] **Windows Service Installer** - install-service.ps1 for NSSM
- [x] **Kitt Wake Word** - "Hey Kitt" hands-free activation
- [x] **Voice Control for Checklists** - Speech commands for checklist widget
- [x] **Mobile Optimization** - Responsive checklist widget for phones/tablets

### 2026-01-11
- [x] **Kitt Task Processor v1.0.0** - State machine for task lifecycle management
- [x] **Task Bubbles UI v1.0.0** - Visual state rendering with progress bars
- [x] **Claude Activity Monitor** - Detects when Claude is busy via relay/kitt APIs
- [x] **Task Queue System** - Queues tasks when Claude is busy, auto-processes when available
- [x] **Core.js Integration** - sendViaTaskProcessor() with event-based response handling
- [x] **Debug Inspector v2.3** - Added DIM (Data Interface Manager) menu with status modals
  - DIM status check (health endpoint)
  - Open SimWidget UI
  - Restart DIM service
  - SimConnect connection status
  - Flight data viewer
- [x] **Relay Cleanup Endpoint** - `/api/queue/cleanup` clears stale processing items

### 2026-01-09
- [x] **Master (O) v1.0.0** - Service orchestrator on port 8500
- [x] **Service Standards v1.2.0** - Logging buffer, /api/log, /api/shutdown, crash protection
- [x] **Remote Support v1.1.0** - Added missing standard patterns
- [x] **start-all-servers.bat v2.0** - Detects running services, O/K/G/L/Q menu
- [x] **Kitt UI Abbreviations** - Added ss/br/uem/newchat/ntt to admin menu

### 2025-01-08 (Session 2)
- [x] **Services Panel Widget v1.0.0** - New widget at /ui/services-panel/
- [x] **Server v1.9.0** - Added /api/services endpoint for service control
- [x] **Agent Server v1.0.5** - Fixed express.static for HTML serving
- [x] **Agent UI Update** - Added ☰ hamburger menu with admin commands
- [x] **Agent UI Update** - Added ⚙️ services panel with status dots
- [x] **Agent UI Update** - Compact status dots in header (SimWidget/Agent/Remote)
- [x] **Service Control API** - Start/stop/restart services via REST

### 2025-01-08
- [x] **Plugin Architecture v1.0** - Modular plugin system
- [x] **plugin-loader.js** - Dynamic plugin discovery & loading
- [x] **Core Plugin** - Essential flight data & controls
- [x] **Voice Control Plugin** - Refactored as optional plugin
- [x] **Flight Recorder Plugin** - Refactored as optional plugin
- [x] **Lorby Bridge Plugin** - SimVar access via HTTP
- [x] **PLUGINS.md** - Plugin system documentation
- [x] **Install Profiles** - Lite/Standard/Pro/Dev tiers
- [x] **RESOURCES.md** - Integration APIs documentation
- [x] **Lorby AAO API testing** - Connection verified
- [x] **Test Framework v1.0** - Automated tests with fixtures
- [x] **Supabase Integration** - Cloud sync for test results
- [x] **Security Inspector** - Multi-file scanner
- [x] **Widget Validator** - Community widget validation

### Earlier
- [x] Keymap Editor v3.0 - GUID-based with editable names
- [x] Flow Pro API layer - shared-ui/flow-api.js
- [x] STANDARDS.md - Project conventions document
- [x] TinyWidget Architecture - Single-function micro-widgets
- [x] DLL Inspector - Node.js PE parser for native DLL exports
- [x] Smart camera controller with ChasePlane detection
- [x] AHK helper for ChasePlane keystroke injection

---

## Notes

**Flow Pro Widget Count:** ~170 items across 20 categories

**Camera Control Test Environments:**
1. MSFS 2024 + ChasePlane ✓ TESTED
2. MSFS 2024 without ChasePlane ✓ TESTED (2026-01-22 via PowerShell key sending)
3. MSFS 2020 variants - future

**Key Latency:** Achieved ~32ms via FastKeySender (persistent PowerShell process)
