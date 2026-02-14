/**
 * Little Navmap Integration API
 * Provides UDP position broadcasting for Little Navmap aircraft tracking
 */

const dgram = require('dgram');

class LittleNavMapAPI {
    constructor() {
        this.udpClient = null;
        this.udpPort = 49002; // Little Navmap default UDP port
        this.udpHost = '127.0.0.1';
        this.enabled = false;
        this.lastPosition = null;
    }

    /**
     * Setup Express routes
     */
    setupRoutes(app) {
        // Start UDP broadcasting
        app.post('/api/littlenavmap/udp/start', (req, res) => {
            const { port, rate } = req.body;
            if (port) this.udpPort = port;

            try {
                this.startUdpBroadcast();
                res.json({ success: true, port: this.udpPort, rate: rate || 200 });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // Stop UDP broadcasting
        app.post('/api/littlenavmap/udp/stop', (req, res) => {
            this.stopUdpBroadcast();
            res.json({ success: true });
        });

        // Receive position update from frontend
        app.post('/api/littlenavmap/udp/position', (req, res) => {
            if (this.enabled) {
                this.lastPosition = req.body;
                this.sendPosition(req.body);
            }
            res.json({ success: true });
        });

        // Get UDP broadcast status
        app.get('/api/littlenavmap/udp/status', (req, res) => {
            res.json({
                enabled: this.enabled,
                port: this.udpPort,
                host: this.udpHost,
                lastUpdate: this.lastPosition ? Date.now() : null
            });
        });
    }

    /**
     * Start UDP broadcasting
     */
    startUdpBroadcast() {
        if (this.udpClient) {
            this.stopUdpBroadcast();
        }

        this.udpClient = dgram.createSocket('udp4');
        this.udpClient.on('error', (err) => {
            console.error('[LittleNavMap] UDP error:', err);
            this.stopUdpBroadcast();
        });

        this.enabled = true;
        console.log(`[LittleNavMap] UDP broadcast started on ${this.udpHost}:${this.udpPort}`);
    }

    /**
     * Stop UDP broadcasting
     */
    stopUdpBroadcast() {
        if (this.udpClient) {
            this.udpClient.close();
            this.udpClient = null;
        }
        this.enabled = false;
        console.log('[LittleNavMap] UDP broadcast stopped');
    }

    /**
     * Send position update via UDP
     * Little Navmap expects comma-separated values:
     * lat,lon,alt,heading,groundSpeed,verticalSpeed
     */
    sendPosition(position) {
        if (!this.udpClient || !this.enabled) return;

        const { lat, lon, alt, heading, groundSpeed, verticalSpeed } = position;

        // Format: lat,lon,alt_ft,heading,gs_kt,vs_fpm
        const message = `${lat.toFixed(6)},${lon.toFixed(6)},${alt.toFixed(0)},${heading.toFixed(1)},${groundSpeed.toFixed(1)},${verticalSpeed.toFixed(0)}`;
        const buffer = Buffer.from(message);

        this.udpClient.send(buffer, 0, buffer.length, this.udpPort, this.udpHost, (err) => {
            if (err) {
                console.error('[LittleNavMap] UDP send error:', err);
            }
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopUdpBroadcast();
    }
}

module.exports = LittleNavMapAPI;
