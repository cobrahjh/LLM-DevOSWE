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
     * Check if aircraft should sequence to next waypoint with turn anticipation
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

        // Base threshold: smaller of fixed minimum or percentage of leg
        const legDist = wp.distanceFromPrev || this.SEQUENCING.DEFAULT_LEG_DIST;
        let threshold = Math.min(this.SEQUENCING.MIN_THRESHOLD_NM, legDist * this.SEQUENCING.LEG_PERCENT);

        // Add turn anticipation if we have a next waypoint
        if (this.activeWaypointIndex < this.flightPlan.waypoints.length - 1 && data.groundSpeed > 30) {
            const nextWpt = this.flightPlan.waypoints[this.activeWaypointIndex + 1];
            if (nextWpt && nextWpt.lat && nextWpt.lng) {
                // Calculate turn angle
                const inboundTrack = this.core.calculateBearing(data.latitude, data.longitude, wp.lat, wp.lng);
                const outboundTrack = this.core.calculateBearing(wp.lat, wp.lng, nextWpt.lat, nextWpt.lng);
                const turnAngle = Math.abs(this.core.normalizeAngle(outboundTrack - inboundTrack));

                // Turn radius (assuming 25° bank, standard rate turn)
                // R (nm) = V² / (11.26 * tan(bank)) ≈ V² / 52.5
                const turnRadius = Math.pow(data.groundSpeed, 2) / 52.5 / 60; // in nm

                // Lead distance = R * tan(turnAngle / 2)
                if (turnAngle > 10) {
                    const leadDistance = turnRadius * Math.tan(this.core.toRad(turnAngle / 2));
                    threshold += leadDistance;
                    threshold = Math.min(threshold, 2.0); // Cap at 2nm
                }
            }
        }

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

        // Try navdb cross-type search first (airports + VOR + NDB + FIX)
        try {
            const navdbResponse = await fetch(`http://${location.hostname}:${this.serverPort}/api/navdb/search/${ident}`);
            if (navdbResponse.ok) {
                const data = await navdbResponse.json();
                if (data.best) {
                    this.dtoTarget = {
                        ident: data.best.ident || ident,
                        name: data.best.name || ident,
                        lat: data.best.lat,
                        lon: data.best.lon,
                        type: data.best.type || 'WAYPOINT'
                    };

                    const dist = this.core.calculateDistance(
                        this._currentLat || 0, this._currentLon || 0,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );
                    const brg = this.core.calculateBearing(
                        this._currentLat || 0, this._currentLon || 0,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );

                    const extra = data.results?.length > 1 ? ` (+${data.results.length - 1} more)` : '';
                    info.innerHTML = `
                        <div class="dto-name">${this.dtoTarget.name}${extra}</div>
                        <div class="dto-coords">${this.dtoTarget.type} - ${dist.toFixed(1)}nm @ ${Math.round(brg)}°</div>
                    `;
                    activateBtn.disabled = false;
                    return;
                }
            }
        } catch (e) {
            // NavDB unavailable, try legacy
        }

        // Fallback: legacy waypoint API (aviationapi.com for airports)
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
            // Legacy also failed
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

    /**
     * Load a procedure (SID/STAR/Approach) into the flight plan
     * @param {string} type - 'dep', 'arr', or 'apr'
     * @param {Object} procedure - Procedure metadata (name, airport, etc.)
     * @param {Array} waypoints - Array of waypoint objects with ident, lat, lon
     */
    loadProcedure(type, procedure, waypoints) {
        if (!waypoints || waypoints.length === 0) {
            GTNCore.log(`[GTN750] No waypoints to load for ${procedure?.name}`);
            return;
        }

        if (!this.flightPlan) {
            this.flightPlan = { waypoints: [], source: 'manual' };
        }
        if (!this.flightPlan.waypoints) {
            this.flightPlan.waypoints = [];
        }

        // Convert navdb waypoints to flight plan format
        const fplWaypoints = waypoints.map(wp => ({
            ident: wp.ident,
            lat: wp.lat,
            lng: wp.lon,  // Note: flight plan uses 'lng', navdb uses 'lon'
            type: wp.type || 'WAYPOINT',
            pathTerm: wp.pathTerm,
            altDesc: wp.altDesc,
            alt1: wp.alt1,
            alt2: wp.alt2,
            speedLimit: wp.speedLimit
        }));

        let insertIndex = 0;
        let procedureName = procedure?.name || 'UNKNOWN';

        switch (type) {
            case 'dep': // SID - insert after origin
                // Find origin airport (first waypoint) or insert at beginning
                insertIndex = this.flightPlan.waypoints.length > 0 ? 1 : 0;
                GTNCore.log(`[GTN750] Loading departure ${procedureName} at index ${insertIndex}`);
                break;

            case 'arr': // STAR - insert before destination
                // Insert before last waypoint (destination) or at end if no destination
                insertIndex = Math.max(0, this.flightPlan.waypoints.length - 1);
                if (this.flightPlan.waypoints.length === 0) insertIndex = 0;
                GTNCore.log(`[GTN750] Loading arrival ${procedureName} at index ${insertIndex}`);
                break;

            case 'apr': // Approach - append to end
                insertIndex = this.flightPlan.waypoints.length;
                GTNCore.log(`[GTN750] Loading approach ${procedureName} at index ${insertIndex}`);
                break;

            default:
                GTNCore.log(`[GTN750] Unknown procedure type: ${type}`);
                return;
        }

        // Insert all procedure waypoints
        for (let i = 0; i < fplWaypoints.length; i++) {
            this.insertWaypoint(fplWaypoints[i], insertIndex + i);
        }

        // Mark flight plan as manually modified
        this.flightPlan.source = 'manual';

        // Store procedure metadata
        if (!this.flightPlan.procedures) {
            this.flightPlan.procedures = {};
        }
        this.flightPlan.procedures[type] = {
            name: procedureName,
            airport: procedure?.airport || procedure?.ident?.split('.')[0],
            transition: procedure?.transition,
            waypointCount: fplWaypoints.length
        };

        GTNCore.log(`[GTN750] Loaded ${procedureName}: ${fplWaypoints.length} waypoints`);
        this.notifyChanged();
    }

    /**
     * Calculate GPS navigation data (DTK, XTK, CDI) for the active leg
     * @param {number} lat - Current aircraft latitude
     * @param {number} lon - Current aircraft longitude
     * @returns {Object} { dtk, xtrk, cdi, distance, toWaypoint } or null if no active leg
     */
    calculateGpsNavigation(lat, lon) {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length === 0) {
            return null;
        }

        const activeIdx = this.activeWaypointIndex;
        const waypoints = this.flightPlan.waypoints;

        // Need at least one waypoint
        if (activeIdx >= waypoints.length || activeIdx < 0) {
            return null;
        }

        const toWpt = waypoints[activeIdx];
        if (!toWpt || !toWpt.lat || !toWpt.lng) {
            return null;
        }

        // Direct-To case or first waypoint - use direct bearing
        if (activeIdx === 0 || this.dtoTarget) {
            const bearing = this.core.calculateBearing(lat, lon, toWpt.lat, toWpt.lng);
            const distance = this.core.calculateDistance(lat, lon, toWpt.lat, toWpt.lng);

            return {
                dtk: bearing,
                xtrk: 0,  // No cross-track for direct-to
                cdi: 0,
                distance,
                toWaypoint: toWpt.ident
            };
        }

        // Normal leg: calculate from previous waypoint to active waypoint
        const fromWpt = waypoints[activeIdx - 1];
        if (!fromWpt || !fromWpt.lat || !fromWpt.lng) {
            // Fall back to direct bearing
            const bearing = this.core.calculateBearing(lat, lon, toWpt.lat, toWpt.lng);
            const distance = this.core.calculateDistance(lat, lon, toWpt.lat, toWpt.lng);
            return { dtk: bearing, xtrk: 0, cdi: 0, distance, toWaypoint: toWpt.ident };
        }

        // Calculate desired track (DTK): bearing from previous waypoint to active waypoint
        const dtk = this.core.calculateBearing(fromWpt.lat, fromWpt.lng, toWpt.lat, toWpt.lng);

        // Calculate distance to active waypoint
        const distance = this.core.calculateDistance(lat, lon, toWpt.lat, toWpt.lng);

        // Calculate cross-track error (XTK)
        // Using great circle cross-track distance formula
        const d13 = this.core.calculateDistance(fromWpt.lat, fromWpt.lng, lat, lon); // Distance from start of leg
        const brg13 = this.core.calculateBearing(fromWpt.lat, fromWpt.lng, lat, lon); // Bearing to aircraft

        // Cross-track distance in nautical miles
        const xtrk = Math.asin(Math.sin(d13 / 60 / 180 * Math.PI) *
                               Math.sin((brg13 - dtk) * Math.PI / 180)) * 60 * 180 / Math.PI;

        // CDI needle deflection: -127 to +127
        // Full scale deflection (FSD) = 5nm for enroute, 1nm for terminal, 0.3nm for approach
        // TODO: Detect approach mode and adjust FSD accordingly
        const fsd = 5.0; // nm
        const cdi = Math.max(-127, Math.min(127, Math.round(xtrk / fsd * 127)));

        return {
            dtk: Math.round(dtk),
            xtrk: Math.abs(xtrk),
            cdi,
            distance,
            toWaypoint: toWpt.ident
        };
    }

    /**
     * Calculate vertical navigation guidance for the active waypoint
     * @param {number} currentAltitude - Current aircraft altitude MSL (feet)
     * @param {number} distanceToWaypoint - Distance to active waypoint (nm)
     * @returns {Object} { targetAlt, altDesc, verticalDeviation, requiredVS, restrictionText } or null
     */
    calculateVNav(currentAltitude, distanceToWaypoint) {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length === 0) {
            return null;
        }

        const activeIdx = this.activeWaypointIndex;
        const waypoints = this.flightPlan.waypoints;

        if (activeIdx >= waypoints.length || activeIdx < 0) {
            return null;
        }

        const toWpt = waypoints[activeIdx];
        if (!toWpt) {
            return null;
        }

        // Check if waypoint has altitude constraint
        const altDesc = toWpt.altDesc;
        const alt1 = toWpt.alt1; // Primary altitude (feet MSL)
        const alt2 = toWpt.alt2; // Secondary altitude for "BETWEEN" constraints

        if (!altDesc || !alt1) {
            return null; // No altitude constraint
        }

        // Parse altitude descriptor (ARINC 424 format)
        let restrictionText = '';
        let targetAlt = alt1;
        let verticalDeviation = 0;

        switch (altDesc) {
            case '@':  // AT - must cross at exactly this altitude
                restrictionText = `AT ${alt1}`;
                targetAlt = alt1;
                verticalDeviation = currentAltitude - alt1;
                break;

            case '+':  // AT OR ABOVE
                restrictionText = `${alt1}A`; // "5000A" = at or above 5000
                targetAlt = alt1;
                verticalDeviation = Math.min(0, currentAltitude - alt1); // Only show deviation if below
                break;

            case '-':  // AT OR BELOW
                restrictionText = `${alt1}B`; // "8000B" = at or below 8000
                targetAlt = alt1;
                verticalDeviation = Math.max(0, currentAltitude - alt1); // Only show deviation if above
                break;

            case 'B':  // BETWEEN alt1 and alt2
                if (alt2) {
                    restrictionText = `${Math.min(alt1, alt2)}A ${Math.max(alt1, alt2)}B`;
                    targetAlt = Math.min(alt1, alt2); // Target the lower altitude for descent
                    // Deviation if outside the range
                    if (currentAltitude < Math.min(alt1, alt2)) {
                        verticalDeviation = currentAltitude - Math.min(alt1, alt2);
                    } else if (currentAltitude > Math.max(alt1, alt2)) {
                        verticalDeviation = currentAltitude - Math.max(alt1, alt2);
                    } else {
                        verticalDeviation = 0; // Within range
                    }
                } else {
                    return null;
                }
                break;

            default:
                return null; // Unknown altitude descriptor
        }

        // Calculate required vertical speed (fpm) to reach target altitude
        // Assume groundspeed from flight plan module (set externally)
        const groundSpeed = this._groundSpeed || 120; // Default 120 knots if not set
        let requiredVS = 0;

        if (distanceToWaypoint && distanceToWaypoint > 0.1) {
            // Time to waypoint in minutes
            const timeToWaypoint = distanceToWaypoint / groundSpeed * 60;
            // Required vertical speed in feet per minute
            requiredVS = -Math.round((currentAltitude - targetAlt) / timeToWaypoint);
        }

        return {
            targetAlt,
            altDesc,
            verticalDeviation: Math.round(verticalDeviation),
            requiredVS,
            restrictionText,
            waypointIdent: toWpt.ident
        };
    }

    /**
     * Set ground speed for VNAV calculations
     * @param {number} groundSpeed - Ground speed in knots
     */
    setGroundSpeed(groundSpeed) {
        this._groundSpeed = groundSpeed;
    }

    destroy() {
        if (this._fetchTimer) clearTimeout(this._fetchTimer);
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
        }
    }
}
