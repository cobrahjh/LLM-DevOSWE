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

        // Timer handle for cleanup
        this._fetchTimer = null;
    }

    // ===== FLIGHT PLAN FETCH =====

    async fetchFlightPlan() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/flightplan`);
            if (response.ok) {
                const data = await response.json();
                if (data?.waypoints?.length > 0) {
                    this.flightPlan = data;
                    this.renderFlightPlan();
                    this.updateFplHeader();
                }
            }
        } catch (e) {
            console.log('[GTN750] No flight plan');
        }
        this._fetchTimer = setTimeout(() => this.fetchFlightPlan(), 30000);
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
            this.renderFlightPlan();
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
            this.renderFlightPlan();
        }
    }

    invertFlightPlan() {
        if (this.flightPlan?.waypoints) {
            this.flightPlan.waypoints.reverse();
            this.activeWaypointIndex = 0;
            this.renderFlightPlan();
            this.updateFplHeader();
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
        if (now - this.lastSequenceTime < 3000) return;

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

        const legDist = wp.distanceFromPrev || 5;
        const threshold = Math.min(0.5, legDist * 0.1);

        if (dist <= threshold && data.groundSpeed > 15) {
            const brg = this.core.calculateBearing(
                data.latitude, data.longitude,
                wp.lat, wp.lng
            );
            const trackError = Math.abs(this.core.normalizeAngle(data.track - brg));

            if (trackError < 120 || dist < 0.2) {
                this.sequenceToNextWaypoint();
            }
        }
    }

    sequenceToNextWaypoint() {
        this.lastSequenceTime = Date.now();

        const passedWp = this.flightPlan.waypoints[this.activeWaypointIndex];
        if (passedWp) {
            passedWp.passed = true;
            console.log(`[GTN750] Sequenced past ${passedWp.ident}, advancing to next waypoint`);
        }

        this.activeWaypointIndex++;

        if (this.activeWaypointIndex < this.flightPlan.waypoints.length) {
            const nextWp = this.flightPlan.waypoints[this.activeWaypointIndex];
            console.log(`[GTN750] Active waypoint: ${nextWp?.ident}`);

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
            console.log('[GTN750] Arrived at final waypoint');
            this.activeWaypoint = null;
        }

        this.renderFlightPlan();
        this.updateFplHeader();
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
            osc.frequency.value = 880;
            gain.gain.value = 0.1;

            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            osc.stop(this.audioContext.currentTime + 0.15);
        } catch (e) {
            // Ignore audio errors
        }
    }

    // ===== DIRECT-TO =====

    showDirectTo(prefilledIdent = null) {
        const modal = document.getElementById('dto-modal');
        const input = document.getElementById('dto-input');
        const info = document.getElementById('dto-info');
        const activateBtn = document.getElementById('dto-activate');

        if (!modal) return;

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

        console.log(`[GTN750] Direct-To activated: ${this.dtoTarget.ident}`);

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
            this.flightPlan = data;
            this.renderFlightPlan();
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
            this.renderFlightPlan();
            if (this.onWaypointChanged) this.onWaypointChanged();
            console.log(`[GTN750] SimBrief flight plan loaded: ${data.departure} -> ${data.arrival} (${data.waypoints.length} waypoints)`);
        }
        if (type === 'waypoint-select') {
            this.selectWaypoint(data.index);
        }
        if (type === 'waypoint-sequence') {
            if (this.flightPlan?.waypoints?.[data.passedIndex]) {
                this.flightPlan.waypoints[data.passedIndex].passed = true;
            }
            this.activeWaypointIndex = data.activeIndex;
            this.renderFlightPlan();
            if (this.onWaypointChanged) this.onWaypointChanged();
        }
    }

    destroy() {
        if (this._fetchTimer) clearTimeout(this._fetchTimer);
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
        }
    }
}
