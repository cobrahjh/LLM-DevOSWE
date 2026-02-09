// Airliner Aircraft Checklists
// Loaded on-demand when airliner aircraft selected

if (typeof AIRCRAFT_CHECKLISTS === 'undefined') {
    var AIRCRAFT_CHECKLISTS = {};
}

AIRCRAFT_CHECKLISTS.a320 = {
        name: 'Airbus A320',
        checklists: {
            preflight: {
                name: 'Cockpit Preparation',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery 1 & 2', action: 'ON' },
                    { text: 'External Power', action: 'ON' },
                    { text: 'APU Master', action: 'ON' },
                    { text: 'APU Start', action: 'ON' },
                    { text: 'APU Bleed', action: 'ON' },
                    { text: 'ADIRS', action: 'NAV' },
                    { text: 'Fuel Pumps', action: 'ON' },
                    { text: 'MCDU', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine Mode', action: 'IGN/START' },
                    { text: 'Engine 2 Master', action: 'ON' },
                    { text: 'N2 > 25%', action: 'VERIFY' },
                    { text: 'Engine 1 Master', action: 'ON' },
                    { text: 'N2 > 25%', action: 'VERIFY' },
                    { text: 'Engine Mode', action: 'NORM' },
                    { text: 'APU Bleed', action: 'OFF' },
                    { text: 'APU Master', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Flaps', action: 'SET (CONFIG 1+F)' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Auto Brake', action: 'MAX' },
                    { text: 'Nose Light', action: 'TAXI' },
                    { text: 'Parking Brake', action: 'RELEASE' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Transponder', action: 'ON' },
                    { text: 'TCAS', action: 'TA/RA' },
                    { text: 'Weather Radar', action: 'AS REQ' },
                    { text: 'Strobe', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Takeoff Config', action: 'TEST' },
                    { text: 'Cabin', action: 'READY' },
                    { text: 'Packs', action: 'AS REQ' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'ECAM', action: 'CHECK' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Landing Lights', action: 'OFF' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Seat Belt Signs', action: 'ON' },
                    { text: 'Baro Ref', action: 'SET' },
                    { text: 'Auto Brake', action: 'SET' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Spoilers', action: 'ARM' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine 1 Master', action: 'OFF' },
                    { text: 'Engine 2 Master', action: 'OFF' },
                    { text: 'APU', action: 'START (AS REQ)' },
                    { text: 'Ext Power', action: 'ON (AS REQ)' },
                    { text: 'Seat Belt Signs', action: 'OFF' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Fuel Pumps', action: 'OFF' }
                ]
            }
        }
};


AIRCRAFT_CHECKLISTS.a320neo = {
        name: 'Airbus A320neo',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery 1 & 2', action: 'ON' },
                    { text: 'External Power', action: 'ON' },
                    { text: 'APU Master', action: 'ON' },
                    { text: 'APU Start', action: 'ON' },
                    { text: 'ADIRS', action: 'NAV' },
                    { text: 'Crew Oxygen', action: 'CHECK' },
                    { text: 'Emergency Equipment', action: 'CHECK' }
                ]
            },
            'before-start': {
                name: 'Before Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'MCDU', action: 'INITIALIZED' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'APU Bleed', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Doors', action: 'CLOSED' },
                    { text: 'Thrust Levers', action: 'IDLE' }
                ]
            },
            'after-start': {
                name: 'After Start',
                items: [
                    { text: 'Engine Mode', action: 'NORM' },
                    { text: 'APU Bleed', action: 'OFF' },
                    { text: 'APU Master', action: 'OFF' },
                    { text: 'Ground Equipment', action: 'CLEAR' },
                    { text: 'Flaps', action: 'SET (T.O. CONFIG)' },
                    { text: 'Flight Controls', action: 'CHECK' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Parking Brake', action: 'RELEASE' },
                    { text: 'Nose Light', action: 'TAXI' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Flight Instruments', action: 'CHECK' },
                    { text: 'Radar', action: 'AS REQ' },
                    { text: 'Predictive Windshear', action: 'AUTO' }
                ]
            },
            'before-takeoff': {
                name: 'Before Takeoff',
                items: [
                    { text: 'T.O. Config', action: 'TEST' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Auto Brake', action: 'MAX' },
                    { text: 'TCAS', action: 'TA/RA' },
                    { text: 'Transponder', action: 'ON' },
                    { text: 'Strobe Lights', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Cabin Crew', action: 'ADVISED' }
                ]
            },
            'after-takeoff': {
                name: 'After Takeoff',
                items: [
                    { text: 'Landing Gear', action: 'UP' },
                    { text: 'Flaps', action: 'RETRACT ON SCHEDULE' },
                    { text: 'Ground Spoilers', action: 'DISARM' },
                    { text: 'Packs', action: 'ON' },
                    { text: 'APU', action: 'OFF (IF RUNNING)' },
                    { text: 'Autopilot', action: 'ENGAGE' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'ECAM', action: 'CHECK' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Altitude', action: 'CROSSCHECK' },
                    { text: 'Landing Lights', action: 'OFF' }
                ]
            },
            descent: {
                name: 'Descent',
                items: [
                    { text: 'ATIS/Weather', action: 'OBTAINED' },
                    { text: 'Landing Elevation', action: 'SET' },
                    { text: 'Approach', action: 'BRIEF' },
                    { text: 'MCDU', action: 'APPROACH SET' },
                    { text: 'Auto Brake', action: 'SET' },
                    { text: 'Seat Belt Signs', action: 'ON' }
                ]
            },
            approach: {
                name: 'Approach',
                items: [
                    { text: 'Baro Reference', action: 'SET' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Go Around Altitude', action: 'SET' }
                ]
            },
            landing: {
                name: 'Landing',
                items: [
                    { text: 'Cabin', action: 'SECURED' },
                    { text: 'Gear', action: 'DOWN & 3 GREEN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Autopilot', action: 'AS REQ' },
                    { text: 'Auto Thrust', action: 'AS REQ' }
                ]
            },
            'after-landing': {
                name: 'After Landing',
                items: [
                    { text: 'Spoilers', action: 'DISARM' },
                    { text: 'Flaps', action: 'RETRACT' },
                    { text: 'APU', action: 'START' },
                    { text: 'Strobe Lights', action: 'OFF' },
                    { text: 'Landing Lights', action: 'OFF' },
                    { text: 'Nose Light', action: 'TAXI' },
                    { text: 'Radar', action: 'OFF' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine 1 Master', action: 'OFF' },
                    { text: 'Engine 2 Master', action: 'OFF' },
                    { text: 'Seat Belt Signs', action: 'OFF' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Fuel Pumps', action: 'OFF' },
                    { text: 'External Power', action: 'AS REQ' },
                    { text: 'APU Bleed', action: 'ON (IF NEEDED)' }
                ]
            }
        }
};


AIRCRAFT_CHECKLISTS.b737 = {
        name: 'Boeing 737',
        checklists: {
            preflight: {
                name: 'Cockpit Prep',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'External Power', action: 'ON' },
                    { text: 'APU', action: 'START' },
                    { text: 'IRS', action: 'NAV' },
                    { text: 'FMC', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'APU Bleed', action: 'ON' },
                    { text: 'Engine 2 Start', action: 'GRD' },
                    { text: 'N2 > 25%', action: 'FUEL ON' },
                    { text: 'Engine 1 Start', action: 'GRD' },
                    { text: 'N2 > 25%', action: 'FUEL ON' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'APU', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Flaps', action: 'SET' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Trim', action: 'SET' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'VERIFY' },
                    { text: 'Stabilizer Trim', action: 'SET' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Speed Brake', action: 'ARM' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Autobrake', action: 'SET' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engines', action: 'CUTOFF' },
                    { text: 'APU', action: 'AS REQ' },
                    { text: 'Beacon', action: 'OFF' }
                ]
            }
        }
};


AIRCRAFT_CHECKLISTS.b747 = {
        name: 'Boeing 747',
        checklists: {
            preflight: {
                name: 'Cockpit Preparation',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'APU', action: 'START' },
                    { text: 'Hydraulics', action: 'CHECK' },
                    { text: 'IRS', action: 'NAV' },
                    { text: 'FMC', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Engine Start Selector', action: 'GND' },
                    { text: 'Engine 4 Start', action: 'INITIATE' },
                    { text: 'Engine 3 Start', action: 'INITIATE' },
                    { text: 'Engine 2 Start', action: 'INITIATE' },
                    { text: 'Engine 1 Start', action: 'INITIATE' },
                    { text: 'APU', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Flaps', action: '10°' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Taxi Light', action: 'ON' },
                    { text: 'Transponder', action: 'TA ONLY' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'TAKEOFF' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Auto Throttle', action: 'ARM' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Strobe', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Landing Lights', action: 'OFF' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Seat Belt Signs', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: '30°' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Autobrake', action: 'SET' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engines', action: 'CUTOFF' },
                    { text: 'APU', action: 'START' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Seat Belt Signs', action: 'OFF' }
                ]
            }
        }
};


AIRCRAFT_CHECKLISTS.b7478 = {
        name: 'Boeing 747-8',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'APU', action: 'START' },
                    { text: 'IRS', action: 'NAV' },
                    { text: 'Hydraulic Pumps', action: 'CHECK' },
                    { text: 'Flight Management', action: 'PROGRAM' },
                    { text: 'Emergency Equipment', action: 'CHECK' }
                ]
            },
            'before-start': {
                name: 'Before Start',
                items: [
                    { text: 'Doors', action: 'CLOSED' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Passenger Signs', action: 'ON' },
                    { text: 'Window Heat', action: 'ON' },
                    { text: 'Hydraulic Demand Pumps', action: 'AUTO' },
                    { text: 'Parking Brake', action: 'SET' }
                ]
            },
            'after-start': {
                name: 'After Start',
                items: [
                    { text: 'Engine Start Levers', action: 'IDLE' },
                    { text: 'Engine Parameters', action: 'CHECK' },
                    { text: 'APU', action: 'OFF' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'Probe Heat', action: 'ON' },
                    { text: 'Anti-Ice', action: 'AS REQ' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Flaps', action: '10°' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Taxi Light', action: 'ON' },
                    { text: 'Transponder', action: 'TA ONLY' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Trim', action: 'SET' }
                ]
            },
            'before-takeoff': {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'T/O POSITION' },
                    { text: 'Stabilizer Trim', action: 'SET' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Strobe Lights', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'T/O Config Warning', action: 'CHECK' }
                ]
            },
            'after-takeoff': {
                name: 'After Takeoff',
                items: [
                    { text: 'Gear', action: 'UP' },
                    { text: 'Flaps', action: 'UP ON SCHEDULE' },
                    { text: 'Autopilot', action: 'ENGAGE' },
                    { text: 'Auto Throttle', action: 'ARM' },
                    { text: 'Altimeter', action: 'SET' },
                    { text: 'Engine Bleeds', action: 'CHECK' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'Fuel', action: 'MONITOR/BALANCE' },
                    { text: 'Center Tank Pumps', action: 'OFF WHEN EMPTY' },
                    { text: 'Landing Lights', action: 'OFF' },
                    { text: 'Pressurization', action: 'MONITOR' }
                ]
            },
            descent: {
                name: 'Descent',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Approach', action: 'BRIEFED' },
                    { text: 'Landing Altitude', action: 'SET' },
                    { text: 'Navigation', action: 'VERIFIED' },
                    { text: 'Auto Brake', action: 'SET' },
                    { text: 'Seat Belt Signs', action: 'ON' }
                ]
            },
            approach: {
                name: 'Approach',
                items: [
                    { text: 'Altimeters', action: 'SET & CROSSCHECK' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Speed Brake', action: 'ARM' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Missed Approach', action: 'REVIEWED' }
                ]
            },
            landing: {
                name: 'Landing',
                items: [
                    { text: 'Gear', action: 'DOWN & 4 GREEN' },
                    { text: 'Flaps', action: '25° or 30°' },
                    { text: 'Speed Brake', action: 'ARM' },
                    { text: 'Autobrake', action: 'VERIFY' },
                    { text: 'Cabin', action: 'SECURE' }
                ]
            },
            'after-landing': {
                name: 'After Landing',
                items: [
                    { text: 'Speed Brake', action: 'DOWN' },
                    { text: 'Flaps', action: 'UP' },
                    { text: 'Strobe Lights', action: 'OFF' },
                    { text: 'Landing Lights', action: 'OFF' },
                    { text: 'Taxi Lights', action: 'ON' },
                    { text: 'APU', action: 'START' },
                    { text: 'Transponder', action: 'STANDBY' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine Start Levers', action: 'CUTOFF' },
                    { text: 'Seat Belt Signs', action: 'OFF' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Fuel Pumps', action: 'OFF' },
                    { text: 'Window Heat', action: 'OFF' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'APU', action: 'AS REQ' }
                ]
            }
        }
};


AIRCRAFT_CHECKLISTS.b787 = {
        name: 'Boeing 787',
        checklists: {
            preflight: {
                name: 'Cockpit Prep',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'External Power', action: 'ON' },
                    { text: 'APU', action: 'START' },
                    { text: 'IRS', action: 'ON' },
                    { text: 'FMS', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Fuel Pumps', action: 'ON' },
                    { text: 'Engine L Start', action: 'ON' },
                    { text: 'EGT', action: 'MONITOR' },
                    { text: 'Engine R Start', action: 'ON' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'APU', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Flaps', action: 'SET' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Trim', action: 'SET' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'VERIFY' },
                    { text: 'Auto Throttle', action: 'ARM' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Speed Brake', action: 'ARM' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Autobrake', action: 'SET' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engines', action: 'CUTOFF' },
                    { text: 'APU', action: 'AS REQ' },
                    { text: 'Beacon', action: 'OFF' }
                ]
            }
        }
};

