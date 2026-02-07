/**
 * SimGlass Base Class v1.2.0
 * Last Updated: 2026-02-07
 *
 * Shared functionality for all SimGlass widgets.
 * Include in your widget:
 *   <link rel="stylesheet" href="/ui/shared/widget-common.css">
 *   <link rel="stylesheet" href="/ui/shared/settings-panel.css">
 *   <script src="/ui/shared/platform-utils.js"></script>
 *   <script src="/ui/shared/telemetry.js"></script>
 *   <script src="/ui/shared/settings-panel.js"></script>
 *   <script src="/ui/shared/feedback-section.js"></script>
 *   <script src="/ui/shared/widget-base.js"></script>
 */

// One-time migration from SimWidget → SimGlass localStorage keys
(function() {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('simglass_migrated')) return;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('simwidget')) {
            localStorage.setItem(key.replace('simwidget', 'simglass'), localStorage.getItem(key));
        }
    }
    localStorage.setItem('simglass_migrated', '1');
})();

class SimGlassBase {
    constructor(options = {}) {
        this.ws = null;
        this.reconnectInterval = null;
        this.serverUrl = options.serverUrl || this.detectServerUrl();
        this.statusElementId = options.statusElementId || 'conn-status';
        this.platform = PlatformUtils.getPlatform();
        
        // Widget info for telemetry
        this.widgetName = options.widgetName || 'unknown';
        this.widgetVersion = options.widgetVersion || '1.0.0';
        
        // Telemetry config
        this.telemetryConfig = options.telemetry || {};
        
        // Initialize telemetry
        this.initTelemetry();
        
        // Initialize settings panel
        this.initSettings();
        
        // Auto-connect if not disabled
        if (options.autoConnect !== false) {
            this.connect();
        }
    }
    
    /**
     * Initialize telemetry service
     */
    initTelemetry() {
        if (typeof TelemetryService === 'undefined') {
            console.warn('[SimGlass] TelemetryService not loaded');
            return;
        }
        
        this.telemetry = new TelemetryService({
            widget: this.widgetName,
            version: this.widgetVersion,
            supabaseUrl: this.telemetryConfig.supabaseUrl || window.SIMGLASS_SUPABASE_URL || '',
            supabaseKey: this.telemetryConfig.supabaseKey || window.SIMGLASS_SUPABASE_KEY || '',
            enabled: this.telemetryConfig.enabled !== false
        });
    }
    
    /**
     * Initialize settings panel with default sections
     */
    initSettings() {
        if (typeof SettingsPanel === 'undefined') {
            console.warn('[SimGlass] SettingsPanel not loaded');
            return;
        }
        
        this.settings = new SettingsPanel();
        
        // Register feedback section
        if (typeof FeedbackSection !== 'undefined' && this.telemetry) {
            const feedbackSection = new FeedbackSection(this.telemetry);
            this.settings.registerSection('feedback', feedbackSection.getConfig());
        }
        
        // Register about section
        this.settings.registerSection('about', {
            title: 'About',
            icon: 'ℹ️',
            render: () => this.renderAboutSection()
        });
        
        // Bind settings button
        this.bindSettingsButton();
    }
    
    /**
     * Bind settings cog button
     */
    bindSettingsButton() {
        const btn = document.getElementById('settings-btn');
        if (btn && this.settings) {
            btn.addEventListener('click', () => this.settings.toggle());
        }
    }
    
    /**
     * Render about section
     */
    renderAboutSection() {
        const stats = this.telemetry ? this.telemetry.getStats() : { uniqueErrors: 0, totalErrors: 0 };
        return `
            <div class="about-section">
                <div class="about-row">
                    <span class="about-label">Widget</span>
                    <span class="about-value">${this.widgetName}</span>
                </div>
                <div class="about-row">
                    <span class="about-label">Version</span>
                    <span class="about-value">${this.widgetVersion}</span>
                </div>
                <div class="about-row">
                    <span class="about-label">Platform</span>
                    <span class="about-value">${this.platform}</span>
                </div>
                <div class="about-row">
                    <span class="about-label">Session Errors</span>
                    <span class="about-value">${stats.uniqueErrors} unique / ${stats.totalErrors} total</span>
                </div>
                <div class="about-footer">
                    <p>SimGlass Engine © 2025</p>
                    <p><a href="https://github.com/simglass" target="_blank">GitHub</a></p>
                </div>
            </div>
        `;
    }
    
    /**
     * Detect server URL based on current location
     */
    detectServerUrl() {
        // Use location.host for remote access, 127.0.0.1 for local
        const host = location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'ws://127.0.0.1:8080';
        }
        return `ws://${location.host}`;
    }
    
    /**
     * Apply platform-specific visibility (delegates to PlatformUtils)
     */
    applyPlatformVisibility() {
        PlatformUtils.applyPlatformVisibility();
    }
    
    /**
     * Connect to WebSocket server
     */
    connect() {
        this.updateConnectionStatus('connecting');
        
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('[SimGlass] Connected to server');
                this.updateConnectionStatus('connected');
                this.clearReconnectInterval();
                this.onConnect();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.onMessage(data);
                } catch (e) {
                    console.error('[SimGlass] Parse error:', e);
                }
            };
            
            this.ws.onclose = () => {
                console.log('[SimGlass] Disconnected');
                this.updateConnectionStatus('disconnected');
                this.scheduleReconnect();
                this.onDisconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('[SimGlass] WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
            };
            
        } catch (e) {
            console.error('[SimGlass] Connection failed:', e);
            this.updateConnectionStatus('disconnected');
            this.scheduleReconnect();
        }
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                console.log('[SimGlass] Reconnecting...');
                this.connect();
            }, 3000);
        }
    }
    
    /**
     * Clear reconnection interval
     */
    clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }
    
    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status) {
        const el = document.getElementById(this.statusElementId);
        if (!el) return;
        
        el.classList.remove('connected', 'disconnected', 'connecting');
        
        switch (status) {
            case 'connected':
                el.classList.add('connected');
                el.title = 'Connected to MSFS';
                break;
            case 'connecting':
                el.classList.add('connecting');
                el.title = 'Connecting...';
                break;
            case 'mock':
                el.title = 'Mock Mode (no MSFS)';
                break;
            default:
                el.title = 'Disconnected';
        }
    }
    
    /**
     * Send command to server
     */
    sendCommand(command, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', command, value }));
        }
    }
    
    /**
     * Send categorized command
     */
    sendCategoryCommand(category, action, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', category, action, ...data }));
        }
    }

    /**
     * Cleanup WebSocket and reconnect timer
     */
    destroy() {
        this.clearReconnectInterval();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }
    }

    // Override these in subclass
    onConnect() {}
    onDisconnect() {}
    onMessage(data) {}
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimGlassBase;
}
