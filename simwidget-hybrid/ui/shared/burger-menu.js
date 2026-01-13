/**
 * Burger Menu v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Sliding navigation menu for SimWidget Engine.
 * Include: <script src="/ui/shared/burger-menu.js"></script>
 */

class BurgerMenu {
    constructor(options = {}) {
        this.containerId = options.containerId || 'burger-menu';
        this.triggerSelector = options.triggerSelector || '.burger-btn';
        this.isOpen = false;
        this.onNavigate = options.onNavigate || (() => {});
        
        this.widgets = [
            { id: 'aircraft-control', name: 'Aircraft Control', icon: '✈️', url: '/ui/aircraft-control/' },
            { id: 'camera-widget', name: 'Camera Widget', icon: '📷', url: '/ui/camera-widget/' },
            { id: 'flight-data-widget', name: 'Flight Data', icon: '📊', url: '/ui/flight-data-widget/' },
            { id: 'flight-recorder', name: 'Flight Recorder', icon: '🎬', url: '/ui/flight-recorder/' },
            { id: 'fuel-widget', name: 'Fuel Widget', icon: '⛽', url: '/ui/fuel-widget/' },
            { id: 'keymap-editor', name: 'Keymap Editor', icon: '⌨️', url: '/ui/keymap-editor/' },
            { id: 'services-panel', name: 'Services Panel', icon: '🔧', url: '/ui/services-panel/' },
            { id: 'voice-control', name: 'Voice Control', icon: '🎤', url: '/ui/voice-control/' },
            { id: 'tinywidgets', name: 'TinyWidgets', icon: '🎛️', url: '/ui/tinywidgets/' }
        ];
        
        this.init();
    }
    
    init() {
        this.createMenu();
        this.bindEvents();
    }
    
    createMenu() {
        if (document.getElementById(this.containerId)) return;
        
        const menuHTML = `
            <div id="${this.containerId}" class="burger-menu hidden">
                <div class="burger-overlay"></div>
                <div class="burger-panel">
                    <div class="burger-header">
                        <h2 class="burger-title">
                            <span class="burger-icon">🚁</span>
                            SimWidget Engine
                        </h2>
                        <button class="burger-close" title="Close Menu">✕</button>
                    </div>
                    
                    <div class="burger-content">
                        <div class="burger-section">
                            <h3 class="section-title">
                                <span class="section-icon">🎮</span>
                                Widgets
                            </h3>
                            <div class="widget-grid">
                                ${this.widgets.map(widget => `
                                    <div class="widget-card" data-widget="${widget.id}">
                                        <div class="widget-icon">${widget.icon}</div>
                                        <div class="widget-name">${widget.name}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="burger-section">
                            <h3 class="section-title">
                                <span class="section-icon">🛠️</span>
                                System
                            </h3>
                            <div class="system-menu">
                                <div class="system-item" data-action="admin">
                                    <span class="system-icon">⚙️</span>
                                    <span class="system-label">Admin Panel</span>
                                    <span class="system-arrow">→</span>
                                </div>
                                <div class="system-item" data-action="api">
                                    <span class="system-icon">🔌</span>
                                    <span class="system-label">API Explorer</span>
                                    <span class="system-arrow">→</span>
                                </div>
                                <div class="system-item" data-action="logs">
                                    <span class="system-icon">📋</span>
                                    <span class="system-label">System Logs</span>
                                    <span class="system-arrow">→</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="burger-section">
                            <h3 class="section-title">
                                <span class="section-icon">📊</span>
                                Status
                            </h3>
                            <div class="status-grid">
                                <div class="status-item">
                                    <span class="status-label">SimConnect</span>
                                    <span class="status-dot" id="status-simconnect"></span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">SimWidget Server</span>
                                    <span class="status-dot active" id="status-server"></span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Agent Service</span>
                                    <span class="status-dot" id="status-agent"></span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Remote Support</span>
                                    <span class="status-dot" id="status-remote"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="burger-footer">
                        <div class="version-info">
                            <span class="version-label">Server v1.10.0</span>
                            <span class="connection-status" id="connection-status">Connecting...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', menuHTML);
    }
    
    bindEvents() {
        const menu = document.getElementById(this.containerId);
        if (!menu) return;
        
        // Trigger buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches(this.triggerSelector) || e.target.closest(this.triggerSelector)) {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Close events
        menu.querySelector('.burger-overlay').addEventListener('click', () => this.close());
        menu.querySelector('.burger-close').addEventListener('click', () => this.close());
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
        
        // Widget navigation
        menu.querySelectorAll('.widget-card').forEach(card => {
            card.addEventListener('click', () => {
                const widgetId = card.dataset.widget;
                const widget = this.widgets.find(w => w.id === widgetId);
                if (widget) {
                    this.onNavigate(widget);
                    this.navigateToWidget(widget);
                }
            });
        });
        
        // System navigation
        menu.querySelectorAll('.system-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleSystemAction(action);
            });
        });
        
        // Start status polling
        this.startStatusPolling();
    }
    
    navigateToWidget(widget) {
        // Open widget in new window/tab
        window.open(widget.url, '_blank', 'width=800,height=600');
        this.close();
    }
    
    handleSystemAction(action) {
        switch (action) {
            case 'admin':
                window.open('/ui/admin/', '_blank', 'width=1000,height=700');
                break;
            case 'api':
                window.open('/api', '_blank');
                break;
            case 'logs':
                window.open('/ui/admin/#logs', '_blank', 'width=900,height=600');
                break;
        }
        this.close();
    }
    
    async startStatusPolling() {
        const updateStatus = async () => {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                // Update connection status
                const connectionEl = document.getElementById('connection-status');
                const simConnectEl = document.getElementById('status-simconnect');
                
                if (connectionEl) {
                    connectionEl.textContent = data.connected ? 'Connected' : 'Disconnected';
                    connectionEl.className = `connection-status ${data.connected ? 'connected' : 'disconnected'}`;
                }
                
                if (simConnectEl) {
                    simConnectEl.className = `status-dot ${data.connected ? 'active' : 'inactive'}`;
                }
                
                // Check other services
                this.checkServicePorts();
                
            } catch (e) {
                console.log('[BurgerMenu] Status check failed');
            }
        };
        
        updateStatus();
        setInterval(updateStatus, 5000);
    }
    
    async checkServicePorts() {
        const services = [
            { id: 'agent', port: 8585 },
            { id: 'remote', port: 8590 }
        ];
        
        for (const service of services) {
            try {
                const response = await fetch(`http://localhost:${service.port}/health`);
                const statusEl = document.getElementById(`status-${service.id}`);
                if (statusEl) {
                    statusEl.className = response.ok ? 'status-dot active' : 'status-dot inactive';
                }
            } catch (e) {
                const statusEl = document.getElementById(`status-${service.id}`);
                if (statusEl) {
                    statusEl.className = 'status-dot inactive';
                }
            }
        }
    }
    
    open() {
        const menu = document.getElementById(this.containerId);
        if (menu) {
            menu.classList.remove('hidden');
            this.isOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }
    
    close() {
        const menu = document.getElementById(this.containerId);
        if (menu) {
            menu.classList.add('hidden');
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    /**
     * Add burger button to existing widget headers
     */
    static addBurgerButton(selector = '.widget-header .header-controls') {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
            if (!container.querySelector('.burger-btn')) {
                const btn = document.createElement('button');
                btn.className = 'btn-icon burger-btn';
                btn.innerHTML = '☰';
                btn.title = 'Menu';
                container.insertBefore(btn, container.firstChild);
            }
        });
    }
}

// Auto-initialize if on main page
if (typeof module === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Create global burger menu instance
        window.burgerMenu = new BurgerMenu();
        
        // Add burger buttons to existing widgets
        BurgerMenu.addBurgerButton();
    });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BurgerMenu;
}