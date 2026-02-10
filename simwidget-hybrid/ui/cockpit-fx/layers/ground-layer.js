/**
 * CockpitFX GroundLayer v2.0.0
 * Sample-based taxi rumble, touchdown chirp, surface texture.
 * Falls back to filtered noise synthesis when samples unavailable.
 * Keeps synthetic braking vibration and nose wheel drop transient.
 */
class GroundLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;
        this._vol = 1;
        this._prevOnGround = null;
        this._prevGS = 0;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0;
        this.output.connect(engine.masterGain);

        // Check which samples are available
        this._hasAsphalt = !!engine.getSample('tires-asphalt');
        this._hasGravel = !!engine.getSample('tires-gravel');
        this._hasScreech = !!engine.getSample('tire-screech');

        // Active looping sources (sample-based)
        this._asphaltSrc = null;
        this._asphaltGain = null;
        this._gravelSrc = null;
        this._gravelGain = null;
        this._taxiActive = false;

        // Synthetic fallback nodes (only created if no samples)
        this.taxiNoise = null;
        this.taxiFilter = null;
        this.taxiGain = null;
        this.surfaceNoise = null;
        this.surfaceFilter = null;
        this.surfaceGain = null;

        if (!this._hasAsphalt) {
            // Taxi rumble fallback: noise → bandpass → gain
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

            // Surface texture overlay
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
        }

        // Braking vibration: low-frequency oscillator (always synthetic)
        this.brakeOsc = this.ctx.createOscillator();
        this.brakeOsc.type = 'sine';
        this.brakeOsc.frequency.value = 5;
        this.brakeGain = this.ctx.createGain();
        this.brakeGain.gain.value = 0;
        this.brakeOsc.connect(this.brakeGain);
        this.brakeGain.connect(this.output);
        this.brakeOsc.start();

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

        // --- Sample-based taxi ---
        if (this._hasAsphalt) {
            const shouldTaxi = onGround && gs > 2;

            if (shouldTaxi && !this._taxiActive) {
                this._startTaxi(surfType);
            } else if (!shouldTaxi && this._taxiActive) {
                this._stopTaxi();
            }

            if (this._taxiActive) {
                // Playback rate scales with ground speed (1.0 at ~20kts reference)
                const rate = Math.max(0.5, Math.min(2.0, gs / 20));
                const amp = Math.min(0.7, gs / 30);

                // Surface selection: asphalt vs gravel
                const isGrass = surfType >= 2; // grass, turf, dirt, gravel
                if (this._asphaltSrc) {
                    this._asphaltSrc.playbackRate.setTargetAtTime(rate, t, tau);
                    this._asphaltGain.gain.setTargetAtTime(isGrass ? 0 : amp * 0.5, t, tau);
                }
                if (this._gravelSrc) {
                    this._gravelSrc.playbackRate.setTargetAtTime(rate, t, tau);
                    this._gravelGain.gain.setTargetAtTime(isGrass ? amp * 0.6 : 0, t, tau);
                }
            }
        } else {
            // Synthetic fallback
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
                    surfFreq = 50 + gs * 1.5;
                    surfAmp = 0.1;
                } else if (surfType === 2 || surfType === 3) {
                    surfFreq = 5 + gs * 0.5;
                    surfAmp = 0.35;
                } else if (surfType >= 4) {
                    surfFreq = 20 + gs;
                    surfAmp = 0.45;
                }
                this.surfaceFilter.frequency.setTargetAtTime(surfFreq, t, tau);
                this.surfaceGain.gain.setTargetAtTime(surfAmp, t, tau);
            } else {
                this.surfaceGain.gain.setTargetAtTime(0, t, tau);
            }
        }

        // Braking vibration — ground speed decreasing (always synthetic)
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

    // --- Sample-based taxi start/stop ---

    _startTaxi(surfType) {
        // Start asphalt loop
        this._asphaltSrc = this.engine.createSampleSource('tires-asphalt', true);
        if (this._asphaltSrc) {
            this._asphaltGain = this.ctx.createGain();
            this._asphaltGain.gain.value = 0;
            this._asphaltSrc.connect(this._asphaltGain);
            this._asphaltGain.connect(this.output);
            this._asphaltSrc.start();
        }

        // Start gravel/grass loop (if available)
        if (this._hasGravel) {
            this._gravelSrc = this.engine.createSampleSource('tires-gravel', true);
            if (this._gravelSrc) {
                this._gravelGain = this.ctx.createGain();
                this._gravelGain.gain.value = 0;
                this._gravelSrc.connect(this._gravelGain);
                this._gravelGain.connect(this.output);
                this._gravelSrc.start();
            }
        }

        this._taxiActive = true;
    }

    _stopTaxi() {
        if (this._asphaltSrc) {
            try { this._asphaltSrc.stop(); } catch (e) {}
            this._asphaltSrc = null;
            this._asphaltGain = null;
        }
        if (this._gravelSrc) {
            try { this._gravelSrc.stop(); } catch (e) {}
            this._gravelSrc = null;
            this._gravelGain = null;
        }
        this._taxiActive = false;
    }

    _triggerTouchdown(vs) {
        const impactForce = Math.min(1.0, Math.abs(vs) / 500);
        if (impactForce < 0.05) return;

        // Sample-based tire screech
        if (this._hasScreech) {
            this.engine.playOneShot('tire-screech', this.output, impactForce * 0.6);
        }

        // Synthetic main gear impact: 80 Hz transient (always play for bass feel)
        const t = this.ctx.currentTime;
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

        // Synthetic nose wheel drop: 200ms later, 60 Hz, softer
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
        this._vol = v;
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        const t = this.ctx.currentTime;
        this.output.gain.setTargetAtTime(b ? (this._vol || 1) : 0, t, 0.05);
    }

    destroy() {
        if (this.taxiNoise) try { this.taxiNoise.stop(); } catch (e) {}
        if (this.surfaceNoise) try { this.surfaceNoise.stop(); } catch (e) {}
        try { this.brakeOsc.stop(); } catch (e) {}
        this._stopTaxi();
        if (this._touchdownTimeout) clearTimeout(this._touchdownTimeout);
    }
}
