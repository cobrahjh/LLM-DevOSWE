/**
 * Voice Stress Analyzer Glass v2.0.0
 * Real-time acoustic analysis: F0 (pitch), Jitter, Shimmer, HNR
 * Uses personal baseline calibration to detect physiological stress markers
 */
class VoiceStressGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'voice-stress',
            widgetVersion: '2.0.0',
            autoConnect: false  // Uses HTTP to port 8771
        });

        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.animationId = null;
        this.countdownInterval = null;
        this.currentMode = null;
        this.isRecording = false;

        this.calmBaseline = null;
        this.stressBaseline = null;
        this.history = [];

        this.f0Values = [];
        this.ampValues = [];

        this.FFT_SIZE = 4096;
        this.F0_MIN = 75;
        this.F0_MAX = 500;
        this.CORR_THRESHOLD = 0.2;
        this.RECORD_SECONDS = 8;
        this.SERVER_URL = 'http://localhost:8771';

        this.calmPrompts = [
            'Count slowly from 1 to 10',
            'Describe what you see around you',
            'Name the days of the week',
            'Talk about your favorite food'
        ];
        this.stressPrompts = [
            'Describe a time you felt very anxious',
            'Talk about your biggest fear',
            'Recall an embarrassing moment',
            'Describe a stressful deadline'
        ];

        this.initElements();
        this.initEvents();
        this.loadState();
    }

    initElements() {
        this.el = {
            calmStatus: document.getElementById('calmStatus'),
            stressStatus: document.getElementById('stressStatus'),
            resetBtn: document.getElementById('resetBtn'),
            promptBox: document.getElementById('promptBox'),
            promptLabel: document.getElementById('promptLabel'),
            promptText: document.getElementById('promptText'),
            recordingPanel: document.getElementById('recordingPanel'),
            countdown: document.getElementById('countdown'),
            liveF0: document.getElementById('liveF0'),
            levelFill: document.getElementById('levelFill'),
            buttonPanel: document.getElementById('buttonPanel'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            resultPanel: document.getElementById('resultPanel'),
            resultVerdict: document.getElementById('resultVerdict'),
            resultScore: document.getElementById('resultScore'),
            resultMetrics: document.getElementById('resultMetrics'),
            resultBreakdown: document.getElementById('resultBreakdown'),
            metricsPanel: document.getElementById('metricsPanel'),
            metricF0: document.getElementById('metricF0'),
            metricF0Var: document.getElementById('metricF0Var'),
            metricJitter: document.getElementById('metricJitter'),
            metricShimmer: document.getElementById('metricShimmer'),
            metricHNR: document.getElementById('metricHNR'),
            canvasPanel: document.getElementById('canvasPanel'),
            waveformCanvas: document.getElementById('waveform'),
            f0Canvas: document.getElementById('f0canvas'),
            historyPanel: document.getElementById('historyPanel'),
            historyList: document.getElementById('historyList')
        };
    }

    initEvents() {
        document.getElementById('calmBtn').addEventListener('click', () => this.startRecording('calm'));
        document.getElementById('stressBtn').addEventListener('click', () => this.startRecording('stress'));
        this.el.analyzeBtn.addEventListener('click', () => this.startRecording('analyze'));
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());
        this.el.resetBtn.addEventListener('click', () => this.resetAll());
    }

    // --- Audio Setup ---

    async startRecording(mode) {
        try {
            this.currentMode = mode;
            this.f0Values = [];
            this.ampValues = [];

            const prompts = mode === 'calm' ? this.calmPrompts : mode === 'stress' ? this.stressPrompts : null;
            this.el.promptLabel.textContent = mode === 'calm' ? 'SPEAK CALMLY:' : mode === 'stress' ? 'RECALL STRESS & SPEAK:' : 'SPEAK NATURALLY:';
            this.el.promptText.textContent = prompts
                ? prompts[Math.floor(Math.random() * prompts.length)]
                : 'Say anything \u2014 system will analyze';
            this.el.promptBox.classList.remove('hidden');

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.FFT_SIZE;
            this.analyser.smoothingTimeConstant = 0.5;
            this.audioContext.createMediaStreamSource(this.mediaStream).connect(this.analyser);

            this.isRecording = true;
            this.el.buttonPanel.classList.add('hidden');
            this.el.recordingPanel.classList.remove('hidden');
            this.el.metricsPanel.classList.remove('hidden');
            this.el.canvasPanel.classList.remove('hidden');
            this.el.resultPanel.classList.add('hidden');

            let timeLeft = this.RECORD_SECONDS;
            this.el.countdown.textContent = timeLeft;
            this.countdownInterval = setInterval(() => {
                timeLeft--;
                this.el.countdown.textContent = timeLeft;
                if (timeLeft <= 0) this.stopRecording();
            }, 1000);

            this.analyze();
        } catch (err) {
            console.error('[VoiceStress] Mic error:', err);
            alert('Microphone access required');
            this.resetUI();
        }
    }

    stopRecording() {
        this.isRecording = false;
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
        if (this.audioContext) this.audioContext.close();

        this.el.recordingPanel.classList.add('hidden');
        this.el.promptBox.classList.add('hidden');
        this.el.buttonPanel.classList.remove('hidden');

        this.processResults();
    }

    // --- Analysis Loop ---

    analyze() {
        if (!this.isRecording) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const freqArray = new Uint8Array(bufferLength);

        this.analyser.getByteTimeDomainData(dataArray);
        this.analyser.getByteFrequencyData(freqArray);

        // RMS level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        this.el.levelFill.style.width = Math.min(100, rms * 300) + '%';

        // F0 detection
        const sampleRate = this.audioContext.sampleRate;
        const f0 = this.detectF0(dataArray, sampleRate);
        if (f0 && f0 > this.F0_MIN && f0 < this.F0_MAX) {
            this.f0Values.push(f0);
            this.el.liveF0.textContent = Math.round(f0);
            this.ampValues.push(Math.max(...Array.from(dataArray).map(v => Math.abs(v - 128))));
        }

        if (this.f0Values.length > 500) {
            this.f0Values = this.f0Values.slice(-500);
            this.ampValues = this.ampValues.slice(-500);
        }

        // Update live metrics
        if (this.f0Values.length > 10) {
            const f0Mean = this.mean(this.f0Values);
            const f0Var = this.stddev(this.f0Values);
            const jitter = this.calcJitter(this.f0Values);
            const shimmer = this.calcShimmer(this.ampValues);
            const hnr = this.calcHNR(freqArray, f0Mean);

            this.el.metricF0.textContent = f0Mean.toFixed(0) + ' Hz';
            this.el.metricF0Var.textContent = f0Var.toFixed(1) + ' Hz';
            this.el.metricJitter.textContent = Math.min(5, jitter).toFixed(2) + '%';
            this.el.metricShimmer.textContent = Math.min(20, shimmer).toFixed(2) + '%';
            this.el.metricHNR.textContent = Math.max(0, Math.min(30, hnr)).toFixed(1) + ' dB';
        }

        this.drawWaveform(dataArray);
        this.drawF0();

        this.animationId = requestAnimationFrame(() => this.analyze());
    }

    // --- DSP Functions ---

    detectF0(dataArray, sampleRate) {
        const minPeriod = Math.floor(sampleRate / this.F0_MAX);
        const maxPeriod = Math.floor(sampleRate / this.F0_MIN);

        const signal = new Float32Array(dataArray.length);
        let rms = 0;
        for (let i = 0; i < dataArray.length; i++) {
            signal[i] = (dataArray[i] - 128) / 128;
            rms += signal[i] * signal[i];
        }
        rms = Math.sqrt(rms / signal.length);
        if (rms < 0.015) return null;

        let bestCorr = 0, bestPeriod = 0;
        for (let period = minPeriod; period < Math.min(maxPeriod, signal.length / 2); period++) {
            let corr = 0;
            for (let i = 0; i < signal.length - period; i++) corr += signal[i] * signal[i + period];
            corr /= (signal.length - period);
            if (corr > bestCorr) { bestCorr = corr; bestPeriod = period; }
        }

        if (bestCorr < this.CORR_THRESHOLD || bestPeriod === 0) return null;
        return sampleRate / bestPeriod;
    }

    calcJitter(f0s) {
        if (f0s.length < 3) return 0;
        const periods = f0s.map(f => 1 / f);
        let diff = 0;
        for (let i = 1; i < periods.length; i++) diff += Math.abs(periods[i] - periods[i - 1]);
        return (diff / (periods.length - 1)) / this.mean(periods) * 100;
    }

    calcShimmer(amps) {
        if (amps.length < 2) return 0;
        let diff = 0;
        for (let i = 1; i < amps.length; i++) diff += Math.abs(amps[i] - amps[i - 1]);
        const avg = this.mean(amps);
        return avg > 0 ? (diff / (amps.length - 1)) / avg * 100 : 0;
    }

    calcHNR(freqData, f0) {
        if (!f0 || f0 < this.F0_MIN) return 0;
        const binSize = 44100 / this.FFT_SIZE;
        let harmonicEnergy = 0, totalEnergy = 0;
        for (let i = 0; i < freqData.length; i++) {
            const freq = i * binSize;
            const energy = Math.pow(freqData[i] / 255, 2);
            totalEnergy += energy;
            for (let h = 1; h <= 10; h++) {
                if (Math.abs(freq - f0 * h) < binSize * 2) { harmonicEnergy += energy; break; }
            }
        }
        const noiseEnergy = totalEnergy - harmonicEnergy;
        if (noiseEnergy <= 0) return 30;
        return 10 * Math.log10(harmonicEnergy / noiseEnergy);
    }

    mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

    stddev(arr) {
        const m = this.mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
    }

    // --- Canvas Drawing ---

    drawWaveform(dataArray) {
        const canvas = this.el.waveformCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = this.currentMode === 'calm' ? '#00ff88' :
                          this.currentMode === 'stress' ? '#ff6644' : '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const slice = w / dataArray.length;
        for (let i = 0; i < dataArray.length; i++) {
            const y = (dataArray[i] / 128) * h / 2;
            i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
    }

    drawF0() {
        const canvas = this.el.f0Canvas;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = '#1a1a2e';
        ctx.fillStyle = '#333';
        ctx.font = '10px monospace';
        [100, 200, 300, 400].forEach(freq => {
            const y = h - ((freq - this.F0_MIN) / (this.F0_MAX - this.F0_MIN) * h);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            ctx.fillText(freq + 'Hz', 5, y - 2);
        });

        // Draw calm/stress baseline bands
        if (this.calmBaseline) {
            const y = h - ((this.calmBaseline.f0Mean - this.F0_MIN) / (this.F0_MAX - this.F0_MIN) * h);
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (this.stressBaseline) {
            const y = h - ((this.stressBaseline.f0Mean - this.F0_MIN) / (this.F0_MAX - this.F0_MIN) * h);
            ctx.strokeStyle = 'rgba(251, 146, 60, 0.3)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            ctx.setLineDash([]);
        }

        // F0 contour
        const vals = this.f0Values.slice(-100);
        if (vals.length > 1) {
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            vals.forEach((f0, i) => {
                const x = (i / 100) * w;
                const y = h - ((f0 - this.F0_MIN) / (this.F0_MAX - this.F0_MIN) * h);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }

    // --- Result Processing ---

    processResults() {
        if (this.f0Values.length < 20) {
            this.showError('Not Enough Speech', 'Speak more clearly for at least a few seconds.');
            return;
        }

        const f0Mean = this.mean(this.f0Values);
        const f0Var = this.stddev(this.f0Values);
        const jitter = this.calcJitter(this.f0Values);
        const shimmer = this.calcShimmer(this.ampValues);
        const metrics = { f0Mean, f0Var, jitter, shimmer };

        if (this.currentMode === 'calm') {
            this.calmBaseline = metrics;
            this.el.calmStatus.className = 'status-badge active';
            this.el.calmStatus.textContent = '\u2713 Calm (' + Math.round(f0Mean) + 'Hz)';
            this.showSaved('CALM BASELINE SAVED', metrics);
            this.updateAnalyzeButton();
            this.saveState();
            return;
        }

        if (this.currentMode === 'stress') {
            this.stressBaseline = metrics;
            this.el.stressStatus.className = 'status-badge stress';
            this.el.stressStatus.textContent = '\u2713 Stress (' + Math.round(f0Mean) + 'Hz)';
            this.showSaved('STRESS BASELINE SAVED', metrics);
            this.updateAnalyzeButton();
            this.saveState();
            return;
        }

        // Analysis mode — compare against baselines
        if (!this.calmBaseline || !this.stressBaseline) {
            this.showError('Calibrate First', 'Record calm and stress baselines first.');
            return;
        }

        const scores = this.scoreMetrics(metrics);
        const total = Math.round(scores.total * 100);
        let verdict, panelClass;
        if (total > 60) { verdict = 'STRESS DETECTED'; panelClass = 'result-stress'; }
        else if (total > 40) { verdict = 'MODERATE STRESS'; panelClass = 'result-moderate'; }
        else { verdict = 'CALM STATE'; panelClass = 'result-calm'; }

        this.el.resultPanel.className = 'result-panel ' + panelClass;
        this.el.resultVerdict.textContent = verdict;
        this.el.resultScore.textContent = total + '%';
        this.el.resultMetrics.textContent =
            'F0: ' + f0Mean.toFixed(0) + ' Hz | Var: ' + f0Var.toFixed(1) +
            ' | Jitter: ' + jitter.toFixed(2) + '% | Shimmer: ' + shimmer.toFixed(2) + '%';

        // Breakdown
        this.el.resultBreakdown.innerHTML =
            '<div class="breakdown-title">Feature Breakdown:</div>' +
            scores.details.map(d => {
                const cls = d.value > 50 ? 'stress' : 'calm';
                return '<div class="breakdown-item"><span>' + d.name + ' (' + d.weight + '%)</span><span class="' + cls + '">' + d.value.toFixed(0) + '% stress</span></div>';
            }).join('');
        this.el.resultPanel.classList.remove('hidden');

        const entry = { time: new Date().toLocaleTimeString(), score: total, metrics };
        this.history.unshift(entry);
        this.history = this.history.slice(0, 10);
        this.updateHistory();
        this.sendToServer(entry);
    }

    scoreMetrics(metrics) {
        const cb = this.calmBaseline, sb = this.stressBaseline;

        function ratio(val, calm, stress) {
            const cd = Math.abs(val - calm);
            const sd = Math.abs(val - stress);
            return cd / (cd + sd + 0.01);
        }

        const f0Score = ratio(metrics.f0Mean, cb.f0Mean, sb.f0Mean);
        const varScore = ratio(metrics.f0Var, cb.f0Var, sb.f0Var);
        const jitScore = ratio(metrics.jitter, cb.jitter, sb.jitter);
        const shimScore = ratio(metrics.shimmer, cb.shimmer, sb.shimmer);

        const total = f0Score * 0.35 + varScore * 0.25 + jitScore * 0.20 + shimScore * 0.20;

        return {
            total,
            details: [
                { name: 'F0 (Pitch)', value: f0Score * 100, weight: 35 },
                { name: 'F0 Variance', value: varScore * 100, weight: 25 },
                { name: 'Jitter', value: jitScore * 100, weight: 20 },
                { name: 'Shimmer', value: shimScore * 100, weight: 20 }
            ]
        };
    }

    // --- UI Helpers ---

    showSaved(text, metrics) {
        this.el.resultPanel.className = 'result-panel result-saved';
        this.el.resultVerdict.textContent = '\u2713 ' + text;
        this.el.resultScore.textContent = '';
        this.el.resultMetrics.textContent =
            'F0: ' + metrics.f0Mean.toFixed(0) + ' Hz | Jitter: ' + metrics.jitter.toFixed(2) + '%';
        this.el.resultBreakdown.innerHTML = '';
        this.el.resultPanel.classList.remove('hidden');
        this.el.resetBtn.classList.remove('hidden');
    }

    showError(title, message) {
        this.el.resultPanel.className = 'result-panel result-error';
        this.el.resultVerdict.textContent = title;
        this.el.resultScore.textContent = '';
        this.el.resultMetrics.textContent = message;
        this.el.resultBreakdown.innerHTML = '';
        this.el.resultPanel.classList.remove('hidden');
    }

    updateAnalyzeButton() {
        this.el.analyzeBtn.disabled = !(this.calmBaseline && this.stressBaseline);
    }

    updateHistory() {
        if (this.history.length === 0) {
            this.el.historyPanel.classList.add('hidden');
            return;
        }
        this.el.historyPanel.classList.remove('hidden');
        this.el.historyList.innerHTML = this.history.map(h => {
            const c = h.score > 60 ? 'stress' : h.score > 40 ? 'moderate' : 'calm';
            return '<div class="history-item"><span class="history-time">' + h.time +
                   '</span><span class="history-score ' + c + '">' + h.score + '%</span></div>';
        }).join('');
    }

    resetAll() {
        this.calmBaseline = null;
        this.stressBaseline = null;
        this.history = [];
        this.el.calmStatus.className = 'status-badge';
        this.el.calmStatus.textContent = '\u25CB Calm Baseline';
        this.el.stressStatus.className = 'status-badge';
        this.el.stressStatus.textContent = '\u25CB Stress Baseline';
        this.el.resetBtn.classList.add('hidden');
        this.el.resultPanel.classList.add('hidden');
        this.el.historyPanel.classList.add('hidden');
        this.el.metricsPanel.classList.add('hidden');
        this.el.canvasPanel.classList.add('hidden');
        this.updateAnalyzeButton();
        localStorage.removeItem('voice-stress-state');
    }

    resetUI() {
        this.el.recordingPanel.classList.add('hidden');
        this.el.promptBox.classList.add('hidden');
        this.el.buttonPanel.classList.remove('hidden');
    }

    // --- Persistence ---

    saveState() {
        try {
            localStorage.setItem('voice-stress-state', JSON.stringify({
                calmBaseline: this.calmBaseline,
                stressBaseline: this.stressBaseline
            }));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveState',
                    glass: 'voice-stress',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('voice-stress-state');
            if (!saved) return;
            const state = JSON.parse(saved);
            if (state.calmBaseline) {
                this.calmBaseline = state.calmBaseline;
                this.el.calmStatus.className = 'status-badge active';
                this.el.calmStatus.textContent = '\u2713 Calm (' + Math.round(state.calmBaseline.f0Mean) + 'Hz)';
            }
            if (state.stressBaseline) {
                this.stressBaseline = state.stressBaseline;
                this.el.stressStatus.className = 'status-badge stress';
                this.el.stressStatus.textContent = '\u2713 Stress (' + Math.round(state.stressBaseline.f0Mean) + 'Hz)';
            }
            if (state.calmBaseline || state.stressBaseline) {
                this.el.resetBtn.classList.remove('hidden');
            }
            this.updateAnalyzeButton();
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadState',
                    glass: 'voice-stress',
                    storage: 'localStorage'
                });
            }
        }
    }

    destroy() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (e) {
                if (window.telemetry) {
                    telemetry.captureError(e, {
                        operation: 'closeAudioContext',
                        glass: 'voice-stress'
                    });
                }
            }
        }

        // Call parent destroy
        super.destroy();
    }

    // --- Server Integration ---

    async sendToServer(result) {
        try {
            await fetch(this.SERVER_URL + '/api/voice-stress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...result,
                    calmBaseline: this.calmBaseline,
                    stressBaseline: this.stressBaseline
                })
            });
        } catch (e) {
            // Server not available — that's fine
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.voiceStress = new VoiceStressGlass();
    window.addEventListener('beforeunload', () => window.voiceStress?.destroy());
});
