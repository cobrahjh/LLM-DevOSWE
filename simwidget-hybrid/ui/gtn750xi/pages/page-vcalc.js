/**
 * GTN750Xi VCALC Page - Vertical Calculator
 * Calculates time to TOD and vertical speed required to reach target altitude
 * Based on Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-4 to 4-6)
 */

class VcalcPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.flightPlanManager = options.flightPlanManager || null;
        this.getData = options.getData || (() => ({}));

        // VCALC profile settings
        this.profile = {
            targetAltitude: 3000,           // ft
            altitudeType: 'MSL',            // 'MSL' or 'Above WPT'
            vsProfile: 500,                 // fpm (descent rate)
            offset: 5,                      // nm
            offsetDirection: 'Before',      // 'Before' or 'After'
            targetWaypointIndex: null       // Index in flight plan, null = last waypoint
        };

        // Settings
        this.settings = {
            displayMessages: true,
            restoreDefaultsExcludesWaypoint: true
        };

        // State
        this.status = 'Inactive';
        this.vsRequired = 0;
        this.timeToTOD = 0;
        this.distanceToTOD = 0;
        this.enabled = false;

        // Elements
        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this._initialized = true;
    }

    cacheElements() {
        this.elements = {
            // Profile inputs
            targetAlt: document.getElementById('vcalc-target-alt'),
            altitudeType: document.getElementById('vcalc-alt-type'),
            vsProfile: document.getElementById('vcalc-vs-profile'),
            offset: document.getElementById('vcalc-offset'),
            offsetDirection: document.getElementById('vcalc-offset-dir'),
            targetWaypoint: document.getElementById('vcalc-target-wpt'),

            // Output display
            status: document.getElementById('vcalc-status'),
            vsRequired: document.getElementById('vcalc-vs-required'),
            timeToTOD: document.getElementById('vcalc-time-tod'),
            distToTOD: document.getElementById('vcalc-dist-tod'),

            // Setup controls
            displayMessages: document.getElementById('vcalc-display-messages'),
            restoreDefaults: document.getElementById('vcalc-restore-defaults')
        };
    }

    bindEvents() {
        // Profile input changes
        if (this.elements.targetAlt) {
            this.elements.targetAlt.addEventListener('input', () => {
                this.profile.targetAltitude = parseInt(this.elements.targetAlt.value) || 0;
                this.saveSettings();
                this.calculate();
            });
        }

        if (this.elements.altitudeType) {
            this.elements.altitudeType.addEventListener('click', () => this.toggleAltitudeType());
        }

        if (this.elements.vsProfile) {
            this.elements.vsProfile.addEventListener('input', () => {
                this.profile.vsProfile = parseInt(this.elements.vsProfile.value) || 500;
                this.saveSettings();
                this.calculate();
            });
        }

        if (this.elements.offset) {
            this.elements.offset.addEventListener('input', () => {
                this.profile.offset = parseFloat(this.elements.offset.value) || 0;
                this.saveSettings();
                this.calculate();
            });
        }

        if (this.elements.offsetDirection) {
            this.elements.offsetDirection.addEventListener('click', () => this.toggleOffsetDirection());
        }

        if (this.elements.targetWaypoint) {
            this.elements.targetWaypoint.addEventListener('click', () => this.selectTargetWaypoint());
        }

        // Setup controls
        if (this.elements.displayMessages) {
            this.elements.displayMessages.addEventListener('change', (e) => {
                this.settings.displayMessages = e.target.checked;
                this.saveSettings();
            });
        }

        if (this.elements.restoreDefaults) {
            this.elements.restoreDefaults.addEventListener('click', () => this.restoreDefaults());
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('gtn750xi_vcalc_settings');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const _safe = o => { if (o) { delete o.__proto__; delete o.constructor; delete o.prototype; } return o; };
                if (data.profile) Object.assign(this.profile, _safe(data.profile));
                if (data.settings) Object.assign(this.settings, _safe(data.settings));
            } catch (e) {
                console.error('[VCALC] Failed to load settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750xi_vcalc_settings', JSON.stringify({
            profile: this.profile,
            settings: this.settings
        }));
    }

    restoreDefaults() {
        this.profile.targetAltitude = 3000;
        this.profile.altitudeType = 'MSL';
        this.profile.vsProfile = 500;
        this.profile.offset = 5;
        this.profile.offsetDirection = 'Before';
        // Exclude targetWaypointIndex per spec
        this.saveSettings();
        this.render();
        this.calculate();
    }

    toggleAltitudeType() {
        this.profile.altitudeType = this.profile.altitudeType === 'MSL' ? 'Above WPT' : 'MSL';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    toggleOffsetDirection() {
        // Check if target waypoint is the last in flight plan
        const plan = this.flightPlanManager?.flightPlan;
        if (plan?.waypoints?.length) {
            const targetIdx = this.profile.targetWaypointIndex ?? (plan.waypoints.length - 1);
            const isLast = targetIdx === plan.waypoints.length - 1;

            // "After" not available for last waypoint
            if (isLast && this.profile.offsetDirection === 'Before') {
                return; // Can't switch to After
            }
        }

        this.profile.offsetDirection = this.profile.offsetDirection === 'Before' ? 'After' : 'Before';
        this.saveSettings();
        this.render();
        this.calculate();
    }

    selectTargetWaypoint() {
        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) {
            alert('No active flight plan');
            return;
        }

        // Show waypoint picker modal
        if (this.onShowWaypointPicker) {
            this.onShowWaypointPicker((selectedIndex) => {
                this.profile.targetWaypointIndex = selectedIndex;
                this.saveSettings();
                this.render();
                this.calculate();
            });
        }
    }

    /**
     * Calculate VCALC outputs based on current profile and aircraft state
     */
    calculate() {
        const data = this.getData();
        const plan = this.flightPlanManager?.flightPlan;

        // Feature inhibit checks
        if (!this.enabled) {
            this.status = 'Inactive';
            this.vsRequired = 0;
            this.timeToTOD = 0;
            this.distanceToTOD = 0;
            this.render();
            return;
        }

        // Check inhibit conditions
        const groundSpeed = data.groundSpeed || 0;
        if (groundSpeed < 35) {
            this.status = 'Speed < 35kt';
            this.vsRequired = 0;
            this.render();
            return;
        }

        if (!plan?.waypoints?.length && !this.flightPlanManager?.directToTarget) {
            this.status = 'No flight plan';
            this.vsRequired = 0;
            this.render();
            return;
        }

        // Get target waypoint
        const targetIdx = this.profile.targetWaypointIndex ?? (plan?.waypoints?.length - 1);
        const targetWp = plan?.waypoints?.[targetIdx];
        if (!targetWp) {
            this.status = 'Invalid target';
            this.vsRequired = 0;
            this.render();
            return;
        }

        // Calculate distance to target waypoint
        let distToTarget = 0;
        const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;

        for (let i = activeIdx + 1; i <= targetIdx; i++) {
            const wp = plan.waypoints[i];
            if (wp?.distanceFromPrev) {
                distToTarget += wp.distanceFromPrev;
            }
        }

        // Add distance to active waypoint
        const gpsNav = this.flightPlanManager?.calculateGpsNavigation(data.latitude, data.longitude);
        if (gpsNav?.distance) {
            distToTarget += gpsNav.distance;
        }

        // Apply offset
        const offsetNM = this.profile.offset || 0;
        const distToTOD = this.profile.offsetDirection === 'Before'
            ? distToTarget - offsetNM
            : distToTarget + offsetNM;

        this.distanceToTOD = distToTOD;

        // Calculate altitude delta
        const currentAlt = data.altitude || 0;
        let targetAlt = this.profile.targetAltitude || 0;

        // If "Above WPT" mode, add waypoint elevation
        if (this.profile.altitudeType === 'Above WPT' && targetWp.elevation) {
            targetAlt += targetWp.elevation;
        }

        const altDelta = currentAlt - targetAlt;

        // Check if already at or below target
        if (altDelta <= 0) {
            this.status = 'At target altitude';
            this.vsRequired = 0;
            this.timeToTOD = 0;
            this.render();
            return;
        }

        // Check if TOD is behind us
        if (distToTOD <= 0) {
            this.status = 'Past TOD';
            this.vsRequired = Math.round(-this.profile.vsProfile);
            this.timeToTOD = 0;
            this.render();
            return;
        }

        // Calculate time to TOD
        this.timeToTOD = groundSpeed > 0 ? (distToTOD / groundSpeed) * 60 : 0; // minutes

        // Calculate required VS to reach target at offset point
        // VS = altitude delta / time to TOD
        this.vsRequired = this.timeToTOD > 0 ? Math.round(-(altDelta / this.timeToTOD)) : 0;

        // Determine status message
        if (this.timeToTOD > 1) {
            this.status = 'Descend to target';
        } else if (this.timeToTOD > 0 && this.timeToTOD <= 1) {
            this.status = 'Approaching TOD';
        } else {
            this.status = 'At TOD';
        }

        this.render();
    }

    /**
     * Render profile inputs and calculated outputs
     */
    render() {
        if (!this._initialized) return;

        // Update input fields
        if (this.elements.targetAlt) this.elements.targetAlt.value = this.profile.targetAltitude;
        if (this.elements.altitudeType) this.elements.altitudeType.textContent = this.profile.altitudeType;
        if (this.elements.vsProfile) this.elements.vsProfile.value = this.profile.vsProfile;
        if (this.elements.offset) this.elements.offset.value = this.profile.offset;
        if (this.elements.offsetDirection) {
            const plan = this.flightPlanManager?.flightPlan;
            const targetIdx = this.profile.targetWaypointIndex ?? (plan?.waypoints?.length - 1);
            const isLast = plan?.waypoints && targetIdx === plan.waypoints.length - 1;
            this.elements.offsetDirection.textContent = this.profile.offsetDirection;
            this.elements.offsetDirection.classList.toggle('disabled', isLast && this.profile.offsetDirection === 'Before');
        }

        // Target waypoint display
        if (this.elements.targetWaypoint) {
            const plan = this.flightPlanManager?.flightPlan;
            if (plan?.waypoints?.length) {
                const targetIdx = this.profile.targetWaypointIndex ?? (plan.waypoints.length - 1);
                const wp = plan.waypoints[targetIdx];
                this.elements.targetWaypoint.textContent = wp?.ident || '----';
            } else {
                this.elements.targetWaypoint.textContent = '----';
            }
        }

        // Update outputs
        if (this.elements.status) this.elements.status.textContent = this.status;
        if (this.elements.vsRequired) {
            this.elements.vsRequired.textContent = this.vsRequired !== 0 ? `${this.vsRequired} FPM` : '--- FPM';
        }
        if (this.elements.timeToTOD) {
            if (this.timeToTOD > 0) {
                const mins = Math.floor(this.timeToTOD);
                const secs = Math.round((this.timeToTOD - mins) * 60);
                this.elements.timeToTOD.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            } else {
                this.elements.timeToTOD.textContent = '--:--';
            }
        }
        if (this.elements.distToTOD) {
            this.elements.distToTOD.textContent = this.distanceToTOD > 0
                ? `${this.distanceToTOD.toFixed(1)} NM`
                : '--- NM';
        }

        // Update setup controls
        if (this.elements.displayMessages) {
            this.elements.displayMessages.checked = this.settings.displayMessages;
        }
    }

    /**
     * Update VCALC calculations (called from main update loop)
     */
    update() {
        if (!this.enabled) return;
        this.calculate();
    }

    /**
     * Enable VCALC feature
     */
    enable() {
        this.enabled = true;
        this.calculate();
    }

    /**
     * Disable VCALC feature
     */
    disable() {
        this.enabled = false;
        this.status = 'Inactive';
        this.vsRequired = 0;
        this.render();
    }

    /**
     * Get current VCALC status for display in other pages
     */
    getStatus() {
        return {
            enabled: this.enabled,
            status: this.status,
            vsRequired: this.vsRequired,
            timeToTOD: this.timeToTOD,
            distanceToTOD: this.distanceToTOD
        };
    }

    /**
     * Check if VCALC should be inhibited based on current flight conditions
     */
    isInhibited() {
        const data = this.getData();
        const plan = this.flightPlanManager?.flightPlan;

        // Groundspeed < 35 knots
        if ((data.groundSpeed || 0) < 35) return true;

        // No active flight plan or direct-to
        if (!plan?.waypoints?.length && !this.flightPlanManager?.directToTarget) return true;

        // SUSP, OBS, or Vectors-to-Final mode active
        // (Would need to check these modes from CDI manager or flight plan manager)

        // Navigating to waypoint after FAF
        // (Would need FAF detection from procedures)

        return false;
    }

    destroy() {
        // No intervals to clean up
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VcalcPage;
}
