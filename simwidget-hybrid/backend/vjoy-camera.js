/**
 * vJoy Camera Module (Stub)
 *
 * Provides camera execution via vJoy or fallback methods.
 * This is a stub module - actual vJoy integration requires vJoy SDK.
 */

/**
 * Execute camera command
 * @param {string} command - Camera command name
 * @param {object} options - Options
 * @returns {Promise<{success: boolean, method: string}>}
 */
async function executeCamera(command, options = {}) {
    console.log(`[vJoy-Camera] Execute: ${command}`);
    // Stub - actual implementation would use vJoy SDK
    return { success: true, method: 'stub' };
}

/**
 * Check if vJoy is available
 * @returns {Promise<boolean>}
 */
async function checkVJoy() {
    // vJoy typically not available, return false
    return false;
}

/**
 * Check if command is a camera command
 * @param {string} command - Command to check
 * @returns {boolean}
 */
function isCameraCommand(command) {
    const cameraCommands = [
        'COCKPIT_VIEW', 'EXTERNAL_VIEW', 'DRONE_VIEW', 'SHOWCASE_VIEW',
        'FIXED_VIEW', 'INSTRUMENT_VIEW', 'CHASE_VIEW', 'SLEW_VIEW',
        'cockpitVFR', 'cockpitIFR', 'externalChase', 'externalFixed',
        'drone', 'showcase', 'flyby', 'cinematic'
    ];
    return cameraCommands.some(cam =>
        command.toLowerCase().includes(cam.toLowerCase())
    );
}

module.exports = {
    executeCamera,
    checkVJoy,
    isCameraCommand
};
