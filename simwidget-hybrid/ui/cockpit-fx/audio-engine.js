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

    /** Set perspective: 'inside' (muffled cabin) or 'outside' (full spectrum) */
    setPerspective(p) {
        this._perspective = p;
        // Apply with current openness
        this._applyCabinFilter(this._openness || 0);
    }

    /** Get current perspective */
    getPerspective() { return this._perspective; }

    /**
     * Set cabin openness (0 = sealed, 1 = fully open).
     * Blends the cabin filter: when inside + open, highs leak through.
     * Has no effect in outside mode (already flat).
     */
    setCabinOpenness(v) {
        this._openness = Math.max(0, Math.min(1, v));
        if (this._perspective === 'inside') {
            this._applyCabinFilter(this._openness);
        }
    }

    /** Apply cabin filter with openness blend */
    _applyCabinFilter(openness) {
        const t = this.ctx.currentTime;
        const tau = 0.08;
        if (this._perspective === 'inside') {
            // Sealed cabin: LP 2800 Hz, resonance +4 dB
            // Fully open: LP 12000 Hz, resonance +1 dB (still some cabin effect)
            const lpFreq = 2800 + openness * 9200;
            const resGain = 4 - openness * 3;
            this._cabinLP.frequency.setTargetAtTime(lpFreq, t, tau);
            this._cabinLP.Q.setTargetAtTime(0.7 - openness * 0.2, t, tau);
            this._cabinRes.gain.setTargetAtTime(resGain, t, tau);
        } else {
            // Outside: flat
            this._cabinLP.frequency.setTargetAtTime(20000, t, tau);
            this._cabinLP.Q.setTargetAtTime(0.5, t, tau);
            this._cabinRes.gain.setTargetAtTime(0, t, tau);
        }
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
