// General Aviation Aircraft Checklists
// Loaded on-demand when GA aircraft selected
// AIRCRAFT_CHECKLISTS is declared in aircraft-registry.js

AIRCRAFT_CHECKLISTS.generic = {
        name: 'Generic GA',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Avionics Master', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Flaps', action: 'UP' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Throttle', action: 'IDLE' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Fuel Pump', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Master', action: 'ON' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil Pressure', action: 'GREEN' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Altimeter', action: 'SET' },
                    { text: 'Nav Lights', action: 'ON' },
                    { text: 'Brakes', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Takeoff',
                items: [
                    { text: 'Flaps', action: 'SET' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Mixture', action: 'LEAN' },
                    { text: 'Autopilot', action: 'AS REQ' }
                ]
            },
            landing: {
                name: 'Landing',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'CUTOFF' },
                    { text: 'Master', action: 'OFF' }
                ]
            }
        }
    };


AIRCRAFT_CHECKLISTS.c172 = {
        name: 'Cessna 172 Skyhawk',
        checklists: {
            preflight: {
                name: 'Pre-Flight Inspection',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Control Lock', action: 'REMOVE' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Avionics Master', action: 'OFF' },
                    { text: 'Master Switch', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Fuel Shutoff Valve', action: 'ON' },
                    { text: 'Static Source', action: 'OPEN' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Preflight', action: 'COMPLETE' },
                    { text: 'Seats/Belts', action: 'ADJUST & LOCK' },
                    { text: 'Brakes', action: 'TEST & SET' },
                    { text: 'Circuit Breakers', action: 'CHECK IN' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Fuel Shutoff', action: 'ON' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Carburetor Heat', action: 'COLD' },
                    { text: 'Throttle', action: 'OPEN 1/4"' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Beacon Light', action: 'ON' },
                    { text: 'Prime', action: '3-5 STROKES' },
                    { text: 'Throttle', action: 'OPEN 1/2"' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil Pressure', action: 'CHECK GREEN' },
                    { text: 'Avionics Master', action: 'ON' },
                    { text: 'Flaps', action: 'RETRACT' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Parking Brake', action: 'RELEASE' },
                    { text: 'Taxi Light', action: 'ON' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Heading Indicator', action: 'SET' },
                    { text: 'Attitude Indicator', action: 'CHECK' },
                    { text: 'Turn Coordinator', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Seats/Belts', action: 'CHECK' },
                    { text: 'Doors/Windows', action: 'CLOSED & LOCKED' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' },
                    { text: 'Instruments', action: 'CHECK' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Throttle', action: '1800 RPM' },
                    { text: 'Magnetos', action: 'CHECK (125 RPM MAX DROP)' },
                    { text: 'Carburetor Heat', action: 'CHECK' },
                    { text: 'Engine Instruments', action: 'CHECK GREEN' },
                    { text: 'Throttle', action: '1000 RPM' },
                    { text: 'Flaps', action: '0-10°' },
                    { text: 'Trim', action: 'SET TAKEOFF' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'LANDING, NAV, STROBE ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: '2100-2400 RPM' },
                    { text: 'Mixture', action: 'LEAN FOR ALTITUDE' },
                    { text: 'Trim', action: 'ADJUST' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Engine Instruments', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Seats/Belts', action: 'SECURE' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Carburetor Heat', action: 'ON (AS REQ)' },
                    { text: 'Landing Light', action: 'ON' },
                    { text: 'Autopilot', action: 'OFF' },
                    { text: 'Flaps', action: 'AS REQUIRED' },
                    { text: 'Airspeed', action: '65-75 KIAS' }
                ]
            },
            shutdown: {
                name: 'Securing Aircraft',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Throttle', action: '1000 RPM' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'IDLE CUTOFF' },
                    { text: 'Ignition', action: 'OFF' },
                    { text: 'Master Switch', action: 'OFF' },
                    { text: 'Control Lock', action: 'INSTALL' },
                    { text: 'Fuel Selector', action: 'LEFT or RIGHT' }
                ]
            }
        }
    };


AIRCRAFT_CHECKLISTS.c208 = {
        name: 'Cessna 208 Caravan',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Oil Level', action: 'CHECK' },
                    { text: 'Exterior', action: 'INSPECT' },
                    { text: 'Control Surfaces', action: 'CHECK' },
                    { text: 'Tires', action: 'CHECK' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Generator', action: 'RESET/ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Condition Lever', action: 'CUTOFF' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Power Lever', action: 'IDLE' },
                    { text: 'Starter', action: 'ON AT 13% NG' },
                    { text: 'Condition Lever', action: 'LOW IDLE' },
                    { text: 'ITT', action: 'MONITOR (MAX 1090°)' },
                    { text: 'Oil Pressure', action: 'CHECK' },
                    { text: 'Generator', action: 'CHECK ONLINE' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Flight Instruments', action: 'CHECK' },
                    { text: 'Nav Lights', action: 'ON' },
                    { text: 'Taxi Light', action: 'ON' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: '20°' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Autopilot', action: 'OFF' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'AS REQUIRED' },
                    { text: 'De-Ice', action: 'AS REQUIRED' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Condition', action: 'HIGH IDLE' },
                    { text: 'Prop', action: 'SET RPM' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Airspeed', action: '85-90 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Power', action: 'IDLE' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Condition', action: 'CUTOFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
    };


AIRCRAFT_CHECKLISTS.da40 = {
        name: 'Diamond DA40',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Documents', action: 'CHECK' },
                    { text: 'Control Lock', action: 'REMOVE' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Flaps', action: 'EXTEND/CHECK' },
                    { text: 'Master Switch', action: 'OFF' },
                    { text: 'Exterior', action: 'INSPECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Seats/Belts', action: 'ADJUST' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Circuit Breakers', action: 'CHECK IN' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Throttle', action: 'IDLE' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Fuel Pump', action: 'ON' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil Pressure', action: 'CHECK' },
                    { text: 'Fuel Pump', action: 'OFF' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'HSI', action: 'SET' },
                    { text: 'Instruments', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flight Controls', action: 'FREE' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Flaps', action: 'T/O' },
                    { text: 'Fuel Pump', action: 'ON' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Mixture', action: 'LEAN' },
                    { text: 'Fuel Pump', action: 'OFF' },
                    { text: 'Engine', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Fuel Pump', action: 'ON' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Speed', action: '73 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'CUTOFF' },
                    { text: 'Master', action: 'OFF' }
                ]
            }
        }
    };


AIRCRAFT_CHECKLISTS.da62 = {
        name: 'Diamond DA62',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Documents', action: 'CHECK' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Flaps', action: 'CHECK' },
                    { text: 'Battery', action: 'OFF' },
                    { text: 'Exterior', action: 'INSPECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'ECU A+B', action: 'ON' },
                    { text: 'Glow', action: 'WAIT' },
                    { text: 'Engine 1', action: 'START' },
                    { text: 'Engine 2', action: 'START' },
                    { text: 'Generators', action: 'ON' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Instruments', action: 'CHECK' },
                    { text: 'Taxi Light', action: 'ON' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Flaps', action: 'T/O' },
                    { text: 'Props', action: 'MAX' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Props', action: 'SET' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Props', action: 'MAX' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Speed', action: '85 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'ECU', action: 'OFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
    };


AIRCRAFT_CHECKLISTS.sr22 = {
        name: 'Cirrus SR22',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'CAPS Pin', action: 'CHECK REMOVED' },
                    { text: 'Bat 1 & 2', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Flaps', action: 'CHECK' },
                    { text: 'Bat 1 & 2', action: 'OFF' },
                    { text: 'Exterior', action: 'INSPECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Bat 1 & 2', action: 'ON' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Throttle', action: '1/4"' },
                    { text: 'Fuel Pump', action: 'BOOST' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil/Fuel', action: 'CHECK' },
                    { text: 'Alt 1 & 2', action: 'ON' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'HSI/CDI', action: 'CHECK' },
                    { text: 'Autopilot', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Flaps', action: '50%' },
                    { text: 'Fuel Pump', action: 'BOOST' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Mixture', action: 'LEAN' },
                    { text: 'Fuel Pump', action: 'OFF' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Fuel Pump', action: 'BOOST' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Flaps', action: '100%' },
                    { text: 'Speed', action: '80 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'CUTOFF' },
                    { text: 'Bat 1 & 2', action: 'OFF' }
                ]
            }
        }
    };

