/**
 * GTN Fuel Monitor - Fuel planning, range calculation, and low fuel warnings
 * Monitors fuel state and provides safety alerts for flight planning
 */

class GTNFuelMonitor {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.flightPlanManager = options.flightPlanManager || null;

        // Configuration (user-adjustable via settings)
        this.config = {
            reserveType: 'VFR', // 'VFR' (45min) or 'IFR' (1hr)
            warningBuffer: 30,  // Warning threshold: reserves + 30min (minutes)
            fuelUnit: 'GAL',    // 'GAL' or 'LBS'
            showRangeRings: true,
            usableFuelPercent: 100 // Some aircraft have unusable fuel
        };

        // State
        this.fuelState = 'unknown'; // 'safe', 'marginal', 'critical', 'unknown'
        this.lastWarningTime = 0;
        this.warningCooldown = 60000; // 1 minute between warnings

        // Cached calculations (updated each frame)
        this.calculations = {
            fuelRemaining: 0,
            fuelRequired: 0,
            fuelReserves: 0,
            fuelExcess: 0,
            endurance: 0,        // Hours
            range: 0,            // Nautical miles
            timeToEmpty: 0,      // Minutes
            canReachDestination: false,
            nearestSuitableAirports: []
        };
    }

    /**
     * Update fuel monitor with current flight data
     * @param {Object} data - Flight data from SimConnect
     * @param {Object} flightPlan - Current flight plan
     */
    update(data, flightPlan) {
        if (!data) return;

        const fuelTotal = data.fuelTotal || 0;
        const fuelFlow = data.fuelFlow || 0;
        const groundSpeed = data.groundSpeed || 0;
        const fuelCapacity = data.fuelCapacity || 50; // Default for small GA

        // Calculate usable fuel
        const usableFuel = fuelTotal * (this.config.usableFuelPercent / 100);

        // Calculate endurance (hours)
        const endurance = fuelFlow > 0 ? usableFuel / fuelFlow : 0;

        // Calculate range (nautical miles)
        const range = groundSpeed > 0 ? endurance * groundSpeed : 0;

        // Calculate reserves based on config
        const reserveMinutes = this.config.reserveType === 'IFR' ? 60 : 45;
        const reserveFuel = fuelFlow * (reserveMinutes / 60);

        // Calculate fuel required to destination
        let fuelRequired = 0;
        let distanceRemaining = 0;
        let canReachDestination = false;

        if (flightPlan?.waypoints?.length > 0 && groundSpeed > 5) {
            // Sum distance from current position to all remaining waypoints
            const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;
            for (let i = activeIdx; i < flightPlan.waypoints.length; i++) {
                const wp = flightPlan.waypoints[i];
                if (wp.distanceFromPrev) {
                    distanceRemaining += wp.distanceFromPrev;
                }
            }

            // Add distance to active waypoint from current position
            if (this.flightPlanManager?.distanceToActive) {
                distanceRemaining += this.flightPlanManager.distanceToActive;
            }

            // Calculate fuel required (distance / speed * fuel flow)
            const timeToDestination = distanceRemaining / groundSpeed; // hours
            fuelRequired = timeToDestination * fuelFlow;

            // Can we make it with reserves?
            canReachDestination = usableFuel >= (fuelRequired + reserveFuel);
        }

        // Calculate excess fuel (remaining after destination + reserves)
        const fuelExcess = usableFuel - fuelRequired - reserveFuel;

        // Determine fuel state
        let fuelState = 'unknown';
        const warningThreshold = reserveFuel + (fuelFlow * (this.config.warningBuffer / 60));

        if (fuelFlow > 0) {
            if (usableFuel > warningThreshold) {
                fuelState = 'safe';
            } else if (usableFuel > reserveFuel) {
                fuelState = 'marginal';
            } else {
                fuelState = 'critical';
            }
        }

        // Update cached calculations
        this.calculations = {
            fuelRemaining: usableFuel,
            fuelRequired,
            fuelReserves: reserveFuel,
            fuelExcess,
            endurance,
            range,
            timeToEmpty: endurance * 60, // Convert to minutes
            distanceRemaining,
            canReachDestination,
            nearestSuitableAirports: [] // TODO: Populate from NavDB
        };

        this.fuelState = fuelState;

        // Trigger warnings if needed
        this.checkWarnings(data);
    }

    /**
     * Check if warnings should be triggered
     * @param {Object} data - Flight data
     */
    checkWarnings(data) {
        const now = Date.now();

        // Cooldown between warnings
        if (now - this.lastWarningTime < this.warningCooldown) {
            return;
        }

        // Critical fuel warning
        if (this.fuelState === 'critical') {
            this.triggerWarning('CRITICAL FUEL', 'Fuel below reserves', 'critical');
            this.lastWarningTime = now;
        }
        // Marginal fuel warning
        else if (this.fuelState === 'marginal') {
            this.triggerWarning('LOW FUEL', `${Math.round(this.calculations.timeToEmpty)} min remaining`, 'warning');
            this.lastWarningTime = now;
        }
        // Can't reach destination warning
        else if (this.calculations.fuelRequired > 0 && !this.calculations.canReachDestination) {
            this.triggerWarning('INSUFFICIENT FUEL', 'Cannot reach destination with reserves', 'warning');
            this.lastWarningTime = now;
        }
    }

    /**
     * Trigger a fuel warning (can be overridden by parent)
     * @param {string} title - Warning title
     * @param {string} message - Warning message
     * @param {string} level - 'warning' or 'critical'
     */
    triggerWarning(title, message, level) {
        GTNCore.log(`[FuelMonitor] ${level.toUpperCase()}: ${title} - ${message}`);
        // Parent can set this.onWarning callback to handle UI notifications
        if (typeof this.onWarning === 'function') {
            this.onWarning(title, message, level);
        }
    }

    /**
     * Calculate fuel range rings for map display
     * Returns array of ring definitions with radius and color
     * @returns {Array<{radius: number, color: string, label: string}>}
     */
    getRangeRings() {
        if (!this.config.showRangeRings || this.calculations.range <= 0) {
            return [];
        }

        const rings = [];
        const totalRange = this.calculations.range;
        const reserveRange = this.calculations.fuelReserves > 0
            ? (this.calculations.fuelReserves / (this.calculations.fuelRemaining / totalRange))
            : 0;

        // Green ring: Safe range (total range minus reserves)
        const safeRange = totalRange - reserveRange;
        if (safeRange > 10) {
            rings.push({
                radius: safeRange,
                color: 'rgba(0, 255, 0, 0.3)',
                strokeColor: '#00ff00',
                label: `${Math.round(safeRange)}nm SAFE`,
                dash: []
            });
        }

        // Yellow ring: Marginal range (includes reserves, no buffer)
        if (totalRange > 10) {
            rings.push({
                radius: totalRange,
                color: 'rgba(255, 255, 0, 0.2)',
                strokeColor: '#ffff00',
                label: `${Math.round(totalRange)}nm MAX`,
                dash: [8, 4]
            });
        }

        return rings;
    }

    /**
     * Get formatted fuel status for display
     * @returns {Object} Formatted fuel status
     */
    getStatus() {
        const calc = this.calculations;
        const hrs = Math.floor(calc.endurance);
        const mins = Math.round((calc.endurance - hrs) * 60);

        return {
            fuelRemaining: Math.round(calc.fuelRemaining * 10) / 10,
            fuelRemainingStr: `${Math.round(calc.fuelRemaining * 10) / 10} ${this.config.fuelUnit}`,
            endurance: calc.endurance,
            enduranceStr: `${hrs}:${mins.toString().padStart(2, '0')}`,
            range: Math.round(calc.range),
            rangeStr: `${Math.round(calc.range)} nm`,
            state: this.fuelState,
            stateColor: this.getStateColor(),
            fuelRequired: Math.round(calc.fuelRequired * 10) / 10,
            fuelReserves: Math.round(calc.fuelReserves * 10) / 10,
            fuelExcess: Math.round(calc.fuelExcess * 10) / 10,
            canReachDestination: calc.canReachDestination,
            distanceRemaining: Math.round(calc.distanceRemaining * 10) / 10
        };
    }

    /**
     * Get color for current fuel state
     * @returns {string} CSS color
     */
    getStateColor() {
        switch (this.fuelState) {
            case 'safe': return '#00ff00';
            case 'marginal': return '#ffff00';
            case 'critical': return '#ff0000';
            default: return '#808080';
        }
    }

    /**
     * Set configuration option
     * @param {string} key - Config key
     * @param {*} value - Config value
     */
    setConfig(key, value) {
        if (key in this.config) {
            this.config[key] = value;
            GTNCore.log(`[FuelMonitor] Config updated: ${key} = ${value}`);
        }
    }

    /**
     * Get configuration
     * @returns {Object} Current config
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Clean up resources
     */
    destroy() {
        // No timers or connections to clean up
        GTNCore.log('[FuelMonitor] Destroyed');
    }
}

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNFuelMonitor;
}
