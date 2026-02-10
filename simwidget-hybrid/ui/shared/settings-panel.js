/**
 * SimGlass Settings Panel v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Modular settings panel with pluggable sections.
 * Include: <script src="/ui/shared/settings-panel.js"></script>
 */

class SettingsPanel {
    constructor(options = {}) {
        this.containerId = options.containerId || 'settings-panel';
        this.sections = new Map();
        this.isOpen = false;
        this.onClose = options.onClose || (() => {});
        
        this.init();
    }
    
    init() {
        // Create panel container if not exists
        if (!document.getElementById(this.containerId)) {
            this.createPanel();
        }
        this.panel = document.getElementById(this.containerId);
        this.sectionsContainer = this.panel.querySelector('.settings-sections');
        
        // Close on backdrop click
        this.panel.querySelector('.settings-backdrop').addEventListener('click', () => this.close());
        this.panel.querySelector('.settings-close').addEventListener('click', () => this.close());
        
        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }
    
    createPanel() {
        const html = `
            <div id="${this.containerId}" class="settings-panel hidden">
                <div class="settings-backdrop"></div>
                <div class="settings-dialog">
                    <div class="settings-header">
                        <span class="settings-title">⚙️ Settings</span>
                        <button class="settings-close" title="Close">✕</button>
                    </div>
                    <div class="settings-nav"></div>
                    <div class="settings-sections"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    
    /**
     * Register a settings section
     * @param {string} id - Unique section ID
     * @param {object} config - { title, icon, render(), onSave() }
     */
    registerSection(id, config) {
        this.sections.set(id, config);
        this.renderNav();
    }
    
    renderNav() {
        const nav = this.panel.querySelector('.settings-nav');
        nav.innerHTML = '';
        
        this.sections.forEach((config, id) => {
            const btn = document.createElement('button');
            btn.className = 'settings-nav-btn';
            btn.dataset.section = id;
            btn.innerHTML = `<span class="nav-icon">${config.icon || '📋'}</span><span class="nav-label">${config.title}</span>`;
            btn.addEventListener('click', () => this.showSection(id));
            nav.appendChild(btn);
        });
        
        // Show first section by default
        if (this.sections.size > 0) {
            this.showSection(this.sections.keys().next().value);
        }
    }
    
    showSection(id) {
        const config = this.sections.get(id);
        if (!config) return;
        
        // Update nav active state
        this.panel.querySelectorAll('.settings-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === id);
        });
        
        // Render section content
        this.sectionsContainer.innerHTML = `
            <div class="settings-section" data-section="${id}">
                <h3 class="section-title">${config.icon || ''} ${config.title}</h3>
                <div class="section-content">${config.render()}</div>
            </div>
        `;
        
        // Call onMount if provided
        if (config.onMount) {
            config.onMount(this.sectionsContainer.querySelector('.section-content'));
        }
    }
    
    open() {
        this.panel.classList.remove('hidden');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.panel.classList.add('hidden');
        this.isOpen = false;
        document.body.style.overflow = '';
        this.onClose();
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /** Re-render a section if it's currently visible */
    rerenderSection(id) {
        const visible = this.sectionsContainer?.querySelector(`[data-section="${id}"]`);
        if (visible) this.showSection(id);
    }

    /**
     * Register theme section (call after ThemeSwitcher is loaded)
     */
    registerThemeSection() {
        if (typeof ThemeSwitcher === 'undefined') {
            console.warn('[Settings] ThemeSwitcher not loaded');
            return;
        }

        const themeSwitcher = new ThemeSwitcher();

        this.registerSection('theme', {
            title: 'Theme',
            icon: '🎨',
            render: () => {
                const themes = [
                    { id: 'default', name: 'Default', icon: '🌙', desc: 'Dark blue theme' },
                    { id: 'cockpit', name: 'Cockpit', icon: '✈️', desc: 'Green aviation instruments' },
                    { id: 'glass', name: 'Glass', icon: '💎', desc: 'Modern avionics blue' },
                    { id: 'day', name: 'Day', icon: '☀️', desc: 'Light mode' },
                    { id: 'oled', name: 'OLED', icon: '🖤', desc: 'True black for OLED screens' },
                    { id: 'sunset', name: 'Sunset', icon: '🌅', desc: 'Warm colors for night flying' },
                    { id: 'retro', name: 'Retro', icon: '📟', desc: 'Amber CRT style' },
                    { id: 'highcontrast', name: 'High Contrast', icon: '👁️', desc: 'Accessibility' }
                ];

                const currentTheme = themeSwitcher.getTheme();

                let html = '<div class="theme-grid">';
                themes.forEach(t => {
                    const isActive = t.id === currentTheme ? 'active' : '';
                    html += `
                        <button class="theme-card ${isActive}" data-theme="${t.id}" title="${t.desc}">
                            <span class="theme-card-icon">${t.icon}</span>
                            <span class="theme-card-name">${t.name}</span>
                        </button>
                    `;
                });
                html += '</div>';

                return html;
            },
            onMount: (container) => {
                container.querySelectorAll('.theme-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        themeSwitcher.setTheme(btn.dataset.theme);
                        container.querySelectorAll('.theme-card').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });
            }
        });
    }
}

// Add theme grid styles
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .theme-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 10px;
            padding: 10px 0;
        }

        .theme-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 8px;
            background: var(--widget-bg-secondary, #16213e);
            border: 2px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .theme-card:hover {
            border-color: var(--widget-accent, #667eea);
            transform: translateY(-2px);
        }

        .theme-card.active {
            border-color: var(--widget-accent, #667eea);
            background: rgba(102, 126, 234, 0.2);
        }

        .theme-card-icon {
            font-size: 24px;
            margin-bottom: 6px;
        }

        .theme-card-name {
            font-size: 11px;
            color: var(--widget-text-muted, #888);
            text-align: center;
        }

        .theme-card.active .theme-card-name {
            color: var(--widget-text, #fff);
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Widget Data Export/Import Utility
 */
class WidgetDataManager {
    static exportAll() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('SimGlass_') || key.includes('-widget-')) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    }

    static importAll(data) {
        let count = 0;
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
            count++;
        });
        return count;
    }

    static downloadBackup() {
        const data = this.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SimGlass-backup-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
        return Object.keys(data).length;
    }

    static async restoreBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const count = this.importAll(data);
                    resolve(count);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('SimGlass_') || key.includes('-widget-')) {
                keys.push(key);
            }
        }
        keys.forEach(k => localStorage.removeItem(k));
        return keys.length;
    }
}

// Register backup section in SettingsPanel
SettingsPanel.prototype.registerBackupSection = function() {
    this.registerSection('backup', {
        title: 'Backup & Restore',
        icon: '💾',
        render: () => `
            <div class="backup-section">
                <p class="backup-desc">Export or import all widget settings and data.</p>
                <div class="backup-actions">
                    <button class="backup-btn" id="btn-export-backup">📥 Export Backup</button>
                    <button class="backup-btn" id="btn-import-backup">📤 Import Backup</button>
                    <input type="file" id="backup-file-input" accept=".json" style="display:none">
                </div>
                <div class="backup-status" id="backup-status"></div>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 16px 0;">
                <button class="backup-btn danger" id="btn-clear-all">🗑️ Clear All Data</button>
            </div>
        `,
        onMount: (container) => {
            const exportBtn = container.querySelector('#btn-export-backup');
            const importBtn = container.querySelector('#btn-import-backup');
            const fileInput = container.querySelector('#backup-file-input');
            const clearBtn = container.querySelector('#btn-clear-all');
            const status = container.querySelector('#backup-status');

            exportBtn.addEventListener('click', () => {
                const count = WidgetDataManager.downloadBackup();
                status.textContent = 'Exported ' + count + ' settings';
                status.style.color = '#22c55e';
            });

            importBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    try {
                        const count = await WidgetDataManager.restoreBackup(e.target.files[0]);
                        status.textContent = 'Restored ' + count + ' settings. Refresh to apply.';
                        status.style.color = '#22c55e';
                    } catch (err) {
                        status.textContent = 'Error: Invalid backup file';
                        status.style.color = '#ef4444';
                    }
                }
            });

            clearBtn.addEventListener('click', () => {
                if (confirm('Clear ALL widget data? This cannot be undone.')) {
                    const count = WidgetDataManager.clearAll();
                    status.textContent = 'Cleared ' + count + ' settings';
                    status.style.color = '#f97316';
                }
            });
        }
    });
};

// Add backup section styles
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .backup-section { padding: 10px 0; }
        .backup-desc { font-size: 12px; color: var(--widget-text-muted, #888); margin-bottom: 16px; }
        .backup-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .backup-btn {
            padding: 10px 16px;
            background: var(--widget-bg-secondary, #16213e);
            border: 1px solid var(--widget-border, rgba(255,255,255,0.1));
            border-radius: 6px;
            color: var(--widget-text, #fff);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .backup-btn:hover { border-color: var(--widget-accent, #667eea); }
        .backup-btn.danger { border-color: #ef4444; color: #ef4444; }
        .backup-btn.danger:hover { background: rgba(239, 68, 68, 0.2); }
        .backup-status { margin-top: 12px; font-size: 12px; min-height: 20px; }
    `;
    document.head.appendChild(style);
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsPanel, WidgetDataManager };
}
