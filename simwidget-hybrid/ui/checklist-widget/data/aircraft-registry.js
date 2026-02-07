/**
 * Aircraft Registry - Maps aircraft to their data modules
 * Enables lazy-loading of aircraft checklists by category
 */

const AIRCRAFT_REGISTRY = {
    // General Aviation
    generic: { category: 'ga', name: 'Generic GA' },
    c172: { category: 'ga', name: 'Cessna 172 Skyhawk' },
    c208: { category: 'ga', name: 'Cessna 208 Caravan' },
    da40: { category: 'ga', name: 'Diamond DA40' },
    da62: { category: 'ga', name: 'Diamond DA62' },
    sr22: { category: 'ga', name: 'Cirrus SR22' },

    // Turboprops
    tbm930: { category: 'turboprop', name: 'TBM 930' },
    pc12: { category: 'turboprop', name: 'Pilatus PC-12' },
    kingair: { category: 'turboprop', name: 'King Air 350' },
    atr72: { category: 'turboprop', name: 'ATR 72-600' },

    // Jets (Business + Regional)
    cj4: { category: 'jets', name: 'Citation CJ4' },
    longitude: { category: 'jets', name: 'Citation Longitude' },
    crj700: { category: 'jets', name: 'Bombardier CRJ-700' },

    // Airliners
    a320: { category: 'airliners', name: 'Airbus A320' },
    a320neo: { category: 'airliners', name: 'Airbus A320neo' },
    b737: { category: 'airliners', name: 'Boeing 737' },
    b747: { category: 'airliners', name: 'Boeing 747' },
    b7478: { category: 'airliners', name: 'Boeing 747-8' },
    b787: { category: 'airliners', name: 'Boeing 787' }
};

// Category to file mapping
const CATEGORY_FILES = {
    ga: 'data/aircraft-ga.js',
    turboprop: 'data/aircraft-turboprop.js',
    jets: 'data/aircraft-jets.js',
    airliners: 'data/aircraft-airliners.js'
};

// Loaded categories cache
const loadedCategories = new Set();

// Aircraft data storage (populated on-demand)
const AIRCRAFT_CHECKLISTS = {};

/**
 * Load aircraft data for a specific aircraft
 * @param {string} aircraftId - Aircraft identifier (e.g., 'c172')
 * @returns {Promise<object>} Aircraft checklist data
 */
async function loadAircraftData(aircraftId) {
    const registry = AIRCRAFT_REGISTRY[aircraftId];
    if (!registry) {
        console.error(`Unknown aircraft: ${aircraftId}`);
        return null;
    }

    const { category } = registry;

    // Return cached if already loaded
    if (AIRCRAFT_CHECKLISTS[aircraftId]) {
        return AIRCRAFT_CHECKLISTS[aircraftId];
    }

    // Load category if not loaded
    if (!loadedCategories.has(category)) {
        const file = CATEGORY_FILES[category];
        try {
            await loadScript(file);
            loadedCategories.add(category);
            console.log(`[Checklist] Loaded ${category} aircraft data (${file})`);
        } catch (err) {
            console.error(`Failed to load ${category} aircraft:`, err);
            return null;
        }
    }

    return AIRCRAFT_CHECKLISTS[aircraftId];
}

/**
 * Dynamically load a JavaScript file
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Preload a category (useful for predictive loading)
 * @param {string} category - Category name (ga, turboprop, jets, airliners)
 */
async function preloadCategory(category) {
    if (loadedCategories.has(category)) return;
    const file = CATEGORY_FILES[category];
    await loadScript(file);
    loadedCategories.add(category);
}
