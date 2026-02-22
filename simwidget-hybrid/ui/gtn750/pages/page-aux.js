/**
 * GTN750 AUX Page - Trip planning, timer, and calculator utilities
 * Provides flight planning tools and utility functions
 */

class AuxPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Timer state
        this.timer = {
            running: false,
            elapsed: 0,
            mode: 'up', // 'up' or 'down'
            preset: 0,
            interval: null
        };

        // Calculator state
        this.calculator = {
            display: '0',
            memory: 0,
            operation: null,
            waitingForOperand: true
        };

        // Trip planning data
        this.tripData = {
            fuelRate: 10, // gal/hr
            fuelOnBoard: 50, // gal
            reserveFuel: 5, // gal
            trueAirspeed: 120 // kts
        };

        // Elements
        this.elements = {};
    }

    /**
     * Initialize page
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
    }

    cacheElements() {
        this.elements = {
            // Trip planning
            auxDist: document.getElementById('aux-dist'),
            auxTime: document.getElementById('aux-time'),
            auxEta: document.getElementById('aux-eta'),
            auxFuel: document.getElementById('aux-fuel'),
            // Timer elements
            timerDisplay: document.getElementById('timer-display'),
            timerStartStop: document.getElementById('timer-toggle'),
            timerReset: document.getElementById('timer-reset')
        };
    }

    bindEvents() {
        // Timer controls
        this.elements.timerStartStop?.addEventListener('click', () => this.toggleTimer());
        this.elements.timerReset?.addEventListener('click', () => this.resetTimer());

        // Logbook controls
        const exportBtn = document.getElementById('logbook-export');
        const clearBtn = document.getElementById('logbook-clear');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogbook());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLogbook());
        }
    }

    loadSettings() {
        // Load trip planning settings from localStorage
        const saved = localStorage.getItem('gtn750_trip_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                delete settings.__proto__; delete settings.constructor; delete settings.prototype;
                Object.assign(this.tripData, settings);
            } catch (e) {
                if (window.telemetry) {
                    telemetry.captureError(e, {
                        operation: 'loadSettings',
                        component: 'GTN750-AuxPage',
                        storage: 'localStorage'
                    });
                }
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750_trip_settings', JSON.stringify(this.tripData));
    }

    // ===== TIMER FUNCTIONS =====

    /**
     * Start or stop timer
     */
    toggleTimer() {
        if (this.timer.running) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }

    /**
     * Start timer
     */
    startTimer() {
        if (this.timer.running) return;

        this.timer.running = true;
        this.timer.interval = setInterval(() => {
            if (this.timer.mode === 'up') {
                this.timer.elapsed++;
            } else {
                this.timer.elapsed--;
                if (this.timer.elapsed <= 0) {
                    this.timer.elapsed = 0;
                    this.timerAlarm();
                    this.stopTimer();
                }
            }
            this.updateTimerDisplay();
        }, 1000);

        // Update button text
        if (this.elements.timerStartStop) {
            this.elements.timerStartStop.textContent = 'STOP';
        }
    }

    /**
     * Stop timer
     */
    stopTimer() {
        this.timer.running = false;
        if (this.timer.interval) {
            clearInterval(this.timer.interval);
            this.timer.interval = null;
        }

        // Update button text
        if (this.elements.timerStartStop) {
            this.elements.timerStartStop.textContent = 'START';
        }
    }

    /**
     * Reset timer
     */
    resetTimer() {
        this.stopTimer();
        this.timer.elapsed = this.timer.mode === 'down' ? this.timer.preset : 0;
        this.updateTimerDisplay();
    }

    /**
     * Set timer mode
     */
    setTimerMode(mode) {
        this.timer.mode = mode;
        this.resetTimer();
    }

    /**
     * Set countdown preset
     */
    setTimerPreset(seconds) {
        this.timer.preset = seconds;
        if (this.timer.mode === 'down') {
            this.timer.elapsed = seconds;
            this.updateTimerDisplay();
        }
    }

    /**
     * Timer alarm callback
     */
    timerAlarm() {
        GTNCore.log('[GTN750] Timer alarm!');
        // Could trigger audio or visual alert
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        if (!this.elements.timerDisplay) return;

        const hours = Math.floor(this.timer.elapsed / 3600);
        const minutes = Math.floor((this.timer.elapsed % 3600) / 60);
        const seconds = this.timer.elapsed % 60;

        const display = hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes}:${seconds.toString().padStart(2, '0')}`;

        this.elements.timerDisplay.textContent = display;
    }

    /**
     * Get timer state
     */
    getTimerState() {
        return {
            running: this.timer.running,
            elapsed: this.timer.elapsed,
            mode: this.timer.mode,
            formatted: this.formatTime(this.timer.elapsed)
        };
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ===== CALCULATOR FUNCTIONS =====

    /**
     * Input digit
     */
    inputDigit(digit) {
        if (this.calculator.waitingForOperand) {
            this.calculator.display = digit;
            this.calculator.waitingForOperand = false;
        } else {
            this.calculator.display = this.calculator.display === '0'
                ? digit
                : this.calculator.display + digit;
        }
        return this.calculator.display;
    }

    /**
     * Input decimal point
     */
    inputDecimal() {
        if (this.calculator.waitingForOperand) {
            this.calculator.display = '0.';
            this.calculator.waitingForOperand = false;
        } else if (!this.calculator.display.includes('.')) {
            this.calculator.display += '.';
        }
        return this.calculator.display;
    }

    /**
     * Clear calculator
     */
    clearCalculator() {
        this.calculator.display = '0';
        this.calculator.memory = 0;
        this.calculator.operation = null;
        this.calculator.waitingForOperand = true;
        return this.calculator.display;
    }

    /**
     * Perform operation
     */
    performOperation(nextOperation) {
        const inputValue = parseFloat(this.calculator.display);

        if (this.calculator.operation && !this.calculator.waitingForOperand) {
            const result = this.calculate(this.calculator.memory, inputValue, this.calculator.operation);
            this.calculator.display = String(result);
            this.calculator.memory = result;
        } else {
            this.calculator.memory = inputValue;
        }

        this.calculator.waitingForOperand = true;
        this.calculator.operation = nextOperation;
        return this.calculator.display;
    }

    /**
     * Calculate result
     */
    calculate(left, right, operation) {
        switch (operation) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return right !== 0 ? left / right : 'Error';
            default: return right;
        }
    }

    /**
     * Calculate equals
     */
    equals() {
        if (!this.calculator.operation) return this.calculator.display;

        const inputValue = parseFloat(this.calculator.display);
        const result = this.calculate(this.calculator.memory, inputValue, this.calculator.operation);

        this.calculator.display = String(result);
        this.calculator.memory = 0;
        this.calculator.operation = null;
        this.calculator.waitingForOperand = true;

        return this.calculator.display;
    }

    // ===== TRIP PLANNING FUNCTIONS =====

    /**
     * Update trip data
     */
    updateTripData(flightPlan, aircraftData) {
        if (!flightPlan?.waypoints?.length) return null;

        // Calculate remaining distance
        let remainingDist = 0;
        const activeIndex = flightPlan.activeWaypointIndex || 0;

        for (let i = activeIndex; i < flightPlan.waypoints.length; i++) {
            const wp = flightPlan.waypoints[i];
            if (wp.distanceFromPrev) {
                remainingDist += wp.distanceFromPrev;
            }
        }

        // Calculate time remaining
        const groundSpeed = aircraftData?.groundSpeed || this.tripData.trueAirspeed;
        const timeRemaining = groundSpeed > 0 ? remainingDist / groundSpeed : 0; // hours

        // Calculate fuel required
        const fuelRequired = timeRemaining * this.tripData.fuelRate;

        // Calculate ETA
        const zuluTime = aircraftData?.zuluTime || (Date.now() / 3600000) % 24;
        const eta = (zuluTime + timeRemaining) % 24;

        // Calculate fuel status
        const fuelRemaining = this.tripData.fuelOnBoard - fuelRequired;
        const fuelStatus = fuelRemaining >= this.tripData.reserveFuel ? 'OK' : 'LOW';

        return {
            remainingDist: Math.round(remainingDist),
            timeRemaining: this.formatEte(timeRemaining * 60),
            eta: this.formatZulu(eta),
            fuelRequired: Math.round(fuelRequired),
            fuelRemaining: Math.round(fuelRemaining),
            fuelStatus
        };
    }

    formatEte(minutes) {
        if (!isFinite(minutes) || minutes < 0) return '--:--';
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}` : `${mins}m`;
    }

    formatZulu(hours) {
        const h = Math.floor(hours) % 24;
        const m = Math.floor((hours % 1) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}Z`;
    }

    /**
     * Set fuel rate
     */
    setFuelRate(rate) {
        this.tripData.fuelRate = rate;
        this.saveSettings();
    }

    /**
     * Set fuel on board
     */
    setFuelOnBoard(gallons) {
        this.tripData.fuelOnBoard = gallons;
        this.saveSettings();
    }

    /**
     * Set reserve fuel
     */
    setReserveFuel(gallons) {
        this.tripData.reserveFuel = gallons;
        this.saveSettings();
    }

    /**
     * Get trip settings
     */
    getTripSettings() {
        return { ...this.tripData };
    }

    // ===== UTILITY CALCULATIONS =====

    /**
     * Calculate headwind/tailwind component
     */
    calculateWindComponent(windDirection, windSpeed, heading) {
        const angleDiff = (windDirection - heading) * Math.PI / 180;
        const headwind = windSpeed * Math.cos(angleDiff);
        const crosswind = windSpeed * Math.sin(angleDiff);

        return {
            headwind: Math.round(headwind), // positive = headwind, negative = tailwind
            crosswind: Math.round(Math.abs(crosswind)),
            crosswindDirection: crosswind > 0 ? 'R' : 'L'
        };
    }

    /**
     * Calculate density altitude
     */
    calculateDensityAltitude(pressureAltitude, temperature) {
        // Standard temp at sea level = 15°C, lapse rate = 2°C per 1000ft
        const standardTemp = 15 - (pressureAltitude / 1000 * 2);
        const tempDiff = temperature - standardTemp;
        const densityAlt = pressureAltitude + (120 * tempDiff);
        return Math.round(densityAlt);
    }

    /**
     * Calculate true airspeed
     */
    calculateTrueAirspeed(indicatedAirspeed, altitude) {
        // Approximate: TAS increases ~2% per 1000ft
        const correction = 1 + (altitude / 1000 * 0.02);
        return Math.round(indicatedAirspeed * correction);
    }

    /**
     * Calculate time/speed/distance
     */
    calculateTSD(params) {
        // Given any two, calculate the third
        const { time, speed, distance } = params;

        if (time && speed) {
            return { distance: speed * time };
        } else if (time && distance) {
            return { speed: distance / time };
        } else if (speed && distance) {
            return { time: distance / speed };
        }
        return null;
    }

    /**
     * Calculate fuel burn
     */
    calculateFuelBurn(params) {
        const { fuelRate, time, fuel } = params;

        if (fuelRate && time) {
            return { fuel: fuelRate * time };
        } else if (fuel && time) {
            return { fuelRate: fuel / time };
        } else if (fuel && fuelRate) {
            return { time: fuel / fuelRate };
        }
        return null;
    }

    // ===== SUBPAGE MANAGEMENT =====

    /**
     * Show specific subpage
     * @param {string} subpage - Subpage to show ('trip', 'util', 'calc', 'logbook')
     */
    showSubpage(subpage) {
        // Hide all subpages
        const subpages = ['trip', 'timer', 'calc', 'logbook'];
        subpages.forEach(id => {
            const el = document.getElementById(`aux-${id}`);
            if (el) el.style.display = 'none';
        });

        // Show requested subpage
        const targetEl = document.getElementById(`aux-${subpage}`);
        if (targetEl) {
            targetEl.style.display = 'block';
        }

        // Update logbook if showing it
        if (subpage === 'logbook') {
            this.renderLogbook();
        }
    }

    // ===== FLIGHT LOGGER UI =====

    /**
     * Set flight logger instance
     * @param {GTNFlightLogger} flightLogger - Flight logger instance
     */
    setFlightLogger(flightLogger) {
        this.flightLogger = flightLogger;
    }

    /**
     * Render logbook display
     */
    renderLogbook() {
        if (!this.flightLogger) return;

        // Render current flight panel
        this.renderCurrentFlight();

        // Render flight history table
        this.renderFlightHistory();

        // Render statistics
        this.renderStats();
    }

    /**
     * Render current flight panel
     */
    renderCurrentFlight() {
        if (!this.flightLogger) return;

        const status = this.flightLogger.getStatus();
        const timers = status.timers;

        // Update phase display
        const phaseEl = document.getElementById('logbook-phase');
        if (phaseEl) {
            phaseEl.textContent = status.phaseLabel;
            phaseEl.style.color = status.phaseColor;
        }

        // Update timers
        const hobbsEl = document.getElementById('logbook-hobbs');
        const flightEl = document.getElementById('logbook-flight');
        const approachEl = document.getElementById('logbook-approach');

        if (hobbsEl) hobbsEl.textContent = timers.hobbsTimeStr;
        if (flightEl) flightEl.textContent = timers.flightTimeStr;
        if (approachEl) approachEl.textContent = timers.approachTimeStr;

        // Update current flight info
        if (status.currentFlight) {
            const aircraft = document.getElementById('logbook-current-aircraft');
            const route = document.getElementById('logbook-current-route');

            if (aircraft) aircraft.textContent = status.currentFlight.aircraft || 'Unknown';
            if (route) {
                const dep = status.currentFlight.departure || '----';
                const dest = status.currentFlight.destination || '----';
                route.textContent = `${dep} → ${dest}`;
            }
        }
    }

    /**
     * Render flight history table
     */
    renderFlightHistory() {
        if (!this.flightLogger) return;

        const tableBody = document.getElementById('logbook-history-table');
        if (!tableBody) return;

        const history = this.flightLogger.getHistory(20); // Last 20 flights

        tableBody.innerHTML = '';

        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666;">No flight history</td></tr>';
            return;
        }

        history.forEach(flight => {
            const row = document.createElement('tr');
            row.className = 'logbook-row';

            const date = new Date(flight.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const dep = flight.departure || '----';
            const dest = flight.destination || '----';
            const aircraft = flight.aircraft || 'Unknown';
            const flightTime = this.flightLogger.formatDuration(flight.flightTime);
            const hobbsTime = this.flightLogger.formatDuration(flight.hobbsTime);

            row.innerHTML = `
                <td>${date}</td>
                <td>${dep}</td>
                <td>${dest}</td>
                <td>${aircraft}</td>
                <td>${flightTime}</td>
                <td>${hobbsTime}</td>
            `;

            tableBody.appendChild(row);
        });
    }

    /**
     * Render statistics
     */
    renderStats() {
        if (!this.flightLogger) return;

        const timers = this.flightLogger.getTimers();
        const history = this.flightLogger.getHistory(999);

        // Total flight time
        const totalFlightEl = document.getElementById('logbook-total-flight');
        if (totalFlightEl) {
            totalFlightEl.textContent = this.flightLogger.formatDuration(timers.totalFlightTime);
        }

        // Total Hobbs time
        const totalHobbsEl = document.getElementById('logbook-total-hobbs');
        if (totalHobbsEl) {
            totalHobbsEl.textContent = this.flightLogger.formatDuration(timers.totalHobbsTime);
        }

        // Total flights
        const totalFlightsEl = document.getElementById('logbook-total-flights');
        if (totalFlightsEl) {
            totalFlightsEl.textContent = history.length.toString();
        }
    }

    /**
     * Export logbook to CSV
     */
    exportLogbook() {
        if (!this.flightLogger) return;

        const csv = this.flightLogger.exportCSV();

        // Download file
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logbook-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        GTNCore.log('[AuxPage] Logbook exported to CSV');
    }

    /**
     * Clear flight history
     */
    clearLogbook() {
        if (!this.flightLogger) return;

        const confirm = window.confirm('Clear all flight history? This cannot be undone.');
        if (!confirm) return;

        this.flightLogger.clearHistory();
        this.renderLogbook();

        GTNCore.log('[AuxPage] Flight history cleared');
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuxPage;
}
