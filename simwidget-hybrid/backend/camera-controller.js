/**
 * SimGlass Camera Controller v3.1
 *
 * Now with platform detection and indicator support
 * Uses the best available input method for the current platform
 *
 * v3.1: Added HTTP-based ChasePlane detection (faster than tasklist)
 *
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\camera-controller.js
 */

const { exec } = require('child_process');
const path = require('path');
const { PlatformDetector } = require('./platform-detector');

// ChasePlane API endpoint
const CHASEPLANE_API = 'http://localhost:8652/getdata';

class CameraController {
    constructor() {
        this.chasePlaneDetected = false;
        this.detectionMethod = null;
        this.checkInterval = null;

        // Platform detection
        this.platformDetector = new PlatformDetector();
        this.platformStatus = null;
        
        // SimConnect event IDs (set by server when SimConnect initializes)
        this.simConnectSend = null;
        this.eventIds = {};
        
        // Button press statistics
        this.stats = {
            totalPresses: 0,
            lastPress: null,
            methodUsed: 'unknown',
            errors: 0
        };
    }

    /**
     * Initialize camera controller with platform detection
     */
    async init() {
        console.log('[Camera] Initializing camera controller with platform detection...');
        
        // Detect platform capabilities
        try {
            this.platformStatus = await this.platformDetector.detectCapabilities();
            console.log('[Camera] Platform method:', this.platformStatus.preferred);
        } catch (err) {
            console.error('[Camera] Platform detection failed:', err);
            this.platformStatus = this.platformDetector.getStatus();
        }
        
        // Check for ChasePlane
        await this.detectChasePlane();
        
        // Start periodic checks
        this.checkInterval = setInterval(() => {
            this.detectChasePlane();
        }, 30000);
        
        return this.getStatus();
    }

    /**
     * Detect if ChasePlane is running via HTTP API (fast) or tasklist (fallback)
     */
    async detectChasePlane() {
        const wasDetected = this.chasePlaneDetected;

        // Try HTTP detection first (faster, ~50ms vs ~400ms for tasklist)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 500);

            const response = await fetch(CHASEPLANE_API, {
                signal: controller.signal
            });
            clearTimeout(timeout);

            this.chasePlaneDetected = response.ok;
            this.detectionMethod = 'http';
        } catch (err) {
            // HTTP failed, fallback to tasklist (hardcoded command, no user input)
            this.chasePlaneDetected = await this.detectChasePlaneTasklist();
            this.detectionMethod = 'tasklist';
        }

        if (this.chasePlaneDetected !== wasDetected) {
            console.log(`[Camera] ChasePlane ${this.chasePlaneDetected ? 'DETECTED' : 'NOT detected'} (via ${this.detectionMethod})`);
        }

        return this.chasePlaneDetected;
    }

    /**
     * Fallback detection using tasklist (slower but reliable)
     */
    async detectChasePlaneTasklist() {
        return new Promise((resolve) => {
            // Safe: hardcoded command with no user input
            exec('tasklist /fi "imagename eq ChasePlane.exe" /fo csv /nh', (err, stdout) => {
                resolve(stdout.includes('ChasePlane.exe'));
            });
        });
    }

    /**
     * Set SimConnect send function (called by server)
     */
    setSimConnect(sendFn, eventIds) {
        this.simConnectSend = sendFn;
        this.eventIds = eventIds || {};
        console.log('[Camera] SimConnect events registered');
    }

    /**
     * Get current status including platform info
     */
    getStatus() {
        return {
            chasePlane: this.chasePlaneDetected,
            chasePlaneDetection: this.detectionMethod || 'unknown',
            platform: this.platformStatus,
            stats: this.stats,
            mode: this.platformStatus?.preferred || 'unknown'
        };
    }

    /**
     * Send button press using the best available method
     */
    async sendButtonPress(action, key, description) {
        const method = this.platformStatus?.preferred || 'sendkeys';
        this.stats.totalPresses++;
        this.stats.lastPress = Date.now();
        this.stats.methodUsed = method;
        
        console.log(`[Camera] ${description} using ${method}`);
        
        try {
            switch (method) {
                case 'vjoy':
                    return await this.sendVJoyButton(action, description);
                    
                case 'simconnect':
                    return await this.sendSimConnectEvent(action, description);
                    
                case 'sendkeys':
                case 'powershell':
                default:
                    return await this.sendKeyToMSFS(key, description);
            }
        } catch (err) {
            this.stats.errors++;
            console.error(`[Camera] ${description} failed:`, err.message);
            return false;
        }
    }

    /**
     * Send vJoy button press
     */
    async sendVJoyButton(action, description) {
        // Map camera actions to vJoy buttons
        const buttonMap = {
            'KEY_TOGGLE_CINEMATIC': 1,  // TCM
            'KEY_NEXT_CINEMATIC': 2,    // NCV  
            'VIEW_MODE': 3              // View Toggle
        };

        const buttonId = buttonMap[action];
        if (!buttonId) {
            console.warn(`[Camera] No vJoy button mapped for action: ${action}`);
            return false;
        }

        return new Promise((resolve, reject) => {
            const script = `
                Add-Type -Path "C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll"
                $vjoy = New-Object vJoy.vJoy
                if ($vjoy.vJoyEnabled()) {
                    $vjoy.AcquireVJD(1)
                    $vjoy.SetBtn($true, 1, ${buttonId})
                    Start-Sleep -Milliseconds 50
                    $vjoy.SetBtn($false, 1, ${buttonId})
                    $vjoy.RelinquishVJD(1)
                    Write-Output "OK"
                } else {
                    Write-Output "vJoy not enabled"
                }
            `;
            
            exec(`powershell -Command "${script.replace(/\n\s+/g, ' ')}"`, 
                (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        console.log(`[Camera] vJoy button ${buttonId}: ${stdout.trim()}`);
                        resolve(stdout.trim() === 'OK');
                    }
                }
            );
        });
    }

    /**
     * Send SimConnect event (placeholder)
     */
    async sendSimConnectEvent(action, description) {
        if (!this.simConnectSend) {
            console.warn('[Camera] SimConnect not available');
            return false;
        }

        // Map actions to SimConnect events
        const eventMap = {
            'KEY_TOGGLE_CINEMATIC': 'TOGGLE_CINEMATIC_MODE',
            'KEY_NEXT_CINEMATIC': 'NEXT_CINEMATIC_VIEW',
            'VIEW_MODE': 'VIEW_MODE_TOGGLE'
        };

        const eventName = eventMap[action];
        if (!eventName) {
            console.warn(`[Camera] No SimConnect event for action: ${action}`);
            return false;
        }

        try {
            await this.simConnectSend(eventName, 0);
            console.log(`[Camera] SimConnect event sent: ${eventName}`);
            return true;
        } catch (err) {
            console.error(`[Camera] SimConnect event failed:`, err);
            return false;
        }
    }

    /**
     * Send key to MSFS using PowerShell - activates window first
     * This is the fallback method
     */
    async sendKeyToMSFS(key, description) {
        return new Promise((resolve, reject) => {
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        [DllImport("user32.dll")]
                        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                    }
"@
                
                # Find MSFS window by process
                $msfs = Get-Process | Where-Object { $_.ProcessName -match 'FlightSimulator' } | Select-Object -First 1
                
                if ($msfs -and $msfs.MainWindowHandle -ne 0) {
                    [Win32]::SetForegroundWindow($msfs.MainWindowHandle) | Out-Null
                    Start-Sleep -Milliseconds 50
                    [System.Windows.Forms.SendKeys]::SendWait('${key}')
                    Write-Output "OK"
                } else {
                    Write-Error "MSFS window not found"
                }
            `;
            
            exec(`powershell -Command "${psScript.replace(/\n\s+/g, ' ')}"`, 
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Camera] ${description} failed:`, stderr || error.message);
                        reject(error);
                    } else {
                        console.log(`[Camera] ${description} - sent ${key}`);
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Toggle Cinematic Mode (TCM button) - Alt+Z
     */
    async toggleCinematic() {
        console.log('[Camera] TCM - Toggle Cinematic Mode');
        return await this.sendButtonPress('KEY_TOGGLE_CINEMATIC', '%z', 'TCM');
    }

    /**
     * Next Cinematic View (NCV button) - Alt+X
     */
    async nextCinematicView() {
        console.log('[Camera] NCV - Next Cinematic View');
        return await this.sendButtonPress('KEY_NEXT_CINEMATIC', '%x', 'NCV');
    }

    /**
     * Toggle Internal/External View (I/E button) - End key
     */
    async toggleView() {
        console.log('[Camera] I/E - Toggle View');
        return await this.sendButtonPress('VIEW_MODE', '{END}', 'I/E View Toggle');
    }

    /**
     * Refresh platform detection
     */
    async refreshPlatform() {
        try {
            this.platformStatus = await this.platformDetector.refresh();
            console.log('[Camera] Platform refreshed:', this.platformStatus.preferred);
            return this.platformStatus;
        } catch (err) {
            console.error('[Camera] Platform refresh failed:', err);
            return this.platformStatus;
        }
    }

    /**
     * Process camera command from widget
     */
    async handleCommand(command) {
        switch (command) {
            case 'KEY_TOGGLE_CINEMATIC':
                return await this.toggleCinematic();
            case 'KEY_NEXT_CINEMATIC':
                return await this.nextCinematicView();
            case 'VIEW_MODE':
                return await this.toggleView();
            case 'REFRESH_PLATFORM':
                return await this.refreshPlatform();
            default:
                console.log(`[Camera] Unknown command: ${command}`);
                return false;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

module.exports = CameraController;