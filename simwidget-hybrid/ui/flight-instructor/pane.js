/**
 * Flight Instructor pane - SimGlass
 * Real-time flight training with scenario evaluation, phase tracking, and voice coaching
 */

const SCENARIOS = {
    pattern: {
        name: 'Traffic Pattern',
        phases: [
            { name: 'Upwind', instruction: 'Climb straight out on runway heading to pattern altitude (1000ft AGL). Maintain Vy.', checks: { minAlt: 0, maxAlt: 1200, maxBank: 30 } },
            { name: 'Crosswind', instruction: 'Turn crosswind at 500ft AGL. Bank no more than 20 degrees. Level at pattern altitude.', checks: { minAlt: 400, maxAlt: 1200, maxBank: 25 } },
            { name: 'Downwind', instruction: 'Fly level at pattern altitude (1000ft AGL). Maintain 90-100 knots. Abeam the threshold, start descent.', checks: { minAlt: 800, maxAlt: 1200, minSpd: 80, maxSpd: 120 } },
            { name: 'Base', instruction: 'Turn base when 45 degrees past the runway. Descend at 500 fpm. Reduce to approach speed.', checks: { maxVs: -800, minSpd: 65, maxSpd: 100 } },
            { name: 'Final', instruction: 'Turn final, align with runway centerline. Stabilize at approach speed. Aim for 3 degree glideslope (~700 fpm descent).', checks: { maxVs: -1000, minSpd: 60, maxSpd: 90 } }
        ]
    },
    landing: {
        name: 'Landing Evaluation',
        phases: [
            { name: 'Approach', instruction: 'Establish stable approach. Speed 65-80kt, descent 500-700 fpm. Check gear down and flaps.', checks: { minSpd: 55, maxSpd: 90, maxVs: -900 } },
            { name: 'Short Final', instruction: 'Maintain centerline. Speed within +5/-0 of Vref. No large corrections below 200ft.', checks: { minSpd: 55, maxSpd: 85 } },
            { name: 'Flare', instruction: 'Begin flare at 20-30ft. Gradually reduce power. Pitch for touchdown at minimum descent rate.', checks: { maxVs: -400, maxAlt: 50 } },
            { name: 'Touchdown', instruction: 'Touchdown! Evaluating landing rate. Target: under 200 fpm. Under 100 fpm is excellent.', checks: { maxVs: -500 } },
            { name: 'Rollout', instruction: 'Lower nose gently. Apply brakes gradually. Maintain centerline during rollout.', checks: { maxSpd: 60 } }
        ]
    },
    stalls: {
        name: 'Stall Recovery',
        phases: [
            { name: 'Setup', instruction: 'Climb to safe altitude (3000+ AGL). Clear the area with turns. Slow to cruise speed.', checks: { minAlt: 2500 } },
            { name: 'Power Reduction', instruction: 'Reduce power to idle. Maintain altitude as speed decreases. Keep wings level.', checks: { minAlt: 2500, maxBank: 10 } },
            { name: 'Approaching Stall', instruction: 'Hold back pressure as speed drops. Note buffet onset. Maintain coordinated flight.', checks: { maxBank: 15 } },
            { name: 'Stall Break', instruction: 'At stall break: Lower nose, add full power, level wings. Minimize altitude loss.', checks: {} },
            { name: 'Recovery', instruction: 'Recover to level flight. Maintain positive climb. Do not exceed Vne. Good job if altitude loss < 200ft.', checks: { minVs: -500 } }
        ]
    },
    emergencies: {
        name: 'Emergency Procedures',
        phases: [
            { name: 'Engine Failure', instruction: 'SIMULATE: Engine has failed! Pitch for best glide speed (Vg). Trim for hands-off glide.', checks: { minSpd: 55, maxSpd: 100 } },
            { name: 'Best Glide', instruction: 'Maintain best glide speed. Look for suitable landing area. Wind direction for approach planning.', checks: { minSpd: 55, maxSpd: 100, maxBank: 30 } },
            { name: 'Troubleshoot', instruction: 'Run restart checklist: Fuel selector BOTH, mixture RICH, carb heat ON, mags CHECK. Attempt restart.', checks: {} },
            { name: 'Field Selection', instruction: 'Select landing field. Plan approach path. Favor into the wind. Avoid obstacles on approach.', checks: { maxBank: 35 } },
            { name: 'Emergency Landing', instruction: 'Configure for landing. Flaps as needed. Secure engine. Touchdown at minimum speed.', checks: { maxSpd: 80, maxVs: -800 } }
        ]
    },
    instruments: {
        name: 'Instrument Scan',
        phases: [
            { name: 'Straight & Level', instruction: 'Hold altitude within 100ft, heading within 5 degrees, and airspeed within 10kt for 60 seconds.', checks: { maxBank: 5, minSpd: 80, maxSpd: 200 } },
            { name: 'Standard Rate Turn', instruction: 'Execute a standard rate turn (3 deg/sec). Maintain altitude within 100ft. Roll out on heading.', checks: { maxBank: 25 } },
            { name: 'Climb', instruction: 'Enter a 500 fpm climb. Maintain heading within 5 degrees. Hold climb speed within 5kt.', checks: { minVs: 300, maxVs: 700 } },
            { name: 'Descent', instruction: 'Enter a 500 fpm descent. Maintain heading. Hold descent speed within 5kt of target.', checks: { minVs: -700, maxVs: -300 } },
            { name: 'Unusual Attitude', instruction: 'Recover to straight and level. Check: Attitude, Airspeed, Altitude, Heading. Smooth corrections.', checks: { maxBank: 10 } }
        ]
    },
    crosswind: {
        name: 'Crosswind Landing',
        phases: [
            { name: 'Setup', instruction: 'Identify wind direction and speed. Choose crab or wing-low method. Configure for approach.', checks: { minSpd: 60, maxSpd: 100 } },
            { name: 'Approach', instruction: 'Establish on final. Apply wind correction (crab into wind or wing-low). Maintain centerline.', checks: { minSpd: 60, maxSpd: 90, maxBank: 20 } },
            { name: 'Transition', instruction: 'Below 200ft, transition to sideslip if using crab method. Upwind wing low, opposite rudder.', checks: { maxBank: 20, maxVs: -700 } },
            { name: 'Touchdown', instruction: 'Land on upwind wheel first. Maintain directional control. Full aileron into wind after touchdown.', checks: { maxVs: -500 } },
            { name: 'Rollout', instruction: 'Maintain centerline with rudder. Gradually lower nose wheel. Apply brakes as needed.', checks: { maxSpd: 60 } }
        ]
    }
};

class FlightInstructor extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-instructor',
            widgetVersion: '1.1.0',
            autoConnect: true
        });

        this.running = false;
        this.scenarioKey = 'pattern';
        this.phase = 0;
        this.score = 100;
        this.errors = 0;
        this.phaseTimer = 0;
        this.lastData = {};
        this.feedbackCooldown = {};
        this.synth = window.speechSynthesis;
        this.voiceEnabled = true;

        this.init();
    }

    init() {
        document.getElementById('btn-start').onclick = () => this.toggle();
        document.getElementById('btn-voice').onclick = () => {
            this.voiceEnabled = !this.voiceEnabled;
            document.getElementById('btn-voice').style.opacity = this.voiceEnabled ? '1' : '0.4';
        };
        document.getElementById('btn-next').onclick = () => {
            if (this.running) this.nextPhase();
        };
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.lastData = msg.data;
            if (this.running) this.evaluate(msg.data);
        }
    }

    toggle() {
        if (this.running) { this.stop(); } else { this.start(); }
    }

    start() {
        this.scenarioKey = document.getElementById('scenario').value;
        const scenario = SCENARIOS[this.scenarioKey];
        this.phase = 0;
        this.score = 100;
        this.errors = 0;
        this.phaseTimer = 0;
        this.feedbackCooldown = {};
        this.running = true;

        document.getElementById('btn-start').textContent = '\u25A0 Stop';
        document.getElementById('btn-start').classList.add('running');
        document.getElementById('feedback-panel').replaceChildren();

        this.updatePhaseDisplay();
        this.showInstruction(scenario.phases[0].instruction);
        this.addFeedback('Starting: ' + scenario.name, 'good');
    }

    stop() {
        this.running = false;
        document.getElementById('btn-start').textContent = '\u25B6 Start';
        document.getElementById('btn-start').classList.remove('running');
        this.showGrade();
    }

    updatePhaseDisplay() {
        const scenario = SCENARIOS[this.scenarioKey];
        const phase = scenario.phases[this.phase];
        document.getElementById('phase').textContent = phase.name;
        document.getElementById('score').textContent = this.score;
        document.getElementById('errors').textContent = this.errors;
    }

    showInstruction(text) {
        document.getElementById('instruction-text').textContent = text;
        if (this.voiceEnabled) this.speak(text);
    }

    nextPhase() {
        const scenario = SCENARIOS[this.scenarioKey];
        this.phase++;
        this.phaseTimer = 0;
        this.feedbackCooldown = {};

        if (this.phase >= scenario.phases.length) {
            this.stop();
            return;
        }

        this.updatePhaseDisplay();
        this.showInstruction(scenario.phases[this.phase].instruction);
        this.addFeedback('Phase: ' + scenario.phases[this.phase].name, 'good');
    }

    evaluate(data) {
        const scenario = SCENARIOS[this.scenarioKey];
        if (!scenario || this.phase >= scenario.phases.length) return;

        const phase = scenario.phases[this.phase];
        const checks = phase.checks;
        const alt = data.altitude || 0;
        const spd = data.speed || 0;
        const vs = data.verticalSpeed || 0;
        const bank = Math.abs(data.bank || 0);

        this.phaseTimer++;

        // Altitude checks
        if (checks.minAlt !== undefined && alt < checks.minAlt) {
            this.throttledFeedback('alt_low', 'Too low! Minimum ' + checks.minAlt + 'ft', 'error');
        }
        if (checks.maxAlt !== undefined && alt > checks.maxAlt) {
            this.throttledFeedback('alt_high', 'Too high! Maximum ' + checks.maxAlt + 'ft', 'warning');
        }

        // Speed checks
        if (checks.minSpd !== undefined && spd < checks.minSpd) {
            this.throttledFeedback('spd_low', 'Too slow! Minimum ' + checks.minSpd + 'kt', 'error');
        }
        if (checks.maxSpd !== undefined && spd > checks.maxSpd) {
            this.throttledFeedback('spd_high', 'Too fast! Maximum ' + checks.maxSpd + 'kt', 'warning');
        }

        // Vertical speed checks
        if (checks.maxVs !== undefined && vs < checks.maxVs) {
            this.throttledFeedback('vs_high', 'Descent rate too high! Max ' + Math.abs(checks.maxVs) + ' fpm', 'error');
        }
        if (checks.minVs !== undefined && vs < checks.minVs) {
            this.throttledFeedback('vs_low', 'Climb rate too low! Min ' + checks.minVs + ' fpm', 'warning');
        }

        // Bank checks
        if (checks.maxBank !== undefined && bank > checks.maxBank) {
            this.throttledFeedback('bank', 'Bank angle too steep! Max ' + checks.maxBank + '\u00B0', 'warning');
        }

        // Auto-advance phase after 30 seconds of clean flying
        if (this.phaseTimer > 30 && this.phaseTimer % 30 === 0) {
            this.nextPhase();
        }

        this.updatePhaseDisplay();
    }

    throttledFeedback(key, text, type) {
        const now = Date.now();
        if (this.feedbackCooldown[key] && now - this.feedbackCooldown[key] < 5000) return;
        this.feedbackCooldown[key] = now;
        this.addFeedback(text, type);
    }

    addFeedback(text, type) {
        const panel = document.getElementById('feedback-panel');
        const item = document.createElement('div');
        item.className = 'feedback-item ' + type;

        const time = document.createElement('span');
        time.className = 'feedback-time';
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        item.appendChild(time);
        item.appendChild(document.createTextNode(' ' + text));

        panel.insertBefore(item, panel.firstChild);

        // Keep max 20 items
        while (panel.children.length > 20) {
            panel.removeChild(panel.lastChild);
        }

        if (type === 'error') { this.score = Math.max(0, this.score - 5); this.errors++; }
        if (type === 'warning') { this.score = Math.max(0, this.score - 2); }

        if (type === 'error' && this.voiceEnabled) {
            this.speak(text);
        }
    }

    showGrade() {
        let letter = 'F';
        let text = 'Needs significant improvement';
        if (this.score >= 95) { letter = 'A+'; text = 'Outstanding performance!'; }
        else if (this.score >= 90) { letter = 'A'; text = 'Excellent flying!'; }
        else if (this.score >= 80) { letter = 'B'; text = 'Good, minor deviations.'; }
        else if (this.score >= 70) { letter = 'C'; text = 'Satisfactory, needs practice.'; }
        else if (this.score >= 60) { letter = 'D'; text = 'Below standards, review procedures.'; }
        document.getElementById('grade-letter').textContent = letter;
        document.getElementById('grade-text').textContent = 'Score: ' + this.score + ' | ' + text;
        if (this.voiceEnabled) this.speak('Training complete. Grade: ' + letter + '. ' + text);
    }

    speak(text) {
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        u.pitch = 1.0;
        this.synth.speak(u);
    }

    destroy() {
        // Additional cleanup beyond SimGlassBase
        if (this.synth) {
            this.synth.cancel();
        }

        // Call parent's destroy() for WebSocket cleanup
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flightInstructor = new FlightInstructor();
    window.addEventListener('beforeunload', () => window.flightInstructor?.destroy());
});
