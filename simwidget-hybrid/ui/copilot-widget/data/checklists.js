// Copilot Checklists - Loaded on-demand when Checklist mode activated
// Part of code splitting optimization for Copilot Widget v3.0.0

// Populate the global CHECKLISTS object (defined in glass.js as empty)
Object.assign(CHECKLISTS, {
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
});

// Data successfully loaded into global CHECKLISTS object
console.log('[Copilot] Loaded checklist data for', Object.keys(CHECKLISTS).length, 'aircraft');
