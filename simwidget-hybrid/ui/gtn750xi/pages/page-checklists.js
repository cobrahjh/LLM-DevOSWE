/**
 * GTN750Xi Checklists Page
 * Based on Garmin GTN 750Xi Pilot's Guide Section 4 (pages 4-20 to 4-22)
 * Electronic aircraft checklists with group/checklist selection and completion tracking
 */

class ChecklistsPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Current selections
        this.selectedGroup = null;
        this.selectedChecklist = null;

        // Checklist data (simulates chklist.ace file from SD card)
        this.checklistData = this._loadDefaultChecklists();

        // Completion state (clears on power cycle/page reload per spec)
        this.completionState = {}; // { groupName: { checklistName: [true, false, true, ...] } }

        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this._initialized = true;

        // Auto-select first group and checklist
        if (this.checklistData.groups.length > 0) {
            this.selectedGroup = this.checklistData.groups[0].name;
            if (this.checklistData.groups[0].checklists.length > 0) {
                this.selectedChecklist = this.checklistData.groups[0].checklists[0].name;
            }
        }

        this.render();
    }

    cacheElements() {
        this.elements = {
            groupName: document.getElementById('checklist-group-name'),
            checklistName: document.getElementById('checklist-name'),
            itemsList: document.getElementById('checklist-items'),
            statusBar: document.getElementById('checklist-status')
        };
    }

    bindEvents() {
        // Items list will have dynamically created checkboxes
    }

    /**
     * Load default checklist data (simulates chklist.ace file)
     */
    _loadDefaultChecklists() {
        return {
            title: 'C172 Checklists',
            groups: [
                {
                    name: 'Normal Procedures',
                    checklists: [
                        {
                            name: 'Preflight Inspection',
                            items: [
                                'Aircraft Documents - Check',
                                'Control Lock - Remove',
                                'Master Switch - ON',
                                'Fuel Quantity - Check',
                                'Avionics Master - OFF',
                                'Flaps - Extend',
                                'Pitot Tube Cover - Remove',
                                'Tie Downs - Remove',
                                'Fuel Caps - Secure',
                                'Oil Level - Check'
                            ]
                        },
                        {
                            name: 'Before Engine Start',
                            items: [
                                'Seats & Belts - Adjust & Secure',
                                'Brakes - Test & Set',
                                'Circuit Breakers - Check',
                                'Fuel Selector - BOTH',
                                'Avionics Master - OFF',
                                'Beacon - ON',
                                'Throttle - Open 1/4 inch'
                            ]
                        },
                        {
                            name: 'Engine Start',
                            items: [
                                'Mixture - RICH',
                                'Carb Heat - COLD',
                                'Master Switch - ON',
                                'Prime - As Required',
                                'Area - Clear',
                                'Ignition - START',
                                'Oil Pressure - Check',
                                'Avionics Master - ON',
                                'Lights - As Required'
                            ]
                        },
                        {
                            name: 'Before Takeoff',
                            items: [
                                'Cabin Heat & Defrost - On',
                                'Flight Controls - Free & Correct',
                                'Flight Instruments - Check & Set',
                                'Fuel Selector - BOTH',
                                'Mixture - RICH',
                                'Elevator Trim - Takeoff',
                                'Throttle - 1700 RPM',
                                'Magnetos - Check (drop <125 RPM)',
                                'Carb Heat - Check',
                                'Engine Instruments - Green',
                                'Throttle - 1000 RPM',
                                'Flaps - 0-10°',
                                'Strobes - ON',
                                'Transponder - ALT',
                                'Takeoff Briefing - Complete'
                            ]
                        },
                        {
                            name: 'Normal Takeoff',
                            items: [
                                'Runway - Clear',
                                'Brakes - Release',
                                'Throttle - Full',
                                'Airspeed - Alive',
                                'Rotate - 55 KIAS',
                                'Climb Speed - 70-80 KIAS',
                                'Flaps - Retract above 60 KIAS'
                            ]
                        },
                        {
                            name: 'Cruise',
                            items: [
                                'Power - Set (2200-2500 RPM)',
                                'Mixture - Lean',
                                'Fuel - Monitor',
                                'Flight Instruments - Monitor',
                                'Engine Instruments - Monitor'
                            ]
                        },
                        {
                            name: 'Descent',
                            items: [
                                'ATIS/Weather - Obtain',
                                'Altimeter - Set',
                                'Mixture - Enrich',
                                'Carb Heat - As Required',
                                'Power - Reduce',
                                'Descent Speed - 90-100 KIAS'
                            ]
                        },
                        {
                            name: 'Before Landing',
                            items: [
                                'Seats & Belts - Secure',
                                'Fuel Selector - BOTH',
                                'Mixture - RICH',
                                'Carb Heat - ON',
                                'Landing Light - ON',
                                'Flaps - As Required'
                            ]
                        },
                        {
                            name: 'After Landing',
                            items: [
                                'Flaps - UP',
                                'Carb Heat - COLD',
                                'Transponder - STANDBY',
                                'Strobes - OFF'
                            ]
                        },
                        {
                            name: 'Engine Shutdown',
                            items: [
                                'Parking Brake - SET',
                                'Avionics Master - OFF',
                                'Electrical Equipment - OFF',
                                'Throttle - 1000 RPM',
                                'Mixture - IDLE CUTOFF',
                                'Ignition - OFF',
                                'Master Switch - OFF',
                                'Control Lock - INSTALL'
                            ]
                        }
                    ]
                },
                {
                    name: 'Emergency Procedures',
                    checklists: [
                        {
                            name: 'Engine Fire During Start',
                            items: [
                                'Ignition - START (continue cranking)',
                                'If fire continues: Throttle - Full',
                                'If fire continues: Mixture - IDLE CUTOFF',
                                'If fire continues: Ignition - OFF',
                                'If fire continues: Master - OFF',
                                'If fire continues: Extinguisher - Use',
                                'Fire Out: Inspect damage',
                                'Fire Out: Obtain clearance'
                            ]
                        },
                        {
                            name: 'Engine Fire In Flight',
                            items: [
                                'Mixture - IDLE CUTOFF',
                                'Fuel Selector - OFF',
                                'Master Switch - OFF',
                                'Cabin Heat/Air - OFF',
                                'Airspeed - 100 KIAS',
                                'Land - Immediately'
                            ]
                        },
                        {
                            name: 'Engine Failure',
                            items: [
                                'Airspeed - 65 KIAS (glide)',
                                'Fuel Selector - BOTH',
                                'Mixture - RICH',
                                'Carb Heat - ON',
                                'Primer - In & Locked',
                                'Ignition Switch - BOTH',
                                'If restart fails: Ignition - OFF',
                                'If restart fails: Master - OFF',
                                'If restart fails: Emergency landing'
                            ]
                        },
                        {
                            name: 'Electrical Fire',
                            items: [
                                'Master Switch - OFF',
                                'Vents/Cabin Air - CLOSED',
                                'Fire Extinguisher - Use',
                                'Avionics Master - OFF',
                                'All switches (except ignition) - OFF',
                                'Vents/Cabin Air - Open when fire out',
                                'Master - ON (if required)'
                            ]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Show group/checklist selection menu
     */
    showMenu() {
        if (this.onShowChecklistMenu) {
            this.onShowChecklistMenu({
                groups: this.checklistData.groups,
                currentGroup: this.selectedGroup,
                currentChecklist: this.selectedChecklist,
                onSelectGroup: (groupName) => this.selectGroup(groupName),
                onSelectChecklist: (checklistName) => this.selectChecklist(checklistName),
                onClearCurrent: () => this.clearCurrentChecklist(),
                onClearAll: () => this.clearAllChecklists()
            });
        }
    }

    selectGroup(groupName) {
        this.selectedGroup = groupName;
        // Auto-select first checklist in group
        const group = this.checklistData.groups.find(g => g.name === groupName);
        if (group?.checklists?.length > 0) {
            this.selectedChecklist = group.checklists[0].name;
        }
        this.render();
    }

    selectChecklist(checklistName) {
        this.selectedChecklist = checklistName;
        this.render();
    }

    clearCurrentChecklist() {
        if (!this.selectedGroup || !this.selectedChecklist) return;

        if (!this.completionState[this.selectedGroup]) {
            this.completionState[this.selectedGroup] = {};
        }
        this.completionState[this.selectedGroup][this.selectedChecklist] = [];
        this.render();
    }

    clearAllChecklists() {
        this.completionState = {};
        this.render();
    }

    goToNextChecklist() {
        if (!this.selectedGroup || !this.selectedChecklist) return;

        const group = this.checklistData.groups.find(g => g.name === this.selectedGroup);
        if (!group) return;

        const currentIdx = group.checklists.findIndex(c => c.name === this.selectedChecklist);
        if (currentIdx < 0) return;

        // Try next checklist in current group
        if (currentIdx < group.checklists.length - 1) {
            this.selectedChecklist = group.checklists[currentIdx + 1].name;
            this.render();
            return;
        }

        // Try first checklist in next group
        const groupIdx = this.checklistData.groups.findIndex(g => g.name === this.selectedGroup);
        if (groupIdx < this.checklistData.groups.length - 1) {
            this.selectedGroup = this.checklistData.groups[groupIdx + 1].name;
            this.selectedChecklist = this.checklistData.groups[groupIdx + 1].checklists[0].name;
            this.render();
        }
    }

    toggleItem(groupName, checklistName, itemIndex) {
        if (!this.completionState[groupName]) {
            this.completionState[groupName] = {};
        }
        if (!this.completionState[groupName][checklistName]) {
            this.completionState[groupName][checklistName] = [];
        }

        const state = this.completionState[groupName][checklistName];
        state[itemIndex] = !state[itemIndex];
        this.render();
    }

    render() {
        if (!this._initialized) return;

        const group = this.checklistData.groups.find(g => g.name === this.selectedGroup);
        const checklist = group?.checklists.find(c => c.name === this.selectedChecklist);

        // Update header
        if (this.elements.groupName) {
            this.elements.groupName.textContent = this.selectedGroup || '----';
        }
        if (this.elements.checklistName) {
            this.elements.checklistName.textContent = this.selectedChecklist || '----';
        }

        // Render items
        if (this.elements.itemsList && checklist) {
            this.elements.itemsList.innerHTML = '';

            const state = this.completionState[this.selectedGroup]?.[this.selectedChecklist] || [];

            checklist.items.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'checklist-item';

                const checkbox = document.createElement('div');
                checkbox.className = 'checklist-checkbox';
                if (state[index]) {
                    checkbox.innerHTML = '<span class="check-mark">✓</span>';
                    checkbox.classList.add('checked');
                }

                const text = document.createElement('div');
                text.className = 'checklist-text';
                text.textContent = item;
                if (state[index]) {
                    text.classList.add('completed');
                }

                itemEl.appendChild(checkbox);
                itemEl.appendChild(text);

                itemEl.addEventListener('click', () => {
                    this.toggleItem(this.selectedGroup, this.selectedChecklist, index);
                });

                this.elements.itemsList.appendChild(itemEl);
            });
        }

        // Update status bar
        if (this.elements.statusBar && checklist) {
            const state = this.completionState[this.selectedGroup]?.[this.selectedChecklist] || [];
            const totalItems = checklist.items.length;
            const completedItems = state.filter(Boolean).length;
            const isComplete = completedItems === totalItems;

            this.elements.statusBar.textContent = isComplete ? 'LIST IS FINISHED' : 'LIST NOT FINISHED';
            this.elements.statusBar.className = isComplete ? 'checklist-status complete' : 'checklist-status incomplete';
        }
    }

    destroy() {
        // No intervals to clean up
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChecklistsPage;
}
