/**
 * Aircraft Performance Profiles
 * Type: data | Category: ai-autopilot
 * Path: ui/ai-autopilot/data/aircraft-profiles.js
 *
 * Contains performance data for rule engine phase commands.
 * Each profile defines speeds, climb/descent rates, and limits.
 */

const AIRCRAFT_PROFILES = {
    C172: {
        name: 'Cessna 172 Skyhawk',
        shortName: 'C172',
        type: 'single-piston',

        // Speeds (KIAS)
        speeds: {
            Vr: 55,         // Rotation
            Vx: 62,         // Best angle of climb
            Vy: 74,         // Best rate of climb
            Vcruise: 110,   // Normal cruise
            Vfe: 85,        // Max flaps extended
            Va: 99,         // Maneuvering speed (at max gross)
            Vno: 129,       // Max structural cruise
            Vne: 163,       // Never exceed
            Vref: 65,       // Approach reference (no flaps)
            VrefFull: 60,   // Approach reference (full flaps)
            Vs0: 48,        // Stall speed (full flaps)
            Vs1: 53         // Stall speed (clean)
        },

        // Climb performance
        climb: {
            normalRate: 700,   // fpm at Vy
            maxRate: 730,      // fpm at sea level
            cruiseClimb: 500,  // fpm during cruise climb
            initialAlt: 500,   // ft AGL to maintain Vy before accelerating
            accelAlt: 1000     // ft AGL to begin accelerating to cruise climb
        },

        // Descent performance
        descent: {
            normalRate: -500,   // fpm
            approachRate: -400, // fpm on approach
            maxRate: -1000,     // fpm limit
            todFactor: 3.0      // NM per 1000ft to lose (3:1 ratio)
        },

        // Limits
        limits: {
            ceiling: 14000,     // service ceiling ft
            maxAlt: 13500,      // practical max alt
            maxVs: 1000,        // max VS fpm
            minVs: -1500,       // min VS fpm
            maxBank: 20,        // max bank degrees for AP
            gearSpeed: 999,     // fixed gear
            flapSpeeds: [85, 85, 85]  // max speed per flap notch
        },

        // Fuel
        fuel: {
            capacity: 56,       // gallons (with long-range tanks)
            usable: 53,         // usable gallons
            burnRate: 8.5,      // gph at cruise
            reserveMin: 45      // minutes reserve required
        },

        // Phase-specific speed targets
        phaseSpeeds: {
            TAKEOFF: 55,
            CLIMB: 74,          // Vy
            CRUISE: 110,
            DESCENT: 100,
            APPROACH: 75,
            LANDING: 60
        }
    }
};

// Default profile
const DEFAULT_PROFILE = 'C172';

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIRCRAFT_PROFILES, DEFAULT_PROFILE };
}
