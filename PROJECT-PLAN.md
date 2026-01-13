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
- [ ] All Phase 1-3 widgets functional
- [ ] Camera controls work with/without ChasePlane
- [ ] Smart installer for first-run setup
- [ ] Sub-50ms latency for control inputs
- [ ] Professional UI matching Flow Pro quality

---

## Current Status

| Component | Status | Version |
|-----------|--------|---------|
| Server (backend) | ✅ Operational | v1.5.0 |
| Keymap System | ✅ Complete | v3.0.0 |
| Aircraft Control Widget | ✅ Ported | v3.7 |
| Camera Controller | ✅ Working (ChasePlane) | v1.2 |
| Flow Pro API Layer | ✅ Implemented | v1.0 |
| AxisPad Component | 🔶 Needs MSFS testing | v1.2 |
| Smart Installer | ❌ Not started | - |

**Flow Pro Parity:** ~35% complete (Phase 1 done, Phase 2 in progress)

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

### Phase 2: Complete Controls 🔶 IN PROGRESS
**Timeline:** Current → Est. 2 weeks

| Feature | Priority | Status | SimVar/Event |
|---------|----------|--------|--------------|
| **Additional Lights** | | |
| Logo light | HIGH | ❌ | LIGHT_LOGO |
| Wing light | HIGH | ❌ | LIGHT_WING |
| Cabin light | MEDIUM | ❌ | LIGHT_CABIN |
| Panel light | MEDIUM | ❌ | LIGHT_PANEL |
| Recognition light | LOW | ❌ | LIGHT_RECOGNITION |
| Ice light | LOW | ❌ | LIGHT_DEICE |
| **Trim Controls** | | |
| Aileron trim | HIGH | ❌ | AILERON_TRIM_SET |
| Elevator trim | HIGH | ❌ | ELEVATOR_TRIM_SET |
| Rudder trim | HIGH | ❌ | RUDDER_TRIM_SET |
| **Engine Systems** | | |
| Cowl flaps | MEDIUM | ❌ | COWL_FLAPS_SET |
| Carb heat | MEDIUM | ❌ | CARB_HEAT_TOGGLE |
| Pitot heat | HIGH | ❌ | PITOT_HEAT_TOGGLE |
| **Doors** | | |
| Main door | MEDIUM | ❌ | TOGGLE_AIRCRAFT_EXIT |
| Cargo doors | LOW | ❌ | Aircraft-specific |
| **Electrical** | | |
| Battery master | HIGH | ❌ | TOGGLE_MASTER_BATTERY |
| Alternator | HIGH | ❌ | TOGGLE_MASTER_ALTERNATOR |
| Avionics master | HIGH | ❌ | TOGGLE_AVIONICS_MASTER |

**Phase 2 Deliverables:**
- [ ] Additional lights widget section
- [ ] Trim controls widget section
- [ ] Electrical systems widget
- [ ] Door controls (basic)

---

### Phase 3: Radio & Navigation
**Timeline:** Est. 2-3 weeks after Phase 2

| Feature | Priority | SimVar/Event |
|---------|----------|--------------|
| COM1 active/standby | HIGH | COM_RADIO_SET, COM_STBY_RADIO_SET |
| COM2 active/standby | HIGH | COM2_RADIO_SET, COM2_STBY_RADIO_SET |
| NAV1 active/standby | HIGH | NAV1_RADIO_SET, NAV1_STBY_SET |
| NAV2 active/standby | HIGH | NAV2_RADIO_SET, NAV2_STBY_SET |
| ADF frequency | MEDIUM | ADF_SET |
| Transponder code | HIGH | XPNDR_SET |
| Transponder mode | HIGH | XPNDR_MODE_SET |
| DME | LOW | - |

**Phase 3 Deliverables:**
- [ ] Radio Stack widget
- [ ] Transponder widget
- [ ] Frequency swap buttons

---

### Phase 4: Information & HUD
**Timeline:** Est. 2 weeks after Phase 3

| Feature | Priority | Notes |
|---------|----------|-------|
| Instrument overlays | MEDIUM | PFD-style tape displays |
| G-force display | LOW | A:G FORCE |
| Wind vector | MEDIUM | A:AMBIENT WIND VELOCITY |
| Control input viz | MEDIUM | Real-time aileron/elevator/rudder |
| Altitude tape | MEDIUM | Vertical scrolling display |
| Speed tape | MEDIUM | IAS indicator |

---

### Phase 5: Environment
**Timeline:** Est. 1-2 weeks after Phase 4

| Feature | Priority | SimVar/Event |
|---------|----------|--------------|
| Time of day | MEDIUM | LOCAL_TIME_SET |
| Time multiplier | LOW | SIM_RATE_SET |
| Weather presets | LOW | Limited SimConnect support |
| Position teleport | LOW | WORLD_POSITION_SET |

---

### Phase 6: Advanced (Optional)
**Timeline:** Backlog

| Feature | Priority | Notes |
|---------|----------|-------|
| MSFS panel launcher | LOW | Open G1000, etc. |
| Interaction wheel | LOW | Flow Pro signature feature |
| Otto search bar | LOW | Quick command search |
| Plugin system | LOW | Third-party widgets |

---

## High Priority Items (Now)

### 1. AxisPad MSFS Testing
**Status:** Component built, needs validation  
**Task:** Test aileron/elevator control in MSFS  
**Risk:** May need sensitivity/deadzone tuning

### 2. Smart Installer / First-Run Wizard
**Status:** Not started  
**Components:**
- [ ] MSFS version detection (2020 vs 2024)
- [ ] ChasePlane detection
- [ ] AutoHotKey detection
- [ ] Keybinding configuration questionnaire
- [ ] Auto-start preference
- [ ] Save to config.json

### 3. Camera Controls Without ChasePlane
**Status:** Not tested  
**Task:** Verify native MSFS camera keybinds work  
**Risk:** Different key mappings needed

---

## Medium Priority Items

### ChasePlane Direct API
**Goal:** Replace AHK helper with WebSocket API  
**Status:** Port 42042 discovered, read-only confirmed  
**Next:** Investigate alternative control methods

### Status Endpoint Enhancement
**Goal:** Add AHK helper status to /api/status  
**Task:** Include camera system state in health check

### Documentation Updates
- [ ] Troubleshooting guide for camera controls
- [ ] Widget development tutorial video
- [ ] MSFS SDK event reference expansion

---

## Technical Debt

| Item | Severity | Notes |
|------|----------|-------|
| Port inconsistency (8080 vs 8484) | LOW | CLAUDE.md says 8484, server uses 8080 |
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
| Harold-PC | 192.168.1.42 | MSFS + Server | ✅ Active |
| Morpu-PC | 192.168.1.97 | Development | ✅ Active |

**Access:** `net use H: \\192.168.1.42\DevClaude`  
**Server:** `http://192.168.1.42:8080`

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
