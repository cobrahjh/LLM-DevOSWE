/**
 * SimGlass Flight Recorder v1.4.0
 * Records flight data for analysis and playback
 * Delta recording: optionals only recorded on change
 * Position playback: Sets aircraft to starting position only
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\flight-recorder\widget.js
 * Last Updated: 2025-01-07
 * 
 * v1.4.0 - Optimized: full lat/lon only on first point, data replay for rest
 * v1.3.0 - Position recording & playback via slew mode
 * v1.2.0 - Added playback functionality
 * v1.1.0 - Delta recording for optionals (controls, AP, lights)
 * v1.0.0 - Initial release
 */

const API_BASE = `http://${window.location.hostname}:8080`;
const WS_URL = `ws://${window.location.hostname}:8080`;
const STORAGE_KEY = 'SimGlass_recorder_settings';
const SESSIONS_KEY = 'SimGlass_flight_sessions';

// State
let ws = null;
let isRecording = false;
let isPaused = false;
let isPlaying = false;
let playbackInterval = null;
let playbackIndex = 0;
let playbackSession = null;
let recordingInterval = null;
let startTime = null;
let pausedDuration = 0;
let pauseStartTime = null;

let currentSession = null;
let savedSessions = [];
let latestFlightData = null;

// Previous state tracking for delta recording
let prevState = {
    thr: null,
    flp: null,
    gear: null,
    brk: null,
    ap: null,
    apHdg: null,
    apAlt: null,
    apVs: null,
    lts: null
};

// Settings
let settings = {
    interval: 100,
    autostop: 0,
    recordControls: true,
    recordAutopilot: true,
    recordLights: false
};

// Session structure
function createSession() {
    return {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        interval: settings.interval,
        dataPoints: [],
        metadata: {
            aircraft: 'Unknown',
            departure: null,
            arrival: null
        },
        settings: { ...settings }
    };
}


// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadSessions();
    connectWebSocket();
    setupEventListeners();
    updateUI();
});

function setupEventListeners() {
    document.getElementById('btn-record').addEventListener('click', startRecording);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-stop').addEventListener('click', stopRecording);
    document.getElementById('btn-play').addEventListener('click', togglePlayback);
    document.getElementById('btn-export').addEventListener('click', exportSession);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importSession);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-transparency').addEventListener('click', toggleTransparency);
}

// ============================================
// WEBSOCKET CONNECTION
// ============================================

function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            latestFlightData = data;
            updateCurrentData(data);
            
            // Record data point if recording
            if (isRecording && !isPaused && currentSession) {
                recordDataPoint(data);
            }
        } catch (e) {}
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = () => {
        ws.close();
    };
}

function updateCurrentData(data) {
    document.getElementById('data-alt').textContent = Math.round(data.altitude || 0).toLocaleString() + ' ft';
    document.getElementById('data-spd').textContent = Math.round(data.speed || 0) + ' kts';
    document.getElementById('data-hdg').textContent = Math.round(data.heading || 0) + '°';
    document.getElementById('data-vs').textContent = Math.round(data.verticalSpeed || 0) + ' fpm';
}


// ============================================
// RECORDING FUNCTIONS
// ============================================

function startRecording() {
    if (isRecording) return;
    
    currentSession = createSession();
    isRecording = true;
    isPaused = false;
    startTime = Date.now();
    pausedDuration = 0;
    
    // Reset previous state for delta recording
    prevState = {
        thr: null, flp: null, gear: null, brk: null,
        ap: null, apHdg: null, apAlt: null, apVs: null,
        lts: null
    };
    
    updateUI();
    startTimer();
    
    console.log('Recording started');
}

function togglePause() {
    if (!isRecording) return;
    
    if (isPaused) {
        // Resume
        pausedDuration += Date.now() - pauseStartTime;
        isPaused = false;
    } else {
        // Pause
        pauseStartTime = Date.now();
        isPaused = true;
    }
    
    updateUI();
}

async function stopRecording() {
    if (isPlaying) {
        await stopPlayback();
        return;
    }
    if (!isRecording) return;
    
    isRecording = false;
    isPaused = false;
    
    if (currentSession) {
        currentSession.endTime = new Date().toISOString();
        currentSession.duration = getElapsedTime();
        
        // Save session
        savedSessions.unshift(currentSession);
        if (savedSessions.length > 20) savedSessions.pop(); // Keep last 20
        saveSessions();
        renderSessions();
    }
    
    stopTimer();
    updateUI();
    
    console.log('Recording stopped, saved session:', currentSession?.id);
}

function recordDataPoint(data) {
    if (!currentSession) return;
    
    const isFirstPoint = currentSession.dataPoints.length === 0;
    
    const point = {
        t: getElapsedTime() // Timestamp in ms
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
        currentSession.startPosition = {
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
    if (settings.recordControls) {
        const thr = Math.round((data.throttle || 0) * 100);
        const flp = data.flapsIndex || 0;
        const gear = data.gearDown ? 1 : 0;
        const brk = data.parkingBrake ? 1 : 0;
        
        if (thr !== prevState.thr) { point.thr = thr; prevState.thr = thr; }
        if (flp !== prevState.flp) { point.flp = flp; prevState.flp = flp; }
        if (gear !== prevState.gear) { point.gear = gear; prevState.gear = gear; }
        if (brk !== prevState.brk) { point.brk = brk; prevState.brk = brk; }
    }
    
    // Optional: Autopilot - only record on change
    if (settings.recordAutopilot) {
        const ap = data.apMaster ? 1 : 0;
        const apHdg = data.apHdgLock ? Math.round(data.apHdgSet || 0) : null;
        const apAlt = data.apAltLock ? Math.round(data.apAltSet || 0) : null;
        const apVs = data.apVsLock ? Math.round(data.apVsSet || 0) : null;
        
        if (ap !== prevState.ap) { point.ap = ap; prevState.ap = ap; }
        if (apHdg !== prevState.apHdg) { point.apHdg = apHdg; prevState.apHdg = apHdg; }
        if (apAlt !== prevState.apAlt) { point.apAlt = apAlt; prevState.apAlt = apAlt; }
        if (apVs !== prevState.apVs) { point.apVs = apVs; prevState.apVs = apVs; }
    }
    
    // Optional: Lights - only record on change
    if (settings.recordLights) {
        const lts = (data.navLight ? 1 : 0) | 
                    (data.beaconLight ? 2 : 0) | 
                    (data.strobeLight ? 4 : 0) | 
                    (data.landingLight ? 8 : 0);
        
        if (lts !== prevState.lts) { point.lts = lts; prevState.lts = lts; }
    }
    
    currentSession.dataPoints.push(point);
    updateStats();
}

function getElapsedTime() {
    if (!startTime) return 0;
    const now = isPaused ? pauseStartTime : Date.now();
    return now - startTime - pausedDuration;
}

// ============================================
// PLAYBACK FUNCTIONS
// ============================================

async function togglePlayback() {
    if (isPlaying) {
        await stopPlayback();
    } else {
        await startPlayback();
    }
}

async function startPlayback() {
    if (savedSessions.length === 0) return;
    if (isRecording) return;
    
    playbackSession = savedSessions[0]; // Play most recent
    if (!playbackSession || !playbackSession.dataPoints.length) return;
    
    // Get starting position from first data point or session metadata
    const startPos = playbackSession.startPosition || playbackSession.dataPoints[0];
    
    if (startPos && startPos.lat !== undefined && startPos.lon !== undefined) {
        // Enable slew mode, position aircraft at start, then disable slew
        await setSlewMode(true);
        await setAircraftPosition(startPos);
        await new Promise(r => setTimeout(r, 500)); // Wait for position to apply
        await setSlewMode(false);
        console.log('Aircraft positioned at start:', startPos.lat.toFixed(4), startPos.lon.toFixed(4));
    }
    
    isPlaying = true;
    playbackIndex = 0;
    startTime = Date.now();
    
    updateUI();
    playNextFrame();
    
    console.log('Playback started:', playbackSession.id);
}

async function stopPlayback() {
    isPlaying = false;
    playbackSession = null;
    playbackIndex = 0;
    
    if (playbackInterval) {
        clearTimeout(playbackInterval);
        playbackInterval = null;
    }
    
    updateUI();
    console.log('Playback stopped');
}

async function playNextFrame() {
    if (!isPlaying || !playbackSession) return;
    
    const points = playbackSession.dataPoints;
    if (playbackIndex >= points.length) {
        await stopPlayback();
        return;
    }
    
    const point = points[playbackIndex];
    
    // Display data only (no position changes during playback)
    displayPlaybackPoint(point);
    
    // Update duration display
    document.getElementById('status-duration').textContent = formatDuration(point.t);
    
    playbackIndex++;
    
    // Schedule next frame
    if (playbackIndex < points.length) {
        const nextPoint = points[playbackIndex];
        const delay = nextPoint.t - point.t;
        playbackInterval = setTimeout(playNextFrame, Math.max(delay, 10));
    } else {
        await stopPlayback();
    }
}

async function setSlewMode(enabled) {
    try {
        await fetch(`${API_BASE}/api/recorder/slew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        console.log(`Slew mode: ${enabled ? 'ON' : 'OFF'}`);
    } catch (e) {
        console.error('Slew mode error:', e);
    }
}

async function setAircraftPosition(point) {
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
        console.error('Position set error:', e);
    }
}

function displayPlaybackPoint(point) {
    document.getElementById('data-alt').textContent = (point.alt || 0).toLocaleString() + ' ft';
    document.getElementById('data-spd').textContent = (point.spd || 0) + ' kts';
    document.getElementById('data-hdg').textContent = (point.hdg || 0) + '°';
    document.getElementById('data-vs').textContent = (point.vs || 0) + ' fpm';
    
    // Update stats during playback
    document.getElementById('stat-points').textContent = `${playbackIndex}/${playbackSession.dataPoints.length}`;
}


// ============================================
// TIMER & UI
// ============================================

let timerInterval = null;

function startTimer() {
    timerInterval = setInterval(() => {
        updateDuration();
        
        // Auto-stop check
        if (settings.autostop > 0) {
            const elapsed = getElapsedTime();
            if (elapsed >= settings.autostop * 60 * 1000) {
                stopRecording();
            }
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateDuration() {
    const elapsed = getElapsedTime();
    document.getElementById('status-duration').textContent = formatDuration(elapsed);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateUI() {
    const btnRecord = document.getElementById('btn-record');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const btnPlay = document.getElementById('btn-play');
    const btnExport = document.getElementById('btn-export');
    const indicator = document.getElementById('rec-indicator');
    const statusLabel = document.getElementById('status-label');
    
    if (isPlaying) {
        btnRecord.disabled = true;
        btnPause.disabled = true;
        btnStop.disabled = false;
        btnPlay.disabled = false;
        btnPlay.textContent = '⏹ Stop';
        btnExport.disabled = true;
        indicator.className = 'rec-indicator playing';
        statusLabel.textContent = 'Playing';
    } else if (isRecording) {
        btnRecord.disabled = true;
        btnPause.disabled = false;
        btnStop.disabled = false;
        btnPlay.disabled = true;
        btnPlay.textContent = '▶ Play';
        btnExport.disabled = true;
        
        if (isPaused) {
            indicator.className = 'rec-indicator paused';
            statusLabel.textContent = 'Paused';
            btnPause.textContent = '▶ Resume';
        } else {
            indicator.className = 'rec-indicator recording';
            statusLabel.textContent = 'Recording';
            btnPause.textContent = '⏸ Pause';
        }
    } else {
        btnRecord.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;
        btnPlay.disabled = savedSessions.length === 0;
        btnPlay.textContent = '▶ Play';
        btnExport.disabled = savedSessions.length === 0;
        indicator.className = 'rec-indicator';
        statusLabel.textContent = 'Ready';
        document.getElementById('status-duration').textContent = '00:00:00';
    }
    
    document.getElementById('stat-interval').textContent = settings.interval + 'ms';
}

function updateStats() {
    if (!currentSession) return;
    
    const points = currentSession.dataPoints.length;
    const sizeBytes = JSON.stringify(currentSession).length;
    const sizeKB = (sizeBytes / 1024).toFixed(1);
    
    document.getElementById('stat-points').textContent = points.toLocaleString();
    document.getElementById('stat-size').textContent = sizeKB + ' KB';
}


// ============================================
// SESSION MANAGEMENT
// ============================================

function loadSessions() {
    try {
        const saved = localStorage.getItem(SESSIONS_KEY);
        if (saved) {
            savedSessions = JSON.parse(saved);
        }
    } catch (e) {
        savedSessions = [];
    }
    renderSessions();
}

function saveSessions() {
    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(savedSessions));
    } catch (e) {
        console.error('Failed to save sessions:', e);
    }
}

function renderSessions() {
    const list = document.getElementById('sessions-list');
    document.getElementById('session-count').textContent = `(${savedSessions.length})`;
    document.getElementById('btn-export').disabled = savedSessions.length === 0;
    
    if (savedSessions.length === 0) {
        list.innerHTML = '<div class="no-sessions">No saved sessions</div>';
        return;
    }
    
    list.innerHTML = savedSessions.map((session, index) => {
        const date = new Date(session.startTime);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const duration = formatDuration(session.duration);
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

function deleteSession(index) {
    if (!confirm('Delete this session?')) return;
    savedSessions.splice(index, 1);
    saveSessions();
    renderSessions();
    updateUI();
}

// ============================================
// EXPORT / IMPORT
// ============================================

function exportSession() {
    if (savedSessions.length === 0) return;
    exportSessionByIndex(0); // Export most recent
}

function exportSessionByIndex(index) {
    const session = savedSessions[index];
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
    
    console.log('Exported session:', session.id);
}

async function importSession(event) {
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
        if (savedSessions.some(s => s.id === data.id)) {
            if (!confirm('Session already exists. Import as copy?')) {
                event.target.value = '';
                return;
            }
            data.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        }
        
        savedSessions.unshift(data);
        saveSessions();
        renderSessions();
        updateUI();
        
        console.log('Imported session:', data.id);
        
    } catch (e) {
        alert('Import failed: ' + e.message);
    }
    
    event.target.value = '';
}

async function playSessionByIndex(index) {
    if (isRecording || isPlaying) return;
    
    const session = savedSessions[index];
    if (!session || !session.dataPoints.length) return;
    
    // Get starting position from first data point or session metadata
    const startPos = session.startPosition || session.dataPoints[0];
    
    if (startPos && startPos.lat !== undefined && startPos.lon !== undefined) {
        // Enable slew mode, position aircraft at start, then disable slew
        await setSlewMode(true);
        await setAircraftPosition(startPos);
        await new Promise(r => setTimeout(r, 500));
        await setSlewMode(false);
        console.log('Aircraft positioned at start:', startPos.lat.toFixed(4), startPos.lon.toFixed(4));
    }
    
    playbackSession = session;
    isPlaying = true;
    playbackIndex = 0;
    startTime = Date.now();
    
    updateUI();
    playNextFrame();
    
    console.log('Playing session:', session.id);
}

// Expose to window for inline handlers
window.exportSessionByIndex = exportSessionByIndex;
window.deleteSession = deleteSession;
window.playSessionByIndex = playSessionByIndex;


// ============================================
// SETTINGS
// ============================================

function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            settings = { ...settings, ...JSON.parse(saved) };
        }
    } catch (e) {}
    
    // Apply to UI
    document.getElementById('setting-interval').value = settings.interval;
    document.getElementById('setting-autostop').value = settings.autostop;
    document.getElementById('setting-controls').checked = settings.recordControls;
    document.getElementById('setting-autopilot').checked = settings.recordAutopilot;
    document.getElementById('setting-lights').checked = settings.recordLights;
}

function saveSettings() {
    settings.interval = parseInt(document.getElementById('setting-interval').value);
    settings.autostop = parseInt(document.getElementById('setting-autostop').value) || 0;
    settings.recordControls = document.getElementById('setting-controls').checked;
    settings.recordAutopilot = document.getElementById('setting-autopilot').checked;
    settings.recordLights = document.getElementById('setting-lights').checked;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    closeSettings();
    updateUI();
    console.log('Settings saved');
}

function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

// ============================================
// TRANSPARENCY
// ============================================

function toggleTransparency() {
    document.body.classList.toggle('transparent');
    localStorage.setItem('recorder_transparent', document.body.classList.contains('transparent'));
}

// Load transparency preference
if (localStorage.getItem('recorder_transparent') === 'true') {
    document.body.classList.add('transparent');
}
