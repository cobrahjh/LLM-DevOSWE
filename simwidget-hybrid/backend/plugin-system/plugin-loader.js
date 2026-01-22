/**
 * SimWidget Plugin System
 * Loads and manages third-party widgets
 */

const fs = require('fs');
const path = require('path');

class PluginLoader {
    constructor(pluginsDir) {
        this.pluginsDir = pluginsDir;
        this.plugins = new Map();
        this.activePlugins = new Set();
    }

    /**
     * Discover all plugins in the plugins directory
     */
    discover() {
        const discovered = [];

        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
            return discovered;
        }

        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginPath = path.join(this.pluginsDir, entry.name);
            const manifestPath = path.join(pluginPath, 'plugin.json');

            if (!fs.existsSync(manifestPath)) {
                console.log(`[Plugins] Skipping ${entry.name} - no plugin.json`);
                continue;
            }

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const plugin = {
                    id: manifest.id || entry.name,
                    name: manifest.name || entry.name,
                    version: manifest.version || '1.0.0',
                    description: manifest.description || '',
                    author: manifest.author || 'Unknown',
                    entry: manifest.entry || 'index.html',
                    icon: manifest.icon || null,
                    category: manifest.category || 'general',
                    commands: manifest.commands || [],
                    settings: manifest.settings || [],
                    path: pluginPath,
                    enabled: false
                };

                this.plugins.set(plugin.id, plugin);
                discovered.push(plugin);
                console.log(`[Plugins] Discovered: ${plugin.name} v${plugin.version}`);

            } catch (err) {
                console.error(`[Plugins] Error loading ${entry.name}:`, err.message);
            }
        }

        return discovered;
    }

    /**
     * Get all discovered plugins
     */
    getAll() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get a specific plugin by ID
     */
    get(pluginId) {
        return this.plugins.get(pluginId);
    }

    /**
     * Enable a plugin
     */
    enable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        plugin.enabled = true;
        this.activePlugins.add(pluginId);
        console.log(`[Plugins] Enabled: ${plugin.name}`);
        return true;
    }

    /**
     * Disable a plugin
     */
    disable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        plugin.enabled = false;
        this.activePlugins.delete(pluginId);
        console.log(`[Plugins] Disabled: ${plugin.name}`);
        return true;
    }

    /**
     * Get active plugins
     */
    getActive() {
        return Array.from(this.plugins.values()).filter(p => p.enabled);
    }

    /**
     * Get plugin entry URL
     */
    getEntryUrl(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return null;
        return `/plugins/${pluginId}/${plugin.entry}`;
    }

    /**
     * Load enabled plugins from config
     */
    loadConfig(configPath) {
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.enabledPlugins) {
                    for (const pluginId of config.enabledPlugins) {
                        this.enable(pluginId);
                    }
                }
            }
        } catch (err) {
            console.error('[Plugins] Error loading config:', err.message);
        }
    }

    /**
     * Save enabled plugins to config
     */
    saveConfig(configPath) {
        try {
            const config = {
                enabledPlugins: Array.from(this.activePlugins)
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (err) {
            console.error('[Plugins] Error saving config:', err.message);
        }
    }
}

module.exports = PluginLoader;
