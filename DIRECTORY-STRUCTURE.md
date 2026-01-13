# SimWidget Engine - Directory Structure
**Version:** 2.0.0  
**Last Updated:** 2025-01-10

## Top-Level Structure

```
C:\LLM-DevOSWE\SimWidget_Engine\
│
├── 📄 Core Documentation
│   ├── CLAUDE.md                   # Project overview for Claude AI
│   ├── STANDARDS.md                # Coding standards & patterns
│   ├── TODO.md                     # Development roadmap
│   ├── README.md                   # Project readme
│   ├── ARCHITECTURE.md             # System architecture
│   ├── GETTING-STARTED.md          # Setup guide
│   ├── PROJECT-PLAN.md             # Project planning
│   ├── RESOURCES.md                # External resources
│   └── DOCUMENTATION-INDEX.md      # Doc navigation
│
├── 📁 Admin/                       # ⭐ Services & Admin Tools
├── 📁 docs/                        # Extended documentation
├── 📁 simwidget-hybrid/            # ⭐ MAIN APPLICATION
├── 📁 tests/                       # Test framework
├── 📁 tools/                       # Utility scripts
├── 📁 templates/                   # Widget templates
├── 📁 data/                        # Databases (FSUIPC, SimVars)
├── 📁 wasm-camera/                 # ⭐ WASM Camera Module
├── 📁 overlay/                     # Electron overlay
├── 📁 packages/                    # Reusable components
├── 📁 msfs-panel/                  # MSFS toolbar panel
├── 📁 KeySenderService/            # .NET TCP key sender
├── 📁 plugins/                     # Plugin system
└── 📁 shortcuts/                   # Keyboard shortcuts
```

## Admin/ - Services & Administration

```
Admin/
├── 📄 SERVICE-STANDARDS.md         # Service requirements spec
├── 📄 PM_Reference_Guide.md        # Project management guide
│
├── 📁 agent/                       # SimWidget Agent (port 8585)
│   ├── agent-server.js             # Main agent server
│   ├── service-manager.js          # Windows service mgmt
│   ├── 📁 agent-ui/                # Web UI
│   ├── 📁 daemon/                  # Daemon mode
│   └── 📁 tests/                   # Agent tests
│
├── 📁 orchestrator/                # Master O (port 8500)
│   ├── orchestrator.js             # Main orchestrator
│   └── 📁 daemon/                  # Daemon mode
│
├── 📁 remote-support/              # Remote Support (port 8590)
│   ├── service.js                  # Remote access service
│   └── 📁 daemon/                  # Daemon mode
│
├── 📁 relay/                       # Message relay service
├── 📁 config/                      # Shared configuration
├── 📁 shared/                      # Shared utilities
└── 📁 standards/                   # Standard definitions
```

## simwidget-hybrid/ - Main Application

```
simwidget-hybrid/
├── 📄 README.md
├── 📄 TODO.md
├── 📄 MSFS2024-REFERENCE.md
│
├── 📁 backend/                     # Node.js Server
│   ├── server.js                   # ⭐ Main server (port 8080)
│   ├── key-sender.js               # v3.0 Keymap & TCP keys
│   ├── camera-controller.js        # Camera control logic
│   ├── camera-system.js            # Camera abstraction
│   ├── wasm-camera-bridge.js       # WASM module bridge
│   ├── vjoy-controller.js          # vJoy emulation
│   ├── hot-reload.js               # Hot reload system
│   ├── component-markers.js        # Component markers
│   ├── cost-tracker.js             # API cost tracking
│   └── 📁 daemon/                  # Daemon mode
│
├── 📁 config/                      # Configuration
│   └── keymaps.json                # v3.0 GUID keymaps
│
├── 📁 shared-ui/                   # Shared frontend
│   └── flow-api.js                 # Flow Pro compatibility
│
└── 📁 ui/                          # Widget UIs
    ├── 📁 aircraft-control/        # Main control widget
    ├── 📁 camera-widget/           # Camera controls
    ├── 📁 flight-data-widget/      # Flight data display
    └── 📁 keymap-editor/           # Keymap config UI
```

## tests/ - Test Framework

```
tests/
├── 📄 README.md                    # Test framework docs
├── 📄 test-runner.js               # Main test runner
├── 📄 test-scheduler.js            # Scheduled testing
├── 📄 test-admin.js                # Admin service tests
├── 📄 test-db.js                   # Database tests
├── 📄 setup-supabase.js            # Cloud sync setup
├── 📄 supabase-schema.sql          # DB schema
│
├── 📁 suites/                      # Test suites
├── 📁 fixtures/                    # Test fixtures
├── 📁 results/                     # Test results
├── 📁 lib/                         # Test utilities
└── 📁 backups/                     # Backup test data
```

## docs/ - Extended Documentation

```
docs/
├── 📄 FLOW-PRO-REFERENCE.md        # Flow Pro API reference
├── 📄 COMPONENT-ARCHITECTURE.md    # Component design
├── 📄 COMPONENT-REGISTRY.md        # Component catalog
├── 📄 WIDGET-CREATION-GUIDE.md     # Widget tutorial
├── 📄 WIDGET-INVENTORY.md          # Widget list
├── 📄 SIMVARS-REFERENCE.md         # SimVar reference
├── 📄 SIMCONNECT_SIMVAR_WRITE_GUIDE.md
├── 📄 TINYWIDGET-ARCHITECTURE.md   # TinyWidget spec
├── 📄 ACCESSIBILITY-FRAMEWORK.md   # A11y guidelines
├── 📄 PLUGINS.md                   # Plugin system
├── 📄 WINDOWS-SERVICES.md          # Service deployment
├── 📄 TELEMETRY-DESIGN.md          # Telemetry system
├── 📄 TELEMETRY-SETUP.md           # Telemetry config
├── 📄 CHASEPLANE_VJOY_SETUP.md     # ChasePlane guide
├── 📄 MINIMUM-REQUIREMENTS.md      # System requirements
└── 📄 RESOURCES-DISCOVERY.md       # Resource guide
```

## wasm-camera/ - WASM Camera Module

```
wasm-camera/
├── 📄 README.md                    # Module documentation
├── 📄 SimWidgetCamera.sln          # VS solution
├── 📄 SimWidgetCamera.vcxproj      # VS project
├── 📄 module.xml                   # WASM manifest
├── 📄 build.bat                    # Build script
│
├── 📁 src/                         # C++ source
├── 📁 build/                       # Build output
└── 📁 package/                     # MSFS package
```

## tools/ - Utility Scripts

```
tools/
├── dll-inspector.js                # DLL analysis
├── dll-inspector.ps1               # PowerShell variant
├── doc-indexer.js                  # Doc indexing
├── find-sim-dlls.js                # Sim DLL finder
├── fsuipc-events-parser.js         # FSUIPC parser
├── lorby-aao-api.js                # Lorby API client
├── security-api.js                 # Security tools
├── security-inspector.js           # Security analysis
├── test-lorby-webapi.js            # Lorby tests
└── widget-validator.js             # Widget validation
```

## data/ - Databases

```
data/
├── fsuipc-events-full.json         # 21,296 FSUIPC events
├── fsuipc-events-index.json        # Event index
├── fsuipc-events-*.json            # Aircraft-specific events
├── simvar-database.json            # SimVar database
└── simvar-summary.json             # SimVar summary
```

## templates/ - Widget Templates

```
templates/
├── 📁 control-widget/              # Control widget template
├── 📁 display-widget/              # Display widget template
├── 📁 tool-widget/                 # Tool widget template
└── 📁 shared/                      # Shared template assets
```

## Key URLs (Server Running)

| Port | Service | URLs |
|------|---------|------|
| 8080 | Main Server | `/ui/aircraft-control/`, `/ui/camera-widget/`, `/ui/keymap-editor/` |
| 8500 | Master O | `/api/status`, `/api/services` |
| 8585 | Agent | `/api/status`, `/api/log` |
| 8590 | Remote | `/api/status`, `/api/support` |

## Startup Commands

| Command | Script |
|---------|--------|
| `sas` | Start all servers (8500, 8080, 8585, 8590) |
| `start` | Start SimWidget Engine (8080) |
| `start-all-servers.bat` | Batch all servers |
