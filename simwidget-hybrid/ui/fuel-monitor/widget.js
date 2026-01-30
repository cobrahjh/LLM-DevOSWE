/**
 * Fuel Monitor Widget v1.0.0
 * Real-time fuel monitoring for MSFS
 *
 * Features:
 * - Total fuel quantity (gallons/lbs)
 * - Left/Right tank levels with visual gauges
 * - Fuel flow rate (GPH)
 * - Endurance calculation (hours remaining)
 * - Range estimation (nautical miles)
 * - Fuel used tracking
 * - Pump and selector status
 *
 * Path: ui/fuel-monitor/widget.js
 */

class FuelMonitorWidget extends SimWidgetBase {
    constructor() {
        super({
            widgetName: 'fuel-monitor',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // Fuel data state
        this.fuel = {
            totalGallons: 0,
            totalCapacity: 50,      // Default capacity, will update from sim
            leftTank: 0,
            rightTank: 0,
            leftCapacity: 25,
            rightCapacity: 25,
            flowRate: 0,            // Gallons per hour
            fuelUsed: 0,
            pumpOn: false,
            selector: 'BOTH'        // OFF, LEFT, RIGHT, BOTH, ALL
        };

        // Flight data for calculations
        this.flight = {
            groundSpeed: 0,
            onGround: true
        };

        // Tracking
        this.initialFuel = null;
        this.fuelWeight = 6.0;      // lbs per gallon (avgas default)

        // Cache DOM elements
        this.elements = {};

        this.init();
    }

    /**
     * Initialize widget
     */
    init() {
        console.log('[FuelMonitor] Initialized');
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
    }

    /**
     * Cache DOM element references for performance
     */
    cacheElements() {
        this.elements = {
            // Total fuel
            totalGal: document.getElementById('fuel-total-gal'),
            totalLbs: document.getElementById('fuel-total-lbs'),
            totalBar: document.getElementById('fuel-total-bar'),
            // Tank gauges
            leftFill: document.getElementById('tank-left-fill'),
            leftVal: document.getElementById('tank-left-val'),
            rightFill: document.getElementById('tank-right-fill'),
            rightVal: document.getElementById('tank-right-val'),
            // Data grid
            flowRate: document.getElementById('fuel-flow'),
            fuelUsed: document.getElementById('fuel-used'),
            endurance: document.getElementById('fuel-endurance'),
            range: document.getElementById('fuel-range'),
            // Status
            selector: document.getElementById('fuel-selector'),
            pumpStatus: document.getElementById('fuel-pump-status'),
            pumpLed: document.getElementById('pump-led'),
            // Footer
            groundSpeed: document.getElementById('ground-speed')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Pump toggle
        document.getElementById('btn-pump')?.addEventListener('click', () => {
            this.sendCommand('FUEL_PUMP');
        });

        // Selector cycle
        document.getElementById('btn-selector')?.addEventListener('click', () => {
            this.sendCommand('FUEL_SELECTOR_ALL');
        });

        // Reset fuel used counter
        document.getElementById('btn-reset')?.addEventListener('click', () => {
            this.resetFuelUsed();
        });
    }

    /**
     * WebSocket connected
     */
    onConnect() {
        console.log('[FuelMonitor] Connected to server');
    }

    /**
     * WebSocket disconnected
     */
    onDisconnect() {
        console.log('[FuelMonitor] Disconnected');
    }

    /**
     * Handle incoming flight data
     */
    onMessage(msg) {
        if (msg.type === 'flightData' && msg.data) {
            this.updateFuelData(msg.data);
        }
    }

    /**
     * Update fuel data from server flightData
     */
    updateFuelData(data) {
        // Total fuel quantity (gallons) - server field: fuelTotal
        if (data.fuelTotal !== undefined) {
            this.fuel.totalGallons = data.fuelTotal;
        }

        // Total capacity - server field: fuelCapacity
        if (data.fuelCapacity !== undefined) {
            this.fuel.totalCapacity = data.fuelCapacity;
        }

        // Left tank - server field: fuelTankLeftMain
        if (data.fuelTankLeftMain !== undefined) {
            this.fuel.leftTank = data.fuelTankLeftMain;
        }

        // Right tank - server field: fuelTankRightMain
        if (data.fuelTankRightMain !== undefined) {
            this.fuel.rightTank = data.fuelTankRightMain;
        }

        // Tank capacities - server fields: fuelTankLeftMainCap, fuelTankRightMainCap
        if (data.fuelTankLeftMainCap !== undefined) {
            this.fuel.leftCapacity = data.fuelTankLeftMainCap;
        }
        if (data.fuelTankRightMainCap !== undefined) {
            this.fuel.rightCapacity = data.fuelTankRightMainCap;
        }

        // Fuel flow - server field: fuelFlow
        if (data.fuelFlow !== undefined) {
            this.fuel.flowRate = data.fuelFlow;
        }

        // Ground speed for range calculation - server field: groundSpeed
        if (data.groundSpeed !== undefined) {
            this.flight.groundSpeed = data.groundSpeed;
        }

        // Track initial fuel for "used" calculation
        if (this.initialFuel === null && this.fuel.totalGallons > 0) {
            this.initialFuel = this.fuel.totalGallons;
        }

        // Calculate fuel used
        if (this.initialFuel !== null) {
            this.fuel.fuelUsed = Math.max(0, this.initialFuel - this.fuel.totalGallons);
        }

        // Update UI
        this.updateUI();
    }

    /**
     * Map selector value to string
     */
    mapSelector(value) {
        const selectors = ['OFF', 'ALL', 'LEFT', 'RIGHT', 'BOTH', 'CENTER'];
        return selectors[value] || 'BOTH';
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        this.updateTotalFuel();
        this.updateTankGauges();
        this.updateDataGrid();
        this.updateStatus();
    }

    /**
     * Update total fuel display
     */
    updateTotalFuel() {
        const { totalGallons, totalCapacity } = this.fuel;
        const percent = totalCapacity > 0 ? (totalGallons / totalCapacity) * 100 : 0;
        const lbs = totalGallons * this.fuelWeight;

        // Values
        if (this.elements.totalGal) {
            this.elements.totalGal.textContent = this.formatNumber(totalGallons, 1);
        }
        if (this.elements.totalLbs) {
            this.elements.totalLbs.textContent = `(${this.formatNumber(lbs, 0)} lbs)`;
        }

        // Progress bar
        if (this.elements.totalBar) {
            this.elements.totalBar.style.width = `${Math.min(100, percent)}%`;
            this.elements.totalBar.classList.remove('warning', 'critical');
            if (percent <= 10) {
                this.elements.totalBar.classList.add('critical');
            } else if (percent <= 25) {
                this.elements.totalBar.classList.add('warning');
            }
        }
    }

    /**
     * Update tank gauge displays
     */
    updateTankGauges() {
        const { leftTank, rightTank, leftCapacity, rightCapacity } = this.fuel;

        // Left tank
        const leftPercent = leftCapacity > 0 ? (leftTank / leftCapacity) * 100 : 0;
        if (this.elements.leftFill) {
            this.elements.leftFill.style.height = `${Math.min(100, leftPercent)}%`;
            this.setGaugeClass(this.elements.leftFill, leftPercent);
        }
        if (this.elements.leftVal) {
            this.elements.leftVal.textContent = this.formatNumber(leftTank, 0);
        }

        // Right tank
        const rightPercent = rightCapacity > 0 ? (rightTank / rightCapacity) * 100 : 0;
        if (this.elements.rightFill) {
            this.elements.rightFill.style.height = `${Math.min(100, rightPercent)}%`;
            this.setGaugeClass(this.elements.rightFill, rightPercent);
        }
        if (this.elements.rightVal) {
            this.elements.rightVal.textContent = this.formatNumber(rightTank, 0);
        }
    }

    /**
     * Set gauge warning/critical class based on percent
     */
    setGaugeClass(element, percent) {
        element.classList.remove('warning', 'critical');
        if (percent <= 10) {
            element.classList.add('critical');
        } else if (percent <= 25) {
            element.classList.add('warning');
        }
    }

    /**
     * Update data grid (flow, used, endurance, range)
     */
    updateDataGrid() {
        const { totalGallons, flowRate, fuelUsed } = this.fuel;
        const { groundSpeed } = this.flight;

        // Flow rate
        if (this.elements.flowRate) {
            this.elements.flowRate.textContent = this.formatNumber(flowRate, 1);
        }

        // Fuel used
        if (this.elements.fuelUsed) {
            this.elements.fuelUsed.textContent = this.formatNumber(fuelUsed, 1);
        }

        // Endurance (hours)
        let enduranceHrs = 0;
        if (flowRate > 0.5) {
            enduranceHrs = totalGallons / flowRate;
        }
        if (this.elements.endurance) {
            if (enduranceHrs > 0 && enduranceHrs < 100) {
                const hrs = Math.floor(enduranceHrs);
                const mins = Math.round((enduranceHrs - hrs) * 60);
                this.elements.endurance.textContent = `${hrs}:${mins.toString().padStart(2, '0')}`;
                this.elements.endurance.classList.remove('warning', 'critical');
                if (enduranceHrs < 0.5) {
                    this.elements.endurance.classList.add('critical');
                } else if (enduranceHrs < 1) {
                    this.elements.endurance.classList.add('warning');
                }
            } else {
                this.elements.endurance.textContent = '--:--';
            }
        }

        // Range (nautical miles)
        let rangeNm = 0;
        if (groundSpeed > 10 && flowRate > 0.5) {
            rangeNm = (totalGallons / flowRate) * groundSpeed;
        }
        if (this.elements.range) {
            if (rangeNm > 0 && rangeNm < 10000) {
                this.elements.range.textContent = this.formatNumber(rangeNm, 0);
            } else {
                this.elements.range.textContent = '--';
            }
        }

        // Ground speed in footer
        if (this.elements.groundSpeed) {
            this.elements.groundSpeed.textContent = this.formatNumber(groundSpeed, 0);
        }
    }

    /**
     * Update status indicators
     */
    updateStatus() {
        const { selector, pumpOn } = this.fuel;

        // Selector
        if (this.elements.selector) {
            this.elements.selector.textContent = selector;
        }

        // Pump status
        if (this.elements.pumpStatus) {
            this.elements.pumpStatus.textContent = pumpOn ? 'ON' : 'OFF';
            this.elements.pumpStatus.classList.toggle('on', pumpOn);
        }
        if (this.elements.pumpLed) {
            this.elements.pumpLed.classList.toggle('on', pumpOn);
        }

        // Update pump button state
        const pumpBtn = document.getElementById('btn-pump');
        if (pumpBtn) {
            pumpBtn.classList.toggle('active', pumpOn);
        }
    }

    /**
     * Reset fuel used counter
     */
    resetFuelUsed() {
        this.initialFuel = this.fuel.totalGallons;
        this.fuel.fuelUsed = 0;
        this.saveSettings();
        console.log('[FuelMonitor] Fuel used counter reset');
    }

    /**
     * Format number with decimals
     */
    formatNumber(value, decimals = 0) {
        if (value === undefined || value === null || isNaN(value)) return '--';
        return Number(value).toFixed(decimals);
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('fuel-monitor-settings', JSON.stringify({
                initialFuel: this.initialFuel,
                fuelWeight: this.fuelWeight
            }));
        } catch (e) {
            console.error('[FuelMonitor] Failed to save settings:', e);
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('fuel-monitor-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.fuelWeight) this.fuelWeight = settings.fuelWeight;
            }
        } catch (e) {
            console.error('[FuelMonitor] Failed to load settings:', e);
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuelMonitorWidget;
}
