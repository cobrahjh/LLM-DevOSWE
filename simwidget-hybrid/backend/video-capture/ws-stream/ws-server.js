// WebSocket Binary Stream Server
// Captures screen and streams raw frames over WebSocket
// No file I/O, direct memory to network

const WebSocket = require('ws');
const { execFile } = require('child_process');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PORT = 9997;
const NIRCMD_PATH = path.join(__dirname, '../../tools/nircmd.exe');
const TEMP_PATH = path.join(__dirname, '../../temp-ws-frame.bmp');

class ScreenStreamer {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.streaming = false;
        this.frameInterval = null;
        this.fps = 30;
        this.quality = 60;
        this.scale = 0.5;
        this.frameCount = 0;
        this.lastStats = Date.now();
    }

    start() {
        this.wss = new WebSocket.Server({ port: PORT });
        console.log(`WebSocket stream server on port ${PORT}`);

        this.wss.on('connection', (ws) => {
            console.log('Client connected');
            this.clients.add(ws);

            ws.on('message', (msg) => {
                try {
                    const cmd = JSON.parse(msg);
                    this.handleCommand(ws, cmd);
                } catch (e) {
                    console.error('Invalid message:', e.message);
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                this.clients.delete(ws);
                if (this.clients.size === 0) {
                    this.stopStreaming();
                }
            });

            // Send current settings
            ws.send(JSON.stringify({
                type: 'settings',
                fps: this.fps,
                quality: this.quality,
                scale: this.scale,
                streaming: this.streaming
            }));
        });
    }

    handleCommand(ws, cmd) {
        switch (cmd.type) {
            case 'start':
                this.fps = cmd.fps || this.fps;
                this.quality = cmd.quality || this.quality;
                this.scale = cmd.scale || this.scale;
                this.startStreaming();
                break;
            case 'stop':
                this.stopStreaming();
                break;
            case 'settings':
                if (cmd.fps) this.fps = cmd.fps;
                if (cmd.quality) this.quality = cmd.quality;
                if (cmd.scale) this.scale = cmd.scale;
                break;
        }
    }

    startStreaming() {
        if (this.streaming) return;
        this.streaming = true;
        console.log(`Starting stream at ${this.fps} FPS`);

        const captureAndSend = async () => {
            if (!this.streaming || this.clients.size === 0) return;

            const startTime = Date.now();

            try {
                // Capture screen to BMP using execFile (safer than exec)
                await new Promise((resolve) => {
                    execFile(NIRCMD_PATH, ['savescreenshotfull', TEMP_PATH],
                        { timeout: 500 }, () => resolve());
                });

                // Check if file exists
                if (!fs.existsSync(TEMP_PATH)) return;

                // Compress with sharp and get buffer directly
                const buffer = await sharp(TEMP_PATH)
                    .resize({
                        width: Math.round(1920 * this.scale),
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality: this.quality,
                        mozjpeg: true
                    })
                    .toBuffer();

                // Send to all clients as binary
                const header = Buffer.alloc(8);
                header.writeUInt32LE(buffer.length, 0);
                header.writeUInt32LE(Date.now() - startTime, 4); // capture time ms

                for (const client of this.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        // Send header then data
                        client.send(header);
                        client.send(buffer);
                    }
                }

                this.frameCount++;
                this.printStats();

            } catch (e) {
                // Silent fail, continue streaming
            }
        };

        // Use setImmediate for faster loop than setInterval
        const loop = () => {
            if (!this.streaming) return;
            captureAndSend().then(() => {
                setTimeout(loop, 1000 / this.fps);
            });
        };
        loop();
    }

    stopStreaming() {
        this.streaming = false;
        console.log('Streaming stopped');

        // Notify clients
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'stopped' }));
            }
        }
    }

    printStats() {
        const now = Date.now();
        if (now - this.lastStats >= 5000) {
            const actualFps = Math.round(this.frameCount * 1000 / (now - this.lastStats));
            console.log(`Stats: ${actualFps} FPS, ${this.clients.size} clients`);
            this.frameCount = 0;
            this.lastStats = now;
        }
    }
}

// Start server
const streamer = new ScreenStreamer();
streamer.start();

console.log('WebSocket Binary Stream Server');
console.log(`Connect to ws://localhost:${PORT}`);
console.log('Send: {"type":"start","fps":30,"quality":60,"scale":0.5}');
