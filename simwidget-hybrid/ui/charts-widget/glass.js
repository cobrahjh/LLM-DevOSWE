/**
 * Charts glass - SimGlass v2.0.0
 * Free approach charts from multiple sources
 *
 * Sources:
 * - ChartFox: https://chartfox.org (free, global)
 * - FAA: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/ (US only)
 * - Eurocontrol: EAD basic charts (Europe)
 */

class ChartsGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'charts-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for chart display
        });

        this.currentAirport = null;
        this.currentSource = 'chartfox';
        this.recentAirports = [];
        this.charts = [];

        this.initElements();
        this.initEvents();
        this.loadState();
        this.renderRecent();
    }

    initElements() {
        this.airportInput = document.getElementById('airport-input');
        this.searchBtn = document.getElementById('btn-search');
        this.refreshBtn = document.getElementById('btn-refresh');
        this.content = document.getElementById('charts-content');
        this.recentList = document.getElementById('recent-list');
        this.sourceTabs = document.getElementById('source-tabs');
    }

    initEvents() {
        this.searchBtn.addEventListener('click', () => this.searchCharts());
        this.refreshBtn.addEventListener('click', () => this.refresh());

        this.airportInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCharts();
        });

        this.airportInput.addEventListener('input', () => {
            this.airportInput.value = this.airportInput.value.toUpperCase();
        });

        // Source tab switching
        this.sourceTabs.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.sourceTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentSource = tab.dataset.source;
                if (this.currentAirport) {
                    this.searchCharts(this.currentAirport);
                }
            });
        });
    }

    async searchCharts(icao) {
        const airport = (icao || this.airportInput.value).toUpperCase().trim();

        if (!airport || airport.length < 3) {
            this.showError('Enter valid ICAO code');
            return;
        }

        this.currentAirport = airport;
        this.showLoading();
        this.refreshBtn.classList.add('spinning');

        try {
            let charts = [];

            switch (this.currentSource) {
                case 'chartfox':
                    charts = await this.fetchChartFox(airport);
                    break;
                case 'faa':
                    charts = await this.fetchFAA(airport);
                    break;
                case 'eurocontrol':
                    charts = await this.fetchEurocontrol(airport);
                    break;
            }

            this.charts = charts;
            this.displayCharts(airport, charts);
            this.addToRecent(airport);

        } catch (error) {
            this.showError(error.message || 'Failed to load charts');
        }

        this.refreshBtn.classList.remove('spinning');
    }

    async fetchChartFox(icao) {
        // ChartFox provides free charts via their website
        // We'll return direct links to their chart pages
        const charts = [
            { name: 'Airport Diagram', type: 'APD', icon: '🗺️', url: `https://chartfox.org/${icao}` },
            { name: 'All Charts', type: 'ALL', icon: '📊', url: `https://chartfox.org/${icao}` }
        ];

        // Add common chart types that ChartFox typically has
        const chartTypes = [
            { name: 'ILS Approaches', type: 'ILS', icon: '📡' },
            { name: 'RNAV Approaches', type: 'RNAV', icon: '🛰️' },
            { name: 'VOR Approaches', type: 'VOR', icon: '📻' },
            { name: 'SID (Departures)', type: 'SID', icon: '🛫' },
            { name: 'STAR (Arrivals)', type: 'STAR', icon: '🛬' }
        ];

        chartTypes.forEach(ct => {
            charts.push({
                name: ct.name,
                type: ct.type,
                icon: ct.icon,
                url: `https://chartfox.org/${icao}#${ct.type.toLowerCase()}`
            });
        });

        return charts;
    }

    async fetchFAA(icao) {
        // FAA provides free charts for US airports
        // DTPP (Digital Terminal Procedures Publication)
        if (!icao.startsWith('K') && !icao.startsWith('P')) {
            throw new Error('FAA charts only available for US airports (K/P prefix)');
        }

        const charts = [
            { name: 'Airport Diagram', type: 'APD', icon: '🗺️', url: `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=current&ident=${icao}` },
            { name: 'All Procedures', type: 'ALL', icon: '📊', url: `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=current&ident=${icao}` }
        ];

        // SkyVector is another free source for US charts
        charts.push({
            name: 'SkyVector View',
            type: 'MAP',
            icon: '🌐',
            url: `https://skyvector.com/airport/${icao}`
        });

        return charts;
    }

    async fetchEurocontrol(icao) {
        // Eurocontrol EAD provides charts for European airports
        const charts = [
            { name: 'EAD Basic', type: 'EAD', icon: '🇪🇺', url: `https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/login/ead-basic/` },
            { name: 'Airport Info', type: 'INFO', icon: '📋', url: `https://www.world-airport-codes.com/search/?s=${icao}` }
        ];

        // OpenFlightMaps for VFR charts in Europe
        charts.push({
            name: 'OpenFlightMaps',
            type: 'VFR',
            icon: '🗺️',
            url: `https://www.openflightmaps.org/`
        });

        return charts;
    }

    displayCharts(airport, charts) {
        this.content.replaceChildren();

        if (charts.length === 0) {
            this.showError('No charts found for ' + airport);
            return;
        }

        // Group charts by type
        const categories = {
            'Diagrams': charts.filter(c => ['APD', 'MAP', 'ALL'].includes(c.type)),
            'Approaches': charts.filter(c => ['ILS', 'RNAV', 'VOR', 'NDB'].includes(c.type)),
            'Procedures': charts.filter(c => ['SID', 'STAR'].includes(c.type)),
            'Other': charts.filter(c => !['APD', 'MAP', 'ALL', 'ILS', 'RNAV', 'VOR', 'NDB', 'SID', 'STAR'].includes(c.type))
        };

        Object.entries(categories).forEach(([catName, catCharts]) => {
            if (catCharts.length === 0) return;

            const category = document.createElement('div');
            category.className = 'chart-category';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.textContent = catName;
            category.appendChild(header);

            const list = document.createElement('div');
            list.className = 'chart-list';

            catCharts.forEach(chart => {
                const item = document.createElement('div');
                item.className = 'chart-item';
                item.addEventListener('click', () => this.openChart(chart));

                const icon = document.createElement('span');
                icon.className = 'chart-icon';
                icon.textContent = chart.icon;

                const info = document.createElement('div');
                info.className = 'chart-info';

                const name = document.createElement('div');
                name.className = 'chart-name';
                name.textContent = chart.name;

                const type = document.createElement('div');
                type.className = 'chart-type';
                type.textContent = chart.type;

                info.appendChild(name);
                info.appendChild(type);

                const action = document.createElement('button');
                action.className = 'chart-action';
                action.textContent = '↗';
                action.title = 'Open in new tab';

                item.appendChild(icon);
                item.appendChild(info);
                item.appendChild(action);
                list.appendChild(item);
            });

            category.appendChild(list);
            this.content.appendChild(category);
        });
    }

    openChart(chart) {
        window.open(chart.url, '_blank');
    }

    showLoading() {
        this.content.replaceChildren();

        const loading = document.createElement('div');
        loading.className = 'loading';

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.textContent = '⏳';

        const text = document.createElement('div');
        text.textContent = 'Searching charts...';
        text.style.marginTop = '12px';
        text.style.color = '#888';

        loading.appendChild(spinner);
        loading.appendChild(text);
        this.content.appendChild(loading);
    }

    showError(message) {
        this.content.replaceChildren();

        const error = document.createElement('div');
        error.className = 'error-message';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '⚠️';

        const text = document.createElement('div');
        text.textContent = message;

        error.appendChild(icon);
        error.appendChild(text);
        this.content.appendChild(error);
    }

    addToRecent(airport) {
        this.recentAirports = this.recentAirports.filter(a => a !== airport);
        this.recentAirports.unshift(airport);
        this.recentAirports = this.recentAirports.slice(0, 5);
        this.saveState();
        this.renderRecent();
    }

    renderRecent() {
        this.recentList.replaceChildren();

        this.recentAirports.forEach(airport => {
            const btn = document.createElement('button');
            btn.className = 'recent-btn';
            btn.textContent = airport;
            btn.addEventListener('click', () => {
                this.airportInput.value = airport;
                this.searchCharts(airport);
            });
            this.recentList.appendChild(btn);
        });
    }

    refresh() {
        if (this.currentAirport) {
            this.searchCharts(this.currentAirport);
        }
    }

    saveState() {
        try {
            localStorage.setItem('charts-glass-state', JSON.stringify({
                recentAirports: this.recentAirports,
                source: this.currentSource
            }));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveState',
                    glass: 'charts-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('charts-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.recentAirports = state.recentAirports || [];
                if (state.source) {
                    this.currentSource = state.source;
                    this.sourceTabs.querySelectorAll('.tab').forEach(tab => {
                        tab.classList.toggle('active', tab.dataset.source === state.source);
                    });
                }
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadState',
                    glass: 'charts-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    destroy() {
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.chartsGlass = new ChartsGlass();
    window.addEventListener('beforeunload', () => window.chartsGlass?.destroy());
});
