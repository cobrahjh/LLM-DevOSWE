/**
 * Default Voice Commands for SimGlass Voice Control
 * Loaded on-demand when no custom commands are saved
 * DEFAULT_VOICE_COMMANDS is consumed by VoiceControlPane
 */

// eslint-disable-next-line no-unused-vars
const DEFAULT_VOICE_COMMANDS = [
    // Camera commands
    { phrase: 'cockpit view', action: 'keymap', category: 'camera', id: 'cockpitVFR', description: 'Switch to cockpit' },
    { phrase: 'external view', action: 'keymap', category: 'camera', id: 'externalClose', description: 'External camera' },
    { phrase: 'drone view', action: 'keymap', category: 'camera', id: 'drone', description: 'Drone camera' },
    { phrase: 'zoom in', action: 'keymap', category: 'camera', id: 'zoomIn', description: 'Zoom in' },
    { phrase: 'zoom out', action: 'keymap', category: 'camera', id: 'zoomOut', description: 'Zoom out' },

    // Lights
    { phrase: 'landing lights', action: 'keymap', category: 'lights', id: 'landing', description: 'Toggle landing lights' },
    { phrase: 'nav lights', action: 'keymap', category: 'lights', id: 'nav', description: 'Toggle nav lights' },
    { phrase: 'strobe lights', action: 'keymap', category: 'lights', id: 'strobes', description: 'Toggle strobes' },
    { phrase: 'beacon', action: 'keymap', category: 'lights', id: 'beacon', description: 'Toggle beacon' },
    { phrase: 'all lights on', action: 'keymap', category: 'lights', id: 'allOn', description: 'All lights on' },
    { phrase: 'all lights off', action: 'keymap', category: 'lights', id: 'allOff', description: 'All lights off' },

    // Aircraft controls
    { phrase: 'gear up', action: 'command', command: 'GEAR_UP', description: 'Retract gear' },
    { phrase: 'gear down', action: 'command', command: 'GEAR_DOWN', description: 'Extend gear' },
    { phrase: 'flaps up', action: 'command', command: 'FLAPS_UP', description: 'Flaps up' },
    { phrase: 'flaps down', action: 'command', command: 'FLAPS_DOWN', description: 'Flaps down' },
    { phrase: 'autopilot', action: 'command', command: 'AP_MASTER', description: 'Toggle autopilot' },
    { phrase: 'parking brake', action: 'command', command: 'PARKING_BRAKES', description: 'Toggle parking brake' },

    // Fuel
    { phrase: 'fill fuel', action: 'fuel', fuelAction: 'setPercent', percent: 100, description: 'Fill all tanks' },
    { phrase: 'half fuel', action: 'fuel', fuelAction: 'setPercent', percent: 50, description: '50% fuel' },

    // Custom/utility
    { phrase: 'take screenshot', action: 'key', key: 'F12', description: 'Screenshot' },
    { phrase: 'pause', action: 'key', key: 'P', description: 'Pause simulation' },

    // Checklist commands (hands-free)
    { phrase: 'check', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'checked', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'next item', action: 'checklist', checklistAction: 'checkNext', description: 'Check next item' },
    { phrase: 'uncheck', action: 'checklist', checklistAction: 'uncheckLast', description: 'Uncheck last item' },
    { phrase: 'reset checklist', action: 'checklist', checklistAction: 'reset', description: 'Reset current checklist' },
    { phrase: 'next checklist', action: 'checklist', checklistAction: 'nextChecklist', description: 'Go to next checklist' },
    { phrase: 'previous checklist', action: 'checklist', checklistAction: 'prevChecklist', description: 'Go to previous checklist' },
    { phrase: 'startup checklist', action: 'checklist', checklistAction: 'goto', target: 'startup', description: 'Go to startup checklist' },
    { phrase: 'taxi checklist', action: 'checklist', checklistAction: 'goto', target: 'taxi', description: 'Go to taxi checklist' },
    { phrase: 'takeoff checklist', action: 'checklist', checklistAction: 'goto', target: 'takeoff', description: 'Go to takeoff checklist' },
    { phrase: 'landing checklist', action: 'checklist', checklistAction: 'goto', target: 'landing', description: 'Go to landing checklist' },

    // Dashboard commands
    { phrase: 'show map', action: 'dashboard', layout: 'map-focus', description: 'Map focus layout' },
    { phrase: 'map focus', action: 'dashboard', layout: 'map-focus', description: 'Map focus layout' },
    { phrase: 'planning mode', action: 'dashboard', layout: 'planning', description: 'Planning layout' },
    { phrase: 'show planning', action: 'dashboard', layout: 'planning', description: 'Planning layout' },
    { phrase: 'enroute mode', action: 'dashboard', layout: 'enroute', description: 'Enroute layout' },
    { phrase: 'show enroute', action: 'dashboard', layout: 'enroute', description: 'Enroute layout' },
    { phrase: 'default layout', action: 'dashboard', layout: 'default', description: 'Default layout' },
    { phrase: 'fullscreen', action: 'dashboard', dashAction: 'fullscreen', description: 'Toggle fullscreen' },
    { phrase: 'open dashboard', action: 'dashboard', dashAction: 'open', description: 'Open flight dashboard' },

    // Glass commands
    { phrase: 'fetch weather', action: 'glass', glass: 'weather', widgetAction: 'fetch', description: 'Fetch weather' },
    { phrase: 'fetch simbrief', action: 'glass', glass: 'simbrief', widgetAction: 'fetch', description: 'Fetch SimBrief OFP' },
    { phrase: 'show charts', action: 'glass', glass: 'charts', widgetAction: 'open', description: 'Open charts glass' },
    { phrase: 'copy to notepad', action: 'glass', glass: 'notepad', widgetAction: 'copy', description: 'Copy to notepad' },

    // ATC commands
    { phrase: 'request taxi', action: 'atc', atcAction: 'request-taxi', description: 'Request taxi clearance' },
    { phrase: 'request taxi clearance', action: 'atc', atcAction: 'request-taxi', description: 'Request taxi clearance' },
    { phrase: 'ground request taxi', action: 'atc', atcAction: 'request-taxi', description: 'Request taxi clearance' },
    { phrase: 'read back', action: 'atc', atcAction: 'readback', description: 'Read back ATC clearance' },
    { phrase: 'readback', action: 'atc', atcAction: 'readback', description: 'Read back ATC clearance' },
    { phrase: 'ready for departure', action: 'atc', atcAction: 'report-ready', description: 'Report ready for departure' },
    { phrase: 'ready to go', action: 'atc', atcAction: 'report-ready', description: 'Report ready for departure' },
    { phrase: 'holding short', action: 'atc', atcAction: 'report-ready', description: 'Report holding short' },
    { phrase: 'request takeoff', action: 'atc', atcAction: 'request-takeoff', description: 'Request takeoff clearance' },
    { phrase: 'ready for takeoff', action: 'atc', atcAction: 'request-takeoff', description: 'Request takeoff clearance' },
    { phrase: 'roger', action: 'atc', atcAction: 'roger', description: 'Acknowledge ATC' },
    { phrase: 'wilco', action: 'atc', atcAction: 'wilco', description: 'Will comply with ATC' }
];
