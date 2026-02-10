/**
 * CockpitFX WarningLayer v1.0.0
 * Stall horn (2500 Hz pulsed), gear warning (1200 Hz), overspeed (1500 Hz).
 */
class WarningLayer {
    constructor(engine, profile) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this._enabled = true;

        this.output = this.ctx.createGain();
        this.output.gain.value = 1.0; // Warnings at full volume by default
        this.output.connect(engine.masterGain);

        // Stall horn: 2500 Hz pulsed at 6 Hz
        this.stallOsc = this.ctx.createOscillator();
        this.stallOsc.type = 'sine';
        this.stallOsc.frequency.value = 2500;
        this.stallLfo = this.ctx.createOscillator();
        this.stallLfo.type = 'square';
        this.stallLfo.frequency.value = 6;
        this.stallLfoGain = this.ctx.createGain();
        this.stallLfoGain.gain.value = 0;
        this.stallGain = this.ctx.createGain();
        this.stallGain.gain.value = 0;
        // LFO modulates stall gain
        this.stallLfo.connect(this.stallLfoGain);
        this.stallLfoGain.connect(this.stallGain.gain);
        this.stallOsc.connect(this.stallGain);
        this.stallGain.connect(this.output);
        this.stallOsc.start();
        this.stallLfo.start();

        // Gear warning: 1200 Hz pulsed at 3 Hz
        this.gearOsc = this.ctx.createOscillator();
        this.gearOsc.type = 'sine';
        this.gearOsc.frequency.value = 1200;
        this.gearLfo = this.ctx.createOscillator();
        this.gearLfo.type = 'square';
        this.gearLfo.frequency.value = 3;
        this.gearLfoGain = this.ctx.createGain();
        this.gearLfoGain.gain.value = 0;
        this.gearWarnGain = this.ctx.createGain();
        this.gearWarnGain.gain.value = 0;
        this.gearLfo.connect(this.gearLfoGain);
        this.gearLfoGain.connect(this.gearWarnGain.gain);
        this.gearOsc.connect(this.gearWarnGain);
        this.gearWarnGain.connect(this.output);
        this.gearOsc.start();
        this.gearLfo.start();

        // Overspeed: 1500 Hz pulsed at 4 Hz
        this.ospdOsc = this.ctx.createOscillator();
        this.ospdOsc.type = 'sine';
        this.ospdOsc.frequency.value = 1500;
        this.ospdLfo = this.ctx.createOscillator();
        this.ospdLfo.type = 'square';
        this.ospdLfo.frequency.value = 4;
        this.ospdLfoGain = this.ctx.createGain();
        this.ospdLfoGain.gain.value = 0;
        this.ospdGain = this.ctx.createGain();
        this.ospdGain.gain.value = 0;
        this.ospdLfo.connect(this.ospdLfoGain);
        this.ospdLfoGain.connect(this.ospdGain.gain);
        this.ospdOsc.connect(this.ospdGain);
        this.ospdGain.connect(this.output);
        this.ospdOsc.start();
        this.ospdLfo.start();
    }

    update(data) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const tau = 0.02;

        // Stall horn
        const stallActive = data.stallWarning === true;
        this.stallLfoGain.gain.setTargetAtTime(stallActive ? 0.35 : 0, t, tau);
        this.stallGain.gain.setTargetAtTime(stallActive ? 0.15 : 0, t, tau);

        // Gear warning: throttle < 15%, gear up, low altitude
        const throttle = data.throttle || 0;
        const gearDown = data.gearDown;
        const agl = data.altitudeAGL || 0;
        const gearWarn = throttle < 15 && !gearDown && agl < 500 && agl > 10;
        this.gearLfoGain.gain.setTargetAtTime(gearWarn ? 0.3 : 0, t, tau);
        this.gearWarnGain.gain.setTargetAtTime(gearWarn ? 0.12 : 0, t, tau);

        // Overspeed
        const ospdActive = data.overspeedWarning === true;
        this.ospdLfoGain.gain.setTargetAtTime(ospdActive ? 0.3 : 0, t, tau);
        this.ospdGain.gain.setTargetAtTime(ospdActive ? 0.12 : 0, t, tau);
    }

    setVolume(v) {
        this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setEnabled(b) {
        this._enabled = b;
        if (!b) this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }

    destroy() {
        try { this.stallOsc.stop(); } catch (e) {}
        try { this.stallLfo.stop(); } catch (e) {}
        try { this.gearOsc.stop(); } catch (e) {}
        try { this.gearLfo.stop(); } catch (e) {}
        try { this.ospdOsc.stop(); } catch (e) {}
        try { this.ospdLfo.stop(); } catch (e) {}
    }
}
