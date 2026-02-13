/**
 * GTN Flight Plan Validator - Pre-flight safety checks and validation
 * Validates fuel range, terrain clearance, waypoint reachability, and procedures
 */

class GTNFlightPlanValidator {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.terrainGrid = options.terrainGrid || null;

        // Validation thresholds
        this.THRESHOLDS = {
            // Fuel
            FUEL_RESERVE_MINUTES: 45,           // IFR reserve requirement
            FUEL_WARNING_BUFFER: 1.2,           // Warn if fuel < 1.2x required

            // Terrain
            MIN_TERRAIN_CLEARANCE_FT: 1000,     // Minimum AGL over terrain
            TERRAIN_WARNING_FT: 2000,           // Warn if less than this
            TERRAIN_SAMPLE_POINTS: 10,          // Points to check per leg

            // Distance
            MAX_SINGLE_LEG_NM: 500,             // Warn if single leg > 500nm
            EXTREME_LEG_NM: 1000,               // Error if > 1000nm (impossible for most GA)

            // Procedures
            MAX_PROCEDURE_WAYPOINTS: 50         // Warn if procedure has too many waypoints
        };

        // Default aircraft performance (C172 conservative values)
        this.aircraftPerformance = {
            cruiseSpeed: 110,        // KTAS
            fuelFlow: 8.5,          // GPH
            fuelCapacity: 53,       // Gallons usable
            maxRange: 500,          // Nautical miles
            serviceceiling: 13500  // Feet MSL
        };
    }

    /**
     * Set aircraft performance parameters
     */
    setAircraftPerformance(performance) {
        this.aircraftPerformance = { ...this.aircraftPerformance, ...performance };
    }

    /**
     * Validate entire flight plan
     * @param {Object} flightPlan - Flight plan with waypoints array
     * @param {Object} currentData - Current aircraft data (fuel, position, etc.)
     * @returns {Object} { valid: boolean, warnings: [], errors: [] }
     */
    validateFlightPlan(flightPlan, currentData = {}) {
        if (!flightPlan || !flightPlan.waypoints || flightPlan.waypoints.length < 2) {
            return {
                valid: false,
                errors: [{ type: 'plan', message: 'Flight plan must have at least 2 waypoints' }],
                warnings: []
            };
        }

        const warnings = [];
        const errors = [];

        // 1. Fuel validation
        const fuelChecks = this.validateFuelRange(flightPlan, currentData);
        warnings.push(...fuelChecks.warnings);
        errors.push(...fuelChecks.errors);

        // 2. Terrain clearance validation
        if (this.terrainGrid) {
            const terrainChecks = this.validateTerrainClearance(flightPlan);
            warnings.push(...terrainChecks.warnings);
            errors.push(...terrainChecks.errors);
        }

        // 3. Waypoint reachability validation
        const reachabilityChecks = this.validateWaypointReachability(flightPlan);
        warnings.push(...reachabilityChecks.warnings);
        errors.push(...reachabilityChecks.errors);

        // 4. Procedure validation
        const procedureChecks = this.validateProcedures(flightPlan);
        warnings.push(...procedureChecks.warnings);
        errors.push(...procedureChecks.errors);

        // 5. Altitude validation
        const altitudeChecks = this.validateAltitudes(flightPlan);
        warnings.push(...altitudeChecks.warnings);
        errors.push(...altitudeChecks.errors);

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Validate fuel range and reserves
     */
    validateFuelRange(flightPlan, currentData) {
        const warnings = [];
        const errors = [];

        // Calculate total distance
        let totalDistance = 0;
        for (const wp of flightPlan.waypoints) {
            if (wp.distanceFromPrev) totalDistance += wp.distanceFromPrev;
        }

        // Get current fuel or use full tanks
        const currentFuel = currentData.fuelTotal || this.aircraftPerformance.fuelCapacity;

        // Calculate required fuel
        const estimatedTimeHours = totalDistance / this.aircraftPerformance.cruiseSpeed;
        const fuelRequired = estimatedTimeHours * this.aircraftPerformance.fuelFlow;
        const fuelWithReserve = fuelRequired + (this.THRESHOLDS.FUEL_RESERVE_MINUTES / 60 * this.aircraftPerformance.fuelFlow);

        // Check if fuel is sufficient
        if (currentFuel < fuelRequired) {
            errors.push({
                type: 'fuel',
                severity: 'critical',
                waypointIndex: -1,
                message: `Insufficient fuel: ${currentFuel.toFixed(1)} gal available, ${fuelRequired.toFixed(1)} gal required`,
                details: `Range deficit: ${((fuelRequired - currentFuel) / this.aircraftPerformance.fuelFlow * this.aircraftPerformance.cruiseSpeed).toFixed(0)} nm`
            });
        } else if (currentFuel < fuelWithReserve) {
            errors.push({
                type: 'fuel',
                severity: 'critical',
                waypointIndex: -1,
                message: `Insufficient fuel reserves: ${currentFuel.toFixed(1)} gal available, ${fuelWithReserve.toFixed(1)} gal required (incl. 45min reserve)`,
                details: `Missing ${(fuelWithReserve - currentFuel).toFixed(1)} gal for legal IFR reserves`
            });
        } else if (currentFuel < fuelWithReserve * this.THRESHOLDS.FUEL_WARNING_BUFFER) {
            warnings.push({
                type: 'fuel',
                severity: 'caution',
                waypointIndex: -1,
                message: `Limited fuel margin: ${currentFuel.toFixed(1)} gal available, ${fuelWithReserve.toFixed(1)} gal required`,
                details: `Consider fuel stop or reduce distance by ${((currentFuel - fuelWithReserve) / this.aircraftPerformance.fuelFlow * this.aircraftPerformance.cruiseSpeed * -1).toFixed(0)} nm`
            });
        }

        // Check if total distance exceeds aircraft max range
        if (totalDistance > this.aircraftPerformance.maxRange) {
            errors.push({
                type: 'range',
                severity: 'critical',
                waypointIndex: -1,
                message: `Flight plan exceeds aircraft range: ${totalDistance.toFixed(0)} nm planned, ${this.aircraftPerformance.maxRange} nm max`,
                details: 'Consider adding fuel stop waypoints'
            });
        }

        return { warnings, errors };
    }

    /**
     * Validate terrain clearance along route
     */
    validateTerrainClearance(flightPlan) {
        const warnings = [];
        const errors = [];

        if (!this.terrainGrid) return { warnings, errors };

        const waypoints = flightPlan.waypoints;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i];
            const wp2 = waypoints[i + 1];

            if (!wp1.lat || !wp1.lng || !wp2.lat || !wp2.lng) continue;

            // Sample terrain along leg
            const maxElevation = this.getMaxTerrainAlongLeg(wp1, wp2);

            if (maxElevation === null) continue;

            // Get planned altitude (use higher of the two waypoints, or cruise altitude)
            let plannedAlt = flightPlan.cruiseAltitude || 5000;
            if (wp1.altitude) plannedAlt = Math.max(plannedAlt, wp1.altitude);
            if (wp2.altitude) plannedAlt = Math.max(plannedAlt, wp2.altitude);

            const clearance = plannedAlt - maxElevation;

            if (clearance < this.THRESHOLDS.MIN_TERRAIN_CLEARANCE_FT) {
                errors.push({
                    type: 'terrain',
                    severity: 'critical',
                    waypointIndex: i,
                    message: `Terrain conflict: ${wp1.ident} → ${wp2.ident}`,
                    details: `${clearance.toFixed(0)} ft clearance (min ${this.THRESHOLDS.MIN_TERRAIN_CLEARANCE_FT} ft). Terrain: ${maxElevation.toFixed(0)} ft, Planned: ${plannedAlt.toFixed(0)} ft`
                });
            } else if (clearance < this.THRESHOLDS.TERRAIN_WARNING_FT) {
                warnings.push({
                    type: 'terrain',
                    severity: 'caution',
                    waypointIndex: i,
                    message: `Low terrain clearance: ${wp1.ident} → ${wp2.ident}`,
                    details: `${clearance.toFixed(0)} ft clearance. Consider higher altitude.`
                });
            }
        }

        return { warnings, errors };
    }

    /**
     * Get maximum terrain elevation along a leg
     */
    getMaxTerrainAlongLeg(wp1, wp2) {
        if (!this.terrainGrid) return null;

        let maxElevation = 0;
        const samples = this.THRESHOLDS.TERRAIN_SAMPLE_POINTS;

        for (let i = 0; i <= samples; i++) {
            const fraction = i / samples;
            const lat = wp1.lat + (wp2.lat - wp1.lat) * fraction;
            const lon = wp1.lng + (wp2.lng - wp1.lng) * fraction;

            const elevation = this.terrainGrid.getElevationFeet(lat, lon);
            if (elevation !== null && elevation > maxElevation) {
                maxElevation = elevation;
            }
        }

        return maxElevation;
    }

    /**
     * Validate waypoint reachability (leg distances)
     */
    validateWaypointReachability(flightPlan) {
        const warnings = [];
        const errors = [];

        const waypoints = flightPlan.waypoints;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i];
            const wp2 = waypoints[i + 1];

            if (!wp1.lat || !wp1.lng || !wp2.lat || !wp2.lng) continue;

            const distance = this.core.calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);

            if (distance > this.THRESHOLDS.EXTREME_LEG_NM) {
                errors.push({
                    type: 'distance',
                    severity: 'critical',
                    waypointIndex: i,
                    message: `Extreme leg distance: ${wp1.ident} → ${wp2.ident}`,
                    details: `${distance.toFixed(0)} nm (max ${this.THRESHOLDS.EXTREME_LEG_NM} nm for most GA aircraft)`
                });
            } else if (distance > this.THRESHOLDS.MAX_SINGLE_LEG_NM) {
                warnings.push({
                    type: 'distance',
                    severity: 'caution',
                    waypointIndex: i,
                    message: `Long leg: ${wp1.ident} → ${wp2.ident}`,
                    details: `${distance.toFixed(0)} nm. Consider adding intermediate waypoints.`
                });
            }
        }

        return { warnings, errors };
    }

    /**
     * Validate procedures (SID/STAR/approach)
     */
    validateProcedures(flightPlan) {
        const warnings = [];
        const errors = [];

        // Check if procedures have valid connections
        const waypoints = flightPlan.waypoints;

        // Check for excessive waypoints (might indicate procedure loading issue)
        if (waypoints.length > this.THRESHOLDS.MAX_PROCEDURE_WAYPOINTS) {
            warnings.push({
                type: 'procedure',
                severity: 'caution',
                waypointIndex: -1,
                message: `Large number of waypoints: ${waypoints.length}`,
                details: 'Verify procedures loaded correctly'
            });
        }

        // Check for duplicate waypoints (common procedure error)
        const identCounts = {};
        waypoints.forEach((wp, idx) => {
            if (wp.ident) {
                if (!identCounts[wp.ident]) identCounts[wp.ident] = [];
                identCounts[wp.ident].push(idx);
            }
        });

        for (const [ident, indices] of Object.entries(identCounts)) {
            if (indices.length > 2) { // Allow 2 for common transitions
                warnings.push({
                    type: 'procedure',
                    severity: 'caution',
                    waypointIndex: indices[0],
                    message: `Duplicate waypoint: ${ident} appears ${indices.length} times`,
                    details: 'May indicate procedure transition issue'
                });
            }
        }

        return { warnings, errors };
    }

    /**
     * Validate altitude constraints and service ceiling
     */
    validateAltitudes(flightPlan) {
        const warnings = [];
        const errors = [];

        const cruiseAlt = flightPlan.cruiseAltitude;

        // Check if cruise altitude exceeds service ceiling
        if (cruiseAlt && cruiseAlt > this.aircraftPerformance.serviceceiling) {
            errors.push({
                type: 'altitude',
                severity: 'critical',
                waypointIndex: -1,
                message: `Cruise altitude exceeds service ceiling`,
                details: `${cruiseAlt} ft planned, ${this.aircraftPerformance.serviceceiling} ft max`
            });
        }

        // Check altitude constraints at waypoints
        flightPlan.waypoints.forEach((wp, idx) => {
            if (wp.altitude && wp.altitude > this.aircraftPerformance.serviceceiling) {
                errors.push({
                    type: 'altitude',
                    severity: 'critical',
                    waypointIndex: idx,
                    message: `${wp.ident} altitude exceeds service ceiling`,
                    details: `${wp.altitude} ft required, ${this.aircraftPerformance.serviceceiling} ft max`
                });
            }
        });

        return { warnings, errors };
    }

    /**
     * Get validation summary for UI display
     */
    getValidationSummary(validation) {
        const criticalCount = validation.errors.filter(e => e.severity === 'critical').length;
        const warningCount = validation.warnings.length;

        if (criticalCount > 0) {
            return {
                level: 'critical',
                message: `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}`,
                canProceed: false
            };
        } else if (warningCount > 0) {
            return {
                level: 'warning',
                message: `${warningCount} warning${warningCount > 1 ? 's' : ''}`,
                canProceed: true
            };
        } else {
            return {
                level: 'ok',
                message: 'Flight plan validated',
                canProceed: true
            };
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNFlightPlanValidator;
}
