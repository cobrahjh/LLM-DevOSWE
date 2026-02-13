/**
 * GTN Flight Logger - Automatic flight logging and timer tracking
 * Detects flight phases, tracks Hobbs time, and maintains flight log history
 */

class GTNFlightLogger {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Configuration
        this.config = {
            enabled: true,
            autoDetect: true,          // Automatically detect flight phases
            persistLogs: true,         // Save logs to localStorage
            maxLogEntries: 100,        // Maximum log entries to keep
            logKey: 'gtn750-flight-log' // localStorage key
        };

        // Flight phase state machine
        this.phase = 'SHUTDOWN'; // SHUTDOWN, ENGINE_START, TAXI, TAKEOFF, AIRBORNE, APPROACH, LANDING
        this.previousPhase = null;

        // Timers (all in milliseconds)
        this.flightStartTime = null;
        this.phaseStartTime = null;
        this.totalFlightTime = 0;      // Total flight time (airborne)
        this.totalHobbsTime = 0;       // Total Hobbs time (engine running)
        this.currentFlightTime = 0;    // Current flight duration
        this.currentHobbsTime = 0;     // Current Hobbs duration
        this.approachTimerStart = null;

        // Current flight data
        this.currentFlight = null;

        // Flight history
        this.flightHistory = [];
        this.loadFlightHistory();

        // Thresholds for phase detection
        this.THRESHOLDS = {
            TAXI_SPEED: 3,             // Ground speed for taxi (knots)
            TAKEOFF_AGL: 50,           // AGL for takeoff detection (feet)
            AIRBORNE_AGL: 100,         // AGL for airborne confirmation (feet)
            APPROACH_AGL: 3000,        // AGL for approach phase (feet)
            LANDING_AGL: 50,           // AGL for landing detection (feet)
            ENGINE_RPM: 500,           // Minimum RPM for engine running
            DESCENT_RATE: -100         // Minimum descent rate for approach (fpm)
        };

        // Callbacks
        this.onPhaseChange = options.onPhaseChange || null;
        this.onFlightComplete = options.onFlightComplete || null;
    }

    /**
     * Update flight logger with current flight data
     * @param {Object} data - Flight data from SimConnect
     */
    update(data) {
        if (!this.config.enabled || !data) return;

        const now = Date.now();

        // Detect flight phase
        const newPhase = this.detectPhase(data);

        // Handle phase transitions
        if (newPhase !== this.phase) {
            this.handlePhaseTransition(newPhase, data, now);
        }

        // Update timers
        this.updateTimers(data, now);
    }

    /**
     * Detect current flight phase based on flight data
     * @param {Object} data - Flight data
     * @returns {string} Detected phase
     */
    detectPhase(data) {
        if (!this.config.autoDetect) return this.phase;

        const engineRunning = (data.rpm1 || 0) > this.THRESHOLDS.ENGINE_RPM;
        const onGround = data.agl < this.THRESHOLDS.LANDING_AGL;
        const groundSpeed = data.groundSpeed || 0;
        const agl = data.agl || 0;
        const verticalSpeed = data.verticalSpeed || 0;

        // Phase detection logic
        if (!engineRunning) {
            return 'SHUTDOWN';
        } else if (engineRunning && onGround && groundSpeed < this.THRESHOLDS.TAXI_SPEED) {
            return 'ENGINE_START';
        } else if (onGround && groundSpeed >= this.THRESHOLDS.TAXI_SPEED) {
            return 'TAXI';
        } else if (agl >= this.THRESHOLDS.TAKEOFF_AGL && agl < this.THRESHOLDS.AIRBORNE_AGL && verticalSpeed > 0) {
            return 'TAKEOFF';
        } else if (agl >= this.THRESHOLDS.AIRBORNE_AGL && agl >= this.THRESHOLDS.APPROACH_AGL) {
            return 'AIRBORNE';
        } else if (agl < this.THRESHOLDS.APPROACH_AGL && agl >= this.THRESHOLDS.LANDING_AGL && verticalSpeed < this.THRESHOLDS.DESCENT_RATE) {
            return 'APPROACH';
        } else if (agl < this.THRESHOLDS.LANDING_AGL && onGround && groundSpeed > this.THRESHOLDS.TAXI_SPEED) {
            return 'LANDING';
        } else if (agl >= this.THRESHOLDS.AIRBORNE_AGL) {
            return 'AIRBORNE';
        }

        return this.phase; // Keep current phase if no clear transition
    }

    /**
     * Handle flight phase transition
     * @param {string} newPhase - New flight phase
     * @param {Object} data - Flight data
     * @param {number} now - Current timestamp
     */
    handlePhaseTransition(newPhase, data, now) {
        this.previousPhase = this.phase;
        this.phase = newPhase;
        this.phaseStartTime = now;

        GTNCore.log(`[FlightLogger] Phase transition: ${this.previousPhase} → ${newPhase}`);

        // Handle specific transitions
        switch (newPhase) {
            case 'ENGINE_START':
                if (this.previousPhase === 'SHUTDOWN') {
                    this.startFlight(data, now);
                }
                break;

            case 'TAKEOFF':
                if (this.currentFlight) {
                    this.currentFlight.takeoffTime = new Date(now).toISOString();
                    this.currentFlight.takeoffLat = data.latitude;
                    this.currentFlight.takeoffLon = data.longitude;
                }
                break;

            case 'APPROACH':
                this.approachTimerStart = now;
                break;

            case 'LANDING':
                if (this.currentFlight && !this.currentFlight.landingTime) {
                    this.currentFlight.landingTime = new Date(now).toISOString();
                    this.currentFlight.landingLat = data.latitude;
                    this.currentFlight.landingLon = data.longitude;
                }
                this.approachTimerStart = null;
                break;

            case 'SHUTDOWN':
                if (this.previousPhase !== 'SHUTDOWN' && this.currentFlight) {
                    this.endFlight(data, now);
                }
                break;
        }

        // Notify phase change
        if (typeof this.onPhaseChange === 'function') {
            this.onPhaseChange(this.phase, this.previousPhase);
        }
    }

    /**
     * Start a new flight
     * @param {Object} data - Flight data
     * @param {number} now - Current timestamp
     */
    startFlight(data, now) {
        this.flightStartTime = now;
        this.currentFlight = {
            id: `FLT-${now}`,
            startTime: new Date(now).toISOString(),
            startLat: data.latitude,
            startLon: data.longitude,
            aircraft: data.aircraftTitle || 'Unknown',
            departure: null, // Will be filled from flight plan
            destination: null,
            route: null,
            takeoffTime: null,
            landingTime: null,
            endTime: null,
            flightTime: 0,
            hobbsTime: 0,
            maxAltitude: 0,
            maxSpeed: 0,
            fuelUsed: data.fuelTotal || 0, // Track starting fuel
            distance: 0
        };

        GTNCore.log('[FlightLogger] Flight started');
    }

    /**
     * End current flight and save to history
     * @param {Object} data - Flight data
     * @param {number} now - Current timestamp
     */
    endFlight(data, now) {
        if (!this.currentFlight) return;

        this.currentFlight.endTime = new Date(now).toISOString();
        this.currentFlight.flightTime = this.currentFlightTime;
        this.currentFlight.hobbsTime = this.currentHobbsTime;
        this.currentFlight.fuelUsed = Math.max(0, this.currentFlight.fuelUsed - (data.fuelTotal || 0));

        // Add to history
        this.flightHistory.unshift(this.currentFlight);

        // Limit history size
        if (this.flightHistory.length > this.config.maxLogEntries) {
            this.flightHistory = this.flightHistory.slice(0, this.config.maxLogEntries);
        }

        // Save to localStorage
        this.saveFlightHistory();

        // Update totals
        this.totalFlightTime += this.currentFlightTime;
        this.totalHobbsTime += this.currentHobbsTime;

        GTNCore.log(`[FlightLogger] Flight ended - ${this.formatDuration(this.currentFlightTime)} flight time, ${this.formatDuration(this.currentHobbsTime)} Hobbs`);

        // Notify flight complete
        if (typeof this.onFlightComplete === 'function') {
            this.onFlightComplete(this.currentFlight);
        }

        // Reset current flight
        this.currentFlight = null;
        this.flightStartTime = null;
        this.currentFlightTime = 0;
        this.currentHobbsTime = 0;
        this.approachTimerStart = null;
    }

    /**
     * Update flight timers
     * @param {Object} data - Flight data
     * @param {number} now - Current timestamp
     */
    updateTimers(data, now) {
        if (!this.flightStartTime) return;

        const elapsed = now - this.flightStartTime;
        this.currentHobbsTime = elapsed;

        // Flight time only counts when airborne
        if (['TAKEOFF', 'AIRBORNE', 'APPROACH', 'LANDING'].includes(this.phase)) {
            this.currentFlightTime = elapsed;
        }

        // Update current flight data
        if (this.currentFlight) {
            this.currentFlight.maxAltitude = Math.max(this.currentFlight.maxAltitude, data.altitude || 0);
            this.currentFlight.maxSpeed = Math.max(this.currentFlight.maxSpeed, data.groundSpeed || 0);
        }
    }

    /**
     * Set departure/destination from flight plan
     * @param {Object} flightPlan - Current flight plan
     */
    updateFlightPlan(flightPlan) {
        if (!this.currentFlight || !flightPlan) return;

        const waypoints = flightPlan.waypoints || [];
        if (waypoints.length > 0) {
            this.currentFlight.departure = waypoints[0].ident || waypoints[0].name;
            this.currentFlight.destination = waypoints[waypoints.length - 1].ident || waypoints[waypoints.length - 1].name;

            // Build route string
            const route = waypoints.map(wp => wp.ident || wp.name).filter(Boolean).join('-');
            this.currentFlight.route = route;
        }
    }

    /**
     * Get current timer values for display
     * @returns {Object} Timer values
     */
    getTimers() {
        const approachTime = this.approachTimerStart
            ? Date.now() - this.approachTimerStart
            : 0;

        return {
            flightTime: this.currentFlightTime,
            hobbsTime: this.currentHobbsTime,
            approachTime,
            flightTimeStr: this.formatDuration(this.currentFlightTime),
            hobbsTimeStr: this.formatDuration(this.currentHobbsTime),
            approachTimeStr: this.formatDuration(approachTime),
            totalFlightTime: this.totalFlightTime,
            totalHobbsTime: this.totalHobbsTime
        };
    }

    /**
     * Get current flight status for display
     * @returns {Object} Flight status
     */
    getStatus() {
        return {
            phase: this.phase,
            phaseLabel: this.getPhaseLabel(),
            phaseColor: this.getPhaseColor(),
            isFlying: this.currentFlight !== null,
            currentFlight: this.currentFlight,
            timers: this.getTimers()
        };
    }

    /**
     * Get human-readable phase label
     * @returns {string} Phase label
     */
    getPhaseLabel() {
        const labels = {
            SHUTDOWN: 'Shutdown',
            ENGINE_START: 'Engine Start',
            TAXI: 'Taxi',
            TAKEOFF: 'Takeoff',
            AIRBORNE: 'Airborne',
            APPROACH: 'Approach',
            LANDING: 'Landing'
        };
        return labels[this.phase] || this.phase;
    }

    /**
     * Get color for current phase
     * @returns {string} CSS color
     */
    getPhaseColor() {
        const colors = {
            SHUTDOWN: '#808080',      // Gray
            ENGINE_START: '#ffaa00',  // Amber
            TAXI: '#ffff00',          // Yellow
            TAKEOFF: '#00ffff',       // Cyan
            AIRBORNE: '#00ff00',      // Green
            APPROACH: '#ffaa00',      // Amber
            LANDING: '#ffff00'        // Yellow
        };
        return colors[this.phase] || '#808080';
    }

    /**
     * Format duration in milliseconds to H:MM:SS
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        if (!ms || ms < 0) return '0:00:00';

        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Load flight history from localStorage
     */
    loadFlightHistory() {
        if (!this.config.persistLogs) return;

        try {
            const stored = localStorage.getItem(this.config.logKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.flightHistory = parsed.history || [];
                this.totalFlightTime = parsed.totalFlightTime || 0;
                this.totalHobbsTime = parsed.totalHobbsTime || 0;
                GTNCore.log(`[FlightLogger] Loaded ${this.flightHistory.length} flight log entries`);
            }
        } catch (e) {
            GTNCore.log(`[FlightLogger] Failed to load flight history: ${e.message}`);
        }
    }

    /**
     * Save flight history to localStorage
     */
    saveFlightHistory() {
        if (!this.config.persistLogs) return;

        try {
            const data = {
                history: this.flightHistory,
                totalFlightTime: this.totalFlightTime,
                totalHobbsTime: this.totalHobbsTime,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(this.config.logKey, JSON.stringify(data));
            GTNCore.log('[FlightLogger] Flight history saved');
        } catch (e) {
            GTNCore.log(`[FlightLogger] Failed to save flight history: ${e.message}`);
        }
    }

    /**
     * Get flight history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Flight history
     */
    getHistory(limit = 10) {
        return this.flightHistory.slice(0, limit);
    }

    /**
     * Export flight history as CSV
     * @returns {string} CSV data
     */
    exportCSV() {
        const headers = [
            'Date', 'Departure', 'Destination', 'Aircraft', 'Route',
            'Flight Time', 'Hobbs Time', 'Max Altitude', 'Max Speed', 'Fuel Used'
        ];

        const rows = this.flightHistory.map(flight => [
            flight.startTime.split('T')[0],
            flight.departure || '-',
            flight.destination || '-',
            flight.aircraft,
            flight.route || '-',
            this.formatDuration(flight.flightTime),
            this.formatDuration(flight.hobbsTime),
            Math.round(flight.maxAltitude),
            Math.round(flight.maxSpeed),
            Math.round(flight.fuelUsed * 10) / 10
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csv;
    }

    /**
     * Clear flight history
     */
    clearHistory() {
        this.flightHistory = [];
        this.totalFlightTime = 0;
        this.totalHobbsTime = 0;
        this.saveFlightHistory();
        GTNCore.log('[FlightLogger] Flight history cleared');
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.currentFlight) {
            // Save in-progress flight
            this.saveFlightHistory();
        }
        GTNCore.log('[FlightLogger] Destroyed');
    }
}

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNFlightLogger;
}
