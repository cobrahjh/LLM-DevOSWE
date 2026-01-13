/**
 * Aircraft Control Widget for SimWidget Engine
 * Ported from Flow Pro v3.7
 */

(function() {
    // Widget class
    class AircraftControlWidget {
        constructor(el, $api, engine) {
            this.hostEl = el;
            this.$api = $api;
            this.engine = engine;
            this.panelEl = null;
            this.rootEl = null;
            this.btns = {};
            this.settingsOpen = false;
            this.designerOpen = false;
            this.selectedComponent = null;
            this.editingPanel = null;
            
            // Component types for designer
            this.componentTypes = [
                { type: 'display', name: 'Data', icon: '#', desc: 'Show value', simvarType: 'numeric' },
                { type: 'button', name: 'Button', icon: 'B', desc: 'K: command', simvarType: 'bool' },
                { type: 'indicator', name: 'Light', icon: 'o', desc: 'On/off', simvarType: 'bool' },
                { type: 'gauge', name: 'Gauge', icon: '=', desc: '0-100%', simvarType: 'percent' },
                { type: 'label', name: 'Label', icon: 'T', desc: 'Text', simvarType: null },
                { type: 'spacer', name: 'Space', icon: '_', desc: 'Gap', simvarType: null }
            ];

            // Categorized simvars
            this.simvarCategories = {
                numeric: [
                    { var: 'A:INDICATED ALTITUDE', unit: 'feet', name: 'Altitude', suffix: 'ft' },
                    { var: 'A:AIRSPEED INDICATED', unit: 'knots', name: 'Airspeed', suffix: 'kts' },
                    { var: 'A:GROUND VELOCITY', unit: 'knots', name: 'Ground Speed', suffix: 'kts' },
                    { var: 'A:HEADING INDICATOR', unit: 'degrees', name: 'Heading', suffix: '°' },
                    { var: 'A:VERTICAL SPEED', unit: 'feet per minute', name: 'Vertical Speed', suffix: 'fpm' },
                    { var: 'A:FUEL TOTAL QUANTITY', unit: 'gallons', name: 'Fuel Total', suffix: 'gal' },
                    { var: 'A:AUTOPILOT ALTITUDE LOCK VAR', unit: 'feet', name: 'AP Alt Setting', suffix: 'ft' },
                    { var: 'A:AUTOPILOT HEADING LOCK DIR', unit: 'degrees', name: 'AP Hdg Bug', suffix: '°' }
                ],
                percent: [
                    { var: 'A:GENERAL ENG THROTTLE LEVER POSITION:1', unit: 'percent', name: 'Throttle 1' },
                    { var: 'A:FLAPS HANDLE PERCENT', unit: 'percent', name: 'Flaps' },
                    { var: 'A:ENG N1 RPM:1', unit: 'percent', name: 'N1 Eng 1' }
                ],
                bool: [
                    { var: 'A:LIGHT NAV', unit: 'bool', name: 'NAV Light' },
                    { var: 'A:LIGHT BEACON', unit: 'bool', name: 'Beacon Light' },
                    { var: 'A:LIGHT STROBE', unit: 'bool', name: 'Strobe Light' },
                    { var: 'A:LIGHT LANDING', unit: 'bool', name: 'Landing Light' },
                    { var: 'A:LIGHT TAXI', unit: 'bool', name: 'Taxi Light' },
                    { var: 'A:AUTOPILOT MASTER', unit: 'bool', name: 'AP Master' },
                    { var: 'A:AUTOPILOT HEADING LOCK', unit: 'bool', name: 'AP HDG Mode' },
                    { var: 'A:AUTOPILOT ALTITUDE LOCK', unit: 'bool', name: 'AP ALT Mode' },
                    { var: 'A:BRAKE PARKING POSITION', unit: 'bool', name: 'Parking Brake' },
                    { var: 'A:GEAR HANDLE POSITION', unit: 'bool', name: 'Gear Handle' },
                    { var: 'A:GENERAL ENG COMBUSTION:1', unit: 'bool', name: 'Engine 1 Running' }
                ]
            };
            
            // Command categories
            this.commandCategories = {
                lights: [
                    { cmd: 'K:TOGGLE_NAV_LIGHTS', name: 'Toggle NAV' },
                    { cmd: 'K:TOGGLE_BEACON_LIGHTS', name: 'Toggle Beacon' },
                    { cmd: 'K:STROBES_TOGGLE', name: 'Toggle Strobes' },
                    { cmd: 'K:LANDING_LIGHTS_TOGGLE', name: 'Toggle Landing' },
                    { cmd: 'K:TOGGLE_TAXI_LIGHTS', name: 'Toggle Taxi' }
                ],
                systems: [
                    { cmd: 'K:PARKING_BRAKES', name: 'Toggle P.Brake' },
                    { cmd: 'K:GEAR_TOGGLE', name: 'Toggle Gear' },
                    { cmd: 'K:FLAPS_INCR', name: 'Flaps Down' },
                    { cmd: 'K:FLAPS_DECR', name: 'Flaps Up' }
                ],
                autopilot: [
                    { cmd: 'K:AP_MASTER', name: 'AP Master' },
                    { cmd: 'K:AP_PANEL_HEADING_HOLD', name: 'AP Heading' },
                    { cmd: 'K:AP_PANEL_ALTITUDE_HOLD', name: 'AP Altitude' },
                    { cmd: 'K:AP_NAV1_HOLD', name: 'AP NAV' },
                    { cmd: 'K:AP_APR_HOLD', name: 'AP Approach' }
                ],
                engine: [
                    { cmd: 'K:TOGGLE_STARTER1', name: 'Starter 1' },
                    { cmd: 'K:TOGGLE_MASTER_BATTERY', name: 'Master Battery' }
                ]
            };

            // Default sections
            this.defaultSections = [
                { id: 'sec-flight', name: 'Flight Data', visible: true },
                { id: 'sec-systems', name: 'Systems', visible: true },
                { id: 'sec-lights', name: 'Lights', visible: true },
                { id: 'sec-engine', name: 'Engine', visible: true },
                { id: 'sec-fuel', name: 'Fuel', visible: true },
                { id: 'sec-ap', name: 'Autopilot', visible: true }
            ];
            
            // Widget state
            this.store = { 
                enabled: true, x: null, y: null, width: 340,
                sections: null,
                customPanels: []
            };
            
            // Button commands
            this.btnCmds = {
                'btn-brk': 'K:PARKING_BRAKES', 'btn-gear': 'K:GEAR_TOGGLE',
                'btn-nav': 'K:TOGGLE_NAV_LIGHTS', 'btn-bcn': 'K:TOGGLE_BEACON_LIGHTS',
                'btn-strb': 'K:STROBES_TOGGLE', 'btn-ldg': 'K:LANDING_LIGHTS_TOGGLE', 
                'btn-taxi': 'K:TOGGLE_TAXI_LIGHTS',
                'btn-ap': 'K:AP_MASTER', 'btn-hdg': 'K:AP_PANEL_HEADING_HOLD', 
                'btn-apnav': 'K:AP_NAV1_HOLD',
                'btn-alt': 'K:AP_PANEL_ALTITUDE_HOLD', 'btn-vs': 'K:AP_PANEL_VS_HOLD',
                'btn-apr': 'K:AP_APR_HOLD', 'btn-loc': 'K:AP_LOC_HOLD', 
                'btn-flc': 'K:FLIGHT_LEVEL_CHANGE'
            };
            
            this.scrollCmds = { 
                'btn-flaps': ['K:FLAPS_DECR', 'K:FLAPS_INCR'], 
                'btn-hdg': ['K:HEADING_BUG_INC', 'K:HEADING_BUG_DEC'] 
            };
            
            this.init();
        }
        
        init() {
            console.log('[ACW] Initializing Aircraft Control Widget');
            this.loadStore();
            this.setupDragResize();
            this.buildButtons();
            this.setupEvents();
            this.applySectionOrder();
            this.renderCustomPanels();
            this.startUpdateLoop();
        }
        
        loadStore() {
            try {
                const saved = this.$api.datastore.import();
                if (saved) {
                    this.store = { ...this.store, ...saved };
                }
            } catch(e) {
                console.log('[ACW] Store load error:', e);
            }
        }
        
        saveStore() {
            try {
                this.$api.datastore.export(this.store);
            } catch(e) {
                console.log('[ACW] Store save error:', e);
            }
        }

        sendCmd(cmd) {
            if (this.$api && this.$api.variables) {
                this.$api.variables.set(cmd, 'Number', 1);
            }
        }
        
        getVar(simvar, unit) {
            if (this.$api && this.$api.variables) {
                return this.$api.variables.get(simvar, unit) || 0;
            }
            return 0;
        }
        
        getSections() {
            if (this.store.sections && this.store.sections.length === this.defaultSections.length) {
                return this.store.sections;
            }
            return this.defaultSections.map(s => ({ ...s }));
        }
        
        setupDragResize() {
            const root = this.hostEl.querySelector('#acw-root');
            const panel = this.hostEl.querySelector('.acw');
            const header = this.hostEl.querySelector('.hdr');
            const resize = this.hostEl.querySelector('.resize-handle');
            
            if (!root || !panel || !header) return;
            
            this.rootEl = root;
            this.panelEl = panel;
            
            root.style.position = 'absolute';
            panel.style.width = this.store.width + 'px';
            
            // Set initial position
            if (!this.store.x || !this.store.y) {
                setTimeout(() => this.centerPanel(), 100);
            } else {
                root.style.left = this.store.x + 'px';
                root.style.top = this.store.y + 'px';
            }
            
            // Drag handling
            let isDragging = false, dragStartX, dragStartY, origX, origY;
            const self = this;
            
            header.onmousedown = (e) => {
                if (e.target.classList.contains('settings-btn') || 
                    e.target.classList.contains('designer-btn')) return;
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                origX = root.offsetLeft;
                origY = root.offsetTop;
                e.preventDefault();
            };
            
            // Resize handling
            let isResizing = false, resizeStartX, origWidth;
            if (resize) {
                resize.onmousedown = (e) => {
                    isResizing = true;
                    resizeStartX = e.clientX;
                    origWidth = panel.offsetWidth;
                    e.preventDefault();
                    e.stopPropagation();
                };
            }
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    root.style.left = (origX + e.clientX - dragStartX) + 'px';
                    root.style.top = (origY + e.clientY - dragStartY) + 'px';
                }
                if (isResizing) {
                    panel.style.width = Math.max(300, Math.min(600, origWidth + e.clientX - resizeStartX)) + 'px';
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.store.x = root.offsetLeft;
                    this.store.y = root.offsetTop;
                    this.saveStore();
                }
                if (isResizing) {
                    isResizing = false;
                    this.store.width = panel.offsetWidth;
                    this.saveStore();
                }
            });
        }
        
        centerPanel() {
            if (!this.rootEl) return;
            const pw = window.innerWidth || 1920;
            const ph = window.innerHeight || 1080;
            this.store.x = Math.max(50, Math.round((pw - 340) / 2));
            this.store.y = Math.max(50, Math.round((ph - 500) / 2));
            this.rootEl.style.left = this.store.x + 'px';
            this.rootEl.style.top = this.store.y + 'px';
            this.saveStore();
        }

        buildButtons() {
            const el = this.hostEl;
            
            const sysRow = el.querySelector('#acw-systems');
            if (sysRow) {
                sysRow.innerHTML = `
                    <div class="btn" id="btn-brk" data-cmd="btn-brk"><div class="sd off"></div><span>P.BRK</span></div>
                    <div class="btn" id="btn-gear" data-cmd="btn-gear"><div class="sd off"></div><span>GEAR</span></div>
                    <div class="btn scrollable" id="btn-flaps" data-cmd="btn-flaps" data-scroll="btn-flaps"><div class="sd off"></div><span>FLAPS</span></div>
                `;
            }
            
            const lightsRow = el.querySelector('#acw-lights');
            if (lightsRow) {
                lightsRow.innerHTML = `
                    <div class="btn" id="btn-nav" data-cmd="btn-nav"><div class="sd off"></div><span>NAV</span></div>
                    <div class="btn" id="btn-bcn" data-cmd="btn-bcn"><div class="sd off"></div><span>BCN</span></div>
                    <div class="btn" id="btn-strb" data-cmd="btn-strb"><div class="sd off"></div><span>STRB</span></div>
                    <div class="btn" id="btn-ldg" data-cmd="btn-ldg"><div class="sd off"></div><span>LDG</span></div>
                    <div class="btn" id="btn-taxi" data-cmd="btn-taxi"><div class="sd off"></div><span>TAXI</span></div>
                `;
            }
            
            const apRow = el.querySelector('#acw-ap');
            if (apRow) {
                apRow.innerHTML = '<div class="apbtn" id="btn-ap" data-cmd="btn-ap">AP OFF</div>';
            }
            
            const apModes = el.querySelector('#acw-ap-modes');
            if (apModes) {
                apModes.innerHTML = `
                    <div class="ambtn scrollable" id="btn-hdg" data-cmd="btn-hdg" data-scroll="btn-hdg">HDG</div>
                    <div class="ambtn" id="btn-apnav" data-cmd="btn-apnav">NAV</div>
                    <div class="ambtn scrollable" id="btn-alt" data-cmd="btn-alt" data-scroll="btn-alt">ALT</div>
                    <div class="ambtn scrollable" id="btn-vs" data-cmd="btn-vs" data-scroll="btn-vs">VS</div>
                    <div class="ambtn" id="btn-apr" data-cmd="btn-apr">APR</div>
                    <div class="ambtn" id="btn-loc" data-cmd="btn-loc">LOC</div>
                    <div class="ambtn scrollable" id="btn-flc" data-cmd="btn-flc" data-scroll="btn-flc">FLC</div>
                `;
            }
            
            // Cache button references
            const ids = ['btn-brk','btn-gear','btn-flaps','btn-nav','btn-bcn','btn-strb',
                        'btn-ldg','btn-taxi','btn-ap','btn-hdg','btn-apnav','btn-alt',
                        'btn-vs','btn-apr','btn-loc','btn-flc'];
            ids.forEach(id => {
                this.btns[id] = el.querySelector('#' + id);
            });
        }
        
        setupEvents() {
            const el = this.hostEl;
            const self = this;
            
            // Settings button
            const settingsBtn = el.querySelector('.settings-btn');
            if (settingsBtn) {
                settingsBtn.onclick = (e) => { this.toggleSettings(); e.stopPropagation(); };
            }
            
            // Designer button
            const designerBtn = el.querySelector('.designer-btn');
            if (designerBtn) {
                designerBtn.onclick = (e) => { this.toggleDesigner(); e.stopPropagation(); };
            }
            
            // Close buttons
            const closeSettings = el.querySelector('#acw-settings-close');
            const closeDesigner = el.querySelector('#acw-designer-close');
            if (closeSettings) closeSettings.onclick = (e) => { this.toggleSettings(); e.stopPropagation(); };
            if (closeDesigner) closeDesigner.onclick = (e) => { this.toggleDesigner(); e.stopPropagation(); };
            
            // Settings panel clicks
            const settingsPanel = el.querySelector('#acw-settings');
            if (settingsPanel) {
                settingsPanel.onclick = (e) => {
                    const action = e.target.getAttribute('data-action');
                    const idx = e.target.getAttribute('data-idx');
                    if (action && idx !== null) this.handleSettingsAction(action, idx);
                    e.stopPropagation();
                };
            }
            
            // Button clicks
            el.addEventListener('click', (e) => {
                let target = e.target;
                while (target && target !== el) {
                    const cmd = target.getAttribute('data-cmd');
                    if (cmd && this.btnCmds[cmd]) {
                        this.sendCmd(this.btnCmds[cmd]);
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                    }
                    // Custom commands
                    const customCmd = target.getAttribute('data-custom-cmd');
                    if (customCmd) {
                        this.sendCmd(customCmd);
                        e.stopPropagation();
                        return;
                    }
                    target = target.parentElement;
                }
            }, true);
            
            // Scroll events for buttons
            el.addEventListener('wheel', (e) => {
                let target = e.target;
                while (target && target !== el) {
                    const scroll = target.getAttribute('data-scroll');
                    if (scroll && this.scrollCmds[scroll]) {
                        const direction = e.deltaY < 0 ? 1 : -1;
                        this.sendCmd(direction > 0 ? this.scrollCmds[scroll][0] : this.scrollCmds[scroll][1]);
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                    }
                    target = target.parentElement;
                }
            }, true);
        }

        startUpdateLoop() {
            // Use engine's loop_1hz
            this.engine.callbacks.loop_1hz.push(() => this.update());
        }
        
        update() {
            if (!this.hostEl) return;
            if (this.designerOpen || this.settingsOpen) return;
            
            const setTxt = (id, txt) => {
                const e = this.hostEl.querySelector('#' + id);
                if (e) e.textContent = txt;
            };
            
            // Flight data
            setTxt('acw-alt', Math.round(this.getVar('A:INDICATED ALTITUDE', 'feet')).toLocaleString() + ' ft');
            setTxt('acw-spd', Math.round(this.getVar('A:AIRSPEED INDICATED', 'knots')) + ' kts');
            setTxt('acw-hdg', String(Math.round(this.getVar('A:HEADING INDICATOR', 'degrees'))).padStart(3, '0') + '°');
            const vsVal = this.getVar('A:VERTICAL SPEED', 'feet per minute');
            setTxt('acw-vs', (vsVal >= 0 ? '+' : '') + Math.round(vsVal) + ' fpm');
            
            // Engine
            const engRunning = this.getVar('A:GENERAL ENG COMBUSTION:1', 'bool');
            const engEl = this.hostEl.querySelector('#acw-eng');
            if (engEl) {
                engEl.textContent = engRunning ? 'RUNNING' : 'OFF';
                engEl.className = 'dv ' + (engRunning ? 'gr' : 'rd');
            }
            setTxt('acw-thr', Math.round(this.getVar('A:GENERAL ENG THROTTLE LEVER POSITION:1', 'percent')) + '%');
            
            // Fuel
            const fuelQty = this.getVar('A:FUEL TOTAL QUANTITY', 'gallons');
            setTxt('acw-fuelqty', Math.round(fuelQty) + ' gal');
            const fuelPct = Math.min(100, Math.max(0, fuelQty / 100 * 100)); // Approximate
            setTxt('acw-fuelpct', 'Level (' + Math.round(fuelPct) + '%)');
            const fuelBar = this.hostEl.querySelector('#acw-fuelbar');
            if (fuelBar) {
                fuelBar.style.width = fuelPct + '%';
                fuelBar.className = 'fb ' + (fuelPct > 30 ? 'fh' : fuelPct > 15 ? 'fm' : 'fl');
            }
            
            // Update buttons
            const updateBtn = (id, isOn, isWarn) => {
                const btn = this.btns[id];
                if (!btn) return;
                btn.className = btn.className.replace(/ ?on| ?warn/g, '') + (isOn && !isWarn ? ' on' : '') + (isWarn ? ' warn' : '');
                const dot = btn.querySelector('.sd');
                if (dot) dot.className = 'sd ' + (isOn && !isWarn ? 'on' : isWarn ? 'warn' : 'off');
            };
            
            // Lights
            updateBtn('btn-nav', this.getVar('A:LIGHT NAV', 'bool'));
            updateBtn('btn-bcn', this.getVar('A:LIGHT BEACON', 'bool'));
            updateBtn('btn-strb', this.getVar('A:LIGHT STROBE', 'bool'));
            updateBtn('btn-ldg', this.getVar('A:LIGHT LANDING', 'bool'));
            updateBtn('btn-taxi', this.getVar('A:LIGHT TAXI', 'bool'));
            
            // Systems
            const pbrk = this.getVar('A:BRAKE PARKING POSITION', 'bool');
            updateBtn('btn-brk', pbrk, pbrk);
            updateBtn('btn-gear', this.getVar('A:GEAR HANDLE POSITION', 'bool'));
            
            // Autopilot
            const apOn = this.getVar('A:AUTOPILOT MASTER', 'bool');
            const apBtn = this.btns['btn-ap'];
            if (apBtn) {
                apBtn.textContent = apOn ? 'AP ON' : 'AP OFF';
                apBtn.className = 'apbtn' + (apOn ? ' on' : '');
            }
            
            updateBtn('btn-hdg', this.getVar('A:AUTOPILOT HEADING LOCK', 'bool'));
            updateBtn('btn-alt', this.getVar('A:AUTOPILOT ALTITUDE LOCK', 'bool'));
            updateBtn('btn-vs', this.getVar('A:AUTOPILOT VERTICAL HOLD', 'bool'));
            updateBtn('btn-apnav', this.getVar('A:AUTOPILOT NAV1 LOCK', 'bool'));
            updateBtn('btn-apr', this.getVar('A:AUTOPILOT APPROACH HOLD', 'bool'));
            
            // Time
            setTxt('acw-time', new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}));
            
            // Update custom panels
            this.updateCustomPanels();
        }
        
        // Settings
        toggleSettings() {
            this.settingsOpen = !this.settingsOpen;
            this.designerOpen = false;
            const settingsPanel = this.hostEl.querySelector('#acw-settings');
            const designerPanel = this.hostEl.querySelector('#acw-designer');
            const mainContent = this.hostEl.querySelector('#acw-content');
            
            if (settingsPanel) settingsPanel.style.display = this.settingsOpen ? 'block' : 'none';
            if (designerPanel) designerPanel.style.display = 'none';
            if (mainContent) mainContent.style.display = this.settingsOpen ? 'none' : 'block';
            
            if (this.settingsOpen) this.renderSettings();
        }
        
        renderSettings() {
            const panel = this.hostEl.querySelector('#acw-settings-list');
            if (!panel) return;
            const sections = this.getSections();
            let html = '';
            sections.forEach((s, i) => {
                html += `<div class="settings-item" data-idx="${i}">
                    <input type="checkbox" ${s.visible ? 'checked' : ''} data-action="toggle" data-idx="${i}">
                    <span class="settings-name">${s.name}</span>
                    <div class="settings-arrows">
                        ${i > 0 ? `<span class="arrow-btn" data-action="up" data-idx="${i}">↑</span>` : ''}
                        ${i < sections.length - 1 ? `<span class="arrow-btn" data-action="down" data-idx="${i}">↓</span>` : ''}
                    </div>
                </div>`;
            });
            panel.innerHTML = html;
        }
        
        handleSettingsAction(action, idx) {
            const sections = this.getSections();
            idx = parseInt(idx);
            if (action === 'toggle') sections[idx].visible = !sections[idx].visible;
            else if (action === 'up' && idx > 0) {
                [sections[idx], sections[idx-1]] = [sections[idx-1], sections[idx]];
            }
            else if (action === 'down' && idx < sections.length-1) {
                [sections[idx], sections[idx+1]] = [sections[idx+1], sections[idx]];
            }
            this.store.sections = sections;
            this.saveStore();
            this.renderSettings();
            this.applySectionOrder();
        }
        
        applySectionOrder() {
            const sections = this.getSections();
            sections.forEach((s, i) => {
                const el = this.hostEl.querySelector('#' + s.id);
                if (el) {
                    el.style.display = s.visible ? 'block' : 'none';
                    el.style.order = i;
                }
            });
        }

        // Designer
        toggleDesigner() {
            this.designerOpen = !this.designerOpen;
            this.settingsOpen = false;
            const designerPanel = this.hostEl.querySelector('#acw-designer');
            const settingsPanel = this.hostEl.querySelector('#acw-settings');
            const mainContent = this.hostEl.querySelector('#acw-content');
            
            if (designerPanel) designerPanel.style.display = this.designerOpen ? 'block' : 'none';
            if (settingsPanel) settingsPanel.style.display = 'none';
            if (mainContent) mainContent.style.display = this.designerOpen ? 'none' : 'block';
            
            if (this.designerOpen) {
                this.editingPanel = { name: 'My Custom Panel', components: [] };
                this.selectedComponent = null;
                this.renderDesigner();
            }
        }
        
        renderDesigner() {
            const toolbox = this.hostEl.querySelector('#designer-toolbox');
            if (toolbox) {
                let html = '<div class="designer-section-title">Components</div>';
                this.componentTypes.forEach(c => {
                    html += `<div class="toolbox-item" data-type="${c.type}">
                        <span class="toolbox-icon">${c.icon}</span>
                        <div class="toolbox-text">
                            <span class="toolbox-name">${c.name}</span>
                            <span class="toolbox-desc">${c.desc}</span>
                        </div>
                    </div>`;
                });
                toolbox.innerHTML = html;
                
                // Click handlers
                toolbox.querySelectorAll('.toolbox-item').forEach(item => {
                    item.onclick = () => this.addComponent(item.getAttribute('data-type'));
                });
            }
            this.renderCanvas();
            this.renderProps();
            
            // Save button
            const saveBtn = this.hostEl.querySelector('#designer-save');
            if (saveBtn) {
                saveBtn.onclick = () => this.saveCustomPanel();
            }
        }
        
        renderCanvas() {
            const canvas = this.hostEl.querySelector('#designer-canvas');
            if (!canvas || !this.editingPanel) return;
            
            let html = `<div class="canvas-header">
                <input type="text" class="panel-name-input" value="${this.editingPanel.name}" 
                       id="panel-name-input" placeholder="Panel Name">
            </div>`;
            html += '<div class="canvas-components">';
            
            if (this.editingPanel.components.length === 0) {
                html += '<div class="canvas-empty">Click components to add</div>';
            } else {
                this.editingPanel.components.forEach((comp, i) => {
                    const selected = this.selectedComponent === i ? ' selected' : '';
                    html += `<div class="canvas-item${selected}" data-idx="${i}">
                        <span class="canvas-item-icon">${this.getComponentIcon(comp.type)}</span>
                        <span class="canvas-item-label">${comp.label || comp.type}</span>
                        <div class="canvas-item-actions">
                            ${i > 0 ? `<span class="canvas-item-up" data-action="moveup" data-idx="${i}">↑</span>` : ''}
                            ${i < this.editingPanel.components.length - 1 ? `<span class="canvas-item-down" data-action="movedown" data-idx="${i}">↓</span>` : ''}
                            <span class="canvas-item-delete" data-action="delete" data-idx="${i}">×</span>
                        </div>
                    </div>`;
                });
            }
            html += '</div>';
            canvas.innerHTML = html;
            
            // Event handlers
            canvas.querySelectorAll('.canvas-item').forEach(item => {
                item.onclick = (e) => {
                    if (!e.target.getAttribute('data-action')) {
                        this.selectComponent(parseInt(item.getAttribute('data-idx')));
                    }
                };
            });
            canvas.querySelectorAll('[data-action]').forEach(btn => {
                btn.onclick = (e) => {
                    const action = btn.getAttribute('data-action');
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    if (action === 'delete') this.deleteComponent(idx);
                    else if (action === 'moveup') this.moveComponent(idx, -1);
                    else if (action === 'movedown') this.moveComponent(idx, 1);
                    e.stopPropagation();
                };
            });
            
            // Name input
            const nameInput = canvas.querySelector('#panel-name-input');
            if (nameInput) {
                nameInput.onchange = () => { this.editingPanel.name = nameInput.value; };
            }
        }
        
        getComponentIcon(type) {
            const comp = this.componentTypes.find(c => c.type === type);
            return comp ? comp.icon : '?';
        }
        
        addComponent(type) {
            if (!this.editingPanel) return;
            const labels = { display: 'Value', button: 'Button', indicator: 'Status', gauge: 'Gauge', label: 'Label', spacer: '' };
            this.editingPanel.components.push({ type, label: labels[type] || type });
            this.selectedComponent = this.editingPanel.components.length - 1;
            this.renderCanvas();
            this.renderProps();
        }
        
        selectComponent(idx) {
            this.selectedComponent = idx;
            this.renderCanvas();
            this.renderProps();
        }
        
        deleteComponent(idx) {
            if (!this.editingPanel) return;
            this.editingPanel.components.splice(idx, 1);
            if (this.selectedComponent >= this.editingPanel.components.length) {
                this.selectedComponent = this.editingPanel.components.length > 0 ? this.editingPanel.components.length - 1 : null;
            }
            this.renderCanvas();
            this.renderProps();
        }
        
        moveComponent(idx, direction) {
            if (!this.editingPanel) return;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= this.editingPanel.components.length) return;
            [this.editingPanel.components[idx], this.editingPanel.components[newIdx]] = 
            [this.editingPanel.components[newIdx], this.editingPanel.components[idx]];
            this.selectedComponent = newIdx;
            this.renderCanvas();
        }

        renderProps() {
            const props = this.hostEl.querySelector('#designer-props');
            if (!props) return;
            
            if (this.selectedComponent === null || !this.editingPanel || !this.editingPanel.components[this.selectedComponent]) {
                props.innerHTML = '<div class="props-empty">Select a component to edit</div>';
                return;
            }
            
            const comp = this.editingPanel.components[this.selectedComponent];
            let html = '<div class="designer-section-title">Properties</div>';
            html += `<div class="prop-row"><label>Label</label><input type="text" id="prop-label" value="${comp.label || ''}"></div>`;
            
            // Type-specific properties
            if (comp.type === 'display' || comp.type === 'indicator' || comp.type === 'gauge') {
                const simvars = this.getSimvarsForType(comp.type);
                html += '<div class="prop-row"><label>Data Source</label><select id="prop-simvar" size="5">';
                html += '<option value="">-- Select --</option>';
                simvars.forEach(sv => {
                    const sel = comp.simvar === sv.var ? ' selected' : '';
                    html += `<option value="${sv.var}|${sv.unit}|${sv.suffix || ''}"${sel}>${sv.name}</option>`;
                });
                html += '</select></div>';
            }
            
            if (comp.type === 'button') {
                html += '<div class="prop-row"><label>Command</label><select id="prop-command" size="5">';
                html += '<option value="">-- Select --</option>';
                Object.entries(this.commandCategories).forEach(([cat, cmds]) => {
                    html += `<optgroup label="${cat}">`;
                    cmds.forEach(cmd => {
                        const sel = comp.command === cmd.cmd ? ' selected' : '';
                        html += `<option value="${cmd.cmd}"${sel}>${cmd.name}</option>`;
                    });
                    html += '</optgroup>';
                });
                html += '</select></div>';
            }
            
            if (comp.type === 'label') {
                html += `<div class="prop-row"><label>Text</label><input type="text" id="prop-text" value="${comp.text || ''}"></div>`;
            }
            
            props.innerHTML = html;
            
            // Event handlers
            const labelInput = props.querySelector('#prop-label');
            if (labelInput) labelInput.onchange = () => { comp.label = labelInput.value; this.renderCanvas(); };
            
            const simvarSelect = props.querySelector('#prop-simvar');
            if (simvarSelect) {
                simvarSelect.onchange = () => {
                    const parts = simvarSelect.value.split('|');
                    comp.simvar = parts[0];
                    comp.unit = parts[1] || '';
                    comp.suffix = parts[2] || '';
                };
            }
            
            const cmdSelect = props.querySelector('#prop-command');
            if (cmdSelect) cmdSelect.onchange = () => { comp.command = cmdSelect.value; };
            
            const textInput = props.querySelector('#prop-text');
            if (textInput) textInput.onchange = () => { comp.text = textInput.value; };
        }
        
        getSimvarsForType(compType) {
            const typeToCategory = { 'display': 'numeric', 'indicator': 'bool', 'gauge': 'percent' };
            return this.simvarCategories[typeToCategory[compType]] || [];
        }
        
        saveCustomPanel() {
            if (!this.editingPanel || this.editingPanel.components.length === 0) return;
            
            const nameInput = this.hostEl.querySelector('#panel-name-input');
            if (nameInput) this.editingPanel.name = nameInput.value || 'My Panel';
            
            this.editingPanel.id = 'custom-' + Date.now();
            this.store.customPanels.push(JSON.parse(JSON.stringify(this.editingPanel)));
            this.saveStore();
            
            this.toggleDesigner();
            this.renderCustomPanels();
        }

        renderCustomPanels() {
            const container = this.hostEl.querySelector('#acw-custom-panels');
            if (!container) return;
            
            if (!this.store.customPanels || this.store.customPanels.length === 0) {
                container.innerHTML = '';
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'block';
            let html = '';
            
            this.store.customPanels.forEach((panel, p) => {
                html += `<div class="sec custom-panel" id="${panel.id}">
                    <div class="sh">${panel.name} <span class="delete-panel" data-panel-idx="${p}">DEL</span></div>
                    <div class="custom-panel-content">`;
                
                panel.components.forEach((comp, c) => {
                    html += this.renderCustomComponent(comp, p, c);
                });
                
                html += '</div></div>';
            });
            
            container.innerHTML = html;
            
            // Delete panel handlers
            container.querySelectorAll('.delete-panel').forEach(btn => {
                btn.onclick = (e) => {
                    this.deleteCustomPanel(parseInt(btn.getAttribute('data-panel-idx')));
                    e.stopPropagation();
                };
            });
        }
        
        renderCustomComponent(comp, panelIdx, compIdx) {
            const id = `custom-${panelIdx}-${compIdx}`;
            
            switch (comp.type) {
                case 'display':
                    return `<div class="di custom-display" id="${id}">
                        <div class="dl">${comp.label}</div>
                        <div class="dv" id="${id}-val">--</div>
                    </div>`;
                case 'button':
                    return `<div class="btn custom-btn" id="${id}" data-custom-cmd="${comp.command || ''}">
                        <span>${comp.label}</span>
                    </div>`;
                case 'indicator':
                    return `<div class="custom-indicator" id="${id}">
                        <div class="sd off" id="${id}-ind"></div>
                        <span>${comp.label}</span>
                    </div>`;
                case 'gauge':
                    return `<div class="di full custom-gauge" id="${id}">
                        <div class="dl">${comp.label}</div>
                        <div class="fbc"><div class="fb fh" id="${id}-bar" style="width:0%"></div></div>
                    </div>`;
                case 'label':
                    return `<div class="custom-label">${comp.text || comp.label}</div>`;
                case 'spacer':
                    return '<div class="custom-spacer"></div>';
                default:
                    return '';
            }
        }
        
        deleteCustomPanel(idx) {
            if (!this.store.customPanels) return;
            this.store.customPanels.splice(idx, 1);
            this.saveStore();
            this.renderCustomPanels();
        }
        
        updateCustomPanels() {
            if (!this.store.customPanels) return;
            
            this.store.customPanels.forEach((panel, p) => {
                panel.components.forEach((comp, c) => {
                    const id = `custom-${p}-${c}`;
                    
                    if (comp.type === 'display' && comp.simvar) {
                        const val = this.getVar(comp.simvar, comp.unit);
                        const el = this.hostEl.querySelector(`#${id}-val`);
                        if (el) {
                            const formatted = Number.isInteger(val) ? val : val.toFixed(comp.decimals || 0);
                            el.textContent = formatted + (comp.suffix || '');
                        }
                    }
                    
                    if (comp.type === 'indicator' && comp.simvar) {
                        const val = this.getVar(comp.simvar, 'bool');
                        const el = this.hostEl.querySelector(`#${id}-ind`);
                        if (el) el.className = 'sd ' + (val ? 'on' : 'off');
                    }
                    
                    if (comp.type === 'gauge' && comp.simvar) {
                        const val = Math.min(100, Math.max(0, this.getVar(comp.simvar, 'percent')));
                        const el = this.hostEl.querySelector(`#${id}-bar`);
                        if (el) el.style.width = val + '%';
                    }
                });
            });
        }
    }
    
    // Register widget with engine
    window.AircraftControlWidget = AircraftControlWidget;
    
    console.log('[ACW] Aircraft Control Widget loaded');
})();
