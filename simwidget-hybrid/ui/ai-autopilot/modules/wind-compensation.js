/**
 * Wind Compensation Calculator
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/wind-compensation.js
 *
 * Calculates heading corrections for wind drift using wind triangle math.
 * Provides crosswind components, headwind/tailwind analysis, and turbulence detection.
 */

class WindCompensation {
    constructor() {
        this._lastVSReadings = [];  // For turbulence detection
        this._maxVSReadings = 10;   // 10 samples for averaging
    }

    /**
     * Calculate heading correction angle for wind drift.
     * Uses wind triangle: desired track + wind correction = heading to fly
     *
     * @param {number} desiredTrack - Desired ground track (degrees true)
     * @param {number} trueAirspeed - Aircraft TAS (knots)
     * @param {number} windDirection - Wind from direction (degrees true)
     * @param {number} windSpeed - Wind speed (knots)
     * @returns {Object} { heading, correction, crosswind, headwind }
     */
    calculateWindCorrection(desiredTrack, trueAirspeed, windDirection, windSpeed) {
        if (!trueAirspeed || trueAirspeed < 10 || !windSpeed || windSpeed < 1) {
            // No wind or too slow, no correction needed
            return {
                heading: desiredTrack,
                correction: 0,
                crosswind: 0,
                headwind: 0,
                effectiveGS: trueAirspeed
            };
        }

        // Convert to radians
        const trackRad = desiredTrack * Math.PI / 180;
        const windDirRad = windDirection * Math.PI / 180;

        // Wind vector components (wind FROM direction)
        // Need to reverse direction (wind blowing TO)
        const windToRad = (windDirection + 180) % 360 * Math.PI / 180;
        const windX = windSpeed * Math.sin(windToRad);
        const windY = windSpeed * Math.cos(windToRad);

        // Aircraft velocity components on desired track
        const acX = trueAirspeed * Math.sin(trackRad);
        const acY = trueAirspeed * Math.cos(trackRad);

        // Ground speed vector (aircraft + wind)
        const gsX = acX + windX;
        const gsY = acY + windY;
        const groundSpeed = Math.sqrt(gsX * gsX + gsY * gsY);

        // Calculate actual ground track from velocity components
        let actualTrack = Math.atan2(gsX, gsY) * 180 / Math.PI;
        if (actualTrack < 0) actualTrack += 360;

        // Drift angle = difference between desired and actual track
        let drift = actualTrack - desiredTrack;
        if (drift > 180) drift -= 360;
        if (drift < -180) drift += 360;

        // Wind correction angle (opposite of drift)
        const correction = -drift;

        // Heading to fly = desired track + wind correction
        let heading = desiredTrack + correction;
        if (heading < 0) heading += 360;
        if (heading >= 360) heading -= 360;

        // Calculate crosswind and headwind components relative to desired track
        const windRelAngle = (windDirection - desiredTrack) * Math.PI / 180;
        const crosswind = windSpeed * Math.sin(windRelAngle);  // Positive = right crosswind
        const headwind = -windSpeed * Math.cos(windRelAngle);  // Positive = headwind

        return {
            heading: Math.round(heading),
            correction: Math.round(correction * 10) / 10,  // Round to 0.1°
            crosswind: Math.round(crosswind * 10) / 10,
            headwind: Math.round(headwind * 10) / 10,
            effectiveGS: Math.round(groundSpeed * 10) / 10,
            drift: Math.round(drift * 10) / 10
        };
    }

    /**
     * Get crosswind component for runway operations.
     * @param {number} runwayHeading - Runway heading (degrees magnetic/true)
     * @param {number} windDirection - Wind from direction (degrees)
     * @param {number} windSpeed - Wind speed (knots)
     * @returns {number} Crosswind component (knots, positive = right crosswind)
     */
    getCrosswindComponent(runwayHeading, windDirection, windSpeed) {
        const windRelAngle = (windDirection - runwayHeading) * Math.PI / 180;
        return windSpeed * Math.sin(windRelAngle);
    }

    /**
     * Get headwind component for runway operations.
     * @param {number} runwayHeading - Runway heading (degrees magnetic/true)
     * @param {number} windDirection - Wind from direction (degrees)
     * @param {number} windSpeed - Wind speed (knots)
     * @returns {number} Headwind component (knots, positive = headwind, negative = tailwind)
     */
    getHeadwindComponent(runwayHeading, windDirection, windSpeed) {
        const windRelAngle = (windDirection - runwayHeading) * Math.PI / 180;
        return -windSpeed * Math.cos(windRelAngle);
    }

    /**
     * Detect turbulence by analyzing vertical speed variability.
     * @param {number} verticalSpeed - Current VS (fpm)
     * @returns {Object} { isTurbulent, severity, vsDelta }
     */
    detectTurbulence(verticalSpeed) {
        this._lastVSReadings.push(verticalSpeed);
        if (this._lastVSReadings.length > this._maxVSReadings) {
            this._lastVSReadings.shift();
        }

        if (this._lastVSReadings.length < 3) {
            return { isTurbulent: false, severity: 0, vsDelta: 0 };
        }

        // Calculate standard deviation of VS readings
        const avg = this._lastVSReadings.reduce((a, b) => a + b, 0) / this._lastVSReadings.length;
        const variance = this._lastVSReadings.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this._lastVSReadings.length;
        const stdDev = Math.sqrt(variance);

        // Max VS delta between consecutive readings
        let maxDelta = 0;
        for (let i = 1; i < this._lastVSReadings.length; i++) {
            const delta = Math.abs(this._lastVSReadings[i] - this._lastVSReadings[i - 1]);
            if (delta > maxDelta) maxDelta = delta;
        }

        // Turbulence thresholds
        // Light: stdDev > 100 fpm or maxDelta > 200 fpm
        // Moderate: stdDev > 250 fpm or maxDelta > 500 fpm
        // Severe: stdDev > 500 fpm or maxDelta > 1000 fpm

        let severity = 0;
        let isTurbulent = false;

        if (stdDev > 500 || maxDelta > 1000) {
            severity = 3; // Severe
            isTurbulent = true;
        } else if (stdDev > 250 || maxDelta > 500) {
            severity = 2; // Moderate
            isTurbulent = true;
        } else if (stdDev > 100 || maxDelta > 200) {
            severity = 1; // Light
            isTurbulent = true;
        }

        return {
            isTurbulent,
            severity,
            vsDelta: Math.round(maxDelta),
            stdDev: Math.round(stdDev)
        };
    }

    /**
     * Calculate maximum demonstrated crosswind for aircraft type.
     * @param {Object} profile - Aircraft profile with wingLoading, approachSpeed
     * @returns {number} Max demonstrated crosswind (knots)
     */
    getMaxCrosswind(profile) {
        // Rough estimate: ~20% of approach speed or 15-25kt for GA
        const baseMax = profile.approachSpeed ? profile.approachSpeed * 0.2 : 20;
        return Math.min(Math.max(baseMax, 15), 25);
    }

    /**
     * Reset turbulence detection history.
     */
    reset() {
        this._lastVSReadings = [];
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.WindCompensation = WindCompensation;
}
