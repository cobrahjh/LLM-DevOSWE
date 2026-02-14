/**
 * GTN750 Procedures Page - SID, STAR, and Approach management
 * Displays available procedures and allows selection/preview
 */

class ProceduresPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.frequencyTuner = options.frequencyTuner || null;

        // Current state
        this.selectedAirport = null;
        this.procedureType = 'dep'; // 'dep', 'arr', 'apr'
        this.procedures = {
            departures: [],
            arrivals: [],
            approaches: []
        };
        this.selectedProcedure = null;
        this.previewWaypoints = [];
        this.ilsData = null; // ILS frequency data for selected approach

        // Elements
        this.elements = {};

        // Callbacks
        this.onProcedureSelect = options.onProcedureSelect || (() => {});
        this.onProcedureLoad = options.onProcedureLoad || (() => {});
    }

    /**
     * Initialize page elements
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        this.elements = {
            procApt: document.getElementById('proc-apt'),
            procList: document.getElementById('proc-list'),
            procTabs: document.querySelectorAll('.proc-tab'),
            detailsPanel: document.getElementById('proc-details-panel'),
            detailsClose: document.getElementById('proc-details-close'),
            detailsTitle: document.getElementById('proc-details-title'),
            procNameVal: document.getElementById('proc-name-val'),
            procTypeVal: document.getElementById('proc-type-val'),
            procRunwayVal: document.getElementById('proc-runway-val'),
            procDistanceVal: document.getElementById('proc-distance-val'),
            procWaypointsList: document.getElementById('proc-waypoints-list')
        };
    }

    bindEvents() {
        // Airport input
        this.elements.procApt?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadProcedures(this.elements.procApt.value.toUpperCase());
            }
        });

        this.elements.procApt?.addEventListener('blur', () => {
            const icao = this.elements.procApt.value.toUpperCase();
            if (icao.length === 4) {
                this.loadProcedures(icao);
            }
        });

        // Type tabs
        this.elements.procTabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchType(tab.dataset.type);
            });
        });

        // Details panel close button
        this.elements.detailsClose?.addEventListener('click', () => {
            this.hideDetailsPanel();
        });
    }

    /**
     * Set airport and load procedures
     */
    setAirport(icao) {
        this.selectedAirport = icao.toUpperCase();
        if (this.elements.procApt) {
            this.elements.procApt.value = this.selectedAirport;
        }
        this.loadProcedures(this.selectedAirport);
    }

    /**
     * Switch procedure type (departure/arrival/approach)
     */
    switchType(type) {
        this.procedureType = type;

        // Update tabs
        this.elements.procTabs?.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Hide details panel when switching types
        this.hideDetailsPanel();

        // Re-render list
        this.renderProcedureList();
    }

    /**
     * Load procedures for airport
     */
    async loadProcedures(icao) {
        if (!icao || icao.length < 3) return;

        this.selectedAirport = icao;
        this.hideDetailsPanel(); // Hide details when loading new airport
        this.showLoading();

        // Try navdb first (local SQLite), then legacy chart-based API
        try {
            const navdbUrl = `http://${location.hostname}:${this.serverPort}/api/navdb/procedures/${icao}`;
            const response = await fetch(navdbUrl);

            if (response.ok) {
                const data = await response.json();
                this.procedures = {
                    departures: data.departures || [],
                    arrivals: data.arrivals || [],
                    approaches: data.approaches || []
                };
                this.renderProcedureList();
                return;
            }
        } catch (e) {
            GTNCore.log(`[GTN750] NavDB procedures failed for ${icao}:`, e.message);
        }

        // Fallback: legacy chart-based API
        try {
            const legacyUrl = `http://${location.hostname}:${this.serverPort}/api/procedures/${icao}`;
            const response = await fetch(legacyUrl);

            if (response.ok) {
                const data = await response.json();
                this.procedures = {
                    departures: data.departures || [],
                    arrivals: data.arrivals || [],
                    approaches: data.approaches || []
                };
            } else {
                this.procedures = { departures: [], arrivals: [], approaches: [] };
            }
        } catch (e) {
            GTNCore.log(`[GTN750] Legacy procedures failed for ${icao}`);
            this.procedures = { departures: [], arrivals: [], approaches: [] };
        }

        this.renderProcedureList();
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.elements.procList) return;
        this.elements.procList.textContent = '';
        const loading = document.createElement('div');
        loading.className = 'gtn-proc-empty';
        loading.textContent = 'Loading...';
        this.elements.procList.appendChild(loading);
    }

    /**
     * Render procedure list based on current type
     */
    renderProcedureList() {
        if (!this.elements.procList) return;
        this.elements.procList.textContent = '';

        let procedures;
        switch (this.procedureType) {
            case 'dep':
                procedures = this.procedures.departures;
                break;
            case 'arr':
                procedures = this.procedures.arrivals;
                break;
            case 'apr':
                procedures = this.procedures.approaches;
                break;
            default:
                procedures = [];
        }

        if (!procedures.length) {
            const empty = document.createElement('div');
            empty.className = 'gtn-proc-empty';
            empty.textContent = this.selectedAirport
                ? `No ${this.getTypeName()} available`
                : 'Select airport';
            this.elements.procList.appendChild(empty);
            return;
        }

        procedures.forEach(proc => {
            const item = document.createElement('div');
            item.className = 'gtn-proc-item';
            if (this.selectedProcedure?.id === proc.id) {
                item.classList.add('selected');
            }

            const name = document.createElement('div');
            name.className = 'gtn-proc-name';
            name.textContent = proc.name;

            const details = document.createElement('div');
            details.className = 'gtn-proc-details';

            if (proc.runway && proc.runway !== 'ALL') {
                const rwy = document.createElement('span');
                rwy.className = 'proc-runway';
                rwy.textContent = `RWY ${proc.runway}`;
                details.appendChild(rwy);
            }

            if (proc.type) {
                const type = document.createElement('span');
                type.className = 'proc-type';
                type.textContent = proc.type;
                details.appendChild(type);
            }

            if (proc.category) {
                const cat = document.createElement('span');
                cat.className = 'proc-category';
                cat.textContent = proc.category;
                details.appendChild(cat);
            }

            // Show ILS frequency for ILS/LOC approaches
            if (this.procedureType === 'apr' && typeof isILSApproach !== 'undefined' && isILSApproach(proc.type)) {
                const runway = typeof extractRunwayFromApproach !== 'undefined' ? extractRunwayFromApproach(proc.ident) : null;
                if (runway && this.selectedAirport) {
                    const ilsData = typeof getILSFrequency !== 'undefined' ? getILSFrequency(this.selectedAirport, runway) : null;
                    if (ilsData) {
                        const ilsInfo = document.createElement('span');
                        ilsInfo.className = 'proc-ils-freq';
                        ilsInfo.textContent = ilsData.freq.toFixed(2);
                        details.appendChild(ilsInfo);

                        // Add tune button
                        const tuneBtn = document.createElement('button');
                        tuneBtn.className = 'proc-tune-ils-btn';
                        tuneBtn.textContent = 'TUNE';
                        tuneBtn.title = `Tune ${ilsData.ident} to NAV1`;
                        tuneBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); // Don't trigger row selection
                            this.tuneILS(ilsData, runway);
                        });
                        details.appendChild(tuneBtn);
                    }
                }
            }

            item.appendChild(name);
            item.appendChild(details);

            item.addEventListener('click', () => this.selectProcedure(proc));
            this.elements.procList.appendChild(item);
        });
    }

    /**
     * Get type name for display
     */
    getTypeName() {
        switch (this.procedureType) {
            case 'dep': return 'departures';
            case 'arr': return 'arrivals';
            case 'apr': return 'approaches';
            default: return 'procedures';
        }
    }

    /**
     * Select a procedure
     */
    async selectProcedure(proc) {
        this.selectedProcedure = proc;
        this.renderProcedureList(); // Re-render to show selection

        // Fetch real procedure legs from navdb
        if (proc.id) {
            try {
                const url = `http://${location.hostname}:${this.serverPort}/api/navdb/procedure/${proc.id}/legs`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.waypoints?.length > 0) {
                        // Map altitude constraints for VNAV
                        this.previewWaypoints = data.waypoints.map(wp => this.mapAltitudeConstraints(wp));
                        this.onProcedureSelect(proc, this.procedureType, this.previewWaypoints);
                        this.showDetailsPanel(proc, this.previewWaypoints);
                        return;
                    }
                }
            } catch (e) {
                GTNCore.log(`[GTN750] Failed to fetch procedure legs for ${proc.id}:`, e.message);
            }
        }

        // Fallback: empty waypoints if navdb unavailable
        this.previewWaypoints = [];
        this.onProcedureSelect(proc, this.procedureType, this.previewWaypoints);
        this.showDetailsPanel(proc, this.previewWaypoints);
    }

    /**
     * Map NavDB waypoint altitude constraints to VNAV format
     * @param {Object} wp - Waypoint from NavDB
     * @returns {Object} Waypoint with VNAV-compatible altitude fields
     */
    mapAltitudeConstraints(wp) {
        // Copy all existing fields
        const mapped = { ...wp };

        // Map altitude constraints from NavDB format (alt1, alt2, altDesc) to VNAV format (altitude, altitudeConstraint)
        if (wp.altDesc && wp.alt1) {
            mapped.altitude = wp.alt1;

            // Convert ARINC 424 altitude descriptor to VNAV constraint type
            switch (wp.altDesc) {
                case '@':  // At altitude
                    mapped.altitudeConstraint = '@';
                    break;
                case '+':  // At or above
                    mapped.altitudeConstraint = '+';
                    break;
                case '-':  // At or below
                    mapped.altitudeConstraint = '-';
                    break;
                case 'B':  // Between (uses alt1 and alt2)
                    mapped.altitudeConstraint = 'B';
                    mapped.altitude2 = wp.alt2;
                    break;
                default:
                    // Unknown constraint type, use as-is
                    mapped.altitudeConstraint = wp.altDesc;
            }

            GTNCore.log(`[PROC] Mapped altitude constraint for ${wp.ident}: ${mapped.altitudeConstraint} ${mapped.altitude}ft`);
        }

        return mapped;
    }

    /**
     * Show procedure details panel with waypoint breakdown
     * @param {Object} proc - Selected procedure
     * @param {Array} waypoints - Procedure waypoints with constraints
     */
    showDetailsPanel(proc, waypoints) {
        if (!this.elements.detailsPanel) return;

        // Populate procedure info
        this.elements.procNameVal.textContent = proc.name || '—';
        this.elements.procTypeVal.textContent = this.getProcedureTypeLabel(proc) || '—';
        this.elements.procRunwayVal.textContent = proc.runway || 'ALL';

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i];
            const wp2 = waypoints[i + 1];
            if (wp1.lat && wp1.lon && wp2.lat && wp2.lon) {
                totalDistance += this.core.haversineDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
            }
        }
        this.elements.procDistanceVal.textContent = totalDistance > 0 ? `${totalDistance.toFixed(1)} nm` : '—';

        // Render waypoint list with bearings and distances
        this.renderWaypointList(waypoints);

        // Show panel
        this.elements.detailsPanel.style.display = 'flex';
    }

    /**
     * Hide procedure details panel
     */
    hideDetailsPanel() {
        if (this.elements.detailsPanel) {
            this.elements.detailsPanel.style.display = 'none';
        }
    }

    /**
     * Render detailed waypoint list with distances, bearings, and constraints
     * @param {Array} waypoints - Procedure waypoints
     */
    renderWaypointList(waypoints) {
        if (!this.elements.procWaypointsList || !waypoints.length) return;

        let html = '';
        let cumulativeDistance = 0;

        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            let distance = 0;
            let bearing = 0;

            // Calculate distance and bearing to next waypoint
            if (i < waypoints.length - 1) {
                const nextWp = waypoints[i + 1];
                if (wp.lat && wp.lon && nextWp.lat && nextWp.lon) {
                    distance = this.core.haversineDistance(wp.lat, wp.lon, nextWp.lat, nextWp.lon);
                    bearing = this.core.calculateBearing(wp.lat, wp.lon, nextWp.lat, nextWp.lon);
                    cumulativeDistance += distance;
                }
            }

            // Format altitude constraint
            let altitudeStr = '—';
            if (wp.altitude) {
                const altK = (wp.altitude / 1000).toFixed(1) + 'K';
                switch (wp.altitudeConstraint) {
                    case '@':
                        altitudeStr = `@${altK}`;
                        break;
                    case '+':
                        altitudeStr = `${altK}+`;
                        break;
                    case '-':
                        altitudeStr = `${altK}-`;
                        break;
                    case 'B':
                        if (wp.altitude2) {
                            const alt2K = (wp.altitude2 / 1000).toFixed(1) + 'K';
                            altitudeStr = `${alt2K}-${altK}`;
                        } else {
                            altitudeStr = `@${altK}`;
                        }
                        break;
                    default:
                        altitudeStr = `${altK}`;
                }
            }

            // Format speed limit
            let speedStr = '';
            if (wp.speedLimit && wp.speedLimit > 0) {
                speedStr = `<span class="proc-wpt-speed">${wp.speedLimit}kt</span>`;
            }

            html += `
                <div class="proc-wpt-item">
                    <div class="proc-wpt-header">
                        <span class="proc-wpt-ident">${wp.ident}</span>
                        ${distance > 0 ? `<span class="proc-wpt-distance">${distance.toFixed(1)} nm</span>` : ''}
                    </div>
                    <div class="proc-wpt-details">
                        ${bearing > 0 ? `<span class="proc-wpt-bearing">${String(Math.round(bearing)).padStart(3, '0')}°</span>` : ''}
                        ${altitudeStr !== '—' ? `<span class="proc-wpt-altitude">${altitudeStr}</span>` : ''}
                        ${speedStr}
                    </div>
                </div>
            `;
        }

        // Add total distance summary
        if (cumulativeDistance > 0) {
            html += `
                <div class="proc-wpt-total">
                    <div class="proc-wpt-total-label">TOTAL DISTANCE</div>
                    <div class="proc-wpt-total-value">${cumulativeDistance.toFixed(1)} nm</div>
                </div>
            `;
        }

        this.elements.procWaypointsList.innerHTML = html;
    }

    /**
     * Get human-readable procedure type label
     * @param {Object} proc - Procedure object
     * @returns {string} Type label
     */
    getProcedureTypeLabel(proc) {
        if (proc.approachType) {
            return proc.approachType; // e.g., "ILS", "RNAV", "VOR"
        }
        switch (this.procedureType) {
            case 'dep':
                return 'DEPARTURE';
            case 'arr':
                return 'ARRIVAL';
            case 'apr':
                return 'APPROACH';
            default:
                return proc.type || 'UNKNOWN';
        }
    }

    /**
     * Load selected procedure into flight plan
     */
    loadProcedure() {
        if (!this.selectedProcedure) {
            console.warn('[GTN750] No procedure selected');
            return;
        }

        this.onProcedureLoad(this.selectedProcedure, this.procedureType, this.previewWaypoints);
    }

    /**
     * Tune ILS frequency to NAV1 standby
     * @param {Object} ilsData - ILS data with freq, ident, name
     * @param {string} runway - Runway identifier
     */
    async tuneILS(ilsData, runway) {
        if (!this.frequencyTuner || !ilsData) {
            GTNCore.log('[PROC] No frequency tuner or ILS data available');
            return;
        }

        const success = await this.frequencyTuner.setFrequency('nav1', 'standby', ilsData.freq);

        if (success) {
            GTNCore.log(`[PROC] Tuned ${ilsData.ident} (${ilsData.freq.toFixed(2)}) to NAV1 standby for RWY ${runway}`);

            // Visual feedback - briefly highlight the button
            const btns = document.querySelectorAll('.proc-tune-ils-btn');
            btns.forEach(btn => {
                if (btn.textContent === 'TUNE') {
                    btn.classList.add('ils-tuned');
                    btn.textContent = '✓ TUNED';
                    setTimeout(() => {
                        btn.classList.remove('ils-tuned');
                        btn.textContent = 'TUNE';
                    }, 2000);
                }
            });
        } else {
            GTNCore.log(`[PROC] Failed to tune ILS frequency ${ilsData.freq.toFixed(2)}`);
        }
    }

    /**
     * Preview procedure on map
     */
    getPreviewWaypoints() {
        return this.previewWaypoints;
    }

    /**
     * Get selected procedure
     */
    getSelectedProcedure() {
        return this.selectedProcedure;
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedProcedure = null;
        this.previewWaypoints = [];
        this.renderProcedureList();
    }

    /**
     * View chart for selected procedure
     */
    viewChart() {
        if (!this.selectedProcedure) {
            console.warn('[GTN750] No procedure selected');
            return;
        }

        // Use chart URL if available
        if (this.selectedProcedure.chartUrl) {
            window.open(this.selectedProcedure.chartUrl, '_blank', 'width=900,height=1100,scrollbars=yes');
        } else if (this.selectedAirport) {
            // Fall back to ChartFox
            window.open(`https://chartfox.org/${this.selectedAirport}`, '_blank');
        }
    }

    /**
     * Open ChartFox for the selected airport
     */
    openChartFox() {
        if (this.selectedAirport) {
            window.open(`https://chartfox.org/${this.selectedAirport}`, '_blank');
        }
    }

    /**
     * Get approach minimums description
     */
    getApproachMinimumsInfo(proc) {
        if (!proc || proc.type === 'VISUAL') return null;

        const minimums = {
            'ILS': { da: '200 AGL', vis: '1/2 SM', note: 'Decision Altitude' },
            'RNAV': { da: '250 AGL', vis: '3/4 SM', note: 'LPV/LNAV' },
            'VOR': { mda: '500 AGL', vis: '1 SM', note: 'Circling available' },
            'LOC': { mda: '400 AGL', vis: '3/4 SM', note: 'Localizer only' },
            'NDB': { mda: '600 AGL', vis: '1 SM', note: 'Non-precision' }
        };

        return minimums[proc.type] || null;
    }

    /**
     * Get procedure summary for display
     */
    getProcedureSummary() {
        if (!this.selectedProcedure) return null;

        const proc = this.selectedProcedure;
        return {
            name: proc.name,
            type: proc.type,
            runway: proc.runway,
            hasChart: !!proc.chartUrl,
            minimums: this.getApproachMinimumsInfo(proc)
        };
    }

    /**
     * Check if selected procedure has a chart
     */
    hasChart() {
        return !!(this.selectedProcedure?.chartUrl);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProceduresPage;
}
