/**
 * Weather Widget - SimWidget
 * METAR/TAF weather display for flight planning
 */

class WeatherWidget {
    constructor() {
        this.recentAirports = [];
        this.currentData = null;

        this.initElements();
        this.initEvents();
        this.loadState();
        this.renderRecent();
    }

    initElements() {
        this.airportInput = document.getElementById('airport-input');
        this.searchBtn = document.getElementById('btn-search');
        this.refreshBtn = document.getElementById('btn-refresh');
        this.content = document.getElementById('weather-content');
        this.recentList = document.getElementById('recent-list');
    }

    initEvents() {
        this.searchBtn.addEventListener('click', () => this.fetchWeather());
        this.refreshBtn.addEventListener('click', () => this.refresh());

        this.airportInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchWeather();
        });

        this.airportInput.addEventListener('input', () => {
            this.airportInput.value = this.airportInput.value.toUpperCase();
        });
    }

    async fetchWeather(icao) {
        const airport = (icao || this.airportInput.value).toUpperCase().trim();

        if (!airport || airport.length < 3) {
            this.showError('Enter valid ICAO code');
            return;
        }

        this.showLoading();
        this.refreshBtn.classList.add('spinning');

        try {
            // Use AVWX API (free tier available)
            const response = await fetch(
                'https://avwx.rest/api/metar/' + airport + '?options=info,translate',
                {
                    headers: {
                        'Authorization': 'DEMO'  // Public demo token
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Airport not found');
            }

            const data = await response.json();
            this.currentData = data;
            this.displayWeather(data);
            this.addToRecent(airport);

        } catch (error) {
            // Fallback: try parsing from aviationweather.gov
            try {
                await this.fetchFromAWC(airport);
            } catch (e) {
                this.showError('Could not fetch weather for ' + airport);
            }
        }

        this.refreshBtn.classList.remove('spinning');
    }

    async fetchFromAWC(icao) {
        // Aviation Weather Center doesn't have CORS, so we simulate with sample data
        // In production, this would go through a backend proxy
        this.showError('API unavailable - enter METAR manually or use backend proxy');
    }

    displayWeather(data) {
        const raw = data.raw || data.sanitized || 'N/A';
        const station = data.station || data.icao || this.airportInput.value.toUpperCase();

        // Parse weather data
        const wind = this.parseWind(data);
        const visibility = this.parseVisibility(data);
        const temp = this.parseTemp(data);
        const pressure = this.parsePressure(data);
        const category = this.getFlightCategory(data);
        const time = data.time ? data.time.dt : new Date().toISOString();

        // Build display using DOM methods
        this.content.replaceChildren();

        // Header
        const header = document.createElement('div');
        header.className = 'metar-header';

        const codeEl = document.createElement('div');
        codeEl.className = 'airport-code';
        codeEl.textContent = station;

        const timeEl = document.createElement('div');
        timeEl.className = 'metar-time';
        timeEl.textContent = new Date(time).toLocaleTimeString();

        header.appendChild(codeEl);
        header.appendChild(timeEl);
        this.content.appendChild(header);

        // Raw METAR
        const rawEl = document.createElement('div');
        rawEl.className = 'metar-raw';
        rawEl.textContent = raw;
        this.content.appendChild(rawEl);

        // Weather grid
        const grid = document.createElement('div');
        grid.className = 'weather-grid';

        grid.appendChild(this.createWeatherItem('Wind', wind.display, 'wind', wind.unit));
        grid.appendChild(this.createWeatherItem('Visibility', visibility.display, 'visibility', visibility.unit));
        grid.appendChild(this.createWeatherItem('Temperature', temp.display, 'temp', temp.unit));
        grid.appendChild(this.createWeatherItem('Pressure', pressure.display, 'pressure', pressure.unit));

        this.content.appendChild(grid);

        // Flight category
        const catEl = document.createElement('div');
        catEl.className = 'flight-category ' + category.toLowerCase();
        catEl.textContent = category + ' Flight Rules';
        this.content.appendChild(catEl);
    }

    createWeatherItem(label, value, className, unit) {
        const item = document.createElement('div');
        item.className = 'weather-item';

        const labelEl = document.createElement('div');
        labelEl.className = 'weather-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'weather-value ' + className;
        valueEl.textContent = value;

        if (unit) {
            const unitEl = document.createElement('span');
            unitEl.className = 'weather-unit';
            unitEl.textContent = ' ' + unit;
            valueEl.appendChild(unitEl);
        }

        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    }

    parseWind(data) {
        if (data.wind_direction && data.wind_speed) {
            const dir = data.wind_direction.value || 'VRB';
            const speed = data.wind_speed.value || 0;
            const gust = data.wind_gust ? data.wind_gust.value : null;
            let display = dir + '° @ ' + speed;
            if (gust) display += 'G' + gust;
            return { display, unit: 'kt' };
        }
        return { display: 'Calm', unit: '' };
    }

    parseVisibility(data) {
        if (data.visibility) {
            const vis = data.visibility.value || 10;
            const unit = data.units?.visibility || 'sm';
            return { display: vis, unit };
        }
        return { display: '10+', unit: 'sm' };
    }

    parseTemp(data) {
        if (data.temperature) {
            const temp = data.temperature.value;
            const dew = data.dewpoint ? data.dewpoint.value : null;
            let display = temp + '°';
            if (dew !== null) display += ' / ' + dew + '°';
            return { display, unit: 'C' };
        }
        return { display: '--', unit: 'C' };
    }

    parsePressure(data) {
        if (data.altimeter) {
            const alt = data.altimeter.value;
            return { display: alt.toFixed(2), unit: 'inHg' };
        }
        return { display: '--', unit: '' };
    }

    getFlightCategory(data) {
        if (data.flight_rules) {
            return data.flight_rules;
        }

        // Calculate from visibility and ceiling
        const vis = data.visibility?.value || 10;
        const ceiling = this.getCeiling(data);

        if (vis < 1 || ceiling < 500) return 'LIFR';
        if (vis < 3 || ceiling < 1000) return 'IFR';
        if (vis < 5 || ceiling < 3000) return 'MVFR';
        return 'VFR';
    }

    getCeiling(data) {
        if (!data.clouds || data.clouds.length === 0) return 99999;

        for (const cloud of data.clouds) {
            if (cloud.type === 'BKN' || cloud.type === 'OVC') {
                return cloud.altitude || 99999;
            }
        }
        return 99999;
    }

    showLoading() {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'placeholder';

        const icon = document.createElement('div');
        icon.className = 'placeholder-icon';
        icon.textContent = '⏳';

        const text = document.createElement('div');
        text.className = 'placeholder-text';
        text.textContent = 'Fetching weather...';

        div.appendChild(icon);
        div.appendChild(text);
        this.content.appendChild(div);
    }

    showError(message) {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'error-message';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '⚠️';

        const text = document.createElement('div');
        text.textContent = message;

        div.appendChild(icon);
        div.appendChild(text);
        this.content.appendChild(div);
    }

    refresh() {
        if (this.airportInput.value) {
            this.fetchWeather();
        }
    }

    addToRecent(icao) {
        // Remove if already exists
        this.recentAirports = this.recentAirports.filter(a => a !== icao);
        // Add to front
        this.recentAirports.unshift(icao);
        // Keep only last 5
        this.recentAirports = this.recentAirports.slice(0, 5);

        this.saveState();
        this.renderRecent();
    }

    renderRecent() {
        this.recentList.replaceChildren();

        this.recentAirports.forEach(icao => {
            const btn = document.createElement('button');
            btn.className = 'recent-btn';
            btn.textContent = icao;
            btn.addEventListener('click', () => {
                this.airportInput.value = icao;
                this.fetchWeather(icao);
            });
            this.recentList.appendChild(btn);
        });
    }

    saveState() {
        try {
            localStorage.setItem('weather-widget-state', JSON.stringify({
                recentAirports: this.recentAirports
            }));
        } catch (e) {}
    }

    loadState() {
        try {
            const saved = localStorage.getItem('weather-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.recentAirports = state.recentAirports || [];
            }
        } catch (e) {}
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.weatherWidget = new WeatherWidget();
});
