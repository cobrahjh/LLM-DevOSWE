/**
 * Environment pane
 * SimGlass Engine v2.0.0 - Phase 5: Environment Controls
 */

class EnvironmentPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'environment',
            widgetVersion: '2.5.0',
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
            clear: { name: 'Clear Skies', icon: '☀️', short: 'CLR', desc: 'Perfect VFR conditions' },
            fewclouds: { name: 'Few Clouds', icon: '🌤️', short: 'FEW', desc: '1-2 oktas cloud cover' },
            scattered: { name: 'Scattered Clouds', icon: '⛅', short: 'SCT', desc: '3-4 oktas cloud cover' },
            broken: { name: 'Broken Clouds', icon: '🌥️', short: 'BKN', desc: '5-7 oktas cloud cover' },
            overcast: { name: 'Overcast', icon: '☁️', short: 'OVC', desc: '8 oktas complete cover' },
            rain: { name: 'Rain', icon: '🌧️', short: 'RA', desc: 'Light to moderate rain' },
            storm: { name: 'Thunderstorm', icon: '⛈️', short: 'TS', desc: 'Heavy rain with lightning' },
            snow: { name: 'Snow', icon: '🌨️', short: 'SN', desc: 'Snowfall conditions' },
            fog: { name: 'Fog', icon: '🌫️', short: 'FG', desc: 'Reduced visibility <1SM' }
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
            // Weather conditions (Phase 1: Live Weather Data)
            wxTemp: document.getElementById('wx-temp'),
            wxQnh: document.getElementById('wx-qnh'),
            wxVis: document.getElementById('wx-vis'),
            wxWind: document.getElementById('wx-wind'),
            wxDalt: document.getElementById('wx-dalt'),
            wxCloud: document.getElementById('wx-cloud'),
            wxPrecipBar: document.getElementById('wx-precip-bar'),
            wxPrecipText: document.getElementById('wx-precip-text'),
            // Weather presets
            weatherIcon: document.getElementById('weather-icon'),
            weatherName: document.getElementById('weather-name'),
            // Actions
            btnPause: document.getElementById('btn-pause'),
            btnSlew: document.getElementById('btn-slew'),
            btnRefuel: document.getElementById('btn-refuel'),
            btnCaptureWx: document.getElementById('btn-capture-wx'),
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

        // Weather capture button (Phase 3)
        if (this.elements.btnCaptureWx) {
            this.elements.btnCaptureWx.addEventListener('click', () => {
                this.captureWeather();
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

        // Visual feedback
        this.showWeatherFeedback(preset);

        // Send weather preset command to server
        // Note: MSFS 2024 has limited weather API - this updates UI state only
        fetch(`http://${window.location.hostname}:8080/api/environment/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: preset })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log(`Weather preset selected: ${preset} (${data.method})`);
                if (data.note) {
                    console.info(`ℹ️ ${data.note}`);
                }
            } else {
                console.warn(`Weather failed: ${data.error}`);
            }
        })
        .catch(err => console.error('Weather error:', err));

        this.updateUI();
    }

    showWeatherFeedback(preset) {
        // Animate the weather current display to show selection
        const currentDisplay = document.querySelector('.env-weather-current');
        if (currentDisplay) {
            currentDisplay.style.transform = 'scale(1.05)';
            currentDisplay.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
            setTimeout(() => {
                currentDisplay.style.transform = 'scale(1)';
                currentDisplay.style.boxShadow = '';
            }, 300);
        }
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

    captureWeather() {
        // Phase 3: Weather Capture - Download current weather as .WPR file
        const port = window.location.port || '8080';
        const presetName = prompt('Enter preset name:', 'My Weather');

        if (!presetName) return; // User cancelled

        const url = `http://localhost:${port}/api/environment/capture-weather?name=${encodeURIComponent(presetName)}`;

        // Create invisible link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `${presetName.replace(/[^a-zA-Z0-9]/g, '_')}.wpr`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`[Environment] Weather capture triggered: ${presetName}`);
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

        // Weather data (Phase 1: Enhanced Weather Reading)
        if (data.windSpeed !== undefined) this.data.windSpeed = data.windSpeed;
        if (data.windDirection !== undefined) this.data.windDir = data.windDirection;
        if (data.temperature !== undefined) this.data.temperature = data.temperature;
        if (data.pressure !== undefined) this.data.pressure = data.pressure;
        if (data.seaLevelPressure !== undefined) this.data.seaLevelPressure = data.seaLevelPressure;
        if (data.visibility !== undefined) this.data.visibility = data.visibility;
        if (data.precipRate !== undefined) this.data.precipRate = data.precipRate;
        if (data.inCloud !== undefined) this.data.inCloud = data.inCloud;
        if (data.densityAltitude !== undefined) this.data.densityAltitude = data.densityAltitude;

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

        // Weather conditions (Phase 1: Live Weather Data)
        if (this.elements.wxTemp && this.data.temperature !== undefined) {
            const tempC = Math.round(this.data.temperature);
            const tempF = Math.round(tempC * 9/5 + 32);
            this.elements.wxTemp.textContent = `${tempC}°C`;
            this.elements.wxTemp.title = `${tempF}°F`;
        }

        if (this.elements.wxQnh && this.data.pressure !== undefined) {
            this.elements.wxQnh.textContent = this.data.pressure.toFixed(2);
        }

        if (this.elements.wxVis && this.data.visibility !== undefined) {
            const visSM = (this.data.visibility / 1609.34).toFixed(1);
            this.elements.wxVis.textContent = `${visSM}SM`;
        }

        if (this.elements.wxWind && this.data.windDir !== undefined && this.data.windSpeed !== undefined) {
            const dir = String(Math.round(this.data.windDir)).padStart(3, '0');
            const spd = Math.round(this.data.windSpeed);
            this.elements.wxWind.textContent = `${dir}/${spd}`;
        }

        if (this.elements.wxDalt && this.data.densityAltitude !== undefined) {
            const dalt = Math.round(this.data.densityAltitude);
            this.elements.wxDalt.textContent = dalt.toLocaleString();
        }

        if (this.elements.wxCloud && this.data.inCloud !== undefined) {
            this.elements.wxCloud.textContent = this.data.inCloud ? 'IMC' : 'CLR';
            this.elements.wxCloud.style.color = this.data.inCloud ? 'var(--env-amber)' : 'var(--env-green)';
        }

        // Precipitation bar (show only if precipitating)
        if (this.elements.wxPrecipBar && this.data.precipRate !== undefined) {
            if (this.data.precipRate > 0.1) {
                this.elements.wxPrecipBar.style.display = 'flex';
                if (this.elements.wxPrecipText) {
                    this.elements.wxPrecipText.textContent = `PRECIP: ${this.data.precipRate.toFixed(1)}mm`;
                }
            } else {
                this.elements.wxPrecipBar.style.display = 'none';
            }
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
