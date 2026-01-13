/**
 * Lorby AAO Bridge Plugin v1.0.0
 * 
 * Provides SimVar access via Lorby Axis & Ohs WebAPI
 * Alternative to direct SimConnect - works without SDK
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\plugins\lorby-bridge\index.js
 * Last Updated: 2025-01-08
 */

const http = require('http');

class LorbyBridgePlugin {
    constructor(manifest, loader) {
        this.manifest = manifest;
        this.loader = loader;
        this.config = manifest.config;
        this.connected = false;
        this.pollTimer = null;
    }

    async init(context) {
        this.app = context.app;
        
        if (this.config.autoConnect) {
            await this.connect();
        }
        
        console.log('[LorbyBridge] Plugin initialized');
    }

    /**
     * Check connection to Lorby AAO
     */
    async connect() {
        try {
            const result = await this.request('conn=1');
            this.connected = result === 'OK';
            console.log(`[LorbyBridge] Connection: ${this.connected ? '✅ OK' : '❌ Failed'}`);
            return this.connected;
        } catch (err) {
            this.connected = false;
            console.log('[LorbyBridge] Connection failed:', err.message);
            return false;
        }
    }

    /**
     * Make request to Lorby AAO WebAPI
     */
    request(query) {
        return new Promise((resolve, reject) => {
            const url = `http://${this.config.host}:${this.config.port}/webapi?${query}`;
            
            http.get(url, { timeout: 2000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data.trim()));
            }).on('error', reject);
        });
    }

    /**
     * Read a SimVar
     */
    async readSimVar(simvar) {
        if (!this.connected) return null;
        
        try {
            const value = await this.request(`var=${encodeURIComponent(simvar)}`);
            return parseFloat(value);
        } catch (err) {
            console.error('[LorbyBridge] SimVar read error:', err.message);
            return null;
        }
    }

    /**
     * Read multiple SimVars at once
     */
    async readSimVars(simvars) {
        if (!this.connected) return {};
        
        try {
            const query = simvars.map(v => encodeURIComponent(v)).join('|');
            const result = await this.request(`vars=${query}`);
            const values = result.split('|').map(v => parseFloat(v));
            
            const data = {};
            simvars.forEach((name, i) => {
                data[name] = values[i];
            });
            return data;
        } catch (err) {
            console.error('[LorbyBridge] SimVars read error:', err.message);
            return {};
        }
    }

    /**
     * Execute an event/script
     */
    async executeEvent(script) {
        if (!this.connected) return false;
        
        try {
            await this.request(`evt=${encodeURIComponent(script)}`);
            return true;
        } catch (err) {
            console.error('[LorbyBridge] Event execute error:', err.message);
            return false;
        }
    }

    registerRoutes(app) {
        // Status endpoint
        app.get('/api/lorby/status', async (req, res) => {
            const connected = await this.connect();
            res.json({ connected, host: this.config.host, port: this.config.port });
        });

        // Read SimVar
        app.get('/api/lorby/simvar', async (req, res) => {
            const { var: simvar } = req.query;
            if (!simvar) return res.status(400).json({ error: 'var parameter required' });
            
            const value = await this.readSimVar(simvar);
            res.json({ simvar, value });
        });

        // Read multiple SimVars
        app.get('/api/lorby/simvars', async (req, res) => {
            const { vars } = req.query;
            if (!vars) return res.status(400).json({ error: 'vars parameter required' });
            
            const simvars = vars.split(',');
            const data = await this.readSimVars(simvars);
            res.json(data);
        });

        // Execute event
        app.post('/api/lorby/event', require('express').json(), async (req, res) => {
            const { script } = req.body;
            if (!script) return res.status(400).json({ error: 'script required' });
            
            const success = await this.executeEvent(script);
            res.json({ success });
        });

        console.log('[LorbyBridge] Routes registered');
    }

    /**
     * Start polling flight data
     */
    startPolling(interval = this.config.pollInterval) {
        if (this.pollTimer) return;
        
        const simvars = [
            '(A:INDICATED ALTITUDE,feet)',
            '(A:AIRSPEED INDICATED,knots)',
            '(A:HEADING INDICATOR,degrees)',
            '(A:VERTICAL SPEED,feet per minute)',
            '(A:GROUND VELOCITY,knots)'
        ];
        
        this.pollTimer = setInterval(async () => {
            const data = await this.readSimVars(simvars);
            this.loader.broadcast('simconnect:data', data);
        }, interval);
        
        console.log(`[LorbyBridge] Polling started (${interval}ms)`);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
            console.log('[LorbyBridge] Polling stopped');
        }
    }

    async shutdown() {
        this.stopPolling();
        console.log('[LorbyBridge] Shutting down...');
    }
}

module.exports = LorbyBridgePlugin;
