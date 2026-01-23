/**
 * Checklist Widget - SimWidget
 * Aircraft-specific checklists for MSFS
 */

// Aircraft-specific checklist definitions
const AIRCRAFT_CHECKLISTS = {
    generic: {
        name: 'Generic GA',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Avionics Master', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Flaps', action: 'UP' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Throttle', action: 'IDLE' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Fuel Pump', action: 'ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Master', action: 'ON' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil Pressure', action: 'GREEN' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Altimeter', action: 'SET' },
                    { text: 'Nav Lights', action: 'ON' },
                    { text: 'Brakes', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Takeoff',
                items: [
                    { text: 'Flaps', action: 'SET' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Mixture', action: 'LEAN' },
                    { text: 'Autopilot', action: 'AS REQ' }
                ]
            },
            landing: {
                name: 'Landing',
                items: [
                    { text: 'ATIS', action: 'RECEIVED' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Flaps', action: 'AS REQ' },
                    { text: 'Lights', action: 'ON' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'CUTOFF' },
                    { text: 'Master', action: 'OFF' }
                ]
            }
        }
    },

    c172: {
        name: 'Cessna 172 Skyhawk',
        checklists: {
            preflight: {
                name: 'Pre-Flight Inspection',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Control Lock', action: 'REMOVE' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Avionics Master', action: 'OFF' },
                    { text: 'Master Switch', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Fuel Shutoff Valve', action: 'ON' },
                    { text: 'Static Source', action: 'OPEN' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Preflight', action: 'COMPLETE' },
                    { text: 'Seats/Belts', action: 'ADJUST & LOCK' },
                    { text: 'Brakes', action: 'TEST & SET' },
                    { text: 'Circuit Breakers', action: 'CHECK IN' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Fuel Shutoff', action: 'ON' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Carburetor Heat', action: 'COLD' },
                    { text: 'Throttle', action: 'OPEN 1/4"' },
                    { text: 'Master Switch', action: 'ON' },
                    { text: 'Beacon Light', action: 'ON' },
                    { text: 'Prime', action: '3-5 STROKES' },
                    { text: 'Throttle', action: 'OPEN 1/2"' },
                    { text: 'Ignition', action: 'START' },
                    { text: 'Oil Pressure', action: 'CHECK GREEN' },
                    { text: 'Avionics Master', action: 'ON' },
                    { text: 'Flaps', action: 'RETRACT' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Parking Brake', action: 'RELEASE' },
                    { text: 'Taxi Light', action: 'ON' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Heading Indicator', action: 'SET' },
                    { text: 'Attitude Indicator', action: 'CHECK' },
                    { text: 'Turn Coordinator', action: 'CHECK' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Seats/Belts', action: 'CHECK' },
                    { text: 'Doors/Windows', action: 'CLOSED & LOCKED' },
                    { text: 'Flight Controls', action: 'FREE & CORRECT' },
                    { text: 'Instruments', action: 'CHECK' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Throttle', action: '1800 RPM' },
                    { text: 'Magnetos', action: 'CHECK (125 RPM MAX DROP)' },
                    { text: 'Carburetor Heat', action: 'CHECK' },
                    { text: 'Engine Instruments', action: 'CHECK GREEN' },
                    { text: 'Throttle', action: '1000 RPM' },
                    { text: 'Flaps', action: '0-10°' },
                    { text: 'Trim', action: 'SET TAKEOFF' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'LANDING, NAV, STROBE ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: '2100-2400 RPM' },
                    { text: 'Mixture', action: 'LEAN FOR ALTITUDE' },
                    { text: 'Trim', action: 'ADJUST' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Engine Instruments', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Seats/Belts', action: 'SECURE' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Mixture', action: 'RICH' },
                    { text: 'Carburetor Heat', action: 'ON (AS REQ)' },
                    { text: 'Landing Light', action: 'ON' },
                    { text: 'Autopilot', action: 'OFF' },
                    { text: 'Flaps', action: 'AS REQUIRED' },
                    { text: 'Airspeed', action: '65-75 KIAS' }
                ]
            },
            shutdown: {
                name: 'Securing Aircraft',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Throttle', action: '1000 RPM' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Mixture', action: 'IDLE CUTOFF' },
                    { text: 'Ignition', action: 'OFF' },
                    { text: 'Master Switch', action: 'OFF' },
                    { text: 'Control Lock', action: 'INSTALL' },
                    { text: 'Fuel Selector', action: 'LEFT or RIGHT' }
                ]
            }
        }
    },

    c208: {
        name: 'Cessna 208 Caravan',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'Oil Level', action: 'CHECK' },
                    { text: 'Exterior', action: 'INSPECT' },
                    { text: 'Control Surfaces', action: 'CHECK' },
                    { text: 'Tires', action: 'CHECK' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'Generator', action: 'RESET/ON' },
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Condition Lever', action: 'CUTOFF' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Power Lever', action: 'IDLE' },
                    { text: 'Starter', action: 'ON AT 13% NG' },
                    { text: 'Condition Lever', action: 'LOW IDLE' },
                    { text: 'ITT', action: 'MONITOR (MAX 1090°)' },
                    { text: 'Oil Pressure', action: 'CHECK' },
                    { text: 'Generator', action: 'CHECK ONLINE' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Flight Instruments', action: 'CHECK' },
                    { text: 'Nav Lights', action: 'ON' },
                    { text: 'Taxi Light', action: 'ON' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: '20°' },
                    { text: 'Trim', action: 'SET' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Autopilot', action: 'OFF' },
                    { text: 'Transponder', action: 'ALT' },
                    { text: 'Lights', action: 'AS REQUIRED' },
                    { text: 'De-Ice', action: 'AS REQUIRED' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Condition', action: 'HIGH IDLE' },
                    { text: 'Prop', action: 'SET RPM' },
                    { text: 'Fuel', action: 'MONITOR' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Fuel Selector', action: 'BOTH' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Airspeed', action: '85-90 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Power', action: 'IDLE' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Condition', action: 'CUTOFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
    },

    tbm930: {
        name: 'TBM 930',
        checklists: {
            preflight: {
                name: 'Pre-Flight',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Fuel Quantity', action: 'CHECK' },
                    { text: 'De-Ice', action: 'CHECK' },
                    { text: 'Exterior', action: 'INSPECT' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery', action: 'ON' },
                    { text: 'Generator', action: 'MAIN ON' },
                    { text: 'Aux BP', action: 'ON' },
                    { text: 'Ignition', action: 'AUTO' },
                    { text: 'Inertial Sep', action: 'ON' },
                    { text: 'Prop', action: 'FEATHER' },
                    { text: 'Starter', action: 'ON' },
                    { text: 'At 13% NG', action: 'FUEL ON' },
                    { text: 'ITT', action: 'MONITOR' },
                    { text: 'At 50% NG', action: 'STARTER OFF' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Aux BP', action: 'OFF' },
                    { text: 'Avionics', action: 'ON' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Trims', action: 'SET' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Brakes', action: 'CHECK' },
                    { text: 'Taxi Light', action: 'ON' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'TAKEOFF' },
                    { text: 'Trims', action: 'SET' },
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Inertial Sep', action: 'AUTO' },
                    { text: 'Transponder', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Strobe', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Power', action: 'SET' },
                    { text: 'Prop', action: '1900 RPM' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Pressurization', action: 'CHECK' }
                ]
            },
            landing: {
                name: 'Before Landing',
                items: [
                    { text: 'Prop', action: 'HIGH RPM' },
                    { text: 'Flaps', action: 'LANDING' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Airspeed', action: '85 KIAS' }
                ]
            },
            shutdown: {
                name: 'Shutdown',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Avionics', action: 'OFF' },
                    { text: 'Fuel', action: 'OFF' },
                    { text: 'Generator', action: 'OFF' },
                    { text: 'Battery', action: 'OFF' }
                ]
            }
        }
    },

    a320: {
        name: 'Airbus A320',
        checklists: {
            preflight: {
                name: 'Cockpit Preparation',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Battery 1 & 2', action: 'ON' },
                    { text: 'External Power', action: 'ON' },
                    { text: 'APU Master', action: 'ON' },
                    { text: 'APU Start', action: 'ON' },
                    { text: 'APU Bleed', action: 'ON' },
                    { text: 'ADIRS', action: 'NAV' },
                    { text: 'Fuel Pumps', action: 'ON' },
                    { text: 'MCDU', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine Mode', action: 'IGN/START' },
                    { text: 'Engine 2 Master', action: 'ON' },
                    { text: 'N2 > 25%', action: 'VERIFY' },
                    { text: 'Engine 1 Master', action: 'ON' },
                    { text: 'N2 > 25%', action: 'VERIFY' },
                    { text: 'Engine Mode', action: 'NORM' },
                    { text: 'APU Bleed', action: 'OFF' },
                    { text: 'APU Master', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Before Taxi',
                items: [
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Flaps', action: 'SET (CONFIG 1+F)' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Auto Brake', action: 'MAX' },
                    { text: 'Nose Light', action: 'TAXI' },
                    { text: 'Parking Brake', action: 'RELEASE' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Transponder', action: 'ON' },
                    { text: 'TCAS', action: 'TA/RA' },
                    { text: 'Weather Radar', action: 'AS REQ' },
                    { text: 'Strobe', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Takeoff Config', action: 'TEST' },
                    { text: 'Cabin', action: 'READY' },
                    { text: 'Packs', action: 'AS REQ' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'ECAM', action: 'CHECK' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Landing Lights', action: 'OFF' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Seat Belt Signs', action: 'ON' },
                    { text: 'Baro Ref', action: 'SET' },
                    { text: 'Auto Brake', action: 'SET' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: 'FULL' },
                    { text: 'Spoilers', action: 'ARM' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engine 1 Master', action: 'OFF' },
                    { text: 'Engine 2 Master', action: 'OFF' },
                    { text: 'APU', action: 'START (AS REQ)' },
                    { text: 'Ext Power', action: 'ON (AS REQ)' },
                    { text: 'Seat Belt Signs', action: 'OFF' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Fuel Pumps', action: 'OFF' }
                ]
            }
        }
    },

    b747: {
        name: 'Boeing 747',
        checklists: {
            preflight: {
                name: 'Cockpit Preparation',
                items: [
                    { text: 'Battery', action: 'ON' },
                    { text: 'External Power', action: 'CONNECT' },
                    { text: 'APU', action: 'START' },
                    { text: 'Hydraulics', action: 'CHECK' },
                    { text: 'IRS', action: 'NAV' },
                    { text: 'FMC', action: 'PROGRAM' }
                ]
            },
            startup: {
                name: 'Engine Start',
                items: [
                    { text: 'Beacon', action: 'ON' },
                    { text: 'Engine Start Selector', action: 'GND' },
                    { text: 'Engine 4 Start', action: 'INITIATE' },
                    { text: 'Engine 3 Start', action: 'INITIATE' },
                    { text: 'Engine 2 Start', action: 'INITIATE' },
                    { text: 'Engine 1 Start', action: 'INITIATE' },
                    { text: 'APU', action: 'OFF' }
                ]
            },
            taxi: {
                name: 'Taxi',
                items: [
                    { text: 'Flaps', action: '10°' },
                    { text: 'Flight Controls', action: 'CHECK' },
                    { text: 'Taxi Light', action: 'ON' },
                    { text: 'Transponder', action: 'TA ONLY' }
                ]
            },
            takeoff: {
                name: 'Before Takeoff',
                items: [
                    { text: 'Flaps', action: 'TAKEOFF' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Auto Throttle', action: 'ARM' },
                    { text: 'Transponder', action: 'TA/RA' },
                    { text: 'Strobe', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' }
                ]
            },
            cruise: {
                name: 'Cruise',
                items: [
                    { text: 'Seat Belt Signs', action: 'AS REQ' },
                    { text: 'Fuel', action: 'MONITOR' },
                    { text: 'Landing Lights', action: 'OFF' }
                ]
            },
            landing: {
                name: 'Approach',
                items: [
                    { text: 'Seat Belt Signs', action: 'ON' },
                    { text: 'Landing Lights', action: 'ON' },
                    { text: 'Gear', action: 'DOWN' },
                    { text: 'Flaps', action: '30°' },
                    { text: 'Spoilers', action: 'ARM' },
                    { text: 'Autobrake', action: 'SET' }
                ]
            },
            shutdown: {
                name: 'Parking',
                items: [
                    { text: 'Parking Brake', action: 'SET' },
                    { text: 'Engines', action: 'CUTOFF' },
                    { text: 'APU', action: 'START' },
                    { text: 'Beacon', action: 'OFF' },
                    { text: 'Seat Belt Signs', action: 'OFF' }
                ]
            }
        }
    }
};

class ChecklistWidget {
    constructor() {
        this.currentAircraft = 'generic';
        this.currentChecklist = 'preflight';
        this.checkedItems = {};
        this.audioEnabled = true;
        this.synth = window.speechSynthesis;

        this.loadState();
        this.initAircraftSelector();
        this.initTabs();
        this.initControls();
        this.renderChecklist();
    }

    get checklists() {
        return AIRCRAFT_CHECKLISTS[this.currentAircraft].checklists;
    }

    loadState() {
        try {
            const saved = localStorage.getItem('checklist-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.checkedItems = state.checkedItems || {};
                this.audioEnabled = state.audioEnabled !== false;
                this.currentAircraft = state.currentAircraft || 'generic';
            }
        } catch (e) {
            console.error('Failed to load checklist state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('checklist-widget-state', JSON.stringify({
                checkedItems: this.checkedItems,
                audioEnabled: this.audioEnabled,
                currentAircraft: this.currentAircraft
            }));
        } catch (e) {
            console.error('Failed to save checklist state:', e);
        }
    }

    initAircraftSelector() {
        const select = document.getElementById('aircraft-select');
        select.value = this.currentAircraft;
        select.addEventListener('change', () => {
            this.currentAircraft = select.value;
            this.currentChecklist = 'preflight';
            this.renderTabs();
            this.renderChecklist();
            this.saveState();
        });
    }

    initTabs() {
        const tabs = document.getElementById('checklist-tabs');
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const checklist = e.target.dataset.checklist;
                this.switchChecklist(checklist);
            }
        });
        this.renderTabs();
    }

    renderTabs() {
        const container = document.getElementById('checklist-tabs');
        container.replaceChildren();

        Object.keys(this.checklists).forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'tab' + (key === this.currentChecklist ? ' active' : '');
            btn.dataset.checklist = key;
            btn.textContent = this.checklists[key].name;

            // Mark completed
            const itemKey = this.currentAircraft + '_' + key;
            const checked = this.checkedItems[itemKey] || [];
            if (checked.length === this.checklists[key].items.length) {
                btn.classList.add('completed');
            }

            container.appendChild(btn);
        });
    }

    initControls() {
        const audioBtn = document.getElementById('btn-audio');
        audioBtn.classList.toggle('active', this.audioEnabled);
        audioBtn.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            audioBtn.classList.toggle('active', this.audioEnabled);
            audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
            this.saveState();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            this.navigateChecklist(-1);
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            this.navigateChecklist(1);
        });
    }

    switchChecklist(name) {
        this.currentChecklist = name;
        this.renderTabs();
        this.renderChecklist();
    }

    createChecklistItem(item, index, isChecked) {
        const div = document.createElement('div');
        div.className = 'checklist-item' + (isChecked ? ' checked' : '');
        div.dataset.index = index;

        const checkbox = document.createElement('div');
        checkbox.className = 'item-checkbox';

        const content = document.createElement('div');
        content.className = 'item-content';

        const textEl = document.createElement('div');
        textEl.className = 'item-text';
        textEl.textContent = item.text;

        const actionEl = document.createElement('div');
        actionEl.className = 'item-action';
        actionEl.textContent = item.action;

        content.appendChild(textEl);
        content.appendChild(actionEl);
        div.appendChild(checkbox);
        div.appendChild(content);

        div.addEventListener('click', () => {
            this.toggleItem(index);
        });

        return div;
    }

    createCompleteMessage(name) {
        const div = document.createElement('div');
        div.className = 'checklist-complete';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.textContent = '✅';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = name + ' Complete!';

        div.appendChild(icon);
        div.appendChild(text);
        return div;
    }

    renderChecklist() {
        const container = document.getElementById('checklist-container');
        const checklist = this.checklists[this.currentChecklist];

        if (!checklist) return;

        container.replaceChildren();

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const allChecked = checked.length === checklist.items.length;

        if (allChecked) {
            container.appendChild(this.createCompleteMessage(checklist.name));
        } else {
            checklist.items.forEach((item, index) => {
                const isChecked = checked.includes(index);
                container.appendChild(this.createChecklistItem(item, index, isChecked));
            });
        }

        this.updateProgress();
        this.renderTabs();
    }

    toggleItem(index) {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        if (!this.checkedItems[itemKey]) {
            this.checkedItems[itemKey] = [];
        }

        const checked = this.checkedItems[itemKey];
        const itemIndex = checked.indexOf(index);

        if (itemIndex === -1) {
            checked.push(index);

            if (this.audioEnabled) {
                const item = checklist.items[index];
                this.speak(item.text + ', ' + item.action);
            }
        } else {
            checked.splice(itemIndex, 1);
        }

        this.saveState();
        this.renderChecklist();
    }

    speak(text) {
        if (!this.synth) return;
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v =>
            v.name.includes('Google UK English Female') ||
            v.name.includes('Microsoft Hazel') ||
            v.lang === 'en-GB'
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.synth.speak(utterance);
    }

    updateProgress() {
        const checklist = this.checklists[this.currentChecklist];
        if (!checklist) return;

        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        const checked = this.checkedItems[itemKey] || [];
        const total = checklist.items.length;
        const completed = checked.length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progress-fill').style.width = percent + '%';
        document.getElementById('progress-text').textContent = completed + '/' + total;
    }

    resetChecklist() {
        const itemKey = this.currentAircraft + '_' + this.currentChecklist;
        this.checkedItems[itemKey] = [];
        this.saveState();
        this.renderChecklist();
    }

    navigateChecklist(direction) {
        const keys = Object.keys(this.checklists);
        const currentIndex = keys.indexOf(this.currentChecklist);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = keys.length - 1;
        if (newIndex >= keys.length) newIndex = 0;

        this.switchChecklist(keys[newIndex]);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.checklistWidget = new ChecklistWidget();
});
