/**
 * GTN750 Charts Page - Approach plates and airport diagrams
 * Integrates with ChartFox API and FAA DTPP for chart viewing
 */

class ChartsPage {
    constructor(options = {}) {
        this.core = options.core;
        this.serverPort = options.serverPort || 8080;

        // State
        this.selectedAirport = null;
        this.charts = [];
        this.selectedChart = null;
        this.chartTypes = ['APD', 'IAP', 'DP', 'STAR', 'MIN', 'HOT'];
        this.activeType = 'IAP';

        // Chart sources
        this.sources = {
            chartfox: 'https://chartfox.org',
            faa: 'https://aeronav.faa.gov/d-tpp'
        };

        // Elements
        this.elements = {};

        // Callbacks
        this.onChartSelect = options.onChartSelect || (() => {});
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderChartTypes();
    }

    cacheElements() {
        this.elements = {
            chartApt: document.getElementById('chart-apt'),
            chartSearch: document.getElementById('chart-search'),
            chartList: document.getElementById('chart-list'),
            chartTypeBar: document.getElementById('chart-type-bar'),
            chartViewer: document.getElementById('chart-viewer'),
            chartFrame: document.getElementById('chart-frame'),
            chartTitle: document.getElementById('chart-title')
        };
    }

    bindEvents() {
        // Airport search
        this.elements.chartSearch?.addEventListener('click', () => {
            this.searchCharts(this.elements.chartApt?.value);
        });

        this.elements.chartApt?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchCharts(this.elements.chartApt.value);
            }
        });
    }

    /**
     * Render chart type filter bar
     */
    renderChartTypes() {
        if (!this.elements.chartTypeBar) return;

        this.elements.chartTypeBar.textContent = '';

        const typeLabels = {
            'APD': 'APT DIAG',
            'IAP': 'APPROACH',
            'DP': 'DEPARTURE',
            'STAR': 'ARRIVAL',
            'MIN': 'MINIMUMS',
            'HOT': 'HOT SPOT'
        };

        this.chartTypes.forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'chart-type-btn' + (type === this.activeType ? ' active' : '');
            btn.textContent = typeLabels[type] || type;
            btn.dataset.type = type;
            btn.addEventListener('click', () => this.filterByType(type));
            this.elements.chartTypeBar.appendChild(btn);
        });
    }

    /**
     * Filter charts by type
     */
    filterByType(type) {
        this.activeType = type;

        // Update active button
        this.elements.chartTypeBar?.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        this.renderChartList();
    }

    /**
     * Search for charts at an airport
     */
    async searchCharts(icao) {
        if (!icao || icao.length < 3) return;

        this.selectedAirport = icao.toUpperCase();
        if (this.elements.chartApt) {
            this.elements.chartApt.value = this.selectedAirport;
        }

        this.showLoading();

        try {
            // Try to fetch from server (which could proxy to ChartFox)
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/charts/${this.selectedAirport}`
            );

            if (response.ok) {
                const data = await response.json();
                this.charts = data.charts || [];
            } else {
                // Generate sample charts for demonstration
                this.charts = this.generateSampleCharts(this.selectedAirport);
            }
        } catch (e) {
            console.log(`[GTN750] Using sample charts for ${this.selectedAirport}`);
            this.charts = this.generateSampleCharts(this.selectedAirport);
        }

        this.renderChartList();
    }

    /**
     * Generate sample charts for demonstration
     */
    generateSampleCharts(icao) {
        const runways = ['01', '19', '09L', '27R', '04', '22'];
        const charts = [];

        // Airport diagram
        charts.push({
            id: `${icao}-APD`,
            name: `${icao} AIRPORT DIAGRAM`,
            type: 'APD',
            url: `${this.sources.chartfox}/${icao}/airport`
        });

        // ILS approaches
        runways.slice(0, 3).forEach(rwy => {
            charts.push({
                id: `${icao}-ILS${rwy}`,
                name: `ILS OR LOC RWY ${rwy}`,
                type: 'IAP',
                url: `${this.sources.chartfox}/${icao}/ILS${rwy}`
            });
        });

        // RNAV approaches
        runways.slice(0, 2).forEach(rwy => {
            charts.push({
                id: `${icao}-RNAV${rwy}`,
                name: `RNAV (GPS) RWY ${rwy}`,
                type: 'IAP',
                url: `${this.sources.chartfox}/${icao}/RNAV${rwy}`
            });
        });

        // VOR approach
        charts.push({
            id: `${icao}-VOR${runways[0]}`,
            name: `VOR RWY ${runways[0]}`,
            type: 'IAP',
            url: `${this.sources.chartfox}/${icao}/VOR${runways[0]}`
        });

        // Departures
        charts.push({
            id: `${icao}-DP1`,
            name: `${icao.slice(1)}ONE DEPARTURE`,
            type: 'DP',
            url: `${this.sources.chartfox}/${icao}/DP1`
        });
        charts.push({
            id: `${icao}-DP2`,
            name: `RNAV DEPARTURE RWY ${runways[0]}`,
            type: 'DP',
            url: `${this.sources.chartfox}/${icao}/DP2`
        });

        // Arrivals
        charts.push({
            id: `${icao}-STAR1`,
            name: `BRAVO ONE ARRIVAL`,
            type: 'STAR',
            url: `${this.sources.chartfox}/${icao}/STAR1`
        });
        charts.push({
            id: `${icao}-STAR2`,
            name: `DELTA TWO ARRIVAL`,
            type: 'STAR',
            url: `${this.sources.chartfox}/${icao}/STAR2`
        });

        // Takeoff minimums
        charts.push({
            id: `${icao}-MIN`,
            name: `TAKEOFF MINIMUMS`,
            type: 'MIN',
            url: `${this.sources.chartfox}/${icao}/MIN`
        });

        return charts;
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.elements.chartList) return;
        this.elements.chartList.textContent = '';
        const loading = document.createElement('div');
        loading.className = 'gtn-charts-empty';
        loading.textContent = 'Loading charts...';
        this.elements.chartList.appendChild(loading);
    }

    /**
     * Render chart list filtered by active type
     */
    renderChartList() {
        if (!this.elements.chartList) return;
        this.elements.chartList.textContent = '';

        const filtered = this.charts.filter(c => c.type === this.activeType);

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'gtn-charts-empty';
            empty.textContent = this.selectedAirport
                ? `No ${this.activeType} charts for ${this.selectedAirport}`
                : 'Enter airport ICAO code';
            this.elements.chartList.appendChild(empty);
            return;
        }

        filtered.forEach(chart => {
            const item = document.createElement('div');
            item.className = 'gtn-chart-item';
            if (this.selectedChart?.id === chart.id) {
                item.classList.add('selected');
            }

            const name = document.createElement('div');
            name.className = 'chart-name';
            name.textContent = chart.name;

            const type = document.createElement('div');
            type.className = 'chart-type';
            type.textContent = chart.type;

            item.appendChild(name);
            item.appendChild(type);

            item.addEventListener('click', () => this.selectChart(chart));
            this.elements.chartList.appendChild(item);
        });
    }

    /**
     * Select a chart
     */
    selectChart(chart) {
        this.selectedChart = chart;
        this.renderChartList();
        this.onChartSelect(chart);
        console.log(`[GTN750] Chart selected: ${chart.name}`);
    }

    /**
     * Open selected chart in viewer
     */
    viewChart() {
        if (!this.selectedChart) {
            console.warn('[GTN750] No chart selected');
            return;
        }

        // Open ChartFox in new window/tab
        const url = this.getChartUrl(this.selectedChart);
        window.open(url, '_blank', 'width=800,height=1000');
    }

    /**
     * Get chart URL - tries ChartFox first, falls back to FAA
     */
    getChartUrl(chart) {
        if (chart.url) return chart.url;

        // Generate ChartFox URL
        const icao = this.selectedAirport;
        return `https://chartfox.org/${icao}`;
    }

    /**
     * Open ChartFox page for current airport
     */
    openChartFox() {
        if (!this.selectedAirport) {
            console.warn('[GTN750] No airport selected');
            return;
        }
        window.open(`https://chartfox.org/${this.selectedAirport}`, '_blank');
    }

    /**
     * Open FAA DTPP page
     */
    openFaaDtpp() {
        window.open('https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/', '_blank');
    }

    /**
     * Get selected chart
     */
    getSelectedChart() {
        return this.selectedChart;
    }

    /**
     * Set airport from external source
     */
    setAirport(icao) {
        if (icao && icao.length >= 3) {
            this.searchCharts(icao);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartsPage;
}
