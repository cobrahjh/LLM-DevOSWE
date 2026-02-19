/**
 * GTN Fuel Planning - Advanced fuel calculations and predictions
 * Provides fuel burn predictions, reserve warnings, and alternate planning
 */

class GTNFuelPlanning {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.flightPlan = null;
        this.currentData = null;

        // Reserve requirements (minutes)
        this.reserves = {
            vfr: 30,      // VFR: 30 minutes day, 45 minutes night
            ifr: 45,      // IFR: 45 minutes
            alternate: 45 // Fuel to alternate + 45 minutes
        };

        // Fuel burn history for averaging
        this.fuelBurnHistory = [];
        this.maxHistorySize = 60; // 60 samples = 1 minute at 1Hz
    }

    /**
     * Update with current flight data
     * @param {Object} data - Current sim data
     * @param {Object} flightPlan - Active flight plan
     */
    update(data, flightPlan) {
        this.currentData = data;
        this.flightPlan = flightPlan;

        // Track fuel burn history
        if (data.fuelFlow > 0 && data.groundSpeed > 30) {
            this.fuelBurnHistory.push({
                time: Date.now(),
                flow: data.fuelFlow,
                speed: data.groundSpeed
            });

            // Trim history
            if (this.fuelBurnHistory.length > this.maxHistorySize) {
                this.fuelBurnHistory.shift();
            }
        }
    }

    /**
     * Get average fuel burn rate (gal/hr)
     * @returns {number}
     */
    getAverageFuelBurn() {
        if (this.fuelBurnHistory.length === 0) {
            return this.currentData?.fuelFlow || 8;
        }

        const sum = this.fuelBurnHistory.reduce((acc, s) => acc + s.flow, 0);
        return sum / this.fuelBurnHistory.length;
    }

    /**
     * Calculate endurance (hours)
     * @param {number} fuelRemaining - Fuel in gallons
     * @param {number} fuelBurn - Burn rate in gal/hr
     * @returns {number}
     */
    calculateEndurance(fuelRemaining, fuelBurn) {
        if (fuelBurn <= 0) return 0;
        return fuelRemaining / fuelBurn;
    }

    /**
     * Calculate range (nm)
     * @param {number} endurance - Endurance in hours
     * @param {number} groundSpeed - Ground speed in knots
     * @returns {number}
     */
    calculateRange(endurance, groundSpeed) {
        return endurance * groundSpeed;
    }

    /**
     * Get fuel planning summary
     * @returns {Object}
     */
    getFuelSummary() {
        if (!this.currentData) {
            return null;
        }

        const data = this.currentData;
        const fuelTotal = data.fuelTotal || 0;
        const fuelFlow = this.getAverageFuelBurn();
        const groundSpeed = data.groundSpeed || 100;

        // Basic calculations
        const endurance = this.calculateEndurance(fuelTotal, fuelFlow);
        const range = this.calculateRange(endurance, groundSpeed);

        // Reserve fuel (VFR 30min, IFR 45min)
        const isIFR = this.isIFRConditions(data);
        const reserveMinutes = isIFR ? this.reserves.ifr : this.reserves.vfr;
        const reserveFuel = (fuelFlow / 60) * reserveMinutes;
        const usableFuel = Math.max(0, fuelTotal - reserveFuel);
        const usableEndurance = this.calculateEndurance(usableFuel, fuelFlow);
        const usableRange = this.calculateRange(usableEndurance, groundSpeed);

        // Fuel to destination
        let fuelToDestination = null;
        let fuelAtDestination = null;
        let reserveStatus = 'ok';

        if (this.flightPlan?.waypoints?.length > 0) {
            const destDist = this.getDestinationDistance(data);
            if (destDist > 0) {
                const timeToDestination = destDist / groundSpeed; // hours
                fuelToDestination = fuelFlow * timeToDestination;
                fuelAtDestination = fuelTotal - fuelToDestination;

                // Check reserve status
                if (fuelAtDestination < reserveFuel) {
                    reserveStatus = 'critical';
                } else if (fuelAtDestination < reserveFuel * 1.2) {
                    reserveStatus = 'marginal';
                }
            }
        }

        // Point of no return (PNR)
        const pnr = this.calculatePNR(range, groundSpeed, fuelFlow);

        return {
            fuelTotal,
            fuelFlow,
            endurance,
            enduranceFormatted: this.formatEndurance(endurance),
            range,
            reserveFuel,
            reserveMinutes,
            usableFuel,
            usableEndurance,
            usableEnduranceFormatted: this.formatEndurance(usableEndurance),
            usableRange,
            fuelToDestination,
            fuelAtDestination,
            reserveStatus,
            pnr,
            isIFR
        };
    }

    /**
     * Calculate point of no return (PNR)
     * Distance at which you can no longer return to origin
     * @param {number} range - Total range (nm)
     * @param {number} groundSpeed - Ground speed (kt)
     * @param {number} fuelFlow - Fuel flow (gal/hr)
     * @returns {Object}
     */
    calculatePNR(range, groundSpeed, fuelFlow) {
        // Simple PNR: range / 2 (assumes same wind both ways)
        // Advanced: account for wind
        const windCorrection = 1.0; // TODO: calculate based on wind

        const pnrDistance = (range / 2) * windCorrection;
        const pnrTime = pnrDistance / groundSpeed;
        const pnrFuel = fuelFlow * pnrTime;

        return {
            distance: pnrDistance,
            time: pnrTime,
            fuel: pnrFuel,
            timeFormatted: this.formatEndurance(pnrTime)
        };
    }

    /**
     * Get range rings for display
     * @returns {Array}
     */
    getRangeRings() {
        const summary = this.getFuelSummary();
        if (!summary) return [];

        const rings = [];

        // Usable range (green)
        rings.push({
            radius: summary.usableRange,
            label: `USABLE ${summary.usableRange.toFixed(0)}nm`,
            color: 'rgba(0, 255, 0, 0.1)',
            strokeColor: '#00ff00',
            dash: [5, 5]
        });

        // Total range (yellow)
        rings.push({
            radius: summary.range,
            label: `MAX ${summary.range.toFixed(0)}nm`,
            color: 'rgba(255, 255, 0, 0.05)',
            strokeColor: '#ffff00',
            dash: [8, 4]
        });

        // PNR (orange)
        if (summary.pnr.distance > 0) {
            rings.push({
                radius: summary.pnr.distance,
                label: `PNR ${summary.pnr.distance.toFixed(0)}nm`,
                color: 'rgba(255, 165, 0, 0.08)',
                strokeColor: '#ffaa00',
                dash: [10, 5]
            });
        }

        return rings.sort((a, b) => b.radius - a.radius);
    }

    /**
     * Get destination distance
     * @param {Object} data - Current flight data
     * @returns {number} Distance in nm
     */
    getDestinationDistance(data) {
        if (!this.flightPlan?.waypoints?.length) return 0;

        const waypoints = this.flightPlan.waypoints;
        const activeIdx = this.flightPlan.activeWaypointIndex || 0;

        // Calculate remaining distance
        let totalDist = 0;

        // Distance to active waypoint
        const activeWp = waypoints[activeIdx];
        if (activeWp) {
            totalDist += this.core.haversine(
                data.latitude, data.longitude,
                activeWp.lat, activeWp.lng
            );
        }

        // Distance between remaining waypoints
        for (let i = activeIdx; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i];
            const wp2 = waypoints[i + 1];
            totalDist += this.core.haversine(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
        }

        return totalDist;
    }

    /**
     * Check if IFR conditions
     * @param {Object} data - Current flight data
     * @returns {boolean}
     */
    isIFRConditions(data) {
        // IFR if: visibility < 3SM or ceiling < 1000ft
        const vis = data.visibility || 10000; // meters
        const visSM = vis / 1609.34; // Convert to statute miles

        return visSM < 3 || data.inCloud;
    }

    /**
     * Format endurance as hours:minutes
     * @param {number} hours - Endurance in hours
     * @returns {string}
     */
    formatEndurance(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * Get fuel warning level
     * @returns {string} 'ok', 'warning', 'critical'
     */
    getFuelWarningLevel() {
        const summary = this.getFuelSummary();
        if (!summary) return 'ok';

        if (summary.reserveStatus === 'critical') return 'critical';
        if (summary.reserveStatus === 'marginal') return 'warning';

        // Check if endurance is less than 60 minutes
        if (summary.usableEndurance < 1.0) return 'warning';
        if (summary.usableEndurance < 0.5) return 'critical';

        return 'ok';
    }
}
