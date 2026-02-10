/**
 * GTN Flight Plan - Flight plan management, Direct-To, waypoint sequencing
 * Extracted from widget.js for modular architecture
 */

class GTNFlightPlan {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.elements = options.elements || {};
        this.serverPort = options.serverPort || 8080;
        this.syncChannel = options.syncChannel || null;

        // Waypoint sequencing constants
        this.SEQUENCING = {
            DEBOUNCE_MS: 3000,           // Minimum time between sequences (ms)
            MIN_THRESHOLD_NM: 0.5,       // Minimum sequence distance (NM)
            LEG_PERCENT: 0.1,            // Sequence at 10% of leg distance
            MIN_GROUND_SPEED: 15,        // Minimum speed to sequence (kt)
            MAX_TRACK_ERROR: 120,        // Maximum track error to sequence (°)
            CLOSE_PROXIMITY_NM: 0.2,     // Very close - sequence regardless of track (NM)
            DEFAULT_LEG_DIST: 5          // Default leg distance if unknown (NM)
        };

        // Audio chime settings
        this.AUDIO = {
            FREQUENCY_HZ: 880,           // Sequence chime frequency (Hz)
            DURATION_SEC: 0.15,          // Chime duration (seconds)
            VOLUME: 0.1                  // Volume (0.0 - 1.0)
        };

        // Polling interval
        this.FETCH_INTERVAL_MS = 30000;  // Flight plan fetch interval (30s)

        // Flight plan state
        this.flightPlan = null;
        this.activeWaypointIndex = 0;
        this.activeWaypoint = null;
        this.lastSequenceTime = 0;

        // Direct-To state
        this.dtoTarget = null;

        // Audio context for sequence chime
        this.audioContext = null;

        // Callbacks for external notifications
        this.onWaypointChanged = options.onWaypointChanged || null;
        this.onDirectToActivated = options.onDirectToActivated || null;
        this.onInsertComplete = options.onInsertComplete || null;
        this.onFlightPlanChanged = options.onFlightPlanChanged || null;

        // Insert mode state (used when FPL INSERT opens Direct-To modal)
        this._insertMode = false;
        this._insertIndex = -1;

        // Timer handle for cleanup
        this._fetchTimer = null;
    }

    // ===== FLIGHT PLAN FETCH =====

    async fetchFlightPlan() {
        try {
            // Don't overwrite a SimBrief or manually-loaded plan
            if (this.flightPlan?.source === 'simbrief' || this.flightPlan?.source === 'manual') {
                this._fetchTimer = setTimeout(() => this.fetchFlightPlan(), this.FETCH_INTERVAL_MS);
                return;
            }
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/flightplan`);
            if (response.ok) {
                const data = await response.json();
                // Re-check after await — SimBrief plan may have been set during fetch
                if (data?.waypoints?.length > 0 &&
                    this.flightPlan?.source !== 'simbrief' &&
                    this.flightPlan?.source !== 'manual') {
                    this.flightPlan = data;
                    this.notifyChanged();
                }
            }
        } catch (e) {
            GTNCore.log('[GTN750] No flight plan');
        }
        this._fetchTimer = setTimeout(() => this.fetchFlightPlan(), this.FETCH_INTERVAL_MS);
    }

    updateFplHeader() {
        if (!this.flightPlan) return;
        const wps = this.flightPlan.waypoints;
        if (wps.length > 0) {
            if (this.elements.fplDep) this.elements.fplDep.textContent = wps[0].ident || '----';
            if (this.elements.fplArr) this.elements.fplArr.textContent = wps[wps.length - 1].ident || '----';
        }

        let totalDist = 0;
        wps.forEach(wp => {
            if (wp.distanceFromPrev) totalDist += wp.distanceFromPrev;
        });
        if (this.elements.fplDist) this.elements.fplDist.textContent = Math.round(totalDist);

        if (this.elements.fplEte) {
            // groundSpeed must be provided externally
            const gs = this._groundSpeed || 0;
            if (gs > 0) {
                const eteMin = (totalDist / gs) * 60;
                this.elements.fplEte.textContent = this.core.formatEte(eteMin);
            }
        }
    }

    renderFlightPlan() {
        if (!this.elements.fplList) return;
        this.elements.fplList.textContent = '';

        if (!this.flightPlan?.waypoints?.length) {
            const empty = document.createElement('div');
            empty.className = 'gtn-fpl-empty';
            empty.textContent = 'No flight plan loaded';
            this.elements.fplList.appendChild(empty);
            return;
        }

        this.flightPlan.waypoints.forEach((wp, index) => {
            const item = document.createElement('div');
            item.className = 'gtn-fpl-item';
            if (wp.passed) item.classList.add('passed');
            if (index === this.activeWaypointIndex) item.classList.add('active');

            const left = document.createElement('div');
            const ident = document.createElement('div');
            ident.className = 'gtn-fpl-ident';
            ident.textContent = wp.ident || `WP${index + 1}`;
            const type = document.createElement('div');
            type.className = 'gtn-fpl-type';
            type.textContent = wp.type || '';
            left.appendChild(ident);
            left.appendChild(type);

            const right = document.createElement('div');
            right.className = 'gtn-fpl-data';
            const dist = document.createElement('span');
            dist.textContent = wp.distanceFromPrev ? Math.round(wp.distanceFromPrev) + ' NM' : '';
            right.appendChild(dist);

            item.appendChild(left);
            item.appendChild(right);
            item.addEventListener('click', () => this.selectWaypoint(index));
            this.elements.fplList.appendChild(item);
        });

        this.updateFplProgress();
    }

    updateFplProgress() {
        if (!this.elements.fplProgress || !this.flightPlan?.waypoints) return;
        const total = this.flightPlan.waypoints.length;
        const passed = this.flightPlan.waypoints.filter(wp => wp.passed).length;
        const progress = total > 0 ? (passed / total) * 100 : 0;
        this.elements.fplProgress.style.width = progress + '%';
    }

    selectWaypoint(index) {
        this.activeWaypointIndex = index;
        if (this.flightPlan?.waypoints[index]) {
            this.notifyChanged();
            if (this.syncChannel) {
                this.syncChannel.postMessage({
                    type: 'waypoint-select',
                    data: { index, ident: this.flightPlan.waypoints[index].ident }
                });
            }
            if (this.onWaypointChanged) this.onWaypointChanged();
        }
    }

    activateLeg() {
        if (this.activeWaypointIndex < this.flightPlan?.waypoints?.length) {
            for (let i = 0; i < this.activeWaypointIndex; i++) {
                this.flightPlan.waypoints[i].passed = true;
            }
            this.notifyChanged();
        }
    }

    invertFlightPlan() {
        if (this.flightPlan?.waypoints) {
            this.flightPlan.waypoints.reverse();
            this.activeWaypointIndex = 0;
            this.notifyChanged();
        }
    }

    /**
     * Update waypoint display strip
     * @param {Object} data - Current sim data { latitude, longitude, groundSpeed, heading, magvar }
     * @param {Object} cdiManager - GTNCdi instance for legacy CDI update
     */
    updateWaypointDisplay(data, cdiManager) {
        const wp = this.flightPlan?.waypoints[this.activeWaypointIndex];
        if (!wp) return;

        if (this.elements.wptId) this.elements.wptId.textContent = wp.ident || '----';

        if (data.latitude && wp.lat && wp.lng) {
            const dist = this.core.calculateDistance(data.latitude, data.longitude, wp.lat, wp.lng);
            const trueBrg = this.core.calculateBearing(data.latitude, data.longitude, wp.lat, wp.lng);
            const magBrg = this.core.trueToMagnetic(trueBrg, data.magvar || 0);

            if (this.elements.wptDis) this.elements.wptDis.textContent = dist.toFixed(1);
            if (this.elements.wptBrg) this.elements.wptBrg.textContent = Math.round(magBrg).toString().padStart(3, '0');

            if (data.groundSpeed > 0 && this.elements.wptEte) {
                const eteMin = (dist / data.groundSpeed) * 60;
                this.elements.wptEte.textContent = this.core.formatEte(eteMin);
            }

            // DTK: desired track from previous waypoint to active waypoint
            if (this.elements.wptDtk) {
                const prevWp = this.activeWaypointIndex > 0
                    ? this.flightPlan.waypoints[this.activeWaypointIndex - 1]
                    : null;
                if (prevWp && prevWp.lat && prevWp.lng) {
                    const dtk = this.core.trueToMagnetic(
                        this.core.calculateBearing(prevWp.lat, prevWp.lng, wp.lat, wp.lng),
                        data.magvar || 0
                    );
                    this.elements.wptDtk.textContent = Math.round(dtk).toString().padStart(3, '0');
                } else {
                    this.elements.wptDtk.textContent = Math.round(magBrg).toString().padStart(3, '0');
                }
            }

            if (cdiManager) {
                cdiManager.updateLegacyCDI(magBrg, dist, data);
            }
        }
    }

    // ===== WAYPOINT AUTO-SEQUENCING =====

    /**
     * Check if aircraft should sequence to next waypoint
     * @param {Object} data - Current sim data
     * @param {boolean} obsSuspended - Whether OBS mode suspends sequencing
     */
    checkWaypointSequencing(data, obsSuspended) {
        const now = Date.now();
        if (now - this.lastSequenceTime < this.SEQUENCING.DEBOUNCE_MS) return;

        if (obsSuspended) return;
        if (!this.flightPlan?.waypoints?.length) return;
        if (!data.latitude || !data.longitude) return;
        if (this.activeWaypointIndex >= this.flightPlan.waypoints.length - 1) return;

        const wp = this.flightPlan.waypoints[this.activeWaypointIndex];
        if (!wp || !wp.lat || !wp.lng) return;

        const dist = this.core.calculateDistance(
            data.latitude, data.longitude,
            wp.lat, wp.lng
        );

        const legDist = wp.distanceFromPrev || this.SEQUENCING.DEFAULT_LEG_DIST;
        const threshold = Math.min(this.SEQUENCING.MIN_THRESHOLD_NM, legDist * this.SEQUENCING.LEG_PERCENT);

        if (dist <= threshold && data.groundSpeed > this.SEQUENCING.MIN_GROUND_SPEED) {
            const brg = this.core.calculateBearing(
                data.latitude, data.longitude,
                wp.lat, wp.lng
            );
            const trackError = Math.abs(this.core.normalizeAngle(data.track - brg));

            if (trackError < this.SEQUENCING.MAX_TRACK_ERROR || dist < this.SEQUENCING.CLOSE_PROXIMITY_NM) {
                this.sequenceToNextWaypoint();
            }
        }
    }

    sequenceToNextWaypoint() {
        this.lastSequenceTime = Date.now();

        const passedWp = this.flightPlan.waypoints[this.activeWaypointIndex];
        if (passedWp) {
            passedWp.passed = true;
            GTNCore.log(`[GTN750] Sequenced past ${passedWp.ident}, advancing to next waypoint`);
        }

        this.activeWaypointIndex++;

        if (this.activeWaypointIndex < this.flightPlan.waypoints.length) {
            const nextWp = this.flightPlan.waypoints[this.activeWaypointIndex];
            GTNCore.log(`[GTN750] Active waypoint: ${nextWp?.ident}`);

            this.activeWaypoint = {
                ident: nextWp.ident,
                lat: nextWp.lat,
                lon: nextWp.lng
            };

            if (this.syncChannel) {
                this.syncChannel.postMessage({
                    type: 'waypoint-sequence',
                    data: {
                        passedIndex: this.activeWaypointIndex - 1,
                        activeIndex: this.activeWaypointIndex,
                        passedIdent: passedWp?.ident,
                        activeIdent: nextWp?.ident
                    }
                });
            }

            this.playSequenceChime();
        } else {
            GTNCore.log('[GTN750] Arrived at final waypoint');
            this.activeWaypoint = null;
        }

        this.notifyChanged();
        if (this.onWaypointChanged) this.onWaypointChanged();
    }

    playSequenceChime() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                return;
            }
        }

        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.type = 'sine';
            osc.frequency.value = this.AUDIO.FREQUENCY_HZ;
            gain.gain.value = this.AUDIO.VOLUME;

            const stopTime = this.audioContext.currentTime + this.AUDIO.DURATION_SEC;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
            osc.stop(stopTime);
        } catch (e) {
            // Ignore audio errors
        }
    }

    // ===== DIRECT-TO =====

    showDirectTo(prefilledIdent = null, options = {}) {
        const modal = document.getElementById('dto-modal');
        const input = document.getElementById('dto-input');
        const info = document.getElementById('dto-info');
        const activateBtn = document.getElementById('dto-activate');
        const header = modal?.querySelector('.dto-header');

        if (!modal) return;

        // Store insert mode state
        this._insertMode = options.insertMode || false;
        this._insertIndex = options.insertIndex ?? -1;

        // Update header text based on mode
        if (header) header.textContent = this._insertMode ? 'INSERT WAYPOINT' : 'DIRECT TO';

        modal.style.display = 'block';
        input.value = prefilledIdent || '';
        info.innerHTML = '<span class="dto-name">Enter waypoint identifier</span>';
        activateBtn.disabled = true;
        this.dtoTarget = null;

        setTimeout(() => input.focus(), 50);

        input.oninput = () => {
            const ident = input.value.toUpperCase().trim();
            if (ident.length >= 2) {
                this.lookupDirectToWaypoint(ident);
            } else {
                info.innerHTML = '<span class="dto-name">Enter waypoint identifier</span>';
                activateBtn.disabled = true;
                this.dtoTarget = null;
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter' && this.dtoTarget) {
                this.activateDirectTo();
            } else if (e.key === 'Escape') {
                this.hideDirectTo();
            }
        };

        activateBtn.onclick = () => this.activateDirectTo();
        document.getElementById('dto-cancel').onclick = () => this.hideDirectTo();
    }

    hideDirectTo() {
        const modal = document.getElementById('dto-modal');
        if (modal) modal.style.display = 'none';
    }

    async lookupDirectToWaypoint(ident) {
        const info = document.getElementById('dto-info');
        const activateBtn = document.getElementById('dto-activate');

        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/waypoint/${ident}`);
            if (response.ok) {
                const data = await response.json();
                if (data && (data.lat || data.latitude)) {
                    this.dtoTarget = {
                        ident: ident,
                        name: data.name || data.facility_name || ident,
                        lat: data.lat || data.latitude,
                        lon: data.lon || data.longitude,
                        type: data.type || 'WAYPOINT'
                    };

                    const dist = this.core.calculateDistance(
                        this._currentLat || 0, this._currentLon || 0,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );
                    const brg = this.core.calculateBearing(
                        this._currentLat || 0, this._currentLon || 0,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );

                    info.innerHTML = `
                        <div class="dto-name">${this.dtoTarget.name}</div>
                        <div class="dto-coords">${this.dtoTarget.type} - ${dist.toFixed(1)}nm @ ${Math.round(brg)}°</div>
                    `;
                    activateBtn.disabled = false;
                    return;
                }
            }
        } catch (e) {
            // Fallback
        }

        // Check nearest page items if provided
        if (this._nearestPage) {
            const item = this._nearestPage.items?.find(i =>
                (i.icao || i.id)?.toUpperCase() === ident
            );
            if (item) {
                this.dtoTarget = {
                    ident: item.icao || item.id,
                    name: item.name || ident,
                    lat: item.lat,
                    lon: item.lon,
                    type: item.type || 'AIRPORT'
                };
                info.innerHTML = `
                    <div class="dto-name">${this.dtoTarget.name}</div>
                    <div class="dto-coords">${item.distance}nm @ ${item.bearing}°</div>
                `;
                activateBtn.disabled = false;
                return;
            }
        }

        info.innerHTML = '<span class="dto-name" style="color: var(--gtn-yellow);">Waypoint not found</span>';
        activateBtn.disabled = true;
        this.dtoTarget = null;
    }

    activateDirectTo() {
        if (!this.dtoTarget) return;

        // Insert mode: add waypoint to flight plan instead of Direct-To
        if (this._insertMode && this._insertIndex >= 0) {
            const waypoint = {
                ident: this.dtoTarget.ident,
                lat: this.dtoTarget.lat,
                lng: this.dtoTarget.lon,
                type: this.dtoTarget.type || 'WAYPOINT',
                name: this.dtoTarget.name || this.dtoTarget.ident
            };
            GTNCore.log(`[GTN750] Insert waypoint: ${waypoint.ident} at index ${this._insertIndex}`);
            this.insertWaypoint(waypoint, this._insertIndex);
            this._insertMode = false;
            this._insertIndex = -1;
            this.hideDirectTo();
            if (this.onInsertComplete) this.onInsertComplete();
            return;
        }

        GTNCore.log(`[GTN750] Direct-To activated: ${this.dtoTarget.ident}`);

        this.activeWaypoint = this.dtoTarget;

        if (this.elements.wptId) this.elements.wptId.textContent = this.dtoTarget.ident;
        if (this.elements.wptType) this.elements.wptType.textContent = 'D→';

        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'direct-to',
                data: this.dtoTarget
            });
        }

        this.hideDirectTo();

        if (this.onDirectToActivated) this.onDirectToActivated();
    }

    directTo(item) {
        if (item) {
            this.dtoTarget = {
                ident: item.icao || item.id,
                name: item.name || item.icao || item.id,
                lat: item.lat,
                lon: item.lon,
                type: item.type || 'WAYPOINT'
            };
            this.activateDirectTo();
        } else {
            this.showDirectTo();
        }
    }

    /**
     * Update current position for distance calculations in Direct-To lookups
     */
    setPosition(lat, lon) {
        this._currentLat = lat;
        this._currentLon = lon;
    }

    /**
     * Set nearest page reference for D→ waypoint lookups
     */
    setNearestPage(nearestPage) {
        this._nearestPage = nearestPage;
    }

    /**
     * Set ground speed for ETE calculations in header
     */
    setGroundSpeed(gs) {
        this._groundSpeed = gs;
    }

    /**
     * Handle sync channel messages related to flight plan
     */
    handleSyncMessage(type, data) {
        if (type === 'route-update' && data.waypoints) {
            // Don't overwrite a SimBrief plan with a route-update
            if (this.flightPlan?.source !== 'simbrief') {
                this.flightPlan = data;
                this.notifyChanged();
            }
        }
        if (type === 'simbrief-plan' && data.waypoints) {
            this.flightPlan = {
                departure: data.departure,
                arrival: data.arrival,
                waypoints: data.waypoints,
                totalDistance: data.totalDistance,
                route: data.route,
                cruiseAltitude: data.altitude,
                source: 'simbrief'
            };
            this.activeWaypointIndex = 0;
            this.notifyChanged();
            if (this.onWaypointChanged) this.onWaypointChanged();
            GTNCore.log(`[GTN750] SimBrief flight plan loaded: ${data.departure} -> ${data.arrival} (${data.waypoints.length} waypoints)`);
        }
        if (type === 'waypoint-select') {
            this.selectWaypoint(data.index);
        }
        if (type === 'waypoint-sequence') {
            if (this.flightPlan?.waypoints?.[data.passedIndex]) {
                this.flightPlan.waypoints[data.passedIndex].passed = true;
            }
            this.activeWaypointIndex = data.activeIndex;
            this.notifyChanged();
            if (this.onWaypointChanged) this.onWaypointChanged();
        }
    }

    // ===== NOTIFY / GETTERS =====

    notifyChanged() {
        if (this.onFlightPlanChanged) {
            this.onFlightPlanChanged(this.flightPlan);
        } else {
            this.renderFlightPlan();
            this.updateFplHeader();
        }
    }

    getFlightPlan() {
        return this.flightPlan;
    }

    getActiveWaypointIndex() {
        return this.activeWaypointIndex;
    }

    // ===== WAYPOINT EDITING =====

    deleteWaypoint(index) {
        if (!this.flightPlan?.waypoints || index < 0 || index >= this.flightPlan.waypoints.length) return;

        this.flightPlan.waypoints.splice(index, 1);

        // Adjust active waypoint index
        if (this.activeWaypointIndex >= this.flightPlan.waypoints.length) {
            this.activeWaypointIndex = Math.max(0, this.flightPlan.waypoints.length - 1);
        } else if (index < this.activeWaypointIndex) {
            this.activeWaypointIndex--;
        }

        this.notifyChanged();
        if (this.onWaypointChanged) this.onWaypointChanged();
    }

    insertWaypoint(waypoint, atIndex) {
        if (!this.flightPlan) {
            this.flightPlan = { waypoints: [] };
        }
        if (!this.flightPlan.waypoints) {
            this.flightPlan.waypoints = [];
        }

        const idx = Math.max(0, Math.min(atIndex, this.flightPlan.waypoints.length));
        this.flightPlan.waypoints.splice(idx, 0, waypoint);

        // Recalculate distanceFromPrev for inserted and next wp
        if (idx > 0 && waypoint.lat && waypoint.lng) {
            const prev = this.flightPlan.waypoints[idx - 1];
            if (prev?.lat && prev?.lng) {
                waypoint.distanceFromPrev = this.core.calculateDistance(prev.lat, prev.lng, waypoint.lat, waypoint.lng);
            }
        }
        if (idx + 1 < this.flightPlan.waypoints.length) {
            const next = this.flightPlan.waypoints[idx + 1];
            if (next?.lat && next?.lng && waypoint.lat && waypoint.lng) {
                next.distanceFromPrev = this.core.calculateDistance(waypoint.lat, waypoint.lng, next.lat, next.lng);
            }
        }

        // Adjust active waypoint index
        if (idx <= this.activeWaypointIndex) {
            this.activeWaypointIndex++;
        }

        this.notifyChanged();
        if (this.onWaypointChanged) this.onWaypointChanged();
    }

    destroy() {
        if (this._fetchTimer) clearTimeout(this._fetchTimer);
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
        }
    }
}
