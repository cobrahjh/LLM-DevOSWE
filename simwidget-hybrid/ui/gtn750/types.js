/**
 * GTN750 Type Definitions
 * JSDoc type annotations for IDE autocomplete and documentation
 * Import this file at the top of any GTN750 module for type hints
 */

/**
 * @typedef {Object} Waypoint
 * @property {string} ident - Waypoint identifier (e.g., 'KSEA', 'SEA')
 * @property {string} [name] - Full waypoint name (e.g., 'Seattle Tacoma Intl')
 * @property {number} lat - Latitude in decimal degrees (-90 to +90)
 * @property {number} lng - Longitude in decimal degrees (-180 to +180)
 * @property {number} [lon] - Alternate longitude field (some APIs use 'lon')
 * @property {number} [altitude] - Altitude constraint in feet MSL
 * @property {string} [type] - Waypoint type (AIRPORT, VOR, NDB, FIX, USER)
 * @property {number} [distanceFromPrev] - Distance from previous waypoint in NM
 * @property {boolean} [passed] - Whether waypoint has been passed
 */

/**
 * @typedef {Object} FlightPlan
 * @property {string} departure - Departure airport ICAO (e.g., 'KSEA')
 * @property {string} arrival - Arrival airport ICAO (e.g., 'KLAX')
 * @property {Waypoint[]} waypoints - Array of waypoints in route
 * @property {number} totalDistance - Total route distance in nautical miles
 * @property {string} [route] - Route string (e.g., 'KSEA SEA BTG KLAX')
 * @property {number} [cruiseAltitude] - Planned cruise altitude in feet
 * @property {string} [source] - Flight plan source ('msfs', 'simbrief', 'manual')
 */

/**
 * @typedef {Object} CDIState
 * @property {'GPS'|'NAV1'|'NAV2'|'OBS'} source - Active navigation source
 * @property {number} needle - CDI needle deflection (-127 to +127, 0=centered)
 * @property {number} dtk - Desired track in degrees (0-359)
 * @property {number} xtrk - Cross-track error in nautical miles
 * @property {0|1|2} toFrom - Direction indicator (0=FROM, 1=TO, 2=---)
 * @property {number} gsNeedle - Glideslope needle deflection (-119 to +119)
 * @property {boolean} gsValid - Whether glideslope is valid/available
 * @property {boolean} signalValid - Whether navigation signal is valid
 */

/**
 * @typedef {Object} NavRadioData
 * @property {number} cdi - CDI deflection value (-127 to +127)
 * @property {number} obs - OBS course setting (0-359 degrees)
 * @property {number} radial - FROM radial from station (0-359 degrees)
 * @property {0|1|2} toFrom - TO/FROM indicator (0=FROM, 1=TO, 2=---)
 * @property {number} signal - Signal strength percentage (0-100)
 * @property {number} gsi - Glideslope index (-119 to +119)
 * @property {boolean} gsFlag - Glideslope flag (true=invalid)
 * @property {boolean} [hasLoc] - Whether localizer is tuned (NAV1 only)
 * @property {boolean} [hasGs] - Whether glideslope is available (NAV1 only)
 * @property {number} dme - DME distance in nautical miles
 * @property {string} [ident] - Station identifier (e.g., 'SEA')
 */

/**
 * @typedef {Object} GPSData
 * @property {number} cdi - GPS CDI needle deflection (-127 to +127)
 * @property {number} xtrk - Cross-track error in nautical miles
 * @property {number} dtk - Desired track in degrees (0-359)
 * @property {number} obs - GPS OBS value (0-359)
 * @property {number} vertError - Vertical error in feet (VNAV)
 * @property {boolean} approachMode - Whether in approach mode (±1nm sensitivity)
 */

/**
 * @typedef {Object} OBSState
 * @property {boolean} active - Whether OBS mode is active
 * @property {number} course - Selected OBS course (0-359 degrees)
 * @property {boolean} suspended - Whether waypoint sequencing is suspended
 * @property {boolean} holdingPattern - Whether holding pattern is active
 * @property {number} legTime - Holding pattern leg time in seconds (30-240)
 * @property {'L'|'R'} turnDirection - Holding pattern turn direction
 * @property {'direct'|'teardrop'|'parallel'|null} entryType - Holding entry type
 * @property {'inbound'|'outbound'} currentLeg - Current holding leg
 * @property {number} outboundTimer - Outbound leg timer
 */

/**
 * @typedef {Object} SimData
 * @property {number} latitude - Aircraft latitude in decimal degrees
 * @property {number} longitude - Aircraft longitude in decimal degrees
 * @property {number} altitude - Altitude MSL in feet
 * @property {number} [altitudeAGL] - Altitude AGL in feet
 * @property {number} [groundAltitude] - Ground elevation in feet
 * @property {number} groundSpeed - Ground speed in knots
 * @property {number} heading - Magnetic heading in degrees (0-359)
 * @property {number} track - Ground track in degrees (0-359)
 * @property {number} magvar - Magnetic variation in degrees (positive=East)
 * @property {number} verticalSpeed - Vertical speed in feet per minute
 * @property {number} com1Active - COM1 active frequency (MHz)
 * @property {number} com1Standby - COM1 standby frequency (MHz)
 * @property {number} com2Active - COM2 active frequency (MHz)
 * @property {number} com2Standby - COM2 standby frequency (MHz)
 * @property {number} nav1Active - NAV1 active frequency (MHz)
 * @property {number} nav1Standby - NAV1 standby frequency (MHz)
 * @property {number} transponder - Transponder code (0000-7777)
 * @property {number} zuluTime - Zulu time in hours (0-24)
 * @property {'GPS'|'NAV1'|'NAV2'} navSource - Active navigation source
 * @property {number} windDirection - Wind direction in degrees (from)
 * @property {number} windSpeed - Wind speed in knots
 * @property {number} ambientTemp - Ambient temperature in Celsius
 * @property {number} ambientPressure - Barometric pressure in inHg
 * @property {number} visibility - Visibility in meters
 * @property {number} precipState - Precipitation state bitmask (0=none, 2=rain, 4=snow)
 * @property {number} [fuelTotal] - Total fuel in gallons
 * @property {number} [fuelFlow] - Fuel flow in gallons per hour
 * @property {number} [fuelCapacity] - Total fuel capacity in gallons
 */

/**
 * @typedef {Object} MapState
 * @property {number} range - Current map range in nautical miles
 * @property {number[]} ranges - Available map ranges (e.g., [2, 5, 10, 20, 50, 100, 200])
 * @property {'north'|'track'|'heading'} orientation - Map orientation mode
 * @property {boolean} showTerrain - Whether terrain overlay is enabled
 * @property {boolean} showTraffic - Whether traffic overlay is enabled
 * @property {boolean} showWeather - Whether weather overlay is enabled
 * @property {boolean} [showFuelRange] - Whether fuel range ring is shown
 * @property {boolean} [showBearingPointers] - Whether bearing pointers are shown
 */

/**
 * @typedef {Object} TAWSState
 * @property {boolean} active - Whether TAWS is active
 * @property {boolean} inhibited - Whether TAWS alerts are inhibited
 */

/**
 * @typedef {Object} RendererState
 * @property {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
 * @property {HTMLCanvasElement} canvas - Canvas element
 * @property {{x: number, y: number}} panOffset - Pan offset in pixels
 * @property {number} declutterLevel - Declutter level (0-3)
 * @property {MapState} map - Map settings
 * @property {SimData} data - Current sim data
 * @property {TAWSState} taws - TAWS state
 * @property {TerrainOverlay} terrainOverlay - Terrain overlay instance
 * @property {TrafficOverlay} trafficOverlay - Traffic overlay instance
 * @property {WeatherOverlay} weatherOverlay - Weather overlay instance
 * @property {FlightPlan|null} flightPlan - Active flight plan
 * @property {number} activeWaypointIndex - Index of active waypoint
 * @property {Waypoint|null} activeWaypoint - Active waypoint object
 * @property {OBSState} obs - OBS state
 * @property {NavRadioData} nav1 - NAV1 radio data
 * @property {NavRadioData} nav2 - NAV2 radio data
 * @property {GPSData} gps - GPS data
 * @property {Function} onUpdateDatafields - Callback to update data fields
 */

/**
 * @typedef {Object} TrafficTarget
 * @property {string} id - Unique traffic target ID
 * @property {number} latitude - Target latitude in decimal degrees
 * @property {number} longitude - Target longitude in decimal degrees
 * @property {number} altitude - Target altitude MSL in feet
 * @property {number} heading - Target heading in degrees
 * @property {number} groundSpeed - Target ground speed in knots
 * @property {number} verticalSpeed - Target vertical speed in fpm
 * @property {string} [callsign] - Target callsign/registration
 * @property {number} [relativeAlt] - Altitude relative to ownship in feet
 * @property {number} [closureRate] - Closure rate in knots (positive=closing)
 */

/**
 * @typedef {Object} DirectToTarget
 * @property {string} ident - Waypoint identifier
 * @property {string} name - Waypoint full name
 * @property {number} lat - Latitude in decimal degrees
 * @property {number} lon - Longitude in decimal degrees
 * @property {string} type - Waypoint type
 */

/**
 * @typedef {Object} SyncMessage
 * @property {'route-update'|'direct-to'|'waypoint-select'|'waypoint-sequence'|'simbrief-plan'|'procedure-load'} type - Message type
 * @property {*} data - Message payload (varies by type)
 */

/**
 * @typedef {Object} TerrainAlert
 * @property {'PULL_UP'|'TERRAIN'|'DONT_SINK'|'CLEAR'} level - Alert level
 * @property {string|null} color - Alert color (hex code or null for CLEAR)
 */

/**
 * @typedef {Object} ModuleOptions
 * @property {GTNCore} [core] - Core utilities instance
 * @property {Object} [elements] - Cached DOM elements
 * @property {number} [serverPort] - WebSocket server port
 * @property {BroadcastChannel} [syncChannel] - Cross-widget sync channel
 * @property {Function} [onWaypointChanged] - Waypoint change callback
 * @property {Function} [onDirectToActivated] - Direct-To activation callback
 * @property {Function} [onDataUpdate] - Data update callback
 * @property {Function} [getState] - State getter callback
 */

// Export for CommonJS (Node.js testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Type definitions only - no runtime exports
    };
}
