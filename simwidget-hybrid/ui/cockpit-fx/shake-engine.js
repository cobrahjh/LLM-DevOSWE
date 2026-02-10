/**
 * CockpitFX ShakeEngine v1.0.0
 * Computes per-frame CSS transform displacement from SimVar data.
 * Applies translate(dx, dy) rotate(rot) to a target element.
 *
 * Sources:
 *  - Engine vibration: high-freq micro-jitter from RPM
 *  - Turbulence: random displacement from wind + body accel
 *  - Stall buffet: oscillating shake near stall AOA
 *  - Touchdown: sharp impulse with exponential decay
 *  - Taxi rumble: surface-dependent ground vibration
 *  - G-force tilt: sustained rotation from lateral G
 */
class ShakeEngine {
    constructor(targetEl) {
        this.target = targetEl;
        this.enabled = false;
        this.intensity = 1.0; // master intensity 0-2
        this._t = 0;
        this._touchdownImpulse = 0;
        this._prevOnGround = null;
        this._frame = 0;
    }

    update(data) {
        if (!this.enabled || !this.target) return;
        this._frame++;
        this._t = performance.now() / 1000;

        let dx = 0, dy = 0, rot = 0;
        const I = this.intensity;

        // --- Engine vibration ---
        // High-frequency micro-jitter proportional to RPM
        const rpm = data.engineRpm || 0;
        const running = data.engineRunning;
        if (running && rpm > 0) {
            const engAmp = (rpm / 2700) * 0.6 * I;
            // Use frame count for high-freq randomness (cheaper than sin at 60hz)
            dx += (Math.random() - 0.5) * engAmp;
            dy += (Math.random() - 0.5) * engAmp;
            // Prop vibration: subtle rotation oscillation
            const propFreq = rpm / 60;
            rot += Math.sin(this._t * propFreq * 0.5) * 0.08 * I;
        }

        // --- Turbulence ---
        const onGround = data.onGround;
        const windSpd = data.windSpeed || 0;
        if (!onGround && windSpd > 5) {
            const turbBase = Math.min(1, (windSpd - 5) / 35);
            // Add body acceleration component
            const accelMag = Math.sqrt(
                Math.pow(data.accelX || 0, 2) + Math.pow(data.accelY || 0, 2)
            );
            const turbAmp = (turbBase + Math.min(0.5, accelMag / 12)) * 3.0 * I;
            // Low-frequency wander with random spikes
            dx += (Math.sin(this._t * 1.7) * 0.6 + (Math.random() - 0.5)) * turbAmp;
            dy += (Math.sin(this._t * 2.3) * 0.6 + (Math.random() - 0.5)) * turbAmp;
            rot += (Math.sin(this._t * 1.1) + (Math.random() - 0.5) * 0.5) * turbAmp * 0.15;
        }

        // --- Stall buffet ---
        const aoa = data.angleOfAttack || 0;
        const stallThresh = 16;
        const buffetStart = stallThresh - 5;
        if (!onGround && aoa > buffetStart) {
            const buffetAmp = Math.min(1, (aoa - buffetStart) / 5) * 5.0 * I;
            // 10-14 Hz oscillation with noise
            dx += Math.sin(this._t * 75) * buffetAmp * 0.7;
            dy += Math.sin(this._t * 82) * buffetAmp;
            rot += Math.sin(this._t * 68) * buffetAmp * 0.2;
        }

        // --- Touchdown impact ---
        if (this._prevOnGround === false && onGround === true) {
            const vs = Math.abs(data.verticalSpeed || 0);
            this._touchdownImpulse = Math.min(1, vs / 500);
        }
        this._prevOnGround = onGround;

        if (this._touchdownImpulse > 0.01) {
            const imp = this._touchdownImpulse * 8.0 * I;
            dy += imp * (1 + Math.sin(this._t * 40) * 0.3);
            dx += (Math.random() - 0.5) * imp * 0.4;
            rot += (Math.random() - 0.5) * imp * 0.15;
            // Exponential decay (~300ms)
            this._touchdownImpulse *= 0.92;
        }

        // --- Taxi rumble ---
        const gs = data.groundSpeed || 0;
        if (onGround && gs > 2) {
            const surfType = data.surfaceType || 0;
            // Surface roughness multiplier
            let surfMul = 0.3; // concrete/asphalt (smooth)
            if (surfType === 1 || surfType === 2) surfMul = 0.8;  // grass/turf
            if (surfType === 3) surfMul = 1.0;  // dirt
            if (surfType >= 4) surfMul = 1.2;   // gravel+

            const taxiAmp = Math.min(1, gs / 30) * surfMul * 2.0 * I;
            dx += (Math.random() - 0.5) * taxiAmp;
            dy += (Math.random() - 0.5) * taxiAmp;
            rot += (Math.random() - 0.5) * taxiAmp * 0.1;
        }

        // --- Braking vibration ---
        if (onGround && data._prevGS !== undefined) {
            const decel = data._prevGS - gs;
            if (decel > 0.5 && gs > 3) {
                const brakeAmp = Math.min(1, decel / 8) * 1.5 * I;
                dx += Math.sin(this._t * 30) * brakeAmp * 0.5;
                dy += (Math.random() - 0.5) * brakeAmp;
            }
        }

        // --- G-force tilt ---
        // Lateral G tilts the panel, longitudinal shifts it
        const gLat = (data.accelY || 0) / 32.17;
        const gLong = (data.accelX || 0) / 32.17;
        rot += gLat * 2.5 * I;
        dy += gLong * 1.5 * I;

        // --- Apply transform ---
        // Clamp to reasonable limits
        dx = Math.max(-12, Math.min(12, dx));
        dy = Math.max(-12, Math.min(12, dy));
        rot = Math.max(-4, Math.min(4, rot));

        this.target.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    }

    setEnabled(b) {
        this.enabled = b;
        if (!b && this.target) {
            this.target.style.transform = '';
        }
    }

    setIntensity(v) {
        this.intensity = Math.max(0, Math.min(2, v));
    }

    destroy() {
        if (this.target) this.target.style.transform = '';
        this.target = null;
    }
}
