/**
 * SimGlass Device ID Manager v1.1.0
 * Last Updated: 2026-02-07
 *
 * Generates and manages anonymous device UUIDs for telemetry.
 * Requires: <script src="/ui/shared/platform-utils.js"></script>
 */

class DeviceIdManager {
    constructor() {
        this.storageKey = 'SimGlass_device_id';
        this.sessionKey = '_SimGlass_session_id';
        this.platform = PlatformUtils.getPlatform();
    }
    
    /**
     * Check if localStorage is available
     */
    hasLocalStorage() {
        return PlatformUtils.hasFeature('localStorage');
    }
    
    /**
     * Generate UUID v4
     */
    generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        const bytes = new Uint8Array(16);
        (crypto || window.crypto).getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    
    /**
     * Get or create device ID
     */
    getDeviceId() {
        // For platforms without localStorage, use session ID
        if (!this.hasLocalStorage()) {
            return this.getSessionId();
        }
        
        let deviceId = localStorage.getItem(this.storageKey);
        
        if (!deviceId) {
            deviceId = 'sw_' + this.generateUUID();
            localStorage.setItem(this.storageKey, deviceId);
            
            // Flag as new install
            this.isNewInstall = true;
        }
        
        return deviceId;
    }
    
    /**
     * Get session ID (for MSFS panels without localStorage)
     */
    getSessionId() {
        if (!window[this.sessionKey]) {
            const prefix = this.platform === 'msfs-panel' ? 'msfs_' : 'sess_';
            window[this.sessionKey] = prefix + Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(36)).join('').slice(0, 5);
        }
        return window[this.sessionKey];
    }
    
    /**
     * Reset device ID (for privacy)
     */
    resetDeviceId() {
        if (this.hasLocalStorage()) {
            localStorage.removeItem(this.storageKey);
        }
        delete window[this.sessionKey];
        return this.getDeviceId();
    }
    
    /**
     * Check if telemetry is enabled
     */
    isTelemetryEnabled() {
        if (!this.hasLocalStorage()) return true; // Default on for MSFS panels
        return localStorage.getItem('SimGlass_telemetry_disabled') !== 'true';
    }
    
    /**
     * Set telemetry enabled/disabled
     */
    setTelemetryEnabled(enabled) {
        if (this.hasLocalStorage()) {
            if (enabled) {
                localStorage.removeItem('SimGlass_telemetry_disabled');
            } else {
                localStorage.setItem('SimGlass_telemetry_disabled', 'true');
            }
        }
    }
    
    /**
     * Get device info for telemetry
     */
    getDeviceInfo() {
        return {
            deviceId: this.getDeviceId(),
            sessionId: this.getSessionId(),
            platform: this.platform,
            hasLocalStorage: this.hasLocalStorage(),
            isNewInstall: this.isNewInstall || false,
            userAgent: navigator.userAgent.substring(0, 200),
            language: navigator.language,
            screenWidth: screen.width,
            screenHeight: screen.height,
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton instance
const deviceIdManager = new DeviceIdManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeviceIdManager, deviceIdManager };
}
