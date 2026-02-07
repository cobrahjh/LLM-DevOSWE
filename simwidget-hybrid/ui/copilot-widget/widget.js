/**
 * AI Copilot Widget - SimWidget
 * Full-featured AI copilot for MSFS
 */

// Checklist data - Multiple aircraft profiles
const CHECKLISTS = {
    generic: {
        preflight: [
            { text: 'Battery', action: 'ON' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Flaps', action: 'UP' },
            { text: 'Parking Brake', action: 'SET' }
        ],
        startup: [
            { text: 'Mixture', action: 'RICH' },
            { text: 'Throttle', action: 'IDLE' },
            { text: 'Master', action: 'ON' },
            { text: 'Ignition', action: 'START' },
            { text: 'Oil Pressure', action: 'GREEN' }
        ],
        taxi: [
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Instruments', action: 'CHECK' },
            { text: 'Nav Lights', action: 'ON' }
        ],
        takeoff: [
            { text: 'Flaps', action: 'SET' },
            { text: 'Trim', action: 'SET' },
            { text: 'Transponder', action: 'ALT' },
            { text: 'Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Power', action: 'SET' },
            { text: 'Mixture', action: 'LEAN' }
        ],
        landing: [
            { text: 'Mixture', action: 'RICH' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'AS REQUIRED' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Mixture', action: 'CUTOFF' },
            { text: 'Master', action: 'OFF' }
        ]
    },
    c172: {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Master Switch', action: 'ON' },
            { text: 'Fuel Quantity', action: 'CHECK' },
            { text: 'Master Switch', action: 'OFF' },
            { text: 'Fuel Selector', action: 'BOTH' }
        ],
        startup: [
            { text: 'Seats/Belts', action: 'SECURE' },
            { text: 'Circuit Breakers', action: 'IN' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Carb Heat', action: 'COLD' },
            { text: 'Master', action: 'ON' },
            { text: 'Beacon', action: 'ON' },
            { text: 'Prime', action: '3 STROKES' },
            { text: 'Ignition', action: 'START' },
            { text: 'Oil Pressure', action: 'GREEN' }
        ],
        taxi: [
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Heading Indicator', action: 'SET' },
            { text: 'Attitude', action: 'CHECK' }
        ],
        takeoff: [
            { text: 'Runup', action: 'COMPLETE' },
            { text: 'Flaps', action: '0-10°' },
            { text: 'Trim', action: 'TAKEOFF' },
            { text: 'Transponder', action: 'ALT' },
            { text: 'Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Power', action: '2300 RPM' },
            { text: 'Mixture', action: 'LEAN' },
            { text: 'Trim', action: 'ADJUST' }
        ],
        landing: [
            { text: 'ATIS', action: 'RECEIVED' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Carb Heat', action: 'ON' },
            { text: 'Flaps', action: 'AS REQUIRED' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Avionics', action: 'OFF' },
            { text: 'Mixture', action: 'CUTOFF' },
            { text: 'Ignition', action: 'OFF' },
            { text: 'Master', action: 'OFF' }
        ]
    },
    c208: {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Battery', action: 'ON' },
            { text: 'Fuel Selector', action: 'ALL' },
            { text: 'Fuel Quantity', action: 'CHECK' },
            { text: 'Control Lock', action: 'REMOVE' }
        ],
        startup: [
            { text: 'Condition Lever', action: 'CUTOFF' },
            { text: 'Power Lever', action: 'IDLE' },
            { text: 'Propeller', action: 'HIGH RPM' },
            { text: 'Generator', action: 'RESET/ON' },
            { text: 'Ignition', action: 'ON' },
            { text: 'Starter', action: 'ENGAGE' },
            { text: 'Ng at 13%', action: 'CONDITION LOW IDLE' },
            { text: 'ITT', action: 'MONITOR' },
            { text: 'Oil Pressure', action: 'GREEN' }
        ],
        taxi: [
            { text: 'Flaps', action: '20°' },
            { text: 'Trims', action: 'SET' },
            { text: 'Flight Instruments', action: 'CHECK' },
            { text: 'Brakes', action: 'CHECK' }
        ],
        takeoff: [
            { text: 'Condition Lever', action: 'HIGH IDLE' },
            { text: 'Propeller', action: 'MAX' },
            { text: 'Power Lever', action: 'TAKEOFF' },
            { text: 'Airspeed', action: 'ALIVE' },
            { text: 'Rotate', action: '80 KIAS' }
        ],
        cruise: [
            { text: 'Power', action: 'SET' },
            { text: 'Propeller', action: 'ADJUST' },
            { text: 'Fuel Flow', action: 'MONITOR' }
        ],
        landing: [
            { text: 'ATIS', action: 'RECEIVED' },
            { text: 'Flaps', action: 'AS REQUIRED' },
            { text: 'Airspeed', action: '85-90 KIAS' },
            { text: 'Propeller', action: 'HIGH RPM' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Condition Lever', action: 'CUTOFF' },
            { text: 'Generator', action: 'OFF' },
            { text: 'Battery', action: 'OFF' }
        ]
    },
    tbm930: {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Source Selector', action: 'BATT' },
            { text: 'Battery', action: 'ON' },
            { text: 'Fuel Quantity', action: 'CHECK' },
            { text: 'CAS Messages', action: 'CHECK' }
        ],
        startup: [
            { text: 'Throttle', action: 'CUT OFF' },
            { text: 'Aux BP', action: 'ON' },
            { text: 'Ignition', action: 'AUTO' },
            { text: 'Starter', action: 'ON' },
            { text: 'Ng 13%', action: 'THROTTLE LO IDLE' },
            { text: 'ITT/Ng/Oil', action: 'MONITOR' },
            { text: 'Ng 50%', action: 'STARTER OFF' },
            { text: 'Generator', action: 'MAIN' },
            { text: 'Aux BP', action: 'OFF' }
        ],
        taxi: [
            { text: 'Flaps', action: 'T/O' },
            { text: 'Trims', action: 'SET' },
            { text: 'AP/Trims', action: 'TEST' },
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Pressurization', action: 'CHECK' }
        ],
        takeoff: [
            { text: 'Inertial Sep', action: 'ON' },
            { text: 'A/C', action: 'OFF' },
            { text: 'Throttle', action: 'T/O' },
            { text: 'Rotate', action: '90 KIAS' },
            { text: 'Positive Climb', action: 'GEAR UP' }
        ],
        cruise: [
            { text: 'Power', action: 'SET' },
            { text: 'Pressurization', action: 'CHECK' },
            { text: 'Fuel Balance', action: 'CHECK' },
            { text: 'A/C', action: 'AS REQUIRED' }
        ],
        landing: [
            { text: 'Approach Brief', action: 'COMPLETE' },
            { text: 'Inertial Sep', action: 'ON' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'LAND' },
            { text: 'Speed', action: '85 KIAS' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Throttle', action: 'CUT OFF' },
            { text: 'Generator', action: 'OFF' },
            { text: 'Source', action: 'OFF' },
            { text: 'Battery', action: 'OFF' }
        ]
    },
    cj4: {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Battery', action: 'ON' },
            { text: 'Emergency Lights', action: 'ARM' },
            { text: 'Fuel Quantity', action: 'CHECK' },
            { text: 'EICAS', action: 'CHECK' }
        ],
        startup: [
            { text: 'Beacon', action: 'ON' },
            { text: 'Throttle L', action: 'IDLE' },
            { text: 'Engine L Start', action: 'PUSH' },
            { text: 'N2 > 20%', action: 'FUEL ON' },
            { text: 'ITT Rise', action: 'MONITOR' },
            { text: 'Throttle R', action: 'IDLE' },
            { text: 'Engine R Start', action: 'PUSH' },
            { text: 'Generators', action: 'ON' }
        ],
        taxi: [
            { text: 'Flaps', action: '15°' },
            { text: 'Speedbrakes', action: 'RETRACT' },
            { text: 'Trims', action: 'SET' },
            { text: 'Flight Controls', action: 'CHECK' },
            { text: 'Transponder', action: 'ON' }
        ],
        takeoff: [
            { text: 'Takeoff Config', action: 'CHECK' },
            { text: 'Throttle', action: 'T/O' },
            { text: 'V1', action: 'CALL' },
            { text: 'Rotate', action: 'Vr' },
            { text: 'Positive Rate', action: 'GEAR UP' },
            { text: 'V2', action: 'CALL' }
        ],
        cruise: [
            { text: 'Thrust', action: 'CRUISE' },
            { text: 'Pressurization', action: 'CHECK' },
            { text: 'Fuel Balance', action: 'MONITOR' },
            { text: 'Autopilot', action: 'ENGAGE' }
        ],
        landing: [
            { text: 'Approach Briefing', action: 'COMPLETE' },
            { text: 'Speedbrakes', action: 'ARM' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: '35°' },
            { text: 'Speed', action: 'Vref + 5' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Throttles', action: 'CUTOFF' },
            { text: 'Generators', action: 'OFF' },
            { text: 'Battery', action: 'OFF' },
            { text: 'Emergency Lights', action: 'OFF' }
        ]
    },
    '737': {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Battery', action: 'ON' },
            { text: 'Emergency Exit Lights', action: 'ARM' },
            { text: 'IRS', action: 'NAV' },
            { text: 'MCP', action: 'SET' }
        ],
        startup: [
            { text: 'Beacon', action: 'ON' },
            { text: 'APU', action: 'START' },
            { text: 'APU Gen', action: 'ON' },
            { text: 'Engine 2', action: 'START' },
            { text: 'Engine 1', action: 'START' },
            { text: 'Generators', action: 'ON' },
            { text: 'APU', action: 'OFF' },
            { text: 'Packs', action: 'AUTO' }
        ],
        taxi: [
            { text: 'Flaps', action: 'SET' },
            { text: 'Flight Controls', action: 'CHECK' },
            { text: 'Trims', action: 'SET' },
            { text: 'Recall', action: 'CHECK' },
            { text: 'Transponder', action: 'TA/RA' }
        ],
        takeoff: [
            { text: 'Strobes', action: 'ON' },
            { text: 'Landing Lights', action: 'ON' },
            { text: 'TOGA', action: 'SET' },
            { text: '80 Knots', action: 'CALL' },
            { text: 'V1', action: 'CALL' },
            { text: 'Rotate', action: 'Vr' },
            { text: 'Positive Rate', action: 'GEAR UP' }
        ],
        cruise: [
            { text: 'Thrust', action: 'CRUISE' },
            { text: 'Landing Lights', action: 'OFF' },
            { text: 'Seat Belt Sign', action: 'AS REQ' },
            { text: 'Pressurization', action: 'CHECK' }
        ],
        landing: [
            { text: 'Approach Briefing', action: 'COMPLETE' },
            { text: 'Autobrake', action: 'SET' },
            { text: 'Speed Brake', action: 'ARM' },
            { text: 'Landing Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'LAND' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Thrust Levers', action: 'CUTOFF' },
            { text: 'Beacon', action: 'OFF' },
            { text: 'APU', action: 'START' },
            { text: 'Generators', action: 'OFF' },
            { text: 'IRS', action: 'OFF' }
        ]
    },
    a320: {
        preflight: [
            { text: 'Battery', action: 'ON' },
            { text: 'External Power', action: 'ON' },
            { text: 'APU', action: 'START' },
            { text: 'ADIRS', action: 'NAV' }
        ],
        startup: [
            { text: 'Beacon', action: 'ON' },
            { text: 'Engine Mode', action: 'IGN/START' },
            { text: 'Engine 2', action: 'START' },
            { text: 'Engine 1', action: 'START' },
            { text: 'APU', action: 'OFF' }
        ],
        taxi: [
            { text: 'Flight Controls', action: 'CHECK' },
            { text: 'Flaps', action: 'CONFIG 1+F' },
            { text: 'Auto Brake', action: 'MAX' }
        ],
        takeoff: [
            { text: 'Transponder', action: 'ON' },
            { text: 'TCAS', action: 'TA/RA' },
            { text: 'Strobe', action: 'ON' },
            { text: 'Landing Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Seat Belt Signs', action: 'AS REQ' },
            { text: 'Landing Lights', action: 'OFF' }
        ],
        landing: [
            { text: 'Auto Brake', action: 'SET' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'FULL' },
            { text: 'Spoilers', action: 'ARM' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Engine 1', action: 'OFF' },
            { text: 'Engine 2', action: 'OFF' },
            { text: 'Beacon', action: 'OFF' }
        ]
    }
};

// Emergency procedures
const EMERGENCY_PROCEDURES = {
    'engine-failure': {
        name: 'Engine Failure',
        critical: true,
        items: [
            { text: 'Airspeed', action: 'BEST GLIDE', critical: true },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Fuel Pump', action: 'ON' },
            { text: 'Ignition', action: 'BOTH/START' },
            { text: 'If no restart', action: 'LAND ASAP', critical: true },
            { text: 'Squawk', action: '7700' },
            { text: 'Mayday', action: 'DECLARE' }
        ]
    },
    'engine-fire': {
        name: 'Engine Fire',
        critical: true,
        items: [
            { text: 'Mixture', action: 'CUTOFF', critical: true },
            { text: 'Fuel Selector', action: 'OFF', critical: true },
            { text: 'Master', action: 'OFF', critical: true },
            { text: 'Cabin Heat/Air', action: 'OFF' },
            { text: 'Airspeed', action: '100 KIAS (SLIP)' },
            { text: 'Forced Landing', action: 'EXECUTE', critical: true },
            { text: 'Squawk', action: '7700' }
        ]
    },
    'electrical': {
        name: 'Electrical Failure',
        critical: false,
        items: [
            { text: 'Master', action: 'OFF THEN ON' },
            { text: 'Circuit Breakers', action: 'CHECK' },
            { text: 'Alternator', action: 'CHECK' },
            { text: 'Load Shed', action: 'NON-ESSENTIAL OFF' },
            { text: 'Battery', action: 'MONITOR' },
            { text: 'Land', action: 'NEAREST SUITABLE' }
        ]
    },
    'hydraulic': {
        name: 'Hydraulic Failure',
        critical: false,
        items: [
            { text: 'Hydraulic Pressure', action: 'CHECK' },
            { text: 'Alternate Gear', action: 'EXTEND' },
            { text: 'No Flaps Landing', action: 'CONSIDER' },
            { text: 'Approach Speed', action: 'INCREASE' },
            { text: 'Landing Distance', action: 'INCREASE' }
        ]
    },
    'pressurization': {
        name: 'Pressurization Failure',
        critical: true,
        items: [
            { text: 'Oxygen Masks', action: 'ON', critical: true },
            { text: 'Establish Comm', action: 'CREW' },
            { text: 'Emergency Descent', action: 'INITIATE', critical: true },
            { text: 'Squawk', action: '7700' },
            { text: 'Descend to', action: '10,000 FT OR MEA' },
            { text: 'Land', action: 'NEAREST SUITABLE' }
        ]
    },
    'ditching': {
        name: 'Ditching',
        critical: true,
        items: [
            { text: 'Squawk', action: '7700', critical: true },
            { text: 'Mayday', action: 'DECLARE' },
            { text: 'Passengers', action: 'BRIEF' },
            { text: 'Life Vests', action: 'DON' },
            { text: 'Flaps', action: 'FULL', critical: true },
            { text: 'Approach', action: 'INTO WIND/SWELL' },
            { text: 'Touchdown', action: 'TAIL LOW', critical: true },
            { text: 'Evacuate', action: 'IMMEDIATELY' }
        ]
    }
};

class AICopilot {
    constructor() {
        this.currentMode = 'assist';
        this.voiceEnabled = true;
        this.isListening = false;
        this.synth = window.speechSynthesis;
        this.recognition = null;
        this.ttsVoice = 'nova'; // OpenAI TTS voice
        this.useNaturalVoice = true; // Use OpenAI TTS when available
        this._ttsAudio = null; // Current playing audio

        // Flight data
        this.flightData = {
            altitude: 0,
            speed: 0,
            heading: 0,
            vspeed: 0,
            onGround: true,
            gearDown: true,
            flaps: 0
        };
        this.lastAltitudeCallout = 0;
        this.lastSpeedCallout = 0;

        // Checklist state
        this.checklistAircraft = 'generic';
        this.checklistPhase = 'preflight';
        this.checklistIndex = 0;
        this.checkedItems = [];
        this.autoRunning = false;

        // Callout settings
        this.callouts = {
            altitude: true,
            speed: true,
            approach: true,
            gear: true,
            flaps: true
        };

        // V-speeds
        this.vSpeeds = {
            vr: 55,
            v2: 62,
            vref: 65
        };

        // Approach callouts tracking
        this.approachCallouts = {
            lastAltCallout: 0,
            calledMinimums: false,
            calledDecision: false,
            decisionHeight: 200,
            minimums: 200
        };

        // Emergency state
        this.emergencyType = 'engine-failure';
        this.emergencyIndex = 0;
        this.emergencyChecked = [];
        this.emergencyAutoRunning = false;

        // ATIS data
        this.atisData = null;

        // LLM config
        this.llmEndpoint = '/api/copilot/chat';
        this.conversationHistory = [];
        this.copilotStatus = null;
        this.isStreaming = false;

        // Flight plan
        this.flightPlan = null;

        // Cross-widget communication
        this.syncChannel = new BroadcastChannel('simwidget-sync');
        this.initSyncListener();

        this.init();
    }

    initSyncListener() {
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'route-update':
                    this.flightPlan = data;
                    this.updateFlightPlanDisplay();
                    break;

                case 'position-update':
                    // Update flight data from map widget
                    if (data.altitude) this.flightData.altitude = data.altitude;
                    if (data.speed) this.flightData.speed = data.speed;
                    if (data.heading) this.flightData.heading = data.heading;
                    break;
            }
        };
    }

    updateFlightPlanDisplay() {
        if (!this.flightPlan) return;

        // Update status bar if we have departure/arrival
        const dep = this.flightPlan.departure || '----';
        const arr = this.flightPlan.arrival || '----';

        // Add message about flight plan
        if (this.flightPlan.waypoints && this.flightPlan.waypoints.length > 0) {
            const nextWp = this.flightPlan.nextWaypoint;
            if (nextWp) {
                this.addMessage(`Flight plan loaded: ${dep} to ${arr}. Next waypoint: ${nextWp.ident}, ${Math.round(nextWp.distance)} nm.`, 'copilot');
            }
        }
    }

    init() {
        this.initTabs();
        this.initAssistMode();
        this.initChecklistMode();
        this.initEmergencyMode();
        this.initATCMode();
        this.initATISDecoder();
        this.initAdvisorMode();
        this.initVoice();
        this.initWebSocket();
        this.loadSettings();
        this.initCopilotStatus();
    }

    // === Tab Navigation ===
    initTabs() {
        document.querySelectorAll('.copilot-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchMode(tab.dataset.mode);
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-mode="${mode}"]`).classList.add('active');

        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + mode).classList.add('active');
    }

    // === Assist Mode ===
    initAssistMode() {
        const input = document.getElementById('pilot-input');
        const sendBtn = document.getElementById('btn-send');

        sendBtn.addEventListener('click', () => this.handlePilotInput());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handlePilotInput();
        });
    }

    handlePilotInput() {
        const input = document.getElementById('pilot-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage(text, 'pilot');
        input.value = '';

        // Process command
        this.processCommand(text);
    }

    processCommand(text) {
        const lower = text.toLowerCase();

        // Checklist commands
        if (lower.includes('checklist') || lower.includes('check')) {
            if (lower.includes('startup') || lower.includes('start')) {
                this.startChecklist('startup');
                this.respond('Starting engine start checklist.');
            } else if (lower.includes('takeoff')) {
                this.startChecklist('takeoff');
                this.respond('Starting before takeoff checklist.');
            } else if (lower.includes('landing')) {
                this.startChecklist('landing');
                this.respond('Starting before landing checklist.');
            } else if (lower.includes('next') || lower === 'check') {
                this.checkNextItem();
            } else {
                this.respond('Which checklist? Say startup, takeoff, or landing.');
            }
            return;
        }

        // Flight info
        if (lower.includes('altitude') || lower.includes('how high')) {
            this.respond('Current altitude is ' + Math.round(this.flightData.altitude) + ' feet.');
            return;
        }

        if (lower.includes('speed') || lower.includes('how fast')) {
            this.respond('Current airspeed is ' + Math.round(this.flightData.speed) + ' knots.');
            return;
        }

        if (lower.includes('heading')) {
            this.respond('Current heading is ' + Math.round(this.flightData.heading) + ' degrees.');
            return;
        }

        // Gear reminder
        if (lower.includes('gear')) {
            const gearStatus = this.flightData.gearDown ? 'down' : 'up';
            this.respond('Gear is currently ' + gearStatus + '.');
            return;
        }

        // Emergency commands
        if (lower.includes('emergency') || lower.includes('mayday') || lower.includes('fire')) {
            if (lower.includes('engine') && lower.includes('fire')) {
                this.startEmergency('engine-fire');
                this.respond('Engine fire emergency. Starting procedure immediately.');
            } else if (lower.includes('engine')) {
                this.startEmergency('engine-failure');
                this.respond('Engine failure. Starting emergency procedure.');
            } else if (lower.includes('electrical')) {
                this.startEmergency('electrical');
                this.respond('Electrical emergency. Starting procedure.');
            } else {
                this.switchMode('emergency');
                this.respond('Emergency panel activated. Select the type of emergency.');
            }
            return;
        }

        // ATIS decode
        if (lower.includes('atis') || lower.includes('decode')) {
            this.switchMode('atc');
            this.respond('Ready to decode ATIS. Paste the ATIS text and click Decode.');
            return;
        }

        // LLM query for complex questions
        this.queryLLM(text);
    }

    async initCopilotStatus() {
        try {
            const res = await fetch('/api/copilot/status');
            if (res.ok) {
                this.copilotStatus = await res.json();
                if (this.copilotStatus.ttsVoice) this.ttsVoice = this.copilotStatus.ttsVoice;
                if (!this.copilotStatus.licensed || !this.copilotStatus.hasApiKey) {
                    this.showAIBanner();
                }
            }
        } catch (e) {
            // Server not available — non-LLM features still work
        }
    }

    showAIBanner() {
        const area = document.getElementById('message-area');
        const banner = document.createElement('div');
        banner.className = 'ai-unconfigured-banner';
        banner.innerHTML = '<strong>AI not configured</strong> — Open Settings to add your license key and API key. Checklists, emergencies, and ATIS work without AI.';
        banner.addEventListener('click', () => {
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn) settingsBtn.click();
        });
        area.parentElement.insertBefore(banner, area);
    }

    async queryLLM(question) {
        // Check if configured
        if (!this.copilotStatus || !this.copilotStatus.licensed || !this.copilotStatus.hasApiKey) {
            this.respond('AI is not configured. Open Settings > AI Copilot to add your license key and API key. I can still help with checklists, emergencies, and ATIS.');
            return;
        }

        if (this.isStreaming) return;
        this.isStreaming = true;
        this.updateStatus('Thinking...');

        // Add user message to history
        this.conversationHistory.push({ role: 'user', content: question });
        this.trimHistory();

        try {
            const response = await fetch(this.llmEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: question,
                    history: this.conversationHistory.slice(0, -1)
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                this.respond(err.error || 'LLM request failed. Check settings.');
                this.isStreaming = false;
                this.updateStatus('Standing by');
                return;
            }

            // Stream SSE response
            const msgEl = this.addStreamingMessage();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            fullText += data.chunk;
                            msgEl.querySelector('.msg-text').textContent = fullText;
                            const area = document.getElementById('message-area');
                            area.scrollTop = area.scrollHeight;
                        }
                        if (data.error) {
                            fullText += '\n[Error: ' + data.error + ']';
                            msgEl.querySelector('.msg-text').textContent = fullText;
                        }
                    } catch (e) { /* skip malformed */ }
                }
            }

            // Finalize
            msgEl.classList.remove('streaming');
            this.conversationHistory.push({ role: 'assistant', content: fullText });
            this.trimHistory();

            if (this.voiceEnabled && fullText) {
                this.speak(fullText.slice(0, 500));
            }
        } catch (e) {
            this.respond('Connection error. Check if the server is running.');
        }

        this.isStreaming = false;
        this.updateStatus('Standing by');
    }

    addStreamingMessage() {
        const area = document.getElementById('message-area');
        const msg = document.createElement('div');
        msg.className = 'message copilot streaming';
        const span = document.createElement('span');
        span.className = 'msg-text';
        msg.appendChild(span);
        area.appendChild(msg);
        area.scrollTop = area.scrollHeight;
        return msg;
    }

    trimHistory() {
        // Keep last 20 entries (10 pairs)
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    addMessage(text, sender) {
        const area = document.getElementById('message-area');
        const msg = document.createElement('div');
        msg.className = 'message ' + sender;
        const span = document.createElement('span');
        span.className = 'msg-text';
        span.textContent = text;
        msg.appendChild(span);
        area.appendChild(msg);
        area.scrollTop = area.scrollHeight;
    }

    respond(text) {
        this.addMessage(text, 'copilot');
        if (this.voiceEnabled) {
            this.speak(text);
        }
    }

    // === Checklist Mode ===
    initChecklistMode() {
        document.getElementById('checklist-aircraft').addEventListener('change', (e) => {
            this.checklistAircraft = e.target.value;
            this.renderChecklist();
        });

        document.getElementById('checklist-phase').addEventListener('change', (e) => {
            this.checklistPhase = e.target.value;
            this.checklistIndex = 0;
            this.checkedItems = [];
            this.renderChecklist();
        });

        document.getElementById('btn-checklist-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        document.getElementById('btn-checklist-auto').addEventListener('click', () => {
            this.toggleAutoRun();
        });

        this.renderChecklist();
    }

    renderChecklist() {
        const container = document.getElementById('checklist-items');
        container.replaceChildren();

        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            if (this.checkedItems.includes(index)) div.classList.add('checked');
            if (index === this.checklistIndex && !this.checkedItems.includes(index)) {
                div.classList.add('active');
            }

            const checkbox = document.createElement('div');
            checkbox.className = 'item-checkbox';

            const text = document.createElement('span');
            text.className = 'item-text';
            text.textContent = item.text;

            const action = document.createElement('span');
            action.className = 'item-action';
            action.textContent = item.action;

            div.appendChild(checkbox);
            div.appendChild(text);
            div.appendChild(action);

            div.addEventListener('click', () => {
                this.toggleChecklistItem(index);
            });

            container.appendChild(div);
        });
    }

    toggleChecklistItem(index) {
        const idx = this.checkedItems.indexOf(index);
        if (idx === -1) {
            this.checkedItems.push(index);
            const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
            if (this.voiceEnabled && items[index]) {
                this.speak(items[index].text + ', ' + items[index].action + ', check.');
            }
        } else {
            this.checkedItems.splice(idx, 1);
        }
        this.advanceChecklist();
        this.renderChecklist();
    }

    advanceChecklist() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
        // Find next unchecked
        for (let i = 0; i < items.length; i++) {
            if (!this.checkedItems.includes(i)) {
                this.checklistIndex = i;
                return;
            }
        }
        // All done
        this.checklistIndex = items.length;
        if (this.checkedItems.length === items.length && items.length > 0) {
            this.speak(this.checklistPhase + ' checklist complete.');
        }
    }

    checkNextItem() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
        if (this.checklistIndex < items.length) {
            this.toggleChecklistItem(this.checklistIndex);
        }
    }

    resetChecklist() {
        this.checkedItems = [];
        this.checklistIndex = 0;
        this.autoRunning = false;
        document.getElementById('btn-checklist-auto').textContent = '▶ Auto Run';
        document.getElementById('btn-checklist-auto').classList.remove('running');
        this.renderChecklist();
    }

    startChecklist(phase) {
        this.checklistPhase = phase;
        document.getElementById('checklist-phase').value = phase;
        this.resetChecklist();
        this.switchMode('checklist');

        const items = CHECKLISTS[this.checklistAircraft]?.[phase] || [];
        if (items.length > 0) {
            this.speak(phase + ' checklist. ' + items[0].text + '?');
        }
    }

    toggleAutoRun() {
        this.autoRunning = !this.autoRunning;
        const btn = document.getElementById('btn-checklist-auto');

        if (this.autoRunning) {
            btn.textContent = '⏹ Stop';
            btn.classList.add('running');
            this.runAutoChecklist();
        } else {
            btn.textContent = '▶ Auto Run';
            btn.classList.remove('running');
        }
    }

    async runAutoChecklist() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];

        while (this.autoRunning && this.checklistIndex < items.length) {
            const item = items[this.checklistIndex];
            this.speak(item.text + '?');

            // Wait for response or timeout
            await this.sleep(3000);

            if (!this.autoRunning) break;

            this.speak(item.action);
            await this.sleep(1500);

            if (!this.autoRunning) break;

            this.toggleChecklistItem(this.checklistIndex);
            await this.sleep(1000);
        }

        if (this.autoRunning) {
            this.autoRunning = false;
            document.getElementById('btn-checklist-auto').textContent = '▶ Auto Run';
            document.getElementById('btn-checklist-auto').classList.remove('running');
        }
    }

    // === Emergency Mode ===
    initEmergencyMode() {
        const typeSelect = document.getElementById('emergency-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.emergencyType = e.target.value;
                this.renderEmergency();
            });
        }

        const resetBtn = document.getElementById('btn-emergency-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetEmergency());
        }

        const autoBtn = document.getElementById('btn-emergency-auto');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => this.toggleEmergencyAuto());
        }

        const squawkBtn = document.getElementById('btn-squawk-7700');
        if (squawkBtn) {
            squawkBtn.addEventListener('click', () => {
                this.speak('Squawking 7700. Mayday, mayday, mayday.');
                this.addMessage('SQUAWK 7700 - Emergency declared', 'copilot');
            });
        }

        this.renderEmergency();
    }

    renderEmergency() {
        const container = document.getElementById('emergency-items');
        if (!container) return;

        container.replaceChildren();
        const procedure = EMERGENCY_PROCEDURES[this.emergencyType];
        if (!procedure) return;

        procedure.items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checklist-item emergency-item';
            if (item.critical) div.classList.add('critical');
            if (this.emergencyChecked.includes(index)) div.classList.add('checked');
            if (index === this.emergencyIndex && !this.emergencyChecked.includes(index)) {
                div.classList.add('active');
            }

            const checkbox = document.createElement('div');
            checkbox.className = 'item-checkbox';

            const text = document.createElement('span');
            text.className = 'item-text';
            text.textContent = item.text;

            const action = document.createElement('span');
            action.className = 'item-action';
            action.textContent = item.action;

            div.appendChild(checkbox);
            div.appendChild(text);
            div.appendChild(action);

            div.addEventListener('click', () => this.toggleEmergencyItem(index));
            container.appendChild(div);
        });
    }

    toggleEmergencyItem(index) {
        const idx = this.emergencyChecked.indexOf(index);
        if (idx === -1) {
            this.emergencyChecked.push(index);
            const procedure = EMERGENCY_PROCEDURES[this.emergencyType];
            if (this.voiceEnabled && procedure.items[index]) {
                const item = procedure.items[index];
                this.speak(item.text + ', ' + item.action);
            }
        } else {
            this.emergencyChecked.splice(idx, 1);
        }
        this.advanceEmergency();
        this.renderEmergency();
    }

    advanceEmergency() {
        const procedure = EMERGENCY_PROCEDURES[this.emergencyType];
        if (!procedure) return;

        for (let i = 0; i < procedure.items.length; i++) {
            if (!this.emergencyChecked.includes(i)) {
                this.emergencyIndex = i;
                return;
            }
        }
        this.emergencyIndex = procedure.items.length;
        if (this.emergencyChecked.length === procedure.items.length) {
            this.speak('Emergency procedure complete.');
        }
    }

    resetEmergency() {
        this.emergencyChecked = [];
        this.emergencyIndex = 0;
        this.emergencyAutoRunning = false;
        const btn = document.getElementById('btn-emergency-auto');
        if (btn) {
            btn.textContent = '▶ Run Procedure';
            btn.classList.remove('running');
        }
        this.renderEmergency();
    }

    startEmergency(type) {
        this.emergencyType = type;
        const select = document.getElementById('emergency-type');
        if (select) select.value = type;
        this.resetEmergency();
        this.switchMode('emergency');

        const procedure = EMERGENCY_PROCEDURES[type];
        if (procedure && procedure.items.length > 0) {
            this.speak(procedure.name + ' emergency. ' + procedure.items[0].text + '?');
        }
    }

    toggleEmergencyAuto() {
        this.emergencyAutoRunning = !this.emergencyAutoRunning;
        const btn = document.getElementById('btn-emergency-auto');

        if (this.emergencyAutoRunning) {
            btn.textContent = '⏹ Stop';
            btn.classList.add('running');
            this.runEmergencyAuto();
        } else {
            btn.textContent = '▶ Run Procedure';
            btn.classList.remove('running');
        }
    }

    async runEmergencyAuto() {
        const procedure = EMERGENCY_PROCEDURES[this.emergencyType];
        if (!procedure) return;

        while (this.emergencyAutoRunning && this.emergencyIndex < procedure.items.length) {
            const item = procedure.items[this.emergencyIndex];

            // Speak with urgency for critical items
            if (item.critical) {
                this.speak(item.text + '! ' + item.action + '!');
            } else {
                this.speak(item.text + '?');
            }

            await this.sleep(2500);
            if (!this.emergencyAutoRunning) break;

            this.speak(item.action);
            await this.sleep(1500);
            if (!this.emergencyAutoRunning) break;

            this.toggleEmergencyItem(this.emergencyIndex);
            await this.sleep(800);
        }

        if (this.emergencyAutoRunning) {
            this.emergencyAutoRunning = false;
            const btn = document.getElementById('btn-emergency-auto');
            if (btn) {
                btn.textContent = '▶ Run Procedure';
                btn.classList.remove('running');
            }
        }
    }

    // === ATC Mode ===
    initATCMode() {
        document.querySelectorAll('.atc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleATCAction(btn.dataset.action);
            });
        });
    }

    handleATCAction(action) {
        const callsign = 'November One Two Three Alpha Bravo';

        switch (action) {
            case 'request-taxi':
                this.addATCMessage('Ground, ' + callsign + ', at the ramp, request taxi to active runway.', 'outgoing');
                this.speak('Ground, ' + callsign + ', at the ramp, request taxi to active runway.');
                break;

            case 'request-takeoff':
                this.addATCMessage('Tower, ' + callsign + ', holding short runway, ready for departure.', 'outgoing');
                this.speak('Tower, ' + callsign + ', holding short, ready for departure.');
                break;

            case 'request-landing':
                this.addATCMessage('Tower, ' + callsign + ', 10 miles out, inbound for landing.', 'outgoing');
                this.speak('Tower, ' + callsign + ', 10 miles out, inbound for landing.');
                break;

            case 'readback':
                this.speak('Roger, ' + callsign + '.');
                break;
        }
    }

    addATCMessage(text, type) {
        const container = document.getElementById('atc-messages');
        const msg = document.createElement('div');
        msg.className = 'atc-msg ' + type;

        const callsign = document.createElement('span');
        callsign.className = 'callsign';
        callsign.textContent = type === 'incoming' ? 'ATC' : 'YOU';

        const msgText = document.createElement('span');
        msgText.className = 'msg';
        msgText.textContent = text;

        msg.appendChild(callsign);
        msg.appendChild(msgText);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // === ATIS Decoder ===
    initATISDecoder() {
        const decodeBtn = document.getElementById('btn-decode-atis');
        if (decodeBtn) {
            decodeBtn.addEventListener('click', () => this.decodeATIS());
        }
    }

    decodeATIS() {
        const input = document.getElementById('atis-input');
        const output = document.getElementById('atis-decoded');
        if (!input || !output) return;

        const text = input.value.trim().toUpperCase();
        if (!text) {
            output.textContent = 'Paste ATIS text above';
            return;
        }

        const decoded = this.parseATIS(text);
        this.atisData = decoded;

        output.replaceChildren();

        // Create decoded display
        const items = [
            { label: 'Info', value: decoded.info || '?' },
            { label: 'Time', value: decoded.time || '?' },
            { label: 'Wind', value: decoded.wind || '?' },
            { label: 'Visibility', value: decoded.visibility || '?' },
            { label: 'Ceiling', value: decoded.ceiling || 'CLR' },
            { label: 'Temp/Dew', value: decoded.temp || '?' },
            { label: 'Altimeter', value: decoded.altimeter || '?' },
            { label: 'Runway', value: decoded.runway || '?' },
            { label: 'Approach', value: decoded.approach || '?' }
        ];

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'atis-row';

            const label = document.createElement('span');
            label.className = 'atis-label';
            label.textContent = item.label;

            const value = document.createElement('span');
            value.className = 'atis-value';
            value.textContent = item.value;

            row.appendChild(label);
            row.appendChild(value);
            output.appendChild(row);
        });

        // Speak key info
        if (this.voiceEnabled) {
            const speech = `Information ${decoded.info || 'unknown'}. Wind ${decoded.wind || 'calm'}. Altimeter ${decoded.altimeter || 'unknown'}. Landing runway ${decoded.runway || 'check ATIS'}.`;
            this.speak(speech);
        }
    }

    parseATIS(text) {
        const decoded = {};

        // Information letter (ATIS INFORMATION ALPHA, INFO A, etc)
        const infoMatch = text.match(/INFORMATION\s+([A-Z])|INFO\s+([A-Z])|ATIS\s+([A-Z])\b/);
        if (infoMatch) {
            decoded.info = infoMatch[1] || infoMatch[2] || infoMatch[3];
        }

        // Time (1234Z, 12:34Z, etc)
        const timeMatch = text.match(/(\d{4})Z|\b(\d{2}):?(\d{2})\s*Z/);
        if (timeMatch) {
            decoded.time = timeMatch[1] ? timeMatch[1] + 'Z' : timeMatch[2] + timeMatch[3] + 'Z';
        }

        // Wind (36010KT, 360 AT 10, VRB05KT)
        const windMatch = text.match(/(\d{3}|VRB)\s*(?:AT\s*)?(\d{2,3})(?:G(\d{2,3}))?\s*(?:KT|KTS?)/);
        if (windMatch) {
            let wind = windMatch[1] + '° at ' + windMatch[2];
            if (windMatch[3]) wind += ' gusting ' + windMatch[3];
            decoded.wind = wind + ' kt';
        } else if (text.includes('CALM') || text.includes('WIND CALM')) {
            decoded.wind = 'Calm';
        }

        // Visibility (10SM, 3SM, 1/2SM, 9999)
        const visMatch = text.match(/(\d+(?:\/\d+)?)\s*SM|VIS\s+(\d+)|(\d{4})\s*(?:M|METERS?)?/);
        if (visMatch) {
            if (visMatch[1]) decoded.visibility = visMatch[1] + ' SM';
            else if (visMatch[2]) decoded.visibility = visMatch[2] + ' SM';
            else if (visMatch[3]) {
                const meters = parseInt(visMatch[3]);
                decoded.visibility = meters >= 9999 ? '10+ km' : (meters / 1000).toFixed(1) + ' km';
            }
        }

        // Ceiling (BKN025, OVC030, SCT040)
        const ceilingMatch = text.match(/(BKN|OVC|VV)(\d{3})/);
        if (ceilingMatch) {
            const height = parseInt(ceilingMatch[2]) * 100;
            decoded.ceiling = ceilingMatch[1] + ' ' + height + ' ft';
        }

        // Temperature/Dewpoint (24/18, M02/M05, 24 DEW 18)
        const tempMatch = text.match(/(M?\d{2})\/(M?\d{2})|TEMP\s+(M?\d{2}).*?DEW\s+(M?\d{2})/);
        if (tempMatch) {
            const temp = (tempMatch[1] || tempMatch[3]).replace('M', '-');
            const dew = (tempMatch[2] || tempMatch[4]).replace('M', '-');
            decoded.temp = temp + '°/' + dew + '°C';
        }

        // Altimeter (A2992, QNH 1013, 29.92)
        const altMatch = text.match(/A(\d{4})|QNH\s+(\d{4})|(\d{2})\.(\d{2})/);
        if (altMatch) {
            if (altMatch[1]) {
                const inhg = parseInt(altMatch[1]) / 100;
                decoded.altimeter = inhg.toFixed(2) + ' inHg';
            } else if (altMatch[2]) {
                decoded.altimeter = altMatch[2] + ' hPa';
            } else if (altMatch[3] && altMatch[4]) {
                decoded.altimeter = altMatch[3] + '.' + altMatch[4] + ' inHg';
            }
        }

        // Landing runway (LDG RWY 27L, LANDING 27, RWY IN USE 09)
        const rwyMatch = text.match(/(?:LANDING|LDG|ARRIV\w*|IN USE)\s*(?:RWY|RUNWAY)?\s*(\d{1,2}[LRC]?)|RWY\s+(\d{1,2}[LRC]?)\s+IN USE/i);
        if (rwyMatch) {
            decoded.runway = 'RWY ' + (rwyMatch[1] || rwyMatch[2]);
        }

        // Approach type (ILS, RNAV, VOR, VISUAL)
        const appMatch = text.match(/(ILS|RNAV|VOR|VISUAL|GPS)\s+(?:APPROACH|APCH)?/i);
        if (appMatch) {
            decoded.approach = appMatch[1];
        }

        return decoded;
    }

    // === Advisor Mode ===
    initAdvisorMode() {
        // Callout toggles
        document.getElementById('callout-altitude').addEventListener('change', (e) => {
            this.callouts.altitude = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-speed').addEventListener('change', (e) => {
            this.callouts.speed = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-approach').addEventListener('change', (e) => {
            this.callouts.approach = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-gear').addEventListener('change', (e) => {
            this.callouts.gear = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-flaps').addEventListener('change', (e) => {
            this.callouts.flaps = e.target.checked;
            this.saveSettings();
        });

        // V-speeds
        document.getElementById('vspeed-vr').addEventListener('change', (e) => {
            this.vSpeeds.vr = parseInt(e.target.value) || 55;
            this.saveSettings();
        });

        document.getElementById('vspeed-v2').addEventListener('change', (e) => {
            this.vSpeeds.v2 = parseInt(e.target.value) || 62;
            this.saveSettings();
        });

        document.getElementById('vspeed-vref').addEventListener('change', (e) => {
            this.vSpeeds.vref = parseInt(e.target.value) || 65;
            this.saveSettings();
        });
    }

    // === Voice ===
    initVoice() {
        const voiceBtn = document.getElementById('btn-voice');
        voiceBtn.classList.toggle('active', this.voiceEnabled);
        voiceBtn.addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled;
            voiceBtn.classList.toggle('active', this.voiceEnabled);
            voiceBtn.textContent = this.voiceEnabled ? '🔊' : '🔇';
        });

        const listenBtn = document.getElementById('btn-listen');
        listenBtn.addEventListener('click', () => {
            this.toggleListening();
        });

        this.initSpeechRecognition();
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            this.handlePilotInput();
            document.getElementById('pilot-input').value = text;
            this.handlePilotInput();
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.recognition.start();
            }
        };
    }

    toggleListening() {
        if (!this.recognition) return;

        this.isListening = !this.isListening;
        const btn = document.getElementById('btn-listen');

        if (this.isListening) {
            btn.classList.add('active', 'listening');
            this.recognition.start();
            this.updateStatus('Listening...');
        } else {
            btn.classList.remove('active', 'listening');
            this.recognition.stop();
            this.updateStatus('Standing by');
        }
    }

    speak(text) {
        if (!this.voiceEnabled) return;

        // Stop any current speech
        if (this._ttsAudio) {
            this._ttsAudio.pause();
            this._ttsAudio = null;
        }
        if (this.synth) this.synth.cancel();

        // Try OpenAI natural voice first
        if (this.useNaturalVoice && this.copilotStatus?.licensed && this.copilotStatus?.hasApiKey && this.copilotStatus?.provider === 'openai') {
            this.speakNatural(text);
            return;
        }

        // Fallback to browser TTS
        this.speakBrowser(text);
    }

    async speakNatural(text) {
        try {
            const res = await fetch('/api/copilot/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text.slice(0, 4096), voice: this.ttsVoice })
            });

            if (!res.ok) {
                this.speakBrowser(text);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            this._ttsAudio = audio;
            audio.onended = () => {
                URL.revokeObjectURL(url);
                this._ttsAudio = null;
            };
            audio.play().catch(() => this.speakBrowser(text));
        } catch (e) {
            this.speakBrowser(text);
        }
    }

    speakBrowser(text) {
        if (!this.synth) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const preferred = voices.find(v =>
            v.name.includes('Google UK English Female') ||
            v.name.includes('Microsoft Hazel') ||
            v.lang === 'en-GB'
        );
        if (preferred) utterance.voice = preferred;

        this.synth.speak(utterance);
    }

    updateStatus(text) {
        document.getElementById('copilot-status').textContent = text;
    }

    // === Flight Data ===
    initWebSocket() {
        const wsUrl = 'ws://' + window.location.host;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateFlightData(data);
                } catch (e) {}
            };

            this.ws.onclose = () => {
                setTimeout(() => this.initWebSocket(), 3000);
            };
        } catch (e) {
            setTimeout(() => this.initWebSocket(), 5000);
        }

        // Fallback polling
        this.pollFlightData();
    }

    async pollFlightData() {
        try {
            const res = await fetch('/api/simvars');
            if (res.ok) {
                const data = await res.json();
                this.updateFlightData(data);
            }
        } catch (e) {}

        setTimeout(() => this.pollFlightData(), 2000);
    }

    updateFlightData(data) {
        const prev = { ...this.flightData };

        this.flightData.altitude = data.PLANE_ALTITUDE || data.altitude || 0;
        this.flightData.speed = data.AIRSPEED_INDICATED || data.speed || 0;
        this.flightData.heading = data.PLANE_HEADING_DEGREES_TRUE || data.heading || 0;
        this.flightData.vspeed = data.VERTICAL_SPEED || data.vspeed || 0;
        this.flightData.onGround = data.SIM_ON_GROUND || data.onGround || false;
        this.flightData.gearDown = data.GEAR_HANDLE_POSITION !== 0;

        // Update display
        document.getElementById('stat-altitude').textContent = Math.round(this.flightData.altitude);
        document.getElementById('stat-speed').textContent = Math.round(this.flightData.speed);
        document.getElementById('stat-heading').textContent = Math.round(this.flightData.heading) + '°';
        document.getElementById('stat-vspeed').textContent = Math.round(this.flightData.vspeed);

        // Process callouts
        this.processCallouts(prev);
    }

    processCallouts(prev) {
        const alt = Math.round(this.flightData.altitude);
        const speed = Math.round(this.flightData.speed);

        // Altitude callouts (every 1000ft)
        if (this.callouts.altitude && !this.flightData.onGround) {
            const currentK = Math.floor(alt / 1000);
            const lastK = Math.floor(this.lastAltitudeCallout / 1000);

            if (currentK !== lastK && alt > 100) {
                this.speak(currentK + ' thousand');
                this.lastAltitudeCallout = alt;
            }
        }

        // Speed callouts
        if (this.callouts.speed && this.flightData.onGround) {
            // Vr callout
            if (prev.speed < this.vSpeeds.vr && speed >= this.vSpeeds.vr) {
                this.speak('V1, rotate');
            }
            // V2 callout
            if (prev.speed < this.vSpeeds.v2 && speed >= this.vSpeeds.v2) {
                this.speak('V2');
            }
        }

        // Gear warning
        if (this.callouts.gear) {
            if (alt < 1000 && !this.flightData.onGround && !this.flightData.gearDown && this.flightData.vspeed < -500) {
                this.speak('Gear! Check gear!');
            }
        }

        // Approach callouts
        if (this.callouts.approach && !this.flightData.onGround && this.flightData.vspeed < -200) {
            const agl = alt; // Approximate AGL (would need terrain data for accuracy)

            // Altitude callouts during approach
            const approachAlts = [2500, 1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10];

            for (const callAlt of approachAlts) {
                if (prev.altitude > callAlt && alt <= callAlt && alt > callAlt - 50) {
                    if (callAlt >= 1000) {
                        this.speak(Math.floor(callAlt / 1000) + ' thousand');
                    } else if (callAlt === 100) {
                        this.speak('One hundred');
                    } else if (callAlt === 50) {
                        this.speak('Fifty');
                    } else if (callAlt === 40) {
                        this.speak('Forty');
                    } else if (callAlt === 30) {
                        this.speak('Thirty');
                    } else if (callAlt === 20) {
                        this.speak('Twenty');
                    } else if (callAlt === 10) {
                        this.speak('Ten');
                    } else {
                        this.speak(callAlt.toString());
                    }
                    this.approachCallouts.lastAltCallout = callAlt;
                    break;
                }
            }

            // Minimums callout
            if (!this.approachCallouts.calledMinimums &&
                prev.altitude > this.approachCallouts.minimums &&
                alt <= this.approachCallouts.minimums) {
                this.speak('Minimums! Minimums!');
                this.approachCallouts.calledMinimums = true;
            }

            // Decision height callout
            if (!this.approachCallouts.calledDecision &&
                prev.altitude > this.approachCallouts.decisionHeight &&
                alt <= this.approachCallouts.decisionHeight) {
                this.speak('Decision height!');
                this.approachCallouts.calledDecision = true;
            }

            // Reset approach callouts when climbing
            if (this.flightData.vspeed > 500 && alt > 1000) {
                this.approachCallouts.calledMinimums = false;
                this.approachCallouts.calledDecision = false;
            }
        }
    }

    // === Settings ===
    saveSettings() {
        try {
            localStorage.setItem('copilot-settings', JSON.stringify({
                callouts: this.callouts,
                vSpeeds: this.vSpeeds,
                voiceEnabled: this.voiceEnabled,
                ttsVoice: this.ttsVoice,
                useNaturalVoice: this.useNaturalVoice
            }));
        } catch (e) {}
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('copilot-settings');
            if (saved) {
                const s = JSON.parse(saved);
                this.callouts = { ...this.callouts, ...s.callouts };
                this.vSpeeds = { ...this.vSpeeds, ...s.vSpeeds };
                this.voiceEnabled = s.voiceEnabled !== false;
                if (s.ttsVoice) this.ttsVoice = s.ttsVoice;
                if (s.useNaturalVoice !== undefined) this.useNaturalVoice = s.useNaturalVoice;

                // Apply to UI
                document.getElementById('callout-altitude').checked = this.callouts.altitude;
                document.getElementById('callout-speed').checked = this.callouts.speed;
                document.getElementById('callout-approach').checked = this.callouts.approach;
                document.getElementById('callout-gear').checked = this.callouts.gear;
                document.getElementById('callout-flaps').checked = this.callouts.flaps;
                document.getElementById('vspeed-vr').value = this.vSpeeds.vr;
                document.getElementById('vspeed-v2').value = this.vSpeeds.v2;
                document.getElementById('vspeed-vref').value = this.vSpeeds.vref;
            }
        } catch (e) {}
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    registerCopilotSettings(settingsPanel) {
        const self = this;
        const MODELS = {
            openai: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
            ],
            anthropic: [
                { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
                { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
            ]
        };

        settingsPanel.registerSection('copilot-ai', {
            title: 'AI Copilot',
            icon: '🤖',
            render: () => {
                const status = self.copilotStatus || {};
                const provider = status.provider || 'openai';
                const model = status.model || 'gpt-4o';

                const modelOptions = (p) => MODELS[p].map(m =>
                    `<option value="${m.id}" ${m.id === model ? 'selected' : ''}>${m.name}</option>`
                ).join('');

                return `
                    <div class="copilot-settings">
                        <div class="cs-row">
                            <label>License Key</label>
                            <div class="cs-input-group">
                                <input type="text" id="cs-license-key" placeholder="SW-XXXXX-XXXXX-XXXXX-XXXXX" value="${status.licensed ? '••••••••••••••••••••' : ''}">
                                <button class="btn-small" id="cs-validate-btn">Validate</button>
                            </div>
                            <div class="cs-status" id="cs-license-status">${status.licensed ? '<span class="cs-ok">Licensed (' + (status.tier || 'pro') + ')</span>' : '<span class="cs-warn">Not licensed</span>'}</div>
                        </div>
                        <div class="cs-row">
                            <label>Provider</label>
                            <select id="cs-provider">
                                <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                            </select>
                        </div>
                        <div class="cs-row">
                            <label>Model</label>
                            <select id="cs-model">${modelOptions(provider)}</select>
                        </div>
                        <div class="cs-row">
                            <label>API Key</label>
                            <input type="password" id="cs-api-key" placeholder="${status.hasApiKey ? 'Key saved (enter new to replace)' : 'Enter your API key'}">
                        </div>
                        <div class="cs-row">
                            <label class="toggle-item">
                                <input type="checkbox" id="cs-memory-only" ${status.apiKeyMemoryOnly ? 'checked' : ''}>
                                <span>Memory only (not saved to disk)</span>
                            </label>
                        </div>
                        <div class="cs-divider"></div>
                        <div class="cs-row">
                            <label>Voice (OpenAI TTS)</label>
                            <div class="cs-input-group">
                                <select id="cs-tts-voice">
                                    <option value="nova" ${self.ttsVoice === 'nova' ? 'selected' : ''}>Nova (warm female)</option>
                                    <option value="shimmer" ${self.ttsVoice === 'shimmer' ? 'selected' : ''}>Shimmer (bright female)</option>
                                    <option value="alloy" ${self.ttsVoice === 'alloy' ? 'selected' : ''}>Alloy (neutral)</option>
                                    <option value="echo" ${self.ttsVoice === 'echo' ? 'selected' : ''}>Echo (male)</option>
                                    <option value="fable" ${self.ttsVoice === 'fable' ? 'selected' : ''}>Fable (British)</option>
                                    <option value="onyx" ${self.ttsVoice === 'onyx' ? 'selected' : ''}>Onyx (deep male)</option>
                                    <option value="coral" ${self.ttsVoice === 'coral' ? 'selected' : ''}>Coral (conversational)</option>
                                    <option value="sage" ${self.ttsVoice === 'sage' ? 'selected' : ''}>Sage (calm)</option>
                                    <option value="ash" ${self.ttsVoice === 'ash' ? 'selected' : ''}>Ash (clear)</option>
                                    <option value="ballad" ${self.ttsVoice === 'ballad' ? 'selected' : ''}>Ballad (soft)</option>
                                </select>
                                <button class="btn-small" id="cs-tts-test">Test</button>
                            </div>
                        </div>
                        <div class="cs-row">
                            <label class="toggle-item">
                                <input type="checkbox" id="cs-natural-voice" ${self.useNaturalVoice ? 'checked' : ''}>
                                <span>Use natural voice (uses API credits)</span>
                            </label>
                        </div>
                        <div class="cs-row">
                            <button class="btn btn-primary" id="cs-save-btn">Save Configuration</button>
                        </div>
                        <div class="cs-status" id="cs-save-status"></div>
                    </div>
                `;
            },
            onMount: (container) => {
                const providerSelect = container.querySelector('#cs-provider');
                const modelSelect = container.querySelector('#cs-model');

                providerSelect.addEventListener('change', () => {
                    const p = providerSelect.value;
                    modelSelect.innerHTML = MODELS[p].map(m =>
                        `<option value="${m.id}">${m.name}</option>`
                    ).join('');
                });

                container.querySelector('#cs-validate-btn').addEventListener('click', async () => {
                    const key = container.querySelector('#cs-license-key').value.trim();
                    const statusEl = container.querySelector('#cs-license-status');
                    if (!key || key.includes('•')) {
                        statusEl.innerHTML = '<span class="cs-warn">Enter a license key to validate</span>';
                        return;
                    }
                    try {
                        const res = await fetch('/api/copilot/validate-key', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key })
                        });
                        const result = await res.json();
                        if (result.valid) {
                            statusEl.innerHTML = '<span class="cs-ok">Valid key (' + (result.tier || 'pro') + ')</span>';
                        } else {
                            statusEl.innerHTML = '<span class="cs-err">' + (result.error || 'Invalid key') + '</span>';
                        }
                    } catch (e) {
                        statusEl.innerHTML = '<span class="cs-err">Server error</span>';
                    }
                });

                // TTS voice test
                container.querySelector('#cs-tts-test').addEventListener('click', async () => {
                    const voice = container.querySelector('#cs-tts-voice').value;
                    self.ttsVoice = voice;
                    self.useNaturalVoice = true;
                    self.speakNatural('Good day Captain, this is your AI copilot. Ready for departure.');
                });

                // Natural voice toggle
                container.querySelector('#cs-natural-voice').addEventListener('change', (e) => {
                    self.useNaturalVoice = e.target.checked;
                    self.saveSettings();
                });

                container.querySelector('#cs-save-btn').addEventListener('click', async () => {
                    const saveStatus = container.querySelector('#cs-save-status');
                    const licenseKey = container.querySelector('#cs-license-key').value.trim();
                    const ttsVoice = container.querySelector('#cs-tts-voice').value;
                    const body = {
                        provider: providerSelect.value,
                        model: modelSelect.value,
                        apiKeyMemoryOnly: container.querySelector('#cs-memory-only').checked,
                        ttsVoice: ttsVoice
                    };

                    self.ttsVoice = ttsVoice;
                    self.useNaturalVoice = container.querySelector('#cs-natural-voice').checked;
                    self.saveSettings();

                    if (licenseKey && !licenseKey.includes('•')) {
                        body.licenseKey = licenseKey;
                    }

                    const apiKey = container.querySelector('#cs-api-key').value.trim();
                    if (apiKey) {
                        body.apiKey = apiKey;
                    }

                    try {
                        const res = await fetch('/api/copilot/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const result = await res.json();
                        if (result.success) {
                            saveStatus.innerHTML = '<span class="cs-ok">Saved! ' + (result.licensed ? 'Licensed.' : 'License invalid.') + (result.hasApiKey ? ' API key set.' : '') + '</span>';
                            self.copilotStatus = {
                                licensed: result.licensed,
                                tier: result.tier,
                                provider: body.provider,
                                model: body.model,
                                hasApiKey: result.hasApiKey,
                                apiKeyMemoryOnly: body.apiKeyMemoryOnly
                            };
                            // Remove banner if now configured
                            const banner = document.querySelector('.ai-unconfigured-banner');
                            if (banner && result.licensed && result.hasApiKey) {
                                banner.remove();
                            }
                        } else {
                            saveStatus.innerHTML = '<span class="cs-err">Save failed</span>';
                        }
                    } catch (e) {
                        saveStatus.innerHTML = '<span class="cs-err">Server error</span>';
                    }
                });
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.copilot = new AICopilot();
});
