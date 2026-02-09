/**
 * Theme Switcher - SimGlass
 * Manages theme selection and persistence across widgets
 *
 * Themes: default, cockpit, glass, day, highcontrast
 *
 * Usage:
 *   const themeSwitcher = new ThemeSwitcher();
 *   themeSwitcher.setTheme('cockpit');
 */

class ThemeSwitcher {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'SimGlass-theme';
        this.defaultTheme = options.defaultTheme || 'default';
        this.themes = ['default', 'cockpit', 'glass', 'day', 'oled', 'sunset', 'retro', 'highcontrast'];
        this.currentTheme = this.defaultTheme;

        // Load saved theme
        this.loadTheme();

        // Listen for theme changes from other widgets
        this.initSyncListener();

        // Create theme picker if container specified
        if (options.container) {
            this.createPicker(options.container);
        }
    }

    initSyncListener() {
        this._syncChannel = new SafeChannel('SimGlass-theme');
        this._syncChannel.onmessage = (event) => {
            if (event.data.type === 'theme-change' && event.data.theme) {
                this.applyTheme(event.data.theme, false);
            }
        };
    }

    destroy() {
        if (this._syncChannel) {
            this._syncChannel.close();
            this._syncChannel = null;
        }
    }

    loadTheme() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && this.themes.includes(saved)) {
                this.applyTheme(saved, false);
            }
        } catch (e) {
            console.log('[Theme] Could not load saved theme');
        }
    }

    saveTheme(theme) {
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (e) {
            console.log('[Theme] Could not save theme');
        }
    }

    setTheme(theme, broadcast = true) {
        if (!this.themes.includes(theme)) {
            console.warn('[Theme] Unknown theme:', theme);
            return false;
        }

        this.applyTheme(theme, broadcast);
        this.saveTheme(theme);
        return true;
    }

    applyTheme(theme, broadcast = true) {
        // Remove all theme classes
        this.themes.forEach(t => {
            document.body.classList.remove('theme-' + t);
        });

        // Add transition class for smooth change
        document.body.classList.add('theme-transition');

        // Apply new theme
        if (theme !== 'default') {
            document.body.classList.add('theme-' + theme);
        }

        this.currentTheme = theme;

        // Remove transition class after animation
        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 300);

        // Broadcast to other widgets
        if (broadcast) {
            const channel = new SafeChannel('SimGlass-theme');
            channel.postMessage({ type: 'theme-change', theme });
            channel.close();
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
    }

    getTheme() {
        return this.currentTheme;
    }

    nextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.setTheme(this.themes[nextIndex]);
        return this.themes[nextIndex];
    }

    createPicker(container) {
        const pickerEl = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!pickerEl) return;

        const themeInfo = {
            'default': { name: 'Default', icon: '\ud83c\udf19', desc: 'Dark blue theme' },
            'cockpit': { name: 'Cockpit', icon: '\u2708\ufe0f', desc: 'Green aviation instruments' },
            'glass': { name: 'Glass', icon: '\ud83d\udc8e', desc: 'Modern avionics blue' },
            'day': { name: 'Day', icon: '\u2600\ufe0f', desc: 'Light mode' },
            'oled': { name: 'OLED', icon: '\ud83d\udda4', desc: 'True black for OLED' },
            'sunset': { name: 'Sunset', icon: '\ud83c\udf05', desc: 'Warm night flying' },
            'retro': { name: 'Retro', icon: '\ud83d\udcdf', desc: 'Amber CRT style' },
            'highcontrast': { name: 'Contrast', icon: '\ud83d\udc41\ufe0f', desc: 'Accessibility mode' }
        };

        const picker = document.createElement('div');
        picker.className = 'theme-picker';

        const label = document.createElement('div');
        label.className = 'theme-picker-label';
        label.textContent = 'Theme';
        picker.appendChild(label);

        const options = document.createElement('div');
        options.className = 'theme-picker-options';

        this.themes.forEach(theme => {
            const info = themeInfo[theme];
            const btn = document.createElement('button');
            btn.className = 'theme-option';
            btn.dataset.theme = theme;
            btn.title = info.desc;

            if (theme === this.currentTheme) {
                btn.classList.add('active');
            }

            const icon = document.createElement('span');
            icon.className = 'theme-icon';
            icon.textContent = info.icon;

            const name = document.createElement('span');
            name.className = 'theme-name';
            name.textContent = info.name;

            btn.appendChild(icon);
            btn.appendChild(name);

            btn.addEventListener('click', () => {
                this.setTheme(theme);
                options.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });

            options.appendChild(btn);
        });

        picker.appendChild(options);
        pickerEl.appendChild(picker);

        // Update active state on theme change
        window.addEventListener('theme-changed', (e) => {
            options.querySelectorAll('.theme-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === e.detail.theme);
            });
        });

        return picker;
    }

    // Static method to quickly apply theme without instance
    static apply(theme) {
        const switcher = new ThemeSwitcher();
        return switcher.setTheme(theme);
    }

    // Static method to get current theme
    static current() {
        try {
            return localStorage.getItem('SimGlass-theme') || 'default';
        } catch (e) {
            return 'default';
        }
    }
}

// Add picker styles dynamically
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .theme-picker {
            padding: 12px;
        }

        .theme-picker-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--widget-text-muted, #888);
            margin-bottom: 8px;
            letter-spacing: 1px;
        }

        .theme-picker-options {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .theme-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 14px;
            background: var(--widget-bg-secondary, #16213e);
            border: 2px solid transparent;
            border-radius: var(--widget-radius-sm, 6px);
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 70px;
        }

        .theme-option:hover {
            border-color: var(--widget-accent, #667eea);
            transform: translateY(-2px);
        }

        .theme-option.active {
            border-color: var(--widget-accent, #667eea);
            background: rgba(102, 126, 234, 0.2);
        }

        .theme-icon {
            font-size: 20px;
            margin-bottom: 4px;
        }

        .theme-name {
            font-size: 10px;
            color: var(--widget-text-muted, #888);
        }

        .theme-option.active .theme-name {
            color: var(--widget-text, #fff);
        }

        /* Compact mode for header buttons */
        .theme-picker-compact {
            display: flex;
            gap: 4px;
        }

        .theme-picker-compact .theme-btn {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid transparent;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--widget-bg-secondary, #16213e);
            transition: all 0.2s ease;
        }

        .theme-picker-compact .theme-btn:hover {
            transform: scale(1.1);
        }

        .theme-picker-compact .theme-btn.active {
            border-color: var(--widget-accent, #667eea);
        }
    `;
    document.head.appendChild(style);
})();

// Export for use
if (typeof window !== 'undefined') {
    window.ThemeSwitcher = ThemeSwitcher;
}
