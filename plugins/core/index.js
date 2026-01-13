/**
 * SimWidget Core Plugin v1.0.0
 * 
 * Provides essential flight data and controls
 * This plugin is REQUIRED and cannot be disabled
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\plugins\core\index.js
 * Last Updated: 2025-01-08
 */

class CorePlugin {
    constructor(manifest, loader) {
        this.manifest = manifest;
        this.loader = loader;
        this.flightData = {};
        this.clients = new Set();
    }

    async init(context) {
        this.app = context.app;
        this.wss = context.wss;
        console.log('[Core] Initializing core plugin...');
    }

    registerRoutes(app) {
        // Status endpoint
        app.get('/api/status', (req, res) => {
            res.json({
                server: 'SimWidget Engine',
                version: this.manifest.version,
                plugins: this.loader.list(),
                simConnected: this.flightData.connected || false
            });
        });

        // Flight data endpoint
        app.get('/api/flight-data', (req, res) => {
            res.json(this.flightData);
        });

        // Plugins list endpoint
        app.get('/api/plugins', (req, res) => {
            res.json(this.loader.list());
        });

        console.log('[Core] Routes registered');
    }

    registerWebSocket(wss) {
        // Track connections for broadcasting
        wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.on('close', () => this.clients.delete(ws));
        });

        console.log('[Core] WebSocket handlers registered');
    }

    /**
     * Update flight data (called by SimConnect handler)
     */
    updateFlightData(data) {
        this.flightData = { ...this.flightData, ...data };
        this.broadcastFlightData();
    }

    /**
     * Broadcast flight data to all connected clients
     */
    broadcastFlightData() {
        const message = JSON.stringify({
            type: 'flightData',
            data: this.flightData
        });

        for (const client of this.clients) {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        }
    }

    /**
     * Handle events from other plugins
     */
    onEvent(event, data) {
        if (event === 'simconnect:data') {
            this.updateFlightData(data);
        }
    }

    async shutdown() {
        console.log('[Core] Shutting down...');
        this.clients.clear();
    }
}

module.exports = CorePlugin;
