/**
 * METAR Widget - SimGlass
 * Real-time aviation weather from aviationweather.gov
 */

class MetarWidget {
    constructor() {
        this.currentStation = '';
        this.recentStations = [];
        this.autoRefreshInterval = null;
        this.autoRefreshEnabled = false;

        this.loadState();
        this.initControls();
        this.renderRecentStations();

        // Load last station if exists
        if (this.currentStation) {
            this.fetchMetar(this.currentStation);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('metar-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.recentStations = state.recentStations || [];
                this.currentStation = state.currentStation || '';
                this.autoRefreshEnabled = state.autoRefreshEnabled || false;
            }
        } catch (e) {
            console.error('[METAR] Failed to load state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('metar-widget-state', JSON.stringify({
                recentStations: this.recentStations,
                currentStation: this.currentStation,
                autoRefreshEnabled: this.autoRefreshEnabled
            }));
        } catch (e) {
            console.error('[METAR] Failed to save state:', e);
        }
    }

    initControls() {
        const input = document.getElementById('airport-code');
        const fetchBtn = document.getElementById('btn-fetch');
        const refreshBtn = document.getElementById('btn-refresh');
        const autoRefreshCheckbox = document.getElementById('auto-refresh');

        // Fetch on button click
        fetchBtn.addEventListener('click', () => {
            const code = input.value.trim().toUpperCase();
            if (code) this.fetchMetar(code);
        });

        // Fetch on Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = input.value.trim().toUpperCase();
                if (code) this.fetchMetar(code);
            }
        });

        // Refresh current
        refreshBtn.addEventListener('click', () => {
            if (this.currentStation) {
                this.fetchMetar(this.currentStation);
            }
        });

        // Auto-refresh toggle
        autoRefreshCheckbox.checked = this.autoRefreshEnabled;
        autoRefreshCheckbox.addEventListener('change', () => {
            this.autoRefreshEnabled = autoRefreshCheckbox.checked;
            this.saveState();
            this.setupAutoRefresh();
        });

        if (this.autoRefreshEnabled) {
            this.setupAutoRefresh();
        }
    }

    setupAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }

        if (this.autoRefreshEnabled && this.currentStation) {
            this.autoRefreshInterval = setInterval(() => {
                this.fetchMetar(this.currentStation);
            }, 5 * 60 * 1000); // 5 minutes
        }
    }

    addToRecent(code) {
        // Remove if exists
        this.recentStations = this.recentStations.filter(s => s !== code);
        // Add to front
        this.recentStations.unshift(code);
        // Keep max 6
        this.recentStations = this.recentStations.slice(0, 6);
        this.saveState();
        this.renderRecentStations();
    }

    renderRecentStations() {
        const container = document.getElementById('recent-airports');
        container.replaceChildren();

        this.recentStations.forEach(code => {
            const btn = document.createElement('button');
            btn.className = 'recent-btn';
            btn.textContent = code;
            btn.addEventListener('click', () => {
                document.getElementById('airport-code').value = code;
                this.fetchMetar(code);
            });
            container.appendChild(btn);
        });
    }

    async fetchMetar(code) {
        this.currentStation = code;
        this.addToRecent(code);
        this.showLoading();

        try {
            // Use aviationweather.gov API
            const url = `https://aviationweather.gov/api/data/metar?ids=${code}&format=json`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch METAR');
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                throw new Error('No METAR data found for ' + code);
            }

            this.renderMetar(data[0]);
            this.setupAutoRefresh();

        } catch (error) {
            this.showError(error.message);
        }
    }

    showLoading() {
        const content = document.getElementById('metar-content');
        content.replaceChildren();

        const loading = document.createElement('div');
        loading.className = 'metar-loading';

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';

        const text = document.createElement('div');
        text.textContent = 'Fetching METAR...';
        text.style.color = 'var(--widget-text-muted)';

        loading.appendChild(spinner);
        loading.appendChild(text);
        content.appendChild(loading);
    }

    showError(message) {
        const content = document.getElementById('metar-content');
        content.replaceChildren();

        const error = document.createElement('div');
        error.className = 'metar-error';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '⚠️';

        const text = document.createElement('div');
        text.className = 'error-text';
        text.textContent = message;

        error.appendChild(icon);
        error.appendChild(text);
        content.appendChild(error);
    }

    renderMetar(metar) {
        const content = document.getElementById('metar-content');
        content.replaceChildren();

        // Flight category
        const category = this.getFlightCategory(metar);
        const categoryEl = document.createElement('div');
        categoryEl.className = 'flight-category ' + category.toLowerCase();
        categoryEl.textContent = category;
        content.appendChild(categoryEl);

        // Station header
        const header = document.createElement('div');
        header.className = 'station-header';

        const stationInfo = document.createElement('div');
        const stationCode = document.createElement('div');
        stationCode.className = 'station-code';
        stationCode.textContent = metar.icaoId || metar.stationId || this.currentStation;
        stationInfo.appendChild(stationCode);

        if (metar.name) {
            const stationName = document.createElement('div');
            stationName.className = 'station-name';
            stationName.textContent = metar.name;
            stationInfo.appendChild(stationName);
        }

        const obsTime = document.createElement('div');
        obsTime.className = 'obs-time';
        const obsDate = new Date(metar.obsTime || metar.reportTime);
        obsTime.textContent = 'Observed: ' + obsDate.toUTCString().slice(0, -4) + 'Z';

        header.appendChild(stationInfo);
        header.appendChild(obsTime);
        content.appendChild(header);

        // Weather grid
        const grid = document.createElement('div');
        grid.className = 'weather-grid';

        // Wind
        grid.appendChild(this.createWeatherItem('Wind', this.formatWind(metar), 'wind'));

        // Visibility
        const visValue = metar.visib !== undefined ? metar.visib : (metar.visibility || 'N/A');
        let visClass = 'vis';
        if (visValue !== 'N/A') {
            if (visValue < 3) visClass += ' very-low';
            else if (visValue < 5) visClass += ' low';
        }
        grid.appendChild(this.createWeatherItem('Visibility', visValue + ' SM', visClass));

        // Temperature
        const temp = metar.temp !== undefined ? Math.round(metar.temp) : 'N/A';
        grid.appendChild(this.createWeatherItem('Temperature', temp + '°C', ''));

        // Dewpoint
        const dewpoint = metar.dewp !== undefined ? Math.round(metar.dewp) : 'N/A';
        grid.appendChild(this.createWeatherItem('Dewpoint', dewpoint + '°C', ''));

        // Altimeter
        const altim = metar.altim !== undefined ? metar.altim.toFixed(2) : 'N/A';
        grid.appendChild(this.createWeatherItem('Altimeter', altim + ' inHg', ''));

        // Humidity
        if (metar.temp !== undefined && metar.dewp !== undefined) {
            const humidity = this.calcHumidity(metar.temp, metar.dewp);
            grid.appendChild(this.createWeatherItem('Humidity', humidity + '%', ''));
        }

        content.appendChild(grid);

        // Weather conditions
        if (metar.wxString) {
            const condSection = document.createElement('div');
            condSection.className = 'conditions-section';

            const condTitle = document.createElement('div');
            condTitle.className = 'conditions-title';
            condTitle.textContent = 'Conditions';
            condSection.appendChild(condTitle);

            const condList = document.createElement('div');
            condList.className = 'conditions-list';

            const conditions = this.parseWeatherCodes(metar.wxString);
            conditions.forEach(cond => {
                const badge = document.createElement('span');
                badge.className = 'condition-badge ' + cond.type;
                badge.textContent = cond.text;
                condList.appendChild(badge);
            });

            condSection.appendChild(condList);
            content.appendChild(condSection);
        }

        // Cloud layers
        if (metar.clouds && metar.clouds.length > 0) {
            const cloudSection = document.createElement('div');
            cloudSection.className = 'clouds-section';

            const cloudTitle = document.createElement('div');
            cloudTitle.className = 'conditions-title';
            cloudTitle.textContent = 'Cloud Layers';
            cloudSection.appendChild(cloudTitle);

            const cloudLayers = document.createElement('div');
            cloudLayers.className = 'cloud-layers';

            metar.clouds.forEach(cloud => {
                const layer = document.createElement('div');
                layer.className = 'cloud-layer';

                const cover = document.createElement('span');
                cover.className = 'cloud-cover';
                cover.textContent = this.cloudCoverName(cloud.cover);

                const alt = document.createElement('span');
                alt.className = 'cloud-alt';
                alt.textContent = (cloud.base * 100) + ' ft AGL';

                layer.appendChild(cover);
                layer.appendChild(alt);
                cloudLayers.appendChild(layer);
            });

            cloudSection.appendChild(cloudLayers);
            content.appendChild(cloudSection);
        }

        // Raw METAR
        const rawSection = document.createElement('div');
        const rawLabel = document.createElement('div');
        rawLabel.className = 'raw-metar-label';
        rawLabel.textContent = 'Raw METAR';
        rawSection.appendChild(rawLabel);

        const rawMetar = document.createElement('div');
        rawMetar.className = 'raw-metar';
        rawMetar.textContent = metar.rawOb || metar.rawMETAR || 'N/A';
        rawSection.appendChild(rawMetar);

        content.appendChild(rawSection);
    }

    createWeatherItem(label, value, className) {
        const item = document.createElement('div');
        item.className = 'weather-item';

        const labelEl = document.createElement('div');
        labelEl.className = 'weather-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'weather-value ' + className;
        valueEl.textContent = value;

        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    }

    formatWind(metar) {
        if (metar.wdir === undefined && metar.wspd === undefined) {
            return 'Calm';
        }

        const dir = metar.wdir !== undefined ? metar.wdir.toString().padStart(3, '0') : 'VRB';
        const speed = metar.wspd !== undefined ? metar.wspd : 0;
        const gust = metar.wgst;

        let wind = dir + '° @ ' + speed + ' kt';
        if (gust) {
            wind += ' G' + gust;
        }
        return wind;
    }

    getFlightCategory(metar) {
        const vis = metar.visib !== undefined ? metar.visib : 10;
        let ceiling = 99999;

        if (metar.clouds) {
            for (const cloud of metar.clouds) {
                if (cloud.cover === 'BKN' || cloud.cover === 'OVC') {
                    ceiling = Math.min(ceiling, cloud.base * 100);
                }
            }
        }

        if (vis < 1 || ceiling < 500) return 'LIFR';
        if (vis < 3 || ceiling < 1000) return 'IFR';
        if (vis < 5 || ceiling < 3000) return 'MVFR';
        return 'VFR';
    }

    cloudCoverName(code) {
        const names = {
            'SKC': 'Sky Clear',
            'CLR': 'Clear',
            'FEW': 'Few (1-2/8)',
            'SCT': 'Scattered (3-4/8)',
            'BKN': 'Broken (5-7/8)',
            'OVC': 'Overcast (8/8)',
            'VV': 'Vertical Visibility'
        };
        return names[code] || code;
    }

    parseWeatherCodes(wxString) {
        const conditions = [];
        const codes = {
            'RA': { text: 'Rain', type: 'precip' },
            'SN': { text: 'Snow', type: 'precip' },
            'DZ': { text: 'Drizzle', type: 'precip' },
            'SH': { text: 'Showers', type: 'precip' },
            'TS': { text: 'Thunderstorm', type: 'thunder' },
            'FG': { text: 'Fog', type: 'fog' },
            'BR': { text: 'Mist', type: 'fog' },
            'HZ': { text: 'Haze', type: 'fog' },
            'FU': { text: 'Smoke', type: 'fog' },
            'GR': { text: 'Hail', type: 'precip' },
            'GS': { text: 'Small Hail', type: 'precip' },
            'PL': { text: 'Ice Pellets', type: 'precip' },
            'IC': { text: 'Ice Crystals', type: 'precip' },
            'FZ': { text: 'Freezing', type: 'precip' },
            'VA': { text: 'Volcanic Ash', type: 'fog' },
            'SQ': { text: 'Squalls', type: 'thunder' }
        };

        for (const [code, info] of Object.entries(codes)) {
            if (wxString.includes(code)) {
                conditions.push(info);
            }
        }

        if (conditions.length === 0) {
            conditions.push({ text: wxString, type: '' });
        }

        return conditions;
    }

    calcHumidity(temp, dewpoint) {
        // Magnus formula approximation
        const a = 17.27;
        const b = 237.7;
        const alpha = (a * dewpoint) / (b + dewpoint);
        const beta = (a * temp) / (b + temp);
        const rh = 100 * Math.exp(alpha - beta);
        return Math.round(rh);
    }

    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.metarWidget = new MetarWidget();
    window.addEventListener('beforeunload', () => window.metarWidget?.destroy());
});
