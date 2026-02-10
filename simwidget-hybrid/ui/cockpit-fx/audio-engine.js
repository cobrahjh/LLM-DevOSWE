/**
 * CockpitFX AudioEngine v1.0.0
 * Web Audio API graph manager — creates AudioContext, routes layers through
 * master gain and optional bass-shaker low-pass filter.
 */
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._destroyed = false;

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;

        // Full-range output → destination
        this.masterGain.connect(this.ctx.destination);

        // Bass shaker chain: master → LP filter → bass gain → destination
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowpass';
        this.bassFilter.frequency.value = 120;
        this.bassFilter.Q.value = 0.7;
        this.bassGain = this.ctx.createGain();
        this.bassGain.gain.value = 0; // Off by default
        this.masterGain.connect(this.bassFilter);
        this.bassFilter.connect(this.bassGain);
        this.bassGain.connect(this.ctx.destination);

        // Layer registry
        this.layers = {};

        // Shared white noise buffer (reused by multiple layers)
        this._noiseBuffer = this._createNoiseBuffer(2);
    }

    /** Create a white noise AudioBuffer of given duration in seconds */
    _createNoiseBuffer(duration) {
        const sr = this.ctx.sampleRate;
        const len = sr * duration;
        const buf = this.ctx.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        return buf;
    }

    /** Get a looping noise source node */
    createNoiseSource() {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        src.loop = true;
        src.start();
        return src;
    }

    /** Register a layer instance */
    addLayer(name, layer) {
        this.layers[name] = layer;
    }

    /** Update all layers with new sim data */
    update(data) {
        if (this._destroyed) return;
        for (const name in this.layers) {
            this.layers[name].update(data);
        }
    }

    /** Set master volume (0-1) */
    setMasterVolume(v) {
        this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    /** Set bass shaker volume (0-1); 0 = disabled */
    setBassVolume(v) {
        this.bassGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    /** Set bass LP filter cutoff (Hz) */
    setBassFrequency(f) {
        this.bassFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
    }

    /** Resume AudioContext (required after user gesture) */
    resume() {
        if (this.ctx.state === 'suspended') return this.ctx.resume();
        return Promise.resolve();
    }

    destroy() {
        this._destroyed = true;
        for (const name in this.layers) {
            if (this.layers[name].destroy) this.layers[name].destroy();
        }
        this.layers = {};
        this.ctx.close().catch(() => {});
    }
}
