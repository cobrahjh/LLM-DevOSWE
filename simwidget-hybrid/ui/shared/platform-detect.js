/**
 * Platform Detection Utility
 * Centralized platform/environment detection for all widgets
 */

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Check if running on mobile device
 * @returns {boolean}
 */
export function isMobile() {
    return typeof navigator !== 'undefined' && MOBILE_REGEX.test(navigator.userAgent);
}

/**
 * Check if running in Electron
 * @returns {boolean}
 */
export function isElectron() {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

/**
 * Check if running in MSFS panel (CoherentGT)
 * @returns {boolean}
 */
export function isMSFSPanel() {
    return typeof window !== 'undefined' &&
           (window.coherent !== undefined || window.CoherentGT !== undefined);
}

/**
 * Check if running in browser (not Electron, not MSFS panel)
 * @returns {boolean}
 */
export function isBrowser() {
    return typeof window !== 'undefined' && !isElectron() && !isMSFSPanel();
}

/**
 * Get platform type
 * @returns {'msfs'|'electron'|'mobile'|'browser'}
 */
export function getPlatform() {
    if (isMSFSPanel()) return 'msfs';
    if (isElectron()) return 'electron';
    if (isMobile()) return 'mobile';
    return 'browser';
}

/**
 * Get user agent (safely)
 * @param {number} maxLength - Maximum length to return (default 200)
 * @returns {string}
 */
export function getUserAgent(maxLength = 200) {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.userAgent.substring(0, maxLength);
}

/**
 * Get language (safely)
 * @returns {string}
 */
export function getLanguage() {
    if (typeof navigator === 'undefined') return 'en-US';
    return navigator.language || 'en-US';
}

/**
 * Check if feature is available
 * @param {'localStorage'|'websocket'|'broadcastchannel'|'serviceworker'} feature
 * @returns {boolean}
 */
export function hasFeature(feature) {
    if (typeof window === 'undefined') return false;

    switch (feature.toLowerCase()) {
        case 'localstorage':
            try {
                const test = '__test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (_) {
                return false;
            }
        case 'websocket':
            return typeof WebSocket !== 'undefined';
        case 'broadcastchannel':
            return typeof BroadcastChannel !== 'undefined';
        case 'serviceworker':
            return 'serviceWorker' in navigator;
        default:
            return false;
    }
}
