/**
 * SimWidget Presets Manager v1.0.0
 * Save and load widget arrangements/layouts
 */

class WidgetPresets {
    constructor() {
        this.presets = [];
        this.loadPresets();
    }

    /**
     * Save current widget arrangement as a preset
     */
    savePreset(name, description = '') {
        const arrangement = this.captureCurrentArrangement();

        const preset = {
            id: Date.now().toString(36),
            name: name,
            description: description,
            created: new Date().toISOString(),
            widgets: arrangement.widgets,
            theme: arrangement.theme
        };

        this.presets.push(preset);
        this.saveToStorage();
        return preset;
    }

    /**
     * Capture the current state of all open widgets
     */
    captureCurrentArrangement() {
        const widgets = [];

        // Get all widget containers with saved positions
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('simwidget_')) {
                try {
                    const state = JSON.parse(localStorage.getItem(key));
                    widgets.push({
                        id: key.replace('simwidget_', ''),
                        state: state
                    });
                } catch (e) {}
            }
        }

        const theme = window.themeSwitcher?.getTheme() || 'default';

        return { widgets, theme };
    }

    /**
     * Load a preset and apply it
     */
    loadPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return false;

        // Apply theme
        if (preset.theme && window.themeSwitcher) {
            window.themeSwitcher.setTheme(preset.theme);
        }

        // Apply widget states
        preset.widgets.forEach(w => {
            try {
                localStorage.setItem('simwidget_' + w.id, JSON.stringify(w.state));
            } catch (e) {}
        });

        // Notify widgets to reload their state
        window.dispatchEvent(new CustomEvent('preset-loaded', { detail: preset }));

        return true;
    }

    /**
     * Delete a preset
     */
    deletePreset(presetId) {
        this.presets = this.presets.filter(p => p.id !== presetId);
        this.saveToStorage();
    }

    /**
     * Rename a preset
     */
    renamePreset(presetId, newName) {
        const preset = this.presets.find(p => p.id === presetId);
        if (preset) {
            preset.name = newName;
            this.saveToStorage();
        }
    }

    /**
     * Export presets to JSON
     */
    exportPresets() {
        const blob = new Blob([JSON.stringify(this.presets, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'simwidget-presets-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import presets from JSON file
     */
    async importPresets(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (Array.isArray(imported)) {
                        // Merge with existing, avoiding duplicates by id
                        const existingIds = new Set(this.presets.map(p => p.id));
                        imported.forEach(preset => {
                            if (!existingIds.has(preset.id)) {
                                this.presets.push(preset);
                            }
                        });
                        this.saveToStorage();
                        resolve(imported.length);
                    } else {
                        reject(new Error('Invalid preset file'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Get all presets
     */
    getAll() {
        return this.presets;
    }

    /**
     * Get default presets
     */
    getDefaultPresets() {
        return [
            {
                id: 'default-vfr',
                name: 'VFR Flight',
                description: 'Basic VFR setup with map, weather, and checklist',
                isDefault: true,
                widgets: [
                    { id: 'map-widget', url: '/ui/map-widget/' },
                    { id: 'weather-widget', url: '/ui/weather-widget/' },
                    { id: 'checklist-widget', url: '/ui/checklist-widget/' }
                ]
            },
            {
                id: 'default-ifr',
                name: 'IFR Flight',
                description: 'Full IFR setup with charts, flight plan, and radio',
                isDefault: true,
                widgets: [
                    { id: 'flightplan-widget', url: '/ui/flightplan-widget/' },
                    { id: 'charts-widget', url: '/ui/charts-widget/' },
                    { id: 'radio-stack', url: '/ui/radio-stack/' },
                    { id: 'weather-widget', url: '/ui/weather-widget/' }
                ]
            },
            {
                id: 'default-airliner',
                name: 'Airliner',
                description: 'Commercial flight setup with SimBrief and performance',
                isDefault: true,
                widgets: [
                    { id: 'simbrief-widget', url: '/ui/simbrief-widget/' },
                    { id: 'flightplan-widget', url: '/ui/flightplan-widget/' },
                    { id: 'checklist-widget', url: '/ui/checklist-widget/' },
                    { id: 'performance-widget', url: '/ui/performance-widget/' }
                ]
            },
            {
                id: 'default-training',
                name: 'Training',
                description: 'Learning setup with instructor and kneeboard',
                isDefault: true,
                widgets: [
                    { id: 'flight-instructor', url: '/ui/flight-instructor/' },
                    { id: 'checklist-widget', url: '/ui/checklist-widget/' },
                    { id: 'kneeboard-widget', url: '/ui/kneeboard-widget/' },
                    { id: 'landing-widget', url: '/ui/landing-widget/' }
                ]
            }
        ];
    }

    /**
     * Open widgets from a preset
     */
    openPresetWidgets(presetId) {
        let preset = this.presets.find(p => p.id === presetId);

        // Check default presets if not found
        if (!preset) {
            preset = this.getDefaultPresets().find(p => p.id === presetId);
        }

        if (!preset) return false;

        // Open each widget in the preset
        const widgets = preset.widgets || [];
        widgets.forEach((w, i) => {
            const url = w.url || '/ui/' + w.id + '/';
            setTimeout(() => {
                window.open(url, '_blank', 'width=400,height=500,left=' + (100 + i * 420));
            }, i * 200);
        });

        return true;
    }

    saveToStorage() {
        try {
            localStorage.setItem('simwidget-presets', JSON.stringify(this.presets));
        } catch (e) {}
    }

    loadPresets() {
        try {
            const saved = localStorage.getItem('simwidget-presets');
            if (saved) {
                this.presets = JSON.parse(saved);
            }
        } catch (e) {
            this.presets = [];
        }
    }
}

// Auto-init
if (typeof window !== 'undefined') {
    window.widgetPresets = new WidgetPresets();
}
