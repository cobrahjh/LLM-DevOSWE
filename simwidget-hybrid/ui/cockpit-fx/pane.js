/**
 * CockpitFX Pane v2.2.0 — Compact avionics-style (320x200)
 * Canvas G-force ball, corner overlays, softkey controls.
 * v2.1: Async sample loading for engine/mechanical/ground layers.
 * v2.2: Per-layer volume/bass — LYRS selects layer, sliders follow.
 */
class CockpitFxPane extends SimGlassBase {
    constructor() {
        super({ widgetName: 'cockpit-fx', widgetVersion: '2.0.0', autoConnect: true });
        this.audioEngine = null;
        this.enabled = false;
        this.profile = localStorage.getItem('cockpit-fx-profile') || 'ga-single-piston';
        this._layers = {};
        this._layerNames = ['engine', 'aero', 'ground', 'mechanical', 'environment', 'warning', 'systems'];
        this._layerVols = { engine: 70, aero: 60, ground: 70, mechanical: 55, environment: 40, warning: 100, systems: 50 };
        this._layerBass = { engine: 0, aero: 0, ground: 0, mechanical: 0, environment: 0, warning: 0, systems: 0 };
        this._layerEnabled = { engine: true, aero: true, ground: true, mechanical: true, environment: true, warning: true, systems: true };
        // LYRS selection: -1 = MSTR, 0-6 = individual layers
        this._selectedLayerIdx = -1;
        this._layerShort = ['ENG', 'AERO', 'GND', 'MECH', 'ENV', 'WARN', 'SYS'];
        this._lastData = {};
        this._masterVol = 80;
        this._bassVol = 0;
        this._bassFreq = 120;
        this._cabinLevel = 0; // 0 = outside, 100 = fully sealed inside
        this._raf = null;
        this._prevGS = undefined;

        // Shake engine
        this.shakeEngine = null; // created after DOM cache

        // Profile short names for softkey
        this._profileKeys = Object.keys(COCKPIT_FX_PROFILES);
        this._profileShort = { 'ga-single-piston': 'GA SNGL', 'ga-twin-piston': 'GA TWIN', 'turboprop': 'TURBO', 'jet': 'JET' };

        this._cacheDOM();
        this._initCanvas();
        this.shakeEngine = new ShakeEngine(document.getElementById('widget-root'));
        this._bindUI();
        this._loadSettings();
        this._updateProfileBadge();
        this._startRenderLoop();
    }

    // --- DOM ---
    _cacheDOM() {
        this.el = {
            canvas: document.getElementById('cfx-canvas'),
            dot: document.getElementById('cfx-dot'),
            rpm: document.getElementById('cfx-rpm'),
            ias: document.getElementById('cfx-ias'),
            aoa: document.getElementById('cfx-aoa'),
            gvert: document.getElementById('cfx-gvert'),
            sfc: document.getElementById('cfx-sfc'),
            pitch: document.getElementById('cfx-pitch'),
            yaw: document.getElementById('cfx-yaw'),
            turb: document.getElementById('cfx-turb'),
            profileBadge: document.getElementById('cfx-profile-badge'),
            volLabel: document.querySelector('.cfx-strip .cfx-strip-lbl'),
            masterSlider: document.getElementById('fx-master-vol'),
            masterPct: document.getElementById('fx-master-pct'),
            bassLblEl: document.querySelectorAll('.cfx-strip .cfx-strip-lbl')[1],
            bassVolSlider: document.getElementById('fx-bass-vol'),
            bassVolLabel: document.getElementById('fx-bass-vol-val'),
            bassSlider: document.getElementById('fx-bass-freq'),
            bassFreqLabel: document.getElementById('fx-bass-freq-val'),
            cabinSlider: document.getElementById('fx-cabin-slider'),
            cabinVal: document.getElementById('fx-cabin-val'),
            cabinLbl: document.getElementById('fx-cabin-lbl'),
            skPower: document.getElementById('cfx-sk-power'),
            skProfile: document.getElementById('cfx-sk-profile'),
            skBassUp: document.getElementById('cfx-sk-bass-up'),
            skBassDn: document.getElementById('cfx-sk-bass-dn'),
            skLayers: document.getElementById('cfx-sk-layers'),
            skShake: document.getElementById('cfx-sk-shake'),
            status: document.getElementById('conn-status'),
            // Layer activity bar fills
            lbEngine: document.getElementById('cfx-lb-engine'),
            lbAero: document.getElementById('cfx-lb-aero'),
            lbGround: document.getElementById('cfx-lb-ground'),
            lbMech: document.getElementById('cfx-lb-mech'),
            lbEnv: document.getElementById('cfx-lb-env'),
            lbWarn: document.getElementById('cfx-lb-warn'),
            lbSys: document.getElementById('cfx-lb-sys'),
        };
    }

    // --- Canvas setup ---
    _initCanvas() {
        const c = this.el.canvas;
        if (!c) return;
        this._dpr = window.devicePixelRatio || 1;
        // Defer sizing until layout is computed (offsetWidth/Height can be 0 in constructor)
        const doSize = () => {
            const w = c.offsetWidth || 320;
            const h = c.offsetHeight || 134;
            c.width = w * this._dpr;
            c.height = h * this._dpr;
            this._ctx = c.getContext('2d');
            this._ctx.scale(this._dpr, this._dpr);
            this._cw = w;
            this._ch = h;
        };
        if (c.offsetWidth > 0 && c.offsetHeight > 0) {
            doSize();
        } else {
            requestAnimationFrame(doSize);
        }
    }

    // --- Render loop (canvas redraws at ~30fps) ---
    _startRenderLoop() {
        let lastDraw = 0;
        const loop = (ts) => {
            this._raf = requestAnimationFrame(loop);
            if (ts - lastDraw < 33) return; // cap 30fps
            lastDraw = ts;
            this._drawCanvas(this._lastData);
        };
        this._raf = requestAnimationFrame(loop);
    }

    // --- Canvas draw: G-force ball + crosshair + buffet ring ---
    _drawCanvas(d) {
        const ctx = this._ctx;
        if (!ctx) return;
        const w = this._cw, h = this._ch;
        const cx = w * 0.38, cy = h * 0.52; // center of G-ball area (left of layer bars)
        const radius = Math.min(w, h) * 0.32;

        // Clear
        ctx.fillStyle = '#050e1a';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,212,255,0.05)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
        for (let i = 0; i < h; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }

        // G-ball ring (limit circle)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Inner rings (0.5g, 1g marks)
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = 'rgba(0,230,118,0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();

        // G-force ball position (lateral G = X axis, longitudinal G = Y axis)
        const gLat = (d.accelY || 0) / 32.17;   // lateral
        const gLong = (d.accelX || 0) / 32.17;   // longitudinal
        const maxG = 0.5; // full deflection
        const ballX = cx + (gLat / maxG) * radius;
        const ballY = cy - (gLong / maxG) * radius; // inverted: forward = up

        // Clamp to circle
        const dx = ballX - cx, dy = ballY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let bx = ballX, by = ballY;
        if (dist > radius) {
            bx = cx + (dx / dist) * radius;
            by = cy + (dy / dist) * radius;
        }

        // Trail (fading previous position)
        if (this._prevBall) {
            ctx.beginPath();
            ctx.moveTo(this._prevBall[0], this._prevBall[1]);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = 'rgba(0,230,118,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        this._prevBall = [bx, by];

        // G-force ball
        const gMag = Math.sqrt(gLat * gLat + gLong * gLong);
        let ballColor = '#00E676';
        if (gMag > 0.3) ballColor = '#FF9100';
        if (gMag > 0.45) ballColor = '#FF1744';

        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = ballColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.strokeStyle = ballColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Buffet/stall ring (pulses red when approaching stall)
        const aoa = d.angleOfAttack || 0;
        const stallThresh = 16;
        const buffet = d.onGround ? 0 : Math.max(0, Math.min(1, (aoa - (stallThresh - 5)) / 5));
        if (buffet > 0.01) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,23,68,${buffet * 0.7})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Vertical G arc indicator (bottom of G-ball area)
        const gV = (d.accelZ || -32.17) / -32.17;
        const arcStart = Math.PI * 0.7;
        const arcEnd = Math.PI * 0.3;
        const arcRadius = radius + 10;
        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, arcStart, Math.PI * 2 + arcEnd);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Value arc (1G = center of range, 0-3G mapped to arc)
        const gNorm = Math.max(0, Math.min(1, gV / 3));
        const arcRange = (Math.PI * 2 + arcEnd) - arcStart;
        const arcVal = arcStart + gNorm * arcRange;
        let arcColor = '#00D4FF';
        if (gV > 1.8) arcColor = '#FF9100';
        if (gV > 2.5) arcColor = '#FF1744';
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, arcStart, arcVal);
        ctx.strokeStyle = arcColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // G value label on arc
        ctx.font = '700 8px "B612 Mono", Consolas, monospace';
        ctx.fillStyle = arcColor;
        ctx.textAlign = 'center';
        ctx.fillText(gV.toFixed(1) + 'G', cx, cy + arcRadius + 10);

        // Axis labels
        ctx.font = '600 6px "B612", sans-serif';
        ctx.fillStyle = '#3A4A5C';
        ctx.textAlign = 'center';
        ctx.fillText('LAT', cx, cy - radius - 4);
        ctx.textAlign = 'left';
        ctx.fillText('LONG', cx + radius + 4, cy + 2);
    }

    // --- UI bindings ---
    _bindUI() {
        // Power softkey (async — samples need to load on first click)
        this._audioLoading = false;
        this.el.skPower.addEventListener('click', async () => {
            if (this._audioLoading) return; // ignore clicks while loading
            if (!this.audioEngine) {
                this._audioLoading = true;
                this.el.skPower.textContent = 'LOAD';
                this.el.skPower.classList.add('loading');
                try {
                    await this._initAudio();
                } catch (e) {
                    console.warn('[CockpitFX] Audio init failed:', e);
                }
                this._audioLoading = false;
                this.el.skPower.classList.remove('loading');
            }
            this.enabled = !this.enabled;
            this.el.skPower.textContent = this.enabled ? 'ON' : 'OFF';
            this.el.skPower.classList.toggle('active', this.enabled);
            this.el.dot.className = 'cfx-status-dot ' + (this.enabled ? 'on' : 'off');
            if (this.enabled) {
                this.audioEngine.resume();
                this.audioEngine.setMasterVolume(this._masterVol / 100);
            } else {
                this.audioEngine.setMasterVolume(0);
            }
            this._saveSettings();
        });

        // Profile cycle softkey
        this.el.skProfile.addEventListener('click', () => {
            const idx = this._profileKeys.indexOf(this.profile);
            const next = (idx + 1) % this._profileKeys.length;
            this.profile = this._profileKeys[next];
            localStorage.setItem('cockpit-fx-profile', this.profile);
            this._applyProfile();
            this._updateProfileBadge();
            this._saveSettings();
        });

        // Perspective quick toggle (INT/EXT) — snaps cabin slider to 0 or 100
        this.el.skBassUp.addEventListener('click', () => {
            this._cabinLevel = this._cabinLevel > 50 ? 0 : 100;
            this.el.cabinSlider.value = this._cabinLevel;
            this.el.cabinVal.textContent = this._cabinLevel;
            this.el.skBassUp.textContent = this._cabinLevel > 50 ? 'INT' : 'EXT';
            this.el.skBassUp.classList.toggle('active', this._cabinLevel > 50);
            if (this.audioEngine) this.audioEngine.setCabinLevel(this._cabinLevel / 100);
            this._saveSettings();
        });

        // Cabin slider — continuous inside/outside blend
        this.el.cabinSlider.addEventListener('input', () => {
            this._cabinLevel = parseInt(this.el.cabinSlider.value);
            this.el.cabinVal.textContent = this._cabinLevel;
            this.el.skBassUp.textContent = this._cabinLevel > 50 ? 'INT' : 'EXT';
            this.el.skBassUp.classList.toggle('active', this._cabinLevel > 50);
            if (this.audioEngine) this.audioEngine.setCabinLevel(this._cabinLevel / 100);
            this._saveSettings();
        });

        // Bass LP frequency — click +10, right-click -10
        this.el.skBassDn.addEventListener('click', () => {
            this._bassFreq = Math.min(200, this._bassFreq + 10);
            this.el.bassFreqLabel.textContent = this._bassFreq;
            if (this.audioEngine) this.audioEngine.setBassFrequency(this._bassFreq);
            this._saveSettings();
        });
        this.el.skBassDn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._bassFreq = Math.max(60, this._bassFreq - 10);
            this.el.bassFreqLabel.textContent = this._bassFreq;
            if (this.audioEngine) this.audioEngine.setBassFrequency(this._bassFreq);
            this._saveSettings();
        });

        // Layers softkey — click cycles selection, right-click toggles on/off
        this.el.skLayers.addEventListener('click', () => {
            // Cycle: MSTR(-1) → ENG(0) → AERO(1) → ... → SYS(6) → MSTR(-1)
            this._selectedLayerIdx++;
            if (this._selectedLayerIdx > 6) this._selectedLayerIdx = -1;
            this._updateSliders();
            const label = this._selectedLayerIdx === -1 ? 'MSTR' : this._layerShort[this._selectedLayerIdx];
            this.el.skLayers.textContent = label;
        });
        this.el.skLayers.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this._selectedLayerIdx < 0) return; // can't toggle master
            const name = this._layerNames[this._selectedLayerIdx];
            this._layerEnabled[name] = !this._layerEnabled[name];
            if (this._layers[name]) this._layers[name].setEnabled(this._layerEnabled[name]);
            const short = this._layerShort[this._selectedLayerIdx];
            this.el.skLayers.textContent = short + (this._layerEnabled[name] ? '+' : '-');
            setTimeout(() => { this.el.skLayers.textContent = short; }, 600);
            this._saveSettings();
        });

        // Shake softkey — toggle shake on/off, long-press cycles intensity
        this.el.skShake.addEventListener('click', () => {
            if (!this.shakeEngine) return;
            const wasEnabled = this.shakeEngine.enabled;
            this.shakeEngine.setEnabled(!wasEnabled);
            this.el.skShake.classList.toggle('active', !wasEnabled);
            this.el.skShake.textContent = !wasEnabled ? 'SHKE' : 'SHKE';
            this._saveSettings();
        });
        this.el.skShake.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.shakeEngine) return;
            // Cycle intensity: 0.5 → 1.0 → 1.5 → 2.0 → 0.5
            const steps = [0.5, 1.0, 1.5, 2.0];
            const cur = this.shakeEngine.intensity;
            const idx = steps.findIndex(s => Math.abs(s - cur) < 0.1);
            const next = steps[(idx + 1) % steps.length];
            this.shakeEngine.setIntensity(next);
            this.el.skShake.textContent = 'I' + next.toFixed(1);
            setTimeout(() => { this.el.skShake.textContent = 'SHKE'; }, 800);
            this._saveSettings();
        });

        // VOL slider — controls master or selected layer
        this.el.masterSlider.addEventListener('input', () => {
            const val = parseInt(this.el.masterSlider.value);
            this.el.masterPct.textContent = val;
            if (this._selectedLayerIdx === -1) {
                // Master mode
                if (this.audioEngine) this.audioEngine.setMasterVolume(val / 100);
                this._masterVol = val;
            } else {
                // Per-layer mode
                const name = this._layerNames[this._selectedLayerIdx];
                this._layerVols[name] = val;
                if (this._layers[name]) this._layers[name].setVolume(val / 100);
            }
            this._saveSettings();
        });

        // BASS slider — controls bass shaker or selected layer bass
        this.el.bassVolSlider.addEventListener('input', () => {
            const val = parseInt(this.el.bassVolSlider.value);
            this.el.bassVolLabel.textContent = val;
            if (this._selectedLayerIdx === -1) {
                // Master bass shaker
                if (this.audioEngine) this.audioEngine.setBassVolume(val / 100);
                this._bassVol = val;
            } else {
                // Per-layer bass
                const name = this._layerNames[this._selectedLayerIdx];
                this._layerBass[name] = val;
            }
            this._saveSettings();
        });
    }

    /** Update sliders and labels to reflect selected layer or master */
    _updateSliders() {
        if (this._selectedLayerIdx === -1) {
            // Master mode
            if (this.el.volLabel) this.el.volLabel.textContent = 'VOL';
            if (this.el.bassLblEl) this.el.bassLblEl.textContent = 'BASS';
            this.el.masterSlider.value = this._masterVol !== undefined ? this._masterVol : this.el.masterSlider.value;
            this.el.masterPct.textContent = this.el.masterSlider.value;
            this.el.bassVolSlider.value = this._bassVol !== undefined ? this._bassVol : this.el.bassVolSlider.value;
            this.el.bassVolLabel.textContent = this.el.bassVolSlider.value;
        } else {
            // Per-layer mode
            const name = this._layerNames[this._selectedLayerIdx];
            const short = this._layerShort[this._selectedLayerIdx];
            if (this.el.volLabel) this.el.volLabel.textContent = short;
            if (this.el.bassLblEl) this.el.bassLblEl.textContent = short + ' B';
            this.el.masterSlider.value = this._layerVols[name];
            this.el.masterPct.textContent = this._layerVols[name];
            this.el.bassVolSlider.value = this._layerBass[name];
            this.el.bassVolLabel.textContent = this._layerBass[name];
        }
    }

    _updateProfileBadge() {
        const p = COCKPIT_FX_PROFILES[this.profile];
        if (this.el.profileBadge) this.el.profileBadge.textContent = p ? p.name.split('(')[0].trim().toUpperCase() : 'UNKNOWN';
        if (this.el.skProfile) this.el.skProfile.textContent = this._profileShort[this.profile] || 'PROF';
    }

    // --- Audio Init (async — loads samples before creating layers) ---
    async _initAudio() {
        this.audioEngine = new AudioEngine();

        // Load samples (non-blocking — layers fall back to synthesis if any fail)
        await this.audioEngine.loadSamples({
            'engine':         'samples/engine.ogg',
            'engine-idle':    'samples/engine-idle.ogg',
            'engine-start':   'samples/engine-start.ogg',
            'engine-crank':   'samples/engine-crank.ogg',
            'flaps-motor':    'samples/flaps-motor.ogg',
            'flaps-click':    'samples/flaps-click.ogg',
            'trim':           'samples/trim.ogg',
            'tires-asphalt':  'samples/tires-rolling-asphalt.ogg',
            'tires-gravel':   'samples/tires-rolling-gravel.ogg',
            'tire-screech':   'samples/tires-screech-asphalt.ogg',
            'ap-disconnect':  'samples/kap140-disengage.ogg'
        });

        const p = COCKPIT_FX_PROFILES[this.profile] || COCKPIT_FX_PROFILES['ga-single-piston'];

        this._layers.engine = new EngineLayer(this.audioEngine, p);
        this._layers.aero = new AeroLayer(this.audioEngine, p);
        this._layers.ground = new GroundLayer(this.audioEngine, p);
        this._layers.mechanical = new MechanicalLayer(this.audioEngine, p);
        this._layers.environment = new EnvironmentLayer(this.audioEngine, p);
        this._layers.warning = new WarningLayer(this.audioEngine, p);
        this._layers.systems = new SystemsLayer(this.audioEngine, p);

        const layerPan = { engine: 0, aero: 0, ground: 0, mechanical: 0.15, environment: -0.1, warning: 0, systems: 0 };
        for (const name in this._layers) {
            this.audioEngine.addLayer(name, this._layers[name], layerPan[name] || 0);
            this._layers[name].setVolume(this._layerVols[name] / 100);
            this._layers[name].setEnabled(this._layerEnabled[name]);
        }

        this.audioEngine.setMasterVolume(this._masterVol / 100);
        this.audioEngine.setBassFrequency(this._bassFreq);
        this.audioEngine.setBassVolume(this._bassVol / 100);
        this.audioEngine.setCabinLevel(this._cabinLevel / 100);
    }

    _applyProfile() {
        const p = COCKPIT_FX_PROFILES[this.profile];
        if (!p) return;
        for (const name of this._layerNames) {
            if (p.layers && p.layers[name] !== undefined) {
                this._layerVols[name] = Math.round(p.layers[name] * 100);
                if (this._layers[name]) {
                    this._layers[name].setVolume(p.layers[name]);
                    if (this._layers[name].setProfile) this._layers[name].setProfile(p);
                }
            }
        }
    }

    // --- WebSocket Data ---
    onMessage(msg) {
        if (msg.type !== 'flightData') return;
        const d = msg.data || msg;
        this._lastData = d;

        if (this.enabled && this.audioEngine) {
            this.audioEngine.update(d);
            // Feed door/canopy openness to cabin filter
            const openness = Math.max(
                d.canopyOpen || 0,
                d.exitOpen0 || 0, d.exitOpen1 || 0,
                d.exitOpen2 || 0, d.exitOpen3 || 0
            );
            this.audioEngine.setCabinOpenness(openness);
        }

        // Shake engine: inject _prevGS for braking detection
        d._prevGS = this._prevGS;
        if (this.shakeEngine) this.shakeEngine.update(d);
        this._prevGS = d.groundSpeed || 0;

        this._updateDataStrip(d);
        this._updateCorners(d);
        this._updateLayerBars(d);
    }

    // --- ROW 1: Data strip ---
    _updateDataStrip(d) {
        const SURFACES = ['CONC', 'GRAS', 'TURF', 'DIRT', 'GRVL', 'ASPH', 'BITM', 'BRCK', 'MCDM', 'SAND', 'SHLE', 'SNOW', 'ICE', 'WATR'];
        if (this.el.rpm) this.el.rpm.textContent = Math.round(d.engineRpm || 0);
        if (this.el.ias) this.el.ias.textContent = Math.round(d.speed || 0);
        if (this.el.aoa) {
            const aoa = d.angleOfAttack || 0;
            this.el.aoa.textContent = aoa.toFixed(1);
            this.el.aoa.className = 'cfx-data-val' + (aoa > 13 ? ' warn' : '') + (aoa > 16 ? ' danger' : '');
        }
        if (this.el.gvert) {
            const gV = d.accelZ ? Math.abs(d.accelZ / 32.17) : 1.0;
            this.el.gvert.textContent = gV.toFixed(2);
            this.el.gvert.className = 'cfx-data-val' + (gV > 1.8 ? ' warn' : '') + (gV > 2.5 ? ' danger' : '');
        }
        if (this.el.sfc) this.el.sfc.textContent = SURFACES[d.surfaceType] || '---';
    }

    // --- Corner overlays ---
    _updateCorners(d) {
        const pitchRate = (d.rotVelX || 0) * 57.2958;
        const yawRate = (d.rotVelZ || 0) * 57.2958;
        const ws = d.windSpeed || 0;
        const accelMag = Math.sqrt(Math.pow(d.accelX || 0, 2) + Math.pow(d.accelY || 0, 2));
        const turb = d.onGround ? 0 : Math.min(100, Math.round(((ws > 10 ? (ws - 10) / 40 : 0) + accelMag / 15) * 100));

        if (this.el.pitch) {
            this.el.pitch.textContent = pitchRate.toFixed(1) + '\u00B0/s';
            this.el.pitch.className = 'cfx-corner-val' + (Math.abs(pitchRate) > 8 ? ' warn' : '');
        }
        if (this.el.yaw) {
            this.el.yaw.textContent = yawRate.toFixed(1) + '\u00B0/s';
            this.el.yaw.className = 'cfx-corner-val' + (Math.abs(yawRate) > 5 ? ' warn' : '');
        }
        if (this.el.turb) {
            this.el.turb.textContent = turb + '%';
            this.el.turb.className = 'cfx-corner-val' + (turb > 50 ? ' warn' : turb > 0 ? ' cyan' : ' cyan');
        }
    }

    // --- Layer activity bars ---
    _updateLayerBars(d) {
        // Engine: activity = throttle * engineRunning
        const eng = d.engineRunning ? (d.throttle || 0) / 100 : 0;
        this._setLBar(this.el.lbEngine, eng, this._layerEnabled.engine);

        // Aero: wind noise intensity
        const aero = d.onGround ? 0 : Math.min(1, Math.pow((d.speed || 0) / 200, 2));
        this._setLBar(this.el.lbAero, aero, this._layerEnabled.aero);

        // Ground: taxi activity
        const gnd = d.onGround && (d.groundSpeed || 0) > 2 ? Math.min(1, (d.groundSpeed || 0) / 30) : 0;
        this._setLBar(this.el.lbGround, gnd, this._layerEnabled.ground);

        // Mechanical: gear/flap transit
        const gearTransit = [d.gearPos0, d.gearPos1, d.gearPos2].some(p => p > 0.01 && p < 0.99);
        this._setLBar(this.el.lbMech, gearTransit ? 0.8 : 0, this._layerEnabled.mechanical);

        // Environment: precip
        const env = (d.precipState || 0) > 0 ? 0.6 : 0;
        this._setLBar(this.el.lbEnv, env, this._layerEnabled.environment);

        // Warning: any active warnings
        const warn = (d.stallWarning || d.overspeedWarning || ((d.throttle || 100) < 15 && !d.gearDown && (d.altitudeAGL || 999) < 500)) ? 1 : 0;
        this._setLBar(this.el.lbWarn, warn, this._layerEnabled.warning);

        // Systems: avionics hum + radio static (active when engine running)
        const sys = d.engineRunning ? 0.5 : 0;
        this._setLBar(this.el.lbSys, sys, this._layerEnabled.systems);
    }

    _setLBar(el, intensity, enabled) {
        if (!el) return;
        const pct = Math.round(Math.max(0, Math.min(1, intensity)) * 100);
        el.style.width = (enabled ? pct : 0) + '%';
        el.className = 'cfx-lbar-fill' + (enabled ? '' : ' off');
    }

    // --- Settings Persistence ---
    _saveSettings() {
        const s = {
            masterVol: this._masterVol !== undefined ? this._masterVol : 80,
            bassFreq: this._bassFreq,
            bassVol: this._bassVol !== undefined ? this._bassVol : 0,
            cabinLevel: this._cabinLevel,
            layerVols: this._layerVols,
            layerBass: this._layerBass,
            layerEnabled: this._layerEnabled,
            profile: this.profile,
            shakeEnabled: this.shakeEngine ? this.shakeEngine.enabled : false,
            shakeIntensity: this.shakeEngine ? this.shakeEngine.intensity : 1.0
        };
        localStorage.setItem('cockpit-fx-settings', JSON.stringify(s));
    }

    _loadSettings() {
        const raw = localStorage.getItem('cockpit-fx-settings');
        if (!raw) return;
        try {
            const s = JSON.parse(raw);
            if (s.masterVol !== undefined) {
                this._masterVol = parseInt(s.masterVol);
                this.el.masterSlider.value = this._masterVol;
                this.el.masterPct.textContent = this._masterVol;
            }
            if (s.bassFreq) {
                this._bassFreq = s.bassFreq;
                this.el.bassFreqLabel.textContent = s.bassFreq;
            }
            if (s.bassVol !== undefined) {
                this._bassVol = parseInt(s.bassVol);
                this.el.bassVolSlider.value = this._bassVol;
                this.el.bassVolLabel.textContent = this._bassVol;
            }
            const _safe = o => { if (o) { delete o.__proto__; delete o.constructor; delete o.prototype; } return o; };
            if (s.layerVols) Object.assign(this._layerVols, _safe(s.layerVols));
            if (s.layerBass) Object.assign(this._layerBass, _safe(s.layerBass));
            if (s.layerEnabled) Object.assign(this._layerEnabled, _safe(s.layerEnabled));
            if (s.cabinLevel !== undefined) {
                this._cabinLevel = parseInt(s.cabinLevel);
                this.el.cabinSlider.value = this._cabinLevel;
                this.el.cabinVal.textContent = this._cabinLevel;
                this.el.skBassUp.textContent = this._cabinLevel > 50 ? 'INT' : 'EXT';
                this.el.skBassUp.classList.toggle('active', this._cabinLevel > 50);
            } else if (s.perspective) {
                // Migrate old binary setting
                this._cabinLevel = s.perspective === 'inside' ? 100 : 0;
                this.el.cabinSlider.value = this._cabinLevel;
                this.el.cabinVal.textContent = this._cabinLevel;
                this.el.skBassUp.textContent = this._cabinLevel > 50 ? 'INT' : 'EXT';
                this.el.skBassUp.classList.toggle('active', this._cabinLevel > 50);
            }
            if (s.profile) this.profile = s.profile;
            if (this.shakeEngine) {
                if (s.shakeEnabled !== undefined) {
                    this.shakeEngine.setEnabled(s.shakeEnabled);
                    if (this.el.skShake) this.el.skShake.classList.toggle('active', s.shakeEnabled);
                }
                if (s.shakeIntensity !== undefined) this.shakeEngine.setIntensity(s.shakeIntensity);
            }
        } catch (e) {
            console.warn('[CockpitFX] Failed to load settings:', e);
        }
    }

    destroy() {
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this.shakeEngine) {
            this.shakeEngine.destroy();
            this.shakeEngine = null;
        }
        if (this.audioEngine) {
            this.audioEngine.destroy();
            this.audioEngine = null;
        }
        super.destroy();
    }
}
