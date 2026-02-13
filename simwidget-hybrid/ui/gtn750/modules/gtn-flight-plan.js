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
        this.userWaypoints = options.userWaypoints || null;

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

        // Approach activation state
        this.approachPhase = null; // null, 'TERM', 'APR', 'FAF', 'MAP', 'MISSED'
        this.approachActive = false;
        this.missedApproachActive = false;
        this.fafIndex = -1; // Final Approach Fix index
        this.mapIndex = -1; // Missed Approach Point index
        this.lastApproachAltitude = 0; // Track altitude for missed approach detection

        // Audio context for sequence chime
        this.audioContext = null;

        // Callbacks for external notifications
        this.onWaypointChanged = options.onWaypointChanged || null;
        this.onDirectToActivated = options.onDirectToActivated || null;
        this.onInsertComplete = options.onInsertComplete || null;
        this.onFlightPlanChanged = options.onFlightPlanChanged || null;
        this.onCdiSourceSwitch = options.onCdiSourceSwitch || null;

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

        // Try user waypoints first
        if (this.userWaypoints) {
            const userWpt = this.userWaypoints.getWaypoint(ident);
            if (userWpt) {
                this.dtoTarget = {
                    ident: userWpt.ident,
                    name: userWpt.name,
                    lat: userWpt.lat,
                    lon: userWpt.lon,
                    type: 'USER WPT',
                    category: userWpt.category
                };

                const dist = this.core.calculateDistance(
                    this._currentLat || 0, this._currentLon || 0,
                    this.dtoTarget.lat, this.dtoTarget.lon
                );
                const brg = this.core.calculateBearing(
                    this._currentLat || 0, this._currentLon || 0,
                    this.dtoTarget.lat, this.dtoTarget.lon
                );

                const catInfo = this.userWaypoints.getCategory(userWpt.category);
                const icon = catInfo ? catInfo.icon : '●';

                info.innerHTML = `
                    <div class="dto-name">${icon} ${this.dtoTarget.name}</div>
                    <div class="dto-coords">USER WPT - ${dist.toFixed(1)}nm @ ${Math.round(brg)}°</div>
                `;
                activateBtn.disabled = false;
                return;
            }
        }

        // Try navdb cross-type search (airports + VOR + NDB + FIX)
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
     * Move waypoint up or down in the flight plan
     * @param {number} fromIndex - Index of waypoint to move
     * @param {number} direction - -1 for up, +1 for down
     */
    moveWaypoint(fromIndex, direction) {
        if (!this.flightPlan?.waypoints || fromIndex < 0 || fromIndex >= this.flightPlan.waypoints.length) return false;

        const toIndex = fromIndex + direction;
        if (toIndex < 0 || toIndex >= this.flightPlan.waypoints.length) return false;

        // Swap waypoints
        const temp = this.flightPlan.waypoints[fromIndex];
        this.flightPlan.waypoints[fromIndex] = this.flightPlan.waypoints[toIndex];
        this.flightPlan.waypoints[toIndex] = temp;

        // Recalculate distances for affected waypoints
        const start = Math.max(0, Math.min(fromIndex, toIndex) - 1);
        const end = Math.min(this.flightPlan.waypoints.length - 1, Math.max(fromIndex, toIndex) + 1);

        for (let i = start; i <= end; i++) {
            const wp = this.flightPlan.waypoints[i];
            if (i > 0 && wp.lat && wp.lng) {
                const prev = this.flightPlan.waypoints[i - 1];
                if (prev?.lat && prev?.lng) {
                    wp.distanceFromPrev = this.core.calculateDistance(prev.lat, prev.lng, wp.lat, wp.lng);
                }
            }
        }

        // Adjust active waypoint index
        if (this.activeWaypointIndex === fromIndex) {
            this.activeWaypointIndex = toIndex;
        } else if (this.activeWaypointIndex === toIndex) {
            this.activeWaypointIndex = fromIndex;
        }

        this.notifyChanged();
        if (this.onWaypointChanged) this.onWaypointChanged();
        return true;
    }

    /**
     * Clear all waypoints from flight plan
     */
    clearFlightPlan() {
        if (!this.flightPlan?.waypoints?.length) return false;

        this.flightPlan = { waypoints: [], source: 'manual' };
        this.activeWaypointIndex = 0;
        this.activeWaypoint = null;
        this.dtoTarget = null;

        this.notifyChanged();
        if (this.onWaypointChanged) this.onWaypointChanged();

        GTNCore.log('[GTN750] Flight plan cleared');
        return true;
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

        // Determine procedure type string for waypoints
        const procTypeStr = type === 'dep' ? 'SID' : (type === 'arr' ? 'STAR' : 'APPROACH');

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
            speedLimit: wp.speedLimit,
            procedureType: procTypeStr
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
            waypointCount: fplWaypoints.length,
            type: procedure?.type  // Store approach type (ILS, RNAV, etc.)
        };

        // Detect and store approach type for ILS switching
        if (type === 'apr') {
            const approachType = procedure?.type || this.detectApproachType(procedureName);
            this.flightPlan.procedures[type].approachType = approachType;

            GTNCore.log(`[GTN750] Loaded ${approachType} approach: ${procedureName}`);

            // Identify critical approach fixes after loading
            this.identifyApproachFixes();

            // Fetch ILS frequency for auto-tuning
            if (approachType === 'ILS' || approachType === 'LOC') {
                this.fetchIlsFrequency(procedure);
            }
        }

        GTNCore.log(`[GTN750] Loaded ${procedureName}: ${fplWaypoints.length} waypoints`);
        this.notifyChanged();
    }

    /**
     * Detect approach type from procedure name
     * @param {string} name - Procedure name (e.g., "ILS RWY 28", "RNAV GPS RWY 10")
     * @returns {string} - Approach type ('ILS', 'RNAV', 'VOR', 'NDB', etc.)
     */
    detectApproachType(name) {
        if (!name) return 'UNKNOWN';

        const upperName = name.toUpperCase();

        if (upperName.includes('ILS')) return 'ILS';
        if (upperName.includes('LOC')) return 'LOC';  // Localizer-only
        if (upperName.includes('RNAV')) return 'RNAV';
        if (upperName.includes('GPS')) return 'RNAV';  // GPS is typically RNAV
        if (upperName.includes('VOR')) return 'VOR';
        if (upperName.includes('NDB')) return 'NDB';
        if (upperName.includes('TACAN')) return 'TACAN';

        return 'UNKNOWN';
    }

    /**
     * Check if current approach is ILS or LOC type requiring NAV radio
     * @returns {boolean} - True if ILS/LOC approach is loaded
     */
    isIlsApproach() {
        const apr = this.flightPlan?.procedures?.apr;
        if (!apr || !apr.approachType) return false;
        return apr.approachType === 'ILS' || apr.approachType === 'LOC';
    }

    /**
     * Fetch ILS frequency for the loaded approach
     * @param {Object} procedure - Procedure metadata with airport ICAO
     */
    async fetchIlsFrequency(procedure) {
        if (!procedure?.airport && !procedure?.ident) {
            GTNCore.log('[GTN750] Cannot fetch ILS freq - no airport identifier');
            return;
        }

        // Extract airport ICAO from procedure
        const airportIcao = procedure.airport || procedure.ident?.split('.')[0];
        if (!airportIcao) return;

        // Extract runway identifier from approach name
        // Example: "ILS RWY 28L" -> "28L"
        const runwayMatch = procedure.name?.match(/RWY?\s*(\d{1,2}[LCR]?)/i);
        if (!runwayMatch) {
            GTNCore.log(`[GTN750] Cannot extract runway from approach name: ${procedure.name}`);
            return;
        }

        const runwayIdent = runwayMatch[1];

        try {
            // Fetch airport data including runways from navdb
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/navdb/airport/${airportIcao}`);
            if (!response.ok) {
                GTNCore.log(`[GTN750] Failed to fetch airport data for ${airportIcao}`);
                return;
            }

            const airportData = await response.json();
            if (!airportData.runways || airportData.runways.length === 0) {
                GTNCore.log(`[GTN750] No runway data for ${airportIcao}`);
                return;
            }

            // Find matching runway
            const runway = airportData.runways.find(rwy => {
                // Match runway identifier (e.g., "28L", "28", "09R")
                const rwyId = rwy.runway_id || rwy.ident || '';
                return rwyId.toUpperCase() === runwayIdent.toUpperCase();
            });

            if (!runway) {
                GTNCore.log(`[GTN750] Runway ${runwayIdent} not found at ${airportIcao}`);
                return;
            }

            // Check if runway has ILS frequency
            const ilsFreq = runway.ils_freq || runway.loc_freq;
            if (!ilsFreq) {
                GTNCore.log(`[GTN750] No ILS frequency for runway ${runwayIdent} at ${airportIcao}`);
                return;
            }

            // Store ILS frequency in flight plan
            if (!this.flightPlan.procedures.apr) {
                this.flightPlan.procedures.apr = {};
            }
            this.flightPlan.procedures.apr.ilsFrequency = ilsFreq;
            this.flightPlan.procedures.apr.runway = runwayIdent;
            this.flightPlan.procedures.apr.airport = airportIcao;

            GTNCore.log(`[GTN750] ILS frequency for ${airportIcao} RWY ${runwayIdent}: ${ilsFreq.toFixed(2)}`);

        } catch (e) {
            GTNCore.log(`[GTN750] Error fetching ILS frequency: ${e.message}`);
        }
    }

    /**
     * Auto-tune NAV1 to ILS frequency
     * Called when approach phase reaches FAF
     */
    async autoTuneIls() {
        if (!this.isIlsApproach()) return;

        const ilsFreq = this.flightPlan?.procedures?.apr?.ilsFrequency;
        if (!ilsFreq) {
            GTNCore.log('[GTN750] No ILS frequency available for auto-tune');
            return;
        }

        try {
            // Set NAV1 active frequency via backend API
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/radio/nav1/active`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frequency: ilsFreq })
            });

            if (response.ok) {
                GTNCore.log(`[GTN750] Auto-tuned NAV1 to ILS ${ilsFreq.toFixed(2)}`);

                // Notify via sync channel for display update
                if (this.syncChannel) {
                    this.syncChannel.postMessage({
                        type: 'ils-tuned',
                        data: {
                            frequency: ilsFreq,
                            runway: this.flightPlan.procedures.apr.runway,
                            airport: this.flightPlan.procedures.apr.airport
                        }
                    });
                }

                // Mark that auto-tune has been performed
                this.ilsAutoTuned = true;
            } else {
                GTNCore.log(`[GTN750] Failed to auto-tune NAV1: ${response.statusText}`);
            }
        } catch (e) {
            GTNCore.log(`[GTN750] Error auto-tuning ILS: ${e.message}`);
        }
    }

    /**
     * Get ILS approach info for display
     * @returns {Object|null} - { frequency, runway, airport } or null
     */
    getIlsInfo() {
        if (!this.isIlsApproach()) return null;

        const apr = this.flightPlan?.procedures?.apr;
        if (!apr?.ilsFrequency) return null;

        return {
            frequency: apr.ilsFrequency,
            runway: apr.runway,
            airport: apr.airport,
            autoTuned: this.ilsAutoTuned || false
        };
    }

    /**
     * Show airways insert modal with smart suggestions
     * @param {Object} options - { selectedWp, nextWp, lat, lon }
     */
    async showAirwaysModal(options = {}) {
        const modal = document.getElementById('awy-modal');
        if (!modal) return;

        modal.style.display = 'block';

        const identInput = document.getElementById('awy-ident');
        const entryInput = document.getElementById('awy-entry');
        const exitInput = document.getElementById('awy-exit');
        const infoDiv = document.getElementById('awy-info');
        const suggestionsDiv = document.getElementById('awy-suggestions');

        // Clear previous values
        if (identInput) identInput.value = '';
        if (entryInput) entryInput.value = '';
        if (exitInput) exitInput.value = '';
        if (infoDiv) infoDiv.textContent = '';
        if (suggestionsDiv) suggestionsDiv.innerHTML = '';

        // Pre-fill entry/exit if provided
        if (options.selectedWp && entryInput) {
            entryInput.value = options.selectedWp.ident || '';
        }
        if (options.nextWp && exitInput) {
            exitInput.value = options.nextWp.ident || '';
        }

        // Find and display airway suggestions
        if (options.selectedWp && options.nextWp) {
            this.findConnectingAirways(options.selectedWp, options.nextWp, options.lat, options.lon);
        }

        // Focus first input
        if (identInput) {
            setTimeout(() => identInput.focus(), 100);
        }

        // Wire up buttons if not already done
        const insertBtn = document.getElementById('awy-insert');
        const cancelBtn = document.getElementById('awy-cancel');

        if (insertBtn && !insertBtn._airwaysWired) {
            insertBtn._airwaysWired = true;
            insertBtn.onclick = () => this.handleAirwayInsert();
        }

        if (cancelBtn && !cancelBtn._airwaysWired) {
            cancelBtn._airwaysWired = true;
            cancelBtn.onclick = () => this.hideAirwaysModal();
        }
    }

    /**
     * Find airways that connect two waypoints and display suggestions
     * @param {Object} entryWp - Entry waypoint
     * @param {Object} exitWp - Exit waypoint
     * @param {number} lat - Current latitude (for nearby search)
     * @param {number} lon - Current longitude (for nearby search)
     */
    async findConnectingAirways(entryWp, exitWp, lat, lon) {
        const suggestionsDiv = document.getElementById('awy-suggestions');
        if (!suggestionsDiv) return;

        suggestionsDiv.innerHTML = '<div class="awy-searching">Searching airways...</div>';

        try {
            // Use midpoint between waypoints for nearby search
            const searchLat = lat || (entryWp.lat + exitWp.lat) / 2;
            const searchLon = lon || ((entryWp.lng || entryWp.lon) + (exitWp.lng || exitWp.lon)) / 2;

            // Fetch nearby airways (wider search range)
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/navdb/nearby/airways?lat=${searchLat}&lon=${searchLon}&range=200&limit=50`
            );

            if (!response.ok) {
                suggestionsDiv.innerHTML = '<div class="awy-no-results">No airways found nearby</div>';
                return;
            }

            const data = await response.json();
            const nearbyAirways = data.items || [];

            if (nearbyAirways.length === 0) {
                suggestionsDiv.innerHTML = '<div class="awy-no-results">No airways found nearby</div>';
                return;
            }

            // Check each airway to see if it connects both waypoints
            const connectingAirways = [];

            for (const airway of nearbyAirways) {
                try {
                    const awResponse = await fetch(
                        `http://${location.hostname}:${this.serverPort}/api/navdb/airway/${airway.ident}`
                    );

                    if (!awResponse.ok) continue;

                    const awData = await awResponse.json();
                    const fixes = awData.fixes || [];

                    // Check if both waypoints are on this airway
                    const entryIdx = fixes.findIndex(f => f.ident === entryWp.ident);
                    const exitIdx = fixes.findIndex(f => f.ident === exitWp.ident);

                    if (entryIdx !== -1 && exitIdx !== -1 && entryIdx !== exitIdx) {
                        const segmentFixes = entryIdx < exitIdx
                            ? fixes.slice(entryIdx, exitIdx + 1)
                            : fixes.slice(exitIdx, entryIdx + 1).reverse();

                        // Calculate MEA (max of all segment min_alts)
                        const mea = Math.max(...segmentFixes.map(f => f.min_alt || 0));

                        connectingAirways.push({
                            ident: airway.ident,
                            type: airway.type,
                            fixCount: segmentFixes.length,
                            mea: mea,
                            distance: this.calculateRouteDistance(segmentFixes),
                            entry: entryWp.ident,
                            exit: exitWp.ident
                        });
                    }
                } catch (e) {
                    // Skip this airway on error
                }
            }

            // Display results
            if (connectingAirways.length === 0) {
                suggestionsDiv.innerHTML = '<div class="awy-no-results">No airways connect these waypoints</div>';
                return;
            }

            // Sort by distance (shortest first)
            connectingAirways.sort((a, b) => a.distance - b.distance);

            // Render suggestions
            let html = '<div class="awy-suggestions-header">SUGGESTED AIRWAYS</div>';
            connectingAirways.forEach(aw => {
                const meaText = aw.mea > 0 ? `${Math.round(aw.mea).toLocaleString()} ft` : 'N/A';
                const distText = aw.distance > 0 ? `${Math.round(aw.distance)} nm` : '';

                html += `
                    <div class="awy-suggestion-item" data-ident="${aw.ident}" data-entry="${aw.entry}" data-exit="${aw.exit}">
                        <div class="awy-suggestion-name">${aw.ident}</div>
                        <div class="awy-suggestion-details">
                            ${aw.fixCount} fixes • MEA ${meaText}${distText ? ' • ' + distText : ''}
                        </div>
                    </div>
                `;
            });

            suggestionsDiv.innerHTML = html;

            // Wire up click handlers
            suggestionsDiv.querySelectorAll('.awy-suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const ident = item.dataset.ident;
                    const entry = item.dataset.entry;
                    const exit = item.dataset.exit;
                    this.handleSuggestionClick(ident, entry, exit);
                });
            });

        } catch (e) {
            GTNCore.log(`[GTN750] Airway suggestions error: ${e.message}`);
            suggestionsDiv.innerHTML = '<div class="awy-no-results">Error loading suggestions</div>';
        }
    }

    /**
     * Calculate total distance along a route
     * @param {Array} fixes - Array of fixes with lat/lon
     * @returns {number} Total distance in nm
     */
    calculateRouteDistance(fixes) {
        if (!fixes || fixes.length < 2) return 0;

        let totalDist = 0;
        for (let i = 0; i < fixes.length - 1; i++) {
            const f1 = fixes[i];
            const f2 = fixes[i + 1];
            totalDist += this.core.haversine(f1.lat, f1.lon, f2.lat, f2.lon);
        }
        return totalDist;
    }

    /**
     * Handle click on airway suggestion
     * @param {string} ident - Airway identifier
     * @param {string} entry - Entry fix
     * @param {string} exit - Exit fix
     */
    async handleSuggestionClick(ident, entry, exit) {
        // Fill in the form fields
        const identInput = document.getElementById('awy-ident');
        const entryInput = document.getElementById('awy-entry');
        const exitInput = document.getElementById('awy-exit');

        if (identInput) identInput.value = ident;
        if (entryInput) entryInput.value = entry;
        if (exitInput) exitInput.value = exit;

        // Auto-insert
        await this.handleAirwayInsert();
    }

    /**
     * Hide airways insert modal
     */
    hideAirwaysModal() {
        const modal = document.getElementById('awy-modal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Handle airway insert button click
     */
    async handleAirwayInsert() {
        const identInput = document.getElementById('awy-ident');
        const entryInput = document.getElementById('awy-entry');
        const exitInput = document.getElementById('awy-exit');
        const infoDiv = document.getElementById('awy-info');

        const airwayIdent = identInput?.value.trim().toUpperCase();
        const entryFix = entryInput?.value.trim().toUpperCase();
        const exitFix = exitInput?.value.trim().toUpperCase();

        if (!airwayIdent || !entryFix || !exitFix) {
            if (infoDiv) {
                infoDiv.textContent = 'Please enter airway, entry fix, and exit fix';
            }
            return;
        }

        if (infoDiv) {
            infoDiv.textContent = `Inserting ${airwayIdent} from ${entryFix} to ${exitFix}...`;
        }

        const success = await this.insertAirway(airwayIdent, entryFix, exitFix);

        if (success) {
            this.hideAirwaysModal();
        } else {
            if (infoDiv) {
                infoDiv.textContent = 'Failed to insert airway. Check entry/exit fixes are valid and entry fix is in flight plan.';
            }
        }
    }

    /**
     * Insert an airway segment between two waypoints
     * @param {string} airwayIdent - Airway identifier (e.g., "V4", "J146")
     * @param {string} entryFix - Entry waypoint identifier
     * @param {string} exitFix - Exit waypoint identifier
     * @returns {Promise<boolean>} - True if successful
     */
    async insertAirway(airwayIdent, entryFix, exitFix) {
        if (!airwayIdent || !entryFix || !exitFix) {
            GTNCore.log('[GTN750] Invalid airway parameters');
            return false;
        }

        try {
            // Fetch airway segment from navdb
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/navdb/airway/${airwayIdent}?entry=${entryFix}&exit=${exitFix}`
            );

            if (!response.ok) {
                const error = await response.json();
                GTNCore.log(`[GTN750] Airway fetch failed: ${error.error}`);
                return false;
            }

            const airway = await response.json();

            if (!airway.fixes || airway.fixes.length < 2) {
                GTNCore.log('[GTN750] No fixes found on airway segment');
                return false;
            }

            if (!this.flightPlan) {
                this.flightPlan = { waypoints: [], source: 'manual' };
            }

            // Find entry fix in current flight plan
            const entryIdx = this.flightPlan.waypoints.findIndex(wp => wp.ident === entryFix);

            if (entryIdx === -1) {
                GTNCore.log(`[GTN750] Entry fix ${entryFix} not found in flight plan`);
                return false;
            }

            // Convert airway fixes to waypoints (skip first since it's already in plan)
            const airwayWaypoints = airway.fixes.slice(1).map(fix => ({
                ident: fix.ident,
                lat: fix.lat,
                lng: fix.lon,
                type: 'WAYPOINT',
                airway: airwayIdent,
                minAlt: fix.min_alt,
                maxAlt: fix.max_alt
            }));

            // Insert airway waypoints after entry fix
            for (let i = 0; i < airwayWaypoints.length; i++) {
                this.insertWaypoint(airwayWaypoints[i], entryIdx + 1 + i);
            }

            GTNCore.log(`[GTN750] Inserted airway ${airwayIdent}: ${entryFix}..${exitFix} (${airwayWaypoints.length} fixes)`);
            this.notifyChanged();
            return true;

        } catch (e) {
            GTNCore.log(`[GTN750] Airway insert failed: ${e.message}`);
            return false;
        }
    }

    /**
     * Determine CDI scaling mode based on flight phase
     * @param {number} distanceToDestination - Distance to final waypoint (nm)
     * @returns {Object} { mode: 'ENR'|'TERM'|'APR', fsd: number }
     */
    getCdiScaling(distanceToDestination) {
        // Check if approach is loaded
        const hasApproach = this.flightPlan?.waypoints?.some(wp => wp.procedureType === 'APPROACH');

        // Approach mode: 0.3nm FSD (within 2nm of destination with approach loaded)
        if (hasApproach && distanceToDestination <= 2.0) {
            return { mode: 'APR', fsd: 0.3 };
        }

        // Terminal mode: 1nm FSD (within 30nm of destination)
        if (distanceToDestination <= 30.0) {
            return { mode: 'TERM', fsd: 1.0 };
        }

        // Enroute mode: 5nm FSD (default)
        return { mode: 'ENR', fsd: 5.0 };
    }

    /**
     * Calculate GPS navigation data (DTK, XTK, CDI) for the active leg
     * @param {number} lat - Current aircraft latitude
     * @param {number} lon - Current aircraft longitude
     * @returns {Object} { dtk, xtrk, cdi, distance, toWaypoint, cdiMode, fsd } or null if no active leg
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
            const scaling = this.getCdiScaling(distance);

            return {
                dtk: bearing,
                xtrk: 0,  // No cross-track for direct-to
                cdi: 0,
                distance,
                toWaypoint: toWpt.ident,
                cdiMode: scaling.mode,
                fsd: scaling.fsd
            };
        }

        // Normal leg: calculate from previous waypoint to active waypoint
        const fromWpt = waypoints[activeIdx - 1];
        if (!fromWpt || !fromWpt.lat || !fromWpt.lng) {
            // Fall back to direct bearing
            const bearing = this.core.calculateBearing(lat, lon, toWpt.lat, toWpt.lng);
            const distance = this.core.calculateDistance(lat, lon, toWpt.lat, toWpt.lng);
            const scaling = this.getCdiScaling(distance);
            return {
                dtk: bearing,
                xtrk: 0,
                cdi: 0,
                distance,
                toWaypoint: toWpt.ident,
                cdiMode: scaling.mode,
                fsd: scaling.fsd
            };
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

        // Calculate distance to destination (last waypoint in flight plan)
        const destWpt = waypoints[waypoints.length - 1];
        let distanceToDestination = distance; // Default to current waypoint distance
        if (destWpt && destWpt.lat && destWpt.lng) {
            // Sum remaining leg distances for more accurate total
            distanceToDestination = distance;
            for (let i = activeIdx + 1; i < waypoints.length; i++) {
                const wp = waypoints[i];
                const prevWp = waypoints[i - 1];
                if (wp && wp.lat && wp.lng && prevWp && prevWp.lat && prevWp.lng) {
                    distanceToDestination += this.core.calculateDistance(prevWp.lat, prevWp.lng, wp.lat, wp.lng);
                }
            }
        }

        // Get CDI scaling mode based on distance to destination
        const scaling = this.getCdiScaling(distanceToDestination);

        // CDI needle deflection: -127 to +127 with dynamic FSD
        const cdi = Math.max(-127, Math.min(127, Math.round(xtrk / scaling.fsd * 127)));

        return {
            dtk: Math.round(dtk),
            xtrk: Math.abs(xtrk),
            cdi,
            distance,
            toWaypoint: toWpt.ident,
            cdiMode: scaling.mode,
            fsd: scaling.fsd
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

    // ===== APPROACH ACTIVATION & MISSED APPROACH =====

    /**
     * Identify approach critical fixes (IAF, FAF, MAP) from loaded procedure
     * Called after loadProcedure() with type='apr'
     */
    identifyApproachFixes() {
        if (!this.flightPlan?.waypoints) return;

        const waypoints = this.flightPlan.waypoints;

        // Find first and last approach waypoint
        let firstApprIdx = -1;
        let lastApprIdx = -1;

        for (let i = 0; i < waypoints.length; i++) {
            if (waypoints[i].procedureType === 'APPROACH') {
                if (firstApprIdx === -1) firstApprIdx = i;
                lastApprIdx = i;
            }
        }

        if (firstApprIdx === -1) {
            // No approach loaded
            this.fafIndex = -1;
            this.mapIndex = -1;
            return;
        }

        // FAF detection: Look for path terminators or altitude constraints in latter part of approach
        // Common FAF indicators: CF (Course to Fix), TF (Track to Fix) with altitude constraint
        let fafIdx = -1;
        for (let i = lastApprIdx; i >= firstApprIdx; i--) {
            const wp = waypoints[i];
            // FAF typically has altitude constraint and is in the final segment
            if (wp.altDesc && wp.alt1 && (wp.pathTerm === 'CF' || wp.pathTerm === 'TF')) {
                fafIdx = i;
                break;
            }
        }

        // If no FAF found by path term, use waypoint 2/3 through the approach
        if (fafIdx === -1) {
            const approachLength = lastApprIdx - firstApprIdx + 1;
            fafIdx = firstApprIdx + Math.floor(approachLength * 0.66);
        }

        // MAP is typically the last waypoint in the approach
        this.fafIndex = fafIdx;
        this.mapIndex = lastApprIdx;

        GTNCore.log(`[GTN750] Approach fixes identified: FAF=${waypoints[fafIdx]?.ident} (idx ${fafIdx}), MAP=${waypoints[lastApprIdx]?.ident} (idx ${lastApprIdx})`);
    }

    /**
     * Check approach phase and update state based on position
     * Called from main update loop
     * @param {Object} data - Current sim data with latitude, longitude, altitude
     */
    checkApproachPhase(data) {
        if (!this.flightPlan?.waypoints || this.fafIndex === -1) {
            // No approach loaded
            if (this.approachActive) {
                this.approachActive = false;
                this.approachPhase = null;
                GTNCore.log('[GTN750] Approach deactivated - no approach in flight plan');
            }
            return;
        }

        if (!data.latitude || !data.longitude || !data.altitude) return;

        const waypoints = this.flightPlan.waypoints;
        const fafWp = waypoints[this.fafIndex];
        const mapWp = waypoints[this.mapIndex];

        if (!fafWp || !mapWp) return;

        // Calculate distances
        const distToFaf = fafWp.lat && fafWp.lng ?
            this.core.calculateDistance(data.latitude, data.longitude, fafWp.lat, fafWp.lng) : 999;
        const distToMap = mapWp.lat && mapWp.lng ?
            this.core.calculateDistance(data.latitude, data.longitude, mapWp.lat, mapWp.lng) : 999;

        // Phase logic
        const activeIdx = this.activeWaypointIndex;

        // Check if we're past FAF
        if (activeIdx >= this.fafIndex) {
            if (activeIdx >= this.mapIndex) {
                // At or past MAP
                if (this.approachPhase !== 'MAP') {
                    this.approachPhase = 'MAP';
                    this.lastApproachAltitude = data.altitude;
                    GTNCore.log('[GTN750] Approach phase: MAP');
                }

                // Check for missed approach (altitude loss or go-around)
                this.detectMissedApproach(data);
            } else {
                // Between FAF and MAP - final approach
                if (this.approachPhase !== 'FAF') {
                    this.approachPhase = 'FAF';
                    this.approachActive = true;
                    GTNCore.log('[GTN750] Approach phase: FAF - final approach active');

                    // Auto-tune ILS frequency if ILS/LOC approach
                    if (this.isIlsApproach() && !this.ilsAutoTuned) {
                        this.autoTuneIls();
                    }

                    // Auto-switch CDI to NAV1 for ILS/LOC approaches
                    if (this.isIlsApproach() && this.onCdiSourceSwitch) {
                        this.onCdiSourceSwitch('NAV1', 'ILS approach at FAF');
                    }
                }
            }
        } else if (distToFaf <= 2.0) {
            // Approaching FAF (within 2nm)
            if (this.approachPhase !== 'APR') {
                this.approachPhase = 'APR';
                this.approachActive = true;
                GTNCore.log('[GTN750] Approach phase: APR - approach mode armed');
            }
        } else if (distToFaf <= 30.0) {
            // Terminal area
            if (this.approachPhase !== 'TERM') {
                this.approachPhase = 'TERM';
                GTNCore.log('[GTN750] Approach phase: TERM - terminal area');
            }
        } else {
            // Enroute - deactivate approach
            if (this.approachActive) {
                this.approachActive = false;
                this.approachPhase = null;
            }
        }
    }

    /**
     * Detect missed approach conditions
     * @param {Object} data - Current sim data
     */
    detectMissedApproach(data) {
        if (this.missedApproachActive) return; // Already in missed
        if (this.approachPhase !== 'MAP') return; // Only detect at MAP

        const altLoss = this.lastApproachAltitude - data.altitude;

        // Missed approach triggers:
        // 1. Altitude GAIN of >200ft (go-around initiated)
        if (altLoss < -200) {
            // Climbing - go-around
            this.activateMissedApproach();
        } else {
            // Update last altitude for next check
            this.lastApproachAltitude = Math.min(this.lastApproachAltitude, data.altitude);
        }
    }

    /**
     * Activate missed approach mode
     */
    activateMissedApproach() {
        if (this.missedApproachActive) return;

        this.missedApproachActive = true;
        this.approachPhase = 'MISSED';

        GTNCore.log('[GTN750] MISSED APPROACH ACTIVATED');

        // Switch CDI back to GPS for missed approach navigation
        if (this.onCdiSourceSwitch) {
            this.onCdiSourceSwitch('GPS', 'Missed approach');
        }

        // Sequence to next waypoint (first missed approach fix if it exists)
        if (this.activeWaypointIndex < this.flightPlan.waypoints.length - 1) {
            this.sequenceToNextWaypoint();
        }

        // Notify CDI manager of missed approach (for autopilot/mode changes)
        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'missed-approach',
                data: { active: true }
            });
        }
    }

    /**
     * Get approach status for display
     * @returns {Object} { active, phase, fafIdent, mapIdent, missed }
     */
    getApproachStatus() {
        return {
            active: this.approachActive,
            phase: this.approachPhase,
            missed: this.missedApproachActive,
            fafIdent: this.fafIndex >= 0 ? this.flightPlan?.waypoints[this.fafIndex]?.ident : null,
            mapIdent: this.mapIndex >= 0 ? this.flightPlan?.waypoints[this.mapIndex]?.ident : null
        };
    }

    /**
     * Check if active waypoint is a holding pattern and return hold parameters
     * @returns {Object|null} - Hold parameters or null
     */
    getActiveHoldingPattern() {
        if (!this.flightPlan?.waypoints?.length) return null;

        const activeWp = this.flightPlan.waypoints[this.activeWaypointIndex];
        if (!activeWp) return null;

        // Check if waypoint is a holding pattern (ARINC 424 leg types: HM, HA, HF)
        const holdingLegTypes = ['HM', 'HA', 'HF'];
        if (!holdingLegTypes.includes(activeWp.pathTerm)) {
            return null;
        }

        // Extract holding parameters
        return {
            fix: {
                ident: activeWp.ident,
                lat: activeWp.lat,
                lon: activeWp.lng
            },
            inboundCourse: activeWp.course || activeWp.magneticCourse || 0,
            turnDirection: activeWp.turnDir || 'R',
            legTime: activeWp.legTime || 60,
            altitude: activeWp.alt1 || null
        };
    }

    // ===== FLIGHT PLAN SAVE/LOAD =====

    /**
     * Save current flight plan to file
     * @param {string} filename - Output filename (without extension)
     * @param {string} format - File format: 'fpl', 'gpx', 'json', 'txt'
     */
    saveFlightPlan(filename = 'flight-plan', format = 'fpl') {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length === 0) {
            GTNCore.log('[GTN750] No flight plan to save');
            return false;
        }

        let content, mimeType, extension;

        switch (format) {
            case 'fpl':
                content = this.serializeToFPL();
                mimeType = 'application/xml';
                extension = 'fpl';
                break;
            case 'gpx':
                content = this.serializeToGPX();
                mimeType = 'application/gpx+xml';
                extension = 'gpx';
                break;
            case 'json':
                content = JSON.stringify(this.flightPlan, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'txt':
                content = this.serializeToText();
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            default:
                GTNCore.log(`[GTN750] Unknown format: ${format}`);
                return false;
        }

        // Create download link
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);

        GTNCore.log(`[GTN750] Flight plan saved: ${filename}.${extension}`);
        return true;
    }

    /**
     * Serialize flight plan to Garmin FPL format (XML)
     */
    serializeToFPL() {
        const wp = this.flightPlan.waypoints;
        const origin = wp[0];
        const dest = wp[wp.length - 1];

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">\n';
        xml += '  <created>SimGlass GTN750</created>\n';
        xml += `  <waypoint-table>\n`;

        wp.forEach((w, i) => {
            xml += `    <waypoint>\n`;
            xml += `      <identifier>${this.escapeXml(w.ident || `WPT${i + 1}`)}</identifier>\n`;
            xml += `      <type>${w.type || 'USER WAYPOINT'}</type>\n`;
            xml += `      <country-code>${w.country || '__'}</country-code>\n`;
            xml += `      <lat>${w.lat.toFixed(6)}</lat>\n`;
            xml += `      <lon>${(w.lng || w.lon).toFixed(6)}</lon>\n`;
            if (w.altitude) xml += `      <comment>ALT ${w.altitude}ft ${w.altitudeConstraint || ''}</comment>\n`;
            xml += `    </waypoint>\n`;
        });

        xml += `  </waypoint-table>\n`;
        xml += `  <route>\n`;
        xml += `    <route-name>${origin.ident}-${dest.ident}</route-name>\n`;
        xml += `    <flight-plan-index>1</flight-plan-index>\n`;

        wp.forEach((w, i) => {
            xml += `    <route-point>\n`;
            xml += `      <waypoint-identifier>${this.escapeXml(w.ident || `WPT${i + 1}`)}</waypoint-identifier>\n`;
            xml += `      <waypoint-type>${w.type || 'USER WAYPOINT'}</waypoint-type>\n`;
            xml += `      <waypoint-country-code>${w.country || '__'}</waypoint-country-code>\n`;
            if (w.airway) xml += `      <comment>via ${w.airway}</comment>\n`;
            xml += `    </route-point>\n`;
        });

        xml += `  </route>\n`;
        xml += '</flight-plan>\n';

        return xml;
    }

    /**
     * Serialize flight plan to GPX format
     */
    serializeToGPX() {
        const wp = this.flightPlan.waypoints;

        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1" creator="SimGlass GTN750"\n';
        gpx += '     xmlns="http://www.topografix.com/GPX/1/1">\n';
        gpx += '  <metadata>\n';
        gpx += `    <name>${wp[0].ident}-${wp[wp.length - 1].ident}</name>\n`;
        gpx += '  </metadata>\n';

        // Waypoints
        wp.forEach((w, i) => {
            gpx += `  <wpt lat="${w.lat.toFixed(6)}" lon="${(w.lng || w.lon).toFixed(6)}">\n`;
            gpx += `    <name>${this.escapeXml(w.ident || `WPT${i + 1}`)}</name>\n`;
            if (w.altitude) gpx += `    <ele>${w.altitude * 0.3048}</ele>\n`; // Convert ft to meters
            if (w.airway) gpx += `    <desc>via ${this.escapeXml(w.airway)}</desc>\n`;
            gpx += `  </wpt>\n`;
        });

        // Route
        gpx += '  <rte>\n';
        gpx += `    <name>${wp[0].ident}-${wp[wp.length - 1].ident}</name>\n`;
        wp.forEach((w, i) => {
            gpx += `    <rtept lat="${w.lat.toFixed(6)}" lon="${(w.lng || w.lon).toFixed(6)}">\n`;
            gpx += `      <name>${this.escapeXml(w.ident || `WPT${i + 1}`)}</name>\n`;
            gpx += `    </rtept>\n`;
        });
        gpx += '  </rte>\n';
        gpx += '</gpx>\n';

        return gpx;
    }

    /**
     * Serialize flight plan to plain text
     */
    serializeToText() {
        const wp = this.flightPlan.waypoints;
        let txt = `FLIGHT PLAN: ${wp[0].ident} → ${wp[wp.length - 1].ident}\n`;
        txt += `Generated: ${new Date().toISOString()}\n`;
        txt += `Waypoints: ${wp.length}\n\n`;

        txt += 'SEQ  IDENT        TYPE          LAT/LON              ALT        AIRWAY\n';
        txt += '─'.repeat(80) + '\n';

        wp.forEach((w, i) => {
            const seq = String(i + 1).padStart(3, ' ');
            const ident = (w.ident || `WPT${i + 1}`).padEnd(12, ' ');
            const type = (w.type || '').padEnd(13, ' ');
            const latLon = `${w.lat.toFixed(4)}, ${(w.lng || w.lon).toFixed(4)}`.padEnd(20, ' ');
            const alt = w.altitude ? `${Math.round(w.altitude)}ft ${w.altitudeConstraint || ''}`.padEnd(10, ' ') : ''.padEnd(10, ' ');
            const airway = w.airway || '';

            txt += `${seq}  ${ident}  ${type}  ${latLon}  ${alt}  ${airway}\n`;
        });

        return txt;
    }

    /**
     * Load flight plan from file
     * @param {File} file - File object from input
     */
    async loadFlightPlan(file) {
        try {
            const content = await file.text();
            const extension = file.name.split('.').pop().toLowerCase();

            let loadedPlan = null;

            switch (extension) {
                case 'fpl':
                    loadedPlan = this.parseFromFPL(content);
                    break;
                case 'gpx':
                    loadedPlan = this.parseFromGPX(content);
                    break;
                case 'json':
                    loadedPlan = JSON.parse(content);
                    break;
                default:
                    GTNCore.log(`[GTN750] Unsupported file format: ${extension}`);
                    return false;
            }

            if (!loadedPlan || !loadedPlan.waypoints || loadedPlan.waypoints.length === 0) {
                GTNCore.log('[GTN750] Invalid flight plan data');
                return false;
            }

            // Set as current flight plan
            this.flightPlan = loadedPlan;
            this.flightPlan.source = 'file';
            this.activeWaypointIndex = 0;
            this.activeWaypoint = this.flightPlan.waypoints[0];

            this.notifyChanged();
            GTNCore.log(`[GTN750] Flight plan loaded: ${file.name} (${loadedPlan.waypoints.length} waypoints)`);

            return true;

        } catch (e) {
            GTNCore.log(`[GTN750] Failed to load flight plan: ${e.message}`);
            return false;
        }
    }

    /**
     * Parse Garmin FPL format
     */
    parseFromFPL(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const waypoints = [];
        const routePoints = doc.querySelectorAll('route-point');

        routePoints.forEach(rp => {
            const ident = rp.querySelector('waypoint-identifier')?.textContent;
            const type = rp.querySelector('waypoint-type')?.textContent;
            const comment = rp.querySelector('comment')?.textContent;

            // Find matching waypoint in waypoint-table
            const wptTable = doc.querySelectorAll('waypoint-table > waypoint');
            let lat, lon, alt;

            for (const wpt of wptTable) {
                if (wpt.querySelector('identifier')?.textContent === ident) {
                    lat = parseFloat(wpt.querySelector('lat')?.textContent);
                    lon = parseFloat(wpt.querySelector('lon')?.textContent);
                    const wptComment = wpt.querySelector('comment')?.textContent;
                    if (wptComment && wptComment.includes('ALT')) {
                        const match = wptComment.match(/ALT\s+(\d+)/);
                        if (match) alt = parseInt(match[1]);
                    }
                    break;
                }
            }

            if (lat && lon) {
                const waypoint = { ident, lat, lon: lon, lng: lon, type };
                if (alt) waypoint.altitude = alt;
                if (comment && comment.includes('via')) {
                    waypoint.airway = comment.replace('via ', '');
                }
                waypoints.push(waypoint);
            }
        });

        return { waypoints, source: 'file' };
    }

    /**
     * Parse GPX format
     */
    parseFromGPX(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const waypoints = [];
        const routePoints = doc.querySelectorAll('rte > rtept');

        if (routePoints.length > 0) {
            // Use route if available
            routePoints.forEach(rp => {
                const lat = parseFloat(rp.getAttribute('lat'));
                const lon = parseFloat(rp.getAttribute('lon'));
                const ident = rp.querySelector('name')?.textContent;

                if (lat && lon) {
                    waypoints.push({ ident, lat, lon: lon, lng: lon, type: 'WAYPOINT' });
                }
            });
        } else {
            // Fallback to waypoints
            const wpts = doc.querySelectorAll('wpt');
            wpts.forEach(wpt => {
                const lat = parseFloat(wpt.getAttribute('lat'));
                const lon = parseFloat(wpt.getAttribute('lon'));
                const ident = wpt.querySelector('name')?.textContent;
                const ele = wpt.querySelector('ele')?.textContent;

                if (lat && lon) {
                    const waypoint = { ident, lat, lon: lon, lng: lon, type: 'WAYPOINT' };
                    if (ele) waypoint.altitude = Math.round(parseFloat(ele) * 3.28084); // meters to feet
                    waypoints.push(waypoint);
                }
            });
        }

        return { waypoints, source: 'file' };
    }

    /**
     * Auto-save flight plan to localStorage
     */
    autoSaveFlightPlan() {
        if (!this.flightPlan || !this.flightPlan.waypoints) return;

        try {
            localStorage.setItem('gtn750-flight-plan', JSON.stringify(this.flightPlan));
            localStorage.setItem('gtn750-active-waypoint-index', this.activeWaypointIndex);
        } catch (e) {
            GTNCore.log('[GTN750] Auto-save failed:', e.message);
        }
    }

    /**
     * Restore flight plan from localStorage
     */
    restoreFlightPlan() {
        try {
            const saved = localStorage.getItem('gtn750-flight-plan');
            const activeIdx = localStorage.getItem('gtn750-active-waypoint-index');

            if (saved) {
                this.flightPlan = JSON.parse(saved);
                this.activeWaypointIndex = activeIdx ? parseInt(activeIdx) : 0;
                this.activeWaypoint = this.flightPlan.waypoints[this.activeWaypointIndex];

                GTNCore.log('[GTN750] Flight plan restored from auto-save');
                return true;
            }
        } catch (e) {
            GTNCore.log('[GTN750] Restore failed:', e.message);
        }

        return false;
    }

    /**
     * Escape XML special characters
     */
    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Get comprehensive flight plan statistics
     * @param {number} groundSpeed - Current groundspeed in knots
     * @param {number} fuelBurnRate - Fuel burn rate in gallons per hour (optional)
     * @returns {Object} Statistics object with total and per-leg data
     */
    getFlightPlanStatistics(groundSpeed = 120, fuelBurnRate = 8.5) {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length < 2) {
            return null;
        }

        const totalDistance = this.calculateTotalDistance();
        const totalETE = groundSpeed > 0 ? (totalDistance / groundSpeed) * 60 : 0; // minutes
        const totalFuel = this.calculateFuelRequired(totalDistance, groundSpeed, fuelBurnRate);
        const legs = this.calculateLegStatistics(groundSpeed);

        // Find highest altitude constraint
        const maxAltitude = Math.max(...this.flightPlan.waypoints
            .map(w => w.altitude || 0)
            .filter(alt => alt > 0));

        return {
            totalDistance: totalDistance,
            totalETE: totalETE,
            totalFuel: totalFuel,
            maxAltitude: maxAltitude || null,
            waypointCount: this.flightPlan.waypoints.length,
            legs: legs,
            groundSpeed: groundSpeed,
            fuelBurnRate: fuelBurnRate
        };
    }

    /**
     * Calculate total flight plan distance
     * @returns {number} Total distance in nautical miles
     */
    calculateTotalDistance() {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length < 2) {
            return 0;
        }

        let totalDistance = 0;
        const waypoints = this.flightPlan.waypoints;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i];
            const wp2 = waypoints[i + 1];

            if (wp1.lat && wp1.lon && wp2.lat && wp2.lon) {
                const distance = this.core.haversineDistance(
                    wp1.lat, wp1.lon || wp1.lng,
                    wp2.lat, wp2.lon || wp2.lng
                );
                totalDistance += distance;
            }
        }

        return totalDistance;
    }

    /**
     * Calculate per-leg statistics with cumulative data
     * @param {number} groundSpeed - Groundspeed in knots
     * @returns {Array} Array of leg statistics
     */
    calculateLegStatistics(groundSpeed = 120) {
        if (!this.flightPlan || !this.flightPlan.waypoints || this.flightPlan.waypoints.length < 2) {
            return [];
        }

        const legs = [];
        const waypoints = this.flightPlan.waypoints;
        let cumulativeDistance = 0;
        let cumulativeTime = 0; // minutes

        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const isLast = i === waypoints.length - 1;

            let legDistance = 0;
            let legTime = 0;
            let bearing = null;

            if (!isLast) {
                const nextWp = waypoints[i + 1];

                if (wp.lat && wp.lon && nextWp.lat && nextWp.lon) {
                    legDistance = this.core.haversineDistance(
                        wp.lat, wp.lon || wp.lng,
                        nextWp.lat, nextWp.lon || nextWp.lng
                    );
                    bearing = this.core.calculateBearing(
                        wp.lat, wp.lon || wp.lng,
                        nextWp.lat, nextWp.lon || nextWp.lng
                    );
                    legTime = groundSpeed > 0 ? (legDistance / groundSpeed) * 60 : 0; // minutes
                }

                cumulativeDistance += legDistance;
                cumulativeTime += legTime;
            }

            legs.push({
                index: i,
                ident: wp.ident || `WPT${i + 1}`,
                lat: wp.lat,
                lon: wp.lon || wp.lng,
                altitude: wp.altitude || null,
                altitudeConstraint: wp.altitudeConstraint || null,
                speed: wp.speed || null,
                legDistance: legDistance,
                legTime: legTime,
                bearing: bearing,
                cumulativeDistance: cumulativeDistance,
                cumulativeTime: cumulativeTime,
                isActive: i === this.activeWaypointIndex
            });
        }

        return legs;
    }

    /**
     * Calculate fuel required for route
     * @param {number} distance - Distance in nautical miles
     * @param {number} groundSpeed - Groundspeed in knots
     * @param {number} fuelBurnRate - Fuel burn rate in gallons per hour
     * @returns {Object} Fuel calculations
     */
    calculateFuelRequired(distance, groundSpeed, fuelBurnRate) {
        if (!distance || !groundSpeed || groundSpeed <= 0) {
            return { trip: 0, reserve: 0, total: 0 };
        }

        const timeHours = distance / groundSpeed;
        const tripFuel = timeHours * fuelBurnRate;

        // FAA reserve: 30 minutes at cruise (VFR day), 45 min (VFR night/IFR)
        const reserveMinutes = 45; // Conservative reserve
        const reserveFuel = (reserveMinutes / 60) * fuelBurnRate;

        return {
            trip: Math.round(tripFuel * 10) / 10,
            reserve: Math.round(reserveFuel * 10) / 10,
            total: Math.round((tripFuel + reserveFuel) * 10) / 10
        };
    }

    destroy() {
        if (this._fetchTimer) clearTimeout(this._fetchTimer);
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
        }
    }
}
