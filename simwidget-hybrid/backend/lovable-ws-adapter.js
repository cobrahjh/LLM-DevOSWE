/**
 * Lovable GTN750Xi WebSocket Adapter
 * Transforms SimGlass WebSocket messages to Lovable.dev format
 *
 * Our format: { latitude, longitude, altitude, groundSpeed, heading, track, magvar, ... }
 * Lovable format: { flightData, fuel, navigation, weather }
 */

class LovableWSAdapter {
    constructor(simGlassWs) {
        this.simGlassWs = simGlassWs;
        this.flightPlanManager = null; // Will be injected
    }

    /**
     * Transform SimGlass message to Lovable format
     * @param {Object} simData - Raw SimGlass WebSocket message
     * @returns {Object} Lovable-formatted message
     */
    transform(simData) {
        return {
            flightData: this.transformFlightData(simData),
            fuel: this.transformFuelData(simData),
            navigation: this.transformNavigationData(simData),
            weather: this.transformWeatherData(simData)
        };
    }

    transformFlightData(data) {
        return {
            altitude: data.altitude || data.altitudeMSL || 0,
            speed: data.indicatedAirSpeed || data.groundSpeed || 0, // IAS if available, else GS
            heading: data.heading || 0,
            verticalSpeed: data.verticalSpeed || 0,
            groundSpeed: data.groundSpeed || 0,
            mach: this.calculateMach(data.indicatedAirSpeed || data.groundSpeed || 0, data.altitude || 0),
            lat: data.latitude || 0,
            lng: data.longitude || 0
        };
    }

    transformFuelData(data) {
        const current = data.fuelTotal || 0;
        const max = data.fuelCapacity || 100;
        const flow = data.fuelFlow || 0;

        // Calculate endurance (HH:MM format)
        const enduranceHours = flow > 0 ? current / flow : 0;
        const hours = Math.floor(enduranceHours);
        const minutes = Math.round((enduranceHours - hours) * 60);
        const endurance = `${hours}:${minutes.toString().padStart(2, '0')}`;

        return {
            current,
            max,
            flow,
            endurance
        };
    }

    transformNavigationData(data) {
        // Pull from flight plan manager if available
        const fpm = this.flightPlanManager;
        const plan = fpm?.flightPlan;

        if (!plan?.waypoints?.length) {
            return {
                currentWaypoint: "----",
                nextWaypoint: "----",
                distanceToNext: 0,
                totalDistance: 0,
                distanceRemaining: 0,
                eta: "--:--",
                dtk: 0,
                activeLegIndex: 0
            };
        }

        const activeIdx = fpm.activeWaypointIndex || 0;
        const currentWp = plan.waypoints[activeIdx];
        const nextWp = plan.waypoints[activeIdx + 1];

        // Calculate distance to next waypoint
        const gpsNav = fpm.calculateGpsNavigation?.(data.latitude, data.longitude);
        const distanceToNext = gpsNav?.distance || 0;

        // Calculate total distance remaining
        let distanceRemaining = distanceToNext;
        for (let i = activeIdx + 1; i < plan.waypoints.length; i++) {
            const wp = plan.waypoints[i];
            if (wp?.distanceFromPrev) {
                distanceRemaining += wp.distanceFromPrev;
            }
        }

        // Calculate total distance
        let totalDistance = 0;
        plan.waypoints.forEach(wp => {
            if (wp?.distanceFromPrev) totalDistance += wp.distanceFromPrev;
        });

        // Calculate ETA (HH:MM format)
        const gs = data.groundSpeed || 0;
        const etaMinutes = gs > 0 ? (distanceRemaining / gs) * 60 : 0;
        const now = new Date();
        const eta = new Date(now.getTime() + etaMinutes * 60000);
        const etaString = `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`;

        return {
            currentWaypoint: currentWp?.ident || "----",
            nextWaypoint: nextWp?.ident || "----",
            distanceToNext: Math.round(distanceToNext * 10) / 10,
            totalDistance: Math.round(totalDistance * 10) / 10,
            distanceRemaining: Math.round(distanceRemaining * 10) / 10,
            eta: etaString,
            dtk: gpsNav?.bearing || 0,
            activeLegIndex: activeIdx
        };
    }

    transformWeatherData(data) {
        // Derive flight rules from visibility
        const visSM = (data.visibility || 10000) / 1609.34;
        let condition = "VFR";
        if (visSM < 1) condition = "LIFR";
        else if (visSM < 3) condition = "IFR";
        else if (visSM < 5) condition = "MVFR";

        return {
            location: "----", // Would need airport lookup
            condition,
            temperature: data.ambientTemp || 15,
            visibility: visSM,
            ceiling: 0, // We don't have ceiling data from sim
            pressure: data.ambientPressure || 29.92,
            windDir: data.windDirection || 0,
            windSpeed: data.windSpeed || 0
        };
    }

    /**
     * Calculate Mach number (approximate)
     * @param {number} tas - True airspeed in knots
     * @param {number} altitude - Altitude in feet
     * @returns {number} Mach number
     */
    calculateMach(tas, altitude) {
        // Speed of sound decreases with altitude
        // Sea level: 661 kt, decreases ~2% per 1000ft
        const tempLapseRate = 0.00198; // °C per foot
        const seaLevelTemp = 15; // °C
        const temp = seaLevelTemp - (altitude * tempLapseRate);
        const speedOfSound = 661.47 * Math.sqrt((temp + 273.15) / 288.15); // kt
        return tas / speedOfSound;
    }

    /**
     * Set flight plan manager reference for navigation data
     */
    setFlightPlanManager(fpm) {
        this.flightPlanManager = fpm;
    }
}

module.exports = LovableWSAdapter;
