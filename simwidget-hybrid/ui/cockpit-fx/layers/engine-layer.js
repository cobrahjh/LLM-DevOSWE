/**
 * CockpitFX EngineLayer v2.0.0
 * Sample-based RPM crossfade (idle + cruise loops) for piston profiles.
 * Falls back to oscillator synthesis when samples unavailable.
 * Keeps synthetic turbine whine, N1 spool, and starter motor.
 *
 * RPM crossfade: idle loop (600-700 RPM) ↔ cruise loop (2200-2400 RPM)
 * playbackRate adjusts pitch to match current RPM.
 * Equal-power crossfade in 800-1800 RPM zone.
 */
class EngineLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.profile = profile.engine;
        this._enabled = true;
        this._vol = 1;
        this._useSamples = false;

        // Output gain → master
        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // --- Sample-based engine (piston profiles with available samples) ---
        this._idleSrc = null;
        this._idleGain = null;
        this._cruiseSrc = null;
        this._cruiseGain = null;
        this._idleRecordedRpm = 650;   // FlightGear idle recording ~650 RPM
        this._cruiseRecordedRpm = 2300; // FlightGear cruise recording ~2300 RPM
        this._samplesStarted = false;

        // Check if samples are available for piston engine
        if (!this.profile.n1Tone && this.profile.harmonics > 0) {
            const hasIdle = engine.getSample('engine-idle');
            const hasCruise = engine.getSample('engine');
            if (hasIdle && hasCruise) {
                this._useSamples = true;
                this._initSampleEngine();
            }
        }

        // --- Oscillator fallback (when no samples or for non-piston profiles) ---
        this.harmonics = [];
        if (!this._useSamples) {
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
        }

        // Prop blade-pass oscillator (kept for both sample and synth modes)
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

        // Prop blade-pass thump: low-frequency pressure pulse (visceral sub-bass)
        this.propThumpOsc = null;
        this.propThumpGain = null;
        this._propThumpFilter = null;
        if (this.profile.propBlades > 0) {
            this.propThumpOsc = this.ctx.createOscillator();
            this.propThumpOsc.type = 'sine';
            this.propThumpOsc.frequency.value = 0;
            this._propThumpFilter = this.ctx.createBiquadFilter();
            this._propThumpFilter.type = 'lowpass';
            this._propThumpFilter.frequency.value = 60;
            this._propThumpFilter.Q.value = 1.5;
            this.propThumpGain = this.ctx.createGain();
            this.propThumpGain.gain.value = 0;
            this.propThumpOsc.connect(this._propThumpFilter);
            this._propThumpFilter.connect(this.propThumpGain);
            this.propThumpGain.connect(this.output);
            this.propThumpOsc.start();
        }

        // Turbine whine (turboprop overlay — synthetic, no samples)
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

        // N1 spool tone (jet engines — synthetic, no samples)
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

        // Starter motor noise (synthetic)
        this.starterNoise = null;
        this.starterGain = null;
        this._engineStartPlayed = false;
    }

    /** Initialize sample-based engine sources */
    _initSampleEngine() {
        // Idle loop
        this._idleSrc = this.engine.createSampleSource('engine-idle', true);
        this._idleGain = this.ctx.createGain();
        this._idleGain.gain.value = 0;
        this._idleSrc.connect(this._idleGain);
        this._idleGain.connect(this.output);

        // Cruise loop
        this._cruiseSrc = this.engine.createSampleSource('engine', true);
        this._cruiseGain = this.ctx.createGain();
        this._cruiseGain.gain.value = 0;
        this._cruiseSrc.connect(this._cruiseGain);
        this._cruiseGain.connect(this.output);

        // Start both loops immediately (gain controls audibility)
        this._idleSrc.start();
        this._cruiseSrc.start();
        this._samplesStarted = true;
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.05;

        const rpm = data.engineRpm || 0;
        const throttle = (data.throttle || 0) / 100;
        const running = data.engineRunning;
        const masterAmp = running ? 1.0 : 0.0;

        // --- Sample-based piston engine ---
        if (this._useSamples && this._samplesStarted) {
            // Playback rate: pitch-shift samples to match current RPM
            const idleRate = Math.max(0.7, Math.min(1.5, rpm / this._idleRecordedRpm));
            const cruiseRate = Math.max(0.7, Math.min(1.5, rpm / this._cruiseRecordedRpm));
            this._idleSrc.playbackRate.setTargetAtTime(idleRate, t, tau);
            this._cruiseSrc.playbackRate.setTargetAtTime(cruiseRate, t, tau);

            // Equal-power crossfade: 800-1800 RPM transition zone
            const crossfadeT = Math.max(0, Math.min(1, (rpm - 800) / 1000));
            const idleAmp = Math.cos(crossfadeT * 0.5 * Math.PI);
            const cruiseAmp = Math.cos((1 - crossfadeT) * 0.5 * Math.PI);

            this._idleGain.gain.setTargetAtTime(masterAmp * idleAmp * 0.8, t, tau);
            this._cruiseGain.gain.setTargetAtTime(masterAmp * cruiseAmp * 0.8, t, tau);

            // Engine start one-shot: play when engine catches
            if (running && !this._engineStartPlayed) {
                this.engine.playOneShot('engine-start', this.output, 0.6);
                this._engineStartPlayed = true;
            }
            if (!running) this._engineStartPlayed = false;
        }

        // --- Oscillator fallback (synth mode) ---
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
            // Reduced prop volume when samples provide main engine sound
            const propVol = this._useSamples ? 0.12 : 0.25;
            this.propGain.gain.setTargetAtTime(masterAmp * throttle * propVol, t, tau);
        }

        // Prop blade-pass thump: deep sub-bass pressure pulse
        // LP filter at 60Hz attenuates higher BPFs (cruise) → realistic fade at speed
        if (this.propThumpOsc) {
            const bpf = (rpm / 60) * this.profile.propBlades;
            this.propThumpOsc.frequency.setTargetAtTime(Math.max(bpf, 0.01), t, tau);
            const thumpAmp = masterAmp * 0.18 * Math.min(1, rpm / 1200);
            this.propThumpGain.gain.setTargetAtTime(thumpAmp, t, tau);
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
        // Try sample-based crank sound first
        const crankSrc = this.engine.createSampleSource('engine-crank', true);
        if (crankSrc) {
            this.starterNoise = crankSrc;
            this.starterGain = this.ctx.createGain();
            this.starterGain.gain.value = 0.2;
            crankSrc.connect(this.starterGain);
            this.starterGain.connect(this.output);
            crankSrc.start();
            return;
        }
        // Fallback: synthetic starter noise
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
    }

    destroy() {
        this.harmonics.forEach(h => { try { h.osc.stop(); } catch (e) {} });
        if (this._idleSrc) try { this._idleSrc.stop(); } catch (e) {}
        if (this._cruiseSrc) try { this._cruiseSrc.stop(); } catch (e) {}
        if (this.propOsc) try { this.propOsc.stop(); } catch (e) {}
        if (this.propThumpOsc) try { this.propThumpOsc.stop(); } catch (e) {}
        if (this.turbineOsc) try { this.turbineOsc.stop(); } catch (e) {}
        if (this.n1Osc) try { this.n1Osc.stop(); } catch (e) {}
        if (this.starterNoise) this._stopStarterMotor();
    }
}
