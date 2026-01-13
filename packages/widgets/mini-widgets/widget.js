/**
 * SimWidget Mini-Widgets Collection
 * Version: v1.0.0
 * Last updated: 2026-01-06
 * 
 * Compact floating displays for key flight data:
 * - Airspeed (IAS/TAS/Mach)
 * - Altitude (with pressure setting)
 * - Heading (magnetic/true)
 * - Vertical Speed
 * - G-Force meter
 */

class MiniWidgetsCollection {
    constructor($api) {
        this.$api = $api;
        this.widgets = new Map();
        this.updateInterval = null;
        this.config = {
            updateRate: 100, // 10Hz for smooth updates
            units: {
                speed: 'knots',    // knots, mph, kmh
                altitude: 'feet',  // feet, meters
                vspeed: 'fpm'      // fpm, mps
            }
        };
    }

    // ========== LIFECYCLE ==========
    
    html_created() {
        this.initializeWidgets();
        this.loadUserPreferences();
        this.startUpdates();
        console.log('[MiniWidgets] Initialized');
    }

    loop_1hz() {
        // Low-frequency updates (settings sync, etc.)
        this.syncPositions();
    }

    exit() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.saveUserPreferences();
        console.log('[MiniWidgets] Cleanup complete');
    }

    // ========== WIDGET DEFINITIONS ==========

    initializeWidgets() {
        // Airspeed Widget
        this.widgets.set('airspeed', {
            id: 'mini-airspeed',
            title: 'IAS',
            simvars: ['AIRSPEED INDICATED', 'AIRSPEED TRUE', 'AIRSPEED MACH'],
            format: (data) => {
                const ias = Math.round(data['AIRSPEED INDICATED'] || 0);
                const tas = Math.round(data['AIRSPEED TRUE'] || 0);
                const mach = (data['AIRSPEED MACH'] || 0).toFixed(2);
                return {
                    primary: ias,
                    unit: 'KTS',
                    secondary: `TAS ${tas} | M${mach}`
                };
            },
            color: this.getSpeedColor.bind(this),
            position: { x: 20, y: 20 }
        });

        // Altitude Widget
        this.widgets.set('altitude', {
            id: 'mini-altitude',
            title: 'ALT',
            simvars: ['INDICATED ALTITUDE', 'KOHLSMAN SETTING HG', 'PRESSURE ALTITUDE'],
            format: (data) => {
                const alt = Math.round(data['INDICATED ALTITUDE'] || 0);
                const baro = (data['KOHLSMAN SETTING HG'] || 29.92).toFixed(2);
                return {
                    primary: alt.toLocaleString(),
                    unit: 'FT',
                    secondary: `${baro} inHg`
                };
            },
            color: () => '#00ff88',
            position: { x: 20, y: 100 }
        });

        // Heading Widget
        this.widgets.set('heading', {
            id: 'mini-heading',
            title: 'HDG',
            simvars: ['HEADING INDICATOR', 'MAGNETIC COMPASS', 'GPS GROUND TRUE HEADING'],
            format: (data) => {
                const hdg = Math.round(data['HEADING INDICATOR'] || 0);
                const mag = Math.round(data['MAGNETIC COMPASS'] || 0);
                const trk = Math.round(data['GPS GROUND TRUE HEADING'] || 0);
                return {
                    primary: hdg.toString().padStart(3, '0'),
                    unit: '°M',
                    secondary: `TRK ${trk.toString().padStart(3, '0')}°`
                };
            },
            color: () => '#ffaa00',
            position: { x: 20, y: 180 }
        });

        // Vertical Speed Widget
        this.widgets.set('vspeed', {
            id: 'mini-vspeed',
            title: 'VS',
            simvars: ['VERTICAL SPEED'],
            format: (data) => {
                const vs = Math.round(data['VERTICAL SPEED'] || 0);
                const sign = vs >= 0 ? '+' : '';
                return {
                    primary: `${sign}${vs}`,
                    unit: 'FPM',
                    secondary: vs > 0 ? '▲ CLIMB' : vs < 0 ? '▼ DESC' : '— LEVEL'
                };
            },
            color: (data) => {
                const vs = data['VERTICAL SPEED'] || 0;
                if (vs > 500) return '#00ff88';
                if (vs < -500) return '#ff4444';
                return '#ffffff';
            },
            position: { x: 20, y: 260 }
        });

        // G-Force Widget
        this.widgets.set('gforce', {
            id: 'mini-gforce',
            title: 'G',
            simvars: ['G FORCE'],
            format: (data) => {
                const g = (data['G FORCE'] || 1).toFixed(1);
                return {
                    primary: g,
                    unit: 'G',
                    secondary: this.getGForceWarning(parseFloat(g))
                };
            },
            color: (data) => {
                const g = Math.abs(data['G FORCE'] || 1);
                if (g > 4) return '#ff0000';
                if (g > 3) return '#ff4444';
                if (g > 2) return '#ffaa00';
                return '#ffffff';
            },
            position: { x: 20, y: 340 }
        });

        this.renderAllWidgets();
    }

    // ========== RENDERING ==========

    renderAllWidgets() {
        const container = document.getElementById('mini-widgets-container');
        if (!container) return;

        container.innerHTML = '';

        this.widgets.forEach((widget, key) => {
            const el = document.createElement('div');
            el.id = widget.id;
            el.className = 'mini-widget';
            el.setAttribute('data-widget', key);
            el.style.left = `${widget.position.x}px`;
            el.style.top = `${widget.position.y}px`;
            el.innerHTML = `
                <div class="mini-widget-header">
                    <span class="mini-widget-title">${widget.title}</span>
                    <button class="mini-widget-close" onclick="miniWidgets.toggleWidget('${key}')">×</button>
                </div>
                <div class="mini-widget-body">
                    <span class="mini-widget-value">---</span>
                    <span class="mini-widget-unit"></span>
                </div>
                <div class="mini-widget-footer"></div>
            `;
            
            this.makeDraggable(el);
            container.appendChild(el);
        });
    }

    updateDisplay(key, data) {
        const widget = this.widgets.get(key);
        if (!widget) return;

        const el = document.getElementById(widget.id);
        if (!el) return;

        const formatted = widget.format(data);
        const color = widget.color(data);

        el.querySelector('.mini-widget-value').textContent = formatted.primary;
        el.querySelector('.mini-widget-value').style.color = color;
        el.querySelector('.mini-widget-unit').textContent = formatted.unit;
        el.querySelector('.mini-widget-footer').textContent = formatted.secondary;
    }

    // ========== DATA UPDATES ==========

    startUpdates() {
        this.updateInterval = setInterval(() => {
            this.fetchAndUpdate();
        }, this.config.updateRate);
    }

    async fetchAndUpdate() {
        // Collect all simvars needed
        const allSimvars = new Set();
        this.widgets.forEach(widget => {
            widget.simvars.forEach(sv => allSimvars.add(sv));
        });

        try {
            const data = {};
            for (const simvar of allSimvars) {
                data[simvar] = await this.$api.variables.get(simvar);
            }

            // Update each widget
            this.widgets.forEach((widget, key) => {
                this.updateDisplay(key, data);
            });
        } catch (err) {
            console.error('[MiniWidgets] Update error:', err);
        }
    }

    // ========== HELPERS ==========

    getSpeedColor(data) {
        const ias = data['AIRSPEED INDICATED'] || 0;
        // These would ideally come from aircraft-specific V-speeds
        if (ias < 60) return '#ff4444';   // Below Vs
        if (ias > 250) return '#ffaa00';  // High speed
        return '#00ff88';
    }

    getGForceWarning(g) {
        if (g > 4) return '⚠️ OVERSTRESS';
        if (g > 3) return '⚠️ HIGH G';
        if (g < 0) return '⚠️ NEGATIVE';
        return 'NORMAL';
    }

    makeDraggable(el) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const header = el.querySelector('.mini-widget-header');
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = el.offsetLeft;
            initialY = el.offsetTop;
            el.style.zIndex = 1000;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initialX + dx}px`;
            el.style.top = `${initialY + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.zIndex = '';
                this.saveWidgetPosition(el.getAttribute('data-widget'), {
                    x: el.offsetLeft,
                    y: el.offsetTop
                });
            }
        });
    }

    toggleWidget(key) {
        const widget = this.widgets.get(key);
        if (!widget) return;
        
        const el = document.getElementById(widget.id);
        if (el) {
            el.classList.toggle('hidden');
        }
    }

    // ========== PERSISTENCE ==========

    saveWidgetPosition(key, position) {
        const widget = this.widgets.get(key);
        if (widget) {
            widget.position = position;
        }
        this.saveUserPreferences();
    }

    saveUserPreferences() {
        const prefs = {
            positions: {},
            visibility: {},
            units: this.config.units
        };

        this.widgets.forEach((widget, key) => {
            prefs.positions[key] = widget.position;
            const el = document.getElementById(widget.id);
            prefs.visibility[key] = el ? !el.classList.contains('hidden') : true;
        });

        this.$api.datastore.set('miniWidgetsPrefs', JSON.stringify(prefs));
    }

    loadUserPreferences() {
        try {
            const saved = this.$api.datastore.get('miniWidgetsPrefs');
            if (saved) {
                const prefs = JSON.parse(saved);
                
                // Restore positions
                if (prefs.positions) {
                    Object.entries(prefs.positions).forEach(([key, pos]) => {
                        const widget = this.widgets.get(key);
                        if (widget) widget.position = pos;
                    });
                }

                // Restore visibility
                if (prefs.visibility) {
                    Object.entries(prefs.visibility).forEach(([key, visible]) => {
                        if (!visible) {
                            const widget = this.widgets.get(key);
                            if (widget) {
                                const el = document.getElementById(widget.id);
                                if (el) el.classList.add('hidden');
                            }
                        }
                    });
                }

                // Restore units
                if (prefs.units) {
                    this.config.units = prefs.units;
                }
            }
        } catch (err) {
            console.warn('[MiniWidgets] Could not load preferences:', err);
        }
    }

    syncPositions() {
        this.widgets.forEach((widget, key) => {
            const el = document.getElementById(widget.id);
            if (el) {
                el.style.left = `${widget.position.x}px`;
                el.style.top = `${widget.position.y}px`;
            }
        });
    }
}

// Global instance
let miniWidgets = null;

// SimWidget Engine hooks
function html_created($api) {
    miniWidgets = new MiniWidgetsCollection($api);
    miniWidgets.html_created();
}

function loop_1hz($api) {
    if (miniWidgets) miniWidgets.loop_1hz();
}

function exit($api) {
    if (miniWidgets) miniWidgets.exit();
}

// Export for module use
if (typeof module !== 'undefined') {
    module.exports = { MiniWidgetsCollection, html_created, loop_1hz, exit };
}
