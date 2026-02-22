/**
 * GTN750Xi Fuel Planning Page
 * Based on Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-11 to 4-14)
 * Calculates fuel required, reserves, range, efficiency, and endurance
 */

class FuelPlanningPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.flightPlanManager = options.flightPlanManager || null;
        this.getData = options.getData || (() => ({}));

        // Mode: 'point-to-point' or 'flight-plan'
        this.mode = 'point-to-point';

        // Point-to-Point settings
        this.pointToPoint = {
            usePresentPosition: false,
            fromWaypoint: null,
            toWaypoint: null,
            estFuelRemaining: 50,    // gallons
            fuelFlow: 10,            // GPH
            groundSpeed: 120,
            useSensorData: false
        };

        // Flight Plan settings
        this.flightPlan = {
            selectedPlan: 'active',
            selectedLeg: 'cumulative',
            estFuelRemaining: 50,
            fuelFlow: 10,
            groundSpeed: 120,
            useSensorData: false
        };

        // Reserve fuel settings (45 min default per FAA VFR)
        this.reserveMinutes = 45;

        // Calculated results
        this.results = {
            fuelRequired: null,      // gallons
            fuelAfterLeg: null,      // gallons
            reserveAfterLeg: null,   // minutes
            range: null,             // NM
            efficiency: null,        // NM/GAL
            endurance: null          // minutes
        };

        // Fuel countdown timer
        this._fuelCountdownInterval = null;
        this._lastFuelUpdate = Date.now();

        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this._initialized = true;
        this.startFuelCountdown();
        this.render();
    }

    cacheElements() {
        this.elements = {
            // Mode toggle
            modeBtn: document.getElementById('fuel-mode'),

            // Point-to-Point controls
            pPosBtn: document.getElementById('fuel-p-pos'),
            fromWptBtn: document.getElementById('fuel-from-wpt'),
            toWptBtn: document.getElementById('fuel-to-wpt'),

            // Flight Plan controls
            flightPlanBtn: document.getElementById('fuel-fpl-select'),
            legBtn: document.getElementById('fuel-leg-select'),

            // Common inputs
            estFuelRemaining: document.getElementById('fuel-est-remaining'),
            fuelFlow: document.getElementById('fuel-flow'),
            groundSpeed: document.getElementById('fuel-ground-speed'),
            useSensorBtn: document.getElementById('fuel-use-sensor'),

            // Results display
            fuelRequired: document.getElementById('fuel-result-required'),
            fuelAfterLeg: document.getElementById('fuel-result-after'),
            reserveAfterLeg: document.getElementById('fuel-result-reserve'),
            range: document.getElementById('fuel-result-range'),
            efficiency: document.getElementById('fuel-result-efficiency'),
            endurance: document.getElementById('fuel-result-endurance')
        };
    }

    bindEvents() {
        // Mode toggle
        this.elements.modeBtn?.addEventListener('click', () => this.toggleMode());

        // Point-to-Point controls
        this.elements.pPosBtn?.addEventListener('click', () => this.togglePresentPosition());
        this.elements.fromWptBtn?.addEventListener('click', () => this.selectFromWaypoint());
        this.elements.toWptBtn?.addEventListener('click', () => this.selectToWaypoint());

        // Flight Plan controls
        this.elements.flightPlanBtn?.addEventListener('click', () => this.selectFlightPlan());
        this.elements.legBtn?.addEventListener('click', () => this.selectLeg());

        // Common inputs
        this.elements.estFuelRemaining?.addEventListener('input', () => {
            this.getCurrentSettings().estFuelRemaining = parseFloat(this.elements.estFuelRemaining.value) || 0;
            this.saveSettings();
            this.calculate();
        });

        this.elements.fuelFlow?.addEventListener('input', () => {
            this.getCurrentSettings().fuelFlow = parseFloat(this.elements.fuelFlow.value) || 0;
            this.saveSettings();
            this.calculate();
        });

        this.elements.groundSpeed?.addEventListener('input', () => {
            this.getCurrentSettings().groundSpeed = parseInt(this.elements.groundSpeed.value) || 120;
            this.saveSettings();
            this.calculate();
        });

        this.elements.useSensorBtn?.addEventListener('click', () => this.toggleUseSensorData());
    }

    loadSettings() {
        const saved = localStorage.getItem('gtn750xi_fuel_planning_settings');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.mode) this.mode = data.mode;
                const _safe = o => { if (o) { delete o.__proto__; delete o.constructor; delete o.prototype; } return o; };
                if (data.pointToPoint) Object.assign(this.pointToPoint, _safe(data.pointToPoint));
                if (data.flightPlan) Object.assign(this.flightPlan, _safe(data.flightPlan));
                if (data.reserveMinutes) this.reserveMinutes = data.reserveMinutes;
            } catch (e) {
                console.error('[Fuel Planning] Failed to load settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750xi_fuel_planning_settings', JSON.stringify({
            mode: this.mode,
            pointToPoint: this.pointToPoint,
            flightPlan: this.flightPlan,
            reserveMinutes: this.reserveMinutes
        }));
    }

    getCurrentSettings() {
        return this.mode === 'point-to-point' ? this.pointToPoint : this.flightPlan;
    }

    toggleMode() {
        this.mode = this.mode === 'point-to-point' ? 'flight-plan' : 'point-to-point';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    togglePresentPosition() {
        this.pointToPoint.usePresentPosition = !this.pointToPoint.usePresentPosition;
        if (this.pointToPoint.usePresentPosition) {
            const data = this.getData();
            this.pointToPoint.fromWaypoint = {
                ident: 'P.POS',
                lat: data.latitude,
                lon: data.longitude
            };
        } else {
            this.pointToPoint.fromWaypoint = null;
        }
        this.saveSettings();
        this.render();
        this.calculate();
    }

    toggleUseSensorData() {
        const settings = this.getCurrentSettings();
        settings.useSensorData = !settings.useSensorData;
        if (settings.useSensorData) {
            const data = this.getData();
            settings.estFuelRemaining = data.fuelTotal || 50;
            settings.fuelFlow = data.fuelFlow || 10;
            settings.groundSpeed = data.groundSpeed || 120;
        }
        this.saveSettings();
        this.render();
        this.calculate();
    }

    selectFromWaypoint() {
        if (this.onShowWaypointPicker) {
            this.onShowWaypointPicker((waypoint) => {
                this.pointToPoint.fromWaypoint = waypoint;
                this.saveSettings();
                this.render();
                this.calculate();
            });
        }
    }

    selectToWaypoint() {
        if (this.onShowWaypointPicker) {
            this.onShowWaypointPicker((waypoint) => {
                this.pointToPoint.toWaypoint = waypoint;
                this.saveSettings();
                this.render();
                this.calculate();
            });
        }
    }

    selectFlightPlan() {
        this.flightPlan.selectedPlan = 'active';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    selectLeg() {
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) return;
        this.flightPlan.selectedLeg = this.flightPlan.selectedLeg === 'cumulative' ? 0 : 'cumulative';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    nextLeg() {
        if (this.mode !== 'flight-plan') return;
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) return;

        if (this.flightPlan.selectedLeg === 'cumulative') {
            this.flightPlan.selectedLeg = 0;
        } else if (this.flightPlan.selectedLeg < plan.waypoints.length - 1) {
            this.flightPlan.selectedLeg++;
        }
        this.saveSettings();
        this.render();
        this.calculate();
    }

    prevLeg() {
        if (this.mode !== 'flight-plan') return;
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) return;

        if (this.flightPlan.selectedLeg === 0) {
            this.flightPlan.selectedLeg = 'cumulative';
        } else if (this.flightPlan.selectedLeg !== 'cumulative') {
            this.flightPlan.selectedLeg--;
        }
        this.saveSettings();
        this.render();
        this.calculate();
    }

    /**
     * Start fuel countdown timer (decrements EST Fuel Remaining once per second)
     */
    startFuelCountdown() {
        if (this._fuelCountdownInterval) clearInterval(this._fuelCountdownInterval);

        this._fuelCountdownInterval = setInterval(() => {
            const settings = this.getCurrentSettings();
            if (settings.fuelFlow > 0 && settings.estFuelRemaining > 0) {
                const now = Date.now();
                const elapsedSec = (now - this._lastFuelUpdate) / 1000;
                this._lastFuelUpdate = now;

                // Decrement fuel: gallons per hour / 3600 = gallons per second
                const fuelUsed = (settings.fuelFlow / 3600) * elapsedSec;
                settings.estFuelRemaining = Math.max(0, settings.estFuelRemaining - fuelUsed);

                if (this.elements.estFuelRemaining) {
                    this.elements.estFuelRemaining.value = settings.estFuelRemaining.toFixed(1);
                }

                this.calculate();
            }
        }, 1000);
    }

    /**
     * Calculate fuel data based on current mode and inputs
     */
    calculate() {
        if (this.mode === 'point-to-point') {
            this._calculatePointToPoint();
        } else {
            this._calculateFlightPlan();
        }
        this.render();
    }

    _calculatePointToPoint() {
        const from = this.pointToPoint.fromWaypoint;
        const to = this.pointToPoint.toWaypoint;

        if (!from || !to) {
            this._clearResults();
            return;
        }

        // Calculate distance
        const distance = this.core.calculateDistance(from.lat, from.lon, to.lat, to.lon);

        const settings = this.pointToPoint;
        this._calculateFuelData(distance, settings);
    }

    _calculateFlightPlan() {
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) {
            this._clearResults();
            return;
        }

        const data = this.getData();
        const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;
        const isActivePlan = this.flightPlan.selectedPlan === 'active';

        // Determine leg range
        let startIdx, endIdx;
        if (this.flightPlan.selectedLeg === 'cumulative') {
            startIdx = isActivePlan ? activeIdx : 0;
            endIdx = plan.waypoints.length - 1;
        } else {
            startIdx = this.flightPlan.selectedLeg;
            endIdx = this.flightPlan.selectedLeg + 1;
        }

        // Calculate cumulative distance
        let totalDist = 0;

        if (isActivePlan && this.flightPlan.selectedLeg === 'cumulative') {
            const gpsNav = this.flightPlanManager?.calculateGpsNavigation(data.latitude, data.longitude);
            if (gpsNav?.distance) totalDist += gpsNav.distance;
        }

        for (let i = startIdx + 1; i <= endIdx; i++) {
            const wp = plan.waypoints[i];
            if (wp?.distanceFromPrev) {
                totalDist += wp.distanceFromPrev;
            }
        }

        const settings = this.flightPlan;
        this._calculateFuelData(totalDist, settings);
    }

    _calculateFuelData(distance, settings) {
        const estFuel = settings.estFuelRemaining || 0;
        const fuelFlow = settings.fuelFlow || 0;
        const groundSpeed = settings.groundSpeed || 0;

        if (groundSpeed <= 0 || fuelFlow <= 0) {
            this._clearResults();
            return;
        }

        // Calculate time for leg (hours)
        const timeHours = distance / groundSpeed;

        // Fuel Required = time × fuel flow
        this.results.fuelRequired = timeHours * fuelFlow;

        // Fuel After Leg = EST Fuel Remaining - Fuel Required
        this.results.fuelAfterLeg = Math.max(0, estFuel - this.results.fuelRequired);

        // Reserve After Leg = (Fuel After Leg / Fuel Flow) × 60 (minutes)
        this.results.reserveAfterLeg = fuelFlow > 0 ? (this.results.fuelAfterLeg / fuelFlow) * 60 : 0;

        // Range = (EST Fuel Remaining / Fuel Flow) × Ground Speed
        this.results.range = (estFuel / fuelFlow) * groundSpeed;

        // Efficiency = Ground Speed / Fuel Flow (NM per gallon)
        this.results.efficiency = fuelFlow > 0 ? groundSpeed / fuelFlow : 0;

        // Endurance = EST Fuel Remaining / Fuel Flow (hours → minutes)
        this.results.endurance = fuelFlow > 0 ? (estFuel / fuelFlow) * 60 : 0;
    }

    _clearResults() {
        this.results = {
            fuelRequired: null,
            fuelAfterLeg: null,
            reserveAfterLeg: null,
            range: null,
            efficiency: null,
            endurance: null
        };
    }

    render() {
        if (!this._initialized) return;

        // Update mode button
        if (this.elements.modeBtn) {
            this.elements.modeBtn.textContent = this.mode === 'point-to-point' ? 'Point to Point' : 'Flight Plan';
        }

        // Show/hide mode-specific controls
        const ptp = this.mode === 'point-to-point';
        const showPTPControls = document.querySelectorAll('.fuel-ptp-control');
        const showFPLControls = document.querySelectorAll('.fuel-fpl-control');
        showPTPControls.forEach(el => el.style.display = ptp ? '' : 'none');
        showFPLControls.forEach(el => el.style.display = ptp ? 'none' : '');

        // Point-to-Point controls
        if (this.elements.pPosBtn) {
            this.elements.pPosBtn.classList.toggle('active', this.pointToPoint.usePresentPosition);
            this.elements.pPosBtn.textContent = this.pointToPoint.usePresentPosition ? 'ON' : 'OFF';
        }
        if (this.elements.fromWptBtn) {
            this.elements.fromWptBtn.textContent = this.pointToPoint.fromWaypoint?.ident || '----';
            this.elements.fromWptBtn.disabled = this.pointToPoint.usePresentPosition;
        }
        if (this.elements.toWptBtn) {
            this.elements.toWptBtn.textContent = this.pointToPoint.toWaypoint?.ident || '----';
        }

        // Flight Plan controls
        if (this.elements.flightPlanBtn) {
            this.elements.flightPlanBtn.textContent = this.flightPlan.selectedPlan === 'active' ? 'Active FPL' : 'Catalog';
        }
        if (this.elements.legBtn) {
            const legText = this.flightPlan.selectedLeg === 'cumulative' ? 'Cumulative' : `Leg ${this.flightPlan.selectedLeg + 1}`;
            this.elements.legBtn.textContent = legText;
        }

        // Common inputs
        const settings = this.getCurrentSettings();
        if (this.elements.estFuelRemaining) {
            this.elements.estFuelRemaining.value = settings.estFuelRemaining.toFixed(1);
            this.elements.estFuelRemaining.disabled = settings.useSensorData;
        }
        if (this.elements.fuelFlow) {
            this.elements.fuelFlow.value = settings.fuelFlow.toFixed(1);
            this.elements.fuelFlow.disabled = settings.useSensorData;
        }
        if (this.elements.groundSpeed) {
            this.elements.groundSpeed.value = settings.groundSpeed;
            this.elements.groundSpeed.disabled = settings.useSensorData;
        }
        if (this.elements.useSensorBtn) {
            this.elements.useSensorBtn.classList.toggle('active', settings.useSensorData);
            this.elements.useSensorBtn.textContent = settings.useSensorData ? 'ON' : 'OFF';
        }

        // Results
        this._renderResults();
    }

    _renderResults() {
        if (this.elements.fuelRequired) {
            this.elements.fuelRequired.textContent = this.results.fuelRequired !== null
                ? `${this.results.fuelRequired.toFixed(1)} GAL`
                : '--- GAL';
        }
        if (this.elements.fuelAfterLeg) {
            this.elements.fuelAfterLeg.textContent = this.results.fuelAfterLeg !== null
                ? `${this.results.fuelAfterLeg.toFixed(1)} GAL`
                : '--- GAL';
        }
        if (this.elements.reserveAfterLeg) {
            if (this.results.reserveAfterLeg !== null) {
                const hours = Math.floor(this.results.reserveAfterLeg / 60);
                const minutes = Math.floor(this.results.reserveAfterLeg % 60);
                const seconds = Math.round((this.results.reserveAfterLeg % 1) * 60);
                this.elements.reserveAfterLeg.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                this.elements.reserveAfterLeg.textContent = '--:--:--';
            }
        }
        if (this.elements.range) {
            this.elements.range.textContent = this.results.range !== null
                ? `${this.results.range.toFixed(0)} NM`
                : '--- NM';
        }
        if (this.elements.efficiency) {
            this.elements.efficiency.textContent = this.results.efficiency !== null
                ? `${this.results.efficiency.toFixed(1)} NM/GAL`
                : '--- NM/GAL';
        }
        if (this.elements.endurance) {
            if (this.results.endurance !== null) {
                const hours = Math.floor(this.results.endurance / 60);
                const minutes = Math.floor(this.results.endurance % 60);
                const seconds = Math.round((this.results.endurance % 1) * 60);
                this.elements.endurance.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                this.elements.endurance.textContent = '--:--:--';
            }
        }
    }

    update() {
        // Update sensor data if active
        const settings = this.getCurrentSettings();
        if (settings.useSensorData) {
            const data = this.getData();
            settings.estFuelRemaining = data.fuelTotal || settings.estFuelRemaining;
            settings.fuelFlow = data.fuelFlow || settings.fuelFlow;
            settings.groundSpeed = data.groundSpeed || settings.groundSpeed;
            this.calculate();
        }
    }

    destroy() {
        if (this._fuelCountdownInterval) {
            clearInterval(this._fuelCountdownInterval);
            this._fuelCountdownInterval = null;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuelPlanningPage;
}
