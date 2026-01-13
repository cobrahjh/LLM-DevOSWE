/**
 * Mobile Compatibility Engine v1.0.0
 *
 * Responsive support for mobile devices:
 *   - Samsung Galaxy S25 Ultra
 *   - Samsung Galaxy Tab / Navo tablets
 *   - General mobile/tablet support
 *
 * Features:
 *   - Device detection
 *   - Viewport management
 *   - Touch-friendly controls
 *   - Responsive layout switching
 *   - Portrait/landscape handling
 *   - Safe area support (notch handling)
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\mobile-engine.js
 * Last Updated: 2026-01-12
 */

const MobileEngine = (function() {
    'use strict';

    // Device breakpoints
    const BREAKPOINTS = {
        phone: 480,
        phoneLarge: 640,      // S25 Ultra portrait
        tablet: 768,          // Tablets
        tabletLarge: 1024,    // Large tablets
        desktop: 1200
    };

    // Known device profiles
    const DEVICE_PROFILES = {
        's25ultra': {
            name: 'Samsung Galaxy S25 Ultra',
            width: 1440,
            height: 3120,
            pixelRatio: 3.0,
            safeAreaTop: 52,
            safeAreaBottom: 24
        },
        'galaxytab': {
            name: 'Samsung Galaxy Tab',
            width: 1600,
            height: 2560,
            pixelRatio: 2.0,
            safeAreaTop: 0,
            safeAreaBottom: 0
        },
        'navo': {
            name: 'Navo Tablet',
            width: 1920,
            height: 1200,
            pixelRatio: 1.5,
            safeAreaTop: 0,
            safeAreaBottom: 0
        }
    };

    let currentDevice = null;
    let isInitialized = false;
    let orientationListeners = [];
    let resizeDebounceTimer = null;

    // ==================== DEVICE DETECTION ====================

    function detectDevice() {
        const ua = navigator.userAgent.toLowerCase();
        const width = window.screen.width;
        const height = window.screen.height;
        const pixelRatio = window.devicePixelRatio || 1;

        // Check for specific devices
        if (ua.includes('sm-s92')) {
            currentDevice = { ...DEVICE_PROFILES['s25ultra'], detected: 's25ultra' };
        } else if (ua.includes('sm-t') || ua.includes('galaxy tab')) {
            currentDevice = { ...DEVICE_PROFILES['galaxytab'], detected: 'galaxytab' };
        } else if (ua.includes('navo')) {
            currentDevice = { ...DEVICE_PROFILES['navo'], detected: 'navo' };
        } else {
            // Generic detection
            currentDevice = {
                name: 'Unknown Device',
                width,
                height,
                pixelRatio,
                safeAreaTop: 0,
                safeAreaBottom: 0,
                detected: 'generic'
            };
        }

        // Add computed properties
        currentDevice.isMobile = width < BREAKPOINTS.tablet;
        currentDevice.isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
        currentDevice.isDesktop = width >= BREAKPOINTS.desktop;
        currentDevice.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        currentDevice.isPortrait = height > width;
        currentDevice.viewportWidth = window.innerWidth;
        currentDevice.viewportHeight = window.innerHeight;

        console.log('[MobileEngine] Detected device:', currentDevice.name);
        return currentDevice;
    }

    // ==================== VIEWPORT MANAGEMENT ====================

    function setupViewport() {
        // Set viewport meta tag
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

        // Add mobile class to body
        document.body.classList.add('mobile-engine-enabled');

        if (currentDevice.isMobile) {
            document.body.classList.add('mobile-device');
        }
        if (currentDevice.isTablet) {
            document.body.classList.add('tablet-device');
        }
        if (currentDevice.isTouch) {
            document.body.classList.add('touch-device');
        }
        if (currentDevice.isPortrait) {
            document.body.classList.add('portrait');
        } else {
            document.body.classList.add('landscape');
        }

        // Set CSS custom properties for safe areas
        document.documentElement.style.setProperty('--safe-area-top', `${currentDevice.safeAreaTop}px`);
        document.documentElement.style.setProperty('--safe-area-bottom', `${currentDevice.safeAreaBottom}px`);
        document.documentElement.style.setProperty('--viewport-width', `${currentDevice.viewportWidth}px`);
        document.documentElement.style.setProperty('--viewport-height', `${currentDevice.viewportHeight}px`);
    }

    function injectMobileStyles() {
        const styleId = 'mobile-engine-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Mobile Engine Base Styles */
            :root {
                --safe-area-top: env(safe-area-inset-top, 0px);
                --safe-area-bottom: env(safe-area-inset-bottom, 0px);
                --safe-area-left: env(safe-area-inset-left, 0px);
                --safe-area-right: env(safe-area-inset-right, 0px);
            }

            /* Touch-friendly tap targets */
            .touch-device button,
            .touch-device .btn,
            .touch-device a,
            .touch-device input[type="checkbox"],
            .touch-device input[type="radio"],
            .touch-device select {
                min-height: 44px;
                min-width: 44px;
            }

            /* Prevent text selection on touch */
            .touch-device * {
                -webkit-tap-highlight-color: transparent;
            }

            .touch-device .no-select {
                -webkit-user-select: none;
                user-select: none;
            }

            /* Mobile layout adjustments */
            .mobile-device {
                font-size: 16px;
            }

            .mobile-device .dashboard {
                padding: 10px;
                padding-top: calc(10px + var(--safe-area-top));
                padding-bottom: calc(10px + var(--safe-area-bottom));
            }

            .mobile-device .grid {
                grid-template-columns: 1fr !important;
                gap: 10px;
            }

            .mobile-device .card {
                padding: 12px;
            }

            .mobile-device h1 {
                font-size: 1.5rem;
            }

            .mobile-device h2 {
                font-size: 1.2rem;
            }

            .mobile-device .card-header h2 {
                font-size: 1rem;
            }

            /* Tablet layout */
            .tablet-device .grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 15px;
            }

            .tablet-device .card {
                padding: 15px;
            }

            /* Portrait mode */
            .portrait .output-bubble {
                width: 90vw !important;
                left: 5vw !important;
                right: auto !important;
            }

            /* Landscape mode */
            .landscape .output-bubble {
                max-width: 400px;
            }

            /* Header mobile adjustments */
            .mobile-device .header {
                flex-wrap: wrap;
                gap: 10px;
            }

            .mobile-device .header-controls {
                width: 100%;
                justify-content: center;
            }

            .mobile-device .header-controls button {
                flex: 1;
                max-width: 60px;
            }

            /* Service cards mobile */
            .mobile-device .service-status {
                flex-direction: column;
            }

            .mobile-device .service-status .status-light {
                margin-bottom: 8px;
            }

            /* Modal mobile */
            .mobile-device .modal {
                margin: 10px;
                width: calc(100% - 20px);
                max-width: none;
                max-height: calc(100vh - 20px - var(--safe-area-top) - var(--safe-area-bottom));
            }

            .mobile-device .modal-header {
                padding: 15px;
            }

            .mobile-device .modal-body {
                padding: 15px;
            }

            /* Debug Inspector mobile */
            .mobile-device #debug-inspector {
                bottom: calc(10px + var(--safe-area-bottom));
                right: 10px;
                max-width: calc(100vw - 20px);
            }

            /* Output bubble mobile */
            .mobile-device .output-bubble {
                bottom: calc(70px + var(--safe-area-bottom));
                right: 10px;
                max-width: calc(100vw - 20px);
            }

            /* Quick actions mobile */
            .mobile-device .quick-actions {
                flex-wrap: wrap;
            }

            .mobile-device .quick-actions button {
                flex: 1 1 45%;
                min-height: 50px;
            }

            /* Widget list mobile */
            .mobile-device .widget-list {
                flex-direction: column;
            }

            .mobile-device .widget-item {
                width: 100%;
            }

            /* Input fields mobile */
            .mobile-device input[type="text"],
            .mobile-device input[type="password"],
            .mobile-device input[type="email"],
            .mobile-device textarea {
                font-size: 16px; /* Prevent zoom on focus in iOS */
            }

            /* Chat input mobile */
            .mobile-device .chat-input-area {
                padding: 10px;
                padding-bottom: calc(10px + var(--safe-area-bottom));
            }

            .mobile-device .chat-input-area textarea {
                min-height: 44px;
            }

            /* Scrollable containers mobile */
            .mobile-device .scrollable {
                -webkit-overflow-scrolling: touch;
            }

            /* Hide scrollbars on mobile but keep scrolling */
            .mobile-device ::-webkit-scrollbar {
                width: 3px;
                height: 3px;
            }

            .mobile-device ::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
            }

            /* Pull-to-refresh indicator */
            .mobile-device .pull-to-refresh {
                position: fixed;
                top: var(--safe-area-top);
                left: 50%;
                transform: translateX(-50%) translateY(-100%);
                background: rgba(0,217,255,0.9);
                padding: 10px 20px;
                border-radius: 0 0 8px 8px;
                transition: transform 0.3s;
                z-index: 9999;
            }

            .mobile-device .pull-to-refresh.visible {
                transform: translateX(-50%) translateY(0);
            }

            /* Bottom navigation for mobile */
            .mobile-device .bottom-nav {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: calc(60px + var(--safe-area-bottom));
                padding-bottom: var(--safe-area-bottom);
                background: rgba(15, 52, 96, 0.95);
                display: flex;
                justify-content: space-around;
                align-items: center;
                border-top: 1px solid rgba(0,217,255,0.3);
                z-index: 1000;
            }

            .mobile-device .bottom-nav button {
                flex: 1;
                height: 100%;
                background: none;
                border: none;
                color: #888;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }

            .mobile-device .bottom-nav button.active {
                color: #00d9ff;
            }

            .mobile-device .bottom-nav button span.icon {
                font-size: 20px;
            }

            /* Adjust main content when bottom nav present */
            .mobile-device.has-bottom-nav .main-content {
                padding-bottom: calc(70px + var(--safe-area-bottom));
            }
        `;

        document.head.appendChild(style);
        console.log('[MobileEngine] Mobile styles injected');
    }

    // ==================== ORIENTATION HANDLING ====================

    function handleOrientationChange() {
        // Update device info
        currentDevice.isPortrait = window.innerHeight > window.innerWidth;
        currentDevice.viewportWidth = window.innerWidth;
        currentDevice.viewportHeight = window.innerHeight;

        // Update CSS custom properties
        document.documentElement.style.setProperty('--viewport-width', `${currentDevice.viewportWidth}px`);
        document.documentElement.style.setProperty('--viewport-height', `${currentDevice.viewportHeight}px`);

        // Update body classes
        document.body.classList.toggle('portrait', currentDevice.isPortrait);
        document.body.classList.toggle('landscape', !currentDevice.isPortrait);

        // Notify listeners
        orientationListeners.forEach(listener => {
            try {
                listener(currentDevice.isPortrait ? 'portrait' : 'landscape', currentDevice);
            } catch (e) {
                console.warn('[MobileEngine] Orientation listener error:', e);
            }
        });

        console.log('[MobileEngine] Orientation changed:', currentDevice.isPortrait ? 'portrait' : 'landscape');
    }

    function onOrientationChange(callback) {
        orientationListeners.push(callback);
        return () => {
            orientationListeners = orientationListeners.filter(l => l !== callback);
        };
    }

    // ==================== TOUCH GESTURES ====================

    function setupTouchGestures() {
        if (!currentDevice.isTouch) return;

        let touchStartY = 0;
        let isPulling = false;

        // Pull-to-refresh
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (touchStartY === 0) return;
            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 50 && window.scrollY === 0) {
                isPulling = true;
                // Show pull indicator
                let indicator = document.querySelector('.pull-to-refresh');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'pull-to-refresh';
                    indicator.textContent = 'Release to refresh';
                    document.body.appendChild(indicator);
                }
                indicator.classList.add('visible');
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (isPulling) {
                // Refresh
                const indicator = document.querySelector('.pull-to-refresh');
                if (indicator) {
                    indicator.textContent = 'Refreshing...';
                    setTimeout(() => {
                        indicator.classList.remove('visible');
                        // Trigger refresh event
                        document.dispatchEvent(new CustomEvent('mobileRefresh'));
                    }, 500);
                }
                isPulling = false;
            }
            touchStartY = 0;
        }, { passive: true });

        console.log('[MobileEngine] Touch gestures enabled');
    }

    // ==================== INITIALIZATION ====================

    function init() {
        if (isInitialized) return;

        console.log('[MobileEngine] Initializing mobile compatibility engine');

        // Detect device
        detectDevice();

        // Setup viewport
        setupViewport();

        // Inject styles
        injectMobileStyles();

        // Setup touch gestures
        setupTouchGestures();

        // Listen for orientation changes
        window.addEventListener('resize', () => {
            if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(handleOrientationChange, 150);
        });

        window.addEventListener('orientationchange', handleOrientationChange);

        isInitialized = true;
        console.log('[MobileEngine] Ready -', currentDevice.isMobile ? 'Mobile' : currentDevice.isTablet ? 'Tablet' : 'Desktop', 'mode');

        // Dispatch init event
        document.dispatchEvent(new CustomEvent('mobileEngineReady', { detail: currentDevice }));

        return currentDevice;
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        getDevice: () => currentDevice,
        isMobile: () => currentDevice?.isMobile || false,
        isTablet: () => currentDevice?.isTablet || false,
        isTouch: () => currentDevice?.isTouch || false,
        isPortrait: () => currentDevice?.isPortrait || false,
        onOrientationChange,
        getBreakpoints: () => ({ ...BREAKPOINTS }),
        refresh: () => {
            detectDevice();
            setupViewport();
        }
    };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MobileEngine.init());
} else {
    MobileEngine.init();
}

// Export
if (typeof module !== 'undefined') module.exports = { MobileEngine };
