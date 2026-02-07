# SimGlass Catalog

> **54 widgets** for Microsoft Flight Simulator 2024

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
| 🛫 **Autopilot** | Autopilot control panel | `/ui/autopilot/` |
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
| 🌤️ **METAR** | METAR decoder | `/ui/metar-widget/` |
| 🌤️ **Environment** | Time & weather control | `/ui/environment/` |

## Communication Widgets

| Widget | Description | Path |
|--------|-------------|------|
| 📻 **Radio Stack** | COM/NAV frequencies | `/ui/radio-stack/` |
| 📡 **ATC Comm** | ATC phrases & TTS | `/ui/atc-widget/` |
| 👥 **Multiplayer** | VATSIM/IVAO traffic | `/ui/multiplayer-widget/` |
| ✈️ **Traffic** | Aircraft traffic display | `/ui/traffic-widget/` |
| 🎙️ **Voice Stress** | Voice stress analyzer | `/ui/voice-stress/` |

## Performance & Monitoring

| Widget | Description | Path |
|--------|-------------|------|
| 📊 **Flight Data** | Altitude, speed, heading | `/ui/flight-data-widget/` |
| 📈 **Performance** | FPS, GPU, CPU stats | `/ui/performance-widget/` |
| ⚡ **Performance Monitor** | Real-time system health, WebSocket latency, error tracking | `/ui/performance-monitor/` |
| 🔧 **Engine Monitor** | Engine parameters display | `/ui/engine-monitor/` |
| ❤️ **Health Dashboard** | Aircraft systems health | `/ui/health-dashboard/` |
| 🛬 **Landing Rate** | Touchdown grading | `/ui/landing-widget/` |
| ⛽ **Fuel** | Fuel management | `/ui/fuel-widget/` |
| 🛢️ **Fuel Monitor** | Real-time fuel monitoring | `/ui/fuel-monitor/` |
| 🛢️ **Fuel Planner** | Trip fuel calculator | `/ui/fuel-planner/` |
| ⚠️ **Failures** | Aircraft failure scenarios | `/ui/failures-widget/` |
| ⚖️ **Weight & Balance** | CG calculator | `/ui/weight-balance/` |

## Utility Widgets

| Widget | Description | Path |
|--------|-------------|------|
| ✅ **Checklist** | Aircraft checklists | `/ui/checklist-widget/` |
| 📝 **Checklist Maker** | Create custom checklists | `/ui/checklist-maker/` |
| ⏱️ **Timer** | Stopwatch/countdown | `/ui/timer-widget/` |
| 📝 **Notepad** | Quick notes | `/ui/notepad-widget/` |
| 📒 **Kneeboard** | Reference info | `/ui/kneeboard-widget/` |
| 📓 **Flight Log** | Auto flight logging | `/ui/flightlog-widget/` |
| 📓 **Flight Log (Legacy)** | Legacy flight log | `/ui/flight-log/` |
| 🎬 **Flight Recorder** | Record/replay | `/ui/flight-recorder/` |
| 📹 **Replay Debrief** | Flight replay & analysis | `/ui/replay-debrief/` |
| 🎥 **Video Viewer** | Video playback | `/ui/video-viewer/` |

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
| 🔍 **Otto Search** | Quick widget search | `/ui/otto-search/` |
| 🖥️ **Services Panel** | System status | `/ui/services-panel/` |
| 🎬 **WASM Camera** | Custom cameras | `/ui/wasm-camera/` |
| 🧩 **Tiny Widgets** | Compact widget collection | `/ui/tinywidgets/` |

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

- ✅ 54 widgets
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

Generated: 2026-02-07
