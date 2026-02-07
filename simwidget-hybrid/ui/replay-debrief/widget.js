class FlightReplay {
    constructor() {
        this.recording = false;
        this.playing = false;
        this.frames = [];
        this.events = [];
        this.currentFrame = 0;
        this.playSpeed = 1;
        this.recordInterval = null;
        this.playInterval = null;
        this.canvas = document.getElementById('timeline-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.init();
    }

    init() {
        document.getElementById('btn-record').onclick = () => this.toggleRecord();
        document.getElementById('btn-stop').onclick = () => this.stopRecording();
        document.getElementById('btn-play').onclick = () => this.togglePlay();
        document.getElementById('btn-rewind').onclick = () => this.seek(-10);
        document.getElementById('btn-forward').onclick = () => this.seek(10);
        document.getElementById('playback-speed').onchange = (e) => {
            this.playSpeed = parseFloat(e.target.value);
        };
        this.canvas.onclick = (e) => this.seekToPosition(e);
        this.loadRecordings();
        this.drawTimeline();
    }

    async toggleRecord() {
        if (this.recording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.recording = true;
        this.frames = [];
        this.events = [];
        this.currentFrame = 0;
        document.getElementById('btn-record').classList.add('recording');
        document.getElementById('btn-record').textContent = '⏺ Recording';
        document.getElementById('btn-stop').disabled = false;
        document.getElementById('rec-status').textContent = 'Recording...';
        document.getElementById('rec-status').classList.add('active');
        this.addEvent('Recording started');
        this.recordInterval = setInterval(() => this.captureFrame(), 1000);
    }

    stopRecording() {
        if (!this.recording) return;
        this.recording = false;
        clearInterval(this.recordInterval);
        document.getElementById('btn-record').classList.remove('recording');
        document.getElementById('btn-record').textContent = '⏺ Record';
        document.getElementById('btn-stop').disabled = true;
        document.getElementById('rec-status').textContent = 'Stopped';
        document.getElementById('rec-status').classList.remove('active');
        this.addEvent('Recording stopped');
        if (this.frames.length > 0) {
            this.saveRecording();
        }
        this.drawTimeline();
        this.updateTimeDisplay();
    }

    async captureFrame() {
        try {
            const res = await fetch('/api/simvars');
            if (!res.ok) return;
            const data = await res.json();
            const frame = {
                time: Date.now(),
                alt: data.PLANE_ALTITUDE || 0,
                spd: data.AIRSPEED_INDICATED || 0,
                hdg: data.PLANE_HEADING_DEGREES_TRUE || 0,
                vs: data.VERTICAL_SPEED || 0,
                lat: data.PLANE_LATITUDE || 0,
                lon: data.PLANE_LONGITUDE || 0,
                gear: data.GEAR_HANDLE_POSITION || 0,
                flaps: data.FLAPS_HANDLE_INDEX || 0
            };
            this.frames.push(frame);
            this.detectEvents(frame);
            this.updateTimeDisplay();
            this.drawTimeline();
        } catch (e) {}
    }

    detectEvents(frame) {
        const idx = this.frames.length - 1;
        if (idx < 1) return;
        const prev = this.frames[idx - 1];
        if (frame.gear !== prev.gear) {
            this.addEvent(frame.gear > 0 ? 'Gear Down' : 'Gear Up', idx);
        }
        if (frame.flaps !== prev.flaps) {
            this.addEvent('Flaps ' + frame.flaps, idx);
        }
        if (prev.vs > -100 && frame.vs < -500) {
            this.addEvent('Descent started', idx);
        }
        if (prev.alt > 50 && frame.alt < 50 && frame.vs < -100) {
            this.addEvent('Touchdown', idx);
        }
    }

    addEvent(desc, frameIdx) {
        const ev = { desc, frame: frameIdx || this.frames.length, time: Date.now() };
        this.events.push(ev);
        this.renderEvents();
    }

    renderEvents() {
        const list = document.getElementById('events-list');
        list.replaceChildren();
        this.events.slice(-10).forEach(e => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.dataset.frame = e.frame;
            const timeSpan = document.createElement('span');
            timeSpan.className = 'time';
            timeSpan.textContent = this.formatTime(e.frame);
            const descSpan = document.createElement('span');
            descSpan.className = 'desc';
            descSpan.textContent = e.desc;
            item.appendChild(timeSpan);
            item.appendChild(descSpan);
            item.onclick = () => {
                this.currentFrame = parseInt(item.dataset.frame);
                this.displayFrame(this.currentFrame);
            };
            list.appendChild(item);
        });
    }

    togglePlay() {
        if (this.frames.length === 0) return;
        if (this.playing) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        this.playing = true;
        document.getElementById('btn-play').textContent = '⏸';
        this.playInterval = setInterval(() => {
            if (this.currentFrame >= this.frames.length - 1) {
                this.pausePlayback();
                return;
            }
            this.currentFrame++;
            this.displayFrame(this.currentFrame);
        }, 1000 / this.playSpeed);
    }

    pausePlayback() {
        this.playing = false;
        clearInterval(this.playInterval);
        document.getElementById('btn-play').textContent = '▶';
    }

    seek(seconds) {
        const newFrame = this.currentFrame + seconds;
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, newFrame));
        this.displayFrame(this.currentFrame);
    }

    seekToPosition(e) {
        if (this.frames.length === 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        this.currentFrame = Math.floor(pct * this.frames.length);
        this.displayFrame(this.currentFrame);
    }

    displayFrame(idx) {
        if (idx < 0 || idx >= this.frames.length) return;
        const f = this.frames[idx];
        document.getElementById('replay-alt').textContent = Math.round(f.alt) + ' ft';
        document.getElementById('replay-spd').textContent = Math.round(f.spd) + ' kt';
        document.getElementById('replay-hdg').textContent = Math.round(f.hdg) + ' deg';
        document.getElementById('replay-vs').textContent = Math.round(f.vs) + ' fpm';
        this.updateTimeDisplay();
        this.drawTimeline();
    }

    drawTimeline() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.fillStyle = '#0f0f1a';
        this.ctx.fillRect(0, 0, w, h);
        if (this.frames.length === 0) return;
        // Draw altitude profile
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        const maxAlt = Math.max(...this.frames.map(f => f.alt), 1000);
        this.frames.forEach((f, i) => {
            const x = (i / this.frames.length) * w;
            const y = h - (f.alt / maxAlt) * (h - 10);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();
        // Draw event markers
        this.events.forEach(e => {
            const x = (e.frame / this.frames.length) * w;
            this.ctx.fillStyle = '#f59e0b';
            this.ctx.beginPath();
            this.ctx.arc(x, 10, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
        // Draw playhead
        const playX = (this.currentFrame / this.frames.length) * w;
        this.ctx.fillStyle = '#22c55e';
        this.ctx.fillRect(playX - 1, 0, 2, h);
    }

    formatTime(frames) {
        const secs = frames;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    updateTimeDisplay() {
        document.getElementById('current-time').textContent = this.formatTime(this.currentFrame);
        document.getElementById('total-time').textContent = this.formatTime(this.frames.length);
    }

    saveRecording() {
        const name = 'Flight ' + new Date().toLocaleString();
        const rec = { name, frames: this.frames, events: this.events, date: Date.now() };
        const saved = JSON.parse(localStorage.getItem('SimGlass-recordings') || '[]');
        saved.unshift(rec);
        if (saved.length > 10) saved.pop();
        localStorage.setItem('SimGlass-recordings', JSON.stringify(saved));
        this.loadRecordings();
    }

    loadRecordings() {
        const saved = JSON.parse(localStorage.getItem('SimGlass-recordings') || '[]');
        const list = document.getElementById('recordings-list');
        list.replaceChildren();
        if (saved.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#888;font-size:11px;';
            empty.textContent = 'No recordings yet';
            list.appendChild(empty);
            return;
        }
        saved.forEach((r, i) => {
            const item = document.createElement('div');
            item.className = 'recording-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = r.name;
            const durSpan = document.createElement('span');
            durSpan.className = 'duration';
            durSpan.textContent = this.formatTime(r.frames.length);
            const btn = document.createElement('button');
            btn.textContent = 'Load';
            btn.onclick = () => this.loadRecording(i);
            item.appendChild(nameSpan);
            item.appendChild(durSpan);
            item.appendChild(btn);
            list.appendChild(item);
        });
    }

    loadRecording(idx) {
        const saved = JSON.parse(localStorage.getItem('SimGlass-recordings') || '[]');
        if (idx >= saved.length) return;
        const rec = saved[idx];
        this.frames = rec.frames;
        this.events = rec.events;
        this.currentFrame = 0;
        this.displayFrame(0);
        this.renderEvents();
        document.getElementById('rec-status').textContent = 'Loaded: ' + rec.name;
    }

    destroy() {
        if (this.recordInterval) {
            clearInterval(this.recordInterval);
            this.recordInterval = null;
        }
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flightReplay = new FlightReplay();
    window.addEventListener('beforeunload', () => window.flightReplay?.destroy());
});
