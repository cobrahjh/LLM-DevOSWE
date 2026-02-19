/**
 * GTN750 VNAV - Vertical Navigation
 * Calculates vertical path, top of descent, and required vertical speed
 */

class GTNVNav {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // VNAV state
        this.enabled = false;
        this.armed = false; // Armed when approaching TOD
        this.active = false; // Active when past TOD

        // Vertical path settings
        this.descentAngle = 3.0; // degrees (standard 3° glideslope)
        this.feetPerNm = 300; // feet per nautical mile for 3° descent
        this.descentRate = 500; // default descent rate in fpm

        // TOD (Top of Descent) calculation
        this.todWaypointIndex = -1;
        this.todDistance = 0; // distance from TOD waypoint to TOD point
        this.todDistanceTotal = 0; // total distance to TOD from current position

        // Vertical deviation
        this.verticalDeviation = 0; // feet (+ = above path, - = below path)
        this.targetAltitude = 0; // ideal altitude at current position

        // Required vertical speed
        this.requiredVS = 0; // fpm needed to meet next constraint

        // Constraints
        this.nextConstraint = null;
        this.constraintAlertDistance = 5; // nm before constraint to alert
    }

    /**
     * Enable/disable VNAV
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.armed = false;
            this.active = false;
        }
    }

    /**
     * Set descent angle (degrees)
     */
    setDescentAngle(angle) {
        this.descentAngle = Math.max(1, Math.min(6, angle)); // 1-6° range
        this.feetPerNm = Math.tan(this.core.toRad(this.descentAngle)) * 6076; // feet per nm
    }

    /**
     * Set descent rate (fpm)
     */
    setDescentRate(rate) {
        this.descentRate = Math.max(300, Math.min(2000, rate)); // 300-2000 fpm range
    }

    /**
     * Calculate VNAV path based on flight plan
     */
    calculate(flightPlan, currentPosition, groundSpeed) {
        if (!this.enabled || !flightPlan?.waypoints?.length) {
            this.reset();
            return;
        }

        const { latitude, longitude, altitude } = currentPosition;
        const waypoints = flightPlan.waypoints;
        const activeIdx = flightPlan.activeWaypointIndex || 0;

        // Find next altitude constraint
        this.nextConstraint = this.findNextConstraint(waypoints, activeIdx);

        if (!this.nextConstraint) {
            this.reset();
            return;
        }

        // Calculate TOD
        this.calculateTOD(waypoints, activeIdx, altitude, latitude, longitude);

        // Calculate vertical deviation if active
        if (this.active) {
            this.calculateVerticalDeviation(waypoints, activeIdx, altitude, latitude, longitude);
        }

        // Calculate required VS for next constraint
        this.calculateRequiredVS(altitude, groundSpeed);

        // Update VNAV mode (armed/active)
        this.updateMode(this.todDistanceTotal);
    }

    /**
     * Find next altitude constraint in flight plan
     */
    findNextConstraint(waypoints, activeIdx) {
        for (let i = activeIdx; i < waypoints.length; i++) {
            const wp = waypoints[i];
            if (wp.altitude && wp.altitudeConstraint) {
                return {
                    waypointIndex: i,
                    waypoint: wp,
                    altitude: wp.altitude,
                    constraint: wp.altitudeConstraint, // '@' = at, '+' = at or above, '-' = at or below
                    ident: wp.ident
                };
            }
        }
        return null;
    }

    /**
     * Calculate Top of Descent point
     */
    calculateTOD(waypoints, activeIdx, currentAlt, currentLat, currentLon) {
        if (!this.nextConstraint) {
            this.todWaypointIndex = -1;
            this.todDistance = 0;
            this.todDistanceTotal = 0;
            return;
        }

        const targetAlt = this.nextConstraint.altitude;
        const altToLose = currentAlt - targetAlt;

        if (altToLose <= 0) {
            // Already at or below target altitude
            this.todWaypointIndex = -1;
            this.todDistance = 0;
            this.todDistanceTotal = 0;
            return;
        }

        // Calculate distance needed to descend
        const descentDistance = altToLose / this.feetPerNm;

        // Calculate distance from current position to constraint waypoint
        let distanceToConstraint = 0;
        for (let i = activeIdx; i < this.nextConstraint.waypointIndex; i++) {
            const wp = waypoints[i];
            if (i === activeIdx && wp.distanceToActive !== undefined) {
                distanceToConstraint += wp.distanceToActive;
            } else if (wp.distanceFromPrev) {
                distanceToConstraint += wp.distanceFromPrev;
            }
        }

        // Add distance to constraint waypoint from current position
        const constraintWp = waypoints[this.nextConstraint.waypointIndex];
        if (constraintWp && constraintWp.lat && constraintWp.lng) {
            const distToConstraintWp = this.core.calculateDistance(
                currentLat, currentLon,
                constraintWp.lat, constraintWp.lng
            );
            distanceToConstraint = distToConstraintWp;
        }

        // TOD is descentDistance before the constraint
        this.todDistanceTotal = distanceToConstraint - descentDistance;

        // Find which leg the TOD falls on
        let cumulativeDistance = 0;
        for (let i = activeIdx; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const legDist = wp.distanceFromPrev || 0;

            if (cumulativeDistance + legDist >= this.todDistanceTotal) {
                // TOD is on this leg
                this.todWaypointIndex = i;
                this.todDistance = this.todDistanceTotal - cumulativeDistance;
                break;
            }

            cumulativeDistance += legDist;
        }
    }

    /**
     * Calculate vertical deviation from ideal path
     */
    calculateVerticalDeviation(waypoints, activeIdx, currentAlt, currentLat, currentLon) {
        if (!this.nextConstraint || this.todDistanceTotal <= 0) {
            this.verticalDeviation = 0;
            this.targetAltitude = currentAlt;
            return;
        }

        // Calculate distance to TOD
        const distToTOD = this.todDistanceTotal;

        if (distToTOD > 0) {
            // Before TOD - should be at cruise altitude
            this.targetAltitude = currentAlt; // No deviation before TOD
            this.verticalDeviation = 0;
        } else {
            // Past TOD - calculate ideal altitude on descent path
            const distancePastTOD = Math.abs(distToTOD);
            const altitudeLost = distancePastTOD * this.feetPerNm;

            // Calculate what altitude we started descent from (at TOD)
            const constraintAlt = this.nextConstraint.altitude;
            const totalDescentDist = (currentAlt - constraintAlt) / this.feetPerNm;
            const todAltitude = constraintAlt + (totalDescentDist * this.feetPerNm);

            this.targetAltitude = todAltitude - altitudeLost;
            this.verticalDeviation = currentAlt - this.targetAltitude;
        }
    }

    /**
     * Calculate required vertical speed to meet next constraint
     */
    calculateRequiredVS(currentAlt, groundSpeed) {
        if (!this.nextConstraint || groundSpeed < 30) {
            this.requiredVS = 0;
            return;
        }

        const targetAlt = this.nextConstraint.altitude;
        const altDiff = currentAlt - targetAlt;

        if (altDiff <= 0) {
            this.requiredVS = 0;
            return;
        }

        // Calculate time to constraint (minutes)
        const distToConstraint = Math.abs(this.todDistanceTotal);
        const timeToConstraint = distToConstraint / groundSpeed; // hours
        const timeToConstraintMin = timeToConstraint * 60; // minutes

        if (timeToConstraintMin < 0.1) {
            this.requiredVS = 0;
            return;
        }

        // Required VS = altitude difference / time
        this.requiredVS = Math.round(altDiff / timeToConstraintMin);
    }

    /**
     * Update VNAV mode (armed/active)
     */
    updateMode(todDistance) {
        const armDistance = 2; // nm before TOD to arm VNAV

        if (todDistance > armDistance) {
            // More than 2nm to TOD
            this.armed = false;
            this.active = false;
        } else if (todDistance > 0 && todDistance <= armDistance) {
            // Within 2nm of TOD - arm VNAV
            this.armed = true;
            this.active = false;
        } else if (todDistance <= 0) {
            // Past TOD - activate VNAV
            this.armed = false;
            this.active = true;
        }
    }

    /**
     * Get VNAV status for display
     */
    getStatus() {
        return {
            enabled: this.enabled,
            armed: this.armed,
            active: this.active,
            todDistance: this.todDistanceTotal,
            verticalDeviation: this.verticalDeviation,
            targetAltitude: Math.round(this.targetAltitude),
            requiredVS: this.requiredVS,
            nextConstraint: this.nextConstraint ? {
                ident: this.nextConstraint.ident,
                altitude: this.nextConstraint.altitude,
                constraint: this.nextConstraint.constraint
            } : null,
            descentAngle: this.descentAngle,
            feetPerNm: Math.round(this.feetPerNm)
        };
    }

    /**
     * Get TOD position for map rendering
     */
    getTODPosition(waypoints) {
        if (this.todWaypointIndex < 0 || !waypoints?.[this.todWaypointIndex]) {
            return null;
        }

        const wp = waypoints[this.todWaypointIndex];
        const prevWp = waypoints[this.todWaypointIndex - 1];

        if (!wp.lat || !wp.lng || !prevWp?.lat || !prevWp.lng) {
            return null;
        }

        // Interpolate position along the leg
        const bearing = this.core.calculateBearing(prevWp.lat, prevWp.lng, wp.lat, wp.lng);
        const todPos = this.core.calculateDestination(
            prevWp.lat,
            prevWp.lng,
            bearing,
            this.todDistance
        );

        return {
            lat: todPos.lat,
            lon: todPos.lon,
            waypointIndex: this.todWaypointIndex,
            distance: this.todDistance
        };
    }

    /**
     * Check if approaching altitude constraint
     */
    isApproachingConstraint() {
        return this.nextConstraint &&
               this.todDistanceTotal >= 0 &&
               this.todDistanceTotal <= this.constraintAlertDistance;
    }

    /**
     * Reset VNAV state
     */
    reset() {
        this.armed = false;
        this.active = false;
        this.todWaypointIndex = -1;
        this.todDistance = 0;
        this.todDistanceTotal = 0;
        this.verticalDeviation = 0;
        this.targetAltitude = 0;
        this.requiredVS = 0;
        this.nextConstraint = null;
    }

    /**
     * Get display color based on vertical deviation
     */
    getDeviationColor() {
        const dev = Math.abs(this.verticalDeviation);
        if (dev < 200) return '#00ff00'; // Green - on path
        if (dev < 500) return '#ffff00'; // Yellow - slightly off
        return '#ff0000'; // Red - significantly off
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNVNav;
}
