/**
 * Platform Detection Utilities v1.0.0
 * Last Updated: 2026-02-07
 *
 * Unified platform detection for all SimGlass widgets.
 * Eliminates duplicate logic across widget-base.js, telemetry.js,
 * device-id.js, mobile-companion.js, and capability-detect.js.
 *
 * Usage:
 *   <script src="/ui/shared/platform-utils.js"></script>
 *
 *   const platform = PlatformUtils.getPlatform();
 *   if (PlatformUtils.isMobile()) { ... }
 *   if (PlatformUtils.hasFeature('localStorage')) { ... }
 */

const PlatformUtils = {
    /**
     * Detect current platform
     * @returns {'msfs-panel'|'electron'|'mobile'|'desktop'}
     */
    getPlatform() {
        // MSFS in-game panel (Coherent GT browser)
        if (window.name === 'ingamepanel' ||
            window.location.href.includes('cohtml') ||
            typeof Coherent !== 'undefined') {
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
    },

    /**
     * Check if running on mobile device
     * @param {boolean} includeTouchScreens - Also detect tablets/touch laptops by touch points
     * @returns {boolean}
     */
    isMobile(includeTouchScreens = false) {
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (includeTouchScreens) {
            return isMobileUA || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
        }

        return isMobileUA;
    },

    /**
     * Check if running in MSFS in-game panel
     * @returns {boolean}
     */
    isMSFSPanel() {
        return window.name === 'ingamepanel' ||
               window.location.href.includes('cohtml') ||
               typeof Coherent !== 'undefined';
    },

    /**
     * Check if running in Electron
     * @returns {boolean}
     */
    isElectron() {
        return navigator.userAgent.includes('Electron');
    },

    /**
     * Check if running on desktop (not mobile, not MSFS panel)
     * @returns {boolean}
     */
    isDesktop() {
        return this.getPlatform() === 'desktop';
    },

    /**
     * Check if a browser feature is available
     * @param {'localStorage'|'sessionStorage'|'indexedDB'|'webgl'|'serviceWorker'|'notifications'|'geolocation'} feature
     * @returns {boolean}
     */
    hasFeature(feature) {
        switch (feature) {
            case 'localStorage':
                try {
                    const test = '__storage_test__';
                    localStorage.setItem(test, test);
                    localStorage.removeItem(test);
                    return true;
                } catch (e) {
                    return false;
                }

            case 'sessionStorage':
                try {
                    const test = '__storage_test__';
                    sessionStorage.setItem(test, test);
                    sessionStorage.removeItem(test);
                    return true;
                } catch (e) {
                    return false;
                }

            case 'indexedDB':
                return typeof indexedDB !== 'undefined';

            case 'webgl':
                try {
                    const canvas = document.createElement('canvas');
                    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                } catch (e) {
                    return false;
                }

            case 'serviceWorker':
                return 'serviceWorker' in navigator;

            case 'notifications':
                return 'Notification' in window;

            case 'geolocation':
                return 'geolocation' in navigator;

            default:
                console.warn(`[PlatformUtils] Unknown feature: ${feature}`);
                return false;
        }
    },

    /**
     * Get platform-specific CSS class
     * @returns {string} e.g., 'platform-desktop'
     */
    getPlatformClass() {
        return `platform-${this.getPlatform()}`;
    },

    /**
     * Apply platform-specific visibility to document
     * Shows/hides elements with .desktop-only, .mobile-only, .msfs-panel-only classes
     */
    applyPlatformVisibility() {
        const platform = this.getPlatform();
        document.body.classList.add(`platform-${platform}`);

        // Hide all platform-specific elements first
        document.querySelectorAll('.desktop-only, .mobile-only, .msfs-panel-only, .electron-only').forEach(el => {
            el.style.display = 'none';
        });

        // Show elements for current platform
        document.querySelectorAll(`.${platform}-only`).forEach(el => {
            el.style.display = '';
        });
    },

    /**
     * Get user agent info
     * @returns {Object} {browser, version, os}
     */
    /**
     * Detect device size category based on screen width, touch capability, and UA.
     * @returns {'phone'|'tablet'|'desktop'}
     */
    getDeviceSize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const shorter = Math.min(w, h);
        const longer  = Math.max(w, h);
        const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
        const ua = navigator.userAgent;

        // Explicit iPad / Android tablet UA
        if (/iPad/i.test(ua)) return 'tablet';
        if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';

        // Touch + short-side >= 600px → tablet
        if (isTouch && shorter >= 600) return 'tablet';

        // Touch + width < 600px → phone
        if (isTouch && w < 600) return 'phone';

        // Non-touch narrow screen still gets "tablet" layout
        if (w >= 600 && w <= 1280 && shorter >= 480) return 'tablet';

        // Anything < 600px wide without explicit touch → phone
        if (w < 600) return 'phone';

        return 'desktop';
    },

    /**
     * Returns true if the device is a tablet (any orientation).
     * @returns {boolean}
     */
    isTablet() {
        return this.getDeviceSize() === 'tablet';
    },

    /**
     * Apply device-size class to an element (default: document.body).
     * Adds device-phone / device-tablet / device-desktop.
     * Call again on resize to update.
     * @param {Element} [target]
     */
    applyDeviceSize(target = document.body) {
        const size = this.getDeviceSize();
        target.classList.remove('device-phone', 'device-tablet', 'device-desktop');
        target.classList.add(`device-${size}`);
        return size;
    },

    getUserAgent() {
        const ua = navigator.userAgent;

        let browser = 'Unknown';
        let version = '';
        let os = 'Unknown';

        // Browser detection
        if (ua.includes('Electron')) {
            browser = 'Electron';
            const match = ua.match(/Electron\/([0-9.]+)/);
            version = match ? match[1] : '';
        } else if (ua.includes('Chrome')) {
            browser = 'Chrome';
            const match = ua.match(/Chrome\/([0-9.]+)/);
            version = match ? match[1] : '';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
            const match = ua.match(/Firefox\/([0-9.]+)/);
            version = match ? match[1] : '';
        } else if (ua.includes('Safari')) {
            browser = 'Safari';
            const match = ua.match(/Version\/([0-9.]+)/);
            version = match ? match[1] : '';
        } else if (ua.includes('Edge')) {
            browser = 'Edge';
            const match = ua.match(/Edge\/([0-9.]+)/);
            version = match ? match[1] : '';
        }

        // OS detection
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac OS')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS')) os = 'iOS';

        return { browser, version, os };
    }
};

// Legacy global function aliases for backward compatibility
window.detectPlatform = () => PlatformUtils.getPlatform();
window.isMobileDevice = (includeTouchScreens) => PlatformUtils.isMobile(includeTouchScreens);
