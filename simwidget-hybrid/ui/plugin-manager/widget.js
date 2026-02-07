/**
 * Plugin Manager Widget
 * Manages SimWidget plugins - discover, enable, disable, filter
 */

const API_BASE = `http://${window.location.host}`;

let plugins = [];
let filteredPlugins = [];
let searchTerm = '';
let categoryFilter = 'all';

async function loadPlugins() {
    const grid = document.getElementById('pluginGrid');
    const empty = document.getElementById('emptyState');
    const loading = document.getElementById('loadingState');
    const countEl = document.getElementById('pluginCount');
    const statusEl = document.getElementById('statusText');
    const lastScanEl = document.getElementById('lastScan');

    if (loading) loading.style.display = 'block';
    grid.style.display = 'none';
    empty.classList.remove('visible');

    try {
        const res = await fetch(`${API_BASE}/api/plugins`);
        const data = await res.json();
        plugins = data.plugins || [];

        if (loading) loading.style.display = 'none';

        const enabled = plugins.filter(p => p.enabled).length;
        countEl.textContent = plugins.length + ' plugin' + (plugins.length !== 1 ? 's' : '') + ' (' + enabled + ' active)';
        statusEl.textContent = 'Connected';
        lastScanEl.textContent = 'Last scan: ' + new Date().toLocaleTimeString();

        applyFilters();

    } catch (err) {
        console.error('Failed to load plugins:', err);
        if (loading) loading.style.display = 'none';
        grid.style.display = 'flex';
        grid.replaceChildren();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'loading';
        errorDiv.textContent = 'Failed to connect to server';
        grid.appendChild(errorDiv);
        document.getElementById('statusText').textContent = 'Disconnected';
    }
}

function applyFilters() {
    const grid = document.getElementById('pluginGrid');
    const empty = document.getElementById('emptyState');

    filteredPlugins = plugins.filter(p => {
        const matchesSearch = !searchTerm ||
            p.name.toLowerCase().includes(searchTerm) ||
            (p.description || '').toLowerCase().includes(searchTerm) ||
            p.id.toLowerCase().includes(searchTerm);
        const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    grid.replaceChildren();

    if (filteredPlugins.length === 0) {
        grid.style.display = 'none';
        empty.classList.add('visible');
        if (plugins.length > 0 && (searchTerm || categoryFilter !== 'all')) {
            document.querySelector('.empty-text').textContent = 'No matching plugins';
            document.querySelector('.empty-hint').textContent = 'Try adjusting your search or filter';
        } else {
            document.querySelector('.empty-text').textContent = 'No plugins found';
            document.querySelector('.empty-hint').innerHTML = 'Add plugins to the <code>plugins/</code> folder with a <code>plugin.json</code> manifest';
        }
        return;
    }

    grid.style.display = 'flex';
    empty.classList.remove('visible');

    filteredPlugins.forEach(plugin => {
        grid.appendChild(createPluginCard(plugin));
    });
}

function createPluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'plugin-card' + (plugin.enabled ? ' enabled' : '');
    card.dataset.id = plugin.id;

    const header = document.createElement('div');
    header.className = 'plugin-header';

    const icon = document.createElement('div');
    icon.className = 'plugin-icon';
    icon.textContent = getPluginEmoji(plugin.category);

    const info = document.createElement('div');
    info.className = 'plugin-info';

    const name = document.createElement('div');
    name.className = 'plugin-name';

    const statusDot = document.createElement('span');
    statusDot.className = 'status-indicator ' + (plugin.enabled ? 'active' : 'inactive');
    name.appendChild(statusDot);
    name.appendChild(document.createTextNode(plugin.name));

    const version = document.createElement('span');
    version.className = 'plugin-version';
    version.textContent = ' v' + plugin.version;
    name.appendChild(version);

    const author = document.createElement('div');
    author.className = 'plugin-author';
    author.textContent = 'by ' + plugin.author;

    info.appendChild(name);
    info.appendChild(author);

    header.appendChild(icon);
    header.appendChild(info);

    const desc = document.createElement('div');
    desc.className = 'plugin-description';
    desc.textContent = plugin.description || 'No description';

    const footer = document.createElement('div');
    footer.className = 'plugin-footer';

    const category = document.createElement('span');
    category.className = 'plugin-category';
    category.textContent = plugin.category;

    const buttons = document.createElement('div');
    buttons.className = 'plugin-buttons';

    if (plugin.enabled && plugin.entryUrl) {
        const openBtn = document.createElement('button');
        openBtn.className = 'open-btn';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPlugin(plugin);
        });
        buttons.appendChild(openBtn);
    }

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn ' + (plugin.enabled ? 'disable' : 'enable');
    toggleBtn.textContent = plugin.enabled ? 'Disable' : 'Enable';
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlugin(plugin.id, !plugin.enabled);
    });
    buttons.appendChild(toggleBtn);

    footer.appendChild(category);
    footer.appendChild(buttons);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(footer);

    return card;
}

function getPluginEmoji(category) {
    const emojis = {
        'utility': '\uD83D\uDD27',
        'navigation': '\uD83E\uDDED',
        'display': '\uD83D\uDCCA',
        'communication': '\uD83D\uDCE1',
        'weather': '\uD83C\uDF24\uFE0F',
        'traffic': '\u2708\uFE0F',
        'general': '\uD83D\uDCE6'
    };
    return emojis[category] || '\uD83D\uDCE6';
}

async function togglePlugin(pluginId, enable) {
    const action = enable ? 'enable' : 'disable';

    try {
        const res = await fetch(`${API_BASE}/api/plugins/${pluginId}/${action}`, {
            method: 'POST'
        });

        if (res.ok) {
            loadPlugins();
        } else {
            const err = await res.json();
            console.error('Toggle failed:', err);
        }
    } catch (err) {
        console.error('Toggle error:', err);
    }
}

function openPlugin(plugin) {
    const url = API_BASE + plugin.entryUrl;
    window.open(url, '_blank', 'width=450,height=600');
}

async function refreshPlugins() {
    const btn = document.getElementById('refreshBtn');
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    try {
        await fetch(`${API_BASE}/api/plugins/refresh`, { method: 'POST' });
        await loadPlugins();
    } catch (err) {
        console.error('Refresh failed:', err);
    }

    btn.textContent = 'Refresh';
    btn.disabled = false;
}

// Event listeners
document.getElementById('refreshBtn').addEventListener('click', refreshPlugins);

document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    applyFilters();
});

document.getElementById('categoryFilter').addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    applyFilters();
});

// Initial load
loadPlugins();
