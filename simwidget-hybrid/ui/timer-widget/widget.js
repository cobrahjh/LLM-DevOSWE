/**
 * Timer Widget - SimWidget
 * Stopwatch and countdown timer for flight procedures
 */

class TimerWidget {
    constructor() {
        this.mode = 'stopwatch';
        this.running = false;
        this.elapsed = 0;
        this.countdownTarget = 300; // 5 minutes default
        this.interval = null;
        this.laps = [];
        this.soundEnabled = true;
        this.audioCtx = null;

        this.initElements();
        this.initEvents();
        this.loadState();
        this.updateDisplay();
    }

    initElements() {
        this.display = document.getElementById('timer-display');
        this.startBtn = document.getElementById('btn-start');
        this.resetBtn = document.getElementById('btn-reset');
        this.soundBtn = document.getElementById('btn-sound');
        this.countdownSetup = document.getElementById('countdown-setup');
        this.lapTimes = document.getElementById('lap-times');
        this.lapList = document.getElementById('lap-list');
        this.hoursInput = document.getElementById('hours-input');
        this.minutesInput = document.getElementById('minutes-input');
        this.secondsInput = document.getElementById('seconds-input');
    }

    initEvents() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchMode(tab.dataset.mode));
        });

        // Main controls
        this.startBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.soundBtn.addEventListener('click', () => this.toggleSound());

        // Presets
        document.querySelectorAll('.preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const seconds = parseInt(btn.dataset.seconds);
                this.setCountdownTime(seconds);
            });
        });

        // Time inputs
        [this.hoursInput, this.minutesInput, this.secondsInput].forEach(input => {
            input.addEventListener('change', () => this.updateCountdownTarget());
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggleTimer();
            } else if (e.code === 'KeyR') {
                this.reset();
            } else if (e.code === 'KeyL' && this.mode === 'stopwatch' && this.running) {
                this.addLap();
            }
        });
    }

    switchMode(mode) {
        this.mode = mode;
        this.running = false;
        this.elapsed = 0;
        clearInterval(this.interval);

        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Show/hide countdown setup
        this.countdownSetup.classList.toggle('visible', mode === 'countdown');
        this.lapTimes.classList.toggle('visible', mode === 'stopwatch');

        // Reset button text
        this.startBtn.textContent = '▶ Start';
        this.startBtn.classList.remove('running');

        this.updateDisplay();
        this.saveState();
    }

    toggleTimer() {
        if (this.running) {
            this.pause();
        } else {
            this.start();
        }
    }

    start() {
        if (this.mode === 'countdown') {
            this.updateCountdownTarget();
            if (this.elapsed === 0) {
                this.elapsed = this.countdownTarget * 1000;
            }
        }

        this.running = true;
        this.startBtn.textContent = '⏸ Pause';
        this.startBtn.classList.add('running');

        const startTime = Date.now() - (this.mode === 'stopwatch' ? this.elapsed : 0);

        this.interval = setInterval(() => {
            if (this.mode === 'stopwatch') {
                this.elapsed = Date.now() - startTime;
            } else {
                this.elapsed -= 100;
                if (this.elapsed <= 0) {
                    this.elapsed = 0;
                    this.timerComplete();
                }

                // Warning states
                this.display.classList.remove('warning', 'danger');
                if (this.elapsed <= 30000 && this.elapsed > 10000) {
                    this.display.classList.add('warning');
                } else if (this.elapsed <= 10000 && this.elapsed > 0) {
                    this.display.classList.add('danger');
                }
            }
            this.updateDisplay();
        }, 100);
    }

    pause() {
        this.running = false;
        clearInterval(this.interval);
        this.startBtn.textContent = '▶ Start';
        this.startBtn.classList.remove('running');
        this.saveState();
    }

    reset() {
        this.running = false;
        clearInterval(this.interval);
        this.elapsed = 0;
        this.laps = [];
        this.startBtn.textContent = '▶ Start';
        this.startBtn.classList.remove('running');
        this.display.classList.remove('warning', 'danger');
        this.updateDisplay();
        this.renderLaps();
        this.saveState();
    }

    addLap() {
        const lapTime = this.elapsed;
        const prevLap = this.laps.length > 0 ? this.laps[this.laps.length - 1].time : 0;
        this.laps.push({
            number: this.laps.length + 1,
            time: lapTime,
            diff: lapTime - prevLap
        });
        this.renderLaps();
    }

    renderLaps() {
        this.lapList.replaceChildren();

        this.laps.slice().reverse().forEach(lap => {
            const div = document.createElement('div');
            div.className = 'lap-item';

            const numSpan = document.createElement('span');
            numSpan.className = 'lap-number';
            numSpan.textContent = 'Lap ' + lap.number;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'lap-time';
            timeSpan.textContent = this.formatTime(lap.time);

            const diffSpan = document.createElement('span');
            diffSpan.className = 'lap-diff';
            diffSpan.textContent = '+' + this.formatTime(lap.diff);

            div.appendChild(numSpan);
            div.appendChild(timeSpan);
            div.appendChild(diffSpan);
            this.lapList.appendChild(div);
        });
    }

    timerComplete() {
        this.pause();
        this.display.classList.add('danger');

        if (this.soundEnabled) {
            this.playAlarm();
        }
    }

    playAlarm() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const playBeep = (freq, duration, delay) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + delay + duration);
            osc.start(this.audioCtx.currentTime + delay);
            osc.stop(this.audioCtx.currentTime + delay + duration);
        };

        // Play 3 beeps
        playBeep(880, 0.2, 0);
        playBeep(880, 0.2, 0.3);
        playBeep(1100, 0.4, 0.6);
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.soundBtn.textContent = this.soundEnabled ? '🔔' : '🔕';
        this.soundBtn.classList.toggle('active', this.soundEnabled);
        this.saveState();
    }

    setCountdownTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        this.hoursInput.value = hours;
        this.minutesInput.value = minutes;
        this.secondsInput.value = seconds;
        this.countdownTarget = totalSeconds;
        this.elapsed = totalSeconds * 1000;
        this.updateDisplay();
    }

    updateCountdownTarget() {
        const hours = parseInt(this.hoursInput.value) || 0;
        const minutes = parseInt(this.minutesInput.value) || 0;
        const seconds = parseInt(this.secondsInput.value) || 0;
        this.countdownTarget = hours * 3600 + minutes * 60 + seconds;
        if (!this.running) {
            this.elapsed = this.countdownTarget * 1000;
            this.updateDisplay();
        }
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const centiseconds = Math.floor((ms % 1000) / 10);

        if (hours > 0) {
            return String(hours).padStart(2, '0') + ':' +
                   String(minutes).padStart(2, '0') + ':' +
                   String(seconds).padStart(2, '0');
        }
        return String(minutes).padStart(2, '0') + ':' +
               String(seconds).padStart(2, '0') + '.' +
               String(centiseconds).padStart(2, '0');
    }

    updateDisplay() {
        this.display.textContent = this.formatTime(this.elapsed);
    }

    saveState() {
        try {
            localStorage.setItem('timer-widget-state', JSON.stringify({
                mode: this.mode,
                soundEnabled: this.soundEnabled,
                countdownTarget: this.countdownTarget
            }));
        } catch (e) {}
    }

    loadState() {
        try {
            const saved = localStorage.getItem('timer-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.soundEnabled = state.soundEnabled !== false;
                this.countdownTarget = state.countdownTarget || 300;
                this.soundBtn.textContent = this.soundEnabled ? '🔔' : '🔕';
                this.soundBtn.classList.toggle('active', this.soundEnabled);
                this.setCountdownTime(this.countdownTarget);
            }
        } catch (e) {}
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.timerWidget = new TimerWidget();
});
