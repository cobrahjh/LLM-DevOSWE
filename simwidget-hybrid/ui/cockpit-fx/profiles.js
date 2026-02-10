/**
 * CockpitFX Aircraft Profiles v2.0.0
 * Per-aircraft tuning presets for immersion layers.
 * v2.0: sampleSet field — which prerecorded audio set to use.
 *       'c172' = FlightGear C172P samples (piston GA)
 *       null = pure synthesis (turboprop/jet)
 */
const COCKPIT_FX_PROFILES = {
    'ga-single-piston': {
        name: 'GA Single Piston (C172/PA28)',
        sampleSet: 'c172',
        engine: {
            harmonics: 4,
            propBlades: 2,
            idleRpm: 600,
            maxRpm: 2700,
            engines: 1,
            turbineWhine: false,
            n1Tone: false
        },
        stall: { aoaThreshold: 16, buffetFreq: 12, stickShaker: false },
        layers: {
            engine: 1.0,
            aero: 0.8,
            ground: 1.0,
            mechanical: 0.7,
            environment: 0.5,
            warning: 1.0
        }
    },
    'ga-twin-piston': {
        name: 'GA Twin Piston (PA34/BE58)',
        sampleSet: 'c172',
        engine: {
            harmonics: 4,
            propBlades: 3,
            idleRpm: 600,
            maxRpm: 2700,
            engines: 2,
            beatOffset: 0.5,
            turbineWhine: false,
            n1Tone: false
        },
        stall: { aoaThreshold: 15, buffetFreq: 10, stickShaker: false },
        layers: {
            engine: 1.0,
            aero: 0.8,
            ground: 0.9,
            mechanical: 0.8,
            environment: 0.5,
            warning: 1.0
        }
    },
    'turboprop': {
        name: 'Turboprop (TBM/King Air)',
        sampleSet: null,
        engine: {
            harmonics: 3,
            propBlades: 4,
            idleRpm: 1000,
            maxRpm: 2200,
            engines: 1,
            turbineWhine: true,
            n1Tone: false
        },
        stall: { aoaThreshold: 17, buffetFreq: 14, stickShaker: false },
        layers: {
            engine: 0.9,
            aero: 0.9,
            ground: 0.8,
            mechanical: 0.8,
            environment: 0.6,
            warning: 1.0
        }
    },
    'jet': {
        name: 'Jet (CJ4/A320)',
        sampleSet: null,
        engine: {
            harmonics: 0,
            propBlades: 0,
            idleRpm: 0,
            maxRpm: 0,
            engines: 2,
            turbineWhine: false,
            n1Tone: true
        },
        stall: { aoaThreshold: 18, buffetFreq: 15, stickShaker: true },
        layers: {
            engine: 0.7,
            aero: 1.0,
            ground: 0.9,
            mechanical: 0.9,
            environment: 0.5,
            warning: 1.0
        }
    }
};
