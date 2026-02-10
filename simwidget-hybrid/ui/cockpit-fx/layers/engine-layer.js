/**
 * CockpitFX EngineLayer v1.0.0
 * RPM harmonics (4 sine oscillators) + prop blade-pass frequency.
 * Real piston engine vibration: fundamental = RPM/60 Hz, harmonics at 2x-4x.
 */
class EngineLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.profile = profile.engine;
        this._enabled = true;

        // Output gain → master
        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Create harmonic oscillators (up to 4) + 1 prop blade-pass
        this.harmonics = [];
        const numHarmonics = this.profile.n1Tone ? 0 : this.profile.harmonics;
        const amplitudes = [0.5, 0.3, 0.15, 0.08];
        for (let i = 0; i < numHarmonics; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 0;
            const gain = this.ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(this.output);
            osc.start();
            this.harmonics.push({ osc, gain, ampScale: amplitudes[i] || 0.05 });
        }

        // Prop blade-pass oscillator
        this.propOsc = null;
        this.propGain = null;
        if (this.profile.propBlades > 0) {
            this.propOsc = this.ctx.createOscillator();
            this.propOsc.type = 'sine';
            this.propOsc.frequency.value = 0;
            this.propGain = this.ctx.createGain();
            this.propGain.gain.value = 0;
            this.propOsc.connect(this.propGain);
            this.propGain.connect(this.output);
            this.propOsc.start();
        }

        // Turbine whine (turboprop overlay)
        this.turbineOsc = null;
        this.turbineGain = null;
        if (this.profile.turbineWhine) {
            this.turbineOsc = this.ctx.createOscillator();
            this.turbineOsc.type = 'sawtooth';
            this.turbineOsc.frequency.value = 400;
            this.turbineGain = this.ctx.createGain();
            this.turbineGain.gain.value = 0;
            const turbineFilter = this.ctx.createBiquadFilter();
            turbineFilter.type = 'bandpass';
            turbineFilter.frequency.value = 600;
            turbineFilter.Q.value = 2;
            this.turbineOsc.connect(turbineFilter);
            turbineFilter.connect(this.turbineGain);
            this.turbineGain.connect(this.output);
            this.turbineOsc.start();
            this._turbineFilter = turbineFilter;
        }

        // N1 spool tone (jet engines)
        this.n1Osc = null;
        this.n1Gain = null;
        if (this.profile.n1Tone) {
            this.n1Osc = this.ctx.createOscillator();
            this.n1Osc.type = 'sawtooth';
            this.n1Osc.frequency.value = 200;
            this.n1Gain = this.ctx.createGain();
            this.n1Gain.gain.value = 0;
            const n1Filter = this.ctx.createBiquadFilter();
            n1Filter.type = 'bandpass';
            n1Filter.frequency.value = 400;
            n1Filter.Q.value = 1.5;
            this.n1Osc.connect(n1Filter);
            n1Filter.connect(this.n1Gain);
            this.n1Gain.connect(this.output);
            this.n1Osc.start();
            this._n1Filter = n1Filter;
        }

        // Starter motor noise
        this.starterNoise = null;
        this.starterGain = null;
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.05; // smoothing time constant

        const rpm = data.engineRpm || 0;
        const throttle = (data.throttle || 0) / 100;
        const running = data.engineRunning;
        const masterAmp = running ? 1.0 : 0.0;

        // Piston harmonics
        if (this.harmonics.length > 0) {
            const fundamental = rpm / 60;
            for (let i = 0; i < this.harmonics.length; i++) {
                const h = this.harmonics[i];
                const freq = fundamental * (i + 1);
                h.osc.frequency.setTargetAtTime(Math.max(freq, 0.01), t, tau);
                h.gain.gain.setTargetAtTime(masterAmp * throttle * h.ampScale, t, tau);
            }
        }

        // Prop blade-pass
        if (this.propOsc) {
            const bpf = (rpm / 60) * this.profile.propBlades;
            this.propOsc.frequency.setTargetAtTime(Math.max(bpf, 0.01), t, tau);
            this.propGain.gain.setTargetAtTime(masterAmp * throttle * 0.25, t, tau);
        }

        // Turbine whine
        if (this.turbineOsc) {
            const whineFreq = 400 + throttle * 400;
            this.turbineOsc.frequency.setTargetAtTime(whineFreq, t, tau);
            this._turbineFilter.frequency.setTargetAtTime(whineFreq * 1.2, t, tau);
            this.turbineGain.gain.setTargetAtTime(masterAmp * throttle * 0.3, t, tau);
        }

        // N1 spool (jet)
        if (this.n1Osc) {
            const n1Freq = 200 + throttle * 400;
            this.n1Osc.frequency.setTargetAtTime(n1Freq, t, tau);
            this._n1Filter.frequency.setTargetAtTime(n1Freq * 1.3, t, tau);
            this.n1Gain.gain.setTargetAtTime(masterAmp * (0.15 + throttle * 0.55), t, tau);
        }

        // Starter motor: engine not running but throttle > 0
        if (!running && throttle > 0 && !this.starterNoise) {
            this._startStarterMotor();
        } else if ((running || throttle === 0) && this.starterNoise) {
            this._stopStarterMotor();
        }
    }

    _startStarterMotor() {
        this.starterNoise = this.engine.createNoiseSource();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 200;
        filter.Q.value = 5;
        this.starterGain = this.ctx.createGain();
        this.starterGain.gain.value = 0.15;
        this.starterNoise.connect(filter);
        filter.connect(this.starterGain);
        this.starterGain.connect(this.output);
        this._starterFilter = filter;
    }

    _stopStarterMotor() {
        try { this.starterNoise.stop(); } catch (e) {}
        this.starterNoise = null;
        this.starterGain = null;
        this._starterFilter = null;
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

    setProfile(profile) {
        this.profile = profile.engine;
        // Full re-init would be needed for harmonic count changes;
        // for now just update parameters on next frame
    }

    destroy() {
        this.harmonics.forEach(h => { try { h.osc.stop(); } catch (e) {} });
        if (this.propOsc) try { this.propOsc.stop(); } catch (e) {}
        if (this.turbineOsc) try { this.turbineOsc.stop(); } catch (e) {}
        if (this.n1Osc) try { this.n1Osc.stop(); } catch (e) {}
        if (this.starterNoise) this._stopStarterMotor();
    }
}
