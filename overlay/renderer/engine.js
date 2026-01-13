/**
 * SimWidget Engine - Widget Runtime
 * Replaces Flow Pro's API with native implementation
 */

class SimWidgetEngine {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.simVars = {};
        this.widgets = new Map();
        this.callbacks = {
            loop_1hz: [],
            loop_5hz: [],
            exit: []
        };
        
        this.statusEl = document.getElementById('connection-status');
        this.container = document.getElementById('overlay-container');
        this.debugPanel = document.getElementById('debug-panel');
        this.debugLog = document.getElementById('debug-log');
        
        this.init();
    }
    
    // Initialize engine
    init() {
        this.log('SimWidget Engine v1.0 initializing...');
        this.connectToServer();
        this.startLoops();
        this.setupKeyBindings();
        
        // Load widgets from /widgets folder
        this.loadWidgets();
    }
    
    // Connect to SimConnect server
    connectToServer() {
        const url = window.simWidget?.serverUrl || 'ws://localhost:8484';
        this.setStatus('connecting');
        
        try {
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                this.log('Connected to server');
                this.connected = true;
                this.setStatus('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleMessage(msg);
                } catch (e) {
                    this.log('Invalid message: ' + e.message);
                }
            };
            
            this.ws.onclose = () => {
                this.log('Disconnected from server');
                this.connected = false;
                this.setStatus('disconnected');
                
                // Reconnect after delay
                setTimeout(() => this.connectToServer(), 3000);
            };
            
            this.ws.onerror = (error) => {
                this.log('WebSocket error');
                this.setStatus('disconnected');
            };
            
        } catch (e) {
            this.log('Connection failed: ' + e.message);
            this.setStatus('disconnected');
            setTimeout(() => this.connectToServer(), 3000);
        }
    }
    
    // Handle incoming messages
    handleMessage(msg) {
        switch (msg.type) {
            case 'status':
                this.connected = msg.connected;
                this.setStatus(msg.connected ? 'connected' : 'disconnected');
                if (msg.simVars) {
                    this.simVars = msg.simVars;
                }
                break;
                
            case 'simvars':
                this.simVars = msg.data;
                break;
        }
    }
    
    // Set connection status UI
    setStatus(status) {
        this.statusEl.className = status;
        this.statusEl.textContent = status === 'connected' ? '● Connected to MSFS' :
                                    status === 'connecting' ? '◌ Connecting...' :
                                    '○ Disconnected';
    }
    
    // Start update loops
    startLoops() {
        // 1Hz loop
        setInterval(() => {
            this.callbacks.loop_1hz.forEach(cb => {
                try { cb(); } catch (e) { this.log('1Hz error: ' + e.message); }
            });
        }, 1000);
        
        // 5Hz loop
        setInterval(() => {
            this.callbacks.loop_5hz.forEach(cb => {
                try { cb(); } catch (e) { this.log('5Hz error: ' + e.message); }
            });
        }, 200);
    }
    
    // Setup keyboard shortcuts
    setupKeyBindings() {
        document.addEventListener('keydown', (e) => {
            // F12 = Toggle debug panel
            if (e.key === 'F12') {
                this.debugPanel.classList.toggle('visible');
                e.preventDefault();
            }
        });
        
        // Smart click-through: enable mouse events only when over widgets
        this.setupClickThrough();
    }
    
    // Setup smart click-through
    setupClickThrough() {
        let isOverWidget = false;
        
        document.addEventListener('mousemove', (e) => {
            // Check if mouse is over a widget
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const overWidget = el && (
                el.closest('.widget-container') || 
                el.closest('#debug-panel') ||
                el.id === 'connection-status'
            );
            
            if (overWidget && !isOverWidget) {
                // Mouse entered widget - enable clicks
                isOverWidget = true;
                if (window.simWidget?.setClickThrough) {
                    window.simWidget.setClickThrough(false);
                }
            } else if (!overWidget && isOverWidget) {
                // Mouse left widget - disable clicks (pass through)
                isOverWidget = false;
                if (window.simWidget?.setClickThrough) {
                    window.simWidget.setClickThrough(true);
                }
            }
        });
        
        this.log('Smart click-through enabled');
    }
    
    // Logging
    log(msg) {
        const time = new Date().toLocaleTimeString();
        console.log(`[SimWidget] ${msg}`);
        
        if (this.debugLog) {
            this.debugLog.innerHTML += `<div>[${time}] ${msg}</div>`;
            this.debugLog.scrollTop = this.debugLog.scrollHeight;
        }
    }
    
    // ==================== FLOW PRO COMPATIBLE API ====================
    
    // Create the $api object that widgets expect
    createWidgetAPI(widget) {
        const self = this;
        
        return {
            variables: {
                // Get a simvar value
                get: (simvar, unit) => {
                    const key = simvar.startsWith('A:') ? simvar : `A:${simvar}`;
                    const data = self.simVars[key];
                    if (data) {
                        return data.value;
                    }
                    return unit === 'bool' ? false : 0;
                },
                
                // Set a simvar or send K: event
                set: (varOrEvent, type, value) => {
                    if (!self.ws || self.ws.readyState !== WebSocket.OPEN) return;
                    
                    if (varOrEvent.startsWith('K:')) {
                        // Send command event
                        self.ws.send(JSON.stringify({
                            type: 'command',
                            event: varOrEvent,
                            value: value || 0
                        }));
                    } else {
                        // Set simvar directly
                        self.ws.send(JSON.stringify({
                            type: 'set',
                            simvar: varOrEvent,
                            value: value
                        }));
                    }
                }
            },
            
            datastore: {
                // Load saved widget data
                import: () => {
                    const key = `simwidget_${widget.id}`;
                    try {
                        const data = localStorage.getItem(key);
                        return data ? JSON.parse(data) : null;
                    } catch (e) {
                        return null;
                    }
                },
                
                // Save widget data
                export: (data) => {
                    const key = `simwidget_${widget.id}`;
                    try {
                        localStorage.setItem(key, JSON.stringify(data));
                    } catch (e) {
                        self.log('Datastore save failed: ' + e.message);
                    }
                }
            }
        };
    }
    
    // ==================== WIDGET LOADING ====================
    
    // Load all widgets
    async loadWidgets() {
        // For now, load our aircraft control widget
        // In future, scan /widgets folder
        this.loadBuiltInWidgets();
    }
    
    // Load built-in widgets
    loadBuiltInWidgets() {
        // Load Aircraft Control Widget
        if (window.loadAircraftControlWidget) {
            window.loadAircraftControlWidget(this);
        } else {
            // Widget loader not ready, try again
            setTimeout(() => this.loadBuiltInWidgets(), 100);
        }
    }
    
    // Register a widget
    registerWidget(config) {
        const widget = {
            id: config.id || `widget_${Date.now()}`,
            name: config.name || 'Widget',
            html: config.html || '',
            css: config.css || '',
            init: config.init || null,
            element: null
        };
        
        // Create container
        const container = document.createElement('div');
        container.className = 'widget-container';
        container.id = widget.id;
        container.innerHTML = widget.html;
        
        // Add styles
        if (widget.css) {
            const style = document.createElement('style');
            style.textContent = widget.css;
            container.appendChild(style);
        }
        
        this.container.appendChild(container);
        widget.element = container;
        
        // Create API for widget
        const $api = this.createWidgetAPI(widget);
        
        // Initialize widget
        if (widget.init) {
            try {
                widget.init(container, $api, this);
            } catch (e) {
                this.log(`Widget init error: ${e.message}`);
            }
        }
        
        this.widgets.set(widget.id, widget);
        this.log(`Widget registered: ${widget.name}`);
        
        return widget;
    }
    
    // ==================== FLOW PRO COMPATIBLE GLOBALS ====================
}

// Create global engine instance
const engine = new SimWidgetEngine();

// Flow Pro compatible global functions
function html_created(callback) {
    // Will be called when widget HTML is ready
    window._html_created = callback;
}

function loop_1hz(callback) {
    engine.callbacks.loop_1hz.push(callback);
}

function loop_5hz(callback) {
    engine.callbacks.loop_5hz.push(callback);
}

function exit(callback) {
    engine.callbacks.exit.push(callback);
}

function info(callback) {
    // Widget info - used by Flow Pro for display
    window._info = callback;
}

function state(callback) {
    // Widget state
    window._state = callback;
}

function style(callback) {
    // Widget style
    window._style = callback;
}

function run(callback) {
    // Widget run action
    window._run = callback;
}

function search(keywords, callback) {
    // Otto search integration - we'll implement our own command system
    window._search = { keywords, callback };
}

// Export engine for widgets
window.SimWidgetEngine = engine;
