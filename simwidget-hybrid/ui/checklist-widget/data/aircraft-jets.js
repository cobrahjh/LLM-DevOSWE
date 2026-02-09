// Business & Regional Jet Aircraft Checklists
// Loaded on-demand when jet aircraft selected
// AIRCRAFT_CHECKLISTS is declared in aircraft-registry.js

AIRCRAFT_CHECKLISTS.cj4 = {
        name: 'Cessna CJ4',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Exterior', action: 'INSPECT' },
                    { text: 'Documents', action: 'CHECK' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Throttle L', action: 'CUTOFF' },
                    { text: 'Engine L Start', action: 'ON' },
                    { text: 'At 20% N2', action: 'THROTTLE IDLE' },
                    { text: 'ITT', action: 'MONITOR' },
                    { text: 'Throttle R', action: 'CUTOFF' },
                    { text: 'Engine R Start', action: 'ON' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Flaps', action: '15°' },
                    { text: 'Trims', action: 'SET' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Brakes', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: '15°' },
                    { text: 'Spoilers', action: 'RETRACT' },
                    { text: 'Trims', action: 'SET' },
                    { text: 'Transponder', action: 'ON' },
                    { text: 'Ice Protection', action: 'AS REQ' },
                    { text: 'Lights', action: 'ON' },
                    { text: 'TOGA', action: 'ARM' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Pressurization', action: 'CHECK' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Speed Brake', action: 'AS REQ' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: '35°' },
                    { text: 'Speed', action: 'VREF' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Throttles', action: 'CUTOFF' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
};

AIRCRAFT_CHECKLISTS.longitude = {
        name: 'Cessna Longitude',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel', action: 'CHECK' },
                    { text: 'Exterior', action: 'INSPECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Engine L', action: 'START' },
                    { text: 'FADEC', action: 'MONITOR' },
                    { text: 'Engine R', action: 'START' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'External Power', action: 'DISCONNECT' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Flaps', action: 'T/O' },
                    { text: 'Trims', action: 'SET' },
                    { text: 'Flight Controls', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'T/O' },
                    { text: 'Spoilers', action: 'RETRACT' },
                    { text: 'Trims', action: 'SET' },
                    { text: 'Auto Throttle', action: 'ON' },
                    { text: 'Transponder', action: 'ON' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Altitude', action: 'SET' },
                    { text: 'Autopilot', action: 'ENGAGE' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Speed Brake', action: 'AS REQ' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Auto Throttle', action: 'OFF' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engines', action: 'CUTOFF' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
};

AIRCRAFT_CHECKLISTS.crj700 = {
        name: 'Bombardier CRJ-700',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery Master', action: 'ON' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'Emergency Lights', action: 'ARM' },
                    { text: 'IRU', action: 'NAV' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Hydraulic Quantity', action: 'CHECK' },
                    { text: 'Flight Controls', action: 'CHECK' }
                ]
            },
            'before-start': {
                name: 'Before Start',
                items: [
                    { text: 'Doors', action: 'CLOSED' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Thrust Levers', action: 'IDLE' },
                    { text: 'Fuel Pumps', action: 'ON' },
                    { text: 'APU', action: 'RUNNING' },
                    { text: 'FMS', action: 'PROGRAMMED' }
                ]
            },
            'after-start': {
                name: 'After Start',
                items: [
                    { text: 'Engine Bleeds', action: 'ON' },
                    { text: 'APU Bleed', action: 'OFF' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'Probe Heat', action: 'ON' },
                    { text: 'Hydraulics', action: 'CHECK' },
                    { text: 'Flaps', action: 'T/O POSITION' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Parking Brake', action: 'RELEASE' },
                    { text: 'Nose Wheel Steering', action: 'CHECK' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Flight Instruments', action: 'CHECK' },
                    { text: 'Taxi Lights', action: 'ON' },
                    { text: 'Nav Lights', action: 'ON' }
                ]
            },
            'before-takeoff': {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: '8° or 20°' },
                    { text: 'Slats', action: 'EXTENDED' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Strobe Lights', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'T.O. Config', action: 'CHECK' }
                ]
            },
            'after-takeoff': {
                name: 'After Takeoff',
                items: [
                    { text: 'Gear', action: 'UP' },
                    { text: 'Flaps/Slats', action: 'RETRACT ON SCHEDULE' },
                    { text: 'Autopilot', action: 'ENGAGE' },
                    { text: 'Yaw Damper', action: 'CHECK' },
                    { text: 'Pressurization', action: 'CHECK' },
                    { text: 'Anti-Ice', action: 'AS REQ' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'EICAS', action: 'CHECK' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Landing Lights', action: 'OFF' },
                    { text: 'Altimeters', action: 'CROSSCHECK' }
                ]
            },
            descent: {
                name: 'Descent',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Approach', action: 'BRIEFED' },
                    { text: 'Landing Elevation', action: 'SET' },
                    { text: 'FMS', action: 'APPROACH SET' },
                    { text: 'Passenger Signs', action: 'ON' },
                    { text: 'Anti-Ice', action: 'AS REQ' }
                ]
            },
            approach: {
                name: 'Approach',
                items: [
                    { text: 'Altimeters', action: 'SET' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Speed Brake', action: 'AS REQ' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps/Slats', action: 'AS REQ' },
                    { text: 'Spoilers', action: 'ARM' }
                ]
            },
            landing: {
                name: 'Landing',
                items: [
                    { text: 'Gear', action: 'DOWN & 3 GREEN' },
                    { text: 'Flaps', action: '45°' },
                    { text: 'Slats', action: 'EXTENDED' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Autopilot', action: 'AS REQ' },
                    { text: 'Go Around', action: 'REVIEWED' }
                ]
            },
            'after-landing': {
                name: 'After Landing',
                items: [
                    { text: 'Spoilers', action: 'RETRACT' },
                    { text: 'Flaps/Slats', action: 'RETRACT' },
                    { text: 'APU', action: 'START' },
                    { text: 'Strobe Lights', action: 'OFF' },
                    { text: 'Landing Lights', action: 'OFF' },
                    { text: 'Transponder', action: 'STANDBY' },
                    { text: 'Radar', action: 'OFF' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Thrust Levers', action: 'CUTOFF' },
                    { text: 'Engine Bleeds', action: 'OFF' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Seat Belt Signs', action: 'OFF' },
                    { text: 'Fuel Pumps', action: 'OFF' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'APU', action: 'AS REQ' }
                ]
            }
        }
};
