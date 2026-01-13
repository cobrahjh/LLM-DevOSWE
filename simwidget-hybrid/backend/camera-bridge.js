/**
 * SimWidget Camera Bridge
 * Version: 1.0.0
 * Last updated: 2026-01-08
 * 
 * Bridges WASM camera module with SimWidget server via LVars
 * Uses node-simconnect for LVar read/write
 */

class CameraBridge {
    constructor(simConnect) {
        this.sc = simConnect;
        this.ready = false;
        this.status = 0;
        this.relativeOffsets = { x: 0, y: 0, z: 0, pitch: 0, heading: 0 };
        
        // LVar names matching WASM module
        this.lvars = {
            cmd: 'L:SIMWIDGET_CAM_CMD',
            mode: 'L:SIMWIDGET_CAM_MODE',
            smooth: 'L:SIMWIDGET_CAM_SMOOTH',
            status: 'L:SIMWIDGET_CAM_STATUS',
            ready: 'L:SIMWIDGET_CAM_READY',
            relX: 'L:SIMWIDGET_CAM_REL_X',
            relY: 'L:SIMWIDGET_CAM_REL_Y',
            relZ: 'L:SIMWIDGET_CAM_REL_Z',
            relPitch: 'L:SIMWIDGET_CAM_REL_PITCH',
            relHdg: 'L:SIMWIDGET_CAM_REL_HDG'
        };
        
        // Commands matching WASM enum
        this.commands = {
            NONE: 0,
            FLYBY: 1,
            CINEMATIC_TOGGLE: 3,
            CINEMATIC_NEXT: 4,
            RESET: 5
        };
        
        this.pollInterval = null;
    }
    
    /**
     * Initialize the camera bridge
     * Starts polling WASM module status
     */
    async init() {
        console.log('[CameraBridge] Initializing...');
        
        // Start polling for WASM ready state
        this.pollInterval = setInterval(() => this.pollStatus(), 100);
        
        // Wait for WASM module
        let attempts = 0;
        while (!this.ready && attempts < 50) {
            await this.sleep(100);
            attempts++;
        }
        
        if (this.ready) {
            console.log('[CameraBridge] WASM module ready');
        } else {
            console.log('[CameraBridge] WASM module not detected (will retry)');
        }
        
        return this.ready;
    }
    
    /**
     * Poll WASM module status and relative offsets
     */
    async pollStatus() {
        try {
            const ready = await this.getLVar(this.lvars.ready);
            this.ready = ready === 1;
            
            if (this.ready) {
                this.status = await this.getLVar(this.lvars.status);
                
                // Read relative camera offsets from WASM
                this.relativeOffsets = {
                    x: await this.getLVar(this.lvars.relX),
                    y: await this.getLVar(this.lvars.relY),
                    z: await this.getLVar(this.lvars.relZ),
                    pitch: await this.getLVar(this.lvars.relPitch),
                    heading: await this.getLVar(this.lvars.relHdg)
                };
                
                // Apply camera position if active
                if (this.status !== 0) {
                    this.applyCameraOffset();
                }
            }
        } catch (err) {
            // Silent fail - WASM module may not be loaded
        }
    }

    
    /**
     * Apply camera offset via SimConnect
     * Uses relative 6DOF camera positioning
     */
    applyCameraOffset() {
        if (!this.sc || this.status === 0) return;
        
        try {
            // SimConnect_CameraSetRelative6DOF equivalent
            this.sc.cameraSetRelative6DOF(
                this.relativeOffsets.x,
                this.relativeOffsets.y,
                this.relativeOffsets.z,
                this.relativeOffsets.pitch,
                0, // bank
                this.relativeOffsets.heading
            );
        } catch (err) {
            console.error('[CameraBridge] Camera offset error:', err.message);
        }
    }
    
    /**
     * Send command to WASM module
     */
    async sendCommand(cmd) {
        if (!this.ready) {
            console.log('[CameraBridge] WASM not ready');
            return false;
        }
        
        await this.setLVar(this.lvars.cmd, cmd);
        console.log(`[CameraBridge] Sent command: ${cmd}`);
        return true;
    }
    
    /**
     * Start flyby camera mode
     */
    async startFlyby() {
        return this.sendCommand(this.commands.FLYBY);
    }
    
    /**
     * Toggle cinematic camera
     */
    async toggleCinematic() {
        return this.sendCommand(this.commands.CINEMATIC_TOGGLE);
    }
    
    /**
     * Next camera position
     */
    async nextPosition() {
        return this.sendCommand(this.commands.CINEMATIC_NEXT);
    }
    
    /**
     * Reset camera to default
     */
    async resetCamera() {
        return this.sendCommand(this.commands.RESET);
    }
    
    /**
     * Set smoothing factor (0-100)
     */
    async setSmoothing(value) {
        await this.setLVar(this.lvars.smooth, Math.max(0, Math.min(100, value)));
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            ready: this.ready,
            mode: this.status,
            offsets: this.relativeOffsets
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    // ==== LVar Helpers ====
    
    async getLVar(name) {
        return new Promise((resolve, reject) => {
            this.sc.calculateCode(name, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
    
    async setLVar(name, value) {
        const code = `${value} (>${name.replace('L:', '')})`;
        return new Promise((resolve, reject) => {
            this.sc.calculateCode(code, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = CameraBridge;
