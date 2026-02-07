# Changelog

All notable changes to SimGlass will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Performance Monitor Widget** (`/ui/performance-monitor/`) - Real-time system health monitoring
  - WebSocket latency tracking with 60-second history chart
  - Browser performance metrics (FPS, memory usage, CPU time, DOM nodes)
  - Error tracking with total/recent/rate display
  - System health checks for API server, SimConnect, and camera service
  - Event log with color-coded severity indicators
  - Statistics: average load time, slowest widget tracking
- **Comprehensive Test Suite** - Expanded from 9 to 60 automated tests
  - All 54 widgets now tested for accessibility
  - 6 shared resources validated with file size reporting
  - Load time measurement per widget
  - HTML structure validation with warnings
  - 100% test pass rate (60/60 passing)

### Changed
- **Widget Catalog** - Updated to reflect all 54 widgets (was 30)
  - Added 14 previously undocumented widgets
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
