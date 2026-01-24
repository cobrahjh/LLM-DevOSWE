/**
 * SimWidget Settings Backup
 * Export/Import functionality for all SimWidget settings
 * @version 1.0.0
 */

const SimWidgetSettingsBackup = (function() {
    'use strict';

    const SETTINGS_PREFIX = 'simwidget-';
    const EXPORT_FILENAME = 'simwidget-settings.json';
    const VERSION = '1.0.0';

    /**
     * Collect all localStorage keys starting with 'simwidget-'
     * @returns {Object} All SimWidget settings as key-value pairs
     */
    function collectAllSettings() {
        const settings = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(SETTINGS_PREFIX)) {
                try {
                    const value = localStorage.getItem(key);
                    // Try to parse JSON values
                    try {
                        settings[key] = JSON.parse(value);
                    } catch {
                        settings[key] = value;
                    }
                } catch (e) {
                    console.warn(`[SettingsBackup] Could not read key: ${key}`, e);
                }
            }
        }

        return settings;
    }

    /**
     * Export all settings to a JSON file download
     */
    function exportSettings() {
        const settings = collectAllSettings();

        const exportData = {
            version: VERSION,
            exportDate: new Date().toISOString(),
            hostname: window.location.hostname,
            settingsCount: Object.keys(settings).length,
            settings: settings
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = EXPORT_FILENAME;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[SettingsBackup] Exported ${Object.keys(settings).length} settings`);
        return Object.keys(settings).length;
    }

    /**
     * Import settings from a JSON file
     * @param {File} file - The JSON file to import
     * @returns {Promise<Object>} Result with count of imported settings
     */
    function importSettings(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            if (!file.name.endsWith('.json')) {
                reject(new Error('File must be a JSON file'));
                return;
            }

            const reader = new FileReader();

            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);

                    // Validate structure
                    if (!data.settings || typeof data.settings !== 'object') {
                        reject(new Error('Invalid settings file format'));
                        return;
                    }

                    let importedCount = 0;
                    let skippedCount = 0;

                    // Import each setting
                    for (const [key, value] of Object.entries(data.settings)) {
                        // Only import keys with our prefix for safety
                        if (key.startsWith(SETTINGS_PREFIX)) {
                            try {
                                const stringValue = typeof value === 'string'
                                    ? value
                                    : JSON.stringify(value);
                                localStorage.setItem(key, stringValue);
                                importedCount++;
                            } catch (err) {
                                console.warn(`[SettingsBackup] Could not import key: ${key}`, err);
                                skippedCount++;
                            }
                        } else {
                            skippedCount++;
                        }
                    }

                    console.log(`[SettingsBackup] Imported ${importedCount} settings, skipped ${skippedCount}`);

                    resolve({
                        imported: importedCount,
                        skipped: skippedCount,
                        version: data.version,
                        exportDate: data.exportDate
                    });

                } catch (err) {
                    reject(new Error('Failed to parse settings file: ' + err.message));
                }
            };

            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Get summary of current settings
     * @returns {Object} Summary with counts by category
     */
    function getSettingsSummary() {
        const settings = collectAllSettings();
        const keys = Object.keys(settings);

        const summary = {
            total: keys.length,
            themes: 0,
            presets: 0,
            hotkeys: 0,
            widgets: 0,
            other: 0
        };

        keys.forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('theme')) {
                summary.themes++;
            } else if (lowerKey.includes('preset')) {
                summary.presets++;
            } else if (lowerKey.includes('hotkey') || lowerKey.includes('shortcut')) {
                summary.hotkeys++;
            } else if (lowerKey.includes('widget')) {
                summary.widgets++;
            } else {
                summary.other++;
            }
        });

        return summary;
    }

    /**
     * Clear all SimWidget settings (use with caution)
     * @returns {number} Number of settings cleared
     */
    function clearAllSettings() {
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(SETTINGS_PREFIX)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        console.log(`[SettingsBackup] Cleared ${keysToRemove.length} settings`);
        return keysToRemove.length;
    }

    // Public API
    return {
        collectAllSettings,
        exportSettings,
        importSettings,
        getSettingsSummary,
        clearAllSettings,
        VERSION
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimWidgetSettingsBackup;
}
