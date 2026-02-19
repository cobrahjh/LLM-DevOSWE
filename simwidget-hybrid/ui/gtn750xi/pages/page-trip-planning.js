/**
 * GTN750Xi Trip Planning Page
 * Based on Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-7 to 4-10)
 * Calculates DTK, DIS, ETE, ETA, ESA, and sunrise/sunset for routes
 */

class TripPlanningPage {
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
            fromWaypoint: null,      // { ident, lat, lon }
            toWaypoint: null,        // { ident, lat, lon }
            departTime: '12:00',     // Local time
            departDate: this._todayString(),
            groundSpeed: 120,
            useSensorData: false
        };

        // Flight Plan settings
        this.flightPlan = {
            selectedPlan: 'active',  // 'active' or catalog name
            selectedLeg: 'cumulative', // 'cumulative' or leg index
            departTime: '12:00',
            departDate: this._todayString(),
            groundSpeed: 120,
            useSensorData: false
        };

        // Calculated results
        this.results = {
            dtk: null,
            dis: null,
            ete: null,      // minutes
            eta: null,      // Date object
            esa: null,
            sunrise: null,  // HH:MM
            sunset: null    // HH:MM
        };

        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this._initialized = true;
        this.render();
    }

    cacheElements() {
        this.elements = {
            // Mode toggle
            modeBtn: document.getElementById('trip-mode'),

            // Point-to-Point controls
            pPosBtn: document.getElementById('trip-p-pos'),
            fromWptBtn: document.getElementById('trip-from-wpt'),
            toWptBtn: document.getElementById('trip-to-wpt'),

            // Flight Plan controls
            flightPlanBtn: document.getElementById('trip-fpl-select'),
            legBtn: document.getElementById('trip-leg-select'),

            // Common inputs
            departTime: document.getElementById('trip-depart-time'),
            departDate: document.getElementById('trip-depart-date'),
            groundSpeed: document.getElementById('trip-ground-speed'),
            useSensorBtn: document.getElementById('trip-use-sensor'),

            // Results display
            resultsContainer: document.getElementById('trip-results'),
            dtk: document.getElementById('trip-result-dtk'),
            dis: document.getElementById('trip-result-dis'),
            ete: document.getElementById('trip-result-ete'),
            eta: document.getElementById('trip-result-eta'),
            esa: document.getElementById('trip-result-esa'),
            sunrise: document.getElementById('trip-result-sunrise'),
            sunset: document.getElementById('trip-result-sunset')
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
        this.elements.departTime?.addEventListener('change', () => {
            this.getCurrentSettings().departTime = this.elements.departTime.value;
            this.saveSettings();
            this.calculate();
        });

        this.elements.departDate?.addEventListener('change', () => {
            this.getCurrentSettings().departDate = this.elements.departDate.value;
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
        const saved = localStorage.getItem('gtn750xi_trip_planning_settings');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.mode) this.mode = data.mode;
                if (data.pointToPoint) Object.assign(this.pointToPoint, data.pointToPoint);
                if (data.flightPlan) Object.assign(this.flightPlan, data.flightPlan);
            } catch (e) {
                console.error('[Trip Planning] Failed to load settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750xi_trip_planning_settings', JSON.stringify({
            mode: this.mode,
            pointToPoint: this.pointToPoint,
            flightPlan: this.flightPlan
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
        // Show flight plan picker (active or catalog)
        // For now, default to active
        this.flightPlan.selectedPlan = 'active';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    selectLeg() {
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) return;

        // Show leg picker (cumulative or specific leg index)
        // For now, toggle between cumulative and first leg
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
     * Calculate trip data based on current mode and inputs
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

        const data = this.getData();
        const magvar = data.magvar || 0;

        // Calculate DTK (magnetic)
        this.results.dtk = this.core.calculateMagneticBearing(from.lat, from.lon, to.lat, to.lon, magvar);

        // Calculate DIS
        this.results.dis = this.core.calculateDistance(from.lat, from.lon, to.lat, to.lon);

        // Calculate ETE
        const gs = this.pointToPoint.useSensorData ? (data.groundSpeed || 120) : this.pointToPoint.groundSpeed;
        this.results.ete = gs > 0 ? (this.results.dis / gs) * 60 : null; // minutes

        // Calculate ETA (Point-to-Point: ETA = ETE + departure time)
        this.results.eta = this._calculateETA(this.pointToPoint.departDate, this.pointToPoint.departTime, this.results.ete);

        // Calculate ESA (placeholder - requires terrain database)
        this.results.esa = this._estimateESA(from, to);

        // Calculate Sunrise/Sunset at destination
        const { sunrise, sunset } = this._calculateSunriseSunset(to.lat, to.lon, this.pointToPoint.departDate);
        this.results.sunrise = sunrise;
        this.results.sunset = sunset;
    }

    _calculateFlightPlan() {
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) {
            this._clearResults();
            return;
        }

        const data = this.getData();
        const magvar = data.magvar || 0;
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

        // Check if leg is completed (for active flight plan)
        if (isActivePlan && startIdx >= plan.waypoints.length) {
            this._clearResults();
            return;
        }

        // Calculate cumulative distance and bearing
        let totalDist = 0;
        let lastBearing = null;

        // If active flight plan, add distance to active waypoint
        if (isActivePlan && this.flightPlan.selectedLeg === 'cumulative') {
            const gpsNav = this.flightPlanManager?.calculateGpsNavigation(data.latitude, data.longitude);
            if (gpsNav?.distance) totalDist += gpsNav.distance;
        }

        for (let i = startIdx + 1; i <= endIdx; i++) {
            const wp = plan.waypoints[i];
            if (wp?.distanceFromPrev) {
                totalDist += wp.distanceFromPrev;
            }

            // Get bearing of last leg
            if (i === endIdx && i > 0) {
                const prev = plan.waypoints[i - 1];
                if (prev && wp && prev.lat && wp.lat) {
                    lastBearing = this.core.calculateMagneticBearing(prev.lat, prev.lng || prev.lon, wp.lat, wp.lng || wp.lon, magvar);
                }
            }
        }

        this.results.dtk = lastBearing;
        this.results.dis = totalDist;

        // Calculate ETE
        const gs = this.flightPlan.useSensorData ? (data.groundSpeed || 120) : this.flightPlan.groundSpeed;
        this.results.ete = gs > 0 ? (totalDist / gs) * 60 : null; // minutes

        // Calculate ETA (depends on active vs catalog)
        if (isActivePlan) {
            // Active: ETA = current time + ETE
            const now = new Date();
            this.results.eta = this.results.ete ? new Date(now.getTime() + this.results.ete * 60000) : null;
        } else {
            // Catalog: ETA = departure time + ETE
            this.results.eta = this._calculateETA(this.flightPlan.departDate, this.flightPlan.departTime, this.results.ete);
        }

        // ESA
        const from = plan.waypoints[startIdx];
        const to = plan.waypoints[endIdx];
        this.results.esa = this._estimateESA(from, to);

        // Sunrise/Sunset at destination
        if (to) {
            const { sunrise, sunset } = this._calculateSunriseSunset(to.lat, to.lng || to.lon, this.flightPlan.departDate);
            this.results.sunrise = sunrise;
            this.results.sunset = sunset;
        }
    }

    _clearResults() {
        this.results = { dtk: null, dis: null, ete: null, eta: null, esa: null, sunrise: null, sunset: null };
    }

    _calculateETA(dateStr, timeStr, eteMinutes) {
        if (!eteMinutes) return null;
        try {
            const [hours, minutes] = timeStr.split(':').map(n => parseInt(n));
            const departDate = new Date(dateStr);
            departDate.setHours(hours, minutes, 0, 0);
            return new Date(departDate.getTime() + eteMinutes * 60000);
        } catch (e) {
            return null;
        }
    }

    _estimateESA(from, to) {
        // Simplified ESA: use higher of departure/arrival elevation + 1000ft
        // Real implementation would query terrain database
        const fromElev = from?.elevation || 0;
        const toElev = to?.elevation || 0;
        return Math.max(fromElev, toElev) + 1000;
    }

    _calculateSunriseSunset(lat, lon, dateStr) {
        // Simplified calculation using approximate formula
        // Real implementation: https://en.wikipedia.org/wiki/Sunrise_equation
        try {
            const date = new Date(dateStr);
            const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

            // Approximate solar noon (12:00 UTC + longitude correction)
            const solarNoon = 12 - (lon / 15);

            // Approximate day length based on latitude and day of year
            const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
            const hourAngle = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(declination * Math.PI / 180)) * 180 / Math.PI / 15;

            const sunrise = solarNoon - hourAngle;
            const sunset = solarNoon + hourAngle;

            const formatTime = (hours) => {
                const h = Math.floor(hours);
                const m = Math.floor((hours - h) * 60);
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            };

            return {
                sunrise: formatTime(sunrise),
                sunset: formatTime(sunset)
            };
        } catch (e) {
            return { sunrise: '--:--', sunset: '--:--' };
        }
    }

    _todayString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    render() {
        if (!this._initialized) return;

        // Update mode button
        if (this.elements.modeBtn) {
            this.elements.modeBtn.textContent = this.mode === 'point-to-point' ? 'Point to Point' : 'Flight Plan';
        }

        // Show/hide mode-specific controls
        const ptp = this.mode === 'point-to-point';
        const showPTPControls = document.querySelectorAll('.trip-ptp-control');
        const showFPLControls = document.querySelectorAll('.trip-fpl-control');
        showPTPControls.forEach(el => el.style.display = ptp ? '' : 'none');
        showFPLControls.forEach(el => el.style.display = ptp ? 'none' : '');

        // Point-to-Point controls
        if (this.elements.pPosBtn) {
            this.elements.pPosBtn.classList.toggle('active', this.pointToPoint.usePresentPosition);
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
        if (this.elements.departTime) this.elements.departTime.value = settings.departTime;
        if (this.elements.departDate) this.elements.departDate.value = settings.departDate;
        if (this.elements.groundSpeed) {
            this.elements.groundSpeed.value = settings.groundSpeed;
            this.elements.groundSpeed.disabled = settings.useSensorData;
        }
        if (this.elements.useSensorBtn) {
            this.elements.useSensorBtn.classList.toggle('active', settings.useSensorData);
        }

        // Results
        this._renderResults();
    }

    _renderResults() {
        if (this.elements.dtk) {
            this.elements.dtk.textContent = this.results.dtk !== null ? `${Math.round(this.results.dtk).toString().padStart(3, '0')}°` : '---°';
        }
        if (this.elements.dis) {
            this.elements.dis.textContent = this.results.dis !== null ? `${this.results.dis.toFixed(1)} NM` : '--- NM';
        }
        if (this.elements.ete) {
            if (this.results.ete !== null) {
                const hours = Math.floor(this.results.ete / 60);
                const minutes = Math.round(this.results.ete % 60);
                this.elements.ete.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
            } else {
                this.elements.ete.textContent = '--:--';
            }
        }
        if (this.elements.eta) {
            if (this.results.eta) {
                const hours = this.results.eta.getHours();
                const minutes = this.results.eta.getMinutes();
                this.elements.eta.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                this.elements.eta.textContent = '--:--';
            }
        }
        if (this.elements.esa) {
            this.elements.esa.textContent = this.results.esa !== null ? `${this.results.esa.toLocaleString()} FT` : '--- FT';
        }
        if (this.elements.sunrise) {
            this.elements.sunrise.textContent = this.results.sunrise || '--:--';
        }
        if (this.elements.sunset) {
            this.elements.sunset.textContent = this.results.sunset || '--:--';
        }
    }

    update() {
        // Update sensor data if active
        const settings = this.getCurrentSettings();
        if (settings.useSensorData) {
            const data = this.getData();
            settings.groundSpeed = data.groundSpeed || 120;
            this.calculate();
        }
    }

    destroy() {
        // No intervals to clean up
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TripPlanningPage;
}
