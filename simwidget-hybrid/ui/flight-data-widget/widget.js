/**
 * SimGlass Flight Data Widget v2.0.0
 * Last Updated: 2026-02-07
 *
 * Displays real-time flight data from MSFS via SimGlass WebSocket
 *
 * Changelog:
 * v2.0.0 - Migrated to SimGlassBase for standardized WebSocket handling
 * v1.0.0 - Initial port from Flow Pro
 */

class FlightDataWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-data-widget',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        // Widget ID for storage
        this.WIDGET_ID = 'flight-data-widget';

        // State
        this.isMinimized = false;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeDirection = '';
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

        this.initElements();
        this.loadWidgetState();
        this.initEventHandlers();
    }

    initElements() {
        this.widget = document.getElementById('widget');
        this.header = document.getElementById('header');
        this.content = document.getElementById('content');
        this.minimizeBtn = document.getElementById('minimizeBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.statusIndicator = document.querySelector('.status-indicator');

        // Data display elements
        this.altitudeEl = document.getElementById('altitude');
        this.headingEl = document.getElementById('heading');
        this.iasEl = document.getElementById('ias');
        this.groundspeedEl = document.getElementById('groundspeed');
        this.vspeedEl = document.getElementById('vspeed');
        this.windEl = document.getElementById('wind');
        this.latitudeEl = document.getElementById('latitude');
        this.longitudeEl = document.getElementById('longitude');
    }

    initEventHandlers() {
        // Drag functionality
        this.header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.control-btn')) return;
            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.widget.offsetLeft;
            this.dragOffset.y = e.clientY - this.widget.offsetTop;
            document.body.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const x = e.clientX - this.dragOffset.x;
                const y = e.clientY - this.dragOffset.y;

                this.widget.style.position = 'absolute';
                this.widget.style.left = `${Math.max(0, x)}px`;
                this.widget.style.top = `${Math.max(0, y)}px`;
            }

            if (this.isResizing) {
                const deltaX = e.clientX - this.resizeStart.x;
                const deltaY = e.clientY - this.resizeStart.y;

                if (this.resizeDirection.includes('e')) {
                    this.widget.style.width = `${Math.max(200, this.resizeStart.width + deltaX)}px`;
                }
                if (this.resizeDirection.includes('s')) {
                    this.widget.style.height = `${Math.max(150, this.resizeStart.height + deltaY)}px`;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging || this.isResizing) {
                this.saveWidgetState();
            }
            this.isDragging = false;
            this.isResizing = false;
            this.resizeDirection = '';
            document.body.style.cursor = 'default';
        });

        // Resize handlers
        document.getElementById('resizeSE')?.addEventListener('mousedown', (e) => this.initResize('se', e));
        document.getElementById('resizeE')?.addEventListener('mousedown', (e) => this.initResize('e', e));
        document.getElementById('resizeS')?.addEventListener('mousedown', (e) => this.initResize('s', e));

        // Control buttons
        this.minimizeBtn.addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;
            this.content.classList.toggle('minimized', this.isMinimized);
            this.saveWidgetState();
        });

        this.settingsBtn.addEventListener('click', () => {
            console.log('[FlightData] Settings clicked');
        });

        this.closeBtn.addEventListener('click', () => {
            this.widget.style.display = 'none';
            this.destroy();
        });
    }

    initResize(direction, e) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeDirection = direction;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.widget.offsetWidth,
            height: this.widget.offsetHeight
        };
    }

    // SimGlassBase lifecycle hook
    onMessage(data) {
        if (data.type === 'flightData' && data.data) {
            this.handleFlightData(data.data);
        } else if (data.altitude !== undefined) {
            // Direct sim data
            this.handleFlightData(data);
        }
    }

    // SimGlassBase lifecycle hook
    onConnect() {
        console.log('[FlightData] Connected to SimGlass server');
        this.updateConnectionStatus(true);
    }

    // SimGlassBase lifecycle hook
    onDisconnect() {
        console.log('[FlightData] Disconnected from SimGlass server');
        this.updateConnectionStatus(false);
    }

    updateConnectionStatus(connected) {
        if (this.statusIndicator) {
            this.statusIndicator.style.background = connected ? '#00ff88' : '#ff4444';
            this.statusIndicator.style.boxShadow = connected
                ? '0 0 10px rgba(0, 255, 136, 0.6)'
                : '0 0 10px rgba(255, 68, 68, 0.6)';
        }
    }

    handleFlightData(data) {
        // Map SimGlass data to our display format
        this.updateFlightData({
            altitude: data.altitude,
            heading: data.heading,
            ias: data.speed,  // SimGlass sends 'speed' as IAS
            groundspeed: data.groundSpeed || data.speed * 1.1,  // Estimate if not available
            vspeed: data.verticalSpeed,
            windDirection: data.windDirection,
            windSpeed: data.windSpeed,
            latitude: data.latitude,
            longitude: data.longitude
        });
    }

    formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '---';
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    updateFlightData(data) {
        // Altitude
        if (data.altitude !== undefined) {
            this.altitudeEl.textContent = this.formatNumber(Math.round(data.altitude));
        }

        // Heading
        if (data.heading !== undefined) {
            this.headingEl.textContent = this.formatNumber(Math.round(data.heading)).padStart(3, '0');
        }

        // Indicated Airspeed
        if (data.ias !== undefined) {
            this.iasEl.textContent = this.formatNumber(Math.round(data.ias));
        }

        // Ground Speed
        if (data.groundspeed !== undefined) {
            this.groundspeedEl.textContent = this.formatNumber(Math.round(data.groundspeed));
        }

        // Vertical Speed
        if (data.vspeed !== undefined) {
            const vs = Math.round(data.vspeed);
            this.vspeedEl.textContent = (vs >= 0 ? '+' : '') + this.formatNumber(vs);
            this.vspeedEl.style.color = vs > 100 ? '#00ff88' : vs < -100 ? '#ff4444' : '#ffffff';
        }

        // Wind
        if (data.windDirection !== undefined && data.windSpeed !== undefined) {
            const dir = Math.round(data.windDirection).toString().padStart(3, '0');
            const spd = Math.round(data.windSpeed);
            this.windEl.textContent = `${dir}° / ${spd} kts`;
        }

        // GPS Coordinates
        if (data.latitude !== undefined && this.latitudeEl) {
            const lat = data.latitude;
            const latDir = lat >= 0 ? 'N' : 'S';
            this.latitudeEl.textContent = `${Math.abs(lat).toFixed(4)}° ${latDir}`;
        }
        if (data.longitude !== undefined && this.longitudeEl) {
            const lon = data.longitude;
            const lonDir = lon >= 0 ? 'E' : 'W';
            this.longitudeEl.textContent = `${Math.abs(lon).toFixed(4)}° ${lonDir}`;
        }
    }

    saveWidgetState() {
        const state = {
            left: this.widget.offsetLeft,
            top: this.widget.offsetTop,
            width: this.widget.offsetWidth,
            height: this.widget.offsetHeight,
            minimized: this.isMinimized
        };
        localStorage.setItem(`SimGlass_${this.WIDGET_ID}`, JSON.stringify(state));
    }

    loadWidgetState() {
        const saved = localStorage.getItem(`SimGlass_${this.WIDGET_ID}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.widget.style.position = 'absolute';
                this.widget.style.left = `${state.left}px`;
                this.widget.style.top = `${state.top}px`;
                this.widget.style.width = `${state.width}px`;
                this.widget.style.height = `${state.height}px`;
                if (state.minimized) {
                    this.isMinimized = true;
                    this.content.classList.add('minimized');
                }
                console.log('[FlightData] Restored widget state');
            } catch (e) {
                console.warn('[FlightData] Could not restore state:', e);
            }
        }
    }

    destroy() {
        this._destroyed = true;
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[FlightData] Widget initializing...');
    window.flightDataWidget = new FlightDataWidget();
    window.addEventListener('beforeunload', () => window.flightDataWidget?.destroy());
});
