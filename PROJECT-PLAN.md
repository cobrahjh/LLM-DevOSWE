# SimWidget Engine - Project Plan
**Version:** 1.0.0  
**Last Updated:** 2025-01-07  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\PROJECT-PLAN.md`

---

## Project Overview

**Goal:** Professional-grade Flow Pro replacement for MSFS 2024  
**Target:** Feature parity with Flow Pro (~170 widgets across 20 categories)  
**Architecture:** Node.js server + Electron overlay + SimConnect integration

### Success Metrics
- [x] All Phase 1-6 widgets functional
- [x] Camera controls work with/without ChasePlane
- [x] Smart installer for first-run setup
- [x] Sub-50ms latency for control inputs (achieved ~32ms via FastKeySender)
- [x] Professional UI matching Flow Pro quality

---

## Current Status

| Component | Status | Version |
|-----------|--------|---------|
| Server (backend) | ✅ Operational | v1.5.0 |
| Keymap System | ✅ Complete | v3.0.0 |
| Aircraft Control Widget | ✅ Ported | v3.7 |
| Camera Controller | ✅ Working (ChasePlane) | v1.2 |
| Flow Pro API Layer | ✅ Implemented | v1.0 |
| Lights & Systems Widget | ✅ Complete | v2.0 |
| Radio Stack Widget | ✅ Complete | v1.0 |
| Flight Instruments Widget | ✅ Complete | v1.0 |
| Environment Widget | ✅ Complete | v1.0 |
| Setup Wizard | ✅ Complete | v1.0 |
| Dashboard Launcher | ✅ Complete | v1.0 |
| AxisPad Component | ✅ MSFS tested | v1.2 |

**Flow Pro Parity:** ~95% complete (Phase 1-6 + Installer + Dashboard)

---

## Phase Roadmap

### Phase 1: Core Flight ✅ COMPLETE
**Timeline:** Completed 2025-01-05

| Feature | Status | Notes |
|---------|--------|-------|
| Autopilot (HDG, ALT, VS, SPD) | ✅ | Full slider controls |
| Camera controls | ✅ | ChasePlane + AHK helper |
| Engine controls (throttle, prop, mixture) | ✅ | Vertical sliders |
| Basic lights (5/11) | ✅ | Nav, beacon, strobe, landing, taxi |
| Basic controls | ✅ | Gear, flaps, spoilers, parking brake |
| Fuel display | ✅ | Quantity, flow, endurance |
| Keymap Editor | ✅ | GUID-based CRUD v3.0 |
| Flow Pro API | ✅ | Variable get/set compatibility |

---

### Phase 2: Complete Controls ✅ COMPLETE
**Timeline:** Completed 2026-01-22

| Feature | Priority | Status | SimVar/Event |
|---------|----------|--------|--------------|
| **Additional Lights** | | |
| Logo light | HIGH | ✅ | TOGGLE_LOGO_LIGHTS |
| Wing light | HIGH | ✅ | TOGGLE_WING_LIGHTS |
| Cabin light | MEDIUM | ✅ | TOGGLE_CABIN_LIGHTS |
| Panel light | MEDIUM | ✅ | PANEL_LIGHTS_TOGGLE |
| Recognition light | LOW | ✅ | TOGGLE_RECOGNITION_LIGHTS |
| **Trim Controls** | | |
| Aileron trim | HIGH | ✅ | AILERON_TRIM_LEFT/RIGHT |
| Elevator trim | HIGH | ✅ | ELEV_TRIM_UP/DN |
| Rudder trim | HIGH | ✅ | RUDDER_TRIM_LEFT/RIGHT |
| **Engine Systems** | | |
| Pitot heat | HIGH | ✅ | PITOT_HEAT_TOGGLE |
| Carb heat | MEDIUM | ✅ | ANTI_ICE_TOGGLE_ENG1 |
| Structural deice | MEDIUM | ✅ | TOGGLE_STRUCTURAL_DEICE |
| **Doors** | | |
| Main door | MEDIUM | ✅ | TOGGLE_AIRCRAFT_EXIT |
| Cargo doors | LOW | ✅ | TOGGLE_AIRCRAFT_EXIT_FAST |
| **Electrical** | | |
| Battery master | HIGH | ✅ | TOGGLE_MASTER_BATTERY |
| Alternator | HIGH | ✅ | TOGGLE_MASTER_ALTERNATOR |
| Avionics master | HIGH | ✅ | TOGGLE_AVIONICS_MASTER |

**Phase 2 Deliverables:**
- [x] Additional lights widget section (5 extra lights)
- [x] Trim controls widget section (aileron, elevator, rudder)
- [x] Electrical systems widget (battery, alternator, avionics)
- [x] Door controls (main, cargo)
- [x] Engine systems (pitot heat, carb heat, deice)

---

### Phase 3: Radio & Navigation ✅ COMPLETE
**Timeline:** Completed 2026-01-22

| Feature | Priority | Status | SimVar/Event |
|---------|----------|--------|--------------|
| COM1 active/standby | HIGH | ✅ | COM_RADIO_SET, COM_STBY_RADIO_SET |
| COM2 active/standby | HIGH | ✅ | COM2_RADIO_SET, COM2_STBY_RADIO_SET |
| NAV1 active/standby | HIGH | ✅ | NAV1_RADIO_SET, NAV1_STBY_SET |
| NAV2 active/standby | HIGH | ✅ | NAV2_RADIO_SET, NAV2_STBY_SET |
| Transponder code | HIGH | ✅ | XPNDR_SET (octal) |
| Transponder mode | HIGH | ✅ | OFF/STBY/ON/ALT modes |
| Frequency swap | HIGH | ✅ | COM_STBY_RADIO_SWAP, NAV1_RADIO_SWAP |
| ADF frequency | MEDIUM | ✅ | ADF_ACTIVE_SET, data in flightData |
| DME | LOW | ✅ | NAV DME:1/2, NAV DMESPEED:1/2 |

**Phase 3 Deliverables:**
- [x] Radio Stack widget (COM1, COM2, NAV1, NAV2)
- [x] Transponder widget with digit tuning
- [x] Frequency swap buttons (⇄)
- [x] Emergency code presets (VFR, HIJ, COM, EMG)
- [x] DME display (distance and speed for NAV1/NAV2)

---

### Phase 4: Information & HUD ✅ COMPLETE
**Timeline:** Completed 2026-01-22

| Feature | Priority | Status | Notes |
|---------|----------|--------|-------|
| Altitude tape | MEDIUM | ✅ | Vertical scrolling 0-50k ft |
| Speed tape | MEDIUM | ✅ | IAS 0-400 kts |
| Attitude indicator | MEDIUM | ✅ | Pitch/bank with horizon |
| Control input viz | MEDIUM | ✅ | Aileron/elevator cross + rudder bar |
| G-force display | LOW | ✅ | Live G + min/max tracking |
| Wind vector | MEDIUM | ✅ | Compass arrow + direction/speed |
| V/S, HDG, GS readouts | MEDIUM | ✅ | Secondary data row |

---

### Phase 5: Environment ✅ COMPLETE
**Timeline:** Completed 2026-01-22

| Feature | Priority | Status | SimVar/Event |
|---------|----------|--------|--------------|
| Time of day | MEDIUM | ✅ | ZULU_HOURS/MINUTES_SET |
| Time slider | MEDIUM | ✅ | 24-hour visual slider |
| Time presets | MEDIUM | ✅ | Dawn/Noon/Dusk/Midnight |
| Sim rate | LOW | ✅ | SIM_RATE_INCR/DECR |
| Rate presets | LOW | ✅ | ¼x to 8x |
| Weather presets | LOW | ✅ | 9 weather conditions |
| Pause/Resume | MEDIUM | ✅ | PAUSE_TOGGLE |
| Slew mode | LOW | ✅ | SLEW_TOGGLE |
| Repair & Refuel | LOW | ✅ | REPAIR_AND_REFUEL |

---

### Phase 6: Advanced ✅ COMPLETE
**Timeline:** Completed 2026-01-22

| Feature | Priority | Status | Notes |
|---------|----------|--------|-------|
| Panel Launcher | LOW | ✅ | G1000 soft keys, avionics power, quick actions |
| Interaction Wheel | LOW | ✅ | Radial menu for common flight controls |
| Otto Search Bar | LOW | ✅ | Command palette with 45+ commands |
| Plugin System | LOW | ✅ | Third-party widget discovery and management |

**Phase 6 Deliverables:**
- [x] Panel Launcher widget (`ui/panel-launcher/`)
  - G1000 PFD/MFD soft keys (SK1-SK6)
  - Avionics power controls (Battery, Alt, Avionics)
  - Knob controls (NAV VOL, HDG, ALT, FMS, RANGE)
  - Quick actions (Direct-To, Menu, FPL, PROC, View)
  - H: event API endpoint (`/api/hevent`)
- [x] Interaction Wheel widget (`ui/interaction-wheel/`)
  - Radial menu with 8 quick actions
  - Live state feedback (gear, brake, AP, lights)
  - Color-coded categories (flight, lights, engine, camera, autopilot)
  - Tooltips and visual feedback
- [x] Otto Search Bar (`ui/otto-search/`)
  - Command palette with 45+ flight commands
  - Fuzzy search by name, description, keywords
  - Category filters (flight, lights, autopilot, engine, camera, radio)
  - Keyboard navigation (arrows, enter, escape)
- [x] Plugin System (`backend/plugin-system/`, `ui/plugin-manager/`)
  - Plugin discovery from `plugins/` folder
  - Manifest-based plugin registration (plugin.json)
  - Enable/disable plugins via API and UI
  - Plugin Manager widget with status indicators
  - Example checklist plugin with flight checklists
  - REST API: GET/POST `/api/plugins`, enable/disable, refresh

---

## High Priority Items (Now)

### 1. AxisPad MSFS Testing ✅ TESTED
**Status:** API commands verified working (2026-01-22)
**Result:** AXIS_AILERONS_SET, AXIS_ELEVATOR_SET commands functional
**Note:** UI sensitivity can be tuned in aircraft-control widget

### 2. Smart Installer / First-Run Wizard ✅ COMPLETE
**Status:** Completed 2026-01-22
**Components:**
- [x] MSFS version detection (2020 vs 2024)
- [x] ChasePlane detection
- [x] AutoHotKey detection
- [x] Keybinding configuration questionnaire
- [x] Auto-start preference
- [x] Save to config.json
- [x] 4-step wizard UI with progress indicator

### 3. Camera Controls Without ChasePlane ✅ TESTED
**Status:** Working (2026-01-22)
**Result:** All native camera views work via PowerShell key sending
**Fixed:** send-key.ps1 script created, path references corrected

---

## Medium Priority Items

### ChasePlane Direct API
**Goal:** Replace AHK helper with WebSocket API  
**Status:** Port 42042 discovered, read-only confirmed  
**Next:** Investigate alternative control methods

### Status Endpoint Enhancement ✅ COMPLETE
**Goal:** Add comprehensive health check endpoint
**Completed:** `/api/health` with camera, plugins, memory, uptime

### Documentation Updates ✅ MOSTLY COMPLETE
- [x] Troubleshooting guide for camera controls (`docs/CAMERA-TROUBLESHOOTING.md`)
- [x] Plugin development guide (`docs/PLUGIN-DEVELOPMENT.md`)
- [x] SimWidget README updated (`simwidget-hybrid/README.md`)
- [ ] Widget development tutorial video (future)
- [ ] MSFS SDK event reference expansion (future)

---

## Technical Debt

| Item | Severity | Notes |
|------|----------|-------|
| ~~Port inconsistency (8080 vs 8484)~~ | ~~LOW~~ | ✅ Fixed - CLAUDE.md updated |
| vJoy integration disabled | LOW | Caused input conflicts |
| AHK helper dependency | MEDIUM | Windows-only solution |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChasePlane users need AHK | MEDIUM | Document setup clearly |
| SimConnect event gaps | HIGH | Research community presets |
| MSFS 2024 SDK changes | MEDIUM | Monitor SDK updates |
| Performance on lower-end PCs | LOW | Optimize polling rates |

---

## Development Environment

| Machine | IP | Role | Status |
|---------|-----|------|--------|
| Harold-PC | 192.168.1.192 | MSFS + Server | ✅ Active |
| Morpu-PC | 192.168.1.97 | Development | ✅ Active |

**Access:** `net use H: \\192.168.1.192\DevClaude`  
**Server:** `http://192.168.1.192:8080`

---

## Resources

| Resource | URL |
|----------|-----|
| MSFS SDK Docs | https://docs.flightsimulator.com/html/Introduction/Introduction.htm |
| SimConnect Reference | https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm |
| MobiFlight HubHop | https://hubhop.mobiflight.com |
| FlyByWire A32NX API | https://docs.flybywiresim.com/aircraft/a32nx/a32nx-api/ |
| node-simconnect | https://github.com/EvenAR/node-simconnect |

---

## Document Index

| Document | Path | Purpose |
|----------|------|---------|
| PROJECT-PLAN.md | This file | Project roadmap & status |
| CLAUDE.md | `CLAUDE.md` | AI context |
| ARCHITECTURE.md | `ARCHITECTURE.md` | System design |
| TODO.md | `TODO.md` | Development backlog |
| STANDARDS.md | `STANDARDS.md` | Coding conventions |
| FLOW-PRO-REFERENCE.md | `docs/` | Widget API reference |
| WIDGET-CREATION-GUIDE.md | `docs/` | Widget dev guide |
| SIMVARS-REFERENCE.md | `docs/` | SimConnect variables |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-07 | Initial project plan created |
