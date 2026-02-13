/**
 * GTN750 Flight Plan Page - Garmin-style waypoint list with cursor navigation
 * Follows NearestPage pattern: lazy-loaded, receives refs from orchestrator
 */

class FlightPlanPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.flightPlanManager = options.flightPlanManager || null;
        this.softKeys = options.softKeys || null;

        // State
        this.cursorIndex = -1; // -1 = no cursor selection
        this.flightPlan = null;

        // Elements cache
        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this._initialized = true;
    }

    cacheElements() {
        this.elements = {
            fplList: document.getElementById('fpl-list'),
            fplDep: document.getElementById('fpl-dep'),
            fplArr: document.getElementById('fpl-arr'),
            fplDist: document.getElementById('fpl-dist'),
            fplEte: document.getElementById('fpl-ete'),
            fplProgress: document.getElementById('fpl-progress'),
            importBtn: document.getElementById('fpl-import-btn')
        };
    }

    bindEvents() {
        // Click outside list to deselect cursor
        const pageFpl = document.getElementById('page-fpl');
        if (pageFpl) {
            pageFpl.addEventListener('click', (e) => {
                if (!e.target.closest('.gtn-fpl-item') && !e.target.closest('.gtn-fpl-col-header')) {
                    this.setCursor(-1);
                }
            });
        }

        // Import SimBrief plan
        if (this.elements.importBtn) {
            this.elements.importBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.importSimBrief();
            });
        }
    }

    async importSimBrief() {
        const btn = this.elements.importBtn;
        if (!btn || btn.classList.contains('loading')) return;

        // Check for saved pilot ID
        let pilotId = localStorage.getItem('simbrief-pilot-id');
        if (!pilotId) {
            pilotId = prompt('Enter SimBrief Pilot ID or Username:');
            if (!pilotId) return;
            localStorage.setItem('simbrief-pilot-id', pilotId.trim());
        }

        btn.classList.add('loading');
        btn.textContent = '... LOADING';

        try {
            const isNumeric = /^\d+$/.test(pilotId);
            const param = isNumeric ? 'userid' : 'username';
            const res = await fetch(`/api/simbrief/ofp?${param}=${encodeURIComponent(pilotId)}`);
            if (!res.ok) throw new Error('Failed to fetch OFP');
            const ofp = await res.json();
            if (ofp.fetch?.status === 'Error') throw new Error(ofp.fetch.error || 'No plan found');

            const navlog = ofp.navlog?.fix || [];
            const waypoints = navlog.map(fix => ({
                ident: fix.ident,
                name: fix.name,
                type: fix.type,
                lat: parseFloat(fix.pos_lat),
                lng: parseFloat(fix.pos_long),
                altitude: parseInt(fix.altitude_feet) || 0,
                distanceFromPrev: parseInt(fix.distance) || 0,
                ete: parseInt(fix.time_leg) || 0
            }));

            const planData = {
                departure: ofp.origin?.icao_code,
                arrival: ofp.destination?.icao_code,
                waypoints,
                totalDistance: parseInt(ofp.general?.route_distance) || 0,
                route: ofp.general?.route || '',
                altitude: ofp.general?.initial_altitude || 0,
                source: 'simbrief'
            };

            // Load into flight plan manager
            if (this.flightPlanManager) {
                this.flightPlanManager.handleSyncMessage('simbrief-plan', planData);
            }

            // Store on server for other panes
            fetch('/api/ai-pilot/shared-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'nav', data: { simbriefPlan: planData } })
            }).catch(() => {});

            // Broadcast to other panes
            const ch = new SafeChannel('SimGlass-sync');
            ch.postMessage({ type: 'simbrief-plan', data: planData });
            ch.close();

            btn.textContent = '\u2714 LOADED';
            setTimeout(() => { btn.textContent = '\u2708 IMPORT'; }, 2000);
        } catch (e) {
            console.error('[FPL] SimBrief import failed:', e);
            btn.textContent = '\u2718 FAILED';
            // Clear saved ID on failure so user can re-enter
            localStorage.removeItem('simbrief-pilot-id');
            setTimeout(() => { btn.textContent = '\u2708 IMPORT'; }, 2000);
        }
        btn.classList.remove('loading');
    }

    // ===== RENDERING =====

    render() {
        this.renderHeader();
        this.renderList();
        this.renderProgress();
    }

    renderHeader() {
        const wps = this.flightPlan?.waypoints;
        if (!wps?.length) {
            if (this.elements.fplDep) this.elements.fplDep.textContent = '----';
            if (this.elements.fplArr) this.elements.fplArr.textContent = '----';
            if (this.elements.fplDist) this.elements.fplDist.textContent = '0';
            if (this.elements.fplEte) this.elements.fplEte.textContent = '--:--';
            return;
        }

        if (this.elements.fplDep) this.elements.fplDep.textContent = wps[0].ident || '----';
        if (this.elements.fplArr) this.elements.fplArr.textContent = wps[wps.length - 1].ident || '----';

        let totalDist = 0;
        wps.forEach(wp => { if (wp.distanceFromPrev) totalDist += wp.distanceFromPrev; });
        if (this.elements.fplDist) this.elements.fplDist.textContent = Math.round(totalDist);

        if (this.elements.fplEte) {
            const gs = this.flightPlanManager?._groundSpeed || 0;
            if (gs > 0 && totalDist > 0) {
                const eteMin = (totalDist / gs) * 60;
                this.elements.fplEte.textContent = this.core.formatEte(eteMin);
            } else {
                this.elements.fplEte.textContent = '--:--';
            }
        }
    }

    renderList() {
        if (!this.elements.fplList) return;
        this.elements.fplList.textContent = '';

        if (!this.flightPlan?.waypoints?.length) {
            this.renderEmpty();
            return;
        }

        // Column header row
        const header = document.createElement('div');
        header.className = 'gtn-fpl-col-header';
        header.innerHTML = '<span>#</span><span>IDENT</span><span>ALT</span><span>CUM</span><span>LEG</span><span>DTK</span><span>ETE</span>';
        this.elements.fplList.appendChild(header);

        const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;

        this.flightPlan.waypoints.forEach((wp, index) => {
            this.renderRow(wp, index, activeIdx);
        });
    }

    renderRow(wp, index, activeIdx) {
        const row = document.createElement('div');
        row.className = 'gtn-fpl-item';

        if (wp.passed) row.classList.add('passed');
        if (index === activeIdx) row.classList.add('active');
        if (index === this.cursorIndex) row.classList.add('cursor');

        // Seq number
        const seq = document.createElement('span');
        seq.className = 'fpl-seq';
        seq.textContent = index + 1;

        // Ident (with airway name if present)
        const ident = document.createElement('span');
        ident.className = 'fpl-ident';
        let identText = wp.ident || `WP${index + 1}`;
        if (wp.airway) {
            identText += ` (${wp.airway})`;
        }
        ident.textContent = identText;

        // Altitude
        const alt = document.createElement('span');
        alt.className = 'fpl-alt';
        alt.textContent = wp.altitude ? Math.round(wp.altitude).toLocaleString() : '---';

        // Cumulative distance
        const cumDist = document.createElement('span');
        cumDist.className = 'fpl-dist';
        cumDist.textContent = Math.round(this.calcCumulativeDist(index));

        // Leg distance
        const legDist = document.createElement('span');
        legDist.className = 'fpl-dist';
        legDist.textContent = wp.distanceFromPrev ? Math.round(wp.distanceFromPrev) : '-';

        // DTK (desired track)
        const dtk = document.createElement('span');
        dtk.className = 'fpl-dtk';
        const dtkVal = this.calcLegDTK(index);
        dtk.textContent = dtkVal !== null ? Math.round(dtkVal).toString().padStart(3, '0') + '\u00B0' : '---';

        // ETE
        const ete = document.createElement('span');
        ete.className = 'fpl-ete';
        const gs = this.flightPlanManager?._groundSpeed || 0;
        if (wp.distanceFromPrev && gs > 0) {
            ete.textContent = this.calcLegETE(wp.distanceFromPrev, gs);
        } else {
            ete.textContent = '--:--';
        }

        row.appendChild(seq);
        row.appendChild(ident);
        row.appendChild(alt);
        row.appendChild(cumDist);
        row.appendChild(legDist);
        row.appendChild(dtk);
        row.appendChild(ete);

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setCursor(index);
        });

        this.elements.fplList.appendChild(row);
    }

    renderEmpty() {
        const empty = document.createElement('div');
        empty.className = 'gtn-fpl-empty';

        const msg = document.createElement('div');
        msg.textContent = 'No Flight Plan';
        msg.style.fontSize = '14px';
        msg.style.marginBottom = '8px';

        const hint = document.createElement('div');
        hint.textContent = 'Use Direct-To or load a SimBrief plan';
        hint.style.fontSize = '10px';
        hint.style.color = 'var(--gtn-text-dim)';

        empty.appendChild(msg);
        empty.appendChild(hint);
        this.elements.fplList.appendChild(empty);
    }

    renderProgress() {
        if (!this.elements.fplProgress || !this.flightPlan?.waypoints) {
            if (this.elements.fplProgress) this.elements.fplProgress.style.width = '0%';
            return;
        }
        const total = this.flightPlan.waypoints.length;
        const passed = this.flightPlan.waypoints.filter(wp => wp.passed).length;
        const progress = total > 0 ? (passed / total) * 100 : 0;
        this.elements.fplProgress.style.width = progress + '%';
    }

    // ===== CURSOR =====

    setCursor(index) {
        const wps = this.flightPlan?.waypoints;
        if (!wps?.length) {
            this.cursorIndex = -1;
            this.updateSoftKeyContext();
            return;
        }

        this.cursorIndex = (index >= 0 && index < wps.length) ? index : -1;

        // Update visual state
        const items = this.elements.fplList?.querySelectorAll('.gtn-fpl-item');
        if (items) {
            items.forEach((item, i) => {
                item.classList.toggle('cursor', i === this.cursorIndex);
            });
        }

        // Scroll into view
        if (this.cursorIndex >= 0 && items?.[this.cursorIndex]) {
            items[this.cursorIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        this.updateSoftKeyContext();
    }

    moveCursor(dir) {
        const wps = this.flightPlan?.waypoints;
        if (!wps?.length) return;

        let newIdx = this.cursorIndex + dir;
        newIdx = Math.max(0, Math.min(wps.length - 1, newIdx));
        this.setCursor(newIdx);
    }

    // ===== ACTIONS =====

    onNew() {
        if (this.flightPlanManager) {
            this.flightPlanManager.showDirectTo();
        }
    }

    onDelete() {
        if (this.cursorIndex < 0 || !this.flightPlanManager) return;
        this.flightPlanManager.deleteWaypoint(this.cursorIndex);

        // Adjust cursor
        const wps = this.flightPlan?.waypoints;
        if (wps?.length) {
            this.cursorIndex = Math.min(this.cursorIndex, wps.length - 1);
        } else {
            this.cursorIndex = -1;
        }
        this.updateSoftKeyContext();
    }

    onInsert() {
        if (this.cursorIndex < 0 || !this.flightPlanManager) return;
        this.flightPlanManager.showDirectTo(null, {
            insertMode: true,
            insertIndex: this.cursorIndex
        });
    }

    onActivateLeg() {
        if (this.cursorIndex < 0 || !this.flightPlanManager) return;
        // Set the active waypoint index to cursor position, mark prior as passed
        this.flightPlanManager.activeWaypointIndex = this.cursorIndex;
        this.flightPlanManager.activateLeg();
    }

    onInvert() {
        if (this.flightPlanManager) {
            this.flightPlanManager.invertFlightPlan();
        }
    }

    onInsertAirway() {
        if (this.cursorIndex < 0 || !this.flightPlanManager) return;
        const selectedWp = this.getSelectedWaypoint();
        if (!selectedWp) return;

        // Show airway modal via flight plan manager
        this.flightPlanManager.showAirwaysModal();

        // Pre-fill entry fix with selected waypoint
        setTimeout(() => {
            const entryInput = document.getElementById('awy-entry');
            if (entryInput) {
                entryInput.value = selectedWp.ident || '';
            }
        }, 150);
    }

    // ===== SOFT KEYS =====

    updateSoftKeyContext() {
        if (!this.softKeys) return;
        if (this.cursorIndex >= 0) {
            this.softKeys.setContext('fpl-selected');
        } else {
            this.softKeys.setContext('fpl');
        }
    }

    // ===== EXTERNAL UPDATE =====

    update(flightPlan) {
        this.flightPlan = flightPlan;
        if (this._initialized) {
            this.render();
        }
    }

    // ===== GETTERS =====

    getSelectedWaypoint() {
        if (this.cursorIndex < 0 || !this.flightPlan?.waypoints) return null;
        return this.flightPlan.waypoints[this.cursorIndex] || null;
    }

    // ===== HELPERS =====

    calcCumulativeDist(upToIndex) {
        if (!this.flightPlan?.waypoints) return 0;
        let total = 0;
        for (let i = 0; i <= upToIndex; i++) {
            const wp = this.flightPlan.waypoints[i];
            if (wp.distanceFromPrev) total += wp.distanceFromPrev;
        }
        return total;
    }

    calcLegDTK(index) {
        if (!this.flightPlan?.waypoints || index <= 0) return null;
        const from = this.flightPlan.waypoints[index - 1];
        const to = this.flightPlan.waypoints[index];
        if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
        const trueBrg = this.core.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        return trueBrg;
    }

    calcLegETE(distNM, groundSpeedKt) {
        if (!distNM || !groundSpeedKt || groundSpeedKt <= 0) return '--:--';
        const eteMin = (distNM / groundSpeedKt) * 60;
        return this.core.formatEte(eteMin);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlightPlanPage;
}
