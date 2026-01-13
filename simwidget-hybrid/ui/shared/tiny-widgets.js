/**
 * SimWidget TinyWidgets v1.0.0
 * Last Updated: 2025-01-08
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\shared\tiny-widgets.js
 * 
 * Single-function widgets for dynamic wheel UI.
 */

class TinyWidget {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.icon = config.icon || '⚡';
        this.category = config.category;
        this.action = config.action;
        this.state = config.state || null;
        this.tooltip = config.tooltip || config.name;
        this.enabled = true;
        this.currentValue = null;
    }

    async execute(wsClient) {
        if (!this.enabled) return { success: false, reason: 'disabled' };
        
        try {
            switch (this.action.type) {
                case 'simvar':
                    wsClient.send(JSON.stringify({
                        type: 'event',
                        event: this.action.event,
                        value: this.action.value ?? 1
                    }));
                    break;
                case 'lvar':
                    wsClient.send(JSON.stringify({
                        type: 'lvar',
                        name: this.action.lvar,
                        value: this.action.value
                    }));
                    break;
                case 'keyboard':
                    wsClient.send(JSON.stringify({
                        type: 'keyboard',
                        keys: this.action.keys
                    }));
                    break;
                case 'custom':
                    if (typeof this.action.handler === 'function') {
                        await this.action.handler(wsClient);
                    }
                    break;
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    updateState(value) {
        this.currentValue = value;
    }

    isActive() {
        if (!this.state) return null;
        return !!this.currentValue;
    }
}

class TinyWidgetRegistry {
    constructor() {
        this.widgets = new Map();
        this.categories = new Map();
        this.loadBuiltinWidgets();
    }

    register(widget) {
        const tw = widget instanceof TinyWidget ? widget : new TinyWidget(widget);
        this.widgets.set(tw.id, tw);
        
        if (!this.categories.has(tw.category)) {
            this.categories.set(tw.category, []);
        }
        this.categories.get(tw.category).push(tw.id);
        
        return tw;
    }

    get(id) {
        return this.widgets.get(id);
    }

    getByCategory(category) {
        const ids = this.categories.get(category) || [];
        return ids.map(id => this.widgets.get(id));
    }

    getAllCategories() {
        return Array.from(this.categories.keys());
    }

    loadBuiltinWidgets() {
        // ═══════════════════════════════════════════════════════════
        // LIGHTS CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'lights-nav',
            name: 'Nav Lights',
            icon: '🔴',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_NAV_LIGHTS' },
            state: { var: 'A:LIGHT NAV', unit: 'Bool' }
        });

        this.register({
            id: 'lights-beacon',
            name: 'Beacon',
            icon: '🔶',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_BEACON_LIGHTS' },
            state: { var: 'A:LIGHT BEACON', unit: 'Bool' }
        });

        this.register({
            id: 'lights-strobe',
            name: 'Strobe',
            icon: '⚡',
            category: 'lights',
            action: { type: 'simvar', event: 'K:STROBES_TOGGLE' },
            state: { var: 'A:LIGHT STROBE', unit: 'Bool' }
        });

        this.register({
            id: 'lights-landing',
            name: 'Landing',
            icon: '💡',
            category: 'lights',
            action: { type: 'simvar', event: 'K:LANDING_LIGHTS_TOGGLE' },
            state: { var: 'A:LIGHT LANDING', unit: 'Bool' }
        });

        this.register({
            id: 'lights-taxi',
            name: 'Taxi',
            icon: '🚕',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_TAXI_LIGHTS' },
            state: { var: 'A:LIGHT TAXI', unit: 'Bool' }
        });

        this.register({
            id: 'lights-logo',
            name: 'Logo',
            icon: '🏷️',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_LOGO_LIGHTS' },
            state: { var: 'A:LIGHT LOGO', unit: 'Bool' }
        });

        this.register({
            id: 'lights-wing',
            name: 'Wing',
            icon: '✈️',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_WING_LIGHTS' },
            state: { var: 'A:LIGHT WING', unit: 'Bool' }
        });

        this.register({
            id: 'lights-cabin',
            name: 'Cabin',
            icon: '💺',
            category: 'lights',
            action: { type: 'simvar', event: 'K:TOGGLE_CABIN_LIGHTS' },
            state: { var: 'A:LIGHT CABIN', unit: 'Bool' }
        });

        this.register({
            id: 'lights-panel',
            name: 'Panel',
            icon: '📊',
            category: 'lights',
            action: { type: 'simvar', event: 'K:PANEL_LIGHTS_TOGGLE' },
            state: { var: 'A:LIGHT PANEL', unit: 'Bool' }
        });

        this.register({
            id: 'lights-all-on',
            name: 'All On',
            icon: '☀️',
            category: 'lights',
            action: { type: 'simvar', event: 'K:ALL_LIGHTS_ON' }
        });

        this.register({
            id: 'lights-all-off',
            name: 'All Off',
            icon: '🌙',
            category: 'lights',
            action: { type: 'simvar', event: 'K:ALL_LIGHTS_OFF' }
        });

        // ═══════════════════════════════════════════════════════════
        // CAMERAS CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'camera-cinematic-toggle',
            name: 'Cinematic',
            icon: '🎬',
            category: 'cameras',
            action: { type: 'keyboard', keys: 'Alt+Z' }
        });

        this.register({
            id: 'camera-next-cinematic',
            name: 'Next View',
            icon: '⏭️',
            category: 'cameras',
            action: { type: 'keyboard', keys: 'Alt+X' }
        });

        this.register({
            id: 'camera-cockpit',
            name: 'Cockpit',
            icon: '🎮',
            category: 'cameras',
            action: { type: 'simvar', event: 'K:VIEW_COCKPIT_FORWARD' }
        });

        this.register({
            id: 'camera-external',
            name: 'External',
            icon: '📷',
            category: 'cameras',
            action: { type: 'simvar', event: 'K:VIEW_EXTERNAL' }
        });

        this.register({
            id: 'camera-drone',
            name: 'Drone',
            icon: '🚁',
            category: 'cameras',
            action: { type: 'simvar', event: 'K:TOGGLE_DRONE_MODE' }
        });

        this.register({
            id: 'camera-next',
            name: 'Cycle View',
            icon: '🔄',
            category: 'cameras',
            action: { type: 'simvar', event: 'K:VIEW_MODE' }
        });

        // ═══════════════════════════════════════════════════════════
        // AUTOPILOT CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'ap-master',
            name: 'AP Master',
            icon: '🅰️',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_MASTER' },
            state: { var: 'A:AUTOPILOT MASTER', unit: 'Bool' }
        });

        this.register({
            id: 'ap-hdg',
            name: 'HDG Hold',
            icon: '🧭',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_HDG_HOLD' },
            state: { var: 'A:AUTOPILOT HEADING LOCK', unit: 'Bool' }
        });

        this.register({
            id: 'ap-alt',
            name: 'ALT Hold',
            icon: '📏',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_ALT_HOLD' },
            state: { var: 'A:AUTOPILOT ALTITUDE LOCK', unit: 'Bool' }
        });

        this.register({
            id: 'ap-nav',
            name: 'NAV',
            icon: '📍',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_NAV1_HOLD' },
            state: { var: 'A:AUTOPILOT NAV1 LOCK', unit: 'Bool' }
        });

        this.register({
            id: 'ap-apr',
            name: 'APR',
            icon: '🛬',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_APR_HOLD' },
            state: { var: 'A:AUTOPILOT APPROACH HOLD', unit: 'Bool' }
        });

        this.register({
            id: 'ap-vs',
            name: 'VS Hold',
            icon: '📈',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_VS_HOLD' },
            state: { var: 'A:AUTOPILOT VERTICAL HOLD', unit: 'Bool' }
        });

        this.register({
            id: 'ap-spd',
            name: 'SPD Hold',
            icon: '⚡',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AP_AIRSPEED_HOLD' },
            state: { var: 'A:AUTOPILOT AIRSPEED HOLD', unit: 'Bool' }
        });

        this.register({
            id: 'ap-disconnect',
            name: 'AP Off',
            icon: '❌',
            category: 'autopilot',
            action: { type: 'simvar', event: 'K:AUTOPILOT_OFF' }
        });

        // ═══════════════════════════════════════════════════════════
        // CONTROLS CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'ctrl-gear-toggle',
            name: 'Gear',
            icon: '🛞',
            category: 'controls',
            action: { type: 'simvar', event: 'K:GEAR_TOGGLE' },
            state: { var: 'A:GEAR HANDLE POSITION', unit: 'Bool' }
        });

        this.register({
            id: 'ctrl-flaps-inc',
            name: 'Flaps +',
            icon: '⬆️',
            category: 'controls',
            action: { type: 'simvar', event: 'K:FLAPS_INCR' }
        });

        this.register({
            id: 'ctrl-flaps-dec',
            name: 'Flaps -',
            icon: '⬇️',
            category: 'controls',
            action: { type: 'simvar', event: 'K:FLAPS_DECR' }
        });

        this.register({
            id: 'ctrl-spoilers',
            name: 'Spoilers',
            icon: '🛑',
            category: 'controls',
            action: { type: 'simvar', event: 'K:SPOILERS_TOGGLE' },
            state: { var: 'A:SPOILERS ARMED', unit: 'Bool' }
        });

        this.register({
            id: 'ctrl-parking-brake',
            name: 'P-Brake',
            icon: '🅿️',
            category: 'controls',
            action: { type: 'simvar', event: 'K:PARKING_BRAKES' },
            state: { var: 'A:BRAKE PARKING INDICATOR', unit: 'Bool' }
        });

        this.register({
            id: 'ctrl-pitot-heat',
            name: 'Pitot Heat',
            icon: '🔥',
            category: 'controls',
            action: { type: 'simvar', event: 'K:PITOT_HEAT_TOGGLE' },
            state: { var: 'A:PITOT HEAT', unit: 'Bool' }
        });

        // ═══════════════════════════════════════════════════════════
        // ENGINE CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'eng-start-all',
            name: 'Start All',
            icon: '🚀',
            category: 'engine',
            action: { type: 'simvar', event: 'K:SET_STARTER1_HELD' }
        });

        this.register({
            id: 'eng-mixture-rich',
            name: 'Mix Rich',
            icon: '🔴',
            category: 'engine',
            action: { type: 'simvar', event: 'K:MIXTURE_RICH' }
        });

        this.register({
            id: 'eng-mixture-lean',
            name: 'Mix Lean',
            icon: '🔵',
            category: 'engine',
            action: { type: 'simvar', event: 'K:MIXTURE_LEAN' }
        });

        this.register({
            id: 'eng-prop-high',
            name: 'Prop High',
            icon: '⏫',
            category: 'engine',
            action: { type: 'simvar', event: 'K:PROP_PITCH_HI' }
        });

        this.register({
            id: 'eng-prop-low',
            name: 'Prop Low',
            icon: '⏬',
            category: 'engine',
            action: { type: 'simvar', event: 'K:PROP_PITCH_LO' }
        });

        this.register({
            id: 'eng-carb-heat',
            name: 'Carb Heat',
            icon: '🌡️',
            category: 'engine',
            action: { type: 'simvar', event: 'K:CARB_HEAT_TOGGLE' }
        });

        // ═══════════════════════════════════════════════════════════
        // FUEL CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'fuel-pump-toggle',
            name: 'Fuel Pump',
            icon: '⛽',
            category: 'fuel',
            action: { type: 'simvar', event: 'K:TOGGLE_ELECT_FUEL_PUMP1' },
            state: { var: 'A:GENERAL ENG FUEL PUMP SWITCH:1', unit: 'Bool' }
        });

        this.register({
            id: 'fuel-selector-all',
            name: 'Fuel All',
            icon: '🔄',
            category: 'fuel',
            action: { type: 'simvar', event: 'K:FUEL_SELECTOR_ALL' }
        });

        this.register({
            id: 'fuel-selector-left',
            name: 'Fuel Left',
            icon: '⬅️',
            category: 'fuel',
            action: { type: 'simvar', event: 'K:FUEL_SELECTOR_LEFT' }
        });

        this.register({
            id: 'fuel-selector-right',
            name: 'Fuel Right',
            icon: '➡️',
            category: 'fuel',
            action: { type: 'simvar', event: 'K:FUEL_SELECTOR_RIGHT' }
        });

        // ═══════════════════════════════════════════════════════════
        // ELECTRICAL CATEGORY
        // ═══════════════════════════════════════════════════════════
        this.register({
            id: 'elec-battery',
            name: 'Battery',
            icon: '🔋',
            category: 'electrical',
            action: { type: 'simvar', event: 'K:TOGGLE_MASTER_BATTERY' },
            state: { var: 'A:ELECTRICAL MASTER BATTERY', unit: 'Bool' }
        });

        this.register({
            id: 'elec-alternator',
            name: 'Alternator',
            icon: '⚡',
            category: 'electrical',
            action: { type: 'simvar', event: 'K:TOGGLE_ALTERNATOR1' },
            state: { var: 'A:GENERAL ENG MASTER ALTERNATOR:1', unit: 'Bool' }
        });

        this.register({
            id: 'elec-avionics',
            name: 'Avionics',
            icon: '📟',
            category: 'electrical',
            action: { type: 'simvar', event: 'K:TOGGLE_AVIONICS_MASTER' },
            state: { var: 'A:AVIONICS MASTER SWITCH', unit: 'Bool' }
        });
    }
}

// ═══════════════════════════════════════════════════════════
// WHEEL UI MANAGER
// ═══════════════════════════════════════════════════════════
class WheelManager {
    constructor(registry, containerId = 'wheel-container') {
        this.registry = registry;
        this.container = document.getElementById(containerId);
        this.currentCategory = null;
        this.wsClient = null;
    }

    setWebSocket(ws) {
        this.wsClient = ws;
    }

    render(category) {
        this.currentCategory = category;
        const widgets = this.registry.getByCategory(category);
        
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        widgets.forEach((widget, index) => {
            const angle = (360 / widgets.length) * index - 90;
            const radius = 120;
            const x = Math.cos(angle * Math.PI / 180) * radius;
            const y = Math.sin(angle * Math.PI / 180) * radius;
            
            const btn = document.createElement('button');
            btn.className = 'wheel-btn' + (widget.isActive() ? ' active' : '');
            btn.title = widget.tooltip;
            btn.innerHTML = `<span class="icon">${widget.icon}</span><span class="label">${widget.name}</span>`;
            btn.style.transform = `translate(${x}px, ${y}px)`;
            btn.onclick = () => this.executeWidget(widget);
            
            this.container.appendChild(btn);
        });
    }

    async executeWidget(widget) {
        if (!this.wsClient) {
            console.error('[WheelManager] No WebSocket client');
            return;
        }
        
        const result = await widget.execute(this.wsClient);
        if (result.success) {
            console.log(`[TinyWidget] Executed: ${widget.id}`);
        } else {
            console.error(`[TinyWidget] Failed: ${widget.id}`, result.error);
        }
    }

    renderCategorySelector() {
        const categories = this.registry.getAllCategories();
        const selector = document.createElement('div');
        selector.className = 'wheel-category-selector';
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn' + (cat === this.currentCategory ? ' active' : '');
            btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            btn.onclick = () => this.render(cat);
            selector.appendChild(btn);
        });
        
        return selector;
    }
}

// Singleton instance
const tinyWidgetRegistry = new TinyWidgetRegistry();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TinyWidget, TinyWidgetRegistry, WheelManager, tinyWidgetRegistry };
}
