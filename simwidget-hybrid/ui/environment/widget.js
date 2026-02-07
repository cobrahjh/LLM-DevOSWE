/**
 * Environment Widget
 * SimGlass Engine v2.0.0 - Phase 5: Environment Controls
 */

class EnvironmentWidget {
    constructor() {
        this._destroyed = false;
        this.ws = null;
        this.data = {
            localTime: 720, // Minutes from midnight (12:00)
            zuluTime: 720,
            simRate: 1,
            weather: 'clear',
            isPaused: false,
            isSlew: false
        };

        this.weatherPresets = {
            clear: { name: 'Clear Skies', icon: '☀️' },
            fewclouds: { name: 'Few Clouds', icon: '🌤️' },
            scattered: { name: 'Scattered Clouds', icon: '⛅' },
            broken: { name: 'Broken Clouds', icon: '🌥️' },
            overcast: { name: 'Overcast', icon: '☁️' },
            rain: { name: 'Rain', icon: '🌧️' },
            storm: { name: 'Thunderstorm', icon: '⛈️' },
            snow: { name: 'Snow', icon: '🌨️' },
            fog: { name: 'Fog', icon: '🌫️' }
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.connect();
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
            btnRefuel: document.getElementById('btn-refuel')
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

    connect() {
        if (this._destroyed) return;

        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn?.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn?.classList.remove('connected');
            if (!this._destroyed) {
                setTimeout(() => this.connect(), 3000);
            }
        };
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
    }

    destroy() {
        this._destroyed = true;
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.envWidget = new EnvironmentWidget();
    window.addEventListener('beforeunload', () => window.envWidget?.destroy());
});
