# SimWidget Hybrid - TODO List

## How to Use
- Add tasks below with `- [ ]` for uncomplete, `- [x]` for done
- Tell Claude "check todo" to review this list
- Priorities: 🔴 High | 🟡 Medium | 🟢 Low

---

## Current Tasks
- [x] 🔴 Test SimConnect integration with MSFS 2024 running ✅ 2026-01-05
- [x] 🔴 Test remote browser connection (Morpu-PC → Harold-PC) ✅ 2026-01-05
- [x] 🔴 Customize UI - add Autopilot section (AP on/off, HDG, ALT, VS, SPD) ✅ 2026-01-05
- [x] 🟡 Customize UI - add Fuel section ✅ 2026-01-05
- [x] 🟡 Add Throttle/Prop/Mixture lever controls ✅ 2026-01-05
- [x] 🟡 Add AP value sliders (HDG, ALT, VS, SPD direct set) ✅ 2026-01-05
- [x] 🟡 Add View Toggle button (I/E - Internal/External) ✅ 2026-01-05
- [x] 🟡 Add press-and-hold +/- buttons for AP values ✅ 2026-01-05
- [x] 🟡 Add Flight Controls (aileron, elevator, rudder sliders) ✅ 2026-01-05
- [x] 🟡 Add Camera buttons (TCM, NCV) ✅ 2026-01-05
- [x] 🟡 Add GPS coordinates display (lat/lon) ✅ 2026-01-23
- [ ] 🟢 Deploy to MSFS toolbar panel for fullscreen use
- [ ] 🟢 Add more light controls (panel, logo, recognition)
- [x] ✅ Keymap editor widget (remap keys via UI) - DONE
- [ ] 🟢 Revisit ChasePlane support (vJoy caused input conflicts)
- [x] 🔴 Disable directory listing in server.js for production (security) ✅ 2026-01-23

---

## Completed
- [x] 🔴 Create hybrid development architecture
  - Backend server (Node.js + Express + WebSocket)
  - Shared UI (HTML/CSS/JS works in browser & panel)
  - Dual-PC setup (Harold-PC dev, Morpu-PC testing)
  - Google Drive sync for file sharing
- [x] 🔴 Setup mock data mode for UI development
  - Generates fake flight data when MSFS not running
  - Allows rapid UI iteration without simulator
- [x] 🔴 Configure remote network access
  - Server binds to 0.0.0.0 for LAN access
  - Harold-PC: 192.168.1.42:8080
  - Morpu-PC connects via browser
- [x] 🟡 Install node-simconnect package
- [x] 🟡 Create start-server.bat and run-server.bat scripts
- [x] 🟡 Update README with dual-PC documentation

---

## Ideas / Future Features
- [x] Autopilot controls (AP on/off, ALT hold, HDG hold, VS, SPD) ✅ Done
- [x] Fuel management display ✅ Done (fuel-widget)
- [x] Radio stack (COM1/2, NAV1/2, transponder) ✅ Done (radio-stack)
- [x] Flight plan display ✅ Done (flightplan-widget)
- [x] Weather/METAR widget ✅ Done (weather-widget)
- [x] AI Co-Pilot integration ✅ Done (copilot-widget)
- [x] Voice commands ✅ Done (voice-control widget)
- [x] Mobile companion view ✅ Done (mobile.css responsive)
- [x] Multiple aircraft profiles ✅ Done (checklist-widget)

---

## Architecture Reference

```
Harold-PC (192.168.1.42)          Morpu-PC (192.168.1.97)
┌────────────────────┐            ┌────────────────────┐
│  MSFS 2024         │            │  Browser           │
│  ↓                 │            │  http://192.168.1.42:8080
│  SimConnect        │            │                    │
│  ↓                 │            │                    │
│  Backend Server    │◄──────────►│  WebSocket Client  │
│  :8080             │  Network   │                    │
└────────────────────┘            └────────────────────┘
```

---

## Quick Commands

**Start server (Harold-PC):**
```
"C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\start-server.bat"
```

**Browser URL (Morpu-PC):**
```
http://192.168.1.42:8080
```

**Kill server:**
```
taskkill /F /IM node.exe
```

**Allow firewall (Admin PowerShell on Harold-PC):**
```
netsh advfirewall firewall add rule name="SimWidget Backend" dir=in action=allow protocol=tcp localport=8080
```

---

## Notes
**Dual-PC Development Workflow:**
1. Edit files on Harold-PC (Claude AI or manually)
2. Files sync to Morpu-PC via Google Drive
3. Refresh browser on Morpu-PC to see changes
4. No MSFS SDK rebuilds needed!

**SimConnect Status:**
- Uses node-simconnect package
- Protocol.KittyHawk for MSFS 2024
- Falls back to mock mode if MSFS not running

**Claude checks this file automatically between steps during long tasks.**
You can add items anytime - even while Claude is working!
