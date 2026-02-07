/**
 * Plugin Manager Widget v2.0.0
 * Manages SimGlass plugins - discover, enable, disable, filter
 */

const API_BASE = `http://${window.location.host}`;

class PluginManagerWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'plugin-manager',
            widgetVersion: '2.0.0',
            autoConnect: false  // HTTP API for plugin management
        });

        this.plugins = [];
        this.filteredPlugins = [];
        this.searchTerm = '';
        this.categoryFilter = 'all';

        this.initElements();
        this.initEvents();
        this.loadPlugins();
    }

    initElements() {
        this.grid = document.getElementById('pluginGrid');
        this.empty = document.getElementById('emptyState');
        this.loading = document.getElementById('loadingState');
        this.countEl = document.getElementById('pluginCount');
        this.statusEl = document.getElementById('statusText');
        this.lastScanEl = document.getElementById('lastScan');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.searchInput = document.getElementById('searchInput');
        this.categoryFilter_el = document.getElementById('categoryFilter');
    }

    initEvents() {
        this.refreshBtn.addEventListener('click', () => this.refreshPlugins());

        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            this.applyFilters();
        });

        this.categoryFilter_el.addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.applyFilters();
        });
    }

    async loadPlugins() {
        if (this.loading) this.loading.style.display = 'block';
        this.grid.style.display = 'none';
        this.empty.classList.remove('visible');

        try {
            const res = await fetch(`${API_BASE}/api/plugins`);
            const data = await res.json();
            this.plugins = data.plugins || [];

            if (this.loading) this.loading.style.display = 'none';

            const enabled = this.plugins.filter(p => p.enabled).length;
            this.countEl.textContent = this.plugins.length + ' plugin' + (this.plugins.length !== 1 ? 's' : '') + ' (' + enabled + ' active)';
            this.statusEl.textContent = 'Connected';
            this.lastScanEl.textContent = 'Last scan: ' + new Date().toLocaleTimeString();

            this.applyFilters();

        } catch (err) {
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'loadPlugins',
                    widget: 'plugin-manager'
                });
            }
            if (this.loading) this.loading.style.display = 'none';
            this.grid.style.display = 'flex';
            this.grid.replaceChildren();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'loading';
            errorDiv.textContent = 'Failed to connect to server';
            this.grid.appendChild(errorDiv);
            this.statusEl.textContent = 'Disconnected';
        }
    }

    applyFilters() {
        this.filteredPlugins = this.plugins.filter(p => {
            const matchesSearch = !this.searchTerm ||
                p.name.toLowerCase().includes(this.searchTerm) ||
                (p.description || '').toLowerCase().includes(this.searchTerm) ||
                p.id.toLowerCase().includes(this.searchTerm);
            const matchesCategory = this.categoryFilter === 'all' || p.category === this.categoryFilter;
            return matchesSearch && matchesCategory;
        });

        this.grid.replaceChildren();

        if (this.filteredPlugins.length === 0) {
            this.grid.style.display = 'none';
            this.empty.classList.add('visible');
            if (this.plugins.length > 0 && (this.searchTerm || this.categoryFilter !== 'all')) {
                document.querySelector('.empty-text').textContent = 'No matching plugins';
                document.querySelector('.empty-hint').textContent = 'Try adjusting your search or filter';
            } else {
                document.querySelector('.empty-text').textContent = 'No plugins found';
                document.querySelector('.empty-hint').innerHTML = 'Add plugins to the <code>plugins/</code> folder with a <code>plugin.json</code> manifest';
            }
            return;
        }

        this.grid.style.display = 'flex';
        this.empty.classList.remove('visible');

        this.filteredPlugins.forEach(plugin => {
            const card = document.createElement('div');
            card.className = 'plugin-card' + (plugin.enabled ? ' enabled' : '');

            const header = document.createElement('div');
            header.className = 'plugin-header';

            const info = document.createElement('div');
            info.className = 'plugin-info';

            const title = document.createElement('div');
            title.className = 'plugin-title';
            title.textContent = plugin.name;
            info.appendChild(title);

            if (plugin.version) {
                const version = document.createElement('div');
                version.className = 'plugin-version';
                version.textContent = 'v' + plugin.version;
                info.appendChild(version);
            }

            header.appendChild(info);

            const toggle = document.createElement('button');
            toggle.className = 'toggle-btn' + (plugin.enabled ? ' enabled' : '');
            toggle.title = plugin.enabled ? 'Disable' : 'Enable';
            toggle.addEventListener('click', () => this.togglePlugin(plugin.id));

            const toggleIcon = document.createElement('div');
            toggleIcon.className = 'toggle-icon';
            toggle.appendChild(toggleIcon);
            header.appendChild(toggle);

            card.appendChild(header);

            if (plugin.description) {
                const desc = document.createElement('div');
                desc.className = 'plugin-description';
                desc.textContent = plugin.description;
                card.appendChild(desc);
            }

            const footer = document.createElement('div');
            footer.className = 'plugin-footer';

            if (plugin.author) {
                const author = document.createElement('div');
                author.className = 'plugin-author';
                author.textContent = 'by ' + plugin.author;
                footer.appendChild(author);
            }

            const category = document.createElement('span');
            category.className = 'plugin-category';
            category.textContent = plugin.category || 'General';
            footer.appendChild(category);

            card.appendChild(footer);
            this.grid.appendChild(card);
        });
    }

    async togglePlugin(id) {
        try {
            const res = await fetch(`${API_BASE}/api/plugins/${id}/toggle`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                await this.loadPlugins();
            } else {
                console.error('Toggle failed:', data.error);
            }
        } catch (err) {
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'togglePlugin',
                    widget: 'plugin-manager',
                    pluginId: id
                });
            }
        }
    }

    async refreshPlugins() {
        this.refreshBtn.textContent = 'Scanning...';
        this.refreshBtn.disabled = true;

        try {
            await fetch(`${API_BASE}/api/plugins/refresh`, { method: 'POST' });
            await this.loadPlugins();
        } catch (err) {
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'refreshPlugins',
                    widget: 'plugin-manager'
                });
            }
        }

        this.refreshBtn.textContent = 'Refresh';
        this.refreshBtn.disabled = false;
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.pluginManager = new PluginManagerWidget();
    window.addEventListener('beforeunload', () => window.pluginManager?.destroy());
});
