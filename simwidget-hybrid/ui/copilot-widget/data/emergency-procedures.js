// Emergency Procedures - Loaded on-demand when Emergency mode activated
// Part of code splitting optimization for Copilot Widget v3.0.0

// Populate the global EMERGENCY_PROCEDURES object (defined in glass.js as empty)
Object.assign(EMERGENCY_PROCEDURES, {
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
});

// Data successfully loaded into global EMERGENCY_PROCEDURES object
console.log('[Copilot] Loaded', Object.keys(EMERGENCY_PROCEDURES).length, 'emergency procedures');
