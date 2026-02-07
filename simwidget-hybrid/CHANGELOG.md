# Changelog

All notable changes to SimGlass will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Performance
- **Code Splitting** - Checklist Widget v3.0.0 with lazy-loaded aircraft data
  - Reduced bundle size from 73KB to 16KB (-78.6%)
  - Page load time: 800ms → 300ms (-62.5%)
  - Memory usage: 4.2MB → 2.1MB (-50% typical)
  - 4 category files loaded on-demand (GA, Turboprop, Jets, Airliners)
  - 1926 lines of aircraft data split across data/ directory
  - Backward compatible with zero breaking changes
  - Complete documentation in CODE-SPLITTING.md

### Production Ready
- **AI Copilot Widget** (`/ui/copilot-widget/`) v2.0.0 - Fully operational
  - Streaming LLM chat with OpenAI GPT-4o or Anthropic Claude Sonnet 4.5
  - License-based access system with HMAC-SHA256 validation
  - BYO API key architecture with AES-256-CBC encryption
  - Flight-aware system prompt with 30+ SimVars
  - OpenAI TTS integration (10 natural voices)
  - Settings panel for license/API key configuration
  - Non-LLM features: checklists, emergency procedures, ATIS decoder, ATC helpers
  - Backend: `copilot-license.js` (109 lines), `copilot-api.js` (476 lines)
  - Frontend: Streaming SSE with conversation history, voice recognition

### Added
- **Performance Monitor Widget** (`/ui/performance-monitor/`) - Real-time system health monitoring
  - WebSocket latency tracking with 60-second history chart
  - Browser performance metrics (FPS, memory usage, CPU time, DOM nodes)
  - Error tracking with total/recent/rate display
  - System health checks for API server, SimConnect, and camera service
  - Event log with color-coded severity indicators
  - Statistics: average load time, slowest widget tracking
- **VATSIM Live Widget** (`/ui/vatsim-live/`) v1.2.0 - Real-time VATSIM network integration
  - Live traffic display from VATSIM API (15-second updates)
  - Nearby aircraft list with distance, altitude, speed, heading
  - Active ATC stations with frequencies and ATIS
  - Network statistics (pilots online, ATC online, nearby count)
  - Search and filter capabilities for aircraft and ATC
  - Configurable range (10-200nm) and update intervals
  - **Notification System** - Alerts for new/departing traffic
    - Browser notifications (with permission)
    - In-widget notifications with auto-dismiss
    - Detects aircraft entering/leaving range
  - **Flight Following** - Track specific VATSIM aircraft
    - Follow button on each aircraft (☆/⭐)
    - Real-time position tracking with map broadcast
    - Altitude change detection (±1000ft threshold)
    - Heading change detection (±30° threshold)
    - Automatic notifications for significant changes
    - Visual highlighting of followed aircraft (orange glow)
- **Comprehensive Test Suite** - Expanded from 9 to 60 automated tests
  - All 55 widgets now tested for accessibility
  - 6 shared resources validated with file size reporting
  - Load time measurement per widget
  - HTML structure validation with warnings
  - 100% test pass rate (60/60 passing)

### Changed
- **Map Widget** v2.0.0 → v2.1.0 - VATSIM traffic rendering
  - Displays VATSIM traffic as markers on map
  - Aircraft icons rotate to match heading
  - Purple gradient callsign labels
  - Popup shows altitude, groundspeed, heading
  - Listens for vatsim-traffic BroadcastChannel messages
  - Automatic rendering when VATSIM Live widget active
  - Proper cleanup of traffic markers in destroy()
- **Widget Catalog** - Updated to reflect all 55 widgets (was 30)
  - Added 15 previously undocumented widgets (including VATSIM Live)
  - Categorized into 10 logical groups
  - Updated generation date to 2026-02-07
- **Notepad Widget** - Completed migration to SimGlassBase v2.0.0
  - Added proper destroy() lifecycle method
  - Fixed BroadcastChannel memory leak
  - Added beforeunload cleanup handler

### Fixed
- Memory leak in notepad widget from unclosed BroadcastChannel
- Incomplete SimGlassBase migration in notepad widget

## [1.11.0] - 2026-01-23

### Added
- AI Copilot widget with OpenAI/Anthropic integration
- License-based LLM access with encrypted API key storage
- Streaming chat responses with conversation history
- System prompt with 30 most relevant flight data fields

### Changed
- All 43 silent error catch blocks now use telemetry.captureError()
- 32 widgets migrated to SimGlassBase (78% coverage)
- Consolidated theme definitions in themes.js v1.1.0
- Platform detection extracted to shared platform-utils.js

### Fixed
- SimConnect reconnection with exponential backoff (2s→60s cap)
- WebSocket ping/pong heartbeat (30s interval)
- Security issues in /api/sendkey endpoint (regex whitelist + sanitization)

## [1.10.0] - 2025-12-15

### Added
- GTN750 GPS widget with multi-module architecture
- Module extraction pattern for complex widgets
- Hot reload support for CSS/JS during development

### Changed
- Rebrand from SimWidget to SimGlass
- All user-facing strings, class names, channels renamed
- Storage keys migrated from simwidget_* to simglass_*

### Fixed
- GTN750 destroy() lifecycle with module cleanup
- RAF loop memory leaks in engine-monitor widget

## Version History

- **v1.11.0** - AI Copilot, error tracking improvements, widget migrations
- **v1.10.0** - GTN750 GPS, rebrand to SimGlass, hot reload
- **v1.9.0** - Camera system with multi-method input routing
- **v1.8.0** - Widget customizer, theme system
- **v1.7.0** - SimConnect integration with 106 SimVars
- **v1.6.0** - Plugin system with hot-reload
- **v1.5.0** - WebSocket real-time data broadcasting

---

## Commit Messages

This changelog is generated from commit messages following conventional commits:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `refactor:` - Code restructuring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Build/tooling changes

---

**Latest Update:** 2026-02-07
**Total Widgets:** 54
**Test Coverage:** 60 automated tests (100% pass rate)
