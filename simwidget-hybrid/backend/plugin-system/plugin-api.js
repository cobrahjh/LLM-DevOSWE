/**
 * SimGlass Plugin API
 * Interface for plugins to interact with the simulator
 */

class PluginAPI {
    constructor(server) {
        this.server = server;
        this.commandHandlers = new Map();
    }

    /**
     * Register plugin routes with Express
     */
    registerRoutes(app, pluginLoader) {
        // List all plugins
        app.get('/api/plugins', (req, res) => {
            const plugins = pluginLoader.getAll().map(p => ({
                id: p.id,
                name: p.name,
                version: p.version,
                description: p.description,
                author: p.author,
                category: p.category,
                icon: p.icon,
                enabled: p.enabled,
                entryUrl: pluginLoader.getEntryUrl(p.id)
            }));
            res.json({ plugins });
        });

        // Get specific plugin
        app.get('/api/plugins/:id', (req, res) => {
            const plugin = pluginLoader.get(req.params.id);
            if (!plugin) {
                return res.status(404).json({ error: 'Plugin not found' });
            }
            res.json({
                ...plugin,
                entryUrl: pluginLoader.getEntryUrl(plugin.id)
            });
        });

        // Enable plugin
        app.post('/api/plugins/:id/enable', (req, res) => {
            const success = pluginLoader.enable(req.params.id);
            if (success) {
                pluginLoader.saveConfig('./plugins-config.json');
                res.json({ success: true, message: 'Plugin enabled' });
            } else {
                res.status(404).json({ error: 'Plugin not found' });
            }
        });

        // Disable plugin
        app.post('/api/plugins/:id/disable', (req, res) => {
            const success = pluginLoader.disable(req.params.id);
            if (success) {
                pluginLoader.saveConfig('./plugins-config.json');
                res.json({ success: true, message: 'Plugin disabled' });
            } else {
                res.status(404).json({ error: 'Plugin not found' });
            }
        });

        // Get active plugins
        app.get('/api/plugins/active', (req, res) => {
            const active = pluginLoader.getActive().map(p => ({
                id: p.id,
                name: p.name,
                entryUrl: pluginLoader.getEntryUrl(p.id)
            }));
            res.json({ plugins: active });
        });

        // Refresh/rescan plugins
        app.post('/api/plugins/refresh', (req, res) => {
            const discovered = pluginLoader.discover();
            res.json({
                success: true,
                count: discovered.length,
                plugins: discovered.map(p => p.id)
            });
        });
    }

    /**
     * Register a custom command handler from a plugin
     */
    registerCommand(commandName, handler) {
        this.commandHandlers.set(commandName, handler);
        console.log(`[PluginAPI] Registered command: ${commandName}`);
    }

    /**
     * Execute a plugin command
     */
    executeCommand(commandName, params) {
        const handler = this.commandHandlers.get(commandName);
        if (handler) {
            return handler(params);
        }
        return { error: 'Command not found' };
    }
}

module.exports = PluginAPI;
