// Node.js wrapper for native screen capture addon
// Provides high-level API and automatic initialization

let addon;

try {
    addon = require('./build/Release/screen_capture.node');
} catch (e) {
    console.error('Native addon not built. Run: npm run build');
    addon = null;
}

class ScreenCapture {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the screen capture system
     * @returns {boolean} Success status
     */
    initialize() {
        if (!addon) {
            throw new Error('Native addon not available');
        }
        this.initialized = addon.initialize();
        return this.initialized;
    }

    /**
     * Capture a single frame
     * @returns {Buffer|null} Raw frame data (8 byte header + BGRA pixels)
     */
    captureFrame() {
        if (!this.initialized) {
            if (!this.initialize()) {
                return null;
            }
        }
        const buffer = addon.captureFrame();
        return buffer.length > 0 ? buffer : null;
    }

    /**
     * Get capture information
     * @returns {Object} { width, height, initialized }
     */
    getInfo() {
        if (!addon) return { width: 0, height: 0, initialized: false };
        return addon.getInfo();
    }

    /**
     * Parse frame buffer into components
     * @param {Buffer} buffer - Raw frame buffer
     * @returns {Object} { width, height, pixels }
     */
    parseFrame(buffer) {
        if (!buffer || buffer.length < 8) return null;

        const width = buffer.readUInt32LE(0);
        const height = buffer.readUInt32LE(4);
        const pixels = buffer.slice(8);

        return { width, height, pixels };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (addon) {
            addon.cleanup();
        }
        this.initialized = false;
    }
}

module.exports = new ScreenCapture();
