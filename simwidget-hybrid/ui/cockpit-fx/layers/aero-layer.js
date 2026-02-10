/**
 * CockpitFX AeroLayer v1.0.0
 * Wind noise (broadband filtered), stall buffet, turbulence shake.
 */
class AeroLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.profile = profile;
        this._enabled = true;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Wind noise: white noise → lowpass (cutoff tracks IAS) → gain
        this.windNoise = engine.createNoiseSource();
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 50;
        this.windFilter.Q.value = 0.5;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.windNoise.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.output);

        // Stall buffet: LFO-modulated noise
        this.buffetNoise = engine.createNoiseSource();
        this.buffetFilter = this.ctx.createBiquadFilter();
        this.buffetFilter.type = 'lowpass';
        this.buffetFilter.frequency.value = 20;
        this.buffetFilter.Q.value = 1;
        this.buffetGain = this.ctx.createGain();
        this.buffetGain.gain.value = 0;
        this.buffetLfo = this.ctx.createOscillator();
        this.buffetLfo.type = 'sine';
        this.buffetLfo.frequency.value = 10;
        this.buffetLfoGain = this.ctx.createGain();
        this.buffetLfoGain.gain.value = 0;
        this.buffetLfo.connect(this.buffetLfoGain);
        this.buffetLfoGain.connect(this.buffetGain.gain);
        this.buffetNoise.connect(this.buffetFilter);
        this.buffetFilter.connect(this.buffetGain);
        this.buffetGain.connect(this.output);
        this.buffetLfo.start();

        // Turbulence: low-frequency modulated rumble
        this.turbNoise = engine.createNoiseSource();
        this.turbFilter = this.ctx.createBiquadFilter();
        this.turbFilter.type = 'lowpass';
        this.turbFilter.frequency.value = 8;
        this.turbFilter.Q.value = 0.7;
        this.turbGain = this.ctx.createGain();
        this.turbGain.gain.value = 0;
        this.turbNoise.connect(this.turbFilter);
        this.turbFilter.connect(this.turbGain);
        this.turbGain.connect(this.output);
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.08;

        const ias = data.speed || 0;
        const onGround = data.onGround;
        const aoa = data.angleOfAttack || 0;
        const windSpd = data.windSpeed || 0;
        const stallThreshold = (this.profile.stall && this.profile.stall.aoaThreshold) || 16;

        // Wind noise — scales with IAS², only meaningful airborne
        const windAmp = onGround ? 0 : Math.min(1.0, Math.pow(ias / 200, 2));
        const windCutoff = 50 + ias * 2;
        this.windFilter.frequency.setTargetAtTime(Math.min(windCutoff, 4000), t, tau);
        this.windGain.gain.setTargetAtTime(windAmp * 0.4, t, tau);

        // Stall buffet — ramps over 5° AOA range approaching stall
        const buffetStart = stallThreshold - 5;
        let buffetAmp = 0;
        if (!onGround && aoa > buffetStart) {
            buffetAmp = Math.min(1.0, (aoa - buffetStart) / 5);
        }
        const buffetFreq = (this.profile.stall && this.profile.stall.buffetFreq) || 12;
        this.buffetLfo.frequency.setTargetAtTime(buffetFreq, t, tau);
        this.buffetLfoGain.gain.setTargetAtTime(buffetAmp * 0.6, t, tau);
        this.buffetGain.gain.setTargetAtTime(buffetAmp * 0.3, t, tau);

        // Turbulence — driven by wind speed and body accelerations
        let turbAmp = 0;
        if (!onGround && windSpd > 10) {
            turbAmp = Math.min(0.5, (windSpd - 10) / 40);
            // Add accel-based component if available
            const accelMag = Math.sqrt(
                Math.pow(data.accelX || 0, 2) + Math.pow(data.accelY || 0, 2)
            );
            turbAmp = Math.min(1.0, turbAmp + accelMag / 10);
        }
        this.turbGain.gain.setTargetAtTime(turbAmp * 0.3, t, tau);
    }

    setVolume(v) {
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        if (!b) this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }

    setProfile(p) { this.profile = p; }

    destroy() {
        try { this.windNoise.stop(); } catch (e) {}
        try { this.buffetNoise.stop(); } catch (e) {}
        try { this.buffetLfo.stop(); } catch (e) {}
        try { this.turbNoise.stop(); } catch (e) {}
    }
}
