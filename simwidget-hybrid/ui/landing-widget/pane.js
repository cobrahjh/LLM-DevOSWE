/**
 * Landing Rate pane - SimGlass
 * Tracks touchdown vertical speed and grades landings
 */

class LandingPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'landing-glass',
            widgetVersion: '1.1.0',
            autoConnect: true
        });

        this.history = [];
        this.lastData = null;
        this.wasOnGround = true;
        this.touchdownDetected = false;
        this.touchdownData = null;

        this.initElements();
        this.initEvents();
        this.loadHistory();
    }

    initElements() {
        this.rateCircle = document.getElementById('rate-circle');
        this.rateValue = document.getElementById('rate-value');
        this.rateGrade = document.getElementById('rate-grade');
        this.gForce = document.getElementById('g-force');
        this.pitch = document.getElementById('pitch');
        this.speed = document.getElementById('speed');
        this.wind = document.getElementById('wind');
        this.historyList = document.getElementById('history-list');
        this.resetBtn = document.getElementById('btn-reset');
    }

    initEvents() {
        this.resetBtn.addEventListener('click', () => this.resetCurrent());
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.processFlightData(msg.data);
        }
    }

    processFlightData(data) {
        const onGround = data.onGround || data.altitude < 50;
        const verticalSpeed = data.verticalSpeed || 0;

        // Detect touchdown: was airborne, now on ground
        if (!this.wasOnGround && onGround && !this.touchdownDetected) {
            this.touchdownDetected = true;
            this.recordLanding({
                rate: Math.abs(Math.round(this.lastData?.verticalSpeed || verticalSpeed)),
                gForce: data.gForce || 1.0,
                pitch: data.pitch || 0,
                speed: data.speed || 0,
                windDirection: data.windDirection || 0,
                windSpeed: data.windSpeed || 0,
                timestamp: Date.now()
            });
        }

        // Reset detection when airborne again
        if (!onGround && this.wasOnGround) {
            this.touchdownDetected = false;
            this.resetDisplay();
        }

        this.wasOnGround = onGround;
        this.lastData = data;

        // Update live stats while in flight
        if (!onGround) {
            this.updateLiveStats(data);
        }
    }

    updateLiveStats(data) {
        this.speed.textContent = Math.round(data.speed || 0) + ' kts';
        if (data.windDirection !== undefined && data.windSpeed !== undefined) {
            this.wind.textContent = Math.round(data.windDirection) + '°/' + Math.round(data.windSpeed) + 'kt';
        }
    }

    recordLanding(data) {
        this.touchdownData = data;
        this.displayLanding(data);
        this.addToHistory(data);
        this.saveHistory();
    }

    displayLanding(data) {
        const rate = data.rate;
        const grade = this.getGrade(rate);

        this.rateValue.textContent = rate;
        this.rateGrade.textContent = grade.label;
        this.rateGrade.style.color = grade.color;

        this.rateCircle.className = 'rate-circle ' + grade.class;

        this.gForce.textContent = (data.gForce || 1.0).toFixed(1) + 'g';
        this.pitch.textContent = (data.pitch || 0).toFixed(1) + '°';
        this.speed.textContent = Math.round(data.speed) + ' kts';
        if (data.windDirection !== undefined) {
            this.wind.textContent = Math.round(data.windDirection) + '°/' + Math.round(data.windSpeed) + 'kt';
        }
    }

    getGrade(rate) {
        if (rate <= 60) return { label: 'Excellent', color: '#22c55e', class: 'excellent' };
        if (rate <= 120) return { label: 'Good', color: '#84cc16', class: 'good' };
        if (rate <= 180) return { label: 'Acceptable', color: '#eab308', class: 'acceptable' };
        if (rate <= 300) return { label: 'Hard', color: '#f97316', class: 'hard' };
        return { label: 'Rough!', color: '#ef4444', class: 'crash' };
    }

    addToHistory(data) {
        this.history.unshift({
            rate: data.rate,
            timestamp: data.timestamp,
            grade: this.getGrade(data.rate).class
        });

        // Keep last 10
        this.history = this.history.slice(0, 10);
        this.renderHistory();
    }

    renderHistory() {
        this.historyList.replaceChildren();

        if (this.history.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-history';
            empty.textContent = 'No landings recorded';
            this.historyList.appendChild(empty);
            return;
        }

        this.history.forEach(landing => {
            const item = document.createElement('div');
            item.className = 'history-item ' + landing.grade;

            const rate = document.createElement('span');
            rate.className = 'landing-rate';
            rate.textContent = landing.rate + ' fpm';

            const time = document.createElement('span');
            time.className = 'landing-time';
            time.textContent = new Date(landing.timestamp).toLocaleTimeString();

            item.appendChild(rate);
            item.appendChild(time);
            this.historyList.appendChild(item);
        });
    }

    resetDisplay() {
        this.rateValue.textContent = '---';
        this.rateGrade.textContent = 'Waiting...';
        this.rateGrade.style.color = 'var(--glass-accent, #667eea)';
        this.rateCircle.className = 'rate-circle';
        this.gForce.textContent = '-.-';
        this.pitch.textContent = '-.-°';
    }

    resetCurrent() {
        this.touchdownDetected = false;
        this.touchdownData = null;
        this.resetDisplay();
    }

    saveHistory() {
        try {
            localStorage.setItem('landing-glass-history', JSON.stringify(this.history));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveHistory',
                    glass: 'landing-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('landing-glass-history');
            if (saved) {
                this.history = JSON.parse(saved);
                this.renderHistory();
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadHistory',
                    glass: 'landing-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    window.LandingPane = new LandingPane();
    // SimGlassBase provides destroy() - wire to beforeunload
    window.addEventListener('beforeunload', () => window.LandingPane?.destroy());
});
