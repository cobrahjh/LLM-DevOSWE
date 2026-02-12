/**
 * SimGlass Help Panel v1.0.0
 * Auto-creates ? button and help modal with widget-specific documentation.
 * Self-contained: injects its own CSS, button, and modal.
 * Include: <script src="/ui/shared/help-panel.js"></script>
 */
(function() {
    'use strict';

    // Detect widget from URL path
    const path = location.pathname;
    const match = path.match(/\/ui\/([^/]+)\//);
    const widgetId = match ? match[1] : 'unknown';

    // ===== HELP CONTENT REGISTRY =====
    const HELP = {
        'gtn750': {
            title: 'GTN750 GPS',
            desc: 'Full GPS navigation unit modeled after the Garmin GTN 750. Includes moving map, flight planning, radio management, and transponder control.',
            items: [
                'Map: Use range +/- buttons to zoom. Aircraft auto-centers.',
                'Direct-To: Press D\u2192 button, type waypoint ID, press ENTER.',
                'Flight Plan: FPL page builds multi-leg routes with waypoints.',
                'Frequencies: Tap COM/NAV frequency to swap active/standby.',
                'Transponder: Tap squawk code in top bar to open XPDR panel. Digits 0-7 only (octal). VFR quick-sets 1200.',
                'PROC: SIDs, STARs, and approaches for departure/destination.',
                'Terrain: Yellow = caution (within 1000ft), Red = warning (within 500ft).',
                'NRST: Nearest airports, VORs, NDBs, and intersections.',
                'CDI: Course deviation \u2014 toggle GPS/NAV source with CDI button.'
            ]
        },
        'autopilot': {
            title: 'Autopilot',
            desc: 'Full autopilot panel for heading, altitude, vertical speed, and airspeed hold. Includes NAV tracking and approach modes.',
            items: [
                'AP: Master engage/disengage. FD: Flight director. YD: Yaw damper.',
                'HDG: Heading hold. Use +/- to adjust heading bug. SYNC sets bug to current heading.',
                'ALT: Altitude hold. Use +/- to adjust target altitude.',
                'VS: Vertical speed hold. Positive = climb, negative = descent.',
                'IAS: Indicated airspeed hold.',
                'NAV: Track NAV1 VOR radial. APR: ILS approach mode. BC: Back course.',
                'Compact mode: Click toggle button for MCP strip layout.'
            ]
        },
        'autopilot-compact': {
            title: 'Autopilot Strip',
            desc: 'Compact MCP-style autopilot strip for minimal screen space.',
            items: [
                'Tap mode label (HDG/ALT/VS/IAS) to engage/disengage.',
                'Use +/- to adjust values.',
                'Tap AP to toggle master autopilot on/off.',
                'Bottom row: NAV, APR, BC, VNAV, FD, YD modes.'
            ]
        },
        'fuel-widget': {
            title: 'Fuel Management',
            desc: 'Monitor and control fuel tanks with flow rate and endurance calculations.',
            items: [
                'Gauge shows total fuel percentage across all tanks.',
                'Click individual tanks to select for add/remove operations.',
                'Add/Remove: Adjusts selected tank by 10 gallons.',
                'Fill/Empty: Sets all tanks to full or empty.',
                'Quick Presets: Set selected tank to 25%, 50%, 75%, or 100%.',
                'Endurance: Calculated from current fuel and flow rate.',
                'Compact mode shows fuel %, total, flow, endurance, and used.'
            ]
        },
        'fuel-monitor': {
            title: 'Fuel Monitor',
            desc: 'Simplified fuel display with tank levels and consumption tracking.',
            items: [
                'Shows real-time fuel quantity and flow rate.',
                'Tracks fuel used since session start.',
                'Displays estimated endurance from current consumption.',
                'Compact layout for cockpit overlay use.'
            ]
        },
        'engine-monitor': {
            title: 'Engine Monitor',
            desc: 'Engine instruments showing temperatures, pressures, and RPM.',
            items: [
                'RPM gauge with redline indicator.',
                'EGT/CHT: Exhaust gas and cylinder head temperatures.',
                'Oil: Temperature and pressure gauges.',
                'Fuel Flow: Current consumption in GPH.',
                'Updates at 10Hz for smooth gauge animation.'
            ]
        },
        'weather-widget': {
            title: 'Weather',
            desc: 'Current weather conditions at your aircraft position from MSFS.',
            items: [
                'Wind: Direction and speed with visual indicator.',
                'Temperature: Outside air temperature (OAT) in Celsius.',
                'Pressure: Altimeter setting in inHg.',
                'Visibility: Current visibility range in meters.',
                'Precipitation: Rain/snow state. Updates from MSFS weather engine.'
            ]
        },
        'metar-widget': {
            title: 'METAR',
            desc: 'Decoded METAR weather reports for any airport.',
            items: [
                'Enter ICAO code (e.g. KJFK) to fetch current METAR.',
                'Auto-decodes wind, visibility, clouds, temp, pressure.',
                'Color-coded flight categories: VFR / MVFR / IFR / LIFR.',
                'Saves recent airports for quick access.'
            ]
        },
        'radio-stack': {
            title: 'Radio Stack',
            desc: 'COM and NAV radio frequency management panel.',
            items: [
                'COM1/COM2: Shows active and standby frequencies.',
                'NAV1/NAV2: VOR/ILS navigation frequencies.',
                'Tap frequency pair to swap active and standby.',
                'Use +/- to tune the standby frequency.',
                'Transponder squawk code display.'
            ]
        },
        'checklist-widget': {
            title: 'Checklist',
            desc: 'Aircraft checklists with progress tracking and voice integration.',
            items: [
                'Select aircraft type to load appropriate checklists.',
                'Tap items to mark complete. Progress bar tracks completion.',
                'Categories: Preflight, Before Start, Taxi, Takeoff, Cruise, etc.',
                'Custom checklists from Checklist Maker sync automatically.',
                'Voice control can advance items when enabled.'
            ]
        },
        'checklist-maker': {
            title: 'Checklist Maker',
            desc: 'Create and edit custom aircraft checklists.',
            items: [
                'Create checklists for any aircraft type.',
                'Add categories and challenge/response items.',
                'Export/Import as JSON files.',
                'Custom checklists sync to the Checklist pane.'
            ]
        },
        'map-widget': {
            title: 'Map',
            desc: 'Moving map display centered on your aircraft.',
            items: [
                'Auto-centers on aircraft with heading-up orientation.',
                'Drag to pan (auto-recenters after 10 seconds).',
                'Buttons or pinch to zoom in/out.',
                'Shows flight plan route, waypoints, and airports.',
                'Track line shows recent flight path.'
            ]
        },
        'flightplan-widget': {
            title: 'Flight Plan',
            desc: 'Flight plan creation and route editing.',
            items: [
                'Enter departure and destination airports.',
                'Add waypoints: VORs, fixes, airports.',
                'Drag waypoints to reorder legs.',
                'Import from SimBrief for complete OFP.',
                'Shows leg distances and total route length.'
            ]
        },
        'traffic-widget': {
            title: 'Traffic Radar',
            desc: 'TCAS-style display showing nearby aircraft traffic.',
            items: [
                'White diamonds: Other traffic in range.',
                'Yellow circles: Traffic advisory (proximity alert).',
                'Red squares: Resolution advisory (collision risk).',
                'Altitude tags show +/- feet relative to you.',
                'Arrows indicate traffic climb/descent trend.'
            ]
        },
        'landing-widget': {
            title: 'Landing Rate',
            desc: 'Records and rates your landing touchdown.',
            items: [
                'Vertical speed at touchdown in FPM.',
                'Rating: Butter / Smooth / Firm / Hard.',
                'G-force measurement on touchdown.',
                'Records landing history with timestamps.',
                'Auto-detects touchdown (gear-on-ground transition).'
            ]
        },
        'camera-widget': {
            title: 'Camera Control',
            desc: 'Quick-access camera view control for MSFS.',
            items: [
                'Buttons for Cockpit, External, Drone, and Custom views.',
                'Smooth transitions between positions.',
                'Works with ChasePlane when detected.',
                'Save and recall custom camera positions.',
                'Key bindings configurable in Keymap Editor.'
            ]
        },
        'wasm-camera': {
            title: 'Cinematic Camera',
            desc: 'Advanced cinematic cameras: flyby, orbit, chase, and tower.',
            items: [
                'Flyby: Camera passes aircraft at set distance.',
                'Orbit: Camera circles aircraft smoothly.',
                'Chase: Dynamic follow camera with lag.',
                'Tower: Fixed ground-based tower view.',
                'Requires WASM module in MSFS Community folder.'
            ]
        },
        'copilot-widget': {
            title: 'AI Copilot',
            desc: 'LLM-powered copilot for procedures, advice, and flight assistance.',
            items: [
                'Ask about procedures, navigation, or checklists.',
                'Gets real-time context from your flight data.',
                'Suggests actions for weather, terrain, emergencies.',
                'Voice interaction when voice control is enabled.',
                'Type or speak your questions.'
            ]
        },
        'flight-instructor': {
            title: 'Flight Instructor',
            desc: 'AI training assistant with guided lessons and scoring.',
            items: [
                'Guided lessons: Takeoff, landing, navigation, patterns.',
                'Real-time feedback on aircraft control.',
                'Performance scoring against standards.',
                'Emergency procedures training.'
            ]
        },
        'voice-control': {
            title: 'Voice Control',
            desc: 'Control SimGlass with voice commands. 47 built-in commands.',
            items: [
                'Click mic button or say wake word to activate.',
                '47 built-in commands for common actions.',
                'Custom commands: Add your own voice triggers in settings.',
                'Works with checklist advancement and radio tuning.',
                'Browser microphone permission required.'
            ]
        },
        'voice-stress': {
            title: 'Voice Stress Analyzer',
            desc: 'Analyzes pilot voice for stress indicators during flight.',
            items: [
                'Monitors voice pitch, rate, and tremor.',
                'Stress level: Low / Medium / High.',
                'Records stress timeline for post-flight review.',
                'Requires microphone access.'
            ]
        },
        'notepad-widget': {
            title: 'Notepad',
            desc: 'Quick notes for clearances, frequencies, and reminders.',
            items: [
                'Type notes during flight \u2014 auto-saves.',
                'Great for ATC clearances and frequency scratchpad.',
                'Notes persist across browser sessions.',
                'Clear button to reset.'
            ]
        },
        'timer-widget': {
            title: 'Timer',
            desc: 'Countdown and stopwatch timers for flight operations.',
            items: [
                'Stopwatch: Count up from zero.',
                'Countdown: Set time and count down to zero.',
                'Useful for holding patterns, approaches, intervals.',
                'Audio alert when countdown reaches zero.'
            ]
        },
        'holding-calc': {
            title: 'Holding Calculator',
            desc: 'Calculate holding pattern entry type and timing.',
            items: [
                'Enter fix, inbound course, and turn direction.',
                'Calculates entry: Direct, Parallel, or Teardrop.',
                'Visual pattern diagram with your entry path.',
                'Wind correction for accurate tracking.',
                'Leg timing based on altitude.'
            ]
        },
        'charts-widget': {
            title: 'Charts',
            desc: 'View approach plates, SIDs, STARs, and airport diagrams.',
            items: [
                'Search by ICAO airport code.',
                'Pinch to zoom, drag to pan.',
                'Night mode for cockpit use.',
                'Geo-referenced: Aircraft position shown on chart.'
            ]
        },
        'navigraph-widget': {
            title: 'Navigraph Charts',
            desc: 'Navigraph subscription chart viewer.',
            items: [
                'Requires active Navigraph subscription.',
                'Full chart library: SIDs, STARs, approaches.',
                'Auto-loads charts for departure/destination.',
                'Pinch to zoom, drag to pan.'
            ]
        },
        'vatsim-live': {
            title: 'VATSIM Live',
            desc: 'Live VATSIM network data \u2014 active controllers and pilots.',
            items: [
                'Shows active ATC controllers and their coverage.',
                'Nearby pilot positions and callsigns.',
                'Controller frequency and ATIS information.',
                'Auto-updates from VATSIM data feed.'
            ]
        },
        'atc-widget': {
            title: 'ATC / Comms',
            desc: 'ATC communication helper with frequency lookup.',
            items: [
                'Common ATC phrases and readback templates.',
                'Nearby facility frequencies list.',
                'One-click tuning: Sets COM radio to selected frequency.',
                'ATIS, Ground, Tower, Approach, Center frequencies.'
            ]
        },
        'simbrief-widget': {
            title: 'SimBrief',
            desc: 'Import flight plans and OFP from your SimBrief account.',
            items: [
                'Import latest OFP from SimBrief.',
                'Shows route, fuel, weather, and NOTAMs.',
                'Send route to Flight Plan pane.',
                'Enter your SimBrief Pilot ID in settings.'
            ]
        },
        'flight-data-widget': {
            title: 'Flight Data',
            desc: 'Primary flight data: altitude, speed, heading, vertical speed, and position.',
            items: [
                'Altitude: MSL and AGL (above ground level).',
                'Speed: Indicated, true, and ground speed.',
                'Heading: Magnetic heading display.',
                'VS: Vertical speed in feet per minute.',
                'Position: Current latitude and longitude.',
                'Compact mode: Minimal display layout.'
            ]
        },
        'performance-widget': {
            title: 'Performance',
            desc: 'Aircraft performance data and V-speed reference.',
            items: [
                'V-speeds: Vso, Vs1, Vfe, Vno, Vne for current config.',
                'Density altitude calculation.',
                'True airspeed from IAS and altitude.',
                'Wind component: Headwind/crosswind calculator.'
            ]
        },
        'weight-balance': {
            title: 'Weight & Balance',
            desc: 'Aircraft weight and CG (center of gravity) calculator.',
            items: [
                'Enter passenger, cargo, and fuel weights.',
                'CG envelope diagram shows limits.',
                'Arm and moment calculations per station.',
                'Visual forward/aft CG limit indicator.'
            ]
        },
        'fuel-planner': {
            title: 'Fuel Planner',
            desc: 'Pre-flight fuel planning with reserves calculation.',
            items: [
                'Enter route distance and fuel burn rate.',
                'Calculates required fuel with reserves.',
                'Taxi, trip, alternate, reserve fuel breakdown.',
                'SimBrief integration for fuel recommendations.'
            ]
        },
        'flight-recorder': {
            title: 'Flight Recorder',
            desc: 'Record flight data for replay and analysis.',
            items: [
                'Records position, altitude, speed, and inputs.',
                'Start / Stop / Pause controls.',
                'Export recordings for sharing.',
                'Auto-record option starts on takeoff.'
            ]
        },
        'replay-debrief': {
            title: 'Flight Replay',
            desc: 'Replay recorded flights with data analysis.',
            items: [
                'Load recorded flight data.',
                'Playback: Play, Pause, Speed, Scrub timeline.',
                'Map overlay shows flight track.',
                'Data graphs: Altitude, speed, G-force over time.'
            ]
        },
        'flight-log': {
            title: 'Flight Log',
            desc: 'Automatic flight logging with hours and airports.',
            items: [
                'Auto-logs departure, arrival, and flight time.',
                'Tracks total hours, landings, airports visited.',
                'Filter by date, aircraft, or airport.',
                'Export as CSV for logbook software.'
            ]
        },
        'flightlog-widget': {
            title: 'Flight Log',
            desc: 'View and manage flight log entries.',
            items: [
                'All logged flights with details.',
                'Sort by date, duration, or aircraft.',
                'Total hours and landings summary.',
                'Delete or edit entries.'
            ]
        },
        'failures-widget': {
            title: 'Failures Monitor',
            desc: 'Trigger aircraft system failures for training scenarios.',
            items: [
                'Engine: Partial or complete power loss.',
                'Instruments: Vacuum, pitot, static failures.',
                'Electrical: Generator, battery, bus failures.',
                'Timed/Random mode for surprise failures.',
                'Reset All restores normal operations.'
            ]
        },
        'environment': {
            title: 'Environment',
            desc: 'Control MSFS environment: time, weather, and season.',
            items: [
                'Time of day: Set local or Zulu time.',
                'Weather presets: Clear, cloudy, rain, storm.',
                'Wind: Direction, speed, and gusts.',
                'Visibility and fog controls.'
            ]
        },
        'aircraft-control': {
            title: 'Aircraft Control',
            desc: 'Direct systems control: lights, doors, gear, and switches.',
            items: [
                'Lights: Nav, beacon, strobe, taxi, landing.',
                'Doors: Open/close cabin and cargo.',
                'Gear: Manual extend/retract.',
                'Flaps position control.',
                'Pitot heat, de-ice, parking brake.'
            ]
        },
        'cockpit-fx': {
            title: 'CockpitFX',
            desc: 'Audio and visual effects for immersive cockpit experience.',
            items: [
                'Engine sound enhancement and mixing.',
                'Wind, rain, and cabin ambiance audio.',
                'CABIN slider: Blend inside/outside sound.',
                'Grid layout for quick effect access.'
            ]
        },
        'video-viewer': {
            title: 'Video Viewer',
            desc: 'Embed video content in your cockpit panel.',
            items: [
                'Enter URL to load video stream.',
                'Supports YouTube and direct video URLs.',
                'Resizable player. Picture-in-picture support.',
                'Watch tutorials during flights.'
            ]
        },
        'multiplayer-widget': {
            title: 'Multiplayer',
            desc: 'Track nearby multiplayer aircraft.',
            items: [
                'Shows other players in MSFS multiplayer.',
                'Distance and altitude of nearby aircraft.',
                'Callsign and aircraft type.',
                'Range filter to focus on closest traffic.'
            ]
        },
        'kneeboard-widget': {
            title: 'Kneeboard',
            desc: 'Digital kneeboard for charts, notes, and references.',
            items: [
                'Load PDF charts and documents.',
                'Multi-page navigation with thumbnails.',
                'Zoom and pan. Quick-access tabs.',
                'Markup tools for annotations.'
            ]
        },
        'mobile-companion': {
            title: 'SimGlass Mobile',
            desc: 'Access SimGlass panes from your phone or tablet.',
            items: [
                'Open any pane on your mobile device.',
                'Connect via local network to SimGlass server.',
                'Touch-optimized controls.',
                'Quick launch grid for favorite panes.'
            ]
        },
        'ai-autopilot': {
            title: 'AI Autopilot',
            desc: 'LLM-powered autopilot with terrain awareness and procedure following.',
            items: [
                'Set destination \u2014 AI flies the entire route.',
                'Terrain avoidance: Auto-climbs when terrain ahead.',
                'Look-ahead checks at 2nm, 5nm, and 10nm.',
                'Speed management for climb, cruise, and descent.',
                'Manual override: Take control at any time.',
                'Status display shows AI decision reasoning.'
            ]
        },
        'dashboard': {
            title: 'Dashboard',
            desc: 'Main SimGlass overview with quick access to all panes.',
            items: [
                'Grid of all available panes.',
                'System status: SimConnect, server, services.',
                'Click to open panes in new windows.',
                'Search and filter panes by name.'
            ]
        },
        'flight-dashboard': {
            title: 'Flight Dashboard',
            desc: 'At-a-glance flight overview with key instruments.',
            items: [
                'Combined view of essential flight data.',
                'Altitude, speed, heading, VS displays.',
                'Fuel status and nav information.',
                'Designed for second-screen monitoring.'
            ]
        },
        'health-dashboard': {
            title: 'System Health',
            desc: 'Monitor SimGlass system and service status.',
            items: [
                'Service status for all running components.',
                'WebSocket and SimConnect health.',
                'Memory and resource usage.',
                'Error log viewer.'
            ]
        },
        'services-panel': {
            title: 'Services',
            desc: 'View and manage SimGlass backend services.',
            items: [
                'Start/Stop individual services.',
                'View logs and port information.',
                'Restart services when issues occur.'
            ]
        },
        'performance-monitor': {
            title: 'Performance Monitor',
            desc: 'System performance: FPS, latency, and resource usage.',
            items: [
                'Frame rate and WebSocket latency.',
                'Data update frequency monitoring.',
                'Browser memory usage.',
                'Identify bottlenecks.'
            ]
        },
        'plugin-manager': {
            title: 'Plugin Manager',
            desc: 'Manage SimGlass plugins and extensions.',
            items: [
                'View installed plugins.',
                'Enable/disable and configure plugins.',
                'Hot-reload without server restart.'
            ]
        },
        'keymap-editor': {
            title: 'Keymap Editor',
            desc: 'Customize keyboard shortcuts and camera key bindings.',
            items: [
                'View all current key bindings.',
                'Click a binding to reassign its key.',
                'Import/Export keymaps as JSON.',
                'Reset to defaults.'
            ]
        },
        'toolbar-panel': {
            title: 'Toolbar',
            desc: 'Quick-access toolbar for common actions.',
            items: [
                'Pin favorite actions for one-click access.',
                'Customizable button layout.',
                'Works as overlay on top of MSFS.'
            ]
        },
        'panel-launcher': {
            title: 'Panel Launcher',
            desc: 'Launch and arrange SimGlass panes.',
            items: [
                'Grid view of all available panes.',
                'Click to open in new window.',
                'Category filter and search.',
                'Recent panes for quick access.'
            ]
        },
        'tinywidgets': {
            title: 'TinyWidgets',
            desc: 'Mini widget collection for compact cockpit overlay.',
            items: [
                'Compact instruments for minimal screen space.',
                'Drag to position anywhere.',
                'Always-on-top mode.',
                'Choose which mini widgets to show.'
            ]
        },
        'interaction-wheel': {
            title: 'Interaction Wheel',
            desc: 'Radial menu for quick access to frequent actions.',
            items: [
                'Right-click or long-press to open.',
                'Customizable action segments.',
                'Touch-friendly radial design.'
            ]
        },
        'otto-search': {
            title: 'SimGlass Search',
            desc: 'Universal command search \u2014 find any SimGlass action.',
            items: [
                'Type to search all available commands.',
                'Execute actions directly from results.',
                'Searches panes, settings, and commands.'
            ]
        }
    };

    // Generic fallback for unknown widgets
    const GENERIC = {
        title: 'SimGlass',
        desc: 'SimGlass avionics pane for MSFS 2024.',
        items: [
            'Settings: Click the gear icon for settings and themes.',
            'Connection: Green dot = connected to MSFS data.',
            'Compact mode: Some panes support a compact toggle.',
            'Themes: Change appearance in Settings.',
            'Feedback: Report issues in Settings.'
        ]
    };

    // Resolve help content
    const help = HELP[widgetId] || {
        ...GENERIC,
        title: document.title.replace(/ - SimGlass.*$/i, '').replace(/SimGlass - /i, '').trim() || GENERIC.title
    };

    // ===== INJECT CSS =====
    const css = document.createElement('style');
    css.textContent = [
        '.help-btn{',
        '  position:fixed;top:6px;right:30px;z-index:9990;',
        '  width:22px;height:22px;border-radius:50%;',
        '  background:transparent;border:1.5px solid rgba(255,255,255,0.25);',
        '  color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;',
        '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
        '  transition:all 0.2s;padding:0;font-family:system-ui,sans-serif;',
        '  line-height:1;',
        '}',
        '.help-btn:hover{',
        '  border-color:rgba(255,255,255,0.6);color:rgba(255,255,255,0.9);',
        '  background:rgba(255,255,255,0.08);',
        '}',
        '.help-overlay{',
        '  position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;',
        '  display:flex;align-items:center;justify-content:center;',
        '  background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);',
        '}',
        '.help-overlay.hidden{display:none;}',
        '.help-dialog{',
        '  position:relative;',
        '  background:linear-gradient(180deg,#2a2a4a 0%,#1a1a2e 100%);',
        '  border:1px solid #3f3f46;border-radius:12px;',
        '  width:90%;max-width:480px;max-height:80vh;',
        '  overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);',
        '}',
        '.help-header{',
        '  display:flex;justify-content:space-between;align-items:center;',
        '  padding:14px 18px;border-bottom:1px solid #3f3f46;',
        '}',
        '.help-title{',
        '  font-size:15px;font-weight:600;color:#e0e0e0;',
        '  display:flex;align-items:center;gap:8px;',
        '}',
        '.help-title-icon{',
        '  width:22px;height:22px;border-radius:50%;',
        '  background:#3b82f6;color:#fff;font-size:13px;font-weight:700;',
        '  display:flex;align-items:center;justify-content:center;flex-shrink:0;',
        '}',
        '.help-close{',
        '  width:26px;height:26px;background:#3f3f46;border:none;',
        '  border-radius:6px;color:#a0a0a0;cursor:pointer;font-size:13px;',
        '  transition:all 0.2s;',
        '}',
        '.help-close:hover{background:#ef4444;color:#fff;}',
        '.help-body{',
        '  padding:16px 18px;overflow-y:auto;max-height:60vh;',
        '}',
        '.help-desc{',
        '  font-size:13px;color:#b0b0b0;line-height:1.5;',
        '  margin-bottom:14px;',
        '}',
        '.help-items{',
        '  list-style:none;margin:0;padding:0;',
        '}',
        '.help-items li{',
        '  font-size:12.5px;color:#d0d0d0;line-height:1.5;',
        '  padding:6px 0 6px 20px;position:relative;',
        '  border-bottom:1px solid rgba(255,255,255,0.04);',
        '}',
        '.help-items li:last-child{border-bottom:none;}',
        '.help-items li::before{',
        '  content:"\\2022";position:absolute;left:4px;',
        '  color:#3b82f6;font-size:14px;',
        '}',
        '.help-footer{',
        '  padding:10px 18px;border-top:1px solid #3f3f46;',
        '  font-size:11px;color:#606060;text-align:center;',
        '}'
    ].join('\n');
    document.head.appendChild(css);

    // ===== CREATE ? BUTTON =====
    const btn = document.createElement('button');
    btn.className = 'help-btn';
    btn.id = 'help-btn';
    btn.title = 'Help';
    btn.textContent = '?';

    // Position next to settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && settingsBtn.parentNode) {
        settingsBtn.parentNode.insertBefore(btn, settingsBtn);
    } else {
        // Fallback: insert at top of body
        document.body.insertBefore(btn, document.body.firstChild);
    }

    // ===== CREATE MODAL (LAZY) =====
    var overlay = null;

    function createOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'help-overlay hidden';
        overlay.innerHTML = [
            '<div class="help-dialog">',
            '  <div class="help-header">',
            '    <span class="help-title">',
            '      <span class="help-title-icon">?</span>',
            '      ' + escHtml(help.title),
            '    </span>',
            '    <button class="help-close" title="Close">\u2715</button>',
            '  </div>',
            '  <div class="help-body">',
            '    <div class="help-desc">' + escHtml(help.desc) + '</div>',
            '    <ul class="help-items">',
                   help.items.map(function(item) {
                       return '      <li>' + escHtml(item) + '</li>';
                   }).join('\n'),
            '    </ul>',
            '  </div>',
            '  <div class="help-footer">SimGlass Help \u00B7 Press Escape or click outside to close</div>',
            '</div>'
        ].join('\n');
        document.body.appendChild(overlay);

        // Close handlers
        overlay.querySelector('.help-close').addEventListener('click', closeHelp);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeHelp();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
                closeHelp();
            }
        });
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function openHelp() {
        if (!overlay) createOverlay();
        overlay.classList.remove('hidden');
    }

    function closeHelp() {
        if (overlay) overlay.classList.add('hidden');
    }

    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (overlay && !overlay.classList.contains('hidden')) {
            closeHelp();
        } else {
            openHelp();
        }
    });

    // ===== PUBLIC API =====
    window.SimGlassHelp = {
        open: openHelp,
        close: closeHelp,
        getWidgetId: function() { return widgetId; },
        getContent: function() { return help; }
    };

})();
