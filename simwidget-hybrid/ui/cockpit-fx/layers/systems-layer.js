/**
 * CockpitFX SystemsLayer v1.0.0
 * Avionics electrical hum (120Hz AC bus + 400Hz gyro) and COM radio static.
 * Constant background texture that makes the cockpit feel alive.
 */
class SystemsLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;
        this._vol = 1;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // --- Avionics electrical hum (120Hz rectified AC bus buzz) ---
        this.avionicsOsc = this.ctx.createOscillator();
        this.avionicsOsc.type = 'sine';
        this.avionicsOsc.frequency.value = 120;
        this.avionicsGain = this.ctx.createGain();
        this.avionicsGain.gain.value = 0;
        this.avionicsOsc.connect(this.avionicsGain);
        this.avionicsGain.connect(this.output);
        this.avionicsOsc.start();

        // --- Gyro whine (400Hz vacuum-driven gyro instruments) ---
        this.gyroOsc = this.ctx.createOscillator();
        this.gyroOsc.type = 'sine';
        this.gyroOsc.frequency.value = 400;
        this.gyroFilter = this.ctx.createBiquadFilter();
        this.gyroFilter.type = 'bandpass';
        this.gyroFilter.frequency.value = 400;
        this.gyroFilter.Q.value = 8;
        this.gyroGain = this.ctx.createGain();
        this.gyroGain.gain.value = 0;
        this.gyroOsc.connect(this.gyroFilter);
        this.gyroFilter.connect(this.gyroGain);
        this.gyroGain.connect(this.output);
        this.gyroOsc.start();

        // --- Radio static (filtered white noise — COM noise floor) ---
        this.radioNoise = engine.createNoiseSource();
        this.radioFilter = this.ctx.createBiquadFilter();
        this.radioFilter.type = 'bandpass';
        this.radioFilter.frequency.value = 2000;
        this.radioFilter.Q.value = 0.7;
        this.radioGain = this.ctx.createGain();
        this.radioGain.gain.value = 0;
        this.radioNoise.connect(this.radioFilter);
        this.radioFilter.connect(this.radioGain);
        this.radioGain.connect(this.output);

        // Radio crackle LFO: random amplitude modulation for texture
        this._crackleLfo = this.ctx.createOscillator();
        this._crackleLfo.type = 'sine';
        this._crackleLfo.frequency.value = 5;
        this._crackleLfoGain = this.ctx.createGain();
        this._crackleLfoGain.gain.value = 0; // modulation depth, set in update()
        this._crackleLfo.connect(this._crackleLfoGain);
        this._crackleLfoGain.connect(this.radioGain.gain);
        this._crackleLfo.start();
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.08; // smooth ramp for on/off

        const running = data.engineRunning ? 1 : 0;

        // Avionics hum: subtle 120Hz buzz
        this.avionicsGain.gain.setTargetAtTime(running * 0.04, t, tau);

        // Gyro whine: narrow resonant 400Hz
        this.gyroGain.gain.setTargetAtTime(running * 0.03, t, tau);

        // Radio static: very low hiss
        this.radioGain.gain.setTargetAtTime(running * 0.02, t, tau);

        // Crackle LFO modulation depth (subtle random variation)
        this._crackleLfoGain.gain.setTargetAtTime(running * 0.008, t, tau);
        // Vary crackle rate slightly
        this._crackleLfo.frequency.setTargetAtTime(3 + Math.random() * 5, t, 0.5);
    }

    setVolume(v) {
        this._vol = v;
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        this.output.gain.setTargetAtTime(b ? (this._vol || 1) : 0, this.ctx.currentTime, 0.05);
    }

    setProfile() {
        // No profile-specific tuning needed — systems sounds are universal
    }

    destroy() {
        try { this.avionicsOsc.stop(); } catch (e) {}
        try { this.gyroOsc.stop(); } catch (e) {}
        try { this.radioNoise.stop(); } catch (e) {}
        try { this._crackleLfo.stop(); } catch (e) {}
    }
}
