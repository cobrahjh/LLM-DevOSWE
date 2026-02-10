/**
 * CockpitFX AudioEngine v2.1.0
 * Web Audio API graph manager — creates AudioContext, routes layers through
 * cabin perspective filter, dynamics compressor, master gain and bass-shaker.
 * v2.0: Sample loading, decoding, playback (OGG with WAV fallback).
 * v2.1: Inside/outside perspective — cabin LP + resonance filter.
 */
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._destroyed = false;
        this._samples = {};

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;

        // Dynamics compressor before destination to prevent clipping
        this._compressor = this.ctx.createDynamicsCompressor();
        this._compressor.threshold.value = -12;
        this._compressor.knee.value = 10;
        this._compressor.ratio.value = 4;
        this._compressor.attack.value = 0.003;
        this._compressor.release.value = 0.15;

        // Cabin perspective filter (inside = muffled, outside = flat)
        // LP simulates fuselage attenuating high frequencies
        this._cabinLP = this.ctx.createBiquadFilter();
        this._cabinLP.type = 'lowpass';
        this._cabinLP.frequency.value = 20000; // flat = outside
        this._cabinLP.Q.value = 0.5;
        // Peaking filter for cabin body resonance (~300 Hz)
        this._cabinRes = this.ctx.createBiquadFilter();
        this._cabinRes.type = 'peaking';
        this._cabinRes.frequency.value = 300;
        this._cabinRes.Q.value = 1.0;
        this._cabinRes.gain.value = 0; // flat = outside
        this._perspective = 'outside';

        // Full-range: master → cabinLP → cabinRes → compressor → destination
        this.masterGain.connect(this._cabinLP);
        this._cabinLP.connect(this._cabinRes);
        this._cabinRes.connect(this._compressor);
        this._compressor.connect(this.ctx.destination);

        // Bass shaker chain: master → LP filter → bass gain → compressor
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowpass';
        this.bassFilter.frequency.value = 120;
        this.bassFilter.Q.value = 0.7;
        this.bassGain = this.ctx.createGain();
        this.bassGain.gain.value = 0; // Off by default
        this.masterGain.connect(this.bassFilter);
        this.bassFilter.connect(this.bassGain);
        this.bassGain.connect(this._compressor);

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

    /**
     * Set cabin level (0 = outside/flat, 1 = fully sealed inside).
     * Continuous blend — replaces binary inside/outside toggle.
     * Door/canopy openness reduces effective level automatically.
     */
    setCabinLevel(v) {
        this._cabinLevel = Math.max(0, Math.min(1, v));
        this._applyCabinFilter();
    }

    /** Get current cabin level (0-1) */
    getCabinLevel() { return this._cabinLevel || 0; }

    /**
     * Set cabin openness from doors/canopy (0 = sealed, 1 = fully open).
     * Reduces effective cabin level — open doors let highs leak through.
     */
    setCabinOpenness(v) {
        this._openness = Math.max(0, Math.min(1, v));
        this._applyCabinFilter();
    }

    /** Apply cabin filter — blends cabin level with door openness */
    _applyCabinFilter() {
        const t = this.ctx.currentTime;
        const tau = 0.08;
        // Effective level: cabin slider reduced by door openness
        const level = (this._cabinLevel || 0) * (1 - (this._openness || 0) * 0.6);
        // 0 = flat (outside): LP 20000 Hz, Q 0.5, resonance 0 dB
        // 1 = sealed inside:  LP 2800 Hz, Q 0.7, resonance +4 dB
        const lpFreq = 20000 - level * 17200;
        const lpQ = 0.5 + level * 0.2;
        const resGain = level * 4;
        this._cabinLP.frequency.setTargetAtTime(lpFreq, t, tau);
        this._cabinLP.Q.setTargetAtTime(lpQ, t, tau);
        this._cabinRes.gain.setTargetAtTime(resGain, t, tau);
    }

    /** Check OGG Vorbis support */
    _canPlayOGG() {
        if (this._oggSupport !== undefined) return this._oggSupport;
        const a = document.createElement('audio');
        this._oggSupport = !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"'));
        return this._oggSupport;
    }

    /**
     * Load audio samples from a manifest.
     * @param {Object} manifest — { name: 'samples/file.ogg', ... }
     * @returns {Promise} resolves when all samples decoded
     */
    async loadSamples(manifest) {
        const ext = this._canPlayOGG() ? '.ogg' : '.wav';
        const entries = Object.entries(manifest);
        const results = await Promise.allSettled(entries.map(async ([name, basePath]) => {
            const url = basePath.replace(/\.ogg$/, ext);
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
            const buf = await resp.arrayBuffer();
            this._samples[name] = await this.ctx.decodeAudioData(buf);
        }));
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) console.warn('[AudioEngine] Failed to load', failed.length, 'samples:', failed.map(r => r.reason.message));
        return results;
    }

    /** Get a decoded AudioBuffer by name */
    getSample(name) { return this._samples[name] || null; }

    /** Create a BufferSource node from a named sample */
    createSampleSource(name, loop = false) {
        const buf = this._samples[name];
        if (!buf) return null;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = loop;
        return src;
    }

    /** Fire-and-forget one-shot sample playback */
    playOneShot(name, outputNode, volume = 1.0) {
        const src = this.createSampleSource(name);
        if (!src) return null;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        src.connect(gain);
        gain.connect(outputNode);
        src.start();
        return src;
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
