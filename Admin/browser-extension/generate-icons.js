/**
 * Generate simple extension icons using canvas-like approach
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createSimplePNG(size) {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR chunk
    function makeChunk(type, data) {
        const typeBuffer = Buffer.from(type);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);

        const crcData = Buffer.concat([typeBuffer, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcData) >>> 0);

        return Buffer.concat([length, typeBuffer, data, crc]);
    }

    // CRC32 table
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[n] = c >>> 0;
    }

    function crc32(buf) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) {
            crc = (crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // IHDR data
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0);  // width
    ihdrData.writeUInt32BE(size, 4);  // height
    ihdrData.writeUInt8(8, 8);        // bit depth
    ihdrData.writeUInt8(2, 9);        // color type (RGB)
    ihdrData.writeUInt8(0, 10);       // compression
    ihdrData.writeUInt8(0, 11);       // filter
    ihdrData.writeUInt8(0, 12);       // interlace

    const ihdr = makeChunk('IHDR', ihdrData);

    // Create image data (simple cyan circle on dark background)
    const rawData = [];
    const cx = size / 2, cy = size / 2;
    const radius = size * 0.4;

    for (let y = 0; y < size; y++) {
        rawData.push(0); // filter byte (none)
        for (let x = 0; x < size; x++) {
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

            if (dist < radius) {
                // Cyan circle
                rawData.push(0, 212, 255);
            } else if (dist < radius + 2) {
                // Border
                rawData.push(0, 150, 200);
            } else {
                // Dark background
                rawData.push(26, 26, 46);
            }
        }
    }

    const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
    const idat = makeChunk('IDAT', compressed);

    // IEND
    const iend = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

// Generate icons
const dir = __dirname;
[16, 48, 128].forEach(size => {
    const png = createSimplePNG(size);
    const file = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(file, png);
    console.log(`Created icon${size}.png (${png.length} bytes)`);
});

console.log('Done!');
