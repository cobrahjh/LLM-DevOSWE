/**
 * CockpitFX Pane v1.0.0
 * Real-time cockpit immersion engine — audio synthesis from SimVar data.
 * Extends SimGlassBase for WebSocket connectivity.
 *
 * Motion effects: visual bars showing G-forces, pitch/yaw rates, buffet
 * intensity, turbulence level — all derived from live SimVars.
 */
class CockpitFxPane extends SimGlassBase {
    constructor() {
        super({ widgetName: 'cockpit-fx', widgetVersion: '1.0.0', autoConnect: true });
        this.audioEngine = null;
        this.enabled = false;
        this.profile = localStorage.getItem('cockpit-fx-profile') || 'ga-single-piston';
        this._layers = {};
        this._lastData = {};

        this._cacheDOM();
        this._bindUI();
        this._loadSettings();
        this._updateProfileDropdown();
    }

    // --- DOM ---
    _cacheDOM() {
        this.el = {
            masterToggle: document.getElementById('fx-master-toggle'),
            masterSlider: document.getElementById('fx-master-vol'),
            masterPct: document.getElementById('fx-master-pct'),
            profileSelect: document.getElementById('fx-profile'),
            bassSlider: document.getElementById('fx-bass-freq'),
            bassFreqLabel: document.getElementById('fx-bass-freq-val'),
            bassVolSlider: document.getElementById('fx-bass-vol'),
            bassVolLabel: document.getElementById('fx-bass-vol-val'),
            status: document.getElementById('conn-status'),
            // Data readout
            dataRpm: document.getElementById('fx-d-rpm'),
            dataIas: document.getElementById('fx-d-ias'),
            dataAoa: document.getElementById('fx-d-aoa'),
            dataG: document.getElementById('fx-d-g'),
            dataSurface: document.getElementById('fx-d-surface'),
            dataGear: document.getElementById('fx-d-gear'),
            dataFlaps: document.getElementById('fx-d-flaps'),
            // Motion bars
            motionGLong: document.getElementById('fx-m-glong'),
            motionGLat: document.getElementById('fx-m-glat'),
            motionGVert: document.getElementById('fx-m-gvert'),
            motionPitch: document.getElementById('fx-m-pitch'),
            motionYaw: document.getElementById('fx-m-yaw'),
            motionBuffet: document.getElementById('fx-m-buffet'),
            motionTurb: document.getElementById('fx-m-turb'),
            motionGLongVal: document.getElementById('fx-mv-glong'),
            motionGLatVal: document.getElementById('fx-mv-glat'),
            motionGVertVal: document.getElementById('fx-mv-gvert'),
            motionPitchVal: document.getElementById('fx-mv-pitch'),
            motionYawVal: document.getElementById('fx-mv-yaw'),
            motionBuffetVal: document.getElementById('fx-mv-buffet'),
            motionTurbVal: document.getElementById('fx-mv-turb'),
        };
        // Layer rows: each has slider, checkbox, pct label
        this._layerNames = ['engine', 'aero', 'ground', 'mechanical', 'environment', 'warning'];
        this._layerEls = {};
        for (const name of this._layerNames) {
            this._layerEls[name] = {
                slider: document.getElementById(`fx-vol-${name}`),
                toggle: document.getElementById(`fx-en-${name}`),
                pct: document.getElementById(`fx-pct-${name}`)
            };
        }
    }

    _bindUI() {
        // Master toggle — first click initializes AudioContext
        this.el.masterToggle.addEventListener('click', () => {
            if (!this.audioEngine) {
                this._initAudio();
            }
            this.enabled = !this.enabled;
            this.el.masterToggle.textContent = this.enabled ? 'ON' : 'OFF';
            this.el.masterToggle.classList.toggle('active', this.enabled);
            if (this.enabled) this.audioEngine.resume();
            this._saveSettings();
        });

        // Master volume
        this.el.masterSlider.addEventListener('input', () => {
            const v = this.el.masterSlider.value / 100;
            this.el.masterPct.textContent = this.el.masterSlider.value + '%';
            if (this.audioEngine) this.audioEngine.setMasterVolume(v);
            this._saveSettings();
        });

        // Profile
        this.el.profileSelect.addEventListener('change', () => {
            this.profile = this.el.profileSelect.value;
            localStorage.setItem('cockpit-fx-profile', this.profile);
            this._applyProfile();
        });

        // Bass filter frequency
        this.el.bassSlider.addEventListener('input', () => {
            const f = parseInt(this.el.bassSlider.value);
            this.el.bassFreqLabel.textContent = f + ' Hz';
            if (this.audioEngine) this.audioEngine.setBassFrequency(f);
            this._saveSettings();
        });

        // Bass volume
        this.el.bassVolSlider.addEventListener('input', () => {
            const v = this.el.bassVolSlider.value / 100;
            this.el.bassVolLabel.textContent = this.el.bassVolSlider.value + '%';
            if (this.audioEngine) this.audioEngine.setBassVolume(v);
            this._saveSettings();
        });

        // Per-layer sliders and toggles
        for (const name of this._layerNames) {
            const els = this._layerEls[name];
            if (els.slider) {
                els.slider.addEventListener('input', () => {
                    const v = els.slider.value / 100;
                    if (els.pct) els.pct.textContent = els.slider.value + '%';
                    if (this._layers[name]) this._layers[name].setVolume(v);
                    this._saveSettings();
                });
            }
            if (els.toggle) {
                els.toggle.addEventListener('change', () => {
                    if (this._layers[name]) this._layers[name].setEnabled(els.toggle.checked);
                    this._saveSettings();
                });
            }
        }
    }

    // --- Audio Init ---
    _initAudio() {
        this.audioEngine = new AudioEngine();
        const p = COCKPIT_FX_PROFILES[this.profile] || COCKPIT_FX_PROFILES['ga-single-piston'];

        this._layers.engine = new EngineLayer(this.audioEngine, p);
        this._layers.aero = new AeroLayer(this.audioEngine, p);
        this._layers.ground = new GroundLayer(this.audioEngine, p);
        this._layers.mechanical = new MechanicalLayer(this.audioEngine, p);
        this._layers.environment = new EnvironmentLayer(this.audioEngine, p);
        this._layers.warning = new WarningLayer(this.audioEngine, p);

        for (const name in this._layers) {
            this.audioEngine.addLayer(name, this._layers[name]);
            // Apply saved volumes
            const els = this._layerEls[name];
            if (els && els.slider) {
                this._layers[name].setVolume(els.slider.value / 100);
            }
            if (els && els.toggle) {
                this._layers[name].setEnabled(els.toggle.checked);
            }
        }

        // Apply saved master/bass
        this.audioEngine.setMasterVolume(this.el.masterSlider.value / 100);
        this.audioEngine.setBassFrequency(parseInt(this.el.bassSlider.value));
        this.audioEngine.setBassVolume(this.el.bassVolSlider.value / 100);
    }

    _applyProfile() {
        const p = COCKPIT_FX_PROFILES[this.profile];
        if (!p) return;
        // Update layer default volumes from profile
        for (const name of this._layerNames) {
            if (p.layers && p.layers[name] !== undefined) {
                const els = this._layerEls[name];
                if (els && els.slider) {
                    els.slider.value = Math.round(p.layers[name] * 100);
                    if (els.pct) els.pct.textContent = els.slider.value + '%';
                }
                if (this._layers[name]) {
                    this._layers[name].setVolume(p.layers[name]);
                    if (this._layers[name].setProfile) this._layers[name].setProfile(p);
                }
            }
        }
    }

    _updateProfileDropdown() {
        const sel = this.el.profileSelect;
        sel.innerHTML = '';
        for (const key in COCKPIT_FX_PROFILES) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = COCKPIT_FX_PROFILES[key].name;
            if (key === this.profile) opt.selected = true;
            sel.appendChild(opt);
        }
    }

    // --- WebSocket Data ---
    onMessage(msg) {
        if (msg.type !== 'flightData' || !this.enabled) return;
        const d = msg.data || msg;
        this._lastData = d;

        // Feed audio engine
        if (this.audioEngine) this.audioEngine.update(d);

        // Update data readout
        this._updateDataReadout(d);

        // Update motion bars
        this._updateMotionBars(d);
    }

    // --- Data Readout ---
    _updateDataReadout(d) {
        const SURFACES = ['Concrete', 'Grass', 'Turf', 'Dirt', 'Gravel', 'Asphalt', 'Bitum', 'Brick', 'Macadam', 'Sand', 'Shale', 'Snow', 'Ice', 'Water'];
        if (this.el.dataRpm) this.el.dataRpm.textContent = Math.round(d.engineRpm || 0);
        if (this.el.dataIas) this.el.dataIas.textContent = Math.round(d.speed || 0) + 'kt';
        if (this.el.dataAoa) this.el.dataAoa.textContent = (d.angleOfAttack || 0).toFixed(1) + '\u00B0';
        // G-force: accelZ in ft/s², 1G = -32.17 ft/s²
        const gForce = d.accelZ ? Math.abs(d.accelZ / 32.17) : 1.0;
        if (this.el.dataG) this.el.dataG.textContent = gForce.toFixed(2) + 'G';
        if (this.el.dataSurface) this.el.dataSurface.textContent = SURFACES[d.surfaceType] || 'Unknown';
        if (this.el.dataGear) this.el.dataGear.textContent = d.gearDown ? 'DOWN' : 'UP';
        if (this.el.dataFlaps) this.el.dataFlaps.textContent = Math.round(d.flapPercent || 0) + '%';
    }

    // --- Motion Bars (visual G-force / rate indicators) ---
    _updateMotionBars(d) {
        // Longitudinal G (accelX): braking/acceleration, ±0.5g range
        const gLong = (d.accelX || 0) / 32.17;
        this._setMotionBar('motionGLong', 'motionGLongVal', gLong, -0.5, 0.5, 'g', 0.3);

        // Lateral G (accelY): turning/sideslip, ±0.3g range
        const gLat = (d.accelY || 0) / 32.17;
        this._setMotionBar('motionGLat', 'motionGLatVal', gLat, -0.3, 0.3, 'g', 0.2);

        // Vertical G (accelZ): normal is -1g, range 0 to -3g
        const gVert = (d.accelZ || -32.17) / -32.17;
        this._setMotionBar('motionGVert', 'motionGVertVal', gVert, 0, 3, 'G', 1.8);

        // Pitch rate (rotVelX): rad/s → deg/s
        const pitchRate = (d.rotVelX || 0) * 57.2958;
        this._setMotionBar('motionPitch', 'motionPitchVal', pitchRate, -15, 15, '\u00B0/s', 8);

        // Yaw rate (rotVelZ): rad/s → deg/s
        const yawRate = (d.rotVelZ || 0) * 57.2958;
        this._setMotionBar('motionYaw', 'motionYawVal', yawRate, -10, 10, '\u00B0/s', 5);

        // Buffet intensity: from AOA proximity to stall
        const stallThresh = 16;
        const buffetStart = stallThresh - 5;
        const aoa = d.angleOfAttack || 0;
        const buffet = d.onGround ? 0 : Math.max(0, Math.min(1, (aoa - buffetStart) / 5));
        this._setMotionBar('motionBuffet', 'motionBuffetVal', buffet, 0, 1, '', 0.5);

        // Turbulence: from wind and accel
        const ws = d.windSpeed || 0;
        const accelMag = Math.sqrt(Math.pow(d.accelX || 0, 2) + Math.pow(d.accelY || 0, 2));
        const turb = d.onGround ? 0 : Math.min(1, (ws > 10 ? (ws - 10) / 40 : 0) + accelMag / 15);
        this._setMotionBar('motionTurb', 'motionTurbVal', turb, 0, 1, '', 0.5);
    }

    /**
     * Update a motion bar element.
     * @param {string} barKey - element key for the fill bar
     * @param {string} valKey - element key for the value label
     * @param {number} value - current value
     * @param {number} min - range min
     * @param {number} max - range max
     * @param {string} unit - display unit
     * @param {number} warnThresh - absolute value where bar turns warning color
     */
    _setMotionBar(barKey, valKey, value, min, max, unit, warnThresh) {
        const bar = this.el[barKey];
        const label = this.el[valKey];
        if (!bar) return;

        // Normalize to 0-100% width
        const range = max - min;
        const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
        bar.style.width = pct + '%';

        // Color classes
        const absVal = Math.abs(value);
        bar.className = 'fx-motion-fill';
        if (warnThresh > 0) {
            if (absVal > warnThresh * 1.5) bar.classList.add('danger');
            else if (absVal > warnThresh) bar.classList.add('warn');
        }

        if (label) {
            const displayVal = Math.abs(value) < 10 ? value.toFixed(2) : Math.round(value);
            label.textContent = displayVal + (unit ? ' ' + unit : '');
        }
    }

    // --- Settings Persistence ---
    _saveSettings() {
        const settings = {
            masterVol: this.el.masterSlider.value,
            bassFreq: this.el.bassSlider.value,
            bassVol: this.el.bassVolSlider.value,
            layers: {}
        };
        for (const name of this._layerNames) {
            const els = this._layerEls[name];
            settings.layers[name] = {
                vol: els.slider ? els.slider.value : 70,
                en: els.toggle ? els.toggle.checked : true
            };
        }
        localStorage.setItem('cockpit-fx-settings', JSON.stringify(settings));
    }

    _loadSettings() {
        const raw = localStorage.getItem('cockpit-fx-settings');
        if (!raw) return;
        try {
            const s = JSON.parse(raw);
            if (s.masterVol) {
                this.el.masterSlider.value = s.masterVol;
                this.el.masterPct.textContent = s.masterVol + '%';
            }
            if (s.bassFreq) {
                this.el.bassSlider.value = s.bassFreq;
                this.el.bassFreqLabel.textContent = s.bassFreq + ' Hz';
            }
            if (s.bassVol) {
                this.el.bassVolSlider.value = s.bassVol;
                this.el.bassVolLabel.textContent = s.bassVol + '%';
            }
            if (s.layers) {
                for (const name of this._layerNames) {
                    const ls = s.layers[name];
                    const els = this._layerEls[name];
                    if (ls && els) {
                        if (els.slider && ls.vol !== undefined) {
                            els.slider.value = ls.vol;
                            if (els.pct) els.pct.textContent = ls.vol + '%';
                        }
                        if (els.toggle && ls.en !== undefined) {
                            els.toggle.checked = ls.en;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[CockpitFX] Failed to load settings:', e);
        }
    }

    destroy() {
        if (this.audioEngine) {
            this.audioEngine.destroy();
            this.audioEngine = null;
        }
        super.destroy();
    }
}
