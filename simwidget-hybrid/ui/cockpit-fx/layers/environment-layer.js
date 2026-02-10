/**
 * CockpitFX EnvironmentLayer v1.0.0
 * Rain, heavy rain windscreen hits, hail/ice percussive pops.
 * Uses precipState from sim data (bit flags: 2=rain, 4=snow/ice).
 */
class EnvironmentLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Rain: broadband noise → bandpass 100-500 Hz
        this.rainNoise = engine.createNoiseSource();
        this.rainFilter = this.ctx.createBiquadFilter();
        this.rainFilter.type = 'bandpass';
        this.rainFilter.frequency.value = 300;
        this.rainFilter.Q.value = 0.5;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0;
        this.rainNoise.connect(this.rainFilter);
        this.rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.output);

        // Heavy rain / windscreen hits: higher band
        this.heavyNoise = engine.createNoiseSource();
        this.heavyFilter = this.ctx.createBiquadFilter();
        this.heavyFilter.type = 'bandpass';
        this.heavyFilter.frequency.value = 600;
        this.heavyFilter.Q.value = 1;
        this.heavyGain = this.ctx.createGain();
        this.heavyGain.gain.value = 0;
        this.heavyNoise.connect(this.heavyFilter);
        this.heavyFilter.connect(this.heavyGain);
        this.heavyGain.connect(this.output);

        // Hail transient generator
        this._hailInterval = null;
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.1;

        // precipState is a bit-field; approximate from available data
        // For now use windSpeed + altitude as proxy (real precip data TBD)
        const precip = data.precipState || 0;
        const hasRain = (precip & 2) !== 0;
        const hasIce = (precip & 4) !== 0;

        // Rain
        this.rainGain.gain.setTargetAtTime(hasRain ? 0.25 : 0, t, tau);
        this.heavyGain.gain.setTargetAtTime(hasRain ? 0.15 : 0, t, tau);

        // Hail pops
        if (hasIce && !this._hailInterval) {
            this._startHail();
        } else if (!hasIce && this._hailInterval) {
            this._stopHail();
        }
    }

    _startHail() {
        this._hailInterval = setInterval(() => {
            if (!this._enabled) return;
            // Random percussive pop: 500-2000 Hz, very short
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 500 + Math.random() * 1500;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15 + Math.random() * 0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.connect(gain);
            gain.connect(this.output);
            osc.start(t);
            osc.stop(t + 0.04);
        }, 50 + Math.random() * 60); // ~10-20 pops/second
    }

    _stopHail() {
        clearInterval(this._hailInterval);
        this._hailInterval = null;
    }

    setVolume(v) {
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        if (!b) this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }

    destroy() {
        try { this.rainNoise.stop(); } catch (e) {}
        try { this.heavyNoise.stop(); } catch (e) {}
        this._stopHail();
    }
}
