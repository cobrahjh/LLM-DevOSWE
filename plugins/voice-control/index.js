/**
 * Voice Control Plugin v1.0.0
 * 
 * Provides voice command support using Web Speech API
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\plugins\voice-control\index.js
 * Last Updated: 2025-01-08
 */

const path = require('path');

class VoiceControlPlugin {
    constructor(manifest, loader) {
        this.manifest = manifest;
        this.loader = loader;
        this.commands = this.getDefaultCommands();
    }

    async init(context) {
        this.app = context.app;
        console.log('[VoiceControl] Plugin initialized');
    }

    getDefaultCommands() {
        return [
            // Camera
            { phrase: 'cockpit view', action: 'CAMERA_COCKPIT' },
            { phrase: 'external view', action: 'CAMERA_EXTERNAL' },
            { phrase: 'drone view', action: 'CAMERA_DRONE' },
            
            // Lights
            { phrase: 'landing lights', action: 'TOGGLE_LANDING_LIGHT' },
            { phrase: 'nav lights', action: 'TOGGLE_NAV_LIGHTS' },
            { phrase: 'strobe lights', action: 'TOGGLE_STROBE_LIGHTS' },
            { phrase: 'beacon', action: 'TOGGLE_BEACON_LIGHTS' },
            { phrase: 'all lights on', action: 'ALL_LIGHTS_ON' },
            { phrase: 'all lights off', action: 'ALL_LIGHTS_OFF' },
            
            // Aircraft
            { phrase: 'gear up', action: 'GEAR_UP' },
            { phrase: 'gear down', action: 'GEAR_DOWN' },
            { phrase: 'flaps up', action: 'FLAPS_DECR' },
            { phrase: 'flaps down', action: 'FLAPS_INCR' },
            { phrase: 'autopilot', action: 'AP_MASTER' },
            { phrase: 'parking brake', action: 'PARKING_BRAKES' },
            
            // Fuel
            { phrase: 'fill fuel', action: 'FUEL_FULL' },
            { phrase: 'half fuel', action: 'FUEL_HALF' },
            
            // Recording (requires flight-recorder plugin)
            { phrase: 'start recording', action: 'RECORDER_START' },
            { phrase: 'stop recording', action: 'RECORDER_STOP' }
        ];
    }

    registerRoutes(app) {
        const uiPath = path.join(this.manifest._path, 'ui');
        
        // Serve UI files
        app.use('/ui/voice-control', require('express').static(uiPath));
        
        // Commands list
        app.get('/api/voice/commands', (req, res) => {
            res.json(this.commands);
        });

        // Add custom command
        app.post('/api/voice/commands', require('express').json(), (req, res) => {
            const { phrase, action } = req.body;
            if (!phrase || !action) {
                return res.status(400).json({ error: 'phrase and action required' });
            }
            this.commands.push({ phrase, action, custom: true });
            res.json({ success: true, commands: this.commands });
        });

        console.log('[VoiceControl] Routes registered');
    }

    onEvent(event, data) {
        // Handle voice command execution
        if (event === 'voice:command') {
            console.log(`[VoiceControl] Executing: ${data.action}`);
            // Forward to core for execution
            this.loader.broadcast('command:execute', { command: data.action });
        }
    }

    async shutdown() {
        console.log('[VoiceControl] Shutting down...');
    }
}

module.exports = VoiceControlPlugin;
