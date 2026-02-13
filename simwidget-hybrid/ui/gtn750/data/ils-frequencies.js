/**
 * ILS Frequency Reference Database
 *
 * Contains ILS/LOC frequencies for major US airports.
 * Data sourced from FAA published ILS frequencies.
 *
 * Format: 'AIRPORT-RUNWAY': { freq, ident, name }
 *
 * @version 1.0.0
 * @created 2026-02-13
 */

const ILS_FREQUENCIES = {
    // Seattle-Tacoma Intl (KSEA)
    'KSEA-16C': { freq: 109.90, ident: 'ISZI', name: 'ILS RWY 16C' },
    'KSEA-16L': { freq: 110.30, ident: 'ISEA', name: 'ILS RWY 16L' },
    'KSEA-16R': { freq: 111.15, ident: 'ISEL', name: 'ILS RWY 16R' },
    'KSEA-34C': { freq: 109.30, ident: 'ISEQ', name: 'ILS RWY 34C' },
    'KSEA-34L': { freq: 110.90, ident: 'ISRW', name: 'ILS RWY 34L' },
    'KSEA-34R': { freq: 110.50, ident: 'ISRH', name: 'ILS RWY 34R' },

    // Denver Intl (KDEN)
    'KDEN-16L': { freq: 111.10, ident: 'IDBQ', name: 'ILS RWY 16L' },
    'KDEN-16R': { freq: 110.30, ident: 'IDPK', name: 'ILS RWY 16R' },
    'KDEN-17L': { freq: 110.90, ident: 'IDEQ', name: 'ILS RWY 17L' },
    'KDEN-17R': { freq: 111.30, ident: 'IDWG', name: 'ILS RWY 17R' },
    'KDEN-34L': { freq: 109.50, ident: 'IDVQ', name: 'ILS RWY 34L' },
    'KDEN-34R': { freq: 109.90, ident: 'IDSH', name: 'ILS RWY 34R' },
    'KDEN-35L': { freq: 110.10, ident: 'IDZZ', name: 'ILS RWY 35L' },
    'KDEN-35R': { freq: 110.75, ident: 'IDDW', name: 'ILS RWY 35R' },

    // Los Angeles Intl (KLAX)
    'KLAX-24L': { freq: 111.50, ident: 'IIMP', name: 'ILS RWY 24L' },
    'KLAX-24R': { freq: 110.50, ident: 'IAXR', name: 'ILS RWY 24R' },
    'KLAX-25L': { freq: 111.10, ident: 'ILZH', name: 'ILS RWY 25L' },
    'KLAX-25R': { freq: 110.90, ident: 'ILXN', name: 'ILS RWY 25R' },
    'KLAX-06L': { freq: 108.50, ident: 'IAXL', name: 'ILS RWY 06L' },
    'KLAX-06R': { freq: 109.90, ident: 'ILAX', name: 'ILS RWY 06R' },

    // San Francisco Intl (KSFO)
    'KSFO-28L': { freq: 111.70, ident: 'ISFO', name: 'ILS RWY 28L' },
    'KSFO-28R': { freq: 111.30, ident: 'ISFF', name: 'ILS RWY 28R' },
    'KSFO-10L': { freq: 109.55, ident: 'ISZZ', name: 'ILS RWY 10L' },
    'KSFO-10R': { freq: 109.15, ident: 'ISFQ', name: 'ILS RWY 10R' },

    // Chicago O'Hare (KORD)
    'KORD-10L': { freq: 111.30, ident: 'INDK', name: 'ILS RWY 10L' },
    'KORD-10R': { freq: 109.35, ident: 'IORW', name: 'ILS RWY 10R' },
    'KORD-28L': { freq: 110.75, ident: 'IORD', name: 'ILS RWY 28L' },
    'KORD-28R': { freq: 109.90, ident: 'IORR', name: 'ILS RWY 28R' },

    // New York JFK (KJFK)
    'KJFK-04L': { freq: 109.50, ident: 'IJFK', name: 'ILS RWY 04L' },
    'KJFK-04R': { freq: 111.50, ident: 'IJRF', name: 'ILS RWY 04R' },
    'KJFK-13L': { freq: 109.30, ident: 'IJAQ', name: 'ILS RWY 13L' },
    'KJFK-13R': { freq: 110.90, ident: 'IJHS', name: 'ILS RWY 13R' },
    'KJFK-22L': { freq: 111.10, ident: 'IJAT', name: 'ILS RWY 22L' },
    'KJFK-22R': { freq: 109.90, ident: 'IJIR', name: 'ILS RWY 22R' },
    'KJFK-31L': { freq: 108.90, ident: 'IJBD', name: 'ILS RWY 31L' },
    'KJFK-31R': { freq: 110.30, ident: 'IJVT', name: 'ILS RWY 31R' },

    // Atlanta Hartsfield (KATL)
    'KATL-08L': { freq: 110.30, ident: 'IATL', name: 'ILS RWY 08L' },
    'KATL-08R': { freq: 110.50, ident: 'IATV', name: 'ILS RWY 08R' },
    'KATL-09L': { freq: 109.90, ident: 'IAMV', name: 'ILS RWY 09L' },
    'KATL-09R': { freq: 111.10, ident: 'IAZH', name: 'ILS RWY 09R' },
    'KATL-26L': { freq: 110.10, ident: 'IAXV', name: 'ILS RWY 26L' },
    'KATL-26R': { freq: 109.30, ident: 'IATR', name: 'ILS RWY 26R' },
    'KATL-27L': { freq: 111.90, ident: 'IAYC', name: 'ILS RWY 27L' },
    'KATL-27R': { freq: 110.90, ident: 'IAYT', name: 'ILS RWY 27R' },

    // Dallas/Fort Worth (KDFW)
    'KDFW-17C': { freq: 110.50, ident: 'IDFC', name: 'ILS RWY 17C' },
    'KDFW-17L': { freq: 109.90, ident: 'IDFW', name: 'ILS RWY 17L' },
    'KDFW-17R': { freq: 109.10, ident: 'IDFR', name: 'ILS RWY 17R' },
    'KDFW-18L': { freq: 111.55, ident: 'IDFL', name: 'ILS RWY 18L' },
    'KDFW-18R': { freq: 111.15, ident: 'IDFV', name: 'ILS RWY 18R' },
    'KDFW-35C': { freq: 111.35, ident: 'IDGL', name: 'ILS RWY 35C' },
    'KDFW-35L': { freq: 110.90, ident: 'IDZS', name: 'ILS RWY 35L' },
    'KDFW-35R': { freq: 108.90, ident: 'IDKX', name: 'ILS RWY 35R' },

    // Phoenix Sky Harbor (KPHX)
    'KPHX-07L': { freq: 109.50, ident: 'IPHX', name: 'ILS RWY 07L' },
    'KPHX-07R': { freq: 110.90, ident: 'IPHQ', name: 'ILS RWY 07R' },
    'KPHX-08': { freq: 110.30, ident: 'IPHL', name: 'ILS RWY 08' },
    'KPHX-25L': { freq: 111.30, ident: 'IPHR', name: 'ILS RWY 25L' },
    'KPHX-25R': { freq: 109.90, ident: 'IPHE', name: 'ILS RWY 25R' },
    'KPHX-26': { freq: 111.70, ident: 'IPSD', name: 'ILS RWY 26' },
};

/**
 * Lookup ILS frequency for airport/runway
 * @param {string} airport - Airport ICAO (e.g., 'KSEA')
 * @param {string} runway - Runway identifier (e.g., '16C', '34L')
 * @returns {Object|null} ILS data or null if not found
 */
function getILSFrequency(airport, runway) {
    const key = `${airport}-${runway}`;
    return ILS_FREQUENCIES[key] || null;
}

/**
 * Extract runway from approach identifier
 * @param {string} ident - Approach ident (e.g., 'I16C', 'L34R', 'R16LY')
 * @returns {string|null} Runway identifier (e.g., '16C') or null
 */
function extractRunwayFromApproach(ident) {
    // Match patterns: I16C, L34R, H16CZ, R16LY
    const match = ident.match(/^[ILHRilhr](\d{2}[LCRlcr]?)/);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Check if approach is an ILS/LOC approach
 * @param {string} type - Approach type (e.g., 'ILS', 'LOC', 'RNAV')
 * @returns {boolean} True if ILS or LOC approach
 */
function isILSApproach(type) {
    return type === 'ILS' || type === 'LOC';
}
