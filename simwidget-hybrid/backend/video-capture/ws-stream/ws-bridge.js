// WebSocket Bridge to JPEG Capture Service
// Connects to TCP capture-jpeg.exe and bridges to WebSocket clients
// Much faster than nircmd + sharp method

const WebSocket = require('ws');
const net = require('net');

const WS_PORT = 9997;
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 9998;

class CaptureStreamBridge {
    constructor() {
        this.wss = null;
        this.tcpClient = null;
        this.clients = new Set();
        this.buffer = Buffer.alloc(0);
        this.expectedSize = 0;
        this.frameCount = 0;
        this.lastStats = Date.now();
        this.connected = false;
    }

    start() {
        this.wss = new WebSocket.Server({ port: WS_PORT });
        console.log(`WebSocket bridge on port ${WS_PORT}`);

        this.wss.on('connection', (ws) => {
            console.log('WebSocket client connected');
            this.clients.add(ws);

            ws.on('message', (msg) => {
                try {
                    const cmd = JSON.parse(msg);
                    if (cmd.type === 'start' && !this.connected) {
                        this.connectTCP();
                    } else if (cmd.type === 'stop') {
                        this.disconnectTCP();
                    }
                } catch (e) {
                    console.error('Invalid message:', e.message);
                }
            });

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
                if (this.clients.size === 0) {
                    this.disconnectTCP();
                }
            });

            // Send status
            ws.send(JSON.stringify({
                type: 'status',
                connected: this.connected,
                clients: this.clients.size
            }));
        });
    }

    connectTCP() {
        if (this.tcpClient) return;

        console.log(`Connecting to capture service at ${TCP_HOST}:${TCP_PORT}...`);
        this.tcpClient = new net.Socket();

        this.tcpClient.connect(TCP_PORT, TCP_HOST, () => {
            console.log('Connected to capture service');
            this.connected = true;
            this.broadcast({ type: 'connected' });
        });

        this.tcpClient.on('data', (data) => {
            this.handleTCPData(data);
        });

        this.tcpClient.on('close', () => {
            console.log('Disconnected from capture service');
            this.connected = false;
            this.tcpClient = null;
            this.buffer = Buffer.alloc(0);
            this.expectedSize = 0;
            this.broadcast({ type: 'disconnected' });
        });

        this.tcpClient.on('error', (err) => {
            console.error('TCP error:', err.message);
            this.tcpClient = null;
            this.connected = false;
        });
    }

    disconnectTCP() {
        if (this.tcpClient) {
            this.tcpClient.destroy();
            this.tcpClient = null;
            this.connected = false;
        }
    }

    handleTCPData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);

        while (true) {
            // Need frame size header (4 bytes)
            if (this.expectedSize === 0 && this.buffer.length >= 4) {
                this.expectedSize = this.buffer.readUInt32LE(0);
                this.buffer = this.buffer.slice(4);
            }

            // Have complete frame?
            if (this.expectedSize > 0 && this.buffer.length >= this.expectedSize) {
                // Parse frame header (2-byte width, 2-byte height, 4-byte jpegSize)
                const width = this.buffer.readUInt16LE(0);
                const height = this.buffer.readUInt16LE(2);
                const jpegSize = this.buffer.readUInt32LE(4);

                // Extract JPEG data (skip 8-byte header)
                const jpegData = this.buffer.slice(8, 8 + jpegSize);

                // Send to WebSocket clients
                this.broadcastBinary(width, height, jpegData);

                // Move to next frame
                this.buffer = this.buffer.slice(this.expectedSize);
                this.expectedSize = 0;

                this.frameCount++;
                this.printStats();
            } else {
                break;
            }
        }
    }

    broadcast(msg) {
        const data = JSON.stringify(msg);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    broadcastBinary(width, height, jpegData) {
        // Create header: size(4) + width(2) + height(2)
        const header = Buffer.alloc(8);
        header.writeUInt32LE(jpegData.length, 0);
        header.writeUInt16LE(width, 4);
        header.writeUInt16LE(height, 6);

        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(header);
                client.send(jpegData);
            }
        }
    }

    printStats() {
        const now = Date.now();
        if (now - this.lastStats >= 2000) {
            const fps = Math.round(this.frameCount * 1000 / (now - this.lastStats));
            console.log(`Bridge: ${fps} FPS -> ${this.clients.size} clients`);
            this.frameCount = 0;
            this.lastStats = now;
        }
    }
}

// Start bridge
const bridge = new CaptureStreamBridge();
bridge.start();

console.log('JPEG Capture Bridge Server');
console.log(`WebSocket: ws://localhost:${WS_PORT}`);
console.log(`TCP Capture: ${TCP_HOST}:${TCP_PORT}`);
console.log('');
console.log('Start capture-jpeg.exe first, then send {"type":"start"}');
