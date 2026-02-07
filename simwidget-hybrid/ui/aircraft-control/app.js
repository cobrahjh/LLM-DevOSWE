/**
 * SimGlass Shared UI JavaScript
 * v1.2 - Added settings panel and telemetry
 * 
 * Connects to backend via WebSocket for real-time flight data
 * Works in both browser and MSFS toolbar panel
 */

class SimGlassApp {
    constructor() {
        this.ws = null;
        this.reconnectInterval = null;
        this.serverUrl = this.detectServerUrl();
        this.axisPadDragging = false;
        
        // Widget info
        this.widgetName = 'aircraft-control';
        this.widgetVersion = '1.2.0';
        
        // Auto-detection for aircraft-specific controls
        this.controlDetection = {
            throttle: { samples: [], detected: false, visible: true },
            propeller: { samples: [], detected: false, visible: true },
            mixture: { samples: [], detected: false, visible: true }
        };
        this.detectionComplete = false;
        
        // AxisPad configuration
        this.axisConfig = {
            invertAileron: true,
            invertElevator: false
        };
        
        this.sensitivity = 0.5;
        
        // Initialize telemetry
        this.initTelemetry();
        
        // Initialize settings panel
        this.initSettings();
        
        this.init();
    }
    
    initTelemetry() {
        if (typeof TelemetryService !== 'undefined') {
            this.telemetry = new TelemetryService({
                widget: this.widgetName,
                version: this.widgetVersion,
                supabaseUrl: window.SimGlass_SUPABASE_URL || '',
                supabaseKey: window.SimGlass_SUPABASE_KEY || ''
            });
        }
    }
    
    initSettings() {
        if (typeof SettingsPanel !== 'undefined') {
            this.settings = new SettingsPanel();
            
            // Register feedback section
            if (typeof FeedbackSection !== 'undefined' && this.telemetry) {
                const feedbackSection = new FeedbackSection(this.telemetry);
                this.settings.registerSection('feedback', feedbackSection.getConfig());
            }
            
            // Register preferences section
            this.settings.registerSection('preferences', {
                title: 'Preferences',
                icon: '🎛️',
                render: () => this.renderPreferencesSection(),
                onMount: (container) => this.bindPreferences(container)
            });
            
            // Register about section
            this.settings.registerSection('about', {
                title: 'About',
                icon: 'ℹ️',
                render: () => this.renderAboutSection()
            });
            
            // Bind settings button
            const btn = document.getElementById('settings-btn');
            if (btn) {
                btn.addEventListener('click', () => this.settings.toggle());
            }
        }
    }
    
    renderPreferencesSection() {
        return `
            <div class="pref-section">
                <div class="pref-row">
                    <label>Invert Aileron</label>
                    <input type="checkbox" id="pref-invert-ail" ${this.axisConfig.invertAileron ? 'checked' : ''}>
                </div>
                <div class="pref-row">
                    <label>Invert Elevator</label>
                    <input type="checkbox" id="pref-invert-elv" ${this.axisConfig.invertElevator ? 'checked' : ''}>
                </div>
                <div class="pref-row">
                    <label>Sensitivity: ${Math.round(this.sensitivity * 100)}%</label>
                    <input type="range" id="pref-sensitivity" min="10" max="100" value="${this.sensitivity * 100}">
                </div>
            </div>
        `;
    }
    
    bindPreferences(container) {
        container.querySelector('#pref-invert-ail')?.addEventListener('change', (e) => {
            this.axisConfig.invertAileron = e.target.checked;
        });
        container.querySelector('#pref-invert-elv')?.addEventListener('change', (e) => {
            this.axisConfig.invertElevator = e.target.checked;
        });
        container.querySelector('#pref-sensitivity')?.addEventListener('input', (e) => {
            this.sensitivity = parseInt(e.target.value) / 100;
        });
    }
    
    renderAboutSection() {
        const stats = this.telemetry ? this.telemetry.getStats() : { uniqueErrors: 0, totalErrors: 0 };
        return `
            <div class="about-section">
                <p><strong>Aircraft Control Widget</strong></p>
                <p>Version: ${this.widgetVersion}</p>
                <p>Session Errors: ${stats.uniqueErrors}</p>
                <hr style="border-color: #3f3f46; margin: 12px 0;">
                <p style="color: #52525b; font-size: 11px;">SimGlass Engine © 2025</p>
            </div>
        `;
    }

    detectServerUrl() {
        // Use location.host for remote access, 127.0.0.1 for local
        const host = location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'ws://127.0.0.1:8080';
        }
        return `ws://${location.host}`;
    }
    
    init() {
        this.setupButtons();
        this.setupCameraButtons();
        this.connect();
        this.updateConnectionStatus('connecting');
    }
    
    connect() {
        console.log(`Connecting to ${this.serverUrl}...`);
        
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected');
                
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'flightData') {
                        this.updateUI(msg.data);
                    }
                } catch (e) {
                    console.error('Message parse error:', e);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.updateConnectionStatus('disconnected');
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
            };
            
        } catch (e) {
            console.error('WebSocket connection failed:', e);
            this.updateConnectionStatus('disconnected');
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                console.log('Attempting reconnect...');
                this.connect();
            }, 3000);
        }
    }
    
    updateConnectionStatus(status) {
        const el = document.getElementById('conn-status');
        if (!el) return;
        
        el.classList.remove('connected', 'disconnected', 'connecting');
        el.classList.add(status === 'connected' ? 'connected' : '');
        el.title = status === 'connected' ? 'Connected to MSFS' : 
                   status === 'mock' ? 'Mock Mode (no MSFS)' : 
                   status === 'connecting' ? 'Connecting...' : 'Disconnected';
    }
    
    updateUI(data) {
        if (data.connected) {
            this.updateConnectionStatus('connected');
        } else {
            this.updateConnectionStatus('mock');
        }
        
        if (!this.detectionComplete && data.connected) {
            this.detectAircraftControls(data);
        }
        
        // Flight Data
        this.setText('data-alt', Math.round(data.altitude).toLocaleString() + ' ft');
        this.setText('data-spd', Math.round(data.speed) + ' kts');
        this.setText('data-hdg', Math.round(data.heading).toString().padStart(3, '0') + '°');
        
        // V/S with color coding
        const vs = Math.round(data.verticalSpeed);
        const vsEl = document.getElementById('data-vs');
        if (vsEl) {
            vsEl.textContent = vs.toLocaleString() + ' fpm';
            vsEl.classList.remove('highlight-cyan', 'highlight-green', 'highlight-red');
            if (vs > 100) {
                vsEl.classList.add('highlight-green');
            } else if (vs < -100) {
                vsEl.classList.add('highlight-red');
            } else {
                vsEl.classList.add('highlight-cyan');
            }
        }
        
        // Systems
        this.setIndicator('btn-brk', data.parkingBrake);
        this.setIndicator('btn-gear', data.gearDown);
        this.setIndicator('btn-flaps', data.flapsIndex > 0);
        
        // Lights
        this.setIndicator('btn-nav', data.navLight);
        this.setIndicator('btn-bcn', data.beaconLight);
        this.setIndicator('btn-strb', data.strobeLight);
        this.setIndicator('btn-ldg', data.landingLight);
        this.setIndicator('btn-taxi', data.taxiLight);
        
        // Engine
        const engEl = document.getElementById('data-eng');
        if (engEl) {
            engEl.textContent = data.engineRunning ? 'RUNNING' : 'OFF';
            engEl.classList.remove('highlight-red', 'highlight-green');
            engEl.classList.add(data.engineRunning ? 'highlight-green' : 'highlight-red');
        }
        
        // Engine Levers
        this.setLever('lever-thr', 'val-thr', data.throttle);
        this.setLever('lever-prop', 'val-prop', data.propeller);
        this.setLever('lever-mix', 'val-mix', data.mixture);
        
        // Autopilot
        this.setIndicator('btn-ap', data.apMaster);
        this.setIndicator('btn-hdg', data.apHdgLock);
        this.setIndicator('btn-alt', data.apAltLock);
        this.setIndicator('btn-vs', data.apVsLock);
        this.setIndicator('btn-spd', data.apSpdLock);
        
        // AP values
        this.setApValue('ap-hdg', 'ap-hdg-slider', Math.round(data.apHdgSet), '°', true);
        this.setApValue('ap-alt', 'ap-alt-slider', Math.round(data.apAltSet), '', false, true);
        this.setApValue('ap-vs', 'ap-vs-slider', Math.round(data.apVsSet), '', false, true);
        this.setApValue('ap-spd', 'ap-spd-slider', Math.round(data.apSpdSet), '', false);
        
        // Flight Controls
        this.setFlightControl('fc-rud', 'val-rud', data.rudder);
        
        // AxisPad display
        if (!this.axisPadDragging) {
            const ailDisplay = document.getElementById('axispad-ail');
            const elvDisplay = document.getElementById('axispad-elv');
            if (ailDisplay) ailDisplay.textContent = Math.round(data.aileron);
            if (elvDisplay) elvDisplay.textContent = Math.round(data.elevator);
        }
        
        // Fuel
        this.setText('fuel-total', data.fuelTotal.toFixed(1) + ' gal');
        this.setText('fuel-flow', data.fuelFlow.toFixed(1) + ' gph');
        this.setText('fuel-left', data.fuelLeft.toFixed(1) + ' gal');
        this.setText('fuel-right', data.fuelRight.toFixed(1) + ' gal');
        
        // Endurance
        if (data.fuelFlow > 0.1) {
            const endurHrs = data.fuelTotal / data.fuelFlow;
            const h = Math.floor(endurHrs);
            const m = Math.floor((endurHrs - h) * 60);
            this.setText('fuel-endur', h + ':' + m.toString().padStart(2, '0'));
        } else {
            this.setText('fuel-endur', '--:--');
        }
        
        // Time
        const hrs = data.localTime;
        const h = Math.floor(hrs);
        const m = Math.floor((hrs - h) * 60);
        this.setText('sim-time', h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0'));
    }
    
    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    setIndicator(id, isOn) {
        const el = document.getElementById(id);
        if (!el) return;
        
        const led = el.querySelector('.status-led');
        if (led) {
            led.classList.remove('on', 'off');
            led.classList.add(isOn ? 'on' : 'off');
        }
        el.classList.toggle('active', isOn);
    }
    
    setLever(sliderId, valueId, value) {
        const slider = document.getElementById(sliderId);
        const valueEl = document.getElementById(valueId);
        const val = Math.round(value);
        
        if (slider && document.activeElement !== slider) {
            slider.value = val;
        }
        if (valueEl) {
            valueEl.textContent = val + '%';
        }
    }
    
    setApValue(textId, sliderId, value, suffix = '', padZeros = false, localeNum = false) {
        const textEl = document.getElementById(textId);
        const slider = document.getElementById(sliderId);
        
        if (textEl) {
            let displayVal = value;
            if (padZeros) displayVal = value.toString().padStart(3, '0');
            else if (localeNum) displayVal = value.toLocaleString();
            textEl.textContent = displayVal + suffix;
        }
        
        if (slider && document.activeElement !== slider) {
            slider.value = value;
        }
    }
    
    setFlightControl(sliderId, valueId, value) {
        const slider = document.getElementById(sliderId);
        const valueEl = document.getElementById(valueId);
        const val = Math.round(value);
        
        if (slider && document.activeElement !== slider) {
            slider.value = val;
        }
        if (valueEl) {
            valueEl.textContent = val;
        }
    }
    
    setupButtons() {
        // All buttons with data-cmd
        document.querySelectorAll('.control-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.sendCommand(cmd);
            });
        });
        
        // AP adjustment buttons (press-and-hold)
        document.querySelectorAll('.ap-adj-btn[data-cmd]').forEach(btn => {
            let holdInterval = null;
            let holdTimeout = null;
            
            const startHold = () => {
                const cmd = btn.dataset.cmd;
                this.sendCommand(cmd);
                
                holdTimeout = setTimeout(() => {
                    holdInterval = setInterval(() => {
                        this.sendCommand(cmd);
                    }, 100);
                }, 400);
            };
            
            const stopHold = () => {
                if (holdTimeout) clearTimeout(holdTimeout);
                if (holdInterval) clearInterval(holdInterval);
                holdTimeout = null;
                holdInterval = null;
            };
            
            btn.addEventListener('mousedown', startHold);
            btn.addEventListener('mouseup', stopHold);
            btn.addEventListener('mouseleave', stopHold);
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); });
            btn.addEventListener('touchend', stopHold);
            btn.addEventListener('touchcancel', stopHold);
        });
        
        // Engine levers
        document.querySelectorAll('.lever[data-cmd]').forEach(lever => {
            lever.addEventListener('input', () => {
                const cmd = lever.dataset.cmd;
                const value = parseInt(lever.value);
                this.sendCommand(cmd, value);
            });
        });
        
        // AP sliders
        document.querySelectorAll('.ap-slider[data-cmd]').forEach(slider => {
            slider.addEventListener('input', () => {
                const cmd = slider.dataset.cmd;
                const value = parseInt(slider.value);
                this.sendCommand(cmd, value);
            });
        });
        
        // Rudder slider
        const rudder = document.getElementById('fc-rud');
        if (rudder) {
            rudder.addEventListener('input', () => {
                const cmd = rudder.dataset.cmd;
                const rawValue = parseInt(rudder.value);
                const value = Math.round(rawValue * this.sensitivity);
                this.sendCommand(cmd, value);
            });
            
            rudder.addEventListener('mouseup', () => {
                rudder.value = 0;
                this.sendCommand(rudder.dataset.cmd, 0);
            });
        }
        
        // Flaps toggle
        const flapsBtn = document.getElementById('btn-flaps');
        if (flapsBtn) {
            flapsBtn.addEventListener('click', () => {
                const led = flapsBtn.querySelector('.status-led');
                const isOn = led && led.classList.contains('on');
                this.sendCommand(isOn ? 'FLAPS_UP' : 'FLAPS_DOWN');
            });
        }
        
        // AxisPad setup
        this.setupAxisPad();
        
        // Sensitivity slider
        this.setupSensitivity();
    }
    
    setupCameraButtons() {
        // Camera system buttons
        document.querySelectorAll('.camera-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                try {
                    const res = await fetch(`/api/camsys/${action}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await res.json();
                    console.log(`[Camera] ${action}:`, data);
                    
                    // Update button states
                    document.querySelectorAll('.camera-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                } catch (e) {
                    console.error('Camera command failed:', e);
                }
            });
        });
    }
    
    setupSensitivity() {
        const slider = document.getElementById('fc-sensitivity');
        const valueDisplay = document.getElementById('sens-value');
        
        if (!slider) return;
        
        slider.value = this.sensitivity * 100;
        if (valueDisplay) valueDisplay.textContent = Math.round(this.sensitivity * 100) + '%';
        
        slider.addEventListener('input', () => {
            this.sensitivity = parseInt(slider.value) / 100;
            if (valueDisplay) valueDisplay.textContent = slider.value + '%';
        });
    }
    
    setupAxisPad() {
        const axispad = document.getElementById('axispad-yoke');
        const knob = document.getElementById('axispad-knob');
        const ailDisplay = document.getElementById('axispad-ail');
        const elvDisplay = document.getElementById('axispad-elv');
        
        if (!axispad || !knob) return;
        
        let isDragging = false;
        let padRect = null;
        const self = this;
        
        const updateKnobPosition = (clientX, clientY) => {
            if (!padRect) padRect = axispad.getBoundingClientRect();
            
            const centerX = padRect.left + padRect.width / 2;
            const centerY = padRect.top + padRect.height / 2;
            
            let offsetX = clientX - centerX;
            let offsetY = clientY - centerY;
            
            const maxOffset = (padRect.width / 2) - 20;
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            
            if (distance > maxOffset) {
                const scale = maxOffset / distance;
                offsetX *= scale;
                offsetY *= scale;
            }
            
            const aileronSign = self.axisConfig.invertAileron ? -1 : 1;
            const elevatorSign = self.axisConfig.invertElevator ? -1 : 1;
            
            const rawAileron = Math.round(aileronSign * (offsetX / maxOffset) * 100);
            const rawElevator = Math.round(elevatorSign * (-offsetY / maxOffset) * 100);
            
            const aileron = Math.round(rawAileron * self.sensitivity);
            const elevator = Math.round(rawElevator * self.sensitivity);
            
            const knobX = 50 + (offsetX / maxOffset) * 40;
            const knobY = 50 - (offsetY / maxOffset) * 40;
            knob.style.left = knobX + '%';
            knob.style.top = knobY + '%';
            
            if (ailDisplay) ailDisplay.textContent = aileron;
            if (elvDisplay) elvDisplay.textContent = elevator;
            
            this.sendCommand('AXIS_AILERONS_SET', aileron);
            this.sendCommand('AXIS_ELEVATOR_SET', elevator);
        };
        
        const centerKnob = () => {
            knob.style.left = '50%';
            knob.style.top = '50%';
            if (ailDisplay) ailDisplay.textContent = '0';
            if (elvDisplay) elvDisplay.textContent = '0';
            this.sendCommand('AXIS_AILERONS_SET', 0);
            this.sendCommand('AXIS_ELEVATOR_SET', 0);
        };
        
        axispad.addEventListener('mousedown', (e) => {
            isDragging = true;
            self.axisPadDragging = true;
            padRect = axispad.getBoundingClientRect();
            updateKnobPosition(e.clientX, e.clientY);
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) updateKnobPosition(e.clientX, e.clientY);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                self.axisPadDragging = false;
                centerKnob();
            }
        });
        
        axispad.addEventListener('touchstart', (e) => {
            isDragging = true;
            self.axisPadDragging = true;
            padRect = axispad.getBoundingClientRect();
            const touch = e.touches[0];
            updateKnobPosition(touch.clientX, touch.clientY);
            e.preventDefault();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                const touch = e.touches[0];
                updateKnobPosition(touch.clientX, touch.clientY);
            }
        });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                self.axisPadDragging = false;
                centerKnob();
            }
        });
    }
    
    detectAircraftControls(data) {
        const cd = this.controlDetection;
        const SAMPLE_COUNT = 20;
        
        cd.throttle.samples.push(data.throttle);
        cd.propeller.samples.push(data.propeller);
        cd.mixture.samples.push(data.mixture);
        
        if (cd.throttle.samples.length < SAMPLE_COUNT) return;
        
        const analyzeControl = (samples) => {
            const min = Math.min(...samples);
            const max = Math.max(...samples);
            const variance = max - min;
            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            return { min, max, variance, avg };
        };
        
        const propStats = analyzeControl(cd.propeller.samples);
        const mixStats = analyzeControl(cd.mixture.samples);
        
        cd.throttle.visible = true;
        cd.propeller.visible = !(propStats.variance < 0.5 && propStats.avg > 99);
        cd.mixture.visible = !(mixStats.variance < 0.5 && mixStats.avg < 1);
        
        this.applyControlVisibility();
        this.detectionComplete = true;
    }
    
    applyControlVisibility() {
        const cd = this.controlDetection;
        
        document.querySelectorAll('.lever-item').forEach(item => {
            const lever = item.querySelector('.lever');
            if (!lever) return;
            
            let visible = true;
            if (lever.id === 'lever-prop') visible = cd.propeller.visible;
            else if (lever.id === 'lever-mix') visible = cd.mixture.visible;
            
            item.style.display = visible ? '' : 'none';
        });
    }
    
    sendCommand(command, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: command,
                value: value
            }));
        } else {
            fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, value })
            }).catch(e => console.error('Command failed:', e));
        }
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    window.SimGlass = new SimGlassApp();
});
