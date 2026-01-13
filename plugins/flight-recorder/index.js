/**
 * Flight Recorder Plugin v1.4.0
 * 
 * Records and plays back flight sessions
 * Uses delta compression for efficient storage
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\plugins\flight-recorder\index.js
 * Last Updated: 2025-01-08
 */

const path = require('path');
const fs = require('fs');

class FlightRecorderPlugin {
    constructor(manifest, loader) {
        this.manifest = manifest;
        this.loader = loader;
        this.config = manifest.config;
        this.sessions = [];
        this.currentSession = null;
        this.isRecording = false;
        this.recordInterval = null;
        this.prevState = {};
    }

    async init(context) {
        this.app = context.app;
        this.wss = context.wss;
        console.log('[FlightRecorder] Plugin initialized');
    }

    registerRoutes(app) {
        const uiPath = path.join(this.manifest._path, 'ui');
        
        // Serve UI files
        app.use('/ui/flight-recorder', require('express').static(uiPath));
        
        // Start recording
        app.post('/api/recorder/start', (req, res) => {
            if (this.isRecording) {
                return res.status(400).json({ error: 'Already recording' });
            }
            this.startRecording();
            res.json({ success: true, sessionId: this.currentSession?.id });
        });

        // Stop recording
        app.post('/api/recorder/stop', (req, res) => {
            if (!this.isRecording) {
                return res.status(400).json({ error: 'Not recording' });
            }
            const session = this.stopRecording();
            res.json({ success: true, session });
        });

        // Get sessions
        app.get('/api/recorder/sessions', (req, res) => {
            res.json(this.sessions.map(s => ({
                id: s.id,
                startTime: s.startTime,
                duration: s.duration,
                dataPoints: s.dataPoints.length
            })));
        });

        // Export session
        app.get('/api/recorder/sessions/:id/export', (req, res) => {
            const session = this.sessions.find(s => s.id === req.params.id);
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
            res.json(session);
        });

        console.log('[FlightRecorder] Routes registered');
    }

    startRecording() {
        this.currentSession = {
            id: `session_${Date.now()}`,
            startTime: new Date().toISOString(),
            dataPoints: [],
            settings: { ...this.config }
        };
        this.isRecording = true;
        this.prevState = {};
        
        // Start recording interval
        this.recordInterval = setInterval(() => {
            this.recordDataPoint();
        }, this.config.recordInterval);
        
        console.log('[FlightRecorder] Recording started');
    }

    stopRecording() {
        if (this.recordInterval) {
            clearInterval(this.recordInterval);
            this.recordInterval = null;
        }
        
        this.isRecording = false;
        
        if (this.currentSession) {
            this.currentSession.duration = Date.now() - new Date(this.currentSession.startTime).getTime();
            this.sessions.push(this.currentSession);
            const session = this.currentSession;
            this.currentSession = null;
            console.log(`[FlightRecorder] Recording stopped: ${session.dataPoints.length} points`);
            return session;
        }
        
        return null;
    }

    recordDataPoint() {
        const core = this.loader.getPlugin('core');
        if (!core) return;
        
        const data = core.flightData;
        const point = {
            t: Date.now() - new Date(this.currentSession.startTime).getTime(),
            alt: Math.round(data.altitude || 0),
            spd: Math.round(data.speed || 0),
            hdg: Math.round(data.heading || 0),
            vs: Math.round(data.verticalSpeed || 0),
            gs: Math.round(data.groundSpeed || 0)
        };

        // First point gets full position
        if (this.currentSession.dataPoints.length === 0) {
            point.lat = data.latitude;
            point.lon = data.longitude;
            this.currentSession.startPosition = { lat: point.lat, lon: point.lon };
        }

        // Delta recording for optional fields
        if (this.config.recordControls) {
            const thr = Math.round((data.throttle || 0) * 100);
            if (thr !== this.prevState.thr) {
                point.thr = thr;
                this.prevState.thr = thr;
            }
        }

        this.currentSession.dataPoints.push(point);
    }

    onEvent(event, data) {
        if (event === 'voice:command') {
            if (data.action === 'RECORDER_START') this.startRecording();
            if (data.action === 'RECORDER_STOP') this.stopRecording();
        }
    }

    async shutdown() {
        if (this.isRecording) {
            this.stopRecording();
        }
        console.log('[FlightRecorder] Shutting down...');
    }
}

module.exports = FlightRecorderPlugin;
