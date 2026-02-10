/**
 * CockpitFX AeroLayer v1.2.0
 * Wind noise (broadband filtered), stall buffet, turbulence shake,
 * crosswind stereo shift, gear drag noise, flap drag noise.
 * v1.2: Crosswind-aware stereo panning, gear/flap aero drag noise.
 * v1.1: Stereo wind split (pink noise L/R), pink turbulence rumble.
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

        // Wind noise: stereo split — two independent pink noise sources
        // Slightly different filter cutoffs create natural L/R timbral difference
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        this.windNoiseL = engine.createPinkNoiseSource();
        this.windFilterL = this.ctx.createBiquadFilter();
        this.windFilterL.type = 'lowpass';
        this.windFilterL.frequency.value = 50;
        this.windFilterL.Q.value = 0.5;
        this.windPanL = new StereoPannerNode(this.ctx, { pan: -0.6 });
        this.windNoiseL.connect(this.windFilterL);
        this.windFilterL.connect(this.windPanL);
        this.windPanL.connect(this.windGain);

        this.windNoiseR = engine.createPinkNoiseSource();
        this.windFilterR = this.ctx.createBiquadFilter();
        this.windFilterR.type = 'lowpass';
        this.windFilterR.frequency.value = 50;
        this.windFilterR.Q.value = 0.5;
        this.windPanR = new StereoPannerNode(this.ctx, { pan: 0.6 });
        this.windNoiseR.connect(this.windFilterR);
        this.windFilterR.connect(this.windPanR);
        this.windPanR.connect(this.windGain);

        this.windGain.connect(this.output);

        // Stall buffet: LFO-modulated white noise (harsh = intentional alert)
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

        // Turbulence: pink noise for warmer low-frequency rumble
        this.turbNoise = engine.createPinkNoiseSource();
        this.turbFilter = this.ctx.createBiquadFilter();
        this.turbFilter.type = 'lowpass';
        this.turbFilter.frequency.value = 8;
        this.turbFilter.Q.value = 0.7;
        this.turbGain = this.ctx.createGain();
        this.turbGain.gain.value = 0;
        this.turbNoise.connect(this.turbFilter);
        this.turbFilter.connect(this.turbGain);
        this.turbGain.connect(this.output);

        // Gear drag: low-frequency turbulent rumble from deployed landing gear
        this.gearDragNoise = engine.createPinkNoiseSource();
        this.gearDragFilter = this.ctx.createBiquadFilter();
        this.gearDragFilter.type = 'lowpass';
        this.gearDragFilter.frequency.value = 100;
        this.gearDragFilter.Q.value = 1.2;
        this.gearDragGain = this.ctx.createGain();
        this.gearDragGain.gain.value = 0;
        this.gearDragNoise.connect(this.gearDragFilter);
        this.gearDragFilter.connect(this.gearDragGain);
        this.gearDragGain.connect(this.output);

        // Flap drag: higher-frequency airflow noise from flap deployment
        this.flapDragNoise = engine.createPinkNoiseSource();
        this.flapDragFilter = this.ctx.createBiquadFilter();
        this.flapDragFilter.type = 'bandpass';
        this.flapDragFilter.frequency.value = 600;
        this.flapDragFilter.Q.value = 0.8;
        this.flapDragGain = this.ctx.createGain();
        this.flapDragGain.gain.value = 0;
        this.flapDragNoise.connect(this.flapDragFilter);
        this.flapDragFilter.connect(this.flapDragGain);
        this.flapDragGain.connect(this.output);
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

        // Crosswind stereo shift — pan toward upwind side
        const windDir = data.windDirection || 0;
        const heading = data.heading || 0;
        let relWind = windDir - heading;
        // Normalize to -180..+180
        while (relWind > 180) relWind -= 360;
        while (relWind < -180) relWind += 360;
        // relWind < 0 = wind from left, > 0 = wind from right
        const windShift = Math.max(-1, Math.min(1, relWind / 90));
        const panL = Math.max(-1, Math.min(1, -0.6 + windShift * 0.5));
        const panR = Math.max(-1, Math.min(1, 0.6 + windShift * 0.5));
        this.windPanL.pan.setTargetAtTime(panL, t, tau);
        this.windPanR.pan.setTargetAtTime(panR, t, tau);

        // Wind noise — scales with IAS², stereo split with ±3% cutoff offset
        const windAmp = onGround ? 0 : Math.min(1.0, Math.pow(ias / 200, 2));
        const windCutoff = Math.min(50 + ias * 2, 4000);
        this.windFilterL.frequency.setTargetAtTime(windCutoff * 0.97, t, tau);
        this.windFilterR.frequency.setTargetAtTime(windCutoff * 1.03, t, tau);
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

        // Gear drag — low rumble from deployed gear, scales with airspeed²
        const gearPos0 = data.gearPos0 || 0;
        const gearPos1 = data.gearPos1 || 0;
        const gearPos2 = data.gearPos2 || 0;
        const gearAvg = (gearPos0 + gearPos1 + gearPos2) / 300; // 0..1
        let gearDragAmp = 0;
        if (!onGround && gearAvg > 0) {
            gearDragAmp = gearAvg * Math.min(1.0, Math.pow(ias / 150, 2)) * 0.25;
        }
        const gearDragCutoff = Math.min(100 + ias * 1.5, 800);
        this.gearDragFilter.frequency.setTargetAtTime(gearDragCutoff, t, tau);
        this.gearDragGain.gain.setTargetAtTime(gearDragAmp, t, tau);

        // Flap drag — higher-frequency airflow from flap deployment
        const flapPct = data.flapPercent || 0;
        let flapDragAmp = 0;
        if (flapPct > 0) {
            const flapSpeedFactor = Math.min(1.0, Math.pow(ias / 120, 2));
            flapDragAmp = (flapPct / 100) * flapSpeedFactor * 0.2;
            // Silent on ground below taxi speed
            if (onGround && ias < 10) flapDragAmp = 0;
        }
        const flapDragCenter = Math.min(300 + flapPct * 4, 700);
        this.flapDragFilter.frequency.setTargetAtTime(flapDragCenter, t, tau);
        this.flapDragGain.gain.setTargetAtTime(flapDragAmp, t, tau);
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

    setProfile(p) { this.profile = p; }

    destroy() {
        try { this.windNoiseL.stop(); } catch (e) {}
        try { this.windNoiseR.stop(); } catch (e) {}
        try { this.buffetNoise.stop(); } catch (e) {}
        try { this.buffetLfo.stop(); } catch (e) {}
        try { this.turbNoise.stop(); } catch (e) {}
        try { this.gearDragNoise.stop(); } catch (e) {}
        try { this.flapDragNoise.stop(); } catch (e) {}
    }
}
