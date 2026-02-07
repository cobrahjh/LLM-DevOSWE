/**
 * Engine Monitor Widget v1.0.0
 * Real-time engine instrumentation for MSFS
 *
 * Features:
 * - RPM arc gauge with canvas rendering
 * - Manifold pressure, fuel flow
 * - Oil temperature and pressure
 * - EGT/CHT temperature bars
 * - Throttle/Mixture/Prop position indicators
 * - Engine start/magneto/cutoff controls
 *
 * Path: ui/engine-monitor/widget.js
 */

class EngineMonitorWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'engine-monitor',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // Engine data state
        this.engine = {
            rpm: 0,
            maxRpm: 2700,           // Typical GA max RPM
            manifoldPressure: 0,    // inHg
            fuelFlow: 0,            // GPH
            oilTemp: 0,             // °F
            oilPressure: 0,         // PSI
            egt: 0,                 // °F
            cht: 0,                 // °F
            running: false,
            throttle: 0,            // 0-100%
            mixture: 0,             // 0-100%
            propeller: 0            // 0-100%
        };

        // Limits for warnings
        this.limits = {
            oilTempMax: 245,
            oilTempMin: 100,
            oilPressMax: 100,
            oilPressMin: 25,
            egtMax: 1650,
            chtMax: 500,
            rpmRedline: 2700
        };

        // Hobbs timer
        this.hobbsStart = null;
        this.hobbsTime = 0;

        // Canvas
        this.canvas = null;
        this.ctx = null;

        // Cache elements
        this.elements = {};

        this.init();
    }

    /**
     * Initialize widget
     */
    init() {
        console.log('[EngineMonitor] Initialized');
        this.cacheElements();
        this.setupCanvas();
        this.bindEvents();
        this.startRenderLoop();
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // RPM
            rpmVal: document.getElementById('rpm-val'),
            // Primary data
            map: document.getElementById('eng-map'),
            ff: document.getElementById('eng-ff'),
            oilT: document.getElementById('eng-oilt'),
            oilP: document.getElementById('eng-oilp'),
            // Temperatures
            egt: document.getElementById('eng-egt'),
            cht: document.getElementById('eng-cht'),
            egtBar: document.getElementById('egt-bar'),
            chtBar: document.getElementById('cht-bar'),
            // Controls
            throttleBar: document.getElementById('ctrl-throttle'),
            mixtureBar: document.getElementById('ctrl-mixture'),
            propBar: document.getElementById('ctrl-prop'),
            thrVal: document.getElementById('ctrl-thr-val'),
            mixVal: document.getElementById('ctrl-mix-val'),
            propVal: document.getElementById('ctrl-prop-val'),
            // Status
            engineStatus: document.getElementById('engine-status'),
            hobbsTime: document.getElementById('hobbs-time')
        };
    }

    /**
     * Setup canvas for RPM gauge
     */
    setupCanvas() {
        this.canvas = document.getElementById('rpm-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            // Set actual size
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = 200;
            this.canvas.height = 120;
        }
    }

    /**
     * Bind button events
     */
    bindEvents() {
        // Engine start
        document.getElementById('btn-starter')?.addEventListener('click', () => {
            this.sendCommand('TOGGLE_STARTER1');
        });

        // Magneto cycle
        document.getElementById('btn-magneto')?.addEventListener('click', () => {
            this.sendCommand('MAGNETO_INCR');
        });

        // Mixture cutoff
        document.getElementById('btn-cutoff')?.addEventListener('click', () => {
            this.sendCommand('MIXTURE_SET', 0);
        });
    }

    /**
     * Start canvas render loop
     */
    startRenderLoop() {
        this._rafId = null;
        const render = () => {
            this.renderRpmGauge();
            this._rafId = requestAnimationFrame(render);
        };
        render();
    }

    /**
     * Cleanup timers, RAF, and WebSocket
     */
    destroy() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * WebSocket connected
     */
    onConnect() {
        console.log('[EngineMonitor] Connected');
    }

    /**
     * WebSocket disconnected
     */
    onDisconnect() {
        console.log('[EngineMonitor] Disconnected');
    }

    /**
     * Handle incoming messages
     */
    onMessage(msg) {
        if (msg.type === 'flightData' && msg.data) {
            this.updateEngineData(msg.data);
        }
    }

    /**
     * Update engine data from SimConnect
     */
    updateEngineData(data) {
        // RPM
        if (data.GENERAL_ENG_RPM_1 !== undefined) {
            this.engine.rpm = data.GENERAL_ENG_RPM_1;
        } else if (data.engineRpm !== undefined) {
            this.engine.rpm = data.engineRpm;
        } else if (data.propeller !== undefined) {
            // Mock: derive RPM from prop percentage
            this.engine.rpm = (data.propeller / 100) * this.engine.maxRpm;
        }

        // Manifold pressure
        if (data.RECIP_ENG_MANIFOLD_PRESSURE_1 !== undefined) {
            this.engine.manifoldPressure = data.RECIP_ENG_MANIFOLD_PRESSURE_1;
        } else if (data.manifoldPressure !== undefined) {
            this.engine.manifoldPressure = data.manifoldPressure;
        }

        // Fuel flow
        if (data.ENG_FUEL_FLOW_GPH_1 !== undefined) {
            this.engine.fuelFlow = data.ENG_FUEL_FLOW_GPH_1;
        } else if (data.fuelFlow !== undefined) {
            this.engine.fuelFlow = data.fuelFlow;
        }

        // Oil temp/pressure
        if (data.GENERAL_ENG_OIL_TEMPERATURE_1 !== undefined) {
            this.engine.oilTemp = data.GENERAL_ENG_OIL_TEMPERATURE_1;
        } else if (data.oilTemp !== undefined) {
            this.engine.oilTemp = data.oilTemp;
        }

        if (data.GENERAL_ENG_OIL_PRESSURE_1 !== undefined) {
            this.engine.oilPressure = data.GENERAL_ENG_OIL_PRESSURE_1;
        } else if (data.oilPressure !== undefined) {
            this.engine.oilPressure = data.oilPressure;
        }

        // EGT/CHT
        if (data.RECIP_ENG_EXHAUST_GAS_TEMPERATURE_1 !== undefined) {
            this.engine.egt = data.RECIP_ENG_EXHAUST_GAS_TEMPERATURE_1;
        } else if (data.egt !== undefined) {
            this.engine.egt = data.egt;
        }

        if (data.RECIP_ENG_CYLINDER_HEAD_TEMPERATURE_1 !== undefined) {
            this.engine.cht = data.RECIP_ENG_CYLINDER_HEAD_TEMPERATURE_1;
        } else if (data.cht !== undefined) {
            this.engine.cht = data.cht;
        }

        // Engine running
        if (data.GENERAL_ENG_COMBUSTION_1 !== undefined) {
            this.engine.running = data.GENERAL_ENG_COMBUSTION_1 !== 0;
        } else if (data.engineRunning !== undefined) {
            this.engine.running = data.engineRunning;
        } else {
            this.engine.running = this.engine.rpm > 500;
        }

        // Controls position
        if (data.GENERAL_ENG_THROTTLE_LEVER_POSITION_1 !== undefined) {
            this.engine.throttle = data.GENERAL_ENG_THROTTLE_LEVER_POSITION_1;
        } else if (data.throttle !== undefined) {
            this.engine.throttle = data.throttle;
        }

        if (data.GENERAL_ENG_MIXTURE_LEVER_POSITION_1 !== undefined) {
            this.engine.mixture = data.GENERAL_ENG_MIXTURE_LEVER_POSITION_1;
        } else if (data.mixture !== undefined) {
            this.engine.mixture = data.mixture;
        }

        if (data.GENERAL_ENG_PROPELLER_LEVER_POSITION_1 !== undefined) {
            this.engine.propeller = data.GENERAL_ENG_PROPELLER_LEVER_POSITION_1;
        } else if (data.propeller !== undefined) {
            this.engine.propeller = data.propeller;
        }

        // Track Hobbs time
        this.updateHobbs();

        // Update UI
        this.updateUI();
    }

    /**
     * Update Hobbs meter
     */
    updateHobbs() {
        if (this.engine.running && !this.hobbsStart) {
            this.hobbsStart = Date.now();
        } else if (!this.engine.running && this.hobbsStart) {
            this.hobbsTime += (Date.now() - this.hobbsStart) / 3600000; // hours
            this.hobbsStart = null;
        }
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        this.updatePrimaryData();
        this.updateTemperatures();
        this.updateControls();
        this.updateStatus();
    }

    /**
     * Update primary engine data display
     */
    updatePrimaryData() {
        // RPM value
        if (this.elements.rpmVal) {
            this.elements.rpmVal.textContent = Math.round(this.engine.rpm);
        }

        // Manifold pressure
        if (this.elements.map) {
            this.elements.map.textContent = this.formatNumber(this.engine.manifoldPressure, 1);
        }

        // Fuel flow
        if (this.elements.ff) {
            this.elements.ff.textContent = this.formatNumber(this.engine.fuelFlow, 1);
        }

        // Oil temp with warning colors
        if (this.elements.oilT) {
            this.elements.oilT.textContent = Math.round(this.engine.oilTemp);
            this.elements.oilT.classList.remove('warning', 'critical', 'good');
            if (this.engine.oilTemp > this.limits.oilTempMax) {
                this.elements.oilT.classList.add('critical');
            } else if (this.engine.oilTemp < this.limits.oilTempMin) {
                this.elements.oilT.classList.add('warning');
            } else if (this.engine.oilTemp > 180) {
                this.elements.oilT.classList.add('good');
            }
        }

        // Oil pressure with warning colors
        if (this.elements.oilP) {
            this.elements.oilP.textContent = Math.round(this.engine.oilPressure);
            this.elements.oilP.classList.remove('warning', 'critical', 'good');
            if (this.engine.oilPressure < this.limits.oilPressMin) {
                this.elements.oilP.classList.add('critical');
            } else if (this.engine.oilPressure > this.limits.oilPressMax) {
                this.elements.oilP.classList.add('warning');
            } else {
                this.elements.oilP.classList.add('good');
            }
        }
    }

    /**
     * Update temperature bars
     */
    updateTemperatures() {
        // EGT
        if (this.elements.egt) {
            this.elements.egt.textContent = `${Math.round(this.engine.egt)}°F`;
        }
        if (this.elements.egtBar) {
            const egtPercent = Math.min(100, (this.engine.egt / this.limits.egtMax) * 100);
            this.elements.egtBar.style.width = `${egtPercent}%`;
        }

        // CHT
        if (this.elements.cht) {
            this.elements.cht.textContent = `${Math.round(this.engine.cht)}°F`;
        }
        if (this.elements.chtBar) {
            const chtPercent = Math.min(100, (this.engine.cht / this.limits.chtMax) * 100);
            this.elements.chtBar.style.width = `${chtPercent}%`;
        }
    }

    /**
     * Update control position bars
     */
    updateControls() {
        // Throttle
        if (this.elements.throttleBar) {
            this.elements.throttleBar.style.height = `${this.engine.throttle}%`;
        }
        if (this.elements.thrVal) {
            this.elements.thrVal.textContent = `${Math.round(this.engine.throttle)}%`;
        }

        // Mixture
        if (this.elements.mixtureBar) {
            this.elements.mixtureBar.style.height = `${this.engine.mixture}%`;
        }
        if (this.elements.mixVal) {
            this.elements.mixVal.textContent = `${Math.round(this.engine.mixture)}%`;
        }

        // Prop
        if (this.elements.propBar) {
            this.elements.propBar.style.height = `${this.engine.propeller}%`;
        }
        if (this.elements.propVal) {
            this.elements.propVal.textContent = `${Math.round(this.engine.propeller)}%`;
        }
    }

    /**
     * Update engine status indicator
     */
    updateStatus() {
        if (this.elements.engineStatus) {
            this.elements.engineStatus.textContent = this.engine.running ? 'RUN' : 'OFF';
            this.elements.engineStatus.classList.toggle('running', this.engine.running);
        }

        // Hobbs time
        if (this.elements.hobbsTime) {
            let totalHobbs = this.hobbsTime;
            if (this.hobbsStart) {
                totalHobbs += (Date.now() - this.hobbsStart) / 3600000;
            }
            this.elements.hobbsTime.textContent = totalHobbs.toFixed(1);
        }
    }

    /**
     * Render RPM arc gauge on canvas
     */
    renderRpmGauge() {
        if (!this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h - 10;
        const radius = 80;

        // Clear
        this.ctx.clearRect(0, 0, w, h);

        // Draw arc background
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, Math.PI, 0, false);
        this.ctx.lineWidth = 12;
        this.ctx.strokeStyle = '#1a2030';
        this.ctx.stroke();

        // Green arc (normal range)
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, Math.PI, Math.PI + (Math.PI * 0.7), false);
        this.ctx.lineWidth = 12;
        this.ctx.strokeStyle = 'rgba(0, 200, 0, 0.3)';
        this.ctx.stroke();

        // Yellow arc (caution)
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, Math.PI + (Math.PI * 0.7), Math.PI + (Math.PI * 0.85), false);
        this.ctx.lineWidth = 12;
        this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.3)';
        this.ctx.stroke();

        // Red arc (redline)
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, Math.PI + (Math.PI * 0.85), 0, false);
        this.ctx.lineWidth = 12;
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.stroke();

        // RPM needle
        const rpmPercent = Math.min(1, this.engine.rpm / this.engine.maxRpm);
        const needleAngle = Math.PI + (Math.PI * rpmPercent);

        // Determine needle color
        let needleColor = '#00ff00';
        if (rpmPercent > 0.85) {
            needleColor = '#ff4444';
        } else if (rpmPercent > 0.7) {
            needleColor = '#ffcc00';
        }

        // Draw active arc up to current RPM
        if (this.engine.rpm > 0) {
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, radius, Math.PI, needleAngle, false);
            this.ctx.lineWidth = 12;
            this.ctx.strokeStyle = needleColor;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // Draw needle line
        const needleLength = radius - 20;
        const nx = cx + Math.cos(needleAngle) * needleLength;
        const ny = cy + Math.sin(needleAngle) * needleLength;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(nx, ny);
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Center dot
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#333';
        this.ctx.fill();
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw tick marks
        for (let i = 0; i <= 10; i++) {
            const tickAngle = Math.PI + (Math.PI * i / 10);
            const innerR = radius - 18;
            const outerR = radius + 2;
            const x1 = cx + Math.cos(tickAngle) * innerR;
            const y1 = cy + Math.sin(tickAngle) * innerR;
            const x2 = cx + Math.cos(tickAngle) * outerR;
            const y2 = cy + Math.sin(tickAngle) * outerR;

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.lineWidth = i % 5 === 0 ? 2 : 1;
            this.ctx.strokeStyle = '#666';
            this.ctx.stroke();
        }
    }

    /**
     * Format number helper
     */
    formatNumber(value, decimals = 0) {
        if (value === undefined || value === null || isNaN(value)) return '--';
        return Number(value).toFixed(decimals);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngineMonitorWidget;
}
