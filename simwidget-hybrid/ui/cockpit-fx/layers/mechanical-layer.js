/**
 * CockpitFX MechanicalLayer v1.0.0
 * Gear motor, gear lock thunk, flap motor, trim servo, AP disconnect.
 */
class MechanicalLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;

        // Previous frame values for change detection
        this._prevGear = [null, null, null];
        this._prevFlap = null;
        this._prevAP = null;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Gear motor: oscillator at 350 Hz (hydraulic pump sound)
        this.gearOsc = this.ctx.createOscillator();
        this.gearOsc.type = 'sawtooth';
        this.gearOsc.frequency.value = 350;
        this.gearFilter = this.ctx.createBiquadFilter();
        this.gearFilter.type = 'bandpass';
        this.gearFilter.frequency.value = 400;
        this.gearFilter.Q.value = 3;
        this.gearGain = this.ctx.createGain();
        this.gearGain.gain.value = 0;
        this.gearOsc.connect(this.gearFilter);
        this.gearFilter.connect(this.gearGain);
        this.gearGain.connect(this.output);
        this.gearOsc.start();

        // Flap motor: 400 Hz buzz
        this.flapOsc = this.ctx.createOscillator();
        this.flapOsc.type = 'square';
        this.flapOsc.frequency.value = 400;
        this.flapFilter = this.ctx.createBiquadFilter();
        this.flapFilter.type = 'lowpass';
        this.flapFilter.frequency.value = 500;
        this.flapGain = this.ctx.createGain();
        this.flapGain.gain.value = 0;
        this.flapOsc.connect(this.flapFilter);
        this.flapFilter.connect(this.flapGain);
        this.flapGain.connect(this.output);
        this.flapOsc.start();
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.03;

        // Gear motor: active when any gear is in transit (not 0 or 100)
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
        this.gearGain.gain.setTargetAtTime(gearMoving ? 0.25 : 0, t, tau);

        // Flap motor: active when flap position is changing
        const flap = data.flapPercent;
        let flapMoving = false;
        if (flap !== undefined && this._prevFlap !== null) {
            flapMoving = Math.abs(flap - this._prevFlap) > 0.1;
        }
        this._prevFlap = flap;
        this.flapGain.gain.setTargetAtTime(flapMoving ? 0.2 : 0, t, tau);

        // AP disconnect transient
        const apNow = data.apMaster;
        if (this._prevAP === true && apNow === false) {
            this._triggerAPDisconnect();
        }
        this._prevAP = apNow;
    }

    _triggerThunk() {
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
        try { this.gearOsc.stop(); } catch (e) {}
        try { this.flapOsc.stop(); } catch (e) {}
    }
}
