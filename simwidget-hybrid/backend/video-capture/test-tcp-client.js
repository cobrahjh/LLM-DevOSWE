// Test TCP Capture Client - Measures actual FPS from capture-service.exe
const net = require('net');

const PORT = 9998;
const HOST = '127.0.0.1';

let frameCount = 0;
let totalBytes = 0;
let startTime = Date.now();
let buffer = Buffer.alloc(0);
let expectedSize = 0;

const client = new net.Socket();

client.connect(PORT, HOST, () => {
    console.log('Connected to capture service on port', PORT);
    console.log('Receiving frames...\n');
    startTime = Date.now();
});

client.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (true) {
        // Need frame size header (4 bytes)
        if (expectedSize === 0 && buffer.length >= 4) {
            expectedSize = buffer.readUInt32LE(0);
            buffer = buffer.slice(4);
        }

        // Have complete frame?
        if (expectedSize > 0 && buffer.length >= expectedSize) {
            // Parse frame header (JPEG format: 2-byte width, 2-byte height, 4-byte jpegSize)
            const width = buffer.readUInt16LE(0);
            const height = buffer.readUInt16LE(2);
            const jpegSize = buffer.readUInt32LE(4);

            frameCount++;
            totalBytes += expectedSize;

            // Stats every second
            const elapsed = Date.now() - startTime;
            if (elapsed >= 1000) {
                const fps = Math.round(frameCount * 1000 / elapsed);
                const mbps = ((totalBytes / 1024 / 1024) / (elapsed / 1000)).toFixed(1);
                const frameKB = Math.round(jpegSize / 1024);
                console.log(`FPS: ${fps} | ${width}x${height} | JPEG: ${frameKB} KB | Throughput: ${mbps} MB/s`);

                // Reset for next interval
                frameCount = 0;
                totalBytes = 0;
                startTime = Date.now();
            }

            // Move to next frame
            buffer = buffer.slice(expectedSize);
            expectedSize = 0;
        } else {
            break;
        }
    }
});

client.on('close', () => {
    console.log('\nConnection closed');
});

client.on('error', (err) => {
    console.error('Error:', err.message);
});

// Run for 10 seconds then exit
setTimeout(() => {
    console.log('\nTest complete');
    client.destroy();
    process.exit(0);
}, 10000);

console.log('TCP Capture Client Test');
console.log('=======================');
console.log('Testing for 10 seconds...\n');
