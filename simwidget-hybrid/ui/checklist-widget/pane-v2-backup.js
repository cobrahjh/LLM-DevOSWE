/**
 * Checklist pane - SimGlass
 * Aircraft-specific checklists for MSFS
 */

// Aircraft-specific checklist definitions
const AIRCRAFT_CHECKLISTS = {
    generic: {
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
    },

    c172: {
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
    },

    c208: {
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
    },

    tbm930: {
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

    a320: {
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
    },

    b747: {
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
    },

    da40: {
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
    },

    da62: {
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
    },

    sr22: {
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
    },

    pc12: {
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

    kingair: {
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

    cj4: {
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
    },

    longitude: {
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
    },

    b737: {
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
    },

    b787: {
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
    },

    a320neo: {
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
    },

    b7478: {
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
    },

    crj700: {
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
    },

    atr72: {
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
};

class ChecklistPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'checklist-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // Local checklist display, no WebSocket
        });

        this.currentAircraft = 'generic';
        this.currentChecklist = 'preflight';
        this.checkedItems = {};
        this.audioEnabled = true;
        this.synth = window.speechSynthesis;

        this.loadState();
        this.initAircraftSelector();
        this.initTabs();
        this.initControls();
        this.renderChecklist();
    }

    get checklists() {
        return AIRCRAFT_CHECKLISTS[this.currentAircraft].checklists;
    }

    loadState() {
        try {
            const saved = localStorage.getItem('checklist-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.checkedItems = state.checkedItems || {};
                this.audioEnabled = state.audioEnabled !== false;
                this.currentAircraft = state.currentAircraft || 'generic';
            }
        } catch (e) {
            console.error('Failed to load checklist state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('checklist-glass-state', JSON.stringify({
                checkedItems: this.checkedItems,
                audioEnabled: this.audioEnabled,
                currentAircraft: this.currentAircraft
            }));
        } catch (e) {
            console.error('Failed to save checklist state:', e);
        }
    }

    initAircraftSelector() {
        const select = document.getElementById('aircraft-select');
        select.value = this.currentAircraft;
        select.addEventListener('change', () => {
            this.currentAircraft = select.value;
            this.currentChecklist = 'preflight';
            this.renderTabs();
            this.renderChecklist();
            this.saveState();
        });
    }

    initTabs() {
        const tabs = document.getElementById('checklist-tabs');
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const checklist = e.target.dataset.checklist;
                this.switchChecklist(checklist);
            }
        });
        this.renderTabs();
    }

    renderTabs() {
        const container = document.getElementById('checklist-tabs');
        container.replaceChildren();

        Object.keys(this.checklists).forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (key === this.currentChecklist ? ' active' : '');
            btn.dataset.checklist = key;
            btn.textContent = this.checklists[key].name;

            // Mark completed
            const itemKey = this.currentAircraft + '_' + key;
            const checked = this.checkedItems[itemKey] || [];
            if (checked.length === this.checklists[key].items.length) {
                btn.classList.add('completed');
            }

            container.appendChild(btn);
        });
    }

    initControls() {
        const audioBtn = document.getElementById('btn-audio');
        audioBtn.classList.toggle('active', this.audioEnabled);
        audioBtn.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            audioBtn.classList.toggle('active', this.audioEnabled);
            audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
            this.saveState();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            this.navigateChecklist(-1);
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            this.navigateChecklist(1);
        });
    }

    switchChecklist(name) {
        this.currentChecklist = name;
        this.renderTabs();
        this.renderChecklist();
    }

    createChecklistItem(item, index, isChecked) {
        const div = document.createElement('div');
        div.className = 'checklist-item' + (isChecked ? ' checked' : '');
        div.dataset.index = index;

        const checkbox = document.createElement('div');
        checkbox.className = 'item-checkbox';

        const content = document.createElement('div');
        content.className = 'item-content';

        const textEl = document.createElement('div');
        textEl.className = 'item-text';
        textEl.textContent = item.text;

        const actionEl = document.createElement('div');
        actionEl.className = 'item-action';
        actionEl.textContent = item.action;

        content.appendChild(textEl);
        content.appendChild(actionEl);
        div.appendChild(checkbox);
        div.appendChild(content);

        div.addEventListener('click', () => {
            this.toggleItem(index);
        });

        return div;
    }

    createCompleteMessage(name) {
        const div = document.createElement('div');
        div.className = 'checklist-complete';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.textContent = '✅';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = name + ' Complete!';

        div.appendChild(icon);
        div.appendChild(text);
        return div;
    }

    renderChecklist() {
        const container = document.getElementById('checklist-container');
        const checklist = this.checklists[this.currentChecklist];

        if (!checklist) return;

        container.replaceChildren();

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const allChecked = checked.length === checklist.items.length;

        if (allChecked) {
            container.appendChild(this.createCompleteMessage(checklist.name));
        } else {
            checklist.items.forEach((item, index) => {
                const isChecked = checked.includes(index);
                container.appendChild(this.createChecklistItem(item, index, isChecked));
            });
        }

        this.updateProgress();
        this.renderTabs();
    }

    toggleItem(index) {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const itemIndex = checked.indexOf(index);

        if (itemIndex === -1) {
            checked.push(index);

            if (this.audioEnabled) {
                const item = checklist.items[index];
                this.speak(item.text + ', ' + item.action);
            }
        } else {
            checked.splice(itemIndex, 1);
        }

        this.saveState();
        this.renderChecklist();
    }

    speak(text) {
        if (!this.synth) return;
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v =>
            v.name.includes('Google UK English Female') ||
            v.name.includes('Microsoft Hazel') ||
            v.lang === 'en-GB'
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.synth.speak(utterance);
    }

    updateProgress() {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];
        const total = checklist.items.length;
        const completed = checked.length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progress-fill').style.width = percent + '%';
        document.getElementById('progress-text').textContent = completed + '/' + total;
    }

    resetChecklist() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        this.checkedItems[itemKey] = [];
        this.saveState();
        this.renderChecklist();
    }

    navigateChecklist(direction) {
        const keys = Object.keys(this.checklists);
        const currentIndex = keys.indexOf(this.currentChecklist);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = keys.length - 1;
        if (newIndex >= keys.length) newIndex = 0;

        this.switchChecklist(keys[newIndex]);
    }

    // Voice control integration
    initVoiceControl() {
        // Listen for voice commands via BroadcastChannel
        const channel = new BroadcastChannel('SimGlass-checklist');
        channel.onmessage = (event) => {
            this.handleVoiceCommand(event.data);
        };

        // Also listen via localStorage for fallback
        window.addEventListener('storage', (event) => {
            if (event.key === 'SimGlass-checklist-command') {
                try {
                    const cmd = JSON.parse(event.newValue);
                    // Only process recent commands (within 2 seconds)
                    if (Date.now() - cmd.timestamp < 2000) {
                        this.handleVoiceCommand(cmd);
                    }
                } catch (e) {
                    if (window.telemetry) {
                        telemetry.captureError(e, {
                            operation: 'voiceCommandParse',
                            glass: 'checklist-glass',
                            rawValue: event.newValue
                        });
                    }
                }
            }
        });
    }

    handleVoiceCommand(cmd) {
        if (!cmd || cmd.type !== 'checklist') return;

        switch (cmd.action) {
            case 'checkNext':
                this.checkNextItem();
                break;
            case 'uncheckLast':
                this.uncheckLastItem();
                break;
            case 'reset':
                this.resetChecklist();
                break;
            case 'nextChecklist':
                this.navigateChecklist(1);
                break;
            case 'prevChecklist':
                this.navigateChecklist(-1);
                break;
            case 'goto':
                if (cmd.target && this.checklists[cmd.target]) {
                    this.switchChecklist(cmd.target);
                }
                break;
        }
    }

    checkNextItem() {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        // Find first unchecked item
        for (let i = 0; i < checklist.items.length; i++) {
            if (!checked.includes(i)) {
                this.toggleItem(i);
                break;
            }
        }
    }

    uncheckLastItem() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];

        if (checked.length > 0) {
            const lastIndex = checked[checked.length - 1];
            this.toggleItem(lastIndex);
        }
    }

    // Multiplayer sync methods
    getState() {
        return {
            aircraft: this.currentAircraft,
            checklist: this.currentChecklist,
            checkedItems: this.checkedItems,
            audioEnabled: this.audioEnabled
        };
    }

    loadState(state) {
        if (!state) return;

        if (state.aircraft && state.aircraft !== this.currentAircraft) {
            this.aircraftSelect.value = state.aircraft;
            this.currentAircraft = state.aircraft;
        }

        if (state.checklist && state.checklist !== this.currentChecklist) {
            this.currentChecklist = state.checklist;
            this.updateTabs();
        }

        if (state.checkedItems) {
            this.checkedItems = state.checkedItems;
        }

        this.renderChecklist();
    }

    handleRemoteAction(action, data) {
        switch (action) {
            case 'toggleItem':
                this.toggleItem(data.index, true);
                break;
            case 'changeChecklist':
                this.currentChecklist = data.checklist;
                this.updateTabs();
                this.renderChecklist();
                break;
            case 'changeAircraft':
                this.aircraftSelect.value = data.aircraft;
                this.currentAircraft = data.aircraft;
                this.renderChecklist();
                break;
            case 'reset':
                this.resetChecklist(true);
                break;
        }
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ChecklistPane = new ChecklistPane();
    window.ChecklistPane.initVoiceControl();
    window.addEventListener('beforeunload', () => window.ChecklistPane?.destroy());
});
