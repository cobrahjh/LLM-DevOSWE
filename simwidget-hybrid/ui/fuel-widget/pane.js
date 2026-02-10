/**
 * Fuel pane v3.0.0
 * Last Updated: 2026-02-07
 *
 * Dynamic fuel management pane for SimGlass Engine
 * - Transparency toggle (persisted)
 * - Auto-detects aircraft fuel tanks from SimConnect
 * - Multi-select tanks (click to toggle)
 * - Real-time fuel monitoring
 * - Dynamic tank visualization
 * - Add/remove fuel controls (per selected tanks or all)
 * - Endurance calculation
 *
 * Changelog:
 * v3.0.0 - Migrated to SimGlassBase for standardized WebSocket handling
 * v2.3.1 - Fixed remote connection (use hostname instead of hardcoded localhost)
 * v2.3.0 - Transparency toggle with localStorage persistence
 * v2.2.0 - Multi-select tanks support
 * v2.1.0 - Selectable tanks, per-tank add/remove, fill/empty all tanks
 * v2.0.0 - Dynamic tank detection from aircraft (11 tank types supported)
 * v1.0.0 - Initial glass with left/right tanks only
 */

class FuelPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'fuel-glass',
            widgetVersion: '3.0.0',
            autoConnect: true
        });

        this.fuelData = {
            fuelTotal: 0,
            fuelCapacity: 56,
            fuelFlow: 0,
            tanks: []
        };

        // Compact mode state
        this.compactMode = localStorage.getItem('fuel-widget-compact') === 'true';

        // Selected tanks (Set for multiple selection)
        this.selectedTanks = new Set();

        // Tank definitions
        this.tankDefs = [
            { key: 'LeftMain', name: 'L Main', qtyField: 'fuelTankLeftMain', capField: 'fuelTankLeftMainCap' },
            { key: 'RightMain', name: 'R Main', qtyField: 'fuelTankRightMain', capField: 'fuelTankRightMainCap' },
            { key: 'LeftAux', name: 'L Aux', qtyField: 'fuelTankLeftAux', capField: 'fuelTankLeftAuxCap' },
            { key: 'RightAux', name: 'R Aux', qtyField: 'fuelTankRightAux', capField: 'fuelTankRightAuxCap' },
            { key: 'Center', name: 'Center', qtyField: 'fuelTankCenter', capField: 'fuelTankCenterCap' },
            { key: 'Center2', name: 'Center 2', qtyField: 'fuelTankCenter2', capField: 'fuelTankCenter2Cap' },
            { key: 'Center3', name: 'Center 3', qtyField: 'fuelTankCenter3', capField: 'fuelTankCenter3Cap' },
            { key: 'LeftTip', name: 'L Tip', qtyField: 'fuelTankLeftTip', capField: 'fuelTankLeftTipCap' },
            { key: 'RightTip', name: 'R Tip', qtyField: 'fuelTankRightTip', capField: 'fuelTankRightTipCap' },
            { key: 'External1', name: 'Ext 1', qtyField: 'fuelTankExternal1', capField: 'fuelTankExternal1Cap' },
            { key: 'External2', name: 'Ext 2', qtyField: 'fuelTankExternal2', capField: 'fuelTankExternal2Cap' }
        ];

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupCompactToggle();
        this.loadTransparencyPreference();
        this.startWasmPolling();
    }

    /**
     * Poll WASM gauge data from localStorage
     * This provides real fuel data when MSFS gauge is active
     */
    startWasmPolling() {
        this.wasmInterval = setInterval(() => {
            try {
                const wasmData = localStorage.getItem('simglass_fuel_data');
                if (wasmData) {
                    const data = JSON.parse(wasmData);
                    // Check if data is recent (within last 2 seconds)
                    if (data.timestamp && (Date.now() - data.timestamp < 2000)) {
                        this.handleData(data);
                        // Update connection status to show WASM source
                        if (this.connectionStatus) {
                            this.connectionStatus.textContent = 'WASM Connected';
                            this.connectionStatus.className = 'connected';
                        }
                    }
                }
            } catch (e) {
                console.error('[Fuel pane] WASM polling error:', e);
            }
        }, 500); // Poll every 500ms
    }

    cacheElements() {
        this.connectionStatus = document.getElementById('conn-status');
        this.statusLog = document.getElementById('statusLog');
        this.gaugeFill = document.getElementById('gaugeFill');
        this.fuelPercent = document.getElementById('fuelPercent');
        this.fuelTotalEl = document.getElementById('fuelTotal');
        this.fuelCapacityEl = document.getElementById('fuelCapacity');
        this.fuelFlowEl = document.getElementById('fuelFlow');
        this.enduranceEl = document.getElementById('endurance');
        this.tanksContainer = document.getElementById('tanksContainer');
        this.selectedTankLabel = document.getElementById('selectedTankLabel');
    }

    bindEvents() {
        // Transparency toggle
        document.getElementById('btnTransparency')?.addEventListener('click', () => this.toggleTransparency());

        // Add/Remove - affects selected tanks
        document.getElementById('btnAddFuel')?.addEventListener('click', () => this.adjustFuel(10));
        document.getElementById('btnRemoveFuel')?.addEventListener('click', () => this.adjustFuel(-10));

        // Fill/Empty - affects ALL tanks
        document.getElementById('btnFillTanks')?.addEventListener('click', () => this.setAllTanksPercent(100));
        document.getElementById('btnEmptyTanks')?.addEventListener('click', () => this.setAllTanksPercent(0));
        
        // Select All / Clear Selection
        document.getElementById('btnSelectAll')?.addEventListener('click', () => this.selectAllTanks());
        document.getElementById('btnClearSelection')?.addEventListener('click', () => this.clearSelection());
        
        // Presets - affects selected tanks
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const percent = parseInt(btn.dataset.percent);
                this.setSelectedTanksPercent(percent);
            });
        });
    }

    setupCompactToggle() {
        const toggle = document.getElementById('compact-toggle');
        const root = document.getElementById('widget-root');
        if (!toggle || !root) return;

        // Apply saved compact mode on load
        if (this.compactMode) {
            root.classList.add('compact');
            toggle.classList.add('active');
        }

        toggle.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            localStorage.setItem('fuel-widget-compact', this.compactMode);
            root.classList.toggle('compact', this.compactMode);
            toggle.classList.toggle('active', this.compactMode);
            this.updateCompact();
        });
    }

    updateCompact() {
        if (!this.compactMode) return;

        const { fuelTotal, fuelCapacity, fuelFlow } = this.fuelData;
        const percent = fuelCapacity > 0 ? Math.round((fuelTotal / fuelCapacity) * 100) : 0;
        const fuelUsed = fuelCapacity - fuelTotal;

        // Endurance
        const endurance = fuelFlow > 0 ? fuelTotal / fuelFlow : 0;
        const hours = Math.floor(endurance);
        const minutes = Math.floor((endurance - hours) * 60);
        const endurStr = fuelFlow > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : '--:--';

        // Update compact DOM elements
        const pctEl = document.getElementById('fw-pct');
        const totalEl = document.getElementById('fw-total');
        const flowEl = document.getElementById('fw-flow');
        const endurEl = document.getElementById('fw-endur');
        const usedEl = document.getElementById('fw-used');

        if (pctEl) pctEl.textContent = percent + '%';
        if (totalEl) totalEl.textContent = fuelTotal.toFixed(1);
        if (flowEl) flowEl.textContent = fuelFlow.toFixed(1);
        if (endurEl) endurEl.textContent = endurStr;
        if (usedEl) usedEl.textContent = fuelUsed.toFixed(1);

        // Color the gauge cell based on fuel level
        const gaugeCell = pctEl?.closest('.fw-cell');
        if (gaugeCell) {
            gaugeCell.classList.remove('warning', 'critical');
            if (percent <= 10) gaugeCell.classList.add('critical');
            else if (percent <= 25) gaugeCell.classList.add('warning');
        }
    }

    toggleTankSelection(tankKey) {
        // Simple toggle - click to select/deselect
        if (this.selectedTanks.has(tankKey)) {
            this.selectedTanks.delete(tankKey);
        } else {
            this.selectedTanks.add(tankKey);
        }
        
        this.updateSelectionDisplay();
        this.log(this.getSelectionLabel(), 'success');
    }

    selectAllTanks() {
        this.fuelData.tanks.forEach(tank => {
            this.selectedTanks.add(tank.key);
        });
        this.updateSelectionDisplay();
        this.log('All tanks selected', 'success');
    }

    clearSelection() {
        this.selectedTanks.clear();
        this.updateSelectionDisplay();
        this.log('Selection cleared', 'success');
    }

    getSelectionLabel() {
        if (this.selectedTanks.size === 0) return 'None';
        if (this.selectedTanks.size === this.fuelData.tanks.length) return 'All';
        
        const names = [];
        this.fuelData.tanks.forEach(tank => {
            if (this.selectedTanks.has(tank.key)) {
                names.push(tank.name);
            }
        });
        return names.join(', ');
    }

    updateSelectionDisplay() {
        // Update tank visual selection
        document.querySelectorAll('.tank').forEach(el => {
            el.classList.toggle('selected', this.selectedTanks.has(el.dataset.tank));
        });
        
        // Update label
        if (this.selectedTankLabel) {
            this.selectedTankLabel.textContent = this.getSelectionLabel();
        }
    }

    // SimGlassBase lifecycle hook
    onMessage(data) {
        this.handleData(data);
    }

    // SimGlassBase lifecycle hook
    onConnect() {
        this.setStatus('Connected', 'connected');
        this.log('Connected to SimGlass server', 'success');
    }

    // SimGlassBase lifecycle hook
    onDisconnect() {
        this.setStatus('Disconnected', 'disconnected');
    }

    handleData(data) {
        const d = data.data || data;
        
        if (d.fuelTotal !== undefined) {
            const detectedTanks = [];
            
            for (const tankDef of this.tankDefs) {
                const capacity = d[tankDef.capField] || 0;
                const quantity = d[tankDef.qtyField] || 0;
                
                if (capacity > 0) {
                    detectedTanks.push({
                        key: tankDef.key,
                        name: tankDef.name,
                        quantity: quantity,
                        capacity: capacity
                    });
                }
            }
            
            this.fuelData = {
                fuelTotal: d.fuelTotal || 0,
                fuelCapacity: d.fuelCapacity || 56,
                fuelFlow: d.fuelFlow || 0,
                tanks: detectedTanks
            };
            
            // Auto-select ALL tanks on first detection
            if (this.selectedTanks.size === 0 && detectedTanks.length > 0) {
                detectedTanks.forEach(tank => this.selectedTanks.add(tank.key));
            }
            
            // Remove any selected tanks that no longer exist
            for (const key of this.selectedTanks) {
                if (!detectedTanks.find(t => t.key === key)) {
                    this.selectedTanks.delete(key);
                }
            }
            
            this.updateDisplay();
        }
    }

    updateDisplay() {
        const { fuelTotal, fuelCapacity, fuelFlow, tanks } = this.fuelData;
        
        const percent = fuelCapacity > 0 ? Math.round((fuelTotal / fuelCapacity) * 100) : 0;
        
        // Update gauge
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (percent / 100) * circumference;
        this.gaugeFill.style.strokeDashoffset = offset;
        this.fuelPercent.textContent = percent + '%';
        
        this.gaugeFill.classList.remove('warning', 'critical');
        if (percent <= 10) {
            this.gaugeFill.classList.add('critical');
        } else if (percent <= 25) {
            this.gaugeFill.classList.add('warning');
        }
        
        // Update stats
        this.fuelTotalEl.textContent = fuelTotal.toFixed(1) + ' gal';
        this.fuelCapacityEl.textContent = fuelCapacity.toFixed(1) + ' gal';
        this.fuelFlowEl.textContent = fuelFlow.toFixed(1) + ' gph';
        
        const endurance = fuelFlow > 0 ? fuelTotal / fuelFlow : 0;
        const hours = Math.floor(endurance);
        const minutes = Math.floor((endurance - hours) * 60);
        this.enduranceEl.textContent = fuelFlow > 0 
            ? `${hours}:${minutes.toString().padStart(2, '0')}` 
            : '--:--';
        
        this.renderTanks(tanks);
        this.updateCompact();
    }

    renderTanks(tanks) {
        const currentCount = this.tanksContainer.querySelectorAll('.tank').length;
        
        if (currentCount !== tanks.length) {
            this.tanksContainer.innerHTML = tanks.map(tank => `
                <div class="tank ${this.selectedTanks.has(tank.key) ? 'selected' : ''}" data-tank="${tank.key}">
                    <div class="tank-bar">
                        <div class="tank-fill" id="tankFill_${tank.key}"></div>
                    </div>
                    <div class="tank-label">${tank.name}</div>
                    <div class="tank-value" id="tankValue_${tank.key}">0.0 gal</div>
                </div>
            `).join('');
            
            // Add click handlers for tank selection (simple toggle)
            this.tanksContainer.querySelectorAll('.tank').forEach(el => {
                el.addEventListener('click', () => {
                    this.toggleTankSelection(el.dataset.tank);
                });
            });
        }
        
        // Update tank values and selection state
        tanks.forEach(tank => {
            const tankEl = this.tanksContainer.querySelector(`[data-tank="${tank.key}"]`);
            const fillEl = document.getElementById(`tankFill_${tank.key}`);
            const valueEl = document.getElementById(`tankValue_${tank.key}`);
            
            if (tankEl) {
                tankEl.classList.toggle('selected', this.selectedTanks.has(tank.key));
            }
            
            if (fillEl && valueEl) {
                const tankPercent = tank.capacity > 0 ? (tank.quantity / tank.capacity) * 100 : 0;
                fillEl.style.height = Math.min(tankPercent, 100) + '%';
                valueEl.textContent = tank.quantity.toFixed(1) + ' gal';
                
                fillEl.classList.remove('warning', 'critical');
                if (tankPercent <= 10) fillEl.classList.add('critical');
                else if (tankPercent <= 25) fillEl.classList.add('warning');
            }
        });
        
        // Update selected tank label
        if (this.selectedTankLabel) {
            this.selectedTankLabel.textContent = this.getSelectionLabel();
        }
    }

    // Adjust fuel for SELECTED tanks
    adjustFuel(amount) {
        if (this.selectedTanks.size === 0) {
            this.log('No tanks selected', 'error');
            return;
        }
        
        // Send command for each selected tank
        for (const tankKey of this.selectedTanks) {
            this.sendCommand('fuel', 'adjustTank', { tankKey, amount });
        }
        
        const label = this.getSelectionLabel();
        this.log(`${amount > 0 ? '+' : ''}${amount} gal → ${label}`, 'success');
    }

    // Set percent for SELECTED tanks
    setSelectedTanksPercent(percent) {
        if (this.selectedTanks.size === 0) {
            this.log('No tanks selected', 'error');
            return;
        }
        
        // Send command for each selected tank
        for (const tankKey of this.selectedTanks) {
            this.sendCommand('fuel', 'setTankPercent', { tankKey, percent });
        }
        
        const label = this.getSelectionLabel();
        this.log(`${label} → ${percent}%`, 'success');
    }

    // Set percent for ALL tanks (Fill/Empty buttons)
    setAllTanksPercent(percent) {
        this.sendCommand('fuel', 'setPercent', { percent });
        this.log(`All tanks → ${percent}%`, 'success');
    }

    sendCommand(category, action, params = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                category,
                action,
                ...params
            }));
        } else {
            this.log('Not connected to server', 'error');
        }
    }

    setStatus(text, className) {
        if (!this.connectionStatus) return;
        this.connectionStatus.className = 'connection-status ' + className;
        this.connectionStatus.title = text;
    }

    toggleTransparency() {
        document.body.classList.toggle('transparent');
        const btn = document.getElementById('btnTransparency');
        btn.classList.toggle('active');
        
        // Save preference
        const isTransparent = document.body.classList.contains('transparent');
        localStorage.setItem('widgetTransparency', isTransparent);
    }

    loadTransparencyPreference() {
        const saved = localStorage.getItem('widgetTransparency');
        if (saved === 'true') {
            document.body.classList.add('transparent');
            document.getElementById('btnTransparency').classList.add('active');
        }
    }

    log(message, type = '') {
        this.statusLog.textContent = message;
        this.statusLog.className = 'status-log ' + type;
    }

    destroy() {
        this._destroyed = true;
        if (this.wasmInterval) {
            clearInterval(this.wasmInterval);
            this.wasmInterval = null;
        }
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.FuelPane = new FuelPane();
    window.addEventListener('beforeunload', () => window.FuelPane?.destroy());
});
