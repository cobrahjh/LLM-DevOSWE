/**
 * SimWidget Capability Detector v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Detects platform capabilities and installed addons.
 */

class CapabilityDetector {
    constructor(serverUrl = null) {
        this.serverUrl = serverUrl || this.detectServerUrl();
        this.capabilities = null;
        this.addons = null;
    }
    
    detectServerUrl() {
        const host = window.location.hostname || 'localhost';
        const port = window.location.port || '8080';
        return `http://${host}:${port}`;
    }
    
    /**
     * Detect all capabilities
     */
    async detectAll() {
        this.capabilities = {
            localStorage: this.testLocalStorage(),
            sessionStorage: this.testSessionStorage(),
            websocket: this.testWebSocket(),
            notifications: this.testNotifications(),
            clipboard: this.testClipboard(),
            touch: this.testTouch(),
            keyboard: true, // Assume keyboard unless detected otherwise
            gamepad: this.testGamepad(),
            fullscreen: this.testFullscreen(),
            fileDownload: this.testFileDownload()
        };
        
        this.addons = await this.detectAddons();
        
        return {
            capabilities: this.capabilities,
            addons: this.addons,
            limitations: this.getLimitations()
        };
    }
    
    testLocalStorage() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    testSessionStorage() {
        try {
            const test = '__test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    testWebSocket() {
        return 'WebSocket' in window;
    }
    
    testNotifications() {
        return 'Notification' in window;
    }
    
    testClipboard() {
        return navigator.clipboard && navigator.clipboard.writeText;
    }
    
    testTouch() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    testGamepad() {
        return 'getGamepads' in navigator;
    }
    
    testFullscreen() {
        return document.fullscreenEnabled || document.webkitFullscreenEnabled;
    }
    
    testFileDownload() {
        // MSFS panels can't download files
        if (window.name === 'ingamepanel') return false;
        return true;
    }
    
    /**
     * Detect installed addons via server API
     */
    async detectAddons() {
        const addons = {
            simconnect: false,
            chaseplane: false,
            fsuipc: false,
            vjoy: false,
            mobiflight: false,
            lorby: false
        };
        
        try {
            const response = await fetch(`${this.serverUrl}/api/status`);
            const status = await response.json();
            
            addons.simconnect = status.connected || false;
            
            // Check for addon-specific endpoints
            if (status.addons) {
                addons.chaseplane = status.addons.chaseplane || false;
                addons.fsuipc = status.addons.fsuipc || false;
                addons.vjoy = status.addons.vjoy || false;
            }
        } catch (e) {
            console.debug('[CapabilityDetector] Server not reachable');
        }
        
        // Try ChasePlane WebSocket
        try {
            const cpResponse = await fetch('http://localhost:8652/getdata', { 
                method: 'GET',
                signal: AbortSignal.timeout(1000)
            });
            if (cpResponse.ok) {
                addons.chaseplane = true;
            }
        } catch (e) {
            // ChasePlane not running
        }
        
        return addons;
    }
    
    /**
     * Get list of limitations based on capabilities
     */
    getLimitations() {
        const limitations = [];
        
        if (!this.capabilities.localStorage) {
            limitations.push('no-preferences-save');
            limitations.push('no-persistent-uuid');
        }
        
        if (!this.capabilities.notifications) {
            limitations.push('no-notifications');
        }
        
        if (!this.capabilities.clipboard) {
            limitations.push('no-clipboard');
        }
        
        if (!this.capabilities.fileDownload) {
            limitations.push('no-file-download');
        }
        
        if (!this.capabilities.gamepad) {
            limitations.push('no-gamepad-input');
        }
        
        if (window.name === 'ingamepanel') {
            limitations.push('msfs-panel-limited-dom');
            limitations.push('no-external-links');
        }
        
        return limitations;
    }
    
    /**
     * Check if a specific feature is supported
     */
    isSupported(feature) {
        if (!this.capabilities) {
            console.warn('[CapabilityDetector] Run detectAll() first');
            return true; // Assume supported if not detected yet
        }
        return this.capabilities[feature] === true;
    }
    
    /**
     * Check if an addon is available
     */
    hasAddon(addon) {
        if (!this.addons) {
            console.warn('[CapabilityDetector] Run detectAll() first');
            return false;
        }
        return this.addons[addon] === true;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CapabilityDetector;
}
