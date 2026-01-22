/**
 * Plugin Manager Widget
 * Manages SimWidget plugins - discover, enable, disable
 */

const API_BASE = 'http://localhost:8080';

let plugins = [];

async function loadPlugins() {
    const grid = document.getElementById('pluginGrid');
    const empty = document.getElementById('emptyState');

    // Clear grid safely
    grid.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/api/plugins`);
        const data = await res.json();
        plugins = data.plugins || [];

        if (plugins.length === 0) {
            grid.style.display = 'none';
            empty.classList.add('visible');
            return;
        }

        grid.style.display = 'flex';
        empty.classList.remove('visible');

        plugins.forEach(plugin => {
            const card = createPluginCard(plugin);
            grid.appendChild(card);
        });

    } catch (err) {
        console.error('Failed to load plugins:', err);
        grid.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'loading';
        errorDiv.textContent = 'Failed to connect to server';
        grid.appendChild(errorDiv);
    }
}

function createPluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'plugin-card' + (plugin.enabled ? ' enabled' : '');
    card.dataset.id = plugin.id;

    // Header with icon and info
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

    // Description
    const desc = document.createElement('div');
    desc.className = 'plugin-description';
    desc.textContent = plugin.description || 'No description';

    // Footer with category and buttons
    const footer = document.createElement('div');
    footer.className = 'plugin-footer';

    const category = document.createElement('span');
    category.className = 'plugin-category';
    category.textContent = plugin.category;

    const buttons = document.createElement('div');

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

    // Assemble card
    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(footer);

    return card;
}

function getPluginEmoji(category) {
    const emojis = {
        'utility': '🔧',
        'navigation': '🧭',
        'display': '📊',
        'communication': '📡',
        'weather': '🌤️',
        'traffic': '✈️',
        'general': '📦'
    };
    return emojis[category] || '📦';
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

// Initial load
loadPlugins();
