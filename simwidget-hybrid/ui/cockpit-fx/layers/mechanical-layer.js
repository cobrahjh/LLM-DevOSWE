/**
 * CockpitFX MechanicalLayer v2.0.0
 * Sample-based gear motor, gear lock thunk, flap motor, trim servo, AP disconnect.
 * Falls back to oscillator synthesis when samples unavailable.
 */
class MechanicalLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;
        this._vol = 1;

        // Previous frame values for change detection
        this._prevGear = [null, null, null];
        this._prevFlap = null;
        this._prevTrim = null;
        this._prevAP = null;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Check which samples are available
        this._hasFlapsMotor = !!engine.getSample('flaps-motor');
        this._hasFlapsClick = !!engine.getSample('flaps-click');
        this._hasTrim = !!engine.getSample('trim');
        this._hasAPDisconnect = !!engine.getSample('ap-disconnect');

        // Active looping sources (managed for start/stop)
        this._gearMotorSrc = null;
        this._gearMotorGain = null;
        this._flapMotorSrc = null;
        this._flapMotorGain = null;
        this._trimSrc = null;
        this._trimGain = null;

        // Oscillator fallbacks (only created if no samples)
        this.gearOsc = null;
        this.gearGain = null;
        this.flapOsc = null;
        this.flapGain = null;

        if (!this._hasFlapsMotor) {
            // Gear motor fallback: oscillator at 350 Hz
            this.gearOsc = this.ctx.createOscillator();
            this.gearOsc.type = 'sawtooth';
            this.gearOsc.frequency.value = 350;
            const gearFilter = this.ctx.createBiquadFilter();
            gearFilter.type = 'bandpass';
            gearFilter.frequency.value = 400;
            gearFilter.Q.value = 3;
            this.gearGain = this.ctx.createGain();
            this.gearGain.gain.value = 0;
            this.gearOsc.connect(gearFilter);
            gearFilter.connect(this.gearGain);
            this.gearGain.connect(this.output);
            this.gearOsc.start();
            this._gearFilter = gearFilter;

            // Flap motor fallback: 400 Hz buzz
            this.flapOsc = this.ctx.createOscillator();
            this.flapOsc.type = 'square';
            this.flapOsc.frequency.value = 400;
            const flapFilter = this.ctx.createBiquadFilter();
            flapFilter.type = 'lowpass';
            flapFilter.frequency.value = 500;
            this.flapGain = this.ctx.createGain();
            this.flapGain.gain.value = 0;
            this.flapOsc.connect(flapFilter);
            flapFilter.connect(this.flapGain);
            this.flapGain.connect(this.output);
            this.flapOsc.start();
            this._flapFilter = flapFilter;
        }
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.03;

        // --- Gear motor: active when any gear is in transit ---
        const gears = [data.gearPos0, data.gearPos1, data.gearPos2];
        let gearMoving = false;
        for (let i = 0; i < 3; i++) {
            const pos = gears[i];
            if (pos !== undefined && pos !== null) {
                const inTransit = pos > 0.01 && pos < 0.99;
                if (inTransit) gearMoving = true;

                // Gear lock thunk: position just reached 0 or 1
                if (this._prevGear[i] !== null) {
                    const wasTransit = this._prevGear[i] > 0.01 && this._prevGear[i] < 0.99;
                    const nowLocked = pos <= 0.01 || pos >= 0.99;
                    if (wasTransit && nowLocked) this._triggerThunk();
                }
                this._prevGear[i] = pos;
            }
        }

        if (this._hasFlapsMotor) {
            // Sample-based gear motor
            if (gearMoving && !this._gearMotorSrc) {
                this._startGearMotor();
            } else if (!gearMoving && this._gearMotorSrc) {
                this._stopGearMotor();
            }
        } else {
            // Oscillator fallback
            this.gearGain.gain.setTargetAtTime(gearMoving ? 0.25 : 0, t, tau);
        }

        // --- Flap motor: active when flap position is changing ---
        const flap = data.flapPercent;
        let flapMoving = false;
        if (flap !== undefined && this._prevFlap !== null) {
            flapMoving = Math.abs(flap - this._prevFlap) > 0.1;
        }
        this._prevFlap = flap;

        if (this._hasFlapsMotor) {
            if (flapMoving && !this._flapMotorSrc) {
                this._startFlapMotor();
            } else if (!flapMoving && this._flapMotorSrc) {
                this._stopFlapMotor();
            }
        } else {
            this.flapGain.gain.setTargetAtTime(flapMoving ? 0.2 : 0, t, tau);
        }

        // --- Trim servo: active when trim position is changing ---
        if (this._hasTrim) {
            const trim = data.elevatorTrim;
            let trimMoving = false;
            if (trim !== undefined && this._prevTrim !== null) {
                trimMoving = Math.abs(trim - this._prevTrim) > 0.001;
            }
            this._prevTrim = trim;

            if (trimMoving && !this._trimSrc) {
                this._startTrimServo();
            } else if (!trimMoving && this._trimSrc) {
                this._stopTrimServo();
            }
        }

        // --- AP disconnect transient ---
        const apNow = data.apMaster;
        if (this._prevAP === true && apNow === false) {
            this._triggerAPDisconnect();
        }
        this._prevAP = apNow;
    }

    // --- Sample-based motor start/stop ---

    _startGearMotor() {
        this._gearMotorSrc = this.engine.createSampleSource('flaps-motor', true);
        if (!this._gearMotorSrc) return;
        this._gearMotorGain = this.ctx.createGain();
        this._gearMotorGain.gain.value = 0.3;
        this._gearMotorSrc.connect(this._gearMotorGain);
        this._gearMotorGain.connect(this.output);
        this._gearMotorSrc.start();
    }

    _stopGearMotor() {
        if (this._gearMotorSrc) {
            try { this._gearMotorSrc.stop(); } catch (e) {}
            this._gearMotorSrc = null;
            this._gearMotorGain = null;
        }
    }

    _startFlapMotor() {
        this._flapMotorSrc = this.engine.createSampleSource('flaps-motor', true);
        if (!this._flapMotorSrc) return;
        this._flapMotorGain = this.ctx.createGain();
        this._flapMotorGain.gain.value = 0.25;
        this._flapMotorSrc.connect(this._flapMotorGain);
        this._flapMotorGain.connect(this.output);
        this._flapMotorSrc.start();
    }

    _stopFlapMotor() {
        if (this._flapMotorSrc) {
            try { this._flapMotorSrc.stop(); } catch (e) {}
            this._flapMotorSrc = null;
            this._flapMotorGain = null;
        }
    }

    _startTrimServo() {
        this._trimSrc = this.engine.createSampleSource('trim', true);
        if (!this._trimSrc) return;
        this._trimGain = this.ctx.createGain();
        this._trimGain.gain.value = 0.15;
        this._trimSrc.connect(this._trimGain);
        this._trimGain.connect(this.output);
        this._trimSrc.start();
    }

    _stopTrimServo() {
        if (this._trimSrc) {
            try { this._trimSrc.stop(); } catch (e) {}
            this._trimSrc = null;
            this._trimGain = null;
        }
    }

    // --- One-shot triggers ---

    _triggerThunk() {
        if (this._hasFlapsClick) {
            this.engine.playOneShot('flaps-click', this.output, 0.5);
            return;
        }
        // Synthetic fallback
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 80;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this.output);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    _triggerAPDisconnect() {
        if (this._hasAPDisconnect) {
            this.engine.playOneShot('ap-disconnect', this.output, 0.5);
            return;
        }
        // Synthetic fallback
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 200;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.output);
        osc.start(t);
        osc.stop(t + 0.17);
    }

    setVolume(v) {
        this._vol = v;
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        const t = this.ctx.currentTime;
        this.output.gain.setTargetAtTime(b ? (this._vol || 1) : 0, t, 0.05);
    }

    destroy() {
        if (this.gearOsc) try { this.gearOsc.stop(); } catch (e) {}
        if (this.flapOsc) try { this.flapOsc.stop(); } catch (e) {}
        this._stopGearMotor();
        this._stopFlapMotor();
        this._stopTrimServo();
    }
}
