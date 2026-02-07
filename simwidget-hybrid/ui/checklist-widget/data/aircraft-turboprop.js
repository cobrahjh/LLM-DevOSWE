// Turboprop Aircraft Checklists
// Loaded on-demand when turboprop aircraft selected

const AIRCRAFT_CHECKLISTS = AIRCRAFT_CHECKLISTS || {};

AIRCRAFT_CHECKLISTS.tbm930 = {
    name: 'TBM 930',
    checklists: {
        preflight: {
            name: 'Pre-Flight',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Battery', action: 'ON' },
                { text: 'Fuel Quantity', action: 'CHECK' },
                { text: 'De-Ice', action: 'CHECK' },
                { text: 'Exterior', action: 'INSPECT' }
            ]
        },
        startup: {
            name: 'Engine Start',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Battery', action: 'ON' },
                { text: 'Generator', action: 'MAIN ON' },
                { text: 'Aux BP', action: 'ON' },
                { text: 'Ignition', action: 'AUTO' },
                { text: 'Inertial Sep', action: 'ON' },
                { text: 'Prop', action: 'FEATHER' },
                { text: 'Starter', action: 'ON' },
                { text: 'At 13% NG', action: 'FUEL ON' },
                { text: 'ITT', action: 'MONITOR' },
                { text: 'At 50% NG', action: 'STARTER OFF' },
                { text: 'Prop', action: 'HIGH RPM' },
                { text: 'Aux BP', action: 'OFF' },
                { text: 'Avionics', action: 'ON' }
            ]
        },
        taxi: {
            name: 'Taxi',
            items: [
                { text: 'Trims', action: 'SET' },
                { text: 'Flight Controls', action: 'CHECK' },
                { text: 'Brakes', action: 'CHECK' },
                { text: 'Taxi Light', action: 'ON' }
            ]
        },
        takeoff: {
            name: 'Before Takeoff',
            items: [
                { text: 'Flaps', action: 'TAKEOFF' },
                { text: 'Trims', action: 'SET' },
                { text: 'Prop', action: 'HIGH RPM' },
                { text: 'Inertial Sep', action: 'AUTO' },
                { text: 'Transponder', action: 'ON' },
                { text: 'Landing Lights', action: 'ON' },
                { text: 'Strobe', action: 'ON' }
            ]
        },
        cruise: {
            name: 'Cruise',
            items: [
                { text: 'Power', action: 'SET' },
                { text: 'Prop', action: '1900 RPM' },
                { text: 'Fuel', action: 'MONITOR' },
                { text: 'Pressurization', action: 'CHECK' }
            ]
        },
        landing: {
            name: 'Before Landing',
            items: [
                { text: 'Prop', action: 'HIGH RPM' },
                { text: 'Flaps', action: 'LANDING' },
                { text: 'Gear', action: 'DOWN' },
                { text: 'Airspeed', action: '85 KIAS' }
            ]
        },
        shutdown: {
            name: 'Shutdown',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Avionics', action: 'OFF' },
                { text: 'Fuel', action: 'OFF' },
                { text: 'Generator', action: 'OFF' },
                { text: 'Battery', action: 'OFF' }
            ]
        }
    }
},

AIRCRAFT_CHECKLISTS.pc12 = {
    name: 'Pilatus PC-12',
    checklists: {
        preflight: {
            name: 'Pre-Flight',
            items: [
                { text: 'Battery', action: 'ON' },
                { text: 'Fuel Quantity', action: 'CHECK' },
                { text: 'Oil', action: 'CHECK' },
                { text: 'Battery', action: 'OFF' },
                { text: 'Exterior', action: 'INSPECT' }
            ]
        },
        startup: {
            name: 'Engine Start',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Battery', action: 'ON' },
                { text: 'Generator', action: 'ON' },
                { text: 'Beacon', action: 'ON' },
                { text: 'Condition', action: 'GROUND IDLE' },
                { text: 'Ignition', action: 'ON' },
                { text: 'Starter', action: 'ON' },
                { text: 'At 13% NG', action: 'CONDITION LO' },
                { text: 'ITT', action: 'MONITOR' },
                { text: 'At 50% NG', action: 'STARTER OFF' },
                { text: 'Avionics', action: 'ON' }
            ]
        },
        taxi: {
            name: 'Taxi',
            items: [
                { text: 'Flaps', action: '15°' },
                { text: 'Trims', action: 'SET' },
                { text: 'Brakes', action: 'CHECK' }
            ]
        },
        takeoff: {
            name: 'Before Takeoff',
            items: [
                { text: 'Flaps', action: '15°' },
                { text: 'Trims', action: 'SET' },
                { text: 'Condition', action: 'MAX' },
                { text: 'Props', action: '1700 RPM' },
                { text: 'Transponder', action: 'ON' },
                { text: 'Lights', action: 'ON' },
                { text: 'Ice Protection', action: 'AS REQ' }
            ]
        },
        cruise: {
            name: 'Cruise',
            items: [
                { text: 'Power', action: 'SET' },
                { text: 'Props', action: 'SET' },
                { text: 'Pressurization', action: 'CHECK' }
            ]
        },
        landing: {
            name: 'Before Landing',
            items: [
                { text: 'Props', action: 'MAX' },
                { text: 'Gear', action: 'DOWN' },
                { text: 'Flaps', action: '40°' },
                { text: 'Speed', action: '100 KIAS' }
            ]
        },
        shutdown: {
            name: 'Shutdown',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Condition', action: 'CUTOFF' },
                { text: 'Avionics', action: 'OFF' },
                { text: 'Battery', action: 'OFF' }
            ]
        }
    }
},

AIRCRAFT_CHECKLISTS.kingair = {
    name: 'King Air 350',
    checklists: {
        preflight: {
            name: 'Pre-Flight',
            items: [
                { text: 'Battery', action: 'ON' },
                { text: 'Fuel Quantity', action: 'CHECK' },
                { text: 'Props', action: 'CHECK' },
                { text: 'Exterior', action: 'INSPECT' }
            ]
        },
        startup: {
            name: 'Engine Start',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Battery', action: 'ON' },
                { text: 'Beacon', action: 'ON' },
                { text: 'Condition L', action: 'LO IDLE' },
                { text: 'Start L', action: 'ENGAGE' },
                { text: 'At 12% NG', action: 'FUEL ON' },
                { text: 'ITT', action: 'MONITOR' },
                { text: 'Condition R', action: 'LO IDLE' },
                { text: 'Start R', action: 'ENGAGE' },
                { text: 'Generators', action: 'ON' },
                { text: 'Avionics', action: 'ON' }
            ]
        },
        taxi: {
            name: 'Taxi',
            items: [
                { text: 'Flaps', action: 'APPROACH' },
                { text: 'Flight Controls', action: 'CHECK' },
                { text: 'Brakes', action: 'CHECK' }
            ]
        },
        takeoff: {
            name: 'Before Takeoff',
            items: [
                { text: 'Flaps', action: 'APPROACH' },
                { text: 'Trims', action: 'SET' },
                { text: 'Props', action: 'MAX' },
                { text: 'Condition', action: 'HIGH' },
                { text: 'Auto Feather', action: 'ARM' },
                { text: 'Transponder', action: 'ON' },
                { text: 'Lights', action: 'ON' }
            ]
        },
        cruise: {
            name: 'Cruise',
            items: [
                { text: 'Power', action: 'SET' },
                { text: 'Props', action: 'SET' },
                { text: 'Pressurization', action: 'CHECK' }
            ]
        },
        landing: {
            name: 'Before Landing',
            items: [
                { text: 'Props', action: 'MAX' },
                { text: 'Gear', action: 'DOWN' },
                { text: 'Flaps', action: 'FULL' },
                { text: 'Speed', action: '120 KIAS' }
            ]
        },
        shutdown: {
            name: 'Shutdown',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Condition', action: 'CUTOFF' },
                { text: 'Avionics', action: 'OFF' },
                { text: 'Battery', action: 'OFF' }
            ]
        }
    }
},

AIRCRAFT_CHECKLISTS.atr72 = {
    name: 'ATR 72-600',
    checklists: {
        preflight: {
            name: 'Pre-Flight',
            items: [
                { text: 'Battery', action: 'ON' },
                { text: 'External Power', action: 'CONNECT' },
                { text: 'Emergency Equipment', action: 'CHECK' },
                { text: 'Fuel Quantity', action: 'CHECK' },
                { text: 'Oil Quantity', action: 'CHECK' },
                { text: 'Circuit Breakers', action: 'CHECK' },
                { text: 'Flight Controls', action: 'FREE' }
            ]
        },
        'before-start': {
            name: 'Before Start',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Beacon', action: 'ON' },
                { text: 'Prop Levers', action: 'FEATHER' },
                { text: 'Condition Levers', action: 'FUEL OFF' },
                { text: 'Fuel Pumps', action: 'ON' },
                { text: 'Passengers Signs', action: 'ON' },
                { text: 'Doors', action: 'CLOSED' }
            ]
        },
        'after-start': {
            name: 'After Start',
            items: [
                { text: 'Generators', action: 'ON' },
                { text: 'External Power', action: 'DISCONNECT' },
                { text: 'Bleed Air', action: 'CHECK' },
                { text: 'Props', action: 'MAX RPM' },
                { text: 'Hydraulics', action: 'CHECK' },
                { text: 'Flaps', action: 'CHECK' }
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
                { text: 'Props', action: 'CHECK' }
            ]
        },
        'before-takeoff': {
            name: 'Before Takeoff',
            items: [
                { text: 'Flaps', action: '15°' },
                { text: 'Trims', action: 'SET' },
                { text: 'Props', action: 'MAX RPM' },
                { text: 'Condition Levers', action: 'MAX' },
                { text: 'Transponder', action: 'ON' },
                { text: 'Strobe Lights', action: 'ON' },
                { text: 'Landing Lights', action: 'ON' },
                { text: 'T.O. Config', action: 'CHECK' }
            ]
        },
        'after-takeoff': {
            name: 'After Takeoff',
            items: [
                { text: 'Gear', action: 'UP' },
                { text: 'Flaps', action: 'RETRACT' },
                { text: 'Autopilot', action: 'ENGAGE' },
                { text: 'Props', action: 'SET CLIMB' },
                { text: 'Altimeter', action: 'SET' },
                { text: 'Pressurization', action: 'CHECK' }
            ]
        },
        cruise: {
            name: 'Cruise',
            items: [
                { text: 'Power Levers', action: 'SET CRUISE' },
                { text: 'Props', action: 'SET CRUISE RPM' },
                { text: 'Condition Levers', action: 'AS REQ' },
                { text: 'Fuel', action: 'MONITOR' },
                { text: 'Seat Belt Signs', action: 'AS REQ' },
                { text: 'Landing Lights', action: 'OFF' }
            ]
        },
        descent: {
            name: 'Descent',
            items: [
                { text: 'ATIS', action: 'RECEIVED' },
                { text: 'Approach', action: 'BRIEFED' },
                { text: 'Landing Altitude', action: 'SET' },
                { text: 'Props', action: 'CHECK' },
                { text: 'Passenger Signs', action: 'ON' },
                { text: 'Ice Protection', action: 'AS REQ' }
            ]
        },
        approach: {
            name: 'Approach',
            items: [
                { text: 'Altimeters', action: 'SET' },
                { text: 'Landing Lights', action: 'ON' },
                { text: 'Props', action: 'MAX RPM' },
                { text: 'Condition Levers', action: 'MAX' },
                { text: 'Gear', action: 'DOWN' },
                { text: 'Flaps', action: 'AS REQ' }
            ]
        },
        landing: {
            name: 'Landing',
            items: [
                { text: 'Gear', action: 'DOWN & 3 GREEN' },
                { text: 'Flaps', action: '30°' },
                { text: 'Props', action: 'MAX RPM' },
                { text: 'Condition Levers', action: 'MAX' },
                { text: 'Auto Pilot', action: 'OFF' },
                { text: 'Go Around', action: 'REVIEWED' }
            ]
        },
        'after-landing': {
            name: 'After Landing',
            items: [
                { text: 'Flaps', action: 'UP' },
                { text: 'Props', action: 'MAX RPM' },
                { text: 'Strobe Lights', action: 'OFF' },
                { text: 'Landing Lights', action: 'OFF' },
                { text: 'Taxi Lights', action: 'ON' },
                { text: 'Transponder', action: 'STANDBY' },
                { text: 'Ice Protection', action: 'OFF' }
            ]
        },
        shutdown: {
            name: 'Shutdown',
            items: [
                { text: 'Parking Brake', action: 'SET' },
                { text: 'Condition Levers', action: 'FUEL OFF' },
                { text: 'Props', action: 'FEATHER' },
                { text: 'Beacon', action: 'OFF' },
                { text: 'Seat Belt Signs', action: 'OFF' },
                { text: 'Fuel Pumps', action: 'OFF' },
                { text: 'External Power', action: 'AS REQ' },
                { text: 'Battery', action: 'OFF' }
            ]
        }
    }
}
