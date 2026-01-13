/**
 * WASM Camera Bridge v1.0.0
 * 
 * Communicates with SimWidget Camera WASM module via LVars
 * 
 * LVars used:
 * - L:SIMWIDGET_CAM_COMMAND - Send commands to WASM (1=flyby, 3=toggle cinematic, etc.)
 * - L:SIMWIDGET_CAM_MODE - Set camera mode
 * - L:SIMWIDGET_CAM_SMOOTH - Smoothing factor (0-100)
 * - L:SIMWIDGET_CAM_SPEED - Transition speed
 * - L:SIMWIDGET_CAM_STATUS - Read current status from WASM
 * - L:SIMWIDGET_CAM_READY - Check if WASM module is loaded
 * 
 * Output LVars (from WASM for external camera positioning):
 * - L:SIMWIDGET_CAM_REL_X/Y/Z - Relative position offsets
 * - L:SIMWIDGET_CAM_REL_PITCH/BANK/HDG - Relative rotation
 */

// Camera commands (must match WASM enum)
const CameraCommand = {
    NONE: 0,
    FLYBY: 1,
    TOWER: 2,
    CINEMATIC_TOGGLE: 3,
    CINEMATIC_NEXT: 4,
    RESET: 5,
    DRONE_TO: 6
};

// Camera modes
const CameraMode = {
    OFF: 0,
    CINEMATIC: 1,
    FLYBY: 2,
    TOWER: 3,
    MANUAL: 4
};

class WasmCameraBridge {
    constructor() {
        this.simConnect = null;
        this.isReady = false;
        this.currentMode = CameraMode.OFF;
        this.smoothFactor = 50;
        this.transitionSpeed = 1.0;
        
        // LVar IDs (set after SimConnect connection)
        this.lvarIds = {};
        
        // Polling interval for reading status
        this.pollInterval = null;
    }
    
    /**
     * Initialize with SimConnect connection
     */
    init(simConnect) {
        this.simConnect = simConnect;
        console.log('[WasmCamera] Bridge initialized');
        
        // Start polling for WASM ready status
        this.startPolling();
    }
    
    /**
     * Check if WASM module is loaded
     */
    async checkReady() {
        if (!this.simConnect) return false;
        
        try {
            // Read L:SIMWIDGET_CAM_READY via calculator code
            // This requires execute_calculator_code or similar
            // For now, we'll assume it's ready if SimConnect is connected
            return true;
        } catch (err) {
            return false;
        }
    }
    
    /**
     * Send command to WASM module
     */
    async sendCommand(command) {
        if (!this.simConnect) {
            console.warn('[WasmCamera] SimConnect not available');
            return false;
        }
        
        console.log(`[WasmCamera] Sending command: ${command}`);
        
        // Write to L:SIMWIDGET_CAM_COMMAND via calculator code
        // Format: {value} (>L:VARNAME)
        const calcCode = `${command} (>L:SIMWIDGET_CAM_COMMAND)`;
        
        try {
            // Note: node-simconnect may not support execute_calculator_code directly
            // Alternative: Use FSUIPC or MobiFlight WASM for LVar access
            // For now, log the intent
            console.log(`[WasmCamera] Would execute: ${calcCode}`);
            return true;
        } catch (err) {
            console.error('[WasmCamera] Failed to send command:', err);
            return false;
        }
    }
    
    /**
     * Start flyby camera mode
     */
    async startFlyby() {
        return this.sendCommand(CameraCommand.FLYBY);
    }
    
    /**
     * Toggle cinematic camera
     */
    async toggleCinematic() {
        return this.sendCommand(CameraCommand.CINEMATIC_TOGGLE);
    }
    
    /**
     * Next cinematic view
     */
    async nextCinematic() {
        return this.sendCommand(CameraCommand.CINEMATIC_NEXT);
    }
    
    /**
     * Reset camera to default
     */
    async resetCamera() {
        return this.sendCommand(CameraCommand.RESET);
    }
    
    /**
     * Set smoothing factor
     */
    async setSmooth(value) {
        this.smoothFactor = Math.max(0, Math.min(100, value));
        const calcCode = `${this.smoothFactor} (>L:SIMWIDGET_CAM_SMOOTH)`;
        console.log(`[WasmCamera] Set smooth: ${this.smoothFactor}`);
        return true;
    }
    
    /**
     * Set transition speed
     */
    async setSpeed(value) {
        this.transitionSpeed = Math.max(0.1, Math.min(5.0, value));
        const calcCode = `${this.transitionSpeed} (>L:SIMWIDGET_CAM_SPEED)`;
        console.log(`[WasmCamera] Set speed: ${this.transitionSpeed}`);
        return true;
    }
    
    /**
     * Start polling for status updates
     */
    startPolling() {
        if (this.pollInterval) return;
        
        this.pollInterval = setInterval(() => {
            this.pollStatus();
        }, 500); // Poll every 500ms
    }
    
    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    /**
     * Poll current status from WASM
     */
    async pollStatus() {
        // Would read L:SIMWIDGET_CAM_STATUS and L:SIMWIDGET_CAM_READY
        // For now, just track local state
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            ready: this.isReady,
            mode: this.currentMode,
            smoothFactor: this.smoothFactor,
            transitionSpeed: this.transitionSpeed
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.stopPolling();
        this.simConnect = null;
    }
}

// Export singleton and constants
const wasmCameraBridge = new WasmCameraBridge();

module.exports = {
    wasmCameraBridge,
    CameraCommand,
    CameraMode
};
