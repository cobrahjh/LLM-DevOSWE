/**
 * SimWidget Settings Panel v1.0.0
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
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsPanel;
}
