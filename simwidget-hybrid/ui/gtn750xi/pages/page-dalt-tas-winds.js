/**
 * GTN750Xi DALT/TAS/Winds Calculator Page
 * Based on Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-15 to 4-17)
 * Calculates density altitude, true airspeed, and wind data
 */

class DaltTasWindsPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.getData = options.getData || (() => ({}));

        // Input settings
        this.inputs = {
            indicatedAlt: 5000,      // ft
            baro: 29.92,             // inHg
            cas: 120,                // knots (Calibrated Air Speed)
            tat: 15,                 // °C (Total Air Temperature)
            hdg: 0,                  // degrees
            trk: 0,                  // degrees
            groundSpeed: 120,        // knots
            useSensorData: false,
            usePressureAlt: false    // True when sensor provides pressure alt
        };

        // Calculated results
        this.results = {
            densityAlt: null,        // ft
            tas: null,               // knots
            windDirection: null,     // degrees
            windSpeed: null,         // knots
            headwindComponent: null  // knots (+ = headwind, - = tailwind)
        };

        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this._initialized = true;
        this.render();
    }

    cacheElements() {
        this.elements = {
            // Inputs
            indicatedAlt: document.getElementById('dalt-indicated-alt'),
            baro: document.getElementById('dalt-baro'),
            cas: document.getElementById('dalt-cas'),
            tat: document.getElementById('dalt-tat'),
            hdg: document.getElementById('dalt-hdg'),
            trk: document.getElementById('dalt-trk'),
            groundSpeed: document.getElementById('dalt-ground-speed'),
            useSensorBtn: document.getElementById('dalt-use-sensor'),

            // Outputs
            densityAlt: document.getElementById('dalt-result-density'),
            tas: document.getElementById('dalt-result-tas'),
            windDirection: document.getElementById('dalt-result-wind-dir'),
            windSpeed: document.getElementById('dalt-result-wind-speed'),
            headwind: document.getElementById('dalt-result-headwind')
        };
    }

    bindEvents() {
        // Input changes
        const inputFields = ['indicatedAlt', 'baro', 'cas', 'tat', 'hdg', 'trk', 'groundSpeed'];
        inputFields.forEach(field => {
            this.elements[field]?.addEventListener('input', () => {
                this.inputs[field] = parseFloat(this.elements[field].value) || 0;
                this.saveSettings();
                this.calculate();
            });
        });

        // Use Sensor Data toggle
        this.elements.useSensorBtn?.addEventListener('click', () => this.toggleUseSensorData());
    }

    loadSettings() {
        const saved = localStorage.getItem('gtn750xi_dalt_tas_winds_settings');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.inputs) Object.assign(this.inputs, data.inputs);
            } catch (e) {
                console.error('[DALT/TAS/Winds] Failed to load settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gtn750xi_dalt_tas_winds_settings', JSON.stringify({
            inputs: this.inputs
        }));
    }

    toggleUseSensorData() {
        this.inputs.useSensorData = !this.inputs.useSensorData;
        if (this.inputs.useSensorData) {
            const data = this.getData();
            // Pull data from sensors
            this.inputs.indicatedAlt = data.altitude || 0;
            this.inputs.baro = data.ambientPressure || 29.92;
            this.inputs.cas = data.indicatedAirSpeed || 120;
            this.inputs.tat = data.ambientTemp || 15;
            this.inputs.hdg = data.heading || 0;
            this.inputs.trk = data.track || 0;
            this.inputs.groundSpeed = data.groundSpeed || 120;
        }
        this.saveSettings();
        this.render();
        this.calculate();
    }

    reset() {
        this.inputs = {
            indicatedAlt: 5000,
            baro: 29.92,
            cas: 120,
            tat: 15,
            hdg: 0,
            trk: 0,
            groundSpeed: 120,
            useSensorData: false,
            usePressureAlt: false
        };
        this.saveSettings();
        this.render();
        this.calculate();
    }

    /**
     * Calculate density altitude, TAS, and wind data
     */
    calculate() {
        const { indicatedAlt, baro, cas, tat, hdg, trk, groundSpeed } = this.inputs;

        // Calculate Pressure Altitude
        // Pressure ALT = Indicated ALT + (29.92 - BARO) × 1000
        const pressureAlt = indicatedAlt + (29.92 - baro) * 1000;

        // Calculate Density Altitude
        // Standard temp at pressure altitude: 15°C - (altitude / 1000 × 2)
        const stdTemp = 15 - (pressureAlt / 1000 * 2);
        // Density ALT = Pressure ALT + 120 × (OAT - Std Temp)
        this.results.densityAlt = Math.round(pressureAlt + 120 * (tat - stdTemp));

        // Calculate True Airspeed (TAS)
        // Simplified formula: TAS = CAS × √(σ₀/σ)
        // where σ = density ratio = (P/P₀) × (T₀/T)
        // Using approximation: TAS ≈ CAS × (1 + altitude/1000 × 0.02)
        const altFactor = 1 + (pressureAlt / 1000 * 0.02);
        this.results.tas = Math.round(cas * altFactor);

        // Calculate Wind Vector
        // Wind is the vector difference between TAS (heading) and ground track/speed
        if (this.results.tas > 0 && groundSpeed > 0) {
            // Convert to radians
            const hdgRad = hdg * Math.PI / 180;
            const trkRad = trk * Math.PI / 180;

            // TAS vector components (heading-based)
            const tasNorth = this.results.tas * Math.cos(hdgRad);
            const tasEast = this.results.tas * Math.sin(hdgRad);

            // Ground speed vector components (track-based)
            const gsNorth = groundSpeed * Math.cos(trkRad);
            const gsEast = groundSpeed * Math.sin(trkRad);

            // Wind vector = Ground - TAS
            const windNorth = gsNorth - tasNorth;
            const windEast = gsEast - tasEast;

            // Calculate wind speed and direction
            this.results.windSpeed = Math.round(Math.sqrt(windNorth * windNorth + windEast * windEast));

            if (this.results.windSpeed > 0) {
                // Wind direction (from where wind is coming)
                let windDir = Math.atan2(windEast, windNorth) * 180 / Math.PI;
                windDir = (windDir + 360) % 360;
                this.results.windDirection = Math.round(windDir);

                // Headwind component = wind speed × cos(wind angle - track)
                const windAngle = this.results.windDirection * Math.PI / 180;
                const relativeWind = windAngle - trkRad;
                this.results.headwindComponent = Math.round(this.results.windSpeed * Math.cos(relativeWind));
            } else {
                this.results.windDirection = null; // Dashes per spec
                this.results.headwindComponent = 0;
            }
        } else {
            this.results.windDirection = null;
            this.results.windSpeed = 0;
            this.results.headwindComponent = 0;
        }

        this.render();
    }

    render() {
        if (!this._initialized) return;

        const disabled = this.inputs.useSensorData;

        // Update input fields
        if (this.elements.indicatedAlt) {
            this.elements.indicatedAlt.value = this.inputs.indicatedAlt;
            this.elements.indicatedAlt.disabled = disabled;
        }
        if (this.elements.baro) {
            this.elements.baro.value = this.inputs.baro.toFixed(2);
            this.elements.baro.disabled = disabled || this.inputs.usePressureAlt;
        }
        if (this.elements.cas) {
            this.elements.cas.value = this.inputs.cas;
            this.elements.cas.disabled = disabled;
        }
        if (this.elements.tat) {
            this.elements.tat.value = this.inputs.tat;
            this.elements.tat.disabled = disabled;
        }
        if (this.elements.hdg) {
            this.elements.hdg.value = this.inputs.hdg;
            this.elements.hdg.disabled = disabled;
        }
        if (this.elements.trk) {
            this.elements.trk.value = this.inputs.trk;
            this.elements.trk.disabled = disabled;
        }
        if (this.elements.groundSpeed) {
            this.elements.groundSpeed.value = this.inputs.groundSpeed;
            this.elements.groundSpeed.disabled = disabled;
        }
        if (this.elements.useSensorBtn) {
            this.elements.useSensorBtn.classList.toggle('active', this.inputs.useSensorData);
            this.elements.useSensorBtn.textContent = this.inputs.useSensorData ? 'ON' : 'OFF';
        }

        // Update outputs
        if (this.elements.densityAlt) {
            this.elements.densityAlt.textContent = this.results.densityAlt !== null
                ? `${this.results.densityAlt.toLocaleString()} FT`
                : '--- FT';
        }
        if (this.elements.tas) {
            this.elements.tas.textContent = this.results.tas !== null
                ? `${this.results.tas} KT`
                : '--- KT';
        }
        if (this.elements.windDirection) {
            this.elements.windDirection.textContent = this.results.windDirection !== null
                ? `${this.results.windDirection.toString().padStart(3, '0')}°`
                : '---°';
        }
        if (this.elements.windSpeed) {
            this.elements.windSpeed.textContent = this.results.windSpeed !== null
                ? `${this.results.windSpeed} KT`
                : '--- KT';
        }
        if (this.elements.headwind) {
            if (this.results.headwindComponent !== null) {
                const component = this.results.headwindComponent;
                const label = component > 0 ? 'Head' : component < 0 ? 'Tail' : 'Cross';
                this.elements.headwind.textContent = `${Math.abs(component)} KT ${label}`;
            } else {
                this.elements.headwind.textContent = '--- KT';
            }
        }
    }

    update() {
        // Update sensor data if active
        if (this.inputs.useSensorData) {
            const data = this.getData();
            this.inputs.indicatedAlt = data.altitude || this.inputs.indicatedAlt;
            this.inputs.baro = data.ambientPressure || this.inputs.baro;
            this.inputs.cas = data.indicatedAirSpeed || this.inputs.cas;
            this.inputs.tat = data.ambientTemp || this.inputs.tat;
            this.inputs.hdg = data.heading || this.inputs.hdg;
            this.inputs.trk = data.track || this.inputs.trk;
            this.inputs.groundSpeed = data.groundSpeed || this.inputs.groundSpeed;
            this.calculate();
        }
    }

    destroy() {
        // No intervals to clean up
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DaltTasWindsPage;
}
