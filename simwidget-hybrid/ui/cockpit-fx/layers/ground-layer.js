/**
 * CockpitFX GroundLayer v1.0.0
 * Taxi rumble, touchdown impact, braking vibration, surface texture.
 */
class GroundLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;
        this._prevOnGround = null;
        this._prevGS = 0;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Taxi rumble: noise → bandpass (center tracks ground speed) → gain
        this.taxiNoise = engine.createNoiseSource();
        this.taxiFilter = this.ctx.createBiquadFilter();
        this.taxiFilter.type = 'bandpass';
        this.taxiFilter.frequency.value = 30;
        this.taxiFilter.Q.value = 0.8;
        this.taxiGain = this.ctx.createGain();
        this.taxiGain.gain.value = 0;
        this.taxiNoise.connect(this.taxiFilter);
        this.taxiFilter.connect(this.taxiGain);
        this.taxiGain.connect(this.output);

        // Surface texture overlay: separate filtered noise for grass/gravel
        this.surfaceNoise = engine.createNoiseSource();
        this.surfaceFilter = this.ctx.createBiquadFilter();
        this.surfaceFilter.type = 'bandpass';
        this.surfaceFilter.frequency.value = 100;
        this.surfaceFilter.Q.value = 1;
        this.surfaceGain = this.ctx.createGain();
        this.surfaceGain.gain.value = 0;
        this.surfaceNoise.connect(this.surfaceFilter);
        this.surfaceFilter.connect(this.surfaceGain);
        this.surfaceGain.connect(this.output);

        // Braking vibration: low-frequency oscillator
        this.brakeOsc = this.ctx.createOscillator();
        this.brakeOsc.type = 'sine';
        this.brakeOsc.frequency.value = 5;
        this.brakeGain = this.ctx.createGain();
        this.brakeGain.gain.value = 0;
        this.brakeOsc.connect(this.brakeGain);
        this.brakeGain.connect(this.output);
        this.brakeOsc.start();

        // Touchdown transient oscillator (reusable)
        this._touchdownTimeout = null;
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.05;

        const onGround = data.onGround;
        const gs = data.groundSpeed || 0;
        const vs = data.verticalSpeed || 0;
        const surfType = data.surfaceType || 0;

        // Detect touchdown: was airborne, now on ground
        if (this._prevOnGround === false && onGround === true) {
            this._triggerTouchdown(vs);
        }
        this._prevOnGround = onGround;

        // Taxi rumble — only on ground, scales with ground speed
        if (onGround && gs > 2) {
            const taxiAmp = Math.min(0.7, gs / 30);
            const taxiFreq = 5 + gs * 0.8;
            this.taxiFilter.frequency.setTargetAtTime(Math.min(taxiFreq, 150), t, tau);
            this.taxiGain.gain.setTargetAtTime(taxiAmp * 0.4, t, tau);
        } else {
            this.taxiGain.gain.setTargetAtTime(0, t, tau);
        }

        // Surface texture
        if (onGround && gs > 2) {
            let surfAmp = 0;
            let surfFreq = 100;
            if (surfType === 0 || surfType === 1) {
                // Concrete/Asphalt — smooth, higher freq, low amp
                surfFreq = 50 + gs * 1.5;
                surfAmp = 0.1;
            } else if (surfType === 2 || surfType === 3) {
                // Grass/Turf — low freq, bumpy
                surfFreq = 5 + gs * 0.5;
                surfAmp = 0.35;
            } else if (surfType >= 4) {
                // Dirt/Gravel/Other — wide band, rough
                surfFreq = 20 + gs;
                surfAmp = 0.45;
            }
            this.surfaceFilter.frequency.setTargetAtTime(surfFreq, t, tau);
            this.surfaceGain.gain.setTargetAtTime(surfAmp, t, tau);
        } else {
            this.surfaceGain.gain.setTargetAtTime(0, t, tau);
        }

        // Braking vibration — ground speed decreasing
        const decel = this._prevGS - gs;
        if (onGround && decel > 0.5 && gs > 3) {
            const brakeAmp = Math.min(0.5, decel / 10);
            this.brakeOsc.frequency.setTargetAtTime(3 + decel, t, tau);
            this.brakeGain.gain.setTargetAtTime(brakeAmp * 0.3, t, tau);
        } else {
            this.brakeGain.gain.setTargetAtTime(0, t, tau);
        }
        this._prevGS = gs;
    }

    _triggerTouchdown(vs) {
        const impactForce = Math.min(1.0, Math.abs(vs) / 500);
        if (impactForce < 0.05) return;

        const t = this.ctx.currentTime;
        // Main gear impact: 80 Hz transient, sharp attack, 300ms decay
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 80;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(impactForce * 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.output);
        osc.start(t);
        osc.stop(t + 0.35);

        // Nose wheel drop: 200ms later, 60 Hz, softer
        const noseOsc = this.ctx.createOscillator();
        noseOsc.type = 'sine';
        noseOsc.frequency.value = 60;
        const noseGain = this.ctx.createGain();
        noseGain.gain.setValueAtTime(0, t + 0.2);
        noseGain.gain.linearRampToValueAtTime(impactForce * 0.25, t + 0.21);
        noseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        noseOsc.connect(noseGain);
        noseGain.connect(this.output);
        noseOsc.start(t + 0.2);
        noseOsc.stop(t + 0.45);
    }

    setVolume(v) {
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        if (!b) this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }

    destroy() {
        try { this.taxiNoise.stop(); } catch (e) {}
        try { this.surfaceNoise.stop(); } catch (e) {}
        try { this.brakeOsc.stop(); } catch (e) {}
        if (this._touchdownTimeout) clearTimeout(this._touchdownTimeout);
    }
}
