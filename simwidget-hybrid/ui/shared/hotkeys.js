/**
 * SimWidget Global Hotkeys v1.0.0
 * Last Updated: 2026-01-23
 *
 * Global keyboard shortcuts for SimWidget widgets.
 * Supports customizable hotkeys stored in localStorage.
 *
 * Usage:
 *   <script src="/ui/shared/hotkeys.js"></script>
 *
 *   // Auto-initializes on DOMContentLoaded
 *   // Or manually: SimWidgetHotkeys.init()
 */

const SimWidgetHotkeys = (() => {
    // Default hotkey mappings
    const DEFAULT_HOTKEYS = {
        'ctrl+1': { action: 'open', widget: 'copilot', label: 'Copilot', url: '/ui/copilot-widget/' },
        'ctrl+2': { action: 'open', widget: 'flightplan', label: 'Flight Plan', url: '/ui/flightplan-widget/' },
        'ctrl+3': { action: 'open', widget: 'map', label: 'Map', url: '/ui/map-widget/' },
        'ctrl+4': { action: 'open', widget: 'checklist', label: 'Checklist', url: '/ui/checklist-widget/' },
        'ctrl+5': { action: 'open', widget: 'weather', label: 'Weather', url: '/ui/weather-widget/' },
        'ctrl+shift+s': { action: 'open', widget: 'simbrief', label: 'SimBrief', url: '/ui/simbrief-widget/' },
        'ctrl+shift+n': { action: 'open', widget: 'notepad', label: 'Notepad', url: '/ui/notepad-widget/' },
        'escape': { action: 'close', label: 'Close Widget' }
    };

    const STORAGE_KEY = 'simwidget-hotkeys';
    let hotkeys = {};
    let toastTimeout = null;
    let toastElement = null;
    let initialized = false;

    /**
     * Load hotkeys from localStorage, merging with defaults
     */
    function loadHotkeys() {
        hotkeys = { ...DEFAULT_HOTKEYS };

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const overrides = JSON.parse(stored);
                // Merge overrides with defaults
                for (const key of Object.keys(overrides)) {
                    if (overrides[key] === null) {
                        // null means disabled
                        delete hotkeys[key];
                    } else {
                        hotkeys[key] = { ...hotkeys[key], ...overrides[key] };
                    }
                }
            }
        } catch (e) {
            console.warn('[Hotkeys] Failed to load stored hotkeys:', e);
        }

        return hotkeys;
    }

    /**
     * Save hotkey overrides to localStorage
     */
    function saveHotkeys(overrides) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
            loadHotkeys(); // Reload merged hotkeys
        } catch (e) {
            console.error('[Hotkeys] Failed to save hotkeys:', e);
        }
    }

    /**
     * Reset hotkeys to defaults
     */
    function resetHotkeys() {
        localStorage.removeItem(STORAGE_KEY);
        loadHotkeys();
    }

    /**
     * Convert keyboard event to hotkey string
     */
    function eventToHotkeyString(e) {
        const parts = [];

        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        // Get key name
        let key = e.key.toLowerCase();

        // Normalize special keys
        if (key === ' ') key = 'space';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';

        // Don't add modifier keys as the main key
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
            parts.push(key);
        }

        return parts.join('+');
    }

    /**
     * Create and show toast notification
     */
    function showToast(message, duration = 1500) {
        // Clear existing timeout
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        // Create toast element if needed
        if (!toastElement) {
            toastElement = document.createElement('div');
            toastElement.className = 'simwidget-hotkey-toast';
            toastElement.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(0, 0, 0, 0.85);
                color: #00d4ff;
                padding: 10px 20px;
                border-radius: 8px;
                font-family: 'Segoe UI', system-ui, sans-serif;
                font-size: 13px;
                font-weight: 500;
                z-index: 99999;
                pointer-events: none;
                transition: transform 0.2s ease, opacity 0.2s ease;
                opacity: 0;
                border: 1px solid rgba(0, 212, 255, 0.3);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            `;
            document.body.appendChild(toastElement);
        }

        // Update message and show
        toastElement.textContent = message;

        // Force reflow for animation
        toastElement.offsetHeight;

        toastElement.style.transform = 'translateX(-50%) translateY(0)';
        toastElement.style.opacity = '1';

        // Hide after duration
        toastTimeout = setTimeout(() => {
            toastElement.style.transform = 'translateX(-50%) translateY(100px)';
            toastElement.style.opacity = '0';
        }, duration);
    }

    /**
     * Execute hotkey action
     */
    function executeAction(config) {
        switch (config.action) {
            case 'open':
                showToast(`Opening ${config.label}...`);
                window.open(config.url, '_blank');
                break;

            case 'close':
                showToast('Closing widget...');
                // Small delay so toast is visible
                setTimeout(() => {
                    window.close();
                }, 200);
                break;

            case 'custom':
                if (typeof config.handler === 'function') {
                    showToast(config.label);
                    config.handler();
                }
                break;

            default:
                console.warn('[Hotkeys] Unknown action:', config.action);
        }
    }

    /**
     * Handle keydown event
     */
    function handleKeydown(e) {
        // Don't trigger if user is typing in an input
        const tagName = e.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || e.target.isContentEditable) {
            // Allow Escape to work in inputs
            if (e.key !== 'Escape') {
                return;
            }
        }

        const hotkeyString = eventToHotkeyString(e);
        const config = hotkeys[hotkeyString];

        if (config) {
            e.preventDefault();
            e.stopPropagation();
            executeAction(config);
        }
    }

    /**
     * Register a custom hotkey
     */
    function registerHotkey(key, config) {
        const normalizedKey = key.toLowerCase();
        hotkeys[normalizedKey] = config;
    }

    /**
     * Unregister a hotkey
     */
    function unregisterHotkey(key) {
        const normalizedKey = key.toLowerCase();
        delete hotkeys[normalizedKey];
    }

    /**
     * Get all registered hotkeys
     */
    function getHotkeys() {
        return { ...hotkeys };
    }

    /**
     * Get default hotkeys
     */
    function getDefaults() {
        return { ...DEFAULT_HOTKEYS };
    }

    /**
     * Format hotkey for display (e.g., "ctrl+1" -> "Ctrl+1")
     */
    function formatHotkey(key) {
        return key.split('+').map(part => {
            if (part === 'ctrl') return 'Ctrl';
            if (part === 'shift') return 'Shift';
            if (part === 'alt') return 'Alt';
            return part.toUpperCase();
        }).join('+');
    }

    /**
     * Generate help text for all hotkeys
     */
    function getHelpText() {
        const lines = ['SimWidget Hotkeys:', ''];
        for (const [key, config] of Object.entries(hotkeys)) {
            lines.push(`  ${formatHotkey(key).padEnd(15)} - ${config.label}`);
        }
        return lines.join('\n');
    }

    /**
     * Initialize hotkeys system
     */
    function init() {
        if (initialized) {
            return;
        }

        loadHotkeys();
        document.addEventListener('keydown', handleKeydown, true);
        initialized = true;

        console.log('[Hotkeys] Initialized. Press Ctrl+1-5 for quick widget access.');
    }

    /**
     * Destroy hotkeys system
     */
    function destroy() {
        document.removeEventListener('keydown', handleKeydown, true);

        if (toastElement && toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
            toastElement = null;
        }

        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }

        initialized = false;
    }

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        setTimeout(init, 0);
    }

    // Public API
    return {
        init,
        destroy,
        loadHotkeys,
        saveHotkeys,
        resetHotkeys,
        registerHotkey,
        unregisterHotkey,
        getHotkeys,
        getDefaults,
        formatHotkey,
        getHelpText,
        showToast
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimWidgetHotkeys;
}
