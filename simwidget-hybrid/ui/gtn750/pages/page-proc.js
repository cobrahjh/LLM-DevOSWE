/**
 * GTN750 Procedures Page - SID, STAR, and Approach management
 * Displays available procedures and allows selection/preview
 */

class ProceduresPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;

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
            procTabs: document.querySelectorAll('.proc-tab')
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

        // Re-render list
        this.renderProcedureList();
    }

    /**
     * Load procedures for airport
     */
    async loadProcedures(icao) {
        if (!icao || icao.length < 3) return;

        this.selectedAirport = icao;
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
                        this.previewWaypoints = data.waypoints;
                        this.onProcedureSelect(proc, this.procedureType, this.previewWaypoints);
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
