/**
 * CockpitFX AudioEngine v2.0.0
 * Web Audio API graph manager — creates AudioContext, routes layers through
 * dynamics compressor, master gain and optional bass-shaker low-pass filter.
 * v2.0: Sample loading, decoding, playback (OGG with WAV fallback).
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

        // Full-range output → compressor → destination
        this.masterGain.connect(this._compressor);
        this._compressor.connect(this.ctx.destination);

        // Bass shaker chain: master → LP filter → bass gain → destination
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
