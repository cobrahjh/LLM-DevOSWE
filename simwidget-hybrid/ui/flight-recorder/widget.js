/**
 * SimGlass Flight Recorder v2.0.0
 * Records flight data for analysis and playback
 * Delta recording: optionals only recorded on change
 * Position playback: Sets aircraft to starting position only
 *
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\flight-recorder\widget.js
 * Last Updated: 2026-02-07
 *
 * v2.0.0 - Migrated to SimGlassBase
 * v1.4.0 - Optimized: full lat/lon only on first point, data replay for rest
 * v1.3.0 - Position recording & playback via slew mode
 * v1.2.0 - Added playback functionality
 * v1.1.0 - Delta recording for optionals (controls, AP, lights)
 * v1.0.0 - Initial release
 */

const API_BASE = `http://${window.location.hostname}:8080`;
const STORAGE_KEY = 'SimGlass_recorder_settings';
const SESSIONS_KEY = 'SimGlass_flight_sessions';

class FlightRecorderWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-recorder',
            widgetVersion: '2.0.0',
            autoConnect: true  // Needs real-time WebSocket for recording
        });

        this._destroyed = false;
        this.isRecording = false;
        this.isPaused = false;
        this.isPlaying = false;
        this.playbackInterval = null;
        this.playbackIndex = 0;
        this.playbackSession = null;
        this.recordingInterval = null;
        this.startTime = null;
        this.pausedDuration = 0;
        this.pauseStartTime = null;
        this.timerInterval = null;

        this.currentSession = null;
        this.savedSessions = [];
        this.latestFlightData = null;

        // Previous state tracking for delta recording
        this.prevState = {
            thr: null, flp: null, gear: null, brk: null,
            ap: null, apHdg: null, apAlt: null, apVs: null,
            lts: null
        };

        // Settings
        this.settings = {
            interval: 100,
            autostop: 0,
            recordControls: true,
            recordAutopilot: true,
            recordLights: false
        };

        this.loadSettings();
        this.loadSessions();
        this.setupEventListeners();
        this.updateUI();

        // Load transparency preference
        if (localStorage.getItem('recorder_transparent') === 'true') {
            document.body.classList.add('transparent');
        }

        // Expose methods to window for inline handlers
        window.exportSessionByIndex = (index) => this.exportSessionByIndex(index);
        window.deleteSession = (index) => this.deleteSession(index);
        window.playSessionByIndex = (index) => this.playSessionByIndex(index);
    }

    // ============================================
    // SIMGLASSBASE LIFECYCLE HOOKS
    // ============================================

    onMessage(data) {
        this.latestFlightData = data;
        this.updateCurrentData(data);

        // Record data point if recording
        if (this.isRecording && !this.isPaused && this.currentSession) {
            this.recordDataPoint(data);
        }
    }

    onConnect() {
        console.log('[Flight Recorder] WebSocket connected');
    }

    onDisconnect() {
        console.log('[Flight Recorder] WebSocket disconnected');
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    setupEventListeners() {
        document.getElementById('btn-record').addEventListener('click', () => this.startRecording());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-stop').addEventListener('click', () => this.stopRecording());
        document.getElementById('btn-play').addEventListener('click', () => this.togglePlayback());
        document.getElementById('btn-export').addEventListener('click', () => this.exportSession());
        document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.importSession(e));
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('btn-close-settings').addEventListener('click', () => this.closeSettings());
        document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-transparency').addEventListener('click', () => this.toggleTransparency());
    }

    updateCurrentData(data) {
        const altEl = document.getElementById('data-alt');
        const spdEl = document.getElementById('data-spd');
        const hdgEl = document.getElementById('data-hdg');
        const vsEl = document.getElementById('data-vs');

        if (altEl) altEl.textContent = Math.round(data.altitude || 0).toLocaleString() + ' ft';
        if (spdEl) spdEl.textContent = Math.round(data.speed || 0) + ' kts';
        if (hdgEl) hdgEl.textContent = Math.round(data.heading || 0) + '°';
        if (vsEl) vsEl.textContent = Math.round(data.verticalSpeed || 0) + ' fpm';
    }

    // ============================================
    // RECORDING FUNCTIONS
    // ============================================

    createSession() {
        return {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            startTime: new Date().toISOString(),
            endTime: null,
            duration: 0,
            interval: this.settings.interval,
            dataPoints: [],
            metadata: {
                aircraft: 'Unknown',
                departure: null,
                arrival: null
            },
            settings: { ...this.settings }
        };
    }

    startRecording() {
        if (this.isRecording) return;

        this.currentSession = this.createSession();
        this.isRecording = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.pausedDuration = 0;

        // Reset previous state for delta recording
        this.prevState = {
            thr: null, flp: null, gear: null, brk: null,
            ap: null, apHdg: null, apAlt: null, apVs: null,
            lts: null
        };

        this.updateUI();
        this.startTimer();

        console.log('[Flight Recorder] Recording started');
    }

    togglePause() {
        if (!this.isRecording) return;

        if (this.isPaused) {
            // Resume
            this.pausedDuration += Date.now() - this.pauseStartTime;
            this.isPaused = false;
        } else {
            // Pause
            this.pauseStartTime = Date.now();
            this.isPaused = true;
        }

        this.updateUI();
    }

    async stopRecording() {
        if (this.isPlaying) {
            await this.stopPlayback();
            return;
        }
        if (!this.isRecording) return;

        this.isRecording = false;
        this.isPaused = false;

        if (this.currentSession) {
            this.currentSession.endTime = new Date().toISOString();
            this.currentSession.duration = this.getElapsedTime();

            // Save session
            this.savedSessions.unshift(this.currentSession);
            if (this.savedSessions.length > 20) this.savedSessions.pop(); // Keep last 20
            this.saveSessions();
            this.renderSessions();
        }

        this.stopTimer();
        this.updateUI();

        console.log('[Flight Recorder] Recording stopped, saved session:', this.currentSession?.id);
    }

    recordDataPoint(data) {
        if (!this.currentSession) return;

        const isFirstPoint = this.currentSession.dataPoints.length === 0;

        const point = {
            t: this.getElapsedTime() // Timestamp in ms
        };

        // First point: record absolute position for accurate start
        if (isFirstPoint) {
            point.lat = data.latitude || 0;
            point.lon = data.longitude || 0;
            point.alt = Math.round(data.altitudeMSL || data.altitude || 0);
            point.hdg = Math.round(data.heading || 0);
            point.pitch = data.pitch || 0;
            point.bank = data.bank || 0;
            point.spd = Math.round(data.speed || 0);

            // Store start position in session metadata
            this.currentSession.startPosition = {
                lat: point.lat,
                lon: point.lon,
                alt: point.alt,
                hdg: point.hdg
            };
        } else {
            // Subsequent points: only essential flight data (no lat/lon)
            point.alt = Math.round(data.altitudeMSL || data.altitude || 0);
            point.hdg = Math.round(data.heading || 0);
            point.spd = Math.round(data.speed || 0);
            point.vs = Math.round(data.verticalSpeed || 0);
            point.gs = Math.round(data.groundSpeed || 0);

            // Only include pitch/bank if significantly different from 0
            if (Math.abs(data.pitch || 0) > 1) point.pitch = Math.round((data.pitch || 0) * 10) / 10;
            if (Math.abs(data.bank || 0) > 1) point.bank = Math.round((data.bank || 0) * 10) / 10;
        }

        // Optional: Control inputs - only record on change
        if (this.settings.recordControls) {
            const thr = Math.round((data.throttle || 0) * 100);
            const flp = data.flapsIndex || 0;
            const gear = data.gearDown ? 1 : 0;
            const brk = data.parkingBrake ? 1 : 0;

            if (thr !== this.prevState.thr) { point.thr = thr; this.prevState.thr = thr; }
            if (flp !== this.prevState.flp) { point.flp = flp; this.prevState.flp = flp; }
            if (gear !== this.prevState.gear) { point.gear = gear; this.prevState.gear = gear; }
            if (brk !== this.prevState.brk) { point.brk = brk; this.prevState.brk = brk; }
        }

        // Optional: Autopilot - only record on change
        if (this.settings.recordAutopilot) {
            const ap = data.apMaster ? 1 : 0;
            const apHdg = data.apHdgLock ? Math.round(data.apHdgSet || 0) : null;
            const apAlt = data.apAltLock ? Math.round(data.apAltSet || 0) : null;
            const apVs = data.apVsLock ? Math.round(data.apVsSet || 0) : null;

            if (ap !== this.prevState.ap) { point.ap = ap; this.prevState.ap = ap; }
            if (apHdg !== this.prevState.apHdg) { point.apHdg = apHdg; this.prevState.apHdg = apHdg; }
            if (apAlt !== this.prevState.apAlt) { point.apAlt = apAlt; this.prevState.apAlt = apAlt; }
            if (apVs !== this.prevState.apVs) { point.apVs = apVs; this.prevState.apVs = apVs; }
        }

        // Optional: Lights - only record on change
        if (this.settings.recordLights) {
            const lts = (data.navLight ? 1 : 0) |
                        (data.beaconLight ? 2 : 0) |
                        (data.strobeLight ? 4 : 0) |
                        (data.landingLight ? 8 : 0);

            if (lts !== this.prevState.lts) { point.lts = lts; this.prevState.lts = lts; }
        }

        this.currentSession.dataPoints.push(point);
        this.updateStats();
    }

    getElapsedTime() {
        if (!this.startTime) return 0;
        const now = this.isPaused ? this.pauseStartTime : Date.now();
        return now - this.startTime - this.pausedDuration;
    }

    // ============================================
    // PLAYBACK FUNCTIONS
    // ============================================

    async togglePlayback() {
        if (this.isPlaying) {
            await this.stopPlayback();
        } else {
            await this.startPlayback();
        }
    }

    async startPlayback() {
        if (this.savedSessions.length === 0) return;
        if (this.isRecording) return;

        this.playbackSession = this.savedSessions[0]; // Play most recent
        if (!this.playbackSession || !this.playbackSession.dataPoints.length) return;

        // Get starting position from first data point or session metadata
        const startPos = this.playbackSession.startPosition || this.playbackSession.dataPoints[0];

        if (startPos && startPos.lat !== undefined && startPos.lon !== undefined) {
            // Enable slew mode, position aircraft at start, then disable slew
            await this.setSlewMode(true);
            await this.setAircraftPosition(startPos);
            await new Promise(r => setTimeout(r, 500)); // Wait for position to apply
            await this.setSlewMode(false);
            console.log('[Flight Recorder] Aircraft positioned at start:', startPos.lat.toFixed(4), startPos.lon.toFixed(4));
        }

        this.isPlaying = true;
        this.playbackIndex = 0;
        this.startTime = Date.now();

        this.updateUI();
        this.playNextFrame();

        console.log('[Flight Recorder] Playback started:', this.playbackSession.id);
    }

    async stopPlayback() {
        this.isPlaying = false;
        this.playbackSession = null;
        this.playbackIndex = 0;

        if (this.playbackInterval) {
            clearTimeout(this.playbackInterval);
            this.playbackInterval = null;
        }

        this.updateUI();
        console.log('[Flight Recorder] Playback stopped');
    }

    async playNextFrame() {
        if (!this.isPlaying || !this.playbackSession) return;

        const points = this.playbackSession.dataPoints;
        if (this.playbackIndex >= points.length) {
            await this.stopPlayback();
            return;
        }

        const point = points[this.playbackIndex];

        // Display data only (no position changes during playback)
        this.displayPlaybackPoint(point);

        // Update duration display
        const durationEl = document.getElementById('status-duration');
        if (durationEl) durationEl.textContent = this.formatDuration(point.t);

        this.playbackIndex++;

        // Schedule next frame
        if (this.playbackIndex < points.length) {
            const nextPoint = points[this.playbackIndex];
            const delay = nextPoint.t - point.t;
            this.playbackInterval = setTimeout(() => this.playNextFrame(), Math.max(delay, 10));
        } else {
            await this.stopPlayback();
        }
    }

    async setSlewMode(enabled) {
        try {
            await fetch(`${API_BASE}/api/recorder/slew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            console.log(`[Flight Recorder] Slew mode: ${enabled ? 'ON' : 'OFF'}`);
        } catch (e) {
            console.error('[Flight Recorder] Slew mode error:', e);
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'setSlewMode',
                    widget: 'flight-recorder',
                    enabled: enabled
                });
            }
        }
    }

    async setAircraftPosition(point) {
        try {
            await fetch(`${API_BASE}/api/recorder/position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: point.lat,
                    lon: point.lon,
                    alt: point.alt,
                    hdg: point.hdg,
                    pitch: point.pitch || 0,
                    bank: point.bank || 0,
                    spd: point.spd
                })
            });
        } catch (e) {
            console.error('[Flight Recorder] Position set error:', e);
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'setAircraftPosition',
                    widget: 'flight-recorder'
                });
            }
        }
    }

    displayPlaybackPoint(point) {
        const altEl = document.getElementById('data-alt');
        const spdEl = document.getElementById('data-spd');
        const hdgEl = document.getElementById('data-hdg');
        const vsEl = document.getElementById('data-vs');
        const ptsEl = document.getElementById('stat-points');

        if (altEl) altEl.textContent = (point.alt || 0).toLocaleString() + ' ft';
        if (spdEl) spdEl.textContent = (point.spd || 0) + ' kts';
        if (hdgEl) hdgEl.textContent = (point.hdg || 0) + '°';
        if (vsEl) vsEl.textContent = (point.vs || 0) + ' fpm';

        // Update stats during playback
        if (ptsEl) ptsEl.textContent = `${this.playbackIndex}/${this.playbackSession.dataPoints.length}`;
    }

    // ============================================
    // TIMER & UI
    // ============================================

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.updateDuration();

            // Auto-stop check
            if (this.settings.autostop > 0) {
                const elapsed = this.getElapsedTime();
                if (elapsed >= this.settings.autostop * 60 * 1000) {
                    this.stopRecording();
                }
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateDuration() {
        const elapsed = this.getElapsedTime();
        const durationEl = document.getElementById('status-duration');
        if (durationEl) durationEl.textContent = this.formatDuration(elapsed);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateUI() {
        const btnRecord = document.getElementById('btn-record');
        const btnPause = document.getElementById('btn-pause');
        const btnStop = document.getElementById('btn-stop');
        const btnPlay = document.getElementById('btn-play');
        const btnExport = document.getElementById('btn-export');
        const indicator = document.getElementById('rec-indicator');
        const statusLabel = document.getElementById('status-label');
        const statInterval = document.getElementById('stat-interval');
        const statusDuration = document.getElementById('status-duration');

        if (this.isPlaying) {
            if (btnRecord) btnRecord.disabled = true;
            if (btnPause) btnPause.disabled = true;
            if (btnStop) btnStop.disabled = false;
            if (btnPlay) { btnPlay.disabled = false; btnPlay.textContent = '⏹ Stop'; }
            if (btnExport) btnExport.disabled = true;
            if (indicator) indicator.className = 'rec-indicator playing';
            if (statusLabel) statusLabel.textContent = 'Playing';
        } else if (this.isRecording) {
            if (btnRecord) btnRecord.disabled = true;
            if (btnPause) btnPause.disabled = false;
            if (btnStop) btnStop.disabled = false;
            if (btnPlay) { btnPlay.disabled = true; btnPlay.textContent = '▶ Play'; }
            if (btnExport) btnExport.disabled = true;

            if (this.isPaused) {
                if (indicator) indicator.className = 'rec-indicator paused';
                if (statusLabel) statusLabel.textContent = 'Paused';
                if (btnPause) btnPause.textContent = '▶ Resume';
            } else {
                if (indicator) indicator.className = 'rec-indicator recording';
                if (statusLabel) statusLabel.textContent = 'Recording';
                if (btnPause) btnPause.textContent = '⏸ Pause';
            }
        } else {
            if (btnRecord) btnRecord.disabled = false;
            if (btnPause) btnPause.disabled = true;
            if (btnStop) btnStop.disabled = true;
            if (btnPlay) { btnPlay.disabled = this.savedSessions.length === 0; btnPlay.textContent = '▶ Play'; }
            if (btnExport) btnExport.disabled = this.savedSessions.length === 0;
            if (indicator) indicator.className = 'rec-indicator';
            if (statusLabel) statusLabel.textContent = 'Ready';
            if (statusDuration) statusDuration.textContent = '00:00:00';
        }

        if (statInterval) statInterval.textContent = this.settings.interval + 'ms';
    }

    updateStats() {
        if (!this.currentSession) return;

        const points = this.currentSession.dataPoints.length;
        const sizeBytes = JSON.stringify(this.currentSession).length;
        const sizeKB = (sizeBytes / 1024).toFixed(1);

        const ptsEl = document.getElementById('stat-points');
        const sizeEl = document.getElementById('stat-size');

        if (ptsEl) ptsEl.textContent = points.toLocaleString();
        if (sizeEl) sizeEl.textContent = sizeKB + ' KB';
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    loadSessions() {
        try {
            const saved = localStorage.getItem(SESSIONS_KEY);
            if (saved) {
                this.savedSessions = JSON.parse(saved);
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadSessions',
                    widget: 'flight-recorder',
                    storage: 'localStorage'
                });
            }
            this.savedSessions = [];
        }
        this.renderSessions();
    }

    saveSessions() {
        try {
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.savedSessions));
        } catch (e) {
            console.error('[Flight Recorder] Failed to save sessions:', e);
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveSessions',
                    widget: 'flight-recorder',
                    storage: 'localStorage'
                });
            }
        }
    }

    renderSessions() {
        const list = document.getElementById('sessions-list');
        const countEl = document.getElementById('session-count');
        const exportBtn = document.getElementById('btn-export');

        if (countEl) countEl.textContent = `(${this.savedSessions.length})`;
        if (exportBtn) exportBtn.disabled = this.savedSessions.length === 0;

        if (!list) return;

        if (this.savedSessions.length === 0) {
            list.innerHTML = '<div class="no-sessions">No saved sessions</div>';
            return;
        }

        list.innerHTML = this.savedSessions.map((session, index) => {
            const date = new Date(session.startTime);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const duration = this.formatDuration(session.duration);
            const points = session.dataPoints?.length || 0;

            // Get start position for display
            const startPos = session.startPosition || session.dataPoints?.[0];
            const hasPosition = startPos && startPos.lat !== undefined;
            const posStr = hasPosition ? `📍 ${startPos.lat.toFixed(3)}, ${startPos.lon.toFixed(3)}` : '';

            return `
                <div class="session-item" data-index="${index}">
                    <div class="session-info">
                        <div class="session-date">${dateStr} ${timeStr}</div>
                        <div class="session-meta">${duration} • ${points.toLocaleString()} pts ${posStr}</div>
                    </div>
                    <div class="session-actions-inline">
                        <button class="btn-tiny btn-play-tiny" onclick="playSessionByIndex(${index})" title="Play from start position">▶</button>
                        <button class="btn-tiny" onclick="exportSessionByIndex(${index})" title="Export">📤</button>
                        <button class="btn-tiny btn-danger" onclick="deleteSession(${index})" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    deleteSession(index) {
        if (!confirm('Delete this session?')) return;
        this.savedSessions.splice(index, 1);
        this.saveSessions();
        this.renderSessions();
        this.updateUI();
    }

    // ============================================
    // EXPORT / IMPORT
    // ============================================

    exportSession() {
        if (this.savedSessions.length === 0) return;
        this.exportSessionByIndex(0); // Export most recent
    }

    exportSessionByIndex(index) {
        const session = this.savedSessions[index];
        if (!session) return;

        const exportData = {
            _exportInfo: {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                source: 'SimGlass Flight Recorder'
            },
            ...session
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const date = new Date(session.startTime);
        const filename = `flight-${date.toISOString().split('T')[0]}-${session.id}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[Flight Recorder] Exported session:', session.id);
    }

    async importSession(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Remove export metadata
            delete data._exportInfo;

            // Validate
            if (!data.id || !data.dataPoints || !Array.isArray(data.dataPoints)) {
                throw new Error('Invalid session file');
            }

            // Check for duplicate
            if (this.savedSessions.some(s => s.id === data.id)) {
                if (!confirm('Session already exists. Import as copy?')) {
                    event.target.value = '';
                    return;
                }
                data.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            }

            this.savedSessions.unshift(data);
            this.saveSessions();
            this.renderSessions();
            this.updateUI();

            console.log('[Flight Recorder] Imported session:', data.id);

        } catch (e) {
            alert('Import failed: ' + e.message);
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'importSession',
                    widget: 'flight-recorder'
                });
            }
        }

        event.target.value = '';
    }

    async playSessionByIndex(index) {
        if (this.isRecording || this.isPlaying) return;

        const session = this.savedSessions[index];
        if (!session || !session.dataPoints.length) return;

        // Get starting position from first data point or session metadata
        const startPos = session.startPosition || session.dataPoints[0];

        if (startPos && startPos.lat !== undefined && startPos.lon !== undefined) {
            // Enable slew mode, position aircraft at start, then disable slew
            await this.setSlewMode(true);
            await this.setAircraftPosition(startPos);
            await new Promise(r => setTimeout(r, 500));
            await this.setSlewMode(false);
            console.log('[Flight Recorder] Aircraft positioned at start:', startPos.lat.toFixed(4), startPos.lon.toFixed(4));
        }

        this.playbackSession = session;
        this.isPlaying = true;
        this.playbackIndex = 0;
        this.startTime = Date.now();

        this.updateUI();
        this.playNextFrame();

        console.log('[Flight Recorder] Playing session:', session.id);
    }

    // ============================================
    // SETTINGS
    // ============================================

    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadSettings',
                    widget: 'flight-recorder',
                    storage: 'localStorage'
                });
            }
        }

        // Apply to UI (after DOM is ready)
        setTimeout(() => {
            const intervalEl = document.getElementById('setting-interval');
            const autostopEl = document.getElementById('setting-autostop');
            const controlsEl = document.getElementById('setting-controls');
            const autopilotEl = document.getElementById('setting-autopilot');
            const lightsEl = document.getElementById('setting-lights');

            if (intervalEl) intervalEl.value = this.settings.interval;
            if (autostopEl) autostopEl.value = this.settings.autostop;
            if (controlsEl) controlsEl.checked = this.settings.recordControls;
            if (autopilotEl) autopilotEl.checked = this.settings.recordAutopilot;
            if (lightsEl) lightsEl.checked = this.settings.recordLights;
        }, 0);
    }

    saveSettings() {
        this.settings.interval = parseInt(document.getElementById('setting-interval').value);
        this.settings.autostop = parseInt(document.getElementById('setting-autostop').value) || 0;
        this.settings.recordControls = document.getElementById('setting-controls').checked;
        this.settings.recordAutopilot = document.getElementById('setting-autopilot').checked;
        this.settings.recordLights = document.getElementById('setting-lights').checked;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));

        this.closeSettings();
        this.updateUI();
        console.log('[Flight Recorder] Settings saved');
    }

    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ============================================
    // TRANSPARENCY
    // ============================================

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        localStorage.setItem('recorder_transparent', document.body.classList.contains('transparent'));
    }

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
        this._destroyed = true;

        // Stop recording/playback
        if (this.isRecording) this.stopRecording();
        if (this.isPlaying) this.stopPlayback();

        // Clear all intervals
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }

        if (this.playbackInterval) {
            clearTimeout(this.playbackInterval);
            this.playbackInterval = null;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // Clear window references
        delete window.exportSessionByIndex;
        delete window.deleteSession;
        delete window.playSessionByIndex;

        // Call parent destroy (handles WebSocket cleanup)
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.flightRecorder = new FlightRecorderWidget();
    window.addEventListener('beforeunload', () => window.flightRecorder?.destroy());
});
