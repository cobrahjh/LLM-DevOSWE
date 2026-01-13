/**
 * SimWidget Camera System v1.4.0
 * With detailed debug logging
 * Uses configurable key mappings from config/keymaps.json
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\camera-system.js
 * 
 * Changelog:
 * v1.4.0 - Added debug logging, action history
 * v1.3.0 - Switched to configurable keymaps
 * v1.2.0 - Fixed MSFS 2024 keybindings (F10, BACKSPACE, SHIFT+X)
 * v1.1.0 - Added presets, smart camera
 * v1.0.0 - Initial camera system with basic views
 */

const keySender = require('./key-sender');

const VERSION = '1.4.0';

// Camera state tracking
const CameraState = {
    COCKPIT: 2,
    EXTERNAL: 3,
    DRONE: 4,
    SHOWCASE: 9
};

class CameraSystem {
    constructor() {
        this.currentState = CameraState.COCKPIT;
        this.flybyActive = false;
        this.orbitActive = false;
        this.flybyTimeout = null;
        this.orbitInterval = null;
        this.isInitialized = true;
        this.debug = true;
        this.actionLog = [];
        this.maxLog = 30;
    }

    log(action, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            state: this.getStateName()
        };
        
        if (this.debug) {
            console.log(`[CameraSystem] ${action}`, details);
        }
        
        this.actionLog.unshift(entry);
        if (this.actionLog.length > this.maxLog) {
            this.actionLog.pop();
        }
    }

    getState() {
        return {
            version: VERSION,
            keySenderVersion: keySender.getVersion(),
            state: this.currentState,
            stateName: this.getStateName(),
            flybyActive: this.flybyActive,
            orbitActive: this.orbitActive,
            keymaps: keySender.getKeymaps().camera,
            recentActions: this.actionLog.slice(0, 5)
        };
    }

    getVersion() {
        return VERSION;
    }

    getStateName() {
        switch (this.currentState) {
            case CameraState.COCKPIT: return 'cockpit';
            case CameraState.EXTERNAL: return 'external';
            case CameraState.DRONE: return 'drone';
            case CameraState.SHOWCASE: return 'showcase';
            default: return 'unknown';
        }
    }

    getActionLog(limit = 20) {
        return this.actionLog.slice(0, limit);
    }

    setDebug(enabled) {
        this.debug = enabled;
        keySender.setDebug(enabled);
        console.log(`[CameraSystem] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    // ==================== BASIC VIEWS ====================

    async cockpitView() {
        this.log('cockpitView', { keymap: 'camera.cockpitVFR' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'cockpitVFR');
            this.currentState = CameraState.COCKPIT;
            this.log('cockpitView', { result: 'success', newState: 'COCKPIT' });
        } catch (e) {
            this.log('cockpitView', { result: 'error', error: e.message });
        }
    }

    async cockpitIFR() {
        this.log('cockpitIFR', { keymap: 'camera.cockpitIFR' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'cockpitIFR');
            this.currentState = CameraState.COCKPIT;
            this.log('cockpitIFR', { result: 'success', newState: 'COCKPIT' });
        } catch (e) {
            this.log('cockpitIFR', { result: 'error', error: e.message });
        }
    }

    async cockpitLanding() {
        this.log('cockpitLanding', { keymap: 'camera.cockpitLanding' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'cockpitLanding');
            this.currentState = CameraState.COCKPIT;
            this.log('cockpitLanding', { result: 'success', newState: 'COCKPIT' });
        } catch (e) {
            this.log('cockpitLanding', { result: 'error', error: e.message });
        }
    }

    async externalView() {
        this.log('externalView', { keymap: 'camera.toggleExternal' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'toggleExternal');
            this.currentState = CameraState.EXTERNAL;
            this.log('externalView', { result: 'success', newState: 'EXTERNAL' });
        } catch (e) {
            this.log('externalView', { result: 'error', error: e.message });
        }
    }

    async droneView() {
        this.log('droneView', { keymap: 'camera.drone' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'drone');
            this.currentState = CameraState.DRONE;
            this.log('droneView', { result: 'success', newState: 'DRONE' });
        } catch (e) {
            this.log('droneView', { result: 'error', error: e.message });
        }
    }

    async topDownView() {
        this.log('topDownView', { keymap: 'camera.drone + camera.panDown' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'drone');
            setTimeout(async () => {
                try {
                    await keySender.send('camera', 'panDown');
                    this.log('topDownView', { result: 'panDown sent' });
                } catch (e) {
                    this.log('topDownView', { result: 'panDown error', error: e.message });
                }
            }, 300);
            this.currentState = CameraState.DRONE;
            this.log('topDownView', { result: 'drone sent', newState: 'DRONE' });
        } catch (e) {
            this.log('topDownView', { result: 'error', error: e.message });
        }
    }

    async toggleView() {
        this.log('toggleView', { keymap: 'camera.toggleExternal', fromState: this.getStateName() });
        try {
            await keySender.send('camera', 'toggleExternal');
            this.currentState = this.currentState === CameraState.COCKPIT ? 
                CameraState.EXTERNAL : CameraState.COCKPIT;
            this.log('toggleView', { result: 'success', newState: this.getStateName() });
        } catch (e) {
            this.log('toggleView', { result: 'error', error: e.message });
        }
    }

    async cycleViews() {
        this.log('cycleViews', { keymap: 'camera.nextFixedCam' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'nextFixedCam');
            this.log('cycleViews', { result: 'success' });
        } catch (e) {
            this.log('cycleViews', { result: 'error', error: e.message });
        }
    }

    async prevView() {
        this.log('prevView', { keymap: 'camera.prevFixedCam' });
        this.stopAllModes();
        try {
            await keySender.send('camera', 'prevFixedCam');
            this.log('prevView', { result: 'success' });
        } catch (e) {
            this.log('prevView', { result: 'error', error: e.message });
        }
    }

    // ==================== CINEMATIC MODES ====================

    async startFlyby(duration = 8000) {
        this.stopAllModes();
        await keySender.send('camera', 'toggleExternal');
        this.flybyActive = true;
        console.log('[CameraSystem] Flyby started');

        this.flybyTimeout = setTimeout(async () => {
            await keySender.send('camera', 'toggleExternal');
            this.flybyActive = false;
            console.log('[CameraSystem] Flyby ended');
        }, duration);
    }

    async startOrbit(speed = 10) {
        this.stopAllModes();
        await keySender.send('camera', 'drone');
        this.orbitActive = true;
        console.log('[CameraSystem] Orbit started');

        this.orbitInterval = setInterval(async () => {
            await keySender.send('camera', 'panRight');
        }, 200);
    }

    stopAllModes() {
        if (this.flybyTimeout) {
            clearTimeout(this.flybyTimeout);
            this.flybyTimeout = null;
        }
        if (this.orbitInterval) {
            clearInterval(this.orbitInterval);
            this.orbitInterval = null;
        }
        this.flybyActive = false;
        this.orbitActive = false;
    }

    // ==================== CAMERA ADJUSTMENTS ====================

    async zoomIn() {
        await keySender.send('camera', 'zoomIn');
        console.log('[CameraSystem] Zoom in');
    }

    async zoomOut() {
        await keySender.send('camera', 'zoomOut');
        console.log('[CameraSystem] Zoom out');
    }

    async resetCamera() {
        await keySender.send('camera', 'resetView');
        console.log('[CameraSystem] Camera reset');
    }

    async panLeft() {
        await keySender.send('camera', 'panLeft');
    }

    async panRight() {
        await keySender.send('camera', 'panRight');
    }

    async panUp() {
        await keySender.send('camera', 'panUp');
    }

    async panDown() {
        await keySender.send('camera', 'panDown');
    }

    // ==================== PRESETS ====================

    presets = [];

    async savePreset(name, slot = 1) {
        if (slot < 1 || slot > 4) {
            console.log('[CameraSystem] Preset slot must be 1-4');
            return;
        }
        
        this.presets[slot] = {
            name: name,
            state: this.currentState,
            timestamp: Date.now()
        };
        
        await keySender.send('camera', `savePreset${slot}`);
        console.log(`[CameraSystem] Saved preset ${slot}: ${name}`);
    }

    async loadPreset(slot) {
        if (slot < 1 || slot > 4) {
            console.log('[CameraSystem] Preset slot must be 1-4');
            return;
        }
        
        await keySender.send('camera', `loadPreset${slot}`);
        console.log(`[CameraSystem] Loaded preset ${slot}`);
    }

    getPresets() {
        return this.presets;
    }

    // ==================== SMART CAMERA ====================

    async enableSmartCamera() {
        await keySender.send('camera', 'droneLock');
        console.log('[CameraSystem] Drone lock toggled');
    }

    async nextSmartTarget() {
        await keySender.send('camera', 'droneNextTarget');
        console.log('[CameraSystem] Next target');
    }

    async prevSmartTarget() {
        await keySender.send('camera', 'dronePrevTarget');
        console.log('[CameraSystem] Previous target');
    }

    // ==================== KEYMAP MANAGEMENT ====================

    getKeymaps() {
        return keySender.getKeymaps();
    }

    updateKeymap(action, newKey) {
        keySender.updateKeymap('camera', action, newKey);
        console.log(`[CameraSystem] Updated ${action} -> ${newKey}`);
    }

    // Send any custom key
    async sendCustomKey(key) {
        await keySender.sendKey(key);
    }

    destroy() {
        this.stopAllModes();
    }
}

// Export singleton
module.exports = new CameraSystem();
module.exports.CameraState = CameraState;
