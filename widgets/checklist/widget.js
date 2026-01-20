/**
 * Checklist Widget
 * SimWidget Engine v1.0.0
 */

class ChecklistWidget {
    constructor() {
        this.ws = null;
        this.currentPhase = 'preflight';
        this.checklists = {
            preflight: [
                { action: 'Parking Brake', response: 'SET', simvar: 'parkingBrake', auto: true },
                { action: 'Throttle', response: 'IDLE', simvar: 'throttle', auto: true },
                { action: 'Mixture', response: 'RICH', simvar: null },
                { action: 'Fuel Selector', response: 'BOTH', simvar: null },
                { action: 'Avionics', response: 'OFF', simvar: null },
                { action: 'Lights', response: 'AS REQUIRED', simvar: null }
            ],
            startup: [
                { action: 'Battery', response: 'ON', simvar: null },
                { action: 'Fuel Pump', response: 'ON', simvar: null },
                { action: 'Beacon', response: 'ON', simvar: 'beaconLight', auto: true },
                { action: 'Mixture', response: 'RICH', simvar: null },
                { action: 'Starter', response: 'ENGAGE', simvar: 'engineRunning', auto: true },
                { action: 'Oil Pressure', response: 'CHECK', simvar: null }
            ],
            taxi: [
                { action: 'Parking Brake', response: 'RELEASE', simvar: null },
                { action: 'Taxi Light', response: 'ON', simvar: 'taxiLight', auto: true },
                { action: 'NAV Light', response: 'ON', simvar: 'navLight', auto: true },
                { action: 'Flight Controls', response: 'FREE', simvar: null },
                { action: 'Instruments', response: 'CHECK', simvar: null }
            ],
            takeoff: [
                { action: 'Flaps', response: 'T/O POSITION', simvar: null },
                { action: 'Trim', response: 'SET', simvar: null },
                { action: 'Strobes', response: 'ON', simvar: 'strobeLight', auto: true },
                { action: 'Landing Light', response: 'ON', simvar: 'landingLight', auto: true },
                { action: 'Transponder', response: 'ALT', simvar: null },
                { action: 'Throttle', response: 'FULL', simvar: null }
            ],
            cruise: [
                { action: 'Gear', response: 'UP', simvar: 'gearDown', auto: true, invert: true },
                { action: 'Flaps', response: 'UP', simvar: null },
                { action: 'Power', response: 'SET', simvar: null },
                { action: 'Trim', response: 'ADJUST', simvar: null },
                { action: 'Autopilot', response: 'AS REQUIRED', simvar: 'apMaster', auto: true }
            ],
            landing: [
                { action: 'Landing Light', response: 'ON', simvar: 'landingLight', auto: true },
                { action: 'Gear', response: 'DOWN', simvar: 'gearDown', auto: true },
                { action: 'Flaps', response: 'AS REQUIRED', simvar: null },
                { action: 'Speed', response: 'VREF', simvar: null },
                { action: 'Autopilot', response: 'OFF', simvar: null }
            ],
            shutdown: [
                { action: 'Parking Brake', response: 'SET', simvar: 'parkingBrake', auto: true },
                { action: 'Throttle', response: 'IDLE', simvar: null },
                { action: 'Avionics', response: 'OFF', simvar: null },
                { action: 'Mixture', response: 'CUTOFF', simvar: null },
                { action: 'Lights', response: 'OFF', simvar: null },
                { action: 'Battery', response: 'OFF', simvar: null }
            ]
        };
        this.checkedItems = {};
        this.flightData = {};
        this.init();
    }

    init() {
        this.connect();
        this.setupPhases();
        this.setupControls();
        this.render();
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            document.getElementById('conn').classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.flightData = msg.data;
                    this.autoCheck();
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    setupPhases() {
        document.querySelectorAll('.cl-phase').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cl-phase').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPhase = btn.dataset.phase;
                this.render();
            });
        });
    }

    setupControls() {
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.checkedItems[this.currentPhase] = [];
            this.render();
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            const items = this.checklists[this.currentPhase];
            const checked = this.checkedItems[this.currentPhase] || [];
            const nextIndex = checked.length;
            if (nextIndex < items.length) {
                checked.push(nextIndex);
                this.checkedItems[this.currentPhase] = checked;
                this.render();
            }
        });
    }

    autoCheck() {
        const items = this.checklists[this.currentPhase];
        const checked = this.checkedItems[this.currentPhase] || [];

        items.forEach((item, index) => {
            if (item.auto && item.simvar && !checked.includes(index)) {
                let value = this.flightData[item.simvar];
                if (item.invert) value = !value;
                if (value) {
                    checked.push(index);
                }
            }
        });

        this.checkedItems[this.currentPhase] = checked;
        this.render();
    }

    render() {
        const items = this.checklists[this.currentPhase];
        const checked = this.checkedItems[this.currentPhase] || [];

        // Progress
        document.getElementById('progress').textContent = `${checked.length}/${items.length}`;

        // Update phase buttons
        Object.keys(this.checklists).forEach(phase => {
            const btn = document.querySelector(`[data-phase="${phase}"]`);
            const phaseChecked = this.checkedItems[phase] || [];
            const phaseItems = this.checklists[phase];
            if (phaseChecked.length === phaseItems.length && phaseItems.length > 0) {
                btn.classList.add('complete');
            } else {
                btn.classList.remove('complete');
            }
        });

        // Render items
        const listEl = document.getElementById('checklist');
        let html = '';

        items.forEach((item, index) => {
            const isChecked = checked.includes(index);
            const isActive = checked.length === index;
            const cls = `cl-item ${isChecked ? 'checked' : ''} ${isActive ? 'active' : ''}`;

            html += `
                <div class="${cls}" data-index="${index}">
                    <div class="cl-checkbox"></div>
                    <div class="cl-text">
                        <div class="cl-action">${item.action}</div>
                        <div class="cl-response">${item.response}</div>
                    </div>
                    ${item.auto ? '<span class="cl-auto">AUTO</span>' : ''}
                </div>
            `;
        });

        listEl.innerHTML = html;

        // Click handlers
        listEl.querySelectorAll('.cl-item').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                const checked = this.checkedItems[this.currentPhase] || [];
                if (checked.includes(index)) {
                    this.checkedItems[this.currentPhase] = checked.filter(i => i !== index);
                } else {
                    checked.push(index);
                    this.checkedItems[this.currentPhase] = checked;
                }
                this.render();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.checklistWidget = new ChecklistWidget();
});
