/**
 * Charts pane - SimGlass v2.0.0
 * Airport charts viewer using FREE sources:
 * - FAA DTPP for US airports (no login required)
 * - SkyVector for worldwide charts
 * - ChartFox for community charts
 *
 * No Navigraph subscription needed!
 */

class NavigraphPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'navigraph-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // HTTP only, no WebSocket
        });

        this.isAuthenticated = true; // No auth needed for free charts
        this.currentAirport = null;
        this.charts = [];
        this.currentFilter = 'all';
        this.zoomLevel = 1;

        // Free chart sources
        this.chartSources = {
            faa: 'https://aeronav.faa.gov/d-tpp/', // FAA DTPP
            skyvector: 'https://skyvector.com/airport/', // SkyVector
            chartfox: 'https://chartfox.org/' // ChartFox
        };

        this.initElements();
        this.initEvents();
        this.initCompactMode();
        this.showReadyMessage();
    }

    initElements() {
        this.airportInput = document.getElementById('airport-input');
        this.searchBtn = document.getElementById('btn-search');
        this.refreshBtn = document.getElementById('btn-refresh');
        this.chartTabs = document.getElementById('chart-tabs');
        this.content = document.getElementById('charts-content');
        this.authNotice = document.getElementById('auth-notice');
        this.connectBtn = document.getElementById('btn-connect');

        this.chartViewer = document.getElementById('chart-viewer');
        this.backBtn = document.getElementById('btn-back');
        this.chartTitle = document.getElementById('chart-title');
        this.chartImage = document.getElementById('chart-image');
        this.zoomInBtn = document.getElementById('btn-zoom-in');
        this.zoomOutBtn = document.getElementById('btn-zoom-out');

        this.compactToggle = document.getElementById('compact-toggle');
        this.widgetContainer = document.querySelector('.widget-container');
    }

    initEvents() {
        this.searchBtn.addEventListener('click', () => this.searchAirport());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        this.connectBtn.addEventListener('click', () => this.connectNavigraph());

        this.airportInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchAirport();
        });

        this.airportInput.addEventListener('input', () => {
            this.airportInput.value = this.airportInput.value.toUpperCase();
        });

        this.chartTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.chartTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.type;
                this.renderCharts();
            });
        });

        this.backBtn.addEventListener('click', () => this.closeViewer());
        this.zoomInBtn.addEventListener('click', () => this.zoom(0.2));
        this.zoomOutBtn.addEventListener('click', () => this.zoom(-0.2));

        this.compactToggle.addEventListener('click', () => this.toggleCompact());
    }

    showReadyMessage() {
        // Show the ready notice (no auth needed)
        if (this.authNotice) {
            this.authNotice.style.display = 'block';
        }
    }

    connectNavigraph() {
        // Show info about free sources
        this.showSourcesDialog();
    }

    showSourcesDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'auth-dialog';
        dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:200;';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--glass-bg,#1a1a2e);padding:24px;border-radius:12px;max-width:320px;text-align:center;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:16px;font-weight:600;color:white;margin-bottom:16px;';
        title.textContent = 'Free Chart Sources';

        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;color:#888;margin-bottom:20px;line-height:1.8;text-align:left;';

        const sources = [
            { label: 'US Airports:', value: 'FAA DTPP (free)', color: '#22c55e' },
            { label: 'Worldwide:', value: 'SkyVector (free)', color: '#3b82f6' },
            { label: 'Community:', value: 'ChartFox (free)', color: '#f59e0b' },
            { label: 'Premium:', value: 'Navigraph (subscription)', color: '#667eea' }
        ];

        sources.forEach(src => {
            const line = document.createElement('div');
            const labelSpan = document.createElement('b');
            labelSpan.style.color = src.color;
            labelSpan.textContent = src.label + ' ';
            line.appendChild(labelSpan);
            line.appendChild(document.createTextNode(src.value));
            info.appendChild(line);
        });

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;';
        closeBtn.textContent = 'Got It';
        closeBtn.addEventListener('click', () => dialog.remove());

        box.appendChild(title);
        box.appendChild(info);
        box.appendChild(closeBtn);
        dialog.appendChild(box);
        document.body.appendChild(dialog);
    }

    async searchAirport() {
        const icao = this.airportInput.value.toUpperCase().trim();

        if (!icao || icao.length < 3) {
            this.showError('Enter valid ICAO code');
            return;
        }

        this.showLoading();

        try {
            const data = await this.fetchAirportData(icao);
            this.currentAirport = data;
            this.charts = data.charts;
            this.renderAirport(data);
            this.renderCharts();
            this.updateCompact();

        } catch (error) {
            this.showError(error.message || 'Airport not found');
        }
    }

    async fetchAirportData(icao) {
        // Try to get real airport info from the server
        let name = icao + ' Airport';
        let elevation = '--';
        let runways = '--';

        try {
            const res = await fetch(`http://${window.location.host}/api/airport/${icao}`);
            if (res.ok) {
                const data = await res.json();
                if (data.name) name = data.name;
                if (data.elevation) elevation = data.elevation + 'ft';
                if (data.runways) runways = data.runways;
            }
        } catch (e) {
            // Fallback to known airports lookup
            const known = this.getKnownAirport(icao);
            if (known) {
                name = known.name;
                elevation = known.elevation;
                runways = known.runways;
            }
        }

        const isUSAirport = icao.startsWith('K') || icao.startsWith('P');
        const chartSource = isUSAirport ? 'FAA DTPP' : 'SkyVector';

        const charts = isUSAirport
            ? this.generateFAACharts(icao)
            : this.generateSkyVectorCharts(icao);

        return {
            icao: icao,
            name: name,
            elevation: elevation,
            runways: runways,
            source: chartSource,
            charts: charts
        };
    }

    getKnownAirport(icao) {
        const airports = {
            'KJFK': { name: 'John F Kennedy Intl', elevation: '13ft', runways: '4L/22R, 4R/22L, 13L/31R, 13R/31L' },
            'KLAX': { name: 'Los Angeles Intl', elevation: '128ft', runways: '6L/24R, 6R/24L, 7L/25R, 7R/25L' },
            'KORD': { name: 'Chicago O\'Hare Intl', elevation: '672ft', runways: '9C/27C, 9L/27R, 9R/27L, 10L/28R, 10C/28C, 10R/28L, 14L/32R, 14R/32L' },
            'KATL': { name: 'Hartsfield-Jackson Atlanta Intl', elevation: '1026ft', runways: '8L/26R, 8R/26L, 9L/27R, 9R/27L, 10/28' },
            'KSFO': { name: 'San Francisco Intl', elevation: '13ft', runways: '1L/19R, 1R/19L, 10L/28R, 10R/28L' },
            'EGLL': { name: 'London Heathrow', elevation: '83ft', runways: '09L/27R, 09R/27L' },
            'LFPG': { name: 'Paris Charles de Gaulle', elevation: '392ft', runways: '08L/26R, 08R/26L, 09L/27R, 09R/27L' },
            'EDDF': { name: 'Frankfurt Main', elevation: '364ft', runways: '07L/25R, 07C/25C, 07R/25L, 18/36' },
            'NZWN': { name: 'Wellington Intl', elevation: '41ft', runways: '16/34' },
            'YBBN': { name: 'Brisbane Intl', elevation: '13ft', runways: '01L/19R, 01R/19L' },
            'RJTT': { name: 'Tokyo Haneda', elevation: '35ft', runways: '04/22, 16L/34R, 16R/34L' },
            'OMDB': { name: 'Dubai Intl', elevation: '62ft', runways: '12L/30R, 12R/30L' },
            'VHHH': { name: 'Hong Kong Intl', elevation: '28ft', runways: '07L/25R, 07R/25L' },
            'WSSS': { name: 'Singapore Changi', elevation: '22ft', runways: '02L/20R, 02C/20C, 02R/20L' },
            'CYYZ': { name: 'Toronto Pearson Intl', elevation: '569ft', runways: '05/23, 06L/24R, 06R/24L, 15L/33R, 15R/33L' }
        };
        return airports[icao] || null;
    }

    generateFAACharts(icao) {
        // FAA DTPP chart types for US airports
        return [
            { id: 1, name: 'Airport Diagram', type: 'apt', category: 'Airport', url: 'faa', icao: icao },
            { id: 2, name: 'Takeoff Minimums', type: 'apt', category: 'Airport', url: 'faa', icao: icao },
            { id: 3, name: 'SID - All Departures', type: 'sid', category: 'Departure', url: 'faa', icao: icao },
            { id: 4, name: 'STAR - All Arrivals', type: 'star', category: 'Arrival', url: 'faa', icao: icao },
            { id: 5, name: 'ILS Approaches', type: 'app', category: 'Approach', url: 'faa', icao: icao },
            { id: 6, name: 'RNAV (GPS) Approaches', type: 'app', category: 'Approach', url: 'faa', icao: icao },
            { id: 7, name: 'VOR/LOC Approaches', type: 'app', category: 'Approach', url: 'faa', icao: icao },
            { id: 8, name: 'Open in SkyVector', type: 'link', category: 'External', url: 'skyvector', icao: icao }
        ];
    }

    generateSkyVectorCharts(icao) {
        // SkyVector links for international airports
        return [
            { id: 1, name: 'Airport Info', type: 'apt', category: 'Airport', url: 'skyvector', icao: icao },
            { id: 2, name: 'Procedures', type: 'app', category: 'Approach', url: 'skyvector', icao: icao },
            { id: 3, name: 'Open in ChartFox', type: 'link', category: 'External', url: 'chartfox', icao: icao },
            { id: 4, name: 'Open in SkyVector', type: 'link', category: 'External', url: 'skyvector', icao: icao }
        ];
    }

    renderAirport(data) {
        this.content.replaceChildren();

        const header = document.createElement('div');
        header.className = 'airport-header';

        const icaoEl = document.createElement('div');
        icaoEl.className = 'airport-icao';
        icaoEl.textContent = data.icao;

        const nameEl = document.createElement('div');
        nameEl.className = 'airport-name';
        nameEl.textContent = data.name;

        const infoRow = document.createElement('div');
        infoRow.className = 'airport-info-row';

        const elev = document.createElement('span');
        elev.textContent = 'Elev: ' + data.elevation;

        const rwy = document.createElement('span');
        rwy.textContent = 'RWY: ' + data.runways;

        infoRow.appendChild(elev);
        infoRow.appendChild(rwy);

        header.appendChild(icaoEl);
        header.appendChild(nameEl);
        header.appendChild(infoRow);

        this.content.appendChild(header);

        const listContainer = document.createElement('div');
        listContainer.className = 'charts-list';
        listContainer.id = 'charts-list';
        this.content.appendChild(listContainer);
    }

    renderCharts() {
        const listContainer = document.getElementById('charts-list');
        if (!listContainer) return;

        listContainer.replaceChildren();

        const filtered = this.currentFilter === 'all'
            ? this.charts
            : this.charts.filter(c => c.type === this.currentFilter);

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;padding:20px;color:#888;';
            empty.textContent = 'No charts in this category';
            listContainer.appendChild(empty);
            return;
        }

        filtered.forEach(chart => {
            const item = document.createElement('div');
            item.className = 'chart-item';

            const icon = document.createElement('div');
            icon.className = 'chart-icon';
            icon.textContent = this.getChartIcon(chart.type);

            const info = document.createElement('div');
            info.className = 'chart-info';

            const name = document.createElement('div');
            name.className = 'chart-name';
            name.textContent = chart.name;

            const type = document.createElement('div');
            type.className = 'chart-type';
            type.textContent = chart.category;

            info.appendChild(name);
            info.appendChild(type);

            const arrow = document.createElement('span');
            arrow.className = 'chart-arrow';
            arrow.textContent = '\u203a';

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(arrow);

            item.addEventListener('click', () => {
                if (chart.type === 'link') {
                    this.openChart(chart);
                } else {
                    this.showChartInfo(chart);
                }
            });

            listContainer.appendChild(item);
        });
    }

    getChartIcon(type) {
        const icons = {
            'apt': '\ud83d\uddfa\ufe0f',
            'sid': '\u2197\ufe0f',
            'star': '\u2198\ufe0f',
            'app': '\u2708\ufe0f'
        };
        return icons[type] || '\ud83d\udcc4';
    }

    openChart(chart) {
        // Build URL based on source
        let url = '';
        const icao = chart.icao;

        switch (chart.url) {
            case 'faa':
                // FAA DTPP - opens search page for the airport
                url = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=current&ident=' + icao;
                break;
            case 'skyvector':
                // SkyVector airport page
                url = 'https://skyvector.com/airport/' + icao;
                break;
            case 'chartfox':
                // ChartFox - community charts
                url = 'https://chartfox.org/' + icao;
                break;
            default:
                url = 'https://skyvector.com/airport/' + icao;
        }

        // Open in new tab
        window.open(url, '_blank');
        this.showMessage('Opening ' + chart.name + ' for ' + icao);
    }

    showChartInfo(chart) {
        this.chartTitle.textContent = chart.name;
        this.zoomLevel = 1;

        const viewerContent = document.getElementById('viewer-content');
        viewerContent.replaceChildren();

        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'text-align:center;color:#888;padding:40px;';

        const icon = document.createElement('div');
        icon.style.cssText = 'font-size:60px;margin-bottom:16px;';
        icon.textContent = '\ud83d\uddfa\ufe0f';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:16px;margin-bottom:8px;color:white;';
        title.textContent = chart.name;

        const text = document.createElement('div');
        text.style.cssText = 'font-size:12px;line-height:1.5;margin-bottom:16px;';
        text.textContent = 'Charts open in external browser for best viewing experience.';

        const openBtn = document.createElement('button');
        openBtn.style.cssText = 'padding:12px 24px;background:#667eea;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;';
        openBtn.textContent = 'Open Chart \u2192';
        openBtn.addEventListener('click', () => this.openChart(chart));

        placeholder.appendChild(icon);
        placeholder.appendChild(title);
        placeholder.appendChild(text);
        placeholder.appendChild(openBtn);
        viewerContent.appendChild(placeholder);

        this.chartViewer.style.display = 'flex';
    }

    closeViewer() {
        this.chartViewer.style.display = 'none';
    }

    zoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + delta));
        this.chartImage.style.transform = 'scale(' + this.zoomLevel + ')';
    }

    showLoading() {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'loading';

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.textContent = '\ud83d\udd04';

        const text = document.createElement('div');
        text.textContent = 'Loading charts...';

        div.appendChild(spinner);
        div.appendChild(text);
        this.content.appendChild(div);
    }

    showError(message) {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'error-message';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '\u26a0\ufe0f';

        const text = document.createElement('div');
        text.textContent = message;

        div.appendChild(icon);
        div.appendChild(text);
        this.content.appendChild(div);
    }

    showMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#667eea;color:white;padding:10px 20px;border-radius:6px;font-size:13px;z-index:1000;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    refresh() {
        if (this.currentAirport) {
            this.searchAirport();
        }
    }

    initCompactMode() {
        const isCompact = localStorage.getItem('navigraph-widget-compact') === 'true';
        if (isCompact) {
            this.widgetContainer.classList.add('compact');
            this.compactToggle.classList.add('active');
        }
        this.updateCompact();
    }

    toggleCompact() {
        const isCompact = this.widgetContainer.classList.toggle('compact');
        this.compactToggle.classList.toggle('active');
        localStorage.setItem('navigraph-widget-compact', isCompact);
        this.updateCompact();
    }

    updateCompact() {
        if (!this.widgetContainer.classList.contains('compact')) return;

        const icao = this.currentAirport ? this.currentAirport.icao : '--';
        const elev = this.currentAirport ? this.currentAirport.elevation : '--';
        const rwy = this.currentAirport ? this.currentAirport.runways.split(',')[0] : '--';
        const charts = this.charts.length > 0 ? this.charts.length.toString() : '--';
        const source = this.currentAirport ? this.currentAirport.source : '--';
        const status = this.currentAirport ? 'Loaded' : 'Ready';

        document.getElementById('compact-icao').textContent = icao;
        document.getElementById('compact-elev').textContent = elev;
        document.getElementById('compact-rwy').textContent = rwy;
        document.getElementById('compact-charts').textContent = charts;
        document.getElementById('compact-source').textContent = source;
        document.getElementById('compact-status').textContent = status;
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.NavigraphPane = new NavigraphPane();
    window.addEventListener('beforeunload', () => window.NavigraphPane?.destroy());
});
