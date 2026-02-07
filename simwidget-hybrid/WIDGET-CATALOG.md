# SimGlass Catalog

> **50+ widgets** for Microsoft Flight Simulator 2024

## Quick Start

```
http://localhost:8080           # Main dashboard
http://localhost:8080/ui/       # All widgets
Ctrl+K                          # Quick search
Ctrl+/                          # Keyboard shortcuts
```

---

## Flight Control Widgets

| Widget | Description | Path |
|--------|-------------|------|
| ✈️ **Aircraft Control** | Autopilot, throttle, lights, gear | `/ui/aircraft-control/` |
| 📷 **Camera** | Camera views, drone mode | `/ui/camera-widget/` |
| ⚙️ **Interaction Wheel** | Quick actions wheel | `/ui/interaction-wheel/` |
| 🎤 **Voice Control** | Speech commands | `/ui/voice-control/` |

## Navigation Widgets

| Widget | Description | Path |
|--------|-------------|------|
| 🗺️ **Map** | Live position tracking | `/ui/map-widget/` |
| 🛫 **Flight Plan** | Route management | `/ui/flightplan-widget/` |
| 📋 **SimBrief** | OFP import/display | `/ui/simbrief-widget/` |
| 🗺️ **GTN750** | Garmin GPS emulator | `/ui/gtn750/` |
| 📊 **Charts** | Free approach plates | `/ui/charts-widget/` |
| 🗺️ **Navigraph** | Navigraph charts | `/ui/navigraph-widget/` |
| 🔄 **Holding Calc** | Holding pattern entry | `/ui/holding-calc/` |

## Weather & Environment

| Widget | Description | Path |
|--------|-------------|------|
| 🌦️ **Weather** | METAR/TAF display | `/ui/weather-widget/` |
| 🌤️ **Environment** | Time & weather control | `/ui/environment/` |

## Communication Widgets

| Widget | Description | Path |
|--------|-------------|------|
| 📻 **Radio Stack** | COM/NAV frequencies | `/ui/radio-stack/` |
| 📡 **ATC Comm** | ATC phrases & TTS | `/ui/atc-widget/` |
| 👥 **Multiplayer** | VATSIM/IVAO traffic | `/ui/multiplayer-widget/` |

## Performance & Monitoring

| Widget | Description | Path |
|--------|-------------|------|
| 📊 **Flight Data** | Altitude, speed, heading | `/ui/flight-data-widget/` |
| 📈 **Performance** | FPS, GPU, CPU stats | `/ui/performance-widget/` |
| 🛬 **Landing Rate** | Touchdown grading | `/ui/landing-widget/` |
| ⛽ **Fuel** | Fuel management | `/ui/fuel-widget/` |
| 🛢️ **Fuel Planner** | Trip fuel calculator | `/ui/fuel-planner/` |
| ⚖️ **Weight & Balance** | CG calculator | `/ui/weight-balance/` |

## Utility Widgets

| Widget | Description | Path |
|--------|-------------|------|
| ✅ **Checklist** | Aircraft checklists | `/ui/checklist-widget/` |
| ⏱️ **Timer** | Stopwatch/countdown | `/ui/timer-widget/` |
| 📝 **Notepad** | Quick notes | `/ui/notepad-widget/` |
| 📒 **Kneeboard** | Reference info | `/ui/kneeboard-widget/` |
| 📓 **Flight Log** | Auto flight logging | `/ui/flightlog-widget/` |
| 🎬 **Flight Recorder** | Record/replay | `/ui/flight-recorder/` |

## AI & Assistance

| Widget | Description | Path |
|--------|-------------|------|
| 🧑‍✈️ **AI Copilot** | Voice assistant | `/ui/copilot-widget/` |
| 👨‍🏫 **Flight Instructor** | Real-time coaching | `/ui/flight-instructor/` |

## Tools & Configuration

| Widget | Description | Path |
|--------|-------------|------|
| ⌨️ **Keymap Editor** | Customize keybindings | `/ui/keymap-editor/` |
| 🔌 **Plugin Manager** | Manage plugins | `/ui/plugin-manager/` |
| 🖥️ **Services Panel** | System status | `/ui/services-panel/` |
| 🎬 **WASM Camera** | Custom cameras | `/ui/wasm-camera/` |

## Dashboards

| Widget | Description | Path |
|--------|-------------|------|
| 🎛️ **Widget Dashboard** | All widgets overview | `/ui/dashboard/` |
| 🎯 **Flight Dashboard** | Combined flight view | `/ui/flight-dashboard/` |
| 🎛️ **Toolbar Panel** | MSFS in-game panel | `/ui/toolbar-panel/` |
| 📱 **Mobile Companion** | Phone remote control | `/ui/mobile-companion/` |
| 🎛️ **Panel Launcher** | Quick launcher | `/ui/panel-launcher/` |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Quick search |
| `Ctrl+/` | Show all shortcuts |
| `Ctrl+1-5` | Open widget 1-5 |
| `Ctrl+Shift+T` | Toggle theme |
| `Ctrl+Shift+N` | Toggle night mode |
| `Escape` | Close dialogs |

---

## Themes

- **Default** - Dark blue
- **Cockpit** - Green aviation
- **Glass** - Modern avionics
- **Day** - Light mode
- **OLED** - True black
- **Sunset** - Warm night
- **Retro** - Amber CRT
- **High Contrast** - Accessibility

---

## Presets

Built-in presets:
- **VFR Flight** - Map, weather, checklist
- **IFR Flight** - Charts, flight plan, radio
- **Airliner** - SimBrief, performance
- **Training** - Instructor, kneeboard

Custom presets: Save via Settings > Backup & Restore

---

## Features

- ✅ 50+ widgets
- ✅ WebSocket real-time data
- ✅ SimConnect integration
- ✅ Mobile responsive
- ✅ PWA installable
- ✅ VATSIM/IVAO support
- ✅ Voice control
- ✅ Theme system
- ✅ Night mode auto-switch
- ✅ Widget presets
- ✅ Keyboard shortcuts
- ✅ Backup/restore

---

## API Endpoints

```
GET  /api/status         # Server status
GET  /api/health         # Health check
GET  /api/flightplan     # GPS flight plan
GET  /api/weather/metar/:icao
POST /api/simconnect/event
GET  /api/debug/camera
```

---

## Requirements

- Node.js 18+
- MSFS 2020/2024
- Chrome/Edge (recommended)

---

Generated: 2026-01-23
