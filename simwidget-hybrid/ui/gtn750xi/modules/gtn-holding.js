/**
 * GTN Holding - Holding pattern entry, timing, and sequencing
 * Handles direct, teardrop, and parallel entry procedures
 */

class GTNHolding {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.syncChannel = options.syncChannel || null;

        // Holding state
        this.active = false;
        this.fix = null;           // { ident, lat, lon }
        this.inboundCourse = 0;    // Magnetic course
        this.turnDirection = 'R';  // 'L' or 'R'
        this.legTime = 60;         // Seconds (1 min below 14k, 1.5 min above)
        this.altitude = null;      // Holding altitude restriction

        // Entry procedure
        this.entryType = null;     // 'DIRECT', 'TEARDROP', 'PARALLEL'
        this.entryComplete = false;

        // Current state
        this.currentLeg = 'inbound';  // 'inbound', 'outbound', 'turn'
        this.legStartTime = 0;
        this.turnsRemaining = 0;      // 0 = unlimited, >0 = specific count
        this.expectedFurtherClearance = null; // EFC time

        // Callbacks
        this.onHoldEntry = options.onHoldEntry || null;
        this.onHoldExit = options.onHoldExit || null;
    }

    /**
     * Detect holding pattern from waypoint
     * @param {Object} waypoint - Waypoint with pathTerm, course, turnDir, legTime
     * @returns {Object|null} - Hold parameters or null
     */
    detectHoldFromWaypoint(waypoint) {
        if (!waypoint) return null;

        // ARINC 424 holding leg types
        const holdingLegTypes = ['HM', 'HA', 'HF'];

        if (!holdingLegTypes.includes(waypoint.pathTerm)) {
            return null;
        }

        // Extract holding parameters
        return {
            fix: {
                ident: waypoint.ident,
                lat: waypoint.lat,
                lon: waypoint.lng
            },
            inboundCourse: waypoint.course || waypoint.magneticCourse || 0,
            turnDirection: waypoint.turnDir || 'R',
            legTime: waypoint.legTime || 60,
            altitude: waypoint.alt1 || null
        };
    }

    /**
     * Calculate holding pattern entry procedure
     * @param {number} aircraftHeading - Current magnetic heading
     * @param {number} inboundCourse - Holding pattern inbound course
     * @param {string} turnDirection - 'L' or 'R'
     * @returns {string} - 'DIRECT', 'TEARDROP', or 'PARALLEL'
     */
    calculateEntryProcedure(aircraftHeading, inboundCourse, turnDirection) {
        // Normalize heading and course to 0-360
        aircraftHeading = this.core.normalizeAngle(aircraftHeading);
        inboundCourse = this.core.normalizeAngle(inboundCourse);

        // Calculate angle from hold fix
        // Inbound course is the course TO the fix
        const outboundCourse = this.core.normalizeAngle(inboundCourse + 180);

        // Calculate relative bearing from outbound course
        let relativeBearing = this.core.normalizeAngle(aircraftHeading - outboundCourse);

        // Adjust sectors based on turn direction
        if (turnDirection === 'R') {
            // Standard right turns
            // Direct: 70° either side of outbound course (290° to 70°)
            // Teardrop: 70° to 110° left of outbound
            // Parallel: 110° to 290° left of outbound

            if (relativeBearing <= 70 || relativeBearing >= 290) {
                return 'DIRECT';
            } else if (relativeBearing > 70 && relativeBearing <= 110) {
                return 'TEARDROP';
            } else {
                return 'PARALLEL';
            }
        } else {
            // Non-standard left turns (mirror the sectors)
            // Direct: 70° either side of outbound course (70° to 290°)
            // Teardrop: 250° to 290° right of outbound
            // Parallel: 110° to 250° right of outbound

            if (relativeBearing >= 70 && relativeBearing <= 290) {
                return 'DIRECT';
            } else if (relativeBearing >= 250 && relativeBearing < 290) {
                return 'TEARDROP';
            } else {
                return 'PARALLEL';
            }
        }
    }

    /**
     * Enter holding pattern
     * @param {Object} holdParams - { fix, inboundCourse, turnDirection, legTime, altitude }
     * @param {number} aircraftHeading - Current heading for entry calculation
     * @param {number} aircraftAltitude - Current altitude
     */
    enterHold(holdParams, aircraftHeading, aircraftAltitude) {
        if (this.active) return; // Already in a hold

        this.active = true;
        this.fix = holdParams.fix;
        this.inboundCourse = holdParams.inboundCourse;
        this.turnDirection = holdParams.turnDirection;
        this.legTime = holdParams.legTime || 60;
        this.altitude = holdParams.altitude;

        // Adjust leg time based on altitude (1 min below 14k, 1.5 min above)
        if (aircraftAltitude >= 14000) {
            this.legTime = 90; // 1.5 minutes
        }

        // Calculate entry procedure
        this.entryType = this.calculateEntryProcedure(
            aircraftHeading,
            this.inboundCourse,
            this.turnDirection
        );

        this.entryComplete = false;
        this.currentLeg = 'entry';
        this.legStartTime = Date.now();
        this.turnsRemaining = 0; // Unlimited by default

        GTNCore.log(`[GTN750] Holding pattern entry: ${this.entryType} at ${this.fix.ident}, inbound ${this.inboundCourse}°${this.turnDirection}`);

        // Notify via callback
        if (this.onHoldEntry) {
            this.onHoldEntry({
                fix: this.fix,
                entryType: this.entryType,
                inboundCourse: this.inboundCourse,
                turnDirection: this.turnDirection
            });
        }

        // Sync across instances
        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'hold-entry',
                data: {
                    fix: this.fix,
                    entryType: this.entryType,
                    inboundCourse: this.inboundCourse,
                    turnDirection: this.turnDirection,
                    legTime: this.legTime
                }
            });
        }
    }

    /**
     * Exit holding pattern
     */
    exitHold() {
        if (!this.active) return;

        GTNCore.log(`[GTN750] Exiting holding pattern at ${this.fix?.ident}`);

        this.active = false;
        this.entryComplete = false;
        this.currentLeg = null;

        // Notify via callback
        if (this.onHoldExit) {
            this.onHoldExit();
        }

        // Sync across instances
        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'hold-exit',
                data: { fix: this.fix?.ident }
            });
        }
    }

    /**
     * Update holding pattern state (called each frame)
     * @param {Object} data - Current aircraft data { latitude, longitude, heading, altitude }
     */
    update(data) {
        if (!this.active || !this.fix) return;

        // Calculate distance and bearing to fix
        const distToFix = this.core.calculateDistance(
            data.latitude, data.longitude,
            this.fix.lat, this.fix.lon
        );
        const bearingToFix = this.core.calculateBearing(
            data.latitude, data.longitude,
            this.fix.lat, this.fix.lon
        );

        // Timing for leg transitions
        const legElapsed = (Date.now() - this.legStartTime) / 1000; // seconds

        // State machine for hold legs
        if (!this.entryComplete) {
            // Still in entry procedure
            this.updateEntryProcedure(data, distToFix, bearingToFix, legElapsed);
        } else {
            // In established hold
            this.updateEstablishedHold(data, distToFix, bearingToFix, legElapsed);
        }
    }

    /**
     * Update entry procedure state
     */
    updateEntryProcedure(data, distToFix, bearingToFix, legElapsed) {
        // Entry is complete when aircraft is established on inbound course
        // near the fix (within 1nm and tracking within 20° of inbound course)
        const courseError = Math.abs(this.core.normalizeAngle(data.heading - this.inboundCourse));

        if (distToFix < 1.0 && courseError < 20) {
            this.entryComplete = true;
            this.currentLeg = 'inbound';
            this.legStartTime = Date.now();
            GTNCore.log(`[GTN750] Entry complete, established in hold`);
        }
    }

    /**
     * Update established hold state
     */
    updateEstablishedHold(data, distToFix, bearingToFix, legElapsed) {
        const outboundCourse = this.core.normalizeAngle(this.inboundCourse + 180);

        switch (this.currentLeg) {
            case 'inbound':
                // Transition to turn when reaching fix
                if (distToFix < 0.2) { // Within 0.2nm of fix
                    this.currentLeg = 'turn';
                    this.legStartTime = Date.now();
                    GTNCore.log('[GTN750] Hold: inbound → turn');
                }
                break;

            case 'turn':
                // Standard rate turn (3°/sec), 180° turn takes ~60 seconds
                if (legElapsed > 60) {
                    this.currentLeg = 'outbound';
                    this.legStartTime = Date.now();
                    GTNCore.log('[GTN750] Hold: turn → outbound');
                }
                break;

            case 'outbound':
                // Transition to turn after leg time elapsed
                if (legElapsed >= this.legTime) {
                    this.currentLeg = 'turn';
                    this.legStartTime = Date.now();

                    // Decrement turns remaining if limited
                    if (this.turnsRemaining > 0) {
                        this.turnsRemaining--;
                        if (this.turnsRemaining === 0) {
                            // Exit hold on next inbound
                            GTNCore.log('[GTN750] Hold: final turn');
                        }
                    }
                    GTNCore.log('[GTN750] Hold: outbound → turn');
                }
                break;
        }
    }

    /**
     * Get holding pattern state for display
     * @returns {Object} - Hold status and parameters
     */
    getStatus() {
        return {
            active: this.active,
            fix: this.fix,
            inboundCourse: this.inboundCourse,
            turnDirection: this.turnDirection,
            legTime: this.legTime,
            entryType: this.entryType,
            entryComplete: this.entryComplete,
            currentLeg: this.currentLeg,
            turnsRemaining: this.turnsRemaining,
            altitude: this.altitude,
            efc: this.expectedFurtherClearance
        };
    }

    /**
     * Calculate holding pattern racetrack coordinates for map display
     * @param {number} fixLat - Hold fix latitude
     * @param {number} fixLon - Hold fix longitude
     * @param {number} inboundCourse - Inbound magnetic course
     * @param {number} legTime - Leg time in seconds
     * @param {string} turnDirection - 'L' or 'R'
     * @param {number} groundSpeed - Aircraft ground speed (kt)
     * @returns {Object} - { inboundStart, inboundEnd, outboundStart, outboundEnd, turnPath }
     */
    calculateRacetrack(fixLat, fixLon, inboundCourse, legTime, turnDirection, groundSpeed = 120) {
        // Leg length in nautical miles (time * speed)
        const legLength = (legTime / 3600) * groundSpeed;

        // Turn radius for standard rate turn (3°/sec)
        // R (nm) = V (kt) / (360 / 60) = V / 6
        const turnRadius = groundSpeed / 360;

        const outboundCourse = this.core.normalizeAngle(inboundCourse + 180);

        // Calculate inbound leg coordinates
        // Inbound leg ends at fix
        const inboundEnd = { lat: fixLat, lon: fixLon };

        // Inbound leg starts legLength away on reciprocal course
        const inboundStart = this.core.projectPoint(
            fixLat, fixLon,
            outboundCourse,
            legLength
        );

        // Outbound leg (parallel to inbound, offset by turn diameter)
        const turnOffset = turnRadius * 2;
        const offsetBearing = turnDirection === 'R' ?
            this.core.normalizeAngle(inboundCourse + 90) :  // Right: 90° right of inbound
            this.core.normalizeAngle(inboundCourse - 90);   // Left: 90° left of inbound

        const outboundStart = this.core.projectPoint(
            fixLat, fixLon,
            offsetBearing,
            turnOffset
        );

        const outboundEnd = this.core.projectPoint(
            outboundStart.lat, outboundStart.lon,
            outboundCourse,
            legLength
        );

        return {
            inboundStart,
            inboundEnd,
            outboundStart,
            outboundEnd,
            turnRadius,
            legLength
        };
    }

    /**
     * Handle sync messages from other instances
     */
    handleSyncMessage(type, data) {
        if (type === 'hold-entry') {
            if (!this.active) {
                this.active = true;
                this.fix = data.fix;
                this.inboundCourse = data.inboundCourse;
                this.turnDirection = data.turnDirection;
                this.legTime = data.legTime;
                this.entryType = data.entryType;
            }
        } else if (type === 'hold-exit') {
            if (this.active && this.fix?.ident === data.fix) {
                this.active = false;
                this.entryComplete = false;
            }
        }
    }

    destroy() {
        this.active = false;
    }
}
