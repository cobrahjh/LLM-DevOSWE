/**
 * vJoy Controller for SimWidget
 * 
 * Uses vJoy to send virtual joystick button presses
 * ChasePlane can be configured to respond to these buttons
 * 
 * Requirements:
 * 1. vJoy installed and configured (Device 1 enabled with 8+ buttons)
 * 2. npm install ffi-napi ref-napi (for vJoy SDK)
 * 
 * Alternative: Uses command-line vJoyFeeder if SDK fails
 */

const { exec } = require('child_process');
const path = require('path');

// vJoy feeder path
const VJOY_FEEDER = 'C:\\Program Files\\vJoy\\x64\\vJoyFeeder.exe';

class VJoyController {
    constructor() {
        this.deviceId = 1;  // vJoy device 1
        this.useFeeder = true;  // Use command-line feeder (simpler)
    }

    /**
     * Press and release a vJoy button
     * @param {number} buttonId - Button number (1-8)
     */
    async pressButton(buttonId) {
        return new Promise((resolve, reject) => {
            if (this.useFeeder) {
                // Use vJoyFeeder command line
                // Format: vJoyFeeder.exe <device> <button> <state>
                // We need to press then release
                
                // Unfortunately vJoyFeeder doesn't have simple button press
                // We'll use a PowerShell script with the vJoy DLL instead
                
                const script = `
                Add-Type -Path "C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll"
                $vjoy = New-Object vJoy.vJoy
                if ($vjoy.vJoyEnabled()) {
                    $vjoy.AcquireVJD(${this.deviceId})
                    $vjoy.SetBtn($true, ${this.deviceId}, ${buttonId})
                    Start-Sleep -Milliseconds 50
                    $vjoy.SetBtn($false, ${this.deviceId}, ${buttonId})
                    $vjoy.RelinquishVJD(${this.deviceId})
                    Write-Output "OK"
                } else {
                    Write-Output "vJoy not enabled"
                }
                `;
                
                exec(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, 
                    (error, stdout, stderr) => {
                        if (error) {
                            console.error(`vJoy error: ${error.message}`);
                            reject(error);
                        } else {
                            console.log(`vJoy button ${buttonId}: ${stdout.trim()}`);
                            resolve(stdout.trim());
                        }
                    }
                );
            }
        });
    }

    // Button mappings for ChasePlane (configure these in ChasePlane)
    static BUTTONS = {
        TOGGLE_CINEMATIC: 1,  // TCM - Toggle Cinematics Mode
        NEXT_CINEMATIC: 2,    // NCV - Next Cinematic View  
        VIEW_MODE: 3,         // VIEW - Toggle View Mode
        DRONE: 4,             // Drone View
        TOWER: 5,             // Tower View
        FLYBY: 6              // Flyby View
    };
}

module.exports = VJoyController;

// Test if run directly
if (require.main === module) {
    const controller = new VJoyController();
    console.log('Testing vJoy button 1...');
    controller.pressButton(1)
        .then(() => console.log('Test complete'))
        .catch(err => console.error('Test failed:', err));
}
