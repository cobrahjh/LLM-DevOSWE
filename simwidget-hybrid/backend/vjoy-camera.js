/**
 * vJoy Camera Controller Integration
 * SimWidget_Engine - Harold-PC
 * v1.0.0 - Last updated: 2026-01-06
 * 
 * Uses vJoy virtual joystick for ChasePlane camera controls
 * Bypasses DirectInput limitations that block keyboard simulation
 */

const { exec } = require('child_process');
const path = require('path');

const VJOY_SCRIPT = path.join(__dirname, 'vjoy-control.ps1');
const VJOY_DLL = 'C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll';

// Camera command mapping
const CAMERA_COMMANDS = {
    'CAM_TOGGLE_CINEMATIC': 'TCM',
    'CAM_NEXT_CINEMATIC': 'NCV',
    'CAM_PREV_CINEMATIC': 'PCV',
    'CAM_VIEW_TOGGLE': 'VTG',
    'CAM_DRONE_TOGGLE': 'DRN',
    'CAM_RESET': 'RST',
    // Direct aliases
    'TCM': 'TCM',
    'NCV': 'NCV',
    'PCV': 'PCV',
    'VTG': 'VTG',
    'DRN': 'DRN',
    'RST': 'RST',
    // Legacy KEY_ commands
    'KEY_TOGGLE_CINEMATIC': 'TCM',
    'KEY_NEXT_CINEMATIC': 'NCV'
};

let vJoyAvailable = null;

/**
 * Check if vJoy is available
 * @returns {Promise<boolean>}
 */
function checkVJoy() {
    return new Promise((resolve) => {
        if (vJoyAvailable !== null) {
            resolve(vJoyAvailable);
            return;
        }
        
        const fs = require('fs');
        vJoyAvailable = fs.existsSync(VJOY_DLL);
        
        if (vJoyAvailable) {
            console.log('[vJoy] vJoyInterface.dll found - vJoy camera controls enabled');
        } else {
            console.log('[vJoy] vJoy not installed - falling back to keyboard simulation');
        }
        
        resolve(vJoyAvailable);
    });
}

/**
 * Execute vJoy camera command
 * @param {string} command - Camera command name
 * @returns {Promise<{success: boolean, message: string, method: string}>}
 */
function executeCamera(command) {
    return new Promise(async (resolve) => {
        const vjoyCmd = CAMERA_COMMANDS[command];
        
        if (!vjoyCmd) {
            resolve({ success: false, message: `Unknown camera command: ${command}`, method: 'none' });
            return;
        }
        
        // Check vJoy availability
        const hasVJoy = await checkVJoy();
        
        if (!hasVJoy) {
            resolve({ success: false, message: 'vJoy not available', method: 'none' });
            return;
        }
        
        const psCommand = `powershell -ExecutionPolicy Bypass -File "${VJOY_SCRIPT}" -Command ${vjoyCmd}`;
        
        exec(psCommand, { timeout: 5000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[vJoy Camera] Error: ${stderr || error.message}`);
                resolve({ success: false, message: stderr || error.message, method: 'vjoy' });
            } else {
                console.log(`[vJoy Camera] ${stdout.trim()}`);
                resolve({ success: true, message: stdout.trim(), method: 'vjoy' });
            }
        });
    });
}

/**
 * Check if a command is a camera command
 * @param {string} command
 * @returns {boolean}
 */
function isCameraCommand(command) {
    return command in CAMERA_COMMANDS;
}

module.exports = {
    executeCamera,
    checkVJoy,
    isCameraCommand,
    CAMERA_COMMANDS
};
