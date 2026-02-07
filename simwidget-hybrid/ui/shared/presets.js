/**
 * SimGlass Presets System v1.0.0
 * Last Updated: 2025-01-23
 *
 * Widget preset/layout system for quickly opening groups of related widgets.
 * Include: <script src="/ui/shared/presets.js"></script>
 */

const SimGlassPresets = (function() {
    const STORAGE_KEY = 'SimGlass-presets';

    // Built-in preset definitions
    const builtInPresets = {
        IFR: {
            name: 'IFR',
            description: 'Instrument Flight Rules - Full cockpit setup',
            icon: 'compass',
            widgets: [
                '/ui/copilot-widget/',
                '/ui/flightplan-widget/',
                '/ui/map-widget/',
                '/ui/weather-widget/',
                '/ui/radio-stack/'
            ]
        },
        VFR: {
            name: 'VFR',
            description: 'Visual Flight Rules - Essential navigation',
            icon: 'eye',
            widgets: [
                '/ui/map-widget/',
                '/ui/checklist-widget/',
                '/ui/timer-widget/',
                '/ui/notepad-widget/'
            ]
        },
        Cruise: {
            name: 'Cruise',
            description: 'Cruise phase - Monitoring and planning',
            icon: 'plane',
            widgets: [
                '/ui/copilot-widget/',
                '/ui/flightplan-widget/',
                '/ui/notepad-widget/',
                '/ui/timer-widget/'
            ]
        },
        Ground: {
            name: 'Ground',
            description: 'Ground operations - Pre-flight setup',
            icon: 'wrench',
            widgets: [
                '/ui/checklist-widget/',
                '/ui/fuel-widget/',
                '/ui/simbrief-widget/'
            ]
        }
    };

    /**
     * Get all presets (built-in + custom)
     * @returns {object} All preset definitions keyed by name
     */
    function getPresets() {
        const customPresets = loadCustomPresets();
        return {
            ...builtInPresets,
            ...customPresets
        };
    }

    /**
     * Get only built-in presets
     * @returns {object} Built-in preset definitions
     */
    function getBuiltInPresets() {
        return { ...builtInPresets };
    }

    /**
     * Apply a preset by opening all its widgets in new tabs/windows
     * @param {string} presetName - Name of the preset to apply
     * @param {object} options - { delay: ms between opens, newWindow: boolean }
     * @returns {boolean} True if preset was found and applied
     */
    function applyPreset(presetName, options = {}) {
        const presets = getPresets();
        const preset = presets[presetName];

        if (!preset) {
            console.warn(`[Presets] Preset "${presetName}" not found`);
            return false;
        }

        const delay = options.delay || 200;
        const newWindow = options.newWindow || false;

        console.log(`[Presets] Applying preset: ${presetName} (${preset.widgets.length} widgets)`);

        preset.widgets.forEach((url, index) => {
            setTimeout(() => {
                if (newWindow) {
                    // Open in new popup window (sized for widgets)
                    const width = 400;
                    const height = 600;
                    const left = 100 + (index * 50);
                    const top = 100 + (index * 30);
                    window.open(url, `widget_${index}`, `width=${width},height=${height},left=${left},top=${top}`);
                } else {
                    // Open in new tab
                    window.open(url, '_blank');
                }
            }, index * delay);
        });

        return true;
    }

    /**
     * Save a custom preset
     * @param {string} name - Unique preset name
     * @param {string[]} widgetUrls - Array of widget URLs
     * @param {object} meta - Optional: { description, icon }
     * @returns {boolean} True if saved successfully
     */
    function saveCustomPreset(name, widgetUrls, meta = {}) {
        if (!name || !Array.isArray(widgetUrls) || widgetUrls.length === 0) {
            console.error('[Presets] Invalid preset: name and widget URLs required');
            return false;
        }

        // Prevent overwriting built-in presets
        if (builtInPresets[name]) {
            console.error(`[Presets] Cannot overwrite built-in preset: ${name}`);
            return false;
        }

        const customPresets = loadCustomPresets();

        customPresets[name] = {
            name: name,
            description: meta.description || `Custom preset: ${name}`,
            icon: meta.icon || 'star',
            widgets: widgetUrls,
            custom: true,
            createdAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
            console.log(`[Presets] Saved custom preset: ${name}`);
            return true;
        } catch (e) {
            console.error('[Presets] Failed to save preset:', e);
            return false;
        }
    }

    /**
     * Load custom presets from localStorage
     * @returns {object} Custom preset definitions
     */
    function loadCustomPresets() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('[Presets] Failed to load custom presets:', e);
            return {};
        }
    }

    /**
     * Delete a custom preset
     * @param {string} name - Preset name to delete
     * @returns {boolean} True if deleted successfully
     */
    function deleteCustomPreset(name) {
        if (builtInPresets[name]) {
            console.error(`[Presets] Cannot delete built-in preset: ${name}`);
            return false;
        }

        const customPresets = loadCustomPresets();

        if (!customPresets[name]) {
            console.warn(`[Presets] Custom preset not found: ${name}`);
            return false;
        }

        delete customPresets[name];

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
            console.log(`[Presets] Deleted custom preset: ${name}`);
            return true;
        } catch (e) {
            console.error('[Presets] Failed to save after delete:', e);
            return false;
        }
    }

    /**
     * Get icon SVG or emoji for a preset
     * @param {string} iconName - Icon identifier
     * @returns {string} HTML for the icon
     */
    function getPresetIcon(iconName) {
        const icons = {
            compass: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/></svg>',
            eye: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
            plane: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
            wrench: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
            star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
        };
        return icons[iconName] || icons.star;
    }

    // Public API
    return {
        getPresets,
        getBuiltInPresets,
        applyPreset,
        saveCustomPreset,
        loadCustomPresets,
        deleteCustomPreset,
        getPresetIcon,
        STORAGE_KEY
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimGlassPresets;
}
