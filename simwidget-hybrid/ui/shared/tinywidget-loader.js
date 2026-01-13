/**
 * TinyWidget Loader v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Dynamically loads TinyWidgets from manifest.
 */

class TinyWidgetLoader {
    constructor(basePath = '/ui/tinywidgets') {
        this.basePath = basePath;
        this.manifest = null;
        this.widgets = new Map();
        this.categories = new Map();
    }
    
    /**
     * Load manifest and all widgets
     */
    async load() {
        try {
            // Load manifest
            const res = await fetch(`${this.basePath}/manifest.json`);
            this.manifest = await res.json();
            
            // Store categories
            for (const [id, cat] of Object.entries(this.manifest.categories)) {
                this.categories.set(id, cat);
            }
            
            // Load each widget
            for (const widgetPath of this.manifest.widgets) {
                await this.loadWidget(widgetPath);
            }
            
            console.log(`[TinyWidget] Loaded ${this.widgets.size} widgets`);
            return this.widgets;
            
        } catch (e) {
            console.error('[TinyWidget] Load failed:', e);
            return this.widgets;
        }
    }
    
    /**
     * Load a single widget
     */
    async loadWidget(widgetPath) {
        try {
            const module = await import(`${this.basePath}/${widgetPath}.js`);
            const widget = module.default;
            
            // Initialize state
            widget.state = { active: false, value: null };
            
            // Get category info
            const category = this.categories.get(widget.category);
            if (category) {
                widget.categoryInfo = category;
            }
            
            this.widgets.set(widget.id, widget);
            return widget;
            
        } catch (e) {
            console.warn(`[TinyWidget] Failed to load ${widgetPath}:`, e);
            return null;
        }
    }
    
    /**
     * Get widgets by category
     */
    getByCategory(categoryId) {
        const result = [];
        this.widgets.forEach(w => {
            if (w.category === categoryId) result.push(w);
        });
        return result;
    }
    
    /**
     * Get all categories with their widgets
     */
    getCategoriesWithWidgets() {
        const result = [];
        this.categories.forEach((cat, id) => {
            result.push({
                id,
                ...cat,
                widgets: this.getByCategory(id)
            });
        });
        return result;
    }
    
    /**
     * Execute widget action
     */
    execute(widgetId, api, flightData) {
        const widget = this.widgets.get(widgetId);
        if (!widget || !widget.action) return null;
        
        const result = widget.action(api, widget.state, flightData);
        widget.state = { ...widget.state, ...result };
        return widget.state;
    }
    
    /**
     * Update widget states from flight data
     */
    updateStates(flightData) {
        this.widgets.forEach(widget => {
            if (widget.update) {
                const result = widget.update(flightData);
                widget.state = { ...widget.state, ...result };
            }
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TinyWidgetLoader;
}
