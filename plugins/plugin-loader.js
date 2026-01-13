/**
 * SimWidget Plugin Loader v1.0.0
 * 
 * Dynamically loads plugins from the plugins/ directory
 * Each plugin must have a manifest.json defining its capabilities
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\plugins\plugin-loader.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');

class PluginLoader {
    constructor(options = {}) {
        this.pluginsDir = options.pluginsDir || path.join(__dirname);
        this.plugins = new Map();
        this.loadedPlugins = [];
        this.server = null;
        this.wss = null;
        this.app = null;
    }

    /**
     * Initialize with Express app and WebSocket server
     */
    init(app, wss, server) {
        this.app = app;
        this.wss = wss;
        this.server = server;
        return this;
    }

    /**
     * Discover all plugins in the plugins directory
     */
    discover() {
        const discovered = [];
        
        if (!fs.existsSync(this.pluginsDir)) {
            console.log('[PluginLoader] No plugins directory found');
            return discovered;
        }

        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
        
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
            
            const manifestPath = path.join(this.pluginsDir, entry.name, 'manifest.json');
            
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    manifest._path = path.join(this.pluginsDir, entry.name);
                    manifest._folder = entry.name;
                    discovered.push(manifest);
                } catch (err) {
                    console.error(`[PluginLoader] Failed to parse ${manifestPath}:`, err.message);
                }
            }
        }

        console.log(`[PluginLoader] Discovered ${discovered.length} plugins`);
        return discovered;
    }

    /**
     * Load a specific plugin by folder name
     */
    async loadPlugin(folderName) {
        const manifestPath = path.join(this.pluginsDir, folderName, 'manifest.json');
        
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Plugin manifest not found: ${folderName}`);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest._path = path.join(this.pluginsDir, folderName);
        manifest._folder = folderName;

        // Check dependencies
        if (manifest.dependencies) {
            for (const dep of manifest.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Missing dependency: ${dep} (required by ${manifest.name})`);
                }
            }
        }

        // Load the plugin module
        const entryPoint = manifest.entry || 'index.js';
        const pluginPath = path.join(manifest._path, entryPoint);
        
        if (!fs.existsSync(pluginPath)) {
            throw new Error(`Plugin entry point not found: ${pluginPath}`);
        }

        const PluginClass = require(pluginPath);
        const plugin = typeof PluginClass === 'function' 
            ? new PluginClass(manifest, this)
            : PluginClass;

        // Initialize plugin with server context
        if (plugin.init) {
            await plugin.init({
                app: this.app,
                wss: this.wss,
                server: this.server,
                manifest,
                pluginLoader: this
            });
        }

        // Register routes if plugin has them
        if (plugin.registerRoutes && this.app) {
            plugin.registerRoutes(this.app);
        }

        // Register WebSocket handlers
        if (plugin.registerWebSocket && this.wss) {
            plugin.registerWebSocket(this.wss);
        }

        this.plugins.set(manifest.id, { manifest, instance: plugin });
        this.loadedPlugins.push(manifest.id);
        
        console.log(`[PluginLoader] Loaded: ${manifest.name} v${manifest.version}`);
        return plugin;
    }

    /**
     * Load all enabled plugins
     */
    async loadAll(enabledList = null) {
        const discovered = this.discover();
        
        // Sort by priority (lower = first)
        discovered.sort((a, b) => (a.priority || 100) - (b.priority || 100));

        for (const manifest of discovered) {
            // Skip if not in enabled list (when provided)
            if (enabledList && !enabledList.includes(manifest.id)) {
                console.log(`[PluginLoader] Skipped (disabled): ${manifest.name}`);
                continue;
            }

            // Skip if explicitly disabled in manifest
            if (manifest.enabled === false) {
                console.log(`[PluginLoader] Skipped (manifest disabled): ${manifest.name}`);
                continue;
            }

            try {
                await this.loadPlugin(manifest._folder);
            } catch (err) {
                console.error(`[PluginLoader] Failed to load ${manifest.name}:`, err.message);
            }
        }

        return this.loadedPlugins;
    }

    /**
     * Get a loaded plugin by ID
     */
    getPlugin(id) {
        return this.plugins.get(id)?.instance;
    }

    /**
     * Get plugin manifest by ID
     */
    getManifest(id) {
        return this.plugins.get(id)?.manifest;
    }

    /**
     * List all loaded plugins
     */
    list() {
        return Array.from(this.plugins.values()).map(p => ({
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            description: p.manifest.description
        }));
    }

    /**
     * Broadcast event to all plugins
     */
    broadcast(event, data) {
        for (const [id, { instance }] of this.plugins) {
            if (instance.onEvent) {
                try {
                    instance.onEvent(event, data);
                } catch (err) {
                    console.error(`[PluginLoader] Event error in ${id}:`, err.message);
                }
            }
        }
    }

    /**
     * Shutdown all plugins
     */
    async shutdown() {
        for (const [id, { instance }] of this.plugins) {
            if (instance.shutdown) {
                try {
                    await instance.shutdown();
                    console.log(`[PluginLoader] Shutdown: ${id}`);
                } catch (err) {
                    console.error(`[PluginLoader] Shutdown error in ${id}:`, err.message);
                }
            }
        }
        this.plugins.clear();
        this.loadedPlugins = [];
    }
}

module.exports = PluginLoader;
