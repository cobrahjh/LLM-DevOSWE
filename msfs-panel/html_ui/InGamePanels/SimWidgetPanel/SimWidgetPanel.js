/**
 * SimWidget Panel for MSFS
 * Native In-Game Panel using SimVar API
 */

class SimWidgetPanel extends HTMLElement {
    constructor() {
        super();
        this.updating = false;
    }
    
    connectedCallback() {
        console.log('[SimWidget] Panel connected, initializing...');
        
        // Wait for DOM to be ready
        setTimeout(() => {
            this.setupButtons();
            this.startUpdateLoop();
        }, 500);
    }
    
    setupButtons() {
        // System buttons
        this.setupButton('btn-brk', 'K:PARKING_BRAKES');
        this.setupButton('btn-gear', 'K:GEAR_TOGGLE');
        this.setupButton('btn-flaps', 'K:FLAPS_INCR');
        
        // Light buttons
        this.setupButton('btn-nav', 'K:TOGGLE_NAV_LIGHTS');
        this.setupButton('btn-bcn', 'K:TOGGLE_BEACON_LIGHTS');
        this.setupButton('btn-strb', 'K:STROBES_TOGGLE');
        this.setupButton('btn-ldg', 'K:LANDING_LIGHTS_TOGGLE');
        this.setupButton('btn-taxi', 'K:TOGGLE_TAXI_LIGHTS');
        
        // Autopilot buttons
        this.setupButton('btn-ap', 'K:AP_MASTER');
        this.setupButton('btn-hdg', 'K:AP_PANEL_HEADING_HOLD');
        this.setupButton('btn-apnav', 'K:AP_NAV1_HOLD');
        this.setupButton('btn-alt', 'K:AP_PANEL_ALTITUDE_HOLD');
        this.setupButton('btn-vs', 'K:AP_PANEL_VS_HOLD');
        this.setupButton('btn-apr', 'K:AP_APR_HOLD');
        
        console.log('[SimWidget] Buttons configured');
    }
    
    setupButton(id, event) {
        const btn = this.querySelector('#' + id);
        if (btn) {
            btn.addEventListener('click', () => {
                console.log('[SimWidget] Button clicked:', event);
                if (typeof SimVar !== 'undefined') {
                    SimVar.SetSimVarValue(event, 'Number', 1);
                }
            });
        }
    }
    
    startUpdateLoop() {
        console.log('[SimWidget] Starting update loop');
        setInterval(() => this.update(), 500);
    }
    
    update() {
        if (this.updating) return;
        if (typeof SimVar === 'undefined') return;
        
        this.updating = true;
        
        try {
            this.updateFlightData();
            this.updateSystems();
            this.updateLights();
            this.updateEngine();
            this.updateFuel();
            this.updateAutopilot();
            this.updateTime();
        } catch (e) {
            console.error('[SimWidget] Update error:', e);
        }
        
        this.updating = false;
    }
    
    setTxt(id, txt) {
        const el = this.querySelector('#' + id);
        if (el) el.textContent = txt;
    }
    
    updateFlightData() {
        const alt = SimVar.GetSimVarValue('INDICATED ALTITUDE', 'feet') || 0;
        const spd = SimVar.GetSimVarValue('AIRSPEED INDICATED', 'knots') || 0;
        const hdg = SimVar.GetSimVarValue('HEADING INDICATOR', 'degrees') || 0;
        const vs = SimVar.GetSimVarValue('VERTICAL SPEED', 'feet per minute') || 0;
        
        this.setTxt('acw-alt', Math.round(alt).toLocaleString() + ' ft');
        this.setTxt('acw-spd', Math.round(spd) + ' kts');
        this.setTxt('acw-hdg', String(Math.round(hdg)).padStart(3, '0') + '°');
        this.setTxt('acw-vs', (vs >= 0 ? '+' : '') + Math.round(vs) + ' fpm');
    }
    
    updateSystems() {
        const pbrk = SimVar.GetSimVarValue('BRAKE PARKING POSITION', 'bool');
        const gear = SimVar.GetSimVarValue('GEAR HANDLE POSITION', 'bool');
        
        this.updateButton('btn-brk', pbrk, pbrk);
        this.updateButton('btn-gear', gear);
    }
    
    updateLights() {
        this.updateButton('btn-nav', SimVar.GetSimVarValue('LIGHT NAV', 'bool'));
        this.updateButton('btn-bcn', SimVar.GetSimVarValue('LIGHT BEACON', 'bool'));
        this.updateButton('btn-strb', SimVar.GetSimVarValue('LIGHT STROBE', 'bool'));
        this.updateButton('btn-ldg', SimVar.GetSimVarValue('LIGHT LANDING', 'bool'));
        this.updateButton('btn-taxi', SimVar.GetSimVarValue('LIGHT TAXI', 'bool'));
    }
    
    updateEngine() {
        const running = SimVar.GetSimVarValue('GENERAL ENG COMBUSTION:1', 'bool');
        const throttle = SimVar.GetSimVarValue('GENERAL ENG THROTTLE LEVER POSITION:1', 'percent') || 0;
        
        const engEl = this.querySelector('#acw-eng');
        if (engEl) {
            engEl.textContent = running ? 'RUNNING' : 'OFF';
            engEl.className = 'dv ' + (running ? 'gr' : 'rd');
        }
        
        this.setTxt('acw-thr', Math.round(throttle) + '%');
    }
    
    updateFuel() {
        const fuelQty = SimVar.GetSimVarValue('FUEL TOTAL QUANTITY', 'gallons') || 0;
        const fuelCap = SimVar.GetSimVarValue('FUEL TOTAL CAPACITY', 'gallons') || 100;
        const fuelPct = fuelCap > 0 ? Math.min(100, Math.max(0, (fuelQty / fuelCap) * 100)) : 0;
        
        this.setTxt('acw-fuelqty', Math.round(fuelQty) + ' gal');
        this.setTxt('acw-fuelpct', 'Level (' + Math.round(fuelPct) + '%)');
        
        const fuelBar = this.querySelector('#acw-fuelbar');
        if (fuelBar) {
            fuelBar.style.width = fuelPct + '%';
            fuelBar.className = 'fb ' + (fuelPct > 30 ? 'fh' : fuelPct > 15 ? 'fm' : 'fl');
        }
    }
    
    updateAutopilot() {
        const apOn = SimVar.GetSimVarValue('AUTOPILOT MASTER', 'bool');
        
        const apBtn = this.querySelector('#btn-ap');
        if (apBtn) {
            apBtn.textContent = apOn ? 'AP ON' : 'AP OFF';
            apBtn.className = 'apbtn' + (apOn ? ' on' : '');
        }
        
        this.updateButton('btn-hdg', SimVar.GetSimVarValue('AUTOPILOT HEADING LOCK', 'bool'));
        this.updateButton('btn-apnav', SimVar.GetSimVarValue('AUTOPILOT NAV1 LOCK', 'bool'));
        this.updateButton('btn-alt', SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK', 'bool'));
        this.updateButton('btn-vs', SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD', 'bool'));
        this.updateButton('btn-apr', SimVar.GetSimVarValue('AUTOPILOT APPROACH HOLD', 'bool'));
    }
    
    updateTime() {
        const now = new Date();
        this.setTxt('acw-time', now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}));
    }
    
    updateButton(id, isOn, isWarn = false) {
        const btn = this.querySelector('#' + id);
        if (!btn) return;
        
        btn.classList.remove('on', 'warn');
        if (isOn && !isWarn) btn.classList.add('on');
        if (isWarn) btn.classList.add('warn');
        
        const dot = btn.querySelector('.sd');
        if (dot) {
            dot.classList.remove('on', 'off', 'warn');
            if (isOn && !isWarn) dot.classList.add('on');
            else if (isWarn) dot.classList.add('warn');
            else dot.classList.add('off');
        }
    }
}

// Register custom element
customElements.define('simwidget-panel', SimWidgetPanel);
console.log('[SimWidget] Panel registered');
