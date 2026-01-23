/**
 * Checklist Widget - SimWidget
 * Pre-flight, takeoff, landing, and shutdown checklists for MSFS
 */

const CHECKLISTS = {
    preflight: {
        name: 'Pre-Flight',
        items: [
            { text: 'Battery', action: 'ON' },
            { text: 'Avionics Master', action: 'OFF' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Fuel Shutoff Valve', action: 'ON' },
            { text: 'Flaps', action: 'UP' },
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Circuit Breakers', action: 'CHECK IN' },
            { text: 'Flight Controls', action: 'FREE & CORRECT' }
        ]
    },
    startup: {
        name: 'Engine Start',
        items: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Throttle', action: 'IDLE' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Fuel Pump', action: 'ON' },
            { text: 'Beacon Light', action: 'ON' },
            { text: 'Master Switch', action: 'ON' },
            { text: 'Propeller Area', action: 'CLEAR' },
            { text: 'Ignition', action: 'START' },
            { text: 'Oil Pressure', action: 'CHECK GREEN' },
            { text: 'Alternator', action: 'ON' },
            { text: 'Avionics Master', action: 'ON' },
            { text: 'Radios', action: 'SET' }
        ]
    },
    taxi: {
        name: 'Taxi',
        items: [
            { text: 'ATIS', action: 'RECEIVED' },
            { text: 'Altimeter', action: 'SET' },
            { text: 'Heading Indicator', action: 'SET' },
            { text: 'Nav Lights', action: 'ON' },
            { text: 'Taxi Clearance', action: 'OBTAINED' },
            { text: 'Parking Brake', action: 'RELEASE' },
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Instruments', action: 'CHECK' }
        ]
    },
    takeoff: {
        name: 'Before Takeoff',
        items: [
            { text: 'Flight Controls', action: 'FREE & CORRECT' },
            { text: 'Instruments', action: 'CHECK' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Trim', action: 'SET FOR TAKEOFF' },
            { text: 'Flaps', action: 'SET' },
            { text: 'Transponder', action: 'ALT' },
            { text: 'Lights', action: 'AS REQUIRED' },
            { text: 'Doors & Windows', action: 'LOCKED' },
            { text: 'Seat Belts', action: 'FASTENED' },
            { text: 'Takeoff Clearance', action: 'OBTAINED' }
        ]
    },
    cruise: {
        name: 'Cruise',
        items: [
            { text: 'Power', action: 'SET' },
            { text: 'Mixture', action: 'LEAN AS REQUIRED' },
            { text: 'Trim', action: 'ADJUST' },
            { text: 'Fuel Quantity', action: 'MONITOR' },
            { text: 'Engine Instruments', action: 'MONITOR' },
            { text: 'Autopilot', action: 'AS REQUIRED' },
            { text: 'Nav/GPS', action: 'VERIFY' }
        ]
    },
    landing: {
        name: 'Before Landing',
        items: [
            { text: 'ATIS', action: 'RECEIVED' },
            { text: 'Altimeter', action: 'SET' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Landing Gear', action: 'DOWN & LOCKED' },
            { text: 'Flaps', action: 'AS REQUIRED' },
            { text: 'Airspeed', action: 'CHECK' },
            { text: 'Landing Clearance', action: 'OBTAINED' },
            { text: 'Landing Lights', action: 'ON' }
        ]
    },
    shutdown: {
        name: 'Shutdown',
        items: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Throttle', action: 'IDLE' },
            { text: 'Avionics Master', action: 'OFF' },
            { text: 'Mixture', action: 'CUTOFF' },
            { text: 'Ignition', action: 'OFF' },
            { text: 'Master Switch', action: 'OFF' },
            { text: 'Fuel Selector', action: 'OFF' },
            { text: 'All Lights', action: 'OFF' },
            { text: 'Control Lock', action: 'INSTALLED' }
        ]
    }
};

class ChecklistWidget {
    constructor() {
        this.currentChecklist = 'preflight';
        this.checkedItems = {};
        this.audioEnabled = true;
        this.synth = window.speechSynthesis;

        // Load saved state
        this.loadState();

        // Initialize UI
        this.initTabs();
        this.initControls();
        this.renderChecklist();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('checklist-widget-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.checkedItems = state.checkedItems || {};
                this.audioEnabled = state.audioEnabled !== false;
            }
        } catch (e) {
            console.error('Failed to load checklist state:', e);
        }
    }

    saveState() {
        try {
            localStorage.setItem('checklist-widget-state', JSON.stringify({
                checkedItems: this.checkedItems,
                audioEnabled: this.audioEnabled
            }));
        } catch (e) {
            console.error('Failed to save checklist state:', e);
        }
    }

    initTabs() {
        const tabs = document.getElementById('checklist-tabs');
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const checklist = e.target.dataset.checklist;
                this.switchChecklist(checklist);
            }
        });
    }

    initControls() {
        // Audio toggle
        const audioBtn = document.getElementById('btn-audio');
        audioBtn.classList.toggle('active', this.audioEnabled);
        audioBtn.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            audioBtn.classList.toggle('active', this.audioEnabled);
            audioBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
            this.saveState();
        });

        // Reset button
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        // Nav buttons
        document.getElementById('btn-prev').addEventListener('click', () => {
            this.navigateChecklist(-1);
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            this.navigateChecklist(1);
        });
    }

    switchChecklist(name) {
        this.currentChecklist = name;

        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.checklist === name);
        });

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
        const checklist = CHECKLISTS[this.currentChecklist];

        if (!checklist) return;

        // Clear container
        container.replaceChildren();

        // Initialize checked items for this checklist if needed
        if (!this.checkedItems[this.currentChecklist]) {
            this.checkedItems[this.currentChecklist] = [];
        }

        const checked = this.checkedItems[this.currentChecklist];
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
        this.updateTabStates();
    }

    toggleItem(index) {
        const checklist = CHECKLISTS[this.currentChecklist];
        if (!checklist) return;

        if (!this.checkedItems[this.currentChecklist]) {
            this.checkedItems[this.currentChecklist] = [];
        }

        const checked = this.checkedItems[this.currentChecklist];
        const itemIndex = checked.indexOf(index);

        if (itemIndex === -1) {
            checked.push(index);

            // Speak the item
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

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        // Try to use a British English voice
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
        const checklist = CHECKLISTS[this.currentChecklist];
        if (!checklist) return;

        const checked = this.checkedItems[this.currentChecklist] || [];
        const total = checklist.items.length;
        const completed = checked.length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progress-fill').style.width = percent + '%';
        document.getElementById('progress-text').textContent = completed + '/' + total;
    }

    updateTabStates() {
        document.querySelectorAll('.tab').forEach(tab => {
            const name = tab.dataset.checklist;
            const checklist = CHECKLISTS[name];
            const checked = this.checkedItems[name] || [];

            if (checklist && checked.length === checklist.items.length) {
                tab.classList.add('completed');
            } else {
                tab.classList.remove('completed');
            }
        });
    }

    resetChecklist() {
        this.checkedItems[this.currentChecklist] = [];
        this.saveState();
        this.renderChecklist();
    }

    navigateChecklist(direction) {
        const keys = Object.keys(CHECKLISTS);
        const currentIndex = keys.indexOf(this.currentChecklist);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = keys.length - 1;
        if (newIndex >= keys.length) newIndex = 0;

        this.switchChecklist(keys[newIndex]);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.checklistWidget = new ChecklistWidget();
});
