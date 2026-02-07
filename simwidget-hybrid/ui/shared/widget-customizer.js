/**
 * SimGlass Customizer v1.0.0
 *
 * Adds theme, layout, and profile customization to any widget.
 * Include after settings-panel.js:
 *   <script src="/ui/shared/widget-customizer.js"></script>
 */

class WidgetCustomizer {
    constructor(options = {}) {
        this.widgetId = options.widgetId || 'widget';
        this.settingsPanel = options.settingsPanel;
        this.onThemeChange = options.onThemeChange || (() => {});
        this.onLayoutChange = options.onLayoutChange || (() => {});

        // Default themes
        this.themes = {
            // Dark themes
            dark: {
                name: 'Dark',
                bg: '#1a1a2e',
                bgSecondary: '#16213e',
                text: '#ffffff',
                textMuted: '#888888',
                accent: '#667eea',
                border: 'rgba(255,255,255,0.1)'
            },
            amoled: {
                name: 'AMOLED',
                bg: '#000000',
                bgSecondary: '#0a0a0a',
                text: '#ffffff',
                textMuted: '#666666',
                accent: '#00ff88',
                border: 'rgba(255,255,255,0.05)'
            },
            midnight: {
                name: 'Midnight',
                bg: '#0f0f23',
                bgSecondary: '#1a1a3e',
                text: '#e0e0ff',
                textMuted: '#7777aa',
                accent: '#9966ff',
                border: 'rgba(153,102,255,0.2)'
            },
            // Aviation themes
            cockpit: {
                name: 'Cockpit',
                bg: '#0d1117',
                bgSecondary: '#161b22',
                text: '#c9d1d9',
                textMuted: '#8b949e',
                accent: '#ff6b35',
                border: 'rgba(255,107,53,0.2)'
            },
            nightFlight: {
                name: 'Night Flight',
                bg: '#1a0a0a',
                bgSecondary: '#2a1515',
                text: '#ff9999',
                textMuted: '#aa6666',
                accent: '#ff3333',
                border: 'rgba(255,50,50,0.2)'
            },
            garmin: {
                name: 'Garmin',
                bg: '#000000',
                bgSecondary: '#1a1a1a',
                text: '#00ff00',
                textMuted: '#008800',
                accent: '#00ffff',
                border: 'rgba(0,255,0,0.2)'
            },
            boeing: {
                name: 'Boeing',
                bg: '#0a1628',
                bgSecondary: '#142238',
                text: '#7ec8e3',
                textMuted: '#4a7c94',
                accent: '#00aaff',
                border: 'rgba(0,170,255,0.2)'
            },
            airbus: {
                name: 'Airbus',
                bg: '#1a1a2e',
                bgSecondary: '#252545',
                text: '#ffffff',
                textMuted: '#8888aa',
                accent: '#ffaa00',
                border: 'rgba(255,170,0,0.2)'
            },
            // Nature themes
            ocean: {
                name: 'Ocean',
                bg: '#0f2027',
                bgSecondary: '#203a43',
                text: '#ffffff',
                textMuted: '#a0c4d4',
                accent: '#00d4ff',
                border: 'rgba(0,212,255,0.2)'
            },
            forest: {
                name: 'Forest',
                bg: '#0a1f0a',
                bgSecondary: '#153015',
                text: '#c8e6c8',
                textMuted: '#7ab37a',
                accent: '#4caf50',
                border: 'rgba(76,175,80,0.2)'
            },
            sunset: {
                name: 'Sunset',
                bg: '#1a0f1a',
                bgSecondary: '#2d1f2d',
                text: '#ffccaa',
                textMuted: '#cc9977',
                accent: '#ff6600',
                border: 'rgba(255,102,0,0.2)'
            },
            aurora: {
                name: 'Aurora',
                bg: '#0a0a1a',
                bgSecondary: '#151530',
                text: '#aaffaa',
                textMuted: '#66aa88',
                accent: '#00ffaa',
                border: 'rgba(0,255,170,0.2)'
            },
            // Light themes
            light: {
                name: 'Light',
                bg: '#f5f5f5',
                bgSecondary: '#ffffff',
                text: '#333333',
                textMuted: '#666666',
                accent: '#667eea',
                border: 'rgba(0,0,0,0.1)'
            },
            paper: {
                name: 'Paper',
                bg: '#faf8f5',
                bgSecondary: '#ffffff',
                text: '#2c2c2c',
                textMuted: '#6b6b6b',
                accent: '#d4a574',
                border: 'rgba(0,0,0,0.08)'
            },
            daylight: {
                name: 'Daylight',
                bg: '#e8f4fc',
                bgSecondary: '#ffffff',
                text: '#1a3a4a',
                textMuted: '#5a7a8a',
                accent: '#0088cc',
                border: 'rgba(0,136,204,0.15)'
            },
            // Special themes
            hacker: {
                name: 'Hacker',
                bg: '#0a0a0a',
                bgSecondary: '#111111',
                text: '#00ff00',
                textMuted: '#006600',
                accent: '#00ff00',
                border: 'rgba(0,255,0,0.1)'
            },
            cyberpunk: {
                name: 'Cyberpunk',
                bg: '#0d0221',
                bgSecondary: '#1a0a3e',
                text: '#ff00ff',
                textMuted: '#aa00aa',
                accent: '#00ffff',
                border: 'rgba(255,0,255,0.2)'
            },
            retro: {
                name: 'Retro',
                bg: '#2b1b17',
                bgSecondary: '#3d2b27',
                text: '#ffd700',
                textMuted: '#cc9900',
                accent: '#ff4500',
                border: 'rgba(255,215,0,0.2)'
            }
        };

        // Layout presets
        this.layouts = {
            mini: { name: 'Mini', scale: 0.7, padding: 4, gap: 4, borderRadius: 4 },
            compact: { name: 'Compact', scale: 0.85, padding: 8, gap: 6, borderRadius: 6 },
            normal: { name: 'Normal', scale: 1.0, padding: 12, gap: 10, borderRadius: 8 },
            comfortable: { name: 'Comfortable', scale: 1.1, padding: 14, gap: 12, borderRadius: 10 },
            large: { name: 'Large', scale: 1.2, padding: 16, gap: 14, borderRadius: 12 },
            touch: { name: 'Touch', scale: 1.3, padding: 20, gap: 16, borderRadius: 14 },
            tablet: { name: 'Tablet', scale: 1.4, padding: 24, gap: 18, borderRadius: 16 },
            kiosk: { name: 'Kiosk', scale: 1.6, padding: 32, gap: 24, borderRadius: 20 }
        };

        // Built-in profiles
        this.builtInProfiles = {
            'Day VFR': { theme: 'daylight', layout: 'normal' },
            'Night IFR': { theme: 'nightFlight', layout: 'comfortable' },
            'Glass Cockpit': { theme: 'garmin', layout: 'normal' },
            'Phone': { theme: 'amoled', layout: 'touch' },
            'Tablet': { theme: 'dark', layout: 'tablet' },
            'Stream Deck': { theme: 'amoled', layout: 'mini' }
        };

        // Load saved settings
        this.currentTheme = this.load('theme') || 'dark';
        this.currentLayout = this.load('layout') || 'normal';
        this.customColors = this.load('customColors') || {};
        this.profiles = this.load('profiles') || {};

        // Apply saved settings
        this.applyTheme(this.currentTheme);
        this.applyLayout(this.currentLayout);

        // Register settings sections if panel provided
        if (this.settingsPanel) {
            this.registerSections();
        }
    }

    /**
     * Storage helpers
     */
    save(key, value) {
        localStorage.setItem(`SimGlass_${this.widgetId}_${key}`, JSON.stringify(value));
    }

    load(key) {
        try {
            return JSON.parse(localStorage.getItem(`SimGlass_${this.widgetId}_${key}`));
        } catch {
            return null;
        }
    }

    /**
     * Apply theme to document
     */
    applyTheme(themeId) {
        const theme = this.themes[themeId];
        if (!theme) return;

        this.currentTheme = themeId;
        this.save('theme', themeId);

        // Merge with custom colors
        const colors = { ...theme, ...this.customColors };

        // Apply CSS variables
        const root = document.documentElement;
        root.style.setProperty('--widget-bg', colors.bg);
        root.style.setProperty('--widget-bg-secondary', colors.bgSecondary);
        root.style.setProperty('--widget-text', colors.text);
        root.style.setProperty('--widget-text-muted', colors.textMuted);
        root.style.setProperty('--widget-accent', colors.accent);
        root.style.setProperty('--widget-border', colors.border);

        // Update body background
        document.body.style.background = colors.bg;
        document.body.style.color = colors.text;

        this.onThemeChange(themeId, colors);
    }

    /**
     * Apply layout preset
     */
    applyLayout(layoutId) {
        const layout = this.layouts[layoutId];
        if (!layout) return;

        this.currentLayout = layoutId;
        this.save('layout', layoutId);

        const root = document.documentElement;
        root.style.setProperty('--widget-scale', layout.scale);
        root.style.setProperty('--widget-padding', `${layout.padding}px`);
        root.style.setProperty('--widget-gap', `${layout.gap}px`);

        // Apply scale to body
        document.body.style.fontSize = `${16 * layout.scale}px`;

        this.onLayoutChange(layoutId, layout);
    }

    /**
     * Set custom accent color
     */
    setAccentColor(color) {
        this.customColors.accent = color;
        this.save('customColors', this.customColors);
        this.applyTheme(this.currentTheme);
    }

    /**
     * Save current settings as profile
     */
    saveProfile(name) {
        this.profiles[name] = {
            theme: this.currentTheme,
            layout: this.currentLayout,
            customColors: { ...this.customColors },
            savedAt: Date.now()
        };
        this.save('profiles', this.profiles);
        return true;
    }

    /**
     * Load a saved profile (user or built-in)
     */
    loadProfile(name) {
        // Check user profiles first, then built-in
        const profile = this.profiles[name] || this.builtInProfiles[name];
        if (!profile) return false;

        this.customColors = profile.customColors || {};
        this.save('customColors', this.customColors);
        this.applyTheme(profile.theme);
        this.applyLayout(profile.layout);
        return true;
    }

    /**
     * Delete a profile
     */
    deleteProfile(name) {
        delete this.profiles[name];
        this.save('profiles', this.profiles);
    }

    /**
     * Register settings panel sections
     */
    registerSections() {
        // Appearance section
        this.settingsPanel.registerSection('appearance', {
            title: 'Appearance',
            icon: '🎨',
            render: () => this.renderAppearanceSection(),
            onMount: (el) => this.bindAppearanceEvents(el)
        });

        // Layout section
        this.settingsPanel.registerSection('layout', {
            title: 'Layout',
            icon: '📐',
            render: () => this.renderLayoutSection(),
            onMount: (el) => this.bindLayoutEvents(el)
        });

        // Profiles section
        this.settingsPanel.registerSection('profiles', {
            title: 'Profiles',
            icon: '💾',
            render: () => this.renderProfilesSection(),
            onMount: (el) => this.bindProfileEvents(el)
        });
    }

    /**
     * Render appearance settings
     */
    renderAppearanceSection() {
        const themeOptions = Object.entries(this.themes).map(([id, theme]) => `
            <button class="theme-btn ${this.currentTheme === id ? 'active' : ''}" data-theme="${id}">
                <span class="theme-preview" style="background: ${theme.bg}; border: 2px solid ${theme.accent}"></span>
                <span class="theme-name">${theme.name}</span>
            </button>
        `).join('');

        return `
            <div class="customizer-section">
                <label class="section-label">Theme</label>
                <div class="theme-grid">${themeOptions}</div>
            </div>
            <div class="customizer-section">
                <label class="section-label">Accent Color</label>
                <div class="color-picker-row">
                    <input type="color" id="accent-color" value="${this.customColors.accent || this.themes[this.currentTheme].accent}">
                    <button class="btn-small" id="reset-accent">Reset</button>
                </div>
            </div>
            <div class="customizer-section">
                <label class="section-label">Transparency</label>
                <div class="slider-row">
                    <input type="range" id="bg-opacity" min="50" max="100" value="${this.load('bgOpacity') || 100}">
                    <span class="slider-value">${this.load('bgOpacity') || 100}%</span>
                </div>
            </div>
        `;
    }

    /**
     * Render layout settings
     */
    renderLayoutSection() {
        const layoutIcons = {
            mini: '🔹', compact: '🔸', normal: '⬜', comfortable: '🔷',
            large: '🔶', touch: '👆', tablet: '📱', kiosk: '🖥️'
        };
        const layoutOptions = Object.entries(this.layouts).map(([id, layout]) => `
            <button class="layout-btn ${this.currentLayout === id ? 'active' : ''}" data-layout="${id}">
                <span class="layout-icon">${layoutIcons[id] || '⬜'}</span>
                <span class="layout-name">${layout.name}</span>
                <span class="layout-scale">${Math.round(layout.scale * 100)}%</span>
            </button>
        `).join('');

        return `
            <div class="customizer-section">
                <label class="section-label">Size Preset</label>
                <div class="layout-grid">${layoutOptions}</div>
            </div>
            <div class="customizer-section">
                <label class="section-label">Custom Scale</label>
                <div class="slider-row">
                    <input type="range" id="custom-scale" min="70" max="150" value="${Math.round((this.layouts[this.currentLayout]?.scale || 1) * 100)}">
                    <span class="slider-value">${Math.round((this.layouts[this.currentLayout]?.scale || 1) * 100)}%</span>
                </div>
            </div>
        `;
    }

    /**
     * Render profiles section
     */
    renderProfilesSection() {
        // Built-in profiles
        const builtInList = Object.entries(this.builtInProfiles).map(([name, profile]) => `
            <div class="profile-item builtin">
                <div class="profile-info">
                    <span class="profile-name">${name}</span>
                    <span class="profile-meta">${this.themes[profile.theme]?.name} / ${this.layouts[profile.layout]?.name}</span>
                </div>
                <div class="profile-actions">
                    <button class="btn-small btn-load" data-profile="${name}">Load</button>
                </div>
            </div>
        `).join('');

        // User profiles
        const userList = Object.entries(this.profiles).map(([name, profile]) => `
            <div class="profile-item user">
                <div class="profile-info">
                    <span class="profile-name">${name}</span>
                    <span class="profile-meta">${this.themes[profile.theme]?.name} / ${this.layouts[profile.layout]?.name}</span>
                </div>
                <div class="profile-actions">
                    <button class="btn-small btn-load" data-profile="${name}">Load</button>
                    <button class="btn-small btn-delete" data-profile="${name}">✕</button>
                </div>
            </div>
        `).join('') || '<p class="empty-state">No custom profiles yet</p>';

        return `
            <div class="customizer-section">
                <label class="section-label">Quick Presets</label>
                <div class="profile-list">${builtInList}</div>
            </div>
            <div class="customizer-section">
                <label class="section-label">Save Current Settings</label>
                <div class="save-profile-row">
                    <input type="text" id="profile-name" placeholder="Profile name...">
                    <button class="btn-primary" id="save-profile">Save</button>
                </div>
            </div>
            <div class="customizer-section">
                <label class="section-label">My Profiles</label>
                <div class="profile-list">${userList}</div>
            </div>
        `;
    }

    /**
     * Bind appearance events
     */
    bindAppearanceEvents(container) {
        // Theme buttons
        container.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyTheme(btn.dataset.theme);
                container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Accent color
        const accentInput = container.querySelector('#accent-color');
        if (accentInput) {
            accentInput.addEventListener('input', (e) => this.setAccentColor(e.target.value));
        }

        // Reset accent
        const resetBtn = container.querySelector('#reset-accent');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                delete this.customColors.accent;
                this.save('customColors', this.customColors);
                this.applyTheme(this.currentTheme);
                if (accentInput) accentInput.value = this.themes[this.currentTheme].accent;
            });
        }

        // Background opacity
        const opacitySlider = container.querySelector('#bg-opacity');
        const opacityValue = container.querySelector('.slider-value');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const val = e.target.value;
                this.save('bgOpacity', val);
                document.documentElement.style.setProperty('--widget-bg-opacity', val / 100);
                if (opacityValue) opacityValue.textContent = `${val}%`;
            });
        }
    }

    /**
     * Bind layout events
     */
    bindLayoutEvents(container) {
        // Layout buttons
        container.querySelectorAll('.layout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyLayout(btn.dataset.layout);
                container.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update scale slider
                const scaleSlider = container.querySelector('#custom-scale');
                const scaleValue = container.querySelectorAll('.slider-value')[0];
                if (scaleSlider) {
                    const scale = this.layouts[btn.dataset.layout].scale * 100;
                    scaleSlider.value = scale;
                    if (scaleValue) scaleValue.textContent = `${Math.round(scale)}%`;
                }
            });
        });

        // Custom scale slider
        const scaleSlider = container.querySelector('#custom-scale');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                const scale = e.target.value / 100;
                document.documentElement.style.setProperty('--widget-scale', scale);
                document.body.style.fontSize = `${16 * scale}px`;
                const valueEl = scaleSlider.parentElement.querySelector('.slider-value');
                if (valueEl) valueEl.textContent = `${e.target.value}%`;
            });
        }
    }

    /**
     * Bind profile events
     */
    bindProfileEvents(container) {
        // Save profile
        const saveBtn = container.querySelector('#save-profile');
        const nameInput = container.querySelector('#profile-name');
        if (saveBtn && nameInput) {
            saveBtn.addEventListener('click', () => {
                const name = nameInput.value.trim();
                if (name) {
                    this.saveProfile(name);
                    nameInput.value = '';
                    // Refresh the section
                    if (this.settingsPanel) {
                        this.settingsPanel.showSection('profiles');
                    }
                }
            });
        }

        // Load profile buttons
        container.querySelectorAll('.btn-load').forEach(btn => {
            btn.addEventListener('click', () => {
                this.loadProfile(btn.dataset.profile);
            });
        });

        // Delete profile buttons
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteProfile(btn.dataset.profile);
                if (this.settingsPanel) {
                    this.settingsPanel.showSection('profiles');
                }
            });
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WidgetCustomizer;
}
