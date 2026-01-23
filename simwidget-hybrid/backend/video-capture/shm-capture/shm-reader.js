// Node.js Shared Memory Reader
// Reads frames from shared memory created by shm-capture.exe
// Uses node-ffi-napi for Windows API access

const ffi = require('ffi-napi');
const ref = require('ref-napi');
const Struct = require('ref-struct-napi');

const SHM_NAME = 'SimWidgetCapture';
const HEADER_SIZE = 32; // 8 uint32 values

// Windows constants
const FILE_MAP_READ = 0x0004;

// Define Windows API
const kernel32 = ffi.Library('kernel32', {
    'OpenFileMappingA': ['pointer', ['uint32', 'bool', 'string']],
    'MapViewOfFile': ['pointer', ['pointer', 'uint32', 'uint32', 'uint32', 'size_t']],
    'UnmapViewOfFile': ['bool', ['pointer']],
    'CloseHandle': ['bool', ['pointer']]
});

class SharedMemoryReader {
    constructor() {
        this.hMapFile = null;
        this.pSharedMem = null;
        this.width = 0;
        this.height = 0;
        this.lastFrameNum = 0;
    }

    connect() {
        // Open existing shared memory
        this.hMapFile = kernel32.OpenFileMappingA(FILE_MAP_READ, false, SHM_NAME);
        if (this.hMapFile.isNull()) {
            throw new Error('Failed to open shared memory. Is shm-capture.exe running?');
        }

        // Map view
        const size = HEADER_SIZE + 1920 * 1080 * 4; // Max size
        this.pSharedMem = kernel32.MapViewOfFile(this.hMapFile, FILE_MAP_READ, 0, 0, size);
        if (this.pSharedMem.isNull()) {
            throw new Error('Failed to map shared memory');
        }

        // Read header
        const header = Buffer.alloc(HEADER_SIZE);
        this.pSharedMem.copy(header, 0, 0, HEADER_SIZE);

        this.width = header.readUInt32LE(0);
        this.height = header.readUInt32LE(4);

        console.log(`Connected to shared memory: ${this.width}x${this.height}`);
        return true;
    }

    getFrame() {
        if (!this.pSharedMem) return null;

        // Read header
        const header = Buffer.alloc(HEADER_SIZE);
        this.pSharedMem.copy(header, 0, 0, HEADER_SIZE);

        const frameNum = header.readUInt32LE(8);
        const ready = header.readUInt32LE(16);

        // Check if new frame available
        if (!ready || frameNum === this.lastFrameNum) {
            return null;
        }

        this.lastFrameNum = frameNum;

        // Read pixel data (BGRA)
        const pixelSize = this.width * this.height * 4;
        const pixels = Buffer.alloc(pixelSize);
        this.pSharedMem.copy(pixels, 0, HEADER_SIZE, HEADER_SIZE + pixelSize);

        return {
            width: this.width,
            height: this.height,
            frameNum: frameNum,
            data: pixels
        };
    }

    disconnect() {
        if (this.pSharedMem) {
            kernel32.UnmapViewOfFile(this.pSharedMem);
            this.pSharedMem = null;
        }
        if (this.hMapFile) {
            kernel32.CloseHandle(this.hMapFile);
            this.hMapFile = null;
        }
    }
}

// Example usage / test
if (require.main === module) {
    const reader = new SharedMemoryReader();

    try {
        reader.connect();

        let frameCount = 0;
        const startTime = Date.now();

        setInterval(() => {
            const frame = reader.getFrame();
            if (frame) {
                frameCount++;

                // Print stats every second
                const elapsed = Date.now() - startTime;
                if (elapsed >= 1000) {
                    const fps = Math.round(frameCount * 1000 / elapsed);
                    console.log(`Frame ${frame.frameNum}: ${fps} FPS`);
                }
            }
        }, 1); // Poll every 1ms for max speed

    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

module.exports = SharedMemoryReader;
