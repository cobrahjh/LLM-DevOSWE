class FlightInstructor {
    constructor() {
        this.running = false;
        this.scenario = null;
        this.phase = 0;
        this.score = 100;
        this.errors = 0;
        this.synth = window.speechSynthesis;
        this.voiceEnabled = true;
        this.init();
    }

    init() {
        document.getElementById('btn-start').onclick = () => this.toggle();
        document.getElementById('btn-voice').onclick = () => { this.voiceEnabled = !this.voiceEnabled; };
        setInterval(() => this.update(), 1000);
    }

    toggle() {
        if (this.running) { this.stop(); } else { this.start(); }
    }

    start() {
        this.phase = 0;
        this.score = 100;
        this.errors = 0;
        this.running = true;
        document.getElementById('btn-start').textContent = '■ Stop';
        document.getElementById('btn-start').classList.add('running');
        this.showInstruction('Training started. Follow the instructions.');
    }

    stop() {
        this.running = false;
        document.getElementById('btn-start').textContent = '▶ Start';
        document.getElementById('btn-start').classList.remove('running');
        this.showGrade();
    }

    showInstruction(text) {
        document.getElementById('instruction-text').textContent = text;
        if (this.voiceEnabled) this.speak(text);
    }

    async update() {
        if (!this.running) return;
        try {
            const res = await fetch('/api/simvars');
            if (!res.ok) return;
            const d = await res.json();
            const alt = d.PLANE_ALTITUDE || 0;
            const spd = d.AIRSPEED_INDICATED || 0;
            const vs = d.VERTICAL_SPEED || 0;
            
            // Evaluate based on scenario
            const scenario = document.getElementById('scenario').value;
            if (scenario === 'landing' && vs < -700) {
                this.addFeedback('Descent rate too high!', 'error');
            }
            if (scenario === 'pattern' && alt > 1500) {
                this.addFeedback('Too high for pattern!', 'warning');
            }
        } catch (e) {}
        document.getElementById('score').textContent = this.score;
        document.getElementById('errors').textContent = this.errors;
    }

    addFeedback(text, type) {
        const panel = document.getElementById('feedback-panel');
        const item = document.createElement('div');
        item.className = 'feedback-item ' + type;
        item.textContent = text;
        panel.appendChild(item);
        if (type === 'error') { this.score -= 5; this.errors++; }
        if (type === 'warning') { this.score -= 1; }
    }

    showGrade() {
        let letter = 'F';
        if (this.score >= 95) letter = 'A+';
        else if (this.score >= 90) letter = 'A';
        else if (this.score >= 80) letter = 'B';
        else if (this.score >= 70) letter = 'C';
        else if (this.score >= 60) letter = 'D';
        document.getElementById('grade-letter').textContent = letter;
        document.getElementById('grade-text').textContent = 'Score: ' + this.score;
        if (this.voiceEnabled) this.speak('Training complete. Grade: ' + letter);
    }

    speak(text) {
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        this.synth.speak(u);
    }
}
document.addEventListener('DOMContentLoaded', () => new FlightInstructor());
