/**
 * Flight Procedures Knowledge Base
 * Type: data | Category: ai-autopilot
 * Path: ui/ai-autopilot/data/flight-procedures.js
 *
 * Compiled from:
 *   - ui/checklist-widget/data/aircraft-ga.js (C172 checklists, 7 phases, 110 items)
 *   - ui/copilot-widget/data/checklists.js (simplified C172 procedures)
 *   - ui/copilot-widget/data/emergency-procedures.js (6 emergency procedures)
 *
 * Used by the rule engine for procedure-aware flight phase management.
 */

const FLIGHT_PROCEDURES = {
    C172: {
        preflight: {
            checklist: [
                'Parking brake — SET',
                'Control wheel lock — REMOVE',
                'Fuel selector — BOTH',
                'Fuel shutoff valve — ON (push full in)',
                'Avionics master — OFF',
                'Master switch — ON',
                'Fuel quantity — CHECK',
                'Flaps — EXTEND and CHECK',
                'Pitot heat — CHECK then OFF',
                'Master switch — OFF'
            ],
            verify: {}
        },
        engineStart: {
            checklist: [
                'Preflight inspection — COMPLETE',
                'Seats/belts — ADJUSTED and LOCKED',
                'Brakes — TEST and SET',
                'Avionics — OFF',
                'Fuel selector — BOTH',
                'Mixture — RICH',
                'Carburetor heat — COLD',
                'Throttle — OPEN 1/4 INCH',
                'Master switch — ON',
                'Beacon — ON',
                'Ignition — START',
                'Oil pressure — CHECK',
                'Avionics master — ON'
            ],
            verify: {
                parkingBrake: { equals: true, desc: 'SET' }
            }
        },
        taxi: {
            checklist: [
                'Parking brake — RELEASE',
                'Brakes — CHECK during taxi',
                'Flight instruments — CHECK',
                'Heading indicator — SET to magnetic compass',
                'Attitude indicator — CHECK',
                'Navigation lights — AS REQUIRED',
                'Taxi lights — ON'
            ],
            verify: {
                parkingBrake: { equals: false, desc: 'RELEASED' }
            }
        },
        beforeTakeoff: {
            checklist: [
                'Seats/belts — SECURE',
                'Flight controls — FREE AND CORRECT',
                'Fuel selector — BOTH',
                'Mixture — RICH',
                'Throttle — 1800 RPM (runup)',
                'Magnetos — CHECK (125 RPM MAX DROP)',
                'Carb heat — CHECK',
                'Throttle — 1000 RPM',
                'Flaps — SET for takeoff (0-10\u00B0)',
                'Trim — TAKEOFF POSITION',
                'Transponder — ALT',
                'Lights — ON (landing, strobe)'
            ],
            verify: {
                mixture: { min: 95, desc: 'RICH' },
                flapsIndex: { max: 1, desc: '0-10\u00B0' },
                parkingBrake: { equals: false, desc: 'RELEASED' }
            }
        },
        takeoffRoll: {
            sequence: [
                { action: 'THROTTLE_SET', value: 100, desc: 'Full throttle' },
                { action: 'MIXTURE_SET', value: 100, desc: 'Mixture rich' },
                { waitFor: 'speed >= Vr (55)', desc: 'Accelerate to rotation speed' }
            ]
        },
        rotate: {
            trigger: 'speed >= 55 KIAS',
            sequence: [
                { action: 'AXIS_ELEVATOR_SET', value: -25, desc: 'Rotate ~10\u00B0 pitch up' },
                { waitFor: '!onGround', desc: 'Liftoff' }
            ]
        },
        initialClimb: {
            trigger: 'airborne && AGL > 50',
            sequence: [
                { action: 'AXIS_ELEVATOR_SET', value: 0, desc: 'Release back-pressure' },
                { waitFor: 'VS > 200 && AGL > 200', desc: 'Positive climb established' },
                { action: 'AP_MASTER', desc: 'Engage autopilot' },
                { action: 'AP_HDG_HOLD', desc: 'Hold runway heading' },
                { action: 'AP_VS_HOLD', desc: 'VS hold' },
                { action: 'AP_VS_VAR_SET', value: 700, desc: '+700 fpm climb' }
            ]
        },
        departure: {
            trigger: 'AGL > 500',
            sequence: [
                { action: 'FLAPS_UP', desc: 'Retract flaps' },
                { action: 'AP_SPD_VAR_SET', value: 74, desc: 'Vy climb speed' },
                { action: 'AP_ALT_VAR_SET', value: 'cruiseAlt', desc: 'Set cruise altitude' }
            ]
        },
        climb: {
            checklist: [
                'Airspeed — 70-80 KIAS (Vy)',
                'Throttle — FULL',
                'Mixture — RICH (below 3000 ft)',
                'Flaps — UP',
                'Engine instruments — MONITOR',
                'Trim — ADJUST for climb'
            ],
            targets: {
                speed: 74,      // Vy
                vs: 700,        // fpm
                flaps: 0
            }
        },
        cruise: {
            checklist: [
                'Altitude — MAINTAIN',
                'Throttle — SET cruise power (2200-2400 RPM)',
                'Mixture — LEAN for altitude',
                'Trim — ADJUST for level flight',
                'Engine instruments — MONITOR',
                'Fuel selector — BOTH',
                'Radios — SET as required'
            ],
            targets: {
                speed: 110,     // Vcruise
                vs: 0
            }
        },
        descent: {
            checklist: [
                'ATIS/weather — OBTAIN',
                'Altimeter — SET',
                'Mixture — ENRICH as descending',
                'Carburetor heat — AS REQUIRED',
                'Throttle — REDUCE for descent',
                'Trim — ADJUST for descent'
            ],
            targets: {
                speed: 100,
                vs: -500
            }
        },
        approach: {
            checklist: [
                'ATIS — RECEIVED',
                'Altimeter — SET to local',
                'Fuel selector — BOTH',
                'Mixture — RICH',
                'Carburetor heat — ON',
                'Flaps — AS REQUIRED',
                'Airspeed — 65-75 KIAS',
                'Landing lights — ON',
                'Autopilot — DISENGAGE below 200 AGL'
            ],
            targets: {
                speed: 75,
                vs: -400
            }
        },
        landing: {
            checklist: [
                'Airspeed — 60-65 KIAS (Vref)',
                'Flaps — FULL (30\u00B0)',
                'Mixture — RICH',
                'Carb heat — ON',
                'Autopilot — OFF',
                'Flare — at 10-20 ft AGL',
                'Throttle — IDLE at touchdown',
                'Brakes — AS REQUIRED after touchdown'
            ],
            targets: {
                speed: 60,
                flaps: 3        // full flaps
            }
        },
        emergencies: {
            engineFailure: {
                critical: true,
                steps: [
                    'Airspeed — BEST GLIDE (68 KIAS)',
                    'Mixture — RICH',
                    'Fuel selector — BOTH',
                    'Fuel pump — ON',
                    'Ignition — BOTH/START',
                    'If no restart — LAND ASAP',
                    'Squawk — 7700',
                    'Mayday — DECLARE'
                ]
            },
            engineFire: {
                critical: true,
                steps: [
                    'Mixture — CUTOFF',
                    'Fuel selector — OFF',
                    'Master — OFF',
                    'Cabin heat/air — OFF',
                    'Airspeed — 100 KIAS (slip to clear smoke)',
                    'Forced landing — EXECUTE',
                    'Squawk — 7700'
                ]
            },
            electricalFailure: {
                critical: false,
                steps: [
                    'Master — OFF THEN ON',
                    'Circuit breakers — CHECK',
                    'Alternator — CHECK',
                    'Non-essential — OFF (load shed)',
                    'Battery — MONITOR',
                    'Land — NEAREST SUITABLE'
                ]
            }
        }
    }
};

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FLIGHT_PROCEDURES };
}
