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

        try {
            // Try to fetch from server (SimBrief data or local database)
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/procedures/${icao}`
            );

            if (response.ok) {
                const data = await response.json();
                this.procedures = {
                    departures: data.departures || [],
                    arrivals: data.arrivals || [],
                    approaches: data.approaches || []
                };
            } else {
                // Generate sample procedures for demonstration
                this.procedures = this.generateSampleProcedures(icao);
            }
        } catch (e) {
            console.log(`[GTN750] Using sample procedures for ${icao}`);
            this.procedures = this.generateSampleProcedures(icao);
        }

        this.renderProcedureList();
    }

    /**
     * Generate sample procedures for demonstration
     */
    generateSampleProcedures(icao) {
        const runways = ['01', '19', '09', '27', '04L', '22R'];
        const fixes = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];

        return {
            departures: [
                { id: `${icao}1`, name: `${icao.slice(1)}ONE DEPARTURE`, runway: runways[0], transition: fixes[0] },
                { id: `${icao}2`, name: `${icao.slice(1)}TWO DEPARTURE`, runway: runways[1], transition: fixes[1] },
                { id: `RNAV1`, name: `RNAV SID RWY ${runways[0]}`, runway: runways[0], transition: 'RADAR' }
            ],
            arrivals: [
                { id: `${fixes[0]}1`, name: `${fixes[0]} ONE ARRIVAL`, runway: 'ALL', transition: fixes[2] },
                { id: `${fixes[1]}2`, name: `${fixes[1]} TWO ARRIVAL`, runway: runways[1], transition: fixes[3] },
                { id: `RNAV2`, name: `RNAV STAR`, runway: 'ALL', transition: fixes[4] }
            ],
            approaches: [
                { id: `ILS${runways[0]}`, name: `ILS RWY ${runways[0]}`, runway: runways[0], type: 'ILS', category: 'CAT I' },
                { id: `ILS${runways[1]}`, name: `ILS OR LOC RWY ${runways[1]}`, runway: runways[1], type: 'ILS', category: 'CAT I' },
                { id: `RNAV${runways[0]}`, name: `RNAV (GPS) RWY ${runways[0]}`, runway: runways[0], type: 'RNAV', category: 'LPV' },
                { id: `RNAV${runways[1]}`, name: `RNAV (GPS) RWY ${runways[1]}`, runway: runways[1], type: 'RNAV', category: 'LNAV/VNAV' },
                { id: `VOR${runways[0]}`, name: `VOR RWY ${runways[0]}`, runway: runways[0], type: 'VOR', category: '' },
                { id: `NDB${runways[1]}`, name: `NDB RWY ${runways[1]}`, runway: runways[1], type: 'NDB', category: '' },
                { id: `VISUAL`, name: `VISUAL APPROACH`, runway: 'ALL', type: 'VISUAL', category: '' }
            ]
        };
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

            if (proc.runway) {
                const rwy = document.createElement('span');
                rwy.className = 'proc-runway';
                rwy.textContent = `RWY ${proc.runway}`;
                details.appendChild(rwy);
            }

            if (proc.transition) {
                const trans = document.createElement('span');
                trans.className = 'proc-transition';
                trans.textContent = proc.transition;
                details.appendChild(trans);
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
    selectProcedure(proc) {
        this.selectedProcedure = proc;
        this.renderProcedureList(); // Re-render to show selection

        // Generate preview waypoints
        this.previewWaypoints = this.generatePreviewWaypoints(proc);

        // Notify listeners
        this.onProcedureSelect(proc, this.procedureType, this.previewWaypoints);
    }

    /**
     * Generate preview waypoints for map display
     */
    generatePreviewWaypoints(proc) {
        // In production, this would come from navigation database
        // For now, generate sample waypoints
        const waypoints = [];
        const baseLat = 40 + Math.random() * 10;
        const baseLon = -100 + Math.random() * 20;

        // Generate 4-6 waypoints
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const offset = i * (this.procedureType === 'dep' ? 1 : -1);
            waypoints.push({
                ident: `${proc.id.slice(0, 3)}${i + 1}`,
                lat: baseLat + offset * 0.2,
                lon: baseLon + offset * 0.3,
                type: i === 0 ? 'IAF' : (i === count - 1 ? 'FAF' : 'WAYPOINT')
            });
        }

        return waypoints;
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
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProceduresPage;
}
