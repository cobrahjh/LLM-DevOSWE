/**
 * Mobile Companion Mode - SimWidget
 * Auto-detects mobile devices and enables companion mode
 *
 * Usage:
 *   - Add ?mobile=1 to URL to force mobile companion mode
 *   - Add ?mobile=0 to force desktop mode
 *   - Otherwise auto-detects based on device
 */

(function() {
    'use strict';

    // Check URL parameter
    const params = new URLSearchParams(window.location.search);
    const mobileParam = params.get('mobile');

    // Auto-detect mobile
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    }

    // Determine if mobile mode should be enabled
    let enableMobile = false;

    if (mobileParam === '1' || mobileParam === 'true') {
        enableMobile = true;
    } else if (mobileParam === '0' || mobileParam === 'false') {
        enableMobile = false;
    } else {
        enableMobile = isMobileDevice();
    }

    // Apply mobile companion class
    if (enableMobile) {
        document.documentElement.classList.add('mobile-companion');
        document.body.classList.add('mobile-companion');

        // Prevent zoom on double-tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // Lock orientation to portrait if supported
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('portrait').catch(() => {});
        }

        console.log('[SimWidget] Mobile companion mode enabled');
    }

    // Export detection function
    window.SimWidgetMobile = {
        isEnabled: () => enableMobile,
        isMobileDevice: isMobileDevice,
        enable: () => {
            document.documentElement.classList.add('mobile-companion');
            document.body.classList.add('mobile-companion');
        },
        disable: () => {
            document.documentElement.classList.remove('mobile-companion');
            document.body.classList.remove('mobile-companion');
        }
    };
})();
