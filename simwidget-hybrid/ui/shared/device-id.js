/**
 * SimGlass Device ID Manager v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Generates and manages anonymous device UUIDs for telemetry.
 */

class DeviceIdManager {
    constructor() {
        this.storageKey = 'SimGlass_device_id';
        this.sessionKey = '_SimGlass_session_id';
        this.platform = this.detectPlatform();
    }
    
    /**
     * Detect platform type
     */
    detectPlatform() {
        // MSFS in-game panel
        if (window.name === 'ingamepanel' || typeof Coherent !== 'undefined') {
            return 'msfs-panel';
        }
        // Electron app
        if (navigator.userAgent.includes('Electron')) {
            return 'electron';
        }
        // Mobile device
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return 'mobile';
        }
        return 'desktop';
    }
    
    /**
     * Check if localStorage is available
     */
    hasLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Generate UUID v4
     */
    generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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
            window[this.sessionKey] = prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
