/**
 * Environment pane
 * SimGlass Engine v2.0.0 - Phase 5: Environment Controls
 */

class EnvironmentPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'environment',
            widgetVersion: '2.1.0',
            autoConnect: true
        });

        this.data = {
            localTime: 720, // Minutes from midnight (12:00)
            zuluTime: 720,
            simRate: 1,
            weather: 'clear',
            isPaused: false,
            isSlew: false
        };

        this.weatherPresets = {
            clear: { name: 'Clear Skies', icon: '☀️', short: 'CLR' },
            fewclouds: { name: 'Few Clouds', icon: '🌤️', short: 'FEW' },
            scattered: { name: 'Scattered Clouds', icon: '⛅', short: 'SCT' },
            broken: { name: 'Broken Clouds', icon: '🌥️', short: 'BKN' },
            overcast: { name: 'Overcast', icon: '☁️', short: 'OVC' },
            rain: { name: 'Rain', icon: '🌧️', short: 'RA' },
            storm: { name: 'Thunderstorm', icon: '⛈️', short: 'TS' },
            snow: { name: 'Snow', icon: '🌨️', short: 'SN' },
            fog: { name: 'Fog', icon: '🌫️', short: 'FG' }
        };

        // Compact mode state
        this.compactMode = localStorage.getItem('environment-compact') === 'true';

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.setupCompactToggle();

        // Apply saved compact mode
        if (this.compactMode) {
            document.getElementById('widget-root')?.classList.add('compact');
            document.getElementById('compact-toggle')?.classList.add('active');
        }

        this.updateUI();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            // Time
            timeIcon: document.getElementById('time-icon'),
            localTime: document.getElementById('local-time'),
            zuluTime: document.getElementById('zulu-time'),
            timeSlider: document.getElementById('time-slider'),
            // Sim rate
            simRate: document.getElementById('sim-rate'),
            rateDecrease: document.getElementById('rate-decrease'),
            rateIncrease: document.getElementById('rate-increase'),
            // Weather
            weatherIcon: document.getElementById('weather-icon'),
            weatherName: document.getElementById('weather-name'),
            // Actions
            btnPause: document.getElementById('btn-pause'),
            btnSlew: document.getElementById('btn-slew'),
            btnRefuel: document.getElementById('btn-refuel'),
            // Compact elements
            evTimeIcon: document.getElementById('ev-time-icon'),
            evLocal: document.getElementById('ev-local'),
            evWxIcon: document.getElementById('ev-wx-icon'),
            evWxName: document.getElementById('ev-wx-name'),
            evWind: document.getElementById('ev-wind'),
            evTemp: document.getElementById('ev-temp'),
            evQnh: document.getElementById('ev-qnh'),
            evVis: document.getElementById('ev-vis'),
            evPrecip: document.getElementById('ev-precip')
        };
    }

    setupEvents() {
        // Time slider
        if (this.elements.timeSlider) {
            this.elements.timeSlider.addEventListener('input', (e) => {
                this.data.localTime = parseInt(e.target.value);
                this.updateUI();
            });

            this.elements.timeSlider.addEventListener('change', (e) => {
                this.setTime(parseInt(e.target.value));
            });
        }

        // Time presets
        document.querySelectorAll('.env-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const time = parseInt(e.currentTarget.dataset.time);
                this.data.localTime = time;
                this.elements.timeSlider.value = time;
                this.setTime(time);
                this.updateUI();
            });
        });

        // Sim rate buttons
        if (this.elements.rateDecrease) {
            this.elements.rateDecrease.addEventListener('click', () => {
                this.changeSimRate(-1);
            });
        }

        if (this.elements.rateIncrease) {
            this.elements.rateIncrease.addEventListener('click', () => {
                this.changeSimRate(1);
            });
        }

        // Sim rate presets
        document.querySelectorAll('.env-rate-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rate = parseFloat(e.currentTarget.dataset.rate);
                this.setSimRate(rate);
            });
        });

        // Weather presets
        document.querySelectorAll('.env-weather-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const weather = e.currentTarget.dataset.weather;
                this.setWeather(weather);
            });
        });

        // Action buttons
        if (this.elements.btnPause) {
            this.elements.btnPause.addEventListener('click', () => {
                this.data.isPaused = !this.data.isPaused;
                this.sendCommand('PAUSE_TOGGLE');
                this.updateUI();
            });
        }

        if (this.elements.btnSlew) {
            this.elements.btnSlew.addEventListener('click', () => {
                this.data.isSlew = !this.data.isSlew;
                this.sendCommand('SLEW_TOGGLE');
                this.updateUI();
            });
        }

        if (this.elements.btnRefuel) {
            this.elements.btnRefuel.addEventListener('click', () => {
                this.sendCommand('REPAIR_AND_REFUEL');
            });
        }
    }

    setTime(minutes) {
        // Convert minutes to hours:minutes for SimConnect
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        // Send time set command
        this.sendCommand('ZULU_HOURS_SET', hours);
        this.sendCommand('ZULU_MINUTES_SET', mins);
    }

    changeSimRate(direction) {
        const rates = [0.25, 0.5, 1, 2, 4, 8, 16];
        const currentIndex = rates.indexOf(this.data.simRate);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= rates.length) newIndex = rates.length - 1;

        this.setSimRate(rates[newIndex]);
    }

    setSimRate(rate) {
        this.data.simRate = rate;

        // Send sim rate command
        if (rate < 1) {
            this.sendCommand('SIM_RATE_DECR');
        } else if (rate > 1) {
            this.sendCommand('SIM_RATE_INCR');
        } else {
            this.sendCommand('SIM_RATE');
        }

        this.updateUI();
    }

    setWeather(preset) {
        this.data.weather = preset;

        // Send weather preset command to server
        // Server will use HTTP API to set weather
        fetch(`http://${window.location.hostname}:8080/api/environment/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: preset })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log(`Weather set: ${preset}`);
            } else {
                console.warn(`Weather failed: ${data.error}`);
            }
        })
        .catch(err => console.error('Weather error:', err));

        this.updateUI();
    }

    // SimGlassBase lifecycle hooks
    onConnect() {
        this.elements.conn?.classList.add('connected');
    }

    onDisconnect() {
        this.elements.conn?.classList.remove('connected');
    }

    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.updateFromSim(msg.data);
        }
    }

    sendCommand(command, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: command,
                value: value
            }));
        }
    }

    updateFromSim(data) {
        if (data.localTime !== undefined) {
            // Server sends hours (0-24), convert to minutes (0-1440)
            this.data.localTime = Math.round(data.localTime * 60);
            this.elements.timeSlider.value = this.data.localTime;
        }
        if (data.zuluTime !== undefined) {
            // Server sends hours, convert to minutes
            this.data.zuluTime = Math.round(data.zuluTime * 60);
        }
        if (data.simRate !== undefined) this.data.simRate = data.simRate;
        if (data.isPaused !== undefined) this.data.isPaused = data.isPaused;
        if (data.isSlew !== undefined) this.data.isSlew = data.isSlew;

        // Environment data for compact view
        if (data.windSpeed !== undefined) this.data.windSpeed = data.windSpeed;
        if (data.windDir !== undefined) this.data.windDir = data.windDir;
        if (data.temperature !== undefined) this.data.temperature = data.temperature;
        if (data.pressure !== undefined) this.data.pressure = data.pressure;
        if (data.visibility !== undefined) this.data.visibility = data.visibility;

        this.updateUI();
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60) % 24;
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    getTimeIcon(minutes) {
        const hours = Math.floor(minutes / 60) % 24;
        if (hours >= 6 && hours < 8) return '🌅'; // Dawn
        if (hours >= 8 && hours < 17) return '☀️'; // Day
        if (hours >= 17 && hours < 20) return '🌇'; // Dusk
        return '🌙'; // Night
    }

    updateUI() {
        // Time display
        if (this.elements.localTime) {
            this.elements.localTime.textContent = this.formatTime(this.data.localTime);
        }
        if (this.elements.zuluTime) {
            this.elements.zuluTime.textContent = this.formatTime(this.data.zuluTime) + 'Z';
        }
        if (this.elements.timeIcon) {
            this.elements.timeIcon.textContent = this.getTimeIcon(this.data.localTime);
        }

        // Sim rate
        if (this.elements.simRate) {
            this.elements.simRate.textContent = this.data.simRate + 'x';
        }

        // Sim rate preset highlighting
        document.querySelectorAll('.env-rate-preset').forEach(btn => {
            const rate = parseFloat(btn.dataset.rate);
            btn.classList.toggle('active', rate === this.data.simRate);
        });

        // Weather
        const weatherData = this.weatherPresets[this.data.weather];
        if (this.elements.weatherIcon && weatherData) {
            this.elements.weatherIcon.textContent = weatherData.icon;
        }
        if (this.elements.weatherName && weatherData) {
            this.elements.weatherName.textContent = weatherData.name;
        }

        // Weather button highlighting
        document.querySelectorAll('.env-weather-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.weather === this.data.weather);
        });

        // Action buttons
        if (this.elements.btnPause) {
            this.elements.btnPause.classList.toggle('active', this.data.isPaused);
            this.elements.btnPause.querySelector('.env-action-icon').textContent =
                this.data.isPaused ? '▶️' : '⏸️';
            this.elements.btnPause.querySelector('.env-action-text').textContent =
                this.data.isPaused ? 'RESUME' : 'PAUSE';
        }

        if (this.elements.btnSlew) {
            this.elements.btnSlew.classList.toggle('active', this.data.isSlew);
        }

        // Compact view
        this.updateCompact();
    }

    setupCompactToggle() {
        const toggle = document.getElementById('compact-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            localStorage.setItem('environment-compact', this.compactMode);
            document.getElementById('widget-root')?.classList.toggle('compact', this.compactMode);
            toggle.classList.toggle('active', this.compactMode);
            this.updateUI();
        });
    }

    updateCompact() {
        const e = this.elements;
        // Time icon and local time
        if (e.evTimeIcon) e.evTimeIcon.textContent = this.getTimeIcon(this.data.localTime);
        if (e.evLocal) e.evLocal.textContent = this.formatTime(this.data.localTime) + 'L';

        // Weather icon and short name
        const wx = this.weatherPresets[this.data.weather];
        if (e.evWxIcon && wx) e.evWxIcon.textContent = wx.icon;
        if (e.evWxName && wx) e.evWxName.textContent = wx.short;

        // Environment data cells (populated from sim data when available)
        if (e.evWind && this.data.windSpeed !== undefined) {
            const dir = this.data.windDir !== undefined ? String(Math.round(this.data.windDir)).padStart(3, '0') : '---';
            e.evWind.textContent = `${dir}/${Math.round(this.data.windSpeed)}kt`;
        }
        if (e.evTemp && this.data.temperature !== undefined) {
            e.evTemp.textContent = `${Math.round(this.data.temperature)}\u00B0C`;
        }
        if (e.evQnh && this.data.pressure !== undefined) {
            e.evQnh.textContent = this.data.pressure.toFixed(2);
        }
        if (e.evVis && this.data.visibility !== undefined) {
            const visSM = (this.data.visibility / 1609.34).toFixed(0);
            e.evVis.textContent = `${visSM}SM`;
        }
        if (e.evPrecip) {
            const precip = this.data.weather;
            const precipMap = { rain: 'RA', storm: 'TS', snow: 'SN', fog: 'FG' };
            e.evPrecip.textContent = precipMap[precip] || 'NONE';
        }
    }

    destroy() {
        // Call parent's destroy() for WebSocket cleanup
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.envPane = new EnvironmentPane();
    window.addEventListener('beforeunload', () => window.envPane?.destroy());
});
