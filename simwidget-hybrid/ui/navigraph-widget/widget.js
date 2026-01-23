/**
 * Navigraph Charts Widget - SimWidget
 * Airport charts viewer (requires Navigraph subscription)
 * API: https://developers.navigraph.com/docs/charts/
 *
 * Note: Full implementation requires OAuth setup with Navigraph.
 * This prototype shows the UI and uses demo data.
 */

class NavigraphWidget {
    constructor() {
        this.isAuthenticated = false;
        this.currentAirport = null;
        this.charts = [];
        this.currentFilter = 'all';
        this.zoomLevel = 1;

        this.initElements();
        this.initEvents();
        this.checkAuth();
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
    }

    checkAuth() {
        const token = localStorage.getItem('navigraph-token');
        if (token) {
            this.isAuthenticated = true;
            this.authNotice.style.display = 'none';
        }
    }

    connectNavigraph() {
        // In production, this would initiate OAuth flow
        // For demo, we'll simulate authentication
        this.showAuthDialog();
    }

    showAuthDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'auth-dialog';
        dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:200;';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--widget-bg,#1a1a2e);padding:24px;border-radius:12px;max-width:320px;text-align:center;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:16px;font-weight:600;color:white;margin-bottom:16px;';
        title.textContent = 'Connect Navigraph Account';

        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;color:#888;margin-bottom:20px;line-height:1.5;';
        info.textContent = 'OAuth authentication with Navigraph is required. This would redirect to navigraph.com for login.';

        const demoBtn = document.createElement('button');
        demoBtn.style.cssText = 'width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:10px;';
        demoBtn.textContent = 'Use Demo Mode';
        demoBtn.addEventListener('click', () => {
            this.enableDemoMode();
            dialog.remove();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = 'width:100%;padding:12px;background:transparent;color:#888;border:1px solid #333;border-radius:6px;cursor:pointer;';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => dialog.remove());

        const note = document.createElement('div');
        note.style.cssText = 'font-size:10px;color:#666;margin-top:16px;';
        note.textContent = 'Full integration requires API access from dev@navigraph.com';

        box.appendChild(title);
        box.appendChild(info);
        box.appendChild(demoBtn);
        box.appendChild(cancelBtn);
        box.appendChild(note);
        dialog.appendChild(box);
        document.body.appendChild(dialog);
    }

    enableDemoMode() {
        this.isAuthenticated = true;
        localStorage.setItem('navigraph-token', 'demo');
        this.authNotice.style.display = 'none';
        this.showMessage('Demo mode enabled. Try NZWN or YBBN for free preview.');
    }

    async searchAirport() {
        const icao = this.airportInput.value.toUpperCase().trim();

        if (!icao || icao.length < 3) {
            this.showError('Enter valid ICAO code');
            return;
        }

        if (!this.isAuthenticated) {
            this.showError('Please connect your Navigraph account first');
            return;
        }

        this.showLoading();

        try {
            // In production, this would call Navigraph API
            // For demo, we use mock data
            const data = await this.fetchAirportData(icao);
            this.currentAirport = data;
            this.charts = data.charts;
            this.renderAirport(data);
            this.renderCharts();

        } catch (error) {
            this.showError(error.message || 'Airport not found');
        }
    }

    async fetchAirportData(icao) {
        // Demo data for free preview airports
        const demoAirports = {
            'NZWN': {
                icao: 'NZWN',
                name: 'Wellington International',
                city: 'Wellington',
                country: 'New Zealand',
                elevation: '41 ft',
                runways: '16/34',
                charts: this.generateDemoCharts('NZWN')
            },
            'YBBN': {
                icao: 'YBBN',
                name: 'Brisbane Airport',
                city: 'Brisbane',
                country: 'Australia',
                elevation: '13 ft',
                runways: '01/19, 14/32',
                charts: this.generateDemoCharts('YBBN')
            }
        };

        // Simulate API delay
        await new Promise(r => setTimeout(r, 500));

        if (demoAirports[icao]) {
            return demoAirports[icao];
        }

        // For other airports, generate placeholder data
        return {
            icao: icao,
            name: icao + ' Airport',
            city: 'Unknown',
            country: 'Unknown',
            elevation: 'N/A',
            runways: 'N/A',
            charts: this.generatePlaceholderCharts(icao)
        };
    }

    generateDemoCharts(icao) {
        return [
            { id: 1, name: 'Airport Diagram', type: 'apt', category: 'Airport' },
            { id: 2, name: 'Parking/Docking', type: 'apt', category: 'Airport' },
            { id: 3, name: 'SID RWY 16', type: 'sid', category: 'Departure' },
            { id: 4, name: 'SID RWY 34', type: 'sid', category: 'Departure' },
            { id: 5, name: 'RNAV STAR RWY 16', type: 'star', category: 'Arrival' },
            { id: 6, name: 'STAR RWY 34', type: 'star', category: 'Arrival' },
            { id: 7, name: 'ILS RWY 16', type: 'app', category: 'Approach' },
            { id: 8, name: 'ILS RWY 34', type: 'app', category: 'Approach' },
            { id: 9, name: 'RNAV (GPS) RWY 16', type: 'app', category: 'Approach' },
            { id: 10, name: 'VOR RWY 34', type: 'app', category: 'Approach' }
        ];
    }

    generatePlaceholderCharts(icao) {
        return [
            { id: 1, name: 'Airport Diagram', type: 'apt', category: 'Airport', placeholder: true },
            { id: 2, name: 'SID (Various)', type: 'sid', category: 'Departure', placeholder: true },
            { id: 3, name: 'STAR (Various)', type: 'star', category: 'Arrival', placeholder: true },
            { id: 4, name: 'ILS Approach', type: 'app', category: 'Approach', placeholder: true }
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

            item.addEventListener('click', () => this.openChart(chart));

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
        this.chartTitle.textContent = chart.name;
        this.zoomLevel = 1;
        this.chartImage.style.transform = 'scale(1)';

        if (chart.placeholder) {
            this.chartImage.src = '';
            this.chartImage.alt = 'Navigraph subscription required';
            this.showChartPlaceholder();
        } else {
            // In production, this would load the actual chart image
            this.showChartPlaceholder(chart.name);
        }

        this.chartViewer.style.display = 'flex';
    }

    showChartPlaceholder(chartName) {
        const viewerContent = document.getElementById('viewer-content');
        viewerContent.replaceChildren();

        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'text-align:center;color:#888;';

        const icon = document.createElement('div');
        icon.style.cssText = 'font-size:60px;margin-bottom:16px;';
        icon.textContent = '\ud83d\uddfa\ufe0f';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:16px;margin-bottom:8px;color:white;';
        title.textContent = chartName || 'Chart Preview';

        const text = document.createElement('div');
        text.style.cssText = 'font-size:12px;line-height:1.5;';
        text.textContent = 'Full Jeppesen charts require Navigraph Ultimate subscription and API integration.';

        const link = document.createElement('a');
        link.href = 'https://navigraph.com/products/subscriptions';
        link.target = '_blank';
        link.style.cssText = 'display:inline-block;margin-top:16px;color:#667eea;text-decoration:none;';
        link.textContent = 'Learn more at navigraph.com \u2192';

        placeholder.appendChild(icon);
        placeholder.appendChild(title);
        placeholder.appendChild(text);
        placeholder.appendChild(link);
        viewerContent.appendChild(placeholder);
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.navigraphWidget = new NavigraphWidget();
});
