# GTN 750Xi Project

## Overview

The GTN 750Xi is a modernized variant of the GTN 750 GPS project. It maintains full compatibility with the original GTN 750 codebase while providing a foundation for experimental features and UI enhancements.

## Key Differences from GTN 750

- **Widget Name:** `gtn750xi` (vs `gtn750`)
- **Version:** v1.0.0 (independent versioning)
- **Class Name:** `GTN750XiPane` (vs `GTN750Pane`)
- **Global Variable:** `window.gtn750xi` (vs `window.gtn750`)

## Purpose

This variant allows:
1. **Experimental features** without affecting the stable GTN 750
2. **UI modernization** testing
3. **Feature isolation** for bleeding-edge development
4. **Parallel deployment** — both widgets can run side-by-side

## Codebase Status

- **Current state:** Identical to GTN 750 v2.3.0
- **All modules copied:** Map renderer, flight plan, overlays, pages
- **All documentation preserved:** User guides, feature status, known issues

## Development Notes

- Both projects share the same CSS base (`.gtn750` class retained for compatibility)
- Module references use relative paths, so no import changes needed
- Server endpoints remain the same (shared navDB, weather API, etc.)

## Deployment

To deploy GTN750Xi:
1. Ensure backend server is running (port 8080)
2. Navigate to `/ui/gtn750xi/`
3. Widget will register as `gtn750xi` with telemetry/status endpoints

## Migration Path

Features developed in GTN750Xi can be:
1. Tested independently
2. Validated by users
3. Backported to GTN750 when stable
4. Or kept exclusive to the Xi variant

---

**Created:** 2026-02-19
**Base Version:** GTN 750 v2.3.0
**Status:** Active Development
