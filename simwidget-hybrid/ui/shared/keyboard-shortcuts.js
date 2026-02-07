/**
 * SimGlass Keyboard Shortcuts v1.0.0
 * Global hotkeys for widget control
 */

class KeyboardShortcuts {
    constructor(options = {}) {
        this.shortcuts = new Map();
        this.enabled = true;
        this.onTrigger = options.onTrigger || (() => {});

        this.registerDefaults();
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleKeydown(e) {
        if (!this.enabled) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = this.getKeyCombo(e);
        const shortcut = this.shortcuts.get(key);

        if (shortcut) {
            e.preventDefault();
            shortcut.action();
            this.onTrigger(shortcut);
        }
    }

    getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    register(combo, config) {
        this.shortcuts.set(combo.toLowerCase(), {
            combo: combo,
            label: config.label || combo,
            action: config.action,
            category: config.category || 'general'
        });
    }

    unregister(combo) {
        this.shortcuts.delete(combo.toLowerCase());
    }

    registerDefaults() {
        // Navigation
        this.register('ctrl+k', {
            label: 'Quick Search',
            category: 'navigation',
            action: () => this.openQuickSearch()
        });

        this.register('ctrl+/', {
            label: 'Show Shortcuts',
            category: 'navigation',
            action: () => this.showHelp()
        });

        this.register('escape', {
            label: 'Close Dialog',
            category: 'navigation',
            action: () => this.closeDialogs()
        });

        // Widget controls
        this.register('ctrl+1', {
            label: 'Aircraft Control',
            category: 'widgets',
            action: () => this.openWidget('aircraft-control')
        });

        this.register('ctrl+2', {
            label: 'Checklist',
            category: 'widgets',
            action: () => this.openWidget('checklist-widget')
        });

        this.register('ctrl+3', {
            label: 'Map',
            category: 'widgets',
            action: () => this.openWidget('map-widget')
        });

        this.register('ctrl+4', {
            label: 'Weather',
            category: 'widgets',
            action: () => this.openWidget('weather-widget')
        });

        this.register('ctrl+5', {
            label: 'Flight Plan',
            category: 'widgets',
            action: () => this.openWidget('flightplan-widget')
        });

        // Theme
        this.register('ctrl+shift+t', {
            label: 'Toggle Theme',
            category: 'appearance',
            action: () => this.toggleTheme()
        });

        this.register('ctrl+shift+n', {
            label: 'Night Mode',
            category: 'appearance',
            action: () => this.toggleNightMode()
        });
    }

    openQuickSearch() {
        if (window.widgetSearch) {
            window.widgetSearch.open();
        }
    }

    showHelp() {
        this.renderHelpDialog();
    }

    closeDialogs() {
        document.querySelectorAll('.shortcut-dialog, .widget-search-dialog').forEach(el => {
            el.remove();
        });
    }

    openWidget(widgetId) {
        window.open('/ui/' + widgetId + '/', '_blank', 'width=400,height=600');
    }

    toggleTheme() {
        if (window.themeSwitcher) {
            const themes = ['default', 'cockpit', 'glass', 'oled'];
            const current = window.themeSwitcher.getTheme();
            const idx = themes.indexOf(current);
            const next = themes[(idx + 1) % themes.length];
            window.themeSwitcher.setTheme(next);
        }
    }

    toggleNightMode() {
        if (window.nightMode) {
            window.nightMode.toggle();
        }
    }

    renderHelpDialog() {
        this.closeDialogs();

        const dialog = document.createElement('div');
        dialog.className = 'shortcut-dialog';
        dialog.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #1a1a2e; border: 1px solid #333; border-radius: 12px;
            padding: 20px; z-index: 10000; min-width: 300px; max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Keyboard Shortcuts';
        title.style.cssText = 'margin: 0 0 16px; color: #fff; font-size: 16px;';
        dialog.appendChild(title);

        const categories = {};
        this.shortcuts.forEach((s, key) => {
            if (!categories[s.category]) categories[s.category] = [];
            categories[s.category].push({ key, ...s });
        });

        Object.entries(categories).forEach(([cat, shortcuts]) => {
            const catTitle = document.createElement('div');
            catTitle.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            catTitle.style.cssText = 'font-size: 11px; color: #888; text-transform: uppercase; margin: 12px 0 6px;';
            dialog.appendChild(catTitle);

            shortcuts.forEach(s => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);';

                const label = document.createElement('span');
                label.textContent = s.label;
                label.style.cssText = 'color: #fff; font-size: 13px;';

                const key = document.createElement('span');
                key.textContent = s.combo;
                key.style.cssText = 'background: #16213e; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #667eea; font-family: monospace;';

                row.appendChild(label);
                row.appendChild(key);
                dialog.appendChild(row);
            });
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close (Esc)';
        closeBtn.style.cssText = 'margin-top: 16px; width: 100%; padding: 10px; background: #667eea; border: none; border-radius: 6px; color: #fff; cursor: pointer;';
        closeBtn.onclick = () => dialog.remove();
        dialog.appendChild(closeBtn);

        document.body.appendChild(dialog);
    }

    getAll() {
        return Array.from(this.shortcuts.entries()).map(([key, config]) => ({
            key,
            ...config
        }));
    }
}

// Auto-init
if (typeof window !== 'undefined') {
    window.keyboardShortcuts = new KeyboardShortcuts();
}
